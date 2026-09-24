// 把本地 data/covers/ 里的封面图全部上传到 R2（已存在的同名对象会跳过）。
// 用法：npm run covers:push
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coversDir = path.join(path.resolve(__dirname, '..'), 'data', 'covers');

if (!fs.existsSync(coversDir)) {
  console.log('data/covers/ 不存在，没有需要上传的封面');
  process.exit(0);
}

const files = fs.readdirSync(coversDir).filter((f) => /^[\w.-]+$/.test(f));
if (!files.length) {
  console.log('data/covers/ 为空，没有需要上传的封面');
  process.exit(0);
}

for (const file of files) {
  console.log(`上传 ${file} …`);
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `tool-gallery-covers/${file}`, '--file', path.join(coversDir, file), '--remote'],
    { stdio: 'inherit' }
  );
}
console.log(`完成，共上传 ${files.length} 个封面。`);
