// Briques d'interface : échappement, icônes, formatage, toasts, modales, tiroirs.

// ------------------------------------------------------------------ HTML
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function on(root, event, selector, handler) {
  root.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ----------------------------------------------------------------- Icônes
const P = {
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/>',
  arrows: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  in: '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
  out: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  adjust: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  up: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  down: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  euro: '<path d="M4 10h12M4 14h9"/><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  enter: '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  crown: '<path d="M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.29l4.27-3.66a.5.5 0 0 1 .82.5l-2.83 10.25a1 1 0 0 1-.96.75H5.8a1 1 0 0 1-.96-.75L2.02 6a.5.5 0 0 1 .82-.5l4.27 3.66a1 1 0 0 0 1.52-.3z"/><path d="M5 21h14"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  moonStar: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};

export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] ?? ''}</svg>`;

// --------------------------------------------------------------- Formatage
const nf = new Intl.NumberFormat('fr-FR');
const cf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const cf0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const ccf = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export const fmt = {
  n: (v) => nf.format(v ?? 0),
  eur: (v) => cf.format(v ?? 0),
  eur0: (v) => cf0.format(v ?? 0),
  eurc: (v) => (Math.abs(v) >= 10000 ? ccf.format(v) : cf0.format(v ?? 0)),
  pct: (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${String(v).replace('.', ',')} %`),
  date: (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (iso ? new Date(iso).toLocaleDateString('fr-FR', opts) : '—'),
  datetime: (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'),
  time: (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  ago(iso) {
    if (!iso) return 'jamais';
    const s = (new Date(iso) - Date.now()) / 1000;
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u);
    return 'à l’instant';
  },
  dayLabel(dateStr) {
    const d = new Date(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    if (diff === 0) return 'Aujourd’hui';
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  },
};

// ------------------------------------------------- Couleurs & identités
const GRADS = [['#8b5cf6', '#6366f1'], ['#6366f1', '#22d3ee'], ['#ec4899', '#8b5cf6'], ['#f59e0b', '#ef4444'], ['#10b981', '#06b6d4'], ['#3b82f6', '#8b5cf6'], ['#f43f5e', '#f97316'], ['#14b8a6', '#6366f1']];
const hash = (s) => [...String(s ?? '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const gradFor = (key) => { const [a, b] = GRADS[hash(key) % GRADS.length]; return `--c1:${a};--c2:${b}`; };
export const initials = (s) => String(s ?? '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const avatar = (name, cls = '') => `<span class="avatar ${cls}" style="${gradFor(name)}">${esc(initials(name))}</span>`;
export const tile = (p, cls = '') => `<span class="tile ${cls}" style="${gradFor(p.category || p.name)}">${esc(initials(p.name))}</span>`;

export const STATUS = {
  ok: { label: 'En stock', icon: 'checkCircle' },
  low: { label: 'Stock bas', icon: 'alert' },
  out: { label: 'Rupture', icon: 'xCircle' },
};
export const statusBadge = (s) => `<span class="badge ${s}">${icon(STATUS[s].icon)}${STATUS[s].label}</span>`;

export const MV = {
  in: { label: 'Entrée', plural: 'Entrées', icon: 'in', cls: 'in', badge: 'in' },
  out: { label: 'Sortie', plural: 'Sorties', icon: 'out', cls: 'out', badge: 'outm' },
  adjust: { label: 'Inventaire', plural: 'Inventaires', icon: 'adjust', cls: 'adjust', badge: 'adjust' },
};
export const signedQty = (m) => {
  const q = m.type === 'out' ? -m.quantity : m.quantity;
  return `${q > 0 ? '+' : q < 0 ? '−' : ''}${fmt.n(Math.abs(q))}`;
};

export const trendBadge = (t, { invert = false } = {}) => {
  if (t === null || t === undefined) return '<span class="trend flat">—</span>';
  const good = invert ? t < 0 : t > 0;
  const cls = t === 0 ? 'flat' : good ? 'up' : 'down';
  return `<span class="trend ${cls}">${icon(t >= 0 ? 'up' : 'down')}${esc(fmt.pct(t))}</span>`;
};

export const stockMeter = (p) => {
  const ratio = p.stock_min > 0 ? p.stock / (p.stock_min * 3) : p.stock > 0 ? 1 : 0;
  return `<div class="meter ${p.status}" style="--p:${Math.max(p.stock > 0 ? 4 : 0, Math.min(100, ratio * 100)).toFixed(0)}%"></div>`;
};

// Compteur animé
export function countUp(el, to, format = fmt.n, ms = 900) {
  const from = 0;
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms);
    const e = 1 - Math.pow(1 - k, 4);
    el.textContent = format(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export const skeleton = (h = 16, w = '100%', r = 8) => `<div class="skel" style="height:${h}px;width:${w};border-radius:${r}px"></div>`;
export const empty = (title, text = '', ico = 'package', action = '') =>
  `<div class="empty"><div class="ill">${icon(ico)}</div><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ''}${action}</div>`;

// ------------------------------------------------------------------ Toasts
export function toast(message, type = 'success', title = null) {
  const icons = { success: 'check', error: 'xCircle', warning: 'alert', info: 'info' };
  const titles = { success: 'C’est fait', error: 'Oups', warning: 'Attention', info: 'Info' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<div class="t-ico">${icon(icons[type])}</div><div class="grow"><b>${esc(title ?? titles[type])}</b><span>${esc(message)}</span></div>
    <button class="btn ghost icon sm" aria-label="Fermer">${icon('x')}</button>`;
  const close = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 250); };
  el.querySelector('button').onclick = close;
  document.getElementById('toasts').append(el);
  setTimeout(close, type === 'error' || type === 'warning' ? 6500 : 4000);
}

// --------------------------------------------------------------- Overlays
const stack = [];

function mountOverlay(className, html, { onClose, dismissable = true } = {}) {
  const root = document.getElementById('overlay-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const panel = document.createElement('div');
  panel.className = className;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.innerHTML = html;
  root.append(backdrop, panel);

  const previous = document.activeElement;
  let closed = false;
  const close = (result) => {
    if (closed) return;
    closed = true;
    stack.splice(stack.indexOf(entry), 1);
    backdrop.classList.add('closing');
    panel.classList.add('closing');
    setTimeout(() => { backdrop.remove(); panel.remove(); }, 220);
    previous?.focus?.();
    onClose?.(result);
  };
  const entry = { close, dismissable, panel };
  stack.push(entry);
  if (dismissable) backdrop.addEventListener('click', () => close());
  panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

  requestAnimationFrame(() => (panel.querySelector('[autofocus]') || panel.querySelector('input, select, textarea, button:not([data-close])'))?.focus());
  return { panel, close };
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if (top.dismissable) { e.preventDefault(); top.close(); }
  }
});

export const hasOverlay = () => stack.length > 0;
export const closeAllOverlays = () => [...stack].reverse().forEach((o) => o.close());

export function modal({ title, subtitle = '', body, foot = '', ico = null, icoCls = '', wide = false, onClose }) {
  return mountOverlay(`modal${wide ? ' wide' : ''}`, `
    <div class="modal-head">
      ${ico ? `<div class="modal-ico ${icoCls}">${icon(ico)}</div>` : ''}
      <div class="grow"><h2>${esc(title)}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      <button class="btn ghost icon sm" data-close aria-label="Fermer">${icon('x')}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${foot ? `<div class="modal-foot">${foot}</div>` : ''}`, { onClose });
}

export function drawer(html, opts = {}) {
  return mountOverlay('drawer', html, opts);
}

export function overlay(className, html, opts) {
  return mountOverlay(className, html, opts);
}

export function confirmDialog({ title, message, confirm = 'Confirmer', danger = true }) {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal({
      title, subtitle: esc(message), ico: danger ? 'alert' : 'info', icoCls: danger ? 'bad' : '',
      body: '',
      foot: `<button class="btn ghost" data-close>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok autofocus>${esc(confirm)}</button>`,
      onClose: () => resolve(ok),
    });
    m.panel.querySelector('.modal-body').remove();
    m.panel.querySelector('[data-ok]').onclick = () => { ok = true; m.close(); };
  });
}

// ------------------------------------------------------------- Formulaires
export function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else data[el.name] = el.value;
  }
  return data;
}

export function showErrors(form, details = {}) {
  $$('.field', form).forEach((f) => { f.classList.remove('invalid'); f.querySelector('.err')?.remove(); });
  let first = null;
  for (const [name, msg] of Object.entries(details)) {
    const input = form.querySelector(`[name="${name}"]`);
    const field = input?.closest('.field');
    if (!field) continue;
    field.classList.add('invalid');
    field.insertAdjacentHTML('beforeend', `<div class="err">${icon('alert')}${esc(msg)}</div>`);
    first ??= input;
  }
  first?.focus();
  return Boolean(first);
}

export async function withLoading(btn, fn) {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>${btn.dataset.loading ?? ''}`;
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}

/** Gestion d'erreur API standard dans un formulaire : 422 → champs, sinon toast. */
export function handleFormError(form, err) {
  if (err.status === 422 && showErrors(form, err.details)) return;
  toast(err.message, 'error');
}
