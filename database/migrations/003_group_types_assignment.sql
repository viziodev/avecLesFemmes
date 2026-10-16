-- 003_group_types_assignment.sql
-- Association des types de campagne autorisés par groupement

CREATE TABLE IF NOT EXISTS groupment_types (
  group_id uuid NOT NULL REFERENCES groupements(id) ON DELETE CASCADE,
  type_id uuid NOT NULL REFERENCES campaign_types(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id, type_id)
);

-- Associer tous les types actuels aux groupements existants
INSERT INTO groupment_types(group_id, type_id)
SELECT g.id, t.id FROM groupements g CROSS JOIN campaign_types t
ON CONFLICT DO NOTHING;

-- RLS (Row Level Security)
ALTER TABLE groupment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY groupment_types_read ON groupment_types FOR SELECT
  USING (app_is_super() OR app_has_access(group_id));
CREATE POLICY groupment_types_write ON groupment_types FOR ALL
  USING (app_is_super()) WITH CHECK (app_is_super());

-- Permissions accordées au rôle applicatif
GRANT SELECT, INSERT, UPDATE, DELETE ON groupment_types TO aveclesfemmes_app;
