# Recette de la synchronisation hors ligne dans l’interface

23 octobre 2026. PWA locale `http://localhost:8086/`, API réelle et PostgreSQL 18 du Docker Compose. Compte membre fictif et groupement « Recette UI Synchronisation », trois campagnes d’épargne dédiées avec séance du jour ouverte. Aucun versement réel et aucune modification des campagnes existantes.

Les interactions ont été effectuées dans le navigateur : navigation, saisie, confirmation, code secret, file d’attente et reçu. Les endpoints métier n’étaient pas simulés. Les données initiales ont été préparées directement dans la base locale ; les trois versements ont été saisis dans l’interface.

| Contrôle                                    | Résultat observé                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Saisie pendant l’indisponibilité du service | Confirmation par mot de passe initial, brouillon conservé dans la file ; montant collecté inchangé.                                                                                                                              |
| Mode automatique                            | Après rétablissement du service et détection par la PWA ouverte, notification « 1 saisie(s) synchronisée(s) automatiquement », file vide, 1 000 FCFA collectés et état « Déjà versé ». Aucun nouveau code demandé pour le rejeu. |
| Mode manuel                                 | Option automatique décochée ; au retour du service, saisie toujours en attente et aucun versement en base pour cette campagne. « Synchroniser cette saisie » demande le code secret ; après validation, reçu et file vide.       |
| Réouverture                                 | Code secret demandé, mode manuel conservé après ouverture d’un autre onglet.                                                                                                                                                     |
| Refus métier                                | Campagne fictive désactivée après préparation hors ligne. Rejeu manuel refusé : « Campagne désactivée. La saisie est conservée ; sa date et son montant ne sont pas modifiés. » Aucun versement pour cette campagne en base.     |
| Reprise après refus                         | Après réactivation de la campagne fictive, même brouillon local `4dd71775` confirmé par code ; reçu émis et file vidée.                                                                                                          |
| Verrouillage                                | Écran « Votre espace est verrouillé après 5 minutes d’inactivité » observé ; déverrouillage par code et brouillon toujours disponible.                                                                                           |
| Préférence restaurée                        | Synchronisation automatique réactivée. La saisie créée en mode manuel est restée à confirmer manuellement, sans autorisation automatique rétroactive.                                                                            |

## Preuves

- [Brouillon hors ligne](01-saisie-hors-ligne.png).
- [Résultat automatique](02-synchronisation-automatique.png).
- [Choix manuel](03-mode-manuel.png) et [confirmation par code](04-confirmation-code-secret.png).
- [Reçu manuel](05-recu-manuel.png).
- [Refus serveur conservé](06-refus-serveur.png) et [reçu après reprise](07-reprise-apres-refus.png).
- [Bandeau corrigé et historique consultable hors ligne en 0.27.1](08-bandeau-corrige-0271.png).

Rapprochement final PostgreSQL : **un versement de 1 000 FCFA dans chacune des trois campagnes**, trois références idempotentes distinctes, total **3 000 FCFA**. Aucun doublon observé. L’historique de la PWA affiche ces trois versements après mise à jour puis pendant une nouvelle coupure du service.

## Correction issue du test

Le bandeau partagé annonçait encore « Aucun envoi automatique » alors que l’envoi automatique était actif. Version **0.27.1** : le texte renvoie maintenant au mode choisi dans « Saisies en attente ». Les contrôles de type, de version et les 13 tests de version/livraison/mise à jour/fiabilité passent. Le protocole et les contrôles métier ne changent pas par rapport à 0.27.0.

## Portée et limites

- Coupure de l’API locale pour le premier scénario ; coupure du serveur PWA local, page déjà ouverte, pour les suivants. Il s’agit d’une indisponibilité réseau réelle vers le service, sans désactiver la connexion de l’ordinateur. Le retour est détecté par la sonde de connexion de la PWA.
- Cette recette interactive vérifie le profil membre et le parcours épargne. Les scénarios mobiles automatisés Chromium/WebKit et les tests API de 0.27.0 couvrent séparément le rejeu signé, la perte d’accusé de réception, les refus automatiques et l’idempotence. Cette recette ne constitue pas un test interactif des encaissements administrateur ni des tontines.
- Synchronisation dans une PWA ouverte et déverrouillée ; aucun test d’envoi depuis une application fermée, aucun test sur téléphone physique ni sur Render/Neon.
- Les données fictives sont conservées localement pour inspection. La campagne de test désactivée a été réactivée ; les services sont remis en fonctionnement à la fin de la recette.
