# AvecLesFemmes — Premier incrément

## État et périmètre

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
   - Connexion rapide par Numéro de téléphone + Code PIN à 4 chiffres (`^\d{4}$`).
   - Hachage cryptographique sécurisé via `scrypt` (`scryptSync`).
   - Protection anti-bruteforce automatique : verrouillage temporaire du compte (`locked_until` 15 min) après 5 échecs consécutifs.
4. **Gestion enrichie des membres :**
   - Nouveaux champs d'état civil : `address` (texte libre) et `gender` ('F' ou 'M').
   - Affectation de la fonction statutaire (`function_id`).
   - Blocage / Déblocage d'un membre avec motif d'audit obligatoire (`is_blocked`, `blocked_at`, `block_reason`). Tout versement ou saisie est immédiatement rejeté pour un membre bloqué.
   - Réinitialisation sécurisée du code PIN par l'administratrice ou le super administrateur.
5. **Cartes et QR Codes SVG légers :**
   - Génération vectorielle SVG pure (aucun asset lourd, téléchargement instantané) pour le membre (émargement rapide en séance) et pour le groupement.
6. **Campagnes & Tontines rotatives (ROSCA) :**
   - Prise en charge des tontines où le montant forfaitaire est identique pour toutes les membres souscrites.
   - Périodicité de récupération paramétrable (mensuelle par défaut, hebdomadaire, etc.).
   - Calcul automatique de la date de fin : $\text{Date début} + (N \text{ souscrites} \times \text{intervalle})$.
   - Proposition de tirage au sort aléatoire (`/tontine/draw`) avec possibilité de réordonnancement manuel par l'administratrice.
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
