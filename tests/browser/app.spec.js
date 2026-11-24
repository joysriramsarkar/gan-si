const { test, expect } = require('@playwright/test');

test('app loads with all 10 tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/গান-সি|সুর সাধনা/);
  const tabs = page.locator('.tab-btn');
  await expect(tabs).toHaveCount(10);
});

test('tab navigation switches panels', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-theory"]');
  await expect(page.locator('#tab-theory')).toHaveClass(/active/);
  await page.click('.tab-btn[data-tab="tab-ear"]');
  await expect(page.locator('#tab-ear')).toHaveClass(/active/);
});

test('theory centre renders 10 chapters', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-theory"]');
  await expect(page.locator('#theoryList > div').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#theoryList > div')).toHaveCount(10);
});

test('alankar generator produces a pattern', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-progress"]');
  await page.click('#genBtn');
  await expect(page.locator('#genOutput')).not.toBeEmpty();
});

test('ear training play + answer flow', async ({ page }) => {
  await page.goto('/');
  await page.click('.tab-btn[data-tab="tab-ear"]');
  await page.click('#earPlayBtn');
  await page.click('.ear-answer[data-swara="সা"]');
  await expect(page.locator('#earScore')).not.toContainText('0/0');
});

test('mic starts with fake device (guided practice path)', async ({ page, context }) => {
  await context.grantPermissions(['microphone']);
  await page.goto('/');
  await page.click('#startMicBtn');
  await expect(page.locator('#startMicBtn')).toContainText(/থামান/, { timeout: 15000 });
  // pitch hero should leave placeholder state once fake audio flows
  await page.click('#startMicBtn');
  await expect(page.locator('#startMicBtn')).toContainText(/রেও/);
});
