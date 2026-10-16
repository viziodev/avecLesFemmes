# ADR 014 — Recette sur Render, production sur VPS avec Dokploy

Date : 14 octobre 2026. Mise à jour : 16 octobre 2026. Statut : décision retenue ; qualification avant production. Render gratuit et Neon confirmés par le porteur du projet ; Dokploy retenu pour le VPS. Complète les ADR 002, 009, 010 et 012.

## Contexte et décision

AvecLesFemmes doit disposer rapidement d’un environnement de test accessible en HTTPS, puis être exploité sur un VPS. La cible métier dépasse 1 000 groupements et 200 000 membres ; cette volumétrie ne constitue pas une mesure de charge simultanée.

Render héberge la recette. Dokploy, installé sur un VPS, pilote la production. GitHub Actions construit et teste les images ; GHCR conserve les livraisons. Chaque livraison fournit quatre images référencées par `image@sha256` : le conteneur combiné de recette et les trois images API, web et PWA destinées à Dokploy. La topologie Dokploy doit être qualifiée séparément ; ses images sont ensuite promues par empreinte sans reconstruction. Les configurations et secrets diffèrent entre environnements ; les données de recette restent séparées des données réelles.

Les déploiements de recette sont déclenchés après réussite de la CI et publication complète du manifeste. La promotion en production est une action explicite après recette. Les plateformes ne reconstruisent pas automatiquement chaque commit de `main`. Aucun déploiement n’utilise `latest`.

## Topologie retenue

### Stratégie par environnement confirmée le 16 octobre 2026

La répartition des bases de données est définie selon trois niveaux indépendants :

1. **Local (Développement)** : PostgreSQL conteneurisé via le service `db` de `compose.yaml` (port 5433, volume `postgres_data`).
2. **Recette** : un seul service web **Render gratuit**, nommé `aveclesfemmes-test`, utilise l’image `aveclesfemmes-render`. PostgreSQL est hébergé sur **Neon**, avec connexion TLS vérifiée, RLS et rôle applicatif `aveclesfemmes_app`. Les données sont conservées dans Neon, indépendamment du cycle de vie du conteneur Render.
3. **Production (VPS avec Dokploy)** : services applicatifs sur le VPS, connectés à une base **Neon dédiée à la production**, isolée de la recette par ses données, ses comptes et ses secrets. Les ressources et modalités de sauvegarde sont à qualifier avant ouverture.

| Composant                       | Local                                 | Recette                                               | Production VPS avec Dokploy                   |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| Web super administrateur        | Compose, port 8085                    | Conteneur unique Render gratuit, HTTPS sous `/admin/` | Image web, domaine HTTPS via Traefik          |
| PWA membres et administratrices | Compose, port 8086                    | Même conteneur Render, racine `/`                     | Image PWA, domaine HTTPS via Traefik          |
| API NestJS                      | Compose, port 3005                    | Même conteneur, écoute `127.0.0.1:3000`               | Image API, réseau interne Compose             |
| PostgreSQL                      | Service `db`, port 5433, volume local | Base Neon de recette, TLS et RLS                      | Base Neon de production distincte, TLS et RLS |
| Migrations                      | Job `migrate` ou commande npm         | Tâche isolée préalable sur Neon                       | Tâche isolée préalable sur Neon               |

En local, les services applicatifs et le job de migration se connectent à `db:5432` sur le réseau Docker Compose. Les outils lancés sur la machine utilisent `localhost:5433`. Le volume `postgres_data` conserve les données locales ; les identifiants sont propres à cet environnement.

Les navigateurs appellent `/api/v1` sur le même domaine que l’interface. Nginx relaie les routes protégées vers l’API interne. Sur Render, seul Nginx écoute sur le port exposé 8080 ; l’API ne dispose pas d’adresse publique séparée. Neon fournit une connexion distante PostgreSQL chiffrée avec des comptes distincts pour l’application et les migrations.

Le conteneur combiné contient Nginx, NestJS et les fichiers statiques des deux interfaces. Il n’héberge aucune base PostgreSQL et ne conserve pas de données métier sur son système de fichiers. La mise en veille du service gratuit peut retarder le premier accès ; elle ne supprime pas les données Neon.

Pour Dokploy, adapter `compose.production.yaml` au routage Traefik et injecter la connexion Neon de production. PostgreSQL reste externe au VPS. L’accès administratif à Dokploy et au VPS est réservé aux exploitants.

## Préparation technique obligatoire

1. Utiliser `docker/render.Dockerfile` pour la recette : PWA à la racine, administration sous `/admin/`, proxy vers `127.0.0.1:3000`. Pour la topologie Dokploy, configurer l’amont interne Nginx et vérifier les en-têtes HTTPS derrière Traefik.
2. Exposer `PORT=8080` sur Render ; le lanceur réserve le port 3000 à l’API sur loopback. Vérifier `/api/v1/health/live`, `/api/v1/health/ready` et les deux interfaces. Sur Dokploy, contrôler séparément chaque service.
3. Qualifier PostgreSQL et les permissions sur chaque plateforme : compte applicatif `aveclesfemmes_app` non propriétaire, sans `SUPERUSER` ni `BYPASSRLS`, distinct du compte de migration. Vérifier que le fournisseur permet le provisionnement des rôles et l’exécution des migrations existantes. Exécuter les tests d’isolation avec ce compte réel ; aucun contournement de RLS pour faciliter le déploiement.
4. Tester les connexions Neon avec TLS, vérification du certificat et le client `pg` ; documenter les hôtes, autorités de certification et droits nécessaires. Conserver une version majeure PostgreSQL compatible entre recette et production, qualifiée avant provisionnement.
5. Créer des secrets propres à chaque environnement : connexion applicative, connexion de migration, `OTP_SECRET`, origines HTTPS exactes et éventuels identifiants SMS. Le compte de migration est réservé à la tâche ponctuelle et retiré des services permanents. Le registre privé utilise un accès en lecture aux packages.
6. Initialiser le premier super administrateur par la commande de bootstrap existante et un secret temporaire. Les comptes et mots de passe de démonstration ne sont pas repris en production. Garder `SMS_MODE=disabled` tant que le fournisseur réel n’est pas configuré ; le mode SMS local est interdit sur ces environnements.

Les tags et images déjà publiés restent immuables. Toute modification applicative suit la stratégie de versionnement ; cette mise à jour documentaire ne modifie aucune ressource distante.

## Mise en service de la recette Render

1. Préparer la base Neon de recette et choisir une région adaptée à la proximité du service Render. Configurer les connexions TLS et les rôles distincts de migration et d’application ; vérifier RLS avec le compte applicatif réel.
2. Appliquer les migrations dans une tâche isolée avec l’image de la livraison. Un échec bloque la livraison. Ne pas injecter le compte propriétaire dans le service permanent.
3. Configurer **un seul service web Render sur le plan gratuit** avec l’empreinte de l’image `aveclesfemmes-render`, le port 8080, le contrôle de santé et les secrets de recette. `DATABASE_URL` utilise le rôle applicatif Neon ; `MIGRATION_DATABASE_URL` reste réservé à la tâche de migration.
4. Respecter la consigne de [IMPLEMENTATION.md](../IMPLEMENTATION.md) : tests locaux intégralement validés et autorisation explicite `VIZIODEPLOIE` avant déclenchement d’un déploiement distant. Le mécanisme GitHub de livraison décrit dans [VERSIONING.md](../VERSIONING.md) reste soumis à cette consigne.
5. Après déploiement, vérifier la version active, la connexion Neon, les droits des trois profils, les campagnes, les versements et annulations, ainsi que la PWA en HTTPS. Utiliser uniquement des données fictives en recette.
6. Enregistrer version, commit, empreinte, migrations, date et résultat de recette sans secrets. Les quotas et mécanismes de veille du plan gratuit restent des contraintes de test.

## Mise en service du VPS Dokploy

1. Provisionner le VPS, configurer SSH par clés, pare-feu, mises à jour, DNS, HTTPS et accès administratif restreint. Installer Dokploy et fixer une version qualifiée. Le VPS reste un point unique de panne ; aucune haute disponibilité n’est promise par ce premier déploiement.
2. Comme hypothèse de départ pour le pilote, prévoir 4 vCPU, 8 Go RAM et un stockage SSD extensible. Ajuster selon CPU, mémoire, latence et croissance de la base ; ce dimensionnement ne garantit pas la cible de 200 000 membres. Les builds restent dans GitHub Actions pour préserver les ressources du VPS.
3. Créer le projet Dokploy et la base Neon de production, séparée de la recette. Configurer les rôles, les connexions TLS, GHCR et les secrets propres à cet environnement. Déployer le Compose adapté avec les empreintes de la recette validée et les domaines Traefik vers les interfaces.
4. Exécuter les migrations une seule fois par livraison, sous verrou, avant les services. Sauvegarder avant migration ; employer des changements compatibles avec la version précédente et les anciennes PWA. Ne pas lancer plusieurs tâches de migration concurrentes.
5. Effectuer les mêmes contrôles de parcours et d’isolation qu’en recette, puis ouvrir l’accès au pilote. Automatiser ultérieurement la promotion via un environnement GitHub `production` avec autorisation explicite et identité de déploiement dédiée.

## Données, sauvegardes et retour arrière

La production démarre avec une base propre : les données fictives de Render ne sont pas importées. Si Render héberge ensuite un pilote avec des versements réels, la reprise de ces données devient une opération distincte : arrêter les écritures, sauvegarder, transférer par `pg_dump`/`pg_restore` avec gestion explicite des propriétaires et rôles, comparer effectifs et totaux par groupement/campagne, tester RLS, puis basculer les domaines. Une seule plateforme accepte des écritures. Après reprise des écritures sur le VPS, revenir sur l’ancienne base Neon de recette sans synchronisation ferait perdre des versements et est interdit.

Pour la production, programmer des sauvegardes PostgreSQL de Neon vers un stockage indépendant, chiffré, avec rétention de 30 jours et alerte d’échec. Vérifier aussi les possibilités de restauration et de rétention de l’offre Neon retenue avant ouverture. Sauvegarder aussi la configuration Dokploy et les éléments nécessaires à la restauration. Tester la restauration dans une base isolée avant ouverture puis mensuellement. Les sauvegardes de volumes ou du VPS ne remplacent pas la sauvegarde cohérente de PostgreSQL.

Objectifs initiaux proposés : RPO de 24 heures et RTO de 4 heures, à mesurer et faire valider avant des versements réels. Si 24 heures de perte potentielle est inacceptable, mettre en place archivage WAL et restauration à un instant donné ou une base managée adaptée avant ouverture.

Pour un incident applicatif, redéployer les trois empreintes de la livraison précédente conservée dans GHCR, après vérification de compatibilité du schéma. Aucune migration inverse automatique ni restauration destructive. Pour un incident de données, interrompre les écritures et restaurer selon une procédure contrôlée avec rapprochement des versements.

## Qualification et conséquences

Avant une ouverture générale : test de restauration, exercice de retour arrière, alertes disponibilité/erreurs API/sauvegardes/disque, logs sans secrets ni données sensibles, puis test de charge avec 200 000 adhésions et environ 10 millions de cotisations. Définir concurrence, profils de requêtes et seuils de latence avant le test. Ajuster les ressources Neon et celles du VPS selon les mesures de charge. Le limiteur actuellement en mémoire doit être partagé avant plusieurs instances API.

Render réduit l’exploitation nécessaire à la recette ; Dokploy conserve la portabilité Docker et le contrôle du VPS. Cette option ajoute deux configurations à maintenir et transfère à l’équipe la responsabilité de la sécurité, des mises à jour, des sauvegardes et de la disponibilité en production. La recette reste sur Render gratuit avec Neon ; la production utilise Dokploy avec une base Neon dédiée.

## Sources officielles

Références techniques ; offres, quotas et fonctionnalités à vérifier lors du provisionnement.

- [Render : images préconstruites, empreintes et registre privé](https://render.com/docs/deploying-an-image).
- [Render : réseau privé et contraintes des services gratuits](https://render.com/docs/private-network).
- [Neon : connexion des applications](https://neon.com/docs/connect/connect-intro).
- [Render : limitations du gratuit](https://render.com/docs/free).
- [Dokploy : domaines Compose et Traefik](https://docs.dokploy.com/docs/core/docker-compose/domains).
- [Dokploy : fournisseurs et registres](https://docs.dokploy.com/docs/core/providers).
- [Neon : documentation](https://neon.com/docs/introduction).
