# Agent Note: 工具卡片数据模型与版本-日期联动规则

Status: implemented

## Problem

画廊卡片要展示程序名、简介、GitHub 地址（可选）、vibecoding 工具、模型、最新版本、版本更新日期。需要确定哪些字段必填、日期格式，以及"更新版本号却忘记改日期"这类常见维护失误如何防止。

## Decision

数据模型（`src/tools-core.js` 的 `toolInputSchema`，zod 校验）：必填仅 `name` 与 `description`；可选字段为 `githubUrl`、`link`、`cover`（封面图，外链或 `/covers/` 站内路径，详见[封面功能笔记](../../implemented/feature/2026-09-24-tool-covers.md)）、`icon`（单个 emoji）、`tags`、`vibeCodingTool`、`model`、`version`、`versionUpdatedAt`。可选字段的空字符串在入口处归一化为"不存在"，数据库中不存空串。`versionUpdatedAt` 强制 `YYYY-MM-DD`。系统字段 `id`（由名称生成的 slug，冲突时追加序号）、`createdAt`、`updatedAt` 由存储层维护。**版本-日期联动**：`updateTool` 发现 `version` 变化而调用方未提供 `versionUpdatedAt` 时，自动将其设为当天日期。该规则同时体现在 MCP 工具描述与 skill 文档中，使 AI 操作者无需记忆此约定。

## Alternatives considered

- **全部字段必填**：用户并非每个工具都有 GitHub 仓库或版本号，强制填写只会逼出垃圾数据，故否决。
- **`versionUpdatedAt` 用完整 ISO 时间戳**：卡片只展示到天，时间部分是无用精度；`YYYY-MM-DD` 更易读易填，故否决。
- **日期完全交给调用方维护**：AI 和人都容易在改版本号时忘记日期，画廊会长期展示过期信息；自动联动在存储层兜底，故否决。
- **`id` 用 UUID**：slug 可读、可在 API 路径与调试中直接辨认，冲突率在本场景可忽略，故否决 UUID。

## Consequences

必填面小降低了登记门槛（AI 只需名称与简介即可收录一个工具）；空串归一化让"没有"与"空"在语义上统一。版本-日期联动消除了最主要的陈旧信息来源，代价是调用方无法用"改版本但不改日期"表达刻意行为——真有此需求时可显式传 `versionUpdatedAt` 旧值覆盖。
