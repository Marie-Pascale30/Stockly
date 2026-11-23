// Graphiques Chart.js harmonisés avec le design system (palette validée, ordre fixe).
import { fmt } from './ui.js';

const live = new Set();

export function destroyCharts() {
  live.forEach((c) => c.destroy());
  live.clear();
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const series = (i) => css(`--s${(i % 8) + 1}`);

function base() {
  return {
    text: css('--text'),
    text2: css('--text-2'),
    muted: css('--muted'),
    border: css('--border'),
    surface: css('--surface-solid'),
    warn: css('--warn'),
  };
}

function make(canvas, config) {
  if (!window.Chart || !canvas) return null;
  const chart = new window.Chart(canvas, config);
  live.add(chart);
  return chart;
}

function tooltip(t, extra = {}) {
  return {
    backgroundColor: t.surface,
    titleColor: t.text,
    bodyColor: t.text2,
    borderColor: t.border,
    borderWidth: 1,
    padding: 12,
    cornerRadius: 12,
    boxPadding: 5,
    usePointStyle: true,
    titleFont: { family: 'Inter', weight: '600', size: 12.5 },
    bodyFont: { family: 'Inter', size: 12.5 },
    ...extra,
  };
}

function axes(t, { yFormat = (v) => fmt.n(v), xTicks = 8 } = {}) {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: t.muted, font: { family: 'Inter', size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: xTicks },
    },
    y: {
      beginAtZero: true,
      grid: { color: t.border, drawTicks: false },
      border: { display: false },
      ticks: { color: t.muted, font: { family: 'Inter', size: 11 }, padding: 8, maxTicksLimit: 5, callback: yFormat },
    },
  };
}

const dayTick = (iso, granularity) => {
  const d = new Date(iso + 'T00:00:00');
  return granularity === 'week'
    ? 'sem. ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

function areaGradient(ctx, color) {
  const { chartArea } = ctx.chart;
  if (!chartArea) return 'transparent';
  const g = ctx.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, color + '38');
  g.addColorStop(1, color + '00');
  return g;
}

/** Flux entrées / sorties (2 séries, une seule échelle). */
export function flowChart(canvas, { points, granularity }) {
  const t = base();
  const cIn = series(0);
  const cOut = series(1);
  return make(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => p.date),
      datasets: [
        { label: 'Entrées', data: points.map((p) => p.in), borderColor: cIn, backgroundColor: (c) => areaGradient(c, cIn), fill: true },
        { label: 'Sorties', data: points.map((p) => p.out), borderColor: cOut, backgroundColor: (c) => areaGradient(c, cOut), fill: true },
      ].map((d) => ({ ...d, borderWidth: 2, tension: 0.35, pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: t.surface, pointHoverBackgroundColor: d.borderColor })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltip(t, {
          callbacks: {
            title: (items) => dayTick(items[0].label, granularity),
            label: (i) => ` ${i.dataset.label} : ${fmt.n(i.parsed.y)} unités`,
          },
        }),
      },
      scales: { ...axes(t), x: { ...axes(t).x, ticks: { ...axes(t).x.ticks, callback(v) { return dayTick(this.getLabelForValue(v), granularity); } } } },
    },
    plugins: [crosshair],
  });
}

/** Chiffre d'affaires estimé (une série → pas de légende). */
export function revenueChart(canvas, { points, granularity }) {
  const t = base();
  const c = series(0);
  return make(canvas, {
    type: 'bar',
    data: {
      labels: points.map((p) => p.date),
      datasets: [{ label: 'CA estimé', data: points.map((p) => p.revenue), backgroundColor: c, hoverBackgroundColor: c, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22, categoryPercentage: 0.8, barPercentage: 0.9 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltip(t, { callbacks: { title: (i) => dayTick(i[0].label, granularity), label: (i) => ` ${fmt.eur(i.parsed.y)}` } }),
      },
      scales: { ...axes(t, { yFormat: (v) => fmt.eurc(v) }), x: { ...axes(t).x, ticks: { ...axes(t).x.ticks, callback(v) { return dayTick(this.getLabelForValue(v), granularity); } } } },
    },
  });
}

/**
 * Répartition par catégorie (couleur liée à l'entité : l'index vient de la liste
 * complète des catégories, pas du rang affiché). Au-delà de 7 → « Autres » en gris.
 */
export function prepareCategories(cats, key = 'value', allNames = null) {
  const names = [...(allNames ?? cats.map((c) => c.category))].sort((a, b) => a.localeCompare(b, 'fr'));
  const sorted = [...cats].sort((a, b) => b[key] - a[key]);
  const head = sorted.slice(0, 7).map((c) => ({ label: c.category, value: c[key], color: series(Math.max(0, names.indexOf(c.category))) }));
  const rest = sorted.slice(7).reduce((s, c) => s + c[key], 0);
  if (rest > 0) head.push({ label: 'Autres', value: rest, color: css('--muted') });
  return head;
}

export function donutChart(canvas, items, format = fmt.eur) {
  const t = base();
  return make(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.label),
      datasets: [{ data: items.map((i) => i.value), backgroundColor: items.map((i) => i.color), borderColor: t.surface, borderWidth: 2, hoverOffset: 6, borderRadius: 4, spacing: 1 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: tooltip(t, { callbacks: { label: (i) => ` ${i.label} : ${format(i.parsed)}` } }),
      },
    },
  });
}

/** Mini-courbe décorative des KPI. */
export function sparkline(canvas, values, color = series(0)) {
  return make(canvas, {
    type: 'line',
    data: { labels: values.map((_, i) => i), datasets: [{ data: values, borderColor: color, borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true, backgroundColor: (c) => areaGradient(c, color) }] },
    options: {
      responsive: false,
      animation: { duration: 900 },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
      events: [],
    },
  });
}

/** Historique du stock d'un produit avec ligne du seuil d'alerte. */
export function stockHistoryChart(canvas, history, min) {
  const t = base();
  const c = series(0);
  return make(canvas, {
    type: 'line',
    data: {
      labels: history.map((h) => h.date),
      datasets: [
        { label: 'Stock', data: history.map((h) => h.stock), borderColor: c, backgroundColor: (x) => areaGradient(x, c), fill: true, borderWidth: 2, tension: 0.25, stepped: false, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: c, pointHoverBorderColor: t.surface, pointHoverBorderWidth: 2 },
        { label: 'Seuil d’alerte', data: history.map(() => min), borderColor: t.warn, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltip(t, { callbacks: { title: (i) => dayTick(i[0].label, 'day'), label: (i) => ` ${i.dataset.label} : ${fmt.n(i.parsed.y)}` } }),
      },
      scales: { ...axes(t, { xTicks: 5 }), x: { ...axes(t).x, ticks: { ...axes(t).x.ticks, maxTicksLimit: 5, callback(v) { return dayTick(this.getLabelForValue(v), 'day'); } } } },
    },
    plugins: [crosshair],
  });
}

// Ligne verticale suivant le curseur.
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.();
    if (!active?.length) return;
    const x = active[0].element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = css('--border-strong');
    ctx.stroke();
    ctx.restore();
  },
};
