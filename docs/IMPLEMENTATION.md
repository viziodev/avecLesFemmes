# AvecLesFemmes — Premier incrément

## État et périmètre

### Téléphone et PIN personnel — 1.1.0

La première connexion PWA demande le téléphone personnel, puis le PIN existant. Les suivantes demandent uniquement le PIN sur l’appareil mémorisé. Le nouveau parcours vérifie les deux éléments côté serveur ; les anciens clients conservent leur route liée à l’appareil. Le Super Admin peut préparer ou remplacer le PIN d’un compte non administratif global et renseigner son téléphone de connexion. Les mots de passe personnels sont conservés ; ils restent nécessaires à l’activation volontaire du coffre et à son ouverture hors ligne. Un PIN ne sert jamais de clé de chiffrement. Les refus, le blocage après cinq erreurs, la révocation et la conservation des anciens brouillons sont testés. Voir [ADR 025](adr/025-connexion-telephone-pin.md), qui remplace les anciennes règles de première connexion des sections historiques ci-dessous.

### Accès PWA et dates mobiles — 1.0.1

L’écran habituel ne propose plus la reconnexion par mot de passe, le changement de compte ou l’oubli d’appareil. Le Super Admin dispose du lien « Accès PWA de cet appareil » dans son espace web ; il ouvre le parcours `/?administration-appareil` sur l’origine PWA. Son identifiant et son mot de passe sont nécessaires pour révoquer l’appareil avant l’effacement de l’identité mémorisée. Les brouillons chiffrés restent conservés. Un code oublié se révoque au préalable depuis la fiche membre. Les dates « Du / Au » de l’historique utilisent deux colonnes réductibles, puis une seule sur les très petits écrans. Voir [ADR 024](adr/024-assistance-acces-pwa.md). Aucun changement des données de Nguith ni déploiement distant par ces correctifs locaux.

### Calendrier mensuel et Nguith — 0.28.0

Les rencontres mensuelles par jour de semaine (dont le premier dimanche) sont calculées sur les mois civils, dans les vues admin/membre et les contrôles de séance/tour. Migration additive 017, anciens rythmes conservés, formulaire et libellés adaptés. Le jeu local a été remplacé après sauvegarde par le groupement de Nguith, Awa présidente et trois campagnes sans versement. [Paramètres et recette](recette/nguith-2026-10-23/README.md), [ADR 023](adr/023-calendrier-mensuel.md).

### Synchronisation hors ligne — 0.27.0

Les saisies confirmées hors ligne peuvent être envoyées automatiquement au retour de la connexion dans l’espace ouvert et déverrouillé. Une autorisation signée propre à chaque saisie remplace la nouvelle saisie du code, sans le mémoriser. Les refus restent visibles et le mode manuel reste disponible. Voir [ADR 022](adr/022-synchronisation-automatique.md).

### Correctifs de sécurité — 0.26.0

Les six constats de l’audit local sont corrigés : preuve serveur d’appareil pour le code, récupération globale réservée au Super Admin sans remplacement du mot de passe initial, compteur d’échecs transactionnel, quotas par compte, protections HTTP et coffre v3. Les créations d’accès exigent un mot de passe initial d’au moins 12 caractères ; le membre choisit ensuite son code. Hors ligne, consultation et brouillons utilisent le mot de passe initial ; le code reste utilisé en ligne. Les migrations 015 et 016 créent les appareils autorisés et révoquent les anciennes sessions PWA. Voir [ADR 021](adr/021-durcissement-authentification-pwa.md) et [les correctifs de l’audit](audits/securite-2026-10-23/CORRECTIFS.md). Les sections de versions antérieures ci-dessous décrivent l’historique.

### Charte PWA intégrée — 0.25.0

Les correctifs de l’audit graphique sont appliqués aux profils membre et admin groupement : DM Sans locale et précachée, échelle typographique commune, surfaces clair/sombre harmonisées, contrastes contrôlés sur les fonds réels, états avec icône et libellé, montants tabulaires en FCFA et cartes adaptables. Les nouveaux défauts violet tontine et ambre solidarité respectent les personnalisations existantes grâce à la migration 014. Voir [ADR 020](adr/020-charte-graphique-pwa.md) et [le compte rendu](audits/pwa-mobile-2026-10-23/charte-integree-0.25/REALISATION.md). La mise en page du Super Admin et les règles métier restent conservées.

Le premier incrément a été initialisé à la version produit **0.1.0** et a évolué jusqu'à la version **0.1.3** pour intégrer les corrections fonctionnelles et la chaîne de déploiement automatisée. Il couvre le web super administrateur, la PWA membre et administratrice, l’API NestJS et PostgreSQL.

Les deux modes de connexion sont fonctionnels : mot de passe et code téléphone avec OTP (5 minutes de validité, 5 tentatives maximum). L’envoi SMS réel attend un fournisseur et son contrat d’intégration ; le mode local et la recette utilisent la simulation locale ou le mode désactivé.

## Incrément 2 : Fonctions, tontines rotatives, QR codes, délais de grâce et dashboards (v0.2.0)

L'incrément 2 porte le produit à la version **0.2.0** (SemVer monorepo). Il introduit des évolutions majeures validées pour la gouvernance des groupements, l'expérience utilisateur et les règles financières :

1. **Catalogue des fonctions de groupement :**
   - Fonctions de bureau et statutaires : _Membre simple_, _Présidente_, _Trésorière_, _Secrétaire_, _Commissaire aux comptes_.
   - Paramétrage par le Super Administrateur des fonctions autorisées par groupement (`group_allowed_functions`).
   - Seules les fonctions de bureau autorisent l'élévation au rôle `ADMIN` (`can_be_admin = true`).
2. **Référentiel des événements & cotisations modulaires (Option B) :**
   - Événements catalogués : _AVEC_, _RAMADAN_, _TABASKI_, _SOLIDARITE_, _RENTREE_.
   - Affectation par groupement avec montant par défaut indicatif et drapeau obligatoire/optionnel (`is_mandatory`). Les montants versés en séance restent libres et aléatoires selon la décision du membre.
3. **Authentification membre simplifiée & Sécurité :**
   - Connexion historique par téléphone/PIN, désormais réservée aux appareils autorisés ; première connexion par mot de passe initial fort (ADR 021).
   - Hachage cryptographique sécurisé via `scrypt` (`scryptSync`).
   - Protection anti-bruteforce automatique : verrouillage temporaire du compte (`locked_until` 15 min) après 5 échecs consécutifs.
4. **Gestion enrichie des membres :**
   - Nouveaux champs d'état civil : `address` (texte libre) et `gender` ('F' ou 'M').
   - Affectation de la fonction statutaire (`function_id`).
   - Blocage / Déblocage d'un membre avec motif d'audit obligatoire (`is_blocked`, `blocked_at`, `block_reason`). Tout versement ou saisie est immédiatement rejeté pour un membre bloqué.
   - Révocation du code uniquement par le Super Admin ; aucun secret définitif choisi pour un compte global (ADR 021).
5. **Cartes et QR Codes SVG légers :**
   - Génération vectorielle SVG pure (aucun asset lourd, téléchargement instantané) pour le membre (émargement rapide en séance) et pour le groupement.
6. **Campagnes & Tontines rotatives (ROSCA) :**
   - Prise en charge des tontines où le montant forfaitaire est identique pour toutes les membres souscrites.
   - Périodicité de récupération paramétrable (mensuelle par défaut, hebdomadaire, etc.).
   - Calcul automatique de la date de fin : $\text{Date début} + (N \text{ souscrites} \times \text{intervalle})$.
   - Tirage aléatoire au début de chaque tour (`/tontine/draw`), le jour prévu, avec désignation d’une seule bénéficiaire encore éligible. Les attributions sont conservées et l’encaissement reste bloqué avant tirage. Les membres se consultent dans la carte de chaque tour.
   - Suivi des levées et marquage des bénéficiaires ayant perçu leur cagnotte (`/tontine/payout`).
7. **Délais de grâce flexibles (Option C) :**
   - Accord d'un délai de grâce individuel à une membre sur une période donnée, avec motif d'audit consigné.
   - Badge d'avertissement visuel dans l'interface sans bloquer l'historique financier.
8. **Expérience utilisateur (UX) & Dashboards dédiés :**
   - **Administratrice de groupement :** Vue épurée restreinte aux seules campagnes en cours. État de la caisse en temps réel (`solde en caisse = total collecté - total reversé`), et cahier de séance détaillé (`/sessions`) session par session avec le total et les versements par membre.
   - **Membre :** Expérience simplifiée pour utilisatrices à faible littératie numérique. Bouton QR Code proéminent, tableau de bord restreint aux seules campagnes auxquelles elle souscrit, et historique style Mobile Money (Wave / Orange Money) avec filtres par type d'événement.
   - **Super Administrateur :** Cockpit 360° consolidé de toutes les caisses des groupements de la plateforme, gestion des catalogues et paramétrages avancés.

> **Consigne de déploiement stricte :** Aucun déploiement sur Render ni sur la recette distante ne doit être déclenché avant la validation intégrale des tests locaux et l'autorisation explicite via le mot de passe de commande **`VIZIODEPLOIE`**.

## Correction fonctionnelle de l'incrément 1 (v0.1.3)

- **Formulaire de création de groupement :**
  - Suppression du champ de saisie « Responsable » dans l'interface Super Administrateur. La désignation d'une responsable d'animation s'effectue naturellement par l'attribution du rôle `ADMIN` lors de l'enregistrement d'une membre dans son groupement.
  - **Rétrocompatibilité API :** Le champ `responsible` dans le DTO `CreateGroupDto` devient facultatif (`responsible?: string`). L'API insère une chaîne vide par défaut si le champ est omis, garantissant la compatibilité des anciens clients et la préservation du schéma de données.
  - Le contrat d'API OpenAPI demeure en `/api/v1` (version `1.0.0`), confirmant l'absence de rupture de contrat client ([ADR 012](adr/README.md#L18)).

## Hypothèses explicites du socle

- Devise **XOF (FCFA)** ; montants entiers strictement positifs représentés en `BIGINT` et sérialisés en chaînes de caractères sur l'API ([ADR 003](adr/README.md#L9)).
- Saisie connectée uniquement. Les données API ne sont pas mises en cache localement par la PWA.
- Isolation stricte multi-tenant par groupement via **PostgreSQL RLS (Row Level Security)** avec contexte transactionnel `SET LOCAL` ([ADR 002](adr/README.md#L8)).
- Le super administrateur attribue le rôle `ADMIN` lorsqu’il crée une membre avec un compte.
- Une campagne inscrit explicitement ses participantes ; le forfait est facultatif. Le versement réel est saisi même en présence d’un forfait.
- Une cotisation appartient à la période de campagne et ne peut être datée dans le futur.
- Cotisations transactionnelles et **idempotentes** (clé unique par groupement + empreinte du contenu).
- Une campagne désactivée reste consultable ; inscriptions, forfaits, saisies et corrections y sont bloqués.
- Une correction annule la cotisation avec un motif d'audit obligatoire ; une nouvelle cotisation doit ensuite être enregistrée. Aucun effacement physique d’historique.
- Les membres voient leurs versements personnels. Les administratrices voient tous les versements des groupements qui leur sont attribués.
- Tous les types créés dans ce socle utilisent le moteur Avec ([ADR 007](adr/README.md#L13)).

## Stratégie de versionnement et de déploiement

### Connexion et validation par code secret — 0.24.0

La PWA demande identifiant et mot de passe au premier accès sur l’appareil, puis le choix et la confirmation d’un code de quatre chiffres. Un compte déjà équipé saisit son code après ce premier accès. Les ouvertures suivantes et les opérations sensibles utilisent le même pavé numérique, les quatre pastilles et la validation au quatrième chiffre. « Code secret oublié ? » permet de vérifier le mot de passe initial en ligne puis de choisir un nouveau code. Les cinq minutes d’inactivité et le verrouillage en arrière-plan restent actifs.

Le code distinct du mot de passe est vérifié par l’API ; cinq échecs entraînent un blocage de quinze minutes. Le coffre chiffré utilise aussi une clé d’appareil, et une protection de récupération par mot de passe pour conserver les saisies lors d’un changement de code. Les brouillons ne sont jamais automatiquement supprimés. Voir [ADR 019](adr/019-code-secret-pwa.md). Migration 013 nécessaire avant lancement de l’API 0.24.0 ; aucun changement de contrat incompatible et aucune publication distante.

### Notifications et reçus PWA — 0.23.0

Les actions de gestion, les versements, les raccourcis, les réglages d’apparence, le téléchargement QR et les actions de synchronisation donnent un retour d’information commun aux profils membre et administratrice. La notification distingue réussite, information et échec ; une seule reste affichée à la fois, avec fermeture manuelle et disparition automatique (pause pendant la lecture au pointeur ou au clavier). Les erreurs restent aussi dans le formulaire pour permettre la correction. La navigation et les lectures automatiques n’émettent pas de notifications répétitives. Il s’agit de notifications dans l’application, sans permission de notifications système.

Chaque encaissement ou versement validé ouvre un reçu inspiré des applications de paiement : confirmation, montant, membre, campagne, groupement, date de séance/tour, date d’enregistrement serveur lorsqu’elle est disponible et référence. Le partage utilise le menu de l’appareil ; à défaut, la copie permet de coller le reçu dans une messagerie. Ces actions ne créent aucun versement supplémentaire. La fermeture restitue le focus à l’action d’origine, ou au titre si cette action n’existe plus. Les thèmes et les couleurs de campagne sont conservés.

Une réponse refusée ou incomplète et une saisie hors ligne en attente ne produisent aucun reçu de réussite. Après synchronisation validée, le reçu utilise la référence du serveur et conserve la date d’origine. Le verrouillage efface les reçus et notifications de la vue ; aucune information de reçu supplémentaire n’est persistée. La mise à jour automatique de la PWA attend la fermeture du reçu. La version produit commune passe à 0.23.0, sans migration SQL et sans déploiement distant.

### Apparence de la PWA — 0.19.0

Les espaces membre et administratrice proposent Automatique, Clair et Sombre.
Le réglage se trouve dans **Mon compte → Apparence** pour le membre et dans
**Plus → Paramètres du groupement → Apparence** pour l’administratrice.
Automatique suit le thème du téléphone, y compris ses changements pendant la visite.
La préférence est propre à l’appareil et à l’origine de la PWA, conservée dans
`localStorage` (`alf:pwa:appearance`) et synchronisée entre onglets. Elle est appliquée
avant le rendu initial, également à la connexion et après une mise à jour de la PWA.
Si le stockage est bloqué, le choix reste utilisable pendant la visite et un message
explique qu’il ne peut pas être conservé.

Les couleurs sémantiques couvrent les fonds, textes, formulaires, fenêtres de saisie,
historiques et campagnes. L’épargne et la tontine gardent des couleurs distinctes ;
les fonds des boutons avec texte blanc restent foncés. Le QR reste noir sur blanc.
Le portail web super administrateur conserve son apparence actuelle.
Les thèmes sont repris dans la refonte « Action du jour », intégrée en 0.20.0 aux deux profils PWA. Voir le [compte rendu](audits/pwa-mobile-2026-10-22/INTEGRATION-ACTION-DU-JOUR.md).

### Environnements retenus

| Environnement  | Hébergement applicatif               | Base de données                                                                                                   |
| -------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Local**      | Docker Compose (`compose.yaml`)      | PostgreSQL du service **`db`** de ce même Compose, volume persistant `postgres_data`, accès hôte `localhost:5433` |
| **Recette**    | **Render gratuit**, conteneur unique | **Neon**, base dédiée à la recette, connexion TLS et isolation RLS                                                |
| **Production** | **VPS avec Dokploy**                 | **Base Neon dédiée à la production**, distincte de la recette                                                     |

En local, les conteneurs utilisent `db:5432` ; les outils exécutés sur la machine utilisent `localhost:5433`. Les migrations et données de démonstration locales ciblent cette base Docker Compose. Chaque environnement possède ses propres données, comptes et secrets.

La stratégie de livraison ([VERSIONING.md](VERSIONING.md) et [ADR 014](adr/014-deploiement-render-dokploy.md)) repose sur des artefacts immuables promus sans reconstruction :

1. **Cycle de version (SemVer monorepo) :**
   - Branche de modification courte (`codex/...`).
   - Commande `npm run version:set -- 0.1.3` synchronisant packages, `package-lock.json`, Dockerfiles et compose.
   - Entrée obligatoire dans `CHANGELOG.md` et validation par `check-pr-version.mjs` en Pull Request.
2. **Publication d'images immuables (GHCR) :**
   - Création automatique du tag Git annoté `v0.1.3` lors du merge sur `main`.
   - Construction multi-architectures (`linux/amd64`, `linux/arm64`) des images et publication sur GHCR.
   - Archivage du manifeste `.releases/v0.1.3.registry.json` avec les empreintes `sha256` exactes (aucun tag flottant `latest`).
3. **Répartition des bases de données selon les environnements :**
   - **Local (Développement)** : PostgreSQL conteneurisé via le service `db` de [compose.yaml](../compose.yaml) (port 5433, volume persistant `postgres_data`).
   - **Recette (Render)** : PostgreSQL managé **Neon**, distinct du conteneur unique Render gratuit, TLS avec vérification du certificat, avec compte applicatif `aveclesfemmes_app` bridé par RLS.
   - **Production (VPS avec Dokploy)** : Base Neon dédiée à la production, isolée de la recette par ses données, ses comptes et ses secrets.
4. **Déploiement automatique Render :**
   - Piloté par `scripts/deploy-render.mjs` sous le groupe de concurrence GitHub `render-test-deployment`.
   - Vérification préalable des migrations et support de la première mise en service via `INITIAL_DEPLOY=true`.

## Avant un lancement réel

Valider les hypothèses métier avec les utilisatrices de terrain, la gestion et récupération des comptes, les indicateurs, la conservation des données et le périmètre des administratrices. Choisir le prestataire SMS et raccorder son webhook. Effectuer les tests de charge à 200 000 adhésions et environ 10 millions de cotisations, tester sauvegarde et restauration sur le VPS Dokploy, et mener le pilote. La présence d’un socle compilable ne valide pas ces critères d’exploitation.

### Local — 0.12.0 : tours et grâce individuelle

L’accueil Tontine distingue le tour du jour (ou en cours) des trois derniers tours passés, triés par date décroissante. Voir plus ajoute trois tours passés ; les tours futurs ne sont pas affichés. Le tirage reste nécessaire avant tout encaissement.

Les raccourcis de l’accueil occupent au maximum deux lignes de quatre emplacements. Au-delà de sept campagnes, six restent visibles, Plus ouvre les suivantes, et Historique garde sa place. Le raccourci de la campagne choisie reste visible ; il remplace le sixième raccourci si nécessaire.

Dans le détail du tour, un membre sans versement peut recevoir un délai de grâce du responsable. L’échéance est inclusive, au plus tard la veille du prochain tour. Le membre reste « N’a pas cotisé » sans délai ; avec un délai expiré et aucun versement valide, il est indiqué « Absent ». Toute cotisation valide, même partielle, prévaut sur l’absence. Un délai existant peut seulement être prolongé ; le serveur vérifie le tour en cours, le tirage, l’inscription et les droits, puis inscrit l’octroi/prolongation dans l’audit. Les dates sont contrôlées avec l’horloge serveur de Dakar. Le formulaire ouvert bloque la mise à jour automatique de la PWA pour préserver la saisie.

### Local — 0.13.0 : cartes compactes

Les résumés de séance et de tour occupent trois lignes : date et nombre de non-cotisants, montants versé/attendu, puis participantes ou bénéficiaire. Les montants sont abrégés en F dans le résumé et présentés intégralement en FCFA dans le détail. Les libellés longs restent sur une ligne avec une ellipse ; ouvrir la carte donne accès aux valeurs complètes.

Le menu Campagnes de la PWA utilise des cartes aux couleurs de leur type, avec quatre lignes : nom, type et sélection, période, puis membres et montant collecté. Toucher le résumé sélectionne la campagne et ouvre le détail avec la fréquence, les autres métriques et les actions existantes. La pagination reste disponible.

La bénéficiaire d’un tour est identifiée dans sa liste de membres. Elle est exclue des délais de grâce et de l’absence calculée sur ces délais, y compris lorsqu’un ancien délai existe. L’API refuse une demande directe à son sujet ; les cotisations et leurs totaux conservent leur calcul sur les participations.

### Local — 0.14.0 : campagnes et adhésions

Le menu Campagnes de la PWA affiche les cartes sans les panneaux Participantes/forfaits et Cahier des sessions. L’action Ajouter un membre et la case Raccourci sont disponibles sur chaque carte fermée. Le délai de grâce reste dans le suivi du tour, hors des cartes de campagne. Le contexte du groupement est présenté sur deux lignes : nom, puis téléphone et nombre de membres.

Les préférences de raccourcis sont enregistrées par compte administrateur et groupement (migration 008, table avec RLS). Six campagnes peuvent être cochées ; les autres sont accessibles dans Plus. Historique reste visible. Consulter une campagne ou la choisir depuis Plus ne l’ajoute pas automatiquement aux raccourcis. Une sélection vide est conservée. Sans préférence préalable, les six campagnes actives les plus récentes sont proposées.

L’ajout recherche côté serveur les membres actifs non bloqués du groupement, encore non inscrits, avec recherche nom/téléphone et pagination de 25 résultats. Les doublons sont refusés, même par appel direct ou concurrent. Pour une tontine, le montant commun défini à la création est requis et présenté en lecture seule. Pour une épargne, Libre enregistre un forfait nul et permet un montant variable ; Fixe reprend exclusivement le montant standard de la campagne. Sans montant standard, seule l’épargne libre est proposée. Les cotisations fixes sont préremplies et non modifiables lors de l’encaissement ; l’API refuse un montant différent du forfait. Les versements enregistrés ne sont pas réécrits et leurs rejeux idempotents restent possibles.

Endpoints : GET/PUT `/groupements/:groupId/campaigns/shortcuts`, GET `/groupements/:groupId/campaigns/:id/eligible-members`, puis POST participants existant. La liste des participantes d’une tontine demeure figée après son premier tirage.

### Local — 0.15.0 : filtres et cartes Membres

Le menu Campagnes de la PWA filtre par type sur toutes les campagnes actives du groupement. Les campagnes cochées apparaissent par défaut ; Voir plus affiche aussi les campagnes actives non sélectionnées du type choisi, et Voir moins rétablit la sélection. La pagination de 25 éléments s’applique après les filtres. Changer de type remet la liste à sa première page et masque les non sélectionnées.

Le formulaire d’adhésion remplace la recherche séparée et la liste native par un seul sélecteur avec recherche intégrée. La recherche nom/téléphone et la pagination des membres non inscrits continuent d’être traitées côté API. Le sélecteur prend en charge les flèches, Entrée, Échap, les rôles combobox/listbox et une sélection explicite ; écrire un nom sans choisir une option n’autorise pas l’enregistrement.

Le menu Membres de la PWA utilise les mêmes cartes que les campagnes avec un résumé de trois lignes : nom/état, téléphone/fonction, puis campagnes inscrites avec montants d’épargne. Le détail présente toutes les inscriptions, y compris les campagnes archivées, les montants en FCFA et les actions QR, PIN et blocage existantes. L’API enrichit uniquement la page de membres demandée par une requête groupée ; les montants cumulés excluent les cotisations annulées et respectent les droits de lecture du profil. La vue tableau Super Admin est conservée.

### Local — 0.16.0 : accueil et versements membres

L’accueil personnel partage le bandeau du groupement : coordonnées, QR personnel, montant total versé dans la campagne sélectionnée et raccourcis des campagnes actives auxquelles le membre participe. Six campagnes, Plus et Historique limitent la grille à deux lignes. Les autres campagnes personnelles sont accessibles dans Plus. Les couleurs dépendent du type choisi. L’administratrice dispose du même parcours dans Mon épargne personnelle.

Le bouton Faire un versement est activé seulement après vérification serveur : séance d’épargne du jour ouverte par le responsable, ou tour courant de tontine dont le tirage a eu lieu. L’identité de la participation et la date sont déterminées par le serveur ; le client transmet uniquement le montant et sa clé d’idempotence. Un versement valide existe au maximum par membre et période dans ce parcours personnel. Le verrou de campagne est partagé avec les encaissements administrateur et les activations. Les encaissements historiques et la saisie administrative existante sont conservés. Une annulation permet un versement de remplacement ; un rejeu du même enregistrement retrouve sa référence sans nouvelle écriture, même après changement de date. Il s’agit d’un enregistrement dans le registre de cotisations, sans intégration d’un prestataire de paiement.

L’épargne présente cinq versements récents, Voir plus par cinq et un filtre de séance appliqué avant pagination. Les cartes ont trois lignes (montant/état, date, séance), la référence reste dans le détail. Les montants annulés sont exclus du total. Le badge compte les séances officiellement ouvertes, antérieures au jour courant et à partir de la date d’inscription, sans versement valide. Une séance non ouverte ne crée pas de retard.

La tontine montre les tours commencés, du plus récent au plus ancien, cinq par défaut, Voir plus par cinq et un filtre de tour. La bénéficiaire tirée et le reversement réellement effectué sont distingués. Le nombre de personnes ayant encaissé compte les tours reversés ; chaque bénéficiaire n’est tirée qu’une fois dans le cycle. Les mois restants correspondent à la durée calendaire jusqu’à la fin du dernier tour, arrondie au mois supérieur, y compris pour les rythmes hebdomadaires.

Endpoints personnels : GET `/groupements/:groupId/member/campaigns`, GET `/groupements/:groupId/member/campaigns/:campaignId`, POST `/groupements/:groupId/campaigns/:campaignId/contributions/self`. La migration 009 autorise uniquement les écritures de la participation du compte connecté et leur audit. Deux fonctions avec droits du propriétaire, chemin SQL fixé et exécution réservée au rôle applicatif exposent le calendrier/noms des bénéficiaires aux seuls inscrits et verrouillent la campagne sans lui accorder UPDATE. Les coordonnées et cotisations des autres membres restent sous RLS. Une panne de vérification désactive le versement, le formulaire et les requêtes en cours retardent les mises à jour PWA.

### Local — 0.17.0 : historique global et accueil personnel choisi

Le montant personnel collecté de l’épargne sélectionnée est présenté dans un bloc avant la liste des versements. La grille d’accueil utilise les préférences propres au compte et au groupement, stockées dans `member_campaign_shortcut_preferences` (migration 010, RLS). Dans Mes campagnes, le membre coche six campagnes au maximum ; une sélection vide est conservée. Les autres campagnes restent dans Plus. Consulter une campagne depuis Plus ne l’ajoute pas à l’accueil. Les choix personnels de l’administratrice sont distincts des raccourcis de son espace de gestion. Le contrôle d’inscription et d’activité est répété côté serveur ; une erreur d’enregistrement rétablit la sélection précédente. Les requêtes d’écriture retardent la mise à jour PWA.

Les badges affichent `unpaid_count` pour l’épargne et la tontine : séances officiellement ouvertes et tours dont le tirage a eu lieu, commencés au plus tard aujourd’hui et depuis l’inscription, sans cotisation valide du membre. La période du jour est incluse ; un délai de grâce n’efface pas le fait qu’une cotisation reste à verser. Les dates futures, les séances non ouvertes, les tours non tirés et les campagnes archivées ne produisent pas de badge d’accueil. Le champ historique `arrears_count` garde son sens de séances passées, hors aujourd’hui. Les calendriers de tontine et leurs cotisations sont chargés par lots pour la page de campagnes.

Historique et Mes versements ouvrent le même historique global personnel, sans champ Campagne suivie et indépendamment de la campagne sélectionnée sur l’accueil. Toutes les campagnes inscrites, actives ou archivées, sont incluses par défaut. L’API applique les filtres avant le comptage et la pagination (cinq lignes depuis la version 0.17.2) ; Voir plus charge la page suivante. Les annulations sont visibles et exclues du montant collecté affiché.

Quatre filtres multiples sont disponibles : types (`typeIds`), campagnes (`campaignIds`), dates de séance d’épargne (`sessions`) et tours identifiés par campagne et numéro (`rounds`, format UUID:numéro). Les choix d’une même liste se combinent par OU ; types et campagnes se combinent par ET. Les séances et tours forment ensemble un filtre de périodes par OU pour pouvoir consulter plusieurs épargnes et tontines à la fois. Un filtre de séance ne capture pas par erreur les cotisations de tontine effectuées le même jour. Effacer les filtres rétablit l’ensemble des versements. Les listes de filtres sont repliables, avec recherche et limites de sélection.

Endpoints : GET/PUT `/groupements/:groupId/member/campaigns/shortcuts`, GET `/groupements/:groupId/member/history`, GET `/groupements/:groupId/member/history/options`. Ces derniers utilisent explicitement l’identité du compte connecté, même pour une administratrice en mode personnel. Ils ne reprennent pas les agrégats du groupement. Les calendriers des tours proviennent de la fonction bornée aux inscrits ; la pagination et les filtres ne permettent pas de consulter une autre participation.

### Local — 0.17.1 : identité membre fixe

Le bandeau vert personnel ne dépend plus de la campagne sélectionnée : téléphone, adresse et nom du groupement occupent trois lignes fixes, puis le QR personnel agrandi à 180 px occupe les trois lignes visuelles restantes. Le bandeau utilise une grille de six rangées, un vert constant et un texte sur une ligne avec titre complet au survol. Le montant, le nom de campagne et la commande de confidentialité sont retirés de cette zone. Les montants collectés et leur commande de confidentialité restent dans le détail de campagne sous les actions.

### Local — 0.17.2 : campagnes choisies et cinq derniers versements

Mes campagnes affiche uniquement les campagnes actives inscrites sélectionnées pour l’accueil. Le bouton Choisir mes campagnes ouvre la liste complète avec les cases de sélection ; la même fenêtre est accessible depuis Plus. Elle reste ouverte pendant les sauvegardes et bloque l’actualisation PWA pour préserver les modifications. Une sélection vide est autorisée.

Mes versements affiche cinq enregistrements par défaut, triés du plus récent au plus ancien côté serveur. Voir plus ajoute cinq enregistrements. Chaque changement de filtre repart de la première page ; le nombre de versements et le montant collecté portent toujours sur tous les résultats filtrés.

### Local — 0.18.0 : identité membre et navigation commune

Le bandeau personnel fixe comporte six rangées : téléphone, adresse et nom du groupement, nom et identifiant du membre en gras, puis QR personnel. Il reste identique lors du changement de campagne. Le bouton Mon Code QR de la barre supérieure est retiré en mode personnel ; le QR du bandeau ouvre toujours la carte membre. Le profil administratrice en gestion conserve son accès à sa carte personnelle.

Les composants CampaignShortcut, CampaignChoiceCard et CampaignHomeToggle assurent la même présentation des raccourcis et du choix d’accueil dans les deux profils. Plus propose directement Afficher sur l’accueil pour une campagne active non sélectionnée, avec compteur de six emplacements, erreurs de sauvegarde et désactivation des commandes pendant l’écriture. Cela modifie uniquement le choix d’accueil du compte et du groupement, sans activer une campagne métier ou modifier une inscription. Les campagnes choisies sortent de Plus et apparaissent sur l’accueil.

Mes campagnes, la fenêtre de personnalisation et Plus réutilisent les mêmes cartes de choix personnelles. Les cartes de gestion conservent leurs actions Ajouter un membre et Détails, et utilisent la même commande Afficher sur l’accueil.

### Couleurs communes et reconnexion PWA — 0.21.0

Le Super Admin dispose du menu **Apparence**. Il choisit quatre couleurs hexadécimales : principale, épargne, tontine et solidarité. Les aperçus clair/sombre ne modifient pas la palette publiée : seul **Enregistrer les couleurs** la met à jour. **Rétablir les couleurs par défaut** prépare une restauration qu’il faut également enregistrer. Les nuances des textes et boutons sont ajustées pour conserver un contraste d’au moins 4,5:1 ; les couleurs des alertes et les QR restent fonctionnels. Les autres types de campagne conservent leur teinte déterministe.

La migration `011_platform_appearance.sql` crée une palette unique persistante. `GET /api/v1/appearance` est public et ne contient que les quatre couleurs ; `PUT /api/v1/appearance` exige le Super Admin, le contrôle CSRF et une palette complète valide. RLS protège également les écritures directes. Chaque modification produit un événement `APPEARANCE_UPDATED`. Les interfaces relisent la palette à l’ouverture, au retour au premier plan, au retour du réseau et toutes les cinq minutes lorsqu’elles sont visibles. Si la lecture échoue, elles gardent la palette disponible ou les valeurs par défaut ; l’administration affiche une action Réessayer.

Sur la PWA, une première authentification réussie mémorise seulement le nom et l’identifiant (`alf:pwa:remembered-account`) sur l’appareil. Après expiration de session ou déconnexion, l’écran demande uniquement le mot de passe habituel et accepte la touche de validation du clavier natif. Le bouton **Changer de compte / oublier cet appareil** retire l’identité enregistrée. Une erreur de connexion n’enregistre aucun nouveau compte. Le stockage local peut être désactivé : la connexion fonctionne alors avec identifiant et mot de passe à chaque fois. Effacer les données du navigateur ou changer d’appareil impose une première connexion complète.

Le mot de passe et les jetons de session ne sont jamais mémorisés en localStorage. Le serveur authentifie chaque connexion ; la session HttpOnly existante conserve sa durée de huit heures. Les anciennes API PIN/SMS restent compatibles, mais l’écran PWA ne les propose plus. L’espace web Super Admin conserve son formulaire de connexion.

Pour actualiser le local, construire les trois images, appliquer la migration via le service `migrate`, puis relancer API, web et PWA. La recette reste Render gratuit + Neon ; la production reste VPS Dokploy + Neon dédiée. Cette version locale n’autorise pas une publication distante : appliquer le processus `VIZIODEPLOIE` à la demande.

### Groupement, verrouillage et hors ligne — 0.22.0

- **Admin groupement → Plus → Paramètres du groupement → Couleurs du groupement** : personnalisation de la palette, aperçus clair/sombre, enregistrement confirmé par mot de passe, retour possible à l’héritage de la plateforme. Les membres du groupement reçoivent la même palette.
- **Membre et admin groupement** : identifiant mémorisé après la première connexion ; mot de passe à chaque ouverture et après cinq minutes d’inactivité. L’arrière-plan verrouille également l’espace. Le serveur applique une expiration d’inactivité indépendante des requêtes de consultation. Les opérations sensibles exigent une nouvelle confirmation du mot de passe.
- **Hors ligne** : consultation des données précédemment chargées et saisie d’encaissements/versements dans un coffre chiffré. Le panneau « Saisies en attente → Synchronisation » présente les opérations ; chacune est confirmée par mot de passe au retour du réseau. Les refus restent visibles, sans modification de la date ni du montant. Une première ouverture et une préparation en ligne sont nécessaires ; ne pas effacer les données du navigateur avant synchronisation.
- **Périodes métier** : les règles existantes restent applicables au serveur. Une épargne saisie pour une séance passée peut être refusée lors d’une synchronisation ultérieure ; aucun transfert automatique vers une autre séance ou un autre tour.
- **Migration** : `012_group_appearance_session_activity.sql`, appliquée avant le redémarrage API/web/PWA. Les anciennes sessions non Super Admin sont soumises au délai de cinq minutes à compter de leur activité initialisée par la migration.

Détails : [ADR 016 — Connexion](adr/016-reconnexion-pwa.md), [ADR 017 — Couleurs du groupement](adr/017-palette-groupement.md), [ADR 018 — Hors ligne](adr/018-hors-ligne-chiffre.md). Les règles de déploiement restent inchangées : local sur Docker Compose, recette Render gratuit + Neon, production Dokploy + Neon dédiée. Aucun déploiement distant sans l’instruction VIZIODEPLOIE pour cette version.
