import { get, put, del, session } from '../api.js';
import { $, $$, esc, icon, fmt, avatar, toast, modal, formData, handleFormError, withLoading, skeleton } from '../ui.js';

const DEMO_NOTE = `<div class="demo-note">${icon('lock')}<span><b>Compte de démonstration.</b> Ses identifiants sont publics : l’identifiant, l’email, le mot de passe et le rôle sont verrouillés et le compte ne peut pas être supprimé. Créez votre propre compte pour tester ces fonctions.</span></div>`;

const TABS = [['profile', 'Profil', 'user'], ['security', 'Sécurité', 'shield'], ['preferences', 'Préférences', 'settings']];

export async function renderSettings(root, { query, setQuery, applyTheme, refreshShell, onAccountDeleted }) {
  let tab = TABS.some(([k]) => k === query.tab) ? query.tab : 'profile';

  root.innerHTML = `
    <div class="page-head"><div><span class="eyebrow">Compte</span><h1>Paramètres</h1><p>Gérez votre profil, votre sécurité et vos préférences d’affichage.</p></div></div>
    <div class="settings-layout">
      <nav class="tabs-v" data-tabs>${TABS.map(([k, l, i]) => `<button data-tab="${k}">${icon(i)}${l}</button>`).join('')}</nav>
      <div data-panel></div>
    </div>`;

  const panel = $('[data-panel]', root);

  const show = (name) => {
    tab = name;
    setQuery({ tab: name === 'profile' ? '' : name });
    $$('[data-tab]', root).forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    ({ profile, security, preferences })[name]();
  };

  // ---------------------------------------------------------------- Profil
  function profile() {
    const u = session.user;
    const locked = u.is_demo ? 'disabled' : '';
    panel.innerHTML = `<div class="card card-pad">${u.is_demo ? DEMO_NOTE : ''}
      <div style="display:flex;gap:18px;align-items:center;margin-bottom:24px">${avatar(u.username, 'lg')}
        <div><h3 style="font-size:20px">${esc(u.username)}</h3><span class="muted">${u.role === 'admin' ? 'Administrateur' : 'Employé'} · membre depuis ${fmt.date(u.created_at, { month: 'long', year: 'numeric' })}</span></div></div>
      <form id="profile-form" class="form-grid" novalidate>
        <div class="field"><label for="s-user">Nom d’utilisateur</label><input id="s-user" class="input" name="username" value="${esc(u.username)}" ${locked}></div>
        <div class="field"><label for="s-mail">Email</label><input id="s-mail" class="input" type="email" name="email" value="${esc(u.email)}" ${locked}></div>
        <div class="full" style="display:flex;justify-content:flex-end"><button class="btn primary" type="submit" ${locked}>${icon('check')}Enregistrer</button></div>
      </form></div>`;
    const form = $('#profile-form', panel);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try {
          const res = await put('/me', formData(form));
          session.patch({ user: res.data });
          refreshShell();
          toast('Profil mis à jour.');
          profile();
        } catch (err) { handleFormError(form, err); }
      });
    });
  }

  // -------------------------------------------------------------- Sécurité
  async function security() {
    const demo = Boolean(session.user.is_demo);
    panel.innerHTML = `<div class="stack">
      <div class="card card-pad"><h3 style="margin-bottom:4px">Changer de mot de passe</h3><p class="muted" style="margin:0 0 18px">Vos autres appareils seront déconnectés.</p>
        ${demo ? DEMO_NOTE : ''}
        <form id="pw-form" class="stack" novalidate style="max-width:460px" ${demo ? 'hidden' : ''}>
          <div class="field"><label for="p-cur">Mot de passe actuel</label><input id="p-cur" class="input" type="password" name="current_password" autocomplete="current-password"></div>
          <div class="field"><label for="p-new">Nouveau mot de passe</label><input id="p-new" class="input" type="password" name="password" autocomplete="new-password">
            <div class="strength" data-strength><i></i><i></i><i></i><i></i></div><span class="hint" data-strength-label>8 caractères minimum. Mélangez lettres, chiffres et symboles.</span></div>
          <div class="field"><label for="p-conf">Confirmation</label><input id="p-conf" class="input" type="password" name="password_confirm" autocomplete="new-password"></div>
          <div><button class="btn primary" type="submit">${icon('lock')}Mettre à jour</button></div>
        </form></div>
      <div class="card card-pad"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
        <div><h3>Sessions actives</h3><p class="muted" style="margin:4px 0 0">Appareils actuellement connectés à votre compte.</p></div>
        <button class="btn" data-revoke>${icon('logout')}Déconnecter les autres</button></div>
        <div class="list" data-sessions>${skeleton(48)}</div></div>
      ${demo ? '' : `<div class="card card-pad danger-zone"><h3 style="margin-bottom:4px">Supprimer mon compte</h3>
        <p class="muted" style="margin:0 0 14px">Votre compte, vos préférences et vos sessions sont effacés définitivement. Les mouvements de stock que vous avez saisis restent dans l’historique, sans votre nom.</p>
        <button class="btn danger" data-delete-account>${icon('trash')}Supprimer mon compte</button></div>`}
    </div>`;

    $('[data-delete-account]', panel)?.addEventListener('click', () => {
      const m = modal({
        title: 'Supprimer définitivement votre compte ?', ico: 'alert', icoCls: 'bad',
        subtitle: 'Cette action est irréversible. Confirmez avec votre mot de passe.',
        body: `<form id="del-form" class="stack" novalidate><div class="field"><label for="d-pw">Mot de passe</label><input id="d-pw" class="input" type="password" name="password" autocomplete="current-password" autofocus></div></form>`,
        foot: `<button class="btn ghost" data-close>Annuler</button><button class="btn danger" type="submit" form="del-form" data-submit>${icon('trash')}Supprimer mon compte</button>`,
      });
      const delForm = $('#del-form', m.panel);
      delForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await withLoading($('[data-submit]', m.panel), async () => {
          try {
            await del('/me', formData(delForm));
            m.close();
            onAccountDeleted?.();
          } catch (err) { handleFormError(delForm, err); }
        });
      });
    });

    const form = $('#pw-form', panel);
    form.password.addEventListener('input', () => {
      const v = form.password.value;
      const score = !v ? 0 : Math.min(4, [v.length >= 8, v.length >= 12, /[A-Z]/.test(v) && /[a-z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length);
      $('[data-strength]', panel).className = `strength s${score}`;
      $('[data-strength-label]', panel).textContent = ['8 caractères minimum. Mélangez lettres, chiffres et symboles.', 'Très faible', 'Moyen', 'Bon', 'Excellent 💪'][score];
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await withLoading(form.querySelector('[type=submit]'), async () => {
        try {
          const res = await put('/me/password', formData(form));
          toast(res.data.message);
          form.reset();
          loadSessions();
        } catch (err) { handleFormError(form, err); }
      });
    });

    const loadSessions = async () => {
      try {
        const res = await get('/me/sessions');
        $('[data-sessions]', panel).innerHTML = res.data.map((s) => `
          <div class="list-item"><span class="mv-ico in">${icon('monitor')}</span>
            <div class="grow"><b>${esc(device(s.user_agent))}${s.current ? ' <span class="badge ok" style="vertical-align:2px">Cet appareil</span>' : ''}</b>
            <span>Actif ${fmt.ago(s.last_used_at)} · expire le ${fmt.date(s.expires_at)}</span></div></div>`).join('');
      } catch (err) { toast(err.message, 'error'); }
    };
    $('[data-revoke]', panel).onclick = async (e) => withLoading(e.currentTarget, async () => {
      try { await del('/me/sessions'); toast('Tous vos autres appareils ont été déconnectés.'); loadSessions(); } catch (err) { toast(err.message, 'error'); }
    });
    loadSessions();
  }

  // ----------------------------------------------------------- Préférences
  function preferences() {
    const s = session.settings;
    panel.innerHTML = `<div class="stack">
      <div class="card card-pad"><h3 style="margin-bottom:4px">Apparence</h3><p class="muted" style="margin:0 0 18px">Choisissez l’ambiance qui vous ressemble.</p>
        <div class="theme-cards">${[['light', 'Clair'], ['dark', 'Sombre'], ['system', 'Système']].map(([k, l]) => `
          <button class="theme-card ${s.theme === k ? 'active' : ''}" data-theme-pick="${k}"><div class="pv ${k}"><i></i><div><em></em></div></div>
          <b>${l}${s.theme === k ? icon('checkCircle') : ''}</b></button>`).join('')}</div></div>
      <div class="card card-pad">
        <div class="setting-row"><div><b>Éléments par page</b><span>Nombre de lignes dans les listes.</span></div>
          <select class="select" data-pref="items_per_page" style="width:110px">${[10, 15, 20, 25, 50, 100].map((n) => `<option ${n === s.items_per_page ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div class="setting-row"><div><b>Alertes de stock</b><span>Afficher la cloche de notifications pour les ruptures et stocks bas.</span></div>
          <label class="switch"><input type="checkbox" data-pref="notifications" ${s.notifications ? 'checked' : ''}><span class="track"></span></label></div>
        <div class="setting-row"><div><b>Graphiques</b><span>Afficher les graphiques sur le tableau de bord et les statistiques.</span></div>
          <label class="switch"><input type="checkbox" data-pref="display_charts" ${s.display_charts ? 'checked' : ''}><span class="track"></span></label></div>
      </div></div>`;

    const save = async (part) => {
      const previous = session.settings;
      session.patch({ settings: { ...previous, ...part } });
      applyTheme();
      refreshShell();
      try {
        const res = await put('/me/settings', part);
        session.patch({ settings: res.data });
        toast('Préférences enregistrées.');
      } catch (err) {
        session.patch({ settings: previous });
        applyTheme();
        toast(err.message, 'error');
      }
      preferences();
    };

    $$('[data-theme-pick]', panel).forEach((b) => (b.onclick = () => save({ theme: b.dataset.themePick })));
    $$('[data-pref]', panel).forEach((el) => el.addEventListener('change', () => save({ [el.dataset.pref]: el.type === 'checkbox' ? el.checked : Number(el.value) })));
  }

  $('[data-tabs]', root).addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  show(tab);
}

function device(ua) {
  if (!ua) return 'Appareil inconnu';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl/i.test(ua) ? 'curl' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} sur ${os}` : browser;
}
