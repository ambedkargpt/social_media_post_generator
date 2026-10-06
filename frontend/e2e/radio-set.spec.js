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

test.describe('the radio set', () => {
  test('renders as a set, with a readout and presets', async ({ page }) => {
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    // The readout is the part that proves the manifest arrived: it carries a
    // clock, which only exists once a duration is known.
    await expect(page.getByText(/\d+:\d{2}/).first()).toBeVisible();

    // A preset per story, and they seek rather than load.
    const presets = page.getByRole('button', { name: /^\d+$/ });
    expect(await presets.count()).toBeGreaterThan(0);

    // Both knobs are real controls, not pictures of them.
    await expect(page.getByRole('slider', { name: /volume|आवाज़/i })).toBeVisible();
  });

  test('the station switcher is gone', async ({ page }) => {
    // Only General is built today; the picker offered three stations that are
    // not on air and one that is.
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    await expect(page.getByRole('tab')).toHaveCount(0);
  });

  test('the walk-through is offered to the demo account', async ({ page }) => {
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    const open = page.getByRole('button', { name: /walk-through|पूरी सैर/i });
    await expect(open).toBeVisible();
    await open.click();

    // Every part of the bulletin, furniture included - which is the whole
    // point of it: the music, the voice, and the sign-off are each reachable.
    await expect(page.getByRole('button', { name: /^intro|^open|शुरुआत/i }).first()).toBeVisible();
  });

  test('and to nobody else', async ({ page }) => {
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    await expect(page.getByRole('button', { name: /walk-through|पूरी सैर/i })).toHaveCount(0);
  });
  test('for the demo account, stopping and starting holds its place', async ({ page }) => {
    // The point of the mode: stop on the opening music, talk over it, carry on
    // from that same second. On the broadcast it would have moved on.
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    const dial = page.getByRole('slider', { name: /seek|आगे-पीछे/i });
    await expect(dial).toBeEnabled();

    // Put it somewhere deliberate while stopped; the clock must not take it
    // back, which is what used to happen a second later.
    await dial.fill('95');
    await page.waitForTimeout(1600);
    expect(Number(await dial.inputValue())).toBeCloseTo(95, 0);
  });

  test('and the big button offers play rather than tune in', async ({ page }) => {
    await signedInAs(page, DEMO_EMAIL);
    await page.goto('/bhimradio');

    // The label carries the mode: a demo account is holding a tape, so it
    // must not be offered "tune in".
    await expect(page.getByRole('button', { name: /play|चलाएँ/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /tune in|सुनिए/i })).toHaveCount(0);
  });

  test('everyone else still gets the broadcast', async ({ page }) => {
    // Tuned out, the station carries on without them: the position keeps
    // moving on its own, which is the whole difference.
    await signedInAs(page, 'someone.else@example.com');
    await page.goto('/bhimradio');
    await expect(page).toHaveURL(/\/bhimradio/);

    const dial = page.getByRole('slider', { name: /seek|आगे-पीछे/i });
    const first = Number(await dial.inputValue());
    await page.waitForTimeout(2200);
    expect(Number(await dial.inputValue())).toBeGreaterThan(first);
  });
});
