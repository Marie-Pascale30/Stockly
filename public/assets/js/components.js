// Composants transverses : mouvement de stock, fiche produit, formulaire produit.
import { get, post, put, patch, del, session } from './api.js';
import {
  $, $$, esc, icon, fmt, tile, statusBadge, MV, signedQty, toast, modal, drawer, confirmDialog,
  formData, handleFormError, withLoading, debounce, avatar, skeleton, empty,
} from './ui.js';
import { stockHistoryChart } from './charts.js';

/** Bus d'événements : 'stock-changed' déclenche le rafraîchissement des vues. */
export const bus = new EventTarget();
export const emitChanged = () => bus.dispatchEvent(new Event('stock-changed'));

// ===================================================================
// Nouveau mouvement
// ===================================================================
export async function openMovementModal({ product = null, type = 'out', quantity = 1 } = {}) {
  const state = { product, type, quantity, products: [] };

  const m = modal({
    title: 'Nouveau mouvement',
    subtitle: 'Entrée, sortie ou correction d’inventaire — le stock est mis à jour instantanément.',
    ico: 'arrows',
    wide: true,
    body: `<form id="mv-form" class="stack" novalidate>
      <div class="field" data-slot="product"></div>
      <div class="field"><span class="label">Type de mouvement</span>
        <div class="type-picker">
          ${['in', 'out', 'adjust'].map((t) => `<button type="button" class="${t}" data-type="${t}">
            <span class="mv-ico ${t}">${icon(MV[t].icon)}</span>
            <b>${MV[t].label}</b><span>${{ in: 'Réception, retour client', out: 'Vente, consommation', adjust: 'Comptage physique' }[t]}</span>
          </button>`).join('')}
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="mv-qty" data-qty-label>Quantité</label>
          <div class="stepper"><button type="button" data-step="-1" aria-label="Moins">−</button>
          <input id="mv-qty" name="quantity" type="number" inputmode="numeric" min="0" value="${quantity}">
          <button type="button" data-step="1" aria-label="Plus">+</button></div>
        </div>
        <div class="field"><label for="mv-note">Note <span class="muted">(facultatif)</span></label>
          <input id="mv-note" class="input" name="note" maxlength="255" placeholder="N° de bon, client, motif…"></div>
      </div>
      <div data-slot="preview"></div>
    </form>`,
    foot: `<button class="btn ghost" data-close>Annuler</button>
      <button class="btn primary" form="mv-form" type="submit" data-submit>${icon('check')}Enregistrer</button>`,
  });

  const form = $('#mv-form', m.panel);
  const qty = $('#mv-qty', m.panel);

  const renderProduct = () => {
    const slot = $('[data-slot="product"]', form);
    if (state.product) {
      const p = state.product;
      slot.innerHTML = `<span class="label">Produit</span>
        <div class="selected-product">${tile(p)}<div class="grow"><b>${esc(p.name)}</b>
        <span class="mono">${esc(p.reference)}</span> · <span>${fmt.n(p.stock)} en stock</span></div>
        ${statusBadge(p.status)}<button type="button" class="btn ghost sm" data-change>Changer</button></div>`;
      $('[data-change]', slot).onclick = () => { state.product = null; renderProduct(); renderPreview(); $('input', slot)?.focus(); };
      return;
    }
    slot.innerHTML = `<label for="mv-search">Produit</label>
      <div class="combo"><div class="input-icon">${icon('search')}
        <input id="mv-search" class="input" autocomplete="off" placeholder="Rechercher un produit par nom ou référence…"></div>
        <div class="combo-list" hidden></div></div>`;
    const input = $('#mv-search', slot);
    const list = $('.combo-list', slot);
    let active = 0;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      const items = state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)).slice(0, 30);
      active = Math.min(active, Math.max(0, items.length - 1));
      list.hidden = false;
      list.innerHTML = items.length
        ? items.map((p, i) => `<div class="opt ${i === active ? 'active' : ''}" data-id="${p.id}">${tile(p)}
            <div class="grow"><b>${esc(p.name)}</b><span class="mono">${esc(p.reference)}</span></div>
            <span class="badge ${p.status}">${fmt.n(p.stock)}</span></div>`).join('')
        : '<div class="opt muted">Aucun produit trouvé</div>';
      return items;
    };
    let current = [];
    const pick = (id) => {
      state.product = state.products.find((p) => p.id === Number(id));
      if (state.type === 'adjust') qty.value = state.product.stock;
      renderProduct(); renderPreview(); qty.focus(); qty.select();
    };
    input.addEventListener('focus', () => { current = draw(); });
    input.addEventListener('input', () => { active = 0; current = draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, current.length - 1); current = draw(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); current = draw(); }
      if (e.key === 'Enter') { e.preventDefault(); if (current[active]) pick(current[active].id); }
    });
    list.addEventListener('mousedown', (e) => { const o = e.target.closest('[data-id]'); if (o) { e.preventDefault(); pick(o.dataset.id); } });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  };

  const renderPreview = () => {
    const slot = $('[data-slot="preview"]', form);
    $$('[data-type]', form).forEach((b) => b.classList.toggle('active', b.dataset.type === state.type));
    $('[data-qty-label]', form).textContent = state.type === 'adjust' ? 'Stock compté' : 'Quantité';
    const submit = $('[data-submit]', m.panel);
    const p = state.product;
    if (!p) { slot.innerHTML = ''; submit.disabled = true; return; }

    const q = Math.max(0, parseInt(qty.value, 10) || 0);
    const after = state.type === 'in' ? p.stock + q : state.type === 'out' ? p.stock - q : q;
    const status = after <= 0 ? 'out' : after <= p.stock_min ? 'low' : 'ok';
    let notice = '';
    let blocked = state.type !== 'adjust' && q === 0;

    if (after < 0) {
      notice = `<div class="notice bad">${icon('xCircle')}Stock insuffisant : seulement ${fmt.n(p.stock)} disponible(s).</div>`;
      blocked = true;
    } else if (state.type === 'adjust' && after === p.stock) {
      notice = `<div class="notice info">${icon('info')}Le stock compté est identique au stock actuel.</div>`;
      blocked = true;
    } else if (status !== 'ok' && state.type !== 'in') {
      notice = `<div class="notice warn">${icon('alert')}Après ce mouvement, le produit passera ${status === 'out' ? 'en rupture' : `sous le seuil d’alerte (${p.stock_min})`}.</div>`;
    }

    slot.innerHTML = `<div class="preview">
        <div class="side"><span>Stock actuel</span><b>${fmt.n(p.stock)}</b></div>
        <div class="arrow">${icon('arrowRight')}</div>
        <div class="side"><span>Après ${MV[state.type].label.toLowerCase()}</span><b style="color:var(--${status === 'ok' ? 'text' : status === 'low' ? 'warn' : 'bad'})">${fmt.n(Math.max(after, 0))}</b></div>
      </div>${notice ? `<div style="margin-top:12px">${notice}</div>` : ''}`;
    submit.disabled = blocked;
  };

  form.addEventListener('click', (e) => {
    const t = e.target.closest('[data-type]');
    if (t) {
      state.type = t.dataset.type;
      if (state.type === 'adjust' && state.product) qty.value = state.product.stock;
      else if (!(parseInt(qty.value, 10) > 0)) qty.value = 1;
      renderPreview();
    }
    const s = e.target.closest('[data-step]');
    if (s) { qty.value = Math.max(0, (parseInt(qty.value, 10) || 0) + Number(s.dataset.step)); renderPreview(); }
  });
  qty.addEventListener('input', renderPreview);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.product) return;
    const btn = $('[data-submit]', m.panel);
    await withLoading(btn, async () => {
      try {
        const data = formData(form);
        const res = await post('/movements', { product_id: state.product.id, type: state.type, quantity: Number(data.quantity), note: data.note });
        const mv = res.data;
        toast(state.type === 'adjust'
          ? `Inventaire de « ${mv.product.name} » : ${fmt.n(mv.stock_after)} en stock (${signedQty(mv)}).`
          : `${MV[state.type].label} de ${fmt.n(mv.quantity)} × « ${mv.product.name} » enregistrée.`);
        if (res.meta?.alert) toast(res.meta.alert, 'warning', 'Alerte stock');
        m.close();
        emitChanged();
      } catch (err) {
        handleFormError(form, err);
      }
    });
  });

  renderProduct();
  renderPreview();
  if (state.product) { qty.focus(); qty.select(); }

  try {
    const res = await get('/products', { per_page: 100, sort: 'name' });
    state.products = res.data;
    if (state.product) state.product = state.products.find((p) => p.id === state.product.id) ?? state.product;
  } catch (err) { toast(err.message, 'error'); }
}

// ===================================================================
// Fiche produit (tiroir)
// ===================================================================
export async function openProductDrawer(id) {
  const d = drawer(`<div class="drawer-head">${skeleton(56, '56px', 16)}<div style="height:12px"></div>${skeleton(22, '70%')}</div>
    <div class="drawer-body">${skeleton(80)}${skeleton(200)}${skeleton(160)}</div>`,
  { onClose: () => bus.removeEventListener('stock-changed', render) });

  const render = async () => {
    let p;
    try {
      p = (await get(`/products/${id}`)).data;
    } catch (err) {
      toast(err.message, 'error');
      d.close();
      return;
    }

    d.panel.innerHTML = `
      <div class="drawer-head">
        <div style="display:flex;gap:16px;align-items:flex-start">
          ${tile(p, 'lg')}
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px">${statusBadge(p.status)}${p.category ? `<span class="badge">${icon('tag')}${esc(p.category)}</span>` : ''}</div>
            <h2 style="font-size:21px;font-weight:800">${esc(p.name)}</h2>
            <span class="mono muted">${esc(p.reference)}</span>
          </div>
          <button class="btn ghost icon sm" data-close aria-label="Fermer">${icon('x')}</button>
        </div>
      </div>
      <div class="drawer-body">
        <div class="stat-mini">
          <div><span>En stock</span><b>${fmt.n(p.stock)}</b></div>
          <div><span>Valeur (achat)</span><b>${fmt.eurc(p.stock_value)}</b></div>
          <div><span>Marge unitaire</span><b>${p.margin_rate === null ? '—' : String(p.margin_rate).replace('.', ',') + ' %'}</b></div>
        </div>
        <div>
          <div class="section-title" style="display:flex;justify-content:space-between">Stock — 30 jours
            <span class="legend" style="text-transform:none;letter-spacing:0;font-weight:500"><span><i style="background:var(--s1)"></i>Stock</span><span><i style="background:var(--warn)"></i>Seuil (${fmt.n(p.stock_min)})</span></span></div>
          <div class="chart-box xs"><canvas data-history aria-label="Évolution du stock sur 30 jours"></canvas></div>
        </div>
        <dl class="dl">
          <div><dt>Prix d’achat</dt><dd>${fmt.eur(p.purchase_price)}</dd></div>
          <div><dt>Prix de vente</dt><dd>${fmt.eur(p.sale_price)}</dd></div>
          <div><dt>Fournisseur</dt><dd>${esc(p.supplier ?? '—')}</dd></div>
          <div><dt>Seuil d’alerte</dt><dd>${fmt.n(p.stock_min)} unités</dd></div>
          <div><dt>Total entré / sorti</dt><dd>${fmt.n(p.totals.in_units)} / ${fmt.n(p.totals.out_units)}</dd></div>
          <div><dt>Dernier mouvement</dt><dd>${fmt.ago(p.totals.last_movement)}</dd></div>
          ${p.description ? `<div style="grid-column:1/-1"><dt>Description</dt><dd style="font-weight:400">${esc(p.description)}</dd></div>` : ''}
        </dl>
        <div>
          <div class="section-title">Derniers mouvements</div>
          ${p.movements.length ? `<div class="list">${p.movements.map((mv) => `
            <div class="list-item"><span class="mv-ico ${mv.type}">${icon(MV[mv.type].icon)}</span>
              <div class="grow"><b>${MV[mv.type].label}${mv.note ? ` · <span class="muted" style="font-weight:400">${esc(mv.note)}</span>` : ''}</b>
              <span>${fmt.datetime(mv.movement_date)} · ${esc(mv.user?.username ?? 'compte supprimé')}</span></div>
              <div style="text-align:right"><div class="qty ${mv.type}">${signedQty(mv)}</div><span class="muted" style="font-size:12px">→ ${fmt.n(mv.stock_after)}</span></div>
            </div>`).join('')}</div>` : empty('Aucun mouvement', 'Ce produit n’a encore jamais bougé.', 'arrows')}
        </div>
      </div>
      <div class="drawer-foot">
        <button class="btn" data-mv="in">${icon('in')}Entrée</button>
        <button class="btn" data-mv="out" ${p.stock <= 0 ? 'disabled' : ''}>${icon('out')}Sortie</button>
        <button class="btn" data-mv="adjust">${icon('adjust')}Inventaire</button>
        <button class="btn icon" data-edit title="Modifier" aria-label="Modifier">${icon('edit')}</button>
        ${session.isAdmin ? `<button class="btn icon" data-delete title="Archiver" aria-label="Archiver">${icon('trash')}</button>` : ''}
      </div>`;

    stockHistoryChart($('[data-history]', d.panel), p.history, p.stock_min);

    $$('[data-mv]', d.panel).forEach((b) => (b.onclick = () => openMovementModal({ product: p, type: b.dataset.mv, quantity: b.dataset.mv === 'adjust' ? p.stock : 1 })));
    $('[data-edit]', d.panel).onclick = () => openProductForm(p);
    const delBtn = $('[data-delete]', d.panel);
    if (delBtn) delBtn.onclick = async () => { if (await deleteProduct(p)) d.close(); };
  };

  bus.addEventListener('stock-changed', render);
  await render();
  return d;
}

export async function deleteProduct(p) {
  const ok = await confirmDialog({
    title: `Archiver « ${p.name} » ?`,
    message: 'Le produit disparaîtra du catalogue. Son historique de mouvements est conservé dans les statistiques.',
    confirm: 'Archiver le produit',
  });
  if (!ok) return false;
  try {
    await del(`/products/${p.id}`);
    toast(`« ${p.name} » a été archivé.`);
    emitChanged();
    return true;
  } catch (err) {
    toast(err.message, 'error');
    return false;
  }
}

// ===================================================================
// Formulaire produit (création / édition)
// ===================================================================
let lookups = null;

export async function openProductForm(product = null) {
  const editing = Boolean(product);
  const p = product ?? { name: '', reference: '', category: '', supplier: '', purchase_price: '', sale_price: '', stock_min: 5, description: '' };

  const m = modal({
    title: editing ? 'Modifier le produit' : 'Nouveau produit',
    subtitle: editing ? esc(p.reference) : 'Ajoutez un article à votre catalogue.',
    ico: editing ? 'edit' : 'package',
    wide: true,
    body: `<form id="product-form" class="form-grid" novalidate>
      <div class="field full"><label for="pf-name">Nom du produit</label><input id="pf-name" class="input" name="name" value="${esc(p.name)}" placeholder="Ex. Clavier mécanique sans fil" autofocus></div>
      <div class="field"><label for="pf-ref">Référence</label><input id="pf-ref" class="input mono" name="reference" value="${esc(p.reference)}" placeholder="LOGI-MXKEYS-001" style="text-transform:uppercase"><span class="hint">Lettres, chiffres, - . _ /</span></div>
      <div class="field"><label for="pf-cat">Catégorie</label><input id="pf-cat" class="input" name="category" list="dl-cats" value="${esc(p.category ?? '')}" placeholder="Informatique"></div>
      <div class="field"><label for="pf-sup">Fournisseur</label><input id="pf-sup" class="input" name="supplier" list="dl-sups" value="${esc(p.supplier ?? '')}" placeholder="Logitech"></div>
      <div class="field"><label for="pf-min">Seuil d’alerte</label><div class="input-group"><input id="pf-min" class="input" type="number" min="0" name="stock_min" value="${esc(p.stock_min)}"><span class="unit">unités</span></div></div>
      <div class="field"><label for="pf-buy">Prix d’achat HT</label><div class="input-group"><input id="pf-buy" class="input" type="number" min="0" step="0.01" name="purchase_price" value="${esc(p.purchase_price)}" placeholder="0,00"><span class="unit">€</span></div></div>
      <div class="field"><label for="pf-sell">Prix de vente HT</label><div class="input-group"><input id="pf-sell" class="input" type="number" min="0" step="0.01" name="sale_price" value="${esc(p.sale_price)}" placeholder="0,00"><span class="unit">€</span></div></div>
      <div class="full" data-margin></div>
      ${editing ? '' : `<div class="field"><label for="pf-init">Stock initial</label><div class="input-group"><input id="pf-init" class="input" type="number" min="0" name="initial_stock" value="0"><span class="unit">unités</span></div><span class="hint">Enregistré comme une entrée de stock.</span></div>`}
      <div class="field full"><label for="pf-desc">Description <span class="muted">(facultatif)</span></label><textarea id="pf-desc" class="textarea" name="description" maxlength="2000">${esc(p.description ?? '')}</textarea></div>
      <datalist id="dl-cats"></datalist><datalist id="dl-sups"></datalist>
    </form>`,
    foot: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="product-form" data-submit>${icon('check')}${editing ? 'Enregistrer' : 'Créer le produit'}</button>`,
  });

  const form = $('#product-form', m.panel);
  const margin = () => {
    const buy = parseFloat(form.purchase_price.value) || 0;
    const sell = parseFloat(form.sale_price.value) || 0;
    const slot = $('[data-margin]', form);
    if (!sell) { slot.innerHTML = ''; return; }
    const rate = ((sell - buy) / sell) * 100;
    slot.innerHTML = `<div class="notice ${rate < 0 ? 'bad' : rate < 15 ? 'warn' : 'info'}">${icon(rate < 0 ? 'alert' : 'sparkles')}
      Marge unitaire : <b>&nbsp;${fmt.eur(sell - buy)}</b>&nbsp;(${rate.toFixed(1).replace('.', ',')} %)${rate < 0 ? ' — vous vendez à perte.' : ''}</div>`;
  };
  form.addEventListener('input', (e) => { if (['purchase_price', 'sale_price'].includes(e.target.name)) margin(); });
  margin();

  (async () => {
    try {
      lookups ??= (await get('/products/categories')).data;
      $('#dl-cats', form).innerHTML = lookups.categories.map((c) => `<option value="${esc(c)}">`).join('');
      $('#dl-sups', form).innerHTML = lookups.suppliers.map((c) => `<option value="${esc(c)}">`).join('');
    } catch {}
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await withLoading($('[data-submit]', m.panel), async () => {
      try {
        const data = formData(form);
        const res = editing ? await put(`/products/${p.id}`, data) : await post('/products', data);
        lookups = null;
        toast(editing ? `« ${res.data.name} » a été mis à jour.` : `« ${res.data.name} » a rejoint le catalogue.`);
        m.close();
        emitChanged();
      } catch (err) {
        handleFormError(form, err);
      }
    });
  });
}

// Réutilisé par plusieurs pages.
export const movementRow = (mv) => `
  <div class="timeline-row" data-product="${mv.product.id}">
    <span class="mv-ico ${mv.type}">${icon(MV[mv.type].icon)}</span>
    <div class="what"><b>${esc(mv.product.name)}</b>
      <span>${avatar(mv.user?.username ?? '?', 'sm')}${esc(mv.user?.username ?? 'compte supprimé')} · ${fmt.time(mv.movement_date)}${mv.note ? ` · ${esc(mv.note)}` : ''}</span></div>
    <div class="qty ${mv.type}">${signedQty(mv)}</div>
    <div class="after">stock → <b>${fmt.n(mv.stock_after)}</b></div>
  </div>`;

export { patch };
