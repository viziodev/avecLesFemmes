# ADR 020 — Charte graphique PWA et polices locales

Statut : appliqué en local en 0.25.0, le 23 octobre 2026.

## Décision

Appliquer les corrections de l’[audit graphique](../audits/pwa-mobile-2026-10-23/charte-graphique/AUDIT-CHARTE.md) aux deux profils PWA en conservant la structure « Action du jour ». La charte est isolée dans `packages/ui/src/pwa-charter.css`, chargée uniquement par la PWA. Les composants et règles métier sont partagés ; le Super Admin conserve sa mise en page et ses titres Manrope.

- DM Sans variable 400–700 : texte et saisie 16 px, secondaire 14 px, navigation et notes courtes 12 px, titres 20/24 px, montant principal 32 px. Tokens en rem, lignes extensibles et chiffres tabulaires.
- Polices WOFF2 latin et latin étendu intégrées au projet, avec leurs licences SIL OFL. Aucun import Google Fonts dans les interfaces applicatives. Les assets à empreinte sont précachés par Workbox. Manrope est conservée localement pour le Super Admin.
- Surfaces claires et sombres, contours, cartes de 16 px et boutons de 12 px. QR noir/blanc inchangé. Les états d’opération utilisent une icône et un libellé, avec une palette sémantique indépendante de celle de la campagne.
- Vert identitaire #155D50 et épargne #197647 conservés ; nouveaux défauts tontine #6D3FC0 et solidarité #A85D12. Les rôles d’édition de palette définis aux ADR 015 et 017 restent identiques.

## Contraste et personnalisation

Une couleur de base produit trois variantes : fond plein recevant du blanc, encre sur surface et teinte de fond. Le générateur vérifie une marge de 4,6:1 sur chaque surface réceptrice prévue, dont les cartes, le fond de page et la navigation sélectionnée. Celle-ci possède une paire de tokens dédiée. Les fonds des états succès/erreur/attente restent indépendants des types.

Le paramétrage conserve les valeurs choisies et affiche un avertissement si les couleurs de deux types sont très proches. Cette détection par distance RGB est une aide à la distinction, pas une simulation du daltonisme. Les icônes et noms restent nécessaires. La dérivation ne constitue pas une certification de conformité de l’ensemble de l’application.

## Données et compatibilité

La migration **014** remplace la palette plateforme uniquement lorsque ses quatre valeurs correspondent encore exactement aux anciens défauts. Toutes les palettes propres aux groupements et les palettes plateforme personnalisées sont préservées. Les migrations déjà appliquées ne sont pas modifiées. La nouvelle charte est dans les images et le service worker ; aucune modification du contrat métier ou des règles d’encaissement n’est nécessaire.

## Validation

Tests des deux profils sur Chromium et WebKit, contrastes calculés et rendus, palettes extrêmes, tailles 360/390/430 px, texte agrandi à 200 %, service worker réel hors ligne et caractères français/wolof. Tests API de migration avec conservation des personnalisations. Captures et résultats détaillés dans [VALIDATION](../VALIDATION.md).

Les essais auprès des utilisatrices, les téléphones physiques et l’ensemble des combinaisons de personnalisation restent à qualifier. Déploiement distant selon ADR 014 et sur instruction VIZIODEPLOIE ; cette livraison est locale.
