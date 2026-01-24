-- Complete Financial Summary
SELECT 
  COUNT(*) as total_transactions,
  ROUND(SUM(CAST(amount as NUMERIC)), 2) as gross_revenue,
  ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as your_commission,
  ROUND(SUM(CAST("tenantRevenue" as NUMERIC)), 2) as tenant_total_revenue,
  ROUND(AVG(CAST("platformFee" as NUMERIC)), 2) as avg_commission_per_tx
FROM transactions
WHERE status = 'completed';
