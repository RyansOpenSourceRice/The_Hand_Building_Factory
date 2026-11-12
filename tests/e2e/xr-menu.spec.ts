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

function component(type: string, button: number): unknown {
  return {type, gamepadIndices: {button}, visualResponses: {}};
}

function stickLayout(hand: 'left' | 'right'): Record<string, unknown> {
  return {
    components: {
      'xr-standard-trigger': component('trigger', 0),
      'xr-standard-squeeze': component('squeeze', 1),
      'xr-standard-thumbstick': component('thumbstick', 3),
      [hand === 'left' ? 'x-button' : 'a-button']:
        component('button', 4),
    },
    gamepad: {mapping: 'xr-standard'},
    selectComponentId: 'xr-standard-trigger',
    assetPath: 'controller.glb',
  };
}

type V3 = [number, number, number];

async function partCenter(page: Page): Promise<V3> {
  return page.evaluate(() => window.factoryDebug!.partCenter()) as Promise<V3>;
}

async function menuVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => window.factoryDebug!.menu());
}

async function pressButton(page: Page, side: 'left' | 'right',
    ms: number): Promise<void> {
  await page.evaluate(
      ({side}) => {
        window.__xrMock!.setController(side, {aButton: 1});
      },
      {side},
  );
  await page.waitForTimeout(ms);
  await page.evaluate(
      ({side}) => {
        window.__xrMock!.setController(side, {aButton: 0});
      },
      {side},
  );
  await page.waitForTimeout(300);
}

async function squeeze(page: Page, side: 'left' | 'right',
    ms: number): Promise<void> {
  await page.evaluate(
      ({side}) => {
        window.__xrMock!.setController(side, {squeeze: 1});
      },
      {side},
  );
  await page.waitForTimeout(ms);
  await page.evaluate(
      ({side}) => {
        window.__xrMock!.setController(side, {squeeze: 0});
      },
      {side},
  );
  await page.waitForTimeout(800);
}

test.describe('xr menu (chromium + mock navigator.xr)', () => {
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
    await page.waitForTimeout(500);
  });

  test('right A button toggles the menu panel', async ({page}) => {
    expect(await menuVisible(page)).toBe(false);
    await pressButton(page, 'right', 300);
    expect(await menuVisible(page)).toBe(true);
    await pressButton(page, 'right', 300);
    expect(await menuVisible(page)).toBe(false);
  });

  test('left X button toggles the menu panel', async ({page}) => {
    expect(await menuVisible(page)).toBe(false);
    await pressButton(page, 'left', 300);
    expect(await menuVisible(page)).toBe(true);
    await pressButton(page, 'left', 300);
    expect(await menuVisible(page)).toBe(false);
  });

  test('squeezing empty hands does not reset the active part',
      async ({page}) => {
        const before = await partCenter(page);
        await squeeze(page, 'left', 400);
        await squeeze(page, 'right', 400);
        const after = await partCenter(page);
        const drift = Math.hypot(
            after[0] - before[0],
            after[1] - before[1],
            after[2] - before[2],
        );
        expect(drift).toBeLessThan(0.05);
      });
});
