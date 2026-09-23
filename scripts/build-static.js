// 把画廊前台构建成纯静态站点（dist/），用于发布到 Cloudflare Pages 等静态托管。
// 做法：复制 public/ → dist/，把数据烘焙成 dist/tools.json，
// 并把前端的数据请求从 /api/tools 改写到 /tools.json。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTools } from '../src/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true });

// 静态站点没有管理后台：去掉后台页面，避免暴露后台入口
fs.rmSync(path.join(out, 'admin.html'), { force: true });
fs.rmSync(path.join(out, 'assets', 'admin.js'), { force: true });

const tools = listTools();
fs.writeFileSync(path.join(out, 'tools.json'), JSON.stringify({ tools }, null, 2) + '\n');

const appJsPath = path.join(out, 'assets', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
if (!appJs.includes("fetch('/api/tools')")) {
  throw new Error('app.js 中的数据请求路径已变化，请同步更新 build-static.js 的改写规则');
}
fs.writeFileSync(appJsPath, appJs.replace("fetch('/api/tools')", "fetch('/tools.json')"));

console.log(`构建完成: dist/ （${tools.length} 个工具已烘焙进 tools.json）`);
