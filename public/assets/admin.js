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

const TOKEN_KEY = 'gallery_admin_token';
let token = localStorage.getItem(TOKEN_KEY) || '';
let tools = [];
let editingId = null;

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
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
    adminList.innerHTML = `<div class="state-box"><div class="big">🗂️</div><p>${tools.length ? '没有匹配的工具' : '还没有登记任何工具，点击右上角「登记新工具」开始'}</p></div>`;
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
      return `<div class="admin-row" data-id="${escapeHtml(t.id)}">
        <span class="row-icon">${escapeHtml(t.icon || '📦')}</span>
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
  modalBackdrop.classList.add('open');
  f.name.focus();
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  toolForm.reset();
  editingId = null;
}

function formPayload() {
  const f = toolForm.elements;
  const payload = {
    name: f.name.value.trim(),
    description: f.description.value.trim(),
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
  return payload;
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
      for (const key of ['githubUrl', 'link', 'icon', 'vibeCodingTool', 'model', 'version', 'versionUpdatedAt']) {
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
  if (e.key === 'Escape') closeModal();
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
