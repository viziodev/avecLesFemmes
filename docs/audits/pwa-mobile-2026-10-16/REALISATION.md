# Réalisation de l’amélioration mobile

## Lot 1 — fiabilité, version 0.2.2

Branche : `codex/pwa-fiabilite-mobile`, construite sur le travail de mise à jour automatique PWA 0.2.1 encore non livré. Aucun déploiement distant déclenché.

### Corrections réalisées

- Les chiffres montrent le total réel et le nombre de versements valides depuis le début de la campagne. Les séries fictives, périodes non calculées et promesses de frais ont été retirées. Une évolution vers de vrais graphiques nécessitera des agrégats serveur par période, pas un calcul sur la seule page d’historique.
- L’espace membre présente ses cotisations enregistrées, sans les qualifier de solde disponible. L’espace gestion affiche le solde renvoyé par la caisse ; une réponse indisponible ne se transforme pas en zéro et la valeur de la campagne précédente est effacée au changement de contexte.
- Un échec serveur conserve le formulaire et affiche l’erreur à l’intérieur. La confirmation vocale ne se déclenche qu’après la réponse de succès.
- Le scanner simulé a été supprimé. La carte membre permet de présenter le QR personnel existant. La lecture caméra réelle reste à implémenter et valider.
- Les catégories d’historique sans effet sont remplacées par une sélection explicite de campagne, reliée à la requête serveur et remettant la pagination à la première page. Les sélecteurs restent limités aux campagnes de la page chargée ; la recherche globale relève du lot 4.
- Le bouton membre « Cotiser » devient « Mes campagnes ». Les raccourcis Solidarité et Tontines donnent une destination ou une explication au lieu de ne rien faire.
- La participante doit être choisie explicitement. Passer d’un forfait à un montant libre efface le montant précédent.

### Validation

- Version commune 0.2.2 synchronisée ; contrat API inchangé et aucune migration.
- Typage et compilation API, web et PWA réussis.
- 16 tests API réussis.
- 10 tests ciblés confirmation, mise à jour PWA et versionnement réussis.
- Formatage et contrôle des différences réussis.
- Construction Docker des deux interfaces réussie ; services locaux sains sur les ports 8085 et 8086. L’API locale existante reste en 0.2.0, le contrat utilisé est inchangé.
- Trois parcours navigateur réussis : enregistrement administratrice, consultation membre mobile, refus serveur conservant le formulaire et son montant.
- Vérification visuelle du résumé financier : [capture](13-lot1-chiffres-reels.jpg).

## Suite du plan

2. Socle mobile : navigation basse, en-tête compact, cartes, focus des dialogues et cibles tactiles.
3. Espace membre : accueil personnel, versements, campagnes terminées, confidentialité des montants.
4. Espace administratrice : encaissement guidé, recherche et filtres serveur sur toutes les pages, gestion de plus de 200 membres.
5. Robustesse PWA : essais de mises à jour entre deux versions, interruptions réseau et récupération de saisie.
6. Recette représentative et validation sur téléphones réels, avant promotion.

La mise en recette suit la consigne `VIZIODEPLOIE` de `docs/IMPLEMENTATION.md` après validation locale. Les constats d’audit décrivent la version 0.2.0 observée et restent conservés comme référence.

## Lot 2 — socle mobile, version 0.3.0

Branche : `codex/pwa-socle-mobile`. Elle conserve les modifications locales du lot 1, non encore publiées.

- Navigation principale fixe en bas jusqu’à 760 px, avec page courante annoncée. L’accueil revient au tableau de bord, même après consultation des chiffres ou des paramètres.
- En-tête compact et retrait des répétitions décoratives sur téléphone. Les détails du groupement sont accessibles dans un volet repliable. Le sélecteur natif remplace l’autocomplétion au toucher ; la pagination des groupements reste accessible.
- Contrôles tactiles de 44 px minimum ; champs à 16 px pour limiter le zoom automatique. Espacement réservé au bas de page et prise en compte des zones sûres.
- Dialogues limités à la hauteur dynamique de l’écran, formulaires en une colonne et prise en compte de la réduction des animations.
- Focus placé dans le dialogue, circulation Tab/Maj+Tab contenue, restauration du focus à la fermeture. Le fond ne défile plus pendant la saisie.
- Le web super administrateur conserve sa navigation ; les améliorations de focus du composant de dialogue sont partagées.

Les listes en cartes et les parcours métier propres à chaque rôle restent dans les lots 3 et 4. Les essais sur appareils réels avec clavier virtuel et en mode PWA installé restent nécessaires : l’émulation de largeur ne les remplace pas.

Validation du lot 2 : typage et construction des interfaces réussis, 10 tests ciblés réussis, formatage et cohérence de version validés. Les 9 parcours navigateur passent : 6 combinaisons profil/largeur (360, 390 et 430 px) vérifiant navigation, débordement, accès à l’encaissement et focus du dialogue, plus les 3 parcours de non-régression du lot 1. Les deux interfaces Docker locales sont saines en 0.3.0 ; l’API locale reste en 0.2.0, sans changement de contrat. Aucun déploiement distant.

[Capture de l’accueil mobile corrigé](14-lot2-accueil-mobile.jpg)

## Lot 3 — espace membre, version 0.4.0

Branche `codex/pwa-espace-membre`, qui conserve les lots locaux précédents.

- Composant dédié à la consultation personnelle, partagé entre membre simple et mode personnel de l’administratrice.
- Quatre rubriques : Accueil, Mes campagnes, Mes versements et Mon compte.
- Accueil avec total personnel de la campagne, QR accessible, règle du forfait ou montant libre, cadence configurée et nombre de versements. Aucune date d’échéance calculée arbitrairement : les tontines renvoient à l’administratrice pour confirmer la séance.
- Campagnes affichées en cartes, actives, terminées par date ou désactivées, avec sélection conservée lors du rafraîchissement. Le filtre porte explicitement sur la page courante ; toutes les pages restent accessibles.
- Versements personnels en cartes : montant, date, référence et annulation éventuelle. Pagination serveur conservée. Aucun téléchargement de reçu officiel ajouté.
- Masquage commun du total, du forfait et de tous les montants de l’historique dans l’espace personnel.
- Fiche personnelle avec nom, identifiant et groupement, QR et indication de contact pour récupération d’accès. Aucun formulaire de modification d’identité ajouté.
- À la bascule vers le mode personnel, les totaux de gestion sont effacés et les montants personnels restent en attente jusqu’à la réponse du serveur avec portée personnelle.

Aucun changement de contrat API, aucune migration et aucun déploiement distant. L’API locale reste celle déjà en service ; seules les interfaces Docker sont actualisées.

Validation du lot 3 : construction et typage des deux interfaces réussis ; 10 tests ciblés de fiabilité/version/PWA réussis ; 9 parcours existants réussis, puis le nouveau test de consultation d’une campagne désactivée et de masquage persistant réussi. Ce dernier utilise des réponses contrôlées et bloque le service worker pour garantir l’interception des données de test. Vérification visuelle effectuée avec le compte membre Awa sur sa campagne d’épargne.

[Capture de l’espace membre](15-lot3-espace-membre.jpg)

## Lot 4 — gestion et encaissement guidé, version 0.5.0

Branche `codex/pwa-encaissement-guide`, avec conservation des lots locaux précédents.

- Navigation mobile de l’administratrice : Accueil, Encaisser, Membres, Plus. Plus donne accès aux campagnes, archives et paramètres. Le mode personnel conserve sa navigation dédiée.
- Recherche serveur par nom ou téléphone sur les membres et les participantes. Résultats et total sont filtrés avant pagination ; le sélecteur d’encaissement dispose de sa propre recherche et de pages de 25 participantes.
- Recherche serveur des versements par nom/téléphone et date exacte, remplaçant le filtrage incomplet sur la seule page chargée. La portée personnelle et l’isolation par groupement restent appliquées par PostgreSQL.
- Encaissement en deux étapes : campagne, participante et montant réellement reçu ; puis récapitulatif membre/montant/date dans le contexte de la campagne. La confirmation déclenche l’unique requête d’enregistrement. Retour possible à la saisie sans perte du brouillon.
- Verrou synchrone des mutations côté interface et clé d’idempotence existante conservée lors d’un échec. Le serveur reste l’autorité contre les doublons. Une erreur n’efface pas la saisie et ne déclenche aucune annonce vocale de succès.
- Listes principales des membres, campagnes et versements présentées en cartes sur mobile, en conservant les actions existantes. Les tableaux spécialisés de séances et de rotations restent à adapter dans une passe complémentaire.
- Extension additive du contrat `/api/v1` avec `q` et `paidOn`, OpenAPI et client régénérés. Aucun changement de schéma de données et aucune migration.

Validation serveur : 17 tests réussis, dont un jeu éphémère de 205 membres et participations. Ce test vérifie une recherche au-delà de la première page, le total filtré, une page vide au-delà du résultat, la portée personnelle, le refus d’accès depuis un autre groupement, et les filtres nom/date des versements. Cela ne constitue pas un test de charge de 1 000 groupements.

Validation finale : les 12 scénarios navigateur ciblés passent, dont la confirmation d’un versement, le maintien de la saisie après refus serveur, la recherche et les filtres, ainsi que les parcours des deux profils à 360, 390 et 430 px. Le test d’enregistrement a été relancé après démarrage des conteneurs et correction de son sélecteur de date devenu ambigu. Les 10 tests ciblés de fiabilité, mise à jour PWA et versionnement passent également. Typage, constructions et cohérence de version validés.

L’API et les deux interfaces Docker locales sont saines en version 0.5.0. La base locale est conservée. Aucun déploiement distant effectué. Les essais sur téléphones réels restent à réaliser ; le prochain lot traite la robustesse des mises à jour et des interruptions réseau.

[Capture du récapitulatif avant confirmation](16-lot4-recapitulatif.jpg). La saisie de démonstration de 750 FCFA a été annulée après capture.

## Lot 5 — reprise réseau et mises à jour PWA, version 0.6.0

Branche `codex/pwa-reprise-reseau`, conservant les lots locaux précédents.

- L’enregistrement du service worker est réessayé au retour réseau, au retour dans l’application ou au contrôle périodique après un échec initial.
- La première installation n’est plus traitée comme une mise à jour en attente. Un test avec deux versions réelles de worker a révélé qu’elle pouvait sinon bloquer l’activation suivante ; ce défaut est corrigé.
- Les mises à jour attendent la fermeture des formulaires et la fin des mutations. Une activation dans un autre onglet ne recharge pas celui qui contient une saisie.
- Une session impossible à vérifier affiche une erreur de connexion et un bouton de reprise, au lieu de présenter immédiatement un écran de connexion. Le retour réseau déclenche aussi un nouvel essai.
- Les mutations sont bloquées hors connexion. Une réponse perdue conserve le récapitulatif et la clé d’idempotence ; l’utilisatrice doit confirmer à nouveau, sans envoi automatique au retour réseau.
- Une alerte de sortie native est demandée pendant les formulaires et mutations. Le navigateur peut ne pas l’afficher, notamment sur mobile : le brouillon reste uniquement en mémoire, sans garantie après fermeture, rechargement forcé ou arrêt du système. Aucune donnée financière ni file de versements n’est persistée dans le stockage du navigateur.

Les tests de cycle du service worker utilisent un serveur local éphémère et le coordinateur de mise à jour de production, avec des workers minimaux versionnés. Ils ne remplacent pas la recette du paquet Workbox sur une PWA installée sur téléphone réel.

Validation : 3 tests navigateur du cycle réel de mise à jour réussis ; 5 parcours applicatifs ciblés réussis, incluant réponse réseau perdue, retour hors ligne/en ligne sans envoi automatique, nouvelle tentative avec contenu et clé identiques, reprise de vérification de session et non-régression administratrice/membre. Les réponses de cotisation du scénario de coupure sont contrôlées : ce test ne crée pas de versement ; l’idempotence serveur est couverte par les tests API du lot précédent. Les 10 tests ciblés de fiabilité/version/mise à jour, le typage, le formatage et les constructions Docker passent. API, web et PWA locaux sains en 0.6.0. Aucun déploiement distant.

[Capture de la confirmation interrompue et du récapitulatif conservé](17-lot5-reprise-reseau.png).

Le lot 6 reste à réaliser : recette représentative, tests de charge et essais sur téléphones réels, notamment clavier virtuel, installation PWA, mise à jour du paquet Workbox et reprise après suspension du système.

## Lot 6 — première étape de qualification, version 0.6.1

Le 18 octobre 2026, branche `codex/pwa-recette-lot6` : correction de la CI préparatoire, configuration de tests mobiles Chromium/WebKit, remplacement des exemples k6 par un scénario local authentifié en lecture seule et profil Docker isolé avec image figée. La recette a révélé un défaut de retour du focus après ouverture tactile du QR sur WebKit ; il est corrigé.

28 tests fonctionnels ont passé avant la correction ciblée, puis 4 parcours mobiles ont passé sur les interfaces reconstruites en 0.6.1. L’essai k6 de 5 utilisatrices virtuelles sur 30 secondes a effectué 240 requêtes sans erreur HTTP. Ces contrôles ne qualifient pas les appareils réels ou les volumes cibles. API, web et PWA locaux sains en 0.6.1 ; aucun déploiement distant.

Le lot 6 reste ouvert pour les essais physiques, les volumes représentatifs, les écritures concurrentes et les tableaux spécialisés. Voir [la recette détaillée et la grille des appareils réels](../../recette/LOT6.md).

## Complément du lot 6 — séances et rotations, version 0.6.2

Branche `codex/pwa-seances-mobile`. Les tableaux spécialisés de séances, tours de tontine et participations sont maintenant adaptés à la PWA mobile : cartes avec libellés, détails dépliables accessibles et références longues sur une seule colonne. Les tableaux de bureau sont conservés.

Validation : 6 tests mobiles Chromium/WebKit réussis, dont les détails et états vides à 360 px ; 1 parcours bureau des campagnes/séances/archives réussi. Typage, formatage, cohérence de version et constructions Docker validés. Services locaux sains en 0.6.2 ; aucun déploiement distant.

Restent la qualification sur appareils réels, les volumes représentatifs et les encaissements concurrents en environnement isolé. Voir le [suivi du lot 6](../../recette/LOT6.md).

## Complément du lot 6 — qualification isolée, outillage 0.6.3

Branche `codex/qualification-volumes`. La qualification sur PostgreSQL réel couvre 1 001 groupements de 201 membres et 201 201 cotisations initiales, avec le rôle applicatif non privilégié. Recherche/pagination, portée membre, isolation RLS et rapprochement après confirmations concurrentes sont vérifiés. Les données sont synthétiques, hébergées sur un réseau et un stockage temporaires distincts de la base locale habituelle.

Le test utilise une image API construite explicitement désignée (0.6.2 pour l’essai local), puis écrit un rapport sans secrets. Il rejoint les vérifications CI conditionnant la livraison, avec artefact et nettoyage même en cas d’échec. Les essais physiques et la charge prolongée restent ouverts. Voir [la procédure de qualification](../../recette/QUALIFICATION-VOLUMES.md).

## Complément du lot 6 — historique étendu, outillage 0.6.4

Le 19 octobre 2026, branche `codex/qualification-historique` : qualification réussie sur l’image API 0.6.2 avec 1 001 groupements, 201 201 adhésions et 2 012 010 cotisations initiales. Recherche, isolation et confirmations concurrentes passent. L’essai mixte sur deux administratrices de deux groupements réalise 60 lectures et 60 versements en 65 secondes, sans erreur ; p95 de 184 ms en lecture et 10 ms en écriture. Les totaux API et SQL concordent pour chaque groupement.

Le stockage temporaire a été retiré après conservation du rapport. Ce résultat complète la qualification des volumes, sans clôturer l’endurance, la concurrence de nombreux comptes, les appareils physiques ou la CI distante. Voir [les mesures et limites](../../recette/QUALIFICATION-VOLUMES.md). Aucun déploiement distant.

### 21 octobre — 0.12.0 : tours et délais de grâce

Tour du jour/en cours prioritaire, trois tours passés et Voir plus par lots de trois ; raccourcis limités à deux lignes avec Plus et Historique conservé. Délai individuel depuis la liste du tour, prolongation auditée et affichage Absent après expiration uniquement sans versement valide. Contrôles serveur du responsable, de l’inscription, du tirage et des échéances. Livraison locale validée par 23 tests API et 20 tests mobiles Android/iPhone, plus contrôle visuel dans la PWA.

### 21 octobre — 0.13.0 : cartes compactes

Résumés de séance et de tour sur trois lignes ; campagnes de la PWA en cartes sur quatre lignes, détails et actions conservés. Bénéficiaire identifiée et exclue des délais de grâce côté interface et API. Validation : 23 tests API, 20 tests mobiles Android/iPhone, TypeScript et version cohérents, reconstruction Docker locale réussie et contrôle visuel des cartes.

### 21 octobre — 0.14.0 : campagnes et adhésions

Menu Campagnes sans panneaux secondaires, ajout direct sur chaque carte et identité du groupement sur deux lignes. Six raccourcis personnalisables, conservés par responsable/groupement ; autres campagnes dans Plus. Ajout par recherche des non-inscrits, montant commun de tontine et épargne libre/fixe au standard, avec contrôles API des inscriptions et encaissements. Migration 008 avec RLS. Validation locale : 26 tests API et 22 parcours mobiles au total (20 régressions, puis 2 nouveaux parcours corrigés et validés), TypeScript/version et reconstruction Docker réussis.

### 21 octobre — 0.15.0 : filtres et cartes Membres

Filtre des campagnes actives par type, sélectionnées par défaut et Voir plus pour les autres. Sélecteur de membre unique avec recherche des non-inscrits intégrée, navigation clavier et pagination serveur. Cartes Membres de trois lignes, détail des inscriptions et montants versés pour chaque épargne, hors annulations. Recherche sans accent et actions QR/PIN/blocage conservées. L’API enrichit la page de membres par une requête groupée, avec isolation des vues personnelles. Aucun déploiement distant pour ce lot ; contrôle réel des filtres, du sélecteur et des montants dans la PWA locale.

Validation finale : 27 tests API et 24 parcours mobiles Android/iPhone réussis après correction de la fermeture tactile du sélecteur ; TypeScript, version et reconstruction Docker validés.

### 21 octobre — 0.16.0 : accueil et versements membres

Bandeau commun au groupement, QR personnel, campagnes actives inscrites et total personnel. Versement personnel après ouverture de la séance du jour ou tirage du tour courant, un enregistrement valide par période et par membre, avec idempotence, règles de montant et audit. Cinq versements/tours, Voir plus, filtres, badges des séances ouvertes non versées, bénéficiaires et durée restante de tontine. Migration 009 : insertion de sa propre participation et accès borné au calendrier des bénéficiaires, sans élargir les droits de modification de campagne ou de lecture des autres cotisations. Validation locale : 30 tests API, 28 parcours mobiles et six tests de fiabilité/mise à jour réussis ; TypeScript, version et reconstruction Docker validés, contrôle réel de l’épargne et de la tontine du compte Awa. Aucun déploiement distant.

### 21 octobre — 0.17.0 : historique global et choix d’accueil

Montant d’épargne personnel avant les versements, choix de six campagnes d’accueil par membre/groupement, autres campagnes dans Plus et préférences indépendantes du profil administrateur. Historique global incluant les archives, filtres multiples type/campagne/séance/tour avant pagination et retrait de Campagne suivie. Badges des séances ouvertes et tours tirés non cotisés, période du jour incluse. Migration 010 avec RLS, contrôles de portée et d’inscription. Validation : 32 tests API, 32 scénarios mobiles distincts validés après adaptation du geste de test de refus sur iPhone, TypeScript/version et construction Docker réussis. Contrôle réel de l’historique et des badges, sans modification des données du compte ; aucun déploiement distant.

### 21 octobre — 0.17.1 : bandeau personnel fixe

Coordonnées du groupement et QR de 180 px dans une grille de six rangées, sans montant ni nom de campagne. Bandeau invariant lors du choix de campagne ; montants et confidentialité conservés dans le détail. Validation ciblée : 12 parcours mobiles Android/iPhone réussis, mesure des six rangées/QR et contrôle de stabilité du contenu, de la couleur et de la hauteur. TypeScript, version, reconstruction Docker et contrôle visuel local validés.

### 22 octobre — 0.17.2 : listes personnelles ciblées

Mes campagnes limitée aux choix d’accueil, configuration dans une fenêtre dédiée accessible également depuis Plus. Mes versements limitée aux cinq derniers enregistrements ; Voir plus charge les cinq suivants, filtres et total global conservés. Validation : 12 tests mobiles Android/iPhone simulés réussis, TypeScript, version et construction Docker validés. Contrôle réel des listes du compte Awa et de la pagination de cinq à dix, sans modification des données ni déploiement distant.

### 22 octobre — 0.18.0 : identité et navigation commune

Nom et identifiant du membre en gras dans le bandeau fixe à six rangées ; QR personnel conservé, bouton de barre supérieure supprimé en mode personnel. Ajout d’une campagne aux raccourcis depuis Plus pour les deux profils. Icônes, cartes de choix et commandes d’affichage partagées pour harmoniser les écrans proposant la même action. Validation : 20 scénarios mobiles distincts réussis après adaptation d’un geste de test de décochage sur une carte immédiatement retirée ; TypeScript, formatage, contrats, version et reconstruction Docker validés. Contrôle visuel réel de l’identité et de Plus sans modification des données ni déploiement distant.
