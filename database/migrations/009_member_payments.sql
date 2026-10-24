-- Self-service writes remain limited to the authenticated member's participation.
CREATE POLICY contributions_self_create ON contributions FOR INSERT WITH CHECK(
  created_by=app_user_id() AND app_owns_participation(participation_id)
  AND EXISTS(SELECT 1 FROM memberships m JOIN participations p ON p.membership_id=m.id
             WHERE p.id=participation_id AND m.active AND NOT m.is_blocked)
);
CREATE POLICY audit_self_write ON audit_events FOR INSERT WITH CHECK(
  actor_id=app_user_id() AND app_has_access(group_id) AND action='MEMBER_CONTRIBUTION_RECORDED'
);

-- Reveal only the rotation size and beneficiary names to an enrolled member.
-- Personal contact details and other members' contributions remain protected by RLS.
CREATE FUNCTION app_member_rotation(camp uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object(
   'size',(SELECT count(*) FROM participations WHERE campaign_id=camp),
   'rounds',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'round_number',tr.round_number,'expected_date',tr.expected_date,
     'beneficiary_name',m.name,'paid',tr.paid,'paid_at',tr.paid_at,'drawn_at',tr.drawn_at
   ) ORDER BY tr.round_number) FROM tontine_rounds tr JOIN memberships m ON m.id=tr.beneficiary_id
   WHERE tr.campaign_id=camp),'[]'::jsonb))
 WHERE EXISTS(SELECT 1 FROM participations p JOIN memberships m ON m.id=p.membership_id
              WHERE p.campaign_id=camp AND m.user_id=app_user_id() AND m.active AND NOT m.is_blocked)
$$;
REVOKE ALL ON FUNCTION app_member_rotation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_member_rotation(uuid) TO aveclesfemmes_app;

-- Lock the same row used by administrator collections and activation, without
-- granting members UPDATE access to campaigns.
CREATE FUNCTION app_lock_member_campaign(camp uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM participations p JOIN memberships m ON m.id=p.membership_id
   WHERE p.campaign_id=camp AND m.user_id=app_user_id() AND m.active AND NOT m.is_blocked)
 THEN RAISE EXCEPTION 'Participation personnelle requise' USING ERRCODE='42501'; END IF;
 PERFORM id FROM campaigns WHERE id=camp FOR UPDATE;
END $$;
REVOKE ALL ON FUNCTION app_lock_member_campaign(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_lock_member_campaign(uuid) TO aveclesfemmes_app;
