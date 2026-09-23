# Agent Note: 以静态快照方式发布到 Cloudflare Pages

Status: implemented

## Problem

用户要求一键把画廊发布到 Cloudflare Pages 并在 README 提供发布按钮。但本项目是 Express 动态服务（文件系统存储、REST API、管理后台），Cloudflare Pages 只托管静态资源（Functions 另算），两者运行模型不同，需要决定发布形态。

## Decision

采用**静态快照发布**：`scripts/build-static.js`（`npm run build`）把 `public/` 复制到 `dist/`，用 `src/store.js` 读出数据烘焙为 `dist/tools.json`，并把前端数据请求从 `/api/tools` 改写为 `/tools.json`；后台页面 `admin.html`/`admin.js` 不进入产物。部署用 wrangler Direct Upload：`npm run deploy` = 构建 + `wrangler pages deploy`（配置在 `wrangler.toml`，项目名 `tool-gallery`）。README 顶部放置 Cloudflare 官方 Deploy 按钮（fork 仓库 + Pages 构建流程，构建命令 `npm run build`、输出目录 `dist`）。线上站点是只读快照；管理后台、REST API、MCP 始终只在本地运行，内容更新流程为"本地改动 → 重新 `npm run deploy`"。`dist/` 不入 git。

## Alternatives considered

- **整体迁移到 Pages Functions + KV/D1**：前台、后台、API 全量上云，随时随地可管理；但要把存储层改写为 KV/D1、后台鉴权重做，且本地与云端出现两个数据源需要同步策略。对个人画廊而言复杂度远超收益，故否决。
- **Git 连接式 Pages 自动部署（push 即发布）**：省掉手动 deploy，但要求每次内容更新都产生 git 提交，把"改数据"与"发版本"耦合；保留为可选项（README 按钮走的就是这条路径），不作为主流程。
- **workers/sites 或自建 CDN**：与 Direct Upload 等价但配置更多，无收益。

## Consequences

代价是线上内容滞后于本地数据，且线上站没有后台与搜索接口以外的动态能力（搜索/过滤本身纯前端完成，不受影响）。换来的是：发布产物零运行时依赖、免费额度内无服务器成本、本地数据文件仍是唯一事实来源，MCP/skill 的维护路径不受发布影响。
