import { post, session } from '../api.js';
import { $, icon, toast, formData, handleFormError, withLoading } from '../ui.js';

const art = `
  <aside class="auth-art">
    <div class="brand"><div class="brand-logo"></div><div class="brand-name">Stockly<small>Gestion de stock</small></div></div>
    <div>
      <h1>Votre stock,<br><em>enfin sous contrôle.</em></h1>
      <p class="lead">Suivez chaque entrée et chaque sortie, anticipez les ruptures et visualisez la valeur de votre inventaire en temps réel.</p>
      <div class="floaters" aria-hidden="true">
        <div class="floater"><span>Valeur du stock</span><b>37 278 €</b> <span class="tag">▲ 12,4 %</span>
          <svg class="mini" width="150" height="30" viewBox="0 0 150 30"><path d="M0 24 18 20 36 22 54 14 72 16 90 9 108 12 126 5 150 3" fill="none" stroke="#a5b4fc" stroke-width="2" stroke-linecap="round"/></svg></div>
        <div class="floater"><span>Alerte</span><b style="font-size:16px">Webcam Brio 4K</b><br><span class="tag bad">● Rupture</span></div>
        <div class="floater"><span>Sorties · 30 jours</span><b>485 unités</b></div>
      </div>
    </div>
    <div class="foot">© ${new Date().getFullYear()} Stockly · Démo de portfolio · <a href="#/legal">Mentions légales &amp; confidentialité</a></div>
  </aside>`;

export function renderLogin(root, { onAuthenticated, mode = 'login' }) {
  const isLogin = mode === 'login';

  root.innerHTML = `<div class="auth">${art}
    <main class="auth-form"><div class="auth-card">
      <span class="eyebrow">${isLogin ? 'Bon retour' : 'Bienvenue'}</span>
      <h2>${isLogin ? 'Connexion à votre espace' : 'Créer votre compte'}</h2>
      <p>${isLogin ? 'Heureux de vous revoir. Entrez vos identifiants pour continuer.' : 'Quelques secondes suffisent pour rejoindre votre équipe.'}</p>
      <form id="auth-form" novalidate>
        ${isLogin ? `
          <div class="field"><label for="a-id">Email ou identifiant</label>
            <div class="input-icon">${icon('mail')}<input id="a-id" class="input" name="identifier" autocomplete="username" placeholder="vous@entreprise.com" autofocus></div></div>
        ` : `
          <div class="field"><label for="a-user">Nom d’utilisateur</label>
            <div class="input-icon">${icon('user')}<input id="a-user" class="input" name="username" autocomplete="username" placeholder="marie.dupont" autofocus></div></div>
          <div class="field"><label for="a-mail">Email</label>
            <div class="input-icon">${icon('mail')}<input id="a-mail" class="input" type="email" name="email" autocomplete="email" placeholder="vous@entreprise.com"></div></div>
        `}
        <div class="field"><label for="a-pw">Mot de passe</label>
          <div class="input-icon">${icon('lock')}<input id="a-pw" class="input" type="password" name="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" placeholder="${isLogin ? '••••••••' : '8 caractères minimum'}">
          <button type="button" class="btn ghost icon sm pw-toggle" aria-label="Afficher le mot de passe">${icon('eye')}</button></div></div>
        ${isLogin ? `
          <div class="row"><label class="check"><input type="checkbox" name="remember" checked>Rester connecté 30 jours</label></div>
        ` : `
          <div class="field"><label for="a-pw2">Confirmation</label>
            <div class="input-icon">${icon('lock')}<input id="a-pw2" class="input" type="password" name="password_confirm" autocomplete="new-password" placeholder="Répétez le mot de passe"></div></div>
        `}
        ${isLogin ? '' : `<p class="consent">Démo de portfolio : la base est effacée à chaque redémarrage du serveur, n’utilisez pas de vraies données.
          En créant un compte, vous acceptez le traitement décrit dans les <a href="#/legal">mentions légales &amp; confidentialité</a>.</p>`}
        <button class="btn primary lg block" type="submit">${isLogin ? 'Se connecter' : 'Créer mon compte'} ${icon('arrowRight')}</button>
      </form>
      ${isLogin ? `
        <div class="demo" data-demo role="button" tabindex="0">
          <span class="mv-ico in">${icon('sparkles')}</span>
          <div class="grow"><b>Compte de démonstration</b><span>admin@stockly.app · password</span></div>
          ${icon('arrowRight')}
        </div>` : ''}
      <p class="switch-auth">${isLogin
        ? 'Pas encore de compte ? <a href="#/register">Inscrivez-vous</a>'
        : 'Déjà inscrit ? <a href="#/login">Connectez-vous</a>'}</p>
      <p class="legal-link"><a href="#/legal">Mentions légales &amp; confidentialité</a></p>
    </div></main>
  </div>`;

  const form = $('#auth-form', root);
  const pw = $('#a-pw', root);
  $('.pw-toggle', root).onclick = (e) => {
    const show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    e.currentTarget.innerHTML = icon(show ? 'eyeOff' : 'eye');
  };

  const demo = $('[data-demo]', root);
  if (demo) {
    const fill = () => { form.identifier.value = 'admin@stockly.app'; pw.value = 'password'; form.requestSubmit(); };
    demo.onclick = fill;
    demo.onkeydown = (e) => { if (e.key === 'Enter') fill(); };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    await withLoading(btn, async () => {
      try {
        const res = await post(isLogin ? '/auth/login' : '/auth/register', formData(form));
        session.set(res.data);
        toast(isLogin ? `Ravi de vous revoir, ${res.data.user.username} !` : 'Votre compte est prêt. Bienvenue à bord !', 'success', isLogin ? 'Connecté' : 'Compte créé');
        onAuthenticated();
      } catch (err) {
        if (err.status === 401) {
          toast(err.message, 'error');
          pw.select();
        } else {
          handleFormError(form, err);
        }
      }
    });
  });
}

