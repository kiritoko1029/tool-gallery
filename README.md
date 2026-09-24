# Tool Gallery 工具集

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kiritoko1029/tool-gallery)

以卡片形式展示你开发的工具程序，记录每个工具的 **封面、vibecoding 工具、模型、最新版本与版本更新日期**。自带管理后台（支持封面上传/裁剪/AI 生成），并暴露 **MCP server** 与 **skill**，让 AI 代理可以帮你登记、更新、下架工具。

线上实例（Cloudflare Workers 全量部署，含前台 + 后台 + API + MCP）：

- 工具集：https://tool-gallery.1794130477.workers.dev
- 管理后台：https://tool-gallery.1794130477.workers.dev/admin
- MCP 端点：`https://tool-gallery.1794130477.workers.dev/mcp`

## 本地运行

```bash
npm install
npm start
```

- 画廊：<http://localhost:3927>
- 后台：<http://localhost:3927/admin>

本地首次启动会自动生成管理员令牌并打印在终端，同时保存到 `data/.admin-token`（权限 0600）。也可以用环境变量覆盖：

```bash
PORT=8080 GALLERY_ADMIN_TOKEN=my-secret npm start
```

## 数据

本地数据存放在 `data/tools.json`（原子写入，外部直接修改也会被服务自动感知）；云端数据存放在 Cloudflare KV（key 为 `tools`，值结构与该文件相同，可互相同步）。字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ | 程序名 |
| `description` | ✅ | 一句话简介 |
| `cover` | | 封面图（16:9）：外部图片链接或 `/covers/…` 站内路径 |
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

本地与云端行为一致。公开读、令牌写（`Authorization: Bearer <token>`）：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tools?q=&tag=` | 列出工具（可搜索/按标签过滤） |
| GET | `/api/tools/:id` | 查看单个 |
| GET | `/api/tags` · `/api/summary` | 标签列表 / 概览 |
| POST | `/api/tools` | 登记新工具 🔒 |
| PUT | `/api/tools/:id` | 部分更新（不传字段保持不变）🔒 |
| DELETE | `/api/tools/:id/field/:field` | 清空某个可选字段 🔒 |
| DELETE | `/api/tools/:id` | 下架 🔒 |
| POST | `/api/covers` | 封面上传（`{image: dataURL}` 或 `{url: 外链}`）🔒 |
| POST | `/api/covers/generate` | AI 生成封面（按工具信息调用 OpenAI 图像模型）🔒 |
| GET | `/api/proxy-image?url=` | 外链图片代理（后台裁剪绕开 CORS）🔒 |
| GET | `/api/features` | 能力开关（如 AI 封面是否已配置）🔒 |
| GET | `/covers/:key` | 封面图读取（公开，本地读 `data/covers/`，云端读 R2） |

## MCP server

工具：`gallery_list_tools`、`gallery_get_tool`、`gallery_summary`（公开读）；`gallery_add_tool`、`gallery_update_tool`、`gallery_remove_tool`（🔒 需要令牌）。两种接入方式：

**本地 stdio**（直接读写 `data/tools.json`，不要求 Web 服务在线）——本仓库已自带项目级 `.kimi-code/mcp.json`：

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

**云端 HTTP**（操作线上画廊，无状态 Streamable HTTP）：

```json
{
  "mcpServers": {
    "tool-gallery-cloud": {
      "url": "https://tool-gallery.1794130477.workers.dev/mcp",
      "headers": { "Authorization": "Bearer <管理员令牌>" }
    }
  }
}
```

配置后**新开会话**才会加载；Kimi Code 里用 `/mcp` 查看连接状态。不带令牌连接时只能使用只读工具。

## 封面图

每个工具可配一张 16:9 封面，三种来源（后台编辑弹窗里操作）：

1. **上传图片**：本地存入 `data/covers/`、云端存入 R2 bucket `tool-gallery-covers`，经 `/covers/:key` 提供公开访问；
2. **图片链接**：直接粘贴外部 URL，或使用代理裁剪后转存本站；
3. **AI 生成**：根据程序名/简介/标签调用 OpenAI 图像模型（默认 `gpt-image-1`，1536×1024）生成封面。

三种来源都可以再**手动裁剪**（拖拽平移 + 缩放，导出 1600×900 WebP）。

AI 生成需要配置 OpenAI 密钥，未配置时后台的「AI 生成」按钮会提示不可用：

```bash
# 本地
export OPENAI_API_KEY=sk-...          # 可选：OPENAI_BASE_URL / OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY

# 云端
npx wrangler secret put OPENAI_API_KEY
```

## 部署到 Cloudflare（Workers）

前台、后台、REST API、MCP 全部跑在一个 Worker 上，数据存 KV：

```bash
# 首次：浏览器授权 Cloudflare 账号
npx wrangler login

# 首次还需：创建 KV 命名空间与 R2 bucket，把 id 填入 wrangler.toml，配置管理员令牌
npx wrangler kv namespace create GALLERY_KV
npx wrangler r2 bucket create tool-gallery-covers
npx wrangler secret put GALLERY_ADMIN_TOKEN   # 建议与本地 data/.admin-token 保持一致
npx wrangler secret put OPENAI_API_KEY        # 可选，启用 AI 封面生成

# 每次发布代码
npm run deploy          # = wrangler deploy
```

数据同步（本地 ⇄ 云端，双向覆盖式，谨慎使用）：

```bash
npm run kv:push       # 本地 data/tools.json → 云端 KV
npm run kv:pull       # 云端 KV → 本地 data/tools.json
npm run covers:push   # 本地 data/covers/ → 云端 R2（封面图）
```

**一键部署自己的实例**：点击 README 顶部的 **Deploy to Cloudflare** 按钮。Cloudflare 会克隆本仓库到你的账号、自动创建并绑定新的 KV 命名空间、配好 Workers Builds CI（此后 push 即自动部署）。部署完成后还需为实例设置管理员令牌才能使用后台：

```bash
git clone <你 fork 出的仓库> && cd tool-gallery
npx wrangler secret put GALLERY_ADMIN_TOKEN
```

## Skill

`skill/SKILL.md` 定义了 AI 维护工具集的规则（查重、版本-日期联动、删除前确认、本地/云端通道选择等）。安装到用户技能目录：

```bash
npm run skill:install   # 复制到 ~/.agents/skills/tool-gallery/
```

## 开发记录

本项目使用 Agent Notes 记录关键开发决策，见 `.agents/notes/`（格式约定：`.agents/notes/` 下 `{lifecycle}/{class}/yyyy-mm-dd-topic.md`）。

## 结构

```
src/tools-core.js   纯逻辑：zod 校验、过滤、版本-日期联动（双端共享）
src/cover-core.js   封面逻辑：OpenAI 生成、外链抓取、dataURL 解析（双端共享）
src/store.js        本地文件存储（JSON 原子写 + mtime 缓存 + 写队列）
src/mcp-tools.js    MCP 工具定义与 JSON-RPC 分发（stdio 与 HTTP 共享）
src/server.js       本地 Express：REST API + 令牌鉴权 + 静态页 + 封面端点
src/mcp-server.js   本地 MCP stdio server
worker/index.js     Cloudflare Worker：API + /mcp + /covers + 静态资源路由
worker/kv-store.js  KV 存储后端（与 fileStore 同接口）
public/             工具集前台 + 管理后台（无构建步骤）
skill/SKILL.md      AI 操作技能定义
scripts/install-skill.js / covers-push.js
wrangler.toml       Cloudflare Workers + KV + R2 配置
data/tools.json     本地数据文件（data/covers/ 为本地封面图）
.agents/notes/      Agent Notes 开发决策记录
```
