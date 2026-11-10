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

export class DemoStage {
  readonly part: Mesh;
  readonly ghost: Mesh;
  readonly snap: SnapService;
  onStatus: ((text: string) => void) | null = null;
  onSnapped: ((tag: string) => void) | null = null;
  private readonly partHome: Vector3;
  private readonly ghostHome: Vector3;
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
    } else {
      this.report('Release inside the blue outline to place the part.');
    }
  }

  reset(): void {
    if (!this.snap.isComplete) {
      return;
    }
    this.snap.reset();
    this.restoreGhost();
    this.tweenPartTo(
        this.partHome,
        this.part.rotationQuaternion ?? Quaternion.Identity(),
    );
    this.report('Part returned. Grab it and slot it into the blue outline.');
  }

  private playSnapSuccess(tag: string): void {
    this.tweenPartTo(this.snap.position, Quaternion.Identity());
    const ghostMat = this.ghost.material as StandardMaterial;
    const fade = Animation.CreateAndStartAnimation(
        'ghostFade',
        ghostMat,
        'alpha',
        60,
        10,
        ghostMat.alpha,
        0,
        0,
    );
    if (fade) {
      fade.onAnimationEnd = () => {
        this.ghost.setEnabled(false);
        ghostMat.alpha = 0.32;
      };
    }
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
