# Audit de sécurité — AvecLesFemmes 0.25.0

**23 octobre 2026 · Code local, API, PWA, base, Docker et chaîne de livraison**

> Rapport historique de la version 0.25.0. Les corrections 0.26.0 et leur validation sont suivies dans [CORRECTIFS.md](CORRECTIFS.md). Les preuves initiales restent conservées dans `preuves/` ; les tests actuels exigent désormais le refus des exploitations et écrivent dans `preuves-apres/`.

## Avis

Le socle contient de bonnes protections, mais **je déconseille une mise en production avec des données réelles avant correction des trois constats P1**. Six constats sont documentés : trois prioritaires et trois moyens. Les niveaux expriment une priorité de correction contextualisée ; aucun score CVSS ni certification n’est revendiqué.

Le problème principal est la récupération d’accès : une administratrice de groupement peut choisir un nouveau secret pour un compte global et ainsi prendre les droits que ce compte possède dans un autre groupement. Le code à quatre chiffres est également accepté comme secret distant depuis un client non enrôlé, et l’ancien point d’entrée PIN présente une course sur son compteur d’échecs.

**Les protections applicatives n’ont pas été modifiées pendant cet audit.** Les défauts restent présents. Les ajouts sont le rapport, les preuves et des scénarios de reproduction isolés.

## Périmètre et méthode

- Version locale **0.25.0**, avec modifications non encore publiées ; commit de base `41ab2552202246db27c1e5aaf7f77b2cad71ee2d`. Ce SHA ne désigne donc pas à lui seul les sources auditées.
- Lecture des gardes et services d’authentification, DTO, contrôles de rôle, requêtes SQL et politiques RLS des migrations 001–014 ; parcours de cotisation, annulation, tirage et synchronisation.
- Lecture du coffre PWA, de la clé d’appareil, des règles de verrouillage, du service worker, des fichiers Nginx, des images Docker, de Compose et du workflow GitHub.
- **7 scénarios API** dans une base **PGlite en mémoire**, avec identités fictives et configuration de production ; aucune connexion à la base PostgreSQL du projet.
- **2 scénarios navigateur** : lectures des en-têtes de la PWA locale et coffre chiffré fictif dans un contexte neuf, dont toutes les requêtes API sont bloquées.
- **42 tests API applicatifs existants réussis**. Ces tests ne couvrent pas tous les scénarios adverses ; leur réussite ne neutralise pas les constats ci-dessous.
- Vérification npm des dépendances de production, puis de l’ensemble des dépendances : **0 vulnérabilité connue signalée** le jour du contrôle. Cela ne couvre ni les défauts métier, ni les images système, ni les vulnérabilités non référencées.

Render, Neon et le futur VPS n’ont pas fait l’objet d’essais d’intrusion. Leurs paramètres effectifs, sauvegardes, secrets, certificats et règles réseau restent à contrôler. Aucun déploiement, aucune tentative de surcharge, aucune modification d’un vrai compte ou d’une cotisation n’a été réalisé.

## Synthèse

| ID     | Priorité         | Constat                                                      | Impact / condition                                                                                | Preuve                                      |
| ------ | ---------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| SEC-01 | **P1 — élevée**  | Réinitialisation locale de secrets d’un compte global        | Prise de contrôle des autres groupements du compte ciblé, si celui-ci possède plusieurs adhésions | API réelle sur base isolée                  |
| SEC-06 | **P1 — élevée**  | Code secret distant sans enrôlement d’appareil               | Identifiant + code observé ou obtenu suffisent depuis un nouveau client                           | API réelle sur base isolée                  |
| SEC-02 | **P1 — élevée**  | Compteur non atomique de l’ancienne connexion PIN            | Limite de cinq échecs contournable sous concurrence                                               | Ordonnancement concurrent contrôlé          |
| SEC-03 | **P2 — moyenne** | Limiteur fondé sur l’adresse du proxy                        | Clients regroupés dans un même quota ; disponibilité et passage à l’échelle                       | Configuration et comportement Express isolé |
| SEC-04 | **P2 — moyenne** | En-têtes de protection absents de la page HTML               | Défense du navigateur incomplète ; Helmet ne protège pas le document servi par Nginx              | Réponses HTTP locales réelles               |
| SEC-05 | **P2 — moyenne** | Blocage hors ligne réinitialisable dans le profil navigateur | Essais locaux de code non durablement bornés, avec accès au stockage du profil                    | Coffre fictif et code réel de la PWA        |

## Constats détaillés

### SEC-01 — Réinitialisation de compte au-delà du périmètre du groupement

**Source :** [GroupementsService.resetPin](../../../apps/api/src/groupements/groupements.module.ts#L339), en particulier la mise à jour des deux empreintes à la ligne 353.

Le serveur vérifie que l’appelante administre le groupement et que la membre y appartient. Il met ensuite à jour **`app_users.password_hash` et `secret_code_hash` avec la même empreinte du PIN choisi**, sans vérifier les autres appartenances ou privilèges du compte. Ces secrets appartiennent au compte global, pas à son adhésion au groupement.

**Reproduction isolée :** A est administré par une personne ; la victime est membre de A et admin de B. L’accès direct de la première personne à B est refusé avec 404. La réinitialisation du PIN de la victime retourne ensuite 201 ; le PIN choisi est accepté comme mot de passe de la victime, et la liste des membres de B devient accessible avec le compte de celle-ci, en 200. L’ancien mot de passe de récupération est refusé en 401. Les deux empreintes sont identiques après l’opération.

Ce n’est pas une injection SQL ni une défaillance directe de RLS : le compte usurpé possède réellement les droits de B. Le scénario suppose une identité partagée entre plusieurs groupements, situation autorisée par le schéma. Le parcours actuel ne propose pas encore le rattachement d’un compte existant ; cela limite aujourd’hui la création de cette situation depuis l’interface, mais ne sécurise pas les comptes multi-groupements présents ou à venir.

**Correction recommandée :** retirer aux admins locaux la possibilité de choisir les secrets définitifs d’un compte global. À court terme, restreindre ou suspendre cette action, notamment sur les comptes présents dans d’autres groupements ou possédant des privilèges. Prévoir une récupération validée par la titulaire, via un canal vérifié, ou une procédure globale dédiée avec contrôle renforcé et audit. Conserver la séparation mot de passe initial / code secret. **Ne changer que `secret_code_hash` ne suffit pas** : ce code permet lui aussi une connexion globale. La titulaire doit choisir son secret après validation de son identité.

**Réception :** un admin de A ne peut pas obtenir un accès global à une victime ; mot de passe de récupération conservé lors d’un changement de code ; identités multi-groupements et comptes privilégiés couverts ; sessions et appareils révoqués selon une politique explicite. Voir [OWASP — récupération de mot de passe](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### SEC-06 — Le code à quatre chiffres n’est pas lié à un appareil enrôlé

**Source :** [AuthService.loginCode](../../../apps/api/src/auth/auth.module.ts#L92) et route publique `POST /api/v1/auth/login/secret-code` à la ligne 338.

L’interface demande un mot de passe initial sur un appareil neuf, mais l’API accepte directement **l’identifiant et le code**, sans session précédente, preuve d’appareil, mot de passe initial ni validation d’un canal. La clé IndexedDB du coffre ne participe pas à cette authentification serveur.

**Preuve :** un compte fictif avec un mot de passe fort et un code distinct reçoit une session en 201 depuis un client sans cookie ni preuve d’enrôlement. `GET /auth/me` accepte cette session en 200. Le scénario ne devine pas un code : il démontre qu’un code connu suffit depuis un autre client.

**Impact :** le code n’est pas seulement un déverrouillage de l’appareil déjà reconnu ; il devient un secret distant de seulement 10 000 valeurs. L’observation du code et la connaissance de l’identifiant permettent un accès depuis un autre appareil. La présence d’un mot de passe dans le premier écran ne constitue pas, à elle seule, une protection serveur.

**Correction recommandée :** enrôler l’appareil côté serveur après une authentification initiale forte ; exiger ensuite le code **et** une preuve d’appareil révocable, protégée et de forte entropie. Étudier une clé de possession ou WebAuthn selon la compatibilité cible. Un nouveau client doit repasser par la procédure initiale/récupération. Un simple identifiant d’appareil modifiable ne suffit pas. Si le produit choisit au contraire un code comme seul secret distant, ce risque doit être accepté explicitement et la politique d’authentification renforcée. Voir [OWASP — authentification](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

### SEC-02 — Course sur le compteur d’échecs de la connexion PIN

**Source :** [AuthService.loginPin](../../../apps/api/src/auth/auth.module.ts#L148), calcul `u.failed_attempts + 1` puis écriture de cette valeur aux lignes 163–173.

Plusieurs requêtes peuvent lire le même compteur avant sa mise à jour. Chaque requête réécrit alors la même valeur, ce qui perd des tentatives. Le chemin `/login/secret-code` utilise déjà une autre forme d’incrément ; les routines divergentes compliquent la garantie globale.

**Preuve contrôlée :** huit requêtes HTTP simultanées, avec une barrière dans l’adaptateur de base du test pour terminer les huit lectures avant les écritures. Les huit codes erronés retournent 401, mais le compteur final vaut **1**, aucun blocage n’est enregistré et le bon PIN reste accepté en 201. L’application de production n’a pas été modifiée. Cette preuve porte sur un ordonnancement possible ; elle n’est pas un test de charge ni la mesure d’une attaque réalisée sur Render.

**Correction recommandée :** unifier les chemins d’authentification, supprimer le chemin historique s’il n’est plus nécessaire, rendre le contrôle compte/échecs/verrouillage atomique ou sérialisé par compte et relire l’état sous concurrence. Ajouter des limites par identité et par source. Tester les courses entre échec, réussite, expiration et récupération.

**Réception :** les tentatives concurrentes ne sont pas perdues ; le seuil de blocage est respecté sur tous les points d’entrée. Une limite par IP ne remplace pas celle du compte.

### SEC-03 — Limitation de débit mal adaptée au reverse proxy

**Sources :** [configuration Express](../../../apps/api/src/bootstrap.ts#L9), [limiteur global](../../../apps/api/src/app.module.ts#L83), [transmission des adresses par Nginx](../../../docker/nginx.conf#L20).

L’application ne configure pas les proxys de confiance ; Express conserve `trust proxy = false`. Deux valeurs différentes de `X-Forwarded-For` donnent le même `req.ip` dans le test. Avec le conteneur unique Render, le pair vu par Node est Nginx ; avec les interfaces séparées, il s’agit des proxys des interfaces. Le Throttler par défaut utilise cette adresse.

**Impact attendu :** les utilisateurs derrière un même proxy partagent un quota par point d’entrée. Avec l’objectif de plus de 200 000 membres, des usages légitimes ou des requêtes abusives peuvent provoquer des 429 pour d’autres personnes. L’incidence réelle sur Render n’a pas été mesurée. Le stockage du limiteur est également local à l’instance.

**Correction recommandée :** définir précisément les sauts/adresses de confiance et assainir les en-têtes au proxy ; ne pas activer aveuglément `trust proxy = true`. Combiner des clés adaptées à l’identité et à la source ; utiliser un état partagé avant multiplication des instances. Qualifier deux clients légitimes et un en-tête forgé. [Documentation NestJS — applications derrière un proxy](https://docs.nestjs.com/security/rate-limiting).

**Point positif vérifié :** l’ordre réel des gardes est `ThrottlerGuard`, puis `AuthGuard`. Une confirmation refusée passe bien par le limiteur avant le calcul cryptographique. L’hypothèse inverse a été écartée et ne figure pas parmi les vulnérabilités.

### SEC-04 — Protection du document HTML incomplète

**Sources :** [Nginx local](../../../docker/nginx.conf#L24), [Nginx du conteneur Render](../../../docker/render-nginx.conf), [Helmet côté API](../../../apps/api/src/bootstrap.ts#L11).

Sur la réponse HTML locale 200 et un asset JavaScript 200 : absence de `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` et `Referrer-Policy`. Les trois derniers sont pourtant déclarés au niveau `server` : le `add_header Cache-Control` dans `location` empêche l’héritage normal. Les réponses API possèdent les en-têtes Helmet, avec certains doublons dus à Nginx.

**Impact :** le navigateur n’applique pas ces protections au document principal. La CSP d’une réponse JSON API ne protège pas la page PWA. Cela réduit la défense contre le chargement/exécution de scripts non autorisés et le cadrage de l’interface. **Aucune injection XSS ni action de clickjacking authentifiée n’a été démontrée.** L’absence de HSTS sur un serveur local HTTP n’est pas classée comme une faille.

**Correction recommandée :** livrer une CSP sur le document HTML et les interfaces web, corriger l’héritage des en-têtes et éviter les doublons. Prévoir `frame-ancestors`, `object-src`, `base-uri`, `form-action` et les ressources réellement utilisées. Le script inline d’application du thème initial doit être externalisé ou autorisé par empreinte/nonce ; ne pas tout résoudre avec `unsafe-inline` pour les scripts. Qualifier QR, caméra, partage, fontes et service worker, ainsi que les réponses d’erreur. Vérifier HTTPS/HSTS sur l’environnement déployé.

Références : [Nginx — héritage de add_header](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header), [OWASP — CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html).

### SEC-05 — Compteur hors ligne modifiable avec accès au profil navigateur

**Sources :** [compteurs locaux](../../../packages/ui/src/DeviceSecrets.ts#L46), [ouverture du coffre par code](../../../packages/ui/src/OfflineVault.ts#L155).

Le nombre d’échecs et le délai de quinze minutes sont stockés dans une entrée `localStorage` modifiable. La suppression de cette seule entrée permet de reprendre les essais, sans modifier le coffre chiffré ni la clé d’appareil.

**Preuve :** dans un contexte navigateur neuf, un coffre fictif est créé avec les vrais modules applicatifs. Après cinq erreurs, même le bon code est bloqué. Après remise à zéro du compteur, trois nouvelles erreurs sont possibles, puis le coffre s’ouvre avec le bon code.

**Limites :** aucun chiffrement AES n’a été cassé et le code n’a pas été retrouvé par recherche exhaustive. Le scénario exige un accès au profil/stockage du navigateur, ou la capacité d’y exécuter du code. Il ne démontre pas une lecture distante anonyme du coffre. La clé non exportable empêche l’export Web Crypto standard ; elle ne garantit pas un compteur matériel ni l’impossibilité d’utiliser cette clé depuis le même contexte.

**Correction recommandée :** définir le niveau de protection attendu contre la perte/compromission d’un appareil ; ne pas présenter ce compteur comme une garantie anti-bruteforce matérielle. Selon le niveau requis, ajouter une preuve de présence utilisateur adossée à l’authentificateur de l’appareil, ou exiger un secret hors ligne plus fort. Un code plus long augmente le coût mais ne rend pas le compteur infalsifiable. Prévoir des mesures de conservation/révocation compatibles avec les brouillons, sans destruction automatique des saisies.

Référence : [OWASP — sécurité du stockage navigateur et des CryptoKey](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

## Protections confirmées et points favorables

| Domaine               | Résultat                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Accès non authentifié | Rejet 401 sur les ressources métier testées                                                                                                     |
| CSRF et origines      | Rejet 403 sans en-tête applicatif et pour une origine étrangère                                                                                 |
| Confirmation sensible | Rejet serveur en 403 si la confirmation manque ; les contrôles ne reposent pas uniquement sur la fenêtre PWA                                    |
| Session de production | Cookie HttpOnly, Secure, SameSite=Lax ; jeton aléatoire et empreinte en base                                                                    |
| Inactivité            | Session PWA périmée après cinq minutes ; le heartbeat d’une session périmée est rejeté                                                          |
| Isolation directe     | Accès direct au groupement étranger rejeté ; politiques RLS et contexte transactionnel utilisateur                                              |
| Cotisations           | Requêtes paramétrées dans les chemins examinés, contrôles serveur, annulation conservée et idempotence ; tests métier réussis                   |
| Coffre                | AES-GCM, IV aléatoires, dérivation PBKDF2, clé d’appareil séparée, absence de jeton de session dans localStorage dans les chemins examinés      |
| Démonstration         | Mot de passe de démonstration non retourné dans le test configuré en production ; la publication locale en développement est volontaire         |
| Conteneurs            | Processus non root, API sans privilège PostgreSQL superuser/bypass RLS prévu, ports locaux liés à loopback, images de base figées par empreinte |
| Livraison             | Permissions CI majoritairement restreintes, audit npm et vérifications de version présents dans le workflow                                     |

Ces résultats sont limités au périmètre testé. Ils ne signifient pas que toutes les routes et toutes les combinaisons de rôle ont été démontrées sûres.

## Risques et vérifications complémentaires

- **Révocation et durée hors ligne :** aucun âge maximal de confiance n’a été identifié dans l’ouverture du coffre ; la vérification des droits attend le retour du réseau. Définir une durée et une stratégie explicites, particulièrement après blocage d’un compte ou perte de rôle. La révocation immédiate est impossible sur un appareil réellement déconnecté.
- **MFA des comptes privilégiés :** aucune étape MFA n’a été trouvée pour le Super Admin. Étudier un facteur supplémentaire et une réauthentification des opérations à fort impact.
- **Cryptographie serveur synchrone :** `scryptSync` est utilisé dans le traitement des requêtes. Évaluer le coût et passer à une exécution non bloquante avec une capacité bornée ; aucun déni de service n’a été tenté.
- **Traçabilité sécurité :** les opérations métier sont auditées, mais aucun dispositif complet d’alerte des échecs/récupérations de compte n’a été identifié. Ajouter événements et alertes sans journaliser codes, mots de passe ou cookies.
- **Secrets et infrastructure :** historique Git, secrets GitHub/Render/Dokploy, rotation, TLS réel vers Neon, privilèges réels du compte PostgreSQL, sauvegardes et restauration n’ont pas été inspectés en production.
- **Chaîne de construction :** `npm audit` ne remplace pas un scan des images et dépendances système. Ajouter SBOM et scan d’images ; vérifier la protection effective du dépôt et l’épinglage des actions CI. Les fichiers de politique du dépôt ne prouvent pas que ces règles sont activées sur GitHub.
- **Protection des données :** définir minimisation, durée de conservation et usage des appareils partagés. Aucune conclusion de conformité réglementaire n’est formulée.

## Plan de correction recommandé

| Lot                               | Actions                                                                                                                               | Validation attendue                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| S1 — Avant données réelles        | SEC-01 : encadrer la récupération globale et préserver le mot de passe initial ; SEC-06 : enrôlement serveur avant connexion par code | Tests négatifs multi-groupements, compte privilégié et appareil neuf ; titulaire contrôlant le choix de son secret |
| S2 — Avant données réelles        | SEC-02 : unifier les authentifications et sérialiser/atomiser les tentatives                                                          | Scénarios concurrents, échec/réussite et blocage respecté sur chaque route                                         |
| S3 — Avant recette de volume      | SEC-03 et SEC-04 : quotas adaptés aux proxys, en-têtes et CSP du document                                                             | Deux IP distinctes, en-tête forgé, quotas par identité ; vérification sur les URLs Render réelles                  |
| S4 — Avant usage terrain sensible | SEC-05 : protection des appareils, politique hors ligne, récupération des brouillons                                                  | Perte d’appareil, compteur altéré, ancien compte révoqué, expiration et synchronisation sans perte                 |
| S5 — Exploitation                 | MFA privilégiée, journalisation sécurité, secrets, scans d’images et restauration                                                     | Recette d’exploitation et surveillance vérifiées                                                                   |

Après correction, les reproductions qui prouvent aujourd’hui une faille devront devenir des tests de refus, puis être intégrées à la CI. Ne pas simplement ajouter les assertions actuelles au pipeline : elles passent précisément parce qu’elles reproduisent les défauts.

## Preuves et reproductibilité

- [API : statuts, concurrence, cookie et ordre des gardes](preuves/api.json).
- [En-têtes HTML, asset et API](preuves/http-headers.json).
- [Compteur du coffre fictif](preuves/offline-counter.json).
- [Audit npm complet](preuves/npm-audit-complet.json).
- [Commandes et précautions de reproduction](REPRODUCTION.md).

Les preuves ne contiennent pas de vrais mots de passe, cookies ou empreintes d’identifiants. Les secrets littéraux des tests sont réservés aux identités fictives de leur base en mémoire.
