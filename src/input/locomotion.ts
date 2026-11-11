import {Matrix, Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import {WebXRState} from '@babylonjs/core/XR/webXRTypes';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {SettingsStore} from '../game/settings';

export const SMOOTH_TURN_RATE = Math.PI / 2;
export const MOVE_SPEED = 1.5;
export const WALK_HALF = 6.25;

const STICK_DEADZONE = 0.15;
const TURN_ARM = 0.6;
const TURN_RELEASE = 0.4;
const THUMBSTICK = 'xr-standard-thumbstick';

export function clampToPlayArea(position: Vector3): void {
  position.x = Math.max(-WALK_HALF, Math.min(WALK_HALF, position.x));
  position.z = Math.max(-WALK_HALF, Math.min(WALK_HALF, position.z));
}

export function attachXrLocomotion(
    xr: WebXRDefaultExperience,
    settings: SettingsStore,
    scene: Scene,
    onMove: (x: number, z: number) => void,
): void {
  let armed = true;
  let lastReport = '';
  const rotation = new Quaternion();
  const matrix = new Matrix();
  const forward = new Vector3();
  const right = new Vector3();
  const next = new Vector3();

  const rotateBy = (yaw: number): void => {
    const camera = xr.baseExperience.camera;
    Quaternion.RotationAxisToRef(Vector3.Up(), yaw, rotation);
    camera.rotationQuaternion = rotation.multiply(
        camera.rotationQuaternion ?? Quaternion.Identity(),
    );
  };

  const report = (): void => {
    const position = xr.baseExperience.camera.position;
    const key = `${position.x.toFixed(2)},${position.z.toFixed(2)}`;
    if (key !== lastReport) {
      lastReport = key;
      onMove(position.x, position.z);
    }
  };

  const update = (): void => {
    if (xr.baseExperience.state !== WebXRState.IN_XR) {
      return;
    }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    let strafe = 0;
    let drive = 0;
    for (const controller of xr.input.controllers) {
      const motion = controller.motionController;
      if (!motion) {
        continue;
      }
      const stick = motion.getComponent(THUMBSTICK);
      if (!stick) {
        continue;
      }
      const dead = (value: number): number =>
        Math.abs(value) > STICK_DEADZONE ? value : 0;
      // xr-standard: stick right is +x, stick forward is -y.
      const x = dead(stick.axes.x);
      const y = dead(-stick.axes.y);
      if (motion.handedness === 'left') {
        const {turnMode, snapAngle} = settings.get();
        if (turnMode === 'snap') {
          if (Math.abs(x) < TURN_RELEASE) {
            armed = true;
          } else if (armed && Math.abs(x) >= TURN_ARM) {
            const radians = (snapAngle * Math.PI) / 180;
            rotateBy(x > 0 ? radians : -radians);
            armed = false;
          }
        } else if (x !== 0) {
          rotateBy(x * SMOOTH_TURN_RATE * dt);
        }
      } else if (motion.handedness === 'right') {
        strafe = x;
        drive = y;
      }
    }
    if (strafe !== 0 || drive !== 0) {
      const camera = xr.baseExperience.camera;
      Matrix.FromQuaternionToRef(
          camera.rotationQuaternion ?? Quaternion.Identity(),
          matrix,
      );
      Vector3.TransformNormalToRef(Vector3.Forward(), matrix, forward);
      forward.y = 0;
      if (forward.lengthSquared() > 1e-8) {
        forward.normalize();
        Vector3.CrossToRef(Vector3.Up(), forward, right);
        next.copyFrom(forward).scaleInPlace(drive * MOVE_SPEED * dt);
        next.addInPlace(right.scale(strafe * MOVE_SPEED * dt));
        next.addInPlace(camera.position);
        clampToPlayArea(next);
        camera.position.x = next.x;
        camera.position.z = next.z;
      }
    }
    report();
  };

  scene.onBeforeRenderObservable.add(update);
}
