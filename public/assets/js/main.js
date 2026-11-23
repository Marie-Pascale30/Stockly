// Point d'entrée : routeur, coquille de l'application, palette de commandes, notifications.
import { get, post, put, session, setUnauthorizedHandler } from './api.js';
import { $, $$, esc, icon, fmt, avatar, tile, toast, overlay, hasOverlay, closeAllOverlays, debounce, statusBadge } from './ui.js';
import { destroyCharts } from './charts.js';
import { bus, openMovementModal, openProductForm, openProductDrawer } from './components.js';
import { renderLogin } from './pages/auth.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderProducts } from './pages/products.js';
import { renderMovements } from './pages/movements.js';
import { renderStats } from './pages/stats.js';
import { renderUsers } from './pages/users.js';
import { renderSettings } from './pages/settings.js';

const app = document.getElementById('app');

const ROUTES = {
  dashboard: { title: 'Tableau de bord', icon: 'dashboard', render: renderDashboard },
  products: { title: 'Produits', icon: 'package', render: renderProducts },
  movements: { title: 'Mouvements', icon: 'arrows', render: renderMovements },
  stats: { title: 'Statistiques', icon: 'chart', render: renderStats },
  users: { title: 'Équipe', icon: 'users', render: renderUsers, admin: true },
  settings: { title: 'Paramètres', icon: 'settings', render: renderSettings },
};

let cleanup = null;
let shellMounted = false;
let alertsCount = 0;

// ================================================================== Thème
const media = matchMedia('(prefers-color-scheme: dark)');
function resolvedTheme() {
  const t = session.settings.theme;
  return t === 'system' ? (media.matches ? 'dark' : 'light') : t;
}
function applyTheme() {
  const before = document.documentElement.dataset.theme;
  const after = resolvedTheme();
  document.documentElement.dataset.theme = after;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', after === 'dark' ? '#08080f' : '#f5f6fb');
  const btn = $('[data-theme-toggle]');
  if (btn) btn.innerHTML = icon(after === 'dark' ? 'sun' : 'moon');
  // Les graphiques lisent les couleurs CSS au rendu : on redessine la page.
  if (before && before !== after && shellMounted) route();
}
media.addEventListener('change', () => session.settings.theme === 'system' && applyTheme());

async function toggleTheme() {
  const theme = resolvedTheme() === 'dark' ? 'light' : 'dark';
  session.patch({ settings: { ...session.settings, theme } });
  applyTheme();
  try { await put('/me/settings', { theme }); } catch {}
}

// ================================================================ Routeur
function parseHash() {
  const [path, qs = ''] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: path || 'dashboard', query: Object.fromEntries(new URLSearchParams(qs)) };
}

function setQuery(name) {
  return (params) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
    history.replaceState(null, '', `#/${name}${qs ? `?${qs}` : ''}`);
  };
}

async function route() {
  const { name, query } = parseHash();

  if (!session.token) {
    shellMounted = false;
    cleanup?.(); cleanup = null;
    closeAllOverlays();
    if (name !== 'login' && name !== 'register') { location.hash = '#/login'; return; }
    renderLogin(app, { mode: name, onAuthenticated: () => { applyTheme(); location.hash = '#/dashboard'; } });
    document.title = `${name === 'login' ? 'Connexion' : 'Inscription'} · Stockly`;
    return;
  }

  if (name === 'login' || name === 'register' || !ROUTES[name]) { location.hash = '#/dashboard'; return; }
  const def = ROUTES[name];
  if (def.admin && !session.isAdmin) { toast('Cette page est réservée aux administrateurs.', 'warning'); location.hash = '#/dashboard'; return; }

  if (!shellMounted) mountShell();
  cleanup?.(); cleanup = null;
  destroyCharts();
  closeAllOverlays();

  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  $('.shell').classList.remove('nav-open');
  document.title = `${def.title} · Stockly`;

  const old = $('.content');
  const content = document.createElement('div');
  content.className = 'content';
  old.replaceWith(content);
  window.scrollTo({ top: 0 });

  try {
    const result = await def.render(content, { query, setQuery: setQuery(name), applyTheme, refreshShell });
    if (typeof result === 'function') cleanup = result;
  } catch (err) {
    console.error(err);
    toast(err.message || 'Erreur d’affichage.', 'error');
  }
}

// ================================================================ Coquille
function navLinks() {
  const item = (key) => {
    const r = ROUTES[key];
    const count = key === 'products' && alertsCount ? `<span class="count" title="Produits à surveiller">${alertsCount}</span>` : '';
    return `<a href="#/${key}" data-route="${key}">${icon(r.icon)}<span>${r.title}</span>${count}</a>`;
  };
  return `
    <div class="nav-label">Pilotage</div>
    <nav class="nav">${['dashboard', 'products', 'movements', 'stats'].map(item).join('')}</nav>
    <div class="nav-label">Compte</div>
    <nav class="nav">${session.isAdmin ? item('users') : ''}${item('settings')}</nav>`;
}

function mountShell() {
  shellMounted = true;
  const u = session.user;
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#/dashboard"><div class="brand-logo"></div><div class="brand-name">Stockly<small>Gestion de stock</small></div></a>
        <div data-nav>${navLinks()}</div>
        <div class="sidebar-foot">
          <div class="promo"><b>Astuce ✨</b><span>Appuyez sur <kbd>Ctrl</kbd> <kbd>K</kbd> pour tout trouver, <kbd>N</kbd> pour un nouveau mouvement.</span></div>
          <div class="user-card" data-user-card>${userCard(u)}</div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
          <button class="search-trigger" data-palette>${icon('search')}<span>Rechercher un produit, une page…</span><kbd>Ctrl K</kbd></button>
          <div class="spacer"></div>
          <div style="position:relative" data-bell-wrap>
            <button class="icon-btn" data-bell aria-label="Alertes de stock">${icon('bell')}</button>
          </div>
          <button class="icon-btn" data-theme-toggle aria-label="Changer de thème">${icon(resolvedTheme() === 'dark' ? 'sun' : 'moon')}</button>
          <button class="btn primary" data-quick-mv>${icon('plus')}<span>Mouvement</span></button>
        </header>
        <div class="content"></div>
      </div>
    </div>`;

  $('[data-menu]').onclick = () => $('.shell').classList.toggle('nav-open');
  $('.shell').addEventListener('click', (e) => {
    if ($('.shell').classList.contains('nav-open') && !e.target.closest('.sidebar') && !e.target.closest('[data-menu]')) $('.shell').classList.remove('nav-open');
  });
  $('[data-palette]').onclick = openPalette;
  $('[data-theme-toggle]').onclick = toggleTheme;
  $('[data-quick-mv]').onclick = () => openMovementModal();
  $('[data-bell]').onclick = toggleBell;
  app.addEventListener('click', (e) => { if (e.target.closest('[data-logout]')) logout(); });

  refreshAlerts();
}

const userCard = (u) => `${avatar(u.username)}<div class="who"><b>${esc(u.username)}</b><span>${u.role === 'admin' ? 'Administrateur' : 'Employé'}</span></div>
  <button class="btn ghost icon sm" data-logout title="Se déconnecter" aria-label="Se déconnecter">${icon('logout')}</button>`;

function refreshShell() {
  if (!shellMounted) return;
  $('[data-user-card]').innerHTML = userCard(session.user);
  const { name } = parseHash();
  $('[data-nav]').innerHTML = navLinks();
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
  refreshAlerts();
}

// ========================================================== Notifications
let alerts = [];
async function refreshAlerts() {
  if (!session.token) return;
  try {
    const res = await get('/notifications');
    alerts = res.data;
    alertsCount = res.meta?.enabled ? alerts.length : 0;
  } catch { return; }
  const bell = $('[data-bell]');
  if (!bell) return;
  bell.querySelector('.dot')?.remove();
  if (alertsCount) bell.insertAdjacentHTML('beforeend', `<span class="dot">${alertsCount > 9 ? '9+' : alertsCount}</span>`);
  const { name } = parseHash();
  $('[data-nav]').innerHTML = navLinks();
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
}
setInterval(refreshAlerts, 60_000);
bus.addEventListener('stock-changed', refreshAlerts);

function toggleBell() {
  const wrap = $('[data-bell-wrap]');
  const open = $('.menu', wrap);
  if (open) { open.remove(); return; }
  const enabled = session.settings.notifications;
  wrap.insertAdjacentHTML('beforeend', `<div class="menu" role="menu">
    <div class="menu-head"><b>Alertes de stock</b>${alerts.length && enabled ? `<span class="badge out">${alerts.length}</span>` : ''}</div>
    <div class="menu-body">${!enabled
      ? '<div class="empty" style="padding:24px"><span>Notifications désactivées dans vos préférences.</span><a href="#/settings?tab=preferences">Réactiver</a></div>'
      : alerts.length ? `<div class="list">${alerts.map((p) => `
        <div class="list-item clickable" data-product="${p.id}">${tile(p)}<div class="grow"><b>${esc(p.name)}</b><span>${fmt.n(p.stock)} en stock · seuil ${fmt.n(p.stock_min)}</span></div>${statusBadge(p.status)}</div>`).join('')}</div>`
      : `<div class="empty" style="padding:28px"><div class="ill">${icon('checkCircle')}</div><b>Tout va bien</b><span>Aucun produit sous son seuil.</span></div>`}
    </div></div>`);
  const menu = $('.menu', wrap);
  menu.addEventListener('click', (e) => {
    const p = e.target.closest('[data-product]');
    if (p) { menu.remove(); openProductDrawer(Number(p.dataset.product)); }
    if (e.target.closest('a')) menu.remove();
  });
  setTimeout(() => document.addEventListener('click', function off(e) {
    if (!wrap.contains(e.target)) { menu.remove(); document.removeEventListener('click', off); }
  }), 0);
}

// ====================================================== Palette ⌘K
function openPalette() {
  if (!session.token || hasOverlay()) return;
  const actions = [
    ...Object.entries(ROUTES).filter(([, r]) => !r.admin || session.isAdmin).map(([k, r]) => ({ group: 'Navigation', icon: r.icon, label: r.title, hint: 'Aller à la page', run: () => (location.hash = `#/${k}`) })),
    { group: 'Actions', icon: 'arrows', label: 'Nouveau mouvement', hint: 'Entrée, sortie ou inventaire', kbd: 'N', run: () => openMovementModal() },
    { group: 'Actions', icon: 'plus', label: 'Nouveau produit', hint: 'Ajouter au catalogue', run: () => openProductForm() },
    { group: 'Actions', icon: 'alert', label: 'Voir les produits à surveiller', hint: 'Stocks bas et ruptures', run: () => (location.hash = '#/products?status=alert') },
    { group: 'Actions', icon: resolvedTheme() === 'dark' ? 'sun' : 'moon', label: resolvedTheme() === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre', hint: 'Apparence', run: toggleTheme },
    { group: 'Actions', icon: 'logout', label: 'Se déconnecter', hint: 'Fermer la session', run: logout },
  ];

  const o = overlay('palette', `
    <div class="p-input">${icon('search')}<input placeholder="Tapez une commande ou un produit…" aria-label="Rechercher" autofocus><kbd>Échap</kbd></div>
    <div class="p-list" role="listbox"></div>
    <div class="p-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span></div>`);

  const input = $('input', o.panel);
  const list = $('.p-list', o.panel);
  let items = [];
  let products = [];
  let active = 0;

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const acts = actions.filter((a) => !q || a.label.toLowerCase().includes(q));
    items = [...products.map((p) => ({ group: 'Produits', product: p, run: () => openProductDrawer(p.id) })), ...acts];
    active = Math.min(active, Math.max(0, items.length - 1));
    let lastGroup = null;
    list.innerHTML = items.length ? items.map((it, i) => {
      const head = it.group !== lastGroup ? `<div class="p-group">${it.group}</div>` : '';
      lastGroup = it.group;
      const inner = it.product
        ? `${tile(it.product)}<div class="grow"><b>${esc(it.product.name)}</b><span class="mono">${esc(it.product.reference)} · ${fmt.n(it.product.stock)} en stock</span></div>${statusBadge(it.product.status)}`
        : `${icon(it.icon)}<div class="grow"><b>${esc(it.label)}</b><span>${esc(it.hint)}</span></div>${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}`;
      return `${head}<div class="p-item ${i === active ? 'active' : ''}" data-i="${i}" role="option">${inner}</div>`;
    }).join('') : '<div class="empty" style="padding:30px"><span>Aucun résultat</span></div>';
    $('.p-item.active', list)?.scrollIntoView({ block: 'nearest' });
  };

  const search = debounce(async (q) => {
    if (q.length < 2) { products = []; draw(); return; }
    try { products = (await get('/products', { q, per_page: 6 })).data; } catch { products = []; }
    draw();
  }, 180);

  const runAt = (i) => { const it = items[i]; if (!it) return; o.close(); setTimeout(it.run, 50); };

  input.addEventListener('input', () => { active = 0; draw(); search(input.value.trim()); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); runAt(active); }
  });
  list.addEventListener('click', (e) => { const el = e.target.closest('[data-i]'); if (el) runAt(Number(el.dataset.i)); });
  list.addEventListener('mousemove', (e) => {
    const el = e.target.closest('[data-i]');
    if (el && Number(el.dataset.i) !== active) { active = Number(el.dataset.i); $$('.p-item', list).forEach((x) => x.classList.toggle('active', x === el)); }
  });
  draw();
}

// ====================================================== Raccourcis clavier
document.addEventListener('keydown', (e) => {
  if (!session.token || !shellMounted) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (typing || hasOverlay() || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); openPalette(); }
  if (e.key.toLowerCase() === 'n') { e.preventDefault(); openMovementModal(); }
});

// ================================================================ Session
async function logout() {
  try { await post('/auth/logout'); } catch {}
  session.clear();
  toast('À bientôt !', 'info', 'Déconnecté');
  location.hash = '#/login';
}

setUnauthorizedHandler(() => {
  if (!session.token) return;
  session.clear();
  closeAllOverlays();
  toast('Votre session a expiré. Merci de vous reconnecter.', 'warning', 'Session expirée');
  if (location.hash === '#/login') route(); else location.hash = '#/login';
});

// ================================================================== Boot
window.addEventListener('hashchange', route);

(async function boot() {
  applyTheme();
  if (session.token) {
    try {
      const me = (await get('/auth/me')).data; // valide le jeton et rafraîchit le profil
      session.patch(me);
      applyTheme();
    } catch (err) {
      if (err.status !== 401) toast(err.message, 'error');
    }
  }
  route();
})();
