# ADR 021 — Authentification, appareils autorisés et coffre hors ligne

> En 1.1.0, [ADR 025](025-connexion-telephone-pin.md) remplace l’enrôlement initial par mot de passe par le parcours téléphone/PIN existant, autorise l’attribution du PIN par le Super Admin et rend la préparation du coffre hors ligne volontaire. Les limites de tentatives et le chiffrement hors ligne par mot de passe restent applicables.

> À partir de 1.0.1, les actions de récupération et d’oubli depuis l’interface sont réservées au parcours d’assistance Super Admin : voir [ADR 024](024-assistance-acces-pwa.md). Les anciens boutons décrits ci-dessous sont retirés de la connexion habituelle.

> La synchronisation exclusivement manuelle décrite ici est remplacée en 0.27.0 par [ADR 022](022-synchronisation-automatique.md) : rejeu signé des saisies préalablement confirmées, sans stockage du code ou du mot de passe. Les autres protections restent applicables.

Statut : correction de l’audit du 23 octobre 2026, produit 0.26.0. Remplace les décisions de récupération administrative, de connexion par code sans preuve d’appareil et de chiffrement par code de l’ADR 019. Complète les ADR 009, 013, 016 et 018.

## Appareil autorisé

Le premier accès demande un identifiant et un mot de passe initial d’au moins 12 caractères. Le serveur délivre une session de huit heures et une preuve d’appareil aléatoire de 256 bits dans un cookie `alf_device` HttpOnly, SameSite=Strict, Secure en production, limité au chemin `/api/v1/auth`. La preuve expire après 30 jours ; un accès par code ne prolonge pas son expiration. Le serveur conserve uniquement son empreinte SHA-256. L’identité mémorisée dans localStorage n’est pas une preuve d’autorisation.

La connexion par code secret, y compris l’ancienne route téléphone/PIN, exige cette preuve valide et liée au même compte. Un nouvel appareil, une preuve expirée ou révoquée exige à nouveau le mot de passe initial. L’action « Reconnecter cet appareil » conserve le code existant ; « Code secret oublié ? » permet de le remplacer après vérification du mot de passe. Le Super Admin conserve son accès web par mot de passe. La migration 016 révoque les anciennes sessions PWA, susceptibles d’avoir été ouvertes via les anciennes routes non liées à un appareil.

Le changement de code révoque toutes les sessions et tous les appareils, puis autorise à nouveau l’appareil courant. L’oubli d’appareil est confirmé par le serveur avant l’effacement de l’identité mémorisée. Une déconnexion ou un verrouillage conserve la preuve pour permettre le prochain accès par code. Cinq minutes d’inactivité et le passage en arrière-plan verrouillent l’espace.

## Récupération et mots de passe courts

Une administratrice de groupement ne peut plus modifier les secrets d’un compte global. Le Super Admin peut révoquer le code, les sessions et les appareils d’un compte non Super Admin. Cette action est auditée ; elle ne choisit aucun secret pour la titulaire et ne modifie pas son mot de passe initial. Le membre choisit ensuite lui-même son nouveau code. Le corps de l’ancienne route `reset-pin` devient vide ; un PIN fourni est refusé.

La création d’accès n’accepte plus de PIN administratif : un mot de passe initial d’au moins 12 caractères est requis. Les membres sans accès peuvent toujours être inscrits au groupement. Le serveur refuse les connexions par mot de passe initial court, afin qu’un PIN historique ne contourne pas la preuve d’appareil. Les anciens comptes dont le mot de passe initial est court nécessitent une récupération vérifiée par le Super Admin avant réactivation ; cette version ne fournit pas de récupération automatique d’un mot de passe initial perdu. Ne pas inventer une preuve d’identité à partir du téléphone déclaré ou des seules informations du groupement.

## Tentatives et disponibilité

Tous les contrôles de mot de passe/code utilisent une transaction et un verrou PostgreSQL sur le compte. Le compteur et le blocage de 15 minutes sont validés avant de retourner un refus HTTP : une exception ne doit pas annuler l’écriture du compteur. Cinq échecs sont conservés même sous concurrence. Les routes d’authentification, les confirmations sensibles et l’ancienne route PIN partagent cet état.

Le proxy Nginx remplace les en-têtes d’adresse fournis par le visiteur par l’adresse du pair qu’il observe. Express ne fait confiance qu’au premier proxy privé/loopback ; `TRUSTED_PROXY_CIDRS` permet de restreindre ces réseaux à ceux de l’installation. Aucun `trust proxy: true` global. Les quotas métier utilisent une session serveur valide et les quotas de connexion l’empreinte de l’identifiant ; des comptes distincts derrière le même ingress Render ne partagent pas un quota de 30/60 requêtes. Un plafond réseau de 3 000 requêtes par minute et route reste appliqué indépendamment. Sur Render, le pair peut être le proxy de plateforme : ce correctif ne revendique pas une identification vérifiée de l’IP publique de chaque visiteur. Sur Dokploy, maintenir l’API privée et contrôler les chemins d’accès et la liste des proxies.

Le stockage du limiteur reste en mémoire pour une instance. Avant plusieurs instances, utiliser un stockage partagé et qualifier les seuils sur le trafic réel ; les blocages de comptes restent partagés dans PostgreSQL.

## Coffre v3 et hors ligne

Le coffre n’est plus déchiffrable avec quatre chiffres et une clé utilisable depuis le profil navigateur. Il conserve une clé de données AES-GCM aléatoire, enveloppée séparément :

- par une clé aléatoire propre à l’appareil, conservée côté serveur et retournée uniquement après authentification en ligne réussie dans `X-ALF-Vault-Key` ; elle reste en mémoire côté application, jamais dans les snapshots ou l’identité ;
- par le mot de passe initial d’au moins 12 caractères, via PBKDF2-SHA256 à 310 000 itérations, pour les ouvertures et confirmations hors ligne.

La clé d’enveloppement serveur est une donnée sensible de `trusted_devices` : restreindre les accès à cette table et aux sauvegardes. Elle n’est pas chiffrée par une autre clé applicative en base ; la sécurité de Neon/PostgreSQL et des sauvegardes reste nécessaire. Les réponses d’authentification sont `no-store` et leurs en-têtes ne doivent pas être journalisés. Ne pas mettre cette clé dans un acteur sérialisé ni dans le service worker.

Les coffres v1/v2 exigent le mot de passe initial lors de la migration. Le chiffrement complet précède l’écriture ; les brouillons ne sont pas effacés en cas d’échec. Le wrapper PIN et l’ancienne clé HMAC sont supprimés après migration réussie. Les anciennes copies d’un coffre v2, faites avant la migration, ne peuvent pas être révoquées à distance ; la mise à jour doit être appliquée sur chaque appareil.

Hors ligne, on peut consulter les dernières données et préparer des saisies avec le mot de passe initial. Aucune comptabilisation automatique : la synchronisation demande le code en ligne, conserve la référence idempotente et revalide droits, date, séance/tour et unicité côté serveur. Une coupure pendant une confirmation par code ne convertit pas ce code en autorisation hors ligne : la saisie doit être vérifiée puis confirmée hors ligne par mot de passe.

## Protection du navigateur et livraison

Nginx applique une CSP sans scripts inline ni eval aux documents et actifs, `frame-ancestors 'none'`, `object-src 'none'`, nosniff, DENY, une politique de référent et des permissions limitées à la caméra du même site. Les styles inline restent autorisés pour les couleurs et composants existants. Le script de thème initial est un fichier local précaché. Les inclusions sont répétées dans les locations qui redéfinissent `add_header`, conformément au fonctionnement de Nginx. L’API ne produit plus de doublon des en-têtes gérés par le proxy.

Migrations immuables 015 et 016, version commune 0.26.0 et contrat `/api/v1` mis à jour. Les changements de sécurité refusent volontairement les anciens usages de PIN administratif et de code sur appareil non autorisé. Tests de sécurité intégrés à la CI. Local : PostgreSQL Docker Compose ; recette : Render gratuit + Neon ; production : Dokploy + Neon dédiée. Aucun déploiement distant effectué par cette correction locale.
