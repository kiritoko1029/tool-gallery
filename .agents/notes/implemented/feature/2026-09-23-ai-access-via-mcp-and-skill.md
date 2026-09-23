# Agent Note: 通过 MCP server 与 skill 双通道向 AI 开放画廊维护能力

Status: implemented

## Problem

用户要求画廊能被 AI 代理操作（登记新工具、更新版本、下架等）。AI 可以直接 `curl` REST API 或编辑 JSON 文件，但没有引导时容易违反项目约定（如版本-日期联动、删除前确认、查重），也不知道字段语义。

## Decision

提供两层 AI 通道。**MCP server**（`src/mcp-server.js`，stdio 传输，六个工具：`gallery_list_tools` / `gallery_get_tool` / `gallery_add_tool` / `gallery_update_tool` / `gallery_remove_tool` / `gallery_summary`）直接复用 `src/store.js`，工具描述内嵌关键约定；注册位置为 Kimi Code 用户级 `~/.kimi-code/mcp.json`、项目级 `.kimi-code/mcp.json` 与根 `.mcp.json`（Claude Code 等客户端约定）。**Skill**（`skill/SKILL.md`，`npm run skill:install` 安装到 `~/.agents/skills/tool-gallery/`）定义操作优先级（MCP → REST API → 直接编辑数据文件）与维护规则（先查重、版本-日期联动、删除需确认、不编造工具/模型字段）。MCP 与 Web 服务对同一数据文件的操作通过 mtime 重载互通，见[存储架构笔记](../../implemented/architecture/2026-09-23-json-store-shared-by-web-and-mcp.md)。

## Alternatives considered

- **只暴露 REST API**：要求 Web 服务常驻，且 API 本身不携带操作约定；AI 容易绕过查重与确认流程，故否决。
- **只提供 skill 文档让 AI 直接改 JSON**：绕过 zod 校验与原子写，手误会直接损坏数据文件，故否决。
- **MCP 使用 HTTP/SSE 传输**：stdio 是本地 agent 的标准方式，无需常驻进程与端口管理；HTTP 传输留待有远程需求时再引入。
- **把规则只写进 MCP 工具描述**：未加载 MCP 的会话（如仅有文件访问权限的代理）看不到规则，skill 作为能力发现入口必须独立存在，故两者并存。

## Consequences

AI 代理在加载 MCP 或 skill 任一通道后即可安全维护画廊，且规则冗余地存在于三处（store 强制、MCP 描述、skill 文档），单一通道失效不破坏约定。代价是新增 server 需维护三处注册文件同步；根 `.mcp.json` 与 `.kimi-code/mcp.json` 内容相同但路径约定不同属有意为之。删除操作无任何回收站机制，依赖"删除前确认"这一行为约定兜底。
