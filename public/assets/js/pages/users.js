import { get, post, patch, del, session } from '../api.js';
import { $, esc, icon, fmt, avatar, skeleton, empty, toast, modal, confirmDialog, formData, handleFormError, withLoading } from '../ui.js';

export async function renderUsers(root) {
  let users = [];

  root.innerHTML = `
    <div class="page-head">
      <div><span class="eyebrow">Administration</span><h1>Équipe</h1><p data-count>Chargement…</p></div>
      <div class="actions"><button class="btn primary" data-new>${icon('plus')}Inviter un membre</button></div>
    </div>
    <div class="user-grid" data-grid>${Array(4).fill(`<div class="card user-tile">${skeleton(64)}${skeleton(60)}</div>`).join('')}</div>`;

  const load = async () => {
    try {
      const res = await get('/users');
      if (!root.isConnected) return;
      users = res.data;
      const m = res.meta;
      $('[data-count]', root).textContent = `${m.total} membre${m.total > 1 ? 's' : ''} · ${m.admins} administrateur${m.admins > 1 ? 's' : ''} · ${m.active} actif${m.active > 1 ? 's' : ''}`;
      $('[data-grid]', root).innerHTML = users.length ? users.map(card).join('') : empty('Aucun membre', '', 'users');
    } catch (err) { toast(err.message, 'error'); }
  };

  const card = (u) => {
    const me = u.id === session.user.id;
    return `<article class="card user-tile ${u.is_active ? '' : 'inactive'}" data-id="${u.id}">
      <div class="head">${avatar(u.username, 'lg')}<div class="grow"><b>${esc(u.username)}${me ? ' <span class="badge brand" style="vertical-align:2px">Vous</span>' : ''}</b><span>${esc(u.email)}</span></div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${u.role === 'admin' ? `<span class="badge brand">${icon('crown')}Administrateur</span>` : `<span class="badge">${icon('user')}Employé</span>`}
        ${u.is_active ? `<span class="badge ok">${icon('checkCircle')}Actif</span>` : `<span class="badge out">${icon('xCircle')}Désactivé</span>`}
      </div>
      <div class="facts">
        <div><span>Mouvements</span><b>${fmt.n(u.stats?.movements ?? 0)}</b></div>
        <div><span>Dernière connexion</span><b>${fmt.ago(u.last_login_at)}</b></div>
      </div>
      <div class="foot"><span class="muted" style="font-size:12px">Membre depuis ${fmt.date(u.created_at, { month: 'long', year: 'numeric' })}</span>
        <div style="display:flex;gap:4px">
          <button class="btn ghost icon sm" data-edit title="Modifier" aria-label="Modifier">${icon('edit')}</button>
          ${me ? '' : `<button class="btn ghost icon sm" data-delete title="Supprimer" aria-label="Supprimer">${icon('trash')}</button>`}
        </div></div>
    </article>`;
  };

  const openForm = (u = null) => {
    const editing = Boolean(u);
    const m = modal({
      title: editing ? `Modifier ${u.username}` : 'Inviter un membre',
      subtitle: editing ? 'Laissez le mot de passe vide pour le conserver.' : 'Le membre pourra se connecter immédiatement.',
      ico: editing ? 'edit' : 'users',
      body: `<form id="user-form" class="form-grid" novalidate>
        <div class="field"><label for="u-name">Nom d’utilisateur</label><input id="u-name" class="input" name="username" value="${esc(u?.username ?? '')}" placeholder="prenom.nom" autofocus></div>
        <div class="field"><label for="u-mail">Email</label><input id="u-mail" class="input" type="email" name="email" value="${esc(u?.email ?? '')}" placeholder="prenom.nom@entreprise.com"></div>
        <div class="field full"><label for="u-pw">Mot de passe${editing ? ' <span class="muted">(facultatif)</span>' : ''}</label>
          <div style="display:flex;gap:8px"><input id="u-pw" class="input mono" name="password" autocomplete="new-password" placeholder="8 caractères minimum">
          <button type="button" class="btn" data-gen title="Générer un mot de passe">${icon('sparkles')}Générer</button></div></div>
        <div class="field full"><span class="label">Rôle</span>
          <div class="seg" data-role><button type="button" data-v="employee">${icon('user')}Employé</button><button type="button" data-v="admin">${icon('crown')}Administrateur</button></div>
          <input type="hidden" name="role" value="${u?.role ?? 'employee'}"></div>
        ${editing ? `<div class="full"><label class="switch"><input type="checkbox" name="is_active" ${u.is_active ? 'checked' : ''}><span class="track"></span><span><b>Compte actif</b><br><span class="muted" style="font-size:12.5px">Un compte désactivé est immédiatement déconnecté.</span></span></label></div>` : ''}
      </form>`,
      foot: `<button class="btn ghost" data-close>Annuler</button><button class="btn primary" type="submit" form="user-form" data-submit>${icon('check')}${editing ? 'Enregistrer' : 'Créer le compte'}</button>`,
    });
    const form = $('#user-form', m.panel);
    const syncRole = () => form.querySelectorAll('[data-role] button').forEach((b) => b.classList.toggle('active', b.dataset.v === form.role.value));
    form.querySelector('[data-role]').onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { form.role.value = b.dataset.v; syncRole(); } };
    syncRole();
    $('[data-gen]', form).onclick = () => {
      const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
      const arr = crypto.getRandomValues(new Uint32Array(14));
      form.password.value = [...arr].map((n) => chars[n % chars.length]).join('');
      navigator.clipboard?.writeText(form.password.value).then(() => toast('Mot de passe copié dans le presse-papiers.', 'info'), () => {});
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await withLoading($('[data-submit]', m.panel), async () => {
        try {
          const data = formData(form);
          if (editing && !data.password) delete data.password;
          const res = editing ? await patch(`/users/${u.id}`, data) : await post('/users', data);
          toast(editing ? `${res.data.username} a été mis à jour.` : `Bienvenue à ${res.data.username} dans l’équipe !`);
          m.close();
          load();
        } catch (err) { handleFormError(form, err); }
      });
    });
  };

  $('[data-new]', root).onclick = () => openForm();
  $('[data-grid]', root).addEventListener('click', async (e) => {
    const cardEl = e.target.closest('[data-id]'); if (!cardEl) return;
    const u = users.find((x) => x.id === Number(cardEl.dataset.id));
    if (e.target.closest('[data-edit]')) openForm(u);
    if (e.target.closest('[data-delete]')) {
      const ok = await confirmDialog({ title: `Supprimer ${u.username} ?`, message: 'Son compte sera supprimé définitivement. Les mouvements qu’il a saisis restent dans l’historique.', confirm: 'Supprimer le compte' });
      if (!ok) return;
      try { await del(`/users/${u.id}`); toast(`${u.username} a été supprimé.`); load(); } catch (err) { toast(err.message, 'error'); }
    }
  });

  await load();
}
