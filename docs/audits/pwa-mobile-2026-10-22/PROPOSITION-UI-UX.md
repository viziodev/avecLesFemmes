# Proposition d’amélioration des interfaces et de l’expérience PWA

**AvecLesFemmes · 22 octobre 2026 · Proposition à partir de l’audit de la version 0.18.0**

## Direction retenue

**Choix utilisateur du 22 octobre 2026 : retenir la deuxième proposition, « Action du jour ».** L’accueil devient plus compact et centré sur la campagne sélectionnée, la séance ou le tour du jour et l’action disponible. Le grand QR reste accessible en une action depuis Ma carte. Les couleurs et la navigation basse sont conservées.

L’audit précédent recensait surtout les défauts. Ce document répond à la question produit : **quelle interface aiderait mieux une membre à suivre ses versements et une responsable à tenir sa séance ?** La direction retenue est intégrée aux interfaces PWA en version **0.20.0** : accueils des deux profils, QR à la demande, bloc Action du jour, cartes et parcours de versement. Les essais d’usage et sur téléphones physiques restent à organiser. Voir le [compte rendu d’intégration](INTEGRATION-ACTION-DU-JOUR.md).

## Lecture UX de l’existant

| Question d’usage                            | Ce qui gêne aujourd’hui                                                  | Expérience recherchée                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Où suis-je et quelle campagne est choisie ? | Titres génériques, contexte répété et noms parfois tronqués              | Une campagne nommée clairement, son type et sa période à côté des chiffres concernés |
| Que puis-je faire aujourd’hui ?             | L’action arrive bas dans l’accueil et dépend d’informations dispersées   | Une action principale accompagnée de la séance ou du tour et de son état             |
| Qu’ai-je réellement versé ?                 | Plusieurs listes, compteurs et formulations                              | Un total personnel contextualisé et cinq dernières preuves de versement              |
| Qui n’a pas encore cotisé ?                 | La responsable doit ouvrir les détails puis filtrer                      | Un résumé de séance et un accès direct à la liste des non-cotisantes                 |
| Comment changer mes raccourcis ?            | Consultation d’une campagne et choix d’accueil peuvent se confondre      | Deux commandes distinctes : Ouvrir la campagne et Afficher sur l’accueil             |
| Que signifie ce message ?                   | Une panne peut ressembler à une liste vide ; certains statuts sont fixes | Des états précis : aucune donnée, indisponible, hors connexion, déjà effectué        |

Ces difficultés portent sur la compréhension et l’enchaînement des tâches. Les temps d’utilisation et les préférences réelles restent à mesurer auprès des utilisatrices.

## Ce que je conserverais

- Le vert identitaire, constant dans le bandeau du groupement.
- L’identité du membre en gras et le nom du groupement dans un bandeau compact ; les coordonnées complètes et le grand QR dans Ma carte, accessible en une action.
- Des couleurs stables par type : épargne, tontine et autres types, accompagnées d’un nom ou d’un statut textuel.
- La navigation basse à quatre entrées et les campagnes choisies par compte ; les autres restent dans Plus.
- La même base de cartes et de formulaires pour les fonctions équivalentes des deux profils.
- Les règles métier actuelles : séance ouverte le jour prévu, tirage avant encaissement de tontine, un versement personnel valide par période, forfait ou montant libre selon l’inscription.

## Deux directions visuelles

### Continuité — variante de référence

Conserver les repères déjà demandés : grand QR dans le bandeau fixe, campagnes sous forme d’icônes, action sous les campagnes et détails en dessous. Alléger les titres répétés, rapprocher état du jour, campagne et action, et réutiliser les mêmes composants sur tous les écrans.

Sur téléphone, lorsque l’action éligible sort de la zone visible, proposer un raccourci d’action au-dessus de la navigation basse. Il doit garder le nom de la campagne et ne pas recouvrir le dernier élément d’une liste. L’action dans le flux et ce raccourci ne doivent pas créer deux soumissions concurrentes. Son comportement avec le clavier et les petites hauteurs d’écran doit être testé.

Cette variante conserve le grand QR permanent. Elle reste documentée comme référence ; la variante Action du jour a été retenue par l’utilisateur.

### Action du jour — retenue

Afficher une identité plus compacte et placer campagne, séance/tour, montant et action dans le premier bloc. Le grand QR est disponible dans une carte ouverte en une action.

Cette variante donne davantage de place à la tâche quotidienne. Le choix explicite de l’utilisateur remplace la contrainte antérieure du grand QR visible en permanence sur l’accueil : il est maintenant présenté dans une carte dédiée, ouverte en un appui.

La proposition interactive est désormais centrée sur la direction retenue, Action du jour, avec des données fictives. Elle permet de changer de profil et de campagne et de parcourir des exemples d’écrans ; elle ne réalise aucune opération réelle. Les icônes QR y représentent la carte, sans constituer des codes d’identification utilisables.

## Accueil membre proposé

Ordre de la direction retenue :

1. Bandeau compact avec nom du groupement, identité du membre et accès Ma carte ; cette zone ne change pas avec la campagne.
2. Icônes des campagnes sélectionnées, badge des périodes non cotisées, Historique et Plus. Deux rangées au maximum.
3. Un bloc lié à la campagne sélectionnée : nom complet, type, état du jour et montant personnel pertinent.
4. Une action explicite, selon le contexte, visible rapidement grâce à la réduction du bandeau.
5. Les cinq derniers versements ou les cinq derniers tours, puis Voir plus.

### Pour l’épargne

Afficher **Mon montant collecté dans cette épargne**, puis **Séance du [date] · Ouverte/Fermée**. Le bouton Faire un versement est actif uniquement si les règles le permettent.

Après enregistrement : **Versement déjà effectué pour cette séance** ; le montant et la référence sont retrouvables dans l’historique. Le masquage doit être disponible depuis l’accueil et l’historique, et conservé après rechargement.

Les cartes de versement restent sur trois lignes :

- Date et montant.
- Séance concernée.
- État ; référence dans le détail.

Le filtre par séance est conservé. Les badges désignent les périodes effectivement ouvertes et non cotisées selon les règles serveur ; aucune dette ne doit être calculée à partir d’une séance future ou non ouverte.

### Pour la tontine

Afficher le nombre de bénéficiaires déjà servis et la durée restante calculée selon la campagne. Présenter le tour sélectionné et son bénéficiaire, puis Faire un versement si le tour est lancé et si le membre n’a pas déjà versé.

Dans les cinq derniers tours, le bénéficiaire doit être lisible immédiatement. Distinguer **Bénéficiaire désignée** et **Reversement effectué** : le tirage ne prouve pas que la personne a reçu le montant.

## Accueil responsable proposé

Conserver la même structure visuelle, avec les informations utiles à la gestion :

1. Groupement et campagne sélectionnée.
2. État de la séance ou du tour du jour.
3. Montants et action principale dans un même contexte.
4. Participation du jour : cotisées et non cotisées, avec accès au filtre correspondant.
5. Cahiers ou tours précédents, classés du plus récent au plus ancien.

### Pour l’épargne

Présenter les deux indicateurs existants : **Total collecté** et **Total disponible**, avec la même importance typographique et une explication courte de leur portée si leurs valeurs diffèrent.

Avant ouverture : **Ouvrir la séance du [date]**, sans ressaisir la date prévue par la campagne. Après ouverture : **Encaisser l’épargne**, avec deux voies : scanner le QR ou rechercher une membre par nom/téléphone. Le membre doit être choisi explicitement.

Une carte de séance tient sur trois lignes : date et état ; versé/attendu ; cotisées/non cotisées. L’attendu reste signalé comme indicatif lorsque son calcul dépend des forfaits actuels ou exclut les montants libres. Cinq séances par défaut, puis Voir plus.

### Pour la tontine

Conserver sur une même ligne **À cotiser**, **Total encaissé** et **Total reversé** ; le premier est un montant par membre, les deux autres des agrégats, ce qui doit être indiqué.

Afficher le tour du jour en premier. Avant tirage, l’action principale est **Faire le tirage**. Après tirage, montrer la bénéficiaire et rendre l’encaissement disponible. Les trois derniers tours passés suivent, avec Voir plus pour les autres.

Le délai de grâce reste une action sur une membre du tour, dans les conditions métier prévues, et ne s’applique pas à la bénéficiaire.

## Navigation et écrans secondaires

| Écran                  | Proposition UI                                                                                                | Bénéfice recherché                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Navigation membre      | Accueil · Campagnes · Versements · Compte ; titres intérieurs « Mes campagnes » et « Mes versements »         | Libellés courts, hauteur de navigation stable                                       |
| Navigation responsable | Accueil · Campagnes · Membres · Plus                                                                          | Continuité avec l’organisation actuelle                                             |
| Campagnes              | Cartes de même structure ; type et état explicites ; sélection d’accueil indépendante de l’ouverture          | Comprendre la différence entre consulter et personnaliser                           |
| Plus des campagnes     | Afficher sur l’accueil directement, compteur d’emplacements et confirmation discrète                          | Personnalisation sans quitter le contexte                                           |
| Membres                | Recherche prioritaire ; nom et téléphone ; inscriptions et montant épargne en détail ; carte sur trois lignes | Retrouver une personne dans un groupement de plus de 200 membres                    |
| Historique             | Même présentation des lignes, références et annulations pour les deux profils ; filtres adaptés aux droits    | Apprentissage commun et preuve de versement facile à retrouver                      |
| Filtres                | Bouton Filtres, panneau clair, choix multiples, résumé des choix actifs et Effacer                            | Éviter l’empilement permanent de champs                                             |
| Compte / paramètres    | Identité, confidentialité, aide vérifiée et préférences ; statuts réellement disponibles                      | Retirer les fausses garanties et les destinations sans contenu                      |
| Connexion              | Une méthode principale clairement nommée, autres méthodes en second niveau et aide d’accès                    | Réduire l’hésitation initiale ; tester la méthode principale avec les utilisatrices |

Le raccourci Historique de l’accueil reste toujours présent. Les filtres multiples personnels par type, campagne, séance et tour sont conservés ; leur simplification visuelle ne doit pas réduire leur portée.

## Un parcours de versement plus clair

### Membre

Campagne → séance/tour éligible → montant → récapitulatif → confirmation → référence et état mis à jour.

L’identité vient de la session connectée. Le forfait est en lecture seule ; le montant libre est saisi explicitement. Le récapitulatif doit réunir membre, campagne, période et montant sur un écran.

### Responsable

Campagne et séance/tour → QR ou recherche → membre → montant → récapitulatif → confirmation → retour à la séance avec les compteurs actualisés.

Après succès, proposer **Encaisser une autre membre** sans perdre la campagne ni la séance. Après échec, conserver la saisie et permettre une nouvelle tentative explicite. Une action locale ou une réponse réseau incertaine ne doit pas être annoncée comme un succès.

Il s’agit du parcours d’enregistrement des cotisations existant ; aucune intégration de transfert mobile money n’est ajoutée par cette proposition.

## Principes visuels communs

- Une action principale par contexte ; actions secondaires sobres.
- Titres courts, chiffres lisibles, unités constantes. Les libellés précisent « personnel », « séance », « tour » ou « campagne ».
- Le vert identifie l’application, la couleur de type identifie la campagne, et le rouge signale un état nécessitant une attention. Le texte reste indispensable.
- Espacements réguliers et surfaces sobres ; éviter les doubles contours, grosses ombres et répétitions d’en-têtes.
- Commandes courantes visant une zone tactile de 44 × 44 pixels ; contraste vérifié, noms accessibles et focus visible.
- Le nom complet d’une campagne ou d’une membre doit être accessible au toucher, sans dépendre d’une infobulle au survol.
- Retour du téléphone pris en charge ; contexte et filtres retrouvés après consultation d’un détail.

Les choix s’appuient sur les principes de visibilité de l’état, de cohérence, de langage compréhensible et de prévention des erreurs des [heuristiques de Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/). La cible produit de 44 pixels est une recommandation de confort ; le [critère WCAG de taille minimale](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) prévoit un minimum distinct et des exceptions.

## Réalisation recommandée

| Lot                        | Contenu                                                                           | Vérification attendue                                                    |
| -------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| UX 1 — Clarté et confiance | États vide/erreur/hors ligne, reprise de pagination, bons libellés et statuts     | Les défauts prioritaires de l’audit sont corrigés et couverts            |
| UX 2 — Structure commune   | Variante Action du jour, cartes, navigation, historique, filtres, confidentialité | Deux profils cohérents à 360/390/430 px, grand QR accessible en un appui |
| UX 3 — Travail de séance   | Ouverture/tirage, QR ou recherche, récapitulatif, retour au cahier                | Une responsable enchaîne plusieurs encaissements sans perdre le contexte |
| UX 4 — Validation d’usage  | Essais avec membres et responsables, puis téléphones physiques et PWA installée   | Ajustements fondés sur les hésitations et erreurs observées              |

Pour la validation, prévoir par exemple huit participantes, réparties entre membres et responsables, avec des habitudes numériques variées. Ce nombre est une proposition d’organisation, pas une garantie statistique. Faire réaliser des tâches concrètes : retrouver son cumul, identifier une période non cotisée, présenter son QR, préparer un encaissement et retrouver sa référence.

Objectifs proposés, à mesurer : identifier campagne et état du jour en moins de dix secondes ; accéder à une membre par recherche sans parcourir toute la liste ; retrouver un versement et sa référence ; reprendre après coupure sans perte ni doublon. Aucun gain de temps n’est encore démontré.

## Décision de conception

**Réaliser Action du jour pour les deux profils.** La structure cible est : identité compacte → campagnes → état et montants de la période → action principale → derniers mouvements. Le QR est consultable dans Ma carte. Le choix est enregistré dans ce document et appliqué à la PWA locale en version 0.20.0.

L’[audit détaillé](AUDIT-PWA.md) reste la référence pour les défauts reproduits et leurs preuves. Ce document ajoute la direction de conception et les parcours cibles.

### Vérification de la proposition retenue

La proposition interactive affiche uniquement Action du jour et permet de basculer entre Membre et Responsable. L’ouverture de Ma carte présente un QR illustratif de 180 px. Le parcours responsable exige de choisir explicitement une membre avant d’ouvrir le récapitulatif. Ces interactions ont été vérifiées dans l’aperçu local, avec des données fictives, sans appel à l’API métier.

[Capture de la direction retenue](proposition-action-du-jour.png). Cette capture représente la proposition de conception. Les captures de l’intégration 0.20.0 se trouvent dans le [compte rendu](INTEGRATION-ACTION-DU-JOUR.md).

## Déclinaison dédiée au membre

La direction Action du jour se décline en quatre destinations, avec les mêmes couleurs et cartes que celles de la responsable, et des actions limitées à la participation personnelle.

| Écran          | Contenu prioritaire                                                                                                               | Action utile                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Accueil        | Nom du membre, groupement, campagnes choisies, montant personnel de l’épargne sélectionnée ou état de la tontine, période du jour | Faire un versement si autorisé ; Ma carte pour le QR          |
| Mes campagnes  | Seulement les campagnes choisies pour l’accueil, avec type et contexte                                                            | Ouvrir une campagne ; Personnaliser l’accueil pour les autres |
| Mes versements | Historique personnel toutes campagnes, cinq lignes initiales, recherche, filtres et Voir plus                                     | Retrouver un montant et sa référence ; masquer les montants   |
| Mon compte     | Identité et identifiant, groupement, confidentialité et aide auprès de la responsable                                             | Présenter ma carte et choisir mes campagnes                   |

En épargne, le membre retrouve son cumul avant ses cinq derniers versements. En tontine, il retrouve les bénéficiaires déjà servis, les mois restants et les tours passés. Le bouton de versement tient compte de l’ouverture de la période et du versement déjà effectué. L’aperçu membre reste une maquette fictive ; l’intégration réelle de ces interfaces utilise les données et droits de l’API existante. Les filtres multiples par campagne, type, séance et tour restent dans la cible décrite plus haut ; l’aperçu en illustre une version simplifiée par type.
