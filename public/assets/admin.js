const loginGate = document.getElementById('loginGate');
const adminApp = document.getElementById('adminApp');
const tokenInput = document.getElementById('tokenInput');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminList = document.getElementById('adminList');
const adminSearch = document.getElementById('adminSearch');
const addBtn = document.getElementById('addBtn');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const toolForm = document.getElementById('toolForm');
const cancelBtn = document.getElementById('cancelBtn');
const toastWrap = document.getElementById('toastWrap');

// 封面相关
const coverPreview = document.getElementById('coverPreview');
const coverInput = document.getElementById('f-cover');
const coverUploadBtn = document.getElementById('coverUploadBtn');
const coverCropBtn = document.getElementById('coverCropBtn');
const coverAiBtn = document.getElementById('coverAiBtn');
const coverRemoveBtn = document.getElementById('coverRemoveBtn');
const coverFileInput = document.getElementById('coverFileInput');

// 裁剪器
const cropperBackdrop = document.getElementById('cropperBackdrop');
const cropperStage = document.getElementById('cropperStage');
const cropperCanvas = document.getElementById('cropperCanvas');
const cropZoom = document.getElementById('cropZoom');
const cropResetBtn = document.getElementById('cropResetBtn');
const cropCancelBtn = document.getElementById('cropCancelBtn');
const cropConfirmBtn = document.getElementById('cropConfirmBtn');

// 设置弹窗
const settingsBtn = document.getElementById('settingsBtn');
const settingsBackdrop = document.getElementById('settingsBackdrop');
const settingsForm = document.getElementById('settingsForm');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');
const sApiKey = document.getElementById('s-apiKey');
const sBaseUrl = document.getElementById('s-baseUrl');
const sModel = document.getElementById('s-model');
const sQuality = document.getElementById('s-quality');
const sClearKey = document.getElementById('s-clearKey');
const apiKeyHint = document.getElementById('apiKeyHint');

const TOKEN_KEY = 'gallery_admin_token';
const EMPTY_COVER_HINT = coverPreview.innerHTML;
let token = localStorage.getItem(TOKEN_KEY) || '';
let tools = [];
let editingId = null;

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  el.setAttribute('role', 'status');
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('令牌无效，请重新登录');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.details?.join('；');
    throw new Error(detail ? `${body.error}：${detail}` : body.error || `HTTP ${res.status}`);
  }
  return body;
}

// ============================================================
// 裁剪器：拖拽平移 + 滑块缩放，固定 16:9，导出 1600×900 WebP
// ============================================================
const CROP_OUT_W = 1600;
const CROP_OUT_H = 900;

const cropper = {
  img: null,
  minScale: 1,
  scale: 1,
  ox: 0,
  oy: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,

  load(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.reset();
        resolve();
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  },

  stageSize() {
    return { w: cropperStage.clientWidth, h: cropperStage.clientHeight };
  },

  reset() {
    const { w, h } = this.stageSize();
    this.minScale = Math.max(w / this.img.naturalWidth, h / this.img.naturalHeight);
    cropZoom.value = '1';
    this.scale = this.minScale;
    this.ox = (w - this.img.naturalWidth * this.scale) / 2;
    this.oy = (h - this.img.naturalHeight * this.scale) / 2;
    this.draw();
  },

  clamp() {
    const { w, h } = this.stageSize();
    const iw = this.img.naturalWidth * this.scale;
    const ih = this.img.naturalHeight * this.scale;
    this.ox = Math.min(0, Math.max(w - iw, this.ox));
    this.oy = Math.min(0, Math.max(h - ih, this.oy));
  },

  draw() {
    const { w, h } = this.stageSize();
    const dpr = window.devicePixelRatio || 1;
    cropperCanvas.width = w * dpr;
    cropperCanvas.height = h * dpr;
    const ctx = cropperCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(
      this.img,
      this.ox,
      this.oy,
      this.img.naturalWidth * this.scale,
      this.img.naturalHeight * this.scale
    );
  },

  export() {
    const out = document.createElement('canvas');
    out.width = CROP_OUT_W;
    out.height = CROP_OUT_H;
    const { w } = this.stageSize();
    const factor = CROP_OUT_W / w;
    const ctx = out.getContext('2d');
    ctx.drawImage(
      this.img,
      this.ox * factor,
      this.oy * factor,
      this.img.naturalWidth * this.scale * factor,
      this.img.naturalHeight * this.scale * factor
    );
    return out.toDataURL('image/webp', 0.92);
  },
};

cropperStage.addEventListener('pointerdown', (e) => {
  cropper.dragging = true;
  cropper.lastX = e.clientX;
  cropper.lastY = e.clientY;
  cropperStage.setPointerCapture(e.pointerId);
});
cropperStage.addEventListener('pointermove', (e) => {
  if (!cropper.dragging) return;
  cropper.ox += e.clientX - cropper.lastX;
  cropper.oy += e.clientY - cropper.lastY;
  cropper.lastX = e.clientX;
  cropper.lastY = e.clientY;
  cropper.clamp();
  cropper.draw();
});
['pointerup', 'pointercancel'].forEach((ev) =>
  cropperStage.addEventListener(ev, () => (cropper.dragging = false))
);
cropZoom.addEventListener('input', () => {
  if (!cropper.img) return;
  const centerX = cropperStage.clientWidth / 2;
  const centerY = cropperStage.clientHeight / 2;
  const ratio = Number(cropZoom.value) * cropper.minScale / cropper.scale;
  cropper.ox = centerX - (centerX - cropper.ox) * ratio;
  cropper.oy = centerY - (centerY - cropper.oy) * ratio;
  cropper.scale = Number(cropZoom.value) * cropper.minScale;
  cropper.clamp();
  cropper.draw();
});
cropResetBtn.addEventListener('click', () => cropper.reset());

// ============================================================
// 封面编辑状态
// ============================================================
// cropperResolve: 裁剪弹窗的 Promise 回调；resolve({dataUrl}) 或 resolve(null) 表示跳过
let cropperResolve = null;

function openCropper(src) {
  return new Promise(async (resolve) => {
    cropperResolve = resolve;
    cropperBackdrop.classList.add('open');
    try {
      await cropper.load(src);
    } catch (err) {
      closeCropper(null);
      toast(err.message, true);
    }
  });
}

function closeCropper(result) {
  cropperBackdrop.classList.remove('open');
  const resolve = cropperResolve;
  cropperResolve = null;
  resolve?.(result);
}

cropCancelBtn.addEventListener('click', () => closeCropper(null));
cropConfirmBtn.addEventListener('click', () => closeCropper({ dataUrl: cropper.export() }));
cropperBackdrop.addEventListener('click', (e) => {
  if (e.target === cropperBackdrop) closeCropper(null);
});

function setCover(value) {
  coverInput.value = value || '';
  renderCoverPreview();
}

function renderCoverPreview(generating = false) {
  const value = coverInput.value.trim();
  coverPreview.classList.toggle('filled', Boolean(value));
  coverCropBtn.disabled = !value;
  coverRemoveBtn.disabled = !value;
  const overlay = generating
    ? `<div class="cover-generating"><div class="spinner"></div><span>AI 正在绘制封面，通常需要 20~60 秒…</span></div>`
    : '';
  coverPreview.innerHTML = value
    ? `<img src="${escapeHtml(value)}" alt="封面预览" onerror="this.remove()" />${overlay}`
    : generating
      ? `<div class="cover-placeholder">…</div>${overlay}`
      : EMPTY_COVER_HINT;
}

// 上传裁剪后的图片（或原图）到对象存储，返回站内路径
async function uploadCoverDataUrl(dataUrl) {
  const { cover } = await api('/api/covers', {
    method: 'POST',
    body: JSON.stringify({ image: dataUrl }),
  });
  return cover;
}

// 把任意封面来源转成可裁剪的本地 src（外链走服务端代理绕开 CORS）
async function coverSourceForCropping(value) {
  if (value.startsWith('/covers/')) return value;
  const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `图片代理失败：HTTP ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

coverUploadBtn.addEventListener('click', () => coverFileInput.click());
coverFileInput.addEventListener('change', async () => {
  const file = coverFileInput.files[0];
  coverFileInput.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return toast('请选择图片文件', true);
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const cropped = await openCropper(dataUrl);
  try {
    const cover = await uploadCoverDataUrl(cropped?.dataUrl ?? dataUrl);
    setCover(cover);
    toast(cropped ? '封面已裁剪并上传' : '封面已上传');
  } catch (err) {
    toast(err.message, true);
  }
});

coverCropBtn.addEventListener('click', async () => {
  const value = coverInput.value.trim();
  if (!value) return;
  try {
    const src = await coverSourceForCropping(value);
    const cropped = await openCropper(src);
    if (src.startsWith('blob:')) URL.revokeObjectURL(src);
    if (!cropped) return;
    const cover = await uploadCoverDataUrl(cropped.dataUrl);
    setCover(cover);
    toast('封面已更新');
  } catch (err) {
    toast(err.message, true);
  }
});

coverAiBtn.addEventListener('click', async () => {
  const f = toolForm.elements;
  const name = f.name.value.trim();
  const description = f.description.value.trim();
  if (!name || !description) {
    return toast('先填写程序名和简介，AI 才能据此生成封面', true);
  }
  coverAiBtn.disabled = true;
  renderCoverPreview(true);
  try {
    const { cover } = await api('/api/covers/generate', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        tags: f.tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        vibeCodingTool: f.vibeCodingTool.value.trim(),
        model: f.model.value.trim(),
      }),
    });
    setCover(cover);
    toast('AI 封面已生成，可点击「裁剪」微调');
  } catch (err) {
    toast(err.message, true);
  } finally {
    coverAiBtn.disabled = false;
    renderCoverPreview();
  }
});

coverRemoveBtn.addEventListener('click', () => setCover(''));
coverInput.addEventListener('input', () => renderCoverPreview());

// ============================================================
// 设置弹窗（AI 配置）
// ============================================================
function refreshAiFeature() {
  return api('/api/features')
    .then((f) => {
      coverAiBtn.title = f.aiCover ? '根据程序名与简介生成封面' : '未配置 OpenAI API Key，点右上角「设置」配置';
    })
    .catch(() => {});
}

async function openSettings() {
  settingsForm.reset();
  try {
    const s = await api('/api/settings');
    sBaseUrl.value = s.openaiBaseUrl ?? '';
    sModel.value = s.openaiImageModel ?? '';
    sQuality.value = s.openaiImageQuality ?? '';
    apiKeyHint.textContent = s.openaiApiKeySet
      ? `已保存密钥（${s.openaiApiKeyPreview}），输入新值可覆盖`
      : '未设置时使用环境变量 / Workers secret 中的 OPENAI_API_KEY';
  } catch (err) {
    toast(err.message, true);
    return;
  }
  settingsBackdrop.classList.add('open');
}

function closeSettings() {
  settingsBackdrop.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
settingsCancelBtn.addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', (e) => {
  if (e.target === settingsBackdrop) closeSettings();
});

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const patch = {};
  const key = sApiKey.value.trim();
  if (sClearKey.checked) patch.openaiApiKey = null;
  else if (key) patch.openaiApiKey = key;
  patch.openaiBaseUrl = sBaseUrl.value.trim() || null;
  patch.openaiImageModel = sModel.value.trim() || null;
  patch.openaiImageQuality = sQuality.value || null;
  try {
    await api('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
    toast('设置已保存');
    closeSettings();
    refreshAiFeature();
  } catch (err) {
    toast(err.message, true);
  }
});

// ============================================================
// 列表 / 表单（原有逻辑）
// ============================================================
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  token = '';
  adminApp.classList.add('hidden');
  loginGate.classList.remove('hidden');
}

async function tryLogin(candidate) {
  token = candidate;
  await api('/api/auth/check', { method: 'POST' });
  localStorage.setItem(TOKEN_KEY, candidate);
  loginGate.classList.add('hidden');
  adminApp.classList.remove('hidden');
  await refresh();
  refreshAiFeature();
}

async function refresh() {
  const data = await api('/api/tools');
  tools = data.tools;
  render();
}

function render() {
  const q = adminSearch.value.trim().toLowerCase();
  const filtered = q
    ? tools.filter((t) =>
        [t.name, t.description, t.vibeCodingTool, t.model, ...(t.tags ?? [])]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(q))
      )
    : tools;

  if (!filtered.length) {
    adminList.innerHTML = `<div class="state-box"><p>${tools.length ? '没有匹配的工具' : '还没有登记任何工具，点击右上角「登记新工具」开始'}</p></div>`;
    return;
  }

  adminList.innerHTML = filtered
    .map((t) => {
      const meta = [
        t.version ? `v${escapeHtml(t.version.replace(/^v/, ''))}` : null,
        t.versionUpdatedAt ? `更新于 ${escapeHtml(t.versionUpdatedAt)}` : null,
        t.vibeCodingTool ? escapeHtml(t.vibeCodingTool) : null,
        t.model ? escapeHtml(t.model) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      const coverCell = t.cover
        ? `<span class="row-cover"><img src="${escapeHtml(t.cover)}" alt="" loading="lazy" /></span>`
        : `<span class="row-cover">${escapeHtml(t.icon || '📦')}</span>`;
      return `<div class="admin-row" data-id="${escapeHtml(t.id)}">
        ${coverCell}
        <div class="row-main">
          <div class="row-name">${escapeHtml(t.name)} <span style="color:var(--text-faint);font-weight:400;font-size:12px">#${escapeHtml(t.id)}</span></div>
          <div class="row-sub">${meta || escapeHtml(t.description)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" data-action="edit">编辑</button>
          <button class="btn btn-sm btn-danger" data-action="delete">删除</button>
        </div>
      </div>`;
    })
    .join('');
}

function openModal(tool) {
  editingId = tool?.id ?? null;
  modalTitle.textContent = tool ? `编辑「${tool.name}」` : '登记新工具';
  const f = toolForm.elements;
  f.name.value = tool?.name ?? '';
  f.icon.value = tool?.icon ?? '';
  f.description.value = tool?.description ?? '';
  f.githubUrl.value = tool?.githubUrl ?? '';
  f.link.value = tool?.link ?? '';
  f.vibeCodingTool.value = tool?.vibeCodingTool ?? '';
  f.model.value = tool?.model ?? '';
  f.version.value = tool?.version ?? '';
  f.versionUpdatedAt.value = tool?.versionUpdatedAt ?? '';
  f.tags.value = (tool?.tags ?? []).join(', ');
  setCover(tool?.cover ?? '');
  modalBackdrop.classList.add('open');
  f.name.focus();
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  toolForm.reset();
  setCover('');
  editingId = null;
}

function formPayload() {
  const f = toolForm.elements;
  return {
    name: f.name.value.trim(),
    description: f.description.value.trim(),
    cover: f.cover.value.trim(),
    githubUrl: f.githubUrl.value.trim(),
    link: f.link.value.trim(),
    icon: f.icon.value.trim(),
    vibeCodingTool: f.vibeCodingTool.value.trim(),
    model: f.model.value.trim(),
    version: f.version.value.trim(),
    versionUpdatedAt: f.versionUpdatedAt.value,
    tags: f.tags.value
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

toolForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = formPayload();
  try {
    if (editingId) {
      // 更新：未填写的可选字段保持原值；被清空的字段通过 clearFields 删除
      const original = tools.find((t) => t.id === editingId);
      const body = { ...payload };
      const clears = [];
      for (const key of ['githubUrl', 'link', 'cover', 'icon', 'vibeCodingTool', 'model', 'version', 'versionUpdatedAt']) {
        if (original?.[key] && !payload[key]) clears.push(key);
      }
      if (original?.tags?.length && !payload.tags.length) clears.push('tags');
      await api(`/api/tools/${encodeURIComponent(editingId)}`, { method: 'PUT', body: JSON.stringify(body) });
      for (const field of clears) {
        await api(`/api/tools/${encodeURIComponent(editingId)}/field/${field}`, { method: 'DELETE' });
      }
      toast('已保存修改');
    } else {
      await api('/api/tools', { method: 'POST', body: JSON.stringify(payload) });
      toast('已登记新工具');
    }
    closeModal();
    await refresh();
  } catch (err) {
    toast(err.message, true);
  }
});

adminList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.closest('.admin-row').dataset.id;
  const tool = tools.find((t) => t.id === id);
  if (btn.dataset.action === 'edit') {
    openModal(tool);
  } else if (btn.dataset.action === 'delete') {
    if (!confirm(`确定要下架「${tool?.name ?? id}」吗？此操作不可恢复。`)) return;
    try {
      await api(`/api/tools/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('已下架');
      await refresh();
    } catch (err) {
      toast(err.message, true);
    }
  }
});

addBtn.addEventListener('click', () => openModal(null));
cancelBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (cropperBackdrop.classList.contains('open')) closeCropper(null);
  else if (settingsBackdrop.classList.contains('open')) closeSettings();
  else closeModal();
});
logoutBtn.addEventListener('click', logout);
adminSearch.addEventListener('input', render);

loginBtn.addEventListener('click', () => {
  tryLogin(tokenInput.value.trim()).catch((err) => toast(err.message, true));
});
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loginBtn.click();
});

// 启动：有缓存令牌则直接验证进入，否则显示登录门
if (token) {
  tryLogin(token).catch(() => logout());
} else {
  loginGate.classList.remove('hidden');
}
