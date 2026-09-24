# Agent Note: 工具封面图功能（R2 对象存储 / 链接 / 裁剪 / AI 生成）

Status: implemented

## Problem

用户要求卡片支持封面图：可以用 Cloudflare R2 做对象存储、可以直接填图片链接、可以手动裁剪、还可以根据已填写的工具信息用 GPT 图像模型生成封面。封面横跨双端架构（本地 Express + 云端 Worker），且涉及浏览器 CORS、密钥管理、图片体积等约束。

## Decision

数据模型新增可选字段 `cover`（[卡片数据模型笔记](../../implemented/feature/2026-09-23-tool-card-schema.md)已同步），取值只接受两种形态：外部 `https?://` 链接，或站内 `/covers/<key>` 路径。封面二进制走独立的对象存储抽象：本地写 `data/covers/`（gitignore），云端写 R2 bucket `tool-gallery-covers`（绑定 `COVERS`），两端都经 `GET /covers/:key` 公开读取（一年 immutable 缓存头）。共享逻辑在 `src/cover-core.js`：dataURL 解析、外链抓取（类型与 10MB 上限校验）、OpenAI Images 调用（默认 `gpt-image-1`、1536×1024、medium 质量，可用 `OPENAI_BASE_URL` / `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_QUALITY` 覆盖）、提示词构建。新增端点：`POST /api/covers`（上传 dataURL 或外链转存）、`POST /api/covers/generate`（AI 生成）、`GET /api/proxy-image`（外链代理，供客户端裁剪绕开 CORS）、`GET /api/features`（能力探测，驱动后台"AI 生成"按钮的可用性提示）。裁剪在客户端 Canvas 完成（拖拽平移 + 滑块缩放，固定 16:9，导出 1600×900 WebP），服务端只存结果。AI 密钥：本地读 `OPENAI_API_KEY` 环境变量，云端用 Workers secret，未配置时端点返回 503 与可操作指引。封面的删除不与工具删除联动（可能被多处复用）。本地封面通过 `npm run covers:push` 同步到 R2。

## Alternatives considered

- **封面存 KV 或 base64 内联进 tools.json**：KV 为读优化且值大小限制 25MB 但图片会拖慢每次 API 响应；内联 base64 让数据文件膨胀 33% 且破坏可读性。R2/文件系统才是对象存储的正解，故否决。
- **引入 Cropper.js 等 CDN 库**：后台是低频次工具页，手写 Canvas 裁剪约百行、零外链依赖、无 CDN 可用性问题，故否决。
- **AI 生成走 MCP 工具**：图像生成耗时 20~60 秒且需要交互式预览微调，MCP 工具调用语义不匹配；留在后台表单里。MCP 只能写入现成图片链接（skill 已记录该边界）。
- **裁剪放服务端**：需要引入图像处理依赖（sharp 原生模块 / Workers 里不可用），客户端 Canvas 天然胜任，故否决。
- **开放 R2 公共访问域名**：经 Worker `/covers/:key` 转发免配置公开 bucket，路径白名单校验防穿越，故否决公开域名。

## Consequences

代价：封面文件生命周期独立（删工具不删封面，孤儿文件靠 covers 目录人工清理）；`kv:push/pull` 不同步封面，需单独 `covers:push`；AI 生成的可用性依赖用户自行配置 OpenAI 密钥。换来：封面链路在本地与云端行为一致、可验证（本轮已实测 上传→裁剪→导出 WebP→存储→公开读取 全链路），且不引入任何新的运行时依赖。
