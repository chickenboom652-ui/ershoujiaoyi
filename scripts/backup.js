import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, copyFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const dataDir = resolve(process.env.DATA_DIR || 'data/production');
const uploadDir = resolve(process.env.UPLOAD_DIR || join(dataDir, 'uploads'));
const destination = resolve(process.argv[2] || join(dataDir, 'backups', new Date().toISOString().replace(/[:.]/g, '-')));
if (destination === uploadDir || destination.startsWith(uploadDir + '/') || destination.startsWith(uploadDir + '\\')) throw new Error('备份目录不能位于上传目录内');
if (!existsSync(join(dataDir, 'market.sqlite'))) throw new Error('数据库不存在，请检查 DATA_DIR');
mkdirSync(destination, { recursive: true });
const db = new DatabaseSync(join(dataDir, 'market.sqlite'));
try {
  // VACUUM INTO 生成包含已提交 WAL 数据的一致性快照，不直接复制活动数据库。
  db.exec(`VACUUM INTO '${join(destination, 'market.sqlite').replaceAll("'", "''")}'`);
  const targetUploads = join(destination, 'uploads');
  mkdirSync(targetUploads, { recursive: true });
  // 上传目录仅含平铺的媒体文件；逐文件复制也避免 Windows 目录 ACL 继承问题。
  for (const entry of readdirSync(uploadDir, { withFileTypes: true })) {
    if (!entry.isFile()) throw new Error('上传目录包含非普通文件，请人工检查备份范围');
    copyFileSync(join(uploadDir, entry.name), join(targetUploads, entry.name));
  }
  console.log(`备份完成：${destination}。请复制到独立存储，并定期验证恢复。`);
} finally { db.close(); }
