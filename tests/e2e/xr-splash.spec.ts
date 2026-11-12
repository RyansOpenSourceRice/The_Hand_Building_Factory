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
      [hand === 'left' ? 'y-button' : 'b-button']:
        component('button', 5),
    },
    gamepad: {mapping: 'xr-standard'},
    selectComponentId: 'xr-standard-trigger',
    assetPath: 'controller.glb',
  };
}

async function pressButton(page: Page, side: 'left' | 'right',
    ms: number): Promise<void> {
  await page.evaluate(({side}) => {
    window.__xrMock!.setController(side, {aButton: 1});
  }, {side});
  await page.waitForTimeout(ms);
  await page.evaluate(({side}) => {
    window.__xrMock!.setController(side, {aButton: 0});
  }, {side});
}

async function splashVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => window.factoryDebug!.splashVisible());
}

test.describe('xr credit splash (chromium + mock navigator.xr)', () => {
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
    await page.waitForTimeout(500);
  });

  test('boot credits hold for four seconds, then skip and release the menu',
      async ({page}) => {
        await page.evaluate(() => window.factoryDebug!.splashRegate());
        expect(await splashVisible(page)).toBe(true);
        expect(await page.evaluate(
            () => window.factoryDebug!.splashGated())).toBe(false);

        await pressButton(page, 'left', 400);
        expect(await splashVisible(page)).toBe(true);

        await pressButton(page, 'right', 400);
        expect(await splashVisible(page)).toBe(true);
        expect(await page.evaluate(
            () => window.factoryDebug!.menu())).toBe(false);

        await expect.poll(async () => page.evaluate(
            () => window.factoryDebug!.splashGated()),
        {timeout: 10_000}).toBe(true);

        await pressButton(page, 'right', 400);
        expect(await splashVisible(page)).toBe(false);

        await pressButton(page, 'right', 400);
        expect(await page.evaluate(
            () => window.factoryDebug!.menu())).toBe(true);
        await pressButton(page, 'right', 400);
        expect(await page.evaluate(
            () => window.factoryDebug!.menu())).toBe(false);
      });
});
