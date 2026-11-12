import {Ray} from '@babylonjs/core/Culling/ray';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Scene} from '@babylonjs/core/scene';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {WebXRInputSource} from '@babylonjs/core/XR/webXRInputSource';
import type {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import type {AssemblyStage} from '../game/assembly';
import type {Screwdriver} from '../game/screwdriver';

const PULSE_VALUE = 0.7;
const PULSE_DURATION_MS = 60;
const PULSE_SOFT_VALUE = 0.05;
const PULSE_SOFT_DURATION_MS = 40;

export type HandRootSource = {
  rootFor: (controller: WebXRInputSource) => TransformNode | null;
};

export type XrGrabHooks = {
  blocked: () => boolean;
  onToolChanged: (equipped: boolean) => void;
};

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
    hands: HandRootSource,
    hooks: XrGrabHooks,
): {releaseAll: () => void} {
  const ray = new Ray(Vector3.Zero(), Vector3.Forward());
  const tipScratch = new Vector3();
  let partHolder: WebXRInputSource | null = null;
  let toolHolder: WebXRInputSource | null = null;

  const controllerFor = (source: XRInputSource): WebXRInputSource | undefined =>
    xr.input.controllers.find((ctrl) => ctrl.inputSource === source);

  const releasePart = (allowSnap = true): void => {
    if (partHolder) {
      stage.endGrab('xr', allowSnap);
    }
    partHolder = null;
  };

  const stowTool = (): void => {
    if (!toolHolder) {
      return;
    }
    toolHolder = null;
    driver.holster();
    hooks.onToolChanged(false);
  };

  const releaseAll = (): void => {
    releasePart(false);
    stowTool();
  };

  const toggleTool = (ctrl: WebXRInputSource): void => {
    if (hooks.blocked()) {
      return;
    }
    if (driver.isEquipped()) {
      stowTool();
      return;
    }
    if (ctrl === partHolder) {
      return;
    }
    const anchor = hands.rootFor(ctrl) ?? ctrl.grip ?? ctrl.pointer;
    if (driver.equip(anchor)) {
      toolHolder = ctrl;
      hooks.onToolChanged(true);
    }
  };

  const grabAt = (ctrl: WebXRInputSource): void => {
    if (partHolder) {
      return;
    }
    ctrl.getWorldPointerRayToRef(ray);
    const pick = scene.pickWithRay(ray, (mesh) =>
      stage.isGrabCandidate(mesh));
    const root = pick?.pickedMesh;
    if (!root) {
      return;
    }
    if (stage.isGrabCandidate(root) && stage.startGrab('xr')) {
      partHolder = ctrl;
      stage.attachTo(ctrl.pointer);
    }
  };

  const onSelectStart = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (!ctrl || ctrl === toolHolder) {
      return;
    }
    grabAt(ctrl);
  };

  const onSelectEnd = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (ctrl && ctrl === partHolder) {
      releasePart();
    }
  };

  const onSqueezeStart = (event: XRInputSourceEvent): void => {
    const ctrl = controllerFor(event.inputSource);
    if (!ctrl) {
      return;
    }
    if (ctrl === toolHolder) {
      stowTool();
      return;
    }
    if (ctrl === partHolder) {
      releasePart();
    }
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
    ctrl.onMotionControllerInitObservable.add((motion) => {
      for (const id of ['b-button', 'y-button']) {
        const component = motion.components[id];
        component?.onButtonStateChangedObservable.add(() => {
          if (component.pressed) {
            toggleTool(ctrl);
          }
        });
      }
    });
  });

  xr.input.onControllerRemovedObservable.add((removed) => {
    liveControllers = liveControllers.filter((ctrl) => ctrl !== removed);
    if (removed === partHolder) {
      releasePart();
    }
    if (removed === toolHolder) {
      stowTool();
    }
  });

  xr.baseExperience.sessionManager.onXRSessionInit.add(addSessionListeners);
  xr.baseExperience.sessionManager.onXRSessionEnded.add((session) => {
    removeSessionListeners(session);
    releaseAll();
  });

  scene.onBeforeRenderObservable.add(() => {
    if (!toolHolder) {
      return;
    }
    const dt = scene.getEngine().getDeltaTime() / 1000;
    stage.driveTick(dt, driver.tipWorld(tipScratch), true, 'xr');
  });

  return {releaseAll};
}
