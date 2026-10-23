# ADR 018 — Consultation et saisies hors ligne chiffrées

Statut : les deux usages sont demandés par l’utilisateur le 22 octobre 2026, appliqués en local en 0.22.0.

## Données et déverrouillage

Le service worker conserve la structure et les ressources de la PWA. Il continue à traiter les API en NetworkOnly : aucune réponse métier n’est placée en clair dans Cache Storage. Après une première connexion en ligne, le client conserve les réponses consultées dans un coffre local chiffré AES-GCM 256 bits. La clé non extractible est dérivée du mot de passe avec PBKDF2 SHA-256, 310 000 itérations et un sel aléatoire propre au coffre. Chaque écriture utilise un nouvel IV aléatoire de 96 bits.

Le coffre est séparé par compte, contient l’identité vérifiée en ligne, les dernières réponses consultées et les saisies en attente. Les mots de passe, jetons de session et en-têtes de confirmation n’y sont jamais enregistrés. La clé reste en mémoire seulement pendant la visite déverrouillée. Un verrouillage ferme le coffre et masque les données ; une nouvelle ouverture exige à nouveau le mot de passe, y compris hors ligne. Une ouverture dans un autre onglet verrouille le précédent. Les requêtes tardives de l’ancienne visite ne sont pas transférées au coffre d’un autre compte.

Les réponses sont limitées à 200 Ko, 60 entrées et environ 2,5 Mo de données consultées. Le coffre est borné à 3 Mo avant chiffrement et à 100 saisies en attente. Le navigateur peut refuser le stockage ; dans ce cas l’utilisation en ligne reste possible avec un message indiquant l’indisponibilité du hors ligne. Les données jamais consultées en ligne ne sont pas inventées : leur écran indique qu’elles ne sont pas disponibles hors ligne.

## Saisies et synchronisation

Seuls les encaissements et versements de cotisation peuvent être conservés hors ligne. Le formulaire s’appuie sur les campagnes, séances, tours et membres déjà chargés. Il conserve la date, le montant, la participation et la clé d’idempotence d’origine. Le mot de passe doit être confirmé avant de conserver la saisie. Le client renvoie un état « en attente » ; il n’affiche ni reçu serveur ni augmentation de solde, et ne prononce aucune confirmation de paiement.

Le panneau **Saisies en attente → Synchronisation** permet de revoir chaque saisie et de la synchroniser. Aucun versement n’est envoyé automatiquement au retour du réseau. Une coupure de transport ou une réponse 5xx incertaine conserve la saisie avec sa référence ; le bouton « Réessayer la connexion » et une sonde de santé toutes les trente secondes permettent de retrouver le serveur sans prolonger artificiellement l’activité de la session. Une nouvelle confirmation du mot de passe réauthentifie le compte en ligne ; le serveur vérifie les droits actuels, la période, la séance ou le tour, les règles de montant et l’unicité. La même clé d’idempotence est conservée, y compris si le réseau coupe après un enregistrement serveur. La saisie n’est retirée de la file qu’après réception d’un versement valide avec identifiant et référence.

Un refus ou une réponse incertaine conserve la saisie et son motif. L’action « Abandonner cette saisie locale » exige le mot de passe et précise qu’elle ne supprime aucun versement déjà enregistré sur le serveur ; vérifier l’historique en cas de réponse incertaine. La date et le montant ne sont jamais modifiés pour obtenir une acceptation. L’encaissement d’épargne reste limité au jour de la séance : une synchronisation tardive peut être refusée. Les versements personnels transmettent aussi la date choisie pour éviter qu’une reprise soit attribuée à une nouvelle séance ou à un nouveau tour.

Les ouvertures de séance, tirages, reversements, annulations, modifications de membres et réglages exigent une connexion ; ils ne sont pas mis en file. La résolution d’un QR membre exige la validation en ligne ; la saisie manuelle peut utiliser les participantes déjà consultées.

## Limites pratiques

Hors ligne, le serveur ne peut pas communiquer une révocation récente de droits : seules les anciennes données déjà reçues sont consultables, sous avertissement, et aucun versement n’est comptabilisé avant la validation serveur. Effacer les données du navigateur supprime aussi les saisies locales. Un changement de mot de passe ne permet pas de déchiffrer l’ancien coffre : il est conservé sans écrasement et un message demande de traiter les anciennes données avant suppression. Synchroniser les saisies avant de changer le mot de passe ou de vider les données du site.

L’émulation couvre le chiffrement, le mauvais mot de passe, le stockage bloqué, les refus de synchronisation, la conservation de la clé d’idempotence et la réouverture hors ligne avec le service worker réel. Les appareils physiques et les interruptions du processus mobile restent à qualifier.
