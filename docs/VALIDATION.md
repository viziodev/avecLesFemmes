# Validation locale des versions

## Validation locale de la version 0.2.0

Exécutée le 15 octobre 2026 sur l'environnement local (PostgreSQL Docker 5433, Node v20.20.2).

### Résultats validés

- **Tests d'intégration API (16/16 réussis) :**
  - Authentification obligatoire et CSRF contrôlé.
  - Isolation RLS entre groupements et contexte de transaction.
  - Droits super administrateur en consultation sauf activation.
  - Les membres ne créent pas de campagne et ne voient pas la liste complète des membres.
  - Rôle administrateur attribué uniquement par super administrateur.
  - Cotisation idempotente et détection de contenu différent.
  - Versement libre et confidentialité de la vue membre.
  - Contrôles montants, dates et pagination.
  - Une administratrice conserve une vue de sa propre épargne.
  - Désactivation bloque la saisie et reste consultable.
  - Annulation conserve la cotisation et corrige les totaux.
  - OTP à usage unique, nombre de tentatives limité.
  - Déconnexion invalide la session.
  - **Authentification membre par code PIN à 4 chiffres et verrouillage anti-bruteforce (5 tentatives).**
  - **Gestion membre : adresse, sexe, fonction de groupement, blocage et déblocage avec traçabilité.**
  - **Tontine rotative (ROSCA), tirage au sort automatique, séances et état de la caisse en temps réel.**
- **Tests SemVer et synchronisation monorepo (4/4 réussis) :**
  - Validation SemVer des versions et préversions.
  - Respect de la progression SemVer.
  - Synchronisation parfaite des 6 packages (`package.json`, `package-lock.json`), manifestes et images sans régression.
  - Blocage de livraison si désynchronisation.
- **Typecheck & Build :**
  - TypeScript : 0 erreur sur l'ensemble des workspaces (`@aveclesfemmes/api`, `@aveclesfemmes/super-admin-web`, `@aveclesfemmes/membres-pwa`, `@aveclesfemmes/ui`, `@aveclesfemmes/api-client`).
  - Build Vite / PWA : génération propre des bundles et du service worker de cache PWA.
  - Formatage de code Prettier conforme sur 100% des fichiers.
- **Contrats et schémas :**
  - Schéma OpenAPI mis à jour (`docs/openapi.json`).
  - Typage TypeScript généré et synchronisé (`packages/api-client/src/schema.d.ts`).
  - Migration SQL `002_fonctions_tontines_qr.sql` appliquée et validée avec RLS complet (y compris politique UPDATE pour gestion membre).

---

## Validation locale du socle 0.1.0

Exécutée le 14 octobre 2026 sur des données fictives.

### Résultats

- Vérification TypeScript des trois applications réussie.
- Compilation de l’API, du web et de la PWA réussie ; manifest et service worker générés.
- Treize tests API réussis sur PostgreSQL embarqué avec les politiques RLS réelles.
- Cinq parcours Chromium réussis sur les conteneurs : super administrateur, saisie administratrice et vue personnelle, membre sur téléphone, OTP et déconnexion, double envoi concurrent.
- Trois requêtes concurrentes avec la même clé ont créé une seule cotisation sur PostgreSQL Docker.
- Quatre services applicatifs en bonne santé : PostgreSQL, API, web et PWA.
- Images de base Node.js, PostgreSQL et Nginx figées par empreinte ; images applicatives construites à plusieurs étapes.
- Audit npm sans vulnérabilité signalée après correction de js-yaml ; ce contrôle ne remplace pas l’analyse des images système.
- Sauvegarde pg_dump restaurée avec pg_restore dans la base locale séparée aveclesfemmes_restorecheck. Compteurs identiques au moment de la vérification : 5 groupements, 3 adhésions, 5 cotisations et 4 300 FCFA valides. Les données de démonstration peuvent ensuite changer lors de nouvelles recettes.

### Portée

Ces vérifications démontrent le fonctionnement du socle local. La capacité à plus de 1 000 groupements et 200 000 membres, les délais RPO et RTO, la disponibilité en production et l’envoi SMS réel ne sont pas encore qualifiés. La CI est définie mais n’a pas été exécutée sur GitHub. Aucun registre externe ni hébergement de production n’a été configuré ou publié.

Les hypothèses métier et les fonctions restant à préciser sont dans IMPLEMENTATION.md. La mise en production exige le cadrage final, les tests de charge et le pilote.
