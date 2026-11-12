/*
 * WebXR mock: installs a navigator.xr polyfill with two tracked-pointer
 * controllers so the game runs its real XR pipeline headlessly. Opt-in:
 * define window.__XR_MOCK_CONFIG__ = {mockXr: true} before this script.
 * Driven through window.__xrMock (see docs/QA_AGENT.md).
 */
(() => {
  const cfg = window.__XR_MOCK_CONFIG__;
  if (!cfg || cfg.mockXr !== true || window.__xrMock) {
    return;
  }

  const state = {
    xrActive: false,
    controllersReady: false,
    viewer: {x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0},
    controllers: {
      left: freshController(),
      right: freshController(),
    },
  };

  function freshController() {
    return {
      x: 0, y: 1.1, z: 0.5, yaw: 0, pitch: 0,
      trigger: 0, squeeze: 0, stickX: 0, stickY: 0,
      stickPressed: false, aButton: 0, bButton: 0,
    };
  }

  function quatFromYawPitch(yaw, pitch) {
    const cy = Math.cos(yaw / 2);
    const sy = Math.sin(yaw / 2);
    const cp = Math.cos(pitch / 2);
    const sp = Math.sin(pitch / 2);
    return {
      x: sp * cy,
      y: sy * cp,
      z: 0,
      w: cp * cy,
    };
  }

  function rigid(c) {
    const q = quatFromYawPitch(c.yaw, c.pitch);
    const x2 = q.x + q.x;
    const y2 = q.y + q.y;
    const z2 = q.z + q.z;
    const xx = q.x * x2;
    const xy = q.x * y2;
    const xz = q.x * z2;
    const yy = q.y * y2;
    const yz = q.y * z2;
    const zz = q.z * z2;
    const wx = q.w * x2;
    const wy = q.w * y2;
    const wz = q.w * z2;
    const m = new Float32Array(16);
    m[0] = 1 - (yy + zz); m[1] = xy + wz; m[2] = xz - wy; m[3] = 0;
    m[4] = xy - wz; m[5] = 1 - (xx + zz); m[6] = yz + wx; m[7] = 0;
    m[8] = xz + wy; m[9] = yz - wx; m[10] = 1 - (xx + yy); m[11] = 0;
    m[12] = c.x; m[13] = c.y; m[14] = c.z; m[15] = 1;
    return {
      position: {x: c.x, y: c.y, z: c.z, w: 1},
      orientation: q,
      matrix: m,
    };
  }

  function projection(eye) {
    const near = 0.1;
    const far = 100;
    const fov = 0.94;
    const aspect = 1.0;
    const f = 1 / Math.tan(fov / 2);
    const shift = eye === 'left' ? -0.02 : 0.02;
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    m[12] = shift;
    return m;
  }

  const spaceOwners = new Map();

  function quatMul(a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  }

  function rotateVec(q, v) {
    const tx = 2 * (q.y * v.z - q.z * v.y);
    const ty = 2 * (q.z * v.x - q.x * v.z);
    const tz = 2 * (q.x * v.y - q.y * v.x);
    return {
      x: v.x + q.w * tx + (q.y * tz - q.z * ty),
      y: v.y + q.w * ty + (q.z * tx - q.x * tz),
      z: v.z + q.w * tz + (q.x * ty - q.y * tx),
    };
  }

  function applyRigid(base, off) {
    const rotated = rotateVec(off.orientation, base.position);
    return {
      position: {
        x: rotated.x + off.position.x,
        y: rotated.y + off.position.y,
        z: rotated.z + off.position.z,
        w: 1,
      },
      orientation: quatMul(off.orientation, base.orientation),
    };
  }

  function invertRigid(r) {
    const conj = {
      x: -r.orientation.x,
      y: -r.orientation.y,
      z: -r.orientation.z,
      w: r.orientation.w,
    };
    const neg = {
      x: -r.position.x,
      y: -r.position.y,
      z: -r.position.z,
      w: 1,
    };
    const rotated = rotateVec(conj, neg);
    return {position: rotated, orientation: conj};
  }

  function makeSpace(name, owner) {
    const space = {
      name,
      getOffsetReferenceSpace(transform) {
        const child = makeSpace(`${name}*`, owner);
        child._offset = space._offset ?
            applyRigid(transform, space._offset) : transform;
        return child;
      },
    };
    if (owner) {
      spaceOwners.set(space, owner);
    }
    return space;
  }
  const viewerSpace = makeSpace('viewer');
  const floorSpace = makeSpace('local-floor');

  function makeInputSource(handedness, index) {
    const gamepad = {
      mapping: 'xr-standard',
      connected: true,
      id: `factory-mock-${handedness}`,
      index,
      axes: [0, 0, 0, 0],
      buttons: Array.from({length: 7}, () => ({
        value: 0, pressed: false, touched: false,
      })),
      hapticActuators: [],
    };
    const src = {
      handedness,
      targetRayMode: 'tracked-pointer',
      profiles: ['factory-mock'],
      skipRendering: true,
      gamepad,
      targetRaySpace: makeSpace(`${handedness}-targetRay`),
      gripSpace: makeSpace(`${handedness}-grip`),
    };
    return src;
  }

  const leftSource = makeInputSource('left', 0);
  const rightSource = makeInputSource('right', 1);
  spaceOwners.set(leftSource.targetRaySpace, leftSource);
  spaceOwners.set(leftSource.gripSpace, leftSource);
  spaceOwners.set(rightSource.targetRaySpace, rightSource);
  spaceOwners.set(rightSource.gripSpace, rightSource);

  const listeners = new Map();
  function dispatch(type, event) {
    for (const cb of listeners.get(type) ?? []) {
      cb(event);
    }
  }

  class MockFrame {
    getViewerPose(refSpace) {
      if (!state.xrActive) {
        return null;
      }
      const inv = invertRigid(refSpace._offset ?? IDENTITY_RIGID);
      const transform = applyRigid(rigid(state.viewer), inv);
      return {
        transform,
        emulatedPosition: false,
        views: [
          {
            eye: 'left',
            viewIndex: 0,
            projectionMatrix: projection('left'),
            transform,
          },
          {
            eye: 'right',
            viewIndex: 1,
            projectionMatrix: projection('right'),
            transform,
          },
        ],
      };
    }

    getPose(space) {
      if (!state.xrActive) {
        return null;
      }
      const owner = spaceOwners.get(space);
      const c = owner ? state.controllers[owner.handedness] : state.viewer;
      const base = rigid(c ?? state.viewer);
      const inv = invertRigid(space._offset ?? IDENTITY_RIGID);
      const transform = applyRigid(base, inv);
      return {transform, emulatedPosition: false};
    }
  }

  const IDENTITY_RIGID = {
    position: {x: 0, y: 0, z: 0, w: 1},
    orientation: {x: 0, y: 0, z: 0, w: 1},
  };

  const frame = new MockFrame();
  let session = null;

  class MockSession {
    constructor() {
      this.inputSources = [leftSource, rightSource];
      this.environmentBlendMode = 'opaque';
      this.visibilityState = 'visible';
      this.renderState = {};
      this._running = false;
    }

    addEventListener(type, cb) {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    }

    removeEventListener(type, cb) {
      const list = listeners.get(type) ?? [];
      const at = list.indexOf(cb);
      if (at >= 0) {
        list.splice(at, 1);
      }
    }

    async requestReferenceSpace(type) {
      return type === 'viewer' ? viewerSpace : floorSpace;
    }

    updateRenderState(next) {
      Object.assign(this.renderState, next);
    }

    requestAnimationFrame(cb) {
      if (!this._running) {
        return 0;
      }
      return window.requestAnimationFrame((t) => {
        this._syncGamepads();
        cb(t, frame);
      });
    }

    async end() {
      this._running = false;
      state.xrActive = false;
      dispatch('end', {type: 'end', session: this, target: this});
    }

    begin() {
      this._running = true;
      state.xrActive = true;
      setTimeout(() => {
        dispatch('inputsourceschange', {
          type: 'inputsourceschange',
          session: this,
          target: this,
          added: this.inputSources,
          removed: [],
        });
        setTimeout(() => {
          state.controllersReady = true;
        }, 50);
      }, 30);
    }

    _syncGamepads() {
      if (!this._buttonState) {
        this._buttonState = new Map();
      }
      for (const src of this.inputSources) {
        const c = state.controllers[src.handedness];
        if (!c) {
          continue;
        }
        src.gamepad.axes[0] = 0;
        src.gamepad.axes[1] = 0;
        src.gamepad.axes[2] = c.stickX;
        src.gamepad.axes[3] = c.stickY;
        const set = (i, value) => {
          const button = src.gamepad.buttons[i];
          button.value = value;
          button.pressed = value > 0.5;
          button.touched = value > 0.1;
        };
        set(0, c.trigger);
        set(1, c.squeeze);
        set(3, c.stickPressed ? 1 : 0);
        set(4, c.aButton);
        set(5, c.bButton);
        const prev = this._buttonState.get(src) ??
          {trigger: 0, squeeze: 0};
        const event = (type) => ({
          type,
          session: this,
          target: this,
          inputSource: src,
        });
        if (prev.trigger <= 0.5 && c.trigger > 0.5) {
          dispatch('selectstart', event('selectstart'));
        }
        if (prev.trigger > 0.5 && c.trigger <= 0.5) {
          dispatch('selectend', event('selectend'));
        }
        if (prev.squeeze <= 0.5 && c.squeeze > 0.5) {
          dispatch('squeezestart', event('squeezestart'));
        }
        if (prev.squeeze > 0.5 && c.squeeze <= 0.5) {
          dispatch('squeezeend', event('squeezeend'));
        }
        this._buttonState.set(
            src, {trigger: c.trigger, squeeze: c.squeeze});
      }
    }
  }

  window.XRWebGLLayer = class MockWebGLLayer {
    constructor(glSession, gl) {
      this.context = gl;
      this.framebuffer = gl ? gl.createFramebuffer() : null;
      this.framebufferWidth = gl ? gl.drawingBufferWidth : 2048;
      this.framebufferHeight = gl ? gl.drawingBufferHeight : 2048;
      this._session = glSession;
    }

    getViewport(view) {
      const half = Math.floor(this.framebufferWidth / 2);
      return view.eye === 'left' ?
          {x: 0, y: 0, width: half, height: this.framebufferHeight} :
          {x: half, y: 0, width: half, height: this.framebufferHeight};
    }
  };

  const xrListeners = new Map();
  const xrApi = {
    addEventListener(type, cb) {
      const list = xrListeners.get(type) ?? [];
      list.push(cb);
      xrListeners.set(type, list);
    },
    removeEventListener(type, cb) {
      const list = xrListeners.get(type) ?? [];
      const at = list.indexOf(cb);
      if (at >= 0) {
        list.splice(at, 1);
      }
    },
    dispatchEvent(event) {
      for (const cb of xrListeners.get(event.type) ?? []) {
        cb(event);
      }
      return true;
    },
    isSessionSupported: async (mode) => mode === 'immersive-vr',
    requestSession: async () => {
      session = new MockSession();
      session.begin();
      return session;
    },
  };

  try {
    Object.defineProperty(navigator, 'xr', {
      value: xrApi,
      writable: false,
      configurable: true,
    });
  } catch {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'xr', {
      value: xrApi,
      writable: false,
      configurable: true,
    });
  }

  window.__xrMock = {
    setController(side, patch) {
      Object.assign(state.controllers[side], patch);
    },
    setViewer(patch) {
      Object.assign(state.viewer, patch);
    },
    async exit() {
      if (session) {
        await session.end();
      }
    },
    state() {
      return {
        xrActive: state.xrActive,
        controllersReady: state.controllersReady,
      };
    },
    snapshot() {
      return {
        xrActive: state.xrActive,
        controllersReady: state.controllersReady,
        controllers: {
          left: {...state.controllers.left},
          right: {...state.controllers.right},
        },
        viewer: {...state.viewer},
      };
    },
  };
})();
