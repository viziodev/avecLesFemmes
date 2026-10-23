# Ouverture des séances d’épargne — 0.8.0

Une administratrice ouvre la séance à l’aide du bouton placé au même endroit que l’encaissement. La date est déterminée par le serveur (Africa/Dakar, UTC), sans saisie. Le bouton d’encaissement apparaît après l’ouverture. Aucun ordonnanceur ne crée de séance sans action de l’administratrice.

La première échéance est le premier jour configuré à partir du début de la campagne, inclus. Les suivantes respectent `interval_weeks`. Les dates de début et de fin sont inclusives ; une campagne désactivée ne peut recevoir ni ouverture ni versement.

Le serveur exige, pour chaque nouveau versement d’épargne, une date égale à aujourd’hui, un jour autorisé par le calendrier et une séance ouverte. Une requête rejouée avec la même clé et le même contenu retourne le versement déjà enregistré, même après la fin du jour, sans nouvelle écriture.

La migration 006 ajoute une table distincte des sessions d’authentification, avec unicité campagne/date, isolation RLS et droits d’insertion réservés aux administratrices. L’ouverture est sérialisée avec les opérations de campagne et journalisée une seule fois. Les membres et le super administrateur ne peuvent pas ouvrir de séance.

Les cahiers comprennent désormais les séances ouvertes même sans versement et les dates des versements historiques. Aucun versement ancien n’est effacé et aucune séance ancienne n’est implicitement ouverte. Les montants attendus restent indicatifs, calculés avec les forfaits actuels.

L’interface vérifie l’état au chargement, au retour du focus et chaque minute. Le contrôle serveur reste déterminant après minuit ou une modification de campagne. La date du formulaire d’épargne est en lecture seule.

Les tests API utilisent une horloge de séance contrôlée, sans modifier l’horloge de production : droits, date interdite, absence d’ouverture, répétition d’ouverture, séance vide, versement autorisé, refus le lendemain, idempotence et fréquence de deux semaines. Les essais mobiles simulent les états du calendrier ; ils ne créent pas de séance dans la base de démonstration.
