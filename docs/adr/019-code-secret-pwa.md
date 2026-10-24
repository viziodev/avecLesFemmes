# ADR 019 — Code secret numérique pour la PWA

> Décision historique 0.24.0 : récupération administrative, absence de preuve serveur d’appareil et coffre PIN remplacés par [ADR 021](021-durcissement-authentification-pwa.md) en 0.26.0. Lire cette décision pour le comportement actuel.

Statut : choix utilisateur confirmé le 23 octobre 2026, implémentation locale 0.24.0. Remplace le choix du mot de passe habituel pour l’interface PWA dans l’ADR 016 et complète l’ADR 018.

## Parcours

Le premier accès sur un appareil demande identifiant et mot de passe initial. Si aucun code n’est configuré, l’utilisatrice choisit quatre chiffres puis les confirme. Si un code existe déjà, elle le saisit après cette première authentification. Les ouvertures suivantes ne demandent que le code ; le compte peut être changé ou oublié. Les quatre pastilles, le pavé tactile et l’effacement suivent l’exemple fourni, avec la marque et les couleurs d’AvecLesFemmes. Le clavier physique reste utilisable. La validation intervient au quatrième chiffre.

Le code sert aussi aux confirmations sensibles, à l’abandon d’un brouillon local et à sa synchronisation. Le passage en arrière-plan et cinq minutes sans activité verrouillent toujours l’espace. Les écrans utilisent la même saisie en clair et sombre.

## Serveur

Migration 013 : `secret_code_hash`, indépendant de `password_hash`. Les deux secrets utilisent scrypt avec sel aléatoire. `POST /auth/secret-code` exige une session et le mot de passe initial valide ; cette configuration révoque les sessions précédentes et renouvelle le cookie. `POST /auth/login/secret-code` vérifie identifiant et code. Les deux endpoints sont protégés contre CSRF et limités en fréquence.

Les opérations PWA utilisent `X-Confirm-Secret-Code`, transmis sous HTTPS sans journalisation des en-têtes d’authentification et contrôlé côté serveur, avec le même compteur de cinq échecs et blocage de quinze minutes que l’authentification. Le mot de passe initial permet « Code secret oublié ? », puis le choix d’un nouveau code. L’ancien accès par mot de passe et son en-tête restent compatibles pour les anciens clients. Le Super Admin web conserve son mot de passe et n’utilise pas ce code.

La réinitialisation administrative de PIN existante initialise aussi le code secret et révoque les sessions du compte. Cette ancienne action remplace également le mot de passe, conformément à son fonctionnement antérieur ; elle doit rester un recours administré. La récupération autonome par mot de passe initial est préférable lorsqu’il est connu.

## Hors ligne

Le code court n’est pas utilisé seul comme clé de chiffrement. Un secret HMAC non exportable, enregistré comme `CryptoKey` dans IndexedDB, contribue à dériver la clé de protection du code. Le coffre v2 contient une clé de données AES-GCM aléatoire, protégée par cette dérivation et, lors de la configuration sur l’appareil, par une seconde protection issue du mot de passe initial. Le contenu est chiffré avec un IV aléatoire à chaque écriture. Aucune valeur de code ou de mot de passe n’est enregistrée en clair.

Les anciens coffres v1 restent lisibles avec leur mot de passe. La conversion et la récupération réécrivent le coffre seulement après chiffrement complet ; une erreur conserve les données précédentes et signale l’indisponibilité hors ligne. Un changement de code via le mot de passe récupère les données et conserve les saisies en attente. La synchronisation envoie le code pour réauthentification, puis rejoue la même date, le même montant et la même clé d’idempotence.

Cinq erreurs de déverrouillage hors ligne déclenchent un délai local de quinze minutes, persistant après fermeture. Une authentification réussie en ligne peut rétablir cet accès local. Ce délai client n’est pas une protection serveur ; l’accès au profil navigateur complet ou une injection de code dans l’origine sortent du périmètre de cette protection locale. Le contrôle serveur reste requis avant toute comptabilisation. La perte de la clé d’appareil exige le mot de passe initial et une connexion pour récupérer le coffre lorsque la protection de récupération existe. Aucun stockage local n’est effacé automatiquement.

## Livraison

Produit 0.24.0, contrat `/api/v1` additif, migration immuable et construction Docker. Local : PostgreSQL Compose. Recette : Render gratuit + Neon ; production : Dokploy + Neon dédiée. Aucun déploiement distant sans l’autorisation `VIZIODEPLOIE` de cette version.
