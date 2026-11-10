import {Matrix, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Plane} from '@babylonjs/core/Maths/math.plane';
import {PointerEventTypes} from '@babylonjs/core/Events/pointerEvents';
import type {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Scene} from '@babylonjs/core/scene';
import {AssemblyStage} from '../game/assembly';

const LOOK_SENSITIVITY = 0.0045;
const PITCH_MIN = -0.65;
const PITCH_MAX = 0.45;

export function attachDesktopGrab(
    scene: Scene,
    camera: UniversalCamera,
    stage: AssemblyStage,
): void {
  let dragging = false;
  let looking = false;
  let lastX = 0;
  let lastY = 0;
  let dragHeight = 0;
  const grabOffset = new Vector3(0, 0, 0);

  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN: {
        const pick = scene.pick(
            scene.pointerX,
            scene.pointerY,
            (mesh) => stage.isGrabCandidate(mesh),
        );
        const mesh = pick?.pickedMesh;
        if (mesh && stage.startGrab('desktop')) {
          dragging = true;
          dragHeight = mesh.position.y;
          grabOffset.copyFrom(
              mesh.position.subtract(pick?.pickedPoint ?? mesh.position),
          );
          grabOffset.y = 0;
          break;
        }
        looking = true;
        lastX = scene.pointerX;
        lastY = scene.pointerY;
        break;
      }
      case PointerEventTypes.POINTERMOVE: {
        if (dragging) {
          const ray = scene.createPickingRay(
              scene.pointerX,
              scene.pointerY,
              Matrix.Identity(),
              camera,
          );
          const plane = Plane.FromPositionAndNormal(
              new Vector3(0, dragHeight, 0),
              Vector3.Up(),
          );
          const distance = ray.intersectsPlane(plane);
          if (distance !== null) {
            const point = ray.origin.add(ray.direction.scale(distance));
            stage.moveGrabbed(point.add(grabOffset));
          }
        } else if (looking) {
          camera.rotation.y -= (scene.pointerX - lastX) * LOOK_SENSITIVITY;
          camera.rotation.x -= (scene.pointerY - lastY) * LOOK_SENSITIVITY;
          camera.rotation.x =
              Math.min(PITCH_MAX, Math.max(PITCH_MIN, camera.rotation.x));
          lastX = scene.pointerX;
          lastY = scene.pointerY;
        }
        break;
      }
      case PointerEventTypes.POINTERUP: {
        if (dragging) {
          dragging = false;
          stage.endGrab('desktop');
        }
        looking = false;
        break;
      }
    }
  });
}
