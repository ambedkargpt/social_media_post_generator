import { expect, test } from '@playwright/test';

/**
 * The "Bhim Radio is live" strip on the landing page.
 *
 * Written because the strip looked missing in the browser and reading the
 * component could not settle it: everything that decides whether it paints -
 * the signed-in check, the pinned stack it shares with the milestone bar, the
 * slide-down animation's fill mode - only resolves in a real render. A unit
 * test with a mocked DOM would have agreed with the code and still been wrong.
 */

const STRIP = '.radio-live-strip';

// The opening splash and the language chooser cover the whole viewport on a
// first visit, so a click aimed at the strip lands on the modal instead. The
// app already has a way past them, and using it keeps these tests about the
// strip rather than about the intro.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('skip-splash', '1'));
});

test.describe('radio live strip', () => {
  test('a signed-out visitor sees it, with a way into the player', async ({ page }) => {
    await page.goto('/');

    const strip = page.locator(STRIP);
    await expect(strip).toBeVisible();

    // Visible is not enough: a zero-height or transparent strip is "visible"
    // to Playwright and invisible to a person.
    const box = await strip.boundingBox();
    expect(box.height).toBeGreaterThan(24);
    expect(box.width).toBeGreaterThan(200);

    await expect(strip.getByRole('button', { name: /log in to listen|लॉग इन/i })).toBeVisible();
  });

  test('it sends the visitor to login, and remembers where they were going',
    async ({ page }) => {
      await page.goto('/');
      await page.locator(STRIP).getByRole('button', { name: /log in to listen|लॉग इन/i }).click();

      await expect(page).toHaveURL(/\/login/);
      const intended = await page.evaluate(() => sessionStorage.getItem('auth_redirect'));
      expect(intended).toBe('/bhimradio');
    });

  test('it is not shown to someone already signed in', async ({ page }) => {
    // The strip's whole message is "log in to listen", so for a signed-in
    // reader it is an advert for a page already in their sidebar.
    await page.addInitScript(() => {
      sessionStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'tester' }));
    });
    await page.goto('/');

    await expect(page.locator(STRIP)).toHaveCount(0);
  });
});
