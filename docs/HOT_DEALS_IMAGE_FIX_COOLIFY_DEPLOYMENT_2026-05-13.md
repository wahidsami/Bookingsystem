# Hot Deals Image Fix - Coolify Deployment (2026-05-13)

## Scope Safety
This fix only touches Hot Deals image upload/storage paths.

Changed files:
- `server/src/routes/hotDealsRoutes.js`
- `server/src/controllers/hotDealsController.js`
- `server/src/models/HotDeal.js`
- `server/migrations/20260513170000-add-image-to-hot-deals.sql`

No tenant UI logic, no other modules, no unrelated features were modified.

## Database Migration Needed
Run this SQL once on your production PostgreSQL database:

```sql
ALTER TABLE hot_deals
ADD COLUMN IF NOT EXISTS image VARCHAR(500);

COMMENT ON COLUMN hot_deals.image IS 'Uploaded hot deal image path (relative to uploads/)';
```

You can also run the repo file:
- `server/migrations/20260513170000-add-image-to-hot-deals.sql`

## Will It Affect Old Data?
No destructive impact.

- Existing rows in `hot_deals` remain unchanged.
- New column `image` will be `NULL` for old deals.
- Old deals will continue showing the existing fallback/placeholder image behavior.
- New or edited deals with uploaded images will show real images.

## Coolify Deployment Steps
1. Open your PostgreSQL service in Coolify.
2. Run the migration SQL above in the DB query console (or via your DB client).
3. Redeploy only the API service (backend) from latest commit.
4. Verify by creating a new Hot Deal with an image.

## Do You Need To Redeploy Tenant / API / DB?
- API: Yes (required).
- Tenant frontend: No (not required for this fix).
- DB service: No full redeploy required; only execute the SQL migration.

If your Coolify flow uses a migration job, include this SQL in that migration step before API rollout.
