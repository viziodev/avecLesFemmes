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
6. Fusionner puis créer un tag annoté, par exemple `git tag -a v0.1.1 -m 'AvecLesFemmes 0.1.1'`. Ne jamais déplacer un tag publié.
7. Pousser le tag pour déclencher la publication après validation CI.

Le premier commit initialise le socle sur main. La branche codex/versioning contient la mise en place de cette stratégie. En l’absence de dépôt distant, son intégration initiale sur main se fait localement ; les prochaines modifications passent par des pull requests dès que le dépôt distant est configuré.

## Images et manifestes

Après création du tag sur un dépôt propre, `npm run release:local` construit les trois images et produit `.releases/vVERSION.local.json`. Le manifeste contient le commit, les tags et les identifiants immuables des images locales. Un identifiant local d’image n’est pas une empreinte de manifeste de registre et ne peut pas être utilisé comme référence GHCR.

Le job de publication associé aux tags construit et pousse les images linux/amd64 et linux/arm64 dans GHCR, sous ghcr.io/compte/aveclesfemmes-api, -web et -pwa. Les métadonnées OCI incluent version, commit et dépôt source. Le job refuse une version déjà publiée et exporte `.releases/vVERSION.registry.json`, avec les trois références `image@sha256:empreinte`.

Les manifestes sont écrits sans écrasement. Une publication partiellement échouée doit être examinée ; ne pas remplacer automatiquement ses images. Publier une nouvelle version si nécessaire.

Recette et production doivent déployer les mêmes références de registre du manifeste validé, sans reconstruire les images. compose.production.yaml attend API_IMAGE, WEB_IMAGE et PWA_IMAGE avec ces empreintes. Aucun tag latest n’est utilisé pour les livraisons.

## Protection du dépôt distant

Le fichier .github/main-protection.json définit les contrôles attendus : pull request, CI verify, branche à jour, historique linéaire, conversations résolues, interdiction des suppressions et des poussées forcées, y compris pour les administrateurs. Une approbation humaine supplémentaire n’est pas obligatoire pour permettre le démarrage avec un seul développeur.

Après création et première publication du dépôt, appliquer cette configuration avec `gh api --method PUT repos/COMPTE/DEPOT/branches/main/protection --input .github/main-protection.json`. La configuration doit être confirmée par l’API ; sa présence dans Git ne protège pas main à elle seule. Certaines protections des dépôts privés dépendent de l’offre GitHub.

Références : [protection des branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) et [registre GHCR](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
