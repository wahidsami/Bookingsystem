import { ServiceCategory } from '../api/client';

export function getLocalizedCategoryName(categoryNameOrSlug: string, categories: ServiceCategory[], isRTL: boolean): string {
    if (!categoryNameOrSlug || categoryNameOrSlug === 'General') return isRTL ? 'عام' : 'General';
    const lower = categoryNameOrSlug.toLowerCase();
    const found = categories.find(c => 
        c.slug?.toLowerCase() === lower || 
        c.name_en?.toLowerCase() === lower || 
        c.name_ar?.toLowerCase() === lower ||
        c.id === categoryNameOrSlug
    );
    if (found) {
        return isRTL ? (found.name_ar || found.name_en) : (found.name_en || found.name_ar);
    }
    return categoryNameOrSlug;
}
