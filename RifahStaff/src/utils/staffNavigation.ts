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
            route: 'schedule',
            href: '/(tabs)/schedule',
            kind: 'tab',
            labelEn: 'Schedule',
            labelAr: 'الجدول',
            icon: 'appointments',
            descriptionEn: 'Live bookings and appointment actions.',
            descriptionAr: 'المواعيد المباشرة وإجراءات الحجز.',
            enabled: true,
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
            route: 'messages',
            href: '/(tabs)/messages',
            kind: 'tab',
            labelEn: 'Inbox',
            labelAr: 'الرسائل',
            icon: 'messages',
            descriptionEn: 'Team inbox and internal messages.',
            descriptionAr: 'صندوق الرسائل الداخلي ورسائل الفريق.',
            enabled: canViewMessages(user),
        },
        {
            route: 'account',
            href: '/(tabs)/account',
            kind: 'tab',
            labelEn: 'Account',
            labelAr: 'الحساب',
            icon: 'profile',
            descriptionEn: 'Account, earnings, and settings.',
            descriptionAr: 'الحساب والأرباح والإعدادات.',
            enabled: true, // Always visible
        },
    ];
}

export function getVisibleStaffTabSections(user: StaffLike, language: string): StaffNavSection[] {
    return getStaffNavSections(user, language).filter((section) => section.enabled && section.kind === 'tab');
}

// Retained for backward compatibility if any legacy component imports it
export function getOverflowStaffSections(user: StaffLike, language: string): StaffNavSection[] {
    return [];
}
