import type {Scene} from '@babylonjs/core/scene';
import {WebXRState} from '@babylonjs/core/XR/webXRTypes';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import {pulseControllerSoft} from './xrGrab';

export const HEIGHT_STEPS = [0, 0.4, 0.8] as const;
export const HEIGHT_STEP_M = 0.4;
export const HEIGHT_SPEED = 0.9;

const THUMBSTICK = 'xr-standard-thumbstick';

export function attachHeightControl(
    xr: WebXRDefaultExperience,
    scene: Scene,
    reducedMotion: boolean,
): void {
  let step = 0;
  let target = 0;
  let applied = 0;

  xr.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motion) => {
      const stick = motion.getComponent(THUMBSTICK);
      if (!stick) {
        return;
      }
      stick.onButtonStateChangedObservable.add((component) => {
        if (!component.changes.pressed || !component.pressed) {
          return;
        }
        if (xr.baseExperience.state !== WebXRState.IN_XR) {
          return;
        }
        step = (step + 1) % HEIGHT_STEPS.length;
        target = step * HEIGHT_STEP_M;
        pulseControllerSoft('xr');
      });
    });
  });

  scene.onBeforeRenderObservable.add(() => {
    if (xr.baseExperience.state !== WebXRState.IN_XR) {
      return;
    }
    const remaining = target - applied;
    if (remaining === 0) {
      return;
    }
    let delta = remaining;
    if (!reducedMotion) {
      const dt = scene.getEngine().getDeltaTime() / 1000;
      const maxStep = HEIGHT_SPEED * dt;
      delta = Math.abs(remaining) <= maxStep ? remaining :
          Math.sign(remaining) * maxStep;
    }
    applied += delta;
    xr.baseExperience.camera.position.y += delta;
  });
}
