const gallery = document.getElementById('gallery');
const tagFilter = document.getElementById('tagFilter');
const searchInput = document.getElementById('searchInput');
const footCount = document.getElementById('footCount');

let tools = [];
let activeTag = null;
let query = '';

const ICONS = {
  github:
    '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.1 11.1 0 0 1 2.89-.39c.98 0 1.97.13 2.89.39 2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>',
  external:
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  empty:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
  warn:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
};

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatDate(iso) {
  if (!iso) return '';
  // 按本地日历日比较，避免跨时区把昨天算成"今天"
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const abs = iso.slice(0, 10);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / 86400000);
  if (days <= 0) return `${abs} · 今天`;
  if (days === 1) return `${abs} · 昨天`;
  if (days < 30) return `${abs} · ${days} 天前`;
  if (days < 365) return `${abs} · ${Math.floor(days / 30)} 个月前`;
  return abs;
}

function metaItem(label, value) {
  return `<div class="meta-item">
    <div class="meta-label">${label}</div>
    <div class="meta-value${value ? '' : ' empty'}" title="${escapeHtml(value || '')}">${escapeHtml(value || '—')}</div>
  </div>`;
}

function versionBadge(tool, extraClass = '') {
  return tool.version
    ? `<span class="version-badge ${extraClass}">v${escapeHtml(tool.version.replace(/^v/, ''))}</span>`
    : `<span class="version-badge no-version ${extraClass}">未发布</span>`;
}

function renderCard(tool, index) {
  const icon = tool.icon || '';
  const tags = (tool.tags ?? [])
    .map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`)
    .join('');
  const links = [
    tool.githubUrl
      ? `<a class="card-link" href="${escapeHtml(tool.githubUrl)}" target="_blank" rel="noopener">${ICONS.github} GitHub</a>`
      : '',
    tool.link
      ? `<a class="card-link" href="${escapeHtml(tool.link)}" target="_blank" rel="noopener">${ICONS.external} 访问</a>`
      : '',
  ].join('');

  const cover = tool.cover
    ? `<div class="card-cover">
        <img src="${escapeHtml(tool.cover)}" alt="${escapeHtml(tool.name)} 封面" loading="lazy" decoding="async" />
        ${versionBadge(tool)}
        ${icon ? `<span class="cover-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : ''}
      </div>`
    : '';

  const header = tool.cover
    ? `<div class="card-top">
        <div class="card-title-group"><span class="card-name">${escapeHtml(tool.name)}</span></div>
      </div>`
    : `<div class="card-top">
        <div class="card-title-group">
          <span class="card-icon" aria-hidden="true">${escapeHtml(icon || '📦')}</span>
          <span class="card-name">${escapeHtml(tool.name)}</span>
        </div>
        ${versionBadge(tool)}
      </div>`;

  return `<article class="tool-card${tool.cover ? ' has-cover' : ''}" style="animation-delay:${Math.min(index * 45, 400)}ms">
    ${cover}
    <div class="card-body">
      ${header}
      <p class="card-desc">${escapeHtml(tool.description)}</p>
      <div class="card-meta">
        ${metaItem('Vibecoding 工具', tool.vibeCodingTool)}
        ${metaItem('模型', tool.model)}
        ${metaItem('版本更新', tool.versionUpdatedAt ? formatDate(tool.versionUpdatedAt) : '')}
        ${metaItem('收录时间', formatDate(tool.createdAt))}
      </div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${links ? `<div class="card-links">${links}</div>` : ''}
    </div>
  </article>`;
}

function renderSkeletons() {
  gallery.innerHTML = Array.from({ length: 3 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-cover"></div>
      <div class="skeleton skeleton-line w60"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line w40" style="margin-bottom:22px"></div>
    </div>`).join('');
}

function render() {
  const q = query.trim().toLowerCase();
  const filtered = tools.filter((t) => {
    if (activeTag && !(t.tags ?? []).includes(activeTag)) return false;
    if (!q) return true;
    return [t.name, t.description, t.vibeCodingTool, t.model, ...(t.tags ?? [])]
      .filter(Boolean)
      .some((s) => s.toLowerCase().includes(q));
  });

  if (!tools.length) {
    gallery.innerHTML = `<div class="state-box">
      <div class="big">${ICONS.empty}</div>
      <p>工具集还是空的，第一件作品正在路上。</p>
    </div>`;
  } else if (!filtered.length) {
    gallery.innerHTML = `<div class="state-box">
      <div class="big">${ICONS.search}</div>
      <p>没有匹配的工具，换个关键词试试。</p>
    </div>`;
  } else {
    gallery.innerHTML = filtered.map(renderCard).join('');
  }

  footCount.textContent = tools.length ? `共 ${tools.length} 件作品` : '';
}

function renderTags() {
  const counts = new Map();
  for (const t of tools) for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!tags.length) {
    tagFilter.innerHTML = '';
    return;
  }
  tagFilter.innerHTML = tags
    .map(
      ([tag, n]) =>
        `<button class="tag-chip${tag === activeTag ? ' active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} ${n}</button>`
    )
    .join('');
}

tagFilter.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  activeTag = chip.dataset.tag === activeTag ? null : chip.dataset.tag;
  renderTags();
  render();
});

let debounce;
searchInput.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    query = searchInput.value;
    render();
  }, 160);
});

async function boot() {
  renderSkeletons();
  try {
    const res = await fetch('/api/tools');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tools = (await res.json()).tools;
    renderTags();
    render();
  } catch (err) {
    gallery.innerHTML = `<div class="state-box">
      <div class="big">${ICONS.warn}</div>
      <p>加载失败：${escapeHtml(err.message)}，请稍后刷新重试。</p>
    </div>`;
  }
}

boot();
