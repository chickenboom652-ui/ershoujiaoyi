import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(resolve('docs/prototypes/heji-mobile.html')).href;
test('手机原型：卡片、搜索详情和收藏互不干扰', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const cards = page.locator('[data-products="home"] .product');
  const dialog = page.locator('#info-dialog');
  for (let i = 0; i < 4; i++) {
    const title = await cards.nth(i).locator('h3').innerText();
    await cards.nth(i).locator('.picture > svg').click();
    await expect(page.locator('#dialog-title')).toHaveText(title);
    await expect(dialog.locator('.detail-description')).not.toBeEmpty();
    await expect(dialog.locator('.detail-facts')).toContainText('数量');
    await expect(dialog.locator('.detail-facts')).toContainText('自取地点');
    await dialog.getByRole('button', { name: '我想要 · 联系卖家' }).click();
    await expect(dialog.locator('.contact-preview')).toContainText('不能联系真实卖家');
    await dialog.locator('[data-close]').first().click();
  }
  await cards.first().locator('.heart').click();
  await expect(dialog).not.toBeVisible();
  await expect(cards.first().locator('.heart')).toHaveAttribute('aria-pressed', 'true');
  await cards.first().focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-close]').first().click();
  const input = page.locator('#live-search');
  const before = await input.boundingBox();
  await input.click();
  expect((await input.boundingBox()).width).toBeGreaterThan(before.width);
  await input.fill('台');
  await expect(page.locator('#live-results [role="option"]')).toHaveCount(1);
  await expect(page.locator('[data-page="home"]')).toBeVisible();
  await page.locator('#live-results [role="option"]').click();
  await expect(dialog.locator('.detail-description')).toContainText('亮度可调');
  await dialog.locator('[data-close]').first().click();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  expect(errors).toEqual([]);
});

test('手机原型：五秒轮播循环与暂停', async ({ page }) => {
  await page.goto(url);
  await page.clock.install();
  await page.locator('button[data-slide="0"]').click();
  const carousel = page.locator('.hero-carousel');
  for (const slide of ['1', '2', '0']) {
    await page.clock.runFor(5000);
    await expect(carousel).toHaveAttribute('data-slide', slide);
    await expect(page.locator(`button[data-slide="${slide}"]`)).toHaveAttribute('aria-current', 'true');
  }
  await page.clock.runFor(700);
  await page.locator('.carousel-pause').click();
  await page.clock.runFor(6000);
  await expect(carousel).toHaveAttribute('data-slide', '0');
});
