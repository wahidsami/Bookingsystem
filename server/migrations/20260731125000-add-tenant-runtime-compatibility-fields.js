'use strict';

module.exports = {
  async up(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      return;
    }

    const statements = [
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT '{"commercialRegister":null,"license":null,"ownerIdCard":null,"vatCertificate":null}'::jsonb;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "contactPersonNameAr" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "contactPersonNameEn" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "contactPersonMobile" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "contactPersonPosition" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "providesHomeServices" BOOLEAN DEFAULT false;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "staffCount" INTEGER;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "mainService" TEXT;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "sellsProducts" BOOLEAN DEFAULT false;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "hasOwnPaymentGateway" BOOLEAN DEFAULT false;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "serviceRanking" INTEGER;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "advertiseOnSocialMedia" BOOLEAN DEFAULT false;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "wantsRifahPromotion" BOOLEAN DEFAULT false;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "planStartDate" TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "planEndDate" TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "approvedBy" UUID;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerName" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerNameAr" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerNameEn" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerPhone" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerEmail" VARCHAR(255);`,
      `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "ownerNationalId" VARCHAR(255);`
    ];

    for (const statement of statements) {
      await queryInterface.sequelize.query(statement);
    }
  },

  async down() {}
};
