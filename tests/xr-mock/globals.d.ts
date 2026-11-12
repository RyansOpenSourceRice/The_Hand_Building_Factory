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
