import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr);
    } else if (file.endsWith('.json')) JSON.parse(readFileSync(file, 'utf8'));
  }
}
for (const dir of ['server', 'web', 'miniprogram', 'scripts', 'tests']) walk(dir);
if (existsSync('miniprogram/app.json')) {
  const config = JSON.parse(readFileSync('miniprogram/app.json', 'utf8'));
  for (const page of config.pages) for (const ext of ['.js', '.json', '.wxml', '.wxss']) if (!existsSync(`miniprogram/${page}${ext}`)) throw new Error(`缺少小程序页面文件 ${page}${ext}`);
}
console.log('JavaScript 语法、JSON 配置和小程序页面完整性检查通过');
