import { expect, test } from '@playwright/test';

/**
 * The headline crawl.
 *
 * Browser tests rather than unit ones because every part that can go wrong is
 * a rendering question: whether the strip is on the page at all, whether the
 * text actually moves, and whether it stays off the landing page. A mocked DOM
 * reports an animation as applied whether or not anything travels.
 */

const TICKER = '[aria-label="Bhim Radio headline ticker"], [aria-label="भीम रेडियो सुर्खियाँ"]';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('skip-splash', '1'));
});

test.describe('news ticker', () => {
  test('carries the headline the station is on, and moves it', async ({ page }) => {
    await page.goto('/about');

    const ticker = page.locator(TICKER);
    await expect(ticker).toBeVisible();

    const headline = ticker.locator('.news-ticker-track > span').first();
    await expect(headline).not.toBeEmpty();

    // The crawl is the whole point, so assert travel rather than the presence
    // of a class: a keyframe that never moves still sets animationName.
    const track = ticker.locator('.news-ticker-track');
    const first = await track.boundingBox();
    await page.waitForTimeout(1200);
    const later = await track.boundingBox();
    expect(later.x).toBeLessThan(first.x);
  });

  test('is not on the landing page', async ({ page }) => {
    // There the visitor is being told what the product is; the "radio is live"
    // strip speaks to them instead.
    await page.goto('/');
    await expect(page.locator(TICKER)).toHaveCount(0);
  });

  test('sits above whatever else is pinned under the navbar', async ({ page }) => {
    await page.goto('/about');

    // The milestone bar and the radio strip are both role=banner and both
    // carry translated labels, so they are found by role rather than by text.
    // boundingBox() waits for a locator to exist, so the count has to be
    // checked first - there may legitimately be nothing else pinned.
    const banners = page.locator('[role="banner"]');
    const n = await banners.count();
    test.skip(n === 0, 'nothing else is pinned on this run');

    const ticker = await page.locator(TICKER).boundingBox();
    for (let i = 0; i < n; i += 1) {
      const box = await banners.nth(i).boundingBox();
      if (box) expect(ticker.y).toBeLessThanOrEqual(box.y);
    }
  });
  test('the next headline arrives from the right edge, not from mid-screen',
    async ({ page }) => {
      // Two passes at their natural width both fit on a wide monitor, so the
      // second one appeared to start in the middle of the page. Each pass is
      // padded to the strip's own width to stop that, and the structural
      // consequence - a track at least twice the viewport - is what is
      // asserted here, because it holds at every moment of the animation
      // rather than only at the instant a screenshot is taken.
      await page.setViewportSize({ width: 1600, height: 800 });
      await page.goto('/about');

      const ticker = page.locator(TICKER);
      await expect(ticker).toBeVisible();

      const viewport = await ticker.locator('.news-ticker-track').evaluate((el) => {
        const strip = el.parentElement.getBoundingClientRect().width;
        const copy = el.firstElementChild.getBoundingClientRect().width;
        return { strip, copy };
      });

      expect(viewport.copy).toBeGreaterThanOrEqual(viewport.strip - 1);
    });
});
