import { get, session } from '../api.js';
import { $, $$, esc, icon, fmt, tile, statusBadge, trendBadge, countUp, skeleton, empty, toast, avatar } from '../ui.js';
import { flowChart, revenueChart, donutChart, prepareCategories, series, destroyCharts } from '../charts.js';
import { openProductDrawer, openMovementModal } from '../components.js';

const PERIODS = [[7, '7 jours'], [30, '30 jours'], [90, '90 jours'], [365, '12 mois']];

export async function renderStats(root, { query, setQuery }) {
  const charts = session.settings.display_charts;
  const state = { days: Number(query.days ?? 30), category: query.category ?? '' };
  let allCategories = [];

  root.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Analyse</span><h1>Statistiques</h1><p data-period>Performance de votre stock</p></div>
      <div class="actions">
        <select class="select" data-cat style="width:auto;min-width:190px" aria-label="Catégorie"><option value="">Toutes les catégories</option></select>
        <div class="seg" data-days>${PERIODS.map(([d, l]) => `<button data-v="${d}" class="${state.days === d ? 'active' : ''}">${l}</button>`).join('')}</div>
      </div>
    </div>
    <div data-body></div>`;

  try {
    allCategories = (await get('/products/categories')).data.categories;
    $('[data-cat]', root).insertAdjacentHTML('beforeend', allCategories.map((c) => `<option ${c === state.category ? 'selected' : ''}>${esc(c)}</option>`).join(''));
  } catch {}

  const body = $('[data-body]', root);

  const load = async () => {
    setQuery({ days: state.days !== 30 ? state.days : '', category: state.category });
    destroyCharts();
    body.innerHTML = `<div class="grid kpis">${Array(4).fill(`<div class="card kpi">${skeleton(110)}</div>`).join('')}</div><div style="height:18px"></div><div class="card card-pad">${skeleton(300)}</div>`;

    let d;
    try {
      d = (await get('/stats', { days: state.days, category: state.category })).data;
    } catch (err) { toast(err.message, 'error'); return; }
    if (!root.isConnected) return;

    const s = d.summary;
    $('[data-period]', root).textContent = `Du ${fmt.date(d.period.from)} au ${fmt.date(d.period.to)}${state.category ? ` · ${state.category}` : ''} — comparé à la période précédente`;
    const per = d.series.granularity === 'week' ? 'semaine' : 'jour';

    body.innerHTML = `
      <section class="grid kpis">
        ${kpi('euro', 'good', 'Chiffre d’affaires estimé', s.revenue, 'eur0')}
        ${kpi('sparkles', '', 'Marge brute', s.gross_margin, 'eur0', s.margin_rate !== null ? `taux ${String(s.margin_rate).replace('.', ',')} %` : '')}
        ${kpi('out', 'warn', 'Unités sorties', s.out_units)}
        ${kpi('in', '', 'Unités entrées', s.in_units)}
      </section>

      ${charts ? `
      <section class="grid halves" style="margin-top:18px">
        <div class="card"><div class="card-head"><div><h3>Chiffre d’affaires estimé</h3><p>Par ${per}, valorisé au prix de vente actuel</p></div></div>
          <div class="card-body"><div class="chart-box"><canvas data-rev aria-label="Chiffre d'affaires par ${per}"></canvas></div></div></div>
        <div class="card"><div class="card-head"><div><h3>Flux de stock</h3><p>Unités par ${per}</p></div>
          <div class="legend"><span><i style="background:${series(0)}"></i>Entrées</span><span><i style="background:${series(1)}"></i>Sorties</span></div></div>
          <div class="card-body"><div class="chart-box"><canvas data-flow aria-label="Flux de stock"></canvas></div></div></div>
      </section>` : ''}

      <section class="grid two" style="margin-top:18px">
        <div class="card"><div class="card-head"><div><h3>Top produits</h3><p>Classés par chiffre d’affaires sur la période</p></div></div>
          <div class="table-wrap">${d.top.length ? `<table class="table"><thead><tr><th>#</th><th>Produit</th><th class="r">Vendus</th><th class="r">CA</th><th class="r hide-sm">Marge</th><th class="hide-sm">Stock</th></tr></thead><tbody>
            ${d.top.map((p, i) => `<tr class="clickable" data-product="${p.id}"><td class="muted num">${i + 1}</td>
              <td><div class="product-cell" style="min-width:180px">${tile(p)}<div><b>${esc(p.name)}</b><span class="mono">${esc(p.reference)}</span></div></div></td>
              <td class="r num">${fmt.n(p.qty)}</td><td class="r num"><b>${fmt.eur0(p.revenue)}</b></td><td class="r num hide-sm">${fmt.eur0(p.margin)}</td>
              <td class="hide-sm">${statusBadge(p.status)}</td></tr>`).join('')}</tbody></table>` : empty('Aucune vente', 'Pas de sortie sur cette période.', 'euro')}</div></div>
        <div class="card"><div class="card-head"><div><h3>Par catégorie</h3><p>Part du CA de la période</p></div></div>
          <div class="card-body" data-cats></div></div>
      </section>

      <section class="grid three" style="margin-top:18px">
        <div class="card"><div class="card-head"><div><h3>Ruptures & alertes</h3><p>Avec réassort conseillé</p></div></div>
          <div class="card-body">${d.critical.length ? `<div class="list">${d.critical.map((p) => `
            <div class="list-item clickable" data-product="${p.id}">${tile(p)}<div class="grow"><b>${esc(p.name)}</b><span>${fmt.n(p.stock)} / seuil ${fmt.n(p.stock_min)}</span></div>
            <button class="btn sm" data-restock="${p.id}">${icon('truck')}+${p.suggested}</button></div>`).join('')}</div>` : empty('Aucune alerte', 'Tout est au-dessus du seuil.', 'checkCircle')}</div></div>
        <div class="card"><div class="card-head"><div><h3>Stock dormant</h3><p>En stock, aucune sortie sur la période</p></div></div>
          <div class="card-body">${d.dormant.length ? `<div class="list">${d.dormant.map((p) => `
            <div class="list-item clickable" data-product="${p.id}">${tile(p)}<div class="grow"><b>${esc(p.name)}</b><span>${fmt.n(p.stock)} unités immobilisées</span></div>
            <b class="num">${fmt.eur0(p.stock_value)}</b></div>`).join('')}</div>` : empty('Aucun stock dormant', 'Chaque produit a tourné sur la période. 👏', 'zap')}</div></div>
        <div class="card"><div class="card-head"><div><h3>Équipe</h3><p>Mouvements saisis</p></div></div>
          <div class="card-body">${d.users.length ? `<div class="list">${d.users.map((u) => `
            <div class="list-item">${avatar(u.username)}<div class="grow"><b>${esc(u.username)}</b><span><span class="qty in" style="font-size:12px">+${fmt.n(u.in_units)}</span> · <span class="qty out" style="font-size:12px">−${fmt.n(u.out_units)}</span></span></div>
            <span class="badge">${fmt.n(u.movements)}</span></div>`).join('')}</div>` : empty('Aucune activité', '', 'users')}</div></div>
      </section>`;

    $$('[data-count]', body).forEach((el) => countUp(el, Number(el.dataset.count), el.dataset.fmt ? fmt[el.dataset.fmt] : (v) => fmt.n(Math.round(v))));

    if (charts) {
      revenueChart($('[data-rev]', body), d.series);
      flowChart($('[data-flow]', body), d.series);
    }

    const cats = prepareCategories(d.categories.filter((c) => c.revenue > 0), 'revenue', allCategories);
    const total = cats.reduce((a, c) => a + c.value, 0);
    $('[data-cats]', body).innerHTML = cats.length ? `
      ${charts ? `<div class="chart-box sm" style="margin-bottom:16px"><canvas data-donut aria-label="CA par catégorie"></canvas>
        <div class="donut-center"><b>${fmt.eurc(total)}</b><span>CA estimé</span></div></div>` : ''}
      <div class="cat-legend">${cats.map((c) => `<div><i style="background:${c.color}"></i><span>${esc(c.label)}</span><b>${fmt.eur0(c.value)} · ${Math.round((c.value / total) * 100)} %</b></div>`).join('')}</div>`
      : empty('Pas de ventes', '', 'chart');
    if (charts && cats.length) donutChart($('[data-donut]', body), cats);

    body.onclick = (e) => {
      const r = e.target.closest('[data-restock]');
      if (r) { e.stopPropagation(); const p = d.critical.find((x) => x.id === Number(r.dataset.restock)); openMovementModal({ product: p, type: 'in', quantity: p.suggested }); return; }
      const p = e.target.closest('[data-product]');
      if (p) openProductDrawer(Number(p.dataset.product));
    };
  };

  const kpi = (ico, tone, label, m, format = null, extra = '') => `
    <div class="card kpi"><div class="top"><span class="ico ${tone}">${icon(ico)}</span>${label}</div>
      <div class="value" data-count="${m.value}" ${format ? `data-fmt="${format}"` : ''}>0</div>
      <div class="foot">${trendBadge(m.trend)}<span>${extra || `vs ${format === 'eur0' ? fmt.eur0(m.previous) : fmt.n(m.previous)}`}</span></div></div>`;

  $('[data-days]', root).addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    state.days = Number(b.dataset.v);
    $$('[data-days] button', root).forEach((x) => x.classList.toggle('active', x === b));
    load();
  });
  $('[data-cat]', root).addEventListener('change', (e) => { state.category = e.target.value; load(); });

  await load();
}
