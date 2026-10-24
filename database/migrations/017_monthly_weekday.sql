-- Rendez-vous mensuel au premier/deuxième/troisième/quatrième jour de semaine.
-- NULL conserve le calendrier historique (semaines ou date fixe pour les tontines).
ALTER TABLE campaigns ADD COLUMN monthly_week integer;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_monthly_week_check
 CHECK (monthly_week IS NULL OR
   (monthly_week BETWEEN 1 AND 4 AND rotation_interval IS NOT NULL AND rotation_interval='MONTHLY'));
GRANT UPDATE(monthly_week) ON campaigns TO aveclesfemmes_app;
