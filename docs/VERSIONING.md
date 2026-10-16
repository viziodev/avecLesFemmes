# Versionnement et livraison

## Versions indépendantes

Le produit utilise une version commune MAJEURE.MINEURE.CORRECTIF pour tous les packages du monorepo. Le socle initial est 0.1.0 ; un pilote pourra devenir 1.0.0-beta.1 puis 1.0.0 après validation. Un nouvel incrément compatible peut devenir 1.1.0.

Le contrat REST est /api/v1, avec sa version indépendante 1.0.0 dans OpenAPI. Une correction du produit ne change pas automatiquement cette version API. Les migrations ont un nom ordonné et une empreinte vérifiée à chaque exécution ; un fichier appliqué ne doit plus être modifié.

## Travail et contrôle des versions

1. Partir de main à jour et créer une branche courte codex/nom-du-changement.
2. Modifier le code et les tests appropriés.
3. Pour une livraison, exécuter `npm run version:set -- 0.1.1` ou la version choisie. La commande synchronise packages, dépendances internes, verrou npm, version exposée par l’API, valeurs Compose et Dockerfiles.
4. Ajouter l’entrée correspondante au CHANGELOG et exécuter `npm run version:check`, format:check, typecheck, tests et build.
5. Créer une pull request vers main. Le contrôle CI `verify` est requis ; main doit rester prêt à livrer.
6. Fusionner la PR. Une modification applicative exige une version supérieure ; la CI bloque une version inchangée ou rétrograde. Le développeur choisit la portée SemVer avec `version:set` avant la PR.
7. Après réussite de la CI sur main, le workflow crée et pousse automatiquement le tag annoté correspondant à la version commune, sans déplacer un tag existant.
8. Dans le même workflow, publier les quatre images GHCR et archiver leur manifeste. Le token GitHub du workflow ne déclenche pas une seconde CI en poussant son tag : les jobs suivants continuent explicitement la livraison.
9. Le job de l’environnement GitHub `render-test` déploie automatiquement l’image de test par empreinte et contrôle la version exposée ainsi que PostgreSQL. Le VPS de production reste une promotion explicite ultérieure.

Le premier commit initialise le socle sur main. La branche codex/versioning contient la mise en place de cette stratégie. En l’absence de dépôt distant, son intégration initiale sur main se fait localement ; les prochaines modifications passent par des pull requests dès que le dépôt distant est configuré.

## Images et manifestes

Après création du tag sur un dépôt propre, `npm run release:local` construit les quatre images et produit `.releases/vVERSION.local.json`. Le manifeste contient le commit, les tags et les identifiants immuables des images locales. Un identifiant local d’image n’est pas une empreinte de manifeste de registre et ne peut pas être utilisé comme référence GHCR.

Le job de publication associé aux tags construit et pousse les images linux/amd64 et linux/arm64 dans GHCR, sous ghcr.io/compte/aveclesfemmes-api, -web , -pwa et -render. Les métadonnées OCI incluent version, commit et dépôt source. Le job refuse une version déjà publiée et exporte `.releases/vVERSION.registry.json`, avec les quatre références `image@sha256:empreinte`.

Les manifestes sont écrits sans écrasement. Une publication partiellement échouée doit être examinée ; ne pas remplacer automatiquement ses images. Publier une nouvelle version si nécessaire.

Recette et production doivent déployer les mêmes références de registre du manifeste validé, sans reconstruire les images. compose.production.yaml attend API_IMAGE, WEB_IMAGE et PWA_IMAGE avec ces empreintes. Aucun tag latest n’est utilisé pour les livraisons.

## Protection du dépôt distant

Le fichier .github/main-protection.json définit les contrôles attendus sur la branche principale : pull request, CI verify, branche à jour, historique linéaire, conversations résolues, interdiction des suppressions et des poussées forcées, y compris pour les administrateurs. Une approbation humaine supplémentaire n’est pas obligatoire pour permettre le démarrage avec un seul développeur.

Dans les paramètres du dépôt GitHub, configurer `Settings > Actions > General > Workflow permissions` sur `Read and write permissions` afin de permettre au workflow CI de pousser le tag de version annoté.

Pour sanctuariser les tags de version et empêcher toute modification ou suppression rétroactive, appliquer le jeu de règles `.github/tag-ruleset.json` ciblant `refs/tags/v*` avec `gh api --method POST repos/COMPTE/DEPOT/rulesets --input .github/tag-ruleset.json`.

Après création et première publication du dépôt, appliquer la protection de la branche avec `gh api --method PUT repos/COMPTE/DEPOT/branches/main/protection --input .github/main-protection.json`. La configuration doit être confirmée par l’API ; sa présence dans Git ne protège pas main à elle seule. Certaines protections des dépôts privés dépendent de l’offre GitHub.

Références : [protection des branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), [jeux de règles de dépôt](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) et [registre GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Déploiement automatique Render

Les environnements de la stratégie de livraison sont :

- **Local :** PostgreSQL du service `db` de `compose.yaml`, avec volume `postgres_data`. Cet environnement sert au développement et à la validation locale.
- **Recette :** conteneur unique sur Render gratuit et base Neon de recette.
- **Production :** VPS Dokploy et base Neon dédiée à la production.

Les données et secrets de ces environnements restent séparés.

La recette utilise un seul conteneur sur Render gratuit et une base PostgreSQL Neon externe, avec TLS vérifié et rôle applicatif isolé par RLS. Aucune base PostgreSQL n’est hébergée sur Render. La consigne de tests locaux et d’autorisation `VIZIODEPLOIE` définie dans [IMPLEMENTATION.md](IMPLEMENTATION.md) s’applique avant tout déclenchement distant.

L’environnement GitHub `render-test` autorise main et les tags v*. Variables : `RENDER_SERVICE_ID=srv-db7s4l6i0phs73af6520` et `RENDER_PUBLIC_URL=https://aveclesfemmes-test.onrender.com`. Ajouter le secret d’environnement `RENDER_API_KEY` depuis le compte Render ; aucun identifiant PostgreSQL propriétaire n’est transmis au workflow de déploiement.

Le déploiement vérifie le manifeste (version, commit et registre), refuse une cible autre que le service web gratuit, conserve l’empreinte précédente dans le résumé GitHub, met à jour la référence persistante du service puis déclenche Render. Il attend le statut live, la version attendue et la readiness PostgreSQL. Les déploiements sont sérialisés et un commit antérieur à la version active est refusé. Un échec est signalé ; aucun retour arrière de base n’est exécuté automatiquement.

Si de nouvelles migrations sont présentes depuis la version en ligne, le déploiement s’arrête avant modification du service. Les appliquer dans une tâche isolée puis renseigner `MIGRATIONS_READY_VERSION` avec la version exacte pour autoriser cette livraison. Sur le plan gratuit, ni tâche ponctuelle Render ni commande pre-deploy ne sont disponibles ; cette étape reste contrôlée. Relancer uniquement le job de déploiement échoué, sans republier les images.

Lors du tout premier déploiement du service ou après une réinitialisation volontaire de la base Neon de recette, aucune version n'est encore active pour le contrôle d'écart. Renseigner alors la variable d’environnement `INITIAL_DEPLOY=true` ainsi que `MIGRATIONS_READY_VERSION=version` pour autoriser la première mise en service après avoir appliqué les migrations initiales.

L’image combinée Render est une exception de recette gratuite, avec l’API sur loopback, PWA à la racine et administration sous /admin/. Elle ne qualifie pas à elle seule la topologie de production à trois images : cette dernière doit être testée avant promotion vers Dokploy.

Références : [API Render : mise à jour persistante du service](https://api-docs.render.com/reference/update-service) et [déclenchement d’un déploiement](https://api-docs.render.com/reference/create-deploy).
