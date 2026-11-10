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

  await page.mouse.click(1187, 655);
  await expect(status).toContainText('Part returned', {timeout: 5_000});
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
  await expect(status).toHaveAttribute('data-xr', 'present');

  await page.mouse.click(640, 587);
  await expect(status).toContainText('VR did not start', {timeout: 5_000});
});
