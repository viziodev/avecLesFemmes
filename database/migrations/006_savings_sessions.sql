CREATE TABLE savings_sessions (
 id uuid PRIMARY KEY,
 group_id uuid NOT NULL,
 campaign_id uuid NOT NULL,
 session_date date NOT NULL,
 created_by uuid NOT NULL REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(group_id,campaign_id) REFERENCES campaigns(group_id,id),
 UNIQUE(campaign_id,session_date)
);
ALTER TABLE savings_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY savings_sessions_read ON savings_sessions FOR SELECT USING(app_has_access(group_id));
CREATE POLICY savings_sessions_create ON savings_sessions FOR INSERT WITH CHECK(app_is_admin(group_id) AND created_by=app_user_id());
GRANT SELECT,INSERT ON savings_sessions TO aveclesfemmes_app;
