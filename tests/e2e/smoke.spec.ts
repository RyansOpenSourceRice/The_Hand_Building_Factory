import {expect, test} from '@playwright/test';

test('boots to a running scene with no page errors', async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await expect(page).toHaveTitle(/HANDS ON!/);
  await expect(page.locator('#stage')).toBeVisible();

  const status = page.locator('#live-status');
  const readyPattern = browserName === 'chromium' ? 'xr' : 'desktop';
  await expect(status).toHaveAttribute('data-ready', readyPattern, {
    timeout: 20_000,
  });

  expect(errors).toEqual([]);
});

test('reports nothing to undo before any action', async ({page}) => {
  test.skip(
      test.info().project.name !== 'firefox',
      'status copy is asserted on the desktop project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'desktop', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());

  await page.mouse.click(915, 655);
  await expect(status).toContainText('Nothing to undo', {timeout: 5_000});
});

test('reset returns the part', async ({page}) => {
  test.skip(
      test.info().project.name !== 'firefox',
      'status copy is asserted on the desktop project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'desktop', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());

  await page.mouse.click(1187, 655);
  await expect(status).toContainText('returned', {timeout: 5_000});
  await expect(status).toHaveAttribute('data-part', /^palm:/);
});

test('settings buttons flip turn mode and snap angle', async ({page}) => {
  test.skip(
      test.info().project.name !== 'firefox',
      'settings copy is asserted on the desktop project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'desktop', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());
  await expect(status).toHaveAttribute('data-turn', 'snap');
  await expect(status).toHaveAttribute('data-angle', '45');

  await page.mouse.click(103, 655);
  await expect(status).toHaveAttribute('data-turn', 'smooth');
  await page.mouse.click(103, 655);
  await expect(status).toHaveAttribute('data-turn', 'snap');

  await page.mouse.click(231, 655);
  await expect(status).toHaveAttribute('data-angle', '90');
  await page.mouse.click(231, 655);
  await expect(status).toHaveAttribute('data-angle', '30');
});

test('WASD moves the desktop camera', async ({page}) => {
  test.skip(
      test.info().project.name !== 'firefox',
      'keyboard movement is asserted on the desktop project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'desktop', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());
  await expect(status).toHaveAttribute('data-cam', '0.00,2.20');

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');

  await expect(status).not.toHaveAttribute('data-cam', '0.00,2.20');
  const cam = await status.getAttribute('data-cam');
  const z = Number(cam?.split(',')[1]);
  expect(z).toBeLessThan(2.2);
  expect(z).toBeGreaterThan(0.69);
});

test('enter VR fails gracefully without a device', async ({page}) => {
  test.skip(
      test.info().project.name !== 'chromium',
      'the xr path is asserted on the chromium project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'xr', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());
  await expect(status).toHaveAttribute('data-xr', 'present');

  await page.mouse.click(640, 587);
  await expect(status).toContainText('VR did not start', {timeout: 5_000});
});

test('the filament palette recolors printed hand parts', async ({page}) => {
  test.skip(
      test.info().project.name !== 'firefox',
      'colour state is asserted on the desktop project',
  );
  await page.goto('/');
  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', 'desktop', {
    timeout: 20_000,
  });
  await page.evaluate(() => window.factoryDebug!.splashSkip());

  expect((await page.evaluate(
      () => window.factoryDebug!.partColor('palm'))).toLowerCase())
      .toBe('#e8e2d4');
  await page.evaluate(
      () => window.factoryDebug!.selectTheme('primary', 5));
  await expect.poll(
      () => page.evaluate(
          () => window.factoryDebug!.partColor('palm').toLowerCase()),
      {timeout: 4_000}).toBe('#c9a227');
});
