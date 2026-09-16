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
    await expect(page.locator('[data-page=chat]')).toBeVisible();
    await expect(page.locator('#chat-product-title')).toHaveText(title);
    await expect(page.locator('.nav-item[data-go=messages]')).toHaveAttribute('aria-current', 'page');
    await page.locator('.nav-item[data-go=home]').click();
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


test('发布后我的发布展示真实填写内容，对话按卖家保存', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  await page.locator('.nav-item[data-go=publish]').click();
  const form=page.locator('#publish-prototype');
  await form.locator('[name=title]').fill('我的测试笔记本');
  await form.locator('[name=description]').fill('只写了三页，剩余空白');
  await form.locator('[name=price]').fill('12.50');
  await form.locator('[name=quantity]').fill('2');
  await form.locator('[name=location]').fill('图书馆门口');
  await form.locator('button[type=submit],button.primary').click();
  await expect(page.locator('#my-title')).toHaveText('我发布的');
  const card=page.locator('[data-products=my] .product');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('我的测试笔记本');
  await expect(card.locator('.price')).toHaveText('¥12.50');
  await card.locator('h3').click();
  await expect(page.locator('.detail-description')).toHaveText('只写了三页，剩余空白');
  await expect(page.locator('.detail-facts')).toContainText('2 件');
  await expect(page.locator('.detail-facts')).toContainText('图书馆门口');
  await page.locator('#info-dialog [data-close]').first().click();
  await page.locator('.nav-item[data-go=home]').click();
  await page.locator('[data-products=home] .product h3').filter({hasText:'高数与线代'}).click();
  await page.getByRole('button',{name:'我想要 · 联系卖家'}).click();
  await expect(page.locator('#chat-seller')).toHaveText('小林同学');
  await page.getByRole('textbox',{name:'输入消息'}).fill('你好，请问还在吗？');
  await page.locator('#chat-form button').click();
  await expect(page.locator('.chat-bubble')).toHaveText('你好，请问还在吗？');
  await page.locator('.nav-item[data-go=messages]').click();
  await expect(page.locator('#conversation-list')).toContainText('你好，请问还在吗？');
  await page.locator('#conversation-list button').click();
  await expect(page.locator('.chat-bubble')).toHaveCount(1);
  await page.locator('.nav-item[data-go=home]').click();
  await page.locator('[data-products=home] .product h3').filter({hasText:'暖光阅读台灯'}).click();
  await page.getByRole('button',{name:'我想要 · 联系卖家'}).click();
  await expect(page.locator('#chat-seller')).toHaveText('小陈同学');
  await expect(page.locator('.chat-bubble')).toHaveCount(0);
});


test('收藏与发布联动：首页、照片、搜索及收藏详情保持一致', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('.brand')).toHaveText('盒闲');
  await page.locator('.nav-item[data-go=mine]').click();
  await page.locator('[data-my=favorites]').click();
  await expect(page.locator('[data-products=my] .empty')).toContainText('还没有收藏');
  await page.locator('.nav-item[data-go=home]').click();
  const first=page.locator('[data-products=home] .product').first();
  const title=await first.locator('h3').innerText();
  await first.locator('.heart').click();
  await page.locator('.nav-item[data-go=mine]').click();
  await page.locator('[data-my=favorites]').click();
  await expect(page.locator('[data-products=my] .product')).toHaveCount(1);
  await expect(page.locator('[data-products=my] h3')).toHaveText(title);
  await page.locator('[data-products=my] .heart').click();
  await expect(page.locator('[data-products=my] .product')).toHaveCount(0);
  await expect(first.locator('.heart')).toHaveAttribute('aria-pressed','false');
  await page.locator('.nav-item[data-go=publish]').click();
  const form=page.locator('#publish-prototype');
  await form.locator('[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=','base64')});
  await form.locator('[name=title]').fill('蓝色保温杯');
  await form.locator('[name=description]').fill('全新杯子，带包装');
  await form.locator('[name=price]').fill('28');
  await form.locator('[name=location]').fill('校门口');
  await form.locator('button.primary').click();
  await page.locator('.nav-item[data-go=home]').click();
  const cup=page.locator('[data-products=home] .product').filter({hasText:'蓝色保温杯'});
  await expect(cup).toBeVisible();
  await expect(cup.locator('.picture>img')).toBeVisible();
  await cup.locator('.heart').click();
  await page.locator('#live-search').fill('保温');
  await expect(page.locator('#live-results [role=option]')).toHaveCount(1);
  await page.locator('#live-results [role=option]').click();
  await expect(page.locator('#dialog-title')).toHaveText('蓝色保温杯');
  await expect(page.locator('.detail-description')).toHaveText('全新杯子，带包装');
  await expect(page.locator('#dialog-content img')).toBeVisible();
  await page.locator('#info-dialog [data-close]').first().click();
  await page.locator('.nav-item[data-go=mine]').click();
  await page.locator('[data-my=favorites]').click();
  await expect(page.locator('[data-products=my] h3')).toHaveText('蓝色保温杯');
  await page.locator('[data-products=my] h3').click();
  await expect(page.locator('.detail-facts')).toContainText('校门口');
  expect(errors).toEqual([]);
});


test('照片上传区：顺序追加、六张上限、删除恢复与手机换行', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(url);
  await page.locator('.nav-item[data-go=publish]').click();
  const input=page.locator('#photo-file-input');
  await expect(input).toBeHidden();
  const photo=i=>({name:'photo'+i+'.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII=','base64')});
  const chooser=page.waitForEvent('filechooser');await page.locator('.photo-add').click();await (await chooser).setFiles(photo(1));
  await expect(page.locator('.photo-tile')).toHaveCount(1);
  const original=await page.locator('.photo-tile img').first().getAttribute('src');
  const first=await page.locator('.photo-tile').boundingBox(),add=await page.locator('.photo-add').boundingBox();
  expect(add.x).toBeGreaterThan(first.x);expect(add.y).toBe(first.y);
  await input.setInputFiles([photo(2),photo(3)]);
  await expect(page.locator('.photo-tile')).toHaveCount(3);
  expect((await page.locator('.photo-add').boundingBox()).y).toBeGreaterThan(first.y);
  await expect(page.locator('.photo-tile img').first()).toHaveAttribute('src',original);
  await input.setInputFiles([photo(4),photo(5),photo(6),photo(7)]);
  await expect(page.locator('.photo-tile')).toHaveCount(6);
  await expect(page.locator('.photo-add')).toHaveCount(0);
  await expect(page.locator('#photo-count')).toHaveText('6 / 6 张');
  await page.getByRole('button',{name:'删除第 2 张照片'}).click();
  await expect(page.locator('.photo-tile')).toHaveCount(5);
  await expect(page.locator('#local-photos > :last-child')).toHaveClass('photo-add');
  await input.setInputFiles(photo(2));await expect(page.locator('.photo-tile')).toHaveCount(6);
  for(const width of [320,375,390,430]){
    await page.setViewportSize({width,height:844});
    const area=await page.locator('.photo-upload-area').boundingBox();
    for(const tile of await page.locator('.photo-tile').all()){const box=await tile.boundingBox();expect(box.x).toBeGreaterThanOrEqual(area.x);expect(box.x+box.width).toBeLessThanOrEqual(area.x+area.width);}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  for(let i=0;i<6;i++)await page.getByRole('button',{name:'删除第 1 张照片'}).click();
  await expect(page.locator('#photo-count')).toHaveText('0 / 6 张');await expect(page.locator('.photo-add')).toBeVisible();
});
