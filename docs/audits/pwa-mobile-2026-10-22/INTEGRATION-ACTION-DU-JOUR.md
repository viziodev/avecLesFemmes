# Intégration de la proposition Action du jour — 0.20.0

La variante retenue est maintenant appliquée aux interfaces réelles de la PWA. La version 0.19.0 avait ajouté les thèmes aux écrans précédents ; 0.20.0 intègre leur nouvelle organisation.

## Deux profils, une structure commune

- Bandeau compact : groupement, nom du membre ou de la responsable, Ma carte. Le grand QR et les coordonnées sont ouverts dans une fenêtre dédiée.
- Six campagnes choisies au maximum sur deux rangées, puis Historique et Plus. Couleurs et icônes stables par type ; le nom complet est repris dans le contexte sélectionné.
- Une carte Action du jour : campagne, type, période, état, montants et action autorisée. L’état vient des règles serveur, sans simuler une ouverture ou un tirage.
- Épargne membre : cumul personnel avant l’action, puis cinq derniers versements et filtre par séance. Tontine membre : bénéficiaires servis, mois restants et versement de la période, puis tours passés avec bénéficiaire et état du reversement.
- Responsable : total disponible/collecté ou montant par membre/encaissé/reversé, ouverture de séance ou tirage avant encaissement. Le scan et la recherche de participante restent reliés aux opérations existantes.
- Cartes et formulaires cohérents dans Campagnes, Membres, Versements et Compte, en clair et sombre. Les filtres multiples de l’historique personnel restent disponibles.
- Navigation membre avec libellés visuels Accueil, Campagnes, Versements et Compte. La responsable retrouve Accueil, Campagnes, Membres et Plus sur mobile comme sur grand écran.
- Le basculement entre gestion et épargne personnelle de la responsable se trouve dans Plus ; le retour à la gestion est accessible dans son compte personnel.

## Parcours et états

Le membre saisit son montant libre ou consulte son forfait, ouvre le récapitulatif (identité, campagne, période, montant), peut modifier sa saisie puis confirme. L’envoi utilise la même clé d’idempotence lors d’une reprise ; une référence est affichée après succès. Le versement est désactivé hors connexion.

Le retour du navigateur parcourt les écrans de la PWA. Le choix de masquer les montants reste conservé après rechargement. Après une erreur de pagination, Voir plus est désactivé jusqu’à une nouvelle tentative de la même page. Une panne des séances produit une erreur avec reprise, sans message de cahier vide. Les faux statuts de sécurité et liens d’aide sans contenu ont été retirés des paramètres ; les coordonnées d’aide affichées proviennent du groupement.

## Vérification

La suite complète `npm run test:mobile` passe avec **52 tests sur 52** sur la PWA Docker 0.20.0. Le rendu a également été contrôlé dans le navigateur déjà connecté, pour la gestion puis l’épargne personnelle de la responsable.

Les tests `action-du-jour.test.ts` et `appearance.test.ts` couvrent 20 scénarios sur Chromium et WebKit : les deux profils, six campagnes sélectionnées, les largeurs 360/390/430 px, les thèmes clair/sombre, QR, confirmation de versement, tirage, reprise après erreur et retour du navigateur. Les API y sont simulées ; aucune opération financière réelle n’est effectuée.

Captures des interfaces intégrées, avec données de test :

- [Membre, clair](integration-membre-clair.png)
- [Membre, sombre](integration-membre-sombre.png)
- [Responsable, clair](integration-responsable-clair.png)
- [Responsable, sombre](integration-responsable-sombre.png)

La validation sur téléphones physiques et les essais d’usage avec les utilisatrices restent à organiser. L’audit 0.18.0 et les captures des anciennes maquettes restent des preuves historiques ; ils ne décrivent pas le rendu de 0.20.0.
