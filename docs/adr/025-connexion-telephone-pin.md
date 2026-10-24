# ADR 025 — Téléphone et PIN personnel pour la PWA

Statut : adopté, produit 1.1.0, 24 octobre 2026. Modifie les ADR 021 et 024 sur la première connexion et l’attribution du PIN.

## Décision

À la demande de la maîtrise d’ouvrage, la première connexion d’une membre ou d’une administratrice de groupement comporte deux écrans : téléphone personnel, puis PIN existant à quatre chiffres. Le téléphone est normalisé : neuf chiffres sénégalais deviennent `+221…`, les numéros internationaux conservent leur indicatif. Aucun appel d’identification ni nom de titulaire n’est retourné à l’étape téléphone seule. Le serveur vérifie téléphone et PIN ensemble via `POST /api/v1/auth/login/phone-pin`.

Après authentification, l’application mémorise uniquement l’identifiant interne, le téléphone, le nom et l’existence du PIN. Aux ouvertures suivantes, elle demande uniquement le PIN. Le verrouillage à l’ouverture, au passage en arrière-plan et après cinq minutes d’inactivité reste appliqué. Les opérations sensibles continuent d’exiger une confirmation côté serveur.

Le Super Admin conserve sa connexion web par identifiant et mot de passe. Il peut préparer ou remplacer un PIN personnel depuis la fiche membre, après vérification de la demande. Cette action révoque les sessions et appareils du compte et est auditée sans enregistrer le PIN en clair. Une administratrice ne peut pas attribuer ou remplacer le PIN global d’une autre personne. La modification du téléphone de connexion d’un compte existant est également réservée au Super Admin ; elle met à jour ses adhésions et révoque ses accès actifs. Le mot de passe personnel reste distinct et n’est pas remplacé par le PIN.

## Conséquence de sécurité acceptée

La première connexion téléphone/PIN est une authentification à un seul facteur : le téléphone est un identifiant, pas une preuve de possession. Un code de quatre chiffres offre moins de résistance qu’un mot de passe long associé à un appareil préalablement autorisé. Cette décision remplace explicitement l’obligation d’enrôlement initial par mot de passe de l’ADR 021. Elle ne fournit ni vérification SMS ni second facteur. Le compteur transactionnel commun bloque le compte quinze minutes après cinq erreurs ; les quotas de connexion s’appliquent aussi au nouveau parcours et normalisent les variantes du téléphone.

Une session réussie délivre la preuve d’appareil et les clés nécessaires au coffre et au rejeu signé. Les anciennes routes `login/pin` et `login/secret-code` restent liées à leur preuve d’appareil pour les clients historiques. Leurs tests ne doivent pas être interprétés comme interdisant le nouveau parcours téléphone/PIN sur un appareil neuf.

## Hors ligne

Le PIN ne chiffre et ne déchiffre jamais le coffre. Une connexion en ligne peut créer un cache chiffré par clé aléatoire enveloppée par la clé serveur de l’appareil, sans demander le mot de passe personnel. L’activation volontaire de l’accès hors ligne exige ensuite ce mot de passe personnel d’au moins douze caractères, vérifié côté serveur, pour ajouter l’enveloppe de récupération PBKDF2/AES-GCM.

Une ouverture à froid hors ligne et la confirmation d’une saisie hors ligne demandent ce mot de passe personnel. Les saisies hors ligne ne sont proposées qu’après préparation du coffre. Un changement de clé d’appareil ne supprime aucun ancien coffre : sa récupération nécessite le mot de passe personnel. Les règles de synchronisation signée, de date métier et d’idempotence de l’ADR 022 restent applicables.

## Livraison et validation

Version produit 1.1.0 ; API `/api/v1` conservée, contrat OpenAPI additif, sans migration de structure. Le téléphone d’un compte déjà créé est renseigné séparément, sans réinitialisation des campagnes, mots de passe ou PIN.

Local : PostgreSQL dans Docker Compose. Recette : Render gratuit, interfaces et API dans un conteneur, Neon. Production : VPS Dokploy et base Neon dédiée. Une validation locale n’est pas un déploiement distant ; la publication attend `VIZIODEPLOIE`.

Les tests couvrent les deux profils, les numéros normalisés, le PIN incorrect, les cinq erreurs partagées, les rôles administratifs, la révocation, la conservation du mot de passe personnel, la reconnexion par PIN seul et la récupération du coffre sans perte de brouillon.
