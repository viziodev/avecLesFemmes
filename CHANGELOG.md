# Journal des versions

## 0.6.0 Reprise réseau et mises à jour PWA — lot 5

- Nouvel essai d’enregistrement du service worker après échec, au retour réseau ou à la reprise de l’application.
- Erreur de vérification de session distincte d’une déconnexion, avec bouton de reprise et nouvel essai au retour réseau.
- Protection de sortie du navigateur pendant les formulaires et opérations ; brouillon conservé en mémoire après coupure, sans stockage local de données financières.
- Message explicite pour une confirmation interrompue et blocage des mutations hors connexion ; nouvelle tentative manuelle avec la même clé d’idempotence.
- Tests navigateur du cycle réel du service worker entre deux versions et de la reprise d’encaissement après interruption.

## 0.5.0 Gestion et encaissement guidé — lot 4

- Navigation mobile de gestion : Accueil, Encaisser, Membres et Plus.
- Encaissement en deux étapes avec choix explicite de campagne et participante, récapitulatif puis confirmation.
- Recherche serveur par nom ou téléphone pour membres et participantes, avec pagination ; recherche de versements par nom/téléphone et date.
- Listes de membres, campagnes et versements présentées en cartes sur mobile.
- Verrou de requête côté interface, conservation de la clé d’idempotence en cas d’échec et suppression des promesses de frais non calculées.

## 0.4.0 Espace membre — lot 3

- Navigation dédiée : Accueil, Mes campagnes, Mes versements et Mon compte.
- Accueil personnel avec montant de la campagne, QR et règles de participation.
- Campagnes actives et désactivées consultables ; historique en cartes avec référence et statut.
- Masquage cohérent des montants et forfaits dans toutes les rubriques personnelles.
- Bascule personnelle de l’administratrice sans conserver les totaux de gestion à l’écran.

## 0.3.0 Socle mobile PWA — lot 2

- Navigation fixe en bas sur téléphone, avec indication de la page active.
- En-tête compact et détails du groupement repliables ; sélecteur natif accessible.
- Cibles tactiles de 44 px minimum, champs de 16 px, prise en compte des zones sûres et des préférences de réduction des animations.
- Dialogues adaptés à la hauteur disponible, focus contenu et restauré, défilement de fond bloqué.
- Inclut les corrections locales 0.2.2 et la mise à jour automatique 0.2.1, pas encore publiées.

## 0.2.2 Fiabilité des parcours PWA — lot 1

- Chiffres limités aux totaux réels de la campagne : retrait des séries fictives, périodes et frais non calculés.
- Distinction entre cotisations personnelles et solde de caisse ; une caisse non chargée est indiquée comme indisponible.
- Confirmation vocale uniquement après succès serveur, erreur visible dans le formulaire conservé.
- Retrait du scanner simulé ; présentation du QR personnel.
- Sélection réelle de campagne dans l’historique à la place des catégories inopérantes.
- Choix explicite de la participante et remise à zéro du montant lors du passage à une participation libre.

## 0.2.1 Mise à jour automatique de la PWA

- Détection au lancement, au retour en ligne ou au premier plan et toutes les cinq minutes visibles.
- Activation et rechargement différés pendant les formulaires, les enregistrements et la connexion, y compris si un autre onglet active la version.
- Conservation de la version courante hors ligne. Les utilisateurs de 0.2.0 doivent cliquer une dernière fois sur « Mettre à jour » pour installer ce mécanisme.

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
