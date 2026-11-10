import './style.css';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/XR/webXRDefaultExperience';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import {createEnvironment} from './scene/environment';
import {DemoStage} from './game/demoStage';
import {Hud} from './ui/hud';
import {attachXrGrab, pulseController} from './input/xrGrab';
import {attachDesktopGrab} from './input/desktopGrab';

type XrCapableNavigator = Navigator & {
  xr?: { isSessionSupported(mode: string): Promise<boolean> };
};

async function initXr(
    scene: Scene,
    ground: Mesh,
): Promise<WebXRDefaultExperience | null> {
  const nav = navigator as XrCapableNavigator;
  if (!nav.xr) {
    return null;
  }
  let supported: boolean;
  try {
    supported = await nav.xr.isSessionSupported('immersive-vr');
  } catch {
    return null;
  }
  if (!supported) {
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

  const camera = new ArcRotateCamera(
      'cam',
      -Math.PI / 2,
      1.08,
      3.4,
      new Vector3(0, 0.95, 0),
      scene,
  );
  camera.attachControl(true);
  camera.lowerRadiusLimit = 1.4;
  camera.upperRadiusLimit = 8;
  camera.wheelDeltaPercentage = 0.01;
  camera.upperBetaLimit = 1.45;

  const stage = new DemoStage(scene, {pedestalTop: env.pedestalTop});
  const hud = new Hud(() => stage.reset());
  stage.onStatus = (text) => hud.setStatus(text);
  stage.onSnapped = (tag) => pulseController(tag);
  hud.setStatus('Grab the red part. Slot it into the blue outline.');

  const xr = await initXr(scene, env.ground);
  if (xr) {
    attachXrGrab(xr, stage, scene);
    hud.hideDesktopOnly();
    hud.setReady('xr');
  } else {
    hud.showDesktopOnly();
    hud.setReady('desktop');
  }
  attachDesktopGrab(scene, camera, stage);

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
