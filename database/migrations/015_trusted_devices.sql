-- Device proof and server-held wrapping key; neither PIN nor vault key is stored in browser storage.
CREATE TABLE trusted_devices (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  vault_secret text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX trusted_devices_expiry ON trusted_devices(expires_at);
GRANT SELECT, INSERT, DELETE ON trusted_devices TO aveclesfemmes_app;
