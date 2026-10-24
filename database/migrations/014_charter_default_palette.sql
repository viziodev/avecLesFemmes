-- Adopt the new charter only for the untouched platform default.
-- Group overrides and customized platform palettes remain exactly as saved.
UPDATE platform_appearance
SET tontine_color = '#6d3fc0', solidarity_color = '#a85d12', updated_at = now()
WHERE id = '00000000-0000-4000-a000-000000000001'
  AND primary_color = '#155d50' AND savings_color = '#197647'
  AND tontine_color = '#471976' AND solidarity_color = '#764019';
