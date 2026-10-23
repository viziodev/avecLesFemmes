CREATE TABLE group_appearance (
  group_id uuid PRIMARY KEY REFERENCES groupements(id),
  primary_color text NOT NULL CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  savings_color text NOT NULL CHECK (savings_color ~ '^#[0-9a-fA-F]{6}$'),
  tontine_color text NOT NULL CHECK (tontine_color ~ '^#[0-9a-fA-F]{6}$'),
  solidarity_color text NOT NULL CHECK (solidarity_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE group_appearance ENABLE ROW LEVEL SECURITY;
CREATE POLICY group_appearance_read ON group_appearance FOR SELECT USING(app_has_access(group_id));
CREATE POLICY group_appearance_insert ON group_appearance FOR INSERT WITH CHECK(app_is_super() OR app_is_admin(group_id));
CREATE POLICY group_appearance_update ON group_appearance FOR UPDATE USING(app_is_super() OR app_is_admin(group_id)) WITH CHECK(app_is_super() OR app_is_admin(group_id));
CREATE POLICY group_appearance_delete ON group_appearance FOR DELETE USING(app_is_super() OR app_is_admin(group_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON group_appearance TO aveclesfemmes_app;
ALTER TABLE sessions ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
GRANT UPDATE(last_activity_at) ON sessions TO aveclesfemmes_app;
