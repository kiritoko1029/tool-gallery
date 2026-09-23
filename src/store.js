import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.GALLERY_DATA_DIR
  ? path.resolve(process.env.GALLERY_DATA_DIR)
  : path.join(PROJECT_ROOT, 'data');
export const DATA_FILE = path.join(DATA_DIR, 'tools.json');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const toolInputSchema = z.object({
  name: z.string().trim().min(1, 'name 不能为空'),
  description: z.string().trim().min(1, 'description 不能为空'),
  githubUrl: z.preprocess(emptyToUndef, z.string().url('githubUrl 必须是合法 URL').optional()),
  link: z.preprocess(emptyToUndef, z.string().url('link 必须是合法 URL').optional()),
  icon: z.preprocess(emptyToUndef, z.string().trim().max(8).optional()),
  tags: z.array(z.string().trim().min(1)).max(12).optional(),
  vibeCodingTool: z.preprocess(emptyToUndef, z.string().trim().max(60).optional()),
  model: z.preprocess(emptyToUndef, z.string().trim().max(60).optional()),
  version: z.preprocess(emptyToUndef, z.string().trim().max(40).optional()),
  versionUpdatedAt: z.preprocess(
    emptyToUndef,
    z.string().regex(DATE_RE, 'versionUpdatedAt 必须是 YYYY-MM-DD 格式').optional()
  ),
});

export const toolPatchSchema = toolInputSchema.partial();

let cache = null; // { mtimeMs, tools: Map<id, tool> }
let writeQueue = Promise.resolve();

function today() {
  return new Date().toISOString().slice(0, 10);
}

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
  // 队列串行化写操作；每次取当前磁快照的副本，避免失败时污染缓存
  const run = writeQueue.then(() => fn(new Map(load().tools)));
  writeQueue = run.catch(() => {});
  return run;
}

function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'tool';
}

function uniqueId(name, tools) {
  const base = slugify(name);
  if (!tools.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!tools.has(candidate)) return candidate;
  }
}

function normalizeTags(tags) {
  if (!tags) return undefined;
  const deduped = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  return deduped.length ? deduped : undefined;
}

export function listTools({ query, tag } = {}) {
  const { tools } = load();
  let all = [...tools.values()];
  if (tag) all = all.filter((t) => (t.tags ?? []).includes(tag));
  if (query) {
    const q = query.toLowerCase();
    all = all.filter((t) =>
      [t.name, t.description, t.vibeCodingTool, t.model, ...(t.tags ?? [])]
        .filter(Boolean)
        .some((s) => s.toLowerCase().includes(q))
    );
  }
  return all.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export function getTool(id) {
  return load().tools.get(id) ?? null;
}

export function listTags() {
  const counts = new Map();
  for (const t of load().tools.values()) {
    for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

export function createTool(input) {
  const data = toolInputSchema.parse(input);
  return withLock((tools) => {
    const now = new Date().toISOString();
    const tool = {
      id: uniqueId(data.name, tools),
      ...data,
      tags: normalizeTags(data.tags),
      createdAt: now,
      updatedAt: now,
    };
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
    const next = { ...existing };
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      next[key] = key === 'tags' ? normalizeTags(value) : value;
    }
    // 版本号变化但调用方没给日期时，自动把版本更新日期刷成今天
    if (data.version && data.version !== existing.version && data.versionUpdatedAt === undefined) {
      next.versionUpdatedAt = today();
    }
    next.updatedAt = new Date().toISOString();
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

export function summarize() {
  const tools = [...load().tools.values()];
  return {
    count: tools.length,
    tags: listTags(),
    latestUpdate: tools.map((t) => t.updatedAt).sort().at(-1) ?? null,
  };
}
