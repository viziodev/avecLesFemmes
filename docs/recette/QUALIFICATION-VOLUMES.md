# Qualification isolée des volumes et encaissements

Compte rendu complété le 19 octobre 2026. Outillage 0.6.4, application testée 0.6.2, sans changement métier ni migration nouvelle.

## Environnement et isolation

`compose.qualification.yaml` utilise le projet distinct `aveclesfemmes-qualification`, un réseau interne et aucun port publié. Depuis l’outillage 0.6.4, PostgreSQL stocke ses données dans un volume Docker jetable propre à ce projet (le scénario initial utilisait un système de fichiers en mémoire de 1 Go), avec 1,5 Go de mémoire et 2 CPU maximum ; le processus API/test dispose de 768 Mo et 2 CPU maximum. Les identifiants présents dans ce Compose sont exclusivement ceux de cette base jetable, sans accès à la base de démonstration ou à Neon.

Le script refuse tout hôte autre que `qualification-db`, toute base autre que `qualification` et une base déjà initialisée. Il ne contient aucune suppression de données. Les migrations existantes sont appliquées avec le propriétaire ; les requêtes HTTP utilisent ensuite le rôle applicatif sans privilège ni propriété des tables. Le rôle est contrôlé avant les essais.

Le jeu synthétique contient 1 001 groupements, 201 adhésions par groupement, une campagne par groupement, 201 201 participations et 201 201 cotisations initiales. Trois comptes permettent de tester administratrice, membre et administratrice d’un autre groupement. Les autres adhésions ne disposent pas d’un compte de connexion ; ce jeu ne simule pas 201 201 utilisatrices connectées.

## Exécution reproductible

Construire d’abord l’image API de la version à qualifier. Exécuter depuis la racine du dépôt :

```sh
export QUALIFICATION_IMAGE=aveclesfemmes-api:0.6.2
npm run test:qualification
# Après lecture du rapport, retrait du seul environnement jetable :
docker compose -f compose.qualification.yaml down --volumes
```

La variable doit désigner une image locale déjà construite ; aucun déploiement n’est déclenché. En CI, l’empreinte locale de l’image construite est utilisée pour éviter l’ambiguïté d’un tag. Sur Linux, définir `QUALIFICATION_UID` et `QUALIFICATION_GID` avec l’utilisateur propriétaire du dossier de rapport pour permettre son écriture. La CI configure ces valeurs, conserve le rapport et nettoie la base temporaire même en cas d’échec. La qualification fait partie du job de vérification dont dépend la livraison.

Le rapport local par défaut est écrit dans [qualification/latest.json](qualification/latest.json), sans cookies ni mots de passe. Il est remplacé à chaque exécution. La CI utilise `QUALIFICATION_REPORT=ci.json` et ne peut donc pas publier par erreur le rapport historique si la qualification n’a pas démarré ; ce rapport distinct est conservé comme artefact. La CI modifiée n’a pas encore été exécutée sur GitHub.

## Résultats observés

Exécution locale enregistrée le 18 octobre 2026 à 22:36 UTC, avec `aveclesfemmes-api:0.6.2` :

| Contrôle                                        | Résultat                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Construction du jeu synthétique                 | 14,742 secondes                                                      |
| Comptages                                       | 1 001 groupements ; 201 201 adhésions, participations et cotisations |
| Recherche, pagination et recherche d’historique | Vérifiées ; ensemble du scénario en 64 ms                            |
| Accès membre et autre groupement                | Périmètre personnel vérifié ; accès intergroupement refusé           |
| RLS sans passer par les contrôleurs             | Aucune ligne étrangère visible avec le rôle applicatif               |
| 20 confirmations simultanées, même clé          | Un seul versement créé ; ensemble en 99 ms                           |
| Même clé avec montant différent                 | Refus HTTP 409                                                       |
| 20 versements distincts simultanés              | Tous enregistrés ; ensemble en 64 ms                                 |
| Rapprochement du groupement testé               | 222 cotisations, total exact de 22 850 FCFA                          |

La base temporaire a été retirée après l’essai. La base locale habituelle n’a pas été modifiée par cette qualification.

## Limites et suite

Ces durées mesurent des scénarios complets sur une machine locale, pas des percentiles de latence ou un engagement de débit. Le test démontre le fonctionnement des contrôles sur ce volume et une concurrence courte sur une campagne. Il ne qualifie pas une charge soutenue, une concurrence sur plusieurs campagnes, les connexions de 200 000 comptes, Neon, la latence réseau ou la disponibilité en production.

Le scénario étendu ci-dessous complète ces premiers résultats avec deux millions de cotisations et deux groupements actifs. Restent à mesurer : davantage de comptes actifs simultanément, charge prolongée avec lecture/écriture, consommation CPU/mémoire dans la durée et comportement du limiteur à saturation. Les sauvegardes, la restauration et les essais sur téléphones physiques restent des validations distinctes.

## Vérification finale de l’intégration CI en local

Une seconde exécution a réussi avec l’image immuable `sha256:123017dbb7ce88fb6863f0f5973a41a8e5a693491d6b3bb282a97b7900cfcdde` et le nom de rapport séparé de la CI. Tous les contrôles passent à nouveau : préparation 14,864 s ; scénario de recherche 77 ms ; 20 confirmations identiques 108 ms ; 20 versements distincts 103 ms. Le total final reste exactement de 222 cotisations et 22 850 FCFA dans le groupement testé. Voir [le rapport de cette exécution](qualification/immutable-image.json). Cela valide localement la configuration ; le workflow GitHub reste non exécuté à ce stade.

## Scénario étendu de l’outillage 0.6.4

```sh
export QUALIFICATION_IMAGE=aveclesfemmes-api:0.6.2
QUALIFICATION_HISTORY=10 QUALIFICATION_ROUNDS=30 QUALIFICATION_REPORT=history-two-million.json npm run test:qualification
docker compose -f compose.qualification.yaml down --volumes
```

`QUALIFICATION_HISTORY` accepte de 1 à 10 journées de cotisations par adhésion. Le jeu maximal contient 2 012 010 cotisations, réparties entre les 1 001 groupements. L’insertion s’effectue par lots journaliers ; la taille de la base est contrôlée après chaque lot et l’essai est arrêté si elle atteint 3 Go. Ce contrôle n’est pas un quota disque : les journaux PostgreSQL et les fichiers du volume peuvent occuper davantage de place. Le volume est supprimé explicitement après conservation du rapport.

`QUALIFICATION_ROUNDS` accepte de 0 à 30 cycles. Chaque cycle effectue une lecture d’historique et un versement par deux administratrices indépendantes, dans deux groupements, avec une pause de deux secondes. Le limiteur reste actif. Les latences comprennent la requête HTTP complète et le décodage JSON ; le rapport contient p50, p95, p99 et maximum pour les lectures et écritures. Les erreurs HTTP font échouer l’essai. Les totaux SQL et API sont rapprochés pour chacun des deux groupements. Le seuil exploratoire p95 est fixé à 2 secondes pour chaque catégorie.

Il s’agit d’un essai mixte d’environ une minute avec deux groupes actifs, pas d’un test d’endurance ni d’une simulation de milliers de sessions simultanées. La CI conserve le scénario court par défaut (`QUALIFICATION_HISTORY=1`, `QUALIFICATION_ROUNDS=0`) ; l’essai étendu se lance explicitement.

## Résultats du scénario étendu — 19 octobre 2026

Le [rapport conservé](qualification/history-two-million.json) confirme la réussite avec la même image immuable de l’application 0.6.2. Les 2 012 010 cotisations initiales ont été chargées en 139,223 secondes. La taille PostgreSQL mesurée est de 1 196 897 983 octets (environ 1 141 Mio, hors journaux).

Recherche paginée, portée membre, isolation RLS, détection des doublons et conflit de contenu passent sur ce volume. Les vingt confirmations identiques produisent un seul versement ; les vingt versements distincts sont tous enregistrés.

| Mesure                     | Lectures d’historique | Versements |
| -------------------------- | --------------------- | ---------- |
| Requêtes du scénario mixte | 60                    | 60         |
| p50                        | 151 ms                | 6 ms       |
| p95                        | 184 ms                | 10 ms      |
| p99 / maximum              | 243 ms                | 28 ms      |

Le scénario mixte dure 64,999 secondes, sans erreur. Les totaux de chacun des deux groupements sont rapprochés entre SQL et API. Le limiteur reste actif et les seuils p95 de 2 secondes sont respectés.

Deux relevés ponctuels pendant l’essai ont montré environ 936 puis 965 Mio pour PostgreSQL, et 33 puis 73 Mio pour le processus API/test. Ce ne sont pas des maxima mesurés en continu. Les résultats concernent uniquement cette machine locale et ce scénario à deux administratrices, sans latence Internet ou Neon.

Les conteneurs, le réseau et le volume jetable ont été supprimés après conservation du rapport. La base locale habituelle est préservée. Restent ouverts : endurance, concurrence représentative de nombreux comptes, recette sur appareils physiques et exécution du workflow GitHub après publication autorisée. Aucun déploiement distant n’a été effectué.
