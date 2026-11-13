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
      [hand === 'left' ? 'y-button' : 'b-button']:
        component('button', 5),
    },
    gamepad: {mapping: 'xr-standard'},
    selectComponentId: 'xr-standard-trigger',
    assetPath: 'controller.glb',
  };
}

type V3 = [number, number, number];

const GRAB_BACK = 0.35;
const DRIVE_MS = 1750;
const TOOL_POSE_PITCH = Math.PI / 2;
const TOOL_POSE: V3 = [0, 1.35, 0.9];

const SOCKETS: Record<string, V3> = {
  'palm': [0, 1.4949, 0],
  'servo-base': [0, 1.1549, -0.035],
  'servo-f1': [0.0993, 1.3899, -0.035],
  'servo-f2': [0.0367, 1.3899, -0.035],
  'servo-f3': [-0.0259, 1.3899, -0.035],
  'servo-f4': [-0.0885, 1.3899, -0.035],
  'thumb-base': [0, 1.4949, 0],
  'finger-index': [0, 1.4949, 0],
  'finger-middle': [-0.0626, 1.4949, 0],
  'finger-ring': [-0.1252, 1.4949, 0],
  'finger-little': [-0.1878, 1.4949, 0],
  'thumb-segments': [0, 1.4949, 0],
  'upper-cover': [0, 1.4949, 0],
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

async function trigger(page: Page, side: 'left' | 'right',
    down: boolean): Promise<void> {
  await page.evaluate(({side, down}) => {
    window.__xrMock!.setController(side, {trigger: down ? 1 : 0});
  }, {side, down});
}

async function pressTool(page: Page, side: 'left' | 'right'): Promise<void> {
  await page.evaluate(({side}) => {
    window.__xrMock!.setController(side, {bButton: 1});
  }, {side});
  await page.waitForTimeout(250);
  await page.evaluate(({side}) => {
    window.__xrMock!.setController(side, {bButton: 0});
  }, {side});
  await page.waitForTimeout(150);
}

async function partCenter(page: Page): Promise<V3> {
  return page.evaluate(() =>
    window.factoryDebug!.partCenter()) as Promise<V3>;
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

async function splashVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => window.factoryDebug!.splashVisible());
}

test.describe('xr full assembly (chromium + mock navigator.xr)', () => {
  test.skip(({browserName}) => browserName !== 'chromium');
  test.slow();

  const audioStatuses: number[] = [];

  test.beforeEach(async ({page}) => {
    audioStatuses.length = 0;
    page.on('response', (response) => {
      if (response.url().includes('/audio/')) {
        audioStatuses.push(response.status());
      }
    });
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
    await page.evaluate(() => {
      type Sample = {
        t: number;
        voice: number;
        keys: string[];
        music: boolean;
      };
      const trace: Sample[] = [];
      const timer = window.setInterval(() => {
        const channels = window.factoryDebug!.audioChannels();
        trace.push({
          t: Date.now(),
          voice: channels.voice.length,
          keys: channels.voice,
          music: channels.music,
        });
      }, 100);
      (window as unknown as {
        __audioTrace: typeof trace;
        __audioTimer: number;
      }).__audioTrace = trace;
      (window as unknown as {__audioTimer: number}).__audioTimer = timer;
    });
  });

  test('finishes the hand with the magnetic screwdriver, then rebuilds',
      async ({page}) => {
        test.setTimeout(330_000);

        await expect.poll(
            () => page.evaluate(
                () => window.factoryDebug!.guidance().visible),
            {timeout: 4_000}).toBe(true);
        await expect.poll(
            () => page.evaluate(
                () => window.factoryDebug!.guidance().title),
            {timeout: 4_000}).toBe('PLACE THE PALM');
        await expect.poll(
            () => page.evaluate(
                () => window.factoryDebug!.arrowCount()),
            {timeout: 4_000}).toBe(2);
        await expect.poll(
            () => page.evaluate(
                () => window.factoryDebug!.hostGlow()),
            {timeout: 4_000}).toBe('stand');
        await setWorldPose(page, 'right', TOOL_POSE, 0, TOOL_POSE_PITCH);
        expect(await page.evaluate(
            () => window.factoryDebug!.audienceCount())).toBe(12);

        await pressTool(page, 'right');
        expect(await page.evaluate(
            () => window.factoryDebug!.toolEquipped())).toBe(true);
        expect(await page.evaluate(
            () => window.factoryDebug!.toolVisible())).toBe(true);
        expect(await page.evaluate(
            () => window.factoryDebug!.toolParent())).toBe('handRep-right');

        await pressTool(page, 'right');
        expect(await page.evaluate(
            () => window.factoryDebug!.toolEquipped())).toBe(false);
        expect(await page.evaluate(
            () => window.factoryDebug!.toolVisible())).toBe(false);

        await pressTool(page, 'right');
        expect(await page.evaluate(
            () => window.factoryDebug!.toolEquipped())).toBe(true);

        const pointer = await page.evaluate(
            () => window.factoryDebug!.pointer('right'),
        ) as V3;
        const heldTip = await page.evaluate(
            () => window.factoryDebug!.tip(),
        ) as V3;
        const tipOff = sub(heldTip, pointer);

        for (const id of Object.keys(SOCKETS)) {
          await waitForActivePart(page, id);

          const socket = SOCKETS[id]!;
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
          if (id === 'palm') {
            await expect.poll(
                () => page.evaluate(
                    () => window.factoryDebug!.arrowCount()),
                {timeout: 4_000}).toBe(2);
            await expect.poll(
                () => page.evaluate(
                    () => window.factoryDebug!.guidance().title),
                {timeout: 4_000}).toBe('CARRY THE PALM');
          }

          await setWorldPose(page, 'left', releasePtr);
          await page.waitForTimeout(350);
          await trigger(page, 'left', false);

          await expect.poll(async () => (await sites(page)).length,
              {timeout: 8_000}).toBeGreaterThan(0);
          if (id === 'palm') {
            await expect.poll(
                () => page.evaluate(
                    () => window.factoryDebug!.arrowCount()),
                {timeout: 4_000}).toBe(4);
            await expect.poll(
                () => page.evaluate(
                    () => window.factoryDebug!.guidance().title),
                {timeout: 4_000}).toBe('DRIVE THE SCREWS');
            await expect.poll(
                () => page.evaluate(
                    () => window.factoryDebug!.hostGlow()),
                {timeout: 4_000}).toBe('');
          }

          for (let rounds = 0; rounds < 14; rounds++) {
            const remaining = await sites(page);
            if (remaining.length === 0) {
              break;
            }
            const site = remaining[0]!;
            const ptr = sub(site, tipOff);
            await setWorldPose(
                page, 'right', ptr, 0, TOOL_POSE_PITCH);
            await page.waitForTimeout(DRIVE_MS);
          }
          if ((await sites(page)).length > 0) {
            throw new Error(`failed to drive screws for ${id}`);
          }
          await page.waitForTimeout(300);
        }

        await expect(page.locator('#live-status'))
            .toHaveText('HAND COMPLETE! Take a bow.');

        const parts = await page.evaluate(
            () => window.factoryDebug!.parts());
        expect(parts).toHaveLength(13);
        for (const part of parts) {
          expect(part.placed, part.id).toBe(true);
          expect(part.screwsDone, part.id).toBe(part.screwCount);
          expect(part.enabled, part.id).toBe(true);
        }
        const byId = new Map(parts.map((part) => [part.id, part]));
        const palm = byId.get('palm');
        const index = byId.get('finger-index');
        const little = byId.get('finger-little');
        const thumbBase = byId.get('thumb-base');
        const thumbSegments = byId.get('thumb-segments');
        const cover = byId.get('upper-cover');
        expect(palm).toBeDefined();
        expect(index).toBeDefined();
        expect(little).toBeDefined();
        expect(thumbBase).toBeDefined();
        expect(thumbSegments).toBeDefined();
        expect(cover).toBeDefined();
        expect(palm!.min[1]!).toBeCloseTo(1.07, 2);
        expect(palm!.max[1]!).toBeLessThan(1.4);
        expect(index!.max[1]!).toBeGreaterThan(1.65);
        expect(index!.min[1]!).toBeLessThan(palm!.max[1]! + 0.03);
        expect(index!.min[0]!).toBeGreaterThan(little!.max[0]!);
        expect(thumbBase!.min[1]!).toBeLessThan(palm!.max[1]!);
        expect(thumbSegments!.min[1]!).toBeLessThan(thumbBase!.max[1]! + 0.01);
        expect(cover!.min[1]!).toBeLessThan(palm!.max[1]!);
        const maxX = Math.max(...parts.map((part) => part.max[0]!));
        const minX = Math.min(...parts.map((part) => part.min[0]!));
        expect(maxX - minX).toBeLessThan(0.5);
        expect(maxX - minX).toBeGreaterThan(0.25);

        const trace = await page.evaluate(() => {
          const store = window as unknown as {
            __audioTrace: Array<{
              t: number;
              voice: number;
              keys: string[];
              music: boolean;
            }>;
            __audioTimer: number;
          };
          window.clearInterval(store.__audioTimer);
          return store.__audioTrace;
        });
        expect(trace.length).toBeGreaterThan(10);
        const overlaps = trace.filter((sample) => sample.voice > 1);
        if (overlaps.length > 0) {
          console.log('voice overlap', JSON.stringify(overlaps.slice(0, 5)));
        }
        expect(overlaps, JSON.stringify(overlaps.slice(0, 3))).toHaveLength(0);

        await expect.poll(() => splashVisible(page),
            {timeout: 12_000}).toBe(true);
        await expect.poll(
            () => page.evaluate(() => window.factoryDebug!.splashGated()),
            {timeout: 15_000}).toBe(true);

        await page.evaluate(() => window.factoryDebug!.splashRebuild());
        expect(await splashVisible(page)).toBe(false);
        expect(await page.evaluate(
            () => window.factoryDebug!.toolEquipped())).toBe(false);

        await expect(page.locator('#live-status'))
            .not.toHaveText('HAND COMPLETE! Take a bow.');
        await expect.poll(async () => (await partInfo(page)).id,
            {timeout: 20_000}).toBe('palm');
        expect((await sites(page)).length).toBe(0);

        expect(audioStatuses.length).toBeGreaterThan(6);
        expect(audioStatuses.every((status) => status === 200)).toBe(true);
        const audio = await page.evaluate(
            () => window.factoryDebug!.audio());
        expect(audio.musicReady).toBe(true);
        expect(audio.base).not.toMatch(/^\/audio/);
      });
});
