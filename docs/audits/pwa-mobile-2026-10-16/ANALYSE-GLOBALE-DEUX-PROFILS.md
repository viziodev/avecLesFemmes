# Analyse globale — Membre et administratrice de groupement

16 octobre 2026 · Audit de la PWA 0.2.0 en recette, complété par lecture du code.

## 1. Conclusion produit

Les deux profils utilisent actuellement une même structure d’écran, avec certaines commandes retirées selon les droits. Cela protège une partie des interactions mais ne produit pas deux expériences réellement adaptées.

**La membre cherche à comprendre et vérifier son épargne. L’administratrice cherche à enregistrer correctement et rapidement les opérations du groupement.** Elles doivent partager les mêmes données de référence et la même identité graphique, mais avoir des accueils, une navigation et des actions prioritaires distincts.

La différence doit porter sur les parcours, pas sur les autorisations : rendre une information plus compréhensible ne doit jamais conduire à exposer des données supplémentaires.

## 2. Base de l’analyse

- Profil administratrice observé : Ndèye Diop, gestion du groupement et bascule personnelle.
- Profil membre simple observé séparément : Awa Fall, connexion et consultation sans commande de gestion.
- Fenêtres mobiles 360, 390 et 430 px ; captures et mesures DOM ; lecture des API, états React, styles et mécanisme PWA.
- Deux membres de démonstration, une campagne active, aucun versement. Aucun changement métier soumis.
- Les tests de caméra réelle, les reçus remplis, les campagnes terminées, les gros volumes, les interruptions réseau et l’accessibilité complète restent à effectuer dans un environnement de test dédié.
- Version 0.2.1 : mise à jour automatique développée séparément, non considérée comme déjà présente en recette.

Documents de détail : [audit administratrice et problèmes communs](ANALYSE-UI-UX.md), [audit membre simple](AUDIT-MEMBRE.md).

## 3. Besoins, responsabilités et différences

| Dimension           | Membre                                                                   | Administratrice de groupement                                        |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Question principale | Combien ai-je versé et pour quoi ?                                       | Que dois-je encaisser et pour qui ?                                  |
| Action dominante    | Présenter son QR et consulter ses versements                             | Enregistrer une cotisation confirmée                                 |
| Périmètre           | Ses participations et montants autorisés                                 | Campagnes, membres et caisse du groupement autorisé                  |
| Argent affiché      | Total personnel par campagne, sans promesse de disponibilité injustifiée | Caisse nette et encaissements, avec périmètre et période             |
| Campagnes           | Comprendre règles, échéances, état et historique                         | Créer/paramétrer selon droits, suivre et clôturer                    |
| Liste de personnes  | Sa fiche d’adhésion                                                      | Répertoire recherchable, fonctions et accès                          |
| QR                  | Présenter une identité                                                   | Lire, vérifier et sélectionner une participante                      |
| Risque dominant     | Mauvaise compréhension de son épargne ou de ses obligations              | Erreur de personne, de campagne, de montant ou double enregistrement |
| Aide                | Compréhension des termes et récupération d’accès                         | Gestion des erreurs, reprise de séance et preuves d’opération        |
| Usage personnel     | Mode normal                                                              | Mode personnel distinct, sans commandes de gestion                   |

## 4. Matrice des problèmes et de leur portée

| Sujet                    | Membre                                                              | Administratrice                                                                            | Priorité globale                                 |
| ------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Sémantique des montants  | « Disponible » ambigu                                               | « Caisse » confondue avec cotisations collectées                                           | P0 : exactitude métier                           |
| Graphiques fictifs       | Non présentés dans le parcours membre inspecté                      | Présents dans Chiffres                                                                     | P0 : retirer/calculer réellement                 |
| Scanner simulé           | Promesse de scan sans utilité claire                                | Ne sécurise pas l’identification lors de l’encaissement                                    | P0 : pas de faux succès                          |
| Retours d’enregistrement | Doit recevoir une preuve fiable                                     | Annonce vocale possible après erreur, toast peu différencié                                | P0 : succès confirmé uniquement                  |
| Hiérarchie mobile        | QR/scanner de la carte et raccourcis loin sous le contexte          | Encaisser hors du premier écran                                                            | P1 : premier écran centré sur la tâche           |
| Tableaux                 | Consultation personnelle sur structure collective                   | Gestion par colonnes très larges                                                           | P1 : cartes et fiches mobiles                    |
| Navigation               | Membres signifie Mon adhésion ; actions redondantes                 | Plusieurs accès et sous-vues sans parcours retour explicite                                | P1 : navigation propre à chaque rôle             |
| Filtres/pagination       | Catégories inopérantes ; historique à qualifier sur plusieurs pages | Recherche limitée aux pages chargées ; sélection de participante à éprouver au-delà de 100 | P1 : recherche globale et résultats exacts       |
| Campagnes terminées      | Accès non évident, menu Archives absent                             | Archives disponible                                                                        | P1 : continuité des preuves personnelles         |
| Confidentialité          | Masquage partiel des montants                                       | Montants visibles ailleurs et annonce vocale par défaut                                    | P1 : portée claire et préférence choisie         |
| Accessibilité            | Petites cibles et QR/modal                                          | Petites cibles et formulaires longs sans focus maîtrisé                                    | P1/P2 selon la tâche bloquée                     |
| PWA/réseau               | Ancienne version possible et accès à clarifier hors connexion       | Risque de perte ou d’incertitude pendant une saisie                                        | P1 : mise à jour différée et statut réseau clair |

## 5. Preuves quantitatives utiles

Mesures sur le jeu de démonstration, pas des temps utilisateurs :

- Accueil administratrice à 390 × 844 : environ **3 080 px** de haut ; Encaisser commence à **1 003 px**.
- Accueil membre simple à 390 × 844 : environ **2 568 px** ; Scanner de la carte à **1 058 px**, Cotiser à **1 150 px**. L’en-tête offre aussi un accès au QR, ce qui atténue ce problème pour cette action précise.
- Tableau membres administratrice à 360 px : **653 px** dans une zone de **286 px**.
- Tableau campagnes administratrice à 430 px : **930 px** dans une zone de **356 px**.
- Navigation haute : boutons d’environ **39 px** de hauteur ; certains contrôles mesurés à **18–20 px**. La taille seule ne permet pas d’affirmer une non-conformité WCAG sans examiner les exceptions et l’espacement.
- Une même campagne affiche **2 membres** côté gestionnaire et **1 membre** côté Awa : le filtrage personnel doit être expliqué par le libellé, pas présenté comme un effectif collectif.

## 6. Architecture d’interface cible

### Socle partagé

Une charte graphique, des formats FCFA/dates cohérents, un contrat commun de statuts et des composants accessibles : cartes, listes, champs, boutons, messages, dialogues et reçus. Les réponses API et règles d’accès restent la source de vérité.

Un en-tête court affiche le nom du groupement et l’espace courant. Les détails (adresse, responsable, QR du groupement) sont déplacés dans une fiche. La sélection de groupement disparaît quand elle n’est pas utile ; lorsqu’elle existe, elle utilise un seul contrôle.

### Navigation membre proposée

**Accueil · Mes campagnes · Mes versements · Mon compte**.

Accueil : campagne et total personnel → prochaine échéance/règle → Présenter mon QR → derniers versements. Aucune action de paiement autonome sans traitement correspondant. Les catégories et filtres restent liés à de vraies données autorisées.

### Navigation administratrice proposée

**Accueil · Encaisser · Membres · Plus**.

Accueil : groupement/campagne courants → caisse nette et encaissements contextualisés → encaisser → opérations récentes et éléments à traiter. Plus contient Campagnes, Chiffres, Archives et Paramètres.

Encaissement : identifier la membre → vérifier la campagne → saisir montant/date → confirmer le récapitulatif → preuve serveur → membre suivante. Le statut incertain d’une requête interrompue exige une vérification avant nouvel envoi.

### Administratrice également membre

Le changement d’espace doit être visible et durablement compréhensible : « Gestion du groupement » ou « Mon épargne ». Un titre, les données et les actions changent ensemble. Ne pas conserver des outils de gestion dans le mode personnel, ni des intitulés collectifs pour les données personnelles.

Une barre basse est une hypothèse à prototyper et tester avec clavier ouvert, retour système et lecteurs d’écran ; pas une fin esthétique en soi.

## 7. Contrat de confiance à établir avant les maquettes

| Élément            | Règle proposée                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Total versé        | Montant réellement enregistré, non annulé, avec campagne et périmètre personnel/collectif explicites                 |
| Caisse disponible  | Encaissements moins reversements selon la règle validée, pas une simple somme des cotisations                        |
| Prochaine échéance | Date calculée depuis la campagne ; montant libre explicitement indiqué sans créer une dette fictive                  |
| Paiement réussi    | Confirmation serveur ; même statut sur écran, voix et reçu                                                           |
| Paiement incertain | Message distinct et reprise par idempotence ; jamais afficher « reçu » par défaut                                    |
| Graphique          | Valeurs issues des données et bornes temporelles réelles ; absence de données distincte de zéro                      |
| QR                 | Identifie une cible selon un format validé ; aucune autorisation financière implicite                                |
| Historique         | Résultats cohérents avec les filtres, droits et pagination ; campagnes terminées accessibles selon les règles métier |
| Confidentialité    | Le bouton de masquage couvre les montants annoncés ; voix explicitement choisie                                      |

## 8. Plan commun de réalisation

1. **Corriger la fiabilité.** Graphiques, sémantique des montants, résultats du scanner, erreurs/succès et annonce vocale. Corriger les filtres qui ne produisent aucun effet.
2. **Définir les deux parcours.** Une arborescence membre, une arborescence gestionnaire, un passage explicite entre gestion et personnel. Valider les mots « versé », « caisse », « échéance », « séance ».
3. **Prototyper les premiers écrans.** Accueil des deux profils, campagne membre, liste membres et saisie. Vérifier le premier écran à 360 × 800 avant d’étendre le design.
4. **Sécuriser l’encaissement.** Recherche sur tout le groupement, pas de participante présélectionnée silencieusement, réinitialisation montant libre/forfait, validation accessible et reçu.
5. **Adapter la consultation.** Cartes campagnes, fiche d’adhésion, versements et campagnes terminées ; retirer les tris et commandes sans utilité pour le profil.
6. **Qualifier la robustesse.** PWA 0.2.1, plusieurs onglets, réseau interrompu, clavier, lecteur d’écran, 250 membres et historique paginé.

Chaque lot doit conserver les règles métier et les accès. Les nouvelles interfaces devraient être testées séparément par profil ; une compilation réussie ou une capture visuelle ne prouve ni l’exactitude financière ni l’utilisabilité.

## 9. Matrice de validation future

| Scénario                                | Profil          | Succès attendu                                                           |
| --------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| Lire son cumul et sa prochaine échéance | Membre          | Identifie campagne, montant versé et règle sans aide                     |
| Présenter son QR                        | Membre          | Une action depuis l’accueil, bon nom et bon groupement                   |
| Retrouver une cotisation ancienne       | Membre          | Recherche exacte au-delà de la première page                             |
| Retrouver une campagne terminée         | Membre          | Historique personnel accessible sans droits de gestion                   |
| Masquer les montants                    | Les deux        | Tous les montants concernés masqués, préférence explicite                |
| Retrouver une membre parmi 250          | Administratrice | Recherche globale, identité vérifiable                                   |
| Passer d’un forfait à un montant libre  | Administratrice | Aucun montant hérité silencieusement                                     |
| Requête refusée/interrompue             | Administratrice | Pas de faux succès, pas de doublon, état et reprise compréhensibles      |
| Changer de période dans Chiffres        | Administratrice | Dates, total et graphique concordent avec les opérations                 |
| Passer en mode personnel                | Administratrice | Périmètre clair, pas de commande collective                              |
| Mise à jour pendant une saisie          | Administratrice | Formulaire et résultat préservés, rechargement au moment sûr             |
| Vérifier les droits                     | Les deux        | Aucun accès supplémentaire créé par la refonte ; tests API en complément |

Faire ensuite tester les parcours par 5 à 8 utilisatrices des deux profils. Mesurer réussite sans aide, erreurs, temps et compréhension du statut. Les objectifs chiffrés seront ajustés après une mesure initiale ; cet audit ne prétend pas avoir conduit cette étude.

## 10. Décisions produit à prendre lors de la conception

- Un membre consulte-t-il uniquement ses versements ou aussi certains indicateurs collectifs ? Les libellés doivent suivre les droits décidés.
- « Cotiser » signifie-t-il présenter son QR, déclarer une intention ou payer réellement ? Le premier incrément observé ne propose pas de paiement autonome.
- Quelle aide proposer pour un PIN oublié et quel rôle peut le réinitialiser ?
- Quelles preuves conserver/partager après versement et après clôture ?
- Quelle terminologie et quel accompagnement linguistique conviennent aux utilisatrices ?

Ces questions ne bloquent pas la correction des problèmes déjà prouvés. Elles doivent être tranchées avant d’ajouter de nouvelles promesses fonctionnelles.
