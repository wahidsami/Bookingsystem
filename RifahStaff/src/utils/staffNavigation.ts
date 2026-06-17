import { canRequestTimeOff, canViewClients, canViewEarnings, canViewMessages, canViewReviews } from './capabilities';
import type { User } from '../context/AuthContext';

export type StaffNavSection = {
    route: string;
    href: string;
    kind: 'tab' | 'action';
    labelEn: string;
    labelAr: string;
    icon: keyof typeof staffIconMap;
    descriptionEn: string;
    descriptionAr: string;
    enabled: boolean;
};

type StaffLike = User | null | undefined;

export const staffIconMap = {
    appointments: 'calendar-outline',
    schedule: 'calendar-outline',
    customers: 'people-outline',
    reviews: 'star-outline',
    messages: 'mail-outline',
    notifications: 'notifications-outline',
    earnings: 'cash-outline',
    profile: 'person-outline',
    timeOff: 'time-outline',
} as const;

const hasProfileSection = (user: StaffLike) => user?.features?.profile !== false;

export function getStaffNavSections(user: StaffLike, language: string): StaffNavSection[] {
    return [
        {
            route: 'appointments',
            href: '/(tabs)/appointments',
            kind: 'tab',
            labelEn: 'Appointments',
            labelAr: 'المواعيد',
            icon: 'appointments',
            descriptionEn: 'Live bookings and appointment actions.',
            descriptionAr: 'المواعيد المباشرة وإجراءات الحجز.',
            enabled: true,
        },
        {
            route: 'schedule',
            href: '/(tabs)/schedule',
            kind: 'tab',
            labelEn: 'Schedule',
            labelAr: 'الجدول',
            icon: 'schedule',
            descriptionEn: 'Shifts, availability, and time blocks.',
            descriptionAr: 'الدوام، التوفر، وفترات الحجز.',
            enabled: user?.features?.schedule !== false,
        },
        {
            route: 'customers',
            href: '/(tabs)/customers',
            kind: 'tab',
            labelEn: 'Customers',
            labelAr: 'العملاء',
            icon: 'customers',
            descriptionEn: 'Approved customer profiles and notes.',
            descriptionAr: 'ملفات العملاء والملاحظات المعتمدة.',
            enabled: canViewClients(user),
        },
        {
            route: 'reviews',
            href: '/(tabs)/reviews',
            kind: 'tab',
            labelEn: 'Reviews',
            labelAr: 'التقييمات',
            icon: 'reviews',
            descriptionEn: 'Reply to customer reviews.',
            descriptionAr: 'الرد على تقييمات العملاء.',
            enabled: canViewReviews(user),
        },
        {
            route: 'messages',
            href: '/(tabs)/messages',
            kind: 'tab',
            labelEn: 'Messages',
            labelAr: 'الرسائل',
            icon: 'messages',
            descriptionEn: 'Team inbox and internal messages.',
            descriptionAr: 'صندوق الرسائل الداخلي ورسائل الفريق.',
            enabled: canViewMessages(user),
        },
        {
            route: 'notifications',
            href: '/(tabs)/notifications',
            kind: 'tab',
            labelEn: 'Notifications',
            labelAr: 'الإشعارات',
            icon: 'notifications',
            descriptionEn: 'Push alerts and system notices.',
            descriptionAr: 'تنبيهات الدفع وإشعارات النظام.',
            enabled: user?.features?.pushNotifications !== false,
        },
        {
            route: 'earnings',
            href: '/(tabs)/earnings',
            kind: 'tab',
            labelEn: 'Earnings',
            labelAr: 'الأرباح',
            icon: 'earnings',
            descriptionEn: 'Revenue visibility and payout summaries.',
            descriptionAr: 'عرض الإيرادات وملخصات الصرف.',
            enabled: canViewEarnings(user),
        },
        {
            route: 'profile',
            href: '/(tabs)/profile',
            kind: 'tab',
            labelEn: 'Profile',
            labelAr: 'الملف الشخصي',
            icon: 'profile',
            descriptionEn: 'Account, language, and security settings.',
            descriptionAr: 'الحساب واللغة وأمان البيانات.',
            enabled: hasProfileSection(user),
        },
        {
            route: 'request-time-off',
            href: '/(modals)/request-time-off',
            kind: 'action',
            labelEn: 'Time off',
            labelAr: 'الإجازات',
            icon: 'timeOff',
            descriptionEn: 'Leave requests and availability exceptions.',
            descriptionAr: 'طلبات الإجازة والاستثناءات.',
            enabled: canRequestTimeOff(user),
        },
    ];
}

export function getVisibleStaffTabSections(user: StaffLike, language: string): StaffNavSection[] {
    const enabledTabs = getStaffNavSections(user, language).filter((section) => section.enabled && section.kind === 'tab');
    if (enabledTabs.length <= 4) {
        return enabledTabs;
    }

    return enabledTabs.slice(0, 3);
}

export function getOverflowStaffSections(user: StaffLike, language: string): StaffNavSection[] {
    const allSections = getStaffNavSections(user, language).filter((section) => section.enabled);
    const visibleTabs = getVisibleStaffTabSections(user, language);
    const visibleRoutes = new Set(visibleTabs.map((section) => section.route));
    const overflowTabs = allSections.filter((section) => section.kind === 'tab' && !visibleRoutes.has(section.route));
    const actionSections = allSections.filter((section) => section.kind === 'action');

    return [...overflowTabs, ...actionSections];
}
