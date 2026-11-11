import './style.css';
import {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Helpers/sceneHelpers';
import {WebXRState} from '@babylonjs/core/XR/webXRTypes';
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
import {createPartProvider, loadPrototypes} from './scene/partMeshes';
import {Hud} from './ui/hud';
import {
  attachXrGrab,
  pulseController,
  pulseControllerSoft,
} from './input/xrGrab';
import {attachXrLocomotion} from './input/locomotion';
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
  const prototypes = await loadPrototypes(scene);
  const reducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = new AssemblyStage(
      scene,
      createPartProvider(prototypes),
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
  });
  stage.onStatus = (text) => hud.setStatus(text);
  stage.onPartInfo = (info) => hud.setPartInfo(info);
  const applySettings = (): void => {
    const current = settings.get();
    hud.setSettings(current.turnMode, current.snapAngle);
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
    hud.setStatus('VR ready. Press ENTER VR to start.');
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
