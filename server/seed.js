import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// 简单矢量演示图，不代表真实出售的物品；只在 --demo 时创建。
const art = [
  '<rect x="130" y="100" width="180" height="235" rx="8" fill="#457263" transform="rotate(-10 220 220)"/><rect x="190" y="120" width="170" height="225" rx="8" fill="#f6f0d8" transform="rotate(8 260 230)"/><path d="M215 180h115M215 195h80M215 265h100M215 280h100" stroke="#759187" stroke-width="8"/>',
  '<rect x="112" y="160" width="275" height="175" rx="28" fill="#e9e5d8"/><path d="M180 160l20-35h100l20 35" fill="#454d48"/><circle cx="250" cy="245" r="70" fill="#384d48"/><circle cx="250" cy="245" r="48" fill="#6c9690"/><circle cx="250" cy="245" r="25" fill="#263c3b"/><rect x="135" y="181" width="44" height="20" rx="4" fill="#6c9690"/>',
  '<ellipse cx="250" cy="345" rx="105" ry="20" fill="#b7b79c"/><path d="M250 340V210l60-75" fill="none" stroke="#dfac50" stroke-width="18"/><path d="M200 220q-20-110 65-110q70 0 80 65z" fill="#f4c367"/><ellipse cx="266" cy="198" rx="85" ry="20" fill="#fff2c7" transform="rotate(-17 266 198)"/>',
  '<path d="M120 270l45-130 70 30 40 65 105 35q30 30-5 52H133q-35-13-13-52" fill="#e7ebe8" stroke="#7b9c90" stroke-width="5"/><path d="M160 192l85 32m-95-6 110 30m-125 49h240" stroke="#7b9c90" stroke-width="9"/><path d="M280 265l55-17" stroke="#de9a6c" stroke-width="16"/>',
  '<path d="M135 270v-70a115 115 0 0 1 230 0v70" fill="none" stroke="#4d625d" stroke-width="34"/><rect x="107" y="220" width="70" height="120" rx="30" fill="#95aca0"/><rect x="323" y="220" width="70" height="120" rx="30" fill="#95aca0"/><path d="M138 235v88m220-88v88" stroke="#dbe2d6" stroke-width="7"/>',
  '<ellipse cx="235" cy="170" rx="80" ry="110" fill="#f4f2d9" stroke="#587b67" stroke-width="13" transform="rotate(22 235 170)"/><path d="M175 120l100 90m-115-50 100 90m-50-150 90 80M170 230l100-120m-70 150 100-120" stroke="#b7bd9a" stroke-width="3"/><path d="M198 265l-50 115" stroke="#587b67" stroke-width="17"/><circle cx="335" cy="325" r="28" fill="#ddd98d"/>'
];
export async function seedDemo(db, dir) {
  if (db.prepare("SELECT 1 FROM users WHERE openid='demo:seed'").get()) return;
  mkdirSync(dir, { recursive: true });
  const userId = randomUUID();
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(userId, 'demo:seed', '校园同学（示例）', Date.now());
  const items = [
    ['高数与线代教材，给下一位同学', '教材书籍', 1800, '#e7edde'],
    ['复古数码相机，记录校园日常', '数码电子', 28000, '#e5ede9'],
    ['暖光阅读台灯，陪你认真读书', '宿舍好物', 3500, '#f4ead7'],
    ['浅色休闲鞋 · 39 码', '服饰配件', 4500, '#e8eee9'],
    ['头戴式耳机，通勤自习好搭子', '数码电子', 8500, '#e8e5dc'],
    ['羽毛球拍，操场见！', '运动户外', 5500, '#edf0dc']
  ];
  for (let i = 0; i < items.length; i++) {
    const [title, category, cents, bg] = items[i]; const id = randomUUID(); const mediaId = randomUUID();
    await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="440"><rect width="500" height="440" fill="${bg}"/><ellipse cx="250" cy="375" rx="145" ry="15" fill="#000" opacity=".04"/>${art[i]}</svg>`)).webp().toFile(join(dir, `${mediaId}.webp`));
    db.prepare('INSERT INTO media VALUES(?,?,?,?)').run(mediaId, userId, `${mediaId}.webp`, Date.now());
    db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, userId, title, '这是本地演示商品，不是真实在售物品。\n这里会展示成色、使用情况、已知瑕疵和配件说明。发布自己的闲置时，请如实描述。', category, 1, cents, 'pickup', '图书馆门口（演示地点）', 'wechat', 'demo_not_real', 'active', '', Date.now() - i * 3600000, Date.now());
    db.prepare('INSERT INTO product_media VALUES(?,?,0)').run(id, mediaId);
  }
}
