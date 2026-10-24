# Audit de la charte graphique et proposition d’évolution

**AvecLesFemmes · PWA locale 0.24.0 · 23 octobre 2026**

**Suite donnée :** les corrections ont été intégrées localement en **0.25.0** après validation de l’utilisateur. Ce document conserve l’état initial de l’audit. Voir [la réalisation et les captures après correction](../charte-integree-0.25/REALISATION.md).

## Avis

La charte possède de bons repères : un vert identitaire reconnaissable, des types de campagne différenciés et une base commune aux deux profils. Je recommande une évolution de cette charte, en conservant l’accueil « Action du jour » déjà retenu. Les priorités sont la lisibilité des petits textes, le contraste de la navigation sombre et la cohérence des styles.

Le résultat attendu : une interface plus facile à lire sur téléphone, des montants mieux hiérarchisés et les mêmes règles visuelles dans l’accueil, les campagnes, les séances, les tours, les formulaires et les reçus.

Au moment de cet audit, la proposition n’était pas encore appliquée à l’application. [Ouvrir le comparatif visuel de référence](PROPOSITION-CHARTE.html).

## Périmètre et méthode

- Lecture du CSS partagé et des composants de palette, apparence, navigation, identité et action du jour.
- Captures et styles calculés dans Chromium mobile, largeur **390 pixels CSS**, hauteur 844, sur `http://localhost:8086/`.
- Deux comptes de démonstration : responsable de groupement et membre ; modes clair et sombre.
- Douze vues : accueil, campagnes et membres pour la responsable ; accueil, campagnes et historique pour la membre, dans les deux thèmes.
- Navigation et consultation uniquement. Le script bloque les écritures métier ; seules les requêtes d’authentification et d’activité nécessaires à l’accès sont autorisées.
- Essai complémentaire de connexion avec le fournisseur Google Fonts bloqué.

Les mesures sont reproductibles dans `tests/audit/charte-graphique.spec.ts`. Les JSON et captures du présent dossier constituent les éléments de preuve. Il ne s’agit pas d’une certification WCAG : les captures couvrent les données et palettes locales présentes au moment de l’audit. Les formulaires ouverts, erreurs, reçus et codes secrets ont été examinés dans le code et les captures antérieures du 23 octobre, sans nouvel encaissement. Le zoom à 200 %, les téléphones physiques et toutes les palettes personnalisées restent à qualifier.

Vérifications réalisées : **5 scénarios de collecte réussis**, puis **1 scénario de vérification du comparatif réussi** (deux profils × deux thèmes × trois types, images actuelles présentes, aucune erreur JavaScript, absence de débordement horizontal à 360/390/430 px). Les deux captures `proposition-responsable-clair.png` et `proposition-membre-sombre.png` ont été inspectées visuellement. Ces vérifications concernent l’audit et sa maquette ; elles ne constituent pas une nouvelle qualification fonctionnelle de l’application.

## Ce qui fonctionne

| Élément          | Observation                                                                               | À conserver                                          |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Identité         | Vert profond, bandeau compact, nom du groupement et identité de l’utilisatrice            | Reconnaissance immédiate et continuité entre profils |
| Campagnes        | Icônes et libellés accompagnent la couleur ; épargne verte et tontine violette            | Identification par plusieurs indices                 |
| Personnalisation | Palette globale et adaptation au groupement ; variantes calculées                         | Paramétrage existant et héritage des couleurs        |
| Thèmes           | Surfaces et textes sont adaptés au clair/sombre                                           | Choix automatique ou manuel par appareil             |
| Typographie      | DM Sans pour le texte et Manrope pour les titres : deux familles adaptées à une interface | Ton simple et lisibilité générale                    |
| QR               | Noir sur blanc, même en mode sombre                                                       | Contraste stable et lecture du code                  |
| Actions          | Bloc « Action du jour », bouton principal clairement identifié                            | Structure déjà retenue par l’utilisateur             |

## Constats et priorités

### P1 — Le libellé actif de la navigation sombre manque légèrement de contraste

Dans les six vues sombres mesurées, le texte de l’onglet actif est `#7EA69F` sur `#193E31`, soit **environ 4,42:1**. Sa taille est de 11 px, graisse 700 : le minimum de 4,5:1 s’applique au texte de cette taille. Les vues claires mesurées ne présentent pas de candidat en échec dans le sous-ensemble de textes contrôlé.

**Correction proposée :** créer une paire dédiée `navigation-selected-foreground/background`. Par exemple `#8BD9BD` sur `#21362C` donne **7,83:1**. Vérifier le fond réel du composant après composition, pas uniquement une surface de référence dans le générateur de palette.

Le générateur actuel vise 4,6:1 mais le composant peut utiliser une autre surface : cette protection doit être conservée et complétée par des tests des composants rendus. Aucun résultat global de conformité ne peut être déduit de ce seul mécanisme.

Preuves : `admin.ndeye-dark.json`, `membre.awa-dark.json`, propriété `contrastCandidates`.

### P1 — Des informations utiles sont trop petites pour une lecture mobile confortable

Mesures réelles : noms secondaires des raccourcis de campagne en **10 px**, navigation basse en **11 px**, accès « Ma carte » en **11 px**, intitulés des indicateurs en **11 px**, action « Ajouter un membre » des campagnes en **11 px**. L’accueil responsable utilise notamment 10, 11, 12, 13, 15, 17, 18 et 22 px.

**Proposition :** informations principales à 16 px, informations secondaires à 14 px, navigation et badges à 12 px minimum, actions à 16 px. Les notes à 12 px restent courtes et secondaires. Ne pas agrandir tous les textes sans adapter le retour à la ligne : conserver les cartes compactes en limitant les répétitions plutôt qu’en réduisant les caractères.

Il s’agit d’un problème de confort de lecture, pas d’une infraction WCAG déduite de la seule taille en pixels. Il faut également tester l’agrandissement à 200 %.

### P2 — La hiérarchie typographique manque de règles communes

Titres Manrope, corps DM Sans, tailles intermédiaires nombreuses et graisses 400 à 800. L’import de DM Sans demande 400/500/600/700, alors que certains textes héritant de cette famille demandent 800 ; ce niveau supplémentaire n’est pas chargé par cet import. Avec `font-synthesis: none`, il ne faut pas compter sur une graisse artificielle pour créer la hiérarchie.

La feuille partagée déclare **45 valeurs distinctes de `font-size`**, y compris les unités relatives et expressions `clamp()`. Ce nombre inclut le Super Admin et des règles surchargées : il ne représente pas 45 tailles visibles dans la PWA. Les écrans capturés confirment néanmoins la présence simultanée de nombreux petits paliers.

**Proposition recommandée :** DM Sans pour l’ensemble de la PWA, avec quatre graisses : 400, 500, 600 et 700. Une seule famille facilite la régularité des formulaires, chiffres et libellés. Il s’agit d’un choix de direction graphique ; les deux familles actuelles ne sont pas intrinsèquement mauvaises. Conserver Manrope pour le seul logotype reste une option si un travail de marque le justifie.

### P2 — Les polices dépendent d’un service externe

Les vues connectées chargées pendant l’audit possèdent des faces DM Sans et Manrope avec l’état `loaded`. Certaines autres faces restent `unloaded` : elles ne sont pas nécessairement requises pour le texte affiché ; ce n’est pas une erreur de chargement.

Le CSS importe Google Fonts à distance. La configuration Workbox ne prévoit pas de précache local de ces fontes ni de stratégie spécifique pour leur fournisseur. Le cache HTTP du navigateur peut aider, mais ne constitue pas une garantie explicite du mode hors ligne. Lorsque le fournisseur est bloqué dans un contexte neuf, l’écran de connexion reste utilisable avec la police générique de repli.

**Proposition :** livrer les fichiers WOFF2 nécessaires avec la PWA, conserver leur licence, déclarer `font-display: swap` et les intégrer au précache. Tester les accents français et, si l’interface est traduite, les caractères wolof. Prévoir `system-ui, sans-serif` en repli. Aucun gain chiffré de performance n’a été mesuré dans cet audit.

### P2 — Les rôles des couleurs doivent être mieux séparés

Le vert sert à l’identité, à l’épargne, aux montants et aux confirmations. C’est cohérent avec le produit, mais il doit toujours être accompagné d’un rôle explicite. Le succès d’un versement ne doit pas changer de couleur lorsque la campagne est une tontine violette. Un état « À venir » ne devrait pas prendre la même importance visuelle qu’une confirmation « Enregistré ».

**Proposition :** quatre groupes de tokens : identité, type de campagne, état métier et surfaces. L’identité conserve son vert ; les types conservent une couleur stable ; succès/erreur/attente/hors ligne ont des couleurs indépendantes des types, avec icône et texte. Les cartes de listes restent neutres, la couleur de type est concentrée sur l’icône, le badge et l’action du contexte.

Ce constat est une amélioration de hiérarchie et de sens, pas la preuve que l’application s’appuie uniquement sur la couleur : les libellés et icônes actuels sont des points positifs.

### P3 — Les chiffres et finitions méritent une normalisation

Les montants changent de taille et d’unité selon les cartes (`F`/`FCFA`). La feuille partagée ne définit pas `font-variant-numeric: tabular-nums`. Plusieurs niveaux de contours et d’arrondis se côtoient ; l’historique membre sombre présente par exemple un panneau, des filtres et des cartes tous entourés.

**Proposition :** chiffres tabulaires sur les montants, espace insécable de groupement des milliers, unité FCFA constante dans les fiches et reçus, montants alignés à droite dans les listes. Réserver 32 px au montant principal et 20 px aux indicateurs. Un contour par groupe utile ; cartes à 16 px d’arrondi, boutons à 12 px, badges à 8 px. Ne pas supprimer les repères nécessaires aux champs de saisie.

## Charte proposée

### Palette par rôle

| Rôle        | Clair / fond plein avec texte blanc | Encre sur surface sombre | Usage                                                            |
| ----------- | ----------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Identité    | **#155D50**                         | **#8BD9BD**              | Bandeau, navigation sélectionnée, actions générales              |
| Épargne     | **#197647**                         | **#8FDFB0**              | Type épargne et action de la campagne                            |
| Tontine     | **#6D3FC0**                         | **#D0B2FF**              | Type tontine ; violet plus lumineux que l’actuel #471976         |
| Solidarité  | **#A85D12**                         | **#F3C17D**              | Type solidarité ; ambre plus distinct que le brun actuel #764019 |
| Succès      | **#16714A**                         | **#8FDFB0**              | Versement enregistré, accompagné d’une coche                     |
| Erreur      | **#B42332**                         | **#FFB3BA**              | Refus, anomalie, non-cotisation explicitement libellée           |
| Attente     | **#805400**                         | **#F3C17D**              | Brouillon, synchronisation en attente                            |
| Information | **#175CD3**                         | **#A9C7FF**              | Information, reprise de connexion                                |

En sombre, garder les fonds pleins des boutons suffisamment foncés pour recevoir du blanc ; employer les encres claires pour les textes et pictogrammes. Ne pas réutiliser une encre claire comme fond de bouton avec du texte blanc.

| Surface ou texte   | Clair   | Sombre  |
| ------------------ | ------- | ------- |
| Fond de page       | #F6F8F7 | #101A16 |
| Carte              | #FFFFFF | #182620 |
| Surface secondaire | #EDF3EF | #21362C |
| Texte principal    | #182B25 | #EFF6F1 |
| Texte secondaire   | #53665D | #B8CBC0 |
| Contour décoratif  | #D7E2DB | #3C5347 |

Les contours décoratifs ne sont pas destinés à identifier seuls un champ, une sélection ou un focus. Prévoir pour ces cas une bordure ou un indicateur renforcé, vérifié à 3:1 sur le fond adjacent.

### Contrastes calculés de quelques paires proposées

| Texte / fond                                | Ratio approximatif |
| ------------------------------------------- | ------------------ |
| Blanc / identité #155D50                    | 7,74:1             |
| Blanc / épargne #197647                     | 5,64:1             |
| Blanc / tontine #6D3FC0                     | 6,73:1             |
| Blanc / solidarité #A85D12                  | 4,95:1             |
| Texte secondaire #53665D / blanc            | 6,13:1             |
| Texte principal #182B25 / fond #F6F8F7      | 13,95:1            |
| Texte secondaire #B8CBC0 / carte #182620    | 9,23:1             |
| Navigation active #8BD9BD / surface #21362C | 7,83:1             |

Ratios calculés sur aplats opaques, arrondis pour présentation. Ils ne qualifient pas les états survol/focus, les dégradés, ni toutes les compositions possibles.

### Typographie

| Élément                        | Taille cible      | Graisse   | Interligne |
| ------------------------------ | ----------------- | --------- | ---------- |
| Titre de page                  | 24 px / 1,5 rem   | 700       | 1,25       |
| Titre de section               | 20 px / 1,25 rem  | 700       | 1,35       |
| Corps, champs, actions         | 16 px / 1 rem     | 400 / 600 | 1,5        |
| Texte secondaire, date         | 14 px / 0,875 rem | 400 / 500 | 1,45       |
| Navigation, badge, note courte | 12 px / 0,75 rem  | 500 / 600 | 1,4        |
| Montant principal              | 32 px / 2 rem     | 700       | 1,15       |
| Indicateur secondaire          | 20 px / 1,25 rem  | 700       | 1,25       |

Limiter le gras aux noms, montants, titres et actions. Éviter les longues phrases tout en gras et les capitales sur les intitulés. Utiliser des tokens en `rem` avec adaptation des contenus, plutôt que des hauteurs fixes qui coupent le texte agrandi. Le pavé du code secret peut garder ses chiffres à 30–32 px ; les caractères d’un code et les références restent des cas fonctionnels distincts.

### Personnalisation conservée

- Le Super Admin définit la palette commune ; l’admin du groupement garde son adaptation conformément aux droits existants.
- La préférence clair/sombre reste personnelle à l’appareil.
- La couleur choisie est une base : dériver séparément fond plein, encre et teinte pour chaque thème.
- Contrôler le contraste de chaque paire réellement utilisée avant enregistrement et dans l’aperçu.
- Avertir si deux types deviennent visuellement trop proches ; conserver toujours leur icône et leur nom.
- Ne pas permettre qu’une personnalisation masque les alertes, le focus ou le QR. Les états d’erreur/succès gardent leurs règles communes.

## Plan d’application recommandé

| Lot             | Réalisation                                                                                             | Critère de réception                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 — Lisibilité  | Contraste navigation sombre, textes utiles 14/16 px, navigation 12 px, variantes actif/inactif          | Paires réelles ≥4,5:1 pour petit texte ; aucune action masquée à 360/390/430 px               |
| 2 — Typographie | Police unique auto-hébergée, tokens de tailles/graisses, chiffres tabulaires et unités                  | Police disponible hors ligne après installation ; pas de faux gras attendu ; accents corrects |
| 3 — Composants  | Identité, cartes séance/tour/campagne, historique, filtres, boutons, formulaires et reçus               | Même fonction = mêmes dimensions, hiérarchie et états dans les deux profils                   |
| 4 — Palette     | Nouveaux tons proposés, séparation type/état, validation des personnalisations                          | Aperçus clair/sombre et composants vérifiés sur palettes claire, sombre et saturée            |
| 5 — Validation  | Tests visuels Chromium/WebKit, texte agrandi, hors ligne, téléphones réels et essais avec utilisatrices | Montants, campagne choisie, état et action compris sans aide ; aucune régression métier       |

La première étape peut corriger le contraste sans attendre l’adoption de la nouvelle palette. La proposition graphique ne change aucune règle d’encaissement, de tirage, d’authentification ou de synchronisation. Une version de livraison sera choisie lors de l’implémentation ; cet audit ne modifie pas la version 0.24.0.

## Références et limites

- [W3C — Contraste du texte, 1.4.3](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum) : petit texte 4,5:1, grand texte 3:1, avec exceptions, notamment les contrôles inactifs.
- [W3C — Contraste non textuel, 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) : indicateurs nécessaires à l’identification des composants et états, 3:1 sur les couleurs adjacentes ; tous les contours décoratifs ne sont pas concernés.
- [W3C — Utilisation de la couleur, 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) : ajouter texte, forme ou autre indice visible lorsque la couleur transmet une information.
- [W3C — Agrandissement du texte, 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) : tester jusqu’à 200 % sans perte de contenu ou de fonction.

Les critères cités orientent les corrections. Les tailles recommandées, le choix d’une police unique et les teintes de la proposition sont des décisions de design, à valider avec les utilisatrices. Aucun score subjectif ni résultat d’essai utilisateur non réalisé n’est présenté comme une mesure.
