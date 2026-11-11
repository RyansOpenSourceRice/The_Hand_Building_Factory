import {Matrix, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Plane} from '@babylonjs/core/Maths/math.plane';
import {PointerEventTypes} from '@babylonjs/core/Events/pointerEvents';
import type {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Scene} from '@babylonjs/core/scene';
import type {AssemblyStage} from '../game/assembly';
import type {Screwdriver} from '../game/screwdriver';

const LOOK_SENSITIVITY = 0.0045;
const PITCH_MIN = -0.65;
const PITCH_MAX = 0.45;

type CarryMode = 'part' | 'tool' | null;

export function attachDesktopGrab(
    scene: Scene,
    camera: UniversalCamera,
    stage: AssemblyStage,
    driver: Screwdriver,
): void {
  let mode: CarryMode = null;
  let looking = false;
  let lastX = 0;
  let lastY = 0;
  let dragHeight = 0;
  const grabOffset = new Vector3(0, 0, 0);
  const tipScratch = new Vector3();

  const pickCarry = (): CarryMode => {
    const tool = scene.pick(
        scene.pointerX,
        scene.pointerY,
        (mesh) => driver.isGrabCandidate(mesh),
    );
    if (tool?.pickedMesh) {
      return 'tool';
    }
    const part = scene.pick(
        scene.pointerX,
        scene.pointerY,
        (mesh) => stage.isGrabCandidate(mesh),
    );
    return part?.pickedMesh ? 'part' : null;
  };

  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN: {
        mode = pickCarry();
        if (mode) {
          const isTool = mode === 'tool';
          const pick = scene.pick(
              scene.pointerX,
              scene.pointerY,
              (mesh) => isTool ?
                  driver.isGrabCandidate(mesh) :
                  stage.isGrabCandidate(mesh),
          );
          const grabber = isTool ? driver : stage;
          const root = isTool ? driver.mesh : stage.currentPart;
          if (pick?.pickedMesh && grabber.startGrab('desktop')) {
            dragHeight = root.position.y;
            grabOffset.copyFrom(
                root.position.subtract(pick.pickedPoint ?? root.position),
            );
            grabOffset.y = 0;
            break;
          }
          mode = null;
        }
        looking = true;
        lastX = scene.pointerX;
        lastY = scene.pointerY;
        break;
      }
      case PointerEventTypes.POINTERMOVE: {
        if (mode === 'tool' || mode === 'part') {
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
            const next = point.add(grabOffset);
            if (mode === 'tool') {
              driver.moveGrabbed(next);
            } else {
              stage.moveGrabbed(next);
            }
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
        if (mode === 'tool') {
          driver.endGrab('desktop');
        } else if (mode === 'part') {
          stage.endGrab('desktop');
        }
        mode = null;
        looking = false;
        break;
      }
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    if (mode !== 'tool') {
      return;
    }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    stage.driveTick(dt, driver.tipWorld(tipScratch), true, 'desktop');
  });
}
