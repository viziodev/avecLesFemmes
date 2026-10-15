-- 005_groupements_archive_status.sql
-- Gestion des groupements actifs/archivés et politiques d'activation

ALTER TABLE groupements ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Politique de mise à jour pour Super Administrateur
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'groupements' AND policyname = 'groups_update'
  ) THEN
    CREATE POLICY groups_update ON groupements FOR UPDATE USING (app_is_super()) WITH CHECK (app_is_super());
  END IF;
END $$;

GRANT UPDATE ON groupements TO aveclesfemmes_app;
