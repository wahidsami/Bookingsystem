const db = require('../models');

const DEFAULT_CATEGORIES = [
    { name_en: 'Hair and styling', name_ar: 'تصفيف الشعر', slug: 'hair-and-styling', icon: '💇' },
    { name_en: 'Nails', name_ar: 'الأظافر', slug: 'nails', icon: '💅' },
    { name_en: 'Brows & lashes', name_ar: 'الحواجب والرموش', slug: 'brows-and-lashes', icon: '✨' },
    { name_en: 'Hair removal', name_ar: 'إزالة الشعر', slug: 'hair-removal', icon: '🪒' },
    { name_en: 'Massage', name_ar: 'التدليك', slug: 'massage', icon: '💆' },
    { name_en: 'Facials', name_ar: 'العناية بالوجه', slug: 'facials', icon: '🧖' },
    { name_en: 'Spa & sauna', name_ar: 'سبا وساونا', slug: 'spa-and-sauna', icon: '🛁' },
    { name_en: 'Barbering', name_ar: 'الحلاقة الرجالية', slug: 'barbering', icon: '💈' },
    { name_en: 'Body', name_ar: 'العناية بالجسم', slug: 'body', icon: '🧘' },
    { name_en: 'Aesthetics', name_ar: 'التجميل', slug: 'aesthetics', icon: '💄' },
    { name_en: 'Makeup', name_ar: 'المكياج', slug: 'makeup', icon: '💋' },
    { name_en: 'Tattoos & piercings', name_ar: 'الوشم والثقب', slug: 'tattoos-and-piercings', icon: '💉' },
    { name_en: 'Medical', name_ar: 'طبي', slug: 'medical', icon: '🏥' },
    { name_en: 'Dental', name_ar: 'طب الأسنان', slug: 'dental', icon: '🦷' },
    { name_en: 'Chiropractic', name_ar: 'تقويم العمود الفقري', slug: 'chiropractic', icon: '🦴' },
    { name_en: 'Physical therapy', name_ar: 'العلاج الطبيعي', slug: 'physical-therapy', icon: '🏃' },
    { name_en: 'Fitness', name_ar: 'اللياقة البدنية', slug: 'fitness', icon: '💪' },
    { name_en: 'Nutrition', name_ar: 'التغذية', slug: 'nutrition', icon: '🍎' },
    { name_en: 'Mental Health', name_ar: 'الصحة النفسية', slug: 'mental-health', icon: '🧠' },
    { name_en: 'Holistic health', name_ar: 'الصحة الشمولية', slug: 'holistic-health', icon: '🌿' },
    { name_en: 'Pets', name_ar: 'الحيوانات الأليفة', slug: 'pets', icon: '🐾' }
];

async function seedServiceCategories() {
    try {
        for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
            const [record, created] = await db.ServiceCategory.findOrCreate({
                where: { slug: category.slug },
                defaults: {
                    ...category,
                    sortOrder: index + 1,
                    isActive: true
                }
            });

            if (!created) {
                let changed = false;
                if (record.name_en !== category.name_en) {
                    record.name_en = category.name_en;
                    changed = true;
                }
                if (record.name_ar !== category.name_ar) {
                    record.name_ar = category.name_ar;
                    changed = true;
                }
                if (record.icon !== category.icon) {
                    record.icon = category.icon;
                    changed = true;
                }
                if (record.sortOrder !== index + 1) {
                    record.sortOrder = index + 1;
                    changed = true;
                }
                if (record.isActive !== true) {
                    record.isActive = true;
                    changed = true;
                }
                if (changed) {
                    await record.save();
                }
            }
        }

        console.log(`✅ Service categories ready (${DEFAULT_CATEGORIES.length} items).`);
    } catch (error) {
        console.error('❌ Error seeding service categories:', error);
    }
}

module.exports = { seedServiceCategories };
