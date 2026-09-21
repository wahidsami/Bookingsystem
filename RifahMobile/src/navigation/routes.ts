import { NavigatorScreenParams } from '@react-navigation/native';
import { Tenant, Service, Staff } from '../api/client';

/**
 * Authoritative Route Constants for Customer App 2.0
 * 
 * Strict classification:
 * - CANONICAL: Primary, modern destinations
 * - TRANSITION: Active legacy transition screens awaiting later phase modernization
 * - LEGACY_COMPATIBILITY: Supporting compatibility aliases
 */
export const ROUTES = {
  CANONICAL: {
    // Bottom Tab Destinations
    HOME: 'Home',
    APPOINTMENTS: 'Appointments',
    PURCHASES: 'Purchases',
    ME: 'Me',

    // Root Stack Destinations
    SEARCH: 'Search',
    TENANT: 'Tenant',
    BOOKING: 'Booking',
    NOTIFICATIONS: 'Notifications',
    NOTIFICATION_DETAIL: 'NotificationDetail',
    PROFILE: 'Profile',
    EDIT_PROFILE: 'EditProfile',
    SETTINGS: 'Settings',
    INFO_PAGE: 'InfoPage',
    CART: 'Cart',
    SERVICE_BOOKING_CART: 'ServiceBookingCart',
    GIFTS: 'Gifts',
    WALLET_BALANCE_DETAILS: 'WalletBalanceDetails',
    TENANT_WALLET_DETAILS: 'TenantWalletDetails',
    CENTERS_BALANCE: 'CentersBalance',
    APPOINTMENT_DETAILS: 'AppointmentDetails',
    APPOINTMENT_INVITE: 'AppointmentInvite',
    SERVICE_DETAILS: 'ServiceDetails',
    PRODUCT_DETAILS: 'ProductDetails',
    PAYMENT: 'Payment',
    PAYMENT_SUCCESS: 'PaymentSuccess',
    REVIEW: 'Review',
    EMPLOYEE_PROFILE: 'EmployeeProfile',
    HOT_DEAL_DETAIL: 'HotDealDetail',
    SAVED_ADDRESSES: 'SavedAddresses',
    PURCHASE_DETAILS: 'PurchaseDetails',
  },
  TRANSITION: {
    BROWSE: 'Browse', // Category browsing transition screen awaiting Phase 5
    SERVICE_BROWSER: 'ServiceBrowser', // In-tenant service browser transition
  },
  LEGACY_COMPATIBILITY: {
    MY_PURCHASES: 'MyPurchases', // Root stack alias for Purchases tab
    BOOKINGS: 'Bookings', // Legacy alias used in DashboardScreen
  },
} as const;

/**
 * Bottom Tab Navigator Parameter List
 */
export type TabParamList = {
  Home: undefined;
  Appointments: undefined;
  Purchases: undefined;
  Me: undefined;
};

/**
 * Root Stack Navigator Parameter List
 */
export type RootStackParamList = {
  // Nested Tab Navigator
  Tabs: NavigatorScreenParams<TabParamList> | undefined;

  // Canonical Root Screens
  Search: { query?: string } | undefined;
  Tenant: { tenantId: string; slug?: string; tenant?: Tenant };
  Booking: { tenantId?: string; serviceId?: string } | undefined;
  Notifications: undefined;
  NotificationDetail: { notificationId?: string; campaignId?: string };
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  SavedAddresses: undefined;
  InfoPage: { pageType: 'support' | 'about' | 'privacy' };
  Cart: { tenant?: Tenant } | undefined;
  ServiceBookingCart: undefined;
  Gifts: { claimToken?: string; tenantClaimToken?: string; tenantId?: string; tenantName?: string; previewOnly?: boolean } | undefined;
  WalletBalanceDetails: { walletBalance?: number; history?: any } | undefined;
  TenantWalletDetails: { tenantId: string; tenantName?: string; tenantLogo?: string; tenantAddress?: string; balance?: number } | undefined;
  CentersBalance: { centersBalance?: any; history?: any } | undefined;
  AppointmentDetails: { bookingGroup: any; activeTab?: string };
  AppointmentInvite: { token: string };
  ServiceDetails: { serviceId?: string; service?: Service; tenantId?: string; tenant?: Tenant };
  ProductDetails: { product: any; tenant?: Tenant };
  Payment: {
    orderId?: string;
    totalAmount?: number;
    appointmentId?: string;
    bookingReference?: string;
    checkoutType?: 'service' | 'product';
    [key: string]: any;
  };
  PaymentSuccess: {
    appointmentId?: string;
    orderId?: string;
    bookingReference?: string;
    [key: string]: any;
  };
  Review: { appointmentId: string };
  EmployeeProfile: { provider: Staff; tenant?: Tenant };
  HotDealDetail: { dealId?: string; tenantId?: string; [key: string]: any };
  PurchaseDetails: { purchaseId: string; order?: any };

  // Transition Screens (Category & In-Tenant Browser)
  Browse: { category?: string; title?: string } | undefined;
  ServiceBrowser: { tenantId?: string; slug?: string; tenant?: Tenant; [key: string]: any };

  // Legacy Compatibility Aliases
  MyPurchases: { orderId?: string } | undefined;
};
