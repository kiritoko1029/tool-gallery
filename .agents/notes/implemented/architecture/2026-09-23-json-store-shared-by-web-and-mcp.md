# Agent Note: 单一 JSON 文件存储，Web 服务与 MCP 共享同一数据层

Status: implemented

## Problem

画廊需要持久化工具条目，同时被两个进程消费：Express Web 服务（前台 + 后台 + REST API）和 MCP stdio server（供 AI 代理直接操作）。需要决定存储形态，以及 MCP 是直接读存储还是经由 HTTP API。

## Decision

存储为单一 JSON 文件 `data/tools.json`（`GALLERY_DATA_DIR` 可覆盖数据目录），写入采用临时文件 + `rename` 的原子写。`src/store.js` 是唯一数据层：进程内缓存 + 基于文件 mtime 的失效重载，写操作经 promise 队列串行化。Web 服务与 MCP server **都直接 import 该模块**；MCP 不依赖 Web 服务在线。每次写操作前重新检查 mtime，因此外部（编辑器、另一个进程）改动会被下一次读取感知。

## Alternatives considered

- **SQLite（better-sqlite3）**：查询与并发语义更强，但引入原生编译依赖，且数据不再肉眼可编辑；个人画廊规模（几十条记录）用不到，故否决。
- **MCP 走 HTTP API**：能保证单写入者，但 MCP 的可用性将依赖 Web 服务常驻，违背"AI 随时可维护画廊"的目标，故否决。
- **低依赖 JSON 库（lowdb）**：与手写模块能力相当，多一个依赖没有换来收益，故否决。
- **跨进程文件锁**：两个进程并发写理论上存在 last-write-wins 窗口；个人单用户场景概率极低，引入锁依赖不值得。若未来出现多写入者，应重开本决策。

## Consequences

代价是放弃关系查询能力与严格的跨进程写互斥。换来的是：零原生依赖、数据文件可直接阅读和手工编辑、MCP 独立可用、外部改动自动生效。原子写保证读者永远不会读到半个文件。
