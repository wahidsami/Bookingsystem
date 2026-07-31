# Database Migrations

This directory contains Sequelize migration files for the Rifah Booking System.

## Running Migrations

### Using Sequelize CLI

1. Install Sequelize CLI globally (if not already installed):
```bash
npm install -g sequelize-cli
```

2. Run migrations:
```bash
cd server
npx sequelize-cli db:migrate
```

3. Rollback last migration:
```bash
npx sequelize-cli db:migrate:undo
```

4. Rollback all migrations:
```bash
npx sequelize-cli db:migrate:undo:all
```

### Manual SQL Execution

If you prefer to run SQL directly, you can extract the SQL from the migration file and execute it in your PostgreSQL client.

## Migration Files

### `20240101000000-create-scheduling-tables.js`

Creates the following tables:
- `staff_shifts` - Staff shift schedules (recurring and date-specific)
- `staff_breaks` - Staff break schedules (lunch, prayer, etc.)
- `staff_time_off` - Staff time off records (vacation, sick, etc.)
- `staff_schedule_overrides` - Schedule exceptions and overrides

**Note:** This migration assumes the `staff` table already exists.

## Current Status

The project currently uses Sequelize's `sync()` method in `server/src/index.js` to automatically create/update tables. Migrations are provided as an alternative for production environments where you want more control over schema changes.

To use migrations instead of sync:
1. Set `sync: false` in your database configuration
2. Run migrations before starting the server
3. Remove or comment out the `sync()` calls in `server/src/index.js`

