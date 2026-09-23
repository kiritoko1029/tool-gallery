import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, 'skill', 'SKILL.md');
const targetDir = path.join(os.homedir(), '.agents', 'skills', 'tool-gallery');
const target = path.join(targetDir, 'SKILL.md');

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);

console.log(`已安装 skill: ${target}`);
console.log('AI 代理下次扫描技能目录时会自动发现 tool-gallery。');
