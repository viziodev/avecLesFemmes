# ADR 022 — Synchronisation automatique des saisies hors ligne

Statut : demande utilisateur du 23 octobre 2026, produit 0.27.0. Complète les ADR 018 et 021 ; remplace leur obligation de synchronisation exclusivement manuelle.

## Expérience

Les nouvelles saisies confirmées hors ligne sont synchronisées automatiquement lorsque la connexion revient, dans une PWA ouverte, visible et déverrouillée. Le mode automatique est activé par défaut. Dans « Saisies en attente », l’utilisatrice peut choisir la synchronisation manuelle ; le choix est conservé dans son coffre chiffré. Le bouton « Synchroniser cette saisie » reste disponible avec confirmation par code secret en ligne, ou mot de passe pour les anciens comptes sans code.

La confirmation hors ligne reste protégée par le mot de passe initial. Elle autorise la saisie exacte qui sera envoyée. Aucun mot de passe ni code secret n’est conservé pour réauthentifier un traitement automatique. L’application fermée ou verrouillée ne synchronise pas ; aucune clé n’est remise au service worker.

Les anciens brouillons dépourvus d’autorisation signée restent à synchroniser manuellement. Ils ne sont ni supprimés ni autorisés silencieusement lors d’une mise à jour ou d’un changement de mode. Le mode manuel reste donc compatible avec les anciennes PWA et les coffres migrés.

## Autorisation limitée et protocole

Après authentification réussie par mot de passe initial ou code sur appareil autorisé, le serveur fournit `X-ALF-Sync-Key`. C’est une clé de signature HMAC-SHA256 dérivée, avec séparation de domaine `alf:offline-signing:v1`, de la clé propre à l’appareil déjà conservée côté serveur. Elle ne permet pas de déchiffrer le coffre. La clé de signature est enregistrée **uniquement à l’intérieur du coffre AES-GCM**, protégé hors ligne par le mot de passe initial. La clé d’enveloppement du coffre, le mot de passe et le code ne sont pas enregistrés en clair dans le navigateur.

Après validation du mot de passe hors ligne, une saisie destinée au mode automatique reçoit une autorisation HMAC portant sur le tableau JSON `["alf:offline:v1", login, path, payload]`. `payload` est la chaîne JSON exacte du corps confirmé : référence idempotente, montant, date et, pour l’encaissement administratrice, participation. Le chemin inclut le groupement, la campagne et le mode personnel ou administratrice. Une modification d’un de ces éléments invalide la signature.

L’envoi utilise `POST /api/v1/auth/offline-replay`. Le serveur exige simultanément : origine/CSRF valide, preuve d’appareil HttpOnly valide et non expirée, même compte actif non bloqué et signature de la saisie. Il n’utilise pas la session de cinq minutes comme autorisation du rejeu : celle-ci peut avoir expiré pendant la coupure. Il ne crée ni ne prolonge de session générale ; après synchronisation, les lectures peuvent demander un nouveau déverrouillage normal.

Seuls les chemins de création de cotisation et de versement personnel sont acceptés. Le JSON signé est soumis aux mêmes DTO stricts que les routes habituelles ; la date originale est obligatoire. Le traitement appelle le même service métier et les mêmes transactions RLS. Droits, participation, blocage, campagne active, séance/tour, date et unicité restent contrôlés. Cette autorisation ne permet ni changement de rôle/couleur, ni annulation, ni création de campagne.

La clé est une capacité déléguée au client déverrouillé pour signer des paiements. Elle ne constitue pas une preuve matérielle de geste utilisateur à chaque signature. Son exploitation suppose aussi la preuve d’appareil et reste limitée aux droits courants et aux écritures de cotisation. Le contrôle du navigateur ou une injection dans l’origine demeure hors de la garantie du coffre ; les protections CSP, la révocation et la sécurité du terminal restent nécessaires.

## Reprise et erreurs

Les saisies sont envoyées successivement. Un verrou en mémoire empêche les envois manuel et automatique simultanés ; l’onglet actif est déjà protégé par le verrouillage inter-onglets. Une confirmation ou un formulaire ouvert diffère le traitement automatique ; il reprend après fermeture. La synchronisation ne prolonge pas artificiellement l’inactivité de cinq minutes.

La référence idempotente et le corps original sont conservés à chaque réessai. Une réponse perdue après validation peut être rejouée sans double comptabilisation. Une saisie ne quitte le coffre qu’après un acquittement serveur valide. Les soldes en cache sont invalidés après succès et relus avec une session valable ; une saisie locale n’est jamais ajoutée arbitrairement au solde.

Une coupure, un 5xx ou un 429 provoque un réessai différé d’au moins 30 secondes, après vérification de disponibilité du service. Les refus métier ou d’autorisation restent visibles, marqués à vérifier et exclus des tentatives automatiques suivantes. La date et le montant ne sont pas déplacés pour rendre l’opération acceptable. L’utilisatrice peut les examiner, confirmer manuellement avec son code ou abandonner le brouillon local.

Une révocation d’appareil, un changement de code ou l’expiration de la preuve invalide aussi les autorisations associées. Les brouillons restent conservés et nécessitent une confirmation manuelle avec un appareil à nouveau autorisé. Le succès automatique est annoncé par un bilan ; les références enregistrées restent accessibles dans l’historique.

## Livraison et validation

Version commune 0.27.0, endpoint additif dans `/api/v1`, aucune nouvelle migration nécessaire : les appareils de la migration 015 fournissent la matière cryptographique. Les migrations 001–016 restent immuables. Local : Docker Compose/PostgreSQL ; recette : Render gratuit/Neon ; production : Dokploy/Neon dédiée. Pas de déploiement distant dans cette tâche.

Contrôles : falsification du montant/chemin, preuve d’appareil manquante ou révoquée, DTO stricts, droits/RLS, date obligatoire, rejeu idempotent sans session générale ; parcours mobiles de reconnexion, refus conservé, retour manuel, réponse perdue et verrouillage. Les résultats exécutés sont consignés dans `docs/VALIDATION.md`.
