-- Le code secret est distinct du mot de passe initial de récupération.
ALTER TABLE app_users ADD COLUMN secret_code_hash text;
GRANT INSERT(secret_code_hash), UPDATE(secret_code_hash) ON app_users TO aveclesfemmes_app;
