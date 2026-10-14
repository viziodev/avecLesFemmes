# Journal des versions

## 0.1.2 Recette Render gratuite

- Image de test Render regroupant Nginx, API sur loopback, PWA à la racine et web super administrateur sous /admin/.
- Provisionnement initial isolé du rôle PostgreSQL applicatif.
- Exception ADR 014 : test temporaire gratuit avec base expirant après 30 jours.

## 0.1.1 Préparation du déploiement Render

- Amont API configurable au lancement des images web et PWA, pour le réseau privé Render.
- Conservation du protocole HTTPS transmis par la terminaison TLS.
- ADR 014 : recette Render puis production VPS Dokploy avec promotion des images par empreinte.

## 0.1.0 Premier socle

- Monorepo TypeScript et API NestJS modulaire.
- Web super administrateur et PWA membre et administratrice avec composants partagés.
- Groupements, comptes, membres, catalogue des types Avec, campagnes et participations.
- Cotisations transactionnelles et idempotentes, annulations traçables et totaux.
- Mot de passe et OTP téléphone ; envoi SMS local simulé, adaptateur externe à connecter.
- Isolation PostgreSQL par rôle applicatif et politiques de sécurité par ligne.
- Images Docker, Compose local et exemple de déploiement avec base externe.
- Contrat OpenAPI, client généré, CI, tests d’intégration et parcours navigateur.
- Synchronisation des versions du monorepo, tags annotés, métadonnées OCI et manifestes de livraison immuables ; publication GHCR préparée pour les tags validés en CI.

Cette version est un socle de développement, pas une validation de disponibilité ou de capacité à la cible. Voir docs/IMPLEMENTATION.md.
