import {fileURLToPath} from 'node:url';
import {expect, test, type Page} from '@playwright/test';

const MOCK_SCRIPT =
  fileURLToPath(new URL('../xr-mock/xr-mock.js', import.meta.url));
const PROFILE_LIST = {'factory-mock': {path: 'factory-mock'}};

const PROFILE = {
  profileId: 'factory-mock',
  layouts: {
    left: stickLayout(),
    right: stickLayout(),
    none: stickLayout(),
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

function stickLayout(): Record<string, unknown> {
  return {
    components: {
      'xr-standard-trigger': component('trigger', 0),
      'xr-standard-squeeze': component('squeeze', 1),
      'xr-standard-thumbstick': component('thumbstick', 3, 2, 3),
    },
    gamepad: {mapping: 'xr-standard'},
    assetPath: 'controller.glb',
  };
}

type V3 = [number, number, number];

const GRAB_BACK = 0.35;
const DRIVE_MS = 1750;

const SOCKETS: Record<string, V3> = {
  'palm': [0, 1.2155, 0],
  'servo-base': [0, 1.1, -0.19],
  'servo-f1': [-0.062, 1.27, -0.19],
  'servo-f2': [0.062, 1.27, -0.19],
  'servo-f3': [-0.062, 1.16, -0.19],
  'servo-f4': [0.062, 1.16, -0.19],
  'thumb-base': [-0.155, 1.21, 0.02],
  'finger-index': [-0.0945, 1.541, 0],
  'finger-middle': [-0.0315, 1.541, 0],
  'finger-ring': [0.0315, 1.541, 0],
  'finger-little': [0.0945, 1.541, 0],
  'thumb-segments': [-0.21, 1.3, 0.08],
  'upper-cover': [0, 1.2155, -0.095],
};

const CONVEYOR_IDS = new Set([
  'servo-base',
  'servo-f1',
  'servo-f2',
  'servo-f3',
  'servo-f4',
]);

function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

async function setWorldPose(page: Page, side: 'left' | 'right',
    worldPos: V3, worldYaw = 0, worldPitch = 0): Promise<void> {
  await page.evaluate(({side, pos, yaw, pitch}) => {
    window.__xrMock!.setController(side, {
      x: pos[0] ?? 0,
      y: pos[1] ?? 0,
      z: -(pos[2] ?? 0),
      yaw: -yaw,
      pitch: -pitch,
    });
  }, {side, pos: worldPos, yaw: worldYaw, pitch: worldPitch});
}

async function partCenter(page: Page): Promise<V3> {
  return page.evaluate(() =>
    window.factoryDebug!.partCenter()) as Promise<V3>;
}

async function trigger(page: Page, side: 'left' | 'right',
    down: boolean): Promise<void> {
  await page.evaluate(({side, down}) => {
    window.__xrMock!.setController(side, {trigger: down ? 1 : 0});
  }, {side, down});
}

async function squeeze(page: Page, side: 'left' | 'right',
    down: boolean): Promise<void> {
  await page.evaluate(({side, down}) => {
    window.__xrMock!.setController(side, {squeeze: down ? 1 : 0});
  }, {side, down});
}

async function partInfo(page: Page): Promise<{id: string; pos: V3}> {
  const raw = await page.getAttribute('#live-status', 'data-part') ?? '';
  const sep = raw.indexOf(':');
  const id = raw.slice(0, sep);
  const nums = raw.slice(sep + 1).split(',').map(Number);
  return {id, pos: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0]};
}

async function waitForActivePart(page: Page, id: string): Promise<void> {
  await page.waitForFunction(
      (wanted) => (document.getElementById('live-status')
          ?.getAttribute('data-part') ?? '').startsWith(`${wanted}:`),
      id,
      {timeout: 45_000},
  );
  await page.waitForTimeout(CONVEYOR_IDS.has(id) ? 1700 : 600);
}

async function sites(page: Page): Promise<V3[]> {
  return page.evaluate(() => window.factoryDebug!.sites()) as Promise<V3[]>;
}

test.describe('xr full assembly (chromium + mock navigator.xr)', () => {
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
  });

  test('carries and screws every part to finish the hand', async ({page}) => {
    test.setTimeout(300_000);

    let driverHeld = false;

    for (const id of Object.keys(SOCKETS)) {
      await waitForActivePart(page, id);

      if (driverHeld) {
        await setWorldPose(page, 'right', [0, 1.25, 0.6]);
        await page.waitForTimeout(200);
        await squeeze(page, 'right', true);
        await page.waitForTimeout(300);
        await squeeze(page, 'right', false);
        await page.waitForTimeout(600);
        for (let tries = 0; tries < 8; tries++) {
          const t1 = await page.evaluate(
              () => window.factoryDebug!.driverCenter(),
          ) as V3;
          await page.waitForTimeout(250);
          const t2 = await page.evaluate(
              () => window.factoryDebug!.driverCenter(),
          ) as V3;
          const drift = Math.abs(t1[0] - t2[0]) + Math.abs(t1[1] - t2[1]) +
              Math.abs(t1[2] - t2[2]);
          if (drift < 0.02) {
            break;
          }
        }
        const dropped = await page.evaluate(
            () => window.factoryDebug!.driverCenter(),
        ) as V3;
        if ((dropped[1] ?? 0) < -0.2) {
          throw new Error(`driver fell out of the world: ${dropped}`);
        }
        await waitForActivePart(page, id);
      }

      const socket = SOCKETS[id]!;

      if (driverHeld) {
        await squeeze(page, 'right', true);
        await page.waitForTimeout(300);
        await squeeze(page, 'right', false);
        await page.waitForTimeout(600);
        for (let tries = 0; tries < 6; tries++) {
          const t1 = await page.evaluate(
              () => window.factoryDebug!.tip(),
          ) as V3;
          await page.waitForTimeout(250);
          const t2 = await page.evaluate(
              () => window.factoryDebug!.tip(),
          ) as V3;
          const drift = Math.abs(t1[0] - t2[0]) + Math.abs(t1[1] - t2[1]) +
              Math.abs(t1[2] - t2[2]);
          if (drift < 0.02) {
            break;
          }
        }
        await waitForActivePart(page, id);
        for (let tries = 0; tries < 10; tries++) {
          const p1 = await partCenter(page);
          await page.waitForTimeout(250);
          const p2 = await partCenter(page);
          const drift = Math.abs(p1[0] - p2[0]) + Math.abs(p1[1] - p2[1]) +
              Math.abs(p1[2] - p2[2]);
          if (drift < 0.02) {
            break;
          }
        }
      }

      const part = await partInfo(page);
      expect(part.id).toBe(id);
      const center = await partCenter(page);

      const releasePtr: V3 = [
        socket[0] + center[0] - part.pos[0],
        socket[1] + center[1] - part.pos[1],
        socket[2] + center[2] - part.pos[2] - GRAB_BACK,
      ];

      const aimOffsets: V3[] = [
        [0, 0, 0],
        [0.06, 0, 0], [-0.06, 0, 0],
        [0, 0.06, 0], [0, -0.06, 0],
        [0.06, 0, 0.06], [-0.06, 0, -0.06],
      ];
      let held = false;
      for (const off of aimOffsets) {
        const aim: V3 = [center[0] + off[0], center[1] + off[1],
          center[2] + off[2] - GRAB_BACK];
        await setWorldPose(page, 'left', aim);
        await page.waitForTimeout(250);
        await trigger(page, 'left', true);
        await page.waitForTimeout(200);
        await setWorldPose(page, 'left', add(aim, [0, 0.15, 0]));
        await page.waitForTimeout(200);
        const now = await partCenter(page);
        if (Math.abs(now[1] - (center[1] + 0.15)) < 0.05) {
          held = true;
          break;
        }
        await trigger(page, 'left', false);
        await page.waitForTimeout(150);
      }
      expect(held).toBe(true);

      await setWorldPose(page, 'left', releasePtr);
      await page.waitForTimeout(350);
      await trigger(page, 'left', false);

      await expect.poll(async () => (await sites(page)).length,
          {timeout: 8_000}).toBeGreaterThan(0);

      const dc = await page.evaluate(
          () => window.factoryDebug!.driverCenter(),
      ) as V3;
      await setWorldPose(page, 'right', add(dc, [0, 0.35, 0]), 0,
          Math.PI / 2);
      await page.waitForTimeout(250);
      await trigger(page, 'right', true);
      await page.waitForTimeout(300);
      const tipBefore = await page.evaluate(
          () => window.factoryDebug!.tip(),
      ) as V3;
      await setWorldPose(page, 'right', add(dc, [0, 0.65, 0]), 0,
          Math.PI / 2);
      await page.waitForTimeout(250);
      const tipAfter = await page.evaluate(
          () => window.factoryDebug!.tip(),
      ) as V3;
      expect(tipAfter[1] - tipBefore[1]).toBeGreaterThan(0.25);
      await setWorldPose(page, 'right', add(dc, [0, 0.35, 0]), 0,
          Math.PI / 2);
      await page.waitForTimeout(200);
      await trigger(page, 'right', false);
      await page.waitForTimeout(150);
      await trigger(page, 'right', true);
      const pointer = await page.evaluate(
          () => window.factoryDebug!.pointer('right'),
      ) as V3;
      const heldTip = await page.evaluate(
          () => window.factoryDebug!.tip(),
      ) as V3;
      const tipOff = sub(heldTip, pointer);
      driverHeld = true;

      for (let rounds = 0; rounds < 14; rounds++) {
        const remaining = await sites(page);
        if (remaining.length === 0) {
          break;
        }
        const site = remaining[0]!;
        const ptr = sub(site, tipOff);
        await setWorldPose(page, 'right', ptr, 0, Math.PI / 2);
        await page.waitForTimeout(DRIVE_MS);
      }
      await trigger(page, 'right', false);
      await page.waitForTimeout(150);
      if ((await sites(page)).length > 0) {
        throw new Error(`failed to drive screws for ${id}`);
      }
      await page.waitForTimeout(300);
    }

    await expect(page.locator('#live-status'))
        .toHaveText('HAND COMPLETE! Take a bow.');
  });
});
