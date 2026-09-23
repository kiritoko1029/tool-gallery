// 文件存储后端：data/tools.json，原子写 + mtime 感知缓存 + 进程内写队列。
// 业务规则（校验、版本-日期联动等）在 tools-core.js，与 Worker 的 KV 后端共享。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toolInputSchema,
  toolPatchSchema,
  buildNewTool,
  applyToolPatch,
  filterTools,
  computeTags,
  summarizeTools,
} from './tools-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.GALLERY_DATA_DIR
  ? path.resolve(process.env.GALLERY_DATA_DIR)
  : path.join(PROJECT_ROOT, 'data');
export const DATA_FILE = path.join(DATA_DIR, 'tools.json');

let cache = null; // { mtimeMs, tools: Map<id, tool> }
let writeQueue = Promise.resolve();

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { mtimeMs: 0, tools: new Map() };
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = raw.trim() ? JSON.parse(raw) : { tools: [] };
  const tools = new Map();
  for (const t of parsed.tools ?? []) tools.set(t.id, t);
  return { mtimeMs: fs.statSync(DATA_FILE).mtimeMs, tools };
}

function load() {
  const mtimeMs = fs.existsSync(DATA_FILE) ? fs.statSync(DATA_FILE).mtimeMs : 0;
  if (!cache || cache.mtimeMs !== mtimeMs) cache = loadFromDisk();
  return cache;
}

function persist(tools) {
  ensureDataDir();
  const payload = JSON.stringify({ version: 1, tools: [...tools.values()] }, null, 2) + '\n';
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  fs.renameSync(tmp, DATA_FILE);
  cache = { mtimeMs: fs.statSync(DATA_FILE).mtimeMs, tools: new Map(tools) };
}

function withLock(fn) {
  // 队列串行化写操作；每次取当前磁盘快照的副本，避免失败时污染缓存
  const run = writeQueue.then(() => fn(new Map(load().tools)));
  writeQueue = run.catch(() => {});
  return run;
}

// ---- 同步 API（本地 Express 服务使用）----

export function listTools({ query, tag } = {}) {
  return filterTools([...load().tools.values()], { query, tag });
}

export function getTool(id) {
  return load().tools.get(id) ?? null;
}

export function listTags() {
  return computeTags([...load().tools.values()]);
}

export function summarize() {
  return summarizeTools([...load().tools.values()]);
}

export function createTool(input) {
  const data = toolInputSchema.parse(input);
  return withLock((tools) => {
    const tool = buildNewTool(data, new Set(tools.keys()));
    tools.set(tool.id, tool);
    persist(tools);
    return tool;
  });
}

export function updateTool(id, patch) {
  const data = toolPatchSchema.parse(patch);
  return withLock((tools) => {
    const existing = tools.get(id);
    if (!existing) return null;
    const next = applyToolPatch(existing, data);
    tools.set(id, next);
    persist(tools);
    return next;
  });
}

export function deleteTool(id) {
  return withLock((tools) => {
    const existed = tools.delete(id);
    if (existed) persist(tools);
    return existed;
  });
}

export function clearField(id, field) {
  return withLock((tools) => {
    const existing = tools.get(id);
    if (!existing) return null;
    const next = { ...existing };
    delete next[field];
    next.updatedAt = new Date().toISOString();
    tools.set(id, next);
    persist(tools);
    return next;
  });
}

// ---- 异步存储接口（MCP 工具层使用；与 worker/kv-store.js 同构）----

export const fileStore = {
  async list(options) {
    return listTools(options);
  },
  async get(id) {
    return getTool(id);
  },
  async create(input) {
    return createTool(input);
  },
  async update(id, patch) {
    return updateTool(id, patch);
  },
  async clearField(id, field) {
    return clearField(id, field);
  },
  async remove(id) {
    return deleteTool(id);
  },
  async summary() {
    return summarize();
  },
};
