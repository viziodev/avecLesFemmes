# Vérification effective de la recette 1.0.0

Vérifiée le **24 octobre 2026**, sur [la recette Render](https://aveclesfemmes-test.onrender.com/). Le service gratuit existant utilise le conteneur unique et la base Neon de recette ; aucun déploiement Dokploy n’a été effectué.

- [PR 5 fusionnée](https://github.com/viziodev/avecLesFemmes/pull/5), commit `3f4c9546c7dfc0d4dd167d6006bf9176d96a1664`, [tag v1.0.0](https://github.com/viziodev/avecLesFemmes/tree/v1.0.0).
- [Chaîne complète réussie](https://github.com/viziodev/avecLesFemmes/actions/runs/40095066035) : vérifications, tag, quatre images Linux amd64/arm64 et déploiement Render par digest.
- Image Render : `ghcr.io/viziodev/aveclesfemmes-render@sha256:6cc339a67fdbfe39d941986d8878d88c1c07988928fce7292dc6a3164c6c3270`.
- `/api/v1/health/live` renvoie `status=ok`, `version=1.0.0`. La CI a vérifié la disponibilité PostgreSQL et le plan Render gratuit.
- Les 17 migrations sont appliquées ; le rôle applicatif reste sans privilège Superuser ni contournement RLS.

## Remplacement demandé

Deux archives privées ont été conservées hors Git : avant migrations, puis juste avant remplacement. Les deux sauvegardes ont été restaurées dans des bases Docker isolées. La dernière contenait 1 groupement, 1 campagne, aucun versement et 17 migrations. Son empreinte SHA-256 : `6dfe7ae976ed90c71a5365cc78cd7b5930a78a4305c18a90985487850a9ce1c7`.

Le remplacement transactionnel a été validé à **13:12 UTC / Dakar**. Résultat : **1 groupement**, **3 campagnes**, **1 membre** et **0 versement**. Le Super Admin, les catalogues et la configuration plateforme sont conservés ; les anciennes données métier et les comptes non Super Admin ont été remplacés. Voir [le résultat du remplacement](nguith.json).

La connexion initiale réelle `awa`, le déverrouillage par code secret et les droits d’administratrice ont été vérifiés via HTTP puis dans Chrome. Aucun mot de passe ou code secret n’est enregistré dans cette documentation.

| Campagne    | Cotisation         | Rencontre                | Événement        |
| ----------- | ------------------ | ------------------------ | ---------------- |
| Avec        | 5 000 FCFA/semaine | Dimanche                 | Fêtes de Tabaski |
| Sokorou Kor | 3 000 FCFA/mois    | Premier dimanche du mois | Ramadan          |
| Natte-10000 | 1 000 FCFA/mois    | Premier dimanche du mois | Aucun            |

La première séance Avec peut être ouverte le **dimanche 25 octobre 2026**. Le bouton est donc désactivé le samedi 24, conformément au contrôle métier. Sokorou Kor prévoit dix rencontres de novembre 2026 à août 2027.

## Preuves d’interface

- [Accueil Nguith, trois campagnes et montants nuls](render-nguith-accueil.png).
- [Liste des trois campagnes et périodes](render-nguith-campagnes.png).
- [Awa Présidente, inscriptions et montants versés](render-nguith-awa.png).

Chrome a initialement présenté l’ancien écran issu du service worker 0.2.0. La fermeture et la réouverture de l’onglet ont activé la nouvelle PWA, sans effacer les données du navigateur. Si un ancien écran persiste sur un autre appareil, terminer les saisies en cours puis fermer et rouvrir la PWA.
