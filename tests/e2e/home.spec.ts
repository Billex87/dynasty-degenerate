import { expect, test } from '@playwright/test';

test.describe('homepage smoke', () => {
  test('renders the league analyzer without horizontal overflow', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Obliterate Your Competition' })).toBeVisible();
    await expect(page.getByPlaceholder('Sleeper username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Find Leagues' })).toBeVisible();
    await expect(page.getByPlaceholder('Find in your Sleeper app settings or URL')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Degenerate Analysis' })).toBeVisible();

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });

    expect(overflow).toBeLessThanOrEqual(1);
  });
});
