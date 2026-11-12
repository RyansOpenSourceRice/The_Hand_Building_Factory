import {Animation} from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Rendering/edgesRenderer';
import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Matrix, Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';
import {
  PhysicsMotionType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import type {PhysicsBody} from '@babylonjs/core/Physics/v2/physicsBody';
import {createScrew} from '../scene/screwMeshes';
import {ArrowGuides} from './arrows';
import {makeBoxBody} from '../scene/physics';
import type {PartDef, PartSource} from './handParts';
import {
  CONVEYOR_BELT_TOP,
  CONVEYOR_PATH,
  PART_DEFS,
  PRINTER_BED_TOP,
} from './handParts';
import {SnapService} from './snap';

const HISTORY_LIMIT = 50;
const TWEEN_FRAMES = 11;
const GHOST_ALPHA = 0.24;
const DRIVE_SECONDS = 1.5;
const DRIVE_RADIUS = 0.09;
const RATCHET_EVERY = 0.12;
const STICK_OUT = 0.012;

function clampSteps(count: number, max: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.min(Math.floor(count), max);
}

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
  screws: Mesh[] | null;
  home: Vector3;
  homeQuat: Quaternion;
  socket: Vector3;
  socketQuat: Quaternion;
  center: Vector3;
  screwsDone: number;
  history: Snapshot[];
  future: Snapshot[];
};

const STANDING_TILT = Math.PI / 2;
const FALLEN_Y = -1;
const REST_GAP = 0.005;
const SPAWN_DROP = 0.04;
const SPAWN_FRAMES = 14;
const SPAWN_RIDE_FRAMES = 72;
const EMISSIVE_FLASH = 0.45;

export type StageGuidance = {
  label: string;
  phase: string;
  phaseIndex: number;
  phaseTotal: number;
  source: PartSource;
  hostId: string;
  hostLabel: string;
  screwsDone: number;
  screwCount: number;
  snapped: boolean;
  grabbing: boolean;
  complete: boolean;
};

export class AssemblyStage {
  private readonly states: PartState[] = [];
  private readonly reducedMotion: boolean;
  private lastTouched = 0;
  private grabbing = false;
  private grabbedBy: string | null = null;
  private driveTarget = -1;
  private driveProgress = 0;
  private ratchetClock = 0;
  private readonly ghostMaterial: StandardMaterial;
  private readonly arrows: ArrowGuides;

  onStatus: ((text: string) => void) | null = null;
  onSnapped: ((tag: string) => void) | null = null;
  onRatchet: ((tag: string) => void) | null = null;
  onScrewDriven: ((tag: string) => void) | null = null;
  onPartInfo: ((info: string) => void) | null = null;
  onProgress: ((done: number, total: number) => void) | null = null;
  onDropped: (() => void) | null = null;
  onAnnounce: ((id: string) => void) | null = null;
  onPhase: ((phase: string, total: number) => void) | null = null;
  onGrab: (() => void) | null = null;
  onMounted:
      ((screwCount: number, phase: string, hostLabel: string,
        firstInPhase: boolean) => void) | null = null;

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
    this.arrows = new ArrowGuides(scene);

    for (const def of PART_DEFS) {
      const mesh = provider(def, scene);
      mesh.setEnabled(false);
      mesh.position.set(def.home.x, def.home.y, def.home.z);
      mesh.rotationQuaternion = Quaternion.FromEulerAngles(
          STANDING_TILT,
          0,
          0,
      );
      mesh.position.y = this.restHeight(def, mesh);

      mesh.refreshBoundingInfo();
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
      if (!def.file) {
        ghost.enableEdgesRendering();
        ghost.edgesWidth = 2;
        ghost.edgesColor = new Color4(0.35, 0.65, 1.0, 0.95);
      }

      const state: PartState = {
        def,
        mesh,
        ghost,
        snap: new SnapService(ghost, def.snapRadius),
        body: null,
        screws: null,
        home: mesh.position.clone(),
        homeQuat: mesh.rotationQuaternion.clone(),
        socket: ghost.position.clone(),
        socketQuat: ghost.rotationQuaternion.clone(),
        center: mesh.getBoundingInfo().boundingBox.center.clone(),
        screwsDone: 0,
        history: [],
        future: [],
      };
      state.history.push(this.capture(state));
      this.states.push(state);
    }
    this.spawnCurrent();
    scene.onBeforeRenderObservable.add(() => this.recoverFallen());
    scene.onBeforeRenderObservable.add(() => {
      const state = this.states[this.current];
      if (state?.ghost.isEnabled()) {
        state.ghost.visibility =
            0.78 + Math.sin(performance.now() / 480) * 0.12;
      }
      if (state?.snap.isComplete) {
        this.arrows.clearParts();
        this.arrows.setScrewTargets(
            this.screwSites(), this.remainingAxes(state));
      } else if (state) {
        this.arrows.clearScrews();
        this.arrows.setPartTargets(
            state.mesh.getAbsolutePosition(),
            state.ghost.getAbsolutePosition(),
        );
      } else {
        this.arrows.clearParts();
        this.arrows.clearScrews();
      }
      this.arrows.tick(performance.now() / 1000);
    });
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

  partColor(id: string): string {
    const state = this.states.find((entry) => entry.def.id === id);
    if (!state) {
      return '';
    }
    const material = state.mesh.material as StandardMaterial;
    return material.diffuseColor.toHexString();
  }

  guidance(): StageGuidance {
    const state = this.states[this.current];
    if (!state) {
      return {
        label: '',
        phase: '',
        phaseIndex: 0,
        phaseTotal: 0,
        source: 'printer',
        hostId: '',
        hostLabel: '',
        screwsDone: 0,
        screwCount: 0,
        snapped: false,
        grabbing: false,
        complete: true,
      };
    }
    const siblings = this.states.filter(
        (entry) => entry.def.phase === state.def.phase);
    return {
      label: state.def.label,
      phase: state.def.phase,
      phaseIndex: siblings.indexOf(state) + 1,
      phaseTotal: siblings.length,
      source: state.def.source,
      hostId: state.def.hostId,
      hostLabel: state.def.hostLabel,
      screwsDone: state.screwsDone,
      screwCount: state.def.screwCount,
      snapped: state.snap.isComplete,
      grabbing: this.grabbing,
      complete: false,
    };
  }

  currentHostId(): string | null {
    const state = this.states[this.current];
    if (!state || state.snap.isComplete) {
      return null;
    }
    return state.def.hostId;
  }

  hostMesh(id: string): Mesh | null {
    return this.states.find((state) => state.def.id === id)?.mesh ?? null;
  }

  activeCenter(): Vector3 {
    const {min, max} = this.active.mesh.getHierarchyBoundingVectors();
    return Vector3.Center(min, max);
  }

  private get current(): number {
    const index = this.states.findIndex((state) => !this.isDone(state));
    return index === -1 ? this.states.length : index;
  }

  private isDone(state: PartState): boolean {
    return state.snap.isComplete &&
        state.screwsDone >= state.def.screwCount;
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
    this.onGrab?.();
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

  endGrab(tag: string, allowSnap = true): void {
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
    if (allowSnap && state.snap.trySnap(state.mesh.position)) {
      this.placePart(state, tag);
    } else {
      this.setBodyMotion(state, PhysicsMotionType.DYNAMIC);
      this.report('Release inside the blue outline to place the part.');
      this.commit(state);
      this.reportPartInfo(state);
      this.onDropped?.();
    }
  }

  reset(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const state = this.active;
    state.snap.reset();
    state.screwsDone = 0;
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

  restart(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    this.stopDrive();
    for (const state of this.states) {
      state.snap.reset();
      state.screwsDone = 0;
      state.history.length = 0;
      state.future.length = 0;
      this.setBodyMotion(state, PhysicsMotionType.STATIC);
      state.mesh.position.copyFrom(state.home);
      state.mesh.rotationQuaternion = state.homeQuat.clone();
      if (state.screws) {
        this.refreshScrews(state);
      }
      state.history.push(this.capture(state));
    }
    this.lastTouched = 0;
    this.syncVisibility();
    this.spawnCurrent();
    this.onProgress?.(0, this.states.length);
    this.report('Starting over. The first part is waiting.');
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

  undoDepth(): number {
    const state = this.states[this.lastTouched];
    return state ? Math.max(0, state.history.length - 1) : 0;
  }

  redoDepth(): number {
    const state = this.states[this.lastTouched];
    return state ? state.future.length : 0;
  }

  undoMany(count: number): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const steps = clampSteps(count, this.undoDepth());
    for (let i = 0; i < steps; i++) {
      this.undo();
    }
    if (steps > 0) {
      this.report(`Undone ${steps} step${steps === 1 ? '' : 's'}.`);
    }
  }

  redoMany(count: number): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const steps = clampSteps(count, this.redoDepth());
    for (let i = 0; i < steps; i++) {
      this.redo();
    }
    if (steps > 0) {
      this.report(`Redone ${steps} step${steps === 1 ? '' : 's'}.`);
    }
  }

  private resolveRoot(mesh: unknown): Mesh | null {
    let node = mesh as Mesh | null;
    while (node?.parent) {
      node = node.parent as Mesh;
    }
    return node;
  }

  arrowCount(): number {
    return this.arrows.count();
  }

  private remainingAxes(state: PartState): Vector3[] {
    const axes: Vector3[] = [];
    for (let i = state.screwsDone; i < state.def.screwCount; i++) {
      axes.push(this.screwAxis(state, i));
    }
    return axes;
  }

  screwSites(): Vector3[] {
    const state = this.states[this.current];
    if (!state || !state.snap.isComplete || !state.screws) {
      return [];
    }
    const sites: Vector3[] = [];
    for (let i = state.screwsDone; i < state.screws.length; i++) {
      const screw = state.screws[i];
      if (screw) {
        sites.push(screw.getAbsolutePosition());
      }
    }
    return sites;
  }

  driveTick(
      dt: number,
      tip: Vector3 | null,
      held: boolean,
      tag: string,
  ): void {
    const state = this.states[this.current];
    if (!state || this.grabbing || !held || !state.snap.isComplete) {
      this.stopDrive();
      return;
    }
    let target = -1;
    let best = DRIVE_RADIUS;
    const sites = this.screwSites();
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (!site || !tip) {
        continue;
      }
      const distance = Vector3.Distance(tip, site);
      if (distance < best) {
        best = distance;
        target = i;
      }
    }
    if (target !== this.driveTarget) {
      this.driveTarget = target;
      this.driveProgress = 0;
    }
    if (target === -1 || !tip) {
      return;
    }
    this.driveProgress += dt / DRIVE_SECONDS;
    this.ratchetClock += dt;
    if (this.ratchetClock >= RATCHET_EVERY) {
      this.ratchetClock = 0;
      this.onRatchet?.(tag);
    }
    if (this.driveProgress >= 1) {
      this.driveOne(state, tag);
    }
  }

  private driveOne(state: PartState, tag: string): void {
    state.screwsDone++;
    const index = state.screwsDone - 1;
    const screw = state.screws?.[index];
    if (screw) {
      Animation.CreateAndStartAnimation(
          'screwSink',
          screw,
          'position',
          60,
          TWEEN_FRAMES,
          screw.position.clone(),
          this.screwPos(state, index),
          Animation.ANIMATIONLOOPMODE_CONSTANT,
      );
    }
    this.stopDrive();
    this.commit(state);
    this.lastTouched = this.states.indexOf(state);
    this.onScrewDriven?.(tag);
    const total = state.def.screwCount;
    if (state.screwsDone >= total) {
      this.advanceQueue();
    } else {
      this.report(`Screw ${state.screwsDone} of ${total} driven.`);
    }
  }

  private stopDrive(): void {
    this.driveTarget = -1;
    this.driveProgress = 0;
    this.ratchetClock = 0;
  }

  private screwPos(state: PartState, index: number): Vector3 {
    const offset = state.def.screwOffsets[index];
    if (!offset) {
      return Vector3.Zero();
    }
    return state.center.add(this.toLocalNormal(
        state,
        new Vector3(offset.x, offset.y, offset.z),
    ));
  }

  private screwAxis(state: PartState, index: number): Vector3 {
    const offset = state.def.screwOffsets[index];
    const sign = offset && offset.z !== 0 ? Math.sign(offset.z) : 1;
    return this.toLocalNormal(state, new Vector3(0, 0, sign));
  }

  private toLocalNormal(state: PartState, world: Vector3): Vector3 {
    const rotation = new Matrix();
    Matrix.FromQuaternionToRef(state.socketQuat, rotation);
    return Vector3.TransformNormal(world, Matrix.Transpose(rotation));
  }

  private buildScrews(state: PartState): void {
    if (state.screws) {
      this.refreshScrews(state);
      return;
    }
    state.screws = state.def.screwOffsets.map((_, index) => {
      const screw =
          createScrew(`${state.def.id}-${index}`, state.mesh.getScene());
      screw.parent = state.mesh;
      return screw;
    });
    this.refreshScrews(state);
  }

  private refreshScrews(state: PartState): void {
    if (!state.screws) {
      return;
    }
    state.screws.forEach((screw, index) => {
      const pos = this.screwPos(state, index);
      const axis = this.screwAxis(state, index);
      screw.rotationQuaternion = this.orientYTo(axis);
      const driven = index < state.screwsDone;
      screw.position.copyFrom(driven ? pos : pos.add(axis.scale(STICK_OUT)));
      screw.setEnabled(state.snap.isComplete);
    });
  }

  private orientYTo(axis: Vector3): Quaternion {
    const up = Vector3.Up();
    const dot = Vector3.Dot(up, axis);
    if (dot > 0.999) {
      return Quaternion.Identity();
    }
    if (dot < -0.999) {
      return Quaternion.FromEulerAngles(Math.PI, 0, 0);
    }
    const cross = Vector3.Cross(up, axis);
    cross.normalize();
    return Quaternion.RotationAxis(cross, Math.acos(dot));
  }

  private placePart(state: PartState, tag: string): void {
    state.screwsDone = 0;
    this.setBodyMotion(state, PhysicsMotionType.STATIC);
    this.tweenTo(state, state.socket, state.socketQuat);
    state.ghost.setEnabled(false);
    this.buildScrews(state);
    const count = state.def.screwCount;
    this.commit(state, {
      pos: state.socket.clone(),
      quat: state.socketQuat.clone(),
      placed: true,
      screws: 0,
    });
    this.lastTouched = this.states.indexOf(state);
    this.report(count === 1 ?
        `${state.def.label} mounted. ` +
        'Press B or Y for the screwdriver, then touch its tip to the screw.' :
        `${state.def.label} mounted. Press B or Y for the screwdriver, ` +
        `then touch its tip to each of the ${count} screws.`);
    this.onSnapped?.(tag);
    const siblings = this.states.filter(
        (entry) => entry.def.phase === state.def.phase);
    this.onMounted?.(
        count,
        state.def.phase,
        state.def.hostLabel,
        siblings[0] === state,
    );
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
      if (printer) {
        const from = state.home.clone();
        from.y += SPAWN_DROP;
        state.mesh.position.copyFrom(from);
        this.tweenTo(state, state.home, state.homeQuat);
      } else {
        this.rideConveyor(state);
      }
      this.flash(state);
    }
    const source = printer ? 'printer' : 'conveyor';
    this.announce(state, source);
  }

  announceCurrent(): void {
    const state = this.active;
    const printer = state.def.source === 'printer';
    this.announce(state, printer ? 'printer' : 'conveyor');
  }

  private announce(state: PartState, source: string): void {
    this.report(`Next part: the ${state.def.label}, at the ${source}.`);
    this.reportPartInfo(state);
    this.onAnnounce?.(state.def.id);
    const siblings = this.states.filter(
        (entry) => entry.def.phase === state.def.phase);
    if (siblings[0] === state) {
      this.onPhase?.(state.def.phase, siblings.length);
    }
  }

  private rideConveyor(state: PartState): void {
    const frames = SPAWN_RIDE_FRAMES + SPAWN_FRAMES;
    const keys = CONVEYOR_PATH.map((point, index) => ({
      frame: Math.round((index / CONVEYOR_PATH.length) * SPAWN_RIDE_FRAMES),
      value: new Vector3(point.x, point.y, point.z),
    }));
    keys.push({
      frame: frames,
      value: state.home.clone(),
    });
    const ride = new Animation(
        'partRide',
        'position',
        60,
        Animation.ANIMATIONTYPE_VECTOR3,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    ride.setKeys(keys);
    state.mesh.getScene().beginDirectAnimation(
        state.mesh, [ride], 0, frames, false);
  }

  private flash(state: PartState): void {
    const material = state.mesh.material;
    if (!(material instanceof StandardMaterial)) {
      return;
    }
    const base = material.diffuseColor;
    Animation.CreateAndStartAnimation(
        'partFlash',
        material,
        'emissiveColor',
        60,
        SPAWN_FRAMES,
        base.scale(EMISSIVE_FLASH),
        base.scale(0.06),
        Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
  }

  private restHeight(def: PartDef, mesh: Mesh): number {
    const base =
        def.source === 'printer' ? PRINTER_BED_TOP : CONVEYOR_BELT_TOP;
    const {min} = mesh.getHierarchyBoundingVectors();
    return mesh.position.y + (base - min.y) + REST_GAP;
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
    const material = state.mesh.material;
    if (material instanceof StandardMaterial) {
      material.emissiveColor = material.diffuseColor.scale(0.06);
    }
  }

  private capture(state: PartState): Snapshot {
    return {
      pos: state.mesh.position.clone(),
      quat: (state.mesh.rotationQuaternion ?? Quaternion.Identity()).clone(),
      placed: state.snap.isComplete,
      screws: state.screwsDone,
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
      this.buildScrews(state);
    } else if (!snapshot.placed && state.snap.isComplete) {
      state.snap.reset();
      this.restore(state);
    }
    state.screwsDone = snapshot.screws;
    this.refreshScrews(state);
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
        Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    Animation.CreateAndStartAnimation(
        'partRotate',
        state.mesh,
        'rotationQuaternion',
        60,
        TWEEN_FRAMES,
        state.mesh.rotationQuaternion?.clone() ?? Quaternion.Identity(),
        rotation,
        Animation.ANIMATIONLOOPMODE_CONSTANT,
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
