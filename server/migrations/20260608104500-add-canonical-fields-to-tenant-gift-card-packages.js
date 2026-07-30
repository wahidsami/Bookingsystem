'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            ADD COLUMN IF NOT EXISTS title VARCHAR(255);
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            ADD COLUMN IF NOT EXISTS description TEXT;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            ADD COLUMN IF NOT EXISTS "discountPreset" VARCHAR(255);
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(10, 2) DEFAULT 0;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            ADD COLUMN IF NOT EXISTS "expirationPreset" VARCHAR(255);
        `);

        await queryInterface.sequelize.query(`
            UPDATE tenant_gift_card_packages
            SET
                title = COALESCE(NULLIF(title, ''), NULLIF(title_en, ''), NULLIF(title_ar, '')),
                description = COALESCE(description, description_en, description_ar),
                "discountPercent" = COALESCE(
                    "discountPercent",
                    CASE
                        WHEN "walletCreditAmount" > 0 AND "priceAmount" > 0 AND "priceAmount" <= "walletCreditAmount"
                            THEN ROUND((1 - ("priceAmount" / "walletCreditAmount")) * 100, 2)
                        ELSE 10
                    END
                ),
                "discountPreset" = COALESCE(
                    "discountPreset",
                    CASE
                        WHEN "walletCreditAmount" > 0 AND "priceAmount" > 0 AND ABS(ROUND((1 - ("priceAmount" / "walletCreditAmount")) * 100, 2) - 2) < 0.01 THEN '2'
                        WHEN "walletCreditAmount" > 0 AND "priceAmount" > 0 AND ABS(ROUND((1 - ("priceAmount" / "walletCreditAmount")) * 100, 2) - 5) < 0.01 THEN '5'
                        WHEN "walletCreditAmount" > 0 AND "priceAmount" > 0 AND ABS(ROUND((1 - ("priceAmount" / "walletCreditAmount")) * 100, 2) - 7) < 0.01 THEN '7'
                        WHEN "walletCreditAmount" > 0 AND "priceAmount" > 0 AND ABS(ROUND((1 - ("priceAmount" / "walletCreditAmount")) * 100, 2) - 10) < 0.01 THEN '10'
                        ELSE 'custom'
                    END
                ),
                "expirationPreset" = COALESCE(
                    "expirationPreset",
                    CASE
                        WHEN "endsAt" IS NULL THEN 'never'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 7) < 1 THEN '1_week'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 14) < 1 THEN '2_weeks'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 21) < 1 THEN '3_weeks'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 30) < 2 THEN '1_month'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 60) < 2 THEN '2_months'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 90) < 3 THEN '3_months'
                        WHEN "startsAt" IS NOT NULL AND ABS(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 86400 - 365) < 5 THEN '1_year'
                        ELSE 'never'
                    END
                );
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            DROP COLUMN IF EXISTS "expirationPreset";
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            DROP COLUMN IF EXISTS "discountPercent";
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            DROP COLUMN IF EXISTS "discountPreset";
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            DROP COLUMN IF EXISTS description;
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE public.tenant_gift_card_packages
            DROP COLUMN IF EXISTS title;
        `);
    }
};
