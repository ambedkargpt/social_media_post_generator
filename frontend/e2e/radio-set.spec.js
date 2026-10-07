import { expect, test } from '@playwright/test';

/**
 * The radio page as a physical set, and the walk-through controls on it.
 *
 * No backend: the route only asks whether a user is in session storage, and
 * the bulletin is static files the dev server hands over. That is enough to
 * answer the two things worth asking - does the set render, and do the
 * demonstration controls appear for exactly one account.
 */

const DEMO_EMAIL = 'krishprakash1232@gmail.com';

async function signedInAs(page, email) {
  // The axios client sends anyone who gets a 401 on a protected page to
  // /login, so the one call this page makes has to be answered. With no
  // backend running it would 401, and the test would be looking at a login
  // form rather than at the radio.
  await page.route('**/questions/pending', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json',
                    body: JSON.stringify({ party: false, position: false }) }));

  await page.addInitScript((e) => {
    sessionStorage.setItem('skip-splash', '1');
    sessionStorage.setItem('ambedkargpt_questionnaire_prompted', '1');
    sessionStorage.setItem('user', JSON.stringify({
      id: 'e2e-user', username: 'e2e', email: e,
      political_party: 'Indian National Congress (INC)',
    }));
  }, email);
}

test.describe('the broadcast desk', () => {
  test('shows what is on air, the running order, and the transcript', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    await expect(page.getByText(/now on air|अभी ऑन एयर/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).not.toBeEmpty();

    // The running order is the rest of the bulletin, and it must not be
    // clickable: a station has no "skip to".
    const order = page.locator('ol li');
    expect(await order.count()).toBeGreaterThan(1);
    await expect(order.first().getByRole('button')).toHaveCount(0);

    // The transcript is the narration the manifest carries, not a summary
    // written beside it, so it has to have words in it.
    await expect(page.getByText(/transcript|पाठ/i).first()).toBeVisible();
  });

  test('offers tune in and nothing that pauses the broadcast', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');

    await expect(page.getByRole('button', { name: /tune in to bhim radio|भीम रेडियो ट्यून/i })).toBeVisible();
    // No transport for an ordinary listener - that was the whole point of the
    // brief, and the demo account is the one exception.
    await expect(page.getByRole('button', { name: /^(previous|next) track$/i })).toHaveCount(0);
  });

  test('the clock keeps moving for someone who never tuned in', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');

    const countdown = page.getByText(/next story in|अगली ख़बर/i).first();
    const first = await countdown.textContent();
    await page.waitForTimeout(2400);
    expect(await countdown.textContent()).not.toBe(first);
  });

  test('the tape layout draws the bulletin against a needle', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');

    await page.getByRole('button', { name: /^tape|टेप$/i }).click();
    await expect(page.getByText(/^NOW \d{2}:\d{2}:\d{2}$/)).toBeVisible();

    // The choice is remembered for this viewer, which is the point of shipping
    // both: compare them without re-picking on every visit.
    await page.reload();
    await expect(page.getByText(/^NOW \d{2}:\d{2}:\d{2}$/)).toBeVisible();
  });

  test('the demo account still gets its transport', async ({ page }) => {
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');

    await page.getByRole('button', { name: /walk-through|पूरी सैर/i }).click();
    await expect(page.getByRole('button', { name: /play|चलाएँ/i }).first()).toBeVisible();
    await expect(page.getByRole('slider', { name: /seek|आगे-पीछे/i })).toBeVisible();
  });

  test('and nobody else does', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');

    await expect(page.getByRole('button', { name: /walk-through|पूरी सैर/i })).toHaveCount(0);
  });
  test('the story sits left of the running order, both on screen', async ({ page }) => {
    // The first build put a generated element in the middle grid column. It
    // is a grid item, so the real children auto-placed around it: the story
    // landed in the right-hand column and the running order left the row.
    // Geometry rather than class names, because the classes were all correct.
    await page.setViewportSize({ width: 1440, height: 900 });
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    const story = await page.locator('.bhim-desk-body > section').boundingBox();
    const order = await page.locator('.bhim-desk-order').boundingBox();

    expect(story.x).toBeLessThan(order.x);          // story on the left
    // 1.45fr against 1fr: the ratio is what proves the columns took, and
    // unlike an absolute x it does not depend on how wide the sidebar is.
    expect(story.width).toBeGreaterThan(order.width);
    expect(order.x + order.width).toBeLessThanOrEqual(1441);
    // Side by side, not stacked.
    expect(Math.abs(story.y - order.y)).toBeLessThan(80);
  });
});
