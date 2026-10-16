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
