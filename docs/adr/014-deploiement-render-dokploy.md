# ADR 014 — Recette sur Render, production sur VPS avec Dokploy

Date : 14 octobre 2026. Statut : décision retenue ; mise en œuvre et qualification à réaliser. Dokploy confirmé par le porteur du projet. Complète les ADR 002, 009, 010 et 012.

## Contexte et décision

AvecLesFemmes doit disposer rapidement d’un environnement de test accessible en HTTPS, puis être exploité sur un VPS. La cible métier dépasse 1 000 groupements et 200 000 membres ; cette volumétrie ne constitue pas une mesure de charge simultanée.

Render héberge la recette. Dokploy, installé sur un VPS, pilote la production. GitHub Actions construit et teste les images ; GHCR conserve les livraisons. La même livraison, référencée par ses trois empreintes `image@sha256`, passe de Render à Dokploy sans reconstruction. Les configurations et secrets diffèrent entre environnements ; les données de recette restent séparées des données réelles.

Les déploiements de recette sont déclenchés après réussite de la CI et publication complète du manifeste. La promotion en production est une action explicite après recette. Les plateformes ne reconstruisent pas automatiquement chaque commit de `main`. Aucun déploiement n’utilise `latest`.

## Topologie retenue

### Exception de test gratuite demandée le 14 octobre 2026

Le porteur demande un déploiement Render entièrement gratuit et refuse une adresse API publique séparée. La démonstration utilise donc un seul service web gratuit et une image dédiée `aveclesfemmes-render`, contenant Nginx, le web super administrateur sous `/admin/`, la PWA à la racine et NestJS sur `127.0.0.1:3000`. Seul le port Nginx 8080 est exposé ; les routes protégées `/api/v1` restent accessibles sur le même domaine HTTPS. PostgreSQL reste séparé et son rôle applicatif conserve RLS. Les services peuvent être mis en veille et PostgreSQL gratuit expire après 30 jours. Aucune donnée réelle ni garantie de disponibilité dans cet environnement. Ce choix remplace la recette payante pour le premier test uniquement ; la production Dokploy reste inchangée. La PWA exclut `/admin/` du repli de navigation de son service worker.

| Composant                       | Recette Render                                           | Production Dokploy                                           |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Web super administrateur        | Service web Docker, HTTPS, port interne 8080             | Service Compose, domaine HTTPS, Traefik vers 8080            |
| PWA membres et administratrices | Service web Docker, HTTPS, port interne 8080             | Service Compose, domaine HTTPS, Traefik vers 8080            |
| API NestJS                      | Service privé, port 3000, même région que les interfaces | Service interne Compose nommé `api`, port 3000               |
| PostgreSQL                      | Render Postgres payant, connexion interne                | PostgreSQL géré par Dokploy, volume persistant, réseau privé |
| Migrations                      | Tâche ponctuelle avant activation de la livraison        | Tâche ponctuelle avant activation de la livraison            |

Les navigateurs appellent `/api/v1` sur leur propre domaine ; Nginx relaie `/api/` vers l’API interne. Cela conserve les cookies de session sur la même origine. Seules les interfaces sont exposées publiquement ; la base et l’API ne reçoivent aucun port public. L’accès administratif à Dokploy et au VPS est restreint aux exploitants.

La base Dokploy constitue une évolution de l’exemple actuel `compose.production.yaml`, qui suppose PostgreSQL externe. Un fichier Compose adapté devra expliciter le réseau partagé avec la base et Traefik, supprimer les publications localhost au profit du routage Dokploy et conserver les contrôles de santé. Une base managée externe reste une option ultérieure si les mesures ou objectifs de disponibilité le justifient.

## Préparation technique obligatoire

1. Rendre l’amont Nginx configurable au lancement, par exemple avec `API_UPSTREAM`. Le `api:3000` actuel fonctionne dans Compose mais pas avec le nom interne attribué par Render. Résoudre aussi le renouvellement DNS et vérifier les en-têtes HTTPS derrière les proxies.
2. Maintenir `PORT=3000` pour l’API et le port 8080 des interfaces ; configurer les contrôles `/api/v1/health/ready` et `/healthz`. Vérifier la connexion PostgreSQL dans la readiness et effectuer séparément un contrôle de bout en bout des interfaces.
3. Qualifier PostgreSQL et les permissions sur chaque plateforme : compte applicatif `aveclesfemmes_app` non propriétaire, sans `SUPERUSER` ni `BYPASSRLS`, distinct du compte de migration. Vérifier que le fournisseur permet le provisionnement des rôles et l’exécution des migrations existantes. Exécuter les tests d’isolation avec ce compte réel ; aucun contournement de RLS pour faciliter le déploiement.
4. Tester les connexions TLS PostgreSQL avec vérification du certificat et le client `pg` ; documenter les URL internes, autorités de certification et droits nécessaires. Conserver une version majeure PostgreSQL compatible entre recette et production, qualifiée avant provisionnement.
5. Créer des secrets propres à chaque environnement : connexion applicative, connexion de migration, `OTP_SECRET`, origines HTTPS exactes et éventuels identifiants SMS. Le compte de migration est réservé à la tâche ponctuelle et retiré des services permanents. Le registre privé utilise un accès en lecture aux packages.
6. Initialiser le premier super administrateur par la commande de bootstrap existante et un secret temporaire. Les comptes et mots de passe de démonstration ne sont pas repris en production. Garder `SMS_MODE=disabled` tant que le fournisseur réel n’est pas configuré ; le mode SMS local est interdit sur ces environnements.

Ces adaptations nécessitent une nouvelle livraison ; elles ne modifient pas les images ni le tag `v0.1.0` déjà publiés. Le présent ADR ne certifie pas que ces images sont directement déployables sur Render.

## Mise en service de la recette Render

1. Choisir une région commune aux quatre composants, les domaines de recette et une offre payante pour l’API privée et PostgreSQL. Le gratuit peut servir à une démonstration temporaire, mais ne constitue pas la recette persistante retenue : veille des services, limitations réseau et expiration de la base gratuite.
2. Provisionner PostgreSQL, les rôles et leurs secrets ; appliquer les migrations dans une tâche isolée avec l’image API de la livraison. Une migration échouée bloque le déploiement. Ne pas injecter le secret propriétaire dans l’API pour utiliser simplement une commande pre-deploy.
3. Configurer les trois services avec les empreintes GHCR, les ports, les contrôles de santé et les variables nécessaires. Les services fondés sur des images préconstruites sont déployés explicitement via le tableau de bord ou l’API Render.
4. Déployer l’API, puis les interfaces. Charger uniquement des données fictives. Vérifier connexion, permissions des trois profils, campagnes, versement idempotent, annulation, montants et installation PWA en HTTPS.
5. Enregistrer version, commit, empreintes, état des migrations, date, résultat de recette et configuration non secrète. Automatiser ensuite le provisionnement par Blueprint et la livraison via un environnement GitHub `test`, sans exposer les hooks ni les secrets dans les journaux.

## Mise en service du VPS Dokploy

1. Provisionner le VPS, configurer SSH par clés, pare-feu, mises à jour, DNS, HTTPS et accès administratif restreint. Installer Dokploy et fixer une version qualifiée. Le VPS reste un point unique de panne ; aucune haute disponibilité n’est promise par ce premier déploiement.
2. Comme hypothèse de départ pour le pilote, prévoir 4 vCPU, 8 Go RAM et un stockage SSD extensible. Ajuster selon CPU, mémoire, latence et croissance de la base ; ce dimensionnement ne garantit pas la cible de 200 000 membres. Les builds restent dans GitHub Actions pour préserver les ressources du VPS.
3. Créer le projet de production, PostgreSQL et son volume durable. Configurer le réseau privé, les rôles, GHCR et les secrets. Déployer le Compose adapté avec les empreintes de la recette validée et les domaines Traefik vers les interfaces.
4. Exécuter les migrations une seule fois par livraison, sous verrou, avant les services. Sauvegarder avant migration ; employer des changements compatibles avec la version précédente et les anciennes PWA. Ne pas lancer plusieurs tâches de migration concurrentes.
5. Effectuer les mêmes contrôles de parcours et d’isolation qu’en recette, puis ouvrir l’accès au pilote. Automatiser ultérieurement la promotion via un environnement GitHub `production` avec autorisation explicite et identité de déploiement dédiée.

## Données, sauvegardes et retour arrière

La production démarre avec une base propre : les données fictives de Render ne sont pas importées. Si Render héberge ensuite un pilote avec des versements réels, sa migration devient une opération distincte : arrêter les écritures, sauvegarder, transférer par `pg_dump`/`pg_restore` avec gestion explicite des propriétaires et rôles, comparer effectifs et totaux par groupement/campagne, tester RLS, puis basculer les domaines. Une seule plateforme accepte des écritures. Après reprise des écritures sur le VPS, revenir sur l’ancienne base Render sans synchronisation ferait perdre des versements et est interdit.

Pour le pilote VPS, programmer des sauvegardes PostgreSQL quotidiennes vers un stockage S3 hors VPS, chiffré, avec rétention de 30 jours et alerte d’échec. Sauvegarder aussi la configuration Dokploy et les éléments nécessaires à la restauration. Tester la restauration dans une base isolée avant ouverture puis mensuellement. Les sauvegardes de volumes ou du VPS ne remplacent pas la sauvegarde cohérente de PostgreSQL.

Objectifs initiaux proposés : RPO de 24 heures et RTO de 4 heures, à mesurer et faire valider avant des versements réels. Si 24 heures de perte potentielle est inacceptable, mettre en place archivage WAL et restauration à un instant donné ou une base managée adaptée avant ouverture.

Pour un incident applicatif, redéployer les trois empreintes de la livraison précédente conservée dans GHCR, après vérification de compatibilité du schéma. Aucune migration inverse automatique ni restauration destructive. Pour un incident de données, interrompre les écritures et restaurer selon une procédure contrôlée avec rapprochement des versements.

## Qualification et conséquences

Avant une ouverture générale : test de restauration, exercice de retour arrière, alertes disponibilité/erreurs API/sauvegardes/disque, logs sans secrets ni données sensibles, puis test de charge avec 200 000 adhésions et environ 10 millions de cotisations. Définir concurrence, profils de requêtes et seuils de latence avant le test. Prévoir de déplacer la base ou séparer les services si les mesures dépassent la capacité du VPS. Le limiteur actuellement en mémoire doit être partagé avant plusieurs instances API.

Render réduit l’exploitation nécessaire à la recette ; Dokploy conserve la portabilité Docker et le contrôle du VPS. Cette option ajoute deux configurations à maintenir et transfère à l’équipe la responsabilité de la sécurité, des mises à jour, des sauvegardes et de la disponibilité en production. La production intégralement sur Render et le déploiement VPS par scripts SSH seuls ne sont pas retenus pour ce premier parcours.

## Sources officielles

Consultées le 14 octobre 2026 ; offres et fonctionnalités à revérifier au provisionnement.

- [Render : images préconstruites, empreintes et registre privé](https://render.com/docs/deploying-an-image).
- [Render : réseau privé et contraintes des services gratuits](https://render.com/docs/private-network).
- [Render : PostgreSQL et connexions](https://render.com/docs/postgresql-creating-connecting).
- [Render : limitations du gratuit](https://render.com/docs/free).
- [Dokploy : domaines Compose et Traefik](https://docs.dokploy.com/docs/core/docker-compose/domains).
- [Dokploy : fournisseurs et registres](https://docs.dokploy.com/docs/core/providers).
- [Dokploy : sauvegardes PostgreSQL vers S3](https://docs.dokploy.com/docs/core/databases/backups).
