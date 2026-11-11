import './style.css';
import {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {WebXRCamera} from '@babylonjs/core/XR/webXRCamera';
import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Helpers/sceneHelpers';
import {WebXRState} from '@babylonjs/core/XR/webXRTypes';
import type {
  StandardMaterial,
} from '@babylonjs/core/Materials/standardMaterial';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import {
  attachEnvironmentColliders,
  createEnvironment,
} from './scene/environment';
import {enableGamePhysics} from './scene/physics';
import {AssemblyStage} from './game/assembly';
import {Screwdriver} from './game/screwdriver';
import {ratchet, screwClick, snap} from './audio/sfx';
import {SettingsStore} from './game/settings';
import {
  applyTheme,
  createPartProvider,
  createThemeMaterials,
  loadPrototypes,
} from './scene/partMeshes';
import {Hud} from './ui/hud';
import {
  attachXrGrab,
  pulseController,
  pulseControllerSoft,
} from './input/xrGrab';
import {attachXrLocomotion} from './input/locomotion';
import {attachHeightControl} from './input/height';
import {
  attachControllerHands,
  handRepTint,
  setHandTint,
} from './input/handRep';
import {attachDesktopControls} from './input/desktopControls';
import {attachDesktopGrab} from './input/desktopGrab';

type XrCapableNavigator = Navigator & {xr?: object};

const XR_PROBE_DELAYS_MS = [0, 150, 350, 700, 1500, 3000];

async function waitForXr(): Promise<boolean> {
  const nav = () => (navigator as XrCapableNavigator).xr;
  for (const delay of XR_PROBE_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    if (nav()) {
      return true;
    }
  }
  return false;
}

async function initXr(
    scene: Scene,
    ground: Mesh,
): Promise<WebXRDefaultExperience | null> {
  if (!(await waitForXr())) {
    return null;
  }
  return scene.createDefaultXRExperienceAsync({
    floorMeshes: [ground],
    disableTeleportation: true,
    disablePointerSelection: true,
    disableNearInteraction: true,
    disableHandTracking: true,
    disableDefaultUI: true,
  });
}

async function boot(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  if (!canvas) {
    throw new Error('stage canvas missing');
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const env = createEnvironment(canvas);
  const {scene, engine} = env;

  await enableGamePhysics(scene);
  attachEnvironmentColliders(env);

  const camera = new UniversalCamera('cam', new Vector3(0, 1.4, 2.2), scene);
  camera.rotation.set(0, Math.PI, 0);
  camera.minZ = 0.05;

  const settings = new SettingsStore();
  const theme = createThemeMaterials(scene, settings.get());
  const prototypes = await loadPrototypes(scene, theme);
  let handRepMaterial: StandardMaterial | null = null;
  const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = new AssemblyStage(
      scene,
      createPartProvider(prototypes, theme),
      reducedMotion,
  );
  const driver = new Screwdriver(scene);
  driver.show();
  stage.onRatchet = (tag) => {
    ratchet();
    pulseControllerSoft(tag);
  };
  stage.onScrewDriven = () => screwClick();
  stage.onSnapped = (tag) => {
    pulseController(tag);
    snap();
  };
  const hud = new Hud({
    reset: () => stage.reset(),
    undo: () => stage.undo(),
    redo: () => stage.redo(),
    cycleTurnMode: () => settings.cycleTurnMode(),
    cycleSnapAngle: () => settings.cycleSnapAngle(),
    setTheme: (slot, colorIndex) => settings.setTheme(slot, colorIndex),
  });
  stage.onStatus = (text) => hud.setStatus(text);
  stage.onPartInfo = (info) => hud.setPartInfo(info);
  stage.announceCurrent();
  const applySettings = (): void => {
    const current = settings.get();
    hud.setSettings(current.turnMode, current.snapAngle);
    applyTheme(theme, current);
    if (handRepMaterial) {
      setHandTint(handRepMaterial, handRepTint(current.themePrimary));
    }
    hud.setThemeSelection({
      primary: current.themePrimary,
      secondary: current.themeSecondary,
      tertiary: current.themeTertiary,
    });
  };
  settings.onChange(applySettings);
  applySettings();
  hud.setCameraInfo(camera.position.x, camera.position.z);

  const lastCam = {key: `${camera.position.x.toFixed(2)},` +
      `${camera.position.z.toFixed(2)}`};
  const reportCamera = (x: number, z: number): void => {
    const key = `${x.toFixed(2)},${z.toFixed(2)}`;
    if (key === lastCam.key) {
      return;
    }
    lastCam.key = key;
    hud.setCameraInfo(x, z);
  };

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) {
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        stage.redo();
      } else {
        stage.undo();
      }
    } else if (key === 'y') {
      e.preventDefault();
      stage.redo();
    }
  });
  const xr = await initXr(scene, env.ground);
  if (xr) {
    attachXrGrab(xr, stage, driver, scene);
    attachXrLocomotion(xr, settings, scene, reportCamera);
    attachHeightControl(xr, scene, reducedMotion);
    handRepMaterial = attachControllerHands(
        xr, scene, settings.get().themePrimary);
    hud.hideDesktopOnly();
    hud.setReady('xr');
    hud.setEnterVr(() => {
      xr.baseExperience
          .enterXRAsync('immersive-vr', 'local-floor')
          .then(() => hud.hideEnterVr())
          .catch((err: unknown) => {
            console.error(err);
            const reason = err instanceof Error ? err.message : String(err);
            hud.setStatus('VR did not start. ' + reason);
          });
    });
    xr.baseExperience.onStateChangedObservable.add((state) => {
      if (state === WebXRState.IN_XR) {
        hud.hideEnterVr();
      } else if (state === WebXRState.NOT_IN_XR) {
        hud.showEnterVr();
      }
    });
  } else {
    const uaQuest = /Quest|OculusBrowser/i.test(navigator.userAgent);
    hud.showDesktopOnly(uaQuest);
    hud.setReady('desktop');
    hud.setStatus(uaQuest ?
        'WebXR is missing in this browser even though this looks like ' +
        'a Quest. Reload the page, or open a private window and try again.' :
        'Assemble the hand. Grab the part waiting on the printer bed.');
  }
  attachDesktopControls(scene, camera, reportCamera);
  attachDesktopGrab(scene, camera, stage, driver);

  const xrCamera = (): UniversalCamera | WebXRCamera =>
    xr?.baseExperience.camera ?? camera;
  const bridgeWindow = window as typeof window & {
    factoryDebug?: {
      camera: () => number[];
      dir: (v: number[]) => number[];
      yaw: () => number;
      enterVr: () => Promise<void>;
      state: () => {ready: string; inXr: boolean};
      pointer: (hand: string) => number[] | null;
      pointerRot: (hand: string) => number[] | null;
      partCenter: () => number[];
      sites: () => number[][];
      tip: () => number[];
      driverCenter: () => number[];
    };
  };
  bridgeWindow.factoryDebug = {
    camera: () => xrCamera().position.asArray(),
    dir: (v) =>
      xrCamera().getDirection(new Vector3(v[0], v[1], v[2])).asArray(),
    yaw: () => {
      const cam = xrCamera();
      const q = cam.rotationQuaternion;
      if (q) {
        return Math.atan2(
            2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.x * q.x + q.y * q.y));
      }
      return cam.rotation.y;
    },
    enterVr: () =>
        xr ? xr.baseExperience
            .enterXRAsync('immersive-vr', 'local-floor')
            .then(() => undefined) :
             Promise.reject(new Error('no xr')),
    state: () => ({
      ready: xr ? 'xr' : 'desktop',
      inXr: xr?.baseExperience.state === WebXRState.IN_XR,
    }),
    pointer: (hand) => {
      const ctrl = xr?.input.controllers.find(
          (c) => c.inputSource.handedness === hand,
      );
      if (!ctrl) {
        return null;
      }
      const p = ctrl.pointer.absolutePosition;
      return [p.x, p.y, p.z];
    },
    pointerRot: (hand) => {
      const ctrl = xr?.input.controllers.find(
          (c) => c.inputSource.handedness === hand,
      );
      const q = ctrl?.pointer.rotationQuaternion;
      if (!q) {
        return null;
      }
      return q.asArray();
    },
    partCenter: () => {
      const v = stage.activeCenter();
      return [v.x, v.y, v.z];
    },
    sites: () => stage.screwSites().map((v) => [v.x, v.y, v.z]),
    tip: () => {
      const v = driver.tipWorld(new Vector3());
      return [v.x, v.y, v.z];
    },
    driverCenter: () => {
      const c = driver.mesh.getBoundingInfo().boundingBox.centerWorld;
      return [c.x, c.y, c.z];
    },
  };

  document.getElementById('boot-fallback')?.remove();
  engine.runRenderLoop(() => scene.render());
  window.addEventListener('resize', () => engine.resize());
}

boot().catch((err: unknown) => {
  console.error(err);
  const type = err instanceof Error ? err.name : 'Error';
  const message = err instanceof Error ? err.message : String(err);
  const live = document.getElementById('live-status');
  if (live) {
    live.textContent = `fatal:${type}:${message}`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'fatal-overlay';

  const heading = document.createElement('h1');
  heading.textContent = 'The stage could not load';

  const kind = document.createElement('p');
  kind.textContent = `Type: ${type}`;

  const detail = document.createElement('p');
  detail.textContent = `Detail: ${message}`;

  const why = document.createElement('p');
  why.textContent =
    'The 3D scene needs WebGL to draw, and this browser did not ' +
    'provide it. This usually means WebGL is off or the browser ' +
    'is out of date.';

  const steps = document.createElement('ul');
  const advice = [
    'Reload the page.',
    'Turn on WebGL or hardware acceleration in your browser settings.',
    'On a Quest, open this page in the Meta Quest Browser.',
  ];
  for (const step of advice) {
    const li = document.createElement('li');
    li.textContent = step;
    steps.append(li);
  }

  overlay.append(heading, kind, detail, why, steps);
  document.body.appendChild(overlay);
});
