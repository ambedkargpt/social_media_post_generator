import { expect, test } from '@playwright/test';

/**
 * Sign-up is three steps - account, where you are, party & role - instead of
 * one long column. Each step checks its own fields before moving on, and Back
 * keeps what was typed.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('skip-splash', '1'));
});

const next = (page) => page.getByRole('button', { name: /^(next|आगे)/i }).click();

test('three steps, each checked before the next, and Back keeps what was typed', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText(/step 1 of 3|चरण 1 \/ 3/i)).toBeVisible();
  // Nothing from later steps on the first one (the phone field has its own
  // country select, so this looks for the state list itself).
  await expect(page.locator('option', { hasText: /select your state|अपना राज्य चुनें/i })).toHaveCount(0);

  await next(page);
  await expect(page.getByText(/step 1 of 3|चरण 1 \/ 3/i)).toBeVisible();   // held back

  await page.locator('form input').first().fill('test@example.com');
  const pw = page.locator('input[type="password"]');
  await pw.nth(0).fill('password123');
  await pw.nth(1).fill('password123');
  await next(page);
  await expect(page.getByText(/step 2 of 3|चरण 2 \/ 3/i)).toBeVisible();

  await page.getByRole('button', { name: /^(back|वापस)/i }).click();
  await expect(page.locator('form input').first()).toHaveValue('test@example.com');
  await next(page);

  const stateSelect = page.locator('select', { has: page.locator('option', { hasText: /select your state|अपना राज्य चुनें/i }) });
  await stateSelect.selectOption({ index: 1 });
  await stateSelect.locator('xpath=../following-sibling::div//select').selectOption({ index: 1 });
  await next(page);
  await expect(page.getByText(/step 3 of 3|चरण 3 \/ 3/i)).toBeVisible();

  // Submitting empty points at the party, the confirmation and the terms.
  await page.locator('form button[type=submit]').click();
  await expect(page.getByText(/select a political party|राजनीतिक दल चुनें।/i)).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
