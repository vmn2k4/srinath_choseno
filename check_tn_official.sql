-- List all ULBs and their ward counts
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
ORDER BY ulb_name;

-- Count by district
SELECT 
  properties->>'districtname' as district,
  COUNT(*) as ward_count
FROM map_shapes
WHERE country = 'India'
  AND boundary_type = 'Ward'
  AND retired_at IS NULL
  AND properties->>'statename' LIKE '%TAMIL%'
  AND properties->>'statename' LIKE '%NADU%'
GROUP BY properties->>'districtname'
ORDER BY district;
