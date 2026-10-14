# AvecLesFemmes

Premier socle de l’application d’épargne solidaire : web super administrateur, PWA membres et administratrices de groupement, API NestJS et PostgreSQL.

La version commune du produit est contrôlée par `npm run version:check`. La procédure de branches, tags et livraison se trouve dans [VERSIONING.md](docs/VERSIONING.md).

## Démarrage local avec Docker

Prérequis : Node.js 24, npm et Docker Desktop démarré.

```sh
npm ci
npm run setup
docker compose up -d --build
docker compose --profile demo run --rm seed
```

`npm run setup` crée un fichier `.env` privé avec des secrets aléatoires, sans écraser un fichier existant. Ne pas le committer. Les données de démonstration sont fictives.

- Web super administrateur : http://localhost:8085
- PWA : http://localhost:8086
- Documentation API en local : http://localhost:3005/api/docs
- Comptes : `superadmin`, `admin.ndeye`, `membre.awa`.
- Mot de passe local : valeur `DEMO_PASSWORD` dans `.env`.
- Téléphones de test : `+221770000001`, `+221770000002`, `+221770000003`. Le mode local affiche le code OTP dans la page de connexion ; aucun SMS n’est envoyé.

Le serveur utilise un rôle PostgreSQL applicatif distinct du compte de migration. Ne pas remplacer DATABASE_URL par un compte propriétaire ou superutilisateur.

## Développement sans reconstruire les images

```sh
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
# Dans deux autres terminaux
npm run dev:web
npm run dev:pwa
```

Web sur 5173 et PWA sur 5174. L’API est sur 3000. Les services Docker utilisent les ports hôte 5433, 3005, 8085 et 8086 pour éviter les conflits avec les applications existantes. La PWA installable est produite par le build ; la consultation des API et la saisie des cotisations exigent une connexion.

## Vérifications

```sh
npm run typecheck
npm test
npm run build
npm run openapi --workspace @aveclesfemmes/api
npm run contracts:generate
npm run test:e2e
```

Les tests API utilisent PostgreSQL embarqué PGlite, avec les mêmes migrations et un rôle sans contournement RLS. Ils vérifient les permissions, les totaux, l’idempotence, la désactivation et les codes OTP. Les tests navigateur nécessitent les services Docker et les données de démonstration.

## Production et SMS

`compose.yaml` est un environnement local HTTP, avec cookies non Secure et SMS de démonstration. Il ne doit pas être utilisé tel quel en production.

`compose.production.yaml` est un exemple pour un hôte derrière une entrée HTTPS existante et un PostgreSQL externe. Définir API_IMAGE, WEB_IMAGE et PWA_IMAGE sous la forme `registre/image@sha256:empreinte`, les connexions PostgreSQL chiffrées appropriées, ALLOWED_ORIGINS HTTPS et les secrets. La publication sur un registre et le déploiement réel ne sont pas effectués automatiquement.

Le mode `SMS_MODE=webhook` attend une URL HTTPS acceptant `POST {to,text}` et un jeton Bearer SMS_WEBHOOK_TOKEN. Ce contrat doit être adapté et vérifié avec le prestataire choisi. Pour désactiver le SMS, utiliser `SMS_MODE=disabled`. Le mode `development` est refusé en production.

Les migrations sont un job unique. Les images applicatives n’incluent pas le mot de passe propriétaire. La CI peut construire les images et une livraison doit conserver les empreintes des trois images. Utiliser les mêmes images en recette et production ; ne pas les reconstruire par environnement. Les frontends appellent une URL API relative.

Avant les migrations sur une base externe, créer le rôle `aveclesfemmes_app` avec LOGIN, sans SUPERUSER, BYPASSRLS, CREATEDB ni CREATEROLE et sans propriété sur les tables. Le compte de migration est propriétaire des tables et des fonctions d’accès. Après migration, créer le premier super administrateur avec `npm run db:bootstrap`, en injectant SUPERADMIN_LOGIN, SUPERADMIN_NAME, SUPERADMIN_PASSWORD et éventuellement SUPERADMIN_PHONE. La commande ne remplace aucun compte existant ; ne pas utiliser le seed fictif en production.

À valider avant production : restauration, charge cible, récupération des comptes, attribution et révocation des accès, conservation des données, supervision et pilote réel. Les limitations connues sont décrites dans [le plan](docs/IMPLEMENTATION.md) et [les ADR](docs/adr/README.md).
