import { test, expect } from '@playwright/test';

test.describe('SoundCard App Test', () => {
  test('page loads correctly', async ({ page }) => {
    // 5173または5174のどちらか起動している方に接続
    let response;
    try {
      response = await page.goto('http://localhost:5173/');
    } catch {
      response = await page.goto('http://localhost:5174/');
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/加治屋　宏樹/Desktop/sound_card/screenshots/page_load.png', fullPage: true });
    const body = page.locator('body');
    await expect(body).toBeVisible();
    console.log('Page loaded successfully');
  });

  test('all buttons visible', async ({ page }) => {
    try {
      await page.goto('http://localhost:5173/');
    } catch {
      await page.goto('http://localhost:5174/');
    }
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/加治屋　宏樹/Desktop/sound_card/screenshots/micro_test.png', fullPage: true });
    const buttons = page.locator('button');
    const count = await buttons.count();
    console.log('Button count: ' + count);
    expect(count).toBeGreaterThan(0);
  });
});
