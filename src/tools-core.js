// 纯逻辑层：字段校验、过滤、版本-日期联动等。不依赖 fs/KV/网络，
// 同时被 Node 端（本地服务、stdio MCP）与 Cloudflare Worker 端复用。
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 封面允许两种来源：外部图片链接，或本站对象存储路径（本地 data/covers / 云端 R2）
const COVER_RE = /^(https?:\/\/.+|\/covers\/[\w.-]+)$/;

export const emptyToUndef = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const toolInputSchema = z.object({
  name: z.string().trim().min(1, 'name 不能为空'),
  description: z.string().trim().min(1, 'description 不能为空'),
  githubUrl: z.preprocess(emptyToUndef, z.string().url('githubUrl 必须是合法 URL').optional()),
  link: z.preprocess(emptyToUndef, z.string().url('link 必须是合法 URL').optional()),
  cover: z.preprocess(
    emptyToUndef,
    z.string().regex(COVER_RE, 'cover 必须是 http(s) 链接或 /covers/ 路径').optional()
  ),
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

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeTags(tags) {
  if (!tags) return undefined;
  const deduped = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  return deduped.length ? deduped : undefined;
}

export function slugify(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'tool';
}

export function uniqueId(name, existingIds) {
  const base = slugify(name);
  if (!existingIds.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

// input 需已通过 toolInputSchema 校验
export function buildNewTool(data, existingIds) {
  const now = new Date().toISOString();
  return {
    id: uniqueId(data.name, existingIds),
    ...data,
    tags: normalizeTags(data.tags),
    createdAt: now,
    updatedAt: now,
  };
}

// patch 需已通过 toolPatchSchema 校验；返回 null 表示目标不存在
export function applyToolPatch(existing, patch) {
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    next[key] = key === 'tags' ? normalizeTags(value) : value;
  }
  // 版本号变化但调用方没给日期时，自动把版本更新日期刷成今天
  if (patch.version && patch.version !== existing.version && patch.versionUpdatedAt === undefined) {
    next.versionUpdatedAt = today();
  }
  next.updatedAt = new Date().toISOString();
  return next;
}

export function filterTools(tools, { query, tag } = {}) {
  let all = [...tools];
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

export function computeTags(tools) {
  const counts = new Map();
  for (const t of tools) {
    for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
}

export function summarizeTools(tools) {
  return {
    count: tools.length,
    tags: computeTags(tools),
    latestUpdate: tools.map((t) => t.updatedAt).sort().at(-1) ?? null,
  };
}
