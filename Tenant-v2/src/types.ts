export type Language = 'ar' | 'en';

export type QuickLaunchTarget = 'appointment' | 'customer' | 'service' | 'product' | 'employee' | 'giftcard';

export interface QuickLaunchRequest {
  target: QuickLaunchTarget;
  nonce: number;
  serviceId?: string;
  section?: 'basic' | 'team' | 'options' | 'settings';
}

export type ViewType =
  | 'dashboard'
  | 'appointments'
  | 'customers'
  | 'employees'
  | 'services'
  | 'packages'
  | 'products'
  | 'pos'
  | 'financial'
  | 'reports'
  | 'marketing'
  | 'giftcards'
  | 'loyalty'
  | 'reviews'
  | 'inventory'
  | 'subscription'
  | 'billing'
  | 'settings'
  | 'messages'
  | 'support'
  | 'marketing-hot-deals'
  | 'marketing-gift-cards'
  | 'marketing-notifications'
  | 'marketing-reviews'
  | 'marketing-page-setup';

export interface NavigationItem {
  id: ViewType;
  labelAr: string;
  labelEn: string;
  iconName: string; // Used to look up Lucide icons dynamically or we can map them
  category: 'core' | 'operations' | 'growth' | 'management';
  badgeAr?: string;
  badgeEn?: string;
}

export interface TabItem {
  id: string; // Unique instance ID
  view: ViewType;
  titleAr: string;
  titleEn: string;
}

export interface RecentItem {
  id: string;
  titleAr: string;
  titleEn: string;
  typeAr: string;
  typeEn: string;
  timestampAr: string;
  timestampEn: string;
  view: ViewType;
}

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  employeeName: string;
  date: string;
  time: string;
  duration: string;
  price: string;
  status: 'confirmed' | 'pending' | 'completed' | 'cancelled';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  appointmentsCount: number;
  totalSpent: string;
  lastVisit: string;
}

export interface Service {
  id: string;
  nameAr: string;
  nameEn: string;
  duration: number; // minutes
  price: number; // SAR
  categoryAr: string;
  categoryEn: string;
}

export interface Product {
  id: string;
  nameAr: string;
  nameEn: string;
  sku: string;
  price: number; // SAR
  stock: number;
  categoryAr: string;
  categoryEn: string;
}

export interface Employee {
  id: string;
  nameAr: string;
  nameEn: string;
  roleAr: string;
  roleEn: string;
  avatar: string;
  rating: number;
  status: 'active' | 'break' | 'off';
}
