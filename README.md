# Tool Gallery 工具画廊

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kiritoko1029/tool-gallery)

以卡片形式展示你开发的工具程序，并记录每个工具背后的 **vibecoding 工具、模型、最新版本与版本更新日期**。自带管理后台，并暴露 **MCP server** 与 **skill**，让 AI 代理可以帮你登记、更新、下架工具。

## 快速开始

```bash
npm install
npm start
```

- 画廊：<http://localhost:3927>
- 后台：<http://localhost:3927/admin>

首次启动会自动生成管理员令牌并打印在终端，同时保存到 `data/.admin-token`（权限 0600）。也可以用环境变量覆盖：

```bash
PORT=8080 GALLERY_ADMIN_TOKEN=my-secret npm start
```

## 数据

所有数据存放在 `data/tools.json`（原子写入，外部直接修改也会被服务自动感知）。字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ | 程序名 |
| `description` | ✅ | 一句话简介 |
| `githubUrl` | | GitHub 仓库地址（没有就省略） |
| `link` | | 在线体验 / 主页地址 |
| `icon` | | 一个 emoji 卡片图标 |
| `tags` | | 标签数组 |
| `vibeCodingTool` | | 开发用的 AI 编程工具（Kimi Code / Claude Code / Cursor …） |
| `model` | | 开发所用模型 |
| `version` | | 最新版本号 |
| `versionUpdatedAt` | | 版本更新日期 `YYYY-MM-DD`（改版本号不传日期时自动填当天） |

`id` / `createdAt` / `updatedAt` 由系统自动维护。

## REST API

公开读、令牌写（`Authorization: Bearer <token>`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tools?q=&tag=` | 列出工具（可搜索/按标签过滤） |
| GET | `/api/tools/:id` | 查看单个 |
| GET | `/api/tags` · `/api/summary` | 标签列表 / 概览 |
| POST | `/api/tools` | 登记新工具 🔒 |
| PUT | `/api/tools/:id` | 部分更新（不传字段保持不变）🔒 |
| DELETE | `/api/tools/:id/field/:field` | 清空某个可选字段 🔒 |
| DELETE | `/api/tools/:id` | 下架 🔒 |

## MCP server

工具：`gallery_list_tools`、`gallery_get_tool`、`gallery_add_tool`、`gallery_update_tool`、`gallery_remove_tool`、`gallery_summary`。MCP 直接读写 `data/tools.json`，不要求 Web 服务在线。

Kimi Code 的配置（`~/.kimi-code/mcp.json` 或项目级 `.kimi-code/mcp.json`）——本仓库已自带项目级配置，并已在构建时写入用户级配置：

```json
{
  "mcpServers": {
    "tool-gallery": {
      "command": "node",
      "args": ["/绝对路径/tool-gallary/src/mcp-server.js"],
      "env": { "GALLERY_DATA_DIR": "/绝对路径/tool-gallary/data" }
    }
  }
}
```

其他兼容 `.mcp.json` 的客户端（如 Claude Code、Cursor）可参考同名根文件。配置后**新开会话**才会加载该 server；在 TUI 里可用 `/mcp` 查看连接状态。

## 发布到 Cloudflare Pages

画廊前台可以一键发布为静态站点（公开只读快照；后台管理与 MCP 仍在你本地运行）：

```bash
# 首次：浏览器授权 Cloudflare 账号
npx wrangler login

# 之后每次发布（自动先构建 dist/，再直接上传部署）
npm run deploy
```

- 构建：`npm run build` 把 `public/` 复制到 `dist/`，将 `data/tools.json` 烘焙为 `dist/tools.json`，并把前端请求从 `/api/tools` 改写到 `/tools.json`；后台页面（`admin.html`）不会进入发布产物。
- 部署：`wrangler pages deploy`（Direct Upload，配置见 `wrangler.toml`），项目名 `tool-gallery`，发布地址为 `https://tool-gallery.pages.dev`。
- 更新内容后重新 `npm run deploy` 即可覆盖线上版本。
- 也可以点击 README 顶部的 **Deploy to Cloudflare Pages** 按钮：Cloudflare 会 fork 本仓库并引导创建 Pages 项目，构建设置填 **构建命令 `npm run build`、输出目录 `dist`**。

## Skill

`skill/SKILL.md` 定义了 AI 维护画廊的规则（查重、版本-日期联动、删除前确认等）。安装到用户技能目录：

```bash
npm run skill:install   # 复制到 ~/.agents/skills/tool-gallery/
```

## 开发记录

本项目使用 Agent Notes 记录关键开发决策，见 `.agents/notes/`（格式约定：`.agents/notes/` 下 `{lifecycle}/{class}/yyyy-mm-dd-topic.md`）。

## 结构

```
src/store.js        数据层：JSON 存储、原子写、zod 校验、版本-日期联动
src/server.js       Express：REST API + 令牌鉴权 + 静态页
src/mcp-server.js   MCP stdio server
public/             画廊前台 + 管理后台（无构建步骤）
skill/SKILL.md      AI 操作技能定义
scripts/build-static.js   静态快照构建（dist/，用于 Cloudflare Pages）
scripts/install-skill.js
wrangler.toml       Cloudflare Pages 部署配置
data/tools.json     数据文件
.agents/notes/      Agent Notes 开发决策记录
```
