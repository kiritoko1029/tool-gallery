---
name: tool-gallery
description: 维护用户的个人工具集（Toolset，项目位于 ~/apps/tool-gallary）——一个以卡片展示用户开发的工具程序的网站。当用户要求登记/收录新做的工具、更新某个工具的信息、版本或封面、下架工具、查询工具集里有什么、或同步 GitHub 仓库信息时使用。优先使用 tool-gallery MCP server 提供的工具操作。
---

# Tool Gallery（工具集）

用户的个人工具集：以卡片形式展示他自己开发的工具程序。本项目位于 `~/apps/tool-gallary`。

两个运行实例：

- **本地实例**：数据在 `~/apps/tool-gallary/data/tools.json`，封面图在 `~/apps/tool-gallary/data/covers/`，Web 服务默认端口 `3927`（前台 `/`，后台 `/admin`）。
- **云端实例**（Cloudflare Workers）：`https://tool-gallery.1794130477.workers.dev`，后台在 `/admin`，MCP 端点在 `/mcp`，数据存 Cloudflare KV，封面图存 R2。

用户说"工具集/画廊"时如果上下文是关于线上网站、访问者能看到的内容，操作云端实例；关于本地开发/调试时操作本地实例。不确定时先问。

## 操作方式（按优先级）

1. **MCP server**（首选，若已连接）：本地 stdio `tool-gallery` 或云端 HTTP `tool-gallery-cloud`，均提供 `gallery_list_tools`、`gallery_get_tool`、`gallery_add_tool`、`gallery_update_tool`、`gallery_remove_tool`、`gallery_summary`。本地 MCP 直接读写数据文件，不要求 Web 服务在线；云端 MCP 的读工具公开、写工具需要令牌（配置里已带）。
2. **REST API**（本地要求 Web 服务已启动；云端随时可用）：`GET /api/tools`、`POST /api/tools`、`PUT /api/tools/:id`、`DELETE /api/tools/:id`；写操作需请求头 `Authorization: Bearer <token>`，令牌在 `~/apps/tool-gallary/data/.admin-token`（本地与云端相同；读取后使用，不要泄露）。
3. **直接编辑 `data/tools.json`**（仅本地实例、以上方式不可用时）：保持 JSON 结构 `{ "version": 1, "tools": [...] }`，保存后 Web 服务会自动感知文件变更，无需重启。

## 数据字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 程序名 |
| `description` | 是 | 一句话简介 |
| `cover` | 否 | 封面图：外部图片链接（https://…）或站内对象存储路径（/covers/…，16:9） |
| `githubUrl` | 否 | GitHub 仓库地址；没有就省略 |
| `link` | 否 | 在线体验/主页地址 |
| `icon` | 否 | 一个 emoji，作为卡片图标 |
| `tags` | 否 | 字符串数组 |
| `vibeCodingTool` | 否 | 开发用的 AI 编程工具，如 Kimi Code、Claude Code、Cursor |
| `model` | 否 | 开发所用模型，如 kimi-k3、claude-sonnet-4 |
| `version` | 否 | 最新版本号，如 1.2.0 |
| `versionUpdatedAt` | 否 | 该版本的更新日期，`YYYY-MM-DD` |

系统字段 `id`、`createdAt`、`updatedAt` 由存储层生成/维护，不要手工指定。

## 维护规则

- **版本与日期联动**：只要 `version` 发生变化，就必须更新 `versionUpdatedAt`（通常设为当天日期）。通过 MCP/API 更新时若只传 `version` 不传日期，系统会自动填当天。
- 登记新工具前先用 `gallery_list_tools` 查重；若已存在则改为更新。
- 用户说"发布/更新了版本"时，更新 `version` 与 `versionUpdatedAt`，并可顺带核对 `githubUrl`。
- **封面**：通过 MCP/API 只能把 `cover` 设为现成的图片链接；上传图片、裁剪与 AI 生成（`POST /api/covers`、`POST /api/covers/generate`，均需令牌）是后台界面的能力——用户要求"生成/裁剪封面"时，引导他去后台操作，或在他给出图片链接时直接写入 `cover` 字段。AI 生成的 OpenAI 配置在后台「设置」页管理（`GET/PUT /api/settings`，密钥只写不读）。
- `gallery_remove_tool` / `DELETE` 不可恢复，执行前必须向用户确认。
- 用户没提供 `vibeCodingTool` 或 `model` 时，若本次就是你在协助开发，可填入当前工具与你自己的模型名；否则留空，不要编造。
- `githubUrl` 必须是合法 URL；没有仓库就省略该字段，不要填空字符串以外的占位符。
- **本地与云端数据相互独立**：本地改动后如需上线，用 `npm run kv:push` 推送数据（代码改动用 `npm run deploy`，封面上传用 `npm run covers:push`）；云端的改动不会自动回流本地，需要时用 `npm run kv:pull` 拉回来。
