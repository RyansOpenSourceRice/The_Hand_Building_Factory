import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {UniversalCamera} from '@babylonjs/core/Cameras/universalCamera';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {attachDesktopControls} from '../../src/input/desktopControls';

type KeyHandler = (event: {code: string; preventDefault: () => void}) => void;

const keyHandlers = new Map<string, KeyHandler>();

const fakeWindow = {
  addEventListener: (type: string, handler: KeyHandler) => {
    keyHandlers.set(type, handler);
  },
  removeEventListener: () => undefined,
  blur: () => undefined,
};

describe('desktopControls', () => {
  let engine: NullEngine;
  let scene: Scene;
  let camera: UniversalCamera;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    keyHandlers.clear();
    (globalThis as {window?: unknown}).window = fakeWindow;
    engine = new NullEngine();
    vi.spyOn(engine, 'getDeltaTime').mockReturnValue(16);
    scene = new Scene(engine);
    camera = new UniversalCamera(
        'cam', new Vector3(0, 1.4, 2.2), scene);
    camera.rotation.set(0, Math.PI, 0);
    scene.activeCamera = camera;
    attachDesktopControls(scene, camera, () => undefined);
  });

  afterEach(() => {
    (globalThis as {window?: unknown}).window = originalWindow;
    scene.dispose();
    engine.dispose();
    vi.restoreAllMocks();
  });

  const press = (code: string) => {
    const handler = keyHandlers.get('keydown');
    if (!handler) {
      throw new Error('keydown handler missing');
    }
    handler({code, preventDefault: () => undefined});
  };

  const release = (code: string) => {
    const handler = keyHandlers.get('keyup');
    if (!handler) {
      throw new Error('keyup handler missing');
    }
    handler({code, preventDefault: () => undefined});
  };

  it('strafes right with D while facing the stage', () => {
    press('KeyD');
    for (let frame = 0; frame < 30; frame++) {
      scene.render();
    }
    release('KeyD');
    expect(camera.position.x).toBeGreaterThan(0.01);
    const radius = Math.hypot(
        camera.position.x, camera.position.z);
    expect(radius).toBeLessThanOrEqual(1.26);
  });

  it('strafes left with A while facing the stage', () => {
    press('KeyA');
    for (let frame = 0; frame < 30; frame++) {
      scene.render();
    }
    release('KeyA');
    expect(camera.position.x).toBeLessThan(-0.01);
  });

  it('moves forward with W toward the stage', () => {
    press('KeyW');
    for (let frame = 0; frame < 30; frame++) {
      scene.render();
    }
    release('KeyW');
    expect(camera.position.z).toBeLessThan(2.1);
  });

  it('turns right with ArrowRight', () => {
    press('ArrowRight');
    for (let frame = 0; frame < 30; frame++) {
      scene.render();
    }
    release('ArrowRight');
    expect(camera.rotation.y).toBeLessThan(Math.PI);
  });
});
