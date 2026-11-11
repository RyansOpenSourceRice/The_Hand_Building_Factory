import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import type {Scene} from '@babylonjs/core/scene';
import {clampToPlayArea} from './locomotion';

const MOVE_SPEED = 1.5;
const TURN_RATE = 2.1;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const TURN_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

export function attachDesktopControls(
    scene: Scene,
    camera: UniversalCamera,
    onMove: (x: number, z: number) => void,
): void {
  const held = new Set<string>();

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (MOVE_KEYS.has(event.code) || TURN_KEYS.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  let lastReport = `${camera.position.x.toFixed(2)},` +
      `${camera.position.z.toFixed(2)}`;

  scene.onBeforeRenderObservable.add(() => {
    const dt = scene.getEngine().getDeltaTime() / 1000;
    if (held.has('ArrowLeft')) {
      camera.rotation.y += TURN_RATE * dt;
    }
    if (held.has('ArrowRight')) {
      camera.rotation.y -= TURN_RATE * dt;
    }
    const yaw = camera.rotation.y;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    let dx = 0;
    let dz = 0;
    if (held.has('KeyW')) {
      dx += forwardX;
      dz += forwardZ;
    }
    if (held.has('KeyS')) {
      dx -= forwardX;
      dz -= forwardZ;
    }
    if (held.has('KeyD')) {
      dx -= forwardZ;
      dz += forwardX;
    }
    if (held.has('KeyA')) {
      dx += forwardZ;
      dz -= forwardX;
    }
    if (dx !== 0 || dz !== 0) {
      const step = new Vector3(
          camera.position.x + dx * MOVE_SPEED * dt,
          camera.position.y,
          camera.position.z + dz * MOVE_SPEED * dt,
      );
      clampToPlayArea(step);
      camera.position.x = step.x;
      camera.position.z = step.z;
    }
    const key = `${camera.position.x.toFixed(2)},` +
        `${camera.position.z.toFixed(2)}`;
    if (key !== lastReport) {
      lastReport = key;
      onMove(camera.position.x, camera.position.z);
    }
  });
}
