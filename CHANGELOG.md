# Journal des versions

## 1.0.0 — Livraison de l’incrément AvecLesFemmes

- Correctifs transitifs body-parser 2.4.0 et Multer 2.5.0 contre les dénis de service signalés en octobre 2026 ; test de survie du serveur après corps comprimé avec octets tardifs.

- Livraison unifiée des espaces Super Admin, administratrice et membre : campagnes, séances d’épargne, tontines, QR, reçus, historique et préférences d’affichage.
- Authentification par mot de passe initial et appareil autorisé, code secret, verrouillage après inactivité, coffre chiffré et synchronisation contrôlée des saisies hors ligne.
- Thèmes et palettes paramétrables, calendrier du premier dimanche du mois, contrôles métier et isolation PostgreSQL.
- Recette Render gratuite avec Neon, quatre images versionnées et déploiement par empreinte après CI. Remplacement des données de recette par le jeu de Nguith explicitement demandé, après sauvegarde et migrations ; production Dokploy séparée.

## 0.28.0 — Calendrier mensuel et groupement de Nguith

- Rencontres au premier, deuxième, troisième ou quatrième jour de semaine du mois, communes aux calendriers d’épargne et de tontine, aux contrôles de cotisation et aux vues membre/admin. Les anciens calendriers restent inchangés.
- Paramétrage de la fréquence mensuelle dans le formulaire de campagne et libellés explicites ; une tontine sans événement conserve cette absence.
- Migration additive 017 et initialisation locale de Nguith avec sauvegarde préalable, présidente Awa et trois campagnes, sans versement prérempli ni modification distante.

## 0.27.1 — Recette de la synchronisation dans l’interface

- Correction du bandeau hors ligne : le mode de synchronisation choisi dans « Saisies en attente » remplace l’ancien message annonçant systématiquement l’absence d’envoi automatique.
- Recette dans le navigateur contre l’API et PostgreSQL locaux réels : envoi automatique, confirmation manuelle par code, refus métier conservé et reprise avec la même saisie.

## 0.27.0 — Synchronisation automatique hors ligne

- Envoi automatique des saisies préalablement confirmées hors ligne au retour du réseau, dans une PWA ouverte et déverrouillée ; choix du mode manuel conservé dans le coffre.
- Autorisation signée de chaque saisie, liée à l’appareil, au compte, au chemin et au corps exact, sans mémoriser le code secret ou le mot de passe. Endpoint de rejeu limité aux cotisations, avec les contrôles métier et RLS existants.
- File séquentielle, référence idempotente conservée, réessai différé après coupure/5xx/429 et refus persistés sans boucle automatique. Bouton manuel et confirmation par code conservés.
- Les anciens brouillons non signés restent manuels ; aucun déplacement de date ni comptabilisation locale anticipée. Verrouillage et révocation des appareils respectés.
- ADR 022, contrat OpenAPI additif et tests API/mobiles dédiés. Aucune nouvelle migration et aucun déploiement distant.

## 0.26.0 — Correctifs de sécurité PWA

- Code secret lié à un appareil autorisé par le mot de passe initial ; preuve serveur HttpOnly de 30 jours, révocation à l’oubli d’appareil et au changement de code.
- Récupération globale réservée au Super Admin : révocation du code, des sessions et des appareils, sans remplacement du mot de passe initial ni secret choisi pour la membre.
- Fin de la création de comptes avec un PIN comme mot de passe : secret initial d’au moins 12 caractères ; les anciens mots de passe courts nécessitent une récupération vérifiée.
- Compteur commun transactionnel sous verrou PostgreSQL : blocage après cinq échecs y compris concurrents, validations des écritures avant le refus HTTP.
- Quotas par compte et plafond réseau, proxy de confiance limité ; CSP et protections HTTP rétablies sur les interfaces et actifs Docker/Render.
- Coffre hors ligne v3 : clé d’enveloppement fournie après authentification en ligne, mot de passe initial requis hors ligne, migration conservant les brouillons et suppression de la protection par PIN.
- Migrations 015–016, révocation des anciennes sessions PWA, contrats, ADR 021, tests de régression API/navigateur et qualification de concurrence PostgreSQL ; corrections locales, sans déploiement distant.

## 0.25.0 — Charte graphique PWA

- Typographie DM Sans commune aux deux profils : corps et formulaires à 16 px, informations secondaires à 14 px, navigation à 12 px, montants hiérarchisés et chiffres tabulaires.
- Polices WOFF2 servies localement avec leurs licences et intégrées au précache PWA ; aucune requête à Google Fonts dans les interfaces applicatives.
- Surfaces clair/sombre harmonisées, contrastes vérifiés sur les fonds réellement utilisés, navigation sélectionnée dédiée et états accompagnés d’une icône indépendante du type de campagne.
- Cartes, boutons, filtres, formulaires et reçus harmonisés ; montants des séances exprimés en FCFA et texte adaptable sans hauteur de ligne fixe.
- Nouveaux défauts tontine violet et solidarité ambre ; palettes personnalisées conservées, signalement des couleurs de type trop proches. Migration 014 limitée aux anciennes valeurs par défaut de la plateforme.

## 0.24.0 — Code secret et pavé numérique PWA

- Après le premier accès par identifiant/mot de passe, choix et confirmation d’un code secret de quatre chiffres ; reconnexion par code seul sur l’appareil mémorisé.
- Écrans épurés communs, quatre pastilles, pavé tactile, effacement, saisie au clavier et validation au quatrième chiffre. Thèmes et couleurs personnalisées conservés.
- Code secret distinct du mot de passe initial, qui permet la récupération. Confirmation des opérations sensibles par code vérifié au serveur ; blocage après cinq échecs, verrouillage à l’ouverture et après cinq minutes conservés.
- Nouveau coffre hors ligne avec clé de données aléatoire, code associé à une clé d’appareil non exportable dans IndexedDB et récupération protégée par le mot de passe initial. Migration conservant les brouillons et synchronisation par code secret.
- Migration 013, API additive et anciens clients par mot de passe compatibles. Super Admin web inchangé.

## 0.23.0 — Notifications et reçus PWA

- Notifications communes pour les actions de gestion, versements, raccourcis, apparence, QR et synchronisation ; retours distincts de réussite, information et échec.
- Reçu après validation serveur des encaissements et versements : membre, campagne, groupement, montant, séance ou tour, date d’enregistrement et référence ; partage natif ou copie.
- Présentation mobile commune en clair et sombre, couleurs de campagne, fermeture accessible et effacement au verrouillage. Une mise à jour PWA attend la fermeture du reçu.
- Aucun reçu pour une saisie refusée ou hors ligne en attente. La synchronisation confirmée produit le reçu avec la référence serveur ; aucune nouvelle opération n’est créée par la copie ou le partage.
- Date de création renvoyée par l’API pour une saisie et sa reprise idempotente, sans migration de données.

## 0.22.0 — Groupements, verrouillage et hors ligne

- Palette propre au groupement et à ses membres, modifiable par son administratrice avec aperçu clair/sombre et retour aux couleurs de la plateforme.
- Mot de passe à chaque ouverture, verrouillage au passage en arrière-plan et après cinq minutes d’inactivité ; expiration également contrôlée par le serveur.
- Confirmation par mot de passe des opérations sensibles, vérifiée côté serveur ; les lectures automatiques ne prolongent plus la session.
- Coffre local chiffré pour les données consultées et les encaissements/versements en attente. Déverrouillage hors ligne après une première connexion en ligne.
- Synchronisation manuelle, confirmation par mot de passe, références idempotentes conservées et refus serveur affichés sans modifier la date ou le montant.
- Migration 012 : palette des groupements sous RLS et activité des sessions.

## 0.21.0 — Couleurs configurables et connexion PWA

- Palette commune configurable par le super administrateur : couleur principale, épargne, tontine et solidarité, aperçus clair/sombre et restauration des valeurs par défaut.
- Nuances de texte et de boutons ajustées pour conserver le contraste ; QR et alertes conservent leurs couleurs fonctionnelles.
- PWA : première connexion par identifiant et mot de passe, puis identifiant mémorisé sur cet appareil et mot de passe seul avec validation au clavier.
- Changement de compte et oubli de l’appareil ; aucun mot de passe ni jeton stocké dans le navigateur.
- Migration 011, API de palette publique en lecture et réservée au super administrateur en écriture, avec RLS et journal d’audit.

## 0.20.0 — Interfaces Action du jour

- Intégration de la proposition retenue aux deux profils PWA : identité compacte, grand QR dans Ma carte, campagne et période du jour réunies avec les montants et l’action disponible.
- Navigation membre raccourcie, cartes communes de campagnes, séances, tours et versements, compte et préférences accessibles dans les deux thèmes.
- Vérification du versement personnel avant confirmation, référence après succès, blocage hors connexion et confidentialité conservée après rechargement.
- Retour du navigateur entre écrans PWA, reprise de pagination après erreur et distinction entre séances indisponibles et cahier vide. Retrait des statuts de sécurité et des destinations d’aide fictifs.

## 0.19.0 — Apparence de la PWA

- Modes Automatique (par défaut), Clair et Sombre dans Mon compte pour le membre et les paramètres pour la responsable.
- Préférence conservée sur l’appareil, appliquée dès l’ouverture et synchronisée entre les onglets. Le mode automatique suit les changements du thème du téléphone.
- Surfaces, textes, formulaires, historiques et couleurs des campagnes adaptés au thème sombre ; codes QR conservés noirs sur fond blanc.

## 0.18.0 — Identité membre et navigation commune

- Nom et identifiant du membre en gras dans le bandeau fixe, avec coordonnées du groupement et QR personnel. Retrait du bouton QR dupliqué dans la barre supérieure de l’espace personnel.
- Ajout aux raccourcis d’accueil depuis Plus pour le membre et l’administratrice, dans la limite de six campagnes, avec sauvegarde et gestion des erreurs.
- Icônes, cartes de choix et commande Afficher sur l’accueil communes aux écrans proposant les mêmes actions.

## 0.17.2 — Listes personnelles ciblées

- Mes campagnes affiche seulement les campagnes sélectionnées ; choix modifiables dans une fenêtre dédiée, accessible aussi depuis Plus.
- Mes versements affiche les cinq derniers versements, puis cinq de plus à chaque appui sur Voir plus ; filtres multiples et total global conservés.

## 0.17.1 — Bandeau membre fixe

- Retrait du montant et du nom de campagne du bandeau vert personnel.
- Identité du groupement et QR de 180 px dans une grille fixe de six lignes visuelles ; sélection de campagne sans modification du bandeau.
- Montants et commande de confidentialité conservés dans le détail de la campagne sous les actions.

## 0.17.0 — Historique global et accueil personnel

- Montant personnel collecté affiché avant la liste des versements d’épargne.
- Historique global incluant les campagnes archivées et filtres multiples par type, campagne, séance et tour, appliqués avant pagination.
- Campagnes d’accueil choisies par membre et groupement, six au maximum ; autres campagnes dans Plus, préférences distinctes de celles de l’administration.
- Badges des séances ouvertes et tours tirés non cotisés, y compris la période du jour, hors versements annulés.

## 0.16.0 — Accueil et versements personnels

- Accueil membre commun au groupement : identité, QR personnel, campagnes actives inscrites et total personnel par campagne.
- Versement personnel d’épargne après ouverture de la séance du jour ou de tontine après tirage du tour ; unicité par période, montant fixe/libre, idempotence et audit.
- Cinq versements ou tours par défaut, Voir plus et filtres par séance/tour ; badge des séances ouvertes passées sans versement et suivi des reversements/mois restants.
- Migration 009 : droits d’insertion personnels bornés, lecture limitée des bénéficiaires et verrouillage sans droit de modification de campagne.

## 0.15.0 Filtres de campagne et suivi des membres

- Campagnes actives filtrées par type sur la liste complète, avec les campagnes cochées par défaut et Voir plus pour les non sélectionnées.
- Sélecteur de membre avec recherche intégrée, navigation clavier et pagination ; suppression du champ de recherche séparé.
- Membres de la PWA en cartes de trois lignes, avec campagnes inscrites et montants versés en épargne. Inscriptions archivées et actions de gestion conservées dans le détail.
- API membres enrichie en une requête groupée pour la page ; montants valides uniquement, sans cotisations annulées, avec isolation des vues personnelles.

## 0.14.0 Campagnes et adhésions simplifiées

- Menu PWA limité aux cartes de campagne ; suppression des panneaux Participantes/forfaits et Sessions, et du délai de grâce sur les cartes.
- Choix persistant de six raccourcis par responsable et groupement ; autres campagnes accessibles dans Plus, Historique conservé.
- Ajouter un membre visible sur chaque carte fermée ; identité du groupement sur deux lignes.
- Recherche serveur des membres actifs non bloqués encore non inscrits, avant pagination ; doublons refusés.
- Montant commun en lecture seule pour la tontine ; épargne libre ou fixe au montant standard. Contrôles API des forfaits et du montant encaissé pour les cotisations fixes ; versements historiques et rejoués conservés.

## 0.13.0 Cartes compactes et bénéficiaire du tour

- Résumés des séances et des tours limités à trois lignes ; montants et libellés complets accessibles dans le détail.
- Menu Campagnes de la PWA présenté en cartes de quatre lignes, aux couleurs des types, avec sélection et actions existantes dans le détail.
- Bénéficiaire du tour identifiée dans la liste ; aucun délai de grâce ni absence liée à un ancien délai. Refus serveur de l’octroi de délai à la bénéficiaire.

## 0.12.0 Tours et délais de grâce

- Tour du jour (ou tour encore en cours) en tête ; trois derniers tours passés par date décroissante, puis « Voir plus » par lots de trois. Tours futurs masqués sur l’accueil.
- Raccourcis sur deux lignes au maximum : six campagnes, Plus pour les suivantes et Historique toujours accessible.
- Délai de grâce individuel depuis le détail d’un tour, avec échéance inclusive et prolongation auditée. Sans versement, « Absent » s’affiche seulement après expiration d’un délai accordé ; un versement prévaut.
- Délai réservé au responsable, après tirage, pour un membre inscrit sans versement du tour en cours. Échéance avant le prochain tour, sans raccourcissement d’un délai existant.

## 0.11.0 Tirage au début de chaque tour

- Tours de tontine présentés comme les séances d’épargne ; recherche et état des membres intégrés à chaque carte.
- Une seule bénéficiaire tirée le jour prévu du tour, parmi les membres encore éligibles ; les tours futurs restent sans attribution.
- Encaissement du jour autorisé après le tirage du tour en cours, contrôlé côté API et dans les interfaces de saisie et de scan.
- Tirages déjà enregistrés conservés et rejoués sans nouvelle attribution ; liste des participantes figée après le premier tirage.

## 0.10.0 Cotisations et suivi de tontine

- Filtre Tous / Cotisé / Pas cotisé et compteur rouge des non-cotisants dans les séances ; suppression du bouton interne.
- Tontine : montant à cotiser, total encaissé et total reversé réunis sur une ligne.
- Liste des membres par tour avec recherche et état avant pagination, présentation commune à l’épargne.
- Totaux de tours calculés sur leur période, y compris pour les rotations hebdomadaires.
- Protection du tirage enregistré et jeux de démonstration locaux pour le tirage et le suivi.

## 0.9.1 Cahiers de séance mobiles

- Cinq dernières séances affichées par défaut, puis « Voir plus » par lots de cinq.
- Carte de séance alignée sur le bouton d’encaissement : bandeau d’icône, couleur du type et flèche.
- Recherche par nom dans chaque séance, y compris les membres sans versement, avec prise en charge des accents.

## 0.9.0 Encaissement QR et historique mobile

- Encaissement par scan de carte membre, avec validation du groupement et de l’inscription côté API.
- Historique mobile regroupé par date, recherche et filtres par période et état avant pagination.
- Séances compactes avec flèche et accès à leurs encaissements.
- Jeux de démonstration locaux pour ouvrir une séance et tester l’encaissement du jour.

## 0.8.0 Ouverture des séances d’épargne

- Séance du jour ouverte par l’administratrice, de manière idempotente, selon le calendrier de la campagne (Africa/Dakar).
- Encaissement épargne autorisé uniquement à la date du jour et après ouverture ; rejets serveur hors calendrier.
- Séances ouvertes sans versement visibles ; historique conservé.
- Cartes de séance alignées sur la largeur du bouton d’encaissement.

## 0.7.2 Synthèse et relevé de séance

- Icône Historique placée après les campagnes actives.
- Totaux réunis dans un bandeau compact aux couleurs de la campagne.
- Lignes de séance avec nom à gauche, montant à droite, date et statut en dessous.

## 0.7.1 Accueil et cahiers simplifiés

- Retrait du suivi redondant et du second cahier de séance sur l’accueil gestion.
- Historique des cotisations déplacé dans une vue dédiée accessible par une icône.
- Aperçu limité aux cinq derniers membres distincts ayant cotisé ; Voir plus conserve tous les statuts.

## 0.7.0 Cahiers de séance d’épargne

- Totaux collecté et disponible et séances triées par date décroissante sur l’accueil Épargne.
- Détail des participantes, statut de versement, montant versé et attendu indicatif selon les forfaits actuels.
- Montants libres et versements partiels identifiés ; contrat API enrichi.

## 0.6.11 Informations de campagne et accès membres

- Accès Membres rétabli dans la navigation basse.
- Informations sous Encaisser identifiées et colorées selon la campagne sélectionnée.
- Filtres et pagination des participantes réinitialisés lors du choix de campagne.

## 0.6.10 Navigation centrée sur les campagnes

- Accueil limité aux raccourcis des campagnes actives.
- Navigation basse : Accueil, Campagnes et Plus.
- Membres, ajout de membre et chiffres regroupés dans Plus avec les archives et paramètres.

## 0.6.9 Identité du groupement et couleurs des campagnes

- QR agrandi, téléphone et adresse au-dessus du nom du groupement.
- Encaissement sous les raccourcis, affiché pour la campagne active sélectionnée.
- Couleurs par type de campagne, reprises sur le bouton d’encaissement.

## 0.6.8 Vue d’ensemble sans sélecteurs

- Retrait des sélecteurs de groupement et campagne sur l’accueil PWA.
- Priorité au groupement actif administré par le compte connecté ; campagnes accessibles par les raccourcis.

## 0.6.7 Raccourcis de campagne prioritaires

- Campagnes actives placées en tête du menu, avec les libellés courts Tontine et Épargne.
- Bouton « Encaisser un membre » placé au-dessus du menu ; nom complet de la campagne conservé dans le contexte.

## 0.6.6 Choix de campagne sur l’accueil

- QR du groupement à côté du solde et choix direct des campagnes actives.
- Épargne Avec sélectionnée par défaut ; encaissement lié à la campagne choisie.
- Raccourcis simplifiés ; archives accessibles dans les paramètres.

## 0.6.5 Accueil PWA inspiré de Wave

- Bandeau de solde vert, campagne visible et carte d’encaissement contrastée.
- Raccourcis compacts sur deux rangées, avec conservation des actions et droits existants.

## 0.6.4 Qualification d’un historique étendu

- Historique synthétique paramétrable de 1 à 10 cotisations par adhésion, soit jusqu’à 2 012 010 cotisations.
- Charge mixte sur deux groupements avec comptes distincts, percentiles de latence et rapprochement des totaux API/SQL.
- Stockage Docker temporaire isolé, contrôle de taille de la base et nettoyage du volume dédié.

## 0.6.3 Qualification isolée des volumes et écritures

- Environnement PostgreSQL temporaire sans port exposé, distinct du Compose local.
- Jeu synthétique de 1 001 groupements, 201 201 adhésions et cotisations.
- Vérification de la recherche paginée, des droits RLS, des confirmations concurrentes et du rapprochement des totaux.
- Rapport de qualification sans secrets, lié explicitement à l’image API testée.

## 0.6.2 Séances et rotations sur mobile

- Présentation en cartes des séances, tours de tontine et participations sur téléphone, avec libellés explicites.
- Détails de cotisations accessibles, état déplié annoncé et références longues lisibles.
- Conservation des tableaux sur ordinateur et des actions métier existantes.

## 0.6.1 Outillage de recette — lot 6

- Correction de la structure CI et utilisation du runner standard Ubuntu.
- Recette tactile des deux profils sur Chromium et WebKit émulés, avec configuration Playwright dédiée.
- Scénario k6 local authentifié, limité aux lectures métier, avec seuils bloquants et image figée par empreinte dans un profil Docker explicite.
- Restauration du focus après fermeture du QR sur WebKit tactile.
- Aucun changement du contrat API ou du schéma de données.

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
