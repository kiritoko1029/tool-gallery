// Cloudflare KV 存储后端：整个画廊数据存为单个 key（'tools'），
// 值结构与 data/tools.json 相同（{version, tools: [...]}），因此可用
// npm run kv:push / kv:pull 与本地文件互相同步。
// 业务规则与本地文件后端共享 tools-core.js。
import {
  toolInputSchema,
  toolPatchSchema,
  buildNewTool,
  applyToolPatch,
  filterTools,
  computeTags,
  summarizeTools,
} from '../src/tools-core.js';

const KV_KEY = 'tools';

export function createKVStore(env) {
  async function readAll() {
    const data = await env.GALLERY_KV.get(KV_KEY, 'json');
    return new Map((data?.tools ?? []).map((t) => [t.id, t]));
  }

  async function writeAll(tools) {
    await env.GALLERY_KV.put(KV_KEY, JSON.stringify({ version: 1, tools: [...tools.values()] }));
  }

  return {
    async list({ query, tag } = {}) {
      return filterTools([...(await readAll()).values()], { query, tag });
    },

    async get(id) {
      return (await readAll()).get(id) ?? null;
    },

    async create(input) {
      const data = toolInputSchema.parse(input);
      const tools = await readAll();
      const tool = buildNewTool(data, new Set(tools.keys()));
      tools.set(tool.id, tool);
      await writeAll(tools);
      return tool;
    },

    async update(id, patch) {
      const data = toolPatchSchema.parse(patch);
      const tools = await readAll();
      const existing = tools.get(id);
      if (!existing) return null;
      const next = applyToolPatch(existing, data);
      tools.set(id, next);
      await writeAll(tools);
      return next;
    },

    async clearField(id, field) {
      const tools = await readAll();
      const existing = tools.get(id);
      if (!existing) return null;
      const next = { ...existing };
      delete next[field];
      next.updatedAt = new Date().toISOString();
      tools.set(id, next);
      await writeAll(tools);
      return next;
    },

    async remove(id) {
      const tools = await readAll();
      const existed = tools.delete(id);
      if (existed) await writeAll(tools);
      return existed;
    },

    async summary() {
      const tools = [...(await readAll()).values()];
      return summarizeTools(tools);
    },

    async tags() {
      return computeTags([...(await readAll()).values()]);
    },
  };
}
