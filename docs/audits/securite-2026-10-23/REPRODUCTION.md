# Reproduire l’audit de sécurité

Depuis la racine du projet, avec Node 24 et les dépendances installées.

## API isolée

```sh
npm run build --workspace @aveclesfemmes/api
node --import tsx --test tests/security/api-audit.ts
```

Les neuf scénarios créent une base PGlite en mémoire et appliquent les migrations du projet. Aucun accès à la base Docker, à Neon ou à Render. Les identifiants de test sont fictifs ; les preuves n’exportent ni cookie ni empreinte secrète. Les essais concurrents vérifient le compteur transactionnel. Une qualification séparée dans PostgreSQL 18 exerce les connexions réelles du pool ; le test en mémoire ne prétend pas remplacer cette vérification.

La configuration de production est activée dans ce processus de test uniquement. Une route de diagnostic du pair réseau existe dans ce serveur de test uniquement, pas dans l’application.

## Navigateur et HTTP local

PWA locale attendue à `http://localhost:8086/` :

```sh
npx playwright test --config playwright.security.config.ts
```

Deux scénarios : lectures HTTP non authentifiées, puis coffre synthétique dans un contexte navigateur neuf. Dans le second, toutes les requêtes vers l’API sont bloquées par le test ; les modules du coffre sont assemblés directement depuis les sources pour exercer leur code réel. Aucune donnée existante du navigateur de l’utilisateur n’est utilisée ou effacée.

## Dépendances et tests applicatifs

```sh
npm audit --omit=dev --json
npm audit --json
npm test
```

Les tests applicatifs API utilisent aussi une base en mémoire. Le registre npm est contacté par les commandes d’audit ; ses résultats évoluent avec les avis publiés.

## Interprétation

**Les tests actuels exigent le refus des exploitations décrites dans le rapport historique.** Ils vérifient également les parcours autorisés : appareil enrôlé, récupération Super Admin, conservation du mot de passe initial et déchiffrement hors ligne par mot de passe.

Ces régressions de sécurité sont intégrées au workflow CI, en plus de la suite métier. Les commandes écrivent dans `preuves-apres/`, sans remplacer les preuves vulnérables initiales. Ne pas rediriger les tests vers des identités ou une base réelles.
