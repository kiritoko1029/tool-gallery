# Agent Note: 更名为「工具集」并按 ui-ux-pro-max 设计系统改版界面

Status: implemented

## Problem

用户指出"画廊"命名不贴切——这里陈列的是工具程序而非艺术品，"工具集"更准确。同时要求按 ui-ux-pro-max 技能美化界面：原有暖色琥珀主题是凭直觉搭建的，缺少系统化设计依据，且结构性图标用了 emoji（字体相关、跨平台不一致）。

## Decision

产品显示名改为**工具集（Toolset）**：页面标题、后台、README、skill、种子卡片同步更新；技术标识（npm 包名、仓库名、MCP server 名、Workers 项目名、URL）保持 `tool-gallery` 不变以避免破坏既有配置与链接。视觉按 `ui-ux-pro-max --design-system` 的推荐落地：Portfolio Grid 模式；配色改用 slate 深色 + 运行绿 accent（`--bg #0f172a`、`--accent #22c55e` 等语义化 CSS 变量）；Inter 字体（`display=swap` + 系统字体兜底）；结构性图标全部换成内联 SVG（搜索、GitHub、外链、设置、警告等），emoji 仅保留为用户内容字段（`icon`）。性能与无障碍配套：封面 `aspect-ratio` 防 CLS、`loading="lazy"`、加载骨架屏、`:focus-visible` 焦点环、按钮触控高度 ≥44px、`prefers-reduced-motion` 降级、toast `role="status"`。

## Alternatives considered

- **连技术标识一起改名（仓库、Worker、MCP server）**：会破坏已部署的 URL、用户级 mcp.json、skill 目录名与既有链接，收益为零，故否决。
- **保留暖色琥珀主题**：与新封面图混排时色彩冲突大；设计系统推荐的 slate+绿更贴开发者工具气质，故采纳推荐。
- **引入 Tailwind/组件库**：项目刻意无构建步骤，CSS 变量 + 原生 CSS 已足够表达 token 体系，故否决。

## Consequences

代价是存量截图、笔记里的旧主题描述成为历史记录（保留不追溯修改）。换来视觉体系有了可检索的设计依据（ui-ux-pro-max），后续改版可沿 MASTER 规则检索而不是重新发明；SVG 图标与语义色 token 消除了 emoji 渲染的平台差异。
