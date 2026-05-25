import { expect, test } from '@playwright/test';

test.describe('loading manager icons', () => {
  test('shows manager icons during the active loading preview', async ({ page }) => {
    await page.goto('/?preview=loading', { waitUntil: 'domcontentloaded' });

    const anchors = page.locator('.loader-kit-backdrop__manager-anchor');
    await expect(anchors).toHaveCount(12);
    await expect(anchors.first()).toBeVisible();

    const visibleAnchorCount = await anchors.evaluateAll(nodes =>
      nodes.filter(node => {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          Number(style.opacity) > 0.5 &&
          box.width >= 32 &&
          box.height >= 32 &&
          box.left < window.innerWidth &&
          box.right > 0 &&
          box.top < window.innerHeight &&
          box.bottom > 0
        );
      }).length
    );

    expect(visibleAnchorCount).toBeGreaterThanOrEqual(8);

    const maxCenterOffset = await anchors.evaluateAll(nodes =>
      Math.max(
        ...nodes.map(node => {
          const anchor = node as HTMLElement;
          const avatar = anchor.querySelector<HTMLElement>('.loader-kit-backdrop__manager-avatar');
          const dot = anchor.querySelector<HTMLElement>('.loader-kit-backdrop__manager-node');
          if (!avatar || !dot) return Number.POSITIVE_INFINITY;

          const avatarBox = avatar.getBoundingClientRect();
          const dotBox = dot.getBoundingClientRect();
          const avatarCenterX = avatarBox.left + avatarBox.width / 2;
          const avatarCenterY = avatarBox.top + avatarBox.height / 2;
          const dotCenterX = dotBox.left + dotBox.width / 2;
          const dotCenterY = dotBox.top + dotBox.height / 2;

          return Math.hypot(avatarCenterX - dotCenterX, avatarCenterY - dotCenterY);
        })
      )
    );

    expect(maxCenterOffset).toBeLessThanOrEqual(1);
  });
});
