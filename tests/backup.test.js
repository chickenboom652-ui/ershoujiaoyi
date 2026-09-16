import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { openStore } from '../server/store.js';

test('活动 WAL 数据库备份后可独立恢复，包含图片且不会重置原库', () => {
  const dir = mkdtempSync(join(tmpdir(), 'campus-market-backup-'));
  const uploads = join(dir, 'uploads'); const backup = join(dir, 'snapshot');
  let db, restored;
  try {
    mkdirSync(uploads); writeFileSync(join(uploads, 'example.webp'), 'image-test');
    db = openStore(join(dir, 'market.sqlite'));
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('u1', 'real:test', '测试同学', Date.now());
    const result = spawnSync(process.execPath, ['scripts/backup.js', backup], { env: { ...process.env, DATA_DIR: dir, UPLOAD_DIR: uploads }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    restored = openStore(join(backup, 'market.sqlite'));
    assert.equal(restored.prepare('SELECT name FROM users WHERE id=?').get('u1').name, '测试同学');
    assert.equal(readFileSync(join(backup, 'uploads', 'example.webp'), 'utf8'), 'image-test');
    assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n, 1);
    db.close(); db = openStore(join(dir, 'market.sqlite'));
    assert.equal(db.prepare('SELECT name FROM users WHERE id=?').get('u1').name, '测试同学');
  } finally { if (db) db.close(); if (restored) restored.close(); assert.ok(resolve(dir).startsWith(join(tmpdir(), 'campus-market-backup-'))); rmSync(dir, { recursive: true, force: true }); }
});
