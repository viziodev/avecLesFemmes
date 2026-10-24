# ADR 016 — Identifiant mémorisé et mot de passe habituel

> Évolution : le 23 octobre 2026, l’utilisateur a retenu le code secret numérique pour la PWA. Voir [ADR 019](019-code-secret-pwa.md), appliqué en 0.24.0. Le présent document conserve la décision historique et les mécanismes de verrouillage.

Statut : choix du mot de passe habituel confirmé par l’utilisateur et appliqué en local, version 0.21.0, 22 octobre 2026.

La PWA demande identifiant et mot de passe lors de la première authentification sur un appareil. Une authentification réussie mémorise seulement le nom et l’identifiant du compte dans `alf:pwa:remembered-account`. Les connexions suivantes, après déconnexion ou expiration de la session, demandent le mot de passe habituel avec le clavier natif du téléphone et sa touche de validation.

Cette identité locale ne constitue aucune preuve d’authentification. Chaque connexion passe par le serveur, qui vérifie le mot de passe. Aucun mot de passe, hash ou jeton n’est conservé en localStorage. La session HttpOnly existante garde sa durée de huit heures, SameSite et Secure en production.

L’action « Changer de compte / oublier cet appareil » supprime l’identité locale et réaffiche les deux champs. Un nouveau navigateur, un appareil différent, l’effacement des données du site ou l’indisponibilité du stockage local imposent de ressaisir l’identifiant. Une donnée locale mal formée est ignorée. Un échec d’authentification ne remplace pas l’identité mémorisée.

Les anciens points d’accès PIN et SMS restent compatibles avec l’ADR 013 et les versions précédentes. Ils ne sont plus proposés dans le formulaire PWA. La connexion web Super Admin conserve son fonctionnement.

Validation : clavier Entrée, première connexion, reconnexion, expiration de session, mot de passe erroné, oubli du compte et stockage indisponible sur émulations Chromium et WebKit. Les tests avec serveur simulé désactivent le service worker pour éviter qu’il contourne l’interception réseau ; les connexions réelles de la suite mobile restent testées contre Docker avec le service worker actif.

## Évolution 0.22.0 — Verrouillage à l’ouverture et après inactivité

À la demande de l’utilisateur, l’espace membre et l’espace admin groupement demandent le mot de passe à **chaque ouverture**, même si le cookie de session reste valide. Le passage en arrière-plan, la fermeture de la page et cinq minutes d’inactivité verrouillent la PWA. Les actions de clavier, toucher, clic et défilement constituent une activité ; les actualisations automatiques n’en constituent pas.

Le serveur refuse également les sessions non Super Admin dont la dernière activité dépasse cinq minutes. Un signal d’activité issu des interactions réelles, au maximum toutes les trente secondes, prolonge la session encore valide. Une session expirée ne peut pas être réactivée par ce signal. Le verrouillage client tente de révoquer la session serveur en ligne sans effacer le cookie d’une éventuelle nouvelle connexion ; hors ligne, l’expiration serveur reste effective.

Chaque écriture métier sensible du membre ou de l’admin groupement exige le mot de passe actuel, contrôlé par le serveur. Cela couvre les cotisations, annulations, reversements, tirages, séances, adhésions, forfaits, activations et couleurs du groupement. Les raccourcis d’accueil et la résolution en lecture d’un QR restent hors de cette confirmation. Le mot de passe est transmis en HTTPS via `X-Confirm-Password`, encodé UTF-8/Base64 avec le préfixe `utf8:` ; cet encodage n’est pas un chiffrement et ne remplace jamais HTTPS. Ne pas journaliser les en-têtes d’authentification.

La PWA lie les requêtes à l’identité de la visite (`X-PWA-Actor`) pour ne pas réutiliser les données d’un autre compte connecté dans un autre espace. Un changement d’onglet actif verrouille l’ancienne visite ; les réponses tardives sont écartées. Le mot de passe habituel utilise désormais le même compteur d’échecs que les connexions PIN : cinq erreurs peuvent entraîner un blocage de quinze minutes.

L’ADR 018 précise le déverrouillage et la saisie hors ligne. Sans réseau, aucun solde serveur ne change ; les opérations en attente nécessitent une réauthentification et les contrôles du serveur avant comptabilisation.
