import { get } from '../api.js';
import { $, esc, icon, fmt, MV, skeleton, empty, toast, debounce } from '../ui.js';
import { openMovementModal, openProductDrawer, movementRow, bus } from '../components.js';
import { pager } from './shared.js';

export async function renderMovements(root, { query, setQuery }) {
  const state = { q: query.q ?? '', type: query.type ?? '', from: query.from ?? '', to: query.to ?? '', page: Number(query.page ?? 1) };

  root.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Traçabilité</span><h1>Mouvements</h1><p data-count>Chargement…</p></div>
      <div class="actions"><button class="btn primary" data-new>${icon('plus')}Nouveau mouvement</button></div>
    </div>
    <div class="card">
      <div class="toolbar">
        <div class="input-icon grow">${icon('search')}<input class="input" type="search" data-search placeholder="Produit, référence, note, utilisateur…" value="${esc(state.q)}"></div>
        <div class="seg" data-type>
          ${[['', 'Tous'], ['in', MV.in.plural], ['out', MV.out.plural], ['adjust', MV.adjust.plural]].map(([v, l]) => `<button data-v="${v}" class="${state.type === v ? 'active' : ''}">${v ? icon(MV[v].icon) : ''}${l}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="input" type="date" data-from value="${esc(state.from)}" aria-label="Du" style="width:auto">
          <span class="muted">→</span>
          <input class="input" type="date" data-to value="${esc(state.to)}" aria-label="Au" style="width:auto">
        </div>
      </div>
      <div data-list></div>
      <div data-pager></div>
    </div>`;

  const list = $('[data-list]', root);

  const load = async () => {
    setQuery({ q: state.q, type: state.type, from: state.from, to: state.to, page: state.page > 1 ? state.page : '' });
    list.innerHTML = `<div style="padding:18px 22px;display:grid;gap:14px">${Array(7).fill(skeleton(40)).join('')}</div>`;
    try {
      const res = await get('/movements', { q: state.q, type: state.type, from: state.from, to: state.to, page: state.page });
      if (!root.isConnected) return;
      const m = res.meta;
      $('[data-count]', root).textContent = `${fmt.n(m.total)} mouvement${m.total > 1 ? 's' : ''} enregistré${m.total > 1 ? 's' : ''}`;

      if (!res.data.length) {
        list.innerHTML = empty('Aucun mouvement', 'Aucun mouvement ne correspond à ces critères.', 'arrows');
      } else {
        const groups = new Map();
        res.data.forEach((mv) => {
          const day = mv.movement_date.slice(0, 10);
          if (!groups.has(day)) groups.set(day, []);
          groups.get(day).push(mv);
        });
        list.innerHTML = [...groups].map(([day, items]) => {
          const inU = items.filter((i) => i.type === 'in').reduce((s, i) => s + i.quantity, 0);
          const outU = items.filter((i) => i.type === 'out').reduce((s, i) => s + i.quantity, 0);
          return `<div class="day-group"><h4><span>${esc(fmt.dayLabel(day + 'T12:00:00'))}</span>
            <span style="text-transform:none;letter-spacing:0">${inU ? `<span class="qty in" style="font-size:12px">+${fmt.n(inU)}</span>` : ''} ${outU ? `<span class="qty out" style="font-size:12px;margin-left:8px">−${fmt.n(outU)}</span>` : ''}</span></h4>
            ${items.map(movementRow).join('')}</div>`;
        }).join('');
      }
      $('[data-pager]', root).innerHTML = pager(m);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  $('[data-search]', root).addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.page = 1; load(); }, 280));
  $('[data-type]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    state.type = b.dataset.v; state.page = 1;
    root.querySelectorAll('[data-type] button').forEach((x) => x.classList.toggle('active', x === b));
    load();
  });
  $('[data-from]', root).addEventListener('change', (e) => { state.from = e.target.value; state.page = 1; load(); });
  $('[data-to]', root).addEventListener('change', (e) => { state.to = e.target.value; state.page = 1; load(); });
  $('[data-pager]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]'); if (!b) return;
    state.page = Number(b.dataset.page); load();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  list.addEventListener('click', (e) => {
    const r = e.target.closest('[data-product]');
    if (r) openProductDrawer(Number(r.dataset.product));
  });
  $('[data-new]', root).onclick = () => openMovementModal();

  bus.addEventListener('stock-changed', load);
  await load();
  return () => bus.removeEventListener('stock-changed', load);
}
