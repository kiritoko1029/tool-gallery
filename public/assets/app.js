const gallery = document.getElementById('gallery');
const tagFilter = document.getElementById('tagFilter');
const searchInput = document.getElementById('searchInput');
const footCount = document.getElementById('footCount');

let tools = [];
let activeTag = null;
let query = '';

const escapeHtml = (s = '') =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const abs = iso.slice(0, 10);
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

function renderCard(tool, index) {
  const icon = tool.icon || '📦';
  const version = tool.version
    ? `<span class="version-badge">v${escapeHtml(tool.version.replace(/^v/, ''))}</span>`
    : '<span class="version-badge no-version">未发布</span>';
  const tags = (tool.tags ?? [])
    .map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`)
    .join('');
  const links = [
    tool.githubUrl
      ? `<a class="card-link" href="${escapeHtml(tool.githubUrl)}" target="_blank" rel="noopener">⭐ GitHub</a>`
      : '',
    tool.link
      ? `<a class="card-link" href="${escapeHtml(tool.link)}" target="_blank" rel="noopener">🔗 访问</a>`
      : '',
  ].join('');

  return `<article class="tool-card" style="animation-delay:${Math.min(index * 45, 400)}ms">
    <div class="card-top">
      <div class="card-title-group">
        <span class="card-icon">${escapeHtml(icon)}</span>
        <span class="card-name">${escapeHtml(tool.name)}</span>
      </div>
      ${version}
    </div>
    <p class="card-desc">${escapeHtml(tool.description)}</p>
    <div class="card-meta">
      ${metaItem('Vibecoding 工具', tool.vibeCodingTool)}
      ${metaItem('模型', tool.model)}
      ${metaItem('版本更新', tool.versionUpdatedAt ? formatDate(tool.versionUpdatedAt) : '')}
      ${metaItem('收录时间', formatDate(tool.createdAt))}
    </div>
    ${tags ? `<div class="card-tags">${tags}</div>` : ''}
    ${links ? `<div class="card-links">${links}</div>` : ''}
  </article>`;
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
    gallery.innerHTML = `<div class="state-box" style="grid-column:1/-1">
      <div class="big">🏝️</div>
      <p>画廊还是空的，第一件作品正在路上。</p>
    </div>`;
  } else if (!filtered.length) {
    gallery.innerHTML = `<div class="state-box" style="grid-column:1/-1">
      <div class="big">🔎</div>
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
  try {
    const res = await fetch('/api/tools');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tools = (await res.json()).tools;
    renderTags();
    render();
  } catch (err) {
    gallery.innerHTML = `<div class="state-box" style="grid-column:1/-1">
      <div class="big">⚠️</div>
      <p>加载失败：${escapeHtml(err.message)}</p>
    </div>`;
  }
}

boot();
