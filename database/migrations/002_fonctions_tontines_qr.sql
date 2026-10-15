-- 002_fonctions_tontines_qr.sql
-- Évolution fonctionnelle : Catalogue de fonctions, événements, tontines rotatives, QR codes et délais de grâce

-- 1. Catalogue des fonctions de groupement
CREATE TABLE group_functions (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  can_be_admin boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insertion des fonctions initiales
INSERT INTO group_functions(id, code, name, can_be_admin, is_default) VALUES
  ('11111111-1111-4111-8111-111111111101', 'MEMBRE_SIMPLE', 'Membre simple', false, true),
  ('11111111-1111-4111-8111-111111111102', 'PRESIDENTE', 'Présidente', true, false),
  ('11111111-1111-4111-8111-111111111103', 'TRESORIERE', 'Trésorière', true, false),
  ('11111111-1111-4111-8111-111111111104', 'SECRETAIRE', 'Secrétaire', true, false),
  ('11111111-1111-4111-8111-111111111105', 'COMMISSAIRE', 'Commissaire aux comptes', false, false);

-- Fonctions autorisées par groupement
CREATE TABLE groupment_functions (
  group_id uuid NOT NULL REFERENCES groupements(id) ON DELETE CASCADE,
  function_id uuid NOT NULL REFERENCES group_functions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id, function_id)
);

-- Rendre toutes les fonctions disponibles par défaut pour les groupements existants
INSERT INTO groupment_functions(group_id, function_id)
SELECT g.id, f.id FROM groupements g CROSS JOIN group_functions f
ON CONFLICT DO NOTHING;

-- 3. Référentiel des événements
CREATE TABLE campaign_events (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insertion des événements initiaux
INSERT INTO campaign_events(id, code, name, description) VALUES
  ('22222222-2222-4222-8222-222222222201', 'AVEC', 'Calabasse Avec classique', 'Épargne périodique solidaire standard'),
  ('22222222-2222-4222-8222-222222222202', 'RAMADAN', 'Épargne Ramadan', 'Préparation aux dépenses du mois béni'),
  ('22222222-2222-4222-8222-222222222203', 'TABASKI', 'Épargne Tabaski', 'Cotisation pour la fête du sacrifice'),
  ('22222222-2222-4222-8222-222222222204', 'SOLIDARITE', 'Caisse de Solidarité / Secours', 'Fonds d’urgence et d’entraide sociale'),
  ('22222222-2222-4222-8222-222222222205', 'RENTREE', 'Rentrée scolaire', 'Frais d’inscription et fournitures');

-- Événements affectés aux groupements (avec règle d'obligation et montant standard Option B)
CREATE TABLE groupment_events (
  group_id uuid NOT NULL REFERENCES groupements(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES campaign_events(id) ON DELETE CASCADE,
  is_mandatory boolean NOT NULL DEFAULT false,
  default_amount bigint CHECK (default_amount IS NULL OR (default_amount > 0 AND default_amount <= 1000000000000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id, event_id)
);

-- Affecter tous les événements de base aux groupements existants
INSERT INTO groupment_events(group_id, event_id, is_mandatory, default_amount)
SELECT g.id, e.id, false, 5000 FROM groupements g CROSS JOIN campaign_events e
ON CONFLICT DO NOTHING;

-- 4. Évolution des types de campagnes
INSERT INTO campaign_types(id, name, code, rule_version, engine) VALUES
  ('33333333-3333-4333-8333-333333333301', 'Tontine rotative', 'TONTINE', 1, 'AVEC'),
  ('33333333-3333-4333-8333-333333333302', 'Caisse de solidarité', 'SOLIDARITE', 1, 'AVEC')
ON CONFLICT (code) DO NOTHING;

-- 5. Modifications sur la table app_users (anti-bruteforce pour codes PIN)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- 6. Modifications sur la table memberships (adresse, sexe, fonction, blocage)
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'F' CHECK (gender IN ('F', 'M'));
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS function_id uuid REFERENCES group_functions(id);
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Mettre à jour les adhésions existantes vers la fonction Membre simple
UPDATE memberships SET function_id = '11111111-1111-4111-8111-111111111101' WHERE function_id IS NULL;

-- 7. Modifications sur la table campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES campaign_events(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_mandatory boolean NOT NULL DEFAULT false;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS standard_amount bigint CHECK (standard_amount IS NULL OR (standard_amount > 0 AND standard_amount <= 1000000000000));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS rotation_interval text CHECK (rotation_interval IS NULL OR rotation_interval IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS due_day integer CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31));

-- Mettre à jour les campagnes existantes vers l'événement Avec par défaut
UPDATE campaigns SET event_id = '22222222-2222-4222-8222-222222222201' WHERE event_id IS NULL;

-- 8. Modifications sur la table participations (cotisation aléatoire, ordre tontine)
ALTER TABLE participations ADD COLUMN IF NOT EXISTS is_random boolean NOT NULL DEFAULT false;
ALTER TABLE participations ADD COLUMN IF NOT EXISTS round_number integer CHECK (round_number IS NULL OR round_number > 0);

-- 9. Table des tours de tontine rotative (Tirage au sort et attribution des cagnottes)
CREATE TABLE tontine_rounds (
  id uuid PRIMARY KEY,
  campaign_id uuid NOT NULL,
  group_id uuid NOT NULL,
  round_number integer NOT NULL CHECK (round_number > 0),
  beneficiary_id uuid NOT NULL,
  expected_date date NOT NULL,
  payout_amount bigint NOT NULL CHECK (payout_amount > 0),
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  paid_by uuid REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, round_number),
  FOREIGN KEY(group_id, campaign_id) REFERENCES campaigns(group_id, id) ON DELETE CASCADE,
  FOREIGN KEY(group_id, beneficiary_id) REFERENCES memberships(group_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_tontine_rounds ON tontine_rounds(group_id, campaign_id, round_number);

-- 10. Table des délais de grâce individuels et flexibles
CREATE TABLE contribution_grace_periods (
  id uuid PRIMARY KEY,
  group_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  period_date date NOT NULL,
  extended_deadline date NOT NULL CHECK (extended_deadline >= period_date),
  reason text,
  granted_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, membership_id, period_date),
  FOREIGN KEY(group_id, campaign_id) REFERENCES campaigns(group_id, id) ON DELETE CASCADE,
  FOREIGN KEY(group_id, membership_id) REFERENCES memberships(group_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_grace_periods ON contribution_grace_periods(group_id, campaign_id, period_date);

-- 11. Politiques RLS (Row Level Security) sur les nouvelles tables
ALTER TABLE group_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_functions_read ON group_functions FOR SELECT USING(app_user_id() IS NOT NULL);
CREATE POLICY group_functions_write ON group_functions FOR ALL USING(app_is_super()) WITH CHECK(app_is_super());

ALTER TABLE groupment_functions ENABLE ROW LEVEL SECURITY;
CREATE POLICY groupment_functions_read ON groupment_functions FOR SELECT USING(app_has_access(group_id));
CREATE POLICY groupment_functions_write ON groupment_functions FOR ALL USING(app_is_super()) WITH CHECK(app_is_super());

ALTER TABLE campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_events_read ON campaign_events FOR SELECT USING(app_user_id() IS NOT NULL);
CREATE POLICY campaign_events_write ON campaign_events FOR ALL USING(app_is_super()) WITH CHECK(app_is_super());

ALTER TABLE groupment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY groupment_events_read ON groupment_events FOR SELECT USING(app_has_access(group_id));
CREATE POLICY groupment_events_write ON groupment_events FOR ALL USING(app_is_super()) WITH CHECK(app_is_super());

ALTER TABLE tontine_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY tontine_rounds_read ON tontine_rounds FOR SELECT USING(app_has_access(group_id));
CREATE POLICY tontine_rounds_write ON tontine_rounds FOR ALL USING(app_is_admin(group_id) OR app_is_super()) WITH CHECK(app_is_admin(group_id) OR app_is_super());

ALTER TABLE contribution_grace_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY grace_periods_read ON contribution_grace_periods FOR SELECT USING(app_has_access(group_id));
CREATE POLICY grace_periods_write ON contribution_grace_periods FOR ALL USING(app_is_admin(group_id) OR app_is_super()) WITH CHECK(app_is_admin(group_id) OR app_is_super());

-- Politique de mise à jour pour memberships
CREATE POLICY members_update ON memberships FOR UPDATE USING(app_is_super() OR app_is_admin(group_id)) WITH CHECK(app_is_super() OR app_is_admin(group_id));

-- 12. Droits accordés au rôle applicatif aveclesfemmes_app
GRANT SELECT, INSERT, UPDATE, DELETE ON group_functions, groupment_functions, campaign_events, groupment_events, tontine_rounds, contribution_grace_periods TO aveclesfemmes_app;
GRANT UPDATE(name, address, responsible, phone) ON groupements TO aveclesfemmes_app;
GRANT UPDATE(name, phone, active, address, gender, function_id, is_blocked, role) ON memberships TO aveclesfemmes_app;
GRANT UPDATE(event_id, is_mandatory, standard_amount, rotation_interval, due_day, end_date) ON campaigns TO aveclesfemmes_app;
GRANT UPDATE(is_random, round_number) ON participations TO aveclesfemmes_app;
GRANT UPDATE(name, phone, password_hash, active, failed_attempts, locked_until) ON app_users TO aveclesfemmes_app;
