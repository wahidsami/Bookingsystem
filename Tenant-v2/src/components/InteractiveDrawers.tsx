import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar as CalendarIcon, User, Users, PlusCircle, Check, 
  Trash, ChevronLeft, ChevronRight, Split, ShoppingBag, Receipt, Printer, Sparkles, AlertTriangle
} from 'lucide-react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

const toMoney = (value: any) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getLocalDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createEmptyGuestService = () => ({
  id: `gs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  serviceId: '',
  serviceName: '',
  category: '',
  duration: 0,
  staffId: '',
  startTime: 540,
  basePrice: 0,
  discountType: 'none',
  discountValue: 0,
  finalPrice: 0,
  isFree: false,
});

interface InteractiveDrawersProps {
  isRtl: boolean;
  isCreateDrawerOpen: boolean;
  setIsCreateDrawerOpen: (open: boolean) => void;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  appointments: any[];
  setAppointments: React.Dispatch<React.SetStateAction<any[]>>;
  addLocalToast: (msgAr: string, msgEn: string, type?: 'success' | 'info' | 'warning') => void;
  formatMinutesToTime: (totalMins: number) => string;
  currentStartTime: number;
  setCurrentStartTime: (mins: number) => void;
  currentStaffId: string;
  setCurrentStaffId: (id: string) => void;
  initialCreateMode?: 'appointment' | 'blocked';
  initialCartTab?: 'products' | 'giftcards';
  selectedDate: Date;
  customers: any[];
  services: any[];
  products: any[];
  giftCardPackages?: GiftCardPackage[];
  stylists: any[];
  onBoardChanged?: () => Promise<void> | void;
  existingBreak?: {
    id: string;
    staffId?: string;
    startTime?: number;
    duration?: number;
    blockedType?: 'Break' | 'Lunch' | 'Meeting';
    type?: string;
    label?: string;
  } | null;
}

export interface GuestService {
  id: string;
  serviceId: string;
  serviceName: string;
  category: string;
  duration: number;
  staffId: string;
  startTime: number;
  basePrice: number;
  discountType: 'none' | 'flat' | 'percent';
  discountValue: number;
  finalPrice: number;
  isFree: boolean;
  metadata?: any;
}

export interface GuestProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes: string;
  isFree: boolean;
  services: GuestService[];
}

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
  packageId?: string;
}

interface GiftCardPackage {
  id: string;
  title: string;
  title_en?: string;
  title_ar?: string;
  priceAmount?: number;
  walletCreditAmount?: number;
  isActive?: boolean;
}

const getBlockPresetTexts = (type: 'Break' | 'Lunch' | 'Meeting') => {
  if (type === 'Break') {
    return {
      titleAr: 'استراحة فنجان قهوة',
      titleEn: 'Coffee Recess Break'
    };
  }

  if (type === 'Lunch') {
    return {
      titleAr: 'فترة استراحة الغداء',
      titleEn: 'Staff Lunch Break'
    };
  }

  return {
    titleAr: 'اجتماع إداري',
    titleEn: 'Staff Administrative Sync'
  };
};

export default function InteractiveDrawers({
  isRtl,
  isCreateDrawerOpen,
  setIsCreateDrawerOpen,
  isCartDrawerOpen,
  setIsCartDrawerOpen,
  appointments,
  setAppointments,
  addLocalToast,
  formatMinutesToTime,
  currentStartTime,
  setCurrentStartTime,
  currentStaffId,
  setCurrentStaffId,
  initialCreateMode,
  initialCartTab,
  selectedDate,
  customers,
  services,
  products,
  giftCardPackages = [],
  stylists,
  onBoardChanged,
  existingBreak
}: InteractiveDrawersProps) {
  
  // Create Modal Step
  const [createMode, setCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [createStep, setCreateStep] = useState<number>(1);

  // Sync initial parameters when drawer opens
  useEffect(() => {
    if (isCreateDrawerOpen && initialCreateMode) {
      setCreateMode(initialCreateMode);
    }
  }, [isCreateDrawerOpen, initialCreateMode]);

  const availableStylists = stylists;

  useEffect(() => {
    if (!isCreateDrawerOpen || createMode !== 'blocked') {
      loadedBreakIdRef.current = null;
      return;
    }

    if (existingBreak?.id) {
      if (loadedBreakIdRef.current === existingBreak.id) {
        return;
      }
      const presetType = (existingBreak.blockedType || existingBreak.type || 'Break') as 'Break' | 'Lunch' | 'Meeting';
      const normalizedType = ['Break', 'Lunch', 'Meeting'].includes(presetType) ? presetType : 'Break';
      setBlockStaffId(existingBreak.staffId || currentStaffId || availableStylists[0]?.id || '');
      setBlockStartTime(Number(existingBreak.startTime ?? 180));
      setBlockDuration(Number(existingBreak.duration ?? 45));
      setBlockType(normalizedType);
      const presetTexts = getBlockPresetTexts(normalizedType);
      setBlockTitleAr(presetTexts.titleAr);
      setBlockTitleEn(existingBreak.label || presetTexts.titleEn);
      if (existingBreak.label) {
        setBlockTitleAr(existingBreak.label);
      }
      loadedBreakIdRef.current = existingBreak.id;
      return;
    }

    if (!blockStaffId) {
      setBlockStaffId(currentStaffId || availableStylists[0]?.id || '');
    }
  }, [
    isCreateDrawerOpen,
    createMode,
    existingBreak,
    availableStylists,
    currentStaffId
  ]);

  useEffect(() => {
    if (isCartDrawerOpen && initialCartTab) {
      setCartTab(initialCartTab);
    }
  }, [isCartDrawerOpen, initialCartTab]);

  useEffect(() => {
    if (isCartDrawerOpen) {
      setPosCheckoutComplete(false);
    } else {
      setCompletedOrder(null);
      setPosCheckoutComplete(false);
    }
  }, [isCartDrawerOpen]);

  // Step 1: Customer Info
  const [custMode, setCustMode] = useState<'existing' | 'new' | 'walkin'>('existing');
  const [selectedCustId, setSelectedCustId] = useState<string>('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustDob, setNewCustDob] = useState('1998-05-12');
  const [newCustGender, setNewCustGender] = useState<'F' | 'M'>('F');
  const [newCustIsVip, setNewCustIsVip] = useState(false);
  const [includeGroupGuests, setIncludeGroupGuests] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [guestNames, setGuestNames] = useState('');
  const existingCustomerSelectRef = useRef<HTMLSelectElement>(null);
  const newCustomerNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (availableStylists.length > 0 && !availableStylists.some((stylist) => stylist.id === currentStaffId)) {
      setCurrentStaffId(availableStylists[0].id);
    }
  }, [availableStylists, currentStaffId, setCurrentStaffId]);

  useEffect(() => {
    if (!isCreateDrawerOpen || createStep !== 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (custMode === 'new') {
        newCustomerNameRef.current?.focus();
      } else {
        existingCustomerSelectRef.current?.focus();
      }
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isCreateDrawerOpen, createStep, custMode]);

  // Structured Guest State
  const [guestsList, setGuestsList] = useState<GuestProfile[]>([
    { 
      id: 'g-1', 
      name: '', 
      phone: '', 
      email: '',
      birthDate: '',
      notes: '', 
      isFree: false, 
      services: [createEmptyGuestService()] 
    }
  ]);

  // Synchronize guest list elements based on numeric guestCount spinner
  useEffect(() => {
    if (guestCount > 0) {
      setGuestsList(prev => {
        const next = [...prev];
        if (next.length < guestCount) {
          for (let i = next.length; i < guestCount; i++) {
            next.push({
              id: `g-${Date.now()}-${i}`,
              name: '',
              phone: '',
              email: '',
              birthDate: '',
              notes: '',
              isFree: false,
              services: [createEmptyGuestService()]
            });
          }
        } else if (next.length > guestCount) {
          next.splice(guestCount);
        }
        return next;
      });
    }
  }, [guestCount]);

  useEffect(() => {
    if (services.length === 0) return;
    const primaryService = services[0];
    const primaryStaff = availableStylists[0];
    setGuestsList(prev => prev.map((guest) => ({
      ...guest,
      services: (guest.services || []).map((service) => {
        const resolvedService = service.serviceId ? services.find((srv) => srv.id === service.serviceId) : null;
        const resolvedStaff = service.staffId ? availableStylists.find((staff) => staff.id === service.staffId) : null;
        const nextService = resolvedService || primaryService;
        const nextStaffId = resolvedStaff?.id || primaryStaff?.id || '';
        const nextBasePrice = toMoney(nextService?.price);
        return {
          ...service,
          serviceId: nextService?.id || '',
          serviceName: isRtl ? (nextService?.nameAr || '') : (nextService?.nameEn || ''),
          category: nextService?.categoryEn || nextService?.categoryAr || '',
          duration: nextService?.duration || service.duration,
          staffId: nextStaffId,
          basePrice: nextBasePrice,
          finalPrice: service.isFree || guest.isFree ? 0 : nextBasePrice,
        };
      }),
    })));
  }, [services, availableStylists, isRtl]);

  const addGuestService = (guestId: string) => {
    setGuestsList(prev => prev.map(g => {
      if (g.id === guestId) {
        const guestServices = g.services || [];
        const catalogService = services[0];
        const catalogStylist = availableStylists[0];
        const newService: GuestService = {
          id: `gs-${Date.now()}-${guestServices.length}`,
          serviceId: catalogService?.id || '',
          serviceName: isRtl ? (catalogService?.nameAr || '') : (catalogService?.nameEn || ''),
          category: catalogService?.categoryEn || catalogService?.categoryAr || '',
          duration: catalogService?.duration || 0,
          staffId: catalogStylist?.id || '',
          startTime: 540,
          basePrice: toMoney(catalogService?.price),
          discountType: 'none',
          discountValue: 0,
          finalPrice: toMoney(catalogService?.price),
          isFree: false
        };
        return { ...g, services: [...guestServices, newService] };
      }
      return g;
    }));
  };

  const removeGuestService = (guestId: string, serviceIdInGuest: string) => {
    setGuestsList(prev => prev.map(g => {
      if (g.id === guestId) {
        const services = g.services || [];
        if (services.length > 1) {
          return { ...g, services: services.filter(s => s.id !== serviceIdInGuest) };
        }
      }
      return g;
    }));
  };

  const updateGuestService = (guestId: string, serviceIdInGuest: string, fields: Partial<GuestService>) => {
    setGuestsList(prev => prev.map(g => {
      if (g.id === guestId) {
        const nextServices = (g.services || []).map(s => {
          if (s.id === serviceIdInGuest) {
            const updated = { ...s, ...fields };
            if (fields.serviceId) {
              const catalogSrv = services.find(srv => srv.id === fields.serviceId);
              if (catalogSrv) {
                updated.serviceName = catalogSrv.nameEn;
                updated.category = catalogSrv.categoryEn;
                updated.duration = catalogSrv.duration;
                updated.basePrice = toMoney(catalogSrv.price);
                updated.finalPrice = toMoney(catalogSrv.price);
              }
            }
            let priceAfterDiscount = toMoney(updated.basePrice);
            if (updated.discountType === 'flat') {
              priceAfterDiscount = Math.max(0, toMoney(updated.basePrice) - toMoney(updated.discountValue));
            } else if (updated.discountType === 'percent') {
              priceAfterDiscount = Math.max(0, toMoney(updated.basePrice) * (1 - toMoney(updated.discountValue) / 100));
            }
            updated.finalPrice = updated.isFree || g.isFree ? 0 : priceAfterDiscount;
            return updated;
          }
          return s;
        });
        return { ...g, services: nextServices };
      }
      return g;
    }));
  };

  // Step 2: Service Queue Staging
  const [currentServiceId, setCurrentServiceId] = useState<string>('');
  const [currentDuration, setCurrentDuration] = useState<number>(60);
  const [currentDiscountType, setCurrentDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
  const [currentDiscountValue, setCurrentDiscountValue] = useState<number>(0);
  const [currentServiceNotes, setCurrentServiceNotes] = useState<string>('');
  const [stagedServices, setStagedServices] = useState<StagedService[]>([]);

  useEffect(() => {
    if (createStep === 4 && stagedServices.length === 0) {
      setCreateStep(3);
    }
  }, [createStep, stagedServices.length]);

  useEffect(() => {
    if (services.length > 0) {
      const selectedServiceExists = services.some((service) => service.id === currentServiceId);
      if (!selectedServiceExists) {
        setCurrentServiceId(services[0].id);
      }
    }
  }, [services, currentServiceId]);

  useEffect(() => {
    if (customers.length > 0) {
      const selectedCustomerExists = customers.some((customer) => customer.id === selectedCustId);
      if (!selectedCustomerExists) {
        setSelectedCustId(customers[0].id);
      }
    }
  }, [customers, selectedCustId]);

  // Step 3: Payments notes & custom checkout
  const [sessionNotes, setSessionNotes] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [createSplitActive, setCreateSplitActive] = useState(false);
  const [createSplitAmounts, setCreateSplitAmounts] = useState({ 
    card: 0, 
    cash: 0, 
    online: 0, 
    bank_transfer: 0, 
    wallet: 0, 
    gift_card: 0 
  });
  const [giftCardCodeInput, setGiftCardCodeInput] = useState('');

  useEffect(() => {
    if (!isCreateDrawerOpen || initialCreateMode !== 'appointment') {
      return;
    }

    setCreateSplitActive(false);
    setCreateSplitAmounts({
      card: 0,
      cash: 0,
      online: 0,
      bank_transfer: 0,
      wallet: 0,
      gift_card: 0
    });
  }, [isCreateDrawerOpen, initialCreateMode]);

  // Blocked shift breaks
  const [blockTitleAr, setBlockTitleAr] = useState('استراحة قهوة الموظفين');
  const [blockTitleEn, setBlockTitleEn] = useState('Staff Espresso Recess');
  const [blockStaffId, setBlockStaffId] = useState('');
  const [blockStartTime, setBlockStartTime] = useState<number>(180); // 12:00 PM
  const [blockDuration, setBlockDuration] = useState<number>(45);
  const [blockType, setBlockType] = useState<'Break' | 'Lunch' | 'Meeting'>('Break');
  const isEditingBreak = Boolean(existingBreak?.id);
  const loadedBreakIdRef = useRef<string | null>(null);

  // POS CART & GIFT CARDS
  const [cartTab, setCartTab] = useState<'products' | 'giftcards'>('products');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [gcSender, setGcSender] = useState('');
  const [gcRecipient, setGcRecipient] = useState('');
  const [gcValue, setGcValue] = useState<number>(500);
  const [generatedGcCode, setGeneratedGcCode] = useState(() => `REF-GFT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [posCustMode, setPosCustMode] = useState<'walkin' | 'existing'>('walkin');
  const [posSelectedCustId, setPosSelectedCustId] = useState('');
  const [posSplitActive, setPosSplitActive] = useState(false);
  const [posSplitAmounts, setPosSplitAmounts] = useState({ card: 0, cash: 0, wallet: 0 });

  // Receipt printed preview modal
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [posCheckoutComplete, setPosCheckoutComplete] = useState(false);

  const buildIsoFromMinutes = (date: Date, minutesFromNine: number) => {
    const dateKey = getLocalDateKey(date);
    const safeMinutes = Math.max(0, Math.round(minutesFromNine));
    const next = new Date(`${dateKey}T00:00:00`);
    next.setHours(9 + Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0);
    return next.toISOString();
  };

  const buildClockTime = (minutesFromNine: number) => {
    const absoluteMinutes = 9 * 60 + Math.max(0, Math.round(minutesFromNine));
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Auto pre-populate duration when service changes
  useEffect(() => {
    const srv = services.find(s => s.id === currentServiceId);
    if (srv) {
      setCurrentDuration(srv.duration);
    }
  }, [currentServiceId, services]);

  const handleAddStagedService = () => {
    const resolvedServiceId = `${currentServiceId || ''}`.trim();
    const srv = services.find(s => s.id === resolvedServiceId);
    if (!srv) return;

    let nextStartTime = currentStartTime;
    if (stagedServices.length > 0) {
      const lastItem = stagedServices[stagedServices.length - 1];
      nextStartTime = lastItem.startTime + lastItem.duration;
    }

    const newItem: StagedService = {
      id: `stg-${Date.now()}`,
      serviceId: resolvedServiceId,
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

  const handleConfirmAppointmentCreation = async () => {
    let custNameEn = '';
    let custNameAr = '';
    let custPhone = '';
    let custEmail = '';
    let loyalty = 'Standard Guest';
    let balance = 0;

    // Guest validation step
    if (includeGroupGuests) {
      const emptyGuestName = guestsList.some(g => g.name.trim() === '');
      if (emptyGuestName) {
        addLocalToast(
          'يرجى تعبئة أسماء جميع المرافقين أولاً لتأكيد الجلسة الجماعية.',
          'Please fill out all guest names before confirming the group session.',
          'warning'
        );
        return;
      }
    }

    if (custMode === 'existing') {
      const existing = customers.find(c => c.id === selectedCustId);
      if (existing) {
        custNameEn = existing.name;
        custNameAr = existing.name;
        custPhone = existing.phone;
        custEmail = existing.email || '';
        loyalty = existing.appointmentsCount > 10 ? 'VIP Gold' : 'Loyal Club';
        balance = Number(existing.walletBalance || existing.balance || 0);
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
      custPhone = '';
      loyalty = 'Guest Account';
    }

    const finalStaged = [...stagedServices];
    if (finalStaged.length === 0) {
      addLocalToast('يرجى إدراج خدمة واحدة على الأقل لتأكيد الحجز', 'Please add at least one service to confirm booking', 'warning');
      return;
    }

    let totalRawPrice = 0;
    let serviceNamesEn: string[] = [];
    let serviceNamesAr: string[] = [];
    let firstStaffId = finalStaged[0].staffId;
    let earliestStartTime = finalStaged[0].startTime;
    let totalDuration = 0;

    finalStaged.forEach(item => {
      const srv = services.find(s => s.id === item.serviceId);
      if (srv) {
        let priceAfterDisc = srv.price;
        if (item.discountType === 'flat') {
          priceAfterDisc = Math.max(0, srv.price - item.discountValue);
        } else if (item.discountType === 'percent') {
          priceAfterDisc = Math.max(0, srv.price - (srv.price * item.discountValue) / 100);
        }
        totalRawPrice += priceAfterDisc;
        serviceNamesEn.push(srv.nameEn);
        serviceNamesAr.push(srv.nameAr);
        totalDuration += item.duration;
      }
    });

    // Aggregate guest pricing review totals
    let guestAddonsPrice = 0;
    if (includeGroupGuests) {
      guestsList.forEach((g, idx) => {
        const guestServices = g.services || [];
        guestServices.forEach((gs) => {
          if (!g.isFree && !gs.isFree) {
            guestAddonsPrice += gs.finalPrice;
          }
          serviceNamesEn.push(`Guest ${idx + 1} (${g.name}): ${gs.serviceName}`);
          serviceNamesAr.push(`مرافق ${idx + 1} (${g.name}): ${gs.serviceNameAr || gs.serviceName}`);
        });
      });
    }

    const finalPrice = Math.max(0, totalRawPrice + guestAddonsPrice);

    const items = finalStaged.map((item) => {
      const resolvedServiceId = `${item.serviceId || ''}`.trim();
      const service = services.find(s => s.id === resolvedServiceId);
      return {
        serviceId: resolvedServiceId,
        staffId: item.staffId,
        requestedStaffId: item.staffId,
        startTime: buildIsoFromMinutes(selectedDate, item.startTime),
        notes: item.notes || undefined,
        duration: item.duration,
        discountType: item.discountType,
        discountValue: item.discountValue,
        paymentMethod: 'at-center',
        assignmentMode: 'tenant_reassigned',
        variantId: undefined,
        serviceName: service ? (isRtl ? service.nameAr : service.nameEn) : undefined
      };
    });

    const resolvedPrimaryServiceId = `${items[0]?.serviceId || ''}`.trim();
    const resolvedPrimaryStaffId = `${firstStaffId || currentStaffId || ''}`.trim();
    if (!resolvedPrimaryServiceId) {
      addLocalToast('يرجى اختيار خدمة صحيحة قبل تأكيد الحجز', 'Please choose a valid service before confirming the booking', 'warning');
      return;
    }

    const payload: any = {
      items,
      staffId: resolvedPrimaryStaffId,
      startTime: buildIsoFromMinutes(selectedDate, earliestStartTime),
      notes: sessionNotes || [
        ...finalStaged.map(s => s.notes),
        ...(includeGroupGuests ? guestsList.map(g => g.notes ? `${g.name}: ${g.notes}` : '') : [])
      ].filter(Boolean).join(' | '),
      assignmentMode: 'tenant_reassigned',
      notifyCustomer: notifyWhatsApp,
      paymentMethod: 'at-center',
      platformUserId: custMode === 'existing' ? selectedCustId : undefined,
      customer: custMode === 'new' || custMode === 'walkin'
        ? {
            firstName: custNameEn.trim(),
            lastName: '',
            email: custEmail.trim(),
            phone: custPhone.trim()
          }
        : null
    };

    try {
      const appointmentTotal = Number((items as any[]).reduce((sum, item) => {
        const servicePrice = Number(item?.price || item?.service?.price || item?.subtotal || 0);
        const discountType = `${item?.discountType || 'none'}`.trim().toLowerCase();
        const discountValue = Number(item?.discountValue || 0);

        let discountedPrice = servicePrice;
        if (discountType === 'flat') {
          discountedPrice = Math.max(servicePrice - discountValue, 0);
        } else if (discountType === 'percent') {
          discountedPrice = Math.max(servicePrice - (servicePrice * discountValue / 100), 0);
        }

        return sum + discountedPrice;
      }, 0).toFixed(2));

      const paymentAllocations = createSplitActive
        ? (() => {
            const allocations = Object.entries(createSplitAmounts)
              .filter(([, amount]) => Number(amount) > 0)
              .map(([paymentMethod, amount]) => ({
                paymentMethod:
                  paymentMethod === 'bank_transfer'
                    ? 'bank_transfer'
                    : paymentMethod === 'gift_card'
                      ? 'gift_card_code'
                      : paymentMethod,
                amount: Number(amount)
              }));

            if (allocations.length === 0) {
              return undefined;
            }

            const totalAllocations = allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
            const allocationDifference = Number((appointmentTotal - totalAllocations).toFixed(2));

            if (Math.abs(allocationDifference) > 0.5) {
              return undefined;
            }

            if (Math.abs(allocationDifference) > 0.0001) {
              const lastAllocation = allocations[allocations.length - 1];
              const adjustedAmount = Number((Number(lastAllocation.amount || 0) + allocationDifference).toFixed(2));
              if (adjustedAmount > 0) {
                allocations[allocations.length - 1] = {
                  ...lastAllocation,
                  amount: adjustedAmount
                };
              }
            }

            return allocations;
          })()
        : undefined;

      if (paymentAllocations) {
        payload.paymentAllocations = paymentAllocations;
      }

      const response = await tenantApiAdapter.createAppointment(payload);
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
      setGuestsList([{ id: 'g-1', name: '', phone: '', services: [createEmptyGuestService()], notes: '', isFree: false }]);
      setIncludeGroupGuests(false);
      setGuestCount(1);
      if (onBoardChanged) {
        await onBoardChanged();
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
  };

  const handleConfirmBlockSubmit = async () => {
    try {
      const payload = {
        specificDate: getLocalDateKey(selectedDate),
        startTime: buildClockTime(blockStartTime),
        endTime: buildClockTime(blockStartTime + blockDuration),
        type: (blockType === 'Meeting' ? 'other' : blockType.toLowerCase() as any),
        label: blockTitleEn,
        isRecurring: false,
        referenceDate: getLocalDateKey(selectedDate)
      };

      const response = existingBreak?.id
        ? await tenantApiAdapter.updateEmployeeBreak(blockStaffId || existingBreak.staffId || '', existingBreak.id, payload)
        : await tenantApiAdapter.createEmployeeBreak(blockStaffId, payload);

      if (!response?.success) {
        throw new Error(response?.message || (existingBreak?.id ? 'Failed to update blocked time' : 'Failed to create blocked time'));
      }

      setIsCreateDrawerOpen(false);
      if (onBoardChanged) {
        await onBoardChanged();
      }
      addLocalToast(
        existingBreak?.id
          ? `تم تحديث الفترة الزمنية المحجوزة (${blockTitleAr}) بنجاح`
          : `تم حظر الفترة الزمنية (${blockTitleAr}) بنجاح للأخصائية المعنية`,
        existingBreak?.id
          ? `Successfully updated blocked time (${blockTitleEn})`
          : `Successfully blocked time (${blockTitleEn}) for the stylist`,
        'success'
      );
    } catch (err) {
      console.error(existingBreak?.id ? 'Failed to update blocked time' : 'Failed to create blocked time', err);
      addLocalToast(
        existingBreak?.id ? 'تعذر تحديث فترة الحظر' : 'تعذر حفظ فترة الحظر',
        existingBreak?.id ? 'Failed to update blocked time' : 'Failed to create blocked time',
        'warning'
      );
    }
  };

  const handleBreakDelete = async () => {
    if (!existingBreak?.id) {
      return;
    }

    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(isRtl ? 'هل تريد حذف فترة الحظر هذه؟' : 'Delete this blocked time?');

    if (!confirmed) {
      return;
    }

    try {
      const response = await tenantApiAdapter.deleteEmployeeBreak(blockStaffId || existingBreak.staffId || '', existingBreak.id);
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to delete blocked time');
      }

      setIsCreateDrawerOpen(false);
      if (onBoardChanged) {
        await onBoardChanged();
      }
      addLocalToast(
        'تم حذف فترة الحظر بنجاح',
        'Blocked time deleted successfully',
        'success'
      );
    } catch (err) {
      console.error('Failed to delete blocked time', err);
      addLocalToast(
        'تعذر حذف فترة الحظر',
        'Failed to delete blocked time',
        'warning'
      );
    }
  };

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

  const handleAddGiftCardPackageToCart = (giftCardPackage: GiftCardPackage) => {
    const displayTitle = giftCardPackage.title_ar || giftCardPackage.title_en || giftCardPackage.title || 'Gift Card';
    setCartItems((prev) => {
      const exists = prev.find((item) => item.type === 'giftcard' && item.packageId === giftCardPackage.id);
      if (exists) {
        return prev.map((item) => (
          item.type === 'giftcard' && item.packageId === giftCardPackage.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      }

      return [
        ...prev,
        {
          id: giftCardPackage.id,
          packageId: giftCardPackage.id,
          type: 'giftcard',
          nameAr: displayTitle,
          nameEn: displayTitle,
          price: Number(giftCardPackage.priceAmount || 0),
          quantity: 1,
          skuOrCode: giftCardPackage.id
        }
      ];
    });

    addLocalToast(
      `تمت إضافة "${displayTitle}" إلى سلة بطاقات الهدايا.`,
      `Added "${displayTitle}" to the gift card cart.`,
      'success'
    );
  };

  const handleAddProductToCart = (prod: any) => {
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
    if (posCustMode === 'existing') {
      const cust = customers.find(c => c.id === posSelectedCustId);
      if (cust) buyerName = cust.name;
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;

    let paymentMethodSummary = isRtl ? 'طرق الدفع' : 'Payment methods';
    if (posSplitActive) {
      const parts = [];
      if (posSplitAmounts.card > 0) parts.push(`Card: ${posSplitAmounts.card} ر.س`);
      if (posSplitAmounts.cash > 0) parts.push(`نقداً: ${posSplitAmounts.cash} ر.س`);
      if (posSplitAmounts.wallet > 0) parts.push(`المحفظة: ${posSplitAmounts.wallet} ر.س`);
      paymentMethodSummary = parts.join(' | ');
    } else {
      paymentMethodSummary = isRtl ? 'مدفوع بالكامل بالبطاقة الرقمية' : 'Paid in full via credit card terminal';
    }

    setCompletedOrder({
      orderId: `REF-POS-${Math.floor(100000 + Math.random() * 900000)}`,
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
      setPosSplitAmounts({ card: 0, cash: 0, wallet: 0 });
      setPosCheckoutComplete(true);

    if (onBoardChanged) {
      await onBoardChanged();
    }

    addLocalToast(
      'تمت فوترة المبيعات وتأكيد السداد بنجاح! 🧾',
      'POS Sale billed and settled successfully! 🧾',
      'success'
    );
  };

  return (
    <>
      {/* 5. ADVANCED CREATE APPOINTMENT / BLOCK TIME ACTION DRAWER */}
      <AnimatePresence>
        {isCreateDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsCreateDrawerOpen(false)}
            />
            
            <motion.div 
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className={`relative w-full max-w-xl h-screen bg-slate-50 shadow-2xl flex flex-col z-10 overflow-hidden ${
                isRtl ? 'border-r border-slate-200' : 'border-l border-slate-200'
              }`}
            >
              {/* Header */}
              <div className="p-5 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
                      <CalendarIcon size={16} />
                    </span>
                    <h3 className="text-sm font-bold tracking-tight">
                      {createMode === 'blocked'
                        ? (isEditingBreak
                          ? (isRtl ? 'تعديل فترة الحظر' : 'Edit Blocked Time')
                          : (isRtl ? 'حظر وقت' : 'Blocked Time'))
                        : (isRtl ? 'حجز موعد ومخطط تشغيل جديد' : 'New Reservation & Operational Booking')}
                    </h3>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {createMode === 'blocked'
                      ? (isEditingBreak
                        ? (isRtl ? 'عدّل أو احذف فترة الحظر الحالية ثم احفظ التغييرات.' : 'Update or delete the selected blocked time.')
                        : (isRtl ? 'أنشئ فترة حظر أو استراحة جديدة للموظفة.' : 'Create a new blocked interval for the stylist.'))
                      : (isRtl ? 'جدولة الخدمات والخصومات وتخصيص الدفع لعملاء صالون واستجمام رفاه الفاخر' : 'Schedule luxury services, client profiles, and payment allocations')}
                  </p>
                </div>
                <button 
                  onClick={() => setIsCreateDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Mode Selector */}
              <div className="px-5 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {isRtl ? 'نوع المعاملة التشغيلية' : 'Operational Booking Type'}
                </span>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setCreateMode('appointment')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      createMode === 'appointment' ? 'bg-zinc-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isRtl ? 'جدولة موعد عميل' : 'Client Appointment'}
                  </button>
                  <button
                    onClick={() => {
                      setCreateMode('blocked');
                      setCreateStep(1);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      createMode === 'blocked' ? 'bg-zinc-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {isRtl ? 'حظر فترة زمنية / استراحة' : 'Block Time / Break'}
                  </button>
                </div>
              </div>

              {createMode === 'appointment' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Step Progress */}
                  <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setCreateStep(1)} className={`flex items-center gap-1 font-bold ${createStep === 1 ? 'text-amber-600' : 'text-slate-400'}`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${createStep === 1 ? 'bg-amber-500 text-zinc-950 font-black' : 'bg-slate-200 text-slate-500'}`}>1</span>
                        <span>{isRtl ? 'بيانات العميل' : 'Identity'}</span>
                      </button>
                      <button onClick={() => setCreateStep(2)} className={`flex items-center gap-1 font-bold ${createStep === 2 ? 'text-amber-600' : 'text-slate-400'}`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${createStep === 2 ? 'bg-amber-500 text-zinc-950 font-black' : 'bg-slate-200 text-slate-500'}`}>2</span>
                        <span>{isRtl ? 'المرافقين' : 'Include Guests'}</span>
                      </button>
                      <button onClick={() => setCreateStep(3)} className={`flex items-center gap-1 font-bold ${createStep === 3 ? 'text-amber-600' : 'text-slate-400'}`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${createStep === 3 ? 'bg-amber-500 text-zinc-950 font-black' : 'bg-slate-200 text-slate-500'}`}>3</span>
                        <span>{isRtl ? 'الخدمات والجدولة' : 'Services'}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (stagedServices.length === 0) {
                            addLocalToast(
                              'يرجى إدراج خدمة واحدة على الأقل للمتابعة إلى الفاتورة',
                              'Please add at least one service before opening the invoice step',
                              'warning'
                            );
                            return;
                          }
                          setCreateStep(4);
                        }}
                        disabled={stagedServices.length === 0}
                        className={`flex items-center gap-1 font-bold ${
                          createStep === 4 ? 'text-amber-600' : 'text-slate-400'
                        } ${stagedServices.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${createStep === 4 ? 'bg-amber-500 text-zinc-950 font-black' : 'bg-slate-200 text-slate-500'}`}>4</span>
                        <span>{isRtl ? 'الفاتورة والسداد' : 'Invoice'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {createStep === 1 && (
                      <div className="space-y-4 animate-fadeIn">
                        <div>
                          <label className="text-xs font-black text-slate-600 block mb-2">{isRtl ? 'تصنيف ملف العميل لحجز الموعد' : 'Booking Guest Category'}</label>
                          <div className="grid grid-cols-3 gap-2">
                            {['existing', 'new', 'walkin'].map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setCustMode(mode as any)}
                                className={`py-2 px-1 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                                  custMode === mode 
                                    ? 'bg-amber-500/10 border-amber-500 text-amber-700' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {mode === 'existing' ? <User size={14} /> : mode === 'new' ? <PlusCircle size={14} /> : <Users size={14} />}
                                <span>{mode === 'existing' ? (isRtl ? 'عميل مسجل' : 'Registered') : mode === 'new' ? (isRtl ? 'عميلة جديدة' : 'New Profile') : (isRtl ? 'زائر POS' : 'Walk-in')}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {custMode === 'existing' && (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block">{isRtl ? 'البحث واختيار عميلة مسجلة' : 'Search & Associate Customer'}</label>
                              <select
                                ref={existingCustomerSelectRef}
                                value={selectedCustId}
                                onChange={(e) => setSelectedCustId(e.target.value)}
                                autoFocus
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                            >
                              {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {custMode === 'new' && (
                          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'الاسم بالكامل' : 'Full Name'}</label>
                                <input
                                  ref={newCustomerNameRef}
                                  type="text"
                                  value={newCustName}
                                  onChange={(e) => setNewCustName(e.target.value)}
                                  placeholder="Noura Ahmad"
                                  autoFocus
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'رقم الجوال' : 'Phone'}</label>
                                <input type="text" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="+966 50" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'البريد الإلكتروني' : 'Email'}</label>
                                <input type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                                <input type="date" value={newCustDob} onChange={(e) => setNewCustDob(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input type="checkbox" id="vip-check" checked={newCustIsVip} onChange={(e) => setNewCustIsVip(e.target.checked)} className="rounded text-amber-500" />
                              <label htmlFor="vip-check" className="font-bold text-slate-700">{isRtl ? 'تصنيف كعميلة VIP 👑' : 'Categorize as Premium VIP 👑'}</label>
                            </div>
                          </div>
                        )}

                        {custMode === 'walkin' && (
                          <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4 text-xs text-center py-6">
                            <p className="font-bold text-slate-800 text-sm">{isRtl ? 'حجز زائر سريع' : 'Walk-In Customer'}</p>
                            <p className="text-[10px] text-slate-400">
                              {isRtl 
                                ? 'حساب مؤقت للزوار السريعين. يمكنك إضافة مرافقين وتفاصيل الجلسة الجماعية في الخطوة التالية.' 
                                : 'Standard transient profile. Group guests and multi-session details can be managed in the next step.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {createStep === 2 && (
                      <div className="space-y-4 animate-fadeIn text-xs">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-4">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{isRtl ? 'إضافة ضيوف مرافقين للحجز' : 'Include Group Guests'}</p>
                              <p className="text-[10px] text-slate-400">{isRtl ? 'حجز خدمات إضافية لمرافقين في نفس الموعد' : 'Schedule additional treatments for guests in this reservation'}</p>
                            </div>
                            <div className="flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                              <input 
                                type="checkbox" 
                                id="group-check-step2" 
                                checked={includeGroupGuests} 
                                onChange={(e) => setIncludeGroupGuests(e.target.checked)} 
                                className="rounded text-amber-500 focus:ring-0 cursor-pointer h-4 w-4" 
                              />
                              <label htmlFor="group-check-step2" className="font-bold text-amber-800 text-[11px] cursor-pointer">
                                {isRtl ? 'تفعيل حجز المرافقين' : 'Enable Guest Bookings'}
                              </label>
                            </div>
                          </div>

                          {includeGroupGuests ? (
                            <div className="space-y-4">
                              {/* Guest Ownership Rules Exposing */}
                              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl space-y-1 text-xs">
                                <p className="font-bold text-[10px] uppercase tracking-wide flex items-center gap-1">
                                  <span>ℹ️</span>
                                  <span>{isRtl ? 'قواعد ملكية حجز المرافقين' : 'GUEST OWNERSHIP & BOOKING RULES'}</span>
                                </p>
                                <p className="text-[10px] leading-relaxed">
                                  {isRtl 
                                    ? 'الضيوف المرافقين تابعين للحساب الرئيسي للعميل. لا يمكن تعديل أو تتبع حالة دفعهم بشكل منفصل؛ يتم إصدار فاتورة موحدة لكافة الخدمات.' 
                                    : 'All guest reservations are owned by the primary customer account. Individual rescheduling is locked; payment and checkout are processed under a unified invoice.'}
                                </p>
                              </div>

                              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div>
                                  <p className="font-bold text-slate-700">{isRtl ? 'عدد الضيوف ومرافقيهم' : 'Group Size (Pax)'}</p>
                                  <p className="text-[10px] text-slate-400">{isRtl ? 'الحد الأقصى 8 ضيوف في الجلسة' : 'Maximum of 8 guests'}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                                    className="w-7 h-7 bg-white hover:bg-slate-100 border rounded-lg font-bold flex items-center justify-center cursor-pointer text-sm text-slate-700"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center font-mono font-black text-slate-800 text-sm">{guestCount}</span>
                                  <button 
                                    type="button"
                                    onClick={() => setGuestCount(prev => Math.min(8, prev + 1))}
                                    className="w-7 h-7 bg-white hover:bg-slate-100 border rounded-lg font-bold flex items-center justify-center cursor-pointer text-sm text-slate-700"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>

                              {/* Structured Guest entries with dedicated capture (email/phone) and first-class notes */}
                              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                                {guestsList.map((guest, index) => {
                                  const isNameEmpty = guest.name.trim() === '';
                                  const isEmailInvalid = guest.email && guest.email.trim() !== '' && !guest.email.includes('@');
                                  const hasValidationError = isNameEmpty || isEmailInvalid;

                                  // Calculate guest subtotal based on services
                                  const guestServicesSubtotal = (guest.services || []).reduce((acc, gs) => acc + (guest.isFree || gs.isFree ? 0 : gs.finalPrice), 0);

                                  return (
                                    <div 
                                      key={guest.id} 
                                      className={`p-4 bg-slate-50/50 rounded-xl border transition-all space-y-4 ${
                                        hasValidationError 
                                          ? 'border-red-200 bg-red-50/10 focus-within:border-red-400' 
                                          : 'border-slate-200 focus-within:border-amber-400'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                                          {isRtl ? `بيانات المرافق ${index + 1}` : `Guest ${index + 1} Profile`}
                                        </span>
                                        {hasValidationError && (
                                          <span className="text-[9px] font-black text-red-500 uppercase tracking-tight bg-red-100 px-2 py-0.5 rounded animate-pulse">
                                            {isNameEmpty ? (isRtl ? 'الاسم مطلوب *' : 'Name Required *') : (isRtl ? 'بريد غير صالح' : 'Invalid Email')}
                                          </span>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">{isRtl ? 'الاسم بالكامل *' : 'Full Name *'}</label>
                                          <input 
                                            type="text" 
                                            required
                                            value={guest.name} 
                                            onChange={(e) => setGuestsList(prev => prev.map(g => g.id === guest.id ? { ...g, name: e.target.value } : g))}
                                            placeholder={isRtl ? `الاسم الأول (مثال: سارة)` : `e.g. Guest ${index + 1}`} 
                                            className={`w-full bg-white border p-2 rounded-lg text-xs font-semibold focus:outline-none ${
                                              isNameEmpty ? 'border-red-300 focus:ring-1 focus:ring-red-400' : 'border-slate-200 focus:ring-1 focus:ring-amber-400'
                                            }`} 
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">{isRtl ? 'رقم الجوال' : 'Phone'}</label>
                                          <input 
                                            type="text" 
                                            value={guest.phone} 
                                            onChange={(e) => setGuestsList(prev => prev.map(g => g.id === guest.id ? { ...g, phone: e.target.value } : g))}
                                            placeholder="+966 50" 
                                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-semibold" 
                                          />
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2.5">
                                        <div>
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
                                          <input 
                                            type="email" 
                                            value={guest.email || ''} 
                                            onChange={(e) => setGuestsList(prev => prev.map(g => g.id === guest.id ? { ...g, email: e.target.value } : g))}
                                            placeholder="guest@example.com" 
                                            className={`w-full bg-white border p-2 rounded-lg text-xs font-semibold focus:outline-none ${
                                              isEmailInvalid ? 'border-red-300 focus:ring-1 focus:ring-red-400' : 'border-slate-200 focus:ring-1 focus:ring-amber-400'
                                            }`} 
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[10px] text-slate-500 font-bold block mb-1">{isRtl ? 'تاريخ الميلاد' : 'Birth Date'}</label>
                                          <input 
                                            type="date" 
                                            value={guest.birthDate || ''} 
                                            onChange={(e) => setGuestsList(prev => prev.map(g => g.id === guest.id ? { ...g, birthDate: e.target.value } : g))}
                                            className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-semibold" 
                                          />
                                        </div>
                                      </div>

                                      {/* Services list for this Guest */}
                                      <div className="space-y-3 bg-white p-3 rounded-lg border border-slate-100">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                          <span className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">{isRtl ? 'خدمات الضيف' : 'Services Selection'}</span>
                                          <button
                                            type="button"
                                            onClick={() => addGuestService(guest.id)}
                                            className="text-amber-600 hover:text-amber-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                          >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            <span>{isRtl ? 'إضافة خدمة أخرى' : 'Add Service'}</span>
                                          </button>
                                        </div>

                                        <div className="space-y-3 divide-y divide-slate-100">
                                          {(guest.services || []).map((gs, gsIdx) => (
                                            <div key={gs.id} className={`space-y-2 ${gsIdx > 0 ? 'pt-2.5' : ''}`}>
                                              <div className="flex items-center justify-between gap-1.5">
                                                <span className="text-[10px] font-black text-slate-400">#{gsIdx + 1}</span>
                                                {(guest.services || []).length > 1 && (
                                                  <button
                                                    type="button"
                                                    onClick={() => removeGuestService(guest.id, gs.id)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 cursor-pointer"
                                                  >
                                                    <Trash className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>

                                              <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                  <label className="text-[9px] text-slate-400 font-semibold block mb-0.5">{isRtl ? 'الخدمة' : 'Service'}</label>
                                                  <select
                                                    value={gs.serviceId}
                                                    onChange={(e) => updateGuestService(guest.id, gs.id, { serviceId: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded text-xs font-black text-slate-700"
                                                  >
                                                    {services.map(s => (
                                                      <option key={s.id} value={s.id}>{isRtl ? s.nameAr : s.nameEn} ({s.price} SAR)</option>
                                                    ))}
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="text-[9px] text-slate-400 font-semibold block mb-0.5">{isRtl ? 'الموظف' : 'Staff/Stylist'}</label>
                                                  <select
                                                    value={gs.staffId}
                                                    onChange={(e) => updateGuestService(guest.id, gs.id, { staffId: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded text-xs font-bold text-slate-700"
                                                  >
                                                    {availableStylists.map(st => (
                                                      <option key={st.id} value={st.id}>{isRtl ? st.nameAr : st.nameEn}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                              </div>

                                              <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                  <label className="text-[9px] text-slate-400 font-semibold block mb-0.5">{isRtl ? 'نوع الخصم' : 'Discount Type'}</label>
                                                  <select
                                                    value={gs.discountType}
                                                    onChange={(e) => updateGuestService(guest.id, gs.id, { discountType: e.target.value as any, discountValue: 0 })}
                                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded text-xs font-semibold text-slate-700"
                                                  >
                                                    <option value="none">{isRtl ? 'بلا خصم' : 'No Discount'}</option>
                                                    <option value="flat">{isRtl ? 'مبلغ ثابت' : 'Flat Cash'}</option>
                                                    <option value="percent">{isRtl ? 'نسبة مئوية' : 'Percentage'}</option>
                                                  </select>
                                                </div>

                                                <div>
                                                  <label className="text-[9px] text-slate-400 font-semibold block mb-0.5">{isRtl ? 'قيمة الخصم' : 'Discount'}</label>
                                                  <input
                                                    type="number"
                                                    disabled={gs.discountType === 'none'}
                                                    value={gs.discountValue || ''}
                                                    placeholder="0"
                                                    onChange={(e) => updateGuestService(guest.id, gs.id, { discountValue: parseFloat(e.target.value) || 0 })}
                                                    className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded text-xs font-mono text-center font-bold"
                                                  />
                                                </div>

                                                <div>
                                                  <label className="text-[9px] text-slate-400 font-semibold block mb-0.5">{isRtl ? 'الصافي' : 'Net price'}</label>
                                                  <div className="w-full bg-slate-100 p-1.5 rounded text-xs font-mono font-black text-center text-slate-800">
                                                    {gs.isFree || guest.isFree ? '0 SAR' : `${gs.finalPrice} SAR`}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div>
                                        <label className="text-[10px] text-slate-500 font-bold block mb-1">{isRtl ? 'ملاحظات وتفضيلات الضيف (حقل أساسي)' : 'Guest Notes / Requests'}</label>
                                        <textarea 
                                          rows={1}
                                          value={guest.notes}
                                          onChange={(e) => setGuestsList(prev => prev.map(g => g.id === guest.id ? { ...g, notes: e.target.value } : g))}
                                          placeholder={isRtl ? 'تفضيلات العناية، تفاصيل مخصصة، حساسية للمنتجات...' : 'Allergies, design reference, specific preferences.'} 
                                          className="w-full bg-white border border-slate-200 p-2 rounded-lg text-xs font-semibold" 
                                        />
                                      </div>

                                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/50">
                                        <span className="text-[10px] font-bold text-slate-500">
                                          {isRtl ? 'مجموع خدمات الضيف:' : 'Guest Subtotal:'}
                                          <span className="font-mono font-black text-slate-800 ml-1">
                                            {guestServicesSubtotal} SAR
                                          </span>
                                        </span>
                                        
                                        {/* Guest free-service toggle as a clear control */}
                                        <label className="flex items-center gap-1.5 cursor-pointer">
                                          <input 
                                            type="checkbox" 
                                            checked={guest.isFree} 
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setGuestsList(prev => prev.map(g => {
                                                if (g.id === guest.id) {
                                                  const nextServices = (g.services || []).map(s => ({ ...s, isFree: checked, finalPrice: checked ? 0 : s.basePrice }));
                                                  return { ...g, isFree: checked, services: nextServices };
                                                }
                                                return g;
                                              }));
                                            }}
                                            className="rounded text-emerald-500 focus:ring-0 cursor-pointer h-4 w-4" 
                                          />
                                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                                            <span>🎁</span>
                                            <span>{isRtl ? 'جلسات مجانية بالكامل' : 'All Free'}</span>
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* GUEST PRICING REVIEW / SUMMARY */}
                              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                                <p className="text-[10px] font-black text-amber-800 uppercase tracking-wide flex items-center gap-1">
                                  <span>💳</span>
                                  <span>{isRtl ? 'مراجعة وتفصيل أسعار خدمات الضيوف:' : 'GROUP SESSION PRICING REVIEW'}</span>
                                </p>
                                <div className="divide-y divide-amber-500/10 text-[11px] font-semibold">
                                  {guestsList.map((g, idx) => {
                                    const guestSub = (g.services || []).reduce((acc, gs) => acc + (g.isFree || gs.isFree ? 0 : gs.finalPrice), 0);
                                    return (
                                      <div key={g.id} className="flex justify-between py-1.5 animate-fadeIn">
                                        <div className="text-slate-600">
                                          <p className="font-bold">{g.name || `${isRtl ? 'مرافق' : 'Guest'} ${idx + 1}`}</p>
                                          <div className="pl-2 border-l border-slate-300 text-[10px] text-slate-400 space-y-0.5">
                                            {(g.services || []).map((gs, sIdx) => (
                                              <p key={gs.id}>- {isRtl ? gs.serviceName : gs.serviceName} ({gs.finalPrice} SAR)</p>
                                            ))}
                                          </div>
                                        </div>
                                        <span className="font-mono font-bold text-slate-800 self-center">
                                          {g.isFree ? <span className="text-emerald-600 font-extrabold">{isRtl ? 'مجاني 🎁' : 'FREE 🎁'}</span> : `${guestSub} SAR`}
                                        </span>
                                      </div>
                                    );
                                  })}
                                  <div className="flex justify-between pt-2.5 mt-2 border-t border-amber-500/20 text-xs font-black text-amber-900">
                                    <span>{isRtl ? 'مجموع خدمات المرافقين:' : 'Total Guest Group Cost:'}</span>
                                    <span className="font-mono text-sm">
                                      {guestsList.reduce((acc, g) => acc + (g.isFree ? 0 : (g.services || []).reduce((sum, gs) => sum + (gs.isFree ? 0 : gs.finalPrice), 0)), 0)} SAR
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                              <p className="font-black text-slate-700">{isRtl ? 'حجز عميل فردي' : 'Single Customer Reservation'}</p>
                              <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                                {isRtl 
                                  ? 'لم يتم تفعيل المرافقين لهذا الحجز. سيتم جدولة العميل الرئيسي فقط.' 
                                  : 'No guest profiles included. Proceeding with single customer booking only.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {createStep === 3 && (
                      <div className="space-y-4 animate-fadeIn text-xs">
                        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-500 block mb-1">{isRtl ? 'الخدمة الفاخرة' : 'Select Service'}</label>
                              <select value={currentServiceId} onChange={(e) => setCurrentServiceId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold">
                                {services.map(s => (
                                  <option key={s.id} value={s.id}>{isRtl ? s.nameAr : s.nameEn} ({toMoney(s.price).toFixed(2)} ر.س)</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-500 block mb-1">{isRtl ? 'أخصائية التجميل' : 'Assign Stylist'}</label>
                              <select value={currentStaffId} onChange={(e) => setCurrentStaffId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold">
                                {availableStylists.map(st => (
                                  <option key={st.id} value={st.id}>{isRtl ? st.nameAr : st.nameEn}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-500 block mb-1">{isRtl ? 'وقت البدء' : 'Start Time'}</label>
                              <div className="flex items-center gap-1">
                                <input type="number" step={15} value={currentStartTime} onChange={(e) => setCurrentStartTime(parseInt(e.target.value) || 0)} className="w-16 bg-slate-50 border rounded p-1 text-center font-mono font-bold" />
                                <span className="text-[10px] font-mono text-zinc-500">{formatMinutesToTime(currentStartTime)}</span>
                              </div>
                            </div>
                            <div>
                              <label className="text-slate-500 block mb-1">{isRtl ? 'المدة بالدقائق' : 'Duration (mins)'}</label>
                              <input type="number" step={15} value={currentDuration} onChange={(e) => setCurrentDuration(parseInt(e.target.value) || 60)} className="w-full bg-slate-50 border rounded p-1 font-mono text-center font-bold" />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button type="button" onClick={handleAddStagedService} className="py-1.5 px-3 bg-zinc-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                              <span>+ {isRtl ? 'إدراج لسلسة الخدمات للجلسة' : 'Add to Session Queue'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Staged list */}
                        {stagedServices.length > 0 && (
                          <div className="p-3 bg-slate-100 border rounded-xl space-y-2">
                            <span className="font-bold text-slate-700 block">{isRtl ? 'الخدمات المضافة للجلسة الكلية' : 'Staged Services'}</span>
                            {stagedServices.map((item, index) => {
                              const s = services.find(srv => srv.id === item.serviceId);
                              const staff = availableStylists.find(st => st.id === item.staffId);
                              return (
                                <div key={item.id} className="p-2 bg-white rounded-lg border flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-bold">#{index+1} {isRtl ? s?.nameAr : s?.nameEn}</p>
                                    <p className="text-[10px] text-slate-400">⏱️ {formatMinutesToTime(item.startTime)} | {isRtl ? staff?.nameAr : staff?.nameEn}</p>
                                  </div>
                                  <button type="button" onClick={() => setStagedServices(prev => prev.filter(p => p.id !== item.id))} className="text-rose-500 p-1">
                                    <Trash size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {createStep === 4 && (
                      <div className="space-y-4 animate-fadeIn text-xs">
                        {(() => {
                          const queuedLineItems = stagedServices.map((item, index) => {
                            const srv = services.find((service) => service.id === item.serviceId);
                            const staff = availableStylists.find((stylist) => stylist.id === item.staffId);
                            return {
                              id: item.id,
                              index,
                              serviceName: srv ? (isRtl ? srv.nameAr : srv.nameEn) : item.serviceId,
                              staffName: isRtl ? staff?.nameAr : staff?.nameEn,
                              duration: item.duration,
                              startTime: item.startTime,
                              price: srv ? toMoney(srv.price) : 0
                            };
                          });
                          const primarySubtotal = queuedLineItems.reduce((sum, item) => sum + item.price, 0);
                          const guestsSubtotal = includeGroupGuests
                            ? guestsList.reduce((acc, g) => acc + (g.isFree ? 0 : (g.services || []).reduce((sum, gs) => sum + (gs.isFree ? 0 : toMoney(gs.finalPrice)), 0)), 0)
                            : 0;
                          const subtotal = primarySubtotal + guestsSubtotal;
                          const vat = subtotal * 0.15;
                          const total = subtotal + vat;

                          return (
                            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                              <h4 className="font-black border-b pb-1.5 flex items-center justify-between text-slate-800">
                                <span>{isRtl ? 'ملخص الحساب الضريبي للفاتورة' : 'Invoice Statement'}</span>
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded uppercase">ZATCA QR</span>
                              </h4>
                              <div className="space-y-2 border-b pb-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-700">{isRtl ? 'خدمات الجلسة المحجوزة' : 'Queued Service Lines'}</span>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{queuedLineItems.length}</span>
                                </div>
                                {queuedLineItems.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-[11px] font-semibold text-amber-800">
                                    {isRtl
                                      ? 'لا توجد خدمات في قائمة الجلسة بعد. أضف خدمة واحدة على الأقل قبل متابعة الفاتورة.'
                                      : 'No services have been added to the session queue yet. Add at least one service before continuing.'}
                                  </div>
                                ) : (
                                  queuedLineItems.map((item) => (
                                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <p className="font-bold text-slate-800 truncate">{item.serviceName}</p>
                                          <p className="text-[10px] text-slate-400 truncate">
                                            {item.staffName || (isRtl ? 'غير محدد' : 'Unassigned')}
                                            {' · '}
                                            {formatMinutesToTime(item.startTime)} · {item.duration} {isRtl ? 'دقيقة' : 'min'}
                                          </p>
                                        </div>
                                        <span className="font-mono font-bold text-slate-700 whitespace-nowrap">
                                          {item.price.toFixed(2)} ر.س
                                        </span>
                                      </div>
                                    </div>
                                  ))
                                )}
                                {includeGroupGuests && (
                                  <div className="space-y-1 pl-2.5 border-l-2 border-amber-500/30 pr-2.5">
                                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">{isRtl ? 'تفصيل خدمات الضيوف:' : 'GROUP GUESTS BREAKDOWN'}</p>
                                    {guestsList.map((g, idx) => {
                                      const guestSub = (g.services || []).reduce((acc, gs) => acc + (g.isFree || gs.isFree ? 0 : toMoney(gs.finalPrice)), 0);
                                      return (
                                        <div key={g.id} className="space-y-0.5 text-[11px] border-b border-dashed border-slate-100 pb-1 mb-1">
                                          <div className="flex justify-between font-bold">
                                            <span>{g.name || `${isRtl ? 'مرافق' : 'Guest'} ${idx + 1}`}</span>
                                            <span className="font-mono">{g.isFree ? '0.00' : toMoney(guestSub).toFixed(2)} ر.س</span>
                                          </div>
                                          <div className="pl-2 text-[10px] text-slate-400">
                                            {(g.services || []).map(gs => (
                                              <div key={gs.id} className="flex justify-between">
                                                <span>- {gs.serviceName}</span>
                                                <span>{toMoney(gs.finalPrice).toFixed(2)} ر.س</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-between">
                                <span>{isRtl ? 'مجموع الخدمات' : 'Services Subtotal'}</span>
                                <span className="font-mono">{toMoney(subtotal).toFixed(2)} ر.س</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{isRtl ? 'الضريبة المضافة ZATCA (15%)' : 'Tax VAT (15%)'}</span>
                                <span className="font-mono">{toMoney(vat).toFixed(2)} ر.س</span>
                              </div>
                              <div className="flex justify-between font-black text-amber-600 text-sm border-t pt-1.5">
                                <span>{isRtl ? 'المبلغ المستحق النهائي' : 'Grand Total Due'}</span>
                                <span className="font-mono">{toMoney(total).toFixed(2)} ر.س</span>
                              </div>

                              {/* Dedicated Guest Group Summary Card in checkout step */}
                              {includeGroupGuests && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                                  <p className="font-black text-slate-700 flex items-center gap-1">
                                    <span>👥</span>
                                    <span>{isRtl ? 'ملخص بطاقات المرافقين للحجز' : 'Group Guests Summary Card'}</span>
                                  </p>
                                  <div className="space-y-2">
                                    {guestsList.map((g, i) => {
                                      const guestSub = (g.services || []).reduce((acc, gs) => acc + (g.isFree || gs.isFree ? 0 : gs.finalPrice), 0);
                                      return (
                                        <div key={g.id} className="bg-white p-2.5 border rounded-lg flex flex-col gap-1.5 text-[11px] leading-relaxed">
                                          <div className="flex items-start justify-between border-b pb-1 border-slate-100">
                                            <div>
                                              <p className="font-bold text-slate-800">#{i + 1}: {g.name}</p>
                                              {g.phone && <p className="text-slate-500 font-mono text-[9px]">{g.phone}</p>}
                                              {g.email && <p className="text-slate-500 font-mono text-[9px]">{g.email}</p>}
                                              {g.birthDate && <p className="text-slate-500 font-mono text-[9px]">🎂 {g.birthDate}</p>}
                                            </div>
                                            <span className="font-mono font-black text-slate-700">
                                              {g.isFree ? (isRtl ? 'مجاني 🎁' : 'Free 🎁') : `${guestSub} SAR`}
                                            </span>
                                          </div>
                                          <div className="space-y-1 pl-1 text-[10px] text-slate-600">
                                            {(g.services || []).map(gs => (
                                              <p key={gs.id}>• {gs.serviceName} ({gs.finalPrice} SAR)</p>
                                            ))}
                                          </div>
                                          {g.notes && <p className="text-amber-700 italic text-[9px] mt-0.5 bg-amber-50 px-1 py-0.5 rounded">📝 {g.notes}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="p-4 bg-white border rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{isRtl ? 'طريقة الدفع' : 'Payment allocation'}</span>
                            <button type="button" onClick={() => setCreateSplitActive(!createSplitActive)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${createSplitActive ? 'bg-amber-500 text-zinc-950' : 'bg-slate-100 text-slate-500'}`}>
                              {createSplitActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'تفعيل' : 'Activate')}
                            </button>
                          </div>
                          {createSplitActive && (
                            <div className="grid grid-cols-3 gap-2 animate-fadeIn">
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'بطاقة' : 'Card'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.card || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'نقداً' : 'Cash'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.cash || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'أونلاين' : 'Online'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.online || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, online: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'تحويل بنكي' : 'Bank Transfer'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.bank_transfer || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, bank_transfer: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'محفظة' : 'Wallet'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.wallet || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-500 block mb-0.5 font-bold">{isRtl ? 'بطاقة هدية' : 'Gift Card'}</label>
                                <input type="number" placeholder="0" value={createSplitAmounts.gift_card || ''} onChange={(e) => setCreateSplitAmounts(prev => ({ ...prev, gift_card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold text-xs" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-white border rounded-xl space-y-2">
                          <label className="text-slate-500 block">{isRtl ? 'ملاحظات الجلسة العامة للموظفة' : 'Staff comments'}</label>
                          <textarea rows={2} value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder={isRtl ? 'ضيافة قهوة عربية' : 'Hospitality request'} className="w-full bg-slate-50 border p-2 rounded-lg text-xs" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white border-t flex justify-between">
                    {createStep > 1 ? (
                      <button type="button" onClick={() => setCreateStep(prev => prev - 1)} className="py-2 px-4 bg-slate-100 rounded-xl text-xs font-bold">
                        {isRtl ? 'السابق' : 'Previous'}
                      </button>
                    ) : <div />}

                    {createStep < 4 ? (
                      <button 
                        type="button" 
                        onClick={() => {
                          if (createStep === 2 && includeGroupGuests) {
                            const emptyGuestName = guestsList.some(g => g.name.trim() === '');
                            if (emptyGuestName) {
                              addLocalToast(
                                'يرجى تعبئة أسماء جميع المرافقين أولاً للمتابعة.',
                                'Please fill out all guest names to continue.',
                                'warning'
                              );
                              return;
                            }
                          }
                          if (createStep === 3 && stagedServices.length === 0) {
                            addLocalToast(
                              'يرجى إدراج خدمة واحدة على الأقل للمتابعة إلى الفاتورة',
                              'Please add at least one service before continuing to the invoice step',
                              'warning'
                            );
                            return;
                          }
                          setCreateStep(prev => prev + 1);
                        }} 
                        className="py-2 px-5 bg-zinc-950 text-white rounded-xl text-xs font-bold"
                      >
                        {isRtl ? 'التالي' : 'Next Step'}
                      </button>
                    ) : (
                      <button type="button" onClick={handleConfirmAppointmentCreation} className="py-2 px-5 bg-amber-500 text-zinc-950 font-black rounded-xl text-xs shadow-md">
                        {isRtl ? 'تأكيد الحجز والجدولة 🗓️' : 'Schedule Booking 🗓️'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Blocked interval */
                <div className="flex-1 p-5 space-y-4 text-xs overflow-y-auto">
                  <div className="p-4 bg-white border rounded-xl space-y-3">
                    <label className="text-slate-500 block">{isRtl ? 'سبب حظر الفترة الزمنية' : 'Block interval sync reason'}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Break', 'Lunch', 'Meeting'].map(type => (
                        <button key={type} onClick={() => {
                          const presetType = type as 'Break' | 'Lunch' | 'Meeting';
                          setBlockType(presetType);
                          const presetTexts = getBlockPresetTexts(presetType);
                          setBlockTitleAr(presetTexts.titleAr);
                          setBlockTitleEn(presetTexts.titleEn);
                        }} className={`py-1.5 rounded-lg border font-bold ${blockType === type ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-slate-50 text-slate-500'}`}>
                          {type}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">عربي</label>
                        <input type="text" value={blockTitleAr} onChange={(e) => setBlockTitleAr(e.target.value)} className="w-full border p-1.5 rounded" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">English</label>
                        <input type="text" value={blockTitleEn} onChange={(e) => setBlockTitleEn(e.target.value)} className="w-full border p-1.5 rounded" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'أخصائية التجميل' : 'Stylist Column'}</label>
                        <select value={blockStaffId} onChange={(e) => setBlockStaffId(e.target.value)} className="w-full border p-1.5 rounded font-bold">
                                                    {availableStylists.map(st => (
                            <option key={st.id} value={st.id}>{isRtl ? st.nameAr : st.nameEn}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'المدة (دقائق)' : 'Block Duration'}</label>
                        <input type="number" step={15} value={blockDuration} onChange={(e) => setBlockDuration(parseInt(e.target.value) || 30)} className="w-full border p-1.5 rounded font-mono text-center font-bold" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'ساعة البدء' : 'Start time'}</label>
                      <input type="number" step={15} value={blockStartTime} onChange={(e) => setBlockStartTime(parseInt(e.target.value) || 0)} className="border p-1.5 rounded font-mono font-bold" />
                      <span className="text-[10px] font-mono text-slate-500 ml-2">{formatMinutesToTime(blockStartTime)}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button onClick={() => setIsCreateDrawerOpen(false)} className="py-2 px-4 bg-slate-100 rounded-lg text-slate-600 font-bold">
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    {isEditingBreak && (
                      <button onClick={handleBreakDelete} className="py-2 px-5 bg-rose-600 text-white font-bold rounded-lg shadow-sm">
                        {isRtl ? 'حذف الحظر' : 'Delete Block'}
                      </button>
                    )}
                    <button onClick={handleConfirmBlockSubmit} className="py-2 px-5 bg-zinc-900 text-white font-bold rounded-lg shadow-sm">
                      {isEditingBreak ? (isRtl ? 'حفظ التغييرات' : 'Save Changes') : (isRtl ? 'تأكيد الحظر' : 'Block Time')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. ADVANCED POS RETAIL CART & GIFT CARD DRAWER WITH VINTAGE RECEIPT PRINTER */}
      <AnimatePresence>
        {isCartDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsCartDrawerOpen(false)}
            />
            
            <motion.div 
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              className={`relative w-full max-w-4xl h-screen bg-slate-50 shadow-2xl flex flex-col z-10 overflow-hidden ${
                isRtl ? 'border-r border-slate-200' : 'border-l border-slate-200'
              }`}
            >
              {/* Header */}
              <div className="p-4 bg-amber-500 text-zinc-950 flex items-center justify-between border-b border-amber-600">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-zinc-950/10 rounded-lg text-zinc-950">
                      <ShoppingBag size={16} />
                    </span>
                    <h3 className="text-sm font-black tracking-tight uppercase">
                      {isRtl ? 'صندوق محاسبة المبيعات والبطاقات (POS)' : 'POS Retail & Gift Cards counter'}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="p-1 rounded bg-zinc-950/10 hover:bg-zinc-950/20 text-zinc-950 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Catalog portion */}
                <div className="w-7/12 border-e border-slate-200 flex flex-col bg-white overflow-hidden">
                  <div className="p-2.5 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button onClick={() => setCartTab('products')} className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${cartTab === 'products' ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600'}`}>
                        {isRtl ? 'مستحضرات التجميل 🧴' : 'Cosmetics 🧴'}
                      </button>
                      <button onClick={() => { setCartTab('giftcards'); handleRegenerateGiftCardCode(); }} className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${cartTab === 'giftcards' ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600'}`}>
                        {isRtl ? 'بطاقات الهدايا 🎁' : 'Gift Cards 🎁'}
                      </button>
                    </div>
                  </div>

                      <div className="flex-1 overflow-y-auto p-3">
                    {cartTab === 'products' ? (
                      <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                        {products.map(prod => (
                          <div key={prod.id} className="p-2.5 border rounded-lg flex flex-col justify-between h-36 bg-white hover:border-amber-400">
                            <div>
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] font-mono text-slate-400">{prod.sku}</span>
                                <span className={`text-[8px] font-bold px-1 rounded ${prod.stock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>{prod.stock} left</span>
                              </div>
                              <h4 className="text-[10px] font-bold text-slate-800 mt-1 line-clamp-2 leading-snug">{isRtl ? prod.nameAr : prod.nameEn}</h4>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t mt-1">
                              <span className="font-mono font-black text-slate-800 text-xs">{prod.price} SAR</span>
                              <button type="button" disabled={prod.stock === 0} onClick={() => handleAddProductToCart(prod)} className="bg-zinc-950 text-white text-[9px] py-1 px-2 rounded-md hover:bg-zinc-850">
                                Add +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-fadeIn text-xs">
                        <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
                          <div className="flex justify-between items-center border-b pb-1">
                            <span className="font-black text-slate-800">{isRtl ? 'بطاقات الهدايا النشطة' : 'Available Gift Cards'}</span>
                            <span className="text-[10px] font-mono font-bold text-amber-600">{giftCardPackages.length}</span>
                          </div>

                          {giftCardPackages.length > 0 ? (
                            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                              {giftCardPackages.map((giftCardPackage) => {
                                const displayTitle = giftCardPackage.title_ar || giftCardPackage.title_en || giftCardPackage.title || 'Gift Card';
                                return (
                                  <button
                                    key={giftCardPackage.id}
                                    type="button"
                                    onClick={() => handleAddGiftCardPackageToCart(giftCardPackage)}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-50/60"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-bold text-slate-800">{displayTitle}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-500">
                                          {isRtl ? 'رصيد' : 'Credit'} {Number(giftCardPackage.walletCreditAmount || 0).toFixed(2)} SAR
                                        </p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-[10px] font-bold text-amber-600">
                                          {Number(giftCardPackage.priceAmount || 0).toFixed(2)} SAR
                                        </p>
                                        <p className="text-[9px] text-slate-400">{isRtl ? 'اضغط للإضافة' : 'Tap to add'}</p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center text-[10px] text-slate-500">
                              {isRtl ? 'لا توجد بطاقات هدايا نشطة بعد.' : 'No active gift card packages yet.'}
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
                          <div className="flex justify-between items-center border-b pb-1">
                            <span className="font-black text-slate-800">{isRtl ? 'إصدار بطاقة هدايا جديدة' : 'Voucher Design'}</span>
                            <span className="text-[10px] font-mono font-bold text-amber-600">{generatedGcCode}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 mb-0.5 block">{isRtl ? 'المرسل' : 'From'}</label>
                              <input type="text" value={gcSender} onChange={(e) => setGcSender(e.target.value)} placeholder="Nora Al-Sudairi" className="w-full border bg-white p-1 text-xs rounded" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 mb-0.5 block">{isRtl ? 'المستلم' : 'To'}</label>
                              <input type="text" value={gcRecipient} onChange={(e) => setGcRecipient(e.target.value)} placeholder="Abeer Bin Laden" className="w-full border bg-white p-1 text-xs rounded" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Value Card Amount</label>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[150, 300, 500, 1000].map(v => (
                                <button key={v} onClick={() => setGcValue(v)} className={`py-1 rounded font-mono font-bold border text-[11px] ${gcValue === v ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white text-slate-600'}`}>{v} ر.س</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between pt-1">
                            <button type="button" onClick={handleRegenerateGiftCardCode} className="text-[9px] underline text-slate-500">Regenerate Serial</button>
                            <button type="button" onClick={handleAddGiftCardToCart} className="bg-zinc-950 text-white text-[10px] font-bold py-1.5 px-3 rounded-lg">+ Issue card</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cart sidebar portion */}
                <div className="w-5/12 bg-slate-50 flex flex-col justify-between h-full overflow-hidden border-s border-slate-200">
                  <div className="flex-1 p-3 flex flex-col overflow-hidden">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">{isRtl ? 'سلة المشتريات' : 'POS Checkout Items'}</span>
                    
                    <div className="flex-1 overflow-y-auto space-y-1.5 mb-3">
                      {cartItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                          <ShoppingBag size={20} className="mb-1 text-slate-300" />
                          <span>سلة المبيعات الرقمية فارغة</span>
                        </div>
                      ) : (
                        cartItems.map(item => (
                          <div key={item.id} className="p-2 bg-white rounded-lg border text-xs flex justify-between items-center animate-fadeIn shadow-3xs">
                            <div className="min-w-0 flex-1 pr-1">
                              <span className="text-[8px] font-mono bg-amber-50 text-amber-700 px-1 rounded block w-fit">{item.skuOrCode}</span>
                              <h5 className="font-bold truncate mt-0.5">{isRtl ? item.nameAr : item.nameEn}</h5>
                              <p className="text-[9px] text-slate-400">{item.price} SAR</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleUpdateCartItemQty(item.id, item.quantity - 1)} className="px-1 text-slate-500 hover:bg-slate-100 font-bold">-</button>
                              <span className="font-mono text-slate-800 px-1 font-bold text-[10px]">{item.quantity}</span>
                              <button disabled={item.type === 'giftcard'} onClick={() => handleUpdateCartItemQty(item.id, item.quantity + 1)} className="px-1 text-slate-500 hover:bg-slate-100 font-bold disabled:opacity-40">+</button>
                              <button onClick={() => handleUpdateCartItemQty(item.id, 0)} className="text-slate-300 hover:text-rose-500 ml-1"><Trash size={11} /></button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Customer Selection */}
                    <div className="p-2.5 bg-white border rounded-xl text-xs mb-2">
                      <div className="flex justify-between pb-1 border-b mb-1">
                        <span className="font-bold">{isRtl ? 'العميل المشتري' : 'POS Customer'}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setPosCustMode('walkin')} className={`px-1 py-0.25 rounded text-[9px] font-bold ${posCustMode === 'walkin' ? 'bg-zinc-950 text-white' : 'bg-slate-100 text-slate-500'}`}>Walk-in</button>
                          <button onClick={() => setPosCustMode('existing')} className={`px-1 py-0.25 rounded text-[9px] font-bold ${posCustMode === 'existing' ? 'bg-zinc-950 text-white' : 'bg-slate-100 text-slate-500'}`}>Registered</button>
                        </div>
                      </div>
                      {posCustMode === 'existing' && (
                        <select value={posSelectedCustId} onChange={(e) => setPosSelectedCustId(e.target.value)} className="w-full bg-slate-50 p-1 text-[11px] font-bold rounded">
                          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Cost Breakdown */}
                    {(() => {
                      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      const vat = subtotal * 0.15;
                      const total = subtotal + vat;
                      return (
                        <div className="p-3 bg-white border rounded-xl space-y-1.5 text-xs font-sans">
                          <div className="flex justify-between text-slate-500">
                            <span>{isRtl ? 'المجموع' : 'Subtotal'}</span>
                            <span className="font-mono font-semibold">{subtotal.toFixed(2)} SAR</span>
                          </div>
                          <div className="flex justify-between text-slate-500">
                            <span>ZATCA VAT (15%)</span>
                            <span className="font-mono font-semibold">{vat.toFixed(2)} SAR</span>
                          </div>
                          <div className="flex justify-between font-black text-slate-900 border-t pt-1 bg-amber-500/5 px-1 py-0.5 rounded text-xs">
                            <span>{isRtl ? 'الصافي النهائي المستحق' : 'Checkout Total'}</span>
                            <span className="font-mono text-amber-600 font-black">{total.toFixed(2)} SAR</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="p-3 bg-white border-t space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-slate-400">{isRtl ? 'بوابة التحصيل مدى' : 'Integrated Mada Gate'}</span>
                      <button onClick={() => setPosSplitActive(!posSplitActive)} className="text-[9px] underline text-slate-500">Split Cash/Card</button>
                    </div>

                    {posSplitActive && (
                      <div className="grid grid-cols-3 gap-1 animate-fadeIn text-[10px]">
                        <div>
                          <label className="text-slate-400 block text-center">Mada</label>
                          <input type="number" placeholder="0" value={posSplitAmounts.card || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                        </div>
                        <div>
                          <label className="text-slate-400 block text-center">Cash</label>
                          <input type="number" placeholder="0" value={posSplitAmounts.cash || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                        </div>
                        <div>
                          <label className="text-slate-400 block text-center">Wallet</label>
                          <input type="number" placeholder="0" value={posSplitAmounts.wallet || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                        </div>
                      </div>
                    )}

                    {posCheckoutComplete && !completedOrder ? (
                      <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500 text-emerald-800 font-black rounded-xl text-[10px] text-center">
                        {isRtl ? 'تم إتمام التحصيل بنجاح' : 'Checkout completed successfully'}
                      </div>
                    ) : null}

                    <button
                      onClick={handleProcessPosCheckout}
                      disabled={posCheckoutComplete || cartItems.length === 0}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-zinc-950 font-black rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Receipt size={13} className="text-zinc-950" />
                      <span>
                        {posCheckoutComplete
                          ? (isRtl ? 'تم التحصيل' : 'Checkout completed')
                          : (isRtl ? 'فوترة المشتريات وتأكيد استلام السداد' : 'Process Checkout & Generate Receipt')}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* PRINT RECEIPT OVERLAY PREVIEW */}
              {completedOrder && (
                <div className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-5 w-80 font-mono text-xs border space-y-3">
                    <div className="border-t-2 border-b-2 border-dashed border-slate-800 py-3 text-center space-y-1">
                      <span className="font-black text-sm tracking-widest block">REFAH CRM</span>
                      <p className="text-[9px] text-zinc-400">Simplified VAT Tax Invoice</p>
                      <p className="text-[8px] text-zinc-400">VAT Registration: 31092813100003</p>
                      <div className="h-px border-b border-dashed my-1" />
                      <div className="text-[9px] text-left space-y-0.5">
                        <p>INV ID: {completedOrder.orderId}</p>
                        <p>DATE: {completedOrder.date}</p>
                        <p>BUYER: {completedOrder.customerName}</p>
                      </div>
                      <div className="h-px border-b border-dashed my-1" />
                      <div className="space-y-1">
                        {completedOrder.items.map((it: any) => (
                          <div key={it.id} className="flex justify-between text-[10px]">
                            <span className="truncate flex-1 text-left">{it.nameEn}</span>
                            <span className="font-bold">{(it.price * it.quantity).toFixed(2)} SAR</span>
                          </div>
                        ))}
                      </div>
                      <div className="h-px border-b border-dashed my-1" />
                      <div className="space-y-0.5 text-[9px] text-left">
                        <div className="flex justify-between"><span>SUBTOTAL:</span><span>{completedOrder.subtotal.toFixed(2)} SAR</span></div>
                        <div className="flex justify-between"><span>VAT (15%):</span><span>{completedOrder.vat.toFixed(2)} SAR</span></div>
                        <div className="flex justify-between font-black text-black"><span>TOTAL NET:</span><span>{completedOrder.total.toFixed(2)} SAR</span></div>
                      </div>
                      <div className="h-px border-b border-dashed my-1.5" />
                      <p className="text-[8px] bg-zinc-900 text-white rounded p-0.5 font-bold">PAID IN FULL - CHECKOUT COMPLETED</p>
                      <p className="text-[8px] text-slate-400 italic">Gateways: {completedOrder.paymentSummary}</p>
                      <p className="text-[8px] text-slate-400 mt-2">شكراً لزيارتكم صالون رفاه الفاخر 🌸 Thank you</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { addLocalToast('تم محاكاة طباعة الإيصال الورقي الفوري بنجاح!', 'Simulated printed physical receipt successfully!', 'success'); setCompletedOrder(null); }} className="flex-1 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                        <Printer size={12} />
                        <span>Print</span>
                      </button>
                      <button onClick={() => { setCompletedOrder(null); setPosCheckoutComplete(true); }} className="py-1.5 px-3 bg-slate-100 rounded-lg text-xs font-bold">
                        Close
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
