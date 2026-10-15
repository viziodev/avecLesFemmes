# AvecLesFemmes — Premier incrément

## État et périmètre

Le premier incrément a été initialisé à la version produit **0.1.0** et a évolué jusqu'à la version **0.1.3** pour intégrer les corrections fonctionnelles et la chaîne de déploiement automatisée. Il couvre le web super administrateur, la PWA membre et administratrice, l’API NestJS et PostgreSQL.

Les deux modes de connexion sont fonctionnels : mot de passe et code téléphone avec OTP (5 minutes de validité, 5 tentatives maximum). L’envoi SMS réel attend un fournisseur et son contrat d’intégration ; le mode local et la recette utilisent la simulation locale ou le mode désactivé.

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
   - **Recette (Render)** : PostgreSQL managé cloud **Neon.tech** (`veclesfemmes_app`), permanent sans expiration de 30 jours, SSL requis, avec compte applicatif `aveclesfemmes_app` bridé par RLS.
   - **Production (VPS avec Dokploy)** : Base dédiée à définir lors du déploiement serveur (PostgreSQL géré par Dokploy avec volume persistant ou base managée externe).
4. **Déploiement automatique Render :**
   - Piloté par `scripts/deploy-render.mjs` sous le groupe de concurrence GitHub `render-test-deployment`.
   - Vérification préalable des migrations et support de la première mise en service via `INITIAL_DEPLOY=true`.

## Avant un lancement réel

Valider les hypothèses métier avec les utilisatrices de terrain, la gestion et récupération des comptes, les indicateurs, la conservation des données et le périmètre des administratrices. Choisir le prestataire SMS et raccorder son webhook. Effectuer les tests de charge à 200 000 adhésions et environ 10 millions de cotisations, tester sauvegarde et restauration sur le VPS Dokploy, et mener le pilote. La présence d’un socle compilable ne valide pas ces critères d’exploitation.
