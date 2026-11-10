import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {Matrix, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Plane} from '@babylonjs/core/Maths/math.plane';
import {PointerEventTypes} from '@babylonjs/core/Events/pointerEvents';
import {Scene} from '@babylonjs/core/scene';
import {DemoStage} from '../game/demoStage';

export function attachDesktopGrab(
    scene: Scene,
    camera: ArcRotateCamera,
    stage: DemoStage,
): void {
  let dragging = false;
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
        if (!mesh || !stage.startGrab('desktop')) {
          break;
        }
        dragging = true;
        dragHeight = mesh.position.y;
        grabOffset.copyFrom(
            mesh.position.subtract(pick?.pickedPoint ?? mesh.position),
        );
        grabOffset.y = 0;
        camera.detachControl();
        break;
      }
      case PointerEventTypes.POINTERMOVE: {
        if (!dragging) {
          break;
        }
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
        break;
      }
      case PointerEventTypes.POINTERUP: {
        if (!dragging) {
          break;
        }
        dragging = false;
        camera.attachControl(true);
        stage.endGrab('desktop');
        break;
      }
    }
  });
}
