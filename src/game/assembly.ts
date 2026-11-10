import {Animation} from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Rendering/edgesRenderer';
import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';
import {
  PhysicsMotionType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type {PhysicsBody} from '@babylonjs/core/Physics/v2/physicsBody';
import {makeBoxBody} from '../scene/physics';
import type {PartDef} from './handParts';
import {
  CONVEYOR_BELT_TOP,
  PART_DEFS,
  PRINTER_BED_TOP,
} from './handParts';
import {SnapService} from './snap';

const HISTORY_LIMIT = 50;
const TWEEN_FRAMES = 11;
const GHOST_ALPHA = 0.3;

type Snapshot = {
  pos: Vector3;
  quat: Quaternion;
  placed: boolean;
  screws: number;
};

type PartState = {
  def: PartDef;
  mesh: Mesh;
  ghost: Mesh;
  snap: SnapService;
  body: PhysicsBody | null;
  home: Vector3;
  homeQuat: Quaternion;
  socket: Vector3;
  socketQuat: Quaternion;
  screws: number;
  history: Snapshot[];
  future: Snapshot[];
};

const STANDING_TILT = Math.PI / 2;
const FALLEN_Y = -1;
const SPAWN_DROP = 0.04;
const SPAWN_SLIDE = 0.3;
const SPAWN_FRAMES = 14;
const EMISSIVE_FLASH = 0.45;

export class AssemblyStage {
  private readonly states: PartState[] = [];
  private readonly reducedMotion: boolean;
  private lastTouched = 0;
  private grabbing = false;
  private grabbedBy: string | null = null;
  private readonly ghostMaterial: StandardMaterial;

  onStatus: ((text: string) => void) | null = null;
  onSnapped: ((tag: string) => void) | null = null;
  onPartInfo: ((info: string) => void) | null = null;
  onProgress: ((done: number, total: number) => void) | null = null;

  constructor(
      scene: Scene,
      provider: (def: PartDef, scene: Scene) => Mesh,
      reducedMotion = false,
  ) {
    this.reducedMotion = reducedMotion;
    this.ghostMaterial = new StandardMaterial('ghostMat', scene);
    this.ghostMaterial.diffuseColor = new Color3(0.16, 0.45, 1.0);
    this.ghostMaterial.emissiveColor = new Color3(0.08, 0.26, 0.8);
    this.ghostMaterial.specularColor = new Color3(0.05, 0.05, 0.08);
    this.ghostMaterial.alpha = GHOST_ALPHA;
    this.ghostMaterial.backFaceCulling = false;

    for (const def of PART_DEFS) {
      const mesh = provider(def, scene);
      mesh.setEnabled(false);
      const material = new StandardMaterial(`mat:${def.id}`, scene);
      const diffuse = Color3.FromHexString(def.color);
      material.diffuseColor = diffuse;
      material.emissiveColor = diffuse.scale(0.06);
      material.specularColor = new Color3(0.07, 0.07, 0.08);
      mesh.material = material;
      mesh.position.set(def.home.x, def.home.y, def.home.z);
      mesh.rotationQuaternion = Quaternion.FromEulerAngles(
          STANDING_TILT,
          0,
          0,
      );
      mesh.position.y = this.restHeight(def, mesh);

      const ghost = mesh.clone(`ghost:${def.id}`);
      ghost.material = this.ghostMaterial;
      ghost.isPickable = false;
      ghost.setEnabled(false);
      ghost.position.set(def.socket.x, def.socket.y, def.socket.z);
      ghost.rotationQuaternion = Quaternion.FromEulerAngles(
          STANDING_TILT,
          def.socketYaw,
          0,
      );
      ghost.enableEdgesRendering();
      ghost.edgesWidth = 3;
      ghost.edgesColor = new Color4(0.35, 0.65, 1.0, 0.95);

      const state: PartState = {
        def,
        mesh,
        ghost,
        snap: new SnapService(ghost, def.snapRadius),
        body: null,
        home: mesh.position.clone(),
        homeQuat: mesh.rotationQuaternion.clone(),
        socket: ghost.position.clone(),
        socketQuat: ghost.rotationQuaternion.clone(),
        screws: 0,
        history: [],
        future: [],
      };
      state.history.push(this.capture(state));
      this.states.push(state);
    }
    this.spawnCurrent();
    scene.onBeforeRenderObservable.add(() => this.recoverFallen());
  }

  get currentPart(): Mesh {
    return this.active.mesh;
  }

  private get active(): PartState {
    const state = this.states[this.current];
    if (!state) {
      throw new Error('assembly has no current part');
    }
    return state;
  }

  get currentIndex(): number {
    return this.current;
  }

  private get current(): number {
    const index = this.states.findIndex((state) => !this.isDone(state));
    return index === -1 ? this.states.length : index;
  }

  private isDone(state: PartState): boolean {
    return state.snap.isComplete && state.screws >= state.def.screwCount;
  }

  isGrabCandidate(mesh: unknown): boolean {
    const root = this.resolveRoot(mesh);
    return root !== null && root === this.active.mesh;
  }

  startGrab(tag: string): boolean {
    const state = this.active;
    if (this.grabbing || state.snap.isComplete) {
      return false;
    }
    this.grabbing = true;
    this.grabbedBy = tag;
    this.setBodyMotion(state, PhysicsMotionType.ANIMATED);
    this.report(
        `Carrying the ${state.def.label}. ` +
        'Release it inside the blue outline.',
    );
    return true;
  }

  moveGrabbed(position: Vector3): void {
    if (!this.grabbing) {
      return;
    }
    this.active.mesh.position.copyFrom(position);
  }

  attachTo(node: unknown): void {
    if (this.grabbing) {
      this.active.mesh.setParent(node as Mesh | null);
    }
  }

  endGrab(tag: string): void {
    if (!this.grabbing || this.grabbedBy !== tag) {
      return;
    }
    this.grabbing = false;
    this.grabbedBy = null;
    const state = this.active;

    if (state.mesh.parent !== null) {
      state.mesh.rotationQuaternion ??= Quaternion.FromEulerAngles(
          state.mesh.rotation.x,
          state.mesh.rotation.y,
          state.mesh.rotation.z,
      );
      state.mesh.setParent(null);
    }

    this.lastTouched = this.current;
    if (state.snap.trySnap(state.mesh.position)) {
      this.placePart(state, tag);
    } else {
      this.setBodyMotion(state, PhysicsMotionType.DYNAMIC);
      this.report('Release inside the blue outline to place the part.');
      this.commit(state);
      this.reportPartInfo(state);
    }
  }

  reset(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const state = this.active;
    state.snap.reset();
    state.screws = 0;
    this.setBodyMotion(state, PhysicsMotionType.STATIC);
    this.restore(state);
    this.tweenTo(state, state.home, state.homeQuat);
    this.commit(state, {
      pos: state.home.clone(),
      quat: state.homeQuat.clone(),
      placed: false,
      screws: 0,
    });
    this.report(
        `${state.def.label} returned. ` +
        'Grab it and slot it into the blue outline.',
    );
    this.reportPartInfo(state);
  }

  undo(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const state = this.states[this.lastTouched];
    if (!state || state.history.length <= 1) {
      this.report('Nothing to undo.');
      return;
    }
    const popped = state.history.pop();
    if (popped) {
      state.future.push(popped);
    }
    const snapshot = state.history.at(-1);
    if (snapshot) {
      this.apply(state, snapshot);
    }
    this.syncVisibility();
    this.report('Undo.');
    this.reportPartInfo(state);
  }

  redo(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const state = this.states[this.lastTouched];
    if (!state) {
      this.report('Nothing to redo.');
      return;
    }
    const snapshot = state.future.pop();
    if (!snapshot) {
      this.report('Nothing to redo.');
      return;
    }
    state.history.push(snapshot);
    this.apply(state, snapshot);
    this.syncVisibility();
    this.report('Redo.');
    this.reportPartInfo(state);
  }

  private resolveRoot(mesh: unknown): Mesh | null {
    let node = mesh as Mesh | null;
    while (node?.parent) {
      node = node.parent as Mesh;
    }
    return node;
  }

  private placePart(state: PartState, tag: string): void {
    state.screws = state.def.screwCount;
    this.setBodyMotion(state, PhysicsMotionType.STATIC);
    this.tweenTo(state, state.socket, state.socketQuat);
    state.ghost.setEnabled(false);
    this.commit(state, {
      pos: state.socket.clone(),
      quat: state.socketQuat.clone(),
      placed: true,
      screws: state.def.screwCount,
    });
    this.report(`${state.def.label} mounted.`);
    this.onSnapped?.(tag);
    this.advanceQueue();
  }

  private advanceQueue(): void {
    const done = this.states.filter((state) => this.isDone(state)).length;
    this.onProgress?.(done, this.states.length);
    if (done >= this.states.length) {
      this.report('HAND COMPLETE! Take a bow.');
      return;
    }
    this.spawnCurrent();
  }

  private syncVisibility(): void {
    this.states.forEach((state, index) => {
      const active = index === this.current;
      state.mesh.setEnabled(state.snap.isComplete || active);
      state.ghost.setEnabled(!state.snap.isComplete && active);
    });
  }

  private spawnCurrent(): void {
    const state = this.active;
    this.syncVisibility();
    this.setBodyMotion(state, PhysicsMotionType.STATIC);
    state.mesh.position.copyFrom(state.home);
    state.mesh.rotationQuaternion = state.homeQuat.clone();
    const printer = state.def.source === 'printer';
    if (!this.reducedMotion) {
      const from = state.home.clone();
      if (printer) {
        from.y += SPAWN_DROP;
      } else {
        from.z -= SPAWN_SLIDE;
      }
      state.mesh.position.copyFrom(from);
      this.tweenTo(state, state.home, state.homeQuat);
      this.flash(state);
    }
    const source = printer ? 'printer' : 'conveyor';
    this.report(`Next part: the ${state.def.label}, at the ${source}.`);
    this.reportPartInfo(state);
  }

  private flash(state: PartState): void {
    const material = state.mesh.material as StandardMaterial;
    const base = Color3.FromHexString(state.def.color);
    Animation.CreateAndStartAnimation(
        'partFlash',
        material,
        'emissiveColor',
        60,
        SPAWN_FRAMES,
        base.scale(EMISSIVE_FLASH),
        base.scale(0.06),
        0,
    );
  }

  private restHeight(def: PartDef, mesh: Mesh): number {
    const base =
        def.source === 'printer' ? PRINTER_BED_TOP : CONVEYOR_BELT_TOP;
    const {min, max} = mesh.getHierarchyBoundingVectors();
    return base + (max.y - min.y) / 2;
  }

  private ensureBody(state: PartState): PhysicsBody | null {
    if (!state.body) {
      state.body =
          makeBoxBody(state.mesh, PhysicsMotionType.STATIC, 1);
    }
    return state.body;
  }

  private setBodyMotion(
      state: PartState,
      motion: PhysicsMotionType,
  ): void {
    const body = this.ensureBody(state);
    if (!body) {
      return;
    }
    body.setMotionType(motion);
    if (motion === PhysicsMotionType.DYNAMIC) {
      body.disablePreStep = true;
      body.setLinearVelocity(Vector3.Zero());
      body.setAngularVelocity(Vector3.Zero());
    } else {
      body.disablePreStep = false;
    }
  }

  private recoverFallen(): void {
    if (this.grabbing || this.states.length === 0) {
      return;
    }
    const state = this.states[this.current];
    if (!state || !state.body) {
      return;
    }
    const dynamic = state.body.motionType === PhysicsMotionType.DYNAMIC;
    if (dynamic && state.mesh.position.y < FALLEN_Y) {
      this.reset();
    }
  }

  private restore(state: PartState): void {
    state.ghost.setEnabled(true);
    const material = state.mesh.material as StandardMaterial;
    material.emissiveColor =
        Color3.FromHexString(state.def.color).scale(0.06);
  }

  private capture(state: PartState): Snapshot {
    return {
      pos: state.mesh.position.clone(),
      quat: (state.mesh.rotationQuaternion ?? Quaternion.Identity()).clone(),
      placed: state.snap.isComplete,
      screws: state.screws,
    };
  }

  private commit(state: PartState, target?: Snapshot): void {
    state.history.push(target ?? this.capture(state));
    if (state.history.length > HISTORY_LIMIT) {
      state.history.shift();
    }
    state.future.length = 0;
  }

  private apply(state: PartState, snapshot: Snapshot): void {
    if (snapshot.placed && !state.snap.isComplete) {
      state.snap.forceComplete();
      state.ghost.setEnabled(false);
    } else if (!snapshot.placed && state.snap.isComplete) {
      state.snap.reset();
      this.restore(state);
    }
    state.screws = snapshot.screws;
    this.setBodyMotion(state, PhysicsMotionType.STATIC);
    this.tweenTo(state, snapshot.pos, snapshot.quat);
  }

  private tweenTo(
      state: PartState,
      position: Vector3,
      rotation: Quaternion,
  ): void {
    Animation.CreateAndStartAnimation(
        'partMove',
        state.mesh,
        'position',
        60,
        TWEEN_FRAMES,
        state.mesh.position.clone(),
        position,
        0,
    );
    Animation.CreateAndStartAnimation(
        'partRotate',
        state.mesh,
        'rotationQuaternion',
        60,
        TWEEN_FRAMES,
        state.mesh.rotationQuaternion?.clone() ?? Quaternion.Identity(),
        rotation,
        0,
    );
  }

  private reportPartInfo(state: PartState): void {
    const pos = state.mesh.position;
    this.onPartInfo?.(
        `${state.def.id}:${pos.x.toFixed(2)},${pos.y.toFixed(2)},` +
        `${pos.z.toFixed(2)}`,
    );
  }

  private report(text: string): void {
    this.onStatus?.(text);
  }
}
