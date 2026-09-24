// 后台设置存储（本地）：data/settings.json。密钥只写不读（读取走脱敏视图）。
// 注意：该文件含密钥，已被 .gitignore 排除。
// patch/视图逻辑在 cover-core.js（applySettingsPatch / settingsViewOf），与 Worker 端共享。
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';
import { aiSettingsSchema, applySettingsPatch, settingsViewOf } from './cover-core.js';

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SETTINGS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, SETTINGS_FILE);
}

export function updateSettings(patch) {
  const data = aiSettingsSchema.parse(patch);
  const next = applySettingsPatch(readSettings(), data);
  writeSettings(next);
  return next;
}

export function settingsView() {
  return settingsViewOf(readSettings());
}
