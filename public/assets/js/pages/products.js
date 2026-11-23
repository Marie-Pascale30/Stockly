import { get, api, session } from '../api.js';
import { $, esc, icon, fmt, tile, statusBadge, stockMeter, skeleton, empty, toast, debounce, withLoading } from '../ui.js';
import { openProductForm, openProductDrawer, openMovementModal, deleteProduct, bus } from '../components.js';
import { pager } from './shared.js';

const STATUSES = [['', 'Tous'], ['ok', 'En stock'], ['alert', 'À surveiller'], ['low', 'Stock bas'], ['out', 'Rupture']];
const COLS = [
  ['name', 'Produit'], ['category', 'Catégorie', 'hide-sm'], ['price', 'Prix de vente', 'r hide-sm'], ['value', 'Valeur stock', 'r hide-sm'], ['stock', 'Stock'],
];

export async function renderProducts(root, { query, setQuery }) {
  const state = { q: query.q ?? '', category: query.category ?? '', status: query.status ?? '', sort: query.sort ?? 'name', page: Number(query.page ?? 1) };
  let rows = [];

  root.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Catalogue</span><h1>Produits</h1><p data-count>Chargement…</p></div>
      <div class="actions">
        <button class="btn" data-export>${icon('download')}Exporter CSV</button>
        <button class="btn primary" data-new>${icon('plus')}Nouveau produit</button>
      </div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="input-icon grow">${icon('search')}<input class="input" data-search type="search" placeholder="Rechercher par nom, référence, fournisseur…" value="${esc(state.q)}"></div>
        <div class="seg" data-status>${STATUSES.map(([v, l]) => `<button data-v="${v}" class="${state.status === v ? 'active' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="chips" data-cats></div>
      <div class="table-wrap"><table class="table">
        <thead><tr>${COLS.map(([k, l, c = '']) => `<th class="sortable ${c}" data-sort="${k}">${l}<span class="arrow"></span></th>`).join('')}<th class="r"><span class="sr-only">Actions</span></th></tr></thead>
        <tbody data-rows></tbody>
      </table></div>
      <div data-pager></div>
    </div>`;

  const tbody = $('[data-rows]', root);

  const drawHead = () => {
    const key = state.sort.replace('-', '');
    const desc = state.sort.startsWith('-');
    root.querySelectorAll('[data-sort]').forEach((th) => {
      const on = th.dataset.sort === key;
      th.classList.toggle('sorted', on);
      th.querySelector('.arrow').textContent = on ? (desc ? '↓' : '↑') : '↕';
    });
  };

  const load = async () => {
    setQuery({ q: state.q, category: state.category, status: state.status, sort: state.sort !== 'name' ? state.sort : '', page: state.page > 1 ? state.page : '' });
    drawHead();
    tbody.innerHTML = Array(6).fill(`<tr><td colspan="6">${skeleton(38)}</td></tr>`).join('');
    try {
      const res = await get('/products', { q: state.q, category: state.category, status: state.status, sort: state.sort, page: state.page });
      if (!root.isConnected) return;
      rows = res.data;
      const m = res.meta;
      $('[data-count]', root).textContent = `${fmt.n(m.total)} produit${m.total > 1 ? 's' : ''}${state.q || state.category || state.status ? ' correspondant à vos filtres' : ' au catalogue'}`;
      tbody.innerHTML = rows.length ? rows.map(row).join('') : `<tr><td colspan="6">${empty(
        'Aucun produit trouvé',
        state.q || state.category || state.status ? 'Essayez d’élargir votre recherche.' : 'Commencez par ajouter votre premier produit.',
        'package',
        state.q || state.category || state.status ? '<button class="btn sm" data-reset>Réinitialiser les filtres</button>' : '',
      )}</td></tr>`;
      $('[data-pager]', root).innerHTML = pager(m);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const row = (p) => `
    <tr class="clickable" data-id="${p.id}">
      <td><div class="product-cell">${tile(p)}<div><b>${esc(p.name)}</b><span class="mono">${esc(p.reference)}</span></div></div></td>
      <td class="hide-sm">${p.category ? `<span class="badge">${esc(p.category)}</span>` : '<span class="muted">—</span>'}</td>
      <td class="r num hide-sm"><b>${fmt.eur(p.sale_price)}</b><div class="muted" style="font-size:12px">marge ${p.margin_rate === null ? '—' : String(p.margin_rate).replace('.', ',') + ' %'}</div></td>
      <td class="r num hide-sm">${fmt.eur0(p.stock_value)}</td>
      <td><div class="stock-cell"><div class="line"><b>${fmt.n(p.stock)}</b>${statusBadge(p.status)}</div>${stockMeter(p)}</div></td>
      <td class="r"><div class="row-actions">
        <button class="btn ghost icon sm" data-act="in" title="Entrée de stock" aria-label="Entrée">${icon('in')}</button>
        <button class="btn ghost icon sm" data-act="out" title="Sortie de stock" aria-label="Sortie" ${p.stock <= 0 ? 'disabled' : ''}>${icon('out')}</button>
        <button class="btn ghost icon sm" data-act="edit" title="Modifier" aria-label="Modifier">${icon('edit')}</button>
        ${session.isAdmin ? `<button class="btn ghost icon sm" data-act="delete" title="Archiver" aria-label="Archiver">${icon('trash')}</button>` : ''}
      </div></td>
    </tr>`;

  // Catégories
  get('/products/categories').then((res) => {
    if (!root.isConnected) return;
    const cats = res.data.categories;
    $('[data-cats]', root).innerHTML = ['', ...cats].map((c) => `<button class="chip ${state.category === c ? 'active' : ''}" data-cat="${esc(c)}">${c ? esc(c) : 'Toutes catégories'}</button>`).join('');
  }).catch(() => {});

  // Interactions
  $('[data-search]', root).addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }, 280));
  $('[data-status]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    state.status = b.dataset.v; state.page = 1;
    root.querySelectorAll('[data-status] button').forEach((x) => x.classList.toggle('active', x === b));
    load();
  });
  $('[data-cats]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    state.category = b.dataset.cat; state.page = 1;
    root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x === b));
    load();
  });
  root.querySelector('thead').addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]'); if (!th) return;
    const k = th.dataset.sort;
    const numeric = ['stock', 'price', 'value'].includes(k);
    state.sort = state.sort === k ? `-${k}` : state.sort === `-${k}` ? k : numeric ? `-${k}` : k;
    load();
  });
  $('[data-pager]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]'); if (!b) return;
    state.page = Number(b.dataset.page); load();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  tbody.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) {
      Object.assign(state, { q: '', category: '', status: '', page: 1 });
      $('[data-search]', root).value = '';
      root.querySelectorAll('[data-status] button').forEach((x) => x.classList.toggle('active', x.dataset.v === ''));
      root.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('active', x.dataset.cat === ''));
      load();
      return;
    }
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const p = rows.find((r) => r.id === Number(tr.dataset.id));
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'in' || act === 'out') openMovementModal({ product: p, type: act });
    else if (act === 'edit') openProductForm(p);
    else if (act === 'delete') deleteProduct(p);
    else openProductDrawer(p.id);
  });

  $('[data-new]', root).onclick = () => openProductForm();
  $('[data-export]', root).onclick = (e) => withLoading(e.currentTarget, async () => {
    try {
      const res = await api('/products/export', { query: { q: state.q, category: state.category, status: state.status, sort: state.sort }, raw: true });
      const blob = await res.blob();
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `stockly-produits-${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Export CSV téléchargé.');
    } catch (err) { toast(err.message, 'error'); }
  });

  bus.addEventListener('stock-changed', load);
  await load();
  if (query.open) openProductDrawer(Number(query.open));

  return () => bus.removeEventListener('stock-changed', load);
}
