// Cloudflare Worker 入口：前台静态资源（assets）+ REST API + 管理后台 + HTTP 版 MCP（/mcp）。
// 与本地 src/server.js 行为保持一致；存储使用 KV（见 worker/kv-store.js），
// 管理员令牌来自 Workers secret/变量 GALLERY_ADMIN_TOKEN。
import { ZodError } from 'zod';
import { createKVStore } from './kv-store.js';
import { handleMcpMessage } from '../src/mcp-tools.js';

const CLEARABLE_FIELDS = [
  'githubUrl',
  'link',
  'icon',
  'tags',
  'vibeCodingTool',
  'model',
  'version',
  'versionUpdatedAt',
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(buf);
}

// 先哈希再做定长逐字节比较，避免计时侧信道
async function isAuthorized(request, env) {
  if (!env.GALLERY_ADMIN_TOKEN) return false;
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;
  const [a, b] = await Promise.all([sha256(token), sha256(env.GALLERY_ADMIN_TOKEN)]);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function unauthorized() {
  return json({ error: '未授权：请提供有效的管理员令牌（Authorization: Bearer <token>）' }, 401);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function zodFailure(err) {
  return json(
    {
      error: '参数校验失败',
      details: err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    },
    400
  );
}

async function handleApi(request, env, url) {
  const store = createKVStore(env);
  const path = url.pathname;
  const method = request.method;
  const notFound = () => json({ error: '接口不存在' }, 404);

  // 公开读接口
  if (method === 'GET' && path === '/api/health') return json({ ok: true, name: 'tool-gallery', runtime: 'worker' });
  if (method === 'GET' && path === '/api/tools') {
    return json({ tools: await store.list({ query: url.searchParams.get('q') || undefined, tag: url.searchParams.get('tag') || undefined }) });
  }
  if (method === 'GET' && path === '/api/tags') return json({ tags: await store.tags() });
  if (method === 'GET' && path === '/api/summary') return json(await store.summary());

  const toolMatch = path.match(/^\/api\/tools\/([^/]+)$/);
  if (method === 'GET' && toolMatch) {
    const id = decodeURIComponent(toolMatch[1]);
    const tool = await store.get(id);
    return tool ? json(tool) : json({ error: `找不到工具：${id}` }, 404);
  }

  // 以下为写接口，需要管理员令牌
  if (!(await isAuthorized(request, env))) return unauthorized();

  if (method === 'POST' && path === '/api/auth/check') return json({ ok: true });

  try {
    if (method === 'POST' && path === '/api/tools') {
      return json(await store.create(await readBody(request)), 201);
    }
    if (method === 'PUT' && toolMatch) {
      const id = decodeURIComponent(toolMatch[1]);
      const updated = await store.update(id, await readBody(request));
      return updated ? json(updated) : json({ error: `找不到工具：${id}` }, 404);
    }
    const fieldMatch = path.match(/^\/api\/tools\/([^/]+)\/field\/([a-zA-Z]+)$/);
    if (method === 'DELETE' && fieldMatch) {
      const [, rawId, field] = fieldMatch;
      if (!CLEARABLE_FIELDS.includes(field)) return json({ error: `不允许清空的字段：${field}` }, 400);
      const updated = await store.clearField(decodeURIComponent(rawId), field);
      return updated ? json(updated) : json({ error: '找不到工具' }, 404);
    }
    if (method === 'DELETE' && toolMatch) {
      const id = decodeURIComponent(toolMatch[1]);
      return (await store.remove(id)) ? json({ ok: true, id }) : json({ error: `找不到工具：${id}` }, 404);
    }
  } catch (err) {
    if (err instanceof ZodError) return zodFailure(err);
    throw err;
  }
  return notFound();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
};

async function handleMcp(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') {
    return json({ error: 'MCP 端点仅支持 POST（Streamable HTTP，无状态模式）' }, 405, corsHeaders);
  }
  const store = createKVStore(env);
  const authorized = await isAuthorized(request, env);
  const body = await readBody(request);

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const result = await handleMcpMessage(store, msg, { authorized });
    if (result !== null) responses.push(result);
  }
  // 全是通知：202 空响应
  if (responses.length === 0) return new Response(null, { status: 202, headers: corsHeaders });
  return json(Array.isArray(body) ? responses : responses[0], 200, corsHeaders);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/mcp') return await handleMcp(request, env);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      // 其余路径交给静态资源（public/）；/admin 由 assets 的 clean-URL 行为映射到 admin.html
      return await env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return json({ error: '服务器内部错误' }, 500);
    }
  },
};
