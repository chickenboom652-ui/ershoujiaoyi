import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('浏览器双用户发布审核收藏联系已售闭环', async ({ browser }) => {
  const sellerContext = await browser.newContext(); const buyerContext = await browser.newContext(); const adminContext = await browser.newContext();
  const seller = await sellerContext.newPage(); const buyer = await buyerContext.newPage(); const admin = await adminContext.newPage();
  const errors = []; for (const page of [seller, buyer, admin]) page.on('pageerror', e => errors.push(e.message));
  const title = `测试台灯-${Date.now()}`;
  await seller.goto('/'); await expect(seller.locator('.product-card').first()).toBeVisible();
  await seller.getByRole('button', { name: '发布闲置', exact: false }).click();
  await seller.getByRole('button', { name: '以小林同学体验 · 卖家' }).click();
  await expect(seller.locator('#dialog')).not.toBeVisible();
  await seller.getByRole('button', { name: '发布闲置', exact: false }).click();
  const image = await sharp({ create: { width: 320, height: 300, channels: 3, background: '#b8d4b2' } }).png().toBuffer();
  await seller.locator('#photo-input').setInputFiles({ name: 'lamp.png', mimeType: 'image/png', buffer: image });
  await expect(seller.locator('.photo-preview')).toHaveCount(1);
  await seller.getByLabel('商品名称', { exact: true }).fill(title);
  await seller.getByLabel('商品简介', { exact: true }).fill('九成新，灯光正常，附电源线。');
  await seller.getByLabel('分类', { exact: true }).selectOption('宿舍好物');
  await seller.getByLabel('单价（元）').fill('35.50');
  await seller.getByLabel('自取交接地点（必填）').fill('图书馆门口');
  await seller.getByLabel('联系方式', { exact: true }).fill('campus_lamp');
  await seller.locator('[name=consent]').check();
  await seller.getByRole('button', { name: '提交审核' }).click();
  const mine = seller.locator('.product-card').filter({ hasText: title });
  await expect(mine).toBeVisible(); await expect(mine).toContainText('待审核');
  await admin.goto('/admin.html'); await admin.getByLabel('管理员密码').fill('demo-admin-2026'); await admin.getByRole('button', { name: '登录后台' }).click();
  const review = admin.locator('.admin-card').filter({ hasText: title }); await expect(review).toBeVisible();
  await review.getByRole('button', { name: '通过审核' }).click(); await expect(review).toHaveCount(0);
  await buyer.goto('/'); await buyer.getByLabel('搜索商品').fill(title); await buyer.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(buyer.locator('.product-card')).toHaveCount(1);
  await buyer.locator('.product-card h3').click(); await expect(buyer.locator('.description')).toContainText('附电源线');
  await buyer.getByRole('button', { name: '联系卖家' }).click(); await buyer.getByRole('button', { name: '以小陈同学体验 · 买家' }).click();
  await expect(buyer.locator('#dialog')).not.toBeVisible(); await buyer.locator('.product-card h3').click();
  await buyer.getByRole('button', { name: '联系卖家' }).click(); await expect(buyer.locator('#contact-box')).toContainText('campus_lamp');
  await buyer.getByRole('button', { name: '♡ 收藏', exact: true }).click(); await expect(buyer.getByRole('button', { name: '♥ 已收藏' })).toBeVisible();
  await buyer.getByRole('button', { name: '关闭', exact: true }).click(); await buyer.locator('.bottom-nav [data-nav=profile]').click(); await buyer.locator('[data-nav=favorites]').click(); await expect(buyer.locator('.product-card').filter({ hasText: title })).toBeVisible();
  await seller.reload(); await expect(mine).toContainText('展示中');
  seller.once('dialog', dialog => dialog.accept()); await mine.getByRole('button', { name: '标记已售' }).click(); await expect(mine).toContainText('已售出');
  await buyer.reload(); const saved = buyer.locator('.product-card').filter({ hasText: title }); await expect(saved).toContainText('商品已售出、下架或重新审核');
  await saved.getByRole('button', { name: '取消收藏' }).click(); await expect(saved).toHaveCount(0);
  expect(errors).toEqual([]);
  await sellerContext.close(); await buyerContext.close(); await adminContext.close();
});

test('桌面和手机视口无横向溢出，搜索空状态和分类可用', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.product-card').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: '教材书籍', exact: true }).click();
  await expect(page.locator('.product-card').first()).toContainText('高数');
  await page.getByLabel('搜索商品').fill('不存在的物品abcdef'); await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('#feed').getByText('暂时没有找到相关好物')).toBeVisible();
  await page.getByLabel('搜索商品').fill(''); await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByRole('button', { name: '全部好物' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.product-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true, animations: 'disabled' });
});

test('移动端发布表单可操作且错误不会清空输入', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '发布闲置', exact: false }).click();
  await page.getByRole('button', { name: '以小林同学体验 · 卖家' }).click();
  await expect(page.locator('#dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '发布闲置', exact: false }).click();
  await page.getByLabel('商品名称', { exact: true }).fill('未上传照片的测试');
  await page.getByLabel('商品简介', { exact: true }).fill('测试失败时不丢失用户输入。');
  await page.getByLabel('单价（元）').fill('12.99');
  await page.getByLabel('自取交接地点（必填）').fill('教学楼大厅');
  await page.getByLabel('联系方式', { exact: true }).fill('student_123');
  await page.locator('[name=consent]').check();
  await page.getByRole('button', { name: '提交审核' }).click();
  await expect(page.locator('#form-error')).toContainText('请上传');
  await expect(page.getByLabel('商品名称', { exact: true })).toHaveValue('未上传照片的测试');
  expect(await page.locator('#dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});


test('盒闲移动导航、实时搜索及轮播接入真实商品', async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  await expect(page.locator('.brand')).toContainText('盒闲');
  await expect(page.locator('.bottom-nav')).toContainText('首页');
  await page.getByLabel('搜索商品').click();
  await expect(page.locator('.app-header')).toHaveClass(/searching/);
  await page.getByLabel('搜索商品').fill('高数');
  await expect(page.locator('#search-suggestions a').first()).toContainText('高数');
  await page.locator('#search-suggestions a').first().click();
  await expect(page.locator('#dialog .description')).not.toBeEmpty();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.locator('.bottom-nav [data-nav=profile]').click();
  await expect(page.locator('#profile-panel h2')).toHaveText('你好，同学');
  await page.getByRole('link',{name:'我的收藏',exact:false}).click();
  await expect(page.locator('#feed')).toContainText('登录后');
  await page.locator('.bottom-nav [data-nav=lost]').click();await expect(page.locator('#placeholder-copy')).toContainText('尚未开放');
  await page.locator('.bottom-nav [data-nav=messages]').click();await expect(page.locator('#placeholder-copy')).toContainText('站内聊天尚未开放');
  await page.locator('.bottom-nav [data-nav=home]').click();
  for(const width of [320,375,390,430,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
  await page.clock.install();await page.locator('button[data-slide="0"]').click();await page.clock.runFor(5000);await expect(page.locator('button[data-slide="1"]')).toHaveAttribute('aria-current','true');
  expect(errors).toEqual([]);
});

test('真实上传区追加六张，移除后可继续添加', async ({page}) => {
  await page.goto('/');await page.getByRole('button',{name:'发布闲置'}).click();await page.getByRole('button',{name:'以小林同学体验 · 卖家'}).click();await page.getByRole('button',{name:'发布闲置'}).click();
  const buffer=await sharp({create:{width:20,height:20,channels:3,background:'#315b45'}}).png().toBuffer();
  const photo=i=>({name:'photo'+i+'.png',mimeType:'image/png',buffer});
  await page.locator('#photo-input').setInputFiles([photo(1),photo(2)]);await expect(page.locator('.photo-preview')).toHaveCount(2);
  await page.locator('#photo-input').setInputFiles([photo(3),photo(4),photo(5),photo(6)]);await expect(page.locator('.photo-preview')).toHaveCount(6);await expect(page.locator('.upload-button')).toHaveCount(0);
  await page.getByRole('button',{name:'移除照片'}).first().click();await expect(page.locator('.photo-preview')).toHaveCount(5);await expect(page.locator('.upload-button')).toBeVisible();
  await page.setViewportSize({width:320,height:844});expect(await page.locator('#dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();
});
