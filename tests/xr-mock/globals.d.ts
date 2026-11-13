interface FactoryDebug {
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
  activeBounds: () => number[][];
  activeTransform: () => {pos: number[]; quat: number[]};
  guidance: () => {
    title: string;
    detail: string;
    progress: string;
    visible: boolean;
  };
  voice: () => {
    current: string;
    lastKey: string;
    lastText: string;
    speaking: boolean;
    muted: boolean;
    plays: Record<string, number>;
    active: string[];
  };
  hostGlow: () => string;
  parts: () => Array<{
    id: string;
    center: number[];
    min: number[];
    max: number[];
    target: number[];
    quat: number[];
    placed: boolean;
    screwsDone: number;
    screwCount: number;
    enabled: boolean;
  }>;
  targetFor: (id: string) => number[] | null;
  completeHand: () => void;
  debugView: (view: 'front' | 'back' | 'left' | 'right' | 'top' |
    'servos') => void;
  audioChannels: () => {voice: string[]; music: boolean; sfx: string[]};
  hidePart: (id: string, visible?: boolean) => void;
  audienceCount: () => number;
  partColor: (id: string) => string;
  selectTheme: (slot: 'primary' | 'secondary' | 'tertiary',
    index: number) => void;
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
}

interface XrMock {
  setController: (
    side: 'left' | 'right',
    patch: Partial<{
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      trigger: number;
      squeeze: number;
      stickX: number;
      stickY: number;
      stickPressed: boolean;
      aButton: number;
      bButton: number;
    }>,
  ) => void;
  setViewer: (patch: Partial<{
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
  }>) => void;
  exit: () => Promise<void>;
  state: () => {xrActive: boolean; controllersReady: boolean};
}

interface Window {
  factoryDebug?: FactoryDebug;
  __xrMock?: XrMock;
  __XR_MOCK_CONFIG__?: {mockXr: boolean};
}
