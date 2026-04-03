-- Migration: Add checked-in and in-service appointment statuses for POS/check-in workflow
-- Run this once in psql before redeploying the API service.

ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE "enum_appointments_status" ADD VALUE IF NOT EXISTS 'in_service';
