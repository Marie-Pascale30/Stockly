import { get, session } from '../api.js';
import { $, $$, esc, icon, fmt, tile, statusBadge, trendBadge, countUp, skeleton, empty, stockMeter, toast } from '../ui.js';
import { flowChart, donutChart, sparkline, prepareCategories, series } from '../charts.js';
import { openMovementModal, openProductDrawer, movementRow } from '../components.js';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
}

export async function renderDashboard(root) {
  const charts = session.settings.display_charts;
  const user = session.user;

  root.innerHTML = `
    <section class="hero">
      <div>
        <span class="eyebrow">${esc(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
        <h1>${greeting()}, <span class="grad-text">${esc(user.username)}</span> <span class="wave">👋</span></h1>
        <p data-summary>Voici l’état de votre stock en un coup d’œil.</p>
      </div>
      <div class="actions" style="display:flex;gap:10px">
        <a class="btn" href="#/stats">${icon('chart')}Statistiques</a>
        <button class="btn primary" data-new-mv>${icon('plus')}Nouveau mouvement</button>
      </div>
    </section>

    <section class="grid kpis" data-kpis>${Array(4).fill(`<div class="card kpi">${skeleton(34, '34px', 10)}<div style="height:14px"></div>${skeleton(30, '60%')}<div style="height:8px"></div>${skeleton(14, '40%')}</div>`).join('')}</section>

    <section class="grid two" style="margin-top:18px">
      <div class="card">
        <div class="card-head"><div><h3>Flux de stock</h3><p>Unités entrées et sorties sur 30 jours</p></div>
          <div class="legend"><span><i style="background:${series(0)}"></i>Entrées</span><span><i style="background:${series(1)}"></i>Sorties</span></div></div>
        <div class="card-body">${charts ? '<div class="chart-box"><canvas data-flow aria-label="Flux de stock sur 30 jours"></canvas></div>' : '<p class="muted">Graphiques désactivés dans vos préférences.</p>'}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Valeur par catégorie</h3><p>Stock valorisé au prix d’achat</p></div></div>
        <div class="card-body" data-cats>${skeleton(170)}</div>
      </div>
    </section>

    <section class="grid three" style="margin-top:18px">
      <div class="card">
        <div class="card-head"><div><h3>À réapprovisionner</h3><p>Produits sous le seuil d’alerte</p></div><a class="btn ghost sm" href="#/products?status=alert">Tout voir</a></div>
        <div class="card-body" data-alerts>${skeleton(200)}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Meilleures ventes</h3><p>CA estimé sur 30 jours</p></div></div>
        <div class="card-body" data-top>${skeleton(200)}</div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Activité récente</h3><p>Derniers mouvements</p></div><a class="btn ghost sm" href="#/movements">Historique</a></div>
        <div class="compact" data-recent style="padding:6px 0 10px">${skeleton(200)}</div>
      </div>
    </section>`;

  $('[data-new-mv]', root).onclick = () => openMovementModal();

  let d;
  try {
    d = (await get('/dashboard')).data;
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  if (!root.isConnected) return;

  const k = d.kpis;
  const alerts = k.low_stock + k.out_of_stock;
  $('[data-summary]', root).innerHTML = alerts
    ? `<b style="color:var(--warn)">${alerts} produit${alerts > 1 ? 's' : ''}</b> demande${alerts > 1 ? 'nt' : ''} votre attention aujourd’hui.`
    : 'Tout est au vert : aucun produit sous son seuil d’alerte. ✨';

  const pts = d.series.points;
  $('[data-kpis]', root).innerHTML = `
    <div class="card kpi"><div class="top"><span class="ico">${icon('wallet')}</span>Valeur du stock</div>
      <div class="value" data-count="${k.stock_value}" data-fmt="eur0">0</div>
      <div class="foot">${fmt.n(k.units)} unités · marge latente ${fmt.eurc(k.potential_margin)}</div></div>
    <div class="card kpi"><div class="top"><span class="ico good">${icon('euro')}</span>CA estimé · 30 j</div>
      <div class="value" data-count="${k.revenue_30d.value}" data-fmt="eur0">0</div>
      <div class="foot">${trendBadge(k.revenue_30d.trend)} vs 30 j précédents</div>
      ${charts ? '<canvas class="spark" data-spark="revenue" width="96" height="34"></canvas>' : ''}</div>
    <div class="card kpi"><div class="top"><span class="ico">${icon('activity')}</span>Mouvements · 7 j</div>
      <div class="value" data-count="${k.movements_7d.value}">0</div>
      <div class="foot">${trendBadge(k.movements_7d.trend)} vs semaine précédente</div>
      ${charts ? '<canvas class="spark" data-spark="moves" width="96" height="34"></canvas>' : ''}</div>
    <a class="card kpi" href="#/products?status=alert" style="color:inherit"><div class="top"><span class="ico ${k.out_of_stock ? 'bad' : k.low_stock ? 'warn' : 'good'}">${icon(alerts ? 'alert' : 'checkCircle')}</span>Alertes stock</div>
      <div class="value" data-count="${alerts}">0</div>
      <div class="foot"><span class="badge out">${icon('xCircle')}${k.out_of_stock} rupture${k.out_of_stock > 1 ? 's' : ''}</span><span class="badge low">${icon('alert')}${k.low_stock} bas</span></div></a>`;

  $$('[data-count]', root).forEach((el) => countUp(el, Number(el.dataset.count), el.dataset.fmt ? fmt[el.dataset.fmt] : (v) => fmt.n(Math.round(v))));

  if (charts) {
    flowChart($('[data-flow]', root), d.series);
    sparkline($('[data-spark="revenue"]', root), pts.slice(-14).map((p) => p.revenue), series(2));
    sparkline($('[data-spark="moves"]', root), pts.slice(-14).map((p) => p.in + p.out), series(0));
  }

  // Catégories
  const cats = prepareCategories(d.categories, 'value');
  const total = cats.reduce((s, c) => s + c.value, 0);
  $('[data-cats]', root).innerHTML = cats.length ? `
    <div class="donut-wrap">
      <div class="chart-box"><canvas data-donut aria-label="Répartition de la valeur du stock par catégorie"></canvas>
        <div class="donut-center"><b>${fmt.eurc(total)}</b><span>${cats.length} catégories</span></div></div>
      <div class="cat-legend">${cats.map((c) => `<div><i style="background:${c.color}"></i><span>${esc(c.label)}</span><b>${total ? Math.round((c.value / total) * 100) : 0} %</b></div>`).join('')}</div>
    </div>` : empty('Aucune donnée', '', 'chart');
  if (cats.length) donutChart($('[data-donut]', root), cats);

  // Alertes
  $('[data-alerts]', root).innerHTML = d.alerts.length ? `<div class="list">${d.alerts.slice(0, 6).map((p) => `
    <div class="list-item clickable" data-product="${p.id}">${tile(p)}
      <div class="grow"><b>${esc(p.name)}</b><div style="display:flex;align-items:center;gap:8px;margin-top:5px">${stockMeter(p)}<span class="num" style="font-size:12px;white-space:nowrap">${p.stock} / ${p.stock_min}</span></div></div>
      <button class="btn sm" data-restock="${p.id}" title="Réassort conseillé : ${p.suggested}">${icon('truck')}+${p.suggested}</button>
    </div>`).join('')}</div>` : empty('Rien à signaler', 'Tous les stocks sont au-dessus du seuil.', 'checkCircle');

  // Top
  const maxRev = Math.max(1, ...d.top.map((t) => t.revenue));
  $('[data-top]', root).innerHTML = d.top.length ? `<div class="bars">${d.top.map((t, i) => `
    <div class="bar-row clickable" data-product="${t.id}" style="cursor:pointer">
      <div class="line"><span><b style="color:var(--muted);margin-right:6px">${i + 1}</b>${esc(t.name)}</span><b class="num">${fmt.eur0(t.revenue)}</b></div>
      <div class="track"><i style="width:${(t.revenue / maxRev) * 100}%"></i></div>
      <span class="muted" style="font-size:12px">${fmt.n(t.qty)} vendus · marge ${fmt.eur0(t.margin)}</span>
    </div>`).join('')}</div>` : empty('Pas encore de ventes', 'Les sorties des 30 derniers jours apparaîtront ici.', 'euro');

  // Récents
  $('[data-recent]', root).innerHTML = d.recent.length ? d.recent.map(movementRow).join('') : empty('Aucun mouvement', '', 'arrows');

  root.addEventListener('click', (e) => {
    const r = e.target.closest('[data-restock]');
    if (r) {
      e.stopPropagation();
      const p = d.alerts.find((a) => a.id === Number(r.dataset.restock));
      openMovementModal({ product: p, type: 'in', quantity: p.suggested });
      return;
    }
    const p = e.target.closest('[data-product]');
    if (p) openProductDrawer(Number(p.dataset.product));
  });
}
