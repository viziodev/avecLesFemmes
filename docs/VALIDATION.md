# Validation locale du socle 0.1.0

Exécutée le 14 octobre 2026 sur des données fictives.

## Résultats

- Vérification TypeScript des trois applications réussie.
- Compilation de l’API, du web et de la PWA réussie ; manifest et service worker générés.
- Treize tests API réussis sur PostgreSQL embarqué avec les politiques RLS réelles.
- Cinq parcours Chromium réussis sur les conteneurs : super administrateur, saisie administratrice et vue personnelle, membre sur téléphone, OTP et déconnexion, double envoi concurrent.
- Trois requêtes concurrentes avec la même clé ont créé une seule cotisation sur PostgreSQL Docker.
- Quatre services applicatifs en bonne santé : PostgreSQL, API, web et PWA.
- Images de base Node.js, PostgreSQL et Nginx figées par empreinte ; images applicatives construites à plusieurs étapes.
- Audit npm sans vulnérabilité signalée après correction de js-yaml ; ce contrôle ne remplace pas l’analyse des images système.
- Sauvegarde pg_dump restaurée avec pg_restore dans la base locale séparée aveclesfemmes_restorecheck. Compteurs identiques au moment de la vérification : 5 groupements, 3 adhésions, 5 cotisations et 4 300 FCFA valides. Les données de démonstration peuvent ensuite changer lors de nouvelles recettes.

## Portée

Ces vérifications démontrent le fonctionnement du socle local. La capacité à plus de 1 000 groupements et 200 000 membres, les délais RPO et RTO, la disponibilité en production et l’envoi SMS réel ne sont pas encore qualifiés. La CI est définie mais n’a pas été exécutée sur GitHub. Aucun registre externe ni hébergement de production n’a été configuré ou publié.

Les hypothèses métier et les fonctions restant à préciser sont dans IMPLEMENTATION.md. La mise en production exige le cadrage final, les tests de charge et le pilote.
