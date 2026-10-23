# Polices embarquées

Fichiers WOFF2 variables téléchargés depuis les réponses officielles Google Fonts le 23 octobre 2026, sous SIL Open Font License 1.1. Les notices complètes sont conservées dans `DM-Sans-OFL.txt` et `Manrope-OFL.txt`.

- DM Sans : 400–700, latin et latin étendu, utilisé dans toute la PWA.
- Manrope : 400–800, latin et latin étendu, conservé pour les titres du Super Admin.
- La plage étendue couvre notamment ŋ, Ŋ, ñ, Ñ ; les caractères français et les espaces insécables des montants sont inclus.
- `fonts.css` déclare les sous-ensembles et `font-display: swap`. Vite produit des URLs d’assets locales avec empreinte ; Workbox précache les WOFF2 pour les démarrages hors ligne après installation.

Sources : [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans), [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope). Les fichiers sont embarqués : aucune dépendance réseau à ces fournisseurs au démarrage de l’application.
