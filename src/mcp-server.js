// 本地 stdio MCP server。工具定义与处理逻辑在 src/mcp-tools.js（与 Worker HTTP 端点共享），
// 这里只做协议适配。本地文件存储拥有全部权限，写工具不再额外鉴权。
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileStore } from './store.js';
import { MCP_SERVER_INFO, listToolSchemas, callTool } from './mcp-tools.js';

const server = new Server(MCP_SERVER_INFO, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listToolSchemas() }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return callTool(fileStore, name, args ?? {});
});

await server.connect(new StdioServerTransport());
console.error('tool-gallery MCP server 已通过 stdio 启动');
