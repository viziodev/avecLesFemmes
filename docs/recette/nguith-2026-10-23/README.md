# Jeu local — Cabalabasse des Femmes de Nguith

Initialisation effectuée le 23 octobre 2026, version **0.28.0**, PostgreSQL du Docker Compose. Anciennes données métier et anciens comptes membres remplacés après sauvegarde ; Super Admin, catalogues et configuration plateforme conservés. Aucun accès à Neon ni déploiement Render/Dokploy.

| Campagne    | Type    | Événement        | Cotisation fixe    | Rencontre                | Début      | Fin initiale |
| ----------- | ------- | ---------------- | ------------------ | ------------------------ | ---------- | ------------ |
| Avec        | Épargne | Fêtes de Tabaski | 5 000 FCFA/semaine | Dimanche                 | 25/10/2026 | 24/10/2027   |
| Sokorou Kor | Épargne | Ramadan          | 3 000 FCFA/mois    | Premier dimanche du mois | 01/11/2026 | 31/08/2027   |
| Natte-10000 | Tontine | Aucun            | 1 000 FCFA/mois    | Premier dimanche du mois | 01/11/2026 | 31/08/2027   |

Sokorou Kor : dix rencontres, les 1er novembre et 6 décembre 2026, puis les 3 janvier, 7 février, 7 mars, 4 avril, 2 mai, 6 juin, 4 juillet et 1er août 2027. La fin initiale de la tontine peut être ajustée au premier tirage selon le nombre de participantes, conformément au fonctionnement existant. Le montant de Natte-10000 est bien **1 000 FCFA**, malgré son nom.

Awa, identifiant **awa**, est administratrice du groupement, avec la fonction **Présidente** et une inscription fixe dans chacune des trois campagnes. Mot de passe initial fort et PIN fournis dans le fichier local ignoré `.env.nguith`, jamais dans ce rapport. Aucun numéro de téléphone fictif n’a été inventé ; le téléphone est laissé non renseigné, l’adresse est « Nguith ».

État final : **1 groupement, 3 campagnes, 1 membre, 3 inscriptions, 0 versement, 0 séance et 0 tour enregistré**. Les trois campagnes sont sélectionnées pour l’accueil admin et personnel ; Avec est affichée par défaut. Les boutons de séance et de tirage respectent les dates et restent désactivés avant le jour prévu.

## Vérifications

- [Rapprochement PostgreSQL](verification.json) : rôles, forfaits, événements, calendriers, absence d’anciens versements et archive de sauvegarde lisible.
- Connexion initiale réelle dans le navigateur avec le mot de passe, puis déverrouillage et réouverture avec le PIN. [Accueil](accueil.png), [Awa présidente](awa-presidente.png), [Avec](avec.png), [Sokorou Kor](sokorou-kor.png) et [Natte-10000](natte-10000.png).
- **49/49 tests API et calendrier réussis**, dont rencontres mensuelles, ouverture et cotisation, compatibilité des anciens calendriers et absence d’événement pour une tontine.
- **2/2 tests mobiles ciblés réussis**, Chromium et WebKit : formulaire mensuel, dimanche, premier rang, montant, confirmation sensible et corps envoyé à l’API simulée. Les deux types de campagne sont vérifiés dans chaque scénario.
- **13 tests de version/livraison/mise à jour/fiabilité réussis**, typecheck, cohérence des versions et `git diff --check` validés. OpenAPI/client régénérés, migration 017 appliquée, images API/web/PWA 0.28.0 reconstruites ; base et services sains.
- Les anciennes suites mobiles `campaign-enrollment` et `member-home`, tentées après la réinitialisation, dépendent encore des comptes supprimés `admin.ndeye` et `membre.awa` : ces six scénarios ne sont pas présentés comme validés sur ce jeu. Pour leur qualification, utiliser une base isolée avec le seed historique. Aucun compte supplémentaire n’a été ajouté à Nguith pour satisfaire ces anciens tests.

## Sauvegarde et réexécution

Archive privée avant suppression : `/var/folders/54/_280_x395gb1fw52d5mq1txc0000gn/T/aveclesfemmes-sauvegardes/avant-nguith-1792779882532.dump`, format pg_dump personnalisé, droits 0600. La lecture de son catalogue par pg_restore est validée ; aucun exercice de restauration complet n’est revendiqué. Ce dossier temporaire doit être copié vers un stockage privé durable si cette sauvegarde doit être conservée.

Le script `node scripts/demo/nguith.mjs --reset-local` exige `.env.nguith` (`NGUITH_PASSWORD` d’au moins 12 caractères, `NGUITH_PIN` de quatre chiffres), une base locale déjà migrée et un Super Admin actif. Il sauvegarde d’abord puis remplace les données dans une transaction, avec contrôle final des quantités. **Le relancer remplace à nouveau les données métier locales**. Mettre `DEMO_PASSWORD=` dans `.env` pour ne plus proposer les anciens comptes de démonstration, puis recréer le service API.

Voir [ADR 023](../../adr/023-calendrier-mensuel.md).
