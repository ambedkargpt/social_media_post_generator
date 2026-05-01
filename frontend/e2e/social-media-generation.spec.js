import { expect, test } from '@playwright/test';

const API_BASE_URL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function loginViaApi(request) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(true, 'Set E2E_EMAIL and E2E_PASSWORD for live frontend-backend E2E.');
  }

  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      identifier: E2E_EMAIL,
      password: E2E_PASSWORD,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body?.tokens?.access_token).toBeTruthy();
  expect(body?.tokens?.refresh_token).toBeTruthy();
  expect(body?.user?.id).toBeTruthy();
  expect(body?.otp_required).toBeFalsy();
  return body;
}

test.describe('Social media generation E2E', () => {
  test('generate and regenerate call backend pipeline endpoints', async ({ page, request }) => {
    const auth = await loginViaApi(request);

    await page.addInitScript((payload) => {
      localStorage.setItem('access_token', payload.tokens.access_token);
      localStorage.setItem('refresh_token', payload.tokens.refresh_token);
      localStorage.setItem('user', JSON.stringify(payload.user));
    }, auth);

    await page.goto('/generate/social-media');
    await expect(page.getByText('Social Post Generator')).toBeVisible();

    const generateResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/posts/generate') &&
        resp.request().method() === 'POST',
      { timeout: 90_000 }
    );
    await page.getByRole('button', { name: /^Generate$/ }).first().click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.status(), 'Generate should succeed').toBe(200);
    const generateBody = await generateResponse.json();
    expect(generateBody?.retrieval_snapshot_id).toBeTruthy();
    expect(generateBody?.retrieval_reused).toBe(false);

    const regenerateResponsePromise = page.waitForResponse(
      (resp) =>
        /\/api\/v1\/posts\/[^/]+\/regenerate$/.test(resp.url()) &&
        resp.request().method() === 'POST',
      { timeout: 90_000 }
    );
    await page.getByRole('button', { name: /Regenerate/i }).click();
    const regenerateResponse = await regenerateResponsePromise;
    expect(regenerateResponse.status(), 'Regenerate should succeed').toBe(200);
    const regenerateBody = await regenerateResponse.json();
    expect(regenerateBody?.retrieval_reused).toBe(true);
    expect(regenerateBody?.retrieval_snapshot_id).toBe(generateBody?.retrieval_snapshot_id);
  });
});
