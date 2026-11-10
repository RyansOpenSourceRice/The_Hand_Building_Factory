import {expect, test} from '@playwright/test';

test('boots to a running scene with no page errors', async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('/');
  await expect(page).toHaveTitle(/HANDS ON!/);
  await expect(page.locator('#stage')).toBeVisible();

  const status = page.locator('#live-status');
  await expect(status).toHaveAttribute('data-ready', /^(xr|desktop)$/, {
    timeout: 20_000,
  });

  expect(errors).toEqual([]);
});
