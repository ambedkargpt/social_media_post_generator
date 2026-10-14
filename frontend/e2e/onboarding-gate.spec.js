import { expect, test } from '@playwright/test';

/**
 * Nobody reaches the post generator - or anything behind the login - without
 * a party and the preference questions.
 *
 * A Google sign-up arrives with a name and no party. The pending check started
 * from the party, so it reported nothing outstanding and the account went
 * straight to the dashboard and could generate posts. The backend now refuses
 * too; this is the app's half.
 */

const INC = 'Indian National Congress (INC)';

async function signedIn(page, user, pending) {
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    const body = url.includes('questions/pending') ? pending
      : url.includes('/questions/position') || url.includes('/questions/party') ? [
        { question_id: 'pos_inc_national_q1', question_text: 'Q1', options: ['A', 'B'], options_hi: ['अ', 'ब'] },
      ]
        : url.includes('daily-quota') ? { used: 0, limit: 5, remaining: 5 }
          : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.addInitScript((u) => {
    sessionStorage.setItem('skip-splash', '1');
    sessionStorage.setItem('user', JSON.stringify(u));
  }, { id: 'e2e', username: 'e2e', email: 'e2e@example.com', full_name: 'E2E User', ...user });
}

test('a new account with no party is sent to choose one, with no way to skip', async ({ page }) => {
  await signedIn(page, {}, { party: false, position: false, profile: true });
  await page.goto('/generate/social-media');

  await expect(page).toHaveURL(/\/profile-setup$/);
  await expect(page.getByRole('button', { name: /skip|छोड़/i })).toHaveCount(0);

  // And it stays there: every other page sends it back.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/profile-setup$/);
});

test('a party with unanswered preferences is sent to the questions, every time', async ({ page }) => {
  await signedIn(page, { political_party: INC, party_position: 'national_vice_president' },
    { party: false, position: true, profile: false });

  await page.goto('/generate/social-media');
  await expect(page).toHaveURL(/\/questionnaire$/);

  // Not a one-time prompt: the next page sends it back again.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/questionnaire$/);
  // No partial save past required questions.
  await expect(page.getByRole('button', { name: /save.*later|बाद/i })).toHaveCount(0);
});

test('an account that has done both gets in', async ({ page }) => {
  await signedIn(page, { political_party: INC, party_position: 'national_vice_president' },
    { party: false, position: false, profile: false });

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('the ON AIR strip on the dashboard opens the station and signs out', async ({ page }) => {
  await signedIn(page, { political_party: INC, party_position: 'national_vice_president' },
    { party: false, position: false, profile: false });
  await page.goto('/dashboard');
  const strip = page.getByRole('link', { name: /open bhim radio|भीम रेडियो खोलें/i });
  await expect(strip).toBeVisible({ timeout: 15000 });
  await strip.click();

  await expect(page).toHaveURL(/\/bhimradio$/);
  expect(await page.evaluate(() => sessionStorage.getItem('user'))).toBeNull();
});
