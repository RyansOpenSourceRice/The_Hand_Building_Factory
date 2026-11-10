import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {Scene} from '@babylonjs/core/scene';
import {
  PhysicsMotionType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import {PhysicsBody} from '@babylonjs/core/Physics/v2/physicsBody';
import {PhysicsShapeBox} from '@babylonjs/core/Physics/v2/physicsShape';
import {HavokPlugin} from '@babylonjs/core/Physics/v2/Plugins/havokPlugin';
import HavokPhysics from '@babylonjs/havok';
import '@babylonjs/core/Physics/v2/physicsEngineComponent';

export function physicsEnabled(scene: Scene): boolean {
  return scene.getPhysicsEngine() != null;
}

export async function enableGamePhysics(scene: Scene): Promise<boolean> {
  try {
    const havok = await HavokPhysics();
    scene.enablePhysics(
        new Vector3(0, -9.81, 0),
        new HavokPlugin(true, havok),
    );
    return true;
  } catch (err: unknown) {
    console.error('Havok physics failed to load', err);
    return false;
  }
}

export function makeBoxBody(
    mesh: Mesh,
    motionType: PhysicsMotionType,
    mass: number,
): PhysicsBody | null {
  const scene = mesh.getScene();
  if (!physicsEnabled(scene)) {
    return null;
  }
  const bounds = mesh.getBoundingInfo().boundingBox;
  const shape = new PhysicsShapeBox(
      bounds.center.clone(),
      Quaternion.Identity(),
      bounds.maximum.subtract(bounds.minimum),
      scene,
  );
  const body = new PhysicsBody(mesh, motionType, false, scene);
  body.shape = shape;
  body.setMassProperties({mass});
  return body;
}

export function addStaticCollider(
    scene: Scene,
    mesh: Mesh,
    center: Vector3,
    extents: Vector3,
): void {
  if (!physicsEnabled(scene)) {
    return;
  }
  const shape =
      new PhysicsShapeBox(center, Quaternion.Identity(), extents, scene);
  const body =
      new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
  body.shape = shape;
}
