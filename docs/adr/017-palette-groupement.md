# ADR 017 — Personnalisation des couleurs par groupement

Statut : appliqué en local en 0.22.0, le 22 octobre 2026.

L’ADR 015 fournit les couleurs par défaut de la plateforme. L’admin d’un groupement peut définir sa propre palette, appliquée à l’espace de gestion et aux membres de ce groupement. Les modes clair/sombre restent des préférences de l’appareil.

La table `group_appearance` de la migration 012 conserve les quatre couleurs. Les membres peuvent lire uniquement les couleurs de leurs groupements. Les écritures et la suppression de la personnalisation exigent les droits d’administration du groupement, les contrôles RLS, CSRF et une confirmation du mot de passe. Elles sont auditées.

Dans **Plus → Paramètres du groupement**, les aperçus clair/sombre précèdent l’enregistrement. L’action **Utiliser les couleurs de la plateforme** supprime la personnalisation ; les prochaines modifications de la palette globale s’appliquent alors à ce groupement.

Les routes `/api/v1/groupements/{groupId}/appearance` acceptent GET, PUT et DELETE. Aucun identifiant de groupement ne permet de contourner les droits serveur. Le réglage est disponible en ligne ; les couleurs déjà chargées sont conservées dans le coffre hors ligne du compte.
