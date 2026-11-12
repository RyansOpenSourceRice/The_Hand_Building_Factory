import {
  PhysicsMotionType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Scene} from '@babylonjs/core/scene';
import {makeBoxBody} from '../scene/physics';

const HOLSTER = new Vector3(0, 1.08, 0.5);
const HAND_OFFSET = new Vector3(0, 0, 0.036);
const HAND_TILT = Quaternion.FromEulerAngles(0.12, 0, 0);
const HANDLE_HEIGHT = 0.11;
const SHAFT_HEIGHT = 0.06;

export class Screwdriver {
  readonly mesh: Mesh;
  private readonly tip: TransformNode;
  private heldBy: string | null = null;
  private body: ReturnType<typeof makeBoxBody> = null;

  constructor(scene: Scene) {
    const gripMat = new StandardMaterial('driverGripMat', scene);
    gripMat.diffuseColor = Color3.FromHexString('#c25b2a');
    gripMat.emissiveColor = Color3.FromHexString('#2a0e04');
    gripMat.specularColor = new Color3(0.08, 0.08, 0.08);
    const metalMat = new StandardMaterial('driverMetalMat', scene);
    metalMat.diffuseColor = Color3.FromHexString('#9aa0ad');
    metalMat.specularColor = new Color3(0.3, 0.3, 0.33);

    this.mesh = MeshBuilder.CreateCylinder(
        'tool:screwdriver',
        {diameter: 0.024, height: HANDLE_HEIGHT},
        scene,
    );
    this.mesh.material = gripMat;
    this.mesh.position.copyFrom(HOLSTER);
    this.mesh.setEnabled(false);

    const shaft = MeshBuilder.CreateCylinder(
        'tool:screwdriver-shaft',
        {diameter: 0.006, height: SHAFT_HEIGHT},
        scene,
    );
    shaft.parent = this.mesh;
    shaft.position.y = HANDLE_HEIGHT / 2 + SHAFT_HEIGHT / 2;
    shaft.material = metalMat;

    this.tip = new TransformNode('tool:screwdriver-tip', scene);
    this.tip.parent = this.mesh;
    this.tip.position.y = HANDLE_HEIGHT / 2 + SHAFT_HEIGHT;
  }

  show(): void {
    this.heldBy = null;
    this.detach();
    this.mesh.setEnabled(true);
    this.mesh.position.copyFrom(HOLSTER);
    this.mesh.rotationQuaternion = Quaternion.Identity();
    this.settleStatic();
  }

  equip(node: TransformNode): boolean {
    if (this.heldBy) {
      return false;
    }
    this.heldBy = 'xr';
    this.mesh.setEnabled(true);
    this.mesh.setParent(node);
    this.mesh.position.copyFrom(HAND_OFFSET);
    this.mesh.rotationQuaternion = HAND_TILT.clone();
    if (this.body) {
      this.body.setMotionType(PhysicsMotionType.ANIMATED);
      this.body.disablePreStep = false;
    }
    return true;
  }

  holster(): void {
    this.heldBy = null;
    this.detach();
    this.mesh.setEnabled(false);
    this.mesh.position.copyFrom(HOLSTER);
    this.mesh.rotationQuaternion = Quaternion.Identity();
    this.settleStatic();
  }

  isEquipped(): boolean {
    return this.heldBy !== null;
  }

  isVisible(): boolean {
    return this.mesh.isEnabled();
  }

  isGrabCandidate(mesh: unknown): boolean {
    return mesh === this.mesh || this.isDescendant(mesh);
  }

  startGrab(tag: string): boolean {
    if (this.heldBy) {
      return false;
    }
    this.heldBy = tag;
    if (this.body) {
      this.body.setMotionType(PhysicsMotionType.ANIMATED);
      this.body.disablePreStep = false;
    }
    return true;
  }

  attachTo(node: unknown): void {
    if (this.heldBy) {
      this.mesh.setParent(node as TransformNode | null);
    }
  }

  moveGrabbed(position: Vector3): void {
    if (this.heldBy === 'desktop') {
      this.mesh.position.copyFrom(position);
    }
  }

  endGrab(tag: string): void {
    if (this.heldBy !== tag) {
      return;
    }
    this.heldBy = null;
    this.detach();
    if (tag === 'desktop') {
      this.show();
      return;
    }
    this.holster();
  }

  isHeld(tag: string): boolean {
    return this.heldBy === tag;
  }

  tipWorld(result: Vector3): Vector3 {
    this.tip.computeWorldMatrix(true);
    result.copyFrom(this.tip.absolutePosition);
    return result;
  }

  private detach(): void {
    if (this.mesh.parent) {
      this.mesh.rotationQuaternion ??= Quaternion.FromEulerAngles(
          this.mesh.rotation.x,
          this.mesh.rotation.y,
          this.mesh.rotation.z,
      );
      this.mesh.setParent(null);
    }
  }

  private isDescendant(mesh: unknown): boolean {
    let node = mesh as Mesh | null;
    while (node) {
      if (node === this.mesh) {
        return true;
      }
      node = node.parent as Mesh | null;
    }
    return false;
  }

  private settleStatic(): void {
    if (!this.body) {
      this.body = makeBoxBody(this.mesh, PhysicsMotionType.STATIC, 1);
      return;
    }
    this.body.setMotionType(PhysicsMotionType.STATIC);
    this.body.disablePreStep = false;
  }
}
