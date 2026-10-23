# Lot 6 — qualification et recette

État du 18 octobre 2026. Branche `codex/pwa-recette-lot6`, version d’outillage 0.6.1. Correction du retour du focus après fermeture du QR sur WebKit tactile. Aucun changement de contrat API ou de schéma. La recette complète initiale cible la version 0.6.0 ; les tests mobiles sont relancés après reconstruction des interfaces en 0.6.1.

## Commandes reproductibles

Utiliser Node 24 et les comptes fictifs du Compose local. Ne jamais employer des données de production.

```sh
npm run typecheck
npm run format:check
npm run version:check
npm run test:e2e
npx playwright install webkit
npm run test:mobile
docker compose --profile load-test run --rm -e LOAD_VUS=1 -e LOAD_DURATION=5s load-tester
```

Le service k6 est isolé par le profil `load-test`, son image est figée par empreinte et son script est monté en lecture seule. `LOAD_PASSWORD` reçoit `DEMO_PASSWORD` depuis Compose, sans mot de passe dans le script ni les journaux. L’authentification utilise le cookie `alf_session` et l’en-tête de protection CSRF de l’application. Après connexion, toutes les opérations métier sont des lectures. L’exécution est limitée aux hôtes locaux et à 20 utilisatrices virtuelles maximum.

Un test exploratoire de 5 utilisatrices virtuelles pendant 30 secondes, avec une pause de 2 secondes entre les itérations, est disponible par défaut. Le limiteur applicatif reste actif : augmenter la concurrence peut produire des réponses 429 ; celles-ci font échouer les seuils et ne doivent pas être masquées. Le contrôle CI utilise 1 utilisatrice pendant 5 secondes. Les seuils de contrôle sont : 100 % des vérifications réussies, moins de 1 % d’erreurs HTTP, 95e percentile des lectures inférieur à 1 seconde. Ce sont des seuils provisoires de fonctionnement, pas un engagement de performance de production.

La suite mobile utilise une configuration dédiée : Pixel 7 avec Chromium et iPhone 13 avec WebKit. Elle vérifie les deux profils, la navigation tactile, les cibles de 44 px, les débordements, la bascule personnelle et la fermeture du dialogue QR avec restauration du focus. Aucun service BrowserStack n’est configuré ou utilisé. Ces tests sont des émulations de navigateurs, pas des essais sur appareils physiques.

## Validation restant à effectuer avant ouverture générale

- Téléphones Android et iPhone réels : clavier virtuel, défilement des formulaires, retour système, lecteur d’écran, installation et lancement autonome.
- Mise à jour du paquet Workbox complet entre deux livraisons, avec formulaire ouvert et activation depuis un autre onglet.
- Suspension/arrêt du système : documenter la perte possible du brouillon en mémoire. Aucune promesse de récupération après fermeture.
- Listes de séances et rotations : adaptation mobile réalisée en 0.6.2 ; compléter les essais physiques avec les jeux de données du pilote.
- Charge représentative dans une base isolée : au moins 1 000 groupements, 200 000 adhésions et historique dimensionné ; plusieurs comptes, profils et niveaux de concurrence. Le scénario actuel utilise un compte et un groupement et ne valide pas cette cible.
- Ajouter un scénario d’encaissement concurrent sur données jetables avec idempotence, contrôle des totaux et isolation entre groupements ; ne pas le lancer sur la base de démonstration courante.
- Recette distante Render gratuit + Neon : vérifier le commit et les empreintes réellement déployés, les trois profils, RLS et la reprise après veille, après `VIZIODEPLOIE`.
- Production : base Neon dédiée, suppression des accès de démonstration, sauvegarde/restauration et retour arrière testés, supervision puis pilote.

## Résultats

- Recette complète avant correction ciblée : 28 tests Chromium réussis sur 0.6.0.
- Recette mobile après correction et reconstruction 0.6.1 : 4 tests réussis, deux profils sur Chromium et WebKit. Le défaut de focus constaté initialement sur WebKit est corrigé sur les boutons QR de l’en-tête et de l’espace personnel.
- Tests ciblés de version, confirmation et mise à jour : 10 réussis. Typage, formatage, cohérence de version et contrôle des différences validés.
- Construction des trois images et démarrage local en 0.6.1 réussis ; services sains.
- k6 exploratoire final : 5 utilisatrices virtuelles, 30 secondes, 75 itérations, 240 requêtes, 390 vérifications réussies, aucune erreur HTTP. 95e percentile des lectures : 30,44 ms ; toutes requêtes, authentification comprise : 60,79 ms. Petit jeu local et compte partagé ; aucune extrapolation vers 200 000 membres.
- La CI a été corrigée et complétée, mais n’a pas été exécutée sur GitHub pendant cette étape. Aucun déploiement distant.

Les rapports détaillés Playwright restent sous `test-results/` et `playwright-report/`, exclus de Git.

## Fiche de recette sur appareil réel

Pour chaque essai, noter le modèle, le système, le navigateur, la version de l’application, le profil, le résultat et une capture en cas d’échec.

| Vérification                                                    | Android réel | iPhone réel |
| --------------------------------------------------------------- | ------------ | ----------- |
| Connexion membre et administratrice                             | À faire      | À faire     |
| Encaissement avec clavier ouvert, boutons accessibles           | À faire      | À faire     |
| Passage gestion / épargne personnelle                           | À faire      | À faire     |
| Installation et lancement depuis l’écran d’accueil              | À faire      | À faire     |
| Mise à jour en attente pendant une saisie                       | À faire      | À faire     |
| Retour après verrouillage et suspension                         | À faire      | À faire     |
| Coupure pendant confirmation et nouvelle tentative sans doublon | À faire      | À faire     |
| Lecture d’écran et retour du focus après dialogue               | À faire      | À faire     |

## Complément 0.6.2 — séances et rotations sur téléphone

Les tableaux de séances, tours de tontine et participations sont présentés en cartes jusqu’à 760 px, uniquement dans la PWA. Les en-têtes restent disponibles pour les technologies d’assistance, les cellules ont des libellés visibles, et les détails utilisent une seule colonne pour éviter les débordements des noms et références longs. Le bouton de dépliage annonce son état et désigne les détails associés. Les tableaux de bureau et les opérations métier sont conservés.

Le test mobile dédié utilise des réponses contrôlées de séances et de rotations (données fictives), vérifie le dépliage, l’absence de débordement et l’état vide. Il ne déclenche aucun tirage ni versement de cagnotte.

Validation du complément 0.6.2 : les 6 tests mobiles passent (les deux profils et le nouveau parcours de détails sur chacun des moteurs Chromium/WebKit). Le nouveau parcours est testé à 360 px, avec noms et références longs, dépliage des tours et séances, état vide et consultation des participations d’épargne. Le test bureau des campagnes, séances et archives passe également. Typage, formatage, versionnement et construction Docker validés ; API et interfaces locales saines en 0.6.2. Aucun déploiement distant.

[Capture WebKit émulé à 360 px, données contrôlées](SEANCES-MOBILE-0.6.2.png).

## Complément 0.6.3 — volumes et encaissements concurrents

Un environnement PostgreSQL jetable indépendant du Compose habituel est disponible. La qualification locale sur l’application 0.6.2 a réussi avec 1 001 groupements, 201 201 adhésions et 201 201 cotisations initiales : recherche paginée, portée membre, isolation RLS, 20 confirmations identiques ne créant qu’un versement, refus d’une clé réutilisée avec un montant différent et 20 versements distincts rapprochés avec les totaux SQL.

La qualification est intégrée au job de vérification CI, avec une image explicitement identifiée, rapport séparé et nettoyage systématique. Son exécution GitHub reste à confirmer après publication. Le code applicatif local reste en 0.6.2 ; la version 0.6.3 porte sur cet outillage. Aucun déploiement distant.

Ces résultats remplacent le statut « à réaliser » pour ce premier scénario de volume/concurrence, mais pas pour la charge prolongée, les millions de cotisations ou les appareils physiques. Voir [la procédure, les résultats et leurs limites](QUALIFICATION-VOLUMES.md).

## Complément du lot 6 — historique étendu, outillage 0.6.4

Le 19 octobre 2026, branche `codex/qualification-historique` : qualification réussie sur l’image API 0.6.2 avec 1 001 groupements, 201 201 adhésions et 2 012 010 cotisations initiales. Recherche, isolation et confirmations concurrentes passent. L’essai mixte sur deux administratrices de deux groupements réalise 60 lectures et 60 versements en 65 secondes, sans erreur ; p95 de 184 ms en lecture et 10 ms en écriture. Les totaux API et SQL concordent pour chaque groupement.

Le stockage temporaire a été retiré après conservation du rapport. Ce résultat complète la qualification des volumes, sans clôturer l’endurance, la concurrence de nombreux comptes, les appareils physiques ou la CI distante. Voir [les mesures et limites](QUALIFICATION-VOLUMES.md). Aucun déploiement distant.
