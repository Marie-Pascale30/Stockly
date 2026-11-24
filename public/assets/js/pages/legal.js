// Mentions légales (LCEN) et politique de confidentialité (RGPD) — page accessible sans connexion.
import { session } from '../api.js';
import { icon } from '../ui.js';

const CONTACT = 'bognesonkeng.mp@gmail.com';

export function renderLegal(root) {
  const back = session.token ? '#/dashboard' : '#/login';

  root.innerHTML = `<main class="legal">
    <a class="btn ghost sm" href="${back}">${icon('chevL')}<span>Retour à Stockly</span></a>
    <span class="eyebrow">Informations légales</span>
    <h1>Mentions légales &amp; confidentialité</h1>
    <p class="lead">Stockly est une <b>application de démonstration</b> réalisée dans le cadre d’un portfolio de développeuse.
      Ce n’est pas un service commercial : n’y saisissez aucune donnée réelle ou sensible.</p>

    <section>
      <h2>Éditeur du site</h2>
      <p>Marie Pascale Bogne Sonkeng (particulier), directrice de la publication.<br>
        Contact : <a href="mailto:${CONTACT}">${CONTACT}</a></p>
    </section>

    <section>
      <h2>Hébergeur</h2>
      <p>Render Services, Inc. — 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis —
        <a href="https://render.com" rel="noopener noreferrer" target="_blank">render.com</a>.<br>
        L’application et sa base de données sont hébergées aux États-Unis.</p>
    </section>

    <section>
      <h2>Finalité et base légale</h2>
      <p>Les données servent uniquement à faire fonctionner la démonstration (connexion, gestion du stock, préférences d’affichage).
        Base légale : l’exécution du service que vous demandez en créant un compte (article 6.1.b du RGPD) et l’intérêt légitime
        de sécuriser l’application (article 6.1.f). Aucune donnée n’est vendue, partagée ni utilisée à des fins publicitaires.</p>
    </section>

    <section>
      <h2>Données collectées</h2>
      <ul>
        <li><b>Compte</b> : nom d’utilisateur, adresse email, mot de passe (stocké uniquement sous forme hachée), rôle, dates de création et de dernière connexion.</li>
        <li><b>Préférences</b> : thème, nombre d’éléments par page, notifications, graphiques.</li>
        <li><b>Sessions</b> : empreinte du jeton de connexion, navigateur utilisé (user-agent), dates d’utilisation et d’expiration.</li>
        <li><b>Contenu saisi</b> : produits et mouvements de stock, associés à leur auteur.</li>
        <li><b>Sécurité</b> : adresse IP et identifiant saisi, utilisés de façon temporaire (une minute environ) pour limiter les tentatives de connexion ;
          journaux techniques de l’hébergeur.</li>
      </ul>
    </section>

    <section>
      <h2>Durée de conservation</h2>
      <p>La base de données est <b>entièrement effacée et recréée à chaque redémarrage du serveur</b> (déploiement ou mise en veille
        après une période d’inactivité, soit en pratique quelques heures au plus). Vous pouvez aussi supprimer votre compte à tout moment
        depuis <i>Paramètres → Sécurité → Supprimer mon compte</i>.</p>
    </section>

    <section>
      <h2>Vos droits</h2>
      <p>Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité de vos données.
        Vous pouvez modifier votre profil dans les Paramètres, supprimer votre compte vous-même, ou écrire à
        <a href="mailto:${CONTACT}">${CONTACT}</a>. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la
        <a href="https://www.cnil.fr/fr/plaintes" rel="noopener noreferrer" target="_blank">CNIL</a>.</p>
    </section>

    <section>
      <h2>Cookies et stockage local</h2>
      <p>Stockly n’utilise <b>aucun cookie</b>, ni outil de mesure d’audience ou de publicité. Votre navigateur conserve dans son
        <i>localStorage</i> (clé <code>stockly.session</code>) votre jeton de connexion, votre profil et vos préférences d’affichage :
        ce stockage est strictement nécessaire au fonctionnement du service et est effacé à la déconnexion.
        Les polices et bibliothèques sont servies par le site lui-même, sans appel à des services tiers.</p>
    </section>
  </main>`;
}
