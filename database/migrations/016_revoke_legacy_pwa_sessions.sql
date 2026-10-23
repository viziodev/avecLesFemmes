-- Force a fresh authentication after the security rollout. Existing sessions
-- may have been issued through the former unrestricted four-digit-code login.
-- Business data and initial passwords are preserved; Super Admin web is unchanged.
DELETE FROM sessions s USING app_users u WHERE s.user_id=u.id AND NOT u.is_super;
