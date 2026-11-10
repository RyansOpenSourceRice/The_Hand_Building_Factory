import {Animation} from '@babylonjs/core/Animations/animation';
import '@babylonjs/core/Rendering/edgesRenderer';
import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';
import {SnapService} from './snap';

const PART_HOME_OFFSET = 0.14;
const GHOST_HEIGHT_ABOVE_BENCH = 0.55;

type Snapshot = {
  pos: Vector3;
  quat: Quaternion;
  placed: boolean;
};

const HISTORY_LIMIT = 50;

export class DemoStage {
  readonly part: Mesh;
  readonly ghost: Mesh;
  readonly snap: SnapService;
  onStatus: ((text: string) => void) | null = null;
  onSnapped: ((tag: string) => void) | null = null;
  private readonly partHome: Vector3;
  private readonly ghostHome: Vector3;
  private readonly history: Snapshot[] = [];
  private readonly future: Snapshot[] = [];
  private grabbing = false;
  private grabbedBy: string | null = null;

  constructor(scene: Scene, opts: { pedestalTop: number }) {
    this.partHome = new Vector3(0, opts.pedestalTop + PART_HOME_OFFSET, 0);
    this.ghostHome =
        new Vector3(0.85, opts.pedestalTop + GHOST_HEIGHT_ABOVE_BENCH, -0.15);

    this.part = MeshBuilder.CreateBox('part', {size: 0.22}, scene);
    this.part.position.copyFrom(this.partHome);
    this.part.rotationQuaternion =
        Quaternion.FromEulerAngles(0, Math.PI / 8, 0);
    const partMat = new StandardMaterial('partMat', scene);
    partMat.diffuseColor = new Color3(0.82, 0.12, 0.14);
    partMat.emissiveColor = new Color3(0.16, 0.02, 0.03);
    partMat.specularColor = new Color3(0.08, 0.08, 0.08);
    this.part.material = partMat;

    this.ghost = MeshBuilder.CreateBox('ghost', {size: 0.26}, scene);
    this.ghost.position.copyFrom(this.ghostHome);
    const ghostMat = new StandardMaterial('ghostMat', scene);
    ghostMat.diffuseColor = new Color3(0.16, 0.45, 1.0);
    ghostMat.emissiveColor = new Color3(0.08, 0.26, 0.8);
    ghostMat.specularColor = new Color3(0.05, 0.05, 0.08);
    ghostMat.alpha = 0.32;
    ghostMat.backFaceCulling = false;
    this.ghost.material = ghostMat;
    this.ghost.enableEdgesRendering();
    this.ghost.edgesWidth = 3;
    this.ghost.edgesColor = new Color4(0.35, 0.65, 1.0, 0.95);

    this.snap = new SnapService(this.ghost, 0.22);
    this.history.push(this.capture());
  }

  isGrabCandidate(mesh: unknown): boolean {
    return mesh === this.part && !this.snap.isComplete;
  }

  get isHeld(): boolean {
    return this.grabbing;
  }

  startGrab(tag: string): boolean {
    if (this.grabbing || this.snap.isComplete) {
      return false;
    }
    this.grabbing = true;
    this.grabbedBy = tag;
    this.report('Carrying the part. Release it inside the blue outline.');
    return true;
  }

  moveGrabbed(position: Vector3): void {
    if (!this.grabbing) {
      return;
    }
    this.part.position.copyFrom(position);
  }

  endGrab(tag: string): void {
    if (!this.grabbing || this.grabbedBy !== tag) {
      return;
    }
    this.grabbing = false;
    this.grabbedBy = null;

    if (this.part.parent !== null) {
      this.part.rotationQuaternion ??= Quaternion.FromEulerAngles(
          this.part.rotation.x,
          this.part.rotation.y,
          this.part.rotation.z,
      );
      this.part.setParent(null);
    }

    if (this.snap.trySnap(this.part.position)) {
      this.playSnapSuccess(tag);
      this.commit({
        pos: this.snap.position.clone(),
        quat: Quaternion.Identity(),
        placed: true,
      });
    } else {
      this.report('Release inside the blue outline to place the part.');
      this.commit();
    }
  }

  reset(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    this.snap.reset();
    this.restoreGhost();
    const quat = this.part.rotationQuaternion ?? Quaternion.Identity();
    this.tweenPartTo(this.partHome, quat);
    this.commit({
      pos: this.partHome.clone(),
      quat: quat.clone(),
      placed: false,
    });
    this.report('Part returned. Grab it and slot it into the blue outline.');
  }

  undo(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    if (this.history.length <= 1) {
      this.report('Nothing to undo.');
      return;
    }
    const popped = this.history.pop();
    if (popped) {
      this.future.push(popped);
    }
    const snapshot = this.history.at(-1);
    if (snapshot) {
      this.apply(snapshot);
    }
    this.report('Undo.');
  }

  redo(): void {
    if (this.grabbing) {
      this.report('Finish carrying the part first.');
      return;
    }
    const snapshot = this.future.pop();
    if (!snapshot) {
      this.report('Nothing to redo.');
      return;
    }
    this.history.push(snapshot);
    this.apply(snapshot);
    this.report('Redo.');
  }

  private capture(): Snapshot {
    return {
      pos: this.part.position.clone(),
      quat: (this.part.rotationQuaternion ?? Quaternion.Identity()).clone(),
      placed: this.snap.isComplete,
    };
  }

  private commit(target?: Snapshot): void {
    this.history.push(target ?? this.capture());
    if (this.history.length > HISTORY_LIMIT) {
      this.history.shift();
    }
    this.future.length = 0;
  }

  private apply(snapshot: Snapshot): void {
    if (snapshot.placed && !this.snap.isComplete) {
      this.snap.forceComplete();
      this.ghost.setEnabled(false);
    } else if (!snapshot.placed && this.snap.isComplete) {
      this.snap.reset();
      this.restoreGhost();
    }
    this.tweenPartTo(snapshot.pos, snapshot.quat);
  }

  private playSnapSuccess(tag: string): void {
    this.tweenPartTo(this.snap.position, Quaternion.Identity());
    this.ghost.setEnabled(false);
    const ghostMat = this.ghost.material as StandardMaterial;
    ghostMat.alpha = 0.32;
    const partMat = this.part.material as StandardMaterial;
    Animation.CreateAndStartAnimation(
        'partGlow',
        partMat,
        'emissiveColor',
        60,
        12,
        partMat.emissiveColor.clone(),
        new Color3(0.45, 0.08, 0.1),
        0,
    );
    this.report('PART COMPLETE');
    this.onSnapped?.(tag);
  }

  private restoreGhost(): void {
    this.ghost.setEnabled(true);
    this.ghost.position.copyFrom(this.ghostHome);
    const ghostMat = this.ghost.material as StandardMaterial;
    ghostMat.alpha = 0.32;
    const partMat = this.part.material as StandardMaterial;
    partMat.emissiveColor = new Color3(0.16, 0.02, 0.03);
  }

  private tweenPartTo(position: Vector3, rotation: Quaternion): void {
    Animation.CreateAndStartAnimation(
        'partMove',
        this.part,
        'position',
        60,
        11,
        this.part.position.clone(),
        position,
        0,
    );
    Animation.CreateAndStartAnimation(
        'partRotate',
        this.part,
        'rotationQuaternion',
        60,
        11,
        this.part.rotationQuaternion?.clone() ?? Quaternion.Identity(),
        rotation,
        0,
    );
  }

  private report(text: string): void {
    this.onStatus?.(text);
  }
}
