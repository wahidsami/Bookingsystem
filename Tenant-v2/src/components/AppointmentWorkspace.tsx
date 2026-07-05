import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Clock, Plus, Search, User, Users, Check, X, 
  ChevronLeft, ChevronRight, CreditCard, Tag, MessageSquare, MapPin, 
  Activity, Wallet, ChevronDown, Trash, Undo2, AlertCircle, Filter, 
  SlidersHorizontal, Star, Split, Share2, Printer, CheckCircle2,
  Lock, Scissors, Sparkles, Smile, ShieldCheck, Mail, Phone,
  TrendingUp, CircleDot, AlertTriangle, FileText, RefreshCw, Copy,
  PlusCircle, Coffee, Heart, ShoppingBag, Receipt, Gift
} from 'lucide-react';
import { Language, Product } from '../types';
import InteractiveDrawers from './InteractiveDrawers';
import EmployeeWeeklyScheduleEditor from './EmployeeWeeklyScheduleEditor';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface AppointmentWorkspaceProps {
  lang: Language;
  onQuickAction: (type: any) => void;
}

// Full types
interface Stylist {
  id: string;
  nameEn: string;
  nameAr: string;
  avatar: string;
  roleEn: string;
  roleAr: string;
  color: string;
}

interface Appointment {
  id: string;
  customerId?: string;
  serviceId?: string;
  service?: any;
  bookingSessionId?: string;
  bookingReference?: string;
  bookingItemIndex?: number;
  customerNameEn: string;
  customerNameAr: string;
  serviceNameEn: string;
  serviceNameAr: string;
  staffId: string;
  startTime: number; // minutes from 9:00 AM (0 to 720 for 12 hours)
  duration: number; // minutes
  status: 'confirmed' | 'arrived' | 'completed' | 'cancelled';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  isGroupBooking: boolean;
  guestCount?: number;
  hasNotes: boolean;
  notes?: string;
  price: number;
  tags: string[];
  customerPhone?: string;
  customerEmail?: string;
  loyaltyTier?: string;
  walletBalance?: number;
  totalPaid?: number;
  remainderAmount?: number;
  branchName?: string;
  branch?: { name?: string };
  invoiceStatus?: string;
  assignedStaffName?: string;
  serviceName?: string;
  nameEn?: string;
  nameAr?: string;
  name?: string;
  paymentAllocations?: any[];
  services?: any[];
  serviceItems?: any[];
  lineItems?: any[];
  invoiceItems?: any[];
  products?: any[];
  productItems?: any[];
  retailItems?: any[];
  membershipTier?: string;
  membershipStatus?: string;
  membershipLabel?: string;
  salonNotes?: string | string[];
  preferences?: string | string[];
  allergies?: string | string[];
  hairFormula?: string | string[];
  medicalNotes?: string | string[];
  notesSummary?: string | string[];
  internalNotes?: string | string[];
  type?: 'appointment' | 'blocked';
  blockedType?: 'Break' | 'Lunch' | 'Meeting';
  serviceCategory?: 'hair' | 'spa' | 'nails';
  date?: string;
}

const API_COLORS = [
  'border-amber-500 bg-amber-500/10 text-amber-900',
  'border-emerald-500 bg-emerald-500/10 text-emerald-900',
  'border-rose-500 bg-rose-500/10 text-rose-900',
  'border-blue-500 bg-blue-500/10 text-blue-900',
  'border-indigo-500 bg-indigo-500/10 text-indigo-900',
  'border-purple-500 bg-purple-500/10 text-purple-900'
];

export default function AppointmentWorkspace({ lang, onQuickAction }: AppointmentWorkspaceProps) {
  const isRtl = lang === 'ar';
  
  // New API States replacing mock data
  const [liveStylists, setLiveStylists] = useState<Stylist[]>([]);
  const [liveServices, setLiveServices] = useState<any[]>([]);
  const [liveCustomers, setLiveCustomers] = useState<any[]>([]);
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [stylistStatuses, setStylistStatuses] = useState<Record<string, 'active' | 'break' | 'off'>>({});

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedStylistFilter, setSelectedStylistFilter] = useState<string>('all');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'agenda'>('day');

  // Master Data Fetch
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [empRes, srvRes, custRes, prodRes] = await Promise.all([
          tenantApiAdapter.getEmployees(),
          tenantApiAdapter.getServices(),
          tenantApiAdapter.getCustomers({ limit: 1000 }),
          tenantApiAdapter.getProducts()
        ]);
        
        const employees = empRes?.employees || [];
        setLiveStylists(employees.map((emp: any, index: number) => ({
          id: emp.id,
          nameEn: emp.name,
          nameAr: emp.name,
          roleEn: emp.title || 'Staff',
          roleAr: emp.title || 'موظف',
          avatar: emp.photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(emp.name),
          color: API_COLORS[index % API_COLORS.length]
        })));

        const services = srvRes?.services || [];
        setLiveServices(services.map((s: any) => ({
          nameEn: s.name_en || s.name || '',
          nameAr: s.name_ar || s.name || '',
          duration: s.duration || 60,
          price: s.finalPrice || s.price || 0,
          categoryAr: s.category || 'علاجات ومساج',
          categoryEn: s.category || 'Massage & Therapy'
        })));

        const customers = custRes?.customers || (custRes as any)?.data?.customers || [];
        setLiveCustomers(customers.map((c: any) => ({
          id: c.id,
          name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Guest',
          email: c.email || '',
          phone: c.phone || '',
          appointmentsCount: c.appointmentsCount || c.totalBookings || 0,
          totalSpent: `${c.totalSpent || 0} ر.س`,
          lastVisit: c.lastVisit || 'N/A'
        })));

        const products = prodRes?.products || [];
        setLiveProducts(products.map((p: any) => ({
          id: p.id,
          nameAr: p.name_ar || p.name,
          nameEn: p.name_en || p.name,
          sku: p.sku || 'SKU-GEN',
          price: p.finalPrice || p.price || 0,
          stock: p.stockQuantity || p.stock || 0,
          categoryAr: p.category || '',
          categoryEn: p.category || ''
        })));
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    };
    fetchMasterData();
  }, []);

  const mapBoardAppointment = (a: any, dateKey: string): Appointment => {
    const startDate = new Date(a.startTime);
    const startMins = startDate.getHours() * 60 + startDate.getMinutes() - 9 * 60;
    const sessionAppointments = Array.isArray(a.bookingSession?.appointments) ? a.bookingSession.appointments : [];
    const services = sessionAppointments.length > 0
      ? sessionAppointments
      : Array.isArray(a.services)
        ? a.services
        : Array.isArray(a.serviceItems)
          ? a.serviceItems
          : (a.service ? [a.service] : []);
    const lineItems = Array.isArray(a.lineItems) ? a.lineItems : Array.isArray(a.invoiceItems) ? a.invoiceItems : [];
    const products = Array.isArray(a.products) ? a.products : Array.isArray(a.productItems) ? a.productItems : Array.isArray(a.retailItems) ? a.retailItems : [];
    const normalizeServiceName = (item: any, key: 'en' | 'ar') => {
      if (key === 'en') {
        return item?.service?.name_en
          || item?.service?.nameEn
          || item?.service?.name
          || item?.serviceNameEn
          || item?.serviceName
          || item?.nameEn
          || item?.name
          || item?.title
          || '';
      }
      return item?.service?.name_ar
        || item?.service?.nameAr
        || item?.service?.name
        || item?.serviceNameAr
        || item?.serviceName
        || item?.nameAr
        || item?.name
        || item?.title
        || '';
    };
    const serviceNameEn = services.length > 1
      ? services.map((item: any) => normalizeServiceName(item, 'en')).filter(Boolean).join(' + ')
      : a.service?.name_en || a.service?.nameEn || a.service?.name || a.serviceNameEn || 'Service';
    const serviceNameAr = services.length > 1
      ? services.map((item: any) => normalizeServiceName(item, 'ar')).filter(Boolean).join(' + ')
      : a.service?.name_ar || a.service?.nameAr || a.service?.name || a.serviceNameAr || 'الخدمة';
    const duration = sessionAppointments.length > 0
      ? sessionAppointments.reduce((sum: number, item: any) => sum + Number(item?.duration || item?.service?.duration || 0), 0)
      : (a.service?.duration || a.duration || 60);
    const price = sessionAppointments.length > 0
      ? sessionAppointments.reduce((sum: number, item: any) => sum + Number(item?.price || item?.service?.price || 0), 0)
      : parseFloat(a.price || 0);
    return {
      id: a.id,
      customerId: a.user?.id || a.customerId,
      serviceId: a.service?.id || a.serviceId,
      bookingSessionId: a.bookingSession?.id || a.bookingSessionId || undefined,
      bookingReference: a.bookingSession?.bookingReference || a.bookingReference || undefined,
      bookingItemIndex: Number.isFinite(Number(a.bookingItemIndex)) ? Number(a.bookingItemIndex) : undefined,
      customerNameEn: a.user?.firstName ? `${a.user.firstName} ${a.user.lastName}` : a.customerNameEn || 'Walk-in',
      customerNameAr: a.user?.firstName ? `${a.user.firstName} ${a.user.lastName}` : a.customerNameAr || 'زائرة',
      serviceNameEn,
      serviceNameAr,
      staffId: a.staffId,
      startTime: startMins,
      duration,
      status: a.status,
      paymentStatus: a.paymentStatus,
      isGroupBooking: Boolean(a.isGroupBooking),
      guestCount: a.guestCount,
      hasNotes: !!a.notes,
      notes: a.notes,
      price,
      tags: Array.isArray(a.tags) ? a.tags : [],
      customerPhone: a.user?.phone || a.customerPhone,
      customerEmail: a.user?.email || a.customerEmail,
      loyaltyTier: a.loyaltyTier,
      walletBalance: a.walletBalance,
      totalPaid: a.totalPaid,
      remainderAmount: a.remainderAmount ?? a.remainingBalance ?? Math.max(0, (parseFloat(a.price || 0) || 0) - (parseFloat(a.totalPaid || 0) || 0)),
      branchName: a.branchName || a.branch?.name || a.locationName || a.location?.name,
      invoiceStatus: a.invoiceStatus || a.paymentStatus,
      assignedStaffName: a.staff?.name || a.staffName || '',
      paymentAllocations: Array.isArray(a.paymentAllocations) ? a.paymentAllocations : [],
      services,
      serviceItems: Array.isArray(a.serviceItems) ? a.serviceItems : [],
      lineItems,
      invoiceItems: Array.isArray(a.invoiceItems) ? a.invoiceItems : [],
      products,
      productItems: Array.isArray(a.productItems) ? a.productItems : [],
      retailItems: Array.isArray(a.retailItems) ? a.retailItems : [],
      membershipTier: a.membershipTier || a.membership?.tier || '',
      membershipStatus: a.membershipStatus || a.membership?.status || '',
      membershipLabel: a.membershipLabel || a.membership?.label || '',
      salonNotes: a.salonNotes || a.internalNotes || '',
      preferences: a.preferences || a.preferenceNotes || '',
      allergies: a.allergies || '',
      hairFormula: a.hairFormula || '',
      medicalNotes: a.medicalNotes || '',
      notesSummary: a.notesSummary || '',
      internalNotes: a.internalNotes || '',
      type: 'appointment',
      serviceCategory: a.service?.category || a.serviceCategory || 'hair',
      date: a.date || dateKey
    };
  };

  const groupBoardAppointments = (items: Appointment[]) => {
    const grouped = new Map<string, Appointment[]>();
    const standalone: Appointment[] = [];

    items.forEach((item) => {
      if (item.type === 'blocked') {
        standalone.push(item);
        return;
      }

      const groupingKey = item.bookingSessionId || item.bookingReference;
      if (!groupingKey) {
        standalone.push(item);
        return;
      }

      const bucket = grouped.get(groupingKey) || [];
      bucket.push(item);
      grouped.set(groupingKey, bucket);
    });

    const aggregateGroup = (group: Appointment[]): Appointment => {
      if (group.length === 1) {
        return group[0];
      }

      const primary = group[0];
      const serviceEntries = group.flatMap((item) => {
        if (Array.isArray(item.serviceItems) && item.serviceItems.length > 0) {
          return item.serviceItems;
        }
        if (Array.isArray(item.services) && item.services.length > 0) {
          return item.services;
        }
        if (item.serviceId || item.serviceNameEn || item.serviceNameAr) {
          return [{
            id: item.serviceId || `svc-${item.id}`,
            service: item.service || null,
            nameEn: item.serviceNameEn,
            nameAr: item.serviceNameAr,
            serviceNameEn: item.serviceNameEn || item.service?.name_en || item.service?.nameEn || item.service?.name || item.nameEn || item.name || '',
            serviceNameAr: item.serviceNameAr || item.service?.name_ar || item.service?.nameAr || item.service?.name || item.nameAr || item.name || '',
            duration: item.duration,
            price: item.price
          }];
        }
        return [];
      });
      const uniqueServiceEntries = serviceEntries.filter((entry, index, arr) => {
        const entryKey = `${entry?.id || entry?.serviceId || entry?.nameEn || entry?.nameAr || index}`;
        return arr.findIndex((candidate) => `${candidate?.id || candidate?.serviceId || candidate?.nameEn || candidate?.nameAr || ''}` === entryKey) === index;
      });
      const namesEn = uniqueServiceEntries
        .map((entry: any) => entry?.service?.name_en || entry?.name_en || entry?.serviceNameEn || entry?.nameEn || entry?.name || '')
        .filter(Boolean);
      const namesAr = uniqueServiceEntries
        .map((entry: any) => entry?.service?.name_ar || entry?.name_ar || entry?.serviceNameAr || entry?.nameAr || entry?.name || '')
        .filter(Boolean);
      const staffNames = Array.from(new Set(group.map((entry) => entry.assignedStaffName).filter(Boolean)));
      const sumDuration = group.reduce((sum, entry) => sum + Number(entry.duration || 0), 0);
      const sumPrice = group.reduce((sum, entry) => sum + Number(entry.price || 0), 0);
      const sumPaid = group.reduce((sum, entry) => sum + Number(entry.totalPaid || 0), 0);
      const sumRemainder = group.reduce((sum, entry) => sum + Number(entry.remainderAmount || 0), 0);
      const combinedLineItems = group.flatMap((entry) => Array.isArray(entry.lineItems) ? entry.lineItems : Array.isArray(entry.invoiceItems) ? entry.invoiceItems : []);
      const combinedProducts = group.flatMap((entry) => Array.isArray(entry.products) ? entry.products : Array.isArray(entry.productItems) ? entry.productItems : Array.isArray(entry.retailItems) ? entry.retailItems : []);
      const combinedTags = Array.from(new Set(group.flatMap((entry) => Array.isArray(entry.tags) ? entry.tags : [])));

      return {
        ...primary,
        id: primary.id,
        serviceId: primary.serviceId || group.find((entry) => entry.serviceId)?.serviceId,
        bookingSessionId: primary.bookingSessionId || undefined,
        bookingReference: primary.bookingReference || undefined,
        serviceNameEn: namesEn.length > 0 ? namesEn.join(' + ') : primary.serviceNameEn,
        serviceNameAr: namesAr.length > 0 ? namesAr.join(' + ') : primary.serviceNameAr,
        staffId: primary.staffId,
        assignedStaffName: staffNames.length > 0 ? staffNames.join(' + ') : primary.assignedStaffName,
        duration: sumDuration || primary.duration,
        price: sumPrice || primary.price,
        totalPaid: sumPaid || primary.totalPaid,
        remainderAmount: sumRemainder || primary.remainderAmount,
        hasNotes: group.some((entry) => entry.hasNotes),
        notes: group.map((entry) => entry.notes).filter(Boolean).join(' | ') || primary.notes,
        tags: combinedTags,
        services: uniqueServiceEntries,
        serviceItems: uniqueServiceEntries,
        lineItems: combinedLineItems,
        invoiceItems: combinedLineItems,
        products: combinedProducts,
        productItems: combinedProducts,
        retailItems: combinedProducts,
        paymentStatus: group.every((entry) => `${entry.paymentStatus || ''}` === 'paid')
          ? 'paid'
          : group.some((entry) => `${entry.paymentStatus || ''}` === 'partial')
            ? 'partial'
            : primary.paymentStatus,
        invoiceStatus: group.every((entry) => `${entry.invoiceStatus || ''}` === 'paid' || `${entry.paymentStatus || ''}` === 'paid')
          ? 'paid'
          : group.some((entry) => `${entry.paymentStatus || ''}` === 'partial')
            ? 'partial'
            : primary.invoiceStatus,
      };
    };

    return [
      ...standalone,
      ...Array.from(grouped.values()).map((group) => aggregateGroup(group))
    ].sort((left, right) => left.startTime - right.startTime);
  };

  const mapBoardBreak = (b: any): Appointment => {
    const [h, m] = (b.startTime || '12:00').split(':');
    const startMins = parseInt(h) * 60 + parseInt(m) - 9 * 60;
    const [eh, em] = (b.endTime || '13:00').split(':');
    const dur = (parseInt(eh) * 60 + parseInt(em)) - (parseInt(h) * 60 + parseInt(m));
    return {
      id: b.id,
      customerNameEn: b.label || b.type,
      customerNameAr: b.label || b.type,
      serviceNameEn: 'Staff Break',
      serviceNameAr: 'فترة راحة',
      staffId: b.staffId,
      startTime: startMins,
      duration: dur,
      status: 'confirmed',
      paymentStatus: 'paid',
      isGroupBooking: false,
      hasNotes: false,
      price: 0,
      tags: ['Blocked'],
      type: 'blocked',
      blockedType: b.type
    };
  };

  const loadBoardData = async () => {
    setIsLoading(true);
    try {
      const dateStr = selectedDate.toLocaleDateString('en-CA');
      const res = await tenantApiAdapter.getAppointmentsBoard(dateStr, {
        staffId: selectedStylistFilter === 'all' ? undefined : selectedStylistFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchQuery.trim() || undefined
      });
      if (res && res.success) {
        const mappedApts: Appointment[] = (res.appointments || []).map((a: any) => mapBoardAppointment(a, dateStr));
        const mappedBreaks: Appointment[] = (res.breaks || []).map((b: any) => mapBoardBreak(b));
        setAppointments([...groupBoardAppointments(mappedApts), ...mappedBreaks]);

        const newStatuses: Record<string, 'active'|'break'|'off'> = {};
        (res.breaks || []).forEach((b: any) => {
          newStatuses[b.staffId] = 'break';
        });
        setStylistStatuses(prev => ({ ...prev, ...newStatuses }));
      }
    } catch (err) {
      console.error('Failed to load board data', err);
    } finally {
      setTimeout(() => setIsLoading(false), 300);
    }
  };

  const getSelectedDateKey = () => selectedDate.toISOString().split('T')[0];
  const buildIsoFromMinutes = (dateKey: string, minutesFromNine: number) => {
    const safeMinutes = Math.max(0, Math.round(minutesFromNine));
    const base = new Date(`${dateKey}T00:00:00`);
    base.setHours(9 + Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0);
    return base.toISOString();
  };
  const buildClockTime = (minutesFromNine: number) => {
    const absoluteMinutes = 9 * 60 + Math.max(0, Math.round(minutesFromNine));
    const hours = Math.floor(absoluteMinutes / 60);
    const mins = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Board Data Fetch
  useEffect(() => {
    void loadBoardData();
  }, [selectedDate, selectedStylistFilter, statusFilter, searchQuery]);

  // Interactive hover tracking
  const [hoveredSlot, setHoveredSlot] = useState<{ staffId?: string; date?: string; timeInMinutes: number } | null>(null);
  
  // Selection / Detail Drawer State
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'financials' | 'timeline' | 'reviews'>('overview');
  const [activeStylistMenuId, setActiveStylistMenuId] = useState<string | null>(null);
  const [isCustomerProfileOpen, setIsCustomerProfileOpen] = useState(false);
  const [appointmentDetailsReadOnly, setAppointmentDetailsReadOnly] = useState(false);
  const [customerDrawerTab, setCustomerDrawerTab] = useState<'overview' | 'wallet' | 'appointments' | 'transactions' | 'reviews' | 'notes'>('overview');
  const [customerAppointmentHistoryFilter, setCustomerAppointmentHistoryFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled' | 'no_show'>('all');
  const [customerProfile, setCustomerProfile] = useState<any | null>(null);
  const [customerHistoryData, setCustomerHistoryData] = useState<any | null>(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [customerProfileError, setCustomerProfileError] = useState<string | null>(null);
  const [customerProfileRefreshToken, setCustomerProfileRefreshToken] = useState(0);
  const [customerTransactionsExpanded, setCustomerTransactionsExpanded] = useState(false);

  const activeAppointmentServiceSources = Array.isArray(activeAppointment?.bookingSession?.appointments) && activeAppointment.bookingSession.appointments.length > 0
    ? activeAppointment.bookingSession.appointments
    : Array.isArray(activeAppointment?.serviceItems) && activeAppointment.serviceItems.length > 0
      ? activeAppointment.serviceItems
      : Array.isArray(activeAppointment?.services) && activeAppointment.services.length > 0
        ? activeAppointment.services
        : [];

  const activeServiceSummary = (() => {
    const service = liveServices.find(s => s.id === activeAppointment?.serviceId);
    if (activeAppointmentServiceSources.length > 0) {
      const serviceNameEn = activeAppointmentServiceSources.map((item: any) => (
        item?.service?.name_en
        || item?.name_en
        || item?.service?.nameEn
        || item?.service?.name
        || item?.serviceNameEn
        || item?.serviceName
        || item?.nameEn
        || item?.name
        || item?.title
        || ''
      )).filter(Boolean);
      const serviceNameAr = activeAppointmentServiceSources.map((item: any) => (
        item?.service?.name_ar
        || item?.name_ar
        || item?.service?.nameAr
        || item?.service?.name
        || item?.serviceNameAr
        || item?.serviceName
        || item?.nameAr
        || item?.name
        || item?.title
        || ''
      )).filter(Boolean);
      const totalDuration = activeAppointmentServiceSources.reduce((sum: number, item: any) => sum + Number(item?.duration || item?.service?.duration || 0), 0);
      const totalPrice = activeAppointmentServiceSources.reduce((sum: number, item: any) => sum + Number(item?.price || item?.service?.price || item?.subtotal || 0), 0);
      return {
        nameEn: serviceNameEn.length > 0 ? serviceNameEn.join(' + ') : activeAppointment?.serviceNameEn || service?.nameEn || service?.name || 'Service',
        nameAr: serviceNameAr.length > 0 ? serviceNameAr.join(' + ') : activeAppointment?.serviceNameAr || service?.nameAr || service?.name || 'الخدمة',
        duration: totalDuration || activeAppointment?.duration || service?.duration || 60,
        price: totalPrice || activeAppointment?.price || service?.price || 0,
        categoryEn: service?.categoryEn || '',
        categoryAr: service?.categoryAr || ''
      };
    }
    return {
      nameEn: activeAppointment?.serviceNameEn && activeAppointment.serviceNameEn !== 'Service'
        ? activeAppointment.serviceNameEn
        : activeAppointment?.service?.name_en
          || activeAppointment?.service?.nameEn
          || activeAppointment?.service?.name
          || activeAppointment?.serviceName
          || activeAppointment?.requestedServiceName
          || service?.nameEn
          || 'Service',
      nameAr: activeAppointment?.serviceNameAr && activeAppointment.serviceNameAr !== 'الخدمة'
        ? activeAppointment.serviceNameAr
        : activeAppointment?.service?.name_ar
          || activeAppointment?.service?.nameAr
          || activeAppointment?.service?.name
          || activeAppointment?.serviceName
          || activeAppointment?.requestedServiceNameAr
          || service?.nameAr
          || 'الخدمة',
      duration: activeAppointment?.duration || service?.duration || 60,
      price: activeAppointment?.price || service?.price || 0,
      categoryEn: service?.categoryEn || '',
      categoryAr: service?.categoryAr || ''
    };
  })();

  const activeStylist = liveStylists.find(stylist => stylist.id === activeAppointment?.staffId);
  const activeCustomerName = isRtl
    ? (customerProfile?.nameAr || activeAppointment?.customerNameAr || activeAppointment?.customerNameEn || '—')
    : (customerProfile?.nameEn || activeAppointment?.customerNameEn || activeAppointment?.customerNameAr || '—');
  const activeCustomerPhone = customerProfile?.phone || activeAppointment?.customerPhone || '';
  const activeCustomerEmail = customerProfile?.email || activeAppointment?.customerEmail || '';
  const activeCustomerTier = customerProfile?.loyaltyTier || activeAppointment?.loyaltyTier || '';
  const activeCustomerWallet = Number(customerProfile?.walletBalance ?? activeAppointment?.walletBalance ?? 0);
  const activeCustomerBranch = activeAppointment?.branchName || activeAppointment?.branch?.name || '';
  const activeAppointmentTime = activeAppointment ? buildClockTime(activeAppointment.startTime) : '';
  const activeCustomerMembership = customerProfile?.membershipTier
    || customerProfile?.membershipStatus
    || activeAppointment?.membershipLabel
    || activeAppointment?.membershipStatus
    || activeAppointment?.membershipTier
    || '';

  const customerHistoryEntries = Array.isArray(customerHistoryData?.history) ? customerHistoryData.history : [];
  const customerSummaryData = customerHistoryData?.summary || {};
  const customerAppointmentHistory = customerHistoryEntries.filter((item: any) => {
    const kind = `${item?.type || item?.entityType || item?.kind || ''}`.toLowerCase();
    return kind === 'appointment' || kind === 'booking_session' || Boolean(item?.details?.service || item?.appointment || item?.service);
  });
  const customerOrderHistory = customerHistoryEntries.filter((item: any) => `${item?.type || item?.entityType || item?.kind || ''}`.toLowerCase() === 'order');
  const customerWalletHistory = Array.isArray(customerHistoryData?.walletTransactions) ? customerHistoryData.walletTransactions : [];
  const customerGiftHistory = customerHistoryEntries.filter((item: any) => {
    const kind = `${item?.type || item?.entityType || item?.kind || ''}`.toLowerCase();
    return kind === 'gift' || kind === 'gift_card';
  });
  const customerReviewHistory = Array.isArray(customerProfile?.reviews) ? customerProfile.reviews : [];
  const customerLiveReviews = Array.isArray(customerProfile?.reviews) && customerProfile.reviews.length > 0
    ? customerProfile.reviews
    : customerReviewHistory;
  const customerNoteHistory = Array.isArray(customerProfile?.notes) ? customerProfile.notes : [];
  const customerAppointmentHistoryRows = [...customerAppointmentHistory]
    .sort((a: any, b: any) => new Date(b?.details?.startTime || b?.date || b?.createdAt || 0).getTime() - new Date(a?.details?.startTime || a?.date || a?.createdAt || 0).getTime());
  const customerAppointmentHistoryCards = customerAppointmentHistoryRows.filter((item: any) => {
    const rawStatus = `${item?.status || item?.paymentStatus || ''}`.toLowerCase();
    const appointmentStart = new Date(item?.details?.startTime || item?.date || item?.createdAt || 0).getTime();
    const isFuture = Number.isFinite(appointmentStart) && appointmentStart > Date.now();
    const bucket = (() => {
      if (['cancelled', 'canceled'].includes(rawStatus)) return 'cancelled';
      if (['no-show', 'noshow', 'no_show'].includes(rawStatus)) return 'no_show';
      if (['completed', 'done', 'served'].includes(rawStatus)) return 'completed';
      if (isFuture || ['confirmed', 'scheduled', 'pending', 'arrived', 'in_progress', 'in progress', 'booked'].includes(rawStatus)) return 'upcoming';
      return 'completed';
    })();
    return customerAppointmentHistoryFilter === 'all' || bucket === customerAppointmentHistoryFilter;
  });
  const customerFirstVisit = [...customerAppointmentHistory]
    .sort((a: any, b: any) => new Date(a.startTime || a.date || a.createdAt || 0).getTime() - new Date(b.startTime || b.date || b.createdAt || 0).getTime())[0];
  const customerLastVisit = [...customerAppointmentHistory]
    .sort((a: any, b: any) => new Date(b.startTime || b.date || b.createdAt || 0).getTime() - new Date(a.startTime || a.date || a.createdAt || 0).getTime())[0];
  const customerCompletedAppointments = customerAppointmentHistory.filter((item: any) => `${item.status || ''}`.toLowerCase() === 'completed').length;
  const customerCancelledAppointments = customerAppointmentHistory.filter((item: any) => `${item.status || ''}`.toLowerCase() === 'cancelled').length;
  const customerNoShowAppointments = customerAppointmentHistory.filter((item: any) => `${item.status || ''}`.toLowerCase() === 'no-show' || `${item.status || ''}`.toLowerCase() === 'noshow').length;
  const customerPreferredStylist = customerProfile?.assignedStylist || activeStylist?.nameEn || '';
  const customerPreferredService = Array.isArray(customerProfile?.favServices) && customerProfile.favServices.length > 0
    ? customerProfile.favServices[0]
    : activeAppointment?.serviceNameEn || '';
  const customerAverageSpend = (() => {
    const totalSpent = Number(customerProfile?.totalSpent ?? customerSummaryData.totalSpent ?? 0);
    const visits = Number(customerProfile?.appointmentsCount ?? customerSummaryData.totalAppointments ?? customerAppointmentHistory.length ?? 0);
    if (!visits) {
      return 0;
    }
    return totalSpent / visits;
  })();

  const getTransactionAmountLabel = (item: any) => {
    const amount = Number(item?.amount ?? item?.totalAmount ?? item?.value ?? item?.price ?? 0);
    return Number.isFinite(amount) && amount > 0 ? `${amount.toFixed(2)} ${t.riyal}` : '—';
  };

  const getTransactionStatusTone = (statusValue: any) => {
    const status = `${statusValue || ''}`.toLowerCase();
    if (['paid', 'completed', 'success', 'captured', 'fully_paid', 'deposit_paid'].includes(status)) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (['pending', 'processing', 'in_progress', 'partially_paid'].includes(status)) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (['failed', 'cancelled', 'canceled', 'void', 'refunded', 'partially_refunded'].includes(status)) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const openCustomerTransactionRecord = async (item: any) => {
    const detailPath = `${item?.detailPath || ''}`;
    const appointmentMatch = detailPath.match(/\/dashboard\/appointments\/([^/?#]+)/);
    const appointmentId = appointmentMatch?.[1]
      || item?.appointment?.id
      || item?.bookingSession?.appointments?.[0]?.id
      || (item?.referenceType === 'appointment' ? item?.referenceId : null)
      || null;

    if (appointmentId) {
      await openHistoricalAppointmentDetails({
        ...item,
        id: appointmentId,
        date: item?.processedAt || item?.date || item?.createdAt || item?.time || item?.appointment?.startTime || item?.appointment?.date,
        details: {
          service: item?.appointment?.service || item?.bookingSession?.appointments?.[0]?.service || item?.details?.service || null,
          staff: item?.appointment?.staff || item?.bookingSession?.appointments?.[0]?.staff || item?.details?.staff || null,
          duration: item?.appointment?.service?.duration || item?.appointment?.duration || item?.details?.duration || 0,
          startTime: item?.appointment?.startTime || item?.processedAt || item?.date || item?.createdAt || '',
          notes: item?.notes || item?.subtitle || ''
        }
      });
      return;
    }

    if (detailPath && detailPath.includes('/dashboard/orders/')) {
      addLocalToast(
        isRtl ? 'لا يوجد Drawer مالي مستقل لهذا السجل بعد.' : 'No standalone financial drawer is available for this record yet.',
        isRtl ? 'يفتح السجل عبر المسار المرتبط عند توفره.' : 'The record opens through its linked path when available.',
        'info'
      );
      return;
    }

    addLocalToast(
      isRtl ? 'لا توجد تفاصيل مالية مرتبطة.' : 'No linked financial details are available.',
      isRtl ? 'راجع المسار المرتبط من الخادم.' : 'Check the linked path from the backend.',
      'info'
    );
  };

  const compactAppointmentField = (value: any, fallback = '—') => {
    if (Array.isArray(value)) {
      const text = value
        .map((item) => (typeof item === 'string' ? item.trim() : item?.label || item?.name || item?.value || item?.text || ''))
        .filter(Boolean)
        .join(' • ');
      return text || fallback;
    }
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    return `${value}`.trim() || fallback;
  };

  const activeVisitServiceEntries = (() => {
    const sources = [
      ...(Array.isArray(activeAppointment?.services) ? activeAppointment.services : []),
      ...(Array.isArray(activeAppointment?.serviceItems) ? activeAppointment.serviceItems : []),
      ...(Array.isArray(activeAppointment?.lineItems) ? activeAppointment.lineItems : []),
      ...(Array.isArray(activeAppointment?.invoiceItems) ? activeAppointment.invoiceItems : [])
    ];

    const mapped = sources
      .map((item: any, idx: number) => {
        const itemType = `${item?.type || item?.itemType || item?.kind || item?.lineType || ''}`.toLowerCase();
        const isProduct = itemType.includes('product') || itemType.includes('retail') || Boolean(item?.productId || item?.sku || item?.isProduct);
        const looksLikeService = itemType.includes('service') || Boolean(
          item?.serviceId
          || item?.serviceName
          || item?.serviceNameEn
          || item?.serviceNameAr
          || item?.service?.id
          || item?.service?.name_en
          || item?.service?.name_ar
        );
        if (isProduct || !looksLikeService) {
          return null;
        }
        const serviceNameEn = item?.serviceNameEn
          || item?.serviceName
          || item?.requestedServiceName
          || item?.serviceVariantName
          || item?.service?.name_en
          || item?.name_en
          || item?.service?.nameEn
          || item?.service?.name
          || item?.service_title
          || item?.nameEn
          || item?.name
          || item?.title
          || activeServiceSummary.nameEn;
        const serviceNameAr = item?.serviceNameAr
          || item?.serviceName
          || item?.requestedServiceNameAr
          || item?.serviceVariantNameAr
          || item?.service?.name_ar
          || item?.name_ar
          || item?.service?.nameAr
          || item?.service?.name
          || item?.service_title_ar
          || item?.nameAr
          || item?.name
          || item?.title
          || activeServiceSummary.nameAr;
        return {
          id: item?.id || item?.serviceId || `svc-${idx}`,
          nameEn: serviceNameEn,
          nameAr: serviceNameAr,
          assignedEmployeeEn: item?.assignedEmployeeNameEn || item?.assignedStaffName || item?.staffName || item?.employeeName || activeStylist?.nameEn || '',
          assignedEmployeeAr: item?.assignedEmployeeNameAr || item?.assignedStaffName || item?.staffName || item?.employeeName || activeStylist?.nameAr || '',
          duration: Number(item?.duration || item?.durationMinutes || activeAppointment?.duration || activeServiceSummary.duration || 0),
          price: Number(item?.price ?? item?.unitPrice ?? item?.subtotal ?? activeServiceSummary.price ?? 0),
          status: item?.status || activeAppointment?.status || '—',
          appointmentTime: item?.appointmentTime || item?.startTime || activeAppointmentTime || '—',
          invoiceStatus: item?.invoiceStatus || activeAppointment?.invoiceStatus || activeAppointment?.paymentStatus || '—',
          branch: item?.branchName || item?.branch || activeCustomerBranch || '—'
        };
      })
      .filter(Boolean);

    if (mapped.length > 0) {
      return mapped;
    }

    if (activeAppointment?.serviceId || activeAppointment?.serviceNameEn || activeAppointment?.serviceNameAr || activeAppointment?.serviceName || activeAppointment?.requestedServiceName) {
      return [{
        id: `svc-${activeAppointment.id}`,
        nameEn: activeServiceSummary.nameEn,
        nameAr: activeServiceSummary.nameAr,
        assignedEmployeeEn: activeStylist?.nameEn || activeAppointment?.assignedStaffName || '',
        assignedEmployeeAr: activeStylist?.nameAr || activeAppointment?.assignedStaffName || '',
        duration: activeServiceSummary.duration,
        price: activeServiceSummary.price,
        status: activeAppointment.status,
        appointmentTime: activeAppointmentTime || '—',
        invoiceStatus: activeAppointment.invoiceStatus || activeAppointment.paymentStatus || '—',
        branch: activeCustomerBranch || '—'
      }];
    }

    return [];
  })();

  const activeVisitProductEntries = (() => {
    const sources = [
      ...(Array.isArray(activeAppointment?.products) ? activeAppointment.products : []),
      ...(Array.isArray(activeAppointment?.productItems) ? activeAppointment.productItems : []),
      ...(Array.isArray(activeAppointment?.retailItems) ? activeAppointment.retailItems : []),
      ...(Array.isArray(activeAppointment?.lineItems) ? activeAppointment.lineItems : [])
    ];

    return sources
      .map((item: any, idx: number) => {
        const itemType = `${item?.type || item?.itemType || item?.kind || item?.lineType || ''}`.toLowerCase();
        const isProduct = itemType.includes('product') || itemType.includes('retail') || Boolean(item?.productId || item?.sku || item?.isRetail);
        if (!isProduct) {
          return null;
        }
        return {
          id: item?.id || item?.productId || `prd-${idx}`,
          nameEn: item?.nameEn || item?.productNameEn || item?.name || item?.title || 'Product',
          nameAr: item?.nameAr || item?.productNameAr || item?.name || item?.title || 'منتج',
          assignedEmployeeEn: item?.assignedEmployeeNameEn || item?.assignedStaffName || item?.staffName || activeStylist?.nameEn || '',
          assignedEmployeeAr: item?.assignedEmployeeNameAr || item?.assignedStaffName || item?.staffName || activeStylist?.nameAr || '',
          quantity: Number(item?.quantity || 1),
          unitPrice: Number(item?.unitPrice ?? item?.price ?? 0),
          subtotal: Number(item?.subtotal ?? (Number(item?.quantity || 1) * Number(item?.unitPrice ?? item?.price ?? 0))),
          status: item?.status || activeAppointment?.paymentStatus || '—',
          appointmentTime: item?.appointmentTime || item?.startTime || activeAppointmentTime || '—',
          invoiceStatus: item?.invoiceStatus || activeAppointment?.invoiceStatus || activeAppointment?.paymentStatus || '—',
          branch: item?.branchName || item?.branch || activeCustomerBranch || '—'
        };
      })
      .filter(Boolean);
  })();

  const customerInternalNotes = [
    { label: isRtl ? 'ملاحظات الصالون' : 'Salon notes', value: compactAppointmentField(customerProfile?.salonNotes || customerProfile?.notesSummary || activeAppointment?.salonNotes || activeAppointment?.notesSummary || customerNoteHistory?.[0]?.text || customerNoteHistory?.[0]?.note || customerNoteHistory?.[0] || '') },
    { label: isRtl ? 'التفضيلات' : 'Preferences', value: compactAppointmentField(customerProfile?.preferences || activeAppointment?.preferences || customerProfile?.communication || '') },
    { label: isRtl ? 'الحساسية' : 'Allergies', value: compactAppointmentField(customerProfile?.allergies || activeAppointment?.allergies || '') },
    { label: isRtl ? 'تركيبة الشعر' : 'Hair Formula', value: compactAppointmentField(customerProfile?.hairFormula || activeAppointment?.hairFormula || '') },
    { label: isRtl ? 'الملاحظات الطبية' : 'Medical Notes', value: compactAppointmentField(customerProfile?.medicalNotes || activeAppointment?.medicalNotes || '') }
  ];

  const customerTimelineEntries = (() => {
    const rows = [
      ...customerAppointmentHistory.map((item: any) => ({
        id: `apt-${item.id || item.bookingNumber || Math.random().toString(36).slice(2)}`,
        titleEn: item.service?.name_en || item.serviceName || 'Appointment',
        titleAr: item.service?.name_ar || item.serviceNameAr || 'موعد',
        subtitleEn: item.status || item.paymentStatus || 'appointment activity',
        subtitleAr: item.status || item.paymentStatus || 'نشاط موعد',
        date: item.startTime || item.date || item.createdAt || '',
        kind: 'appointment'
      })),
      ...customerOrderHistory.map((item: any) => ({
        id: `ord-${item.id || item.orderNumber || Math.random().toString(36).slice(2)}`,
        titleEn: item.orderNumber ? `Order ${item.orderNumber}` : 'Order activity',
        titleAr: item.orderNumber ? `طلب ${item.orderNumber}` : 'نشاط طلب',
        subtitleEn: item.status || item.paymentStatus || 'order activity',
        subtitleAr: item.status || item.paymentStatus || 'نشاط طلب',
        date: item.date || item.createdAt || '',
        kind: 'order'
      })),
      ...customerWalletHistory.map((item: any) => ({
        id: `wal-${item.id || Math.random().toString(36).slice(2)}`,
        titleEn: item.type || 'Wallet transaction',
        titleAr: item.type || 'عملية محفظة',
        subtitleEn: item.method || item.status || 'wallet activity',
        subtitleAr: item.method || item.status || 'نشاط محفظة',
        date: item.date || item.createdAt || '',
        kind: 'wallet'
      })),
      ...customerGiftHistory.map((item: any) => ({
        id: `gft-${item.id || Math.random().toString(36).slice(2)}`,
        titleEn: item.title || item.name || 'Gift activity',
        titleAr: item.title || item.name || 'نشاط هدايا',
        subtitleEn: item.status || item.type || 'gift activity',
        subtitleAr: item.status || item.type || 'نشاط هدايا',
        date: item.date || item.createdAt || '',
        kind: 'gift'
      })),
      ...customerReviewHistory.map((item: any) => ({
        id: `rev-${item.id || Math.random().toString(36).slice(2)}`,
        titleEn: item.serviceName || item.title || 'Review',
        titleAr: item.serviceName || item.title || 'تقييم',
        subtitleEn: item.comment || item.text || 'review',
        subtitleAr: item.comment || item.text || 'تقييم',
        date: item.createdAt || item.reviewedAt || '',
        kind: 'review'
      }))
    ];

    return rows
      .filter((entry) => entry.titleEn || entry.titleAr)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 8);
  })();

  const customerRecentTransactions = (() => {
    const rows = [
      ...(customerHistoryData?.transactions || []),
      ...(customerHistoryData?.walletTransactions || [])
    ];
    const seen = new Set<string>();
    return rows
      .filter((entry: any) => {
        const key = `${entry?.source || 'unknown'}:${entry?.id || entry?.referenceId || entry?.transactionRef || JSON.stringify(entry)}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice()
      .sort((a: any, b: any) => new Date(b.date || b.createdAt || b.time || 0).getTime() - new Date(a.date || a.createdAt || a.time || 0).getTime())
      .slice(0, customerTransactionsExpanded ? 12 : 4);
  })();
  
  // Custom Drag State & Interactive Preview
  const [draggedAptId, setDraggedAptId] = useState<string | null>(null);
  const [dragOverStaffId, setDragOverStaffId] = useState<string | null>(null);
  const [dragOverTime, setDragOverTime] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCustomerProfile = async () => {
      if (!drawerOpen || !activeAppointment?.customerId) {
        setCustomerProfile(null);
        setCustomerHistoryData(null);
        setCustomerProfileError(null);
        setCustomerProfileLoading(false);
        return;
      }

      setCustomerProfileLoading(true);
      setCustomerProfileError(null);

      try {
        const [profileResponse, historyResponse, transactionsResponse] = await Promise.all([
          tenantApiAdapter.getCustomer(activeAppointment.customerId),
          tenantApiAdapter.getCustomerHistory(activeAppointment.customerId, { limit: 20 }),
          tenantApiAdapter.getCustomerTransactions(activeAppointment.customerId, { limit: 20 })
        ]);
        const profile = normalizeCustomerProfile(profileResponse);
        const historyPayload = historyResponse?.history || historyResponse?.data?.history || historyResponse?.data || historyResponse || {};
        const transactionsPayload = transactionsResponse?.transactions || transactionsResponse?.data?.transactions || transactionsResponse?.data || transactionsResponse || [];
        if (!cancelled) {
          setCustomerProfile(profile);
          setCustomerHistoryData({
            history: Array.isArray(historyPayload.history) ? historyPayload.history : [],
            summary: historyPayload.summary || {},
            walletTransactions: Array.isArray(historyPayload.walletTransactions) ? historyPayload.walletTransactions : [],
            notes: Array.isArray(profile.notes) ? profile.notes : [],
            transactions: Array.isArray(transactionsPayload) ? transactionsPayload : Array.isArray(transactionsPayload.transactions) ? transactionsPayload.transactions : []
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setCustomerProfileError(err?.message || 'Failed to load customer profile');
          setCustomerProfile(null);
          setCustomerHistoryData(null);
        }
      } finally {
        if (!cancelled) {
          setCustomerProfileLoading(false);
        }
      }
    };

    void loadCustomerProfile();

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, activeAppointment?.customerId, customerProfileRefreshToken]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    staffId: string;
    timeInMinutes: number;
    appointmentId?: string;
  } | null>(null);

  // Drag State Tracker for Vertical Resizing
  const [dragState, setDragState] = useState<{
    appointmentId: string;
    startMouseY: number;
    startStartTime: number;
    originalStaffId: string;
    isResizing: boolean;
    startDuration: number;
    lastDuration?: number;
  } | null>(null);

  // Split payments demo state
  const [splitAmounts, setSplitAmounts] = useState<{ card: number; cash: number; wallet: number }>({ card: 0, cash: 0, wallet: 0 });
  const [isSplitActive, setIsSplitActive] = useState(false);

  // Wallet simulation state
  const [simulatedWalletTopUp, setSimulatedWalletTopUp] = useState<string>('');

  // Checkout combined products & gift cards state for active appointment
  const [checkoutProducts, setCheckoutProducts] = useState<{ id: string; nameAr: string; nameEn: string; price: number; quantity: number; sku: string }[]>([]);
  const [appliedGiftCardCode, setAppliedGiftCardCode] = useState<string>('');
  const [appliedGiftCardAmount, setAppliedGiftCardAmount] = useState<number>(0);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [checkoutReceiptData, setCheckoutReceiptData] = useState<any | null>(null);

  const activeInvoiceLineItems = activeAppointment ? [
    {
      id: `svc-${activeAppointment.id}`,
      nameEn: activeServiceSummary.nameEn,
      nameAr: activeServiceSummary.nameAr,
      stylistEn: activeAppointment.assignedStaffName || activeStylist?.nameEn || '',
      stylistAr: activeAppointment.assignedStaffName || activeStylist?.nameAr || '',
      quantity: 1,
      unitPrice: Number(activeServiceSummary.price || 0),
      subtotal: Number(activeServiceSummary.price || 0),
      type: 'service'
    },
    ...checkoutProducts.map((product) => ({
      id: `prd-${product.id}`,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      stylistEn: activeAppointment.assignedStaffName || activeStylist?.nameEn || '',
      stylistAr: activeAppointment.assignedStaffName || activeStylist?.nameAr || '',
      quantity: product.quantity,
      unitPrice: Number(product.price || 0),
      subtotal: Number(product.price || 0) * Number(product.quantity || 0),
      type: 'product'
    }))
  ] : [];
  const activeInvoiceSubtotal = activeInvoiceLineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const activeInvoiceDiscount = Number(appliedGiftCardAmount || 0);
  const activeInvoiceTaxable = Math.max(0, activeInvoiceSubtotal - activeInvoiceDiscount);
  const activeInvoiceVat = Number((activeInvoiceTaxable * 0.15).toFixed(2));
  const activeInvoiceTotal = Number((activeInvoiceTaxable + activeInvoiceVat).toFixed(2));
  const activeInvoiceRemaining = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0) - Number(splitAmounts.wallet || 0));

  // Skeletons / Refresh Simulation
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Local Animated Toast Feedback System
  const [localToasts, setLocalToasts] = useState<{ id: string; msgAr: string; msgEn: string; type: 'success' | 'info' | 'warning' }[]>([]);
  const addLocalToast = (msgAr: string, msgEn: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setLocalToasts(prev => [...prev, { id, msgAr, msgEn, type }]);
    setTimeout(() => {
      setLocalToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const getSchedulingErrorToast = (err: unknown, fallbackAr: string, fallbackEn: string) => {
    const raw = `${(err as any)?.message || err || ''}`.toLowerCase();
    const isConflict = raw.includes('conflict') || raw.includes('overlap') || raw.includes('not available') || raw.includes('unavailable') || raw.includes('outside working hours') || raw.includes('time slot');
    if (isConflict) {
      return {
        ar: 'تعذر حفظ التغيير بسبب تعارض في الجدول. جرّب وقتاً أو موظفاً آخر.',
        en: 'Scheduling conflict detected. Try another time or staff member.'
      };
    }
    return { ar: fallbackAr, en: fallbackEn };
  };

  const normalizeCustomerProfile = (payload: any) => {
    const customer = payload?.customer || payload?.data?.customer || payload?.data || payload || {};
    const firstName = customer.firstName || customer.first_name || '';
    const lastName = customer.lastName || customer.last_name || '';
    const fullName = customer.name || customer.fullName || `${firstName} ${lastName}`.trim() || activeAppointment?.customerNameEn || activeAppointment?.customerNameAr || 'Guest';
    const reviews = Array.isArray(customer.reviews) ? customer.reviews : [];
    const notes = Array.isArray(customer.notes)
      ? customer.notes
      : typeof customer.notes === 'string' && customer.notes.trim().length > 0
        ? [customer.notes]
        : [];

    return {
      id: customer.id || activeAppointment?.customerId || '',
      nameEn: fullName,
      nameAr: customer.nameAr || fullName,
      email: customer.email || activeAppointment?.customerEmail || '',
      phone: customer.phone || activeAppointment?.customerPhone || '',
      gender: customer.gender || '',
      birthdate: customer.birthdate || customer.birthDate || '',
      preferredLanguage: customer.preferredLanguage || 'ar',
      memberSince: customer.memberSince || customer.createdAt || '',
      loyaltyTier: customer.loyaltyTier || activeAppointment?.loyaltyTier || '',
      walletBalance: customer.walletBalance ?? activeAppointment?.walletBalance ?? 0,
      appointmentsCount: customer.appointmentsCount ?? customer.totalBookings ?? 0,
      totalSpent: customer.totalSpent ?? 0,
      lastVisit: customer.lastVisit || '',
      tags: Array.isArray(customer.tags) ? customer.tags : [],
      notes,
      reviews,
      communication: Array.isArray(customer.communication) ? customer.communication : [],
      history: Array.isArray(customer.history) ? customer.history : [],
      assignedStylist: customer.assignedStylist || '',
      assignedStylistAr: customer.assignedStylistAr || customer.assignedStylist || '',
      customerType: customer.customerType || customer.type || '',
      favServices: Array.isArray(customer.favServices) ? customer.favServices : [],
      favServicesAr: Array.isArray(customer.favServicesAr) ? customer.favServicesAr : [],
      visitsCount: customer.visitsCount ?? 0,
      noShowsCount: customer.noShowsCount ?? 0,
      documents: Array.isArray(customer.documents) ? customer.documents : [],
      transactions: Array.isArray(customer.transactions) ? customer.transactions : []
    };
  };

  // --- INTERACTIVE ADD APPOINTMENT / BLOCK TIME DRAWER ---
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [createStep, setCreateStep] = useState<number>(1);
  
  // Step 1: Customer Details State
  const [custMode, setCustMode] = useState<'existing' | 'new' | 'walkin'>('existing');
  const [selectedCustId, setSelectedCustId] = useState<string>('CUST-001');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustDob, setNewCustDob] = useState('1998-05-12');
  const [newCustGender, setNewCustGender] = useState<'F' | 'M'>('F');
  const [newCustIsVip, setNewCustIsVip] = useState(false);
  const [includeGroupGuests, setIncludeGroupGuests] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [guestNames, setGuestNames] = useState('');

  // Step 2: Service Configuration & Queue
  const [currentServiceId, setCurrentServiceId] = useState<string>('SRV-001');
  const [currentStaffId, setCurrentStaffId] = useState<string>('st-1');
  const [currentStartTime, setCurrentStartTime] = useState<number>(120); // minutes from 9:00 AM. 120 = 11:00 AM
  const [currentDuration, setCurrentDuration] = useState<number>(60);
  const [currentDiscountType, setCurrentDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
  const [currentDiscountValue, setCurrentDiscountValue] = useState<number>(0);
  const [currentServiceNotes, setCurrentServiceNotes] = useState<string>('');
  
  // Staged Services queue for multi-service sequence bookings
  interface StagedService {
    id: string;
    serviceId: string;
    staffId: string;
    startTime: number;
    duration: number;
    discountType: 'none' | 'flat' | 'percent';
    discountValue: number;
    notes: string;
  }
  const [stagedServices, setStagedServices] = useState<StagedService[]>([]);

  // Step 3: Global Checkout notes & Custom Payment Rows
  const [sessionNotes, setSessionNotes] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [createSplitActive, setCreateSplitActive] = useState(false);
  const [createSplitAmounts, setCreateSplitAmounts] = useState({ card: 0, cash: 0, wallet: 0, bank: 0, gift: 0 });
  const [giftCardCodeInput, setGiftCardCodeInput] = useState('');

  // Blocked shift breaks
  const [blockTitleAr, setBlockTitleAr] = useState('استراحة قهوة الموظفين');
  const [blockTitleEn, setBlockTitleEn] = useState('Staff Espresso Recess');
  const [blockStaffId, setBlockStaffId] = useState('st-1');
  const [blockStartTime, setBlockStartTime] = useState<number>(180); // 12:00 PM
  const [blockDuration, setBlockDuration] = useState<number>(45);
  const [blockType, setBlockType] = useState<'Break' | 'Lunch' | 'Meeting'>('Break');

  // Shift Editor Modal states
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedShiftStaffId, setSelectedShiftStaffId] = useState('st-1');
  const [initialCreateMode, setInitialCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [initialCartTab, setInitialCartTab] = useState<'products' | 'giftcards'>('products');

  // --- POS CART & GIFT CARD COUNTER DRAWER ---
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'products' | 'giftcards'>('products');
  
  // Cart items sequence
  interface CartItem {
    id: string;
    type: 'product' | 'giftcard';
    nameAr: string;
    nameEn: string;
    price: number;
    quantity: number;
    skuOrCode: string;
    recipient?: string;
    sender?: string;
  }
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // Gift Card generator
  const [gcSender, setGcSender] = useState('');
  const [gcRecipient, setGcRecipient] = useState('');
  const [gcValue, setGcValue] = useState<number>(500);
  const [generatedGcCode, setGeneratedGcCode] = useState('REF-GFT-2026-9844');
  
  // POS Checkout customer association
  const [posCustMode, setPosCustMode] = useState<'walkin' | 'existing'>('walkin');
  const [posSelectedCustId, setPosSelectedCustId] = useState('CUST-001');
  
  // POS Split checkout state
  const [posSplitActive, setPosSplitActive] = useState(false);
  const [posSplitAmounts, setPosSplitAmounts] = useState({ card: 0, cash: 0, wallet: 0, bank: 0 });

  // Receipt billing report preview modal/pane
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    date: string;
    customerName: string;
    items: CartItem[];
    subtotal: number;
    vat: number;
    total: number;
    paymentSummary: string;
  } | null>(null);

  // Auto load service durations
  useEffect(() => {
    const srv = liveServices.find(s => s.id === currentServiceId);
    if (srv) {
      setCurrentDuration(srv.duration);
    }
  }, [currentServiceId]);

  useEffect(() => {
    // Whenever date changes, show a sleek skeleton reload
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [selectedDate, viewMode, serviceCategoryFilter]);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setIsLoading(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setIsLoading(false);
    }, 600);
  };

  // Translate utilities
  const t = {
    today: isRtl ? 'اليوم' : 'Today',
    allStaff: isRtl ? 'جميع خبيرات التجميل' : 'All Stylists',
    allStatus: isRtl ? 'جميع الحالات' : 'All Statuses',
    confirmed: isRtl ? 'مؤكد' : 'Confirmed',
    arrived: isRtl ? 'وصلت المركز' : 'Arrived',
    completed: isRtl ? 'اكتملت الخدمة' : 'Completed',
    cancelled: isRtl ? 'ملغية' : 'Cancelled',
    paid: isRtl ? 'مدفوعة' : 'Paid',
    unpaid: isRtl ? 'غير مدفوعة' : 'Unpaid',
    partial: isRtl ? 'جزئي' : 'Partial Paid',
    riyal: isRtl ? 'ر.س' : 'SAR',
    durationMin: isRtl ? 'دقيقة' : 'min',
    newBooking: isRtl ? 'حجز موعد جديد' : 'New Appointment',
    blockTime: isRtl ? 'حظر فترة زمنية' : 'Block Time',
    editShift: isRtl ? 'تعديل نوبة العمل' : 'Edit Shift',
    addBreak: isRtl ? 'إضافة استراحة غداء/قهوة' : 'Add Break',
    pasteAppointment: isRtl ? 'لصق حجز منسوخ' : 'Paste Appointment',
    refreshSchedule: isRtl ? 'تحديث الجدول والربط' : 'Refresh Schedule',
    reschedule: isRtl ? 'إعادة جدولة الموعد' : 'Reschedule Appointment',
    checkout: isRtl ? 'دفع سريع وخروج' : 'Checkout & Pay',
    rebook: isRtl ? 'إعادة حجز فوري' : 'Instant Rebook',
    walletText: isRtl ? 'محفظة العميل الرقمية' : 'Client Wallet Balance',
    splitPayments: isRtl ? 'تقسيم المدفوعات' : 'Split Payments',
    financeSummary: isRtl ? 'الملخص المالي للفاتورة' : 'Invoice Financial Summary',
    timelineText: isRtl ? 'سجل تفاعل العميل' : 'Client Touchpoint Log',
    reviewsText: isRtl ? 'تقييمات وملاحظات العميل' : 'Reviews & Comments',
    quickActionsTitle: isRtl ? 'أدوات التحكم والجدولة' : 'Schedule Controller',
    slotBookPrompt: isRtl ? '+ حجز في الساعة' : '+ Book at',
    clearFilters: isRtl ? 'إعادة تعيين الفلاتر' : 'Reset Filters',
    dragTip: isRtl ? 'اسحب الموعد لتغيير الخبيرة والوقت • اسحب المقبض السفلي لتعديل المدة' : 'Drag card to reschedule • Drag bottom handle to resize duration',
    emptyStateText: isRtl ? 'لا توجد مواعيد تطابق خيارات البحث الحالية' : 'No appointments found matching filters'
  };

  // Conversions for layout
  const SLOT_HEIGHT = 100; // 100px per hour
  const START_HOUR = 9; // 9:00 AM
  const END_HOUR = 21; // 9:00 PM (12 hours duration)
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  const minutesToTop = (mins: number) => {
    return (mins / 60) * SLOT_HEIGHT;
  };

  const minutesToHeight = (duration: number) => {
    return (duration / 60) * SLOT_HEIGHT;
  };

  const formatMinutesToTime = (totalMins: number) => {
    const minsFromMidnight = (START_HOUR * 60) + totalMins;
    let hours = Math.floor(minsFromMidnight / 60);
    const mins = Math.floor(minsFromMidnight % 60);
    const ampm = hours >= 12 ? (isRtl ? 'م' : 'PM') : (isRtl ? 'ص' : 'AM');
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const minStr = mins < 10 ? '0' + mins : mins;
    return `${hours}:${minStr} ${ampm}`;
  };

  const handleDayShift = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // Custom Mouse Drag Handling for Resizing
  const handleMouseDown = (e: React.MouseEvent, aptId: string, isResize: boolean) => {
    e.stopPropagation();
    e.preventDefault();
    const apt = appointments.find(a => a.id === aptId);
    if (!apt) return;

    setDragState({
      appointmentId: aptId,
      startMouseY: e.clientY,
      startStartTime: apt.startTime,
      originalStaffId: apt.staffId,
      isResizing: isResize,
      startDuration: apt.duration,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState) return;
    
    const deltaY = e.clientY - dragState.startMouseY;
    // Each 1 hour is SLOT_HEIGHT (100px). So deltaMinutes = (deltaY / 100) * 60
    const deltaMinutes = Math.round(((deltaY / SLOT_HEIGHT) * 60) / 5) * 5; // 5 minute precision step

    if (dragState.isResizing) {
      // Handle resizing duration
      const newDuration = Math.max(15, dragState.startDuration + deltaMinutes); // min 15 minutes
      setAppointments(prev => prev.map(a => a.id === dragState.appointmentId ? { ...a, duration: newDuration } : a));
      setDragState(prev => prev ? { ...prev, lastDuration: newDuration } : prev);
    }
  };

  const handleMouseUp = async () => {
    if (dragState?.isResizing) {
      const target = appointments.find(a => a.id === dragState.appointmentId);
      const nextDuration = dragState.lastDuration ?? target?.duration ?? dragState.startDuration;
      if (target && nextDuration !== dragState.startDuration) {
        try {
          await tenantApiAdapter.patchAppointment(dragState.appointmentId, {
            duration: nextDuration
          });
          await loadBoardData();
        } catch (err) {
          console.error('Failed to persist resize change', err);
          const toast = getSchedulingErrorToast(err, 'تعذر حفظ تعديل مدة الموعد', 'Failed to save appointment resize');
          addLocalToast(
            toast.ar,
            toast.en,
            'warning'
          );
          await loadBoardData();
        }
      }
    }
    setDragState(null);
  };

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState]);

  // Context Menu Helpers
  const handleContextMenu = (e: React.MouseEvent, staffId: string, timeInMinutes: number, appointmentId?: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      staffId,
      timeInMinutes,
      appointmentId,
    });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Quick action from Context Menu
  const triggerContextAction = (actionType: 'new' | 'block' | 'shift' | 'break' | 'paste' | 'refresh' | 'giftcards' | 'products') => {
    if (actionType === 'new') {
      if (contextMenu) {
        setCurrentStaffId(contextMenu.staffId);
        setCurrentStartTime(contextMenu.timeInMinutes);
      }
      setInitialCreateMode('appointment');
      setCreateStep(1);
      setStagedServices([]);
      setIsCreateDrawerOpen(true);
    } else if (actionType === 'block') {
      if (contextMenu) {
        setBlockStaffId(contextMenu.staffId);
        setBlockStartTime(contextMenu.timeInMinutes);
        setBlockTitleAr('فترة استراحة وحظر');
        setBlockTitleEn('Break Slot');
        setCurrentStaffId(contextMenu.staffId);
        setCurrentStartTime(contextMenu.timeInMinutes);
      }
      setInitialCreateMode('blocked');
      setIsCreateDrawerOpen(true);
    } else if (actionType === 'giftcards') {
      if (contextMenu) {
        setCurrentStaffId(contextMenu.staffId);
      }
      setInitialCartTab('giftcards');
      setIsCartDrawerOpen(true);
    } else if (actionType === 'products') {
      if (contextMenu) {
        setCurrentStaffId(contextMenu.staffId);
      }
      setInitialCartTab('products');
      setIsCartDrawerOpen(true);
    } else if (actionType === 'shift') {
      if (contextMenu) {
        setSelectedShiftStaffId(contextMenu.staffId);
        setIsShiftModalOpen(true);
      }
    } else if (actionType === 'refresh') {
      void loadBoardData();
    } else {
      addLocalToast(
        `تمت محاكاة الإجراء ${actionType.toUpperCase()} بنجاح.`,
        `Simulated action ${actionType.toUpperCase()} successfully.`,
        'info'
      );
    }
    setContextMenu(null);
  };

  // Open Details Drawer
  const openAppointmentDetails = async (apt: Appointment, options: { readOnly?: boolean } = {}) => {
    if (apt.type === 'blocked') {
      // For blocked cards, open a simplified popup or handle beautifully
      addLocalToast(
        `فترة محظورة: ${apt.customerNameAr}`,
        `Blocked time interval: ${apt.customerNameEn}`,
        'info'
      );
      return;
    }
    try {
      const response = await tenantApiAdapter.getAppointment(apt.id);
      const detail = response?.appointment || response?.data?.appointment || response?.data || response;
      setActiveAppointment(detail?.id ? mapBoardAppointment(detail, apt.date || selectedDate.toISOString().split('T')[0]) : apt);
    } catch (err) {
      console.warn('Failed to load appointment detail, falling back to board row', err);
      setActiveAppointment(apt);
    }
    setSplitAmounts({ card: apt.price, cash: 0, wallet: 0 });
    setIsSplitActive(false);
    setCheckoutProducts([]);
    setAppliedGiftCardCode('');
    setAppliedGiftCardAmount(0);
    setAppointmentDetailsReadOnly(Boolean(options.readOnly));
    setIsCustomerProfileOpen(false);
    setCustomerTransactionsExpanded(false);
    setCustomerProfile(null);
    setCustomerHistoryData(null);
    setCustomerProfileError(null);
    setDrawerOpen(true);
  };

  const openHistoricalAppointmentDetails = async (historyItem: any) => {
    if (!historyItem?.id) {
      return;
    }

    const historyDate = historyItem?.date || historyItem?.details?.startTime || selectedDate.toISOString().split('T')[0];
    const fallbackAppointment = mapBoardAppointment({
      id: historyItem.id,
      customerId: activeAppointment?.customerId,
      customerNameEn: activeAppointment?.customerNameEn || historyItem?.customerNameEn || activeCustomerName || 'Guest',
      customerNameAr: activeAppointment?.customerNameAr || historyItem?.customerNameAr || activeCustomerName || 'زائرة',
      customerPhone: activeCustomerPhone || '',
      customerEmail: activeCustomerEmail || '',
      service: historyItem?.details?.service || null,
      serviceId: historyItem?.details?.service?.id || historyItem?.service?.id || null,
      serviceNameEn: historyItem?.details?.service?.name_en || historyItem?.details?.service?.nameEn || historyItem?.details?.service?.name || historyItem?.serviceName || historyItem?.title || 'Service',
      serviceNameAr: historyItem?.details?.service?.name_ar || historyItem?.details?.service?.nameAr || historyItem?.details?.service?.name || historyItem?.serviceName || historyItem?.title || 'الخدمة',
      staff: historyItem?.details?.staff || null,
      staffId: historyItem?.details?.staff?.id || historyItem?.staffId || null,
      staffName: historyItem?.details?.staff?.name || historyItem?.staffName || '',
      startTime: historyItem?.details?.startTime || historyItem?.date || activeAppointment?.startTime || 0,
      duration: historyItem?.details?.duration || historyItem?.duration || activeAppointment?.duration || 60,
      status: historyItem?.status || 'completed',
      paymentStatus: historyItem?.paymentStatus || historyItem?.normalizedPaymentStatus || 'paid',
      totalPaid: Number(historyItem?.paidAmount ?? historyItem?.amount ?? 0),
      price: Number(historyItem?.amount ?? 0),
      branchName: activeAppointment?.branchName || activeCustomerBranch || '',
      invoiceStatus: historyItem?.paymentStatus || historyItem?.normalizedPaymentStatus || 'paid',
      notes: historyItem?.details?.notes || '',
      services: historyItem?.details?.service ? [historyItem.details.service] : [],
      serviceItems: historyItem?.details?.service ? [{
        service: historyItem.details.service,
        duration: historyItem?.details?.duration || 0,
        price: Number(historyItem?.amount ?? 0)
      }] : [],
      lineItems: [],
      invoiceItems: [],
      products: [],
      productItems: [],
      retailItems: [],
      tags: []
    }, historyDate);

    try {
      const response = await tenantApiAdapter.getAppointment(historyItem.id);
      const detail = response?.appointment || response?.data?.appointment || response?.data || response;
      setActiveAppointment(
        detail?.id
          ? mapBoardAppointment(detail, detail.date || historyDate)
          : fallbackAppointment
      );
    } catch (err) {
      console.warn('Failed to load historical appointment detail, using history snapshot', err);
      setActiveAppointment(fallbackAppointment);
    }

    setSplitAmounts({ card: Number(historyItem?.amount ?? historyItem?.paidAmount ?? 0), cash: 0, wallet: 0 });
    setIsSplitActive(false);
    setCheckoutProducts([]);
    setAppliedGiftCardCode('');
    setAppliedGiftCardAmount(0);
    setDrawerTab('overview');
    setAppointmentDetailsReadOnly(true);
    setIsCustomerProfileOpen(false);
    setCustomerTransactionsExpanded(false);
    setCustomerDrawerTab('overview');
    setCustomerProfileError(null);
    setDrawerOpen(true);
  };

  const handleCheckoutPayment = async () => {
    if (!activeAppointment) return;
    if (appointmentDetailsReadOnly) {
      addLocalToast(
        isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
        isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
        'info'
      );
      return;
    }
    
    // Calculate totals
    const serviceSubtotal = activeAppointment.price;
    const productsSubtotal = checkoutProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const subtotal = serviceSubtotal + productsSubtotal;
    const discount = appliedGiftCardAmount;
    const taxableAmount = Math.max(0, subtotal - discount);
    const vat = taxableAmount * 0.15;
    const total = taxableAmount + vat;

    let paymentMethodSummary = isRtl ? 'بوابة مدى الرقمية المتكاملة' : 'Integrated Mada Card Terminal';
    if (isSplitActive) {
      const parts = [];
      if (splitAmounts.card > 0) parts.push(`${isRtl ? 'مدى' : 'Mada'}: ${splitAmounts.card} ${t.riyal}`);
      if (splitAmounts.cash > 0) parts.push(`${isRtl ? 'كاش' : 'Cash'}: ${splitAmounts.cash} ${t.riyal}`);
      if (splitAmounts.wallet > 0) parts.push(`${isRtl ? 'المحفظة' : 'Wallet'}: ${splitAmounts.wallet} ${t.riyal}`);
      if (parts.length > 0) paymentMethodSummary = parts.join(' | ');
    }

    try {
      // 1. Mark appointment as paid
      const paymentResponse = await tenantApiAdapter.updateAppointmentPaymentStatus(activeAppointment.id, {
        paymentStatus: 'paid',
        paymentMethod: paymentMethodSummary,
        splitAmounts: isSplitActive ? splitAmounts : undefined,
        totalPaid: total
      });

      // 2. Checkout any added products
      if (checkoutProducts.length > 0) {
        await tenantApiAdapter.checkoutProducts({
          items: checkoutProducts.map(p => ({ productId: p.id, quantity: p.quantity, price: p.price })),
          customerId: activeAppointment.customerId || undefined,
          customerName: activeAppointment.customerNameEn || activeAppointment.customerNameAr || 'Walk-in',
          paymentMethod: paymentMethodSummary
        });
      }

      const receipt = {
        orderId: `REF-APT-${activeAppointment.id.substring(0, 8).toUpperCase()}`,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        customerName: isRtl ? activeAppointment.customerNameAr : activeAppointment.customerNameEn,
        serviceName: isRtl ? activeAppointment.serviceNameAr : activeAppointment.serviceNameEn,
        servicePrice: serviceSubtotal,
        products: [...checkoutProducts],
        subtotal,
        discount,
        vat,
        total,
        paymentSummary: paymentMethodSummary
      };

      setCheckoutReceiptData(receipt);
      setShowReceiptModal(true);

      await loadBoardData();
      setCustomerProfileRefreshToken(token => token + 1);
      const confirmedAppointmentId = paymentResponse?.appointment?.id || paymentResponse?.data?.appointment?.id || activeAppointment.id;
      if (confirmedAppointmentId) {
        const refreshedAppointment = await tenantApiAdapter.getAppointment(confirmedAppointmentId);
        const confirmedData = refreshedAppointment?.appointment || refreshedAppointment?.data?.appointment || refreshedAppointment?.data || refreshedAppointment;
        if (confirmedData) {
          setActiveAppointment(mapBoardAppointment(confirmedData, selectedDate.toISOString().split('T')[0]));
        }
      }
      
      addLocalToast(
        'تم إتمام سداد فاتورة الجلسة وخروج العميل بنجاح! 🧾',
        'Session invoice settled and customer checked out successfully! 🧾',
        'success'
      );
    } catch (err) {
      console.error('Checkout failed', err);
      addLocalToast('فشل إتمام الدفع', 'Checkout failed. Try again.', 'warning');
    }
  };

  const handleAddWalletBalance = async () => {
    const amount = parseFloat(simulatedWalletTopUp);
    if (!isNaN(amount) && amount > 0 && activeAppointment) {
      if (appointmentDetailsReadOnly) {
        addLocalToast(
          isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
          isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
          'info'
        );
        return;
      }
      try {
        if (!activeAppointment.customerId) {
          throw new Error('Missing customer id for wallet top-up');
        }

        const response = await tenantApiAdapter.topUpCustomerWallet(activeAppointment.customerId, {
          amount,
          appointmentId: activeAppointment.id,
          note: 'Appointment drawer wallet recharge'
        });
        const nextBalance = Number(response?.walletBalance ?? response?.newBalance ?? response?.customer?.walletBalance ?? activeAppointment.walletBalance ?? 0);
        setSimulatedWalletTopUp('');
        setActiveAppointment(prev => prev ? { ...prev, walletBalance: nextBalance } : null);
        setCustomerProfile(prev => prev ? { ...prev, walletBalance: nextBalance } : prev);
        setCustomerProfileRefreshToken(token => token + 1);
        await loadBoardData();
        addLocalToast(
          `تم شحن محفظة العميل بقيمة ${amount} ر.س بنجاح!`,
          `Successfully recharged customer wallet with ${amount} SAR!`,
          'success'
        );
      } catch (err) {
        console.error('Customer wallet top-up failed', err);
        addLocalToast(
          isRtl ? 'تعذر شحن المحفظة.' : 'Unable to recharge the wallet.',
          isRtl ? 'Unable to recharge the wallet.' : 'تعذر شحن المحفظة.',
          'warning'
        );
      }
    }
  };

  // --- OPERATIONS FOR CREATE DRAWER ---
  const handleAddStagedService = () => {
    const srv = liveServices.find(s => s.id === currentServiceId);
    if (!srv) return;

    let nextStartTime = currentStartTime;
    if (stagedServices.length > 0) {
      const lastItem = stagedServices[stagedServices.length - 1];
      nextStartTime = lastItem.startTime + lastItem.duration;
    }

    const newItem: StagedService = {
      id: `stg-${Date.now()}`,
      serviceId: currentServiceId,
      staffId: currentStaffId,
      startTime: nextStartTime,
      duration: currentDuration,
      discountType: currentDiscountType,
      discountValue: currentDiscountValue,
      notes: currentServiceNotes,
    };

    setStagedServices(prev => [...prev, newItem]);
    setCurrentServiceNotes('');
    addLocalToast(
      `تمت إضافة الخدمة "${isRtl ? srv.nameAr : srv.nameEn}" للموعد المجدول.`,
      `Service "${isRtl ? srv.nameAr : srv.nameEn}" added to session queue.`,
      'success'
    );
  };

  const handleConfirmAppointmentCreation = () => {
    let custNameEn = '';
    let custNameAr = '';
    let custPhone = '';
    let custEmail = '';
    let loyalty = 'Standard Guest';
    let balance = 0;

    if (custMode === 'existing') {
      const existing = liveCustomers.find(c => c.id === selectedCustId);
      if (existing) {
        custNameEn = existing.name;
        custNameAr = existing.name;
        custPhone = existing.phone;
        custEmail = existing.email || '';
        loyalty = existing.appointmentsCount > 10 ? 'VIP Gold' : 'Loyal Club';
        balance = 300;
      }
    } else if (custMode === 'new') {
      if (!newCustName || !newCustPhone) {
        addLocalToast('يرجى تعبئة الاسم ورقم الجوال للعميل الجديد', 'Please fill name and phone for new customer', 'warning');
        return;
      }
      custNameEn = newCustName;
      custNameAr = newCustName;
      custPhone = newCustPhone;
      custEmail = newCustEmail;
      loyalty = newCustIsVip ? 'Diamond Elite VIP' : 'Classic Base';
      balance = 0;
    } else {
      custNameEn = includeGroupGuests ? `Group Guest (${guestCount} pax)` : 'Walk-in Guest';
      custNameAr = includeGroupGuests ? `حجز مجموعة زوار (${guestCount} أشخاص)` : 'زائرة زائرة';
      custPhone = '+966 50 000 0000';
      loyalty = 'Guest Account';
    }

    let finalStaged = [...stagedServices];
    if (finalStaged.length === 0) {
      const srv = liveServices.find(s => s.id === currentServiceId);
      if (srv) {
        finalStaged.push({
          id: `stg-${Date.now()}`,
          serviceId: currentServiceId,
          staffId: currentStaffId,
          startTime: currentStartTime,
          duration: currentDuration,
          discountType: currentDiscountType,
          discountValue: currentDiscountValue,
          notes: currentServiceNotes,
        });
      }
    }

    if (finalStaged.length === 0) {
      addLocalToast('يرجى إدراج خدمة واحدة على الأقل لتأكيد الحجز', 'Please add at least one service to confirm booking', 'warning');
      return;
    }

    let firstStaffId = finalStaged[0].staffId;
    let earliestStartTime = finalStaged[0].startTime;
    const payloadItems = finalStaged.map((item) => {
      const srv = liveServices.find(s => s.id === item.serviceId);
      return {
        serviceId: item.serviceId,
        staffId: item.staffId,
        requestedStaffId: item.staffId,
        startTime: buildIsoFromMinutes(getSelectedDateKey(), item.startTime),
        notes: item.notes || sessionNotes || null,
        paymentMethod: createSplitActive || giftCardCodeInput ? 'paid' : 'at-center',
        assignmentMode: item.staffId ? 'tenant_reassigned' : 'auto_assigned',
        duration: item.duration || srv?.duration || 60,
        discountType: item.discountType,
        discountValue: item.discountValue,
        serviceName: isRtl ? (srv?.nameAr || srv?.name || '') : (srv?.nameEn || srv?.name || '')
      };
    });

    void (async () => {
      try {
        const response = await tenantApiAdapter.createAppointment({
          items: payloadItems,
          staffId: firstStaffId,
          startTime: buildIsoFromMinutes(getSelectedDateKey(), earliestStartTime),
          notes: sessionNotes || finalStaged.map(s => s.notes).filter(Boolean).join(' | '),
          assignmentMode: 'tenant_reassigned',
          notifyCustomer: true,
          paymentMethod: createSplitActive || giftCardCodeInput ? 'paid' : 'at-center',
          paymentAllocations: createSplitActive
            ? Object.entries(splitAmounts)
                .filter(([, amount]) => Number(amount) > 0)
                .map(([paymentMethod, amount]) => ({ paymentMethod, amount: Number(amount) }))
            : undefined,
          platformUserId: custMode === 'existing' ? selectedCustId : undefined,
          customer: custMode === 'new' || custMode === 'walkin'
            ? {
                firstName: custNameEn.trim(),
                lastName: '',
                email: custEmail.trim(),
                phone: custPhone.trim()
              }
            : null
        });

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to create appointment');
        }

        setIsCreateDrawerOpen(false);
        setStagedServices([]);
        setCreateStep(1);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustEmail('');
        setSessionNotes('');
        setGiftCardCodeInput('');
        setCreateSplitActive(false);

        await loadBoardData();
        const createdAppointment = response?.appointment || response?.appointments?.[0] || null;
        if (createdAppointment) {
          const createdSessionSeed = {
            ...createdAppointment,
            bookingSession: {
              ...(createdAppointment.bookingSession || {}),
              appointments: Array.isArray(response?.appointments) ? response.appointments : (createdAppointment.bookingSession?.appointments || []),
              id: createdAppointment.bookingSession?.id || createdAppointment.bookingSessionId || response?.bookingSession?.id || createdAppointment.bookingSession?.bookingReference || createdAppointment.bookingReference || undefined,
              bookingReference: createdAppointment.bookingSession?.bookingReference || createdAppointment.bookingReference || response?.bookingSession?.bookingReference || undefined
            }
          };
          setActiveAppointment(mapBoardAppointment(createdSessionSeed, getSelectedDateKey()));
        }

        addLocalToast(
          `تم إدراج الموعد الجديد لـ ${custNameAr} بنجاح على مخطط لوحة التشغيل! 🗓️`,
          `Successfully scheduled new appointment for ${custNameEn}! 🗓️`,
          'success'
        );
      } catch (err) {
        console.error('Failed to create appointment', err);
        addLocalToast(
          'تعذر إنشاء الموعد الجديد',
          'Failed to create appointment',
          'warning'
        );
      }
    })();
  };

  const handleConfirmBlockCreation = () => {
    const newBlock: Appointment = {
      id: `block-created-${Date.now()}`,
      customerNameEn: blockTitleEn.toUpperCase(),
      customerNameAr: blockTitleAr,
      serviceNameEn: 'Reserved Operational Block Interval',
      serviceNameAr: 'فترة حظر زمني محددة للصيانة/الراحة',
      staffId: blockStaffId,
      startTime: blockStartTime,
      duration: blockDuration,
      status: 'confirmed',
      paymentStatus: 'paid',
      isGroupBooking: false,
      hasNotes: false,
      price: 0,
      tags: ['Blocked', blockType],
      type: 'blocked',
      blockedType: blockType
    };

    setAppointments(prev => [...prev, newBlock]);
    setIsCreateDrawerOpen(false);
    addLocalToast(
      `تم حظر الفترة الزمنية (${blockTitleAr}) بنجاح للأخصائية المعنية`,
      `Successfully blocked time (${blockTitleEn}) for the stylist`,
      'success'
    );
  };

  // --- OPERATIONS FOR POS CART DRAWER ---
  const handleRegenerateGiftCardCode = () => {
    const code = 'REF-GFT-2026-' + Math.floor(1000 + Math.random() * 9000);
    setGeneratedGcCode(code);
  };

  const handleAddGiftCardToCart = () => {
    const newItem: CartItem = {
      id: `gc-item-${Date.now()}`,
      type: 'giftcard',
      nameAr: `بطاقة هدايا فاخرة من ${gcSender || 'عميلة رفاه'} لـ ${gcRecipient || 'شخص عزيز'}`,
      nameEn: `Luxury Gift Card from ${gcSender || 'REFAH Guest'} to ${gcRecipient || 'Dear Guest'}`,
      price: gcValue,
      quantity: 1,
      skuOrCode: generatedGcCode,
      recipient: gcRecipient,
      sender: gcSender
    };

    setCartItems(prev => [...prev, newItem]);
    setGcSender('');
    setGcRecipient('');
    handleRegenerateGiftCardCode();
    addLocalToast(
      'تمت إضافة بطاقة الهدايا بنجاح إلى سلة المبيعات الرقمية 🛒',
      'Gift card added to POS sales cart successfully 🛒',
      'success'
    );
  };

  const handleAddProductToCart = (prod: Product) => {
    if (prod.stock === 0) {
      addLocalToast(
        'عذراً، هذا المنتج غير متوفر بالمخزون حالياً!',
        'Sorry, this product is currently out of stock!',
        'warning'
      );
      return;
    }

    setCartItems(prev => {
      const exists = prev.find(item => item.id === prod.id);
      if (exists) {
        return prev.map(item => 
          item.id === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, {
          id: prod.id,
          type: 'product',
          nameAr: prod.nameAr,
          nameEn: prod.nameEn,
          price: prod.price,
          quantity: 1,
          skuOrCode: prod.sku
        }];
      }
    });

    addLocalToast(
      `تمت إضافة "${isRtl ? prod.nameAr : prod.nameEn}" للسلة`,
      `Added "${isRtl ? prod.nameAr : prod.nameEn}" to cart`,
      'success'
    );
  };

  const handleUpdateCartItemQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== id));
      return;
    }
    setCartItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const handleProcessPosCheckout = async () => {
    if (cartItems.length === 0) {
      addLocalToast('سلة المبيعات فارغة، لا يمكن إتمام عملية الشراء', 'Sales cart is empty. Cannot checkout', 'warning');
      return;
    }

    let buyerName = isRtl ? 'زائر مجهول / Walk-in' : 'Walk-in Guest / زائر مجهول';
    let customerId: string | undefined = undefined;
    if (posCustMode === 'existing') {
      const cust = liveCustomers.find(c => c.id === posSelectedCustId);
      if (cust) {
        buyerName = cust.name;
        customerId = cust.id;
      }
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;

    let paymentMethodSummary = isRtl ? 'أطراف مدى المشتركة' : 'Mada Unified Terminals';
    let allocations = undefined;
    if (posSplitActive) {
      allocations = {
        card: posSplitAmounts.card,
        cash: posSplitAmounts.cash,
        wallet: posSplitAmounts.wallet,
        bank: posSplitAmounts.bank
      };
      const parts = [];
      if (posSplitAmounts.card > 0) parts.push(`مدى: ${posSplitAmounts.card} ر.س`);
      if (posSplitAmounts.cash > 0) parts.push(`نقداً: ${posSplitAmounts.cash} ر.س`);
      if (posSplitAmounts.wallet > 0) parts.push(`المحفظة: ${posSplitAmounts.wallet} ر.س`);
      if (posSplitAmounts.bank > 0) parts.push(`تحويل: ${posSplitAmounts.bank} ر.س`);
      paymentMethodSummary = parts.join(' | ');
    } else {
      paymentMethodSummary = isRtl ? 'مدفوع بالكامل بالبطاقة الرقمية' : 'Paid in full via credit card terminal';
    }

    try {
      const productItems = cartItems.filter(i => i.type === 'product');
      const giftCardItems = cartItems.filter(i => i.type === 'giftcard');
      let orderId = `REF-POS-${Math.floor(100000 + Math.random() * 900000)}`;

      if (productItems.length > 0) {
        const prodRes = await tenantApiAdapter.checkoutProducts({
          items: productItems.map(p => ({ productId: p.id, quantity: p.quantity, price: p.price })),
          customerId,
          customerName: buyerName,
          paymentMethod: paymentMethodSummary,
          paymentAllocations: allocations
        });
        if (prodRes.orderId || prodRes.transactionRef) orderId = prodRes.orderId || prodRes.transactionRef;
      }

      if (giftCardItems.length > 0) {
        const gcRes = await tenantApiAdapter.checkoutGiftCards({
          items: giftCardItems.map(g => ({ giftCardId: g.id, quantity: g.quantity, price: g.price })),
          customerId,
          customerName: buyerName,
          paymentMethod: paymentMethodSummary,
          paymentAllocations: allocations
        });
        if (gcRes.orderId || gcRes.transactionRef) orderId = gcRes.orderId || gcRes.transactionRef;
      }

      setCompletedOrder({
        orderId: orderId,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16),
        customerName: buyerName,
        items: [...cartItems],
        subtotal,
        vat,
        total,
        paymentSummary: paymentMethodSummary
      });

      setCartItems([]);
      setPosSplitActive(false);
      setPosSplitAmounts({ card: 0, cash: 0, wallet: 0, bank: 0 });

      addLocalToast(
        'تمت فوترة المبيعات وتأكيد السداد بنجاح! 🧾',
        'POS Sale billed and settled successfully! 🧾',
        'success'
      );
    } catch (err) {
      console.error('POS Checkout failed', err);
      addLocalToast('خطأ في إتمام الطلب', 'POS Checkout error', 'warning');
    }
  };

  // Helper to calculate active 4-day block for Week view
  const getDaysOfActiveBlock = (baseDate: Date) => {
    const list: string[] = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  };

  // Filters application
  const filteredAppointments = appointments.filter(apt => {
    const matchesStaff = selectedStylistFilter === 'all' || apt.staffId === selectedStylistFilter;
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    const matchesCategory = serviceCategoryFilter === 'all' || apt.type === 'blocked' || apt.serviceCategory === serviceCategoryFilter;
      const matchesSearch = searchQuery === '' || 
      apt.customerNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.customerNameAr.includes(searchQuery) ||
      apt.serviceNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.serviceNameAr.includes(searchQuery) ||
      `${apt.customerPhone || ''}`.includes(searchQuery) ||
      `${apt.id || ''}`.toLowerCase().includes(searchQuery.toLowerCase());

    const dateStr = apt.date || '2026-06-28';
    let matchesDate = false;
    
    if (viewMode === 'day') {
      matchesDate = dateStr === selectedDate.toISOString().split('T')[0];
    } else if (viewMode === 'week') {
      const activeBlock = getDaysOfActiveBlock(selectedDate);
      matchesDate = activeBlock.includes(dateStr);
    } else {
      // Agenda view shows all appointments starting from selected date
      const targetDateStr = selectedDate.toISOString().split('T')[0];
      matchesDate = dateStr >= targetDateStr;
    }

    return matchesStaff && matchesStatus && matchesCategory && matchesSearch && matchesDate;
  });

  // Calculate coordinates of the dragged element's ghost card
  const draggedApt = draggedAptId ? appointments.find(a => a.id === draggedAptId) : null;

  return (
    <div className="space-y-4 select-none font-sans" id="appointments-workspace">
      
      {/* 1. COMPREHENSIVE CONTROL BAR & BOARD CONTROLS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Unified Tool controls: Prev, Next, Today, Date Picker, Day / Week, Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Day Shift Segment */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button 
                onClick={() => handleDayShift(-1)} 
                className="p-1 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Previous Day"
              >
                <ChevronLeft size={14} />
              </button>
              <button 
                onClick={() => setSelectedDate(new Date(2026, 5, 28))} 
                className="px-2.5 py-1 font-bold text-xs hover:bg-white rounded-md text-slate-700 transition-all"
              >
                {t.today}
              </button>
              <button 
                onClick={() => handleDayShift(1)} 
                className="p-1 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                title="Next Day"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Date Picker Input */}
            <div className="relative flex items-center bg-slate-100 rounded-lg border border-slate-200 p-1 px-2 text-xs font-bold text-slate-700">
              <CalendarIcon size={13} className="mr-1.5 ml-1.5 text-slate-500" />
              <input 
                type="date" 
                value={selectedDate.toISOString().split('T')[0]} 
                onChange={(e) => {
                  const parts = e.target.value.split('-');
                  if (parts.length === 3) {
                    setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
                  }
                }}
                className="bg-transparent border-none outline-none text-xs font-bold font-sans cursor-pointer focus:ring-0 p-0.5" 
              />
            </div>

            {/* Day / Week / Agenda views tab */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewMode('day')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  viewMode === 'day' ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'يومي' : 'Day'}
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  viewMode === 'week' ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'أسبوعي' : 'Week'}
              </button>
              <button 
                onClick={() => setViewMode('agenda')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  viewMode === 'agenda' ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'أجندة' : 'Agenda'}
              </button>
            </div>

            {/* Refresh button with action */}
            <button 
              onClick={triggerRefresh}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center cursor-pointer"
              title="Refresh Schedule"
            >
              <RefreshCw size={14} className={`${isRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center cursor-pointer"
              title={isSidebarCollapsed ? (isRtl ? 'توسيع الشريط الجانبي' : 'Expand sidebar') : (isRtl ? 'طي الشريط الجانبي' : 'Collapse sidebar')}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Add Appointment Global Trigger */}
            <button 
              onClick={() => {
                setCreateMode('appointment');
                setCreateStep(1);
                setStagedServices([]);
                setIsCreateDrawerOpen(true);
              }}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={13} className="text-amber-400" />
              <span>{isRtl ? 'حجز موعد جديد 🗓️' : 'New Appointment 🗓️'}</span>
            </button>

            {/* POS Cart Counter Trigger */}
            <button 
              onClick={() => {
                setIsCartDrawerOpen(true);
                setCompletedOrder(null);
              }}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-950 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag size={13} className="text-zinc-950" />
              <span>{isRtl ? 'صندوق المبيعات والبطاقات 🛒' : 'POS Retail Counter 🛒'}</span>
            </button>

          </div>
        </div>

        {/* SERVICE CATEGORY FILTER CHIPS */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Filter size={10} className="text-amber-500" />
            {isRtl ? 'تصنيف الخدمات:' : 'Category Filter:'}
          </span>
          {[
            { id: 'all', labelEn: 'All Services', labelAr: 'جميع الخدمات', color: 'bg-slate-100 border-slate-200 text-slate-700' },
            { id: 'hair', labelEn: 'Hair Styling & Dye', labelAr: 'الشعر والصبغات', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            { id: 'spa', labelEn: 'Spa & Hydra-Facial', labelAr: 'العناية بالبشرة والسبا', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
            { id: 'nails', labelEn: 'Premium Nails Art', labelAr: 'فن العناية بالأظافر', color: 'bg-rose-50 border-rose-200 text-rose-800' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setServiceCategoryFilter(cat.id)}
              className={`py-1 px-3 border rounded-full text-xs font-semibold transition-all cursor-pointer ${
                serviceCategoryFilter === cat.id 
                  ? 'bg-zinc-900 text-white border-zinc-950 scale-102 shadow-xs' 
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {isRtl ? cat.labelAr : cat.labelEn}
            </button>
          ))}

          {/* Helper tip */}
          <span className="text-[10px] text-slate-400 italic ml-auto flex items-center gap-1">
            <AlertCircle size={10} className="text-amber-500" />
            {t.dragTip}
          </span>
        </div>
      </div>

      {/* 2. GRID WORKSPACE: LEFT CONTROLLER & CENTER BOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* LEFT COLUMN: CONTROLS & DATE NAVIGATOR (col-span-3) */}
        <div className={`${isSidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-4`}>
          
          {/* Quick Date Indicator Widget */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'المخطط الزمني للتشغيل' : 'Daily Timeline Navigator'}</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Selected Date Presentation */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' })}
              </p>
              <p className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                {selectedDate.getDate()}
              </p>
              <p className="text-xs font-bold text-slate-600">
                {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Quick mini-strip calendar mapping */}
            {isSidebarCollapsed ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isRtl ? 'الشريط مطوي' : 'Sidebar collapsed'}
                </p>
                <button
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-[11px] font-bold text-white"
                >
                  {isRtl ? 'توسيع الآن' : 'Expand now'}
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-7 gap-1 text-center">
              {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                const day = new Date(selectedDate);
                day.setDate(day.getDate() + offset);
                const isSelected = offset === 0;
                return (
                  <button 
                    key={offset}
                    onClick={() => handleDayShift(offset)}
                    className={`p-1.5 rounded-lg text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                      isSelected 
                        ? 'bg-zinc-900 text-white shadow-md scale-105' 
                        : 'hover:bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span className="opacity-70">{day.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'narrow' })}</span>
                    <span className="text-xs">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>
            )}
          </div>

          {/* Search & liveStylists / Filters Panel */}
          {!isSidebarCollapsed && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={12} className="text-amber-500" />
                {isRtl ? 'البحث والتصفية والفرز' : 'FILTER CONTROL DESK'}
              </span>
              <SlidersHorizontal size={13} className="text-slate-400" />
            </div>

            {/* Search client or service */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{isRtl ? 'البحث عن حجز' : 'Search'}</label>
              <div className="relative">
                <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={13} />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'اسم العميل، الخدمة...' : 'Client, service name...'}
                  className={`w-full ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all`}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Stylist filter dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{isRtl ? 'مقدم الخدمة / الخبيرة' : 'Staff Stylist'}</label>
              <div className="relative">
                <select
                  value={selectedStylistFilter}
                  onChange={(e) => setSelectedStylistFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
                >
                  <option value="all">👑 {t.allStaff}</option>
                  {liveStylists.map(s => (
                    <option key={s.id} value={s.id}>✨ {isRtl ? s.nameAr : s.nameEn}</option>
                  ))}
                </select>
                <ChevronDown size={14} className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none`} />
              </div>
            </div>

            {/* Status filtering strip */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{isRtl ? 'حالة الموعد' : 'Booking Status'}</label>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { id: 'all', label: t.allStatus },
                  { id: 'confirmed', label: t.confirmed },
                  { id: 'arrived', label: t.arrived },
                  { id: 'completed', label: t.completed }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setStatusFilter(opt.id)}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-center border transition-all ${
                      statusFilter === opt.id 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear filters trigger */}
            {(selectedStylistFilter !== 'all' || serviceCategoryFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '') && (
              <button 
                onClick={() => {
                  setSelectedStylistFilter('all');
                  setServiceCategoryFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="w-full py-2 bg-slate-100 hover:bg-zinc-900 hover:text-white transition-all text-[10px] font-bold text-slate-600 rounded-lg uppercase tracking-wider"
              >
                {t.clearFilters}
              </button>
            )}
          </div>
          )}

          {/* Real-time ZATCA & Platform Status card */}
          <div className="bg-zinc-950 text-white p-4 rounded-xl border border-zinc-800 space-y-3 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Scissors size={80} className="text-white" />
            </div>
            <h3 className="text-xs font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              <Sparkles size={12} className="animate-spin text-amber-400" />
              {isRtl ? 'أدوات تخطيط ذكية' : 'Intelligent Planners'}
            </h3>
            <div className="space-y-2 text-xs text-zinc-300">
              <p className="leading-relaxed">
                {isRtl 
                  ? 'الجدول يدعم السحب والإفلات وتغيير مدة المواعيد مباشرة. انقر بالزر الأيمن في أي خلية.' 
                  : 'Board features live drag & drop rescheduling, vertical handles to stretch duration, and custom context actions.'}
              </p>
              <div className="pt-2 border-t border-zinc-800 space-y-1 text-[10px] text-zinc-400">
                <div className="flex justify-between">
                  <span>{isRtl ? 'حالة التزامن' : 'Integration Status'}</span>
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                    Online
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{isRtl ? 'توقيت الخادم' : 'Server Time Zone'}</span>
                  <span className="font-mono text-zinc-400">UTC+3 (Riyadh)</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* CENTER COLUMN: INTERACTIVE SCHEDULER BOARD (col-span-9) */}
        <div className={`${isSidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-9'}`}>
          
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
            
            {/* Timeline Scheduler Navigation Bar */}
            <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                  {isRtl ? 'مراقبة الصالون والسبا الحية' : 'LIVE SALON ROOM MONITOR'}
                </span>
              </div>
              
              {/* Layout strip helpers */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-2">{isRtl ? 'مستوى الدقة:' : 'Step Precision:'}</span>
                <span className="bg-amber-500/10 text-amber-700 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">5 {isRtl ? 'دقائق' : 'Mins'}</span>
                <span className="bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded text-[10px] font-bold">ZATCA Compliant</span>
              </div>
            </div>

            {/* THE INTERACTIVE SCHEDULE BOARD CONTAINER */}
            <div className="overflow-x-auto scrollbar-thin relative" id="interactive-board-scroll">
              
              {viewMode === 'agenda' ? (
                /* 1. COMPREHENSIVE AGENDA SCHEDULE VIEW */
                <div className="p-6 bg-white min-h-[420px]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-6 gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{isRtl ? 'قائمة أجندة المواعيد النشطة والمستقبلية' : 'AGENDA OF ACTIVE & UPCOMING SESSIONS'}</h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        {isRtl 
                          ? `تعرض الجلسات المجدولة ابتداءً من ${selectedDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}` 
                          : `Displaying scheduling matrix from ${selectedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })} onwards.`}
                      </p>
                    </div>
                    <span className="bg-zinc-900 text-amber-400 px-3 py-1 rounded-lg text-xs font-mono font-black self-start sm:self-auto shadow-xs">
                      {filteredAppointments.length} {isRtl ? 'جلسات متبقية' : 'Sessions Listed'}
                    </span>
                  </div>

                  {filteredAppointments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-4 border border-slate-200">
                        <CalendarIcon size={32} />
                      </div>
                      <p className="text-sm font-black text-slate-700">{isRtl ? 'لا توجد مواعيد مضافة في الأجندة لهذا البحث.' : 'No agenda appointments found matching the current filters.'}</p>
                      <p className="text-xs text-slate-400 mt-1">{isRtl ? 'حاول إزالة الفلاتر أو تغيير تاريخ البدء.' : 'Try clearing active filters or changing the timeline base date.'}</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {filteredAppointments.map((apt) => {
                        const stylist = liveStylists.find(s => s.id === apt.staffId);
                        const statusBadgeColor = 
                          apt.status === 'confirmed' ? 'bg-amber-100 text-amber-700 border-amber-200/60' :
                          apt.status === 'arrived' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          apt.status === 'completed' ? 'bg-zinc-100 text-zinc-700 border-zinc-200' : 'bg-rose-100 text-rose-700 border-rose-200';

                        const statusText = 
                          apt.status === 'confirmed' ? t.confirmed :
                          apt.status === 'arrived' ? t.arrived :
                          apt.status === 'completed' ? t.completed : (isRtl ? 'ملغي' : 'Cancelled');

                        return (
                          <div 
                            key={apt.id}
                            className="flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-slate-50/60 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl hover:shadow-sm transition-all cursor-pointer gap-4"
                            onClick={() => openAppointmentDetails(apt)}
                          >
                            <div className="flex flex-col md:flex-row md:items-center gap-4 min-w-0 flex-1">
                              {/* Date & Time block */}
                              <div className="flex md:flex-col items-center md:items-start shrink-0 min-w-[120px] gap-2 md:gap-0.5 border-r md:border-r-0 border-slate-200 pb-2 md:pb-0">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider font-mono">{apt.date}</span>
                                <span className="text-sm font-mono font-black text-slate-800">{formatMinutesToTime(apt.startTime)}</span>
                                <span className="text-[10px] text-slate-400 font-bold mt-0.5">{apt.duration} {t.durationMin}</span>
                              </div>

                              {/* Customer and treatment details */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-black text-slate-800 truncate">
                                    {isRtl ? apt.customerNameAr : apt.customerNameEn}
                                  </h4>
                                  {apt.isGroupBooking && (
                                    <span className="bg-zinc-950 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 leading-none">
                                      <Users size={8} />
                                      <span>{isRtl ? `مرافقين (${apt.guestCount || 2})` : `${apt.guestCount || 2} guests`}</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-semibold text-slate-600 truncate mt-1.5">
                                  {isRtl ? apt.serviceNameAr : apt.serviceNameEn}
                                </p>
                                {apt.notes && (
                                  <p className="text-[10px] text-slate-400 italic mt-1 truncate max-w-md">
                                    "{apt.notes}"
                                  </p>
                                )}
                              </div>

                              {/* Stylist block */}
                              {stylist && (
                                <div className="flex items-center gap-2 shrink-0 bg-white border border-slate-200/60 p-1.5 rounded-lg">
                                  <div className="w-6 h-6 rounded-full overflow-hidden border border-slate-200">
                                    <img src={stylist.avatar} alt={stylist.nameEn} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  </div>
                                  <div className="text-left min-w-0">
                                    <p className="text-[10px] font-black text-slate-700 leading-none">{isRtl ? stylist.nameAr : stylist.nameEn}</p>
                                    <p className="text-[8px] text-slate-400 font-bold leading-none mt-1 uppercase tracking-tight">{isRtl ? stylist.roleAr : stylist.roleEn}</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Price & Action block */}
                            <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 mt-2 lg:mt-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-150">
                              <div className="text-right">
                                <span className="text-xs font-black text-slate-800 font-mono">{apt.price} {t.riyal}</span>
                                <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: apt.paymentStatus === 'paid' ? '#059669' : apt.paymentStatus === 'partial' ? '#d97706' : '#dc2626' }}>
                                  {apt.paymentStatus === 'paid' ? t.paid : apt.paymentStatus === 'partial' ? t.partial : t.unpaid}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-[9px] font-black border rounded-md shadow-2xs ${statusBadgeColor}`}>
                                  {statusText}
                                </span>
                                <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/65 rounded-lg transition-all cursor-pointer">
                                  <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* 2. INTERACTIVE TIMELINE SATELLITE BOARD (Day or Week) */
                <div className="min-w-[920px] relative flex flex-col" style={{ height: `${(TOTAL_HOURS * SLOT_HEIGHT) + 60}px` }}>
                  
                  {/* Board Columns Header */}
                  <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 sticky top-0 z-20 h-12 items-center text-center">
                    {/* Left corner time column header */}
                    <div className="col-span-2 border-r border-slate-200 h-full flex items-center justify-center font-bold text-xs text-slate-500 bg-slate-50">
                      {isRtl ? 'الفترة' : 'Time Slot'}
                    </div>

                    {viewMode === 'day' ? (
                      /* Staff columns headers */
                      <div className="col-span-10 grid grid-cols-4 h-full relative">
                        {liveStylists.map((stylist) => {
                          const name = isRtl ? stylist.nameAr : stylist.nameEn;
                          const role = isRtl ? stylist.roleAr : stylist.roleEn;
                          const status = stylistStatuses[stylist.id] || 'active';
                          
                          // Status mapping helpers
                          const statusColor = 
                            status === 'active' ? 'bg-emerald-500' :
                            status === 'break' ? 'bg-amber-500' : 'bg-rose-500';

                          const statusText = 
                            status === 'active' ? (isRtl ? 'نشط' : 'Active') :
                            status === 'break' ? (isRtl ? 'في استراحة' : 'On Break') : (isRtl ? 'خارج العمل' : 'Off-duty');

                          return (
                            <div 
                              key={stylist.id} 
                              className="border-r last:border-r-0 border-slate-200 h-full flex items-center justify-between px-3 bg-white relative min-w-0"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {/* Avatar with status indicator badge */}
                                <div className="relative w-7 h-7 rounded-full border border-slate-200 shrink-0 select-none">
                                  <img src={stylist.avatar} alt={name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusColor} border-2 border-white animate-pulse shadow-xs`} />
                                </div>
                                
                                <div className="text-left min-w-0">
                                  <p className="text-xs font-black text-slate-800 truncate leading-none flex items-center gap-1">
                                    {name}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase leading-none">
                                    {role} • <span className="font-semibold text-slate-500">{statusText}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Lane Configuration Action Trigger */}
                              <div className="relative shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStylistMenuId(activeStylistMenuId === stylist.id ? null : stylist.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-all cursor-pointer"
                                  title={isRtl ? 'تعديل حالة الخبيرة' : 'Lane Actions'}
                                >
                                  <ChevronDown size={14} />
                                </button>

                                {/* Dynamic Lane Settings Dropdown Overlay */}
                                <AnimatePresence>
                                  {activeStylistMenuId === stylist.id && (
                                    <>
                                      {/* Invisible click backdrop to dismiss */}
                                      <div className="fixed inset-0 z-40" onClick={() => setActiveStylistMenuId(null)} />
                                      
                                      <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className={`absolute top-6 ${isRtl ? 'left-0' : 'right-0'} w-40 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 space-y-1`}
                                      >
                                        <div className="px-2 py-1 border-b border-slate-100 mb-1 text-left">
                                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{isRtl ? 'تحديث حالة خبيرة التجميل' : 'PROVIDER STATUS'}</p>
                                        </div>
                                        
                                        <button
                                          onClick={() => {
                                            setStylistStatuses(prev => ({ ...prev, [stylist.id]: 'active' }));
                                            setActiveStylistMenuId(null);
                                            addLocalToast(
                                              `تم تعيين ${name} في وضع النشاط والجاهزية! 🟢`,
                                              `${stylist.nameEn} is now marked as Active and ready! 🟢`,
                                              'success'
                                            );
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 cursor-pointer ${
                                            status === 'active' ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-700'
                                          }`}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                          <span>{isRtl ? 'جاهزة ومتاحة (نشط)' : 'Active & Ready'}</span>
                                        </button>

                                        <button
                                          onClick={() => {
                                            setStylistStatuses(prev => ({ ...prev, [stylist.id]: 'break' }));
                                            setActiveStylistMenuId(null);
                                            addLocalToast(
                                              `تم تعيين ${name} في فترة استراحة مؤقتة ☕`,
                                              `${stylist.nameEn} is now On Break ☕`,
                                              'warning'
                                            );
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 cursor-pointer ${
                                            status === 'break' ? 'text-amber-700 bg-amber-50/50' : 'text-slate-700'
                                          }`}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                          <span>{isRtl ? 'في استراحة قصيرة ☕' : 'On Short Break'}</span>
                                        </button>

                                        <button
                                          onClick={() => {
                                            setStylistStatuses(prev => ({ ...prev, [stylist.id]: 'off' }));
                                            setActiveStylistMenuId(null);
                                            addLocalToast(
                                              `تم تعيين ${name} كخارج العمل للوردية الحالية 🛑`,
                                              `${stylist.nameEn} is now marked as Off-duty 🛑`,
                                              'warning'
                                            );
                                          }}
                                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 cursor-pointer ${
                                            status === 'off' ? 'text-rose-700 bg-rose-50/50' : 'text-slate-700'
                                          }`}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                          <span>{isRtl ? 'خارج العمل اليوم 🛑' : 'Off-duty / Shift End'}</span>
                                        </button>
                                      </motion.div>
                                    </>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Date columns headers (Week View) */
                      <div className="col-span-10 grid grid-cols-4 h-full relative">
                        {getDaysOfActiveBlock(selectedDate).map((dayStr, idx) => {
                          const d = new Date(dayStr);
                          const dayName = d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'short' });
                          const dateFormatted = d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
                          const isTodayStr = new Date().toISOString().split('T')[0] === dayStr;
                          
                          return (
                            <div 
                              key={idx} 
                              className={`border-r last:border-r-0 border-slate-200 h-full flex flex-col items-center justify-center px-2 select-none ${
                                isTodayStr ? 'bg-amber-500/5' : 'bg-white'
                              }`}
                            >
                              <span className={`text-xs font-black leading-tight ${isTodayStr ? 'text-amber-600' : 'text-slate-800'}`}>
                                {dayName} {isTodayStr && (isRtl ? '(اليوم)' : '(Today)')}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 mt-0.5 leading-none">{dateFormatted}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Loading Skeleton Overlays */}
                  <AnimatePresence>
                    {isLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white/75 backdrop-blur-xs z-30 flex flex-col justify-center items-center gap-3"
                      >
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2.5 h-2.5 bg-zinc-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs font-bold text-zinc-600">{isRtl ? 'مزامنة لوحة المواعيد...' : 'Synchronizing schedule...'}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Empty State Overlay if filtered list is empty */}
                  {filteredAppointments.length === 0 && !isLoading && (
                    <div className="absolute inset-x-0 bottom-0 top-12 bg-slate-50/80 z-10 flex flex-col justify-center items-center p-8 text-center">
                      <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-3 border border-slate-200">
                        <Search size={32} />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">{t.emptyStateText}</p>
                      <p className="text-xs text-slate-500 mt-1">{isRtl ? 'حاول إزالة أو تعديل بعض معايير التصفية والبحث.' : 'Try adjusting your search criteria or stylist selection.'}</p>
                      <button 
                        onClick={() => {
                          setSelectedStylistFilter('all');
                          setServiceCategoryFilter('all');
                          setStatusFilter('all');
                          setSearchQuery('');
                        }}
                        className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 cursor-pointer"
                      >
                        {t.clearFilters}
                      </button>
                    </div>
                  )}

                  {/* Calendar Body Area */}
                  <div className="flex-1 relative flex">
                    
                    {/* LEFT TIME STRIP COLUMN (2 of 12 columns) - STICKY RAIL */}
                    <div className="w-[16.6666%] border-r border-slate-200 bg-slate-50/50 flex-shrink-0 relative z-10" style={{ height: `${TOTAL_HOURS * SLOT_HEIGHT}px` }}>
                      {Array.from({ length: TOTAL_HOURS }).map((_, index) => {
                        const hourNum = START_HOUR + index;
                        const timeStr = formatMinutesToTime(index * 60);
                        return (
                          <div 
                            key={index} 
                            className="absolute w-full border-b border-slate-100/80 flex items-start justify-center pt-2 px-2"
                            style={{ 
                              top: `${index * SLOT_HEIGHT}px`, 
                              height: `${SLOT_HEIGHT}px` 
                            }}
                          >
                            <span className="text-[10px] font-black text-slate-400 font-mono tracking-tight">{timeStr}</span>
                          </div>
                        );
                      })}

                      {/* Left Timeline exact active hover zone marker */}
                      {hoveredSlot && (
                        <div 
                          className="absolute left-0 right-0 h-8 bg-amber-500/10 border-r-4 border-amber-500 z-20 flex items-center justify-center pointer-events-none transition-all"
                          style={{ top: `${(hoveredSlot.timeInMinutes / 60) * SLOT_HEIGHT}px`, marginTop: '-4px' }}
                        >
                          <span className="text-[10px] font-bold text-amber-700 font-mono">
                            {formatMinutesToTime(hoveredSlot.timeInMinutes)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CENTER SCHEDULER GRID (10 of 12 columns) */}
                    <div className="flex-1 relative" style={{ height: `${TOTAL_HOURS * SLOT_HEIGHT}px` }}>
                      
                      {/* Horizontal Hourly gridlines */}
                      {Array.from({ length: TOTAL_HOURS }).map((_, index) => (
                        <div 
                          key={index} 
                          className="absolute left-0 right-0 border-b border-slate-100 pointer-events-none"
                          style={{ 
                            top: `${index * SLOT_HEIGHT}px`, 
                            height: `${SLOT_HEIGHT}px` 
                          }}
                        />
                      ))}

                      {/* Column Dividers for columns (4 Columns) */}
                      <div className="absolute inset-0 grid grid-cols-4 pointer-events-none">
                        {Array.from({ length: 4 }).map((_, colIdx) => (
                          <div key={colIdx} className="border-r last:border-r-0 border-slate-200/60 h-full" />
                        ))}
                      </div>

                      {/* Interactivity Grid Cell Blocks - Mouse Tracker for 5-minute precision */}
                      <div className="absolute inset-0 grid grid-cols-4">
                        {viewMode === 'day' ? (
                          liveStylists.map((stylist) => (
                            <div 
                              key={stylist.id} 
                              className="h-full relative select-none cursor-pointer"
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeY = e.clientY - rect.top;
                                const totalMins = (relativeY / SLOT_HEIGHT) * 60;
                                const stepMins = Math.round(totalMins / 5) * 5;
                                setHoveredSlot({ staffId: stylist.id, timeInMinutes: stepMins });
                              }}
                              onMouseLeave={() => setHoveredSlot(null)}
                              onContextMenu={(e) => {
                                if (hoveredSlot) {
                                  handleContextMenu(e, stylist.id, hoveredSlot.timeInMinutes);
                                }
                              }}
                              onClick={() => {
                                if (hoveredSlot) {
                                  setCurrentStaffId(hoveredSlot.staffId);
                                  setCurrentStartTime(hoveredSlot.timeInMinutes);
                                  setCreateMode('appointment');
                                  setCreateStep(1);
                                  setStagedServices([]);
                                  setIsCreateDrawerOpen(true);
                                }
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeY = e.clientY - rect.top;
                                const totalMins = (relativeY / SLOT_HEIGHT) * 60;
                                const stepMins = Math.round(totalMins / 5) * 5;
                                setDragOverStaffId(stylist.id);
                                setDragOverTime(stepMins);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const aptId = e.dataTransfer.getData('text/plain');
                                if (aptId && dragOverStaffId && dragOverTime !== null) {
                                  setAppointments(prev => prev.map(a => {
                                    if (a.id === aptId) {
                                      if (!a.id.startsWith('block-')) {
                                        const patchDate = buildIsoFromMinutes(getSelectedDateKey(), dragOverTime);
                                      tenantApiAdapter.reassignRescheduleAppointment(a.id, {
                                        staffId: dragOverStaffId,
                                        startTime: patchDate,
                                        notifyCustomer: true
                                        }).then(() => {
                                          void loadBoardData();
                                        }).catch((err) => {
                                          console.error("Optimistic sync failed", err);
                                          const toast = getSchedulingErrorToast(err, 'تعذر نقل الموعد إلى الخانة الجديدة', 'Unable to move appointment to the new slot.');
                                          addLocalToast(toast.ar, toast.en, 'warning');
                                        });
                                      }
                                      return {
                                        ...a,
                                        staffId: dragOverStaffId,
                                        startTime: dragOverTime
                                      };
                                    }
                                    return a;
                                  }));
                                }
                                setDraggedAptId(null);
                                setDragOverStaffId(null);
                                setDragOverTime(null);
                              }}
                            >
                              {/* 5-minute slot hover indicator */}
                              {hoveredSlot && hoveredSlot.staffId === stylist.id && (
                                <div 
                                  className="absolute left-0 right-0 z-10 pointer-events-none flex justify-end border-t border-amber-500/50"
                                  style={{ 
                                    top: `${(hoveredSlot.timeInMinutes / 60) * SLOT_HEIGHT}px`,
                                    height: '16px',
                                    backgroundImage: 'repeating-linear-gradient(-45deg, rgba(245, 158, 11, 0.08) 0px, rgba(245, 158, 11, 0.08) 4px, transparent 4px, transparent 8px)'
                                  }}
                                >
                                  <span className="bg-zinc-900 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md -mt-2.5 mr-2 ml-2 tracking-tight">
                                    {formatMinutesToTime(hoveredSlot.timeInMinutes)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          /* Week view column block listeners */
                          getDaysOfActiveBlock(selectedDate).map((dayStr, idx) => (
                            <div 
                              key={idx} 
                              className="h-full relative select-none cursor-pointer"
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const relativeY = e.clientY - rect.top;
                                const totalMins = (relativeY / SLOT_HEIGHT) * 60;
                                const stepMins = Math.round(totalMins / 5) * 5;
                                setHoveredSlot({ date: dayStr, timeInMinutes: stepMins });
                              }}
                              onMouseLeave={() => setHoveredSlot(null)}
                              onClick={() => {
                                if (hoveredSlot) {
                                  const d = new Date(dayStr);
                                  setSelectedDate(d);
                                  setCurrentStartTime(hoveredSlot.timeInMinutes);
                                  setCurrentStaffId('st-1'); // default to first stylist
                                  setCreateMode('appointment');
                                  setCreateStep(1);
                                  setStagedServices([]);
                                  setIsCreateDrawerOpen(true);
                                }
                              }}
                            >
                              {/* 5-minute slot hover indicator for Week Columns */}
                              {hoveredSlot && hoveredSlot.date === dayStr && (
                                <div 
                                  className="absolute left-0 right-0 z-10 pointer-events-none flex justify-end border-t border-amber-500/50"
                                  style={{ 
                                    top: `${(hoveredSlot.timeInMinutes / 60) * SLOT_HEIGHT}px`,
                                    height: '16px',
                                    backgroundImage: 'repeating-linear-gradient(-45deg, rgba(245, 158, 11, 0.08) 0px, rgba(245, 158, 11, 0.08) 4px, transparent 4px, transparent 8px)'
                                  }}
                                >
                                  <span className="bg-zinc-900 text-amber-400 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-md -mt-2.5 mr-2 ml-2 tracking-tight">
                                    {formatMinutesToTime(hoveredSlot.timeInMinutes)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* GHOST PREVIEW OF DRAGGED APPOINTMENT (Only in Day View) */}
                      {viewMode === 'day' && draggedApt && dragOverStaffId && dragOverTime !== null && (
                        (() => {
                          const sIdx = liveStylists.findIndex(s => s.id === dragOverStaffId);
                          if (sIdx === -1) return null;
                          const leftPct = sIdx * 25;
                          const topPos = minutesToTop(dragOverTime);
                          const hPos = minutesToHeight(draggedApt.duration);
                          return (
                            <div
                              className="absolute border-2 border-dashed border-amber-500 bg-amber-500/10 rounded-lg pointer-events-none z-30 flex flex-col justify-between p-2 opacity-85"
                              style={{
                                left: `calc(${leftPct}% + 4px)`,
                                width: 'calc(25% - 8px)',
                                top: `${topPos}px`,
                                height: `${hPos}px`,
                              }}
                            >
                              <div className="space-y-1">
                                <span className="bg-amber-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase">
                                  MOVE TO: {formatMinutesToTime(dragOverTime)}
                                </span>
                                <p className="text-xs font-bold text-amber-900 truncate">{draggedApt.customerNameEn}</p>
                                <p className="text-[9px] text-amber-700 font-bold truncate">{isRtl ? liveStylists.find(s=>s.id === dragOverStaffId)?.nameAr : liveStylists.find(s=>s.id === dragOverStaffId)?.nameEn}</p>
                              </div>
                              <span className="text-[9px] text-amber-800 font-bold">{draggedApt.duration} mins</span>
                            </div>
                          );
                        })()
                      )}

                      {/* FLOATING APPOINTMENT CARDS (ABSOLUTELY POSITIONED) */}
                      {filteredAppointments.map((apt) => {
                        let leftPercent = 0;
                        
                        if (viewMode === 'day') {
                          const staffIdx = liveStylists.findIndex(s => s.id === apt.staffId);
                          if (staffIdx === -1) return null;
                          leftPercent = staffIdx * 25;
                        } else {
                          const activeBlock = getDaysOfActiveBlock(selectedDate);
                          const dayIdx = activeBlock.indexOf(apt.date || '2026-06-28');
                          if (dayIdx === -1) return null;
                          leftPercent = dayIdx * 25;
                        }

                        const cardTop = minutesToTop(apt.startTime);
                        const cardHeight = minutesToHeight(apt.duration);
                        const isDragged = draggedAptId === apt.id;

                        // Style variants
                        let cardStyle = {};
                        let classNames = "";

                        if (apt.type === 'blocked') {
                          classNames = "bg-slate-50 text-slate-500 border-slate-200 shadow-none hover:shadow-none";
                          cardStyle = {
                            backgroundImage: 'repeating-linear-gradient(45deg, #f1f5f9 0px, #f1f5f9 8px, #f8fafc 8px, #f8fafc 16px)'
                          };
                        } else {
                          // Color categories based on status
                          if (apt.status === 'confirmed') {
                            classNames = "bg-amber-50 text-amber-900 border-amber-200/80 shadow-xs hover:border-amber-300";
                          } else if (apt.status === 'arrived') {
                            classNames = "bg-emerald-50 text-emerald-900 border-emerald-200 shadow-xs hover:border-emerald-300";
                          } else if (apt.status === 'completed') {
                            classNames = "bg-zinc-100 text-zinc-700 border-zinc-200 shadow-xs opacity-90";
                          } else {
                            classNames = "bg-rose-50 text-rose-900 border-rose-200 shadow-xs";
                          }
                        }

                        return (
                          <div
                            key={apt.id}
                            draggable={viewMode === 'day'}
                            onDragStart={(e) => {
                              if (viewMode !== 'day') return;
                              e.dataTransfer.setData('text/plain', apt.id);
                              setDraggedAptId(apt.id);
                            }}
                            onDragEnd={() => {
                              setDraggedAptId(null);
                              setDragOverStaffId(null);
                              setDragOverTime(null);
                            }}
                            className={`absolute p-2.5 rounded-xl border transition-all cursor-pointer select-none group flex flex-col justify-between overflow-hidden ${
                              isDragged ? 'opacity-30 scale-95 ring-2 ring-amber-500 z-0' : 'hover:shadow-md z-10 hover:-translate-y-0.5'
                            } ${classNames}`}
                            style={{
                              left: `calc(${leftPercent}% + 4px)`,
                              width: 'calc(25% - 8px)',
                              top: `${cardTop}px`,
                              height: `${cardHeight}px`,
                              ...cardStyle
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAppointmentDetails(apt);
                            }}
                            onMouseDown={(e) => {
                              if (viewMode === 'day') {
                                handleMouseDown(e, apt.id, false);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (viewMode === 'day') {
                                handleContextMenu(e, apt.staffId, apt.startTime, apt.id);
                              }
                            }}
                          >
                            {/* Inner container to hold items */}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              
                              {/* Card Header Info */}
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <span className="text-[9px] uppercase font-black tracking-tight bg-zinc-900/10 px-1.5 py-0.5 rounded leading-none">
                                  {formatMinutesToTime(apt.startTime)}
                                </span>
                                
                                {/* Group booking or notes indicators */}
                                <div className="flex items-center gap-1 shrink-0 text-slate-500">
                                  {apt.isGroupBooking && (
                                    <div className="flex items-center gap-0.5 bg-zinc-900/10 px-1 rounded text-[8px] font-bold">
                                      <Users size={9} />
                                      <span>{apt.guestCount || 2}</span>
                                    </div>
                                  )}
                                  {apt.hasNotes && <MessageSquare size={10} className="text-zinc-700" />}
                                </div>
                              </div>

                              {/* Customer Name */}
                              <p className="text-xs font-bold truncate mt-1.5 leading-tight text-slate-900">
                                {isRtl ? apt.customerNameAr : apt.customerNameEn}
                              </p>

                              {/* Service name */}
                              <p className="text-[10px] opacity-90 font-medium truncate leading-tight text-slate-600 mt-0.5">
                                {isRtl ? apt.serviceNameAr : apt.serviceNameEn}
                              </p>
                            </div>

                            {/* Footer Info of Card */}
                            <div className="flex items-center justify-between gap-1 mt-1 text-[9px] opacity-90 pt-1.5 border-t border-slate-900/5 shrink-0">
                              <span className="font-bold font-mono text-slate-500">{apt.duration} {t.durationMin}</span>
                              
                              {/* Blocked vs Paid status indicators */}
                              {apt.type === 'blocked' ? (
                                <span className="bg-zinc-900/5 text-zinc-600 px-1 py-0.5 rounded text-[8px] font-black tracking-wide uppercase">
                                  {apt.blockedType}
                                </span>
                              ) : (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                  apt.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-700' : apt.paymentStatus === 'partial' ? 'bg-amber-500/10 text-amber-700' : 'bg-red-500/10 text-red-700'
                                }`}>
                                  {apt.paymentStatus === 'paid' ? t.paid : apt.paymentStatus === 'partial' ? t.partial : t.unpaid}
                                </span>
                              )}
                            </div>

                            {/* Absolute Bottom resize handle bar (Only in Day View) */}
                            {viewMode === 'day' && apt.type !== 'blocked' && (
                              <div
                                className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/5 hover:bg-black/15 cursor-ns-resize transition-all"
                                onMouseDown={(e) => handleMouseDown(e, apt.id, true)}
                                title="Drag to resize duration"
                              />
                            )}
                          </div>
                        );
                      })}

                    </div>

                  </div>

                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* 3. ABSOLUTE PORTAL POPUP CONTEXT MENU */}
      <AnimatePresence>
        {contextMenu && contextMenu.visible && (
          <div 
            className="fixed bg-zinc-950 text-white rounded-xl shadow-2xl border border-zinc-800 p-2 py-2.5 z-50 w-56 space-y-0.5 text-xs text-start"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          >
            <p className="text-[9px] text-zinc-500 font-black tracking-widest uppercase p-1.5 border-b border-zinc-800/80 mb-1">
              {isRtl ? 'أدوات التحكم السريعة' : 'QUICK BOARD CONTROLS'}
            </p>
            
            <button 
              onClick={() => triggerContextAction('new')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Plus size={13} className="text-amber-400" />
              <span>{isRtl ? 'إضافة حجز جديد' : 'Add New Appointment'}</span>
            </button>
            
            <button 
              onClick={() => triggerContextAction('giftcards')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Gift size={13} className="text-pink-400" />
              <span>{isRtl ? 'بطاقات الهدايا' : 'Gift Cards'}</span>
            </button>

            <button 
              onClick={() => triggerContextAction('products')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <ShoppingBag size={13} className="text-teal-400" />
              <span>{isRtl ? 'المنتجات والمستحضرات' : 'Products'}</span>
            </button>

            <button 
              onClick={() => triggerContextAction('block')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Lock size={13} className="text-neutral-400" />
              <span>{isRtl ? 'حظر فترة زمنية' : 'Add Blocked Time'}</span>
            </button>

            <button 
              onClick={() => triggerContextAction('shift')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Scissors size={13} className="text-indigo-400" />
              <span>{isRtl ? 'تعديل شيفت العمل الأسبوعي' : 'Edit Shift'}</span>
            </button>

            <div className="border-t border-zinc-800/60 my-1" />
            <button 
              onClick={() => triggerContextAction('refresh')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2 text-zinc-400"
            >
              <RefreshCw size={13} />
              <span>{isRtl ? 'تحديث اللوحة' : 'Refresh Board'}</span>
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PREMIUM APPOINTMENT DETAILS DRAWER (88vw operations workspace) */}
      <AnimatePresence>
        {drawerOpen && activeAppointment && (
          <div className="fixed inset-0 z-50 flex overflow-hidden">
            
            {/* Backdrop slide dim background */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
            />

            {/* Slide drawer container spanning 88vw */}
            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`absolute top-0 bottom-0 ${isRtl ? 'left-0' : 'right-0'} w-[88vw] bg-slate-50 border-${isRtl ? 'r' : 'l'} border-slate-200 shadow-2xl flex flex-col`}
            >
              
              {/* STICKY COMMAND HEADER */}
              <header className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 shrink-0 shadow-xs h-16">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-zinc-900 rounded-lg text-amber-400">
                    <CheckCircle2 size={18} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 leading-none">
                      {isRtl ? 'تفاصيل الحجز وإدارة العميل' : 'APPOINTMENT OPERATIONS CONTROL'}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        activeAppointment.status === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                        activeAppointment.status === 'arrived' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>
                        {activeAppointment.status === 'confirmed' ? t.confirmed :
                         activeAppointment.status === 'arrived' ? t.arrived : t.completed}
                      </span>
                      {appointmentDetailsReadOnly && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          {isRtl ? 'وضع قراءة' : 'Read only'}
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      {isRtl ? 'معتمد عبر الفاتورة الإلكترونية هيئة الزكاة والضريبة والجمارك' : 'ZATCA Cryptographic Stamp Compliant • ID: ' + activeAppointment.id}
                    </p>
                  </div>
                </div>

                {/* Operations tools */}
                <div className="flex items-center gap-2">
                  <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all cursor-pointer" title="Print Invoice">
                    <Printer size={15} />
                  </button>
                  <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all cursor-pointer" title="Share Touchpoint">
                    <Share2 size={15} />
                  </button>
                  <button
                    onClick={() => setIsCustomerProfileOpen(true)}
                    className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                    title={isRtl ? 'فتح ملف العميل' : 'Open customer profile'}
                  >
                    <div className="flex items-center gap-1.5">
                      <User size={14} />
                      <span>{isRtl ? 'ملف العميل' : 'Customer Profile'}</span>
                    </div>
                  </button>
                  <div className="h-5 w-px bg-slate-200 mx-1" />
                  <button 
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>

              {/* OPERATIONS THREE-COLUMN WORKSPACE BODY */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* COLUMN 1: STICKY CUSTOMER PROFILE & OPERATIONS SUMMARY (col-span-3) */}
                <div className="xl:col-span-3">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 sticky top-4">
                    
                    {/* Customer Info Card Header */}
                    <div className="text-center pb-4 border-b border-slate-100">
                      <div className="w-16 h-16 bg-amber-100 border border-amber-200 rounded-full flex items-center justify-center font-bold text-amber-700 text-xl mx-auto mb-2 select-none shadow-xs">
                        {activeAppointment.customerNameEn.slice(0, 2).toUpperCase()}
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight">
                        {isRtl ? activeAppointment.customerNameAr : activeAppointment.customerNameEn}
                      </h3>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/50 px-2.5 py-0.5 rounded-full mt-1.5 inline-block">
                        {activeCustomerTier || '—'}
                      </span>
                    </div>

                    {/* Quick Profile fields */}
                    <div className="space-y-3.5 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-400" />
                        <span className="font-mono">{activeCustomerPhone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-slate-400" />
                        <span className="truncate">{activeCustomerEmail || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-slate-400" />
                        <span>{activeCustomerBranch || '—'}</span>
                      </div>
                    </div>

                    {/* Tag chips with manual add option */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{isRtl ? 'الوسوم المميزة' : 'Customer Tags'}</span>
                      <div className="flex flex-wrap gap-1">
                        {activeAppointment.tags.map((tag, idx) => (
                          <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sticky notes editor box */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{isRtl ? 'تفضيلات وملاحظات خبيرة التجميل' : 'Stylist Notes'}</span>
                      <div className="bg-amber-50/50 border border-amber-200/40 p-3 rounded-lg text-xs text-amber-900 font-medium leading-relaxed">
                        {activeAppointment.notes || '—'}
                      </div>
                    </div>

                    {/* Wallet Quick Balance card */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-semibold">{isRtl ? 'رصيد المحفظة النشط:' : 'Active Wallet:'}</span>
                        <span className="font-mono font-black text-slate-800">{activeCustomerWallet} {t.riyal}</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* COLUMN 2: TABS & ACTION MODULES (col-span-5) */}
                <div className="xl:col-span-5 space-y-5">
                  
                  {/* Sliding Tabs selector header */}
                  <div className="bg-white p-1 rounded-xl border border-slate-200/60 flex gap-1 shadow-2xs">
                    {[
                      { id: 'overview', label: isRtl ? 'الملخص والتحكم' : 'Interactive Hub' },
                      { id: 'timeline', label: isRtl ? 'الخط الزمني' : 'Timeline History' },
                      { id: 'reviews', label: isRtl ? 'التقييمات والآراء' : 'Reviews Log' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setDrawerTab(tab.id as any)}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                          drawerTab === tab.id 
                            ? 'bg-zinc-900 text-white' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: CORE OPERATIONS & WALLET INTERFACE */}
                  {drawerTab === 'overview' && (
                    <div className="space-y-5">
                      
                      {/* Active service item banner */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200/40 px-2.5 py-0.5 rounded-full uppercase">
                              {isRtl ? 'الخدمة الرئيسية النشطة' : 'ACTIVE SERVICE LINE'}
                            </span>
                            <h4 className="font-bold text-slate-800 text-base mt-2.5">
                              {isRtl ? activeServiceSummary.nameAr : activeServiceSummary.nameEn}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <Clock size={12} />
                              <span>{activeServiceSummary.duration} {t.durationMin} • {isRtl ? 'مع خبيرة التجميل' : 'assigned to'} {isRtl ? liveStylists.find(s=>s.id === activeAppointment.staffId)?.nameAr : liveStylists.find(s=>s.id === activeAppointment.staffId)?.nameEn}</span>
                            </p>
                          </div>
                          <span className="text-base font-black text-slate-900 font-mono">
                            {activeServiceSummary.price} {t.riyal}
                          </span>
                        </div>

                        {/* Interactive Rebook / Reschedule tool buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                          <button 
                            onClick={async () => {
                              if (appointmentDetailsReadOnly) {
                                addLocalToast(
                                  isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                  isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                  'info'
                                );
                                return;
                              }
                              const serviceId = activeAppointment.serviceId;
                              if (!serviceId) {
                                addLocalToast(
                                  isRtl ? 'تعذر تكرار الموعد لأن الخدمة الأصلية غير متاحة.' : 'Unable to duplicate appointment because the source service is missing.',
                                  isRtl ? 'Unable to duplicate appointment because the source service is missing.' : 'تعذر تكرار الموعد لأن الخدمة الأصلية غير متاحة.',
                                  'warning'
                                );
                                return;
                              }

                              const baseDate = activeAppointment.date || getSelectedDateKey();
                              const duplicateStart = buildIsoFromMinutes(baseDate, activeAppointment.startTime + 120);
                              try {
                                const response = await tenantApiAdapter.createAppointment({
                                  serviceId,
                                  staffId: activeAppointment.staffId,
                                  startTime: duplicateStart,
                                  notes: activeAppointment.notes,
                                  notifyCustomer: false,
                                  assignmentMode: 'tenant_reassigned',
                                  customer: activeAppointment.customerId ? null : undefined,
                                  platformUserId: activeAppointment.customerId || undefined
                                });
                                if (response?.success) {
                                  await loadBoardData();
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    isRtl ? 'تمت إضافة نسخة جديدة من الموعد بعد ساعتين.' : 'Duplicate appointment created two hours later.',
                                    isRtl ? 'Duplicate appointment created two hours later.' : 'تمت إضافة نسخة جديدة من الموعد بعد ساعتين.',
                                    'success'
                                  );
                                } else {
                                  throw new Error(response?.message || 'Failed to duplicate appointment');
                                }
                              } catch (err: any) {
                                console.error('Failed to duplicate appointment', err);
                                addLocalToast(
                                  isRtl ? 'تعذر إنشاء النسخة المكررة.' : 'Unable to create duplicate appointment.',
                                  isRtl ? 'Unable to create duplicate appointment.' : 'تعذر إنشاء النسخة المكررة.',
                                  'warning'
                                );
                              }
                            }}
                            className="py-2 border border-slate-200 hover:border-zinc-900 hover:bg-zinc-900 hover:text-white bg-white rounded-lg text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Undo2 size={13} />
                            <span>{t.rebook}</span>
                          </button>
                          
                          <button 
                            onClick={async () => {
                              if (appointmentDetailsReadOnly) {
                                addLocalToast(
                                  isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                  isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                  'info'
                                );
                                return;
                              }
                              try {
                                const response = await tenantApiAdapter.updateAppointmentStatus(activeAppointment.id, 'cancelled', activeAppointment.notes);
                                if (response?.success) {
                                  await loadBoardData();
                                  setActiveAppointment(prev => prev ? { ...prev, status: 'cancelled' } : null);
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    isRtl ? 'تم إلغاء الموعد وحفظ الحالة على الخادم.' : 'Appointment cancelled and synced to the server.',
                                    isRtl ? 'Appointment cancelled and synced to the server.' : 'تم إلغاء الموعد وحفظ الحالة على الخادم.',
                                    'success'
                                  );
                                } else {
                                  throw new Error(response?.message || 'Failed to cancel appointment');
                                }
                              } catch (err) {
                                console.error('Failed to cancel appointment', err);
                                addLocalToast(
                                  isRtl ? 'تعذر إلغاء الموعد.' : 'Unable to cancel appointment.',
                                  isRtl ? 'Unable to cancel appointment.' : 'تعذر إلغاء الموعد.',
                                  'warning'
                                );
                              }
                            }}
                            className="py-2 border border-rose-200 hover:border-rose-500 hover:bg-rose-50 bg-white rounded-lg text-xs font-bold text-rose-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                            <Trash size={13} />
                            <span>{isRtl ? 'إلغاء الموعد' : 'Cancel Booking'}</span>
                          </button>

                          <button 
                            onClick={async () => {
                              if (appointmentDetailsReadOnly) {
                                addLocalToast(
                                  isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                  isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                  'info'
                                );
                                return;
                              }
                              try {
                                const response = await tenantApiAdapter.updateAppointmentStatus(
                                  activeAppointment.id,
                                  'cancelled',
                                  `${activeAppointment.notes || ''}${activeAppointment.notes ? ' | ' : ''}${isRtl ? 'إلغاء متأخر' : 'Late cancel'}`
                                );
                                if (response?.success) {
                                  await loadBoardData();
                                  setActiveAppointment(prev => prev ? { ...prev, status: 'cancelled' } : null);
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    isRtl ? 'تم تسجيل الإلغاء المتأخر وحفظه على الخادم.' : 'Late cancel recorded and synced to the server.',
                                    isRtl ? 'Late cancel recorded and synced to the server.' : 'تم تسجيل الإلغاء المتأخر وحفظه على الخادم.',
                                    'success'
                                  );
                                } else {
                                  throw new Error(response?.message || 'Failed to mark late cancel');
                                }
                              } catch (err) {
                                console.error('Failed to mark late cancel', err);
                                addLocalToast(
                                  isRtl ? 'تعذر تسجيل الإلغاء المتأخر.' : 'Unable to mark late cancel.',
                                  isRtl ? 'Unable to mark late cancel.' : 'تعذر تسجيل الإلغاء المتأخر.',
                                  'warning'
                                );
                              }
                            }}
                            className="py-2 border border-amber-200 hover:border-amber-500 hover:bg-amber-50 bg-white rounded-lg text-xs font-bold text-amber-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <AlertTriangle size={13} />
                            <span>{isRtl ? 'إلغاء متأخر' : 'Late Cancel'}</span>
                          </button>
                        </div>
                      </div>

                      {/* GROUP GUESTS SESSION SUMMARY */}
                      {activeAppointment.isGroupBooking && activeAppointment.guestsDetails && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-fadeIn">
                          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                              <Users size={14} />
                            </span>
                            <span className="text-xs font-black text-slate-800">
                              {isRtl ? `قائمة مرافقي الجلسة الجماعية (${activeAppointment.guestCount || activeAppointment.guestsDetails.length} أشخاص)` : `GROUP GUEST DETAILS (${activeAppointment.guestCount || activeAppointment.guestsDetails.length} Pax)`}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {activeAppointment.guestsDetails.map((guest: any, idx: number) => {
                              const srv = liveServices.find(s => s.id === guest.serviceId);
                              return (
                                <div key={guest.id || idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200/50 space-y-2 text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      {guest.name}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                      guest.isFree ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {guest.isFree ? (isRtl ? 'خدمة مجانية 🎁' : 'Complimentary 🎁') : `${srv?.price || 0} SAR`}
                                    </span>
                                  </div>
                                  
                                  <div className="text-slate-600 text-[11px] space-y-1">
                                    <p className="font-medium">
                                      <span className="text-slate-400">{isRtl ? 'الخدمة المطلوبة: ' : 'Treatment: '}</span>
                                      {isRtl ? srv?.nameAr : srv?.nameEn}
                                    </p>
                                    {guest.phone && (
                                      <p className="font-mono">
                                        <span className="text-slate-400">{isRtl ? 'الجوال: ' : 'Phone: '}</span>
                                        {guest.phone}
                                      </p>
                                    )}
                                    {guest.notes && (
                                      <div className="bg-amber-50/40 p-2 rounded border border-amber-200/30 text-[10px] text-amber-900 leading-normal">
                                        <span className="font-bold">{isRtl ? 'ملاحظة الضيف: ' : 'Guest Note: '}</span>
                                        {guest.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* INTERACTIVE REASSIGN & RESCHEDULE WORKSPACE CONTROLS */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                            <CalendarIcon size={14} />
                          </span>
                          <span className="text-xs font-black text-slate-800">{isRtl ? 'إعادة التعيين والجدولة الفورية' : 'REASSIGN & RESCHEDULE WORKSPACE'}</span>
                        </div>

                        {/* Dropdown for Reassignment */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block uppercase">{isRtl ? 'إعادة تعيين خبيرة التجميل' : 'Reassign Stylist'}</label>
                          <select
                            value={activeAppointment.staffId}
                            disabled={appointmentDetailsReadOnly}
                            onChange={async (e) => {
                              if (appointmentDetailsReadOnly) {
                                addLocalToast(
                                  isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                  isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                  'info'
                                );
                                return;
                              }
                              const newStaffId = e.target.value;
                              try {
                                const response = await tenantApiAdapter.reassignAppointmentStaff(activeAppointment.id, newStaffId);
                                if (response?.success) {
                                  await loadBoardData();
                                  setActiveAppointment(prev => prev ? { ...prev, staffId: newStaffId } : null);
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    'تمت إعادة تعيين أخصائية التجميل بنجاح!',
                                    'Stylist successfully reassigned for this session!',
                                    'success'
                                  );
                                } else {
                                  throw new Error(response?.message || 'Failed to reassign stylist');
                                }
                              } catch (err) {
                                console.error('Failed to reassign stylist', err);
                                const toast = getSchedulingErrorToast(err, isRtl ? 'تعذر إعادة تعيين الموظفة.' : 'Unable to reassign stylist.', isRtl ? 'Unable to reassign stylist.' : 'تعذر إعادة تعيين الموظفة.');
                                addLocalToast(
                                  toast.ar,
                                  toast.en,
                                  'warning'
                                );
                              }
                            }}
                            className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-amber-500 outline-none ${appointmentDetailsReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                            {liveStylists.map(s => (
                              <option key={s.id} value={s.id}>✨ {isRtl ? s.nameAr : s.nameEn}</option>
                            ))}
                          </select>
                        </div>

                        {/* Reschedule Time Selection */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block uppercase">{isRtl ? 'تعديل التوقيت' : 'Reschedule Time'}</label>
                          <select
                            value={activeAppointment.startTime}
                            disabled={appointmentDetailsReadOnly}
                            onChange={async (e) => {
                              if (appointmentDetailsReadOnly) {
                                addLocalToast(
                                  isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                  isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                  'info'
                                );
                                return;
                              }
                              const newTime = parseInt(e.target.value);
                              try {
                                const response = await tenantApiAdapter.reassignRescheduleAppointment(activeAppointment.id, {
                                  staffId: activeAppointment.staffId,
                                  startTime: buildIsoFromMinutes(activeAppointment.date || getSelectedDateKey(), newTime),
                                  notifyCustomer: true
                                });
                                if (response?.success) {
                                  await loadBoardData();
                                  setActiveAppointment(prev => prev ? { ...prev, startTime: newTime } : null);
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    'تم تغيير موعد البدء بنجاح!',
                                    'Appointment start time successfully updated!',
                                    'success'
                                  );
                                } else {
                                  throw new Error(response?.message || 'Failed to reschedule appointment');
                                }
                              } catch (err) {
                                console.error('Failed to reschedule appointment', err);
                                const toast = getSchedulingErrorToast(err, isRtl ? 'تعذر تعديل التوقيت.' : 'Unable to reschedule appointment.', isRtl ? 'Unable to reschedule appointment.' : 'تعذر تعديل التوقيت.');
                                addLocalToast(
                                  toast.ar,
                                  toast.en,
                                  'warning'
                                );
                              }
                            }}
                            className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold text-slate-700 focus:ring-1 focus:ring-amber-500 outline-none ${appointmentDetailsReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          >
                              {Array.from({ length: TOTAL_HOURS * 4 }).map((_, idx) => {
                                const totalMins = idx * 15;
                                return (
                                  <option key={idx} value={totalMins}>
                                    {formatMinutesToTime(totalMins)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block uppercase">{isRtl ? 'تاريخ الجلسة' : 'Booking Date'}</label>
                          <input
                              type="date"
                              value={activeAppointment.date || '2026-06-28'}
                              disabled={appointmentDetailsReadOnly}
                              onChange={async (e) => {
                                if (appointmentDetailsReadOnly) {
                                  addLocalToast(
                                    isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                    isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                    'info'
                                  );
                                  return;
                                }
                                const newDateStr = e.target.value;
                                try {
                                  const response = await tenantApiAdapter.reassignRescheduleAppointment(activeAppointment.id, {
                                    staffId: activeAppointment.staffId,
                                    startTime: buildIsoFromMinutes(newDateStr, activeAppointment.startTime),
                                    notifyCustomer: true
                                  });
                                if (response?.success) {
                                  await loadBoardData();
                                  setActiveAppointment(prev => prev ? { ...prev, date: newDateStr } : null);
                                  setCustomerProfileRefreshToken(token => token + 1);
                                  addLocalToast(
                                    'تم تحديث تاريخ الحجز بنجاح!',
                                    'Booking session date successfully updated!',
                                    'success'
                                    );
                                  } else {
                                    throw new Error(response?.message || 'Failed to update booking date');
                                  }
                                } catch (err) {
                                  console.error('Failed to update booking date', err);
                                  const toast = getSchedulingErrorToast(err, isRtl ? 'تعذر تحديث تاريخ الحجز.' : 'Unable to update booking date.', isRtl ? 'Unable to update booking date.' : 'تعذر تحديث تاريخ الحجز.');
                                  addLocalToast(
                                    toast.ar,
                                    toast.en,
                                    'warning'
                                  );
                                }
                              }}
                              className={`w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-amber-500 outline-none ${appointmentDetailsReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            />
                          </div>
                        </div>

                        {/* Combined Action Reassign + Reschedule */}
                        <button
                          onClick={() => {
                            if (appointmentDetailsReadOnly) {
                              addLocalToast(
                                isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
                                isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
                                'info'
                              );
                              return;
                            }
                            addLocalToast(
                              'تم حفظ الموعد بالتعديل الجديد، وجاري إرسال إشعار فوري للزبونة! 💬',
                              'Session schedule updated. Dynamic operations push alert successfully dispatched! 💬',
                              'success'
                            );
                          }}
                          className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles size={13} className="text-amber-400" />
                          <span>{isRtl ? 'حفظ وإرسال إشعار فوري 💬' : 'Commit Roster & Send Notification 💬'}</span>
                        </button>
                      </div>

                      {/* CLIENT WALLET INTERACTIVE COMPONENT */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
                              <Wallet size={14} />
                            </span>
                            <span className="text-xs font-bold text-slate-800">{t.walletText}</span>
                          </div>
                          <span className="text-xs font-black text-emerald-600 font-mono">
                            {activeAppointment.walletBalance || 0} {t.riyal}
                          </span>
                        </div>

                        {/* Simulate Wallet Top-up */}
                        <div className="space-y-2">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">{isRtl ? 'شحن رصيد إضافي للمحفظة' : 'CREDIT / TOP-UP SIMULATOR'}</p>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              value={simulatedWalletTopUp}
                              disabled={appointmentDetailsReadOnly}
                              onChange={(e) => setSimulatedWalletTopUp(e.target.value)}
                              placeholder={isRtl ? 'المبلغ ر.س...' : 'Amount SAR...'}
                              className={`flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-amber-500 ${appointmentDetailsReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                            />
                            <button
                              onClick={handleAddWalletBalance}
                              disabled={appointmentDetailsReadOnly}
                              className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 ${appointmentDetailsReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                              {isRtl ? 'شحن فوري' : 'Top Up'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* CLIENT ACTIVE TRANSACTION HISTORY */}
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{isRtl ? 'سجل العمليات المالية الأخيرة' : 'RECENT TRANSACTIONS'}</h4>
                          <button
                            type="button"
                            onClick={() => setCustomerTransactionsExpanded(prev => !prev)}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                          >
                            {isRtl ? 'عرض الكل' : 'View All'}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {customerRecentTransactions.length === 0 ? (
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500">
                              {isRtl ? 'لا توجد عمليات مالية حديثة مسجلة.' : 'No recent financial activity found.'}
                            </div>
                          ) : customerRecentTransactions.slice(0, customerTransactionsExpanded ? customerRecentTransactions.length : 3).map((item: any, idx: number) => {
                            const amount = Number(item.amount ?? item.totalAmount ?? item.value ?? item.price ?? 0);
                            const label = item.invoiceNumber || item.orderNumber || item.type || item.method || item.paymentMethod || `TX-${idx + 1}`;
                            const dateLabel = item.date || item.createdAt || item.time || '';
                            return (
                              <div key={`${label}-${idx}`} className="flex justify-between gap-2 text-xs p-2 bg-slate-50 rounded-lg">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 truncate">{label}</p>
                                  <p className="text-[9px] text-slate-400 truncate">
                                    {dateLabel ? new Date(dateLabel).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                  </p>
                                </div>
                                <span className={`font-mono font-bold ${amount >= 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                  {amount >= 0 ? '+' : '-'}{Math.abs(amount).toFixed(2)} {t.riyal}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* TAB 2: CLIENT TOUCHPOINT LOG */}
                  {drawerTab === 'timeline' && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.timelineText}</h4>
                      {customerProfileLoading ? (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                          {isRtl ? 'جاري تحميل الخط الزمني من بيانات العميل الفعلية...' : 'Loading live timeline from customer data...'}
                        </div>
                      ) : customerTimelineEntries.length === 0 ? (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                          {isRtl ? 'لا توجد أحداث زمنية متاحة لهذا العميل حالياً.' : 'No live timeline events are available for this customer yet.'}
                        </div>
                      ) : (
                        <div className="relative border-l border-slate-200 pl-4 space-y-5 py-2 text-xs">
                          {customerTimelineEntries.map((entry: any) => (
                            <div key={entry.id} className="relative">
                              <span className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                entry.kind === 'appointment' ? 'bg-blue-400' :
                                entry.kind === 'order' ? 'bg-emerald-400' :
                                entry.kind === 'wallet' ? 'bg-amber-400' :
                                entry.kind === 'gift' ? 'bg-pink-400' :
                                'bg-slate-300'
                              }`} />
                              <div>
                                <p className="font-bold text-slate-800">{isRtl ? entry.titleAr : entry.titleEn}</p>
                                <p className="text-slate-500 text-[10px] mt-0.5">{isRtl ? entry.subtitleAr : entry.subtitleEn}</p>
                                {entry.date && (
                                  <p className="text-slate-400 mt-1 leading-relaxed text-[10px]">
                                    {new Date(entry.date).toLocaleString(isRtl ? 'ar-SA' : 'en-US', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short'
                                    })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: REVIEWS LOG */}
                      {drawerTab === 'reviews' && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t.reviewsText}</h4>
                      
                      <div className="space-y-3.5">
                        {(() => {
                          const reviews = customerLiveReviews;

                          if (customerProfileLoading) {
                            return (
                              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                {isRtl ? 'جاري تحميل التقييمات من ملف العميل...' : 'Loading customer reviews from the live profile...'}
                              </div>
                            );
                          }

                          if (reviews.length === 0) {
                            return (
                              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                {isRtl ? 'لا توجد تقييمات مسجلة لهذا العميل حالياً.' : 'No customer reviews are linked to this appointment yet.'}
                              </div>
                            );
                          }

                          return reviews.map((review: any, idx: number) => (
                            <div key={review.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800">{review.serviceName || review.title || review.service?.name_en || (isRtl ? 'خدمة مرتبطة' : 'Linked Service')}</span>
                                <div className="flex text-amber-500 gap-0.5">
                                  {Array.from({ length: Math.max(1, Math.min(5, review.rating || 0)) }).map((_, starIdx) => (
                                    <Star key={starIdx} size={11} fill="currentColor" />
                                  ))}
                                </div>
                              </div>
                              <p className="text-slate-600 leading-relaxed italic">
                                {review.comment || review.text || (isRtl ? 'لا يوجد تعليق مسجل.' : 'No comment recorded.')}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {review.createdAt || review.reviewedAt || ''}
                              </p>
                            </div>
                          ));
                        })()}

                      </div>
                    </div>
                  )}

                </div>

                {/* COLUMN 3: FINANCIALS & PAYMENT WORKSPACE (col-span-4) */}
                <div className="xl:col-span-4 space-y-5">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-amber-500" />
                      {t.financeSummary}
                    </h3>

                    <div className="space-y-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isRtl ? 'بنود الفاتورة المباشرة' : 'LIVE INVOICE LINE ITEMS'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500">
                          {isRtl ? 'خدمة + منتجات' : 'Service + Products'}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {activeInvoiceLineItems.map((item) => (
                          <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px] space-y-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 truncate">
                                  {isRtl ? item.nameAr : item.nameEn}
                                </p>
                                <p className="text-slate-400">
                                  {isRtl ? 'الموظفة:' : 'Stylist:'} {isRtl ? item.stylistAr || '—' : item.stylistEn || '—'}
                                </p>
                              </div>
                              <span className="font-black text-slate-800 font-mono">
                                {item.subtotal.toFixed(2)} {t.riyal}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-slate-500">
                              <div>
                                <p className="uppercase text-[9px] font-bold">{isRtl ? 'الكمية' : 'Qty'}</p>
                                <p className="font-mono font-bold text-slate-700">{item.quantity}</p>
                              </div>
                              <div>
                                <p className="uppercase text-[9px] font-bold">{isRtl ? 'سعر الوحدة' : 'Unit'}</p>
                                <p className="font-mono font-bold text-slate-700">{item.unitPrice.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="uppercase text-[9px] font-bold">{isRtl ? 'الإجمالي' : 'Subtotal'}</p>
                                <p className="font-mono font-bold text-slate-700">{item.subtotal.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="uppercase text-[9px] font-bold">{isRtl ? 'نوع' : 'Type'}</p>
                                <p className="font-mono font-bold text-slate-700">{item.type}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {activeInvoiceLineItems.length === 0 && (
                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                            {isRtl ? 'لم يتم تحميل بنود الفاتورة بعد.' : 'Invoice line items are not loaded yet.'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Products to Ticket Section */}
                    {activeAppointment.paymentStatus !== 'paid' && (
                      <div className="border-b border-slate-100 pb-3 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isRtl ? 'إضافة منتجات التجميل للفاتورة 🧴' : 'ADD RETAIL PRODUCTS TO TICKET 🧴'}
                        </span>
                        
                        {/* Inline list of available products to add */}
                        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                          {liveProducts.map(prod => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => {
                                setCheckoutProducts(prev => {
                                  const exists = prev.find(p => p.id === prod.id);
                                  if (exists) {
                                    return prev.map(p => p.id === prod.id ? { ...p, quantity: p.quantity + 1 } : p);
                                  } else {
                                    return [...prev, { id: prod.id, nameAr: prod.nameAr, nameEn: prod.nameEn, price: prod.price, quantity: 1, sku: prod.sku }];
                                  }
                                });
                                addLocalToast(
                                  `تمت إضافة "${isRtl ? prod.nameAr : prod.nameEn}" لفاتورة الموعد.`,
                                  `Added "${isRtl ? prod.nameAr : prod.nameEn}" to appointment bill.`,
                                  'success'
                                );
                              }}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-amber-500/10 hover:border-amber-400 border border-slate-200 rounded-lg text-[10px] font-bold shrink-0 text-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>+</span>
                              <span>{isRtl ? prod.nameAr.split(' ')[0] + ' ' + (prod.nameAr.split(' ')[1] || '') : prod.nameEn.split(' ')[0] + ' ' + (prod.nameEn.split(' ')[1] || '')}</span>
                              <span className="text-amber-600 font-mono font-black">{prod.price} {t.riyal}</span>
                            </button>
                          ))}
                        </div>

                        {/* List of currently added products */}
                        {checkoutProducts.length > 0 && (
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60 space-y-1 text-[11px]">
                            {checkoutProducts.map(prod => (
                              <div key={prod.id} className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-slate-150">
                                <div className="min-w-0 flex-1 pr-1">
                                  <p className="font-bold text-slate-800 truncate">{isRtl ? prod.nameAr : prod.nameEn}</p>
                                  <p className="text-[9px] text-slate-400 font-mono">{prod.price} SAR</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCheckoutProducts(prev => {
                                        const found = prev.find(p => p.id === prod.id);
                                        if (found && found.quantity === 1) {
                                          return prev.filter(p => p.id !== prod.id);
                                        }
                                        return prev.map(p => p.id === prod.id ? { ...p, quantity: p.quantity - 1 } : p);
                                      });
                                    }}
                                    className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-black text-slate-600"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono font-bold text-slate-700">{prod.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCheckoutProducts(prev => prev.map(p => p.id === prod.id ? { ...p, quantity: p.quantity + 1 } : p));
                                    }}
                                    className="px-1 bg-slate-100 hover:bg-slate-200 rounded font-black text-slate-600"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCheckoutProducts(prev => prev.filter(p => p.id !== prod.id));
                                    }}
                                    className="text-slate-300 hover:text-rose-600 ml-1"
                                  >
                                    <Trash size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Apply Gift Card Section */}
                    {activeAppointment.paymentStatus !== 'paid' && (
                      <div className="border-b border-slate-100 pb-3 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isRtl ? 'تطبيق كوبون / بطاقة هدايا 🎁' : 'APPLY VOUCHER / GIFT CARD 🎁'}
                        </span>
                        
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={appliedGiftCardCode}
                            onChange={(e) => setAppliedGiftCardCode(e.target.value)}
                            placeholder={isRtl ? 'مثال: REF-GFT-9844' : 'e.g. REF-GFT-9844'}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold outline-none uppercase"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!appliedGiftCardCode.trim()) {
                                addLocalToast('يرجى إدخال رمز بطاقة الهدايا أولاً', 'Please enter a gift card code first', 'warning');
                                return;
                              }
                              const cleanedCode = appliedGiftCardCode.trim().toUpperCase();
                              if (cleanedCode.includes('GFT') || cleanedCode.length >= 6) {
                                setAppliedGiftCardAmount(200); // 200 SAR discount
                                addLocalToast(
                                  `تم تطبيق بطاقة الهدايا بنجاح! الرصيد المتاح: ٢٠٠ ر.س.`,
                                  `Gift card applied successfully! Available balance: 200 SAR.`,
                                  'success'
                                );
                              } else {
                                addLocalToast(
                                  `الرمز غير مطابق أو منتهي الصلاحية!`,
                                  `Invalid or expired gift card voucher!`,
                                  'warning'
                                );
                              }
                            }}
                            className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                          >
                            {isRtl ? 'تطبيق' : 'Apply'}
                          </button>
                        </div>

                        {appliedGiftCardAmount > 0 && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500 rounded-lg flex justify-between items-center text-[10px] text-emerald-800">
                            <span className="font-bold">{isRtl ? 'خصم بطاقة الهدايا نشط ✓' : 'Gift card discount active ✓'}</span>
                            <span className="font-mono font-black">-{appliedGiftCardAmount} {t.riyal}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pricing breakdown */}
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>{isRtl ? 'رسوم الخدمة الأساسية' : 'Service Subtotal'}</span>
                        <span className="font-mono font-bold">{activeServiceSummary.price.toFixed(2)} {t.riyal}</span>
                      </div>

                      <div className="flex justify-between text-slate-500">
                        <span>{isRtl ? 'إجمالي منتجات التجزئة' : 'Retail Products Total'}</span>
                        <span className="font-mono font-bold">{checkoutProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0).toFixed(2)} {t.riyal}</span>
                      </div>

                      {appliedGiftCardAmount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>{isRtl ? 'خصم بطاقة الهدايا' : 'Gift Card Discount'}</span>
                          <span className="font-mono font-black">-{appliedGiftCardAmount.toFixed(2)} {t.riyal}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-500 border-t pt-1.5 border-dashed">
                        <span>{isRtl ? 'الوعاء الخاضع للضريبة' : 'Taxable Subtotal'}</span>
                        <span className="font-mono font-bold">{activeInvoiceTaxable.toFixed(2)} {t.riyal}</span>
                      </div>

                      <div className="flex justify-between text-slate-500">
                        <span>{isRtl ? 'ضريبة القيمة المضافة ١٥٪' : 'ZATCA VAT (15%)'}</span>
                        <span className="font-mono font-bold">{activeInvoiceVat.toFixed(2)} {t.riyal}</span>
                      </div>

                      <div className="h-px bg-slate-100 border-dashed border-b pt-1" />

                      <div className="flex justify-between text-sm font-black text-slate-900 pt-1">
                        <span>{isRtl ? 'المبلغ الكلي المستحق' : 'Total Amount Due'}</span>
                        <span className="font-mono text-amber-600 font-black">{activeInvoiceTotal.toFixed(2)} {t.riyal}</span>
                      </div>

                      <div className="flex justify-between text-slate-500">
                        <span>{isRtl ? 'الرصيد المتبقي' : 'Remaining Balance'}</span>
                        <span className="font-mono font-bold">{activeInvoiceRemaining.toFixed(2)} {t.riyal}</span>
                      </div>

                      {splitAmounts.wallet > 0 && (
                        <div className="flex justify-between text-amber-700 font-semibold">
                          <span>{isRtl ? 'خصم/سداد المحفظة' : 'Wallet Deduction'}</span>
                          <span className="font-mono font-black">-{Number(splitAmounts.wallet).toFixed(2)} {t.riyal}</span>
                        </div>
                      )}
                    </div>

                    {/* SPLIT PAYMENTS COMPONENT CONTAINER */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.splitPayments}</span>
                        <button 
                          onClick={() => setIsSplitActive(!isSplitActive)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                            isSplitActive ? 'bg-amber-500 text-zinc-950' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Split size={10} />
                          <span>{isSplitActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'تفعيل' : 'Activate')}</span>
                        </button>
                      </div>

                      {isSplitActive ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'مدى / فيزا' : 'Card'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.card}
                              onChange={(e) => setSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'نقد كاش' : 'Cash'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.cash}
                              onChange={(e) => setSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 w-16">{isRtl ? 'المحفظة' : 'Wallet'}</span>
                            <input 
                              type="number" 
                              value={splitAmounts.wallet}
                              onChange={(e) => setSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))}
                              className="flex-1 bg-slate-50 border border-slate-200 rounded p-1 text-right font-mono text-xs font-bold"
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {isRtl ? 'تسمح هذه الأداة بتقسيم الفاتورة الكلية على أكثر من طريقة دفع (مثل مدى + كاش).' : 'Allows split distribution among multi-payment gateways (Mada, Cash, Credit, Wallet).'}
                        </p>
                      )}
                    </div>

                    {/* Checkout and Complete operation */}
                    <div className="pt-3">
                      {activeAppointment.paymentStatus === 'paid' ? (
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3 rounded-lg flex items-center gap-2 text-xs font-bold">
                          <Check size={16} />
                          <span>{isRtl ? 'تم سداد الفاتورة بنجاح عبر بوابة مدى الرقمية' : 'Paid successfully via Integrated Mada terminal'}</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleCheckoutPayment}
                          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 size={15} className="text-amber-400" />
                          <span>{t.checkout}</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              <AnimatePresence>
                {isCustomerProfileOpen && activeAppointment && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20"
                  >
                    <div
                      className="absolute inset-0 bg-zinc-950/10"
                      onClick={() => {
                        setIsCustomerProfileOpen(false);
                        setCustomerTransactionsExpanded(false);
                      }}
                    />

                    <motion.div
                      initial={{ x: isRtl ? -32 : 32, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: isRtl ? -32 : 32, opacity: 0 }}
                      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                      className={`absolute top-0 bottom-0 ${isRtl ? 'left-0' : 'right-0'} w-full md:w-[min(88vw,1120px)] bg-white shadow-2xl overflow-y-auto`}
                      style={isRtl ? { borderRight: '1px solid rgb(226 232 240)' } : { borderLeft: '1px solid rgb(226 232 240)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomerProfileOpen(false);
                              setCustomerTransactionsExpanded(false);
                            }}
                            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all shrink-0 cursor-pointer"
                            title={isRtl ? 'العودة لتفاصيل الحجز' : 'Back to appointment details'}
                          >
                            <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                          </button>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">
                              {isRtl ? 'ملف العميل السياقي' : 'CONTEXTUAL CUSTOMER PROFILE'}
                            </p>
                            <h3 className="text-sm font-bold text-slate-800 truncate">
                              {activeCustomerName}
                            </h3>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          {isRtl ? 'يرتبط بالموعد الحالي' : 'Scoped to current appointment'}
                        </span>
                      </header>

                      <div className="p-4 space-y-4">
                        {customerProfileError && (
                          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs">
                            {customerProfileError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                          <div className="xl:col-span-5 space-y-4 xl:sticky xl:top-[76px]">
                            <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center font-black text-amber-700 text-base shrink-0">
                                    {(activeCustomerName || 'GU').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate">{activeCustomerName}</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                                        {activeCustomerTier || '—'}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                                        {activeCustomerMembership || (isRtl ? 'جاهزة مستقبلياً' : 'Future-ready')}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                  {isRtl ? 'العميل الحالي' : 'Current customer'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-2 text-xs text-slate-700">
                                <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Phone size={12} className="text-slate-400 shrink-0" />
                                    <span className="font-bold">{isRtl ? 'Phone' : 'Phone'}</span>
                                  </div>
                                  <span className="font-mono font-bold truncate text-slate-600">{activeCustomerPhone || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Mail size={12} className="text-slate-400 shrink-0" />
                                    <span className="font-bold">{isRtl ? 'Email' : 'Email'}</span>
                                  </div>
                                  <span className="font-mono font-bold truncate text-slate-600">{activeCustomerEmail || '—'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  {
                                    label: isRtl ? 'اتصال' : 'Call',
                                    action: () => {
                                      if (activeCustomerPhone) window.location.href = `tel:${activeCustomerPhone}`;
                                    },
                                    disabled: !activeCustomerPhone,
                                    tone: 'bg-zinc-900 text-white'
                                  },
                                  {
                                    label: isRtl ? 'واتساب' : 'WhatsApp',
                                    action: () => {
                                      if (!activeCustomerPhone) return;
                                      const phoneDigits = `${activeCustomerPhone}`.replace(/[^\d]/g, '');
                                      if (!phoneDigits) return;
                                      window.open(`https://wa.me/${phoneDigits}`, '_blank', 'noopener,noreferrer');
                                    },
                                    disabled: !activeCustomerPhone,
                                    tone: 'bg-slate-100 text-slate-700'
                                  },
                                  {
                                    label: isRtl ? 'نسخ' : 'Copy',
                                    action: async () => {
                                      const payload = [
                                        activeCustomerName,
                                        activeCustomerPhone,
                                        activeCustomerEmail,
                                        activeAppointment?.id ? `Appointment: ${activeAppointment.id}` : ''
                                      ].filter(Boolean).join(' | ');
                                      if (navigator.clipboard?.writeText && payload) {
                                        await navigator.clipboard.writeText(payload);
                                      }
                                    },
                                    disabled: false,
                                    tone: 'bg-slate-100 text-slate-700'
                                  },
                                  {
                                    label: isRtl ? 'ملاحظات' : 'Notes',
                                    action: () => setCustomerDrawerTab('notes'),
                                    disabled: false,
                                    tone: 'bg-slate-100 text-slate-700'
                                  }
                                ].map((item) => (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={item.action}
                                    disabled={item.disabled}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${item.tone}`}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </section>

                            <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {isRtl ? 'مخزون المحفظة' : 'Wallet Summary'}
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'الرصيد' : 'Wallet'}</p>
                                  <p className="text-base font-black text-slate-800 mt-1 font-mono">{activeCustomerWallet.toFixed(2)} {t.riyal}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'إجمالي الإنفاق' : 'Total Spent'}</p>
                                  <p className="text-base font-black text-slate-800 mt-1 font-mono">{Number(customerProfile?.totalSpent || 0).toFixed(2)} {t.riyal}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'المواعيد' : 'Appointments'}</p>
                                  <p className="text-base font-black text-slate-800 mt-1 font-mono">{customerAppointmentHistory.length}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'المعاملات' : 'Transactions'}</p>
                                  <p className="text-base font-black text-slate-800 mt-1 font-mono">{customerRecentTransactions.length}</p>
                                </div>
                              </div>
                            </section>

                            <section id="customer-notes-section" className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                  {isRtl ? 'الملاحظات الداخلية' : 'Internal Notes'}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => setCustomerDrawerTab('notes')}
                                  className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-700"
                                >
                                  {isRtl ? 'فتح القسم' : 'Open section'}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {customerInternalNotes.map((note) => (
                                  <div key={note.label} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{note.label}</p>
                                    <p className="leading-relaxed">{note.value || '—'}</p>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>

                          <div className="xl:col-span-7 space-y-4">
                            <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                      {isRtl ? 'سجل التفاعل والنشاط' : 'Customer Interaction Workspace'}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      {isRtl ? 'عرض سياقي مرتبط بالموعد الحالي فقط.' : 'Contextually scoped to the currently opened appointment.'}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                    {isRtl ? 'وضع المشغل' : 'Operator mode'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
                                  {[
                                    { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
                                    { id: 'wallet', labelEn: 'Wallet', labelAr: 'المحفظة' },
                                    { id: 'appointments', labelEn: 'Appointments', labelAr: 'الحجوزات' },
                                    { id: 'transactions', labelEn: 'Transactions', labelAr: 'الفواتير' },
                                    { id: 'reviews', labelEn: 'Reviews', labelAr: 'التقييمات' },
                                    { id: 'notes', labelEn: 'Notes', labelAr: 'الملاحظات' }
                                  ].map(tab => (
                                    <button
                                      key={tab.id}
                                      type="button"
                                      onClick={() => setCustomerDrawerTab(tab.id as any)}
                                      className={`text-[11px] px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        customerDrawerTab === tab.id
                                          ? 'bg-zinc-900 text-amber-400 text-white shadow-xs'
                                          : 'text-slate-500 hover:text-zinc-900'
                                      }`}
                                    >
                                      {isRtl ? tab.labelAr : tab.labelEn}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <AnimatePresence mode="wait">
                                {customerDrawerTab === 'overview' && (
                                  <motion.div key="customer-overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {isRtl ? 'ملخص العميل' : 'Customer Summary'}
                                      </h4>
                                      <p className="text-[10px] text-slate-400">
                                        {isRtl ? 'ملخص CRM طويل المدى فقط بدون تكرار بيانات الموعد الحالي.' : 'Long-term CRM summary only, without repeating the current appointment.'}
                                      </p>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        {[
                                          { label: isRtl ? 'المحفظة' : 'Wallet', value: `${activeCustomerWallet.toFixed(2)} ${t.riyal}` },
                                          { label: isRtl ? 'إجمالي الإنفاق' : 'Total Spent', value: `${Number(customerProfile?.totalSpent ?? customerSummaryData.totalSpent ?? 0).toFixed(2)} ${t.riyal}` },
                                          { label: isRtl ? 'إجمالي المواعيد' : 'Total Appointments', value: `${Number(customerSummaryData.totalAppointments ?? customerAppointmentHistory.length ?? 0)}` },
                                          { label: isRtl ? 'المكتملة' : 'Completed', value: `${customerCompletedAppointments}` },
                                          { label: isRtl ? 'الملغاة' : 'Cancelled', value: `${customerCancelledAppointments}` },
                                          { label: isRtl ? 'عدم الحضور' : 'No Shows', value: `${customerNoShowAppointments}` },
                                          { label: isRtl ? 'أول زيارة' : 'First Visit', value: customerFirstVisit ? new Date(customerFirstVisit.startTime || customerFirstVisit.date || customerFirstVisit.createdAt || 0).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }) : '—' },
                                          { label: isRtl ? 'آخر زيارة' : 'Last Visit', value: customerLastVisit ? new Date(customerLastVisit.startTime || customerLastVisit.date || customerLastVisit.createdAt || 0).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }) : '—' },
                                          { label: isRtl ? 'المصفف المفضل' : 'Preferred Stylist', value: customerPreferredStylist || '—' },
                                          { label: isRtl ? 'الخدمة المفضلة' : 'Preferred Service', value: customerPreferredService || '—' },
                                          { label: isRtl ? 'متوسط الإنفاق' : 'Average Spend', value: `${customerAverageSpend.toFixed(2)} ${t.riyal}` }
                                        ].map((item) => (
                                          <div key={item.label} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{item.label}</p>
                                            <p className="text-slate-800 font-bold mt-1 truncate">{item.value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </section>
                                  </motion.div>
                                )}

                                {customerDrawerTab === 'wallet' && (
                                  <motion.div key="customer-wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {isRtl ? 'محفظة العميل' : 'Customer Wallet'}
                                      </h4>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'الرصيد' : 'Balance'}</p>
                                          <p className="text-base font-black text-slate-800 mt-1 font-mono">{activeCustomerWallet.toFixed(2)} {t.riyal}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'العمليات' : 'Transactions'}</p>
                                          <p className="text-base font-black text-slate-800 mt-1 font-mono">{customerRecentTransactions.length}</p>
                                        </div>
                                      </div>
                                    </section>
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                          {isRtl ? 'سجل المحفظة' : 'Wallet Ledger'}
                                        </h4>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                                          {isRtl ? 'يعرض بيانات مباشرة' : 'Live data'}
                                        </span>
                                      </div>
                                      <div className="space-y-2">
                                        {customerRecentTransactions.length === 0 ? (
                                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'لا توجد معاملات محفظة متاحة.' : 'No wallet ledger entries are available yet.'}
                                          </div>
                                        ) : (
                                          customerRecentTransactions.map((item: any, idx: number) => {
                                            const amount = Number(item.amount ?? item.totalAmount ?? item.value ?? item.price ?? 0);
                                            const label = item.invoiceNumber || item.orderNumber || item.type || item.method || item.paymentMethod || `TX-${idx + 1}`;
                                            const dateLabel = item.date || item.createdAt || item.time || '';
                                            const category = `${item.type || item.kind || item.status || item.paymentStatus || item.method || 'transaction'}`.toLowerCase();
                                            return (
                                              <div key={`${label}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-[10px]">
                                                <div className="min-w-0">
                                                  <p className="font-bold text-slate-800 truncate">{label}</p>
                                                  <p className="text-slate-400 truncate">
                                                    {dateLabel ? new Date(dateLabel).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                                  </p>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 uppercase">
                                                    {category}
                                                  </span>
                                                  <span className="font-mono font-black text-slate-700 whitespace-nowrap">
                                                    {amount ? `${amount.toFixed(2)} ${t.riyal}` : '—'}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </section>
                                  </motion.div>
                                )}

                                {customerDrawerTab === 'appointments' && (
                                  <motion.div key="customer-appointments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                            {isRtl ? 'سجل الحجوزات' : 'Appointment History'}
                                          </h4>
                                          <p className="text-[10px] text-slate-400 mt-1">
                                            {isRtl ? 'أحدث الحجوزات أولاً مع تفاصيل الفوترة والموظف.' : 'Newest appointments first with service, staff, and payment details.'}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {[
                                            { id: 'all', labelEn: 'All', labelAr: 'الكل' },
                                            { id: 'upcoming', labelEn: 'Upcoming', labelAr: 'القادمة' },
                                            { id: 'completed', labelEn: 'Completed', labelAr: 'مكتملة' },
                                            { id: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغاة' },
                                            { id: 'no_show', labelEn: 'No Show', labelAr: 'عدم الحضور' }
                                          ].map((filter) => (
                                            <button
                                              key={filter.id}
                                              type="button"
                                              onClick={() => setCustomerAppointmentHistoryFilter(filter.id as any)}
                                              className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all ${
                                                customerAppointmentHistoryFilter === filter.id
                                                  ? 'bg-zinc-900 text-white border-zinc-900'
                                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                              }`}
                                            >
                                              {isRtl ? filter.labelAr : filter.labelEn}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        {customerAppointmentHistoryCards.length === 0 ? (
                                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'لا توجد حجوزات تطابق هذا الفلتر.' : 'No appointments match the selected filter.'}
                                          </div>
                                        ) : (
                                          customerAppointmentHistoryCards.map((item: any) => {
                                            const serviceName = item?.details?.service?.name_en
                                              || item?.details?.service?.nameEn
                                              || item?.details?.service?.name
                                              || item?.serviceName
                                              || item?.title
                                              || (isRtl ? 'خدمة' : 'Service');
                                            const employeeName = item?.details?.staff?.name
                                              || item?.assignedStaffName
                                              || item?.staffName
                                              || '—';
                                            const dateValue = item?.details?.startTime || item?.date || item?.createdAt || '';
                                            const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                                            const timeLabel = dateValue ? new Date(dateValue).toLocaleTimeString(isRtl ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
                                            const durationLabel = `${Number(item?.details?.duration ?? item?.duration ?? 0) || 0} ${isRtl ? 'دقيقة' : 'Minutes'}`;
                                            const paymentStatusLabel = `${item?.normalizedPaymentStatus || item?.paymentStatus || '—'}`;
                                            const statusTone = (() => {
                                              const status = `${item?.status || ''}`.toLowerCase();
                                              if (['completed', 'done', 'served'].includes(status)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                              if (['cancelled', 'canceled'].includes(status)) return 'bg-rose-50 text-rose-700 border-rose-200';
                                              if (['no-show', 'noshow', 'no_show'].includes(status)) return 'bg-amber-50 text-amber-700 border-amber-200';
                                              return 'bg-slate-50 text-slate-700 border-slate-200';
                                            })();
                                            const paymentTone = (() => {
                                              const paymentStatus = `${item?.normalizedPaymentStatus || item?.paymentStatus || ''}`.toLowerCase();
                                              if (['paid', 'completed', 'fully_paid', 'deposit_paid'].includes(paymentStatus)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                                              if (['pending', 'partial', 'partially_paid'].includes(paymentStatus)) return 'bg-amber-50 text-amber-700 border-amber-200';
                                              if (['refunded', 'partially_refunded'].includes(paymentStatus)) return 'bg-rose-50 text-rose-700 border-rose-200';
                                              return 'bg-slate-50 text-slate-700 border-slate-200';
                                            })();
                                            const totalPaid = Number(item?.paidAmount ?? item?.amount ?? 0);
                                            const branchLabel = item?.details?.branch?.name || item?.branchName || activeCustomerBranch || '—';
                                            return (
                                              <button
                                                key={item.id || `${dateValue || Math.random()}`}
                                                type="button"
                                                onClick={() => void openHistoricalAppointmentDetails(item)}
                                                className="w-full text-left rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 hover:bg-white hover:border-amber-200 transition-all shadow-xs"
                                              >
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="min-w-0 space-y-1">
                                                    <p className="text-sm font-black text-slate-900 truncate">{serviceName}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">{employeeName}</p>
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone}`}>
                                                        {item?.status || '—'}
                                                      </span>
                                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${paymentTone}`}>
                                                        {paymentStatusLabel}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <div className="text-right shrink-0 space-y-1">
                                                    <p className="text-sm font-black text-slate-900 font-mono whitespace-nowrap">
                                                      {totalPaid ? `${totalPaid.toFixed(2)} ${t.riyal}` : '—'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">#{item?.id?.slice?.(0, 8) || '—'}</p>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-[11px]">
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'التاريخ' : 'Date'}</p>
                                                    <p className="text-slate-800 font-bold mt-1">{dateLabel}</p>
                                                  </div>
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'الوقت' : 'Time'}</p>
                                                    <p className="text-slate-800 font-bold mt-1">{timeLabel}</p>
                                                  </div>
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'المدة' : 'Duration'}</p>
                                                    <p className="text-slate-800 font-bold mt-1">{durationLabel}</p>
                                                  </div>
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'الفرع' : 'Branch'}</p>
                                                    <p className="text-slate-800 font-bold mt-1 truncate">{branchLabel}</p>
                                                  </div>
                                                </div>
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </section>
                                  </motion.div>
                                )}

                                {customerDrawerTab === 'transactions' && (
                                  <motion.div key="customer-transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                            {isRtl ? 'المعاملات المالية' : 'Financial Transactions'}
                                          </h4>
                                          <p className="text-[10px] text-slate-400 mt-1">
                                            {isRtl ? 'بطاقات مالية كاملة مع رقم المرجع والحالة.' : 'Rich financial cards with reference, payment method, and status.'}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setCustomerTransactionsExpanded(prev => !prev)}
                                          className="text-[10px] font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-700"
                                        >
                                          {isRtl ? 'عرض الكل' : 'View All'}
                                        </button>
                                      </div>
                                      <div className="space-y-2">
                                        {customerRecentTransactions.length === 0 ? (
                                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'لا توجد عمليات مالية مسجلة.' : 'No recent financial activity found.'}
                                          </div>
                                        ) : (
                                          customerRecentTransactions.map((item: any, idx: number) => {
                                            const amount = Number(item.amount ?? item.totalAmount ?? item.value ?? item.price ?? 0);
                                            const referenceNumber = item.reference || item.transactionRef || item.invoiceNumber || item.orderNumber || item.bookingReference || item.bookingSessionReference || item.id || `TX-${idx + 1}`;
                                            const transactionType = item.title || item.type || item.kind || item.source || item.paymentMethodLabel || 'Transaction';
                                            const dateValue = item.processedAt || item.date || item.createdAt || item.time || '';
                                            const paymentMethod = item.paymentMethodLabel || item.paymentMethod || item.method || '—';
                                            const statusLabel = item.status || item.normalizedPaymentStatus || item.paymentStatus || '—';
                                            const statusTone = getTransactionStatusTone(item.status || item.normalizedPaymentStatus || item.paymentStatus);
                                            const detailHint = item.subtitle || item.notes || '';
                                            const detailPath = `${item.detailPath || ''}`;
                                            const isLinked = Boolean(detailPath);
                                            return (
                                              <button
                                                key={`${referenceNumber}-${idx}`}
                                                type="button"
                                                onClick={() => void openCustomerTransactionRecord(item)}
                                                className="w-full text-left rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 hover:bg-white hover:border-amber-200 transition-all shadow-xs"
                                              >
                                                <div className="flex items-start justify-between gap-3">
                                                  <div className="min-w-0 space-y-1">
                                                    <p className="text-sm font-black text-slate-900 truncate">{transactionType}</p>
                                                    <p className="text-[11px] text-slate-500 truncate">
                                                      {referenceNumber}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 truncate">
                                                      {dateValue ? new Date(dateValue).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                                                    </p>
                                                  </div>
                                                  <div className="text-right shrink-0 space-y-1">
                                                    <p className="text-sm font-black text-slate-900 font-mono whitespace-nowrap">
                                                      {amount ? `${amount.toFixed(2)} ${t.riyal}` : '—'}
                                                    </p>
                                                    <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusTone}`}>
                                                      {statusLabel}
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-[11px]">
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</p>
                                                    <p className="text-slate-800 font-bold mt-1 truncate">{paymentMethod}</p>
                                                  </div>
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'النوع' : 'Type'}</p>
                                                    <p className="text-slate-800 font-bold mt-1 truncate">{item.type || item.entityType || '—'}</p>
                                                  </div>
                                                  <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{isRtl ? 'المرجع' : 'Reference'}</p>
                                                    <p className="text-slate-800 font-bold mt-1 truncate">{isLinked ? 'Linked' : 'Standalone'}</p>
                                                  </div>
                                                </div>
                                                {(detailHint || isLinked) && (
                                                  <div className="flex items-center justify-between gap-3 mt-3 text-[10px] text-slate-500">
                                                    <span className="truncate">{detailHint || (isRtl ? 'مرتبط بتفاصيل فعلية من الخادم' : 'Linked to live production data')}</span>
                                                    <span className="font-black text-slate-900">{isRtl ? 'فتح' : 'Open'} ›</span>
                                                  </div>
                                                )}
                                              </button>
                                            );
                                          })
                                        )}
                                      </div>
                                    </section>
                                  </motion.div>
                                )}

                                {customerDrawerTab === 'reviews' && (
                                  <motion.div key="customer-reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {isRtl ? 'التقييمات' : 'Reviews'}
                                      </h4>
                                      <div className="space-y-2">
                                        {customerProfileLoading ? (
                                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'جاري تحميل التقييمات من الملف الفعلي...' : 'Loading customer reviews from live data...'}
                                          </div>
                                        ) : customerLiveReviews.length === 0 ? (
                                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'لا توجد تقييمات مسجلة لهذا العميل حالياً.' : 'No customer reviews are linked to this appointment yet.'}
                                          </div>
                                        ) : (
                                          customerLiveReviews.map((review: any, idx: number) => (
                                            <div key={review.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2 text-xs">
                                              <div className="flex justify-between items-center gap-3">
                                                <span className="font-bold text-slate-800 truncate">{review.serviceName || review.title || review.service?.name_en || (isRtl ? 'خدمة مرتبطة' : 'Linked Service')}</span>
                                                <div className="flex text-amber-500 gap-0.5 shrink-0">
                                                  {Array.from({ length: Math.max(1, Math.min(5, review.rating || 0)) }).map((_, starIdx) => (
                                                    <Star key={starIdx} size={11} fill="currentColor" />
                                                  ))}
                                                </div>
                                              </div>
                                              <p className="text-slate-600 leading-relaxed italic">
                                                {review.comment || review.text || (isRtl ? 'لا يوجد تعليق مسجل.' : 'No comment recorded.')}
                                              </p>
                                              <p className="text-[10px] text-slate-400">
                                                {review.createdAt || review.reviewedAt || ''}
                                              </p>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    </section>
                                  </motion.div>
                                )}

                                {customerDrawerTab === 'notes' && (
                                  <motion.div key="customer-notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                                    <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                        {isRtl ? 'ملاحظات الصالون' : 'Internal Notes'}
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {customerInternalNotes.map((note) => (
                                          <div key={note.label} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{note.label}</p>
                                            <p className="leading-relaxed">{note.value || '—'}</p>
                                          </div>
                                        ))}
                                      </div>
                                      {customerNoteHistory.length > 0 && (
                                        <div className="space-y-2 pt-1">
                                          {customerNoteHistory.map((note: any, idx: number) => (
                                            <div key={`${note.id || idx}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                                              {note.text || note.note || note}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </section>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </section>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Render modular advanced interactive creation & POS checkout drawers */}
      <InteractiveDrawers 
        isRtl={isRtl}
        isCreateDrawerOpen={isCreateDrawerOpen}
        setIsCreateDrawerOpen={setIsCreateDrawerOpen}
        isCartDrawerOpen={isCartDrawerOpen}
        setIsCartDrawerOpen={setIsCartDrawerOpen}
        appointments={appointments}
        setAppointments={setAppointments}
        addLocalToast={addLocalToast}
        formatMinutesToTime={formatMinutesToTime}
        currentStartTime={currentStartTime}
        setCurrentStartTime={setCurrentStartTime}
        currentStaffId={currentStaffId}
        setCurrentStaffId={setCurrentStaffId}
        initialCreateMode={initialCreateMode}
        initialCartTab={initialCartTab}
        selectedDate={selectedDate}
        customers={liveCustomers}
        services={liveServices}
        products={liveProducts}
        onBoardChanged={loadBoardData}
      />

      {/* Render Roster / Employee Weekly Schedule Editor Modal */}
      <EmployeeWeeklyScheduleEditor 
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        isRtl={isRtl}
        staffId={selectedShiftStaffId}
        staffName={isRtl 
          ? (liveStylists.find(s => s.id === selectedShiftStaffId)?.nameAr || selectedShiftStaffId)
          : (liveStylists.find(s => s.id === selectedShiftStaffId)?.nameEn || selectedShiftStaffId)
        }
        addLocalToast={addLocalToast}
        onBoardChanged={loadBoardData}
      />

      {/* SIMULATED THERMAL RECEIPT MODAL FOR APPOINTMENT CHECKOUT */}
      <AnimatePresence>
        {showReceiptModal && checkoutReceiptData && (
          <div className="fixed inset-0 z-[60] bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-5 w-80 font-mono text-xs border text-slate-800 space-y-3 shadow-2xl relative"
            >
              <div className="border-t-2 border-b-2 border-dashed border-slate-800 py-3 text-center space-y-1">
                <span className="font-black text-sm tracking-widest block text-zinc-950">REFAH OPERATIONS</span>
                <p className="text-[9px] text-zinc-400">Simplified VAT Tax Invoice</p>
                <p className="text-[8px] text-zinc-400">VAT Registration: 31092813100003</p>
                <div className="h-px border-b border-dashed my-1" />
                
                <div className="text-[9px] text-left space-y-0.5 text-slate-600">
                  <p>INV ID: {checkoutReceiptData.orderId}</p>
                  <p>DATE: {checkoutReceiptData.date}</p>
                  <p>BUYER: {checkoutReceiptData.customerName}</p>
                </div>
                
                <div className="h-px border-b border-dashed my-1" />
                
                {/* Items List */}
                <div className="space-y-1">
                  {/* Service Line */}
                  <div className="flex justify-between text-[10px] text-slate-800 font-bold">
                    <span className="truncate flex-1 text-left">{checkoutReceiptData.serviceName}</span>
                    <span className="shrink-0">{checkoutReceiptData.servicePrice.toFixed(2)} SAR</span>
                  </div>
                  
                  {/* Product Lines */}
                  {checkoutReceiptData.products.map((it: any) => (
                    <div key={it.id} className="flex justify-between text-[10px] text-slate-600 pl-2">
                      <span className="truncate flex-1 text-left">• {it.nameEn} (x{it.quantity})</span>
                      <span className="shrink-0">{(it.price * it.quantity).toFixed(2)} SAR</span>
                    </div>
                  ))}
                </div>
                
                <div className="h-px border-b border-dashed my-1" />
                
                {/* Subtotals */}
                <div className="space-y-0.5 text-[9px] text-left text-slate-600">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>{checkoutReceiptData.subtotal.toFixed(2)} SAR</span>
                  </div>
                  {checkoutReceiptData.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>DISCOUNT (GIFT CARD):</span>
                      <span>-{checkoutReceiptData.discount.toFixed(2)} SAR</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>VAT (15%):</span>
                    <span>{checkoutReceiptData.vat.toFixed(2)} SAR</span>
                  </div>
                  <div className="flex justify-between font-black text-black text-[11px] border-t border-slate-300 pt-1 mt-1">
                    <span>TOTAL NET:</span>
                    <span>{checkoutReceiptData.total.toFixed(2)} SAR</span>
                  </div>
                </div>
                
                <div className="h-px border-b border-dashed my-1.5" />
                
                <p className="text-[8px] bg-zinc-950 text-white rounded p-0.5 font-bold tracking-wider">
                  PAID IN FULL - CHECKOUT COMPLETE
                </p>
                <p className="text-[8px] text-slate-500 italic mt-1">
                  Gateways: {checkoutReceiptData.paymentSummary}
                </p>
                <p className="text-[8px] text-slate-400 mt-2">
                  شكراً لزيارتكم صالون رفاه الفاخر 🌸 Thank you
                </p>
              </div>
              
              <div className="flex gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => { 
                    addLocalToast('تمت محاكاة طباعة الفاتورة الضريبية الورقية الملكية لـ ZATCA!', 'Simulated royal paper ZATCA simplified invoice print successfully!', 'success'); 
                    setShowReceiptModal(false); 
                  }} 
                  className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={12} className="text-amber-400" />
                  <span>Print Receipt</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowReceiptModal(false)} 
                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SELF-CONTAINED LOCAL FLOATING TOASTS NOTIFICATION PORTAL */}
      <div className={`fixed bottom-6 z-50 flex flex-col gap-2 max-w-sm ${isRtl ? 'left-6' : 'right-6'}`}>
        <AnimatePresence>
          {localToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className={`p-3 rounded-xl shadow-xl flex items-start gap-2 border backdrop-blur-md ${
                toast.type === 'success' 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-800' 
                  : toast.type === 'warning'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-800'
                    : 'bg-amber-500/10 border-amber-500 text-amber-800'
              }`}
            >
              <div className="flex-1">
                <p className="text-xs font-black">{isRtl ? toast.msgAr : toast.msgEn}</p>
                <p className="text-[9px] opacity-70 mt-0.5">{isRtl ? toast.msgEn : toast.msgAr}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
