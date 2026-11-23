import { icon, fmt } from '../ui.js';

/** Pagination compacte : 1 … 4 5 [6] 7 8 … 20 */
export function pager({ page, total_pages: pages, total, per_page: per }) {
  if (!total) return '';
  const from = (page - 1) * per + 1;
  const to = Math.min(total, page * per);
  const nums = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...nums].sort((a, b) => a - b);
  const items = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) items.push('<span class="muted" style="padding:0 4px">…</span>');
    items.push(`<button data-page="${n}" class="${n === page ? 'active' : ''}" aria-label="Page ${n}">${n}</button>`);
  });
  return `<div class="pager"><span>${fmt.n(from)}–${fmt.n(to)} sur ${fmt.n(total)}</span>
    <div class="pages">
      <button data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Page précédente">${icon('chevL')}</button>
      ${items.join('')}
      <button data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Page suivante">${icon('chevR')}</button>
    </div></div>`;
}
