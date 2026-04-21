'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS public.tenant_dashboard_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        "displayName" VARCHAR(120) NOT NULL,
        "roleKey" VARCHAR(50) NOT NULL DEFAULT 'custom',
        permissions JSONB NOT NULL DEFAULT '{"view_dashboard": true}'::jsonb,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false,
        "lastLoginAt" TIMESTAMP WITH TIME ZONE NULL,
        "lastLoginIP" VARCHAR(120) NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_dashboard_accounts_tenant_email
        ON public.tenant_dashboard_accounts ("tenantId", email);

      CREATE INDEX IF NOT EXISTS idx_tenant_dashboard_accounts_tenant
        ON public.tenant_dashboard_accounts ("tenantId");

      CREATE INDEX IF NOT EXISTS idx_tenant_dashboard_accounts_role
        ON public.tenant_dashboard_accounts ("roleKey");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS public.tenant_dashboard_accounts;
    `);
  }
};
