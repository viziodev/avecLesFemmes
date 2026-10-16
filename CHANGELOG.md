# Journal des versions

## 0.2.0 Fonctions, tontines rotatives, QR codes, délais de grâce et dashboards

- Catalogue des fonctions de groupement (Présidente, Trésorière, Secrétaire, Membre simple...) avec affectation par groupement et éligibilité au rôle administrateur.
- Référentiel des événements (AVEC, RAMADAN, TABASKI, SOLIDARITE, RENTREE) et configuration par groupement avec montant standard et souscription obligatoire ou optionnelle (Option B).
- Authentification membre simplifiée par numéro de téléphone + code PIN à 4 chiffres avec hachage scrypt et verrouillage anti-bruteforce (5 tentatives).
- Cartes et codes QR vectoriels SVG légers pour les membres (émargement rapide en séance) et pour les groupements.
- Gestion des membres enrichie : champs adresse et sexe, blocage/déblocage avec traçabilité d'audit, réinitialisation de code PIN par l'administratrice ou le super administrateur.
- Tontines rotatives (ROSCA) : tirage au sort automatique avec ordre réorganisable, calcul automatique de la date de fin, attribution et versement des cagnottes.
- Délais de grâce individuels et flexibles (Option C) avec indicateur d'échéance et motif.
- Tableau de bord administratrice : vue restreinte aux campagnes en cours, état de la caisse en temps réel (encaissé, reversé, solde) et cahier de séance détaillé.
- Tableau de bord membre : expérience simplifiée (faible littératie numérique), bouton QR code proéminent et historique des versements style Mobile Money (Wave / Orange Money) avec filtres par événement.
- Cockpit 360° Super Administrateur : vue consolidée multi-groupements de toutes les caisses et paramétrage complet de la plateforme.

## 0.1.3 Création de groupement et livraison automatique

- Suppression du champ Responsable dans le formulaire ; création possible sans ce champ, avec compatibilité des anciens clients.
- Préparation de la livraison automatique après fusion et du déploiement Render par empreinte.

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
