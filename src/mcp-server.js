import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listTools, getTool, createTool, updateTool, deleteTool, clearField, summarize } from './store.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toolFields = {
  name: z.string().min(1).describe('程序名'),
  description: z.string().min(1).describe('一句话简介'),
  githubUrl: z.string().url().optional().describe('GitHub 仓库地址；没有就省略'),
  link: z.string().url().optional().describe('在线体验 / 主页地址；没有就省略'),
  icon: z.string().max(8).optional().describe('一个 emoji 作为卡片图标，如 🛠️'),
  tags: z.array(z.string()).max(12).optional().describe('标签列表，如 ["cli", "效率"]'),
  vibeCodingTool: z
    .string()
    .optional()
    .describe('开发用的 vibecoding 工具，如 Kimi Code、Claude Code、Cursor、Codex'),
  model: z.string().optional().describe('开发所用模型，如 kimi-k2、claude-sonnet-4、gpt-5'),
  version: z.string().optional().describe('最新版本号，如 1.2.0'),
  versionUpdatedAt: z.string().regex(DATE_RE).optional().describe('该版本的更新日期，YYYY-MM-DD'),
};

const CLEARABLE_FIELDS = [
  'githubUrl',
  'link',
  'icon',
  'tags',
  'vibeCodingTool',
  'model',
  'version',
  'versionUpdatedAt',
];

const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (err) => ({
  isError: true,
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
});

const server = new McpServer(
  { name: 'tool-gallery', version: '1.0.0' },
  {
    instructions:
      'tool-gallery 是用户的个人工具画廊。用这些工具来展示、登记、更新或下架用户开发的工具程序。' +
      '新增工具时至少需要 name 和 description；githubUrl 可省略。' +
      '更新 version 时如果不提供 versionUpdatedAt，系统会自动把版本更新日期设为今天。',
  }
);

server.registerTool(
  'gallery_list_tools',
  {
    title: '列出画廊中的工具',
    description: '列出画廊里登记的全部工具程序，可按关键词或标签过滤。',
    inputSchema: {
      query: z.string().optional().describe('关键词，匹配名称/简介/标签/工具/模型'),
      tag: z.string().optional().describe('按标签精确过滤'),
    },
  },
  async ({ query, tag }) => {
    try {
      return text({ tools: listTools({ query, tag }) });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'gallery_get_tool',
  {
    title: '查看单个工具',
    description: '按 id 查看一个工具程序的完整信息。',
    inputSchema: { id: z.string().describe('工具 id，可先通过 gallery_list_tools 获取') },
  },
  async ({ id }) => {
    try {
      const tool = getTool(id);
      if (!tool) return fail(new Error(`找不到工具：${id}`));
      return text(tool);
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'gallery_add_tool',
  {
    title: '登记新工具',
    description:
      '把一个新的工具程序加入画廊。name 和 description 必填；githubUrl 没有可省略。' +
      'version 与 versionUpdatedAt（YYYY-MM-DD）建议一起提供。',
    inputSchema: { ...toolFields },
  },
  async (input) => {
    try {
      return text(createTool(input));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'gallery_update_tool',
  {
    title: '更新工具信息',
    description:
      '部分更新一个工具程序的信息。只传要改的字段即可；不传的字段保持不变。' +
      '更新 version 时若不提供 versionUpdatedAt，会自动设为当天日期。' +
      '需要把某个可选字段清空时用 clearFields。',
    inputSchema: {
      id: z.string().describe('工具 id'),
      ...Object.fromEntries(Object.entries(toolFields).map(([k, v]) => [k, v.optional()])),
      clearFields: z
        .array(z.enum(CLEARABLE_FIELDS))
        .optional()
        .describe('要清空的可选字段名列表，如 ["githubUrl"]'),
    },
  },
  async ({ id, clearFields, ...patch }) => {
    try {
      const updated = updateTool(id, patch);
      if (!updated) return fail(new Error(`找不到工具：${id}`));
      let current = updated;
      for (const field of clearFields ?? []) {
        current = clearField(id, field);
      }
      return text(current);
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'gallery_remove_tool',
  {
    title: '下架工具',
    description: '把一个工具程序从画廊中删除。此操作不可恢复，执行前请确认用户意图。',
    inputSchema: { id: z.string().describe('工具 id') },
  },
  async ({ id }) => {
    try {
      if (!deleteTool(id)) return fail(new Error(`找不到工具：${id}`));
      return text({ ok: true, id });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  'gallery_summary',
  {
    title: '画廊概览',
    description: '查看画廊的工具数量、全部标签和最近更新时间。',
    inputSchema: {},
  },
  async () => {
    try {
      return text(summarize());
    } catch (err) {
      return fail(err);
    }
  }
);

await server.connect(new StdioServerTransport());
console.error('tool-gallery MCP server 已通过 stdio 启动');
