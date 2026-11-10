import {Ray} from '@babylonjs/core/Culling/ray';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {WebXRInputSource} from '@babylonjs/core/XR/webXRInputSource';
import type {AssemblyStage} from '../game/assembly';
import type {Screwdriver} from '../game/screwdriver';

const PULSE_VALUE = 0.7;
const PULSE_DURATION_MS = 60;
const PULSE_SOFT_VALUE = 0.05;
const PULSE_SOFT_DURATION_MS = 40;

let liveControllers: WebXRInputSource[] = [];

export function pulseController(tag: string): void {
  if (tag !== 'xr') {
    return;
  }
  for (const ctrl of liveControllers) {
    void ctrl.motionController?.pulse(PULSE_VALUE, PULSE_DURATION_MS);
  }
}

export function pulseControllerSoft(tag: string): void {
  if (tag !== 'xr') {
    return;
  }
  for (const ctrl of liveControllers) {
    void ctrl.motionController?.pulse(
        PULSE_SOFT_VALUE,
        PULSE_SOFT_DURATION_MS,
    );
  }
}

export function attachXrGrab(
    xr: WebXRDefaultExperience,
    stage: AssemblyStage,
    driver: Screwdriver,
    scene: Scene,
): void {
  const ray = new Ray(Vector3.Zero(), Vector3.Forward());
  const tipScratch = new Vector3();
  let holder: WebXRInputSource | null = null;
  let holderMode: 'part' | 'tool' | null = null;
  let driving = false;

  const controllerFor = (source: XRInputSource): WebXRInputSource | undefined =>
    xr.input.controllers.find((ctrl) => ctrl.inputSource === source);

  const release = (): void => {
    if (holderMode === 'tool') {
      driver.endGrab('xr');
    } else if (holderMode === 'part') {
      stage.endGrab('xr');
    }
    holder = null;
    holderMode = null;
    driving = false;
  };

  const grabAt = (ctrl: WebXRInputSource): void => {
    ctrl.getWorldPointerRayToRef(ray);
    const pick = scene.pickWithRay(ray, (mesh) =>
      stage.isGrabCandidate(mesh) || driver.isGrabCandidate(mesh));
    const root = pick?.pickedMesh;
    if (!root) {
      return;
    }
    if (driver.isGrabCandidate(root) && driver.startGrab('xr')) {
      holder = ctrl;
      holderMode = 'tool';
      driver.attachTo(ctrl.pointer);
      return;
    }
    if (stage.isGrabCandidate(root) && stage.startGrab('xr')) {
      holder = ctrl;
      holderMode = 'part';
      stage.attachTo(ctrl.pointer);
    }
  };

  const onSelectStart = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (!ctrl) {
      return;
    }
    if (ctrl === holder && holderMode === 'tool') {
      driving = true;
      return;
    }
    if (holder) {
      return;
    }
    grabAt(ctrl);
  };

  const onSelectEnd = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (!ctrl) {
      return;
    }
    if (ctrl === holder && holderMode === 'tool') {
      driving = false;
      return;
    }
    if (ctrl === holder && holderMode === 'part') {
      release();
    }
  };

  const onSqueezeStart = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (ctrl === holder && holderMode === 'tool') {
      release();
      return;
    }
    if (ctrl === holder && holderMode === 'part') {
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

  scene.onBeforeRenderObservable.add(() => {
    if (holderMode !== 'tool' || !driving) {
      return;
    }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    stage.driveTick(dt, driver.tipWorld(tipScratch), true, 'xr');
  });
}
