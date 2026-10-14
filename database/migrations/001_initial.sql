CREATE TABLE app_users (
 id uuid PRIMARY KEY, login text NOT NULL UNIQUE, name text NOT NULL,
 phone text UNIQUE, password_hash text, is_super boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES app_users(id),expires_at timestamptz NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE otp_challenges (phone text PRIMARY KEY,code_hash text NOT NULL,expires_at timestamptz NOT NULL,attempts integer NOT NULL DEFAULT 0,sent_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE groupements (
 id uuid PRIMARY KEY,name text NOT NULL CHECK(length(name)>0),address text NOT NULL,
 responsible text NOT NULL,phone text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
 id uuid PRIMARY KEY,group_id uuid NOT NULL REFERENCES groupements(id), user_id uuid REFERENCES app_users(id),
 name text NOT NULL,phone text,role text NOT NULL DEFAULT 'MEMBER' CHECK(role IN ('MEMBER','ADMIN')),
 active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(group_id,user_id),UNIQUE(group_id,id),CHECK(role<>'ADMIN' OR user_id IS NOT NULL)
);
CREATE INDEX memberships_user ON memberships(user_id,group_id) WHERE active;
CREATE INDEX memberships_group ON memberships(group_id,created_at,id);
CREATE TABLE campaign_types (
 id uuid PRIMARY KEY,name text NOT NULL,code text NOT NULL UNIQUE,
 rule_version integer NOT NULL DEFAULT 1 CHECK(rule_version>0),engine text NOT NULL DEFAULT 'AVEC' CHECK(engine='AVEC')
);
CREATE TABLE campaigns (
 id uuid PRIMARY KEY,group_id uuid NOT NULL REFERENCES groupements(id),type_id uuid NOT NULL REFERENCES campaign_types(id),
 name text NOT NULL,start_date date NOT NULL,end_date date NOT NULL,
 interval_weeks integer NOT NULL DEFAULT 1 CHECK(interval_weeks BETWEEN 1 AND 52),weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),
 active boolean NOT NULL DEFAULT true,rule_version integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(group_id,id),CHECK(end_date>=start_date)
);
CREATE INDEX campaigns_group ON campaigns(group_id,created_at,id);
CREATE TABLE participations (
 id uuid PRIMARY KEY,group_id uuid NOT NULL,campaign_id uuid NOT NULL,membership_id uuid NOT NULL,
 forfait bigint CHECK(forfait>0 AND forfait<=1000000000000),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,membership_id),UNIQUE(group_id,campaign_id,id),
 FOREIGN KEY(group_id,campaign_id) REFERENCES campaigns(group_id,id),
 FOREIGN KEY(group_id,membership_id) REFERENCES memberships(group_id,id)
);
CREATE TABLE contributions (
 id uuid PRIMARY KEY,group_id uuid NOT NULL,campaign_id uuid NOT NULL,participation_id uuid NOT NULL,
 amount bigint NOT NULL CHECK(amount>0 AND amount<=1000000000000),currency text NOT NULL DEFAULT 'XOF' CHECK(currency='XOF'),
 paid_on date NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES app_users(id),
 reference text NOT NULL UNIQUE,idempotency_key uuid NOT NULL,request_hash text NOT NULL,
 voided_at timestamptz,voided_by uuid REFERENCES app_users(id),void_reason text,
 UNIQUE(group_id,idempotency_key),FOREIGN KEY(group_id,campaign_id,participation_id) REFERENCES participations(group_id,campaign_id,id),
 CHECK((voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL) OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(void_reason)>0))
);
CREATE INDEX contributions_campaign ON contributions(group_id,campaign_id,paid_on DESC,id);
CREATE INDEX contributions_participation ON contributions(participation_id,paid_on DESC,id);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY,group_id uuid REFERENCES groupements(id),actor_id uuid NOT NULL REFERENCES app_users(id),
 action text NOT NULL,entity_id uuid NOT NULL,payload jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_group ON audit_events(group_id,created_at DESC);
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
CREATE FUNCTION app_is_super() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM app_users WHERE id=app_user_id() AND is_super AND active) $$;
CREATE FUNCTION app_has_access(g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT app_is_super() OR EXISTS(SELECT 1 FROM memberships WHERE group_id=g AND user_id=app_user_id() AND active) $$;
CREATE FUNCTION app_is_admin(g uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM memberships WHERE group_id=g AND user_id=app_user_id() AND role='ADMIN' AND active) $$;
CREATE FUNCTION app_owns_membership(m uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM memberships WHERE id=m AND user_id=app_user_id() AND active) $$;
CREATE FUNCTION app_owns_participation(p uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM participations WHERE id=p AND app_owns_membership(membership_id)) $$;
ALTER TABLE groupements ENABLE ROW LEVEL SECURITY;
CREATE POLICY groups_read ON groupements FOR SELECT USING(app_has_access(id));
CREATE POLICY groups_create ON groupements FOR INSERT WITH CHECK(app_is_super());
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON memberships FOR SELECT USING(app_is_super() OR app_is_admin(group_id) OR app_owns_membership(id));
CREATE POLICY members_create ON memberships FOR INSERT WITH CHECK(app_is_super() OR (app_is_admin(group_id) AND role='MEMBER'));
ALTER TABLE campaign_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY types_read ON campaign_types FOR SELECT USING(app_user_id() IS NOT NULL);
CREATE POLICY types_create ON campaign_types FOR INSERT WITH CHECK(app_is_super());
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_read ON campaigns FOR SELECT USING(app_has_access(group_id));
CREATE POLICY campaigns_create ON campaigns FOR INSERT WITH CHECK(app_is_admin(group_id));
CREATE POLICY campaigns_update ON campaigns FOR UPDATE USING(app_is_admin(group_id)) WITH CHECK(app_is_admin(group_id));
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY participations_read ON participations FOR SELECT USING(app_is_super() OR app_is_admin(group_id) OR app_owns_membership(membership_id));
CREATE POLICY participations_create ON participations FOR INSERT WITH CHECK(app_is_admin(group_id));
CREATE POLICY participations_update ON participations FOR UPDATE USING(app_is_admin(group_id)) WITH CHECK(app_is_admin(group_id));
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contributions_read ON contributions FOR SELECT USING(app_is_super() OR app_is_admin(group_id) OR app_owns_participation(participation_id));
CREATE POLICY contributions_create ON contributions FOR INSERT WITH CHECK(app_is_admin(group_id) AND created_by=app_user_id());
CREATE POLICY contributions_void ON contributions FOR UPDATE USING(app_is_admin(group_id)) WITH CHECK(app_is_admin(group_id) AND voided_by=app_user_id());
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_events FOR SELECT USING(app_is_super() OR app_is_admin(group_id));
CREATE POLICY audit_write ON audit_events FOR INSERT WITH CHECK(actor_id=app_user_id() AND (app_is_super() OR app_is_admin(group_id)));
CREATE FUNCTION set_campaign_activation(c uuid,enabled boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 BEGIN
 IF NOT app_is_super() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE campaigns SET active=enabled WHERE id=c;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN c;
 END $$;
REVOKE ALL ON FUNCTION app_is_super(),app_has_access(uuid),app_is_admin(uuid),app_owns_membership(uuid),app_owns_participation(uuid),set_campaign_activation(uuid,boolean) FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO aveclesfemmes_app;
GRANT SELECT,INSERT ON groupements,memberships,campaign_types,campaigns,participations,contributions,audit_events TO aveclesfemmes_app;
GRANT UPDATE(forfait) ON participations TO aveclesfemmes_app;
GRANT UPDATE(name) ON campaigns TO aveclesfemmes_app;
GRANT UPDATE(voided_at,voided_by,void_reason) ON contributions TO aveclesfemmes_app;
GRANT SELECT ON app_users TO aveclesfemmes_app;
GRANT INSERT(id,login,name,phone,password_hash) ON app_users TO aveclesfemmes_app;
GRANT SELECT,INSERT,DELETE ON sessions TO aveclesfemmes_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON otp_challenges TO aveclesfemmes_app;
GRANT EXECUTE ON FUNCTION app_is_super(),app_has_access(uuid),app_is_admin(uuid),app_owns_membership(uuid),app_owns_participation(uuid),set_campaign_activation(uuid,boolean) TO aveclesfemmes_app;
