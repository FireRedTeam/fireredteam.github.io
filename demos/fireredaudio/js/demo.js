const DATA = JSON.parse(document.getElementById('demo-data').textContent);
const THRESH = DATA.long_question_threshold || 180;
const PROMPT_COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const promptStore = new Map();
let promptStoreSeq = 0;

function compactPrompt(q) {
  if (!q) return q;
  return String(q).trim();
}

function storePromptText(text) {
  const id = `prompt-${++promptStoreSeq}`;
  promptStore.set(id, String(text || ''));
  return id;
}

function readPromptFromBubble(bubble) {
  const id = bubble.getAttribute('data-prompt-id') || '';
  return promptStore.get(id) || '';
}

async function copyPromptText(text, btn) {
  const value = String(text || '');
  let copied = false;

  if (value && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch (_) {}
  }

  if (!copied && value) {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      ta.style.width = '2em';
      ta.style.height = '2em';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (_) {}
  }

  if (!copied) return;

  btn.classList.add('copied');
  btn.title = 'Copied';
  btn.setAttribute('aria-label', 'Copied');
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.title = 'Copy prompt';
    btn.setAttribute('aria-label', 'Copy prompt');
  }, 1600);
}

function wirePromptCopyButtons(container) {
  if (!container) return;
  container.querySelectorAll('.user-prompt-bubble').forEach(bubble => {
    const text = readPromptFromBubble(bubble);
    bubble.querySelectorAll('.prompt-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyPromptText(text, btn);
      });
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderMarkdown(md) {
  if (window.marked) {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(md || '');
  }
  return `<pre style="white-space:pre-wrap">${escapeHtml(md || '')}</pre>`;
}

function enhanceTables(container) {
  if (!container) return;
  container.querySelectorAll('.md-body table').forEach(tbl => {
    const wrap = document.createElement('div');
    wrap.className = 'table-scroll-wrap';
    tbl.parentNode.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
    const cols = tbl.querySelectorAll('tr:first-child th, tr:first-child td').length;
    if (cols > 6) tbl.classList.add('table-wide');
  });
}

function renderChatMessages(caseData, opts = {}) {
  const showMedia = opts.showAudio !== false;
  const videoOnly = opts.videoOnly === true;
  const audioUrl = opts.audioUrl || caseData.audio_url || '';
  const videoUrl = opts.videoUrl || caseData.video_url || '';
  const parts = [];

  const promptRaw = caseData.question || '';
  const promptId = storePromptText(promptRaw);
  parts.push(`<div class="chat-msg user">
    <div class="chat-avatar">U</div>
    <div class="chat-bubble user-prompt-bubble" data-prompt-id="${escapeHtml(promptId)}">
      <button type="button" class="prompt-copy-btn prompt-copy-top" title="Copy prompt" aria-label="Copy prompt">${PROMPT_COPY_ICON}</button>
      <div class="md-body user-prompt-md">${renderMarkdown(compactPrompt(promptRaw))}</div>
    </div>
  </div>`);

  if (showMedia && videoUrl) {
    const linkLabel = caseData.video_link_label || '小红书 · 原视频来源';
    if (isExternalPageLink(videoUrl) && !isDirectMediaUrl(videoUrl)) {
      parts.push(`<div class="chat-msg audio">
      <div class="chat-avatar" style="visibility:hidden">·</div>
      <div class="chat-bubble">
        <div class="showcase-media-link-row"><span class="showcase-media-hint">点击播放</span><a class="showcase-media-link" href="${escapeHtml(videoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)}</a></div>
      </div>
    </div>`);
    } else {
      parts.push(`<div class="chat-msg audio">
      <div class="chat-avatar" style="visibility:hidden">·</div>
      <div class="chat-bubble">
        <video class="chat-case-video" controls playsinline preload="metadata"><source src="${escapeHtml(videoUrl)}" type="video/mp4"/></video>
      </div>
    </div>`);
    }
  } else if (showMedia && audioUrl && !videoOnly) {
    parts.push(`<div class="chat-msg audio">
      <div class="chat-avatar" style="visibility:hidden">·</div>
      <div class="chat-bubble">
        <audio controls preload="metadata" class="chat-audio" src="${escapeHtml(audioUrl)}"></audio>
      </div>
    </div>`);
  }

  if (caseData.think_md) {
    parts.push(`<div class="chat-msg think">
      <div class="chat-avatar">F</div>
      <div class="chat-bubble">
        <div class="think-label">Thinking</div>
        <div class="md-body">${renderMarkdown(caseData.think_md)}</div>
      </div>
    </div>`);
  }

  parts.push(`<div class="chat-msg model">
    <div class="chat-avatar">F</div>
    <div class="chat-bubble"><div class="md-body">${renderMarkdown(caseData.output_md)}</div></div>
  </div>`);

  return parts.join('');
}

function isDirectMediaUrl(url) {
  return /\.(mp4|webm|m4a|wav|mp3|ogg)(\?|#|$)/i.test(String(url || ''));
}

function isExternalPageLink(url) {
  const u = String(url || '');
  return u.startsWith('http://') || u.startsWith('https://');
}

function renderPinnedMedia(url, label) {
  if (!url) return { html: '', isLinkRow: false };
  if (isExternalPageLink(url) && !isDirectMediaUrl(url)) {
    return {
      html: `<span class="showcase-media-hint">点击播放</span><a class="showcase-media-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || '小红书 · 原视频来源')}</a>`,
      isLinkRow: true,
    };
  }
  if (/\.(mp4|webm)(\?|#|$)/i.test(url)) {
    return {
      html: `<video class="showcase-video-in-dialog" controls playsinline preload="metadata"><source src="${escapeHtml(url)}" type="video/mp4"/></video>`,
      isLinkRow: false,
    };
  }
  if (/\.(m4a|wav|mp3|ogg)(\?|#|$)/i.test(url)) {
    return {
      html: `<audio controls preload="metadata" class="chat-media-audio" src="${escapeHtml(url)}"></audio>`,
      isLinkRow: false,
    };
  }
  return { html: '', isLinkRow: false };
}

function updateCaseMediaPin(el, caseData) {
  const url = caseData.video_url || caseData.audio_url || '';
  const { html, isLinkRow } = renderPinnedMedia(url, caseData.video_link_label || '小红书 · 原视频来源');
  if (!html) {
    el.style.display = 'none';
    el.innerHTML = '';
    el.classList.remove('showcase-media-link-row');
    return;
  }
  el.style.display = '';
  el.innerHTML = html;
  el.classList.toggle('showcase-media-link-row', isLinkRow);
}

function renderShowcaseMedia(showcase) {
  const url = showcase.video_url || '';
  const { html, isLinkRow } = renderPinnedMedia(url, showcase.video_link_label || 'Open source audio');
  if (!html) return '';
  const cls = isLinkRow ? 'chat-media-pin showcase-media-link-row' : 'chat-media-pin';
  return `<div class="${cls}">${html}</div>`;
}

function mountBlogShowcase(root, showcase) {
  const tabs = showcase.cases.map((c, i) =>
    `<button type="button" class="qa-tab${i === 0 ? ' active' : ''}" data-i="${i}">${escapeHtml(c.tab)}</button>`
  ).join('');

  const mediaHtml = renderShowcaseMedia(showcase);

  const headerNote = showcase.audio_description
    ? ` · ${escapeHtml(showcase.audio_description)}`
    : '';

  root.innerHTML = `<section class="section-card" id="${escapeHtml(showcase.id)}">
    <p class="part-label">Part 1</p>
    <h2 class="task-title">${escapeHtml(showcase.title)}</h2>
    <div class="blog-showcase">
      <div class="qa-tabs" role="tablist">${tabs}</div>
      <div class="chat-shell chat-shell-part1">
        <div class="chat-header"><span class="chat-header-dot"></span> FireRedAudio${headerNote}</div>
        <div class="chat-body">
          ${mediaHtml}
          <div class="chat-window" id="part1-chat"></div>
        </div>
      </div>
    </div>
  </section>`;

  const chatEl = root.querySelector('#part1-chat');
  const tabEls = [...root.querySelectorAll('.qa-tab')];

  function showCase(i) {
    const idx = Math.max(0, Math.min(i, showcase.cases.length - 1));
    tabEls.forEach((t, j) => t.classList.toggle('active', j === idx));
    chatEl.innerHTML = renderChatMessages(showcase.cases[idx], { showAudio: false });
    enhanceTables(chatEl);
    wirePromptCopyButtons(chatEl);
    chatEl.scrollTop = 0;
  }

  tabEls.forEach((t, i) => t.addEventListener('click', () => showCase(i)));
  showCase(0);
}

function mountBlogSection(root, section) {
  const tabs = section.cases.map((c, i) =>
    `<button type="button" class="qa-tab${i === 0 ? ' active' : ''}" data-i="${i}">${escapeHtml(c.title)}</button>`
  ).join('');

  const el = document.createElement('section');
  el.className = 'section-card';
  el.id = section.id;
  el.innerHTML = `<p class="part-label">Part 2</p>
    <h2 class="task-title">${escapeHtml(section.title)}</h2>
    <div class="qa-tabs" role="tablist">${tabs}</div>
    <div class="chat-shell chat-shell-part1">
      <div class="chat-header"><span class="chat-header-dot"></span> FireRedAudio</div>
      <div class="chat-body">
        <div class="chat-media-pin" data-section-media="${escapeHtml(section.id)}"></div>
        <div class="chat-window" data-section-chat="${escapeHtml(section.id)}"></div>
      </div>
    </div>`;
  root.appendChild(el);

  const chatEl = el.querySelector('[data-section-chat]');
  const mediaEl = el.querySelector('[data-section-media]');
  const tabEls = [...el.querySelectorAll('.qa-tab')];

  function showCase(i) {
    const idx = Math.max(0, Math.min(i, section.cases.length - 1));
    tabEls.forEach((t, j) => t.classList.toggle('active', j === idx));
    const caseData = section.cases[idx];
    updateCaseMediaPin(mediaEl, caseData);
    chatEl.innerHTML = renderChatMessages(caseData, { showAudio: false });
    enhanceTables(chatEl);
    wirePromptCopyButtons(chatEl);
    chatEl.scrollTop = 0;
  }

  tabEls.forEach((t, i) => t.addEventListener('click', () => showCase(i)));
  showCase(0);
}

function initCaseTabs(section) {
  const tabs = [...section.querySelectorAll('.case-tab')];
  const panels = [...section.querySelectorAll('.case-panel, .edit-panel')];
  if (!tabs.length) return;
  function setActive(i) {
    const idx = Math.max(0, Math.min(i, tabs.length - 1));
    tabs.forEach((t, j) => t.classList.toggle('active', j === idx));
    panels.forEach((p, j) => { p.classList.toggle('active', j === idx); p.hidden = j !== idx; });
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => setActive(i)));
  setActive(0);
}

function initContentsNav() {
  const links = [...document.querySelectorAll('.top-nav-link[href^="#"]')];
  if (!links.length) return;
  function setActiveLink(id) {
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href').slice(1) === id));
  }
  links.forEach(a => a.addEventListener('click', () => setActiveLink(a.getAttribute('href').slice(1))));
  const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if (!targets.length) return;
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible.length) setActiveLink(visible[0].target.id);
  }, { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.15, 0.4, 0.7] });
  targets.forEach(el => observer.observe(el));
  const hash = location.hash.slice(1);
  if (hash && targets.some(el => el.id === hash)) setActiveLink(hash);
  else if (links[0]) setActiveLink(links[0].getAttribute('href').slice(1));
}

let mediaModal = null;

function makeModalDraggable(overlay, handle) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    function onMove(ev) {
      const left = Math.max(0, Math.min(ev.clientX - dx, window.innerWidth - rect.width));
      const top = Math.max(0, Math.min(ev.clientY - dy, window.innerHeight - 48));
      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.right = 'auto';
    }
    function onUp() {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    }
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  });
}

function ensureMediaModal() {
  if (mediaModal) return mediaModal;
  const overlay = document.createElement('div');
  overlay.className = 'media-modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="media-modal" role="dialog" aria-modal="true" aria-label="音频原始来源">
      <div class="media-modal-header">
        <span class="media-modal-title"></span>
        <a class="media-modal-open" href="#" target="_blank" rel="noopener noreferrer">在新标签页打开</a>
        <button type="button" class="media-modal-close" aria-label="关闭">×</button>
      </div>
      <iframe class="media-modal-frame" title="音频原始来源" loading="lazy" referrerpolicy="no-referrer"></iframe>
      <div class="media-modal-note">部分站点不允许在页面内嵌展示；若内容空白，请点击右上角「在新标签页打开」。</div>
    </div>`;
  document.body.appendChild(overlay);
  makeModalDraggable(overlay, overlay.querySelector('.media-modal-header'));
  overlay.querySelector('.media-modal-close').addEventListener('click', closeMediaModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeMediaModal();
  });
  mediaModal = overlay;
  return overlay;
}

function openMediaModal(url, label) {
  const overlay = ensureMediaModal();
  overlay.querySelector('.media-modal-title').textContent = label || '音频原始来源';
  overlay.querySelector('.media-modal-open').href = url;
  overlay.querySelector('.media-modal-frame').src = url;
  overlay.style.left = '';
  overlay.style.top = '';
  overlay.style.right = '';
  overlay.hidden = false;
}

function closeMediaModal() {
  if (!mediaModal) return;
  mediaModal.hidden = true;
  mediaModal.querySelector('.media-modal-frame').src = 'about:blank';
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a.showcase-media-link');
  if (!link) return;
  const url = link.getAttribute('href') || '';
  if (!isExternalPageLink(url) || isDirectMediaUrl(url)) return;
  e.preventDefault();
  openMediaModal(url, link.textContent.trim());
});

function initIntroVideoSwitch() {
  const card = document.querySelector('.understanding-intro-video-card');
  if (!card) return;
  const video = card.querySelector('.understanding-intro-video');
  const source = video && video.querySelector('source');
  const zhUrl = card.dataset.videoZh || '';
  const enUrl = card.dataset.videoEn || '';
  if (!video || !source || !zhUrl || !enUrl) return;
  card.querySelectorAll('.intro-video-lang-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang || 'zh';
      const url = lang === 'en' ? enUrl : zhUrl;
      if (!url || source.getAttribute('src') === url) return;
      card.querySelectorAll('.intro-video-lang-tab').forEach(tab => {
        const active = tab === btn;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      const wasPlaying = !video.paused;
      source.src = url;
      video.load();
      if (wasPlaying) video.play().catch(() => {});
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initIntroVideoSwitch();
  const part1Root = document.getElementById('part1-root');
  mountBlogShowcase(part1Root, DATA.part1);
  const sectionsRoot = document.getElementById('sections-root');
  DATA.sections.forEach(sec => mountBlogSection(sectionsRoot, sec));
  const speechEditing = document.getElementById('speech-editing');
  if (speechEditing) initCaseTabs(speechEditing);
  initContentsNav();
});
