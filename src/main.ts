import './style.css';
import {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
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
  AUDIENCE_COUNT,
  attachEnvironmentColliders,
  createEnvironment,
} from './scene/environment';
import {AbstractEngine} from '@babylonjs/core/Engines/abstractEngine';
import {enableGamePhysics} from './scene/physics';
import {AssemblyStage} from './game/assembly';
import {Screwdriver} from './game/screwdriver';
import {
  cheer,
  initSfx,
  partDrop,
  ratchet,
  screwClick,
  setSfxMuted,
  snap,
} from './audio/sfx';
import {MusicLoop} from './audio/music';
import {VoicePlayer} from './audio/voice';
import {partVoiceKey} from './audio/voiceLines';
import {SettingsStore} from './game/settings';
import type {ThemeSlot} from './game/palette';
import {
  applyTheme,
  createPartProvider,
  createThemeMaterials,
  loadPrototypes,
} from './scene/partMeshes';
import {Hud} from './ui/hud';
import {VrMenu} from './ui/vrMenu';
import {CreditSplash} from './ui/splash';
import {
  attachXrGrab,
  pulseController,
  pulseControllerSoft,
} from './input/xrGrab';
import {attachXrLocomotion} from './input/locomotion';
import {attachHeightControl} from './input/height';
import {
  attachControllerHands,
  createDebugHand,
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
  initSfx(scene);
  const music = new MusicLoop(scene);
  const voice = new VoicePlayer(
      scene, (speaking) => music.setDucked(speaking));
  let voiceArmed = false;
  let pendingPart = '';
  let introSaid = false;
  let arrowsTold = false;
  let menuTold = false;
  let audioArmed = false;
  const armAudio = (): void => {
    if (audioArmed) {
      return;
    }
    audioArmed = true;
    music.start();
  };
  window.addEventListener('pointerdown', armAudio);
  window.addEventListener('keydown', armAudio);
  stage.onRatchet = (tag) => {
    armAudio();
    ratchet();
    pulseControllerSoft(tag);
  };
  stage.onScrewDriven = () => {
    armAudio();
    screwClick();
  };
  stage.onSnapped = (tag) => {
    pulseController(tag);
    armAudio();
    snap();
  };
  stage.onProgress = (done, total) => {
    if (total > 0 && done >= total) {
      cheer();
      voice.say('complete');
      window.setTimeout(() => splash.show(true), 2500);
    }
  };
  stage.onDropped = () => partDrop();
  stage.onAnnounce = (id) => {
    const key = partVoiceKey(id);
    if (voiceArmed) {
      voice.say(key);
    } else {
      pendingPart = key;
    }
  };
  stage.onMounted = (count, first) => {
    if (!voiceArmed) {
      return;
    }
    voice.say(count > 1 ? 'mount-many' : 'mount-one');
    if (first && count > 1 && !arrowsTold) {
      arrowsTold = true;
      voice.say('arrows');
    }
  };
  const toggleDriver = (): void => {
    if (driver.isEquipped() || driver.isVisible()) {
      driver.holster();
      hud.setStatus('Screwdriver put away.');
      voice.say('tool-off');
      return;
    }
    driver.show();
    hud.setStatus('Screwdriver ready. Drag it to a screw.');
    voice.say('tool-on');
  };
  const hud = new Hud({
    reset: () => stage.reset(),
    undo: () => stage.undo(),
    redo: () => stage.redo(),
    cycleTurnMode: () => settings.cycleTurnMode(),
    cycleSnapAngle: () => settings.cycleSnapAngle(),
    setTheme: (slot, colorIndex) => settings.setTheme(slot, colorIndex),
    toggleMuted: () => {
      armAudio();
      settings.toggleMuted();
    },
    toggleTool: () => {
      armAudio();
      toggleDriver();
    },
  });
  stage.onStatus = (text) => hud.setStatus(text);
  stage.onPartInfo = (info) => hud.setPartInfo(info);
  let vrMenu: VrMenu | null = null;
  let xrGrabControls: {releaseAll: () => void} | null = null;
  const splash = new CreditSplash(scene, {
    rebuild: () => {
      xrGrabControls?.releaseAll();
      driver.holster();
      voice.say('rebuild');
      stage.restart();
      armAudio();
    },
  });
  splash.onDismissed = () => {
    scene.onBeforeRenderObservable.addOnce(() => {
      vrMenu?.setSuppressed(false);
    });
    hud.setSuppressed(false);
    armAudio();
    voiceArmed = true;
    if (!introSaid) {
      introSaid = true;
      voice.say('intro');
    }
    if (pendingPart) {
      voice.say(pendingPart);
      pendingPart = '';
    }
  };
  splash.onShown = () => hud.setSuppressed(true);
  splash.setCamera(camera);
  stage.announceCurrent();
  const applySettings = (): void => {
    const current = settings.get();
    hud.setSettings(current.turnMode, current.snapAngle);
    vrMenu?.sync(current.turnMode, current.snapAngle);
    vrMenu?.setThemeSelection({
      primary: current.themePrimary,
      secondary: current.themeSecondary,
      tertiary: current.themeTertiary,
    });
    setSfxMuted(current.muted);
    music.setMuted(current.muted);
    voice.setMuted(current.muted);
    hud.setMutedLabel(current.muted);
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
    if (e.code === 'KeyT' && !e.repeat &&
        !(e.ctrlKey || e.metaKey || e.altKey)) {
      armAudio();
      toggleDriver();
      return;
    }
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
    const hands = attachControllerHands(
        xr, scene, settings.get().themePrimary);
    handRepMaterial = hands.material;
    xrGrabControls = attachXrGrab(xr, stage, driver, scene, hands, {
      blocked: () => splash.isVisible(),
      onToolChanged: (equipped) => {
        armAudio();
        hud.setStatus(equipped ?
            'Screwdriver ready. Touch the tip to a screw.' :
            'Screwdriver put away. Press B or Y to bring it back.');
        voice.say(equipped ? 'tool-on' : 'tool-off');
      },
    });
    attachXrLocomotion(xr, settings, scene, reportCamera);
    attachHeightControl(xr, scene, reducedMotion);
    splash.attach(xr);
    const menu = new VrMenu(scene, {
      reset: () => stage.reset(),
      undo: (count) => stage.undoMany(count),
      redo: (count) => stage.redoMany(count),
      undoDepth: () => stage.undoDepth(),
      redoDepth: () => stage.redoDepth(),
      cycleTurnMode: () => settings.cycleTurnMode(),
      cycleSnapAngle: () => settings.cycleSnapAngle(),
      setTheme: (slot, colorIndex) => settings.setTheme(slot, colorIndex),
    });
    menu.attach(xr);
    menu.onToggled = () => {
      armAudio();
      if (!menuTold) {
        menuTold = true;
        voice.say('menu');
      }
    };
    vrMenu = menu;
    vrMenu.setSuppressed(splash.isVisible());
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
        vrMenu?.hide();
      }
    });
    applySettings();
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
  if (!xr && new URLSearchParams(window.location.search).has('handDebug')) {
    const debugHand = createDebugHand(scene, settings.get().themePrimary);
    debugHand.position.set(0, 1.5, 0.55);
    debugHand.rotationQuaternion = Quaternion.Identity();
    driver.equip(debugHand);
    camera.position.set(0.3, 1.65, 1.35);
    camera.setTarget(new Vector3(0, 1.48, 0.55));
  }

  const xrCamera = (): UniversalCamera | WebXRCamera =>
    xr?.baseExperience.camera ?? camera;
  let lastError = '';
  const reportError = (err: unknown): void => {
    const text = err instanceof Error ? err.message : String(err);
    if (!text || text === lastError) {
      return;
    }
    lastError = text;
    hud.setStatus('Something went wrong: ' + text);
  };
  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason);
  });

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
      menu: () => boolean;
      menuToggle: () => void;
      menuPlace: () => void;
      splashVisible: () => boolean;
      splashGated: () => boolean;
      splashSkip: () => void;
      splashRegate: () => void;
      splashRebuild: () => void;
      splashBg: () => string;
      splashPos: () => number[];
      splashCam: () => number[];
      toolEquipped: () => boolean;
      toolVisible: () => boolean;
      toolParent: () => string;
      controllerMotion: (hand: string) => boolean;
      arrowCount: () => number;
      audienceCount: () => number;
      partColor: (id: string) => string;
      selectTheme: (slot: ThemeSlot, index: number) => void;
      perf: () => {
        fps: number;
        meshes: number;
        activeMeshes: number;
        materials: number;
      };
      audio: () => {
        base: string;
        state: string;
        unlocked: boolean;
        musicReady: boolean;
      };
      lastError: () => string;
      hudBg: () => Record<string, string>;
      menuBg: () => Record<string, string>;
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
    menu: () => vrMenu?.isVisible() ?? false,
    menuToggle: () => vrMenu?.debugToggle(),
    menuPlace: () => vrMenu?.debugPlaceInFrontOfActiveCamera(),
    splashVisible: () => splash.isVisible(),
    splashGated: () => splash.gateElapsed(),
    splashSkip: () => splash.debugSkip(),
    splashRegate: () => splash.debugRegate(),
    splashRebuild: () => splash.debugRebuild(),
    splashBg: () => splash.buttonBackground(),
    splashPos: () => splash.debugPosition(),
    splashCam: () => splash.debugCam(),
    toolEquipped: () => driver.isEquipped(),
    toolVisible: () => driver.isVisible(),
    toolParent: () => driver.mesh.parent?.name ?? '',
    controllerMotion: (hand) =>
      !!xr?.input.controllers.find(
          (ctrl) => ctrl.inputSource.handedness === hand)?.motionController,
    arrowCount: () => stage.arrowCount(),
    audienceCount: () => AUDIENCE_COUNT,
    partColor: (id) => stage.partColor(id),
    selectTheme: (slot, index) => settings.setTheme(slot, index),
    perf: () => ({
      fps: scene.getEngine().getFps(),
      meshes: scene.meshes.length,
      activeMeshes: scene.getActiveMeshes().length,
      materials: scene.materials.length,
    }),
    audio: () => {
      const engineAudio = AbstractEngine.audioEngine;
      return {
        base: import.meta.env.BASE_URL,
        state: engineAudio?.audioContext?.state ?? 'none',
        unlocked: engineAudio?.unlocked ?? false,
        musicReady: music.isReady(),
      };
    },
    lastError: () => lastError,
    hudBg: () => hud.buttonBackgrounds(),
    menuBg: () => vrMenu?.buttonBackgrounds() ?? {},
  };

  splash.show();
  vrMenu?.setSuppressed(true);
  document.getElementById('boot-fallback')?.remove();
  engine.runRenderLoop(() => {
    try {
      scene.render();
    } catch (err) {
      reportError(err);
    }
  });
  window.addEventListener('resize', () => engine.resize());
  if (new URLSearchParams(window.location.search).has('perf')) {
    const readout = document.createElement('div');
    readout.id = 'perf-readout';
    readout.style.cssText =
        'position:fixed;right:8px;top:8px;padding:6px 8px;' +
        'background:rgba(0,0,0,.65);color:#d9e2ff;font:12px monospace;' +
        'z-index:99;border-radius:4px;pointer-events:none';
    document.body.appendChild(readout);
    window.setInterval(() => {
      const perf = bridgeWindow.factoryDebug?.perf();
      if (!perf) {
        return;
      }
      readout.textContent =
          `${perf.fps.toFixed(0)} fps | ${perf.activeMeshes} active | ` +
          `${perf.meshes} meshes | ${perf.materials} mats`;
    }, 1000);
  }
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
