import {fileURLToPath} from 'node:url';
import {expect, test, type Page} from '@playwright/test';

const MOCK_SCRIPT =
  fileURLToPath(new URL('../xr-mock/xr-mock.js', import.meta.url));
const PROFILE_LIST = {'factory-mock': {path: 'factory-mock'}};

const PROFILE = {
  profileId: 'factory-mock',
  layouts: {
    left: stickLayout('left'),
    right: stickLayout('right'),
    none: stickLayout('right'),
  },
};

function component(type: string, button: number, xAxis?: number,
    yAxis?: number): unknown {
  const gamepadIndices: {button: number; xAxis?: number; yAxis?: number} =
    {button};
  if (xAxis !== undefined && yAxis !== undefined) {
    gamepadIndices.xAxis = xAxis;
    gamepadIndices.yAxis = yAxis;
  }
  return {type, gamepadIndices, visualResponses: {}};
}

function stickLayout(hand: 'left' | 'right'): Record<string, unknown> {
  return {
    components: {
      'xr-standard-trigger': component('trigger', 0),
      'xr-standard-squeeze': component('squeeze', 1),
      'xr-standard-thumbstick': component('thumbstick', 3, 2, 3),
      [hand === 'left' ? 'x-button' : 'a-button']:
        component('button', 4),
    },
    gamepad: {mapping: 'xr-standard'},
    selectComponentId: 'xr-standard-trigger',
    assetPath: 'controller.glb',
  };
}

interface FlatPose {
  x: number;
  z: number;
  yaw: number;
  forward: [number, number];
  right: [number, number];
}

async function pose(page: Page): Promise<FlatPose> {
  return page.evaluate(() => {
    const dbg = window.factoryDebug!;
    const camera = dbg.camera();
    const forward = dbg.dir([0, 0, 1]);
    const right = dbg.dir([1, 0, 0]);
    return {
      x: camera[0] ?? 0,
      z: camera[2] ?? 0,
      yaw: dbg.yaw(),
      forward: [forward[0] ?? 0, forward[2] ?? 0] as [number, number],
      right: [right[0] ?? 0, right[2] ?? 0] as [number, number],
    };
  });
}

async function pulse(page: Page, side: 'left' | 'right',
    patch: {stickX?: number; stickY?: number}, ms: number): Promise<void> {
  await page.evaluate(
      ({side, patch}) => {
        window.__xrMock!.setController(side, patch);
      },
      {side, patch},
  );
  await page.waitForTimeout(ms);
  await page.evaluate(
      ({side}) => {
        window.__xrMock!.setController(side, {stickX: 0, stickY: 0});
      },
      {side},
  );
}

test.describe('xr thumbsticks (chromium + mock navigator.xr)', () => {
  test.skip(({browserName}) => browserName !== 'chromium');
  test.slow();

  test.beforeEach(async ({page}) => {
    await page.addInitScript(() => {
      window.__XR_MOCK_CONFIG__ = {mockXr: true};
    });
    await page.addInitScript({path: MOCK_SCRIPT});
    await page.route('**/profiles/profilesList.json', (route) =>
      route.fulfill({json: PROFILE_LIST}));
    await page.route('**/profiles/factory-mock/profile.json', (route) =>
      route.fulfill({json: PROFILE}));

    await page.goto('/');
    const status = page.locator('#live-status');
    await expect(status).toHaveAttribute('data-ready', 'xr', {
      timeout: 20_000,
    });
    await page.evaluate(() => window.factoryDebug!.enterVr());
    await page.waitForFunction(
        () => window.__xrMock!.state().controllersReady,
        undefined,
        {timeout: 20_000},
    );
    await page.waitForFunction(
        () => window.factoryDebug!.controllerMotion('left') &&
            window.factoryDebug!.controllerMotion('right'),
        undefined,
        {timeout: 10_000},
    );
    await page.evaluate(() => window.factoryDebug!.splashSkip());
  });

  test('right thumbstick forward walks along the camera forward vector',
      async ({page}) => {
        const before = await pose(page);
        await pulse(page, 'right', {stickY: -1}, 1500);
        const after = await pose(page);

        const dx = after.x - before.x;
        const dz = after.z - before.z;
        const distance = Math.hypot(dx, dz);
        expect(distance).toBeGreaterThan(0.3);

        const along = dx * before.forward[0] + dz * before.forward[1];
        const across = dx * before.right[0] + dz * before.right[1];
        expect(along).toBeGreaterThan(distance * 0.7);
        expect(Math.abs(across)).toBeLessThan(distance * 0.5);
      });

  test('right thumbstick right strafes along the camera right vector',
      async ({page}) => {
        const before = await pose(page);
        await pulse(page, 'right', {stickX: 1}, 1500);
        const after = await pose(page);

        const dx = after.x - before.x;
        const dz = after.z - before.z;
        const distance = Math.hypot(dx, dz);
        expect(distance).toBeGreaterThan(0.3);

        const along = dx * before.right[0] + dz * before.right[1];
        const across = dx * before.forward[0] + dz * before.forward[1];
        expect(along).toBeGreaterThan(distance * 0.7);
        expect(Math.abs(across)).toBeLessThan(distance * 0.5);
      });

  test('left thumbstick x=1 snap turns the camera to the right', async ({
    page,
  }) => {
    const before = await pose(page);
    await pulse(page, 'left', {stickX: 1}, 800);
    const after = await pose(page);

    let delta = after.yaw - before.yaw;
    if (delta > Math.PI) {
      delta -= 2 * Math.PI;
    } else if (delta < -Math.PI) {
      delta += 2 * Math.PI;
    }
    expect(delta).toBeGreaterThan(0.55);
    expect(delta).toBeLessThan(1.0);
  });

  test('camera stays inside the yard while walking toward a wall', async ({
    page,
  }) => {
    await pulse(page, 'right', {stickY: -1}, 14_000);
    const final = await pose(page);
    expect(Math.abs(final.x)).toBeLessThanOrEqual(6.2501);
    expect(Math.abs(final.z)).toBeLessThanOrEqual(6.2501);
  });
});
