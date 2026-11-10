import {Ray} from '@babylonjs/core/Culling/ray';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {WebXRInputSource} from '@babylonjs/core/XR/webXRInputSource';
import type {DemoStage} from '../game/demoStage';

const PULSE_VALUE = 0.7;
const PULSE_DURATION_MS = 60;

let liveControllers: WebXRInputSource[] = [];

export function pulseController(tag: string): void {
  if (tag !== 'xr') {
    return;
  }
  for (const ctrl of liveControllers) {
    void ctrl.motionController?.pulse(PULSE_VALUE, PULSE_DURATION_MS);
  }
}

export function attachXrGrab(
    xr: WebXRDefaultExperience,
    stage: DemoStage,
    scene: Scene,
): void {
  const ray = new Ray(Vector3.Zero(), Vector3.Forward());
  let holder: WebXRInputSource | null = null;

  const controllerFor = (source: XRInputSource): WebXRInputSource | undefined =>
    xr.input.controllers.find((ctrl) => ctrl.inputSource === source);

  const release = (): void => {
    holder = null;
    stage.endGrab('xr');
  };

  const onSelectStart = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (!ctrl || holder) {
      return;
    }
    ctrl.getWorldPointerRayToRef(ray);
    const pick = scene.pickWithRay(ray, (mesh) => stage.isGrabCandidate(mesh));
    if (pick?.pickedMesh && stage.startGrab('xr')) {
      holder = ctrl;
      stage.part.setParent(ctrl.pointer);
    }
  };

  const onSelectEnd = (event: XRInputSourceEvent): void => {
    if (controllerFor(event.inputSource) === holder && holder) {
      release();
    }
  };

  const onSqueezeStart = (event: XRInputSourceEvent): void => {
    if (controllerFor(event.inputSource) === holder && holder) {
      release();
    }
    stage.reset();
  };

  const addSessionListeners = (session: XRSession): void => {
    session.addEventListener('selectstart', onSelectStart);
    session.addEventListener('selectend', onSelectEnd);
    session.addEventListener('squeezestart', onSqueezeStart);
  };

  const removeSessionListeners = (session: XRSession): void => {
    session.removeEventListener('selectstart', onSelectStart);
    session.removeEventListener('selectend', onSelectEnd);
    session.removeEventListener('squeezestart', onSqueezeStart);
  };

  xr.input.onControllerAddedObservable.add((ctrl) => {
    liveControllers.push(ctrl);
  });

  xr.input.onControllerRemovedObservable.add((removed) => {
    liveControllers = liveControllers.filter((ctrl) => ctrl !== removed);
    if (removed === holder) {
      release();
    }
  });

  xr.baseExperience.sessionManager.onXRSessionInit.add(addSessionListeners);
  xr.baseExperience.sessionManager.onXRSessionEnded.add((session) => {
    removeSessionListeners(session);
    if (holder) {
      release();
    }
  });
}
