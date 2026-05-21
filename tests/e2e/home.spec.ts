import { expect, test } from '@playwright/test';

test.describe('homepage smoke', () => {
  test('renders the league analyzer without horizontal overflow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Win now. Win later. Build your dynasty.' })).toBeVisible();
    await expect(page.getByPlaceholder('Sleeper username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Degenerate Analysis' })).toBeVisible();
    await expect(page.getByPlaceholder('Find in your Sleeper app settings or URL')).toHaveCount(0);

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      return Math.max(root.scrollWidth, body.scrollWidth) - root.clientWidth;
    });

    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('renders the internal report component reference', async ({ page }) => {
    await page.goto('/components', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Fantasy Report Primitives')).toBeVisible();
    await expect(page.getByText('Dynasty Value')).toBeVisible();
    await expect(page.getByText('Season Value')).toBeVisible();
    await expect(page.getByText('Collapsed Preview Contract')).toBeVisible();
  });
});
