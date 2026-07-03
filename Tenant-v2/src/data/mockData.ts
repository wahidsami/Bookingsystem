import { Appointment, Customer, Employee, Service, Product } from '../types';

export const mockStats = {
  revenueSAR: 48920,
  revenueGrowth: '+12.4%',
  appointmentsCount: 312,
  appointmentsGrowth: '+8.2%',
  newCustomers: 45,
  newCustomersGrowth: '+15.1%',
  occupancyRate: '84%',
  occupancyGrowth: '+4.5%',
};

export const mockAppointments: Appointment[] = [
  {
    id: 'APT-101',
    customerName: 'سارة عبد الله',
    customerPhone: '+966 50 123 4567',
    serviceName: 'جل تجميل أظافر وسيشوار مائي',
    employeeName: 'نادين الحربي',
    date: '2026-06-27',
    time: '14:30',
    duration: '60 دقيقة',
    price: '280 ر.س',
    status: 'confirmed',
  },
  {
    id: 'APT-102',
    customerName: 'مها الشمري',
    customerPhone: '+966 54 876 5432',
    serviceName: 'مساج الأحجار الساخنة الفاخر',
    employeeName: 'إيلينا فاسيلي',
    date: '2026-06-27',
    time: '16:00',
    duration: '90 دقيقة',
    price: '450 ر.س',
    status: 'pending',
  },
  {
    id: 'APT-103',
    customerName: 'أروى العتيبي',
    customerPhone: '+966 56 345 6789',
    serviceName: 'تنظيف وجه هيدرافيشال مكثف',
    employeeName: 'ليلى العسيري',
    date: '2026-06-27',
    time: '17:30',
    duration: '45 دقيقة',
    price: '380 ر.س',
    status: 'completed',
  },
  {
    id: 'APT-104',
    customerName: 'فاطمة الدوسري',
    customerPhone: '+966 55 987 6543',
    serviceName: 'قص أطراف وصبغ أولابليكس رفيع',
    employeeName: 'نادين الحربي',
    date: '2026-06-28',
    time: '11:00',
    duration: '120 دقيقة',
    price: '650 ر.س',
    status: 'confirmed',
  },
  {
    id: 'APT-105',
    customerName: 'هدى القحطاني',
    customerPhone: '+966 53 456 7890',
    serviceName: 'جلسة علاج الشعر بالبروتين العضوي',
    employeeName: 'منى الرويلي',
    date: '2026-06-28',
    time: '13:00',
    duration: '180 دقيقة',
    price: '900 ر.س',
    status: 'cancelled',
  },
];

export const mockCustomers: Customer[] = [
  {
    id: 'CUST-001',
    name: 'سارة عبد الله',
    email: 'sarah.a@gmail.com',
    phone: '+966 50 123 4567',
    appointmentsCount: 14,
    totalSpent: '3,840 ر.س',
    lastVisit: '2026-06-20',
  },
  {
    id: 'CUST-002',
    name: 'مها الشمري',
    email: 'maha.sh@hotmail.com',
    phone: '+966 54 876 5432',
    appointmentsCount: 8,
    totalSpent: '2,450 ر.س',
    lastVisit: '2026-06-25',
  },
  {
    id: 'CUST-003',
    name: 'أروى العتيبي',
    email: 'arwa_beauty@yahoo.com',
    phone: '+966 56 345 6789',
    appointmentsCount: 22,
    totalSpent: '7,120 ر.س',
    lastVisit: '2026-06-27',
  },
  {
    id: 'CUST-004',
    name: 'فاطمة الدوسري',
    email: 'fatimah.d@outlook.com',
    phone: '+966 55 987 6543',
    appointmentsCount: 3,
    totalSpent: '950 ر.س',
    lastVisit: '2026-05-18',
  },
  {
    id: 'CUST-005',
    name: 'نجلاء آل سعود',
    email: 'najla.as@vip.gov.sa',
    phone: '+966 50 999 8888',
    appointmentsCount: 45,
    totalSpent: '18,600 ر.س',
    lastVisit: '2026-06-26',
  },
];

export const mockEmployees: Employee[] = [
  {
    id: 'EMP-001',
    nameAr: 'نادين الحربي',
    nameEn: 'Nadeen Al-Harbi',
    roleAr: 'أخصائية شعر وتصفيف كبار شخصيات',
    roleEn: 'Senior Hair Stylist (VIP)',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop',
    rating: 4.9,
    status: 'active',
  },
  {
    id: 'EMP-002',
    nameAr: 'ليلى العسيري',
    nameEn: 'Layla Al-Asiri',
    roleAr: 'أخصائية عناية بالبشرة وتنظيف علاجي',
    roleEn: 'Skincare Specialist',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=200&auto=format&fit=crop',
    rating: 4.8,
    status: 'active',
  },
  {
    id: 'EMP-003',
    nameAr: 'إيلينا فاسيلي',
    nameEn: 'Elena Vasily',
    roleAr: 'أخصائية علاج طبيعي ومساج تايلاندي',
    roleEn: 'Massage Therapist',
    avatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?q=80&w=200&auto=format&fit=crop',
    rating: 4.7,
    status: 'break',
  },
  {
    id: 'EMP-004',
    nameAr: 'منى الرويلي',
    nameEn: 'Mona Al-Ruwaiti',
    roleAr: 'خبيرة مكياج وعروس ومناسبات فاخرة',
    roleEn: 'Celebrity Makeup Artist',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
    rating: 5.0,
    status: 'active',
  },
  {
    id: 'EMP-005',
    nameAr: 'ريم القاسم',
    nameEn: 'Reem Al-Qasim',
    roleAr: 'خبيرة تجميل ورسم أظافر فني',
    roleEn: 'Nail Artist Specialist',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop',
    rating: 4.6,
    status: 'off',
  },
];

export const mockServices: Service[] = [
  {
    id: 'SRV-001',
    nameAr: 'جلسة مساج السويدي الملكي بالأروما',
    nameEn: 'Royal Swedish Massage with Aromatherapy',
    duration: 90,
    price: 450,
    categoryAr: 'علاجات ومساج',
    categoryEn: 'Massage & Therapy',
  },
  {
    id: 'SRV-002',
    nameAr: 'تنظيف بشرة هيدرافيشال بلاتينيوم مكثف',
    nameEn: 'Platinum Hydrafacial Skincare Treatment',
    duration: 60,
    price: 380,
    categoryAr: 'عناية بالبشرة',
    categoryEn: 'Skincare',
  },
  {
    id: 'SRV-003',
    nameAr: 'تصفيف شعر فاخر (قص + غسيل + سيشوار)',
    nameEn: 'Premium Hair Styling (Cut + Wash + Blowdry)',
    duration: 75,
    price: 290,
    categoryAr: 'العناية بالشعر',
    categoryEn: 'Hair Care',
  },
  {
    id: 'SRV-004',
    nameAr: 'باديكير ومانيكير كولاجين سبا عميق',
    nameEn: 'Collagen Deep Spa Pedicure & Manicure',
    duration: 60,
    price: 180,
    categoryAr: 'عناية بالأظافر',
    categoryEn: 'Nail Care',
  },
  {
    id: 'SRV-005',
    nameAr: 'علاج الشعر العضوي بالكيراتين النباتي',
    nameEn: 'Organic Vegan Keratin Hair Treatment',
    duration: 180,
    price: 850,
    categoryAr: 'العناية بالشعر',
    categoryEn: 'Hair Care',
  },
];

export const mockProducts: Product[] = [
  {
    id: 'PRD-001',
    nameAr: 'زيت علاجي مغذي للشعر بالبروتين والمغنيسيوم',
    nameEn: 'Nutrient Hair Therapy Oil with Protein',
    sku: 'REF-OIL-091',
    price: 240,
    stock: 45,
    categoryAr: 'منتجات الشعر',
    categoryEn: 'Hair Products',
  },
  {
    id: 'PRD-002',
    nameAr: 'سيروم حمض الهيالورونيك العضوي النقي ٣٪',
    nameEn: 'Organic Pure Hyaluronic Acid 3% Serum',
    sku: 'REF-HYA-122',
    price: 310,
    stock: 18,
    categoryAr: 'منتجات البشرة',
    categoryEn: 'Skincare Products',
  },
  {
    id: 'PRD-003',
    nameAr: 'مقشر الملح البحري واللافندر للاستجمام',
    nameEn: 'Spa Sea Salt & Lavender Body Scrub',
    sku: 'REF-SCRB-004',
    price: 150,
    stock: 82,
    categoryAr: 'منتجات الجسم',
    categoryEn: 'Body Products',
  },
  {
    id: 'PRD-004',
    nameAr: 'شامبو الترطيب العميق العضوي الخالي من السلفات',
    nameEn: 'Sulfate-Free Organic Deep Hydration Shampoo',
    sku: 'REF-SHMP-332',
    price: 110,
    stock: 12,
    categoryAr: 'منتجات الشعر',
    categoryEn: 'Hair Products',
  },
  {
    id: 'PRD-005',
    nameAr: 'قناع الطين المغربي لتنقية خلايا البشرة',
    nameEn: 'Pure Moroccan Clay Mask for Skin Purification',
    sku: 'REF-CLAY-881',
    price: 185,
    stock: 0, // Out of stock to show inventory badge warning!
    categoryAr: 'منتجات البشرة',
    categoryEn: 'Skincare Products',
  },
];

export const mockTransactions = [
  { id: 'TXN-4001', date: '2026-06-27 19:42', typeAr: 'فاتورة مبيعات POS', typeEn: 'POS Sales Receipt', methodAr: 'مدى (Mada)', methodEn: 'Mada Card', amount: '630 ر.س', status: 'success' },
  { id: 'TXN-4002', date: '2026-06-27 18:10', typeAr: 'عربون حجز إلكتروني', typeEn: 'Online Booking Deposit', methodAr: 'فيزا (Visa)', methodEn: 'Visa', amount: '150 ر.س', status: 'success' },
  { id: 'TXN-4003', date: '2026-06-27 16:15', typeAr: 'شراء بطاقة هدايا', typeEn: 'Gift Card Purchase', methodAr: 'أبل باي (Apple Pay)', methodEn: 'Apple Pay', amount: '500 ر.س', status: 'success' },
  { id: 'TXN-4004', date: '2026-06-27 14:05', typeAr: 'فاتورة مبيعات POS', typeEn: 'POS Sales Receipt', methodAr: 'نقداً', methodEn: 'Cash', amount: '280 ر.س', status: 'success' },
  { id: 'TXN-4005', date: '2026-06-27 11:30', typeAr: 'استرجاع مبيعات', typeEn: 'POS Return Refund', methodAr: 'مدى (Mada)', methodEn: 'Mada Card', amount: '-110 ر.س', status: 'refunded' },
];

export const mockCampaigns = [
  { nameAr: 'حملة العيد الفاخر لعملاء VIP', nameEn: 'Royal Eid VIP Campaign', statusAr: 'نشطة حالياً', statusEn: 'Active Now', sent: 1420, clicks: '84%', conversion: '12.3%', channel: 'SMS & Email' },
  { nameAr: 'عروض الصيف الاستوائي للاسترخاء', nameEn: 'Tropical Summer Spa Promo', statusAr: 'مجدولة', statusEn: 'Scheduled', sent: 3500, clicks: '0%', conversion: '0%', channel: 'WhatsApp Broadcast' },
  { nameAr: 'خصم ٢٠٪ لأول حجز عبر الرابط', nameEn: 'First-time online booking 20% off', statusAr: 'مكتملة', statusEn: 'Completed', sent: 890, clicks: '92%', conversion: '18.7%', channel: 'Instagram Link' },
];

export const mockGiftCards = [
  { code: 'REF-GFT-9821-SA', value: '500 ر.س', sender: 'نورة السديري', recipient: 'عبير بن لادن', statusAr: 'غير مفعلة بعد', statusEn: 'Unused / Active', expiry: '2027-06-27' },
  { code: 'REF-GFT-1104-SA', value: '1000 ر.س', sender: 'رانية الجفالي', recipient: 'د. لولوة الباز', statusAr: 'مستعملة جزئياً (باقي 250)', statusEn: 'Partially Used (250 left)', expiry: '2027-03-15' },
  { code: 'REF-GFT-5092-SA', value: '300 ر.س', sender: 'لينا السليمان', recipient: 'جود الراجحي', statusAr: 'مستهلكة بالكامل', statusEn: 'Fully Redeemed', expiry: '2026-05-10' },
];

export const mockLoyalty = [
  { tierAr: 'الفئة الماسية العليا VIP', tierEn: 'Diamond Elite VIP Tier', count: 124, reqSpendAr: '10,000 ر.س / سنوياً', reqSpendEn: '10,000 SAR / Yr', benefitsAr: 'خصم ٢٠٪ ثابت + حجوزات فورية + خدمات مجانية بصفة دورية', benefitsEn: '20% Flat Discount + Instant Bookings + Free Periodic Spa services' },
  { tierAr: 'الفئة البلاتينية الفاخرة', tierEn: 'Platinum Prestige Tier', count: 489, reqSpendAr: '5,000 ر.س / سنوياً', reqSpendEn: '5,000 SAR / Yr', benefitsAr: 'خصم ١٥٪ ثابت + مشروب ضيافة فاخر في كل زيارة', benefitsEn: '15% Flat Discount + Complimentary Luxury Welcome Drink' },
  { tierAr: 'الفئة الذهبية الأنيقة', tierEn: 'Elegant Gold Tier', count: 1205, reqSpendAr: '2,000 ر.س / سنوياً', reqSpendEn: '2,000 SAR / Yr', benefitsAr: 'خصم ١٠٪ ثابت + نقاط ترحيب مضاعفة', benefitsEn: '10% Flat Discount + Double Welcome Points' },
];

export const mockReviews = [
  { customer: 'هيا البنيان', rating: 5, commentAr: 'تجربة استثنائية بكل المعايير! الفرع غاية في الفخامة والروعة، ونادين الحربي فنانة حقيقية بالقص والصبغ. سأكرر الزيارة بالتأكيد.', commentEn: 'An exceptional experience by all standards! The branch is extremely luxurious and beautiful, and Nadeen Al-Harbi is a true artist in cutting and coloring. I will definitely visit again.', date: 'اليوم' },
  { customer: 'غادة عبد اللطيف', rating: 5, commentAr: 'جلسة الهيدرافيشال لغرفة العناية الفاخرة نقلتني لعالم آخر من الاستجمام. ليلى كانت متعاونة ولطيفة جداً وتعرف مصلحة بشرتي.', commentEn: 'The hydrafacial treatment in the luxury room took me to another world of relaxation. Layla was very helpful and knew exactly what my skin needed.', date: 'أمس' },
  { customer: 'أمل الخالدي', rating: 4, commentAr: 'مساج الأحجار الساخنة ممتاز جداً ومريح للأعصاب. فقط تمنيت لو كانت موسيقى الخلفية في الغرفة أكثر هدوءاً بعض الشيء.', commentEn: 'The hot stone massage is excellent and very relaxing. I only wished the background music in the spa room was slightly quieter.', date: 'منذ ٣ أيام' },
];

export const mockInvoices = [
  { id: 'INV-2026-0091', date: '2026-06-01', amount: '2,400 ر.س', statusAr: 'مدفوعة', statusEn: 'Paid', periodAr: 'يونيو ٢٠٢٦', periodEn: 'June 2026' },
  { id: 'INV-2026-0082', date: '2026-05-01', amount: '2,400 ر.س', statusAr: 'مدفوعة', statusEn: 'Paid', periodAr: 'مايو ٢٠٢٦', periodEn: 'May 2026' },
  { id: 'INV-2026-0073', date: '2026-04-01', amount: '2,400 ر.س', statusAr: 'مدفوعة', statusEn: 'Paid', periodAr: 'أبريل ٢٠٢٦', periodEn: 'April 2026' },
];
