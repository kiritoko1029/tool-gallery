# Agent Note: 以 Cloudflare Workers 全量部署（前台 + 后台 + API + MCP）

Status: implemented

## Problem

静态快照发布（见[被取代的 Pages 方案](../../implemented/process/2026-09-23-cloudflare-pages-publish.md)）让线上站只有前台：管理后台和 MCP 只能在本地用。用户明确要求线上也要有后台，并通过 Cloudflare 环境变量配置管理员密码，同时指出 Workers 可以承载服务端逻辑。

## Decision

部署形态改为单个 Cloudflare Worker（`worker/index.js`）承载全部功能：`public/` 静态资源由 Workers Static Assets 直接服务；`/api/*` 与本地 Express 行为一致的 REST API；`/mcp` 为无状态 Streamable HTTP MCP 端点；`/admin` 后台照常可用，令牌校验改为读 Workers secret `GALLERY_ADMIN_TOKEN`。存储用 KV（命名空间 `GALLERY_KV`，单 key `tools`，值结构与 `data/tools.json` 相同），由 `worker/kv-store.js` 实现与本地 `fileStore` 相同的存储接口。业务规则抽到 `src/tools-core.js`（zod 校验、版本-日期联动），MCP 工具定义与 JSON-RPC 分发抽到 `src/mcp-tools.js`——本地 stdio MCP（`src/mcp-server.js`，改用 SDK 低层 Server API）与云端 HTTP 端点共享同一份工具 schema 与处理逻辑。远程 MCP 读工具（list/get/summary）公开，写工具（add/update/remove）需 `Authorization: Bearer <token>`。`npm run deploy` 现在执行 `wrangler deploy`；`npm run kv:push` / `kv:pull` 在本地文件与云端 KV 间做覆盖式同步。旧 Pages 项目已删除，`scripts/build-static.js` 一并移除。README 顶部保留 Deploy to Cloudflare 按钮：官方按钮流程会解析 wrangler.toml 并为点击者自动创建、绑定新的 KV 命名空间（2025-04 起支持，fork 者的仓库会被改写为新资源 id）；此前一度因误判"按钮无法处理账号专属 KV id"而移除，核实官方文档后恢复。本决策取代[静态快照发布](../../implemented/process/2026-09-23-cloudflare-pages-publish.md)。

## Alternatives considered

- **维持 Pages 静态快照**：无法满足"线上也要有后台和 MCP"，故被本方案取代。
- **Pages Functions + KV**：与 Workers 等价但多一层 Pages 抽象；Workers + Static Assets 一个项目即可表达，故直接选 Workers。
- **D1（SQLite）替代 KV**：KV 的单 key JSON 与现有数据模型完全同构、`kv:push/pull` 同步实现为零成本；D1 的 SQL schema、迁移与一致性优势在几十条记录的规模用不到，故否决。
- **远程 MCP 用 `@cloudflare/agents` 的 McpAgent（Durable Objects）**：引入 DO 有状态会话；画廊工具全部无状态，手写的无状态 JSON-RPC 分发（约百行）足够且少一个依赖，故否决。若未来需要 SSE 长连接会话再重开。
- **Workers 上跑 Express（nodejs_compat）**：可行但引入兼容层行为差异；`worker/index.js` 用原生 fetch handler 重写路由仅百行左右，更可预期。

## Consequences

代价：本地与云端成为两个独立数据实例，需要显式 `kv:push`/`kv:pull` 同步，存在分叉风险（skill 已记录该规则）；KV 是最终一致性，写入后其他边缘节点最长约一分钟内可能读到旧值。换来：线上站具备完整能力（访客看前台、主人用后台、AI 走 MCP）；管理密码不落盘在任何仓库文件中（Workers secret）；本地与云端共用同一套校验与工具逻辑，行为不易分叉。
