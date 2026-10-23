# Validation locale des versions

## Calendrier mensuel et initialisation de Nguith — 0.28.0, 23 octobre 2026

- **49/49 tests API/calendrier**, **2/2 scénarios mobiles ciblés Chromium/WebKit** et **13 tests version/livraison/mise à jour/fiabilité réussis**. Premier dimanche réel du mois, dix rencontres, anciens calendriers conservés, création des deux types, ouverture/cotisation mensuelles, tontine sans événement et raccourcis de démonstration désactivés sans secret configuré.
- Réinitialisation PostgreSQL Compose après pg_dump privé : un groupement, Awa ADMIN/Présidente, trois campagnes, trois inscriptions fixes et aucun versement/séance/tour. Contrôles PostgreSQL et connexion réelle dans la PWA par mot de passe puis PIN ; montants, fonctions, événements et fréquences vérifiés dans l’interface. Sauvegarde lisible par pg_restore, aucune restauration complète exécutée.
- Migration 017 appliquée, OpenAPI/client régénérés, typecheck, SemVer et `git diff --check` validés ; images locales 0.28.0 et services sains. Les six scénarios historiques mobiles dépendant des comptes supprimés ne sont pas requalifiés sur ce jeu. [Rapport, captures et limites](recette/nguith-2026-10-23/README.md). Aucun déploiement distant.

## Recette interactive de la synchronisation — 0.27.1, 23 octobre 2026

- [Parcours, captures et limites](recette/synchronisation-ui-2026-10-23/RECETTE.md). Tests dans le navigateur contre la PWA, l’API et PostgreSQL Compose réels, avec un groupement fictif dédié : envoi automatique sans nouvelle saisie du code, choix manuel persistant, confirmation par code, reçu, refus métier conservé et reprise du même brouillon après réactivation.
- Verrouillage après cinq minutes observé, brouillon récupéré après déverrouillage. Rapprochement final : trois versements de 1 000 FCFA, un par campagne, sans doublon ; même total de 3 000 FCFA affiché dans l’historique en ligne et depuis les données synchronisées pendant la coupure.
- Ancien texte « Aucun envoi automatique » corrigé ; nouveau bandeau vérifié dans l’interface reconstruite. Typecheck, cohérence SemVer, les 13 tests de version/livraison/mise à jour/fiabilité et `git diff --check` réussis. Contrat OpenAPI régénéré ; images API/web/PWA locales 0.27.1 reconstruites et relancées.
- Portée interactive : profil membre, épargne et indisponibilité réelle du service local. Les encaissements administrateur, tontines, téléphones physiques et plateformes distantes ne sont pas requalifiés par cette recette. Aucune publication distante.

## Synchronisation automatique hors ligne — 0.27.0, 23 octobre 2026

- **44/44 tests API réussis**. Le nouveau scénario couvre le rejeu signé sans session générale, preuve d’appareil obligatoire, CSRF, falsification du montant, chemin interdit, DTO stricts, droits réévalués après changement de rôle, versement personnel, date obligatoire, concurrence idempotente et révocation.
- **114 scénarios mobiles validés** sur Chromium et WebKit : passage complet à **113/114** en 5,5 minutes, puis reprise des **10/10 scénarios de synchronisation réussie** en 58,3 secondes après ajustement du seul parcours de test iPhone. La notification de fin recouvrait temporairement le bouton des saisies ; le test ferme explicitement cette notification avant de continuer. Aucun clic forcé ni contournement du contrôle métier.
- Les nouveaux contrôles vérifient l’envoi automatique sans code supplémentaire, la signature Web Crypto compatible avec le serveur, l’absence de code/mot de passe dans la requête de rejeu, le refus conservé puis confirmé manuellement avec la même référence, la réponse perdue et son réessai sans double comptabilisation, l’absence de départ pendant le verrouillage et la préférence manuelle conservée après rechargement. La clé de signature n’apparaît pas en clair dans localStorage.
- **9/9 régressions de sécurité API** et **3/3 contrôles de sécurité navigateur réussis** : authentification, appareils, coffre v3, migration conservant les brouillons et protections HTTP. **13 tests de version, livraison, mise à jour PWA et fiabilité UI réussis**.
- Version commune **0.27.0**, typecheck des workspaces, OpenAPI et client régénérés, format et `git diff --check` vérifiés. API, web et PWA reconstruits dans Docker et relancés ; services principaux et base sains. Aucune nouvelle migration, les migrations 001–016 sont conservées.
- Synchronisation automatique activée par défaut pour les nouvelles saisies signées, uniquement dans l’espace ouvert, visible et déverrouillé ; choix manuel dans « Saisies en attente ». Les anciens brouillons non signés restent manuels. Date, montant, idempotence et validations métier sont conservés. Les refus ne sont pas répétés automatiquement.
- [ADR 022](adr/022-synchronisation-automatique.md). Aucune synchronisation depuis l’application fermée, aucun code secret mémorisé et aucun déploiement distant. Les émulations ne constituent pas une qualification sur tous les téléphones physiques ; cette livraison ne prétend pas requalifier l’environnement Render distant ni le VPS.

## Correctifs de sécurité — 0.26.0, 23 octobre 2026

- **104/104 tests mobiles réussis** en 4,1 minutes, Chromium et WebKit, sur les images Docker locales finales. Code en ligne, mot de passe initial hors ligne, récupération et conservation des brouillons, reçus, thèmes, QR et parcours métier contrôlés.
- **43/43 tests API métier et migrations réussis** ; révocation des anciennes sessions PWA et conservation des mots de passe et des sessions Super Admin vérifiées séparément.
- **9/9 régressions de sécurité API réussies**, identités fictives et base PGlite isolée en configuration de production : récupération inter-groupements refusée, preuve d’appareil exigée, accès courts refusés, compteur concurrent, révocation, CSRF, isolation et quotas.
- **3/3 contrôles de sécurité navigateur réussis**, puis **3/3 sur le conteneur Render local** : CSP/en-têtes HTTP, retrait de la protection du coffre par PIN, migration v1/v2 préservant les brouillons. Aucune clé ni mot de passe en clair dans les preuves.
- **Qualification PostgreSQL 18 réussie**, migrations 001–016, **1 001 groupements et 201 201 adhésions**, historique fictif d’un jour. Pool réel : huit échecs simultanés répartis entre PIN historique et code secret, compteur à cinq, compte verrouillé et bon code ensuite refusé. RLS, concurrence idempotente et rapprochement des totaux également validés. [Rapport](recette/qualification/securite-0260.json).
- **Deux exécutions E2E ciblées réussies** : création d’un compte fictif avec mot de passe initial fort puis configuration du code et affichage QR, sur le Compose classique puis le conteneur unique Render local. La suite E2E historique complète n’est pas présentée comme validée par ce contrôle ciblé.
- **13 tests de version, déploiement, mise à jour PWA et fiabilité UI réussis**. Typecheck de tous les workspaces, version commune **0.26.0**, format, contrats régénérés et `git diff --check` vérifiés.
- API/web/PWA et conteneur Render construits ; migrations **015_trusted_devices.sql** et **016_revoke_legacy_pwa_sessions.sql** appliquées sur PostgreSQL Compose local. Base et services principaux sains ; caches anciens récupérables par le mot de passe initial. Aucune publication ni migration distante.
- Décision [ADR 021](adr/021-durcissement-authentification-pwa.md), [correctifs, preuves et limites](audits/securite-2026-10-23/CORRECTIFS.md). Les protections de Render distant, Neon, Dokploy et sauvegardes ne sont pas certifiées par cette validation locale. Avant plusieurs instances : stockage partagé du limiteur et qualification des seuils réseau.

## Charte graphique PWA — 0.25.0, 23 octobre 2026

- **104/104 tests mobiles réussis**, Chromium et WebKit, en 3,9 minutes, contre les images Docker locales finales : deux profils, apparence, campagnes, séances, tours, inscriptions, recherche, reçus, code secret, verrouillage, brouillons chiffrés et synchronisation.
- **42/42 tests API réussis**, dont un nouveau test isolé de la migration 014 : adoption des anciens défauts, conservation d’une palette plateforme personnalisée et des palettes de groupement.
- Nouvelles vérifications : taille du texte et chiffres tabulaires, contraste réel de la navigation, palettes extrêmes sur les surfaces réceptrices, absence de débordement à 360/390/430 px, texte d’accueil agrandi à 200 %, polices françaises/wolof chargées depuis les assets locaux et réouverture réellement hors ligne avec service worker.
- **5 scénarios de collecte visuelle réussis**, couvrant douze vues des comptes de démonstration en clair/sombre et un accès avec Google Fonts bloqué. Dans les textes contrôlés, aucun candidat de contraste insuffisant ; la navigation active sombre passe d’environ **4,42:1 à 8,95:1** sur la palette locale. Les mesures excluent les contrôles désactivés, les opacités composées et les dégradés non pris en charge ; elles ne constituent pas une certification WCAG.
- Ajustement des anciennes attentes de tests : 24 px maximum pour une ligne compacte comprenant un titre de 16 px, couleurs sémantiques et nouveaux fonds sombres. Les cartes gardent leurs trois/quatre lignes logiques ; les montants extrêmes et le texte agrandi peuvent se réorganiser sans être coupés.
- Typecheck des workspaces, constructions API/web/PWA, version commune **0.25.0**, quatre tests SemVer et formatage réussis. Contrat OpenAPI régénéré, API `/api/v1` conservée, `git diff --check` sans erreur.
- Migration **014_charter_default_palette.sql** appliquée. API, web, PWA et PostgreSQL sains ; le proxy PWA annonce 0.25.0. Les nouveaux défauts ne remplacent aucune palette personnalisée de groupement. Aucune publication distante.
- [Décision ADR 020](adr/020-charte-graphique-pwa.md), [réalisation et captures finales](audits/pwa-mobile-2026-10-23/charte-integree-0.25/REALISATION.md), [audit initial](audits/pwa-mobile-2026-10-23/charte-graphique/AUDIT-CHARTE.md).
- Limites : téléphones physiques, essais avec utilisatrices, toutes les personnalisations possibles et agrandissement de chaque écran secondaire restent à qualifier. L’avertissement Vite sur la taille du bundle JavaScript demeure ; la disponibilité hors ligne des fontes a été vérifiée séparément avec le service worker réel.

## Code secret PWA — 0.24.0, 23 octobre 2026

- **41/41 tests API réussis** : configuration authentifiée et protégée contre CSRF, code distinct du mot de passe initial, rotation des sessions, confirmation des opérations sensibles, cinq échecs puis blocage de quinze minutes, récupération et format strict. Les régressions métier et l’isolation restent validées.
- **96/96 tests mobiles réussis**, Chromium et WebKit, contre Docker local en quatre minutes. Après les seuls ajustements CSS de compacité et de contraste, les **10/10 scénarios du code secret** passent aussi sur les images finales (27,3 secondes), avec contrôle du contraste des pastilles sombres et de la visibilité de l’aide sur 360 × 800.
- Parcours : choix/confirmation différents puis identiques, pavé tactile, effacement, code seul après réouverture, erreur puis réussite, annulation sans envoi, preuve numérique transmise sans mot de passe, reçu après validation, cinq minutes d’inactivité, données chiffrées, délai hors ligne après cinq erreurs et connexion en ligne permettant de rétablir l’accès local.
- Un brouillon hors ligne est conservé après récupération par mot de passe initial et changement de code, puis synchronisé avec le nouveau code. La réouverture réellement hors ligne de la PWA installée est également validée avec son service worker, sur les deux moteurs.
- Le scénario WebKit initial de coupure a nécessité d’attendre l’état « versement disponible » avant de couper le réseau : le titre de la page pouvait apparaître avant la préparation des données de séance. La reprise ciblée et les suites finales passent. Le mode hors ligne reste limité aux données déjà consultées.
- Typecheck de tous les workspaces, constructions API/web/PWA, version commune 0.24.0, quatre tests SemVer, six tests de mise à jour/confirmation et formatage des fichiers modifiés : réussis. `git diff --check` sans erreur.
- Migration `013_secret_code.sql` appliquée. API, web, PWA et PostgreSQL sains ; le proxy PWA annonce 0.24.0. Serveur temporaire de vérification arrêté. Aucun déploiement distant.
- La qualification réelle a configuré le code de démonstration **2468** pour les comptes locaux `admin.ndeye` et `membre.awa`, distinct de leur mot de passe initial. Ce code appartient aux données de test locales ; aucun code par défaut n’est créé en production. Les scénarios de cotisations et de récupération utilisent un serveur simulé.
- Captures fictives : [connexion claire](audits/pwa-mobile-2026-10-23/connexion-code-clair-0.24.png), [confirmation sombre](audits/pwa-mobile-2026-10-23/confirmation-code-sombre-0.24.png). Décision : [ADR 019](adr/019-code-secret-pwa.md), qui fait évoluer l’ADR 016.
- Les émulations ne remplacent pas des essais sur téléphones physiques, lecteurs d’écran, stockage évincé par le système et interruption du processus. La clé IndexedDB ne constitue pas une garantie de stockage matériel ; les limites et la récupération du coffre sont documentées dans l’ADR 019.

## Notifications et reçus PWA — 0.23.0, 23 octobre 2026

- **38/38 tests API réussis**, dont la conservation de la date de création et de la référence lors du rejeu idempotent d’une cotisation. La réponse expose la date serveur au format ISO.
- **86 scénarios mobiles validés** sur Chromium et WebKit contre Docker local : passage complet initial à 84/86 (3,7 minutes), puis reprise réussie des deux contrôles dont l’ancienne attente cherchait la référence dans le statut temporaire plutôt que dans le nouveau reçu (2/2, 7,2 secondes). Aucun changement applicatif n’a été nécessaire pour cette adaptation de test.
- Les **huit nouveaux contrôles** couvrent l’attente de l’acquittement serveur avant le reçu, le montant et la référence, les thèmes clair/sombre, la copie du reçu, l’effacement au verrouillage, le retour du focus, le refus sans faux reçu, le réessai avec la même clé et la notification après ouverture de séance. Les paiements de ces scénarios sont simulés.
- La régression hors ligne confirme qu’un brouillon reste en attente sans reçu de réussite ; la synchronisation acceptée ouvre ensuite un reçu avec la référence serveur. Une réponse refusée conserve la saisie.
- Typecheck de tous les workspaces, construction des trois images, cohérence SemVer 0.23.0, quatre tests de version et six tests de mise à jour/confirmation : réussis. Formatage vérifié sur les fichiers modifiés, `git diff --check` sans erreur.
- API, PWA, web et PostgreSQL locaux sains ; `/api/v1/health/live` annonce 0.23.0 et la disponibilité de la base est confirmée via le proxy PWA. Serveur de vérification temporaire arrêté. Aucune migration supplémentaire ni publication distante.
- Captures avec données fictives : [encaissement clair](audits/pwa-mobile-2026-10-23/recu-encaissement-clair.png), [versement sombre](audits/pwa-mobile-2026-10-23/recu-versement-sombre.png). Les reçus longs défilent dans la fenêtre ; la fermeture reste aussi accessible dans l’en-tête.
- Le partage natif dépend des capacités et autorisations du navigateur. La copie est vérifiée avec un presse-papiers simulé ; le menu de partage réel et les lecteurs d’écran sur appareils physiques restent à qualifier.

## Groupements, verrouillage et hors ligne — 0.22.0, 22 octobre 2026

- **38/38 tests API réussis** : palette du groupement, héritage et isolation, confirmation serveur obligatoire, expiration après cinq minutes sans activité, verrouillage lié au compte et date des versements hors ligne, avec les régressions métier existantes.
- **78/78 tests mobiles réussis**, Chromium et WebKit, en 2,3 minutes contre les images Docker locales finales. Les nouveaux parcours couvrent le mot de passe à chaque ouverture, l’activité réelle, le verrouillage après cinq minutes, la confirmation et son annulation, la palette admin du groupement, le déverrouillage hors ligne, le stockage chiffré, la déconnexion hors ligne et la synchronisation manuelle avec conservation des références.
- La réouverture de l’application sans réseau utilise le **service worker réel**, puis déchiffre les données précédemment chargées après saisie du mot de passe. Les tests de transactions utilisent un serveur simulé pour éviter toute écriture financière réelle pendant les scénarios de coupure.
- Une réponse HTTP 502 incertaine conserve la saisie en attente ; l’abandon local demande le mot de passe et ne supprime aucune écriture serveur. Les refus de synchronisation sont conservés, sans changement du montant ni de la date. Les reprises utilisent la même clé d’idempotence.
- Typecheck des workspaces, constructions des trois images, version commune 0.22.0, quatre tests SemVer et six tests de mise à jour/confirmation : réussis. Formatage contrôlé sur les fichiers modifiés.
- Migration `012_group_appearance_session_activity.sql` appliquée ; API, web et PWA redémarrés. Base locale conservée. Aucun déploiement distant.
- Deux anciennes attentes de tests ont été adaptées : présence de `paidOn` dans le versement personnel et isolation du service worker dans les tests de palette avec serveur simulé. La suite complète finale passe.
- Les appareils physiques, l’éviction du stockage par le système et l’arrêt forcé du processus mobile restent à qualifier. Une première connexion en ligne est nécessaire ; les données jamais consultées ne sont pas disponibles hors ligne. Une synchronisation après le jour autorisé peut être refusée par les règles métier.
- Captures fictives : [couleurs du groupement](audits/pwa-mobile-2026-10-22/apparence-groupement-0.22.png), [synchronisation en attente](audits/pwa-mobile-2026-10-22/synchronisation-hors-ligne-0.22.png).
- Décisions : [ADR 016](adr/016-reconnexion-pwa.md), [ADR 017](adr/017-palette-groupement.md), [ADR 018](adr/018-hors-ligne-chiffre.md).

## Palette commune et reconnexion PWA — 0.21.0, 22 octobre 2026

- **33/33 tests API réussis** : permissions, validation hexadécimale, CSRF, persistance, politique RLS et audit de la palette, avec les parcours métier existants.
- **66/66 tests mobiles réussis**, Chromium et WebKit (1,9 minute), contre les images locales 0.21.0 : connexion initiale, mot de passe seul, validation au clavier, expiration, erreur de mot de passe, changement de compte, stockage bloqué/invalide, personnalisation et contraste clair/sombre, aperçu puis enregistrement et restauration des couleurs.
- Le premier passage a révélé une interférence entre le service worker WebKit et l’interception du serveur d’authentification simulé. Le service worker est désactivé dans cette seule fixture ; les tests de connexion réelle contre Docker le conservent. La reprise ciblée (4/4), puis la suite complète (66/66) passent.
- Typecheck des workspaces, constructions API/web/PWA, trois images Docker, version commune 0.21.0, quatre tests SemVer et formatage des fichiers modifiés : réussis.
- Migration `011_platform_appearance.sql` appliquée à PostgreSQL local ; API et interfaces relancées. Vérification visuelle du formulaire dans le navigateur connecté, puis de l’écran « Bon retour ». Aucun déploiement distant.
- Ces tests sont des émulations ; le clavier réel et les propositions du gestionnaire de mots de passe restent à vérifier sur des téléphones physiques.
- Captures avec comptes fictifs : [reconnexion Android](audits/pwa-mobile-2026-10-22/reconnexion-android.png), [reconnexion iPhone](audits/pwa-mobile-2026-10-22/reconnexion-iphone.png), [palette commune sombre](audits/pwa-mobile-2026-10-22/palette-commune-sombre.png).
- Décisions : [ADR 015 — Palette](adr/015-palette-commune.md) et [ADR 016 — Reconnexion](adr/016-reconnexion-pwa.md).

## Intégration Action du jour — 0.20.0, 22 octobre 2026

- Images Docker API, web et PWA construites et relancées ; services sains. Base locale conservée, aucun déploiement distant.
- `npm run test:mobile` : **52/52 tests réussis**, sur Chromium et WebKit (1,9 minute), contre la PWA Docker sur le port 8086.
- Couverture : accueils membre/responsable, six campagnes et deux rangées à 360/390/430 px, clair/sombre, cartes QR, scan d’image, versement libre/fixe avec récapitulatif, ouverture de séance, tirage, filtres et adhésions, reprise de pagination, confidentialité et retour du navigateur.
- Vérification visuelle complémentaire dans le navigateur connecté : accueil responsable, passage à l’épargne personnelle et compte membre, puis retour à la gestion. Aucune écriture financière réalisée pendant cette vérification.
- Typecheck des workspaces, constructions des clients, contrôles de version, quatre tests SemVer et formatage des fichiers modifiés : réussis.
- Les émulations ne remplacent pas des essais sur appareils physiques ni les tests d’usage avec les utilisatrices. [Compte rendu et captures](audits/pwa-mobile-2026-10-22/INTEGRATION-ACTION-DU-JOUR.md).

## Apparence PWA — 0.19.0, 22 octobre 2026

- `npm run typecheck`, `npm run version:check`, `npm run test:version` (4 tests) et construction PWA : réussis.
- `tests/mobile/appearance.test.ts` : **8 scénarios réussis**, avec émulation Android Chromium et iPhone WebKit, sur la construction locale.
- Vérifications : Automatique suit le système, un choix explicite prévaut, persistance après rechargement, synchronisation entre onglets, préférence invalide et stockage bloqué.
- Les deux profils sont couverts, avec formulaires, cartes épargne/tontine et QR noir sur blanc. Les textes contrôlés atteignent un contraste d’au moins 4,5:1 en sombre. Ce contrôle ciblé ne constitue pas une certification d’accessibilité de l’ensemble de la PWA.
- API entièrement simulée dans ces huit scénarios : aucune transaction financière créée. Il ne s’agit pas d’un essai sur téléphones physiques ni d’un déploiement distant.
- Images locales API, web et PWA 0.19.0 construites et relancées, services sains. Les quatre parcours existants de `tests/mobile/pwa-mobile.test.ts` passent ensuite sur Docker (`http://localhost:8086`) : navigation membre/responsable, confidentialité, ouverture/fermeture du QR et retour du focus, avec Chromium et WebKit.

Commande : `PWA_URL=http://127.0.0.1:8770 npx playwright test --config playwright.mobile.config.ts tests/mobile/appearance.test.ts` (Node 24, serveur Vite preview de la construction PWA).

## Historique étendu — outillage 0.6.4

Qualification réussie le 19 octobre 2026 sur l’application 0.6.2 : 2 012 010 cotisations initiales, puis 60 lectures et 60 écritures sur deux groupements en 65 secondes, sans erreur et avec totaux API/SQL concordants. p95 : 184 ms en lecture, 10 ms en écriture. Le stockage isolé a été supprimé. Voir [les résultats et limites](recette/QUALIFICATION-VOLUMES.md). L’endurance et la recette sur appareils physiques restent ouvertes.

## Qualification des volumes — outillage 0.6.3

La qualification isolée sur PostgreSQL réel passe avec 1 001 groupements et 201 201 adhésions/cotisations initiales, contrôle RLS et écritures concurrentes. L’application testée est l’image locale 0.6.2. Voir [le rapport détaillé](recette/QUALIFICATION-VOLUMES.md). Il ne s’agit pas d’une qualification de charge prolongée ou de production.

## Recette mobile et outillage 0.6.1 — 18 octobre 2026

Les résultats récents et leurs limites sont dans [le compte rendu du lot 6](recette/LOT6.md). La suite complète de 28 tests passe avant la correction de focus WebKit ; les 4 parcours mobiles passent après cette correction en 0.6.1. Un essai k6 local de 5 utilisatrices virtuelles sur 30 secondes passe, sans qualification de la cible de 200 000 membres. Les sections ci-dessous sont des résultats historiques.

## Validation locale de la version 0.2.0

Exécutée le 15 octobre 2026 sur l'environnement local (PostgreSQL Docker 5433, Node v20.20.2).

### Résultats validés

- **Tests d'intégration API (16/16 réussis) :**
  - Authentification obligatoire et CSRF contrôlé.
  - Isolation RLS entre groupements et contexte de transaction.
  - Droits super administrateur en consultation sauf activation.
  - Les membres ne créent pas de campagne et ne voient pas la liste complète des membres.
  - Rôle administrateur attribué uniquement par super administrateur.
  - Cotisation idempotente et détection de contenu différent.
  - Versement libre et confidentialité de la vue membre.
  - Contrôles montants, dates et pagination.
  - Une administratrice conserve une vue de sa propre épargne.
  - Désactivation bloque la saisie et reste consultable.
  - Annulation conserve la cotisation et corrige les totaux.
  - OTP à usage unique, nombre de tentatives limité.
  - Déconnexion invalide la session.
  - **Authentification membre par code PIN à 4 chiffres et verrouillage anti-bruteforce (5 tentatives).**
  - **Gestion membre : adresse, sexe, fonction de groupement, blocage et déblocage avec traçabilité.**
  - **Tontine rotative (ROSCA), tirage au sort automatique, séances et état de la caisse en temps réel.**
- **Tests SemVer et synchronisation monorepo (4/4 réussis) :**
  - Validation SemVer des versions et préversions.
  - Respect de la progression SemVer.
  - Synchronisation parfaite des 6 packages (`package.json`, `package-lock.json`), manifestes et images sans régression.
  - Blocage de livraison si désynchronisation.
- **Typecheck & Build :**
  - TypeScript : 0 erreur sur l'ensemble des workspaces (`@aveclesfemmes/api`, `@aveclesfemmes/super-admin-web`, `@aveclesfemmes/membres-pwa`, `@aveclesfemmes/ui`, `@aveclesfemmes/api-client`).
  - Build Vite / PWA : génération propre des bundles et du service worker de cache PWA.
  - Formatage de code Prettier conforme sur 100% des fichiers.
- **Contrats et schémas :**
  - Schéma OpenAPI mis à jour (`docs/openapi.json`).
  - Typage TypeScript généré et synchronisé (`packages/api-client/src/schema.d.ts`).
  - Migration SQL `002_fonctions_tontines_qr.sql` appliquée et validée avec RLS complet (y compris politique UPDATE pour gestion membre).
  - Migration SQL `003_group_types_assignment.sql` appliquée et validée : table `groupment_types` avec RLS, politiques de lecture/écriture et attribution des types et événements lors de la création d'un groupement.
  - Migration SQL `004_types_crud_permissions.sql` appliquée et validée : politiques RLS UPDATE/DELETE pour super-admin sur `campaign_types`, politiques RLS pour création et modification des campagnes par le super-admin, et endpoints PATCH/DELETE complets.
  - **CRUD Événements & Types (Super Admin) :** création, modification et suppression sécurisées avec vérification des liaisons en cascade (campagnes actives).
  - **Recherche autocomplete & Détails groupement (Super Admin & Admin Groupement) :** refonte ergonomique accessible pour profils non-numériques (champ clair, déroulement direct via bouton chevron sans frappe obligatoire, badge du groupement actif, cartes de groupements enrichies avec adresse, téléphone et statut actuel).
  - **Bouton Créer une campagne :** disponible directement sur l'onglet Campagnes dès la sélection d'un groupement pour le super-admin et l'admin groupement.
  - **Sous-onglets de campagne (Participantes/Forfaits & Sessions) :** affichage détaillé sans bouton redondant, table des sessions avec métriques et totaux.
  - **Filtres autocomplete cotisations (Épargne & Tontine) :**
    - Type Épargne : filtre par session passée en liste autocomplete (dates réelles des séances, nombre de versements, total collecté) et filtre par membre autocomplete (avatar, nom, téléphone).
    - Type Tontine : filtre par période passée en liste autocomplete (tours de rotation, date, nom de la bénéficiaire, total collecté) et filtre par membre.
    - Bannière récapitulative des filtres actifs avec pastilles détachables et bouton de réinitialisation générale.
  - **Informations de connexion & Préremplissage 1-clic sur les pages de connexion :**
    - Console Super Admin : carte des identifiants avec compte `superadmin`, téléphone `+221770000001`, mot de passe commun (copier/révéler) et boutons de préremplissage automatique en un clic.
    - PWA Membres & Groupements : carte des identifiants avec compte administratrice (`admin.ndeye`, `+221770000002`), compte membre (`membre.awa`, `+221770000003`), indications pour connexion SMS et Code PIN, et boutons de préremplissage automatique.
  - **Tests E2E Playwright (13/13 réussis) :** validation de bout en bout de l'ensemble des parcours (dont les nouveaux parcours CRUD Événements/Types, autocomplétion + fiche détaillée + QR code groupement, création directe de campagne, archives/campagnes, sous-onglets, filtres cotisations et informations de connexion avec pré-remplissage).

---

## Validation locale du socle 0.1.0

Exécutée le 14 octobre 2026 sur des données fictives.

### Résultats

- Vérification TypeScript des trois applications réussie.
- Compilation de l’API, du web et de la PWA réussie ; manifest et service worker générés.
- Treize tests API réussis sur PostgreSQL embarqué avec les politiques RLS réelles.
- Cinq parcours Chromium réussis sur les conteneurs : super administrateur, saisie administratrice et vue personnelle, membre sur téléphone, OTP et déconnexion, double envoi concurrent.
- Trois requêtes concurrentes avec la même clé ont créé une seule cotisation sur PostgreSQL Docker.
- Quatre services applicatifs en bonne santé : PostgreSQL, API, web et PWA.
- Images de base Node.js, PostgreSQL et Nginx figées par empreinte ; images applicatives construites à plusieurs étapes.
- Audit npm sans vulnérabilité signalée après correction de js-yaml ; ce contrôle ne remplace pas l’analyse des images système.
- Sauvegarde pg_dump restaurée avec pg_restore dans la base locale séparée aveclesfemmes_restorecheck. Compteurs identiques au moment de la vérification : 5 groupements, 3 adhésions, 5 cotisations et 4 300 FCFA valides. Les données de démonstration peuvent ensuite changer lors de nouvelles recettes.

### Portée

Ces vérifications démontrent le fonctionnement du socle local. La capacité à plus de 1 000 groupements et 200 000 membres, les délais RPO et RTO, la disponibilité en production et l’envoi SMS réel ne sont pas encore qualifiés. La CI est définie mais n’a pas été exécutée sur GitHub. Aucun registre externe ni hébergement de production n’a été configuré ou publié.

Les hypothèses métier et les fonctions restant à préciser sont dans IMPLEMENTATION.md. La mise en production exige le cadrage final, les tests de charge et le pilote.

### Épargne, QR et historique — version 0.9.0 (19 octobre 2026)

- Le bouton QR ouvre la caméra arrière ou permet de choisir une image ; les pixels restent sur l’appareil. Le serveur valide le groupement, l’inscription, l’activité et le blocage de la membre. Le scan préremplit le formulaire ; le montant et la confirmation restent nécessaires.
- Une flèche déplie chaque séance ; « Encaissements de cette séance » ouvre son historique filtré. Les cinq dernières participantes et « Voir plus » sont conservés.
- L’historique présente les encaissements par date, avec montant, référence, statut et heure d’enregistrement (Dakar). Recherche, plage de dates et état sont filtrés côté serveur avant pagination.
- Démonstration locale : `node scripts/demo/savings-today.mjs` avec le Node du projet et `DEMO_PASSWORD` dans `.env`. Le script cible exclusivement localhost:3005 et le compte `admin.ndeye`. Il crée deux campagnes TEST du jour : « À ouvrir » et « Encaisser », cette dernière avec six versements fictifs (9 000 FCFA). Les campagnes existantes restent intactes. Les clés d’idempotence rendent les relances sûres.
- Les campagnes de test se terminent le jour même : relancer le script un autre jour pour tester à nouveau l’ouverture, sans assouplir les règles métier.
- Aucun déploiement distant effectué pour cette version.

### Vérification finale — 21 octobre 2026

- TypeScript et cohérence des versions : succès, version locale 0.9.0.
- 14 tests mobiles réussis sur Chromium Android et WebKit iPhone après les derniers ajustements, dont le décodage d’une vraie image QR et la présélection du membre. Les 21 tests API du lot sont également réussis.
- Services Docker reconstruits et disponibles sur les ports locaux habituels.
- Deux campagnes de démonstration créées pour le 21 octobre, avec Ndèye Diop, Awa Fall et Mariama Bâ : ouverture disponible, et séance ouverte avec six encaissements fictifs totalisant 9 000 FCFA.
- Vérification dans le navigateur du compte connecté : les boutons d’ouverture et d’encaissement du jour s’affichent selon la campagne choisie.
- Le scan par caméra est implémenté ; la validation automatisée utilise une image QR, sans caméra physique.

### Cahiers de séance — version 0.9.1 (21 octobre 2026)

- Cinq séances visibles au départ, triées par date décroissante. « Voir plus » ajoute les cinq suivantes ; « Voir moins » revient aux cinq dernières.
- Cartes avec le bandeau d’icône, les couleurs du type de campagne et la flèche du bouton d’encaissement. Le dépliage conserve les attendus, versements et statuts des membres.
- Recherche indépendante dans chaque séance, sans distinction de casse ou d’accents, sur tous ses membres (y compris ceux sans versement et ceux hors de l’aperçu des cinq derniers cotisants). Les totaux de séance ne changent pas lors du filtrage.
- Vérification mobile dédiée : sept séances servies dans le désordre, affichage initial de cinq, dépliage des autres, réduction, recherche d’une membre n’ayant pas cotisé, recherche sans accent et absence de résultat.
- Résultat : 14 tests mobiles réussis sur Android Chromium et iPhone WebKit. Après correction du clic sur une campagne déjà sélectionnée, les deux tests ciblés de navigation sont également réussis ; le solde reste affiché.
- TypeScript, cohérence des versions et reconstruction Docker locale : succès, version 0.9.1. Recherche `ndeye` vérifiée dans le navigateur du compte connecté : Ndèye Diop apparaît avec son statut sans cotisation.

### Épargne et tontine — version 0.10.0 (21 octobre 2026)

- Dans une séance d’épargne : suppression du bouton interne « Encaissements de cette séance », nombre de membres sans versement en rouge et filtre Tous / Cotisé / Pas cotisé, combinable avec la recherche par nom. Les cinq membres de l’aperçu sont filtrés à partir du registre complet.
- Tontine : montant individuel à cotiser, total encaissé et total reversé sur une même ligne. La liste des membres apparaît après la carte de tirage ; sélection du tour, recherche et filtre d’état sont appliqués côté serveur avant pagination.
- « Cotisé » signifie au moins un versement valide sur la période du tour. Un versement inférieur au forfait reste signalé comme partiel. Un versement annulé est exclu du suivi.
- Les périodes suivent les échéances des tours et leur intervalle (hebdomadaire, toutes les deux semaines ou mensuel), avec une borne de fin exclue. Les compteurs payés / sans versement restent ceux du tour complet pendant une recherche.
- Un tirage déjà enregistré ne peut plus être remplacé par un nouveau tirage. Les écritures existantes sont conservées ; le bouton devient « Tirage effectué ».
- Démonstration exclusivement locale : `node scripts/demo/tontine.mjs`, compte `admin.ndeye` et secret `DEMO_PASSWORD` lu dans `.env`. « Tontine TEST À tirer » inscrit Ndèye Diop, Awa Fall et Mariama Bâ, à 2 000 FCFA chacune, sans lancer le tirage. « Tontine TEST Suivi » contient un tirage de trois bénéficiaires uniques, 9 000 FCFA de versements fictifs et un reversement fictif de 6 000 FCFA ; le tour courant présente deux membres ayant versé, dont un partiellement, et un membre sans versement.
- Les scripts de démonstration réutilisent leurs campagnes dédiées et leurs clés d’idempotence ; ils ne remplacent pas les campagnes et les tirages existants. Aucun déploiement distant pour ce lot.
- Validation : 22 tests API réussis. Les 14 parcours mobiles existants réussissent, puis les deux nouveaux tests Android / iPhone de suivi des membres et de changement de tour passent après l’ajout du libellé explicite du sélecteur : 16 parcours mobiles validés au total.
- Vérification réelle en local : « Tontine TEST Suivi » affiche 2 000 / 9 000 / 6 000 FCFA ; « Tontine TEST À tirer » affiche trois membres sans versement et un bouton « Tirage au sort » actif. Cette dernière est laissée prête à tirer dans le navigateur.

### Tirage par tour — version 0.11.0 (21 octobre 2026)

- Les tours se présentent sous forme de cartes de séance : date, bénéficiaire, attendu, versé et membres sans versement. Le détail du tour contient sa liste de membres avec recherche et état. La carte séparée « Membres de la tontine » est supprimée.
- Le calendrier de la rotation est préparé à partir de la date de campagne, de son intervalle et des participantes inscrites. Les tours sans tirage n’ont pas de bénéficiaire attribuée ; leur consultation n’écrit aucune ligne de tirage.
- Un administrateur du groupement effectue le tirage le jour prévu du tour (date serveur, Africa/Dakar). Une bénéficiaire déjà tirée dans cette campagne est exclue des candidats suivants ; le dernier membre éligible peut ainsi recevoir le dernier tour. Les membres bloqués ou inactifs ne sont pas candidats.
- L’API sérialise le tirage sur la campagne. Un double lancement le même jour renvoie le même tirage et ne crée pas de nouvelle attribution. Les participations sont figées après le premier tirage pour stabiliser le calendrier du cycle.
- Encaissement : date du jour uniquement, dans la période du tour courant et après son tirage. Le bouton d’encaissement et le scan sont remplacés par « Tirer la bénéficiaire du tour » tant que la condition n’est pas remplie. La bénéficiaire désignée apparaît ensuite avant la saisie.
- Migration 007 : conservation des attributions déjà enregistrées en les marquant comme tirages effectués. Aucun tirage historique ni reversement n’est effacé. Les nouvelles campagnes ne désignent plus leurs bénéficiaires futures à l’avance.
- Les mois courts sont bornés au dernier jour du mois et restent ancrés sur la date initiale, pour éviter les trous de calendrier (31 janvier → 28 février → 31 mars).
- Démonstration locale : `node scripts/demo/tontine.mjs` prépare « Tontine TOUR TEST À tirer » et « Tontine TOUR TEST Encaisser ». Cette dernière a seulement le tour du jour tiré, 3 000 FCFA fictifs versés et ses tours suivants sans bénéficiaire.
- Tests API : encaissement avant tirage rejeté, tirage hors date rejeté, permissions, double lancement, bénéficiaires distinctes entre les tours, dernier membre éligible, absence de réattribution et dates mensuelles.

- Résultat : 23 tests API et 18 tests mobiles Android / iPhone réussis. Version 0.11.0 et TypeScript cohérents ; images locales reconstruites et migration 007 appliquée. À la création du jeu de test, la campagne « Encaisser » a le tour du jour tiré et 3 000 FCFA fictifs ; « À tirer » attend son tirage. Son état peut ensuite changer lors des essais interactifs.

### Tours et délais individuels — version 0.12.0 (21 octobre 2026)

- Tour du jour/en cours en tête, puis trois tours passés triés par date décroissante ; Voir plus ajoute trois tours, Voir moins rétablit trois. Les tours futurs sont masqués sur l’accueil.
- Tests mobiles avec calendrier volontairement désordonné : tour 7 en tête, puis 6 / 5 / 4, puis 3 / 2 / 1 après Voir plus. Le tour futur 8 reste masqué. Le parcours tirage → bénéficiaire → encaissement reste validé.
- Grille d’accueil limitée à huit emplacements et deux lignes : au maximum six campagnes, Plus et Historique. La campagne sélectionnée reste visible. Sélection depuis Plus, fermeture du dialogue, contexte d’encaissement et absence de débordement contrôlés.
- Formulaire individuel lié au membre et à la date du tour, limite avant le prochain tour. Les tests API couvrent l’échéance inclusive, l’absence après expiration, la prolongation, le refus d’un raccourcissement, les dates invalides/passées, le mauvais tour, le membre non inscrit et les rôles non autorisés. Un versement valide, y compris partiel, annule l’affichage « Absent » et ferme l’octroi de délai.
- L’absence est un statut calculé lors de la consultation : sans délai accordé, le membre reste « N’a pas cotisé ». Aucune sanction financière automatique. Les octrois et prolongations sont audités.
- Résultat : 23 tests API réussis et 20 tests mobiles réussis (Android Chromium et iPhone WebKit). Les nouveaux parcours mobiles utilisent des réponses simulées pour contrôler précisément les dates et les délais ; les règles sont aussi exercées dans les tests API avec PGlite. Reconstruction Docker locale réussie et versions cohérentes à 0.12.0. Vérification visuelle sur le jeu de démonstration, avec accès au formulaire depuis un membre du tour du jour. Aucun déploiement distant pour ce lot.
- Capture locale : [Détail du tour et délai individuel](recette/pwa-delai-grace-0.12.0.png).

### Cartes compactes et bénéficiaire — version 0.13.0 (21 octobre 2026)

- Résumés de séances et tours : trois lignes mesurées dans les tests mobiles, sans retour à la ligne ni débordement. Date et non-cotisants, versé/attendu, puis participantes ou bénéficiaire. Les valeurs complètes sont consultables en ouvrant le détail.
- Menu Campagnes de la PWA : quatre lignes par résumé, sélection au toucher et actions conservées dans le détail. Les tests vérifient le nombre et la hauteur des lignes, l’ajout de membre, la désactivation et le changement de campagne entre tontine et épargne. Le tableau Super Admin conserve son affichage.
- Bénéficiaire : indicateur dans la liste du tour, aucun bouton de délai même en présence d’une réponse cliente incohérente. L’API identifie la bénéficiaire, neutralise l’absence et l’affichage d’un ancien délai, et rejette l’octroi direct d’un délai. Le test API choisit explicitement une autre participante pour vérifier l’octroi et la prolongation.
- Résultat : TypeScript et version 0.13.0 cohérents, 23 tests API et 20 tests mobiles Android Chromium/iPhone WebKit réussis. Conteneurs locaux reconstruits et contrôle visuel du menu Campagnes effectué. Aucun déploiement distant pour ce lot.
- Capture : [Campagnes compactes](recette/pwa-campagnes-compactes-0.13.0.png).

### Campagnes et adhésions — version 0.14.0 (21 octobre 2026)

- PWA : retrait des panneaux Participantes/forfaits et Sessions du menu Campagnes, retrait de l’action Délai sur les cartes, ajout d’un membre disponible sur carte fermée et identité du groupement en deux lignes.
- Raccourcis : choix de six campagnes maximum, enregistrés par administrateur et groupement avec RLS (migration 008). Sélection vide conservée, vérifications de rôles, de groupement, d’unicité et de limite. Les autres campagnes restent dans Plus, même quand elles sont consultées. La case réagit immédiatement ; un échec serveur rétablit la sélection précédente.
- Adhésion : recherche des membres actifs non bloqués et non inscrits, filtre appliqué avant pagination. Test avec plus de 200 membres, accents, doublons et isolation entre groupements. Inscription et contrôle des montants sérialisés sur la campagne.
- Tontine : montant commun obligatoire à la création, lecture seule à l’ajout ; montant libre ou forfait individuel différent refusé. Épargne : Libre ou Fixe au standard ; un encaissement fixe d’un montant différent est refusé, les montants libres variables sont acceptés. Les versements antérieurs restent conservés.
- Résultat : 26 tests API réussis. Les 20 parcours mobiles de régression passent ; les deux nouveaux parcours Android/iPhone sont repris après correction de la réaction tactile de la case et séparation du libellé du montant de son aide, puis réussissent. Total : 22 parcours mobiles validés. TypeScript validé par la reconstruction des deux interfaces, versions synchronisées à 0.14.0 et conteneurs locaux reconstruits. Contrôle visuel du menu Campagnes effectué ; aucun déploiement distant pour ce lot.
- Les nouveaux parcours mobiles simulent les réponses des campagnes et adhésions ; l’API et la migration sont testées avec PGlite. Les scripts de démonstration respectent désormais les montants fixes/libres et évitent de réinscrire les membres ou de remplacer des versements existants. Leur syntaxe est vérifiée ; ils ne sont pas exécutés pour cette livraison.
- Capture locale : [Campagnes et adhésions](recette/pwa-campagnes-adhesions-0.14.0.png).

### Filtres et cartes Membres — version 0.15.0 (21 octobre 2026)

- Campagnes : filtre par type sur toutes les campagnes actives, sélectionnées visibles par défaut et Voir plus pour les non sélectionnées. Les tests contrôlent le changement de type, l’exclusion des campagnes archivées, la persistance des raccourcis et le retrait immédiat d’une carte décochée.
- Adhésion : un seul sélecteur avec recherche intégrée, résultats limités aux non-inscrits, sélection tactile ou par Entrée et conservation des règles fixe/libre. Régression couverte : fermer le formulaire lorsque sa liste est ouverte doit fonctionner au premier appui ; la fermeture extérieure de la liste intervient après le clic pour éviter le déplacement du dialogue pendant le geste.
- Membres : cartes de trois lignes, détail des inscriptions actives et archivées, montants versés uniquement pour l’épargne, actions QR/PIN/blocage conservées. Contrôles de hauteur des lignes, de recherche sans accent et d’absence de débordement à 360 px.
- API : 27 tests réussis, dont le cumul net des annulations, les inscriptions archivées et l’isolation de la vue personnelle. Les nouveaux parcours d’interface simulent les campagnes/adhésions et les membres ; les règles serveur sont aussi exercées avec PGlite.
- Contrôle réel dans la PWA locale : filtre Épargne et Voir plus, sélecteur intégré avec pagination des non-inscrits, carte Ndèye Diop et son épargne de 28 000 FCFA. Aucune inscription créée lors de ce contrôle. Capture : [Membres et campagnes](recette/pwa-membres-campagnes-0.15.0.png).
- Résultat final : 27 tests API et 24 tests mobiles Android Chromium/iPhone WebKit réussis. TypeScript et constructions Docker validés, version synchronisée à 0.15.0, services locaux sains. Aucun déploiement distant pour ce lot.

### Accueil et versements membres — version 0.16.0 (21 octobre 2026)

- Accueil personnel commun au groupement : coordonnées, QR personnel, total personnel et campagnes actives inscrites. Contrôlé pour le membre et pour l’administratrice en mode personnel. Les données du nouveau parcours proviennent d’endpoints personnels explicites ; la PWA ne réutilise pas les agrégats du groupement.
- Épargne : badge des séances ouvertes passées non versées après inscription ; séance du jour ouverte requise pour le versement. Cinq versements par défaut, Voir plus et filtre serveur par séance, cartes de trois lignes. Le total ignore les annulations et les références restent consultables.
- Tontine : calendrier complet pour les inscrits, même lorsque RLS ne permet de lire que leur participation ; tirage préalable, montant commun en lecture seule, unicité par tour, cinq tours passés avec bénéficiaire et filtre. Les noms des bénéficiaires sont accessibles aux seuls inscrits ; les coordonnées et les autres versements restent protégés.
- API : 30 tests réussis. Les nouveaux scénarios couvrent deux requêtes de versement concurrentes, rejeu idempotent, changement de jour, annulation/remplacement, montant fixe/libre, tour suivant, dates du calendrier, non-inscription, blocage, campagnes archivées et portée personnelle. La base PGlite exécute la migration 009 avec le rôle applicatif ; elle sérialise les transactions des tests et ne constitue pas une qualification de charge PostgreSQL réelle.
- Interface : 28 parcours Android Chromium/iPhone WebKit réussis, dont quatre nouveaux scénarios avec réponses simulées (pagination/filtre, badge, total, confirmation unique, tirage requis et forfait). Six tests de protection des mises à jour et de confirmation après réponse serveur réussissent également. Le serveur temporaire utilisé pendant le téléchargement Docker a été arrêté ; la recette complète s’exécute sur les conteneurs.
- Contrôle réel du compte Awa : épargne du 21 octobre, 3 000 FCFA et versement désactivé car déjà effectué ; tontine Suivi, 4 000 FCFA personnels, un reversement effectué et deux mois restants. Tour 1 reversé à Awa, tour 2 désigné pour Ndèye et non encore reversé. Aucune cotisation réelle créée pendant ce contrôle, aucun déploiement distant.
- Constructions Docker et TypeScript validés, migration 009 appliquée localement, versions synchronisées à 0.16.0 et quatre services sains. La première installation npm Docker a subi une coupure réseau ; la reprise a réussi.
- Captures réelles : [Accueil membre](recette/pwa-accueil-membre-0.16.0.png), [Tontine membre](recette/pwa-membre-tontine-0.16.0.png).
- Après alignement final de la flèche et du corps des cartes : huit parcours membre/administratrice personnelle repris sur Android/iPhone et réussis. [Capture mobile réelle du compte Awa](recette/pwa-accueil-membre-mobile-0.16.0.png).

### Historique global et accueil personnel — version 0.17.0 (21 octobre 2026)

- Montant personnel d’épargne avant la liste des versements ; campagnes d’accueil choisies et conservées par compte/groupement, séparément de l’administration. Sélection vide, choix depuis Plus sans ajout automatique, rejet d’une campagne étrangère/non inscrite/archivée, unicité et maximum de six vérifiés.
- Historique global incluant les archives et annulations, pagination après filtres et total net. Tests des intersections type/campagne, des séances et tours combinés par OU, du même jour entre épargne et tontine, d’une pagination à une ligne, des valeurs invalides, des résultats vides et de l’isolation membre/administratrice personnelle/autre groupement.
- Badges d’épargne et de tontine : période ouverte/tirée du jour incluse, absence de versement valide, puis disparition après versement. Les séances antérieures à l’inscription restent exclues.
- Résultat API : 32 tests réussis avec PGlite et rôle applicatif, migration 010 comprise. TypeScript, formatage, contrats OpenAPI et version 0.17.0 cohérents. Reconstruction Docker locale réussie, quatre services sains ; aucun déploiement distant.
- Résultat mobile : 31 scénarios de la suite complète réussissent immédiatement. Le test de refus d’enregistrement sur iPhone est adapté pour employer un appui tactile, car le retour arrière immédiat rendait incompatible la commande de test exigeant un état coché persistant. Les quatre scénarios d’historique/préférences Android/iPhone sont ensuite repris et réussissent, sans modification du comportement applicatif. Total : 32 scénarios mobiles distincts validés.
- Contrôle réel du compte Ndèye en mode personnel : 15 versements pour 30 000 FCFA par défaut ; filtre Épargne, 14 versements pour 28 000 FCFA ; deux types et un tour précis, un versement pour 2 000 FCFA. Coordonnées, badges des deux types et montant collecté avant la liste vérifiés sur l’accueil. Aucune préférence ni cotisation réelle modifiée pendant ce contrôle.
- Captures : [Accueil personnel](recette/pwa-accueil-personnel-0.17.0.png), [Historique filtré](recette/pwa-historique-personnel-0.17.0.png).

### Bandeau membre fixe — version 0.17.1 (21 octobre 2026)

- Montant et nom de campagne retirés du bandeau personnel. Téléphone, adresse et nom du groupement sur trois rangées ; QR personnel de 180 px sur les trois rangées suivantes, vert constant. Le montant collecté reste avant la liste des versements ; sa commande de confidentialité est dans le détail de campagne.
- Validation ciblée : 12 parcours Android Chromium/iPhone WebKit réussis (accueil membre, administratrice personnelle, QR, historique et préférences). La grille de six rangées et la largeur du QR sont mesurées ; contenu HTML, couleur et hauteur du bandeau restent identiques après passage de l’épargne à la tontine.
- TypeScript, formatage, version 0.17.1 et constructions Docker validés. Contrôle visuel réel du bandeau personnel effectué, sans saisie de cotisation ni déploiement distant.
- Capture : [Bandeau membre fixe](recette/pwa-bandeau-membre-fixe-0.17.1.png).

### Listes personnelles ciblées — version 0.17.2 (22 octobre 2026)

- Mes campagnes : seules les campagnes sélectionnées sont affichées. Fenêtre Choisir mes campagnes pour gérer les choix ; sélection vide, persistance après rechargement et restauration après erreur vérifiées sur Android Chromium et iPhone WebKit simulés. Les campagnes non sélectionnées restent dans Plus.
- Mes versements : cinq dernières lignes par défaut ; Voir plus ajoute cinq lignes et un changement de filtre revient à cinq. Totaux calculés sur tous les résultats filtrés, archives et filtres multiples conservés.
- Validation ciblée : 12 tests mobiles réussis, TypeScript et cohérence de version 0.17.2 validés. Constructions Docker réussies et services locaux démarrés. Les tests de listes utilisent des réponses simulées ; les parcours de connexion, navigation et QR utilisent l’API locale.
- Contrôle réel du compte Awa : six campagnes sélectionnées dans Mes campagnes ; neuf choix disponibles dans la fenêtre de configuration, sans modification des préférences. Historique : cinq lignes parmi 57 versements puis dix après Voir plus, total net de 15 000 FCFA inchangé. Aucun versement créé et aucun déploiement distant.
- Captures : [Campagnes sélectionnées](recette/pwa-membre-campagnes-selectionnees-0.17.2.png), [Cinq derniers versements](recette/pwa-membre-cinq-versements-0.17.2.png).

### Identité membre et navigation commune — version 0.18.0 (22 octobre 2026)

- Bandeau personnel : nom et identifiant en gras (graisse calculée >= 700), six rangées, QR de 180 px conservé. Identité, couleur, contenu et hauteur stables après sélection d’une autre campagne. Bouton Mon Code QR absent en mode membre et administratrice personnelle ; carte QR accessible depuis le bandeau avec restauration du focus après fermeture.
- Raccourcis et cartes : composants communs aux deux profils ; commande Afficher sur l’accueil commune à Plus, la personnalisation personnelle et aux cartes de gestion. Couleur par type, état de sélection et badges personnels conservés.
- Plus : ajout direct vérifié avec réponses simulées pour le membre et l’administratrice ; carte retirée de Plus, raccourci ajouté sur l’accueil, sélection conservée après rechargement. Compteur et garde de six emplacements, blocage pendant la sauvegarde et retour arrière après erreur conservés. Il s’agit d’une préférence d’affichage, sans modification de l’activité métier de la campagne.
- Résultat : 20 scénarios mobiles distincts Android Chromium/iPhone WebKit validés. Dix-huit passent au premier lancement ; le parcours d’adhésion est repris avec un appui tactile au lieu de uncheck, car la carte décochée disparaît aussitôt. Les deux reprises passent. Aucune correction applicative nécessaire après cette adaptation du test.
- TypeScript, formatage, version 0.18.0, génération des contrats et constructions Docker validés. Contrôle réel du compte Awa : identité en gras, retrait du bouton dupliqué et commandes d’ajout depuis Plus. Aucune préférence ni cotisation réelle modifiée ; aucun déploiement distant. Les scénarios de QR, navigation et historique groupé utilisent l’API locale ; ceux de sélection et d’adhésion utilisent des réponses simulées.
- Captures : [Identité et raccourcis](recette/pwa-identite-membre-0.18.0.png), [Plus membre](recette/pwa-plus-membre-0.18.0.png), [Vue mobile réelle](recette/pwa-identite-membre-mobile-0.18.0.png).

### Audit des interfaces PWA — 22 octobre 2026, version 0.18.0

- [Rapport de revue et d’audit](audits/pwa-mobile-2026-10-22/AUDIT-PWA.md) : deux profils, trois largeurs CSS (360/390/430), Chromium Android et WebKit iPhone simulés ; revue manuelle complémentaire de l’administratrice en mode personnel.
- 16 scénarios d’observation exécutés et 90 relevés de vues, sans débordement horizontal mesuré. Les scénarios confirment des défauts ; leur réussite ne signifie pas une recette sans anomalies.
- Trois défauts réseau reproduits sur les deux moteurs : saut d’une page après échec de pagination, cahier indisponible présenté comme vide, bouton de versement personnel actif hors connexion. Statuts fixes des paramètres également confirmés.
- Compléments : contraste de l’aide des paramètres à 2,56:1, interrupteur sans nom accessible, compteur collectif différent entre les profils, Retour navigateur sortant de l’application dans le contexte de test. Rapport avec priorités et critères de correction.
- Aucun code applicatif modifié, aucune écriture métier, aucune reconstruction ou livraison distante. Harnais dédié `playwright.audit.config.ts`, séparé de la suite de régression, captures et JSON conservés avec le rapport.
