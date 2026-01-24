-- Query 8: Employee Hours & Earnings
SELECT 
  t.name as tenant,
  s.name as employee,
  COUNT(*) as bookings,
  ROUND(SUM(EXTRACT(EPOCH FROM (a."endTime" - a."startTime")))/3600.0, 2) as hours_worked,
  ROUND(SUM(CAST(a."employeeCommission" as NUMERIC)), 2) as earned
FROM appointments a
JOIN staff s ON a."staffId" = s.id
JOIN tenants t ON a."tenantId" = t.id
WHERE a.status = 'completed'
GROUP BY t.id, t.name, s.id, s.name
ORDER BY hours_worked DESC;
