# Agent Note: 采用 Agent Notes 记录本项目开发决策

Status: implemented

## Problem

用户要求在开发工具画廊的过程中使用 agent-notes 技能记录开发过程。项目新建，此前没有任何决策记录机制；没有记录的话，后续维护者（包括 AI 代理）无法得知关键设计取舍的原因，容易重开已否决的方案。

## Decision

项目采用 DeepSeek Harness 风格的 Agent Notes 约定，笔记根目录为 `.agents/notes/`，路径编码 `{lifecycle}/{class}/yyyy-mm-dd-topic-title.md`：lifecycle 取 `proposed/`、`implemented/`、`rejected/`；class 取 `feature`、`bug-fix`、`simplification`、`architecture`、`process`、`testing`。文件格式：首行 `# Agent Note: <title>`，随后 `Status: <status>`，正文以 `## Problem` 开头，必须有 `## Alternatives considered`；implemented 笔记使用 `## Decision` 与 `## Consequences`，并保持与已交付代码的事实同步。项目不使用中文版伴随文件（`.zh.md`）、一致性 sidecar 与归档清单校验器；`archived/` 树按需引入。本约定来自用户指定的 agent-notes 技能（`dsh-archive-agent-notes`）。

## Alternatives considered

- **不建笔记、只依赖 git 提交信息**：提交信息只记录"改了什么"，无法承载"为什么这么选、否决了什么"，这正是 Agent Notes 存在的理由，故否决。
- **自由格式的 docs/decisions/ 目录**：缺乏生命周期与强制 Alternatives 结构，长期会退化为没人维护的散文，故否决。
- **引入完整上游约定（中文伴随文件 + sidecar + 归档 manifest 校验器）**：对个人项目过重；约定明确允许不引入伴随文件与校验器，故只取核心格式。

## Consequences

成本是每次非平凡变更需同步一篇笔记；换来的是 AI 代理与人都能追溯决策动机，且 `dsh-archive-agent-notes` 技能可直接在本项目执行归档工作流。首批笔记覆盖了存储架构、卡片数据模型与 AI 访问通道三个决策。
