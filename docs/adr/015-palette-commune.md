# ADR 015 — Palette commune configurable

Statut : appliqué en local, version 0.21.0, 22 octobre 2026.

Le Super Admin choisit la couleur principale et celles des familles épargne, tontine et solidarité. La palette est commune à tous les groupements ; chaque appareil conserve son choix de mode automatique, clair ou sombre.

Une table singleton PostgreSQL (`platform_appearance`, migration 011) conserve quatre valeurs hexadécimales. La lecture publique permet de personnaliser aussi la page de connexion et ne contient aucune donnée personnelle. Les écritures exigent une session Super Admin, les contrôles CSRF, une validation serveur et RLS. Elles sont consignées dans l’audit.

Le client applique des variables CSS à partir des couleurs enregistrées. Il dérive des nuances avec un contraste minimal de 4,5:1 pour le texte et les boutons sur les surfaces prévues. Les alertes, le QR noir/blanc et les types de campagne hors de ces trois familles gardent leurs règles visuelles. Un aperçu clair/sombre et la préparation d’un retour aux valeurs par défaut précèdent l’enregistrement explicite.

La palette est relue à l’ouverture, au retour au premier plan, au rétablissement du réseau et toutes les cinq minutes lorsque la page est visible. Une indisponibilité conserve les couleurs disponibles ou les valeurs par défaut ; elle bloque l’édition initiale et propose une nouvelle lecture. Cette personnalisation ne nécessite aucune reconstruction des images Docker.

Validation : tests API de permissions, validation, persistance, CSRF, RLS et audit ; tests mobiles de propagation clair/sombre, couleurs extrêmes, aperçu et reprise après échec d’enregistrement.
