CREATE TABLE platform_appearance (
  id uuid PRIMARY KEY CHECK (id = '00000000-0000-4000-a000-000000000001'),
  primary_color text NOT NULL CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  savings_color text NOT NULL CHECK (savings_color ~ '^#[0-9a-fA-F]{6}$'),
  tontine_color text NOT NULL CHECK (tontine_color ~ '^#[0-9a-fA-F]{6}$'),
  solidarity_color text NOT NULL CHECK (solidarity_color ~ '^#[0-9a-fA-F]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_appearance(id,primary_color,savings_color,tontine_color,solidarity_color)
VALUES('00000000-0000-4000-a000-000000000001','#155d50','#197647','#471976','#764019');
ALTER TABLE platform_appearance ENABLE ROW LEVEL SECURITY;
-- Only this non-personal palette is readable before authentication.
CREATE POLICY appearance_read ON platform_appearance FOR SELECT USING(true);
CREATE POLICY appearance_update ON platform_appearance FOR UPDATE USING(app_is_super()) WITH CHECK(app_is_super());
GRANT SELECT,UPDATE ON platform_appearance TO aveclesfemmes_app;
