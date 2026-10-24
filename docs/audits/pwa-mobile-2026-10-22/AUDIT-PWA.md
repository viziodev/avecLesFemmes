# Revue des interfaces et audit PWA — AvecLesFemmes

**22 octobre 2026 · Version locale 0.18.0 · Membre et administratrice de groupement**

## Verdict

La PWA dispose désormais d’un socle visuel cohérent : navigation basse, couleurs par type de campagne, cartes compactes, QR personnel et séparation gestion/consultation personnelle. Les principales tâches sont identifiables. Les fragilités prioritaires portent sur **la fiabilité en réseau dégradé et la confiance dans les informations affichées**.

**Quatre constats P1 sont à traiter avant une nouvelle promotion en recette.** Ils sont suivis de quatre constats P2 sur l’accessibilité, la compréhension et la navigation. Aucun changement applicatif ni déploiement n’est réalisé par cet audit.

La [proposition d’interfaces et de parcours cibles](PROPOSITION-UI-UX.md) complète ce diagnostic avec les parcours cibles et la direction « Action du jour », retenue par l’utilisateur le 22 octobre 2026.

## Méthode et périmètre

- Application locale sur `http://localhost:8086/`, comptes de démonstration `admin.ndeye` et `membre.awa` ; mode personnel de l’administratrice également consulté manuellement.
- Chromium avec profil Android et WebKit avec profil iPhone, à **360 × 800**, **390 × 844** et **430 × 932 pixels CSS**.
- **16 scénarios d’observation exécutés**, comprenant **90 relevés de vues**, des captures et des reproductions contrôlées de pannes. Leur réussite signifie que la collecte et les reproductions ont abouti : plusieurs scénarios confirment précisément des défauts.
- Parcours réels en lecture seule : accueil, Plus, campagnes, personnalisation, historique, filtres, compte membre, membres, paramètres, formulaire de campagne sans soumission, séances et tontine. Inspection du code UI et du coordinateur de mise à jour PWA.
- Les scénarios réseau simulent les réponses HTTP dans le navigateur. Les écritures métier sont interdites par le harnais ; seules les connexions de test sont autorisées. Aucun versement, tirage, délai de grâce, inscription ou préférence réelle n’a été modifié.

Les comptes contiennent notamment des campagnes de démonstration datées du 21 octobre. Les boutons indisponibles le 22 octobre ne constituent pas, à eux seuls, une anomalie. La création effective d’une séance, un tirage et l’enregistrement financier ne sont pas qualifiés par cette revue en lecture seule.

Cet audit ne certifie ni la conformité WCAG complète, ni la sécurité API, ni la capacité de charge de 1 000 groupements. Les essais sur téléphones physiques, clavier virtuel, lecteur d’écran, caméra et PWA installée restent à réaliser. La recette Render/Neon n’a pas été inspectée.

## Revue par interface

| Interface            | Points solides                                                                   | Écart principal                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Connexion            | Identifiant et méthodes téléphone disponibles ; formulaire identifiable          | Démonstration très présente, aide de récupération limitée ; masquer les cartes démo selon l’environnement                     |
| Accueil membre       | Identité en gras, grand QR stable, total personnel, badges et campagnes choisies | Action de versement basse dans la page ; pas de blocage visuel immédiat hors ligne                                            |
| Mes campagnes / Plus | Choix et consultation distincts ; cartes et commandes partagées                  | Titres longs tronqués ; conserver un accès tactile au nom complet                                                             |
| Mes versements       | Cinq lignes initiales, filtres multiples, archives et références                 | Reprise de pagination incorrecte après panne ; confidentialité seulement commandable depuis l’accueil                         |
| Mon compte           | Fiche personnelle simple et compréhensible                                       | Aide non actionnable directement ; préciser comment joindre la responsable                                                    |
| Accueil gestion      | Campagne sélectionnée, QR groupement, actions contextualisées                    | Contexte et raccourcis repoussent l’encaissement sous le premier écran                                                        |
| Campagnes / membres  | Recherche, cartes et actions de gestion existantes                               | Fiche de contexte et textes introductifs occupent beaucoup de place ; listes de membres longues                               |
| Séances / tours      | Présentation commune, détails et filtres d’état                                  | Une panne de cahier peut être affichée comme une absence de données                                                           |
| Historique gestion   | Recherche nom/téléphone, état, dates et actualisation                            | Bouton d’actualisation étroit ; logique et présentation différentes de l’historique personnel                                 |
| Paramètres           | Destinations utiles regroupées                                                   | Statuts et aide présentés comme opérationnels sans donnée ou destination correspondante ; contrastes et sémantique à corriger |

## Constats prioritaires

P1 : fiabilité, compréhension métier ou confiance à corriger avant promotion. P2 : usage, accessibilité ou cohérence à corriger dans le lot suivant.

### A01 — P1 · Une erreur de pagination peut masquer cinq versements

**Reproduction confirmée sur les deux moteurs.** Dans Mes versements, charger cinq lignes, simuler une erreur 503 sur la page 2, puis appuyer à nouveau sur Voir plus. La séquence demandée est **1 → 2 en erreur → 3**. L’écran affiche sept lignes sur douze et omet celles de la page 2. Il s’agit d’une omission d’affichage ; aucune suppression en base n’est démontrée. Le lien Réessayer propose un chemin distinct, mais Voir plus reste utilisable après l’erreur et permet ce saut.

Cause : le compteur de page avance au clic, et le bouton reste actif après l’échec (`packages/ui/src/MemberHistory.tsx:59`, `:73`, `:244`). Le même schéma existe dans la liste de versements d’épargne de l’accueil et mérite la même correction.

**Correction :** valider l’avancement seulement après succès ou conserver explicitement la page à réessayer ; désactiver le chargement de la page suivante tant que la précédente manque. **Acceptation :** après une panne puis reprise, les douze références sont consultables une seule fois, sans trou.

Preuve : [requêtes et références affichées](pagination-android-chromium.json), [WebKit](pagination-iphone-webkit.json).

### A02 — P1 · Une panne de cahier devient « Aucune séance enregistrée »

**Reproduction confirmée sur les deux moteurs.** Un 503 sur l’endpoint des séances produit une liste vide et le message « Aucune séance enregistrée », sans alerte de panne. La responsable peut croire que le cahier n’existe pas.

Cause : les erreurs de séances sont converties en `[]` ; les tours et délais utilisent également ce traitement (`packages/ui/src/App.tsx:2606`). Le défaut des séances a été reproduit ; l’extension aux autres listes provient de la lecture du code.

**Correction :** états distincts chargement/vide/erreur, conservation des dernières données avec indication de fraîcheur, bouton Réessayer local. **Acceptation :** un 503 ne produit jamais un message d’absence de données.

Preuve : [texte et alertes observés](erreur-seances-android-chromium.json), [capture](erreur-seances.png).

### A03 — P1 · Le bouton de versement personnel reste actif hors connexion

**Reproduction confirmée sur les deux moteurs.** Avec une séance autorisant le versement, couper le réseau : la bannière Hors connexion apparaît, mais Faire un versement reste activé. Aucun paiement n’a été soumis pendant cet essai.

Cause : le composant personnel ne reçoit pas l’état réseau et le bouton dépend seulement du statut précédemment chargé (`packages/ui/src/MemberSpace.tsx:545`). La vérification périodique ne remplace pas une réaction immédiate au changement réseau.

**Correction :** partager l’état réseau, désactiver la soumission hors ligne, conserver le brouillon et proposer une nouvelle tentative explicite après reconnexion. **Acceptation :** coupure avant saisie ou avant confirmation : aucune requête d’écriture, saisie conservée et consigne claire. Les garanties serveur d’unicité doivent rester indépendantes de ce contrôle UI.

Preuve : [bouton et bannière observés](hors-ligne-android-chromium.json), [WebKit](hors-ligne-iphone-webkit.json).

### A04 — P1 · Les paramètres affichent des garanties sans vérification

**Constaté dans l’interface et le code.** « Sécurité & Code PIN — Actif » et « Vérifier conformité Calebasse — Conforme » sont des textes fixes. Aucun état de compte ni résultat de contrôle ne les alimente. Le numéro d’assistance et la gratuité sont également codés en dur ; leur validité n’a pas été vérifiée. Le bouton Vidéos de formation affiche une alerte sans ouvrir de contenu.

Sources : `packages/ui/src/App.tsx:1223`, `:1232`, `:1242`, `:1258`.

**Correction :** afficher des états réellement calculés ou retirer ces garanties ; configurer une assistance validée, supprimer la promesse de gratuité non établie, ouvrir une ressource de formation réelle ou indiquer son indisponibilité. **Acceptation :** chaque statut est traçable à une donnée et chaque action d’aide possède une destination exploitable.

Preuve : [états et destination observés](navigation-parametres-android-chromium.json), [paramètres complets](parametres-desktop.png).

### A05 — P2 · L’accessibilité reste incomplète

Trois écarts mesurés ou inspectés :

- **Nom accessible manquant** sur l’interrupteur Annoncer les paiements : aucun `aria-label`/`aria-labelledby`, et son label ne contient que le dessin du bouton. L’arbre d’accessibilité affiche une case sans nom. Source : `packages/ui/src/App.tsx:1161`.
- **Contraste de 2,56:1** pour l’aide des paramètres : texte de 12 px, `rgb(148,163,184)` sur blanc. La référence pour ce texte est 4,5:1. Source : `packages/ui/src/styles.css:3784` et [mesure](navigation-parametres-android-chromium.json). Référence : [W3C, contraste minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- **Cibles et focus à harmoniser** : Filtres mesure 32 px de haut, l’actualisation gestion 20 × 44 px ; certains selects WebKit mesurent 26 px de haut. Les cases possèdent un label plus grand : leur seule taille graphique ne permet pas de conclure à un échec d’accessibilité. Objectif produit recommandé : 44 × 44 px sur les commandes courantes. Le minimum WCAG AA de 24 px comporte des exceptions d’espacement ; les mesures sous 44 ne sont donc pas automatiquement des non-conformités. Référence : [W3C, taille des cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

Le dialogue commun dispose d’un focus initial et d’un confinement au clavier. Le fond n’est pas rendu `inert` dans le DOM inspecté ; le comportement de lecture avec VoiceOver/TalkBack reste à qualifier selon le [modèle de dialogue W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

**Acceptation :** nom accessible explicite, contraste suffisant, commandes tactiles homogènes et parcours clavier/lecteur d’écran réels validés.

### A06 — P2 · « Nombre de membres du groupement » dépend du profil

**Confirmé aux trois largeurs et sur les deux moteurs.** Pour le même groupement, les écrans Campagnes affichent **50 membres** côté administratrice et **1 membre** côté membre. Le nombre affiché dans la fiche collective reprend un résultat filtré par les droits ; son libellé lui donne pourtant une portée collective (`packages/ui/src/App.tsx:3468`). Ce point était déjà signalé par l’audit du 16 octobre.

**Correction :** présenter « Mon adhésion » sans compteur collectif, ou fournir un agrégat collectif explicitement autorisé. Ne pas élargir la lecture des fiches membres pour résoudre un libellé. **Acceptation :** le même libellé a la même signification pour les deux profils.

Preuves : [campagnes membre](membre.awa-campagnes-390.png), [campagnes gestion](admin.ndeye-campagnes-390.png), relevés JSON des deux comptes.

### A07 — P2 · Retour et rechargement perdent le contexte d’usage

**Retour navigateur reproduit sur les deux moteurs.** Paramètres → accueil → Membres ne crée aucune entrée de navigation : la pile reste à deux entrées. Retour mène à `about:blank` dans le contexte de test, au lieu de revenir à l’écran précédent. La destination réelle dépendra de la page visitée avant la PWA.

Les rubriques, la campagne et les filtres sont principalement en état React (`packages/ui/src/App.tsx:1910`, `:3262`). Un rechargement repart de l’accueil. Le masquage des montants est aussi initialisé à visible (`:2018`) ; sa persistance après rechargement n’est pas prévue par le code.

**Correction :** synchroniser rubrique/campagne/filtres avec une navigation URL et gérer Retour ; conserver la préférence de confidentialité séparément des données financières. **Acceptation :** Retour traverse les écrans de l’application et la préférence de masquage survit au redémarrage.

Preuve : [pile de navigation et destination](navigation-parametres-android-chromium.json).

### A08 — P2 · La hiérarchie mobile et certaines présentations restent à uniformiser

À **390 × 844**, le bloc d’action commence vers **y=692 côté membre** et **y=789 côté gestion** ; la navigation fixe commence vers **y=767 et y=781**. L’accès complet à l’action demande donc de faire défiler la page. À 360 px, la contrainte augmente. Ces valeurs concernent le jeu de données inspecté, avec ses raccourcis et titres longs ; elles ne mesurent pas un temps de tâche utilisateur.

Le grand QR et le bandeau fixe correspondent aux choix fonctionnels demandés : ils sont à conserver. Il faut arbitrer l’accès à l’action autour de cette contrainte, par exemple une action persistante uniquement lorsqu’une séance ou un tour permet de l’utiliser, positionnée au-dessus de la navigation et sans recouvrir les listes.

Autres différences visibles : cartes et filtres d’historique personnel/gestion, bordures natives épaisses dans les paramètres, textes introductifs répétés, hauteur de navigation qui varie avec les libellés, aide accessible depuis un seul endroit. Les montants et références importants restent disponibles dans les détails ; les noms tronqués doivent aussi pouvoir être lus au toucher.

**Acceptation :** action éligible atteignable et contextualisée, navigation de hauteur stable, mêmes composants pour les fonctions équivalentes, accès au nom complet et au masquage depuis l’historique.

Preuves : [accueil membre](membre.awa-accueil-390.png), [accueil gestion](admin.ndeye-accueil-390.png), [paramètres mobiles](admin.ndeye-parametres-390.png).

## Mesures récapitulatives à 390 px

| Mesure Chromium                           | Membre   | Administratrice |
| ----------------------------------------- | -------- | --------------- |
| Hauteur du document Accueil               | 1 763 px | 1 585 px        |
| Début du bloc d’action                    | y=692 px | y=789 px        |
| Début de la navigation basse              | y=767 px | y=781 px        |
| Compteur collectif affiché dans Campagnes | 1        | 50              |
| Débordement horizontal dans les relevés   | 0 px     | 0 px            |

Les relevés comptent aussi des éléments hors du premier écran mais accessibles par défilement. Les petits inputs doivent être évalués avec leurs labels cliquables ; les coordonnées ne constituent pas un audit WCAG automatique.

## Qualité du code et couverture à renforcer

- `CampaignNavigation`, `MemberSpace`, `MemberHistory` et `Dialog` sont des extractions utiles. Les références financières sont affichées et les erreurs de soumission disposent d’un message.
- `App.tsx` contient **7 340 lignes** et `styles.css` **5 899 lignes** dans l’état audité. Les variantes personnelles historiques et les surcharges successives rendent les changements difficiles à isoler. Extraire progressivement les écrans et leurs états de chargement constitue une amélioration de maintenabilité ; aucune dégradation de performance chiffrée n’est déduite de ces volumes.
- Certaines attentes de `tests/e2e/parcours.spec.ts:640` visent encore « Ma participation » ou l’ancien titre de montant. Ces éléments ne correspondent plus au parcours membre actuel. Ce décalage est constaté par lecture du code ; la suite e2e complète n’a pas été exécutée pendant cet audit, car elle comporte des écritures métier.
- Le chargement du statut personnel est renouvelé au focus et périodiquement ; les listes et badges n’ont pas tous la même politique de rafraîchissement. Ajouter un scénario où une responsable enregistre ailleurs puis le membre revient dans la PWA. Une incohérence temporelle est un risque de code à tester, pas un défaut reproduit ici.
- Le coordinateur de mise à jour retarde le rechargement pendant les dialogues et mutations. La qualification d’une mise à jour entre deux versions installées sur téléphone reste nécessaire.

## Plan de correction proposé

| Lot                                | Contenu                                                                                                     | Critère de sortie                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 — Fiabilité et confiance         | A01–A04 : reprise de page, états d’erreur distincts, garde réseau personnelle, paramètres vérifiables       | Régressions de panne/reprise sans trou ni faux vide ; aucun statut non étayé                          |
| 2 — Accessibilité et compréhension | A05–A06 : noms accessibles, contrastes, cibles, compteur selon portée                                       | Parcours clavier et lecteur d’écran ; libellés corrects entre profils                                 |
| 3 — Navigation et cohérence        | A07–A08 : Retour, confidentialité, accès à l’action, composants d’historique/paramètres                     | Recette 360/390/430, zoom, navigation stable, noms complets accessibles                               |
| 4 — Qualification                  | Mettre à jour les e2e obsolètes, fraîcheur multi-utilisatrice, PWA installée, caméra et réseau mobile réels | Recette sur Android/iPhone physiques puis promotion Render gratuit + Neon selon le processus existant |

Pour chaque correction, transformer la reproduction d’audit en test de non-régression exigeant le bon comportement. Les scénarios d’audit actuels constatent certains défauts et ne doivent pas devenir une barrière de qualité imposant leur conservation.

## Rejouer et retrouver les preuves

Commande depuis la racine, services locaux démarrés et identifiants de démonstration configurés dans `.env` :

```sh
npx playwright test --config playwright.audit.config.ts
```

Harnais : [configuration](../../../playwright.audit.config.ts), [scénarios](../../../tests/audit/pwa-ui-audit.spec.ts). Il est séparé de la suite mobile de régression. Les captures et JSON sont régénérés dans ce dossier ; ne pas le lancer sur un environnement réel sans comptes et données de test prévus.

Relevés principaux : [membre Chromium](membre.awa-android-chromium.json), [membre WebKit](membre.awa-iphone-webkit.json), [gestion Chromium](admin.ndeye-android-chromium.json), [gestion WebKit](admin.ndeye-iphone-webkit.json). Compléments : [séances/tontine gestion](metier-admin.ndeye-android-chromium.json), [tontine membre](metier-membre.awa-android-chromium.json).
