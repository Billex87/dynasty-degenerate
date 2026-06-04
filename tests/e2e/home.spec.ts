import { expect, test } from '@playwright/test';

test.describe('homepage smoke', () => {
  test('renders the league analyzer without horizontal overflow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByPlaceholder('Sleeper username')).toBeVisible();
    await expect(page.getByRole('button', { name: /Run (The Damn Report|Degenerate Analysis)/ })).toBeVisible();
    await expect(page.getByPlaceholder('Find in your Sleeper app settings or URL')).toBeVisible();

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

  test('renders public legal and product policy pages', async ({ page }) => {
    const routes = [
      ['/terms', 'Dynasty Degenerates Terms'],
      ['/privacy', 'Privacy and Data Handling'],
      ['/refunds', 'Refunds, Cancellations, and Paid Access'],
      ['/data-disclosures', 'Fantasy Data Source and Confidence Disclosures'],
      ['/support', 'Support and Contact'],
    ] as const;

    for (const [path, heading] of routes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByText('Last updated: June 2, 2026')).toBeVisible();
      await expect(
        page.getByRole('main').getByRole('navigation', { name: 'Legal sections' })
      ).toBeVisible();
    }
  });
});
