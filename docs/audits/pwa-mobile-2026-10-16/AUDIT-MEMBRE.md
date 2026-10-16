# Audit du profil membre — PWA AvecLesFemmes

16 octobre 2026 · Recette 0.2.0 · Complément à l’audit administratrice.

## Périmètre réel

Connexion avec le compte de démonstration **Awa Fall, membre simple**, après déconnexion de l’administratrice. Cet audit complète et remplace la limite précédente qui portait uniquement sur le mode personnel de l’administratrice.

Parcours inspectés : connexion par identifiant, accueil, Cotiser, Campagnes, Ma participation, Sessions, Membres/Mon adhésion, QR personnel, masquage du solde, Tontines sans campagne correspondante et scanner. Dimensions 390 × 844, 360 × 800 et 430 × 932 pixels CSS. Aucun enregistrement financier, changement de profil ou envoi de SMS effectué. Les interactions de connexion et navigation sont les seules modifications de session.

Limites : un groupement, une campagne active, aucun versement dans la recette, deux membres. Pas de campagne clôturée ni de tontine à échéance dans les données inspectées. Pas de test physique de caméra, de clavier mobile ou de lecteur d’écran. Les limites sur les campagnes clôturées et la pagination proviennent du code, pas d’une simulation de données absentes. La confidentialité constatée à l’écran ne constitue pas un audit complet des autorisations API.

## Diagnostic membre

L’interface respecte visiblement la différence de droits : Awa n’a pas accès aux boutons d’encaissement, d’ajout de membre ou de création de campagne. Mais elle conserve le vocabulaire et la structure d’une interface de gestion. Le membre doit surtout comprendre **ce qu’il a versé, pour quelle campagne, ce qui est prévu ensuite et comment présenter son identité à l’administratrice**.

L’accueil actuel est dominé par le contexte du groupement puis une grille de huit actions dont plusieurs sont redondantes ou sans résultat utile. Le montant principal est nommé « disponible », alors que la donnée est un total de cotisations de la campagne sélectionnée : ce libellé suggère une possibilité de retrait qui n’est pas démontrée.

## Résultats observés par parcours

| Parcours                  | Résultat constaté                                                             | Appréciation                                                                     |
| ------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Connexion par identifiant | Connexion réussie avec le compte membre de recette                            | Fonctionnelle ; le choix entre trois modes augmente la charge initiale           |
| Accueil                   | Total personnel, campagne et versements affichés ; pas de commande de gestion | Bon périmètre visuel, mauvaise hiérarchie des informations                       |
| Cotiser                   | Ouvre Campagnes, sans paiement ni formulaire d’enregistrement                 | Libellé trompeur par rapport à l’action                                          |
| Campagnes                 | Tableau de campagne puis participation d’Awa seulement                        | Données personnelles utiles, présentation administrative trop dense              |
| Sessions                  | Cahier des séances avec titres collectifs et état vide                        | Périmètre personnel/collectif insuffisamment explicite                           |
| Membres                   | Affiche uniquement « Mon adhésion » et la fiche Awa                           | Confidentialité préservée dans cet écran ; menu à renommer                       |
| Mon Code QR               | Ouvre la carte nominative avec QR et téléchargement                           | Action utile et accessible dans l’en-tête ; texte technique inutile sous le code |
| Masquer le solde          | Masque le montant principal ; « Mon montant versé » reste visible plus bas    | Confidentialité partielle, portée du bouton ambiguë                              |
| Tontines                  | Pas de tableau cible, pas de message ni de destination dédiée                 | Impasse de navigation sur ce jeu de données                                      |
| Scanner                   | Ouvre un viseur sans caméra, avec bouton de simulation                        | Fonction non aboutie présentée comme disponible                                  |

## Mesures et constats priorisés

Priorités : P0 = confiance et exactitude ; P1 = compréhension ou tâche courante bloquée ; P2 = confort et cohérence.

| ID  | Priorité | Constat                                                                                                                                                                                                 | Évolution recommandée                                                                                                                                                                   |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | P1       | À 390 px, page d’accueil d’environ 2 568 px. Commande de masquage vers y=790, scanner vers y=1 058, Cotiser vers y=1 150 et raccourci Mon QR vers y=1 255. Le QR reste aussi accessible dans l’en-tête. | Conserver le QR rapide en haut ; placer montant contextualisé, prochaine échéance et derniers versements dès le premier écran.                                                          |
| M02 | P1       | Recherche, sélection native et fiche du groupement consomment une grande partie de l’écran malgré un seul groupement.                                                                                   | Afficher un seul nom compact et un lien vers la fiche ; changement de groupement seulement si nécessaire.                                                                               |
| M03 | P0       | « Solde d’épargne disponible » correspond au total versé dans la campagne courante.                                                                                                                     | Renommer « Mes versements dans … » ; n’afficher un disponible que si son calcul et son usage sont définis.                                                                              |
| M04 | P1       | Cotiser, Paiements et Forfaits conduisent au même écran Campagnes.                                                                                                                                      | Séparer les intentions réelles ; proposer « Mes campagnes », « Mes versements » et « Présenter mon QR ». Aucun paiement autonome à promettre sans fonctionnalité correspondante.        |
| M05 | P1       | Le menu Membres mène à une seule fiche personnelle.                                                                                                                                                     | Remplacer par « Mon compte » ou « Mon adhésion », en carte lisible sans pagination artificielle pour une fiche unique.                                                                  |
| M06 | P1       | Dans la même campagne, Awa voit « 1 membre » et l’administratrice « 2 membres ». Les titres restent collectifs alors que les droits filtrent les résultats.                                             | Libellés propres au périmètre : « Ma participation », « Mes versements ». Ne pas élargir les droits pour corriger un libellé.                                                           |
| M07 | P1       | « Ma participation : 1 » est un nombre technique ; les séances utilisent « Montant récupéré », « Nbre Membre ayant de cotisation ».                                                                     | État compréhensible : « Inscrite », « Montant libre » ou « 2 000 FCFA chaque mardi » ; « Date », « Mon versement », « Statut ».                                                         |
| M08 | P1       | L’accueil donne une fréquence mais pas une prochaine date clairement mise en avant.                                                                                                                     | Ajouter la prochaine échéance calculée, et préciser « montant libre » lorsque aucun forfait n’est défini. Ne pas inventer un reste à payer.                                             |
| M09 | P1       | Les pastilles AVEC/Ramadan/Tabaski/Solidarité changent leur sélection sans participer au filtrage dans le code.                                                                                         | Filtrer réellement sur le périmètre autorisé ou retirer ces contrôles. Avec zéro versement, l’effet métier ne peut pas être vérifié visuellement.                                       |
| M10 | P1       | Le tri « Par membre » apparaît dans Mes versements alors que le profil n’en consulte qu’un seul.                                                                                                        | Retirer ce tri du membre simple ; garder date, campagne et statut selon les données réelles.                                                                                            |
| M11 | P1       | Tontines ne produit aucun résultat lorsqu’il n’existe pas de tableau correspondant.                                                                                                                     | Page dédiée ou état « Aucune tontine en cours » ; expliquer comment une participation est ouverte.                                                                                      |
| M12 | P0       | Scanner simulé ; message de succès possible sans identification réelle.                                                                                                                                 | Le membre présente son QR ; réserver le scan à un parcours réel justifié, notamment côté administratrice.                                                                               |
| M13 | P1       | Le montant reste visible dans les cartes après masquage du montant principal.                                                                                                                           | Un mode confidentialité global de l’espace personnel, avec préférence conservée.                                                                                                        |
| M14 | P1       | Archives absent du menu membre ; liste des campagnes filtrée sur les actives dans le code.                                                                                                              | Garantir un accès personnel aux campagnes terminées et aux preuves de versement. À qualifier avec une campagne clôturée avant de conclure sur tous les accès possibles.                 |
| M15 | P2       | Carte QR affiche un identifiant technique `ALF:MEMBER:…` long ; aucune explication de sa portée.                                                                                                        | Nom, groupement, code lisible de secours ; « Présentez ce QR à la responsable ». Un QR d’identification ne doit pas servir d’autorisation de paiement.                                  |
| M16 | P2       | PIN proposé par défaut, mais identifiants de recette communiqués en mode mot de passe ; carte démo avec préremplissage local de secours ; aucun chemin de récupération clairement visible.              | Une méthode principale conforme aux accès réels, « Code oublié ? Contacter ma responsable », démonstration explicitement conditionnée. Ne pas réinitialiser les accès pendant un audit. |

## Lecture de l’expérience

### Comprendre avant d’agir

Un montant élevé et une grille pastel peuvent évoquer un portefeuille mobile avec retrait ou transfert. AvecLesFemmes suit ici une épargne enregistrée par une responsable. Il faut expliquer cette différence par les mots et les actions : « Montant versé », « Prochaine cotisation », « Présenter ma carte », « Voir mes versements ».

### Apporter une preuve

Après un versement, une membre doit pouvoir retrouver date, montant, campagne et statut, et signaler un problème. Une notification éphémère ne suffit pas. Le présent audit n’a pas inspecté de reçu rempli, faute de cotisation en recette ; ce parcours doit être testé avec des données fictives dédiées, incluant un versement annulé.

### Éviter les impasses

Une action visible doit conduire à une information utile même sans données. « Aucune tontine », « Aucune échéance définie » et « Vous n’avez pas encore de versement » nécessitent des explications différentes. Le retour à l’accueil doit être stable et compatible avec le bouton retour du téléphone.

## Interface membre cible proposée

Navigation : **Accueil · Mes campagnes · Mes versements · Mon compte**.

Premier écran : identité discrète et groupement ; campagne sélectionnée clairement nommée ; total versé ; prochaine échéance et règle de montant ; bouton « Présenter mon QR » ; derniers versements. Les détails du groupement sont accessibles dans une fiche secondaire.

Mes campagnes : cartes actives et terminées, chacune avec mon statut, ma règle de cotisation et mon cumul. Mes versements : liste chronologique, filtres réels, détail et état d’annulation. Mon compte : adhésion, aide d’accès, confidentialité, langue si retenue et déconnexion.

La place d’une notification d’échéance et d’un reçu partageable doit être décidée après clarification métier ; ce sont des propositions, pas des fonctionnalités actuellement garanties.

## Critères de validation

1. La membre identifie en moins de dix secondes la campagne et la nature du montant affiché — objectif à tester, pas résultat déjà atteint.
2. Le QR personnel s’ouvre en une action depuis l’accueil et affiche le bon nom/groupement.
3. Aucun bouton visible ne promet une opération impossible ; chaque état vide est explicite.
4. Les filtres et totaux restent corrects avec plusieurs campagnes et plus de 25 versements.
5. Le masquage cache tous les montants personnels de l’écran concerné.
6. Une campagne terminée et son historique personnel restent accessibles selon les droits métier.
7. Aucune identité ou cotisation d’une autre membre n’apparaît dans le parcours personnel ; validation API séparée nécessaire.
8. Les parcours sont utilisables à 360 px, avec clavier, zoom et lecteur d’écran sur appareils réels.

## Preuves

- [Connexion membre](08-connexion-membre.jpg)
- [Accueil Awa, membre simple](09-membre-accueil-390.jpg)
- [Destination Cotiser : Campagnes](10-membre-cotiser-campagnes.jpg)
- [Membres : fiche personnelle uniquement](11-membre-ma-fiche.jpg)
- [QR personnel](12-membre-qr.jpg)

Les constats de code communs sont documentés dans [l’audit initial](ANALYSE-UI-UX.md). Les priorités communes et les arbitrages des deux profils sont rassemblés dans [l’analyse globale](ANALYSE-GLOBALE-DEUX-PROFILS.md).
