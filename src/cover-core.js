// 封面功能的共享逻辑：OpenAI 图像生成、外链抓取、dataURL 解析、key 生成。
// 同时被本地 Express（src/server.js）与 Cloudflare Worker（worker/index.js）使用。
// 只用 Web 标准 API（fetch / atob / crypto），不依赖 Node 内置模块。

const IMAGE_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export class CoverError extends Error {}

export function extForContentType(contentType) {
  return IMAGE_EXT[(contentType ?? '').split(';')[0].trim().toLowerCase()] ?? null;
}

export function newCoverKey(ext) {
  const rand = crypto.getRandomValues(new Uint8Array(6));
  const hex = [...rand].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `cover-${Date.now().toString(36)}-${hex}.${ext}`;
}

export function parseDataUrl(dataUrl) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl ?? '');
  if (!match) throw new CoverError('image 字段必须是 data:image/...;base64,... 形式');
  const contentType = match[1].toLowerCase();
  const ext = extForContentType(contentType);
  if (!ext) throw new CoverError(`不支持的图片类型：${contentType}`);
  const binary = atob(match[2].replace(/\s/g, ''));
  if (binary.length > MAX_IMAGE_BYTES) throw new CoverError('图片超过 10MB 上限');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType, ext };
}

async function readLimited(response) {
  const contentType = response.headers.get('content-type') ?? '';
  const ext = extForContentType(contentType);
  if (!ext) throw new CoverError(`目标不是图片（content-type: ${contentType || '未知'}）`);
  const buf = await response.arrayBuffer();
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new CoverError('图片超过 10MB 上限');
  return { bytes: new Uint8Array(buf), contentType: contentType.split(';')[0], ext };
}

// 抓取外链图片（上传"填链接"与客户端裁剪代理共用）
export async function fetchImageBytes(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new CoverError('不是合法 URL');
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new CoverError('仅支持 http(s) 图片链接');
  let response;
  try {
    response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch {
    throw new CoverError('抓取图片失败（网络不可达或超时）');
  }
  if (!response.ok) throw new CoverError(`抓取图片失败：HTTP ${response.status}`);
  return readLimited(response);
}

export function buildCoverPrompt({ name, description, tags, vibeCodingTool, model, prompt }) {
  if (prompt && prompt.trim()) return prompt.trim();
  return [
    `为开发者工具「${name}」设计一张 16:9 的产品封面图。`,
    `工具简介：${description}`,
    tags?.length ? `关键词：${tags.join('、')}。` : '',
    vibeCodingTool || model ? `它由 ${[vibeCodingTool, model].filter(Boolean).join(' + ')} 构建。` : '',
    '风格：深色背景上的现代极简科技插画，柔和的暖色或霓虹点缀，几何构图，大量留白，无文字、无水印、无 logo。',
  ]
    .filter(Boolean)
    .join('');
}

// 调用 OpenAI Images API（gpt-image-1 系列），返回图片字节
export async function generateCoverImage({ apiKey, baseUrl, model, quality }, prompt) {
  const endpoint = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'gpt-image-1',
        prompt,
        size: '1536x1024',
        quality: quality || 'medium',
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new CoverError('调用图像模型失败（网络不可达或超时）');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new CoverError(`图像生成失败：${body?.error?.message ?? `HTTP ${response.status}`}`);
  }
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new CoverError('图像模型未返回图片数据');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: 'image/png', ext: 'png' };
}
