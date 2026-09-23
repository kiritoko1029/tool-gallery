// MCP 工具定义与分发：stdio server（src/mcp-server.js）与
// Worker HTTP 端点（worker/index.js 的 /mcp）共享同一份工具 schema 和处理逻辑。
// 参数的最终校验由 tools-core.js 的 zod schema 完成，这里的 inputSchema 仅作协议声明。

export const MCP_SERVER_INFO = { name: 'tool-gallery', version: '1.2.0' };

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

const toolProperties = {
  name: { type: 'string', minLength: 1, description: '程序名' },
  description: { type: 'string', minLength: 1, description: '一句话简介' },
  githubUrl: { type: 'string', format: 'uri', description: 'GitHub 仓库地址；没有就省略' },
  link: { type: 'string', format: 'uri', description: '在线体验 / 主页地址；没有就省略' },
  icon: { type: 'string', maxLength: 8, description: '一个 emoji 作为卡片图标，如 🛠️' },
  tags: {
    type: 'array',
    items: { type: 'string' },
    maxItems: 12,
    description: '标签列表，如 ["cli", "效率"]',
  },
  vibeCodingTool: {
    type: 'string',
    description: '开发用的 vibecoding 工具，如 Kimi Code、Claude Code、Cursor、Codex',
  },
  model: { type: 'string', description: '开发所用模型，如 kimi-k2、claude-sonnet-4、gpt-5' },
  version: { type: 'string', description: '最新版本号，如 1.2.0' },
  versionUpdatedAt: {
    type: 'string',
    pattern: DATE_PATTERN,
    description: '该版本的更新日期，YYYY-MM-DD',
  },
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

export const TOOLS = [
  {
    name: 'gallery_list_tools',
    description: '列出画廊里登记的全部工具程序，可按关键词或标签过滤。',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '关键词，匹配名称/简介/标签/工具/模型' },
        tag: { type: 'string', description: '按标签精确过滤' },
      },
    },
    handler: (store, args) => store.list({ query: args.query, tag: args.tag }).then((tools) => ({ tools })),
  },
  {
    name: 'gallery_get_tool',
    description: '按 id 查看一个工具程序的完整信息。',
    requiresAuth: false,
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '工具 id，可先通过 gallery_list_tools 获取' } },
      required: ['id'],
    },
    handler: async (store, args) => {
      const tool = await store.get(args.id);
      if (!tool) throw new Error(`找不到工具：${args.id}`);
      return tool;
    },
  },
  {
    name: 'gallery_summary',
    description: '查看画廊的工具数量、全部标签和最近更新时间。',
    requiresAuth: false,
    inputSchema: { type: 'object', properties: {} },
    handler: (store) => store.summary(),
  },
  {
    name: 'gallery_add_tool',
    description:
      '把一个新的工具程序加入画廊。name 和 description 必填；githubUrl 没有可省略。' +
      'version 与 versionUpdatedAt（YYYY-MM-DD）建议一起提供。',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: toolProperties,
      required: ['name', 'description'],
    },
    handler: (store, args) => store.create(args),
  },
  {
    name: 'gallery_update_tool',
    description:
      '部分更新一个工具程序的信息。只传要改的字段即可；不传的字段保持不变。' +
      '更新 version 时若不提供 versionUpdatedAt，会自动设为当天日期。' +
      '需要把某个可选字段清空时用 clearFields。',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '工具 id' },
        ...toolProperties,
        clearFields: {
          type: 'array',
          items: { enum: CLEARABLE_FIELDS },
          description: '要清空的可选字段名列表，如 ["githubUrl"]',
        },
      },
      required: ['id'],
    },
    handler: async (store, args) => {
      const { id, clearFields, ...patch } = args;
      const updated = await store.update(id, patch);
      if (!updated) throw new Error(`找不到工具：${id}`);
      let current = updated;
      for (const field of clearFields ?? []) {
        current = await store.clearField(id, field);
      }
      return current;
    },
  },
  {
    name: 'gallery_remove_tool',
    description: '把一个工具程序从画廊中删除。此操作不可恢复，执行前请确认用户意图。',
    requiresAuth: true,
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: '工具 id' } },
      required: ['id'],
    },
    handler: async (store, args) => {
      if (!(await store.remove(args.id))) throw new Error(`找不到工具：${args.id}`);
      return { ok: true, id: args.id };
    },
  },
];

const toolIndex = new Map(TOOLS.map((t) => [t.name, t]));

export function listToolSchemas() {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
}

export function toolRequiresAuth(name) {
  return toolIndex.get(name)?.requiresAuth ?? false;
}

// 返回 MCP content 数组形态的结果
export async function callTool(store, name, args = {}) {
  const tool = toolIndex.get(name);
  if (!tool) throw new Error(`未知工具：${name}`);
  try {
    const result = await tool.handler(store, args);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
    };
  }
}

// ---- 无状态 JSON-RPC 分发（Worker 的 HTTP /mcp 端点使用）----
// store 为实现 {list,get,create,update,clearField,remove,summary} 的存储接口；
// authorized 表示请求已通过管理员令牌校验。返回值：{status, body}；通知类消息返回 null。
export async function handleMcpMessage(store, message, { authorized }) {
  const { id, method, params } = message;

  // 通知（无 id）不需要响应体
  if (id === undefined || id === null) {
    return null;
  }

  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, messageText) => ({ jsonrpc: '2.0', id, error: { code, message: messageText } });

  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: params?.protocolVersion ?? '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: MCP_SERVER_INFO,
        instructions:
          'tool-gallery 是用户的个人工具画廊。用这些工具来展示、登记、更新或下架用户开发的工具程序。' +
          '新增工具时至少需要 name 和 description；githubUrl 可省略。' +
          '更新 version 时如果不提供 versionUpdatedAt，系统会自动把版本更新日期设为今天。',
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: listToolSchemas() });
    case 'tools/call': {
      const { name, arguments: args } = params ?? {};
      if (toolRequiresAuth(name) && !authorized) {
        return fail(-32001, `工具 ${name} 需要管理员令牌（Authorization: Bearer <token>）`);
      }
      const result = await callTool(store, name, args ?? {});
      return ok(result);
    }
    default:
      return fail(-32601, `不支持的方法：${method}`);
  }
}
