# Audit UI/UX mobile — AvecLesFemmes PWA

Date : 16 octobre 2026. Tâche 1 : analyse de l’existant, sans modification fonctionnelle.

> Complément : une vraie session membre simple a ensuite été auditée. Voir [Audit membre](AUDIT-MEMBRE.md) et [Analyse globale des deux profils](ANALYSE-GLOBALE-DEUX-PROFILS.md). Les limites ci-dessous décrivent le périmètre de cette première inspection.

## 1. Diagnostic

La PWA possède une identité visuelle cohérente et plusieurs composants adaptés au tactile, mais son organisation reste celle d’un tableau de bord web empilé sur un téléphone. La refonte inspirée de Wave est placée sous l’ancienne structure de navigation : elle embellit certaines sections sans simplifier le parcours global.

**La priorité est de rendre les informations fiables et les actions compréhensibles, puis de raccourcir les parcours.** Une refonte seulement graphique laisserait subsister des problèmes qui affectent directement la confiance : graphiques fictifs, scanner simulé, solde mal nommé, et possibilité d’annonce vocale positive après un échec d’enregistrement.

Aucune note globale artificielle n’est attribuée : il manque des observations utilisateurs, des tests sur appareils physiques et des mesures de performance pour établir un score représentatif.

## 2. Périmètre et méthode

- Inspection de la recette Render en version 0.2.0, session administratrice de démonstration.
- Parcours observés : accueil gestionnaire, mode épargne personnelle, campagnes, membres, formulaires de cotisation et d’ajout de membre, chiffres hebdomadaires, scanner.
- Dimensions de fenêtre : 390 × 844, 360 × 800 et 430 × 932 pixels CSS. Il s’agit d’une simulation de dimensions, pas d’un test sur iPhone ou Android physique.
- Lecture du code partagé `packages/ui/src/App.tsx`, des styles, des API de dashboard/caisse et de la configuration PWA. La branche locale comporte déjà le mécanisme de mise à jour 0.2.1 ; son statut est distingué de la recette 0.2.0.
- Mesures DOM : position des actions, taille des boutons, profondeur des pages, largeur des tableaux et gestion du focus.
- Aucun versement, changement de rôle, blocage de membre ou autre modification métier n’a été soumis.

Limites : le parcours personnel observé est celui d’une administratrice passant en mode personnel, pas une session indépendante de membre simple. Le jeu de recette ne contient que deux participantes et aucun versement. Les problèmes de volumétrie sont établis par le code ou proposés comme tests à réaliser. L’authentification est analysée dans le code ; le clavier virtuel, le lecteur d’écran, la caméra réelle, les contrastes complets et la performance sur réseau lent ne sont pas validés dans cet audit.

## 3. Ce qui mérite d’être conservé

- Palette verte, typographie et composants visuellement cohérents ; montants et unités FCFA visibles.
- Action d’encaissement contrastée et haute de 55 px : bonne cible tactile une fois atteinte.
- Distinction gestion du groupement / épargne personnelle pertinente pour les administratrices qui cotisent aussi.
- Montant libre ou forfaitaire, date du versement, retour d’enregistrement et contrôle d’idempotence déjà présents.
- QR généré en SVG, masquage du montant principal, libellés sur la majorité des icônes importantes.
- Focus clavier visible dans les styles, formulaires HTML avec contraintes, états d’enregistrement et indication hors connexion.
- Pas de débordement horizontal de la page entière sur les dimensions inspectées. Certains composants défilent horizontalement à l’intérieur, ce qui reste un problème d’usage distinct.

## 4. Constats prioritaires

P0 : fiabilité ou confiance à corriger avant une utilisation terrain. P1 : obstacle majeur à une tâche mobile courante. P2 : amélioration de confort et de cohérence. Ces niveaux expriment la priorité produit, pas une classification de vulnérabilité.

| ID  | Priorité | Constat et preuve                                                                                                                                                                       | Impact                                                                                                                            | Recommandation                                                                                                                                             |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | P0       | `WaveChiffresView` contient dates et montants fixes : 11 500, 12 500, 500, 24 077, etc. L’écran Semaine affiche des barres positives alors que le résumé est à zéro.                    | Les utilisatrices peuvent prendre des valeurs fictives pour leur comptabilité.                                                    | Retirer les valeurs fictives ; agréger les versements réels par période. Si indisponible, afficher un état explicite sans graphique chiffré.               |
| F02 | P0       | Le titre « SOLDE CAISSE » utilise `dashboard.total`, somme des cotisations non annulées d’une campagne. Le calcul net après cagnottes existe séparément dans l’API caisse.              | Confusion entre encaissements, argent disponible et ensemble du groupement.                                                       | Afficher la caisse nette et son périmètre ; séparer « Total versé » et « Disponible ». Même clarification pour « Solde d’épargne disponible » du membre.   |
| F03 | P0       | `CameraScannerOverlay` ne capture aucune vidéo et propose « Simuler lecture instantanée du QR Code ». La lampe ne change qu’un état visuel ; la valeur scannée est ignorée au retour.   | Un succès annoncé ne prouve ni une lecture ni l’identification de la bonne personne.                                              | Masquer la simulation hors démonstration. Réaliser la lecture, valider le QR, identifier la membre et confirmer sa campagne avant saisie.                  |
| F04 | P0       | `action()` intercepte les erreurs sans retourner un résultat d’échec. Après `await action(...)`, la cotisation déclenche néanmoins la synthèse vocale « reçue ».                        | Une cotisation refusée peut être annoncée comme encaissée. Constat de flux dans le code, sans déclencher de paiement en recette.  | Annoncer le succès uniquement après confirmation serveur ; distinguer refus et statut incertain, avec vérification par idempotence.                        |
| F05 | P1       | À 390 × 844, le bouton d’encaissement commence à y ≈ 1 003 px ; l’accueil mesure environ 3 080 px.                                                                                      | L’action principale est absente du premier écran ; chaque séance commence par du défilement.                                      | En-tête compact, campagne active, caisse et action principale immédiatement accessibles. Déplacer les détails du groupement dans une fiche.                |
| F06 | P1       | Recherche de groupement + sélection native + carte détaillée répètent le même contexte, même avec un seul groupement.                                                                   | Encombrement et hésitation sur le contrôle à utiliser.                                                                            | Une seule sélection compacte ; sans sélecteur quand un seul groupement est accessible.                                                                     |
| F07 | P1       | Tableau membres : 653 px dans une zone de 286 px à 360 px. Tableau campagnes : 930 px dans 356 px à 430 px.                                                                             | Nom et actions sont séparés par un déplacement horizontal ; erreurs possibles sur la ligne visée.                                 | Listes de cartes sur mobile, fiche de détail et actions secondaires dans un menu. Conserver les tableaux sur grand écran.                                  |
| F08 | P1       | « Cotiser », « Paiements » et « Forfaits » ouvrent tous Campagnes. « Calebasse » et « Historique » visent le même ancrage. « Tontines » ne fait rien si la cible n’existe pas.          | Les promesses des boutons ne correspondent pas aux résultats.                                                                     | Une destination précise par action ; supprimer les doublons. Pour un membre, parler de suivi ou de présentation du QR si aucun paiement autonome n’existe. |
| F09 | P1       | `historyFilter` change la pastille active, mais n’est pas utilisé pour filtrer les contributions.                                                                                       | Fausse impression de filtrage, particulièrement dangereuse pour le suivi d’épargne.                                               | Brancher le filtre sur une requête réelle ou supprimer les catégories tant qu’elles ne sont pas fonctionnelles.                                            |
| F10 | P1       | Filtres membre/séance appliqués au tableau `contributions` déjà paginé à 25 éléments ; sélection d’encaissement alimentée par une page de 100 participations.                           | À plus de 200 membres, certaines participantes et anciennes cotisations peuvent être introuvables depuis ces contrôles.           | Recherche et filtres côté serveur, pagination cohérente, sélection de membre avec recherche sur tout le groupement.                                        |
| F11 | P1       | Le formulaire de cotisation présélectionne la première participante. Passer d’un forfait à une membre libre ne remet pas le montant à zéro dans le `onChange`.                          | Risque d’encaissement pour la mauvaise personne ou avec un montant hérité.                                                        | Sélection explicite ou QR validé ; réinitialisation contrôlée du montant ; récapitulatif nom/campagne/montant avant confirmation.                          |
| F12 | P1       | La modale de cotisation mesure ≈ 760 px pour ≈ 954 px de contenu ; la validation est sous le pavé. Le champ montant reste un input numérique classique.                                 | Défilement interne ; risque d’empilement clavier système + pavé personnalisé sur téléphone, à vérifier sur appareil.              | Écran de saisie mobile dédié, bouton de validation fixe avec zone sûre, un seul mode de clavier clairement choisi.                                         |
| F13 | P1       | Après ouverture de la modale, le focus reste sur le bouton d’encaissement derrière elle. `Dialog` ne gère ni entrée de focus, ni boucle de tabulation, ni retour explicite.             | Navigation clavier/lecteur d’écran incohérente ; contenu arrière encore atteignable.                                              | Dialog accessible avec focus initial, arrière-plan inerte, boucle Tab et restitution au déclencheur.                                                       |
| F14 | P1       | Erreurs et succès passent par `notice`, affiché dans un toast avec icône de validation. La modale peut rester au-dessus du message.                                                     | Un refus peut ressembler à un succès et être difficile à voir.                                                                    | États distincts succès/erreur ; erreur persistante dans le formulaire, associée au champ si possible.                                                      |
| F15 | P2       | Navigation haute défilante, plusieurs niveaux de contexte, raccourcis plus bas et sous-vues gérées par état React sans routes métier.                                                   | Retrouver une fonction et revenir au bon écran demande de la mémoire. Le bouton retour système n’a pas de parcours métier défini. | Navigation mobile persistante, 4 destinations maximum, routes et historique explicites.                                                                    |
| F16 | P2       | Plusieurs boutons sont sous 44 px : navigation 39 px, déconnexion 31 × 31, modes 33 px, tris 28 px, icônes 18–20 px.                                                                    | Usage au pouce plus difficile, surtout en séance.                                                                                 | Cible produit de 44–48 px, espacement suffisant et texte lisible ; vérifier séparément la conformité WCAG.                                                 |
| F17 | P2       | Préférence vocale activée par défaut, stockée dans l’état React ; le masquage ne couvre que le montant principal, d’autres montants restent visibles.                                   | Confidentialité inattendue ; réglages perdus au rechargement.                                                                     | Annonce vocale choisie explicitement et persistée ; masquer tous les montants sensibles dans le périmètre annoncé.                                         |
| F18 | P2       | Connexion proposant PIN, identifiant et code téléphone ; carte de démonstration affichée sans garde UI, avec valeur locale de secours alors que l’API peut désactiver la démonstration. | Trop de choix, préremplissage potentiellement faux en recette, confusion entre test et accès normal.                              | Méthode principale claire, aide de récupération, alternatives secondaires, carte démo conditionnée à un indicateur serveur explicite.                      |

## 5. Lecture des parcours

### Administratrice : encaisser pendant une séance

Aujourd’hui : ouvrir l’accueil → traverser les informations répétées → atteindre Encaisser → retrouver la participante dans une liste → saisir le montant/date → défiler dans la modale → enregistrer → interpréter le message.

Le parcours cumule trois risques : une action principale tardive, un contexte campagne loin du montant principal, et une participante présélectionnée. Un joli pavé numérique ne compense pas ces risques.

Cible proposée : accueil de séance → choisir/rechercher/scanner la membre → nom et campagne visibles → montant → bouton « Confirmer 2 000 FCFA pour … » → reçu et « Membre suivante ». Une confirmation explicite peut être portée par le bouton et un récapitulatif sur le même écran ; éviter d’ajouter systématiquement plusieurs dialogues.

### Membre : comprendre son épargne

L’information essentielle devrait répondre à « combien ai-je versé, à quelle campagne, quand et quelle est ma prochaine échéance ? ». La page actuelle met en concurrence le QR, huit raccourcis et plusieurs répétitions du total. Elle évoque le paiement autonome alors que les raccourcis conduisent à la consultation.

Cible proposée : montant versé avec nom de campagne et date de mise à jour, prochaine échéance, « Présenter mon QR », puis derniers versements. Remplacer les fonctions absentes par un état compréhensible, pas un bouton sans effet.

### Campagnes et membres

La densité des tableaux convient davantage à l’administration sur ordinateur. Le mobile devrait afficher d’abord l’identité, l’état et l’action courante. Les actions sensibles (bloquer, désactiver, réinitialiser un PIN) doivent être séparées des actions fréquentes et nommer précisément leur cible.

Pour 200 membres, la recherche est une fonction centrale : nom, téléphone et identifiant lisible ; pagination ou chargement progressif côté serveur. Un résultat vide doit indiquer le filtre actif et permettre de le retirer.

### Chiffres et confiance

Une période sélectionnée doit modifier réellement la requête, le total, le nombre de versements et les dates. Le graphique doit rester cohérent avec les données affichées. « 0 FCFA », « aucune donnée » et « chargement impossible » sont trois états différents. Il faut également nommer le périmètre : campagne ou groupement, montants collectés ou caisse nette.

## 6. Accessibilité et contraintes mobiles

Objectifs proposés : texte courant d’au moins 16 px, actions principales de 48 px, contrôles secondaires de 44 px, contraste vérifié et contenu utilisable à 200 % de zoom. Ces dimensions sont des choix ergonomiques du produit, pas toutes des exigences WCAG AA.

Le minimum WCAG 2.2 AA pour les cibles est 24 × 24 px, avec exceptions notamment d’espacement. Les mesures sous 44 px ne prouvent donc pas à elles seules une non-conformité. Les contrôles de 18–20 px exigent un examen de leur zone et de leur espacement. [Référence W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Les fenêtres modales doivent déplacer et contenir le focus puis le restituer à leur fermeture. [Patron de dialogue WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

À vérifier sur appareils : clavier iOS/Android, zoom des champs, geste retour, zones sûres et encoche, mode paysage, annonce des erreurs avec VoiceOver/TalkBack, contraste au soleil. Les styles inspectés n’intègrent pas de traitement explicite `safe-area-inset` ni `prefers-reduced-motion`. Ne pas déduire d’une simulation de viewport que ces comportements sont validés.

Les langues et l’aide vocale doivent être décidées avec les utilisatrices : français simple d’abord, possibilité d’accompagnement en wolof si le terrain le confirme. L’analphabétisme et les habitudes numériques ne doivent pas être supposés identiques pour toutes les membres.

## 7. PWA, réseau et performance

La recette 0.2.0 attend encore une mise à jour manuelle ; le problème de cache a été constaté précédemment dans cet onglet. Le mécanisme automatique 0.2.1 est développé sur la branche dédiée, pas encore livré. Prévoir une installation initiale manuelle puis tester les versions successives, plusieurs onglets et une cotisation en cours.

Les données API utilisent `NetworkOnly`. L’application ne doit pas laisser entendre qu’une cotisation est enregistrée hors connexion. Afficher clairement : « Connexion nécessaire », « Enregistrement en cours », « Enregistré » et « Résultat à vérifier » lorsque la réponse est perdue. L’idempotence existante constitue une base utile pour reprendre une opération sans doublon.

Le service gratuit peut se réveiller lentement. Le ressenti doit être traité par un écran explicite et une reprise contrôlée ; cet audit ne mesure pas le temps de réveil ni les Core Web Vitals. La taille non compressée du bundle PWA inspecté est d’environ 386 Ko, le CSS d’environ 55 Ko : ce sont des tailles de fichiers, pas des mesures de vitesse sur téléphone. L’impact du chargement, du rendu SVG et des grands tableaux doit être profilé sur un Android modeste et réseau dégradé.

## 8. Architecture d’information proposée

**Membre :** Accueil · Mes campagnes · Mes versements · Mon compte. QR comme action visible depuis l’accueil, sans multiplier les entrées. La fiche de campagne regroupe forfait, échéances et historique correspondant.

**Administratrice :** Accueil · Encaisser · Membres · Plus. « Plus » regroupe campagnes, chiffres, archives et paramètres. Le contexte courant affiche clairement le groupement et la campagne ; le changement d’espace personnel reste accessible dans le compte ou un sélecteur compact explicite.

Une barre basse est une hypothèse de conception à prototyper, pas une correction automatique : valider l’accès au pouce, le clavier ouvert, l’absence d’occultation de contenu et les libellés avec les utilisatrices.

## 9. Plan de refonte proposé

| Lot | Objectif                   | Contenu                                                                                          | Condition de validation                                                                                             |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| A   | Fiabilité avant esthétique | F01–F04, F09, F14 ; périmètre des montants et filtres réels                                      | Aucun chiffre fictif, aucune annonce positive après refus, chaque filtre modifie les bons résultats                 |
| B   | Accueil mobile             | F05–F08, F15 ; en-tête compact, navigation et actions par rôle                                   | Solde contextualisé et action principale visibles sans défilement à 360 × 800                                       |
| C   | Encaissement terrain       | F10–F13 ; recherche globale, sélection explicite, montant et confirmation, modales accessibles   | Trouver n’importe quelle membre parmi 250 ; nom/campagne/montant visibles avant validation ; pas de perte de saisie |
| D   | Consultation et autonomie  | Cartes campagnes/membres, échéances, vrais graphiques, états vides, confidentialité et connexion | Compréhension du total et du statut sans assistance ; contraste, zoom et lecteurs d’écran contrôlés                 |
| E   | Robustesse PWA             | Qualification 0.2.1, réseau lent, interruption, plusieurs onglets, appareils physiques           | Mise à jour sans perte de saisie ; reprise sans doublon ; aucun succès non confirmé                                 |

Ne pas mélanger tous les lots dans une refonte unique : conserver les règles métier et livrer des incréments testables. Les points P0 méritent une correction ciblée avant les changements de navigation.

## 10. Protocole de validation utilisateur

Panel proposé : 5 à 8 participantes, incluant membres et administratrices, avec niveaux d’aisance numérique variés. Ce panel est une proposition, pas une étude déjà menée.

Scénarios : consulter son dernier versement ; présenter son QR ; retrouver une membre parmi 250 ; encaisser un montant libre puis un forfait ; corriger une sélection ; comprendre un refus réseau ; consulter une autre campagne ; revenir de l’écran Chiffres ; recevoir une mise à jour pendant une saisie.

Mesurer : réussite sans aide, temps par tâche, nombre de retours arrière, erreurs de membre/campagne/montant, compréhension du statut final et confiance déclarée. Cibles provisoires à ajuster après une mesure de référence : 90 % de réussite sans aide pour les tâches courantes ; aucun versement attribué à la mauvaise personne ; encaissement courant en moins de 30 secondes après authentification ; aucune perte de formulaire lors d’une mise à jour.

Tests techniques : 360/390/430 px, texte à 200 %, iOS Safari/PWA et Android Chrome/PWA ; 250 membres et plus de 25 cotisations réparties sur plusieurs pages ; forfait vers montant libre ; réponse serveur refusée ou perdue ; double appui ; caisse après reversement ; dates réelles et changement de période ; clavier et lecteur d’écran.

## 11. Preuves et repères

Captures de recette, données fictives :

- [Accueil administratrice 390 px](01-admin-390.jpg)
- [Formulaire de cotisation 390 px](02-cotisation-390.jpg)
- [Chiffres : semaine](03-chiffres-semaine.jpg)
- [Mode épargne personnelle 390 px](04-personnel-390.jpg)
- [Scanner simulé](05-scanner-simulation.jpg)
- [Membres 360 px](06-membres-360.jpg)
- [Campagnes 430 px](07-campagnes-430.jpg)

Repères du code inspecté (les lignes peuvent évoluer) :

- `packages/ui/src/App.tsx` : `Dialog` vers 156 ; `CameraScannerOverlay` vers 350 ; `WaveChiffresView` vers 410 ; `Login` vers 747 ; `filteredContributions` vers 1533 ; chargement paginé vers 1754 ; `action` vers 1917 ; annonce vocale vers 2121 ; raccourcis membre vers 2800 ; « SOLDE CAISSE » vers 2933 ; cotisation vers 5940.
- `packages/ui/src/styles.css` : adaptation mobile vers 1072 ; composants Wave vers 3100–4030.
- `apps/api/src/campaigns/campaigns.module.ts` : `dashboard` vers 263 ; `cashboxState` vers 551.
- `apps/membres-pwa/vite.config.ts` et `src/pwa-update.ts` : distinguer la configuration livrée 0.2.0 et le travail 0.2.1 local.

Le document « Refonte Wave UI/UX » présente certaines fonctions comme achevées. Cet audit constate que les captures et les tests de parcours ne suffisent pas à garantir la lecture réelle d’un QR, l’exactitude des chiffres ou l’efficacité sur téléphone. Ces fonctionnalités doivent être qualifiées séparément.
