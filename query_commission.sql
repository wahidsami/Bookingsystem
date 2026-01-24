SELECT 
  DATE_TRUNC('month', "createdAt")::date as month,
  ROUND(SUM(CAST("platformFee" as NUMERIC)), 2) as earnings,
  COUNT(*) as transaction_count
FROM transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', "createdAt")
ORDER BY month DESC
LIMIT 12;
