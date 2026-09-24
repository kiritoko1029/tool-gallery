# Agent Note: AI 生成配置收进后台设置页（密钥只写不读）

Status: implemented

## Problem

AI 封面生成的 OpenAI API Key、Base URL、模型此前只能走环境变量（本地 `OPENAI_API_KEY`）或 `wrangler secret`（云端）——改配置要碰终端和 shell profile，和"后台管理一切"的产品形态不一致。用户要求这三项在管理页面里配置。

## Decision

新增设置存储与两个端点（`GET/PUT /api/settings`，均需令牌），配置项为 `openaiApiKey` / `openaiBaseUrl` / `openaiImageModel` / `openaiImageQuality`。存储：本地 `data/settings.json`（0600、gitignore），云端 KV 独立 key `settings`（与工具数据隔离）。**密钥只写不读**：`GET` 只返回 `openaiApiKeySet` 与尾号脱敏预览（`••••1234`），完整密钥永不出服务端；`PUT` 语义为 非空=覆盖、null=清除、缺省=不动，清除勾选框走 null 通道。优先级：页面配置 > 环境变量/secret（`resolveAiConfig`，`src/cover-core.js`）。`GET /api/features` 与 `/api/covers/generate` 改用解析后的配置，未配置时 503 文案指向设置页。后台右上角新增「设置」弹窗（API Key 密码框 + Base URL + 模型 + 质量下拉 + 清除勾选），保存后即时刷新"AI 生成"按钮的可用性提示。patch/视图纯逻辑（`applySettingsPatch` / `settingsViewOf`）在 cover-core.js，双端共享。

## Alternatives considered

- **继续只用环境变量/secret**：与"后台管理一切"相悖，且本地与云端配置方式不一致，故否决（保留为兜底通道）。
- **读取时返回完整密钥给登录后的管理员**：密钥一旦出现在响应里就会进入浏览器历史、日志、代理缓存的风险面；脱敏回显是通行做法（GitHub/Cloudflare 均如此），故否决。
- **设置存 tools.json 同 key**：密钥与公开数据混存会让 `kv:push` 把密钥带进 git 提交风险区；独立文件/key 物理隔离，故否决。

## Consequences

代价：双端各多一份设置存储（file 与 KV）需要各自初始化，且页面配置与 secret 并存时可能困惑（页面优先的规则已写入设置页提示与 README）。换来：AI 生成的全部配置可在界面内完成，密钥不离开服务端、不进 git、不出响应体；环境变量降级为兜底而非唯一途径。
