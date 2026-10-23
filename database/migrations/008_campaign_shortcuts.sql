-- Shortcuts belong to one administrator and one group; an empty selection is valid.
CREATE TABLE campaign_shortcut_preferences (
 user_id uuid NOT NULL REFERENCES app_users(id),
 group_id uuid NOT NULL REFERENCES groupements(id),
 campaign_ids uuid[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,group_id),
 CHECK(cardinality(campaign_ids) <= 6)
);
ALTER TABLE campaign_shortcut_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_shortcuts_own ON campaign_shortcut_preferences
 USING(user_id=app_user_id() AND app_is_admin(group_id))
 WITH CHECK(user_id=app_user_id() AND app_is_admin(group_id));
GRANT SELECT,INSERT,UPDATE ON campaign_shortcut_preferences TO aveclesfemmes_app;
