# ADR 024 — Assistance Super Admin pour l’accès PWA

Statut : adopté, produit 1.0.1. Complète l’ADR 021.

> Évolution 1.1.0 : [ADR 025](025-connexion-telephone-pin.md) remplace le parcours de réinscription décrit ci-dessous. Après assistance, la titulaire saisit son téléphone et son PIN existant ; en cas de PIN oublié, le Super Admin peut lui en préparer un nouveau. L’oubli d’appareil conserve sa vérification administrative et la conservation des coffres.

## Décision

La connexion habituelle des membres et administratrices conserve le code secret et ne propose plus les boutons de reconnexion par mot de passe, de récupération de code ou de changement/oubli de compte. Un texte invite à contacter le Super Admin. La première connexion et le déchiffrement hors ligne par mot de passe initial restent nécessaires.

Le lien « Accès PWA de cet appareil » du portail Super Admin ouvre `/?administration-appareil` sur l’origine PWA : localement `http://localhost:8086/`, en recette la racine du conteneur Render. L’endpoint `POST /api/v1/auth/forget-device` exige l’identifiant et le mot de passe du Super Admin dans le corps de cette demande, vérifie son rôle et applique les compteurs de tentatives existants. L’authentification autorise uniquement cette action : aucune session administrative n’est créée sur l’appareil de la membre. Une identité locale, un cookie d’appareil ou une session déjà ouverte ne suffisent pas. La route est limitée à dix demandes par minute selon les quotas d’authentification existants.

La preuve d’appareil est révoquée avant de retirer l’identité mémorisée. En cas de refus serveur, l’identité reste présente. Les coffres et leurs saisies ne sont jamais effacés. Le code existant est conservé et la prochaine connexion demande l’identifiant et le mot de passe initial, puis le code. Pour un code oublié, le Super Admin utilise au préalable « Révoquer » dans la fiche membre : le code, les sessions et les appareils sont révoqués, sans choisir de nouveau secret à la place de la titulaire.

## Procédure d’assistance

1. Le Super Admin vérifie la demande de la titulaire et, pour un code oublié, révoque son code depuis le portail web.
2. Sur l’appareil concerné et dans le même navigateur ou la même installation PWA, il suit « Assistance Super Admin » depuis la connexion (ou ouvre `/?administration-appareil`), saisit ses propres identifiants et confirme l’oubli. Le compte mémorisé est affiché avant validation.
3. Après succès, la session locale et la preuve d’appareil sont révoquées. Aucune session administrative n’a été ouverte. La titulaire revient à la connexion et saisit son identifiant et son mot de passe initial. Elle confirme son code existant, ou choisit un nouveau code si le Super Admin l’a révoqué.

Une intervention dans un autre profil de navigateur ne peut pas effacer le stockage de l’installation concernée. La révocation globale reste distante ; l’oubli de l’identité locale exige une intervention dans cette installation. Cette procédure ne constitue pas une récupération d’un mot de passe initial perdu. Une révocation n’efface pas les sauvegardes anciennes d’un coffre hors ligne.

## Validation et livraison

Tests API : demande incomplète, mauvais mot de passe, membre et administratrice refusés ; révocation avec les identifiants Super Admin et absence de nouvelle session administrative. Tests mobiles : absence des anciens boutons, refus conservant l’identité et les saisies, réinscription après assistance, brouillon conservé et synchronisé après récupération. Aucun changement de schéma PostgreSQL. Local : Docker Compose ; recette : Render gratuit et Neon ; production : Dokploy et Neon dédiée. La publication distante de cette version attend la consigne `VIZIODEPLOIE`.
