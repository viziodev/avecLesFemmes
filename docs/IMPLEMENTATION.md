# AvecLesFemmes premier incrément

## État et périmètre

Le socle commence à la version produit 0.1.0. Il couvre le web super administrateur, la PWA membre et administration, l’API NestJS et PostgreSQL. Les deux modes de connexion sont prévus : mot de passe et code téléphone. L’envoi SMS réel attend un fournisseur et son contrat d’intégration ; le mode local n’envoie aucun SMS.

## Hypothèses explicites du socle

- Devise XOF ; montants entiers strictement positifs.
- Saisie connectée uniquement. Les données API ne sont pas mises en cache par la PWA.
- Le super administrateur attribue le rôle ADMIN lorsqu’il crée une membre avec un compte.
- Une campagne inscrit explicitement ses participantes ; le forfait est facultatif. Le versement réel est saisi même en présence d’un forfait. Versements multiples et partiels permis provisoirement, à confirmer.
- Une cotisation appartient à la période de campagne et ne peut être datée dans le futur.
- Une campagne désactivée reste consultable ; inscriptions, forfaits, saisies et corrections y sont bloqués.
- Une correction annule la cotisation avec un motif ; une nouvelle cotisation doit ensuite être enregistrée. Aucun effacement d’historique.
- Les membres voient leurs versements personnels. Les administratrices voient tous les versements des groupements qui leur sont attribués.
- Tous les types créés dans ce socle utilisent le moteur Avec. Une nouvelle règle de type nécessite une implémentation dédiée.

## Séquence de réalisation

1. Socle du monorepo, compilation et contrats OpenAPI.
2. Migrations, isolation par groupement, comptes et sessions.
3. Parcours groupements et membres.
4. Campagnes, participations et cotisations idempotentes.
5. Vues personnelles, tableaux de bord et PWA.
6. Images Docker, Compose, tests métier et recette pilote.

## Avant un lancement réel

Valider les hypothèses métier, la gestion et récupération des comptes, les indicateurs, la conservation des données et le périmètre des administratrices. Choisir le prestataire SMS, le registre et la plateforme de production. Effectuer les tests de charge à 200 000 adhésions et environ 10 millions de cotisations, tester sauvegarde et restauration, et mener le pilote. La présence d’un socle compilable ne valide pas ces critères d’exploitation.
