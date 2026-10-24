# Livraison 1.0.0 — recette Nguith

Cible autorisée : service existant `aveclesfemmes-test` sur **Render gratuit**, conteneur unique (PWA, `/admin/`, API sous `/api/v1`), base **Neon de recette**. La production VPS Dokploy utilise une autre base et n’est pas concernée.

## Procédure

1. Construire et qualifier les images 1.0.0 dans `compose.release-test.yaml`, base et ports indépendants du Compose local de Nguith. `node scripts/release-test.mjs up`, puis `exec npm run test:e2e`, `exec npm run test:mobile` et `exec npx playwright test --config playwright.security.config.ts`. L’environnement de qualification privé est généré dans `.releases/`, jamais dans `.env`.
2. Sauvegarder Neon avec `node scripts/neon-release.mjs backup`. La sauvegarde privée est vérifiée par `pg_restore --list`, avec empreinte SHA-256 et contrôle de la cible. Les secrets de connexion restent dans `.releases/` ignoré par Git.
3. Appliquer les migrations 006–017 via `node scripts/neon-release.mjs migrate`, puis renseigner `MIGRATIONS_READY_VERSION=1.0.0` dans l’environnement GitHub `render-test`.
4. Publier la branche de livraison et passer par une PR avec la vérification `verify` obligatoire. Après fusion dans `main`, la CI crée le tag `v1.0.0`, publie les quatre images et déploie l’image Render par digest. Le script vérifie le plan gratuit et la version de l’API en ligne.
5. Après santé 1.0.0 confirmée, créer une seconde sauvegarde privée avec `node scripts/neon-release.mjs backup --before-reset`, puis exécuter `node scripts/neon-release.mjs reset-nguith` dans les quinze minutes. Cette archive séparée inclut les migrations et les éventuelles données ajoutées depuis la préparation ; la sauvegarde initiale reste conservée. Cette opération remplace les données métier et les comptes non Super Admin, révoque les sessions/appareils et conserve le Super Admin actif, les catalogues et la palette plateforme. Elle est réservée à la base Neon de recette identifiée et exige la sauvegarde vérifiée.
6. Contrôler les quantités, paramètres, connexion Awa et affichage réel. Le résultat final est enregistré dans `nguith.json`, sans secret.

## Données de remplacement demandées

| Campagne    | Type    | Événement        | Cotisation         | Rencontre                | Période initiale      |
| ----------- | ------- | ---------------- | ------------------ | ------------------------ | --------------------- |
| Avec        | Épargne | Fêtes de Tabaski | 5 000 FCFA/semaine | Dimanche                 | 25/10/2026–24/10/2027 |
| Sokorou Kor | Épargne | Ramadan          | 3 000 FCFA/mois    | Premier dimanche du mois | 01/11/2026–31/08/2027 |
| Natte-10000 | Tontine | Aucun            | 1 000 FCFA/mois    | Premier dimanche du mois | 01/11/2026–31/08/2027 |

Un seul groupement : **Cabalabasse des Femmes de Nguith**, adresse Nguith. Une membre : **Awa**, administratrice et Présidente, inscrite aux trois campagnes avec leurs forfaits. Login `awa`. Le mot de passe initial approuvé et le PIN sont fournis séparément et ne sont pas versionnés. Aucun téléphone inventé, aucune cotisation, séance ou tirage prérempli.

## Retour arrière

Conserver l’archive privée et son empreinte hors du dépôt. Le retour à une image antérieure ne restaure pas les données supprimées ni les anciennes sessions. Une restauration de sauvegarde doit être effectuée dans une base isolée, vérifiée, puis faire l’objet d’une décision explicite avant de remplacer la recette. Ne pas modifier les migrations déjà appliquées. Render gratuit peut se mettre en veille ; les vérifications de santé peuvent nécessiter le réveil du service.
