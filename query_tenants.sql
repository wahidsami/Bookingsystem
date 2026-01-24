-- Query 2: Tenant Earnings
SELECT 
  t.id,
  t.name,
  COUNT(*) as bookings,
  ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_earned,
  ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as paid_to_platform,
  t.plan as package
FROM transactions tr
JOIN tenants t ON tr."tenantId" = t.id
WHERE tr.status = 'completed'
GROUP BY t.id, t.name, t.plan
ORDER BY tenant_earned DESC;
