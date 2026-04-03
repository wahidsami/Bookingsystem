-- Migration: Extend bills.status enum for draft/failed/void invoice lifecycle.
-- Run once on the production Postgres DB before deploying the extended bill-status backend code.

ALTER TYPE "enum_bills_status" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "enum_bills_status" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "enum_bills_status" ADD VALUE IF NOT EXISTS 'VOID';
