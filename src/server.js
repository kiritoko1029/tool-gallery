import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ZodError } from 'zod';
import {
  PROJECT_ROOT,
  DATA_DIR,
  listTools,
  getTool,
  listTags,
  createTool,
  updateTool,
  deleteTool,
  clearField,
  summarize,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3927);
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const TOKEN_FILE = path.join(DATA_DIR, '.admin-token');

function loadAdminToken() {
  if (process.env.GALLERY_ADMIN_TOKEN) {
    return { token: process.env.GALLERY_ADMIN_TOKEN, source: 'env GALLERY_ADMIN_TOKEN' };
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const existing = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (existing) return { token: existing, source: TOKEN_FILE };
  } catch {
    /* 首次运行，下面生成 */
  }
  const token = crypto.randomBytes(24).toString('base64url');
  fs.writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 });
  return { token, source: `${TOKEN_FILE}（已自动生成）` };
}

const { token: ADMIN_TOKEN, source: tokenSource } = loadAdminToken();

function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  // 先哈希再比较，避免长度差异导致 timingSafeEqual 抛错
  const digest = (s) => crypto.createHash('sha256').update(s).digest();
  if (token && crypto.timingSafeEqual(digest(token), digest(ADMIN_TOKEN))) {
    return next();
  }
  res.status(401).json({ error: '未授权：请提供有效的管理员令牌（Authorization: Bearer <token>）' });
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// ---- 公开 API ----
app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'tool-gallery' }));

app.get('/api/tools', (req, res) => {
  const { q, tag } = req.query;
  res.json({ tools: listTools({ query: q || undefined, tag: tag || undefined }) });
});

app.get('/api/tools/:id', (req, res) => {
  const tool = getTool(req.params.id);
  if (!tool) return res.status(404).json({ error: `找不到工具：${req.params.id}` });
  res.json(tool);
});

app.get('/api/tags', (_req, res) => res.json({ tags: listTags() }));

app.get('/api/summary', (_req, res) => res.json(summarize()));

// ---- 管理 API（需要令牌）----
app.post('/api/auth/check', requireAuth, (_req, res) => res.json({ ok: true }));

app.post('/api/tools', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await createTool(req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

app.put('/api/tools/:id', requireAuth, async (req, res, next) => {
  try {
    const updated = await updateTool(req.params.id, req.body ?? {});
    if (!updated) return res.status(404).json({ error: `找不到工具：${req.params.id}` });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// 显式清空某个可选字段（PUT 语义里 undefined 表示不动它）
app.delete('/api/tools/:id/field/:field', requireAuth, async (req, res, next) => {
  const allowed = ['githubUrl', 'link', 'icon', 'tags', 'vibeCodingTool', 'model', 'version', 'versionUpdatedAt'];
  if (!allowed.includes(req.params.field)) {
    return res.status(400).json({ error: `不允许清空的字段：${req.params.field}` });
  }
  try {
    const updated = await clearField(req.params.id, req.params.field);
    if (!updated) return res.status(404).json({ error: `找不到工具：${req.params.id}` });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/tools/:id', requireAuth, async (req, res, next) => {
  try {
    if (!(await deleteTool(req.params.id))) {
      return res.status(404).json({ error: `找不到工具：${req.params.id}` });
    }
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    next(err);
  }
});

// ---- 页面 ----
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.use(express.static(PUBLIC_DIR));

// ---- 统一错误处理 ----
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: '参数校验失败',
      details: err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`工具画廊已启动:  http://localhost:${PORT}`);
  console.log(`后台管理:        http://localhost:${PORT}/admin`);
  console.log(`管理员令牌来源:  ${tokenSource}`);
  console.log(`管理员令牌:      ${ADMIN_TOKEN}`);
});
