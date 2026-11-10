import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';

export class SnapService {
  private readonly node: TransformNode;
  readonly snapRadius: number;
  private complete = false;

  constructor(node: TransformNode, snapRadius = 0.18) {
    this.node = node;
    this.snapRadius = snapRadius;
  }

  get isComplete(): boolean {
    return this.complete;
  }

  get position(): Vector3 {
    return this.node.position.clone();
  }

  distanceTo(position: Vector3): number {
    return Vector3.Distance(position, this.node.position);
  }

  trySnap(position: Vector3): boolean {
    if (this.complete) {
      return false;
    }
    if (this.distanceTo(position) > this.snapRadius) {
      return false;
    }
    this.complete = true;
    return true;
  }

  forceComplete(): void {
    this.complete = true;
  }

  reset(): void {
    this.complete = false;
  }
}
