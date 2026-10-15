-- 004_types_crud_permissions.sql
-- Autorisations UPDATE et DELETE pour les types de campagne par le super administrateur
-- et autorisation de création/gestion de campagnes pour le super administrateur

CREATE POLICY types_update ON campaign_types FOR UPDATE
  USING (app_is_super()) WITH CHECK (app_is_super());

CREATE POLICY types_delete ON campaign_types FOR DELETE
  USING (app_is_super());

GRANT UPDATE, DELETE ON campaign_types TO aveclesfemmes_app;

-- Permettre au super administrateur de créer et mettre à jour des campagnes pour un groupement
DROP POLICY IF EXISTS campaigns_create ON campaigns;
CREATE POLICY campaigns_create ON campaigns FOR INSERT
  WITH CHECK (app_is_admin(group_id) OR app_is_super());

DROP POLICY IF EXISTS campaigns_update ON campaigns;
CREATE POLICY campaigns_update ON campaigns FOR UPDATE
  USING (app_is_admin(group_id) OR app_is_super())
  WITH CHECK (app_is_admin(group_id) OR app_is_super());
