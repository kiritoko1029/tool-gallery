const gallery = document.getElementById('gallery');
const tagFilter = document.getElementById('tagFilter');
const searchInput = document.getElementById('searchInput');
const footCount = document.getElementById('footCount');
const collectionCount = document.getElementById('collectionCount');
const resultStatus = document.getElementById('resultStatus');
const moreTags = document.getElementById('moreTags');
const sortSelect = document.getElementById('sortSelect');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

let tools = [];
let activeTag = null;
let query = '';
let tagsExpanded = false;

const ICONS = {
  github: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.1 11.1 0 0 1 2.89-.39c.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
  external: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5m-9 5v9"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
};

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : '';
  } catch {
    return '';
  }
}

function coverHue(id) {
  return [...id].reduce((hash, char) => (hash * 31 + char.codePointAt(0)) % 360, 0);
}

function renderCard(tool, index) {
  const githubUrl = safeUrl(tool.githubUrl);
  const link = safeUrl(tool.link);
  const cover = safeUrl(tool.cover);
  const tags = (tool.tags ?? []).map((tag) => `<span class="card-tag">${escapeHtml(tag)}</span>`).join('');
  const build = [tool.vibeCodingTool, tool.model].filter(Boolean).map(escapeHtml).join(' · ');
  const date = tool.versionUpdatedAt || tool.createdAt?.slice(0, 10);
  const dateLabel = tool.versionUpdatedAt ? '版本更新' : '收录于';
  const symbol = tool.icon
    ? escapeHtml(tool.icon)
    : `<span class="cover-initial">${escapeHtml([...tool.name].slice(0, 2).join('').toUpperCase())}</span>`;

  return `<article class="tool-card" style="--entry-delay:${Math.min(index * 45, 270)}ms;--cover-hue:${coverHue(tool.id || tool.name)}">
    <div class="card-cover">
      <div class="cover-art" aria-hidden="true"><span class="cover-symbol">${symbol}</span></div>
      ${cover ? `<img src="${cover}" alt="${escapeHtml(tool.name)} 封面" loading="lazy" decoding="async" />` : ''}
    </div>
    <div class="card-body">
      <div class="card-top">
        <h3 class="card-name">${escapeHtml(tool.name)}</h3>
        ${tool.version ? `<span class="version-badge">v${escapeHtml(tool.version.replace(/^v/i, ''))}</span>` : ''}
      </div>
      <p class="card-desc" title="${escapeHtml(tool.description)}">${escapeHtml(tool.description)}</p>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${build ? `<div class="build-meta" aria-label="创作工具与模型">${ICONS.spark}<span>${build}</span></div>` : ''}
      <div class="card-bottom">
        <span class="card-date" title="${escapeHtml(`${dateLabel} ${date || '暂无日期'} · 收录于 ${tool.createdAt?.slice(0, 10) || '暂无日期'}`)}">${escapeHtml(date || '持续打磨中')}</span>
        <div class="card-links">
          ${githubUrl ? `<a class="card-link" href="${githubUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(tool.name)} 的 GitHub 仓库">${ICONS.github}源码</a>` : ''}
          ${link ? `<a class="card-link" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="访问 ${escapeHtml(tool.name)}">打开${ICONS.external}</a>` : ''}
        </div>
      </div>
    </div>
  </article>`;
}

function renderSkeletons() {
  gallery.setAttribute('aria-busy', 'true');
  gallery.innerHTML = Array.from({ length: 3 }, () => `<div class="skeleton-card" aria-hidden="true">
    <div class="skeleton skeleton-cover"></div><div class="skeleton skeleton-line w60"></div>
    <div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line w40"></div>
  </div>`).join('');
  resultStatus.textContent = '正在加载工具…';
}

function render() {
  const q = query.trim().toLowerCase();
  const filtered = tools.filter((tool) => {
    if (activeTag && !(tool.tags ?? []).includes(activeTag)) return false;
    return !q || [tool.name, tool.description, tool.vibeCodingTool, tool.model, ...(tool.tags ?? [])]
      .filter(Boolean).some((value) => value.toLowerCase().includes(q));
  });
  if (sortSelect.value === 'updated') {
    filtered.sort((a, b) => (b.versionUpdatedAt || b.updatedAt || b.createdAt || '').localeCompare(a.versionUpdatedAt || a.updatedAt || a.createdAt || ''));
  } else if (sortSelect.value === 'name') {
    filtered.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
  }

  if (!tools.length) {
    gallery.innerHTML = `<div class="state-box"><div class="big">${ICONS.empty}</div>
      <h3>第一件作品，正在路上。</h3><p>好想法值得被做出来，也值得被收藏。</p></div>`;
  } else if (!filtered.length) {
    gallery.innerHTML = `<div class="state-box"><div class="big">${ICONS.search}</div>
      <h3>暂时没有找到</h3><p>换个关键词，或者看看全部工具。</p><button class="btn" data-action="reset">清除筛选</button></div>`;
  } else {
    gallery.innerHTML = filtered.map(renderCard).join('');
    // Local covers may not be synced; keep the designed cover visible on failure.
    for (const img of gallery.querySelectorAll('.card-cover img')) {
      img.addEventListener('error', () => { img.hidden = true; }, { once: true });
      if (img.complete && !img.naturalWidth) img.hidden = true;
    }
  }
  gallery.setAttribute('aria-busy', 'false');
  collectionCount.textContent = String(filtered.length).padStart(2, '0');
  resultStatus.textContent = `共 ${tools.length} 件工具，当前显示 ${filtered.length} 件${activeTag ? `，标签：${activeTag}` : ''}。`;
  footCount.textContent = `${tools.length} 件作品 · 持续生长中`;
}

function renderTags() {
  const counts = new Map();
  for (const tool of tools) {
    for (const tag of new Set(tool.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  tagFilter.innerHTML = `<button class="tag-chip" data-tag="" type="button">全部工具 <span class="tag-count">${tools.length}</span></button>` + tags
    .map(([tag, count], index) => `<button class="tag-chip" type="button" data-tag="${escapeHtml(tag)}" data-overflow="${index >= 6}">${escapeHtml(tag)} <span class="tag-count">${count}</span></button>`).join('');
  moreTags.hidden = tags.length <= 6;
  updateTags();
}

function updateTags() {
  for (const chip of tagFilter.querySelectorAll('.tag-chip')) {
    const selected = (chip.dataset.tag || null) === activeTag;
    chip.classList.toggle('active', selected);
    chip.setAttribute('aria-pressed', String(selected));
    chip.hidden = !tagsExpanded && chip.dataset.overflow === 'true' && !selected;
  }
  moreTags.textContent = tagsExpanded ? '收起标签' : '更多标签';
  moreTags.setAttribute('aria-expanded', String(tagsExpanded));
}

tagFilter.addEventListener('click', (event) => {
  const chip = event.target.closest('.tag-chip');
  if (!chip) return;
  activeTag = chip.dataset.tag === activeTag ? null : chip.dataset.tag || null;
  updateTags();
  render();
});
moreTags.addEventListener('click', () => { tagsExpanded = !tagsExpanded; updateTags(); });
sortSelect.addEventListener('change', render);

let debounce;
searchInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { query = searchInput.value; render(); }, 140);
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    clearTimeout(debounce);
    searchInput.value = '';
    query = '';
    render();
  }
});
document.addEventListener('keydown', (event) => {
  const editing = event.target.closest('input, textarea, select, [contenteditable="true"]');
  if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    searchInput.focus();
  }
});
gallery.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'reset') {
    clearTimeout(debounce);
    activeTag = null;
    query = '';
    searchInput.value = '';
    updateTags();
    render();
    searchInput.focus();
  } else if (action === 'retry') {
    boot();
  }
});

// Only update on pointer movement; no idle animation loop or work on touch devices.
let pointerFrame = 0;
gallery.addEventListener('pointermove', (event) => {
  if (reducedMotion.matches || !finePointer.matches) return;
  const card = event.target.closest('.tool-card');
  if (!card) return;
  cancelAnimationFrame(pointerFrame);
  pointerFrame = requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
  });
});

async function boot() {
  renderSkeletons();
  try {
    const res = await fetch('/api/tools');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.tools)) throw new Error('Invalid tools response');
    tools = data.tools;
    renderTags();
    render();
  } catch {
    gallery.setAttribute('aria-busy', 'false');
    collectionCount.textContent = '—';
    gallery.innerHTML = `<div class="state-box"><div class="big">${ICONS.empty}</div>
      <h3>工具暂时没能加载</h3><p>请检查网络连接，再试一次。</p><button class="btn" data-action="retry">重新加载</button></div>`;
    resultStatus.textContent = '工具加载失败，请重试。';
  }
}

boot();
