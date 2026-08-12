-- Count Tamil Nadu wards
SELECT 
  COUNT(*) as total_tn_wards,
  COUNT(DISTINCT COALESCE(properties->>'ulbname', 'Unknown')) as ulb_count,
  COUNT(DISTINCT COALESCE(properties->>'districtname', 'Unknown')) as district_count
FROM map_shapes
WHERE country = 'India'
  AND boundary_type = 'Ward'
  AND retired_at IS NULL
  AND properties->>'statename' LIKE '%TAMIL%'
  AND properties->>'statename' LIKE '%NADU%';

-- Top ULBs in TN
SELECT 
  properties->>'ulbname' as ulb_name,
  COUNT(*) as ward_count,
  properties->>'districtname' as district
FROM map_shapes
WHERE country = 'India'
  AND boundary_type = 'Ward'
  AND retired_at IS NULL
  AND properties->>'statename' LIKE '%TAMIL%'
  AND properties->>'statename' LIKE '%NADU%'
GROUP BY properties->>'ulbname', properties->>'districtname'
ORDER BY ward_count DESC
LIMIT 20;

-- Search for Tambaram
SELECT 
  id,
  name,
  properties->>'ulbname' as ulb_name,
  properties->>'districtname' as district
FROM map_shapes
WHERE country = 'India'
  AND boundary_type = 'Ward'
  AND retired_at IS NULL
  AND (properties->>'ulbname' ILIKE '%TAMBARAM%'
    OR name ILIKE '%TAMBARAM%')
LIMIT 50;
