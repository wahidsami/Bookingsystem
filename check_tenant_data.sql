-- Check which tenant owns the appointments
SELECT s."tenantId", COUNT(*) as appointment_count, SUM(a.price) as total_revenue
FROM appointments a 
JOIN staff s ON a."staffId" = s.id 
WHERE a.status IN ('completed', 'confirmed')
GROUP BY s."tenantId";

-- Check staff distribution
SELECT "tenantId", COUNT(*) as staff_count
FROM staff 
GROUP BY "tenantId";

-- Check which tenant user wahidsami belongs to
SELECT id, email 
FROM tenants 
WHERE email IN ('wahidsami@gmail.com', 'wahid2@gmail.com');
