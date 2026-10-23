# ADR 023 — Rencontres mensuelles par jour de semaine

Statut : adopté le 23 octobre 2026 pour le jeu local de Nguith ; produit 0.28.0.

Les campagnes peuvent se réunir le premier dimanche du mois. Une fréquence de quatre semaines ne représente pas un mois civil et ne doit pas servir d’approximation.

Migration additive immuable 017 : `campaigns.monthly_week`, nullable, compris entre 1 et 4 et autorisé seulement avec `rotation_interval=MONTHLY`. Le champ REST optionnel est `monthlyWeek` et `weekday` désigne le jour de semaine (0 = dimanche). Une épargne mensuelle sans rang explicite utilise le premier jour de semaine choisi. Une tontine historique mensuelle sans rang conserve sa date fixe.

Un calcul UTC commun choisit le rendez-vous du mois, puis le premier rendez-vous à partir de la date de début. Dakar utilise UTC. Les séances d’épargne, les périodes/tirages de tontine, les cotisations et les historiques membre/admin utilisent ce même calendrier. Les rencontres hors période sont refusées ; le changement n’ouvre aucune séance ni aucun tour par anticipation. Une durée de dix mois contient dix rendez-vous mensuels ; pour Sokorou Kor, du 1er novembre 2026 au 31 août 2027 inclus.

Les quatre premiers rangs garantissent un rendez-vous dans chaque mois ; un cinquième jour de semaine n’est pas proposé. Les campagnes hebdomadaires et les anciens tours déjà enregistrés restent inchangés.

Le script `scripts/demo/nguith.mjs --reset-local` cible uniquement PostgreSQL Compose sur loopback:5433, réalise un `pg_dump` privé avant suppression et remplace les données métier dans une transaction. Les Super Admin et catalogues sont conservés. Les secrets viennent du fichier local ignoré `.env.nguith`. Aucun changement de politique d’authentification : mot de passe initial de 12 caractères minimum et PIN numérique distinct. Aucun déploiement ni accès à Neon.
