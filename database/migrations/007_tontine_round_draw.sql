-- Existing allocations are preserved as completed legacy draws.
ALTER TABLE tontine_rounds ADD COLUMN drawn_at timestamptz;
ALTER TABLE tontine_rounds ADD COLUMN drawn_by uuid REFERENCES app_users(id);
UPDATE tontine_rounds SET drawn_at=created_at;
