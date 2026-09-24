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
import {
  CoverError,
  newCoverKey,
  parseDataUrl,
  fetchImageBytes,
  buildCoverPrompt,
  generateCoverImage,
  resolveAiConfig,
} from './cover-core.js';
import { readSettings, updateSettings, settingsView } from './settings.js';

const PORT = Number(process.env.PORT ?? 3927);
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');
const TOKEN_FILE = path.join(DATA_DIR, '.admin-token');
const COVERS_DIR = path.join(DATA_DIR, 'covers');

function saveCover({ bytes, ext }) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  const key = newCoverKey(ext);
  fs.writeFileSync(path.join(COVERS_DIR, key), Buffer.from(bytes), { mode: 0o644 });
  return `/covers/${key}`;
}

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
app.use(express.json({ limit: '12mb' })); // 封面图为 base64，需要较大上限

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

app.get('/api/features', requireAuth, (_req, res) =>
  res.json({ aiCover: Boolean(resolveAiConfig(readSettings(), process.env).apiKey) })
);

// 后台设置（AI 配置）：密钥只写不读，读取返回脱敏视图
app.get('/api/settings', requireAuth, (_req, res) => res.json(settingsView()));

app.put('/api/settings', requireAuth, (req, res, next) => {
  try {
    updateSettings(req.body ?? {});
    res.json(settingsView());
  } catch (err) {
    next(err);
  }
});

// 封面上传：{image: dataURL} 或 {url: 外链} → 存入 data/covers/
app.post('/api/covers', requireAuth, async (req, res, next) => {
  try {
    const { image, url } = req.body ?? {};
    const material = image ? parseDataUrl(image) : url ? await fetchImageBytes(url) : null;
    if (!material) return res.status(400).json({ error: '需要 image（dataURL）或 url 字段' });
    res.status(201).json({ cover: saveCover(material) });
  } catch (err) {
    next(err);
  }
});

// 封面 AI 生成：根据已填写的工具信息调用 OpenAI 图像模型
app.post('/api/covers/generate', requireAuth, async (req, res, next) => {
  try {
    const ai = resolveAiConfig(readSettings(), process.env);
    if (!ai.apiKey) {
      return res.status(503).json({ error: '未配置 OpenAI API Key：可在后台右上角「设置」中配置，或设置 OPENAI_API_KEY 环境变量' });
    }
    const prompt = buildCoverPrompt(req.body ?? {});
    const image = await generateCoverImage(ai, prompt);
    res.status(201).json({ cover: saveCover(image), prompt });
  } catch (err) {
    next(err);
  }
});

// 外链图片代理（后台裁剪外部图片时绕过浏览器 CORS）
app.get('/api/proxy-image', requireAuth, async (req, res, next) => {
  try {
    const { bytes, contentType } = await fetchImageBytes(req.query.url ?? '');
    res.set('Content-Type', contentType).send(Buffer.from(bytes));
  } catch (err) {
    next(err);
  }
});

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
  const allowed = ['githubUrl', 'link', 'cover', 'icon', 'tags', 'vibeCodingTool', 'model', 'version', 'versionUpdatedAt'];
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

// 封面图（本地对象存储 data/covers/）
app.get('/covers/:key', (req, res) => {
  const key = path.basename(req.params.key); // 防目录穿越
  const file = path.join(COVERS_DIR, key);
  if (!/^[\w.-]+$/.test(key) || !fs.existsSync(file)) {
    return res.status(404).json({ error: '封面不存在' });
  }
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(file);
});

// ---- 统一错误处理 ----
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: '参数校验失败',
      details: err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    });
  }
  if (err instanceof CoverError) {
    return res.status(422).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`工具集已启动:  http://localhost:${PORT}`);
  console.log(`后台管理:      http://localhost:${PORT}/admin`);
  console.log(`管理员令牌来源:  ${tokenSource}`);
  console.log(`管理员令牌:      ${ADMIN_TOKEN}`);
});
