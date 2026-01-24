export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  image: string;
  rating: number;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  image: string;
  rating: number;
  specialties: string[];
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  service: string;
}

export interface BookingData {
  serviceId?: string;
  date?: string;
  time?: string;
  serviceType?: 'in-center' | 'home-visit';
  staffId?: string;
  paymentMethod?: 'at-center' | 'online-full' | 'booking-fee';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  specialRequests?: string;
  location?: string;
  bookingReference?: string;
}

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  category: 'Skincare' | 'Oils' | 'Hair Care' | 'Tools' | 'Sets';
  image: string;
  images: string[];
  rating: number;
  reviewCount: number;
  ingredients?: string;
  usage?: string;
  benefits?: string[];
  sizes?: string[];
  inStock: boolean;
}

export interface ProductReview {
  id: string;
  productId: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
}

export interface CheckoutData {
  fullName?: string;
  phone?: string;
  email?: string;
  deliveryType?: 'pickup' | 'delivery';
  city?: string;
  district?: string;
  street?: string;
  building?: string;
  paymentMethod?: 'pay-on-delivery' | 'online' | 'booking-fee';
}
