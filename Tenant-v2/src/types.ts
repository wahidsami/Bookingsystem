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
  | 'services2'
  | 'packages'
  | 'products'
  | 'orders'
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
  | 'marketing-page-setup'
  | 'audit';

export type OrderFulfillmentStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_for_pickup'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type OrderPaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type OrderPaymentMethod =
  | 'online'
  | 'cash_on_delivery'
  | 'pay_on_visit'
  | 'split'
  | 'cash'
  | 'card_pos'
  | 'wallet';

export type OrderDeliveryType = 'pickup' | 'delivery';

export interface TenantOrderItemProduct {
  id: string;
  name_en: string;
  name_ar?: string;
  image?: string;
  category?: string;
  price?: number | string;
}

export interface TenantOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productNameAr?: string;
  quantity: number;
  unitPrice: number | string;
  taxAmount: number | string;
  totalPrice: number | string;
  product?: TenantOrderItemProduct;
}

export interface TenantOrderUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  photo?: string;
}

export interface TenantOrderPaymentTransaction {
  id: string;
  type: 'deposit' | 'remainder' | 'full' | 'refund';
  amount: number | string;
  paymentMethod: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  transactionRef?: string | null;
  notes?: string | null;
  processedAt: string;
  processor?: {
    id: string;
    name: string;
  } | null;
}

export interface TenantOrderShippingAddress {
  street?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  notes?: string;
  buildingNumber?: string;
  floor?: string;
  apartment?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface TenantOrder {
  id: string;
  orderNumber: string;
  platformUserId: string;
  tenantId: string;
  status: OrderFulfillmentStatus;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: OrderPaymentStatus;
  subtotal: number | string;
  taxAmount: number | string;
  shippingFee: number | string;
  platformFee: number | string;
  totalAmount: number | string;
  deliveryType: OrderDeliveryType;
  shippingAddress?: TenantOrderShippingAddress | null;
  pickupDate?: string | null;
  trackingNumber?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: TenantOrderUser;
  items?: TenantOrderItem[];
  paymentTransactions?: TenantOrderPaymentTransaction[];
  tenant?: {
    id: string;
    name: string;
    name_en?: string;
    name_ar?: string;
    logo?: string;
    phone?: string;
    email?: string;
  };
}

export interface TenantOrderStats {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
}

export interface TenantOrderPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TenantOrdersResponse {
  success: boolean;
  orders: TenantOrder[];
  pagination: TenantOrderPagination;
  stats: TenantOrderStats;
}

export interface TenantOrderDetailResponse {
  success: boolean;
  order: TenantOrder;
}

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
