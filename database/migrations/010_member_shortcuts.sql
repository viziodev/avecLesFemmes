-- Personal home preferences are independent from group administrator shortcuts.
CREATE TABLE member_campaign_shortcut_preferences (
 user_id uuid NOT NULL REFERENCES app_users(id),
 group_id uuid NOT NULL REFERENCES groupements(id),
 campaign_ids uuid[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,group_id),
 CHECK(cardinality(campaign_ids) <= 6)
);
ALTER TABLE member_campaign_shortcut_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_campaign_shortcuts_own ON member_campaign_shortcut_preferences
 USING(user_id=app_user_id() AND app_has_access(group_id))
 WITH CHECK(user_id=app_user_id() AND app_has_access(group_id));
GRANT SELECT,INSERT,UPDATE ON member_campaign_shortcut_preferences TO aveclesfemmes_app;
