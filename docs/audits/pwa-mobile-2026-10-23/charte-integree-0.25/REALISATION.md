# Charte graphique intégrée — 0.25.0

Les corrections de l’audit du 23 octobre sont appliquées aux interfaces de la PWA locale, membre et admin groupement, en conservant les droits, les données et les parcours métier.

## Changements

- DM Sans unifiée, tailles et graisses par rôle ; formulaires 16 px, secondaire 14 px et navigation 12 px.
- Polices locales avec licences ; précache des WOFF2 latin et latin étendu. Les caractères français et wolof ne dépendent plus de Google Fonts.
- Contraste de la navigation sombre corrigé ; le générateur contrôle chaque surface réceptrice connue.
- Palette proposée : identité et épargne conservées, nouveaux défauts violet tontine et ambre solidarité ; personnalisation et héritage conservés.
- Cartes, filtres, boutons, champs, montants et reçus harmonisés ; FCFA et chiffres tabulaires ; états avec icône et texte.
- Migration 014 limitée à l’ancienne palette par défaut, sans modification des palettes des groupements.

## Éléments de preuve

Validation finale : **104 tests mobiles et 42 tests API réussis**, deux navigateurs, quatre tests SemVer et cinq scénarios de collecte des mesures/captures. La navigation active sombre mesurée passe de 4,42:1 à 8,95:1 ; aucun écart n’est relevé dans les textes contrôlés des douze vues. Le chargement des fontes locales et des caractères étendus a été vérifié hors ligne après installation du service worker.

Les captures et mesures sont celles de l’application locale, avec les comptes de démonstration existants, sans écriture métier pendant l’audit. Les vues responsables et membres, claires et sombres, se trouvent dans ce dossier. Le dossier `../charte-graphique` conserve les captures **avant** correction et la maquette de proposition.

Les résultats finaux de qualification sont consignés dans [VALIDATION](../../../VALIDATION.md). La validation automatisée et les captures ne remplacent pas les essais d’usage sur téléphones physiques.
