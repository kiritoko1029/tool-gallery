---
name: tool-gallery
description: 维护用户的个人工具画廊（Tool Gallery，位于 ~/apps/tool-gallary）——一个以卡片展示用户开发的工具程序的网站。当用户要求登记/收录新做的工具、更新某个工具的信息或版本、下架工具、查询画廊里有什么、或同步 GitHub 仓库信息到画廊时使用。优先使用 tool-gallery MCP server 提供的工具操作。
---

# Tool Gallery

用户的个人工具画廊：以卡片形式展示他自己开发的工具程序。本项目位于 `~/apps/tool-gallary`，数据在 `~/apps/tool-gallary/data/tools.json`，Web 服务默认端口 `3927`（画廊 `/`，后台 `/admin`）。

## 操作方式（按优先级）

1. **MCP server `tool-gallery`**（首选，若已连接）：使用 `gallery_list_tools`、`gallery_get_tool`、`gallery_add_tool`、`gallery_update_tool`、`gallery_remove_tool`、`gallery_summary`。MCP 直接读写数据文件，不要求 Web 服务在线。
2. **REST API**（要求 Web 服务已启动）：`GET /api/tools`、`POST /api/tools`、`PUT /api/tools/:id`、`DELETE /api/tools/:id`；写操作需请求头 `Authorization: Bearer <token>`，令牌在 `~/apps/tool-gallary/data/.admin-token`（读取该文件后即可使用，不要展示给用户以外的人）。
3. **直接编辑 `data/tools.json`**：仅在以上方式不可用时。保持 JSON 结构 `{ "version": 1, "tools": [...] }`，保存后 Web 服务会自动感知文件变更，无需重启。

## 数据字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | 是 | 程序名 |
| `description` | 是 | 一句话简介 |
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
- `gallery_remove_tool` / `DELETE` 不可恢复，执行前必须向用户确认。
- 用户没提供 `vibeCodingTool` 或 `model` 时，若本次就是你在协助开发，可填入当前工具与你自己的模型名；否则留空，不要编造。
- `githubUrl` 必须是合法 URL；没有仓库就省略该字段，不要填空字符串以外的占位符。
