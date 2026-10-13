import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { calculateNearestValidChain, calculateAllValidChains } from '../utils/bookingChains';
import { isAutoDerivedFromPreviousChain } from '../lib/chainedServiceTiming';
import { useAppointmentSubmission } from '../hooks/useAppointmentSubmission';
import { useSmartConflictResolver } from '../hooks/useSmartConflictResolver';
import { SmartConflictModal } from './appointment/SmartConflictModal';
import { SmartAvailabilityPicker } from './appointment/SmartAvailabilityPicker';
import {
  calculateSmartAvailability,
  findNextAvailableAlternative,
  applySmartSlotToStagedServices,
  type SmartSlot,
  type DayAvailabilitySummary,
  type NextAvailableAlternative,
  type StagedItemForAvailability
} from '../services/smartAvailabilityService';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Calendar, Loader2 as CalendarIcon, User, Users, PlusCircle, Check,
  Trash, ChevronLeft, Loader2, ChevronRight, Split, ShoppingBag, Receipt, Printer, Sparkles, AlertTriangle, Search, AlertCircle,
  ChevronDown, Clock, Layers, Package as PackageIcon, Settings2, RotateCcw
} from 'lucide-react';
import AppointmentServicesStep from './appointment/AppointmentServicesStep';
import { CustomerBookingHistory, type CustomerHistoricalSession } from './appointment/CustomerBookingHistory';
import {
  ResourceBadge,
  ResourceBadgeList,
  resolveEffectiveServiceRequirements,
  type ItemResourceAvailability
} from './appointment/ResourceBadge';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import {
  getServiceDisplayName,
  getServiceDisplayPrice,
  isParentServiceBookable,
  resolveServiceImageUrl,
  groupServicesByCategory,
  normalizeServiceRecord,
  resolveServiceOrBundleCategory,
  type ServiceRecord,
  type ServiceVariantRecord
} from '../lib/serviceContract';
import {
  isQueuedStandaloneServiceSelected,
  removeStandaloneQueuedService,
  removeBundleFromStagedServices,
  checkIsAppointmentDraftDirty,
  calculateGroupStagedPricing,
  type GroupPricingSummary
} from '../lib/bundleStagingHelpers';
import { to12HourTime, to24HourTime } from '../lib/employeeHelpers';
import {
  PRODUCT_CATEGORY_OPTIONS,
  resolveProductImageUrl,
  type ProductRecord
} from '../lib/productContract';
import {
  buildConflictCard,
  formatConflictTime,
  pickBestConflictDiagnostic,
  type AvailabilityDiagnostic,
  type ConflictCard
} from '../lib/bookingConflictDiagnostics';
import {
  buildTenantIsoFromMinutes,
  resolveTenantTimezone
, getDatePartsInTimeZone } from '../lib/tenantTime';
import { resolveBookingDuration } from '../lib/bookingDuration';
import {
  buildAdvanceBookingDialog,
  buildExtendedHoursBookingDialog,
  buildGenericBookingErrorDialog,
  buildSpecificConflictDialog,
  extractBookingErrorMeta,
  hasStructuredBookingDiagnostics,
  isBookingConflictError,
  isBookingTooSoonError,
  type BookingDialogCopy
} from '../lib/bookingUiDialogs';
import { buildEmptyAppointmentDraftSnapshot, isAppointmentDraftContent } from '../lib/appointmentDraftState';
import { resolveCompatibleStaffAssignments, type StaffAssignmentResolution } from '../lib/staffAssignmentEngine';

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

  const getRiyadhCurrentTimeLabel = (value = new Date()) => (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(value)
  );

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
  tenantId: string;
  tenantTimezone?: string;
  normalEndHour?: number;
  isCreateDrawerOpen: boolean;
  setIsCreateDrawerOpen: (open: boolean) => void;
  preserveBoardStartTime?: boolean;
  boardStartHour?: number;
  slotMinutes?: number;
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
  initialDuration?: number;
  initialCartTab?: 'products' | 'giftcards';
  selectedDate: Date;
  setSelectedDate?: (date: Date) => void;
  customers: any[];
  services: any[];
  servicePackages?: any[];
  services2Bundles?: any[];
  tenantCategories?: any[];
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

export interface GroupParticipant {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  isGuest?: boolean;
  customerId?: string;
}

interface StagedService {
  id: string;
  itemType?: "service" | "package";
  serviceId: string;
  variantId?: string;
  packageId?: string;
  packageItemId?: string;
  packageInstanceId?: string;
  sequenceOrder?: number;
  serviceCategory?: string;
  staffId: string;
  isExplicitStaff?: boolean;
  resolvedStaffId?: string;
  startTime: number;
  startTimeIso?: string;
  duration: number;
  discountType: 'none' | 'flat' | 'percent';
  discountValue: number;
  notes: string;
  basePrice?: number;
  finalPrice?: number;
  timingMode?: 'auto' | 'manual';
  overtimeApproval?: { approved: boolean };
  participantId?: string;
}

interface QueuedServiceEditDraft {
  serviceId: string;
  variantId: string;
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

const normalizeBlockPreset = (value?: string | null): 'Break' | 'Lunch' | 'Meeting' => {
  const normalized = `${value || ''}`.trim().toLowerCase();

  if (normalized === 'lunch') {
    return 'Lunch';
  }

  if (normalized === 'prayer' || normalized === 'meeting') {
    return 'Meeting';
  }

  return 'Break';
};

const mapBlockPresetToBackendType = (preset: 'Break' | 'Lunch' | 'Meeting') => {
  if (preset === 'Lunch') {
    return 'lunch';
  }

  // The backend supports `other` for generic blocked intervals.
  // `Break` and `Meeting` are UI presets only.
  return 'other';
};

const APPOINTMENT_DRAFT_STORAGE_KEY = 'refah.interactiveDrawers.appointmentDraft';
const CART_DRAFT_STORAGE_KEY = 'refah.interactiveDrawers.cartDraft';

type AppointmentDraftSnapshot = {
  createMode: 'appointment' | 'blocked';
  createStep: number;
  custMode: 'existing' | 'walkin';
  selectedCustId: string;
  customerSearch: string;
  walkinFullName: string;
  walkinPhone: string;
  walkinEmail: string;
  walkinDob: string;
  walkinIsVip: boolean;
  includeGroupGuests: boolean;
  guestCount: number;
  guestNames: string;
  guestsList: GuestProfile[];
  currentServiceId: string;
  currentStaffId: string;
  currentStartTime: number;
  currentDuration: number;
  currentDiscountType: 'none' | 'flat' | 'percent';
  currentDiscountValue: number;
  currentServiceNotes: string;
  stagedServices: StagedService[];
  sessionNotes: string;
  notifyWhatsApp: boolean;
  createSplitActive: boolean;
  createSplitAmounts: { card: number; cash: number; online: number; bank_transfer: number; wallet: number; gift_card: number };
  giftCardCodeInput: string;
  blockTitleAr: string;
  blockTitleEn: string;
  blockStaffId: string;
  blockStartTime: number;
  blockDuration: number;
  blockType: 'Break' | 'Lunch' | 'Meeting';
  blockIsRecurring: boolean;
  blockEndDate: string;
};

type CartDraftSnapshot = {
  cartTab: 'products' | 'giftcards';
  productSearch: string;
  productCategoryFilter: string;
  cartItems: CartItem[];
  gcSender: string;
  gcRecipient: string;
  gcValue: number;
  generatedGcCode: string;
  posCustMode: 'walkin' | 'existing';
  posSelectedCustId: string;
  posCustomerSearch: string;
  posSplitActive: boolean;
  posSplitAmounts: { card: number; cash: number; wallet: number };
  posWalkinName: string;
  posWalkinEmail: string;
  posWalkinPhone: string;
  showWalkinModal: boolean;
};

const readDraftStorage = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeDraftStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore sessionStorage quota / serialization issues.
  }
};

const removeDraftStorage = (key: string) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures.
  }
};

export default function InteractiveDrawers({
  isRtl,
  tenantId,
  normalEndHour,
  isCreateDrawerOpen,
  setIsCreateDrawerOpen,
  preserveBoardStartTime = false,
  boardStartHour = 9,
  slotMinutes = 5,
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
  initialDuration,
  initialCartTab,
  selectedDate,
  setSelectedDate,
  customers,
  services,
  servicePackages = [],
  services2Bundles = [],
  tenantCategories = [],
  products,
  giftCardPackages = [],
  stylists,
  onBoardChanged,
  existingBreak,
  tenantTimezone
}: InteractiveDrawersProps) {
  const resolvedTenantTimezone = useMemo(() => resolveTenantTimezone(tenantTimezone), [tenantTimezone]);

  // Create Modal Step
  const [createMode, setCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [createStep, setCreateStep] = useState<number>(1);
  const [showAssignWarning, setShowAssignWarning] = useState(false);

  // Sync initial parameters when drawer opens
  useEffect(() => {
    if (isCreateDrawerOpen && initialCreateMode) {
      setCreateMode(initialCreateMode);
    }
  }, [isCreateDrawerOpen, initialCreateMode]);

  // setCurrentDuration is obsolete as duration is now handled directly by the service configuration component

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
      const normalizedType = normalizeBlockPreset(existingBreak.blockedType || existingBreak.type || 'Break');
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
    if (!isCreateDrawerOpen || createMode !== 'blocked' || existingBreak?.id) {
      return;
    }

    setBlockStartTime((prev) => (prev === currentStartTime ? prev : currentStartTime));
  }, [isCreateDrawerOpen, createMode, existingBreak?.id, currentStartTime]);

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
  const [custMode, setCustMode] = useState<'existing' | 'walkin'>('existing');
  const [selectedCustId, setSelectedCustId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [walkinFullName, setWalkinFullName] = useState('');
  const [walkinPhone, setWalkinPhone] = useState('');
  const [walkinEmail, setWalkinEmail] = useState('');
  const [walkinDob, setWalkinDob] = useState('');
  const [walkinIsVip, setWalkinIsVip] = useState(false);
  const [includeGroupGuests, setIncludeGroupGuests] = useState(false);
  const [guestCount, setGuestCount] = useState<number>(1);
  const [guestNames, setGuestNames] = useState('');
  const [identityValidationError, setIdentityValidationError] = useState(false);
  const registeredCustomerSearchRef = useRef<HTMLInputElement>(null);
  const walkinNameRef = useRef<HTMLInputElement>(null);

  // Group Booking State (Phase 5A)
  const [bookingScope, setBookingScope] = useState<'single' | 'group'>('single');
  const [groupName, setGroupName] = useState<string>('');
  const [groupPaymentArrangement, setGroupPaymentArrangement] = useState<'organizer_pays' | 'individual_pays'>('organizer_pays');
  const [groupParticipants, setGroupParticipants] = useState<GroupParticipant[]>([
    { id: 'part-1', name: '', phone: '', email: '', isGuest: true }
  ]);
  const [activeParticipantId, setActiveParticipantId] = useState<string>('part-1');

  // Appointment service staging state
  const [currentServiceId, setCurrentServiceId] = useState('');
  const [currentDuration, setCurrentDuration] = useState<number>(60);
  const [currentDiscountType, setCurrentDiscountType] = useState<'none' | 'flat' | 'percent'>('none');
  const [currentDiscountValue, setCurrentDiscountValue] = useState<number>(0);
  const [currentServiceNotes, setCurrentServiceNotes] = useState('');

  // Rebooking resolution state
  const [rebookPrompt, setRebookPrompt] = useState<{
    isOpen: boolean;
    session: any;
    unavailableItems: Array<{ name: string; variantName?: string; reason: string }>;
    availableItems: Array<{
      service: ServiceRecord;
      variant?: ServiceVariantRecord | null;
      prevStaffId?: string;
      duration: number;
      basePrice: number;
      sequenceOrder?: number;
    }>;
    matchedPkgId?: string | null;
    hasExistingDraftConflict?: boolean;
  } | null>(null);

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
      if (custMode === 'walkin') {
        walkinNameRef.current?.focus();
      } else {
        registeredCustomerSearchRef.current?.focus();
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

        let nextStaffId = resolvedStaff?.id || primaryStaff?.id || '';
        if (nextService) {
          const normalizedAssignments = (nextService.employeeAssignments || []).map((id: any) => String(id));
          if (normalizedAssignments.length > 0 && !normalizedAssignments.includes(String(nextStaffId))) {
            const validStylists = availableStylists.filter(s => normalizedAssignments.includes(String(s.id)));
            nextStaffId = validStylists[0]?.id || availableStylists[0]?.id || '';
          }
        }

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
        let defaultStaffId = availableStylists[0]?.id || '';
        if (catalogService) {
          const normalizedAssignments = (catalogService.employeeAssignments || []).map((id: any) => String(id));
          if (normalizedAssignments.length > 0) {
            const validStylists = availableStylists.filter(s => normalizedAssignments.includes(String(s.id)));
            defaultStaffId = validStylists[0]?.id || defaultStaffId;
          }
        }

        const newService: GuestService = {
          id: `gs-${Date.now()}-${guestServices.length}`,
          serviceId: catalogService?.id || '',
          serviceName: isRtl ? (catalogService?.nameAr || '') : (catalogService?.nameEn || ''),
          category: catalogService?.categoryEn || catalogService?.categoryAr || '',
          duration: catalogService?.duration || 0,
          staffId: defaultStaffId,
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
  const [currentServiceCategory, setCurrentServiceCategory] = useState<string>('all');
  const [serviceSearch, setServiceSearch] = useState<string>('');
  const [stagedServices, setStagedServices] = useState<StagedService[]>([]);
  const [mobileDrawerTab, setMobileDrawerTab] = useState<'booking' | 'catalogue'>('catalogue');
  const [isOptionsExpanded, setIsOptionsExpanded] = useState(false);
  const [expandedVariantServiceIds, setExpandedVariantServiceIds] = useState<Record<string, boolean>>({});
  const [configuredServiceId, setConfiguredServiceId] = useState<string | null>(null);

  const toggleVariants = (serviceId: string) => {
    setExpandedVariantServiceIds(prev => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  // Participant management helpers (Phase 5A)
  const handleAddGroupParticipant = () => {
    const nextIndex = groupParticipants.length + 1;
    const newId = `part-${Date.now()}-${nextIndex}`;
    const newParticipant: GroupParticipant = {
      id: newId,
      name: `${isRtl ? 'مشارك' : 'Participant'} ${nextIndex}`,
      phone: '',
      email: '',
      isGuest: true
    };
    setGroupParticipants(prev => [...prev, newParticipant]);
    setActiveParticipantId(newId);
  };

  const handleRemoveGroupParticipant = (partId: string) => {
    if (groupParticipants.length <= 1) return;
    if (partId === groupParticipants[0].id) return;
    setGroupParticipants(prev => prev.filter(p => p.id !== partId));
    setStagedServices(prev => prev.filter(s => s.participantId !== partId));
    if (activeParticipantId === partId) {
      setActiveParticipantId(groupParticipants[0].id);
    }
  };

  const handleUpdateGroupParticipant = (partId: string, fields: Partial<GroupParticipant>) => {
    setGroupParticipants(prev => prev.map(p => p.id === partId ? { ...p, ...fields } : p));
  };

  // Canonical Identity Validation and Messages
  const IDENTITY_PREREQUISITE_MESSAGE = useMemo(() => ({
    ar: 'اختر عميلاً أو حدّد خيار الزيارة بدون موعد للمتابعة.',
    en: 'Select a customer or choose Walk-in to continue.'
  }), []);

  const hasAppointmentIdentity = (mode: 'existing' | 'walkin', custId: string): boolean => {
    if (mode === 'walkin') return true;
    if (mode === 'existing') return Boolean(custId && custId.trim().length > 0);
    return false;
  };

  // Clear validation error when identity becomes satisfied
  useEffect(() => {
    if (hasAppointmentIdentity(custMode, selectedCustId)) {
      setIdentityValidationError(false);
    }
  }, [custMode, selectedCustId]);

  // Centralized guard check for advancing workflow steps
  const canAdvanceToStep = (targetStep: number): { allowed: boolean; reason?: { ar: string; en: string } } => {
    // Advancing beyond Step 1 (to Services or Invoice) strictly requires Identity
    if (targetStep >= 2) {
      if (!hasAppointmentIdentity(custMode, selectedCustId)) {
        return {
          allowed: false,
          reason: IDENTITY_PREREQUISITE_MESSAGE
        };
      }
    }

    // Advancing to Step 3 (Invoice) strictly requires at least one service
    if (targetStep >= 3) {
      if (stagedServices.length === 0) {
        return {
          allowed: false,
          reason: {
            ar: 'يرجى إدراج خدمة واحدة على الأقل للمتابعة إلى الفاتورة',
            en: 'Please add at least one service before opening the invoice step'
          }
        };
      }
    }

    return { allowed: true };
  };

  // Safe guarded step setter
  const safeSetCreateStep = (targetStepOrUpdater: number | ((prev: number) => number)) => {
    setCreateStep((current) => {
      const next = typeof targetStepOrUpdater === 'function' ? targetStepOrUpdater(current) : targetStepOrUpdater;

      // Moving backward is always permitted
      if (next <= current) {
        return Math.max(1, next);
      }

      // Moving forward requires prerequisite verification
      const guard = canAdvanceToStep(next);
      if (!guard.allowed) {
        if (current === 1 && !hasAppointmentIdentity(custMode, selectedCustId)) {
          setIdentityValidationError(true);
        }
        if (guard.reason) {
          addLocalToast(guard.reason.ar, guard.reason.en, 'warning');
        }
        return current; // Stay in current valid step
      }

      return next;
    });
  };

  // Defensive guard: if identity prerequisite becomes invalid while on higher steps, snap back to Step 1
  useEffect(() => {
    if (isCreateDrawerOpen && createMode === 'appointment' && createStep >= 2) {
      if (!hasAppointmentIdentity(custMode, selectedCustId)) {
        setCreateStep(1);
        setIdentityValidationError(true);
      }
    }
  }, [isCreateDrawerOpen, createMode, createStep, custMode, selectedCustId]);

  // Reset step to 1 whenever create drawer closes
  useEffect(() => {
    if (!isCreateDrawerOpen) {
      setCreateStep(1);
      setIdentityValidationError(false);
    }
  }, [isCreateDrawerOpen]);

  const { executeFinalSubmission: sharedExecuteSubmission, isSubmitting } = useAppointmentSubmission();
  const executeFinalSubmissionRef = useRef<((items: any[]) => Promise<void>) | null>(null);

  const {
    conflictDialog,
    setConflictDialog,
    conflictView,
    setConflictView,
    bookingRecoveryMode,
    setBookingRecoveryMode,
    preflightMultiServiceChain,
    preflightSeparateServices,
    acceptSuggestedChain,
    selectAlternativeDate,
    closeDialog
  } = useSmartConflictResolver({
    tenantId,
    isRtl,
    stylists,
    onSubmitValidatedItems: async (itemsToSubmit) => {
       if (executeFinalSubmissionRef.current) {
         await executeFinalSubmissionRef.current(itemsToSubmit);
       }
    },
    onRevalidationFailed: () => {}
  });

  const [bookingErrorDialog, setBookingErrorDialog] = useState<BookingDialogCopy | null>(null);
  const [bookingHoursDecisionDialog, setBookingHoursDecisionDialog] = useState<(BookingDialogCopy & {
    extensionMinutes: number;
    onChooseAnotherDay: () => void;
    onExtendHours: () => void;
    onCancel: () => void;
  }) | null>(null);
  const START_HOUR = 9;

  const [expandedServiceIds, setExpandedServiceIds] = useState<Record<string, boolean>>({});

  // Phase 3: Smart Availability & Conflict Recovery State
  const [isFindingAvailableTimes, setIsFindingAvailableTimes] = useState(false);
  const [smartAvailabilityDate, setSmartAvailabilityDate] = useState<Date>(selectedDate);
  const [isCheckingAllProfessionals, setIsCheckingAllProfessionals] = useState(false);
  const [smartAvailabilityLoading, setSmartAvailabilityLoading] = useState(false);
  const [smartAvailabilitySummary, setSmartAvailabilitySummary] = useState<DayAvailabilitySummary | null>(null);
  const [nextAvailableAlternative, setNextAvailableAlternative] = useState<NextAvailableAlternative | null>(null);
  const [isSearchingNextDate, setIsSearchingNextDate] = useState(false);

  useEffect(() => {
    setSmartAvailabilityDate(selectedDate);
  }, [selectedDate]);

  const canonicalServices = useMemo<ServiceRecord[]>(() => services.map((service) => ({
    ...normalizeServiceRecord(service),
    tenantServiceCategoryId: service.tenantServiceCategoryId || (service as any).tenant_service_category_id || null
  })), [services]);
  const serviceCategories = useMemo(() => groupServicesByCategory(canonicalServices), [canonicalServices]);
  const effectiveBundles = useMemo(() => {
    if (services2Bundles && services2Bundles.length > 0) {
      return services2Bundles;
    }
    return servicePackages || [];
  }, [services2Bundles, servicePackages]);

  const serviceCategoryTabs = useMemo(() => {
    const tabs = [
      { key: 'all', labelAr: 'الكل', labelEn: 'All' }
    ];

    (tenantCategories || []).forEach(cat => {
      tabs.push({
        key: cat.id,
        labelAr: cat.name_ar || cat.nameAr || cat.name_en || 'فئة',
        labelEn: cat.name_en || cat.nameEn || cat.name_ar || 'Category'
      });
    });

    const hasUncategorizedServices = canonicalServices.some(s => !resolveServiceOrBundleCategory(s, tenantCategories));
    const hasUncategorizedBundles = effectiveBundles.some(b => !resolveServiceOrBundleCategory(b, tenantCategories));
    if (hasUncategorizedServices || hasUncategorizedBundles) {
      tabs.push({
        key: 'uncategorized',
        labelAr: 'غير مصنف',
        labelEn: 'Uncategorized'
      });
    }

    return tabs;
  }, [tenantCategories, canonicalServices, effectiveBundles]);

  const categorySections = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();

    const matchesQuery = (nameAr?: string, nameEn?: string, descAr?: string, descEn?: string) => {
      if (!query) return true;
      return [nameAr, nameEn, descAr, descEn].some(val => `${val || ''}`.toLowerCase().includes(query));
    };

    const sections: Array<{
      id: string;
      labelAr: string;
      labelEn: string;
      services: ServiceRecord[];
      bundles: any[];
    }> = [];

    (tenantCategories || []).forEach(cat => {
      if (currentServiceCategory !== 'all' && currentServiceCategory !== cat.id) return;

      const catServices = canonicalServices.filter(s => {
        const resolved = resolveServiceOrBundleCategory(s, tenantCategories);
        const matchesCategory = resolved ? (resolved.id === cat.id || (resolved.slug && resolved.slug === cat.slug)) : false;
        if (!matchesCategory) return false;
        return matchesQuery(s.nameAr, s.nameEn, s.descriptionAr, s.descriptionEn);
      });

      const catBundles = effectiveBundles.filter(b => {
        const resolved = resolveServiceOrBundleCategory(b, tenantCategories);
        const matchesCategory = resolved ? (resolved.id === cat.id || (resolved.slug && resolved.slug === cat.slug)) : false;
        if (!matchesCategory) return false;
        return matchesQuery(b.name_ar || b.nameAr, b.name_en || b.nameEn, b.description_ar || b.descriptionAr, b.description_en || b.descriptionEn);
      });

      if (catServices.length > 0 || catBundles.length > 0) {
        sections.push({
          id: cat.id,
          labelAr: cat.name_ar || cat.nameAr || cat.name_en || 'فئة',
          labelEn: cat.name_en || cat.nameEn || cat.name_ar || 'Category',
          services: catServices,
          bundles: catBundles
        });
      }
    });

    if (currentServiceCategory === 'all' || currentServiceCategory === 'uncategorized') {
      const uncatServices = canonicalServices.filter(s => {
        const resolved = resolveServiceOrBundleCategory(s, tenantCategories);
        if (resolved) return false;
        return matchesQuery(s.nameAr, s.nameEn, s.descriptionAr, s.descriptionEn);
      });

      const uncatBundles = effectiveBundles.filter(b => {
        const resolved = resolveServiceOrBundleCategory(b, tenantCategories);
        if (resolved) return false;
        return matchesQuery(b.name_ar || b.nameAr, b.name_en || b.nameEn, b.description_ar || b.descriptionAr, b.description_en || b.descriptionEn);
      });

      if (uncatServices.length > 0 || uncatBundles.length > 0) {
        sections.push({
          id: 'uncategorized',
          labelAr: 'غير مصنف',
          labelEn: 'Uncategorized',
          services: uncatServices,
          bundles: uncatBundles
        });
      }
    }

    return sections;
  }, [canonicalServices, effectiveBundles, tenantCategories, currentServiceCategory, serviceSearch]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, uncategorized: 0 };
    (tenantCategories || []).forEach(cat => {
      counts[cat.id] = 0;
    });

    canonicalServices.forEach(s => {
      counts.all = (counts.all || 0) + 1;
      const cat = resolveServiceOrBundleCategory(s, tenantCategories);
      if (cat && cat.id && counts[cat.id] !== undefined) {
        counts[cat.id] = (counts[cat.id] || 0) + 1;
      } else {
        counts.uncategorized = (counts.uncategorized || 0) + 1;
      }
    });

    effectiveBundles.forEach(b => {
      counts.all = (counts.all || 0) + 1;
      const cat = resolveServiceOrBundleCategory(b, tenantCategories);
      if (cat && cat.id && counts[cat.id] !== undefined) {
        counts[cat.id] = (counts[cat.id] || 0) + 1;
      } else {
        counts.uncategorized = (counts.uncategorized || 0) + 1;
      }
    });

    return counts;
  }, [canonicalServices, effectiveBundles, tenantCategories]);

  const appointmentInvoiceSummary = useMemo(() => {
    const standaloneCartItems = stagedServices.filter(s => s.itemType !== 'package').map((item, index) => {
      const srv = canonicalServices.find((service) => service.id === item.serviceId);
      const variant = srv?.variants.find((entry) => entry.id === item.variantId) || srv?.variants[0] || null;
      const staff = availableStylists.find((stylist) => stylist.id === item.staffId);
      const basePrice = variant ? toMoney(variant.finalPrice ?? variant.price) : (srv ? toMoney(srv.price) : 0);
      let finalPrice = basePrice;
      if (item.discountType === 'flat') {
        finalPrice = Math.max(0, basePrice - (item.discountValue || 0));
      } else if (item.discountType === 'percent') {
        finalPrice = Math.max(0, basePrice - (basePrice * (item.discountValue || 0)) / 100);
      }

      const resolvedDuration = resolveBookingDuration(item.duration, variant?.duration, srv?.duration);

      return {
        id: item.id,
        index,
        itemType: 'service' as const,
        serviceId: item.serviceId,
        variantId: item.variantId,
        serviceName: srv ? `${isRtl ? srv.nameAr : srv.nameEn}${variant ? ` / ${isRtl ? (variant.name_ar || variant.nameAr || variant.name_en || variant.nameEn) : (variant.name_en || variant.nameEn || variant.name_ar || variant.nameAr)}` : ''}` : item.serviceId,
        staffId: item.staffId,
        staffName: isRtl ? staff?.nameAr : staff?.nameEn,
        duration: resolvedDuration,
        startTime: item.startTime,
        price: finalPrice,
        basePrice,
        hasDiscount: item.discountType !== 'none' && (item.discountValue || 0) > 0,
        discountType: item.discountType,
        discountValue: item.discountValue,
        notes: item.notes
      };
    });

    const pkgCartItems = stagedServices.filter(s => s.itemType === 'package');
    const pkgGroups = pkgCartItems.reduce((acc, curr) => {
      const groupKey = curr.packageInstanceId || curr.packageId!;
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(curr);
      return acc;
    }, {} as Record<string, typeof stagedServices>);

    const packageCartItems = Object.entries(pkgGroups).map(([instanceId, items]: [string, any[]]) => {
      const pkgId = items[0].packageId;
      const pkg = services2Bundles?.find(p => p.id === pkgId) || servicePackages?.find(p => p.id === pkgId);
      const packagePrice = Number(pkg?.totalPrice ?? 0);
      const isParallel = pkg?.scheduleType === 'parallel';
      const duration = isParallel
        ? Math.max(...items.map(it => Number(it.duration || 0)))
        : (pkg?.totalDuration || items.reduce((sum, it) => sum + Number(it.duration || 0), 0));
      return {
        id: instanceId,
        itemType: 'package' as const,
        packageId: pkgId,
        serviceName: pkg ? (isRtl ? pkg.name_ar || pkg.nameAr : pkg.name_en || pkg.nameEn) : 'Package',
        staffName: items.length + (isRtl ? (isParallel ? ' خدمات متزامنة' : ' خدمات') : (isParallel ? ' parallel services' : ' services')),
        duration,
        startTime: items[0]?.startTime || 0,
        price: packagePrice,
        basePrice: packagePrice,
        hasDiscount: false,
        isParallel,
        childItems: items
      };
    });

    const queuedLineItems = [...packageCartItems, ...standaloneCartItems];
    const subtotal = queuedLineItems.reduce((sum, item) => sum + item.price, 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;

    return {
      standaloneCartItems,
      packageCartItems,
      queuedLineItems,
      subtotal,
      vat,
      total
    };
  }, [stagedServices, canonicalServices, availableStylists, isRtl, services2Bundles, servicePackages]);

  // Group Financial Summary (Phase 5A)
  const groupFinancialSummary = useMemo(() => {
    if (bookingScope !== 'group') return null;
    return calculateGroupStagedPricing(
      groupParticipants.map((p, idx) => ({
        id: p.id,
        name: p.name || (idx === 0 ? (isRtl ? 'المنظم' : 'Organizer') : `${isRtl ? 'مشارك' : 'Participant'} ${idx + 1}`),
        phone: p.phone,
        email: p.email,
        isOrganizer: idx === 0
      })),
      stagedServices,
      services2Bundles || servicePackages || []
    );
  }, [bookingScope, groupParticipants, stagedServices, services2Bundles, servicePackages, isRtl]);

  const activeParticipantName = useMemo(() => {
    const p = groupParticipants.find(part => part.id === activeParticipantId) || groupParticipants[0];
    const idx = groupParticipants.findIndex(part => part.id === activeParticipantId);
    return idx === 0
      ? (p?.name ? `${p.name} (${isRtl ? 'المنظم' : 'Organizer'})` : (isRtl ? 'المنظم' : 'Organizer'))
      : (p?.name || `${isRtl ? 'مشارك' : 'Participant'} ${idx + 1}`);
  }, [groupParticipants, activeParticipantId, isRtl]);

  const activeParticipantItemsCount = useMemo(() => {
    if (bookingScope !== 'group') return stagedServices.length;
    return stagedServices.filter(s => (s.participantId || groupParticipants[0]?.id) === activeParticipantId).length;
  }, [bookingScope, stagedServices, groupParticipants, activeParticipantId]);

  const displayedPackageCartItems = useMemo(() => {
    if (bookingScope !== 'group') return appointmentInvoiceSummary.packageCartItems;
    return appointmentInvoiceSummary.packageCartItems.filter(pkgItem => {
      return pkgItem.childItems?.some(c => (c.participantId || groupParticipants[0]?.id) === activeParticipantId);
    });
  }, [bookingScope, appointmentInvoiceSummary.packageCartItems, groupParticipants, activeParticipantId]);

  const displayedStandaloneCartItems = useMemo(() => {
    if (bookingScope !== 'group') return appointmentInvoiceSummary.standaloneCartItems;
    return appointmentInvoiceSummary.standaloneCartItems.filter(item => {
      const raw = stagedServices.find(s => s.id === item.id);
      return (raw?.participantId || groupParticipants[0]?.id) === activeParticipantId;
    });
  }, [bookingScope, appointmentInvoiceSummary.standaloneCartItems, stagedServices, groupParticipants, activeParticipantId]);

  useEffect(() => {
    if (createStep === 3 && stagedServices.length === 0) {
      setCreateStep(2);
    }
  }, [createStep, stagedServices.length]);

  useEffect(() => {
    if (!isCreateDrawerOpen) {
      setBookingRecoveryMode('chain');
    }
  }, [isCreateDrawerOpen]);



  useEffect(() => {
    if (selectedCustId && !customers.some((customer) => customer.id === selectedCustId)) {
      setSelectedCustId('');
    }
  }, [customers, selectedCustId]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    const sortedCustomers = [...customers].sort((left, right) => {
      const leftName = `${left?.name || ''}`.trim().toLowerCase();
      const rightName = `${right?.name || ''}`.trim().toLowerCase();
      return leftName.localeCompare(rightName);
    });

    if (!query) {
      return sortedCustomers;
    }

    return sortedCustomers.filter((customer) => {
      const name = `${customer?.name || ''}`.toLowerCase();
      const phone = `${customer?.phone || ''}`.toLowerCase();
      const email = `${customer?.email || ''}`.toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [customers, customerSearch]);

  const selectedRegisteredCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustId) || null,
    [customers, selectedCustId]
  );

  // Synchronize Organizer (Participant 1) with primary client info
  useEffect(() => {
    if (groupParticipants.length === 0) return;
    const primaryName = custMode === 'existing'
      ? (selectedRegisteredCustomer?.name || '')
      : (walkinFullName || '');
    const primaryPhone = custMode === 'existing'
      ? (selectedRegisteredCustomer?.phone || '')
      : (walkinPhone || '');
    const primaryEmail = custMode === 'existing'
      ? (selectedRegisteredCustomer?.email || '')
      : (walkinEmail || '');
    const primaryCustomerId = custMode === 'existing' ? selectedCustId : undefined;
    const primaryIsGuest = custMode === 'walkin';

    setGroupParticipants(prev => {
      if (prev.length === 0) return prev;
      const first = prev[0];
      if (
        first.name === primaryName &&
        first.phone === primaryPhone &&
        first.email === primaryEmail &&
        first.customerId === primaryCustomerId &&
        first.isGuest === primaryIsGuest
      ) {
        return prev;
      }
      return [
        {
          ...first,
          name: primaryName || first.name,
          phone: primaryPhone,
          email: primaryEmail,
          customerId: primaryCustomerId,
          isGuest: primaryIsGuest
        },
        ...prev.slice(1)
      ];
    });
  }, [custMode, selectedRegisteredCustomer, selectedCustId, walkinFullName, walkinPhone, walkinEmail]);

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
  const [blockIsRecurring, setBlockIsRecurring] = useState<boolean>(false);
  const [blockEndDate, setBlockEndDate] = useState<string>('');
  const isEditingBreak = Boolean(existingBreak?.id);
  const loadedBreakIdRef = useRef<string | null>(null);

  // POS CART & GIFT CARDS
  const [cartTab, setCartTab] = useState<'products' | 'giftcards'>('products');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [gcSender, setGcSender] = useState('');
  const [gcRecipient, setGcRecipient] = useState('');
  const [gcValue, setGcValue] = useState<number>(500);
  const [generatedGcCode, setGeneratedGcCode] = useState(() => `REF-GFT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  const [posCustMode, setPosCustMode] = useState<'walkin' | 'existing'>('walkin');
  const [posSelectedCustId, setPosSelectedCustId] = useState('');
  const [posCustomerSearch, setPosCustomerSearch] = useState('');
  const [posSplitActive, setPosSplitActive] = useState(false);
  const [posSplitAmounts, setPosSplitAmounts] = useState({ card: 0, cash: 0, wallet: 0 });
  const [posWalkinName, setPosWalkinName] = useState('');
  const [posWalkinEmail, setPosWalkinEmail] = useState('');
  const [posWalkinPhone, setPosWalkinPhone] = useState('');
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [appointmentDraftPending, setAppointmentDraftPending] = useState<boolean>(() => Boolean(readDraftStorage<AppointmentDraftSnapshot>(APPOINTMENT_DRAFT_STORAGE_KEY)));
  const [cartDraftPending, setCartDraftPending] = useState<boolean>(() => Boolean(readDraftStorage<CartDraftSnapshot>(CART_DRAFT_STORAGE_KEY)));
  const [showAppointmentDraftPrompt, setShowAppointmentDraftPrompt] = useState(false);
  const [showDiscardConfirmDialog, setShowDiscardConfirmDialog] = useState(false);
  const [showCartDraftPrompt, setShowCartDraftPrompt] = useState(false);
  const suppressAppointmentDraftPersistenceRef = useRef(false);
  const previousCreateDrawerOpenRef = useRef(isCreateDrawerOpen);
  const previousCartDrawerOpenRef = useRef(isCartDrawerOpen);

  const canonicalProducts = useMemo<ProductRecord[]>(() => {
    return products.map((product: any) => ({
      ...product,
      imageUrl: resolveProductImageUrl(product.imageUrl || product.primaryImage || product.image || product.images?.[0]),
      primaryImage: resolveProductImageUrl(product.primaryImage || product.image || product.images?.[0]),
      images: Array.isArray(product.images) ? product.images.map((img: any) => resolveProductImageUrl(img)).filter(Boolean) : []
    }));
  }, [products]);

  const productCategoryOptions = useMemo(() => {
    const categories = new Map<string, { id: string; labelAr: string; labelEn: string }>();
    canonicalProducts.forEach((product) => {
      const category = `${product.category || product.categoryEn || product.categoryAr || ''}`.trim();
      if (!category || categories.has(category.toLowerCase())) {
        return;
      }

      const match = PRODUCT_CATEGORY_OPTIONS.find((option) => {
        return [option.id, option.slug, option.labelEn, option.labelAr]
          .some((candidate) => `${candidate}`.toLowerCase() === category.toLowerCase());
      });

      const entry = match
        ? { id: match.id, labelAr: match.labelAr, labelEn: match.labelEn }
        : { id: category, labelAr: product.categoryAr || category, labelEn: product.categoryEn || category };

      categories.set(category.toLowerCase(), entry);
    });

    return [
      { id: 'all', labelAr: 'جميع المنتجات', labelEn: 'All Products' },
      ...Array.from(categories.values())
    ];
  }, [canonicalProducts]);

  const filteredProductCards = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return canonicalProducts.filter((product) => {
      const category = `${product.category || product.categoryEn || product.categoryAr || ''}`.trim();
      const matchesCategory = productCategoryFilter === 'all' || category.toLowerCase() === productCategoryFilter.toLowerCase();
      const matchesSearch = query.length === 0
        || [product.nameAr, product.nameEn, product.sku, product.brand, category]
          .some((value) => `${value ?? ''}`.toLowerCase().includes(query));
      return matchesCategory && matchesSearch;
    });
  }, [canonicalProducts, productCategoryFilter, productSearch]);

  // Receipt printed preview modal
  const [completedOrder, setCompletedOrder] = useState<any | null>(null);
  const [posCheckoutComplete, setPosCheckoutComplete] = useState(false);

  const buildIsoFromMinutes = (date: Date, minutesFromNine: number) => {
    const dateKey = getLocalDateKey(date);
    return buildTenantIsoFromMinutes(dateKey, minutesFromNine, resolvedTenantTimezone, boardStartHour);
  };
  const addMinutesToIso = (iso: string, minutes: number) => (
    new Date(new Date(iso).getTime() + Math.max(0, Math.round(minutes)) * 60000).toISOString()
  );
  const getSyncedStagedStartIso = (item: { startTime?: number | string; startTimeIso?: string | null }) => {
    if (typeof item.startTime === 'string' && item.startTime.includes('T') && !Number.isNaN(new Date(item.startTime).getTime())) {
      return item.startTime;
    }
    const expectedStartIso = buildIsoFromMinutes(selectedDate, Number(item.startTime || 0));
    if (!item.startTimeIso) {
      return expectedStartIso;
    }

    const currentMs = new Date(item.startTimeIso).getTime();
    const expectedMs = new Date(expectedStartIso).getTime();
    if (!Number.isFinite(currentMs) || currentMs !== expectedMs) {
      return expectedStartIso;
    }

    return item.startTimeIso;
  };

  const buildClockTime = (minutesFromNine: number) => {
    const absoluteMinutes = (boardStartHour * 60) + Math.max(0, Math.round(minutesFromNine));
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const blockStartTimeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const step = Math.max(1, slotMinutes);
    for (let absoluteMinutes = boardStartHour * 60; absoluteMinutes < (24 * 60); absoluteMinutes += step) {
      const hours = Math.floor(absoluteMinutes / 60);
      const minutes = absoluteMinutes % 60;
      const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      options.push({ value, label: to12HourTime(value) });
    }
    return options;
  }, [boardStartHour, slotMinutes]);

  const formatBlockStartClockValue = (minutesFromNine?: number | null) => {
    const safeOffset = Math.max(0, Math.round(Number(minutesFromNine || 0)));
    const absoluteMinutes = (boardStartHour * 60) + safeOffset;
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const convertBlockClockToOffset = (value: string) => {
    const normalized = to24HourTime(value);
    const match = normalized.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
      return blockStartTime;
    }

    const absoluteMinutes = (Number(match[1]) * 60) + Number(match[2]);
    return Math.max(0, absoluteMinutes - (boardStartHour * 60));
  };

  const appointmentDraftSnapshot = useMemo<AppointmentDraftSnapshot>(() => ({
    createMode,
    createStep,
    custMode,
    selectedCustId,
    customerSearch,
    walkinFullName,
    walkinPhone,
    walkinEmail,
    walkinDob,
    walkinIsVip,
    includeGroupGuests,
    guestCount,
    guestNames,
    guestsList,
    currentServiceId,
    currentStaffId,
    currentStartTime,
    currentDuration,
    currentDiscountType,
    currentDiscountValue,
    currentServiceNotes,
    stagedServices,
    sessionNotes,
    notifyWhatsApp,
    createSplitActive,
    createSplitAmounts,
    giftCardCodeInput,
    blockTitleAr,
    blockTitleEn,
    blockStaffId,
    blockStartTime,
    blockDuration,
    blockType,
    blockIsRecurring,
    blockEndDate
  }), [
    createMode,
    createStep,
    custMode,
    selectedCustId,
    customerSearch,
    walkinFullName,
    walkinPhone,
    walkinEmail,
    walkinDob,
    walkinIsVip,
    includeGroupGuests,
    guestCount,
    guestNames,
    guestsList,
    currentServiceId,
    currentStaffId,
    currentStartTime,
    currentDuration,
    currentDiscountType,
    currentDiscountValue,
    currentServiceNotes,
    stagedServices,
    sessionNotes,
    notifyWhatsApp,
    createSplitActive,
    createSplitAmounts,
    giftCardCodeInput,
    blockTitleAr,
    blockTitleEn,
    blockStaffId,
    blockStartTime,
    blockDuration,
    blockType,
    blockIsRecurring,
    blockEndDate
  ]);

  const appointmentDraftHasContent = useMemo(() => isAppointmentDraftContent({
    createMode,
    createStep,
    custMode,
    selectedCustId,
    customerSearch,
    walkinFullName,
    walkinPhone,
    walkinEmail,
    walkinDob,
    walkinIsVip,
    includeGroupGuests,
    guestCount,
    guestNames,
    currentServiceId,
    currentStaffId,
    currentStartTime,
    currentDuration,
    currentDiscountType,
    currentDiscountValue,
    currentServiceNotes,
    stagedServices,
    sessionNotes,
    notifyWhatsApp,
    createSplitActive,
    createSplitAmounts,
    giftCardCodeInput,
    blockTitleAr,
    blockTitleEn,
    blockStaffId,
    blockStartTime,
    blockDuration,
    blockType,
    blockIsRecurring,
    blockEndDate
  }), [
    createMode,
    createStep,
    custMode,
    selectedCustId,
    customerSearch,
    walkinFullName,
    walkinPhone,
    walkinEmail,
    walkinDob,
    walkinIsVip,
    includeGroupGuests,
    guestCount,
    guestNames,
    currentServiceId,
    currentStaffId,
    currentStartTime,
    currentDuration,
    currentDiscountType,
    currentDiscountValue,
    currentServiceNotes,
    stagedServices,
    sessionNotes,
    notifyWhatsApp,
    createSplitActive,
    createSplitAmounts,
    giftCardCodeInput,
    blockTitleAr,
    blockTitleEn,
    blockStaffId,
    blockStartTime,
    blockDuration,
    blockType,
    blockIsRecurring,
    blockEndDate
  ]);

  const cartDraftSnapshot = useMemo<CartDraftSnapshot>(() => ({
    cartTab,
    productSearch,
    productCategoryFilter,
    cartItems,
    gcSender,
    gcRecipient,
    gcValue,
    generatedGcCode,
    posCustMode,
    posSelectedCustId,
    posCustomerSearch,
    posSplitActive,
    posSplitAmounts,
    posWalkinName,
    posWalkinEmail,
    posWalkinPhone,
    showWalkinModal
  }), [
    cartTab,
    productSearch,
    productCategoryFilter,
    cartItems,
    gcSender,
    gcRecipient,
    gcValue,
    generatedGcCode,
    posCustMode,
    posSelectedCustId,
    posCustomerSearch,
    posSplitActive,
    posSplitAmounts,
    posWalkinName,
    posWalkinEmail,
    posWalkinPhone,
    showWalkinModal
  ]);

  const cartDraftHasContent = useMemo(() => (
    Boolean(
      cartTab !== 'products'
      || productSearch.trim()
      || productCategoryFilter !== 'all'
      || cartItems.length > 0
      || gcSender.trim()
      || gcRecipient.trim()
      || gcValue !== 500
      || posCustMode !== 'walkin'
      || posSelectedCustId
      || posCustomerSearch.trim()
      || posSplitActive
      || Object.values(posSplitAmounts).some((amount) => Number(amount) > 0)
      || posWalkinName.trim()
      || posWalkinEmail.trim()
      || posWalkinPhone.trim()
      || showWalkinModal
    )
  ), [
    cartTab,
    productSearch,
    productCategoryFilter,
    cartItems.length,
    gcSender,
    gcRecipient,
    gcValue,
    posCustMode,
    posSelectedCustId,
    posCustomerSearch,
    posSplitActive,
    posSplitAmounts,
    posWalkinName,
    posWalkinEmail,
    posWalkinPhone,
    showWalkinModal
  ]);

  const restoreAppointmentDraft = (snapshot: AppointmentDraftSnapshot | null) => {
    if (!snapshot) {
      return;
    }

    setCreateMode(snapshot.createMode);
    if (snapshot.createStep >= 2 && !hasAppointmentIdentity(snapshot.custMode, snapshot.selectedCustId)) {
      setCreateStep(1);
    } else {
      setCreateStep(snapshot.createStep);
    }
    setCustMode(snapshot.custMode);
    setSelectedCustId(snapshot.selectedCustId);
    setCustomerSearch(snapshot.customerSearch);
    setWalkinFullName(snapshot.walkinFullName);
    setWalkinPhone(snapshot.walkinPhone);
    setWalkinEmail(snapshot.walkinEmail);
    setWalkinDob(snapshot.walkinDob);
    setWalkinIsVip(snapshot.walkinIsVip);
    setIncludeGroupGuests(snapshot.includeGroupGuests);
    setGuestCount(snapshot.guestCount);
    setGuestNames(snapshot.guestNames);
    setGuestsList(snapshot.guestsList || []);
    setCurrentServiceId(snapshot.currentServiceId);
    setCurrentStaffId(snapshot.currentStaffId);
    setCurrentStartTime(snapshot.currentStartTime);
    setCurrentDuration(snapshot.currentDuration);
    setCurrentDiscountType(snapshot.currentDiscountType);
    setCurrentDiscountValue(snapshot.currentDiscountValue);
    setCurrentServiceNotes(snapshot.currentServiceNotes);
    setStagedServices(snapshot.stagedServices || []);
    setSessionNotes(snapshot.sessionNotes);
    setNotifyWhatsApp(snapshot.notifyWhatsApp);
    setCreateSplitActive(snapshot.createSplitActive);
    setCreateSplitAmounts(snapshot.createSplitAmounts);
    setGiftCardCodeInput(snapshot.giftCardCodeInput);
    setBlockTitleAr(snapshot.blockTitleAr);
    setBlockTitleEn(snapshot.blockTitleEn);
    setBlockStaffId(snapshot.blockStaffId);
    setBlockStartTime(snapshot.blockStartTime);
    setBlockDuration(snapshot.blockDuration);
    setBlockType(snapshot.blockType);
    setBlockIsRecurring(snapshot.blockIsRecurring);
    setBlockEndDate(snapshot.blockEndDate);
  };

  const resetAppointmentDraft = () => {
    const emptyDraft = buildEmptyAppointmentDraftSnapshot();

    setCreateMode(emptyDraft.createMode as 'appointment' | 'blocked');
    setCreateStep(emptyDraft.createStep as number);
    setCustMode(emptyDraft.custMode as 'existing' | 'walkin');
    setSelectedCustId(emptyDraft.selectedCustId as string);
    setCustomerSearch(emptyDraft.customerSearch as string);
    setWalkinFullName(emptyDraft.walkinFullName as string);
    setWalkinPhone(emptyDraft.walkinPhone as string);
    setWalkinEmail(emptyDraft.walkinEmail as string);
    setWalkinDob(emptyDraft.walkinDob as string);
    setWalkinIsVip(Boolean(emptyDraft.walkinIsVip));
    setIncludeGroupGuests(Boolean(emptyDraft.includeGroupGuests));
    setGuestCount(Number(emptyDraft.guestCount || 1));
    setGuestNames(emptyDraft.guestNames as string);
    setGuestsList([
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
    setCurrentServiceId(emptyDraft.currentServiceId as string);
    setCurrentStaffId(emptyDraft.currentStaffId as string);
    if (!preserveBoardStartTime) {
      setCurrentStartTime(Number(emptyDraft.currentStartTime || 120));
    }
    setCurrentDuration(Number(emptyDraft.currentDuration || 60));
    setCurrentDiscountType(emptyDraft.currentDiscountType as 'none' | 'flat' | 'percent');
    setCurrentDiscountValue(Number(emptyDraft.currentDiscountValue || 0));
    setCurrentServiceNotes(emptyDraft.currentServiceNotes as string);
    setStagedServices([]);
    setSessionNotes(emptyDraft.sessionNotes as string);
    setNotifyWhatsApp(Boolean(emptyDraft.notifyWhatsApp));
    setCreateSplitActive(Boolean(emptyDraft.createSplitActive));
    setCreateSplitAmounts(emptyDraft.createSplitAmounts as { card: number; cash: number; online: number; bank_transfer: number; wallet: number; gift_card: number });
    setGiftCardCodeInput(emptyDraft.giftCardCodeInput as string);
    setBlockTitleAr(emptyDraft.blockTitleAr as string);
    setBlockTitleEn(emptyDraft.blockTitleEn as string);
    setBlockStaffId(emptyDraft.blockStaffId as string);
    setBlockStartTime(Number(emptyDraft.blockStartTime || 180));
    setBlockDuration(Number(emptyDraft.blockDuration || 45));
    setBlockType(emptyDraft.blockType as 'Break' | 'Lunch' | 'Meeting');
    setBlockIsRecurring(Boolean(emptyDraft.blockIsRecurring));
    setBlockEndDate(emptyDraft.blockEndDate as string);
    setExpandedServiceIds({});
    setConflictDialog(null);
    setBookingRecoveryMode('chain');
    setCurrentServiceCategory('all');
    setServiceSearch('');
    setConfiguredServiceId(null);
    setExpandedVariantServiceIds({});
    setIsOptionsExpanded(false);
    setShowDiscardConfirmDialog(false);
    setIdentityValidationError(false);
    setBookingScope('single');
    setGroupName('');
    setGroupPaymentArrangement('organizer_pays');
    setGroupParticipants([{ id: 'part-1', name: '', phone: '', email: '', isGuest: true }]);
    setActiveParticipantId('part-1');
    removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
    setAppointmentDraftPending(false);
    setShowAppointmentDraftPrompt(false);
    suppressAppointmentDraftPersistenceRef.current = true;
  };

  const restoreCartDraft = (snapshot: CartDraftSnapshot | null) => {
    if (!snapshot) {
      return;
    }

    setCartTab(snapshot.cartTab);
    setProductSearch(snapshot.productSearch);
    setProductCategoryFilter(snapshot.productCategoryFilter);
    setCartItems(snapshot.cartItems || []);
    setGcSender(snapshot.gcSender);
    setGcRecipient(snapshot.gcRecipient);
    setGcValue(snapshot.gcValue);
    setGeneratedGcCode(`REF-GFT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setPosCustMode(snapshot.posCustMode);
    setPosSelectedCustId(snapshot.posSelectedCustId);
    setPosCustomerSearch(snapshot.posCustomerSearch);
    setPosSplitActive(snapshot.posSplitActive);
    setPosSplitAmounts(snapshot.posSplitAmounts);
    setPosWalkinName(snapshot.posWalkinName);
    setPosWalkinEmail(snapshot.posWalkinEmail);
    setPosWalkinPhone(snapshot.posWalkinPhone);
    setShowWalkinModal(snapshot.showWalkinModal);
  };

  const resetCartDraft = () => {
    setCartTab('products');
    setProductSearch('');
    setProductCategoryFilter('all');
    setCartItems([]);
    setGcSender('');
    setGcRecipient('');
    setGcValue(500);
    setGeneratedGcCode(`REF-GFT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
    setPosCustMode('walkin');
    setPosSelectedCustId('');
    setPosCustomerSearch('');
    setPosSplitActive(false);
    setPosSplitAmounts({ card: 0, cash: 0, wallet: 0 });
    setPosWalkinName('');
    setPosWalkinEmail('');
    setPosWalkinPhone('');
    setShowWalkinModal(false);
    setCompletedOrder(null);
    setPosCheckoutComplete(false);
  };

  const appointmentDraftTypeLabel = createMode === 'blocked'
    ? (isRtl ? 'فترة حظر' : 'blocked time')
    : (isRtl ? 'موعد' : 'appointment');
  const cartDraftTypeLabel = cartTab === 'giftcards'
    ? (isRtl ? 'بطاقة هدايا' : 'gift card order')
    : (isRtl ? 'طلب منتجات' : 'product order');

  const handleContinueAppointmentDraft = () => {
    const snapshot = readDraftStorage<AppointmentDraftSnapshot>(APPOINTMENT_DRAFT_STORAGE_KEY);
    if (snapshot) {
      restoreAppointmentDraft(snapshot);
    }
    setShowAppointmentDraftPrompt(false);
    setAppointmentDraftPending(true);
  };

  const handleDiscardAppointmentDraft = () => {
    resetAppointmentDraft();
    removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
    setAppointmentDraftPending(false);
    setShowAppointmentDraftPrompt(false);
  };

  const isAppointmentFormDirty = useMemo(() => {
    return checkIsAppointmentDraftDirty({
      createMode,
      selectedCustId,
      customerSearch,
      custMode,
      walkinFullName,
      walkinPhone,
      walkinEmail,
      walkinDob,
      walkinIsVip,
      includeGroupGuests,
      guestCount,
      guestNames,
      stagedServicesCount: stagedServices.length,
      currentServiceId,
      currentDiscountType,
      currentDiscountValue,
      currentServiceNotes,
      sessionNotes,
      createSplitActive,
      createSplitAmounts,
      giftCardCodeInput,
      blockTitleAr,
      blockTitleEn,
      blockStaffId,
      blockIsRecurring,
      blockEndDate,
      bookingScope,
      groupName,
      groupParticipantsCount: groupParticipants.length
    });
  }, [
    createMode,
    selectedCustId,
    customerSearch,
    custMode,
    walkinFullName,
    walkinPhone,
    walkinEmail,
    walkinDob,
    walkinIsVip,
    includeGroupGuests,
    guestCount,
    guestNames,
    stagedServices.length,
    currentServiceId,
    currentDiscountType,
    currentDiscountValue,
    currentServiceNotes,
    sessionNotes,
    createSplitActive,
    createSplitAmounts,
    giftCardCodeInput,
    blockTitleAr,
    blockTitleEn,
    blockStaffId,
    blockIsRecurring,
    blockEndDate,
    bookingScope,
    groupName,
    groupParticipants.length
  ]);

  const handleRequestDismissCreateDrawer = () => {
    if (showDiscardConfirmDialog) {
      setShowDiscardConfirmDialog(false);
      return;
    }
    if (isAppointmentFormDirty) {
      setShowDiscardConfirmDialog(true);
    } else {
      resetAppointmentDraft();
      setIsCreateDrawerOpen(false);
    }
  };

  const handleConfirmDiscardAndLeave = () => {
    setShowDiscardConfirmDialog(false);
    suppressAppointmentDraftPersistenceRef.current = true;
    resetAppointmentDraft();
    removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
    setAppointmentDraftPending(false);
    setIsCreateDrawerOpen(false);
  };

  const handleCancelDiscard = () => {
    setShowDiscardConfirmDialog(false);
  };

  useEffect(() => {
    if (!isCreateDrawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleRequestDismissCreateDrawer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateDrawerOpen, isAppointmentFormDirty, showDiscardConfirmDialog]);

  const handleContinueCartDraft = () => {
    const snapshot = readDraftStorage<CartDraftSnapshot>(CART_DRAFT_STORAGE_KEY);
    if (snapshot) {
      restoreCartDraft(snapshot);
    }
    setShowCartDraftPrompt(false);
    setCartDraftPending(true);
  };

  const handleDiscardCartDraft = () => {
    resetCartDraft();
    removeDraftStorage(CART_DRAFT_STORAGE_KEY);
    setCartDraftPending(false);
    setShowCartDraftPrompt(false);
  };

  useEffect(() => {
    if (suppressAppointmentDraftPersistenceRef.current) {
      suppressAppointmentDraftPersistenceRef.current = false;
      removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
      return;
    }

    if (appointmentDraftHasContent) {
      writeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY, appointmentDraftSnapshot);
    } else {
      removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
      if (!isCreateDrawerOpen) {
        setAppointmentDraftPending(false);
      }
    }
  }, [appointmentDraftHasContent, appointmentDraftSnapshot, isCreateDrawerOpen]);

  useEffect(() => {
    if (cartDraftHasContent) {
      writeDraftStorage(CART_DRAFT_STORAGE_KEY, cartDraftSnapshot);
    } else {
      removeDraftStorage(CART_DRAFT_STORAGE_KEY);
      if (!isCartDrawerOpen) {
        setCartDraftPending(false);
      }
    }
  }, [cartDraftHasContent, cartDraftSnapshot, isCartDrawerOpen]);

  useEffect(() => {
    const wasOpen = previousCreateDrawerOpenRef.current;
    previousCreateDrawerOpenRef.current = isCreateDrawerOpen;

    if (wasOpen && !isCreateDrawerOpen && appointmentDraftHasContent) {
      setAppointmentDraftPending(true);
    }

    if (isCreateDrawerOpen && appointmentDraftPending && !preserveBoardStartTime) {
      setShowAppointmentDraftPrompt(true);
    }
  }, [isCreateDrawerOpen, appointmentDraftHasContent, appointmentDraftPending, preserveBoardStartTime]);

  useEffect(() => {
    const wasOpen = previousCartDrawerOpenRef.current;
    previousCartDrawerOpenRef.current = isCartDrawerOpen;

    if (wasOpen && !isCartDrawerOpen && cartDraftHasContent) {
      setCartDraftPending(true);
    }

    if (isCartDrawerOpen && cartDraftPending) {
      setShowCartDraftPrompt(true);
    }
  }, [isCartDrawerOpen, cartDraftHasContent, cartDraftPending]);

  // Removed obsolete auto-populate duration and warning validation

  const removeQueuedService = (serviceId: string, variantId?: string | null) => {
    setStagedServices((current) => removeStandaloneQueuedService(
      current,
      serviceId,
      variantId,
      bookingScope === 'group' ? activeParticipantId : null
    ));
  };

  const isQueuedServiceSelected = (serviceId: string, variantId?: string | null) => {
    return isQueuedStandaloneServiceSelected(
      stagedServices,
      serviceId,
      variantId,
      bookingScope === 'group' ? activeParticipantId : null
    );
  };

  // Removed obsolete handleAddStagedService and toggleServiceExpansion since AppointmentServicesStep handles it

  const handleUpdateStagedService = (itemId: string, updates: Partial<StagedService>) => {
    setStagedServices(prev => {
      const targetItem = prev.find(item => item.id === itemId);
      if (!targetItem) return prev;

      const isStartTimeUpdate = Object.prototype.hasOwnProperty.call(updates, 'startTime');
      const targetPkgId = targetItem.packageId;
      const targetPkg = targetPkgId
        ? (services2Bundles?.find(p => p.id === targetPkgId) || servicePackages?.find(p => p.id === targetPkgId))
        : null;
      const isParallelPackage = Boolean(targetItem.packageInstanceId && targetPkg?.scheduleType === 'parallel');

      const newStartTime = isStartTimeUpdate ? Number(updates.startTime || 0) : targetItem.startTime;
      const newStartTimeIso = isStartTimeUpdate
        ? (updates.startTimeIso || buildIsoFromMinutes(selectedDate, newStartTime))
        : targetItem.startTimeIso;

      // 1. Update the target item and, if in a parallel bundle, all parallel sibling services
      const updatedList = prev.map(item => {
        const isTarget = item.id === itemId;
        const isParallelSibling = isParallelPackage && item.packageInstanceId === targetItem.packageInstanceId;

        if (!isTarget && !isParallelSibling) {
          return item;
        }

        if (isTarget) {
          const next = { ...item, ...updates };
          if (Object.prototype.hasOwnProperty.call(updates, 'staffId')) {
            next.isExplicitStaff = updates.isExplicitStaff !== undefined ? updates.isExplicitStaff : Boolean(updates.staffId);
          }
          const shouldResyncStartIso =
            isStartTimeUpdate ||
            !next.startTimeIso ||
            !Number.isFinite(new Date(next.startTimeIso).getTime()) ||
            new Date(next.startTimeIso).getTime() !== new Date(buildIsoFromMinutes(selectedDate, Number(next.startTime || 0))).getTime();

          if (shouldResyncStartIso) {
            next.startTimeIso = buildIsoFromMinutes(selectedDate, Number(next.startTime || 0));
          }

          if (next.basePrice !== undefined) {
            let priceAfterDiscount = next.basePrice;
            if (next.discountType === 'flat') {
              priceAfterDiscount = Math.max(0, next.basePrice - (next.discountValue || 0));
            } else if (next.discountType === 'percent') {
              priceAfterDiscount = Math.max(0, next.basePrice - (next.basePrice * (next.discountValue || 0)) / 100);
            }
            next.finalPrice = priceAfterDiscount;
          }
          return next;
        }

        // Parallel sibling receiving synchronized start time
        if (isStartTimeUpdate) {
          return {
            ...item,
            startTime: newStartTime,
            startTimeIso: newStartTimeIso,
            timingMode: updates.timingMode || item.timingMode
          };
        }

        return item;
      });

      // Synchronize appointment-level anchor start time
      if (isStartTimeUpdate) {
        const earliestStaged = Math.min(...updatedList.map(i => Number(i.startTime || 0)));
        if (Number.isFinite(earliestStaged)) {
          setCurrentStartTime(earliestStaged);
        }
      }

      // 2. Cascade only when later services are in sequential chaining mode
      const shouldChainServiceTimes = bookingRecoveryMode !== 'separate_services';
      if (!shouldChainServiceTimes) {
        return updatedList;
      }

      for (let i = 1; i < updatedList.length; i++) {
        const currentItem = updatedList[i];
        const defaultPartId = groupParticipants[0]?.id;
        const currentPartId = currentItem.participantId || defaultPartId;

        // In group bookings, only chain sequentially against preceding services of the SAME participant
        const precedingSameParticipantItems = updatedList
          .slice(0, i)
          .filter(it => (bookingScope !== 'group') || ((it.participantId || defaultPartId) === currentPartId));

        if (precedingSameParticipantItems.length === 0) {
          // This is the participant's first service; its start time is independent
          continue;
        }

        const prevItem = precedingSameParticipantItems[precedingSameParticipantItems.length - 1];

        // Sibling services in the same parallel bundle share the same start time and do not chain sequentially
        if (
          currentItem.packageInstanceId &&
          prevItem.packageInstanceId &&
          currentItem.packageInstanceId === prevItem.packageInstanceId
        ) {
          const currentPkg = currentItem.packageId
            ? (services2Bundles?.find(p => p.id === currentItem.packageId) || servicePackages?.find(p => p.id === currentItem.packageId))
            : null;
          if (currentPkg?.scheduleType === 'parallel') {
            continue;
          }
        }

        // Compute expected start time based on preceding service / bundle
        let expectedStart = prevItem.startTime + prevItem.duration;
        if (prevItem.packageInstanceId) {
          const prevPkg = prevItem.packageId
            ? (services2Bundles?.find(p => p.id === prevItem.packageId) || servicePackages?.find(p => p.id === prevItem.packageId))
            : null;
          if (prevPkg?.scheduleType === 'parallel') {
            const parallelSiblings = updatedList.filter(it => it.packageInstanceId === prevItem.packageInstanceId);
            expectedStart = Math.max(...parallelSiblings.map(it => Number(it.startTime || 0) + Number(it.duration || 0)));
          }
        }

        const priorItem = prev[i - 1];
        const priorCurrentItem = prev[i];
        let priorExpectedStart = priorItem ? priorItem.startTime + priorItem.duration : null;
        if (priorItem?.packageInstanceId) {
          const priorPkg = priorItem.packageId
            ? (services2Bundles?.find(p => p.id === priorItem.packageId) || servicePackages?.find(p => p.id === priorItem.packageId))
            : null;
          if (priorPkg?.scheduleType === 'parallel') {
            const priorParallelSiblings = prev.filter(it => it.packageInstanceId === priorItem.packageInstanceId);
            priorExpectedStart = Math.max(...priorParallelSiblings.map(it => Number(it.startTime || 0) + Number(it.duration || 0)));
          }
        }

        const isAutoDerived = isAutoDerivedFromPreviousChain({
          priorItem,
          currentItem: priorCurrentItem,
          expectedStartIso: buildIsoFromMinutes(selectedDate, priorExpectedStart || 0)
        });

        if (!isAutoDerived) {
          if (expectedStart > priorCurrentItem.startTime) {
            addLocalToast(
              isRtl ? 'تحذير: وقت الخدمة السابقة يتداخل مع هذه الخدمة' : 'Warning: Previous service overlaps with this service',
              isRtl ? 'Warning: Previous service overlaps with this service' : 'تحذير: وقت الخدمة السابقة يتداخل مع هذه الخدمة',
              'warning'
            );
          }
          continue;
        }

        currentItem.startTime = expectedStart;
        currentItem.startTimeIso = buildIsoFromMinutes(selectedDate, expectedStart);
      }

      return updatedList;
    });
  };

  // Phase 3: Smart Availability Operations
  const loadSmartAvailability = useCallback(async (
    targetDate: Date,
    checkAll: boolean
  ) => {
    if (stagedServices.length === 0) {
      setSmartAvailabilitySummary(null);
      setNextAvailableAlternative(null);
      return;
    }

    setSmartAvailabilityLoading(true);
    try {
      const stagedForAvail: StagedItemForAvailability[] = stagedServices.map(item => ({
        id: item.id,
        serviceId: item.serviceId,
        packageId: item.packageId,
        variantId: item.variantId,
        duration: item.duration,
        staffId: item.staffId,
        isExplicitStaff: item.isExplicitStaff,
        sequenceOrder: item.sequenceOrder
      }));

      const dateKey = getLocalDateKey(targetDate);
      const summary = await calculateSmartAvailability({
        tenantId,
        stagedItems: stagedForAvail,
        dateKey,
        checkAllProfessionals: checkAll,
        isRtl,
        allStylists: availableStylists,
        tenantTimezone: resolvedTenantTimezone,
        boardStartHour
      });

      setSmartAvailabilitySummary(summary);

      // Offer earliest valid date & slots when requested date has no suitable availability
      if (summary.slots.length === 0) {
        setIsSearchingNextDate(true);
        try {
          const alternative = await findNextAvailableAlternative({
            tenantId,
            stagedItems: stagedForAvail,
            startDate: dateKey,
            checkAllProfessionals: checkAll,
            isRtl,
            tenantTimezone: resolvedTenantTimezone,
            boardStartHour
          });
          setNextAvailableAlternative(alternative);
        } catch (altErr) {
          console.error('Failed to find next available date alternative:', altErr);
          setNextAvailableAlternative(null);
        } finally {
          setIsSearchingNextDate(false);
        }
      } else {
        setNextAvailableAlternative(null);
      }
    } catch (err) {
      console.error('Failed to calculate smart availability:', err);
      setSmartAvailabilitySummary(null);
    } finally {
      setSmartAvailabilityLoading(false);
    }
  }, [stagedServices, availableStylists, tenantId, isRtl, resolvedTenantTimezone, boardStartHour]);

  const handleSelectSmartSlot = (slot: SmartSlot) => {
    const slotBoardMinutes = slot.boardMinutes ?? slot.timeMinutes;
    setCurrentStartTime(slotBoardMinutes);

    if (slot.chainSlots && slot.chainSlots.length > 0) {
      setStagedServices(prev => applySmartSlotToStagedServices(prev, slot, resolvedTenantTimezone, boardStartHour));
    } else if (stagedServices.length > 0) {
      const anchorItem = stagedServices[0];
      const updates: Partial<StagedService> = {
        startTime: slotBoardMinutes,
        startTimeIso: slot.startTime,
        ...(slot.staffId ? { staffId: slot.staffId, isExplicitStaff: true } : {})
      };
      handleUpdateStagedService(anchorItem.id, updates);
    }

    if (slot.staffId) {
      setCurrentStaffId(slot.staffId);
    }

    addLocalToast(
      isRtl
        ? `تم تعيين الوقت: ${slot.clockLabel}`
        : `Scheduled time set: ${slot.clockLabel}`,
      'success'
    );
  };

  const handleJumpToNextDate = (alt: NextAvailableAlternative) => {
    if (!alt.dateKey) return;
    const parts = alt.dateKey.split('-');
    if (parts.length === 3) {
      const nextDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      setSmartAvailabilityDate(nextDate);
      if (setSelectedDate) {
        setSelectedDate(nextDate);
      }
      if (alt.earliestSlot) {
        handleSelectSmartSlot(alt.earliestSlot);
      }
      loadSmartAvailability(nextDate, isCheckingAllProfessionals);
    }
  };

  // Auto-refresh smart availability when active and queue or staff changes
  useEffect(() => {
    if (isFindingAvailableTimes && stagedServices.length > 0) {
      loadSmartAvailability(smartAvailabilityDate, isCheckingAllProfessionals);
    }
  }, [
    isFindingAvailableTimes,
    smartAvailabilityDate,
    isCheckingAllProfessionals,
    stagedServices.length,
    stagedServices.map(s => `${s.id}:${s.serviceId}:${s.staffId}:${s.duration}`).join(','),
    appointments.length
  ]);

  // Live Resource Availability Tracker (Phase 5A)
  const [resourceAvailabilityMap, setResourceAvailabilityMap] = useState<Record<string, ItemResourceAvailability>>({});
  const [isCheckingResources, setIsCheckingResources] = useState(false);
  const latestResourceRequestIdRef = useRef<number>(0);

  useEffect(() => {
    if (!isCreateDrawerOpen) return;

    let isCancelled = false;
    const currentRequestId = ++latestResourceRequestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        setIsCheckingResources(true);

        // 1. Build staged items payload (only items with valid serviceId consume resources)
        const stagedItemsPayload: Array<{
          id: string;
          serviceId: string;
          variantId?: string | null;
          startTime: string;
          duration: number;
        }> = [];

        for (const item of stagedServices) {
          if (item.serviceId) {
            const startIso = buildIsoFromMinutes(selectedDate, Number(item.startTime || 0));
            stagedItemsPayload.push({
              id: item.id,
              serviceId: item.serviceId,
              variantId: item.variantId || null,
              startTime: startIso,
              duration: Number(item.duration || 30)
            });
          }
        }

        // 2. Build catalogue probe items payload
        // Evaluate at the active participant's next scheduled/chained start time
        let activeParticipantNextStartTime = currentStartTime;
        const participantStaged = bookingScope === 'group'
          ? stagedServices.filter(s => (s.participantId || groupParticipants[0]?.id) === activeParticipantId)
          : stagedServices;

        const shouldChainServiceTimes = bookingRecoveryMode !== 'separate_services';
        if (shouldChainServiceTimes && participantStaged.length > 0) {
          const lastItem = participantStaged[participantStaged.length - 1];
          if (lastItem.packageInstanceId) {
            const siblingItems = participantStaged.filter(p => p.packageInstanceId === lastItem.packageInstanceId);
            activeParticipantNextStartTime = Math.max(...siblingItems.map(s => Number(s.startTime || 0) + Number(s.duration || 0)));
          } else {
            activeParticipantNextStartTime = lastItem.startTime + lastItem.duration;
          }
        }

        const catalogueStartIso = buildIsoFromMinutes(selectedDate, activeParticipantNextStartTime);
        const catalogueItemsPayload: Array<{
          id: string;
          serviceId: string;
          variantId?: string | null;
          startTime: string;
          duration: number;
        }> = [];

        for (const srv of canonicalServices) {
          if (srv.id) {
            catalogueItemsPayload.push({
              id: `cat-srv-${srv.id}`,
              serviceId: srv.id,
              variantId: null,
              startTime: catalogueStartIso,
              duration: Number(srv.duration || 30)
            });

            if (Array.isArray(srv.variants)) {
              for (const v of srv.variants) {
                if (v.id) {
                  catalogueItemsPayload.push({
                    id: `cat-var-${v.id}`,
                    serviceId: srv.id,
                    variantId: v.id,
                    startTime: catalogueStartIso,
                    duration: Number(v.duration || srv.duration || 30)
                  });
                }
              }
            }
          }
        }

        const response = await tenantApiAdapter.batchCheckResourceAvailability({
          stagedItems: stagedItemsPayload,
          catalogueItems: catalogueItemsPayload
        });

        if (!isCancelled && currentRequestId === latestResourceRequestIdRef.current && response && response.results) {
          setResourceAvailabilityMap(response.results);
        }
      } catch (err) {
        console.warn('Batch resource availability check failed:', err);
      } finally {
        if (!isCancelled && currentRequestId === latestResourceRequestIdRef.current) {
          setIsCheckingResources(false);
        }
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    isCreateDrawerOpen,
    selectedDate,
    currentStartTime,
    activeParticipantId,
    groupParticipants.length,
    bookingScope,
    bookingRecoveryMode,
    boardStartHour,
    resolvedTenantTimezone,
    stagedServices.map(s => `${s.id}:${s.serviceId}:${s.variantId}:${s.startTime}:${s.duration}:${s.participantId}`).join(','),
    canonicalServices.length
  ]);

  const handleToggleServiceSelection = (service: ServiceRecord, variantOverride?: ServiceVariantRecord | null) => {
    const isSelected = isQueuedServiceSelected(service.id, variantOverride?.id);
    if (isSelected) {
      setStagedServices((current) => removeStandaloneQueuedService(
        current,
        service.id,
        variantOverride?.id,
        bookingScope === 'group' ? activeParticipantId : null
      ));
      setExpandedServiceIds((current) => ({
        ...current,
        [service.id]: false
      }));
    } else {
      const resolvedVariant = variantOverride || null;
      let nextStartTime = currentStartTime;
      const shouldChainServiceTimes = bookingRecoveryMode !== 'separate_services';
      const participantStaged = bookingScope === 'group'
        ? stagedServices.filter(s => (s.participantId || groupParticipants[0]?.id) === activeParticipantId)
        : stagedServices;

      if (shouldChainServiceTimes && participantStaged.length > 0) {
        const lastItem = participantStaged[participantStaged.length - 1];
        if (lastItem.packageInstanceId) {
          const siblingItems = participantStaged.filter(p => p.packageInstanceId === lastItem.packageInstanceId);
          nextStartTime = Math.max(...siblingItems.map(s => Number(s.startTime || 0) + Number(s.duration || 0)));
        } else {
          nextStartTime = lastItem.startTime + lastItem.duration;
        }
      }
      const nextStartTimeIso = buildIsoFromMinutes(selectedDate, nextStartTime);

      const basePrice = toMoney(resolvedVariant?.finalPrice ?? resolvedVariant?.price ?? service.finalPrice ?? service.price ?? 0);

      const newItem: StagedService = {
        id: `stg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        itemType: 'service',
        serviceId: service.id,
        variantId: resolvedVariant?.id || undefined,
        serviceCategory: service.category,
        staffId: currentStaffId || '',
        isExplicitStaff: Boolean(currentStaffId),
        startTime: nextStartTime,
        startTimeIso: nextStartTimeIso,
        duration: resolveBookingDuration(undefined, resolvedVariant?.duration, service.duration),
        discountType: 'none',
        discountValue: 0,
        notes: '',
        basePrice,
        finalPrice: basePrice,
        timingMode: 'auto',
        participantId: bookingScope === 'group' ? activeParticipantId : undefined
      };

      setStagedServices(prev => [...prev, newItem]);
      const optionName = resolvedVariant
        ? (isRtl ? (resolvedVariant.name_ar || resolvedVariant.nameAr || resolvedVariant.name_en || resolvedVariant.nameEn) : (resolvedVariant.name_en || resolvedVariant.nameEn || resolvedVariant.name_ar || resolvedVariant.nameAr))
        : (isRtl ? service.nameAr : service.nameEn);
      addLocalToast(
        `تمت إضافة "${optionName}" لقائمة الخدمات المطلوبة بنجاح`,
        `Successfully queued "${optionName}" into the staging list`,
        'success'
      );

      setExpandedServiceIds((current) => ({
        ...current,
        [service.id]: true
      }));
    }
  };

  const handleAddPackageToStaged = (pkgId: string) => {
    const pkg = services2Bundles?.find(p => p.id === pkgId) || servicePackages?.find(p => p.id === pkgId);
    if (!pkg || !pkg.items || pkg.items.length === 0) {
      addLocalToast(
        `لم يتم العثور على خدمات في الباقة "${isRtl ? pkg?.name_ar : pkg?.name_en}".`,
        `The package "${isRtl ? pkg?.name_ar : pkg?.name_en}" contains no services.`,
        'warning'
      );
      return;
    }

    const isStaged = stagedServices.some(s => s.packageId === pkgId && (bookingScope !== 'group' || (s.participantId || groupParticipants[0]?.id) === activeParticipantId));
    if (isStaged) {
      setStagedServices(prev => removeBundleFromStagedServices(
        prev,
        pkgId,
        bookingScope === 'group' ? activeParticipantId : null
      ));
      addLocalToast(
        `تمت إزالة الباقة بنجاح`,
        `Successfully removed package`,
        'info'
      );
      return;
    }

    const isParallel = pkg.scheduleType === 'parallel';

    setStagedServices(prev => {
      let nextStartTime = currentStartTime;
      const shouldChainServiceTimes = bookingRecoveryMode !== 'separate_services';
      const participantStaged = bookingScope === 'group'
        ? prev.filter(s => (s.participantId || groupParticipants[0]?.id) === activeParticipantId)
        : prev;

      if (shouldChainServiceTimes && participantStaged.length > 0) {
        const lastItem = participantStaged[participantStaged.length - 1];
        if (lastItem.packageInstanceId) {
          const siblingItems = participantStaged.filter(p => p.packageInstanceId === lastItem.packageInstanceId);
          nextStartTime = Math.max(...siblingItems.map(s => Number(s.startTime || 0) + Number(s.duration || 0)));
        } else {
          nextStartTime = lastItem.startTime + lastItem.duration;
        }
      }

      const newItems: StagedService[] = [];
      let runningStartTime = nextStartTime;

      const sortedItems = [...pkg.items].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0));
      const packageInstanceId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const usedStaffIdsInBundle = new Set<string>();

      for (const item of sortedItems) {
        const service = canonicalServices.find(s => s.id === item.serviceId);
        if (!service) continue;

        const resolvedVariant = item.variantId 
          ? (service.variants || []).find((v: any) => v.id === item.variantId) 
          : null;

        const basePrice = toMoney(resolvedVariant?.finalPrice ?? resolvedVariant?.price ?? service.finalPrice ?? service.price ?? 0);
        const duration = resolveBookingDuration(undefined, resolvedVariant?.duration, service.duration);

        // Child services in bundles default to "Any Professional" unless explicitly assigned
        const itemStartTime = isParallel ? nextStartTime : runningStartTime;
        const nextStartTimeIso = buildIsoFromMinutes(selectedDate, itemStartTime);

        newItems.push({
          id: `stg-pkg-${pkg.id}-${item.id}-${Date.now()}-${Math.random()}`,
          itemType: 'package',
          packageInstanceId,
          packageId: pkg.id,
          packageItemId: item.id,
          sequenceOrder: item.sequenceOrder || 0,
          serviceId: service.id,
          variantId: resolvedVariant?.id || undefined,
          serviceCategory: service.category,
          staffId: '', // Default to Any Professional
          isExplicitStaff: false,
          startTime: itemStartTime,
          startTimeIso: nextStartTimeIso,
          duration,
          discountType: 'none',
          discountValue: 0,
          notes: '',
          basePrice,
          finalPrice: basePrice,
          timingMode: 'auto',
          participantId: bookingScope === 'group' ? activeParticipantId : undefined
        });

        if (shouldChainServiceTimes && !isParallel) {
          runningStartTime += duration;
        }
      }

      return [...prev, ...newItems];
    });

    addLocalToast(
      `تمت إضافة الباقة "${isRtl ? pkg.name_ar : pkg.name_en}" بنجاح.`,
      `Package "${isRtl ? pkg.name_ar : pkg.name_en}" added successfully.`,
      'success'
    );
  };

  const executeApplyRebookedDraft = (
    items: Array<{
      service: ServiceRecord;
      variant?: ServiceVariantRecord | null;
      prevStaffId?: string;
      duration: number;
      basePrice: number;
      sequenceOrder?: number;
    }>
  ) => {
    if (!items || items.length === 0) {
      addLocalToast(
        'تعذر إعادة الحجز لعدم توفر أي من الخدمات في القائمة الحالية.',
        'Cannot rebook: none of the services are currently available.',
        'warning'
      );
      setRebookPrompt(null);
      return;
    }

    let runningStartTime = currentStartTime;
    const shouldChainServiceTimes = bookingRecoveryMode !== 'separate_services';

    const freshStaged: StagedService[] = items.map((it, idx) => {
      const itemStartTime = runningStartTime;
      const nextStartTimeIso = buildIsoFromMinutes(selectedDate, itemStartTime);
      if (shouldChainServiceTimes) {
        runningStartTime += it.duration;
      }

      return {
        id: `stg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
        itemType: 'service',
        serviceId: it.service.id,
        variantId: it.variant?.id || undefined,
        serviceCategory: it.service.category,
        staffId: it.prevStaffId || '',
        isExplicitStaff: Boolean(it.prevStaffId),
        startTime: itemStartTime,
        startTimeIso: nextStartTimeIso,
        duration: it.duration,
        discountType: 'none',
        discountValue: 0,
        notes: '',
        basePrice: it.basePrice,
        finalPrice: it.basePrice,
        timingMode: 'auto'
      };
    });

    setStagedServices(freshStaged);
    setIsFindingAvailableTimes(true);
    setRebookPrompt(null);

    addLocalToast(
      `تم إنشاء مسودة جديدة لـ ${freshStaged.length} خدمة وفق الأسعار الحالية. يرجى اختيار الموعد المناسب.`,
      `Created fresh draft with ${freshStaged.length} service(s) at current pricing. Please select an available time.`,
      'success'
    );
  };

  const handleRebookAppointment = (session: CustomerHistoricalSession) => {
    if (!session) return;

    // 1. Extract historical raw service items
    let rawItems: any[] = [];
    if (Array.isArray(session.serviceLines) && session.serviceLines.length > 0) {
      rawItems = session.serviceLines;
    } else if (Array.isArray(session.details?.services) && session.details.services.length > 0) {
      rawItems = session.details.services;
    } else if (Array.isArray(session.appointments) && session.appointments.length > 0) {
      rawItems = session.appointments;
    } else {
      rawItems = [session];
    }

    // 2. Identify if this is reliably a package bundle
    // Requirement 3: "Preserve historical bundle composition only when it can be identified reliably from the historical data. Do not guess bundle identity from ambiguous service names or approximate composition."
    const explicitPkgId = (session as any).packageId
      || session.details?.service?.packageId
      || (session.details as any)?.packageId
      || rawItems.find((it: any) => it.packageId)?.packageId;

    const matchedPkg = explicitPkgId
      ? (services2Bundles?.find(p => p.id === explicitPkgId) || servicePackages?.find(p => p.id === explicitPkgId))
      : null;

    if (matchedPkg && matchedPkg.items && matchedPkg.items.length > 0) {
      // Rebook as package
      if (stagedServices.length > 0) {
        setRebookPrompt({
          isOpen: true,
          session,
          unavailableItems: [],
          availableItems: [],
          matchedPkgId: matchedPkg.id,
          hasExistingDraftConflict: true
        });
        return;
      }
      setStagedServices([]);
      handleAddPackageToStaged(matchedPkg.id);
      setIsFindingAvailableTimes(true);
      return;
    }

    // 3. For individual services, validate against active catalog
    const unavailableList: Array<{ name: string; variantName?: string; reason: string }> = [];
    const availableList: Array<{
      service: ServiceRecord;
      variant?: ServiceVariantRecord | null;
      prevStaffId?: string;
      duration: number;
      basePrice: number;
      sequenceOrder?: number;
    }> = [];

    rawItems.forEach((item: any, idx: number) => {
      const sId = item.service?.id || item.serviceId || item.id;
      const sNameEn = item.serviceNameEn || item.service?.name_en || item.name_en || item.title || '';
      const sNameAr = item.serviceNameAr || item.service?.name_ar || item.name_ar || item.title || '';
      const displayName = isRtl ? (sNameAr || sNameEn || `خدمة #${idx + 1}`) : (sNameEn || sNameAr || `Service #${idx + 1}`);

      // Match live service
      const liveService = canonicalServices.find(s => s.id === sId)
        || canonicalServices.find(s => (s.nameEn && s.nameEn === sNameEn) || (s.nameAr && s.nameAr === sNameAr));

      if (!liveService || liveService.isActive === false || (liveService as any).status === 'inactive') {
        unavailableList.push({
          name: displayName,
          variantName: item.serviceVariantName || item.variantName || undefined,
          reason: isRtl ? 'الخدمة غير متوفرة أو معطلة في القائمة الحالية' : 'Service is inactive or no longer in catalog'
        });
        return;
      }

      // Check variant if historical item had a variant
      const histVariantName = item.serviceVariantName || item.variantName || item.details?.serviceVariantName || '';
      const histVariantId = item.serviceVariantId || item.variantId || item.details?.serviceVariantId || '';
      let liveVariant: ServiceVariantRecord | null = null;

      if (histVariantId || histVariantName) {
        liveVariant = (liveService.variants || []).find((v: any) =>
          (histVariantId && v.id === histVariantId) ||
          (histVariantName && (
            (v.name_en && v.name_en.toLowerCase() === histVariantName.toLowerCase()) ||
            (v.name_ar && v.name_ar === histVariantName) ||
            (v.nameEn && v.nameEn.toLowerCase() === histVariantName.toLowerCase()) ||
            (v.nameAr && v.nameAr === histVariantName)
          ))
        ) || null;

        if (!liveVariant || liveVariant.isActive === false) {
          unavailableList.push({
            name: displayName,
            variantName: histVariantName,
            reason: isRtl ? 'الخيار أو الخصلة المحددة لم تعد متاحة' : 'Variant is no longer available'
          });
          return;
        }
      }

      // Live price and duration
      const basePrice = toMoney(liveVariant?.finalPrice ?? liveVariant?.price ?? liveService.finalPrice ?? liveService.price ?? 0);
      const duration = resolveBookingDuration(undefined, liveVariant?.duration, liveService.duration);

      // Previous staff preference (Requirement 2)
      const prevStaffId = item.staff?.id || item.staffId || session.details?.staff?.id || (session as any).staffId || '';
      const matchedStylist = availableStylists.find(st => st.id === prevStaffId);
      const assignments = liveService.employeeAssignments || [];
      const isQualified = matchedStylist && (assignments.length === 0 || assignments.map(String).includes(String(matchedStylist.id)));

      availableList.push({
        service: liveService,
        variant: liveVariant,
        prevStaffId: isQualified ? matchedStylist.id : '',
        duration,
        basePrice,
        sequenceOrder: idx
      });
    });

    // Requirement 1 & Draft conflict check
    if (unavailableList.length > 0 || (stagedServices.length > 0 && availableList.length > 0)) {
      setRebookPrompt({
        isOpen: true,
        session,
        unavailableItems: unavailableList,
        availableItems: availableList,
        matchedPkgId: null,
        hasExistingDraftConflict: stagedServices.length > 0
      });
      return;
    }

    // All available and no draft conflict
    executeApplyRebookedDraft(availableList);
  };

  const showBookingErrorDialog = (dialog: {
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
  }) => {
    setBookingErrorDialog(dialog);
  };

  const getBookingChainFinalEndMinutes = (items: Array<{ startTime?: number; duration?: number }>) => (
    items.reduce((max, item) => {
      const startOffset = Math.max(0, Math.round(Number(item.startTime || 0)));
      const duration = Math.max(0, Math.round(Number(item.duration || 0)));
      return Math.max(max, startOffset + duration);
    }, 0)
  );

  const handleConfirmAppointmentCreation = async (allowExtendedHours = false) => {
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
        showBookingErrorDialog({
          titleAr: 'يرجى تعبئة أسماء المرافقين',
          titleEn: 'Missing guest names',
          bodyAr: 'لا يمكن متابعة الحجز الجماعي قبل تعبئة أسماء جميع المرافقين.',
          bodyEn: 'The group booking cannot continue until all guest names are filled in.'
        });
        return;
      }
    }

    if (custMode === 'existing') {
      if (!selectedCustId) {
        showBookingErrorDialog({
          titleAr: 'يرجى اختيار عميل',
          titleEn: 'Missing customer',
          bodyAr: 'يرجى اختيار عميل من القائمة لإكمال الحجز.',
          bodyEn: 'Please select a customer from the list to continue.'
        });
        return;
      }
      const existing = customers.find(c => c.id === selectedCustId);
      if (existing) {
        custNameEn = existing.name;
        custNameAr = existing.name;
        custPhone = existing.phone;
        custEmail = existing.email || '';
        loyalty = existing.appointmentsCount > 10 ? 'VIP Gold' : 'Loyal Club';
        balance = Number(existing.walletBalance || existing.balance || 0);
      }
    } else {
      const trimmedWalkinName = walkinFullName.trim();
      const defaultWalkinLabel = isRtl ? 'عميل' : 'Customer';
      custNameEn = trimmedWalkinName || defaultWalkinLabel;
      custNameAr = trimmedWalkinName || defaultWalkinLabel;
      custPhone = walkinPhone.trim();
      custEmail = walkinEmail.trim() || '';
      loyalty = walkinIsVip ? 'Premium VIP' : 'Guest Account';
      balance = 0;
    }

    const splitCustomerName = (value: string) => {
      const normalized = `${value || ''}`.trim().replace(/\s+/g, ' ');
      if (!normalized) {
        return { firstName: isRtl ? 'عميل' : 'Customer', lastName: '' };
      }

      const parts = normalized.split(' ').filter(Boolean);
      if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
      }

      if (parts.length === 2) {
        return { firstName: parts[0], lastName: parts[1] };
      }

      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' ')
      };
    };

    const derivedCustomerName = `${custNameEn || custNameAr || ''}`.trim();
    const derivedCustomerNameParts = splitCustomerName(derivedCustomerName);

    const finalStaged = [...stagedServices];
    if (finalStaged.length === 0) {
      showBookingErrorDialog({
        titleAr: 'لا توجد خدمات محددة',
        titleEn: 'No service selected',
        bodyAr: 'يرجى إدراج خدمة واحدة على الأقل لتأكيد الحجز.',
        bodyEn: 'Please add at least one service before confirming the booking.'
      });
      return;
    }

    // Pre-validate staged services and guest services staff assignment using compatible staff resolver
    const staffResolution = resolveCompatibleStaffAssignments(finalStaged, availableStylists, canonicalServices);
    if (!staffResolution.success) {
      showBookingErrorDialog({
        titleAr: staffResolution.reason === 'explicit_overlap'
          ? 'تعارض في تعيين المختصين'
          : staffResolution.reason === 'no_qualified_staff'
          ? 'لا يوجد موظف مؤهل'
          : 'تعارض في توفر الموظفين للباقة المتزامنة',
        titleEn: staffResolution.reason === 'explicit_overlap'
          ? 'Specialist Scheduling Conflict'
          : staffResolution.reason === 'no_qualified_staff'
          ? 'No Qualified Professional'
          : 'Parallel Bundle Specialist Conflict',
        bodyAr: staffResolution.messageAr || 'تعذر إيجاد مختصين متاحين لجميع الخدمات في الوقت المحدد.',
        bodyEn: staffResolution.messageEn || 'Could not find compatible available professionals for all services at the selected time.'
      });
      return;
    }

    // Populate resolvedStaffId for unassigned services
    for (const item of finalStaged) {
      if (!item.isExplicitStaff && staffResolution.resolvedStaffMap.has(item.id)) {
        item.resolvedStaffId = staffResolution.resolvedStaffMap.get(item.id);
      }
    }

    if (includeGroupGuests) {
      for (const guest of guestsList) {
        for (const gs of guest.services) {
          const srv = canonicalServices.find(s => s.id === gs.serviceId);
          if (srv && srv.employeeAssignments) {
            const normalizedAssignments = srv.employeeAssignments.map(id => String(id));
            if (gs.staffId && !normalizedAssignments.includes(String(gs.staffId))) {
              setShowAssignWarning(true);
              return;
            }
          }
        }
      }
    }

    let totalRawPrice = 0;
    let serviceNamesEn: string[] = [];
    let serviceNamesAr: string[] = [];
    let firstStaffId = finalStaged[0].staffId;
    let earliestStartTime = finalStaged[0].startTime;
    let totalDuration = 0;

    // Pre-flight validation: 15-minute advance booking rule
    const earliestStartTimestamp = Math.min(...finalStaged.map(item => {
      const iso = getSyncedStagedStartIso(item);
      return new Date(iso).getTime();
    }));
    const nowTimestamp = Date.now();
    const MINIMUM_ADVANCE_MS = 15 * 60 * 1000;
    if (Number.isFinite(earliestStartTimestamp) && (earliestStartTimestamp < nowTimestamp + MINIMUM_ADVANCE_MS)) {
      const earliestItem = finalStaged[0];
      const slotLabel = formatMinutesToTime(
        typeof earliestItem?.startTime === 'number'
          ? earliestItem.startTime
          : currentStartTime
      );
      showBookingErrorDialog(buildAdvanceBookingDialog({
        isRtl,
        currentLabel: getRiyadhCurrentTimeLabel(),
        slotLabel
      }));
      addLocalToast(
        'يجب أن يكون وقت الحجز قبل الموعد بـ 15 دقيقة على الأقل.',
        'Appointments must be booked at least 15 minutes in advance.',
        'warning'
      );
      return;
    }

    finalStaged.forEach(item => {
      const srv = canonicalServices.find(s => s.id === item.serviceId);
      const variant = srv?.variants.find((entry) => entry.id === item.variantId) || srv?.variants[0] || null;
      if (srv) {
        let priceAfterDisc = variant?.finalPrice ?? srv.finalPrice ?? srv.price;
        if (item.discountType === 'flat') {
          priceAfterDisc = Math.max(0, priceAfterDisc - item.discountValue);
        } else if (item.discountType === 'percent') {
          priceAfterDisc = Math.max(0, priceAfterDisc - (priceAfterDisc * item.discountValue) / 100);
        }
        totalRawPrice += priceAfterDisc;
        serviceNamesEn.push(variant ? `${srv.nameEn} / ${variant.nameEn}` : srv.nameEn);
        serviceNamesAr.push(variant ? `${srv.nameAr} / ${variant.nameAr}` : srv.nameAr);
        totalDuration += resolveBookingDuration(item.duration, variant?.duration, srv.duration);
      }
    });

    // In Phase 1: group guest appointments are decoupled from single-client booking.
    // Phantom guest pricing is removed so ordinary invoice matches actual staged line items.
    const finalPrice = Math.max(0, totalRawPrice);

    const normalClosingMinutes = Math.max(0, Math.round(Number(normalEndHour ?? (boardStartHour + 8)))) * 60;

    const items: any[] = [];
    const groupedPackages = new Map<string, any>();

    finalStaged.forEach((item) => {
      const resolvedServiceId = `${item.serviceId || ''}`.trim();
      const service = canonicalServices.find(s => s.id === resolvedServiceId);
      const variant = service?.variants.find((entry) => entry.id === item.variantId) || service?.variants[0] || null;
      const requestStartIso = getSyncedStagedStartIso(item);
      const packageId = (item as any).packageId;
      const resolvedDuration = resolveBookingDuration(item.duration, variant?.duration, service?.duration);

      if (packageId) {
        const packageKey = item.packageInstanceId || `${packageId}_${(item as any).participantId || 'default'}`;
        if (!groupedPackages.has(packageKey)) {
          groupedPackages.set(packageKey, {
            itemType: 'package',
            packageId,
            packageInstanceId: item.packageInstanceId,
            participantId: (item as any).participantId || undefined,
            packageItems: [],
            notes: [],
            overtimeApproval: allowExtendedHours ? { approved: true } : undefined
          });
        }
        const pkgGroup = groupedPackages.get(packageKey);
        if (item.notes) pkgGroup.notes.push(item.notes);

        const effectiveStaffId = item.isExplicitStaff ? item.staffId : null;
        pkgGroup.packageItems.push({
          serviceId: resolvedServiceId,
          variantId: variant?.id || undefined,
          staffId: effectiveStaffId,
          requestedStaffId: item.isExplicitStaff ? item.staffId : null,
          startTime: requestStartIso,
          duration: resolvedDuration,
          assignmentMode: item.isExplicitStaff ? 'tenant_reassigned' : 'auto_assigned',
          packageItemId: (item as any).packageItemId || undefined,
          participantId: (item as any).participantId || undefined,
          overtimeApproval: item.overtimeApproval || (allowExtendedHours
            && (boardStartHour * 60) + item.startTime + Number(resolvedDuration || 0) > normalClosingMinutes
            ? { approved: true }
            : undefined)
        });
      } else {
        const effectiveStaffId = item.isExplicitStaff ? item.staffId : null;
        items.push({
          serviceId: resolvedServiceId,
          staffId: effectiveStaffId,
          requestedStaffId: item.isExplicitStaff ? item.staffId : null,
          startTime: requestStartIso,
          notes: item.notes || undefined,
          duration: resolvedDuration,
          price: variant ? toMoney(variant.finalPrice ?? variant.price) : (service ? toMoney(service.price) : 0),
          discountType: item.discountType,
          discountValue: item.discountValue,
          paymentMethod: 'at-center',
          assignmentMode: item.isExplicitStaff ? 'tenant_reassigned' : 'auto_assigned',
          variantId: variant?.id || undefined,
          participantId: (item as any).participantId || undefined,
          overtimeApproval: item.overtimeApproval || (allowExtendedHours
            && (boardStartHour * 60) + item.startTime + Number(resolvedDuration || 0) > normalClosingMinutes
            ? { approved: true }
            : undefined),
          serviceName: service ? (isRtl ? service.nameAr : service.nameEn) : undefined,
          variantName: variant ? (isRtl ? variant.nameAr : variant.nameEn) : undefined
        });
      }
    });

    groupedPackages.forEach((pkgGroup) => {
      pkgGroup.notes = pkgGroup.notes.join(' | ') || undefined;
      items.push(pkgGroup);
    });

    const resolvedPrimaryServiceId = `${items[0]?.serviceId || items[0]?.packageId || ''}`.trim();
    const resolvedPrimaryStaffId = `${firstStaffId || finalStaged[0]?.resolvedStaffId || currentStaffId || ''}`.trim();
    if (!resolvedPrimaryServiceId) {
      showBookingErrorDialog({
        titleAr: 'إعدادات خدمة غير صالحة',
        titleEn: 'Invalid service configuration',
        bodyAr: 'تعذر إكمال الحجز بسبب إعدادات الخدمة المحددة.',
        bodyEn: 'The booking cannot continue because the selected service configuration is invalid.'
      });
      return;
    }

    const finalChainEndMinutes = (boardStartHour * 60) + getBookingChainFinalEndMinutes(finalStaged);
    const extensionMinutes = finalChainEndMinutes - normalClosingMinutes;

    if (!allowExtendedHours && extensionMinutes > 0) {
      setBookingHoursDecisionDialog({
        extensionMinutes,
        onChooseAnotherDay: () => {
          setBookingHoursDecisionDialog(null);
          setCreateStep(2);
        },
        onExtendHours: () => {
          setBookingHoursDecisionDialog(null);
          void handleConfirmAppointmentCreation(true);
        },
        onCancel: () => setBookingHoursDecisionDialog(null)
      });
      return;
    }

    if (bookingScope === 'group') {
      const emptyParticipants = groupParticipants.filter(p => {
        const count = stagedServices.filter(s => (s.participantId || groupParticipants[0].id) === p.id).length;
        return count === 0;
      });
      if (emptyParticipants.length > 0) {
        addLocalToast(
          `يرجى إضافة خدمة واحدة على الأقل لكل مشارك (${emptyParticipants.map(p => p.name || 'مشارك').join(', ')})`,
          `Please add at least one service for each participant (${emptyParticipants.map(p => p.name || 'Participant').join(', ')})`,
          'warning'
        );
        return;
      }

      const missingNameParticipant = groupParticipants.find(p => !p.customerId && !p.name?.trim());
      if (missingNameParticipant) {
        addLocalToast(
          'يرجى إدخال اسم لكل مشارك في المجموعة',
          'Please enter a name for each participant in the group',
          'warning'
        );
        return;
      }
    }

    const executeFinalSubmission = async (itemsToSubmit: any[]) => {
      const formattedItems = itemsToSubmit.map(i => {
        if (i.itemType === 'package') {
          return {
            ...i,
            overtimeApproval: i.overtimeApproval || (allowExtendedHours ? { approved: true } : undefined),
            packageItems: (i.packageItems || []).map((c: any) => ({
              ...c,
              overtimeApproval: c.overtimeApproval || (allowExtendedHours ? { approved: true } : undefined)
            }))
          };
        }
        return {
          ...i,
          overtimeApproval: i.overtimeApproval || (allowExtendedHours ? { approved: true } : undefined)
        };
      });

    const payload: any = {
      items: formattedItems,
      skipAdvanceValidation: true,
      overtimeApproval: allowExtendedHours || itemsToSubmit.some(i => i.overtimeApproval?.approved) ? { approved: true } : undefined,
      staffId: finalStaged.some(i => i.isExplicitStaff) ? (finalStaged.find(i => i.isExplicitStaff)?.staffId || null) : null,
      startTime: buildIsoFromMinutes(selectedDate, earliestStartTime),
      notes: sessionNotes || finalStaged.map(s => s.notes).filter(Boolean).join(' | '),
      assignmentMode: finalStaged.some(i => i.isExplicitStaff) ? 'tenant_reassigned' : 'auto_assigned',
      notifyCustomer: notifyWhatsApp,
      paymentMethod: 'at-center',
      platformUserId: custMode === 'existing' ? selectedCustId : undefined,
      customer: custMode === 'walkin'
        ? {
            firstName: derivedCustomerNameParts.firstName,
            lastName: derivedCustomerNameParts.lastName || undefined,
            email: custEmail.trim() || undefined,
            phone: custPhone.trim() || undefined,
            gender: undefined,
            notes: undefined,
            isGuest: !walkinIsVip
          }
        : null
    };

    if (bookingScope === 'group') {
      const groupParticipantsPayload = groupParticipants.map((p, idx) => {
        const pItems = formattedItems.filter((i: any) => (i.participantId || groupParticipants[0].id) === p.id);
        const trimmedName = (p.name || '').trim();
        let firstName = trimmedName || `Participant ${idx + 1}`;
        let lastName = '';
        if (trimmedName.includes(' ')) {
          const parts = trimmedName.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
        return {
          participantId: p.id,
          isOrganizer: idx === 0,
          platformUserId: p.customerId || undefined,
          customer: p.customerId ? undefined : {
            firstName,
            lastName: lastName || undefined,
            phone: p.phone?.trim() || undefined,
            email: p.email?.trim() || undefined,
            isGuest: p.isGuest ?? true
          },
          items: pItems
        };
      });

      payload.sessionType = 'group';
      payload.groupName = groupName.trim() || (isRtl ? `مجموعة ${groupParticipants[0].name || 'العميل'}` : `${groupParticipants[0].name || 'Client'}'s Group`);
      payload.paymentArrangement = groupPaymentArrangement;
      payload.participants = groupParticipantsPayload;
    }

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

      await sharedExecuteSubmission(formattedItems, payload, {
        onSuccess: async () => {
          suppressAppointmentDraftPersistenceRef.current = true;
          resetAppointmentDraft();
          removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
          setAppointmentDraftPending(false);
          setShowAppointmentDraftPrompt(false);
          setIsCreateDrawerOpen(false);
          if (onBoardChanged) {
            await onBoardChanged();
          }
          addLocalToast(
            bookingScope === 'group'
              ? `تم حجز المجموعة "${payload.groupName || 'المجموعة'}" بنجاح وتوزيع المواعيد على المخطط! 👥🗓️`
              : `تم إدراج الموعد الجديد لـ ${custNameAr} بنجاح على مخطط لوحة التشغيل! 🗓️`,
            bookingScope === 'group'
              ? `Successfully scheduled group booking "${payload.groupName || 'Group'}"! 👥🗓️`
              : `Successfully scheduled new appointment for ${custNameEn}! 🗓️`,
            'success'
          );
        },
        onTooSoon: (meta) => {
          showBookingErrorDialog(buildAdvanceBookingDialog({
            isRtl,
            currentLabel: getRiyadhCurrentTimeLabel(),
            slotLabel: formatMinutesToTime(itemsToSubmit[0]?.startTime ? (typeof itemsToSubmit[0].startTime === 'string' && itemsToSubmit[0].startTime.includes('T') ? (new Date(itemsToSubmit[0].startTime).getHours() * 60 + new Date(itemsToSubmit[0].startTime).getMinutes()) : Number(itemsToSubmit[0].startTime)) : currentStartTime)
          }));
        },
        onConflict: async (itemsArg, meta) => {
          if (itemsArg.length > 1 || hasStructuredBookingDiagnostics(meta)) {
            if (!conflictDialog) {
              if (bookingRecoveryMode === 'separate_services') {
                await preflightSeparateServices(itemsArg, stagedServices, getLocalDateKey(selectedDate));
              } else {
                await preflightMultiServiceChain(itemsArg, stagedServices, getLocalDateKey(selectedDate), true);
              }
            } else {
              setConflictView(bookingRecoveryMode === 'separate_services' ? 'explanation' : 'time-selection');
            }
          } else {
            showBookingErrorDialog(buildSpecificConflictDialog(meta));
          }
        },
        onError: (err) => {
          const meta = extractBookingErrorMeta(err);
          if (meta.status === 409 || isBookingConflictError(meta)) {
            showBookingErrorDialog(buildSpecificConflictDialog(meta));
          } else {
            showBookingErrorDialog(buildGenericBookingErrorDialog());
          }
        }
      });
    } catch (err: any) {
      console.error('Failed to calculate payments or construct payload', err);
      showBookingErrorDialog(buildGenericBookingErrorDialog());
    }
  };

  void (async () => {
    executeFinalSubmissionRef.current = executeFinalSubmission;
    if (bookingScope !== 'group' && items.length > 1 && !allowExtendedHours) {
      if (bookingRecoveryMode === 'separate_services') {
        await preflightSeparateServices(items, stagedServices, getLocalDateKey(selectedDate));
      } else {
        await preflightMultiServiceChain(items, stagedServices, getLocalDateKey(selectedDate), false);
      }
    } else {
      await executeFinalSubmission(items);
    }
  })();
  };

  const handleConfirmBlockSubmit = async () => {
    try {
      const payload: any = {
        specificDate: getLocalDateKey(selectedDate),
        startTime: buildClockTime(blockStartTime),
        endTime: buildClockTime(blockStartTime + blockDuration),
        type: mapBlockPresetToBackendType(blockType),
        label: blockTitleEn,
        isRecurring: blockIsRecurring,
        referenceDate: getLocalDateKey(selectedDate)
      };

      if (blockIsRecurring) {
        payload.dayOfWeek = null;
        payload.startDate = getLocalDateKey(selectedDate);
        if (blockEndDate) {
          payload.endDate = blockEndDate;
        }
      }

      const response = existingBreak?.id
        ? await tenantApiAdapter.updateEmployeeBreak(blockStaffId || existingBreak.staffId || '', existingBreak.id, payload)
        : await tenantApiAdapter.createEmployeeBreak(blockStaffId, payload);

      if (!response?.success) {
        throw new Error(response?.message || (existingBreak?.id ? 'Failed to update blocked time' : 'Failed to create blocked time'));
      }

      resetAppointmentDraft();
      removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
      setAppointmentDraftPending(false);
      setShowAppointmentDraftPrompt(false);
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

      resetAppointmentDraft();
      removeDraftStorage(APPOINTMENT_DRAFT_STORAGE_KEY);
      setAppointmentDraftPending(false);
      setShowAppointmentDraftPrompt(false);
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
      nameAr: `بطاقة هدايا فاخرة من ${gcSender || 'عميلة بارسبا'} لـ ${gcRecipient || 'شخص عزيز'}`,
      nameEn: `Luxury Gift Card from ${gcSender || 'BarSpa Guest'} to ${gcRecipient || 'Dear Guest'}`,
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
    let customerId: string | undefined = undefined;
    let customerEmail: string | undefined = undefined;
    let customerPhone: string | undefined = undefined;

    if (posCustMode === 'existing') {
      const cust = customers.find(c => c.id === posSelectedCustId);
      if (!cust) {
        addLocalToast('يجب اختيار عميل مسجل من القائمة', 'You must select a registered customer from the list', 'warning');
        return;
      }
      buyerName = cust.name;
      customerId = cust.id;
    } else if (posCustMode === 'walkin' && posWalkinName) {
      buyerName = posWalkinName;
      customerEmail = posWalkinEmail || undefined;
      customerPhone = posWalkinPhone || undefined;
    }

    const checkoutPayload = {
      posCustMode,
      posSelectedCustId,
      customerId,
      customerName: buyerName
    };
    console.log('[POS Checkout Debug]', checkoutPayload);

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = total - (total / 1.15);
    const subtotal = total - vat;

    let canonicalPaymentMethod = 'card_pos';
    let paymentMethodSummary = isRtl ? 'طرق الدفع' : 'Payment methods';
    let allocationsArray: any[] | undefined = undefined;

    if (posSplitActive) {
      allocationsArray = [];
      const parts = [];
      if (posSplitAmounts.card > 0) {
        allocationsArray.push({ paymentMethod: 'card_pos', amount: posSplitAmounts.card });
        parts.push(`Card: ${posSplitAmounts.card} ر.س`);
      }
      if (posSplitAmounts.cash > 0) {
        allocationsArray.push({ paymentMethod: 'cash', amount: posSplitAmounts.cash });
        parts.push(`نقداً: ${posSplitAmounts.cash} ر.س`);
      }
      if (posSplitAmounts.wallet > 0) {
        allocationsArray.push({ paymentMethod: 'wallet', amount: posSplitAmounts.wallet });
        parts.push(`المحفظة: ${posSplitAmounts.wallet} ر.س`);
      }
      paymentMethodSummary = parts.join(' | ');
      if (allocationsArray.length > 0) {
        canonicalPaymentMethod = allocationsArray[0].paymentMethod;
      }
    } else {
      paymentMethodSummary = isRtl ? 'مدفوع بالكامل بالبطاقة الرقمية' : 'Paid in full via credit card terminal';
      canonicalPaymentMethod = 'card_pos';
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
          paymentMethod: canonicalPaymentMethod,
          paymentAllocations: allocationsArray,
          notes: paymentMethodSummary
        });
        if (prodRes.orderId || prodRes.transactionRef) orderId = prodRes.orderId || prodRes.transactionRef;
      }

      const collectedRedeemCodes: Record<string, string[]> = {};

      if (giftCardItems.length > 0) {
        for (const gc of giftCardItems) {
          collectedRedeemCodes[gc.id] = [];
          for (let q = 0; q < (gc.quantity || 1); q++) {
            const gcRes = await tenantApiAdapter.checkoutGiftCards({
              packageId: gc.packageId || gc.id,
              amount: gc.price,
              customerId,
              customerName: buyerName,
              customerEmail,
              customerPhone,
              paymentMethod: canonicalPaymentMethod,
              paymentAllocations: allocationsArray,
              notes: paymentMethodSummary
            });
            if (gcRes.orderId || gcRes.transactionRef || gcRes.transaction?.id) {
              orderId = gcRes.orderId || gcRes.transactionRef || gcRes.transaction?.id;
            }
            if (gcRes.externalRedeemCode) {
              collectedRedeemCodes[gc.id].push(gcRes.externalRedeemCode);
            }
          }
        }
      }

      const completedReceiptItems = cartItems.map(it => {
        if (it.type === 'giftcard') {
          if (collectedRedeemCodes[it.id] && collectedRedeemCodes[it.id].length > 0) {
            return { ...it, skuOrCode: collectedRedeemCodes[it.id].join(', ') };
          } else {
            return { ...it, skuOrCode: 'تم إضافة الرصيد للمحفظة / Wallet credited' };
          }
        }
        return it;
      });

      const completedReceipt = {
        orderId: orderId,
        date: (() => {
          const tzParts = getDatePartsInTimeZone(new Date(), resolvedTenantTimezone);
          return `${tzParts.year}-${tzParts.month}-${tzParts.day} ${tzParts.hour}:${tzParts.minute}`;
        })(),
        customerName: buyerName,
        items: completedReceiptItems,
        subtotal,
        vat,
        total,
        paymentSummary: paymentMethodSummary
      };

      resetCartDraft();
      removeDraftStorage(CART_DRAFT_STORAGE_KEY);
      setCartDraftPending(false);
      setShowCartDraftPrompt(false);
      setCompletedOrder(completedReceipt);
      setPosCheckoutComplete(true);

      if (onBoardChanged) {
        await onBoardChanged();
      }

      addLocalToast(
        'تمت فوترة المبيعات وتأكيد السداد بنجاح! 🧾',
        'POS Sale billed and settled successfully! 🧾',
        'success'
      );
    } catch (err: any) {
      console.error('POS Checkout failed', err);
      addLocalToast('خطأ في إتمام الطلب: ' + (err.message || ''), 'POS Checkout error', 'warning');
    }
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
              onClick={handleRequestDismissCreateDrawer}
            />

            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full ${
                createMode === 'appointment' ? 'max-w-4xl lg:max-w-6xl xl:max-w-7xl' : 'max-w-3xl'
              } h-screen bg-slate-50 shadow-2xl flex flex-col z-10 overflow-hidden ${
                isRtl ? 'border-r border-slate-200' : 'border-l border-slate-200'
              }`}
            >
              <AnimatePresence>
                {showDiscardConfirmDialog && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[95] flex items-center justify-center bg-zinc-950/65 px-4 backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelDiscard();
                    }}
                  >
                    <div
                      className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl bg-rose-500/10 p-2.5 text-rose-600">
                          <AlertTriangle size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-black text-slate-900">
                            {isRtl ? 'تجاهل التغييرات غير المحفوظة؟' : 'Discard unsaved changes?'}
                          </h4>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {isRtl
                              ? 'لديك تغييرات غير محفوظة في هذا الحجز. إذا غادرت الآن، فسيتم إلغاء جميع التعديلات والبيانات المدخلة بشكل نهائي.'
                              : 'You have unsaved changes in this draft. Leaving now will discard all entered details and reset the appointment form.'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleCancelDiscard}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          {isRtl ? 'متابعة التعديل' : 'Keep editing'}
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmDiscardAndLeave}
                          className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm"
                        >
                          {isRtl ? 'تجاهل ومغادرة' : 'Discard and leave'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showAppointmentDraftPrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[80] flex items-center justify-center bg-zinc-950/55 px-4 backdrop-blur-sm"
                  >
                    <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white p-6 shadow-2xl">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl bg-amber-500/10 p-2 text-amber-600">
                          <AlertTriangle size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                            {isRtl ? 'جلسة مسودة غير مكتملة' : 'Unfinished draft session'}
                          </p>
                          <h4 className="mt-1 text-lg font-black text-slate-900">
                            {isRtl
                              ? `لديك ${appointmentDraftTypeLabel} غير مكتمل`
                              : `You have an unfinished ${appointmentDraftTypeLabel}`}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {isRtl
                              ? 'بدأت العملية سابقاً ولم تكتمل. هل تريد المتابعة من حيث توقفت أم تجاهل المسودة وبدء عملية جديدة؟'
                              : 'You started this workflow earlier but did not complete it. Would you like to continue where you left off or discard the draft and start a fresh one?'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleDiscardAppointmentDraft}
                          className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                        >
                          {isRtl ? 'تجاهل وبدء جديد' : 'Discard & Start New'}
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueAppointmentDraft}
                          className="rounded-full bg-[#6537C0] hover:bg-[#532ab0] px-5 py-2.5 text-sm font-bold text-white transition shadow-sm"
                        >
                          {isRtl ? 'متابعة المسودة' : 'Continue'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header */}
              <div className="p-5 bg-[#1D035F] text-white flex items-center justify-between border-b border-[#A379E2]/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#6537C0] rounded-xl text-white shadow-xs">
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
                      : (isRtl ? 'جدولة الخدمات والخصومات وتخصيص الدفع لعملاء بارسبا الفاخر' : 'Schedule luxury services, client profiles, and payment allocations')}
                  </p>
                </div>
                <button
                  onClick={handleRequestDismissCreateDrawer}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
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
                      createMode === 'appointment' ? 'bg-[#6537C0] text-white shadow-sm' : 'text-slate-600 hover:text-[#1D035F]'
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
                      createMode === 'blocked' ? 'bg-[#6537C0] text-white shadow-sm' : 'text-slate-600 hover:text-[#1D035F]'
                    }`}
                  >
                    {isRtl ? 'حظر فترة زمنية / استراحة' : 'Block Time / Break'}
                  </button>
                </div>
              </div>

              {createMode === 'appointment' ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  {/* Mobile Navigation Header: Switcher between Booking/Invoice and Service Catalogue (hidden on desktop) */}
                  <div className="lg:hidden flex border-b border-slate-200 bg-white select-none shrink-0">
                    <button
                      type="button"
                      onClick={() => setMobileDrawerTab('booking')}
                      className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                        mobileDrawerTab === 'booking'
                          ? 'border-[#6537C0] text-[#6537C0] bg-purple-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>{isRtl ? 'تفاصيل الموعد والفاتورة' : 'Booking & Invoice'}</span>
                      {stagedServices.length > 0 && (
                        <span className="bg-[#6537C0] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                          {stagedServices.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileDrawerTab('catalogue')}
                      className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                        mobileDrawerTab === 'catalogue'
                          ? 'border-[#6537C0] text-[#6537C0] bg-purple-50/40'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                      <span>{isRtl ? 'كتالوج الخدمات' : 'Service Catalogue'}</span>
                    </button>
                  </div>

                  {/* Two-Column Responsive Workspace: Side-by-side on lg+ screens */}
                  <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                    
                    {/* COLUMN 1: Booking Details, Customer, Queued Services, Progressive Disclosure & Persistent Invoice */}
                    <div className={`w-full lg:w-[480px] xl:w-[500px] shrink-0 border-e border-slate-200 flex flex-col h-full bg-slate-50 min-h-0 overflow-hidden ${
                      mobileDrawerTab !== 'booking' ? 'hidden lg:flex' : 'flex'
                    }`}>
                      {/* Scrollable upper body */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                        
                        {/* Phase 5A: Booking Scope Switcher (Single Client vs Group Booking) */}
                        <div className="flex bg-slate-200/80 p-1 rounded-2xl gap-1">
                          <button
                            type="button"
                            onClick={() => setBookingScope('single')}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              bookingScope === 'single'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'حجز فردي' : 'Single Client'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setBookingScope('group');
                              const primaryName = custMode === 'existing' ? (selectedRegisteredCustomer?.name || '') : walkinFullName;
                              if (primaryName && groupParticipants.length > 0 && !groupParticipants[0].name) {
                                setGroupParticipants(prev => prev.map((p, idx) => idx === 0 ? { ...p, name: primaryName } : p));
                              }
                            }}
                            className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              bookingScope === 'group'
                                ? 'bg-[#6537C0] text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{isRtl ? 'حجز جماعي (مجموعة)' : 'Group Booking'}</span>
                            {bookingScope === 'group' && (
                              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                                {groupParticipants.length}
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Group Booking Configuration & Payment Arrangement */}
                        {bookingScope === 'group' && (
                          <div className="rounded-[20px] border border-purple-200 bg-purple-50/40 p-4 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-[#6537C0]" />
                                <span className="text-xs font-bold text-slate-900">
                                  {isRtl ? 'إعدادات الحجز الجماعي' : 'Group Booking Settings'}
                                </span>
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-mono">
                                {groupParticipants.length} {isRtl ? 'مشاركين' : 'Participants'}
                              </span>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                {isRtl ? 'اسم المجموعة / المناسبة' : 'Group / Occasion Name'}
                              </label>
                              <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder={isRtl ? 'مثال: حفل زفاف سارة، عائلة الخالد...' : 'e.g. Bridal Party, Family...'}
                                className="w-full rounded-xl border border-purple-200 bg-white p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                {isRtl ? 'ترتيب الدفع المالي' : 'Payment Arrangement'}
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => setGroupPaymentArrangement('organizer_pays')}
                                  className={`p-2.5 rounded-xl border text-start text-xs font-bold transition cursor-pointer ${
                                    groupPaymentArrangement === 'organizer_pays'
                                      ? 'border-[#6537C0] bg-white text-[#6537C0] ring-1 ring-[#6537C0]'
                                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span>👑</span>
                                    <span>{isRtl ? 'المنظم يدفع عن الجميع' : 'Organizer Pays for All'}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                    {isRtl ? 'فاتورة موحدة وحساب إجمالي واحد' : 'Single consolidated invoice'}
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setGroupPaymentArrangement('individual_pays')}
                                  className={`p-2.5 rounded-xl border text-start text-xs font-bold transition cursor-pointer ${
                                    groupPaymentArrangement === 'individual_pays'
                                      ? 'border-[#6537C0] bg-white text-[#6537C0] ring-1 ring-[#6537C0]'
                                      : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 font-bold">
                                    <span>👤</span>
                                    <span>{isRtl ? 'كل مشارك يدفع بشكل مستقل' : 'Each Pays Individually'}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-normal mt-0.5">
                                    {isRtl ? 'حساب ومطالبة دفع منفصلة لكل شخص' : 'Independent payment per client'}
                                  </p>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Group Participant Management & Tab Switcher */}
                        {bookingScope === 'group' && (
                          <div className="rounded-[20px] border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {isRtl ? 'المشاركون في الحجز' : 'Participants'}
                              </span>
                              <button
                                type="button"
                                onClick={handleAddGroupParticipant}
                                className="inline-flex items-center gap-1 text-xs font-bold text-[#6537C0] hover:text-[#532ab0] px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 transition cursor-pointer"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>{isRtl ? 'إضافة مشارك' : 'Add Participant'}</span>
                              </button>
                            </div>

                            {/* Participant selection tabs */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                              {groupParticipants.map((participant, pIdx) => {
                                const isActive = activeParticipantId === participant.id;
                                const pServices = stagedServices.filter(s => (s.participantId || groupParticipants[0].id) === participant.id);
                                const displayName = pIdx === 0
                                  ? (participant.name || (isRtl ? 'المنظم' : 'Organizer'))
                                  : (participant.name || `${isRtl ? 'مشارك' : 'Participant'} ${pIdx + 1}`);

                                return (
                                  <div
                                    key={participant.id}
                                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shrink-0 cursor-pointer ${
                                      isActive
                                        ? 'border-[#6537C0] bg-purple-50 text-[#6537C0] shadow-2xs'
                                        : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-slate-100'
                                    }`}
                                    onClick={() => setActiveParticipantId(participant.id)}
                                  >
                                    <span>{pIdx === 0 ? '👑 ' : ''}{displayName}</span>
                                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                                      isActive ? 'bg-[#6537C0] text-white' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {pServices.length}
                                    </span>
                                    {pIdx > 0 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveGroupParticipant(participant.id);
                                        }}
                                        className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer ms-1"
                                        title={isRtl ? 'حذف المشارك' : 'Remove participant'}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Non-organizer quick profile editor */}
                            {activeParticipantId !== groupParticipants[0].id && (() => {
                              const activePart = groupParticipants.find(p => p.id === activeParticipantId);
                              if (!activePart) return null;
                              return (
                                <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                        {isRtl ? 'اسم المشارك' : 'Participant Name'}
                                      </label>
                                      <input
                                        type="text"
                                        value={activePart.name}
                                        onChange={(e) => handleUpdateGroupParticipant(activePart.id, { name: e.target.value })}
                                        placeholder={isRtl ? 'اسم الضيف...' : 'Guest Name...'}
                                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#6537C0]"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                        {isRtl ? 'رقم الجوال (اختياري)' : 'Phone (Optional)'}
                                      </label>
                                      <input
                                        type="tel"
                                        value={activePart.phone || ''}
                                        onChange={(e) => handleUpdateGroupParticipant(activePart.id, { phone: e.target.value })}
                                        placeholder="05XXXXXXXX"
                                        className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono text-slate-900 outline-none focus:border-[#6537C0]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* 1. Customer Identification Card */}
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {isRtl ? (bookingScope === 'group' ? '👑 بيانات منظم الحجز (المشارك 1)' : 'بيانات العميل') : (bookingScope === 'group' ? '👑 Booking Organizer Profile (Participant 1)' : 'Client Profile')}
                            </span>
                            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                              {([
                                { key: 'existing', icon: User, labelEn: 'Registered', labelAr: 'مسجل' },
                                { key: 'walkin', icon: Users, labelEn: 'Walk-in', labelAr: 'زائر' }
                              ] as const).map((mode) => {
                                const Icon = mode.icon;
                                const active = custMode === mode.key;
                                return (
                                  <button
                                    key={mode.key}
                                    type="button"
                                    onClick={() => setCustMode(mode.key)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                                      active
                                        ? 'bg-[#6537C0] text-white shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    <span>{isRtl ? mode.labelAr : mode.labelEn}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {custMode === 'existing' ? (
                            <div className="space-y-2.5">
                              {selectedRegisteredCustomer ? (
                                <div className="space-y-2">
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-200 text-sm font-black text-emerald-700 shadow-2xs">
                                        {`${selectedRegisteredCustomer.name || 'U'}`.trim().charAt(0).toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold text-slate-900">
                                          {selectedRegisteredCustomer.name}
                                        </p>
                                        <p className="truncate text-xs font-mono text-slate-600">
                                          {selectedRegisteredCustomer.phone || selectedRegisteredCustomer.email || (isRtl ? 'عميل مسجل' : 'Registered customer')}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCustId('')}
                                      className="shrink-0 text-xs font-bold text-[#6537C0] hover:underline px-2 py-1 cursor-pointer"
                                    >
                                      {isRtl ? 'تغيير' : 'Change'}
                                    </button>
                                  </div>

                                  <CustomerBookingHistory
                                    customerId={selectedRegisteredCustomer.id}
                                    customerName={selectedRegisteredCustomer.name}
                                    isRtl={isRtl}
                                    onRebook={handleRebookAppointment}
                                  />
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="relative">
                                    <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
                                    <input
                                      ref={registeredCustomerSearchRef}
                                      type="text"
                                      value={customerSearch}
                                      onChange={(e) => setCustomerSearch(e.target.value)}
                                      placeholder={isRtl ? 'ابحث باسم العميل أو رقم الجوال...' : 'Search by name or phone...'}
                                      className={`w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-900 outline-none transition focus:border-[#6537C0] focus:ring-2 focus:ring-[#6537C0]/15 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                                    />
                                  </div>

                                  <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                                    {filteredCustomers.length > 0 ? (
                                      filteredCustomers.slice(0, 15).map((customer) => (
                                        <button
                                          key={customer.id}
                                          type="button"
                                          onClick={() => setSelectedCustId(customer.id)}
                                          className="flex w-full items-center justify-between px-3 py-2 text-start text-xs hover:bg-slate-50 transition cursor-pointer"
                                        >
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-900 truncate">{customer.name}</p>
                                            <p className="text-[11px] font-mono text-slate-500 truncate">{customer.phone}</p>
                                          </div>
                                          <Check className="h-3.5 w-3.5 text-slate-300" />
                                        </button>
                                      ))
                                    ) : (
                                      <p className="p-3 text-center text-xs text-slate-400">
                                        {isRtl ? 'لا توجد نتائج مطابقة.' : 'No matching customers found.'}
                                      </p>
                                    )}
                                  </div>

                                  {identityValidationError && !selectedCustId && (
                                    <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                      <span>{isRtl ? 'يرجى اختيار عميل من القائمة أو التبديل إلى زائر.' : 'Please select a customer or switch to Walk-in.'}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Walk-In Mode */
                            <div className="space-y-2.5">
                              <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-2.5 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-violet-900 flex items-center gap-1">
                                    <span>⚡</span>
                                    <span>{isRtl ? 'تسجيل زائر سريع' : 'Fast Walk-In Active'}</span>
                                  </p>
                                  <p className="text-[11px] text-violet-700/80">
                                    {isRtl ? 'الاسم والجوال اختياريان؛ سيتم استخدام عميل افتراضي.' : 'Name & phone optional; default profile created.'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    {isRtl ? 'الاسم الكامل (اختياري)' : 'Name (Optional)'}
                                  </label>
                                  <input
                                    ref={walkinNameRef}
                                    type="text"
                                    value={walkinFullName}
                                    onChange={(e) => setWalkinFullName(e.target.value)}
                                    placeholder={isRtl ? 'عميل زائر' : 'Walk-in Customer'}
                                    className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6537C0] ${isRtl ? 'text-right' : 'text-left'}`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    {isRtl ? 'رقم الجوال (اختياري)' : 'Phone (Optional)'}
                                  </label>
                                  <input
                                    type="text"
                                    value={walkinPhone}
                                    onChange={(e) => setWalkinPhone(e.target.value)}
                                    placeholder={isRtl ? '+966 50...' : '+966 50...'}
                                    className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-[#6537C0] ${isRtl ? 'text-right' : 'text-left'}`}
                                  />
                                </div>
                              </div>

                              <label className="flex items-center gap-2 pt-0.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={walkinIsVip}
                                  onChange={(e) => setWalkinIsVip(e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 accent-[#6537C0]"
                                />
                                <span className="text-xs font-bold text-slate-700">
                                  {isRtl ? 'عميل مميز VIP 👑' : 'VIP Client 👑'}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>

                        {/* 2. Queued / Staged Services Section */}
                        <div className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                                {bookingScope === 'group'
                                  ? (isRtl ? `الخدمات المحددة لـ: ${activeParticipantName}` : `Queued Services: ${activeParticipantName}`)
                                  : (isRtl ? 'الخدمات المحددة في الجلسة' : 'Queued Services')}
                              </h4>
                              <span className="rounded-full bg-[#6537C0]/10 px-2 py-0.5 text-[10px] font-black text-[#6537C0]">
                                {bookingScope === 'group' ? activeParticipantItemsCount : stagedServices.length}
                              </span>
                            </div>

                            {/* Mobile button to open catalogue */}
                            <button
                              type="button"
                              onClick={() => setMobileDrawerTab('catalogue')}
                              className="lg:hidden text-xs font-bold text-[#6537C0] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{isRtl ? '+ إضافة خدمات' : '+ Add Services'}</span>
                            </button>
                          </div>

                          {/* Recovery mode indicator if active */}
                          {bookingRecoveryMode === 'separate_services' && stagedServices.length > 1 && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                              {isRtl
                                ? `سيتم إنشاء ${stagedServices.length} مواعيد منفصلة عند التأكيد النهائي.`
                                : `${stagedServices.length} separate appointments will be created when confirmed.`}
                            </div>
                          )}

                          {/* Phase 3: Smart Availability Section */}
                          {stagedServices.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFindingAvailableTimes(prev => !prev);
                                    if (!isFindingAvailableTimes) {
                                      loadSmartAvailability(smartAvailabilityDate, isCheckingAllProfessionals);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs border ${
                                    isFindingAvailableTimes
                                      ? 'border-[#6537C0] bg-[#6537C0] text-white'
                                      : 'border-purple-200 bg-purple-50 hover:bg-purple-100 text-[#6537C0]'
                                  }`}
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    {isFindingAvailableTimes
                                      ? (isRtl ? 'إخفاء الأوقات المتاحة' : 'Hide Available Times')
                                      : (isRtl ? 'البحث عن أوقات متاحة' : 'Find Available Times')}
                                  </span>
                                </button>
                                {isFindingAvailableTimes && (
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {isRtl ? 'حساب التوافر الذكي' : 'Availability-led booking'}
                                  </span>
                                )}
                              </div>

                              {isFindingAvailableTimes && (
                                <SmartAvailabilityPicker
                                  isRtl={isRtl}
                                  smartAvailabilityDate={smartAvailabilityDate}
                                  onDateChange={(newDate) => {
                                    setSmartAvailabilityDate(newDate);
                                    if (setSelectedDate) {
                                      setSelectedDate(newDate);
                                    }
                                    loadSmartAvailability(newDate, isCheckingAllProfessionals);
                                  }}
                                  currentStartTime={currentStartTime}
                                  formatMinutesToTime={formatMinutesToTime}
                                  isCheckingAllProfessionals={isCheckingAllProfessionals}
                                  onToggleCheckAllProfessionals={() => {
                                    const nextVal = !isCheckingAllProfessionals;
                                    setIsCheckingAllProfessionals(nextVal);
                                    loadSmartAvailability(smartAvailabilityDate, nextVal);
                                  }}
                                  loading={smartAvailabilityLoading}
                                  summary={smartAvailabilitySummary}
                                  nextAlternative={nextAvailableAlternative}
                                  isSearchingNextDate={isSearchingNextDate}
                                  onSelectSlot={handleSelectSmartSlot}
                                  onJumpToNextDate={handleJumpToNextDate}
                                  onClose={() => setIsFindingAvailableTimes(false)}
                                />
                              )}
                            </div>
                          )}

                          {activeParticipantItemsCount === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-2">
                              <div className="w-10 h-10 rounded-full bg-purple-50 text-[#6537C0] flex items-center justify-center mx-auto">
                                <Sparkles className="w-5 h-5" />
                              </div>
                              <p className="text-xs font-bold text-slate-700">
                                {bookingScope === 'group'
                                  ? (isRtl ? `لم يتم اختيار أي خدمات لـ ${activeParticipantName} بعد` : `No services queued for ${activeParticipantName} yet`)
                                  : (isRtl ? 'لم يتم اختيار أي خدمات بعد' : 'No services queued yet')}
                              </p>
                              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                                {isRtl
                                  ? 'اختر الخدمات أو الباقات من الكتالوج لإضافتها إلى جدول الموعد.'
                                  : 'Select services or bundles from the catalogue on the right to start building the appointment.'}
                              </p>
                              <button
                                type="button"
                                onClick={() => setMobileDrawerTab('catalogue')}
                                className="lg:hidden mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#6537C0] text-white text-xs font-bold cursor-pointer"
                              >
                                {isRtl ? 'تصفح الكتالوج' : 'Browse Catalogue'}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Staged Bundles Groups */}
                              {displayedPackageCartItems.map((pkgItem) => {
                                const pkg = services2Bundles?.find(p => p.id === pkgItem.packageId) || servicePackages?.find(p => p.id === pkgItem.packageId);
                                const isParallel = pkg?.scheduleType === 'parallel';

                                return (
                                  <div key={pkgItem.id} className="rounded-xl border border-purple-200 bg-purple-50/30 p-3 space-y-2.5">
                                    <div className="flex items-start justify-between gap-2 border-b border-purple-100 pb-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded uppercase">
                                            BUNDLE
                                          </span>
                                          {isParallel && (
                                            <span className="text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded uppercase">
                                              PARALLEL
                                            </span>
                                          )}
                                          <h5 className="font-bold text-slate-900 text-xs truncate">{pkgItem.serviceName}</h5>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-purple-600" />
                                            <select
                                              value={formatBlockStartClockValue(pkgItem.startTime)}
                                              onChange={(e) => {
                                                const offset = convertBlockClockToOffset(e.target.value);
                                                if (pkgItem.childItems && pkgItem.childItems.length > 0) {
                                                  handleUpdateStagedService(pkgItem.childItems[0].id, { startTime: offset });
                                                }
                                              }}
                                              className="rounded border border-purple-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-purple-900 outline-none"
                                              title={isRtl ? 'تعديل وقت بدء الباقة' : 'Edit bundle start time'}
                                            >
                                              {blockStartTimeOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <p className="text-[11px] text-slate-500 font-semibold">
                                            <span>{pkgItem.price.toFixed(2)} SAR</span>
                                            {' · '}
                                            <span>{pkgItem.duration} {isRtl ? 'دقيقة' : 'min'}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setStagedServices(prev => removeBundleFromStagedServices(prev, pkgItem.id));
                                        }}
                                        className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                        title={isRtl ? 'إزالة الباقة' : 'Remove Bundle'}
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Child steps in bundle */}
                                    <div className="space-y-2 pt-1">
                                      {pkgItem.childItems.map((cItem) => {
                                        const cSrv = canonicalServices.find(s => s.id === cItem.serviceId);
                                        const cStylists = availableStylists.filter(s => {
                                          const assignments = cSrv?.employeeAssignments || [];
                                          return assignments.length === 0 || assignments.map(String).includes(String(s.id));
                                        });

                                        return (
                                          <div key={cItem.id} className="rounded-lg bg-white border border-purple-100 p-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="font-semibold text-slate-800 text-[11px] truncate">
                                                {cSrv ? (isRtl ? cSrv.nameAr : cSrv.nameEn) : cItem.serviceId}
                                              </p>
                                              <p className="text-[10px] text-slate-400 font-mono">
                                                {formatMinutesToTime(cItem.startTime)} · {cItem.duration} min
                                              </p>
                                              <ResourceBadgeList
                                                requirements={resolveEffectiveServiceRequirements(cSrv, cItem.variantId)}
                                                availability={resourceAvailabilityMap[cItem.id]}
                                                isLoading={isCheckingResources}
                                                isRtl={isRtl}
                                                compact
                                              />
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                              <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-purple-500" />
                                                <select
                                                  value={formatBlockStartClockValue(cItem.startTime)}
                                                  onChange={(e) => {
                                                    const offset = convertBlockClockToOffset(e.target.value);
                                                    handleUpdateStagedService(cItem.id, { startTime: offset });
                                                  }}
                                                  className="rounded border border-purple-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-purple-900 outline-none"
                                                  title={isRtl ? 'تعديل وقت بدء الخدمة' : 'Edit service start time'}
                                                >
                                                  {blockStartTimeOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                  ))}
                                                </select>
                                              </div>
                                              <select
                                                value={cItem.staffId || ''}
                                                onChange={(e) => {
                                                  const newStaff = e.target.value;
                                                  handleUpdateStagedService(cItem.id, {
                                                    staffId: newStaff,
                                                    isExplicitStaff: Boolean(newStaff)
                                                  });
                                                }}
                                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none"
                                              >
                                                <option value="">{isRtl ? 'أي مختص متاح' : 'Any Stylist'}</option>
                                                {cStylists.map(st => (
                                                  <option key={st.id} value={st.id}>{isRtl ? st.nameAr : st.nameEn}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Standalone Staged Services */}
                              {displayedStandaloneCartItems.map((item) => {
                                const srv = canonicalServices.find(s => s.id === item.serviceId);
                                const validStylists = availableStylists.filter(s => {
                                  const assignments = srv?.employeeAssignments || [];
                                  return assignments.length === 0 || assignments.map(String).includes(String(s.id));
                                });
                                const isConfiguring = configuredServiceId === item.id;

                                return (
                                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-2">
                                    <div
                                      className="flex items-start justify-between gap-2 cursor-pointer select-none"
                                      onClick={() => setConfiguredServiceId(isConfiguring ? null : item.id)}
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-bold text-slate-900 text-xs truncate">{item.serviceName}</p>
                                          {isConfiguring && (
                                            <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-1 py-0.2 rounded">
                                              {isRtl ? 'قيد التعديل' : 'Configuring'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-semibold">
                                          <span className="font-mono text-purple-700 bg-purple-100/60 px-1 py-0.2 rounded text-[10px]">
                                            {formatMinutesToTime(item.startTime)}
                                          </span>
                                          <span>·</span>
                                          <span>{item.duration} {isRtl ? 'دقيقة' : 'min'}</span>
                                        </div>
                                        <ResourceBadgeList
                                          requirements={resolveEffectiveServiceRequirements(srv, item.variantId)}
                                          availability={resourceAvailabilityMap[item.id]}
                                          isLoading={isCheckingResources}
                                          isRtl={isRtl}
                                          compact
                                        />
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <div className="text-right">
                                          <span className="font-mono font-bold text-slate-900 text-xs">
                                            {item.price.toFixed(2)} SAR
                                          </span>
                                          {item.hasDiscount && (
                                            <span className="block font-mono text-[9px] text-slate-400 line-through">
                                              {item.basePrice.toFixed(2)} SAR
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setConfiguredServiceId(isConfiguring ? null : item.id)}
                                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                                            isConfiguring ? 'bg-purple-100 text-[#6537C0]' : 'text-slate-400 hover:bg-slate-200'
                                          }`}
                                          title={isRtl ? 'إعدادات الخصم والملاحظات' : 'Configure service'}
                                        >
                                          <Settings2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setStagedServices(prev => prev.filter(s => s.id !== item.id))}
                                          className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                                          title={isRtl ? 'إزالة' : 'Remove'}
                                        >
                                          <Trash className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Stylist Selector & Time offset */}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                          {isRtl ? 'المختص:' : 'Stylist:'}
                                        </span>
                                        <select
                                          value={item.staffId || ''}
                                          onChange={(e) => {
                                            const newStaff = e.target.value;
                                            handleUpdateStagedService(item.id, {
                                              staffId: newStaff,
                                              isExplicitStaff: Boolean(newStaff)
                                            });
                                          }}
                                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none max-w-[150px] truncate"
                                        >
                                          <option value="">{isRtl ? 'أي مختص متاح' : 'Any Stylist'}</option>
                                          {validStylists.map(st => (
                                            <option key={st.id} value={st.id}>{isRtl ? st.nameAr : st.nameEn}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <select
                                          value={formatBlockStartClockValue(item.startTime)}
                                          onChange={(e) => {
                                            const offset = convertBlockClockToOffset(e.target.value);
                                            handleUpdateStagedService(item.id, { startTime: offset });
                                          }}
                                          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 outline-none"
                                        >
                                          {blockStartTimeOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    {/* Inline Service Configuration Drawer (Discount & Notes) */}
                                    {isConfiguring && (
                                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 bg-white p-2.5 rounded-lg">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-bold text-slate-500">
                                            {isRtl ? 'نوع الخصم:' : 'Discount:'}
                                          </span>
                                          <select
                                            value={item.discountType || 'none'}
                                            onChange={(e) => {
                                              const newType = e.target.value;
                                              handleUpdateStagedService(item.id, { discountType: newType });
                                            }}
                                            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none"
                                          >
                                            <option value="none">{isRtl ? 'بدون خصم' : 'None'}</option>
                                            <option value="flat">{isRtl ? 'مبلغ ثابت (SAR)' : 'Flat (SAR)'}</option>
                                            <option value="percent">{isRtl ? 'نسبة مئوية (%)' : 'Percent (%)'}</option>
                                          </select>
                                          {item.discountType !== 'none' && (
                                            <input
                                              type="number"
                                              min="0"
                                              step="5"
                                              value={item.discountValue || ''}
                                              onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                handleUpdateStagedService(item.id, { discountValue: val });
                                              }}
                                              placeholder="0"
                                              className="w-16 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 outline-none"
                                            />
                                          )}
                                        </div>

                                        <div>
                                          <input
                                            type="text"
                                            value={item.notes || ''}
                                            onChange={(e) => handleUpdateStagedService(item.id, { notes: e.target.value })}
                                            placeholder={isRtl ? 'ملاحظة خاصة بالخدمة...' : 'Note for this service...'}
                                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 outline-none"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 3. Progressive Disclosure Accordion: Additional Options & Notes */}
                        <div className="rounded-[20px] border border-slate-200 bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setIsOptionsExpanded(!isOptionsExpanded)}
                            className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <span>📝</span>
                              <span>{isRtl ? 'ملاحظات وخيارات إضافية' : 'Additional Options & Notes'}</span>
                            </span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOptionsExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isOptionsExpanded && (
                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3 text-xs animate-fadeIn">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                  {isRtl ? 'ملاحظات الجلسة للموظفين' : 'Staff Comments & Requests'}
                                </label>
                                <textarea
                                  rows={2}
                                  value={sessionNotes}
                                  onChange={(e) => setSessionNotes(e.target.value)}
                                  placeholder={isRtl ? 'مثال: طلب ضيافة خاصة، حساسية معينة...' : 'e.g. hospitality request, special preferences...'}
                                  className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs outline-none focus:border-[#6537C0]"
                                />
                              </div>

                              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={notifyWhatsApp}
                                  onChange={(e) => setNotifyWhatsApp(e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 accent-[#6537C0]"
                                />
                                <span className="text-xs font-semibold text-slate-700">
                                  {isRtl ? 'إرسال تأكيد الموعد عبر واتساب 💬' : 'Send WhatsApp appointment reminder 💬'}
                                </span>
                              </label>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* 4. Persistent Invoice Summary & Schedule Action Bar (Always visible at bottom of Column 1) */}
                      <div className="p-4 bg-white border-t border-slate-200 shadow-md space-y-3 shrink-0">
                        {bookingScope === 'group' && groupFinancialSummary && (
                          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-2.5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-purple-950 flex items-center gap-1.5 truncate">
                                <span>👥</span>
                                <span className="truncate">{groupName || (isRtl ? 'حجز جماعي' : 'Group Booking')}</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                groupPaymentArrangement === 'organizer_pays'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                  : 'bg-blue-100 text-blue-800 border border-blue-300'
                              }`}>
                                {groupPaymentArrangement === 'organizer_pays'
                                  ? (isRtl ? 'الخيار أ: المنظم يدفع الكل' : 'Option A: Organizer Pays')
                                  : (isRtl ? 'الخيار ب: دفع فردي مستقل' : 'Option B: Individual Pays')}
                              </span>
                            </div>
                            <div className="space-y-1 pt-1 border-t border-purple-200/60 max-h-28 overflow-y-auto pr-1">
                              {(groupFinancialSummary.participantBreakdowns || groupFinancialSummary.participants || []).map((p) => (
                                <div key={p.participantId} className="flex items-center justify-between text-[11px] text-slate-700">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="font-semibold truncate">{p.participantName || p.name}</span>
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      ({p.itemsCount ?? p.serviceCount ?? 0} {isRtl ? 'خدمات' : 'items'})
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 shrink-0">
                                    {(p.total || 0).toFixed(2)} SAR
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>{isRtl ? 'مجموع الخدمات' : 'Services Subtotal'}</span>
                            <span className="font-mono font-bold">
                              {(bookingScope === 'group' && groupFinancialSummary ? (groupFinancialSummary.subtotal ?? groupFinancialSummary.consolidatedSubtotal ?? 0) : appointmentInvoiceSummary.subtotal).toFixed(2)} SAR
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span className="flex items-center gap-1">
                              <span>{isRtl ? 'ضريبة القيمة المضافة ZATCA (15%)' : 'VAT Tax (15%)'}</span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded">ZATCA</span>
                            </span>
                            <span className="font-mono font-bold">
                              {(bookingScope === 'group' && groupFinancialSummary ? (groupFinancialSummary.vat ?? groupFinancialSummary.consolidatedVat ?? 0) : appointmentInvoiceSummary.vat).toFixed(2)} SAR
                            </span>
                          </div>
                          <div className="flex justify-between font-black text-[#6537C0] text-sm border-t border-slate-100 pt-2">
                            <span>{isRtl ? 'المبلغ المستحق النهائي' : 'Grand Total Due'}</span>
                            <span className="font-mono text-base">
                              {(bookingScope === 'group' && groupFinancialSummary ? (groupFinancialSummary.total ?? groupFinancialSummary.consolidatedTotal ?? 0) : appointmentInvoiceSummary.total).toFixed(2)} SAR
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            stagedServices.length === 0 ||
                            (bookingScope === 'single' && custMode === 'existing' && !selectedCustId) ||
                            (bookingScope === 'group' && !groupParticipants[0]?.name?.trim() && custMode === 'existing' && !selectedCustId) ||
                            isSubmitting
                          }
                          onClick={() => handleConfirmAppointmentCreation()}
                          className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer ${
                            stagedServices.length === 0 ||
                            (bookingScope === 'single' && custMode === 'existing' && !selectedCustId) ||
                            (bookingScope === 'group' && !groupParticipants[0]?.name?.trim() && custMode === 'existing' && !selectedCustId) ||
                            isSubmitting
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-[#6537C0] hover:bg-[#532ab0] text-white shadow-purple-500/20'
                          }`}
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>{isRtl ? 'جارٍ الحفظ والجدولة...' : 'Scheduling Booking...'}</span>
                            </>
                          ) : stagedServices.length === 0 ? (
                            <span>{isRtl ? 'أضف خدمات للمتابعة 🗓️' : 'Add services to schedule 🗓️'}</span>
                          ) : (bookingScope === 'single' && custMode === 'existing' && !selectedCustId) ? (
                            <span>{isRtl ? 'اختر عميلاً لتأكيد الحجز 👤' : 'Select a customer to schedule 👤'}</span>
                          ) : bookingScope === 'group' ? (
                            <span>
                              {isRtl
                                ? `تأكيد حجز المجموعة (${groupParticipants.length} عملاء) 👥🗓️`
                                : `Schedule Group Booking (${groupParticipants.length} clients) 👥🗓️`}
                            </span>
                          ) : bookingRecoveryMode === 'separate_services' && stagedServices.length > 1 ? (
                            <span>{isRtl ? `تأكيد ${stagedServices.length} مواعيد منفصلة 🗓️` : `Schedule ${stagedServices.length} separate appointments 🗓️`}</span>
                          ) : (
                            <span>{isRtl ? 'تأكيد الحجز والجدولة 🗓️' : 'Schedule Booking 🗓️'}</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* COLUMN 2: Searchable Service Catalogue with Categories */}
                    <div className={`flex-1 min-w-0 flex flex-col h-full bg-white overflow-hidden ${
                      mobileDrawerTab !== 'catalogue' ? 'hidden lg:flex' : 'flex'
                    }`}>
                      {/* Search Bar & Category Filter Pills */}
                      <div className="p-4 border-b border-slate-200 bg-white space-y-3 shrink-0">
                        <div className="relative">
                          <Search className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 ${isRtl ? 'right-3' : 'left-3'}`} />
                          <input
                            type="text"
                            value={serviceSearch}
                            onChange={(e) => setServiceSearch(e.target.value)}
                            placeholder={isRtl ? 'ابحث عن خدمة أو باقة...' : 'Search services or bundles...'}
                            className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-[#6537C0] focus:bg-white focus:ring-2 focus:ring-[#6537C0]/15 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                          />
                        </div>

                        {/* Category Navigation Pills */}
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                          {serviceCategoryTabs.map((tab) => {
                            const active = currentServiceCategory === tab.key || (!currentServiceCategory && tab.key === 'all');
                            const count = tabCounts[tab.key];

                            return (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => setCurrentServiceCategory(tab.key)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition cursor-pointer shrink-0 ${
                                  active
                                    ? '!border-[#1D035F] !bg-[#1D035F] !text-white shadow-xs'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                }`}
                              >
                                <span className={active ? '!text-white' : ''}>{isRtl ? tab.labelAr : tab.labelEn}</span>
                                {count !== undefined && (
                                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                                    active ? '!bg-[#6537C0] !text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Catalogue Scrollable List */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {categorySections.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                            {serviceSearch.trim()
                              ? (isRtl ? 'لا توجد خدمات أو باقات مطابقة للبحث.' : 'No services or bundles match the search.')
                              : (isRtl ? 'لا توجد خدمات متاحة ضمن هذه الفئة.' : 'No services available in this category.')}
                          </div>
                        ) : (
                          categorySections.map((section) => (
                            <div key={`cat-sec-${section.id}`} className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-[#6537C0]" />
                                  <span>{isRtl ? section.labelAr : section.labelEn}</span>
                                </h4>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {section.services.length + section.bundles.length} {isRtl ? 'عنصر' : 'items'}
                                </span>
                              </div>

                              {/* Category Bundles */}
                              {section.bundles.map((bundle) => {
                                const isParallel = bundle.scheduleType === 'parallel';
                                const bName = isRtl ? (bundle.name_ar || bundle.nameAr) : (bundle.name_en || bundle.nameEn);
                                const isStaged = stagedServices.some(s => s.packageId === bundle.id);

                                return (
                                  <div
                                    key={`bnd-${bundle.id}`}
                                    className="rounded-xl border border-purple-200/90 bg-purple-50/20 p-3 hover:border-purple-300 transition-all flex items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                        <PackageIcon className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[8px] font-black bg-purple-100 text-purple-800 px-1 py-0.2 rounded uppercase">
                                            BUNDLE
                                          </span>
                                          {isParallel && (
                                            <span className="text-[8px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded uppercase">
                                              PARALLEL
                                            </span>
                                          )}
                                          <p className="font-bold text-slate-900 text-xs truncate">{bName}</p>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                          <span className="font-mono text-purple-700 font-bold">{bundle.totalPrice} SAR</span>
                                          {' · '}
                                          <span>{bundle.totalDuration || 60} {isRtl ? 'دقيقة' : 'min'}</span>
                                        </p>
                                        {(() => {
                                          const childResults = bundle.items?.map((it: any) => resourceAvailabilityMap[`cat-srv-${it.serviceId}`]);
                                          const hasConflict = childResults?.some((cr: any) => cr && cr.hasRequirements && !cr.isAvailable);
                                          if (hasConflict) {
                                            return (
                                              <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 text-rose-700 font-bold px-1.5 py-0.2 text-[9px] mt-1 select-none">
                                                <AlertCircle className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                                <span>{isRtl ? 'تعارض في الموارد' : 'Resource Conflict'}</span>
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleAddPackageToStaged(bundle.id)}
                                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                        isStaged
                                          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                                          : 'bg-[#6537C0] text-white hover:bg-[#532ab0]'
                                      }`}
                                    >
                                      {isStaged ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                      <span>{isStaged ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}</span>
                                    </button>
                                  </div>
                                );
                              })}

                              {/* Category Services */}
                              <div className="grid grid-cols-1 gap-2">
                                {section.services.map((service) => {
                                  const sName = getServiceDisplayName(service, isRtl ? 'ar' : 'en');
                                  const hasVariants = Array.isArray(service.variants) && service.variants.length > 0;
                                  const isExpanded = Boolean(expandedVariantServiceIds[service.id]);
                                  const isAdded = isQueuedServiceSelected(service.id, null);
                                  const parentBookable = isParentServiceBookable(service);

                                  return (
                                    <div
                                      key={`srv-${service.id}`}
                                      className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all overflow-hidden"
                                    >
                                      <div className="p-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 font-bold text-xs">
                                            {sName.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-bold text-slate-900 text-xs truncate">{sName}</p>
                                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                              <span className="font-mono text-slate-700 font-bold">
                                                {Number(service.finalPrice ?? service.price ?? 0).toFixed(2)} SAR
                                              </span>
                                              {' · '}
                                              <span>{service.duration || 30} {isRtl ? 'دقيقة' : 'min'}</span>
                                            </p>
                                            <ResourceBadgeList
                                              requirements={resolveEffectiveServiceRequirements(service, null)}
                                              availability={resourceAvailabilityMap[`cat-srv-${service.id}`]}
                                              isLoading={isCheckingResources}
                                              isRtl={isRtl}
                                              compact
                                            />
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {hasVariants ? (
                                            <button
                                              type="button"
                                              onClick={() => toggleVariants(service.id)}
                                              className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-[#6537C0] text-[11px] font-bold flex items-center gap-1 hover:bg-purple-100 transition cursor-pointer"
                                            >
                                              <span>{service.variants.length} {isRtl ? 'خيارات' : 'options'}</span>
                                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleToggleServiceSelection(service, null)}
                                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                                isAdded
                                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                  : 'bg-[#6537C0] text-white hover:bg-[#532ab0]'
                                              }`}
                                            >
                                              {isAdded ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                              <span>{isAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Variant Expansion Rows */}
                                      {hasVariants && isExpanded && (
                                        <div className="bg-slate-50 border-t border-slate-100 p-2.5 space-y-1.5">
                                          {/* Main standalone service option if independently bookable */}
                                          {parentBookable && (
                                            <div className="rounded-lg bg-white border border-slate-200 p-2 flex items-center justify-between text-xs">
                                              <div>
                                                <span className="font-bold text-slate-800 text-[11px]">
                                                  {isRtl ? 'الخدمة الأساسية' : 'Main Service Option'}
                                                </span>
                                                <span className="block text-[10px] text-slate-500 font-mono">
                                                  {Number(service.finalPrice ?? service.price ?? 0).toFixed(2)} SAR · {service.duration} min
                                                </span>
                                                <ResourceBadgeList
                                                  requirements={resolveEffectiveServiceRequirements(service, null)}
                                                  availability={resourceAvailabilityMap[`cat-srv-${service.id}`]}
                                                  isLoading={isCheckingResources}
                                                  isRtl={isRtl}
                                                  compact
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleServiceSelection(service, null)}
                                                className={`px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                                  isAdded
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : 'bg-[#6537C0] text-white hover:bg-[#532ab0]'
                                                }`}
                                              >
                                                {isAdded ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                                <span>{isAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}</span>
                                              </button>
                                            </div>
                                          )}

                                          {/* Individual Variants */}
                                          {service.variants.map((variant) => {
                                            const vName = isRtl
                                              ? (variant.name_ar || variant.nameAr || variant.name_en || variant.nameEn)
                                              : (variant.name_en || variant.nameEn || variant.name_ar || variant.nameAr);
                                            const vPrice = Number(variant.finalPrice ?? variant.rawPrice ?? variant.price ?? 0);
                                            const vDuration = Number(variant.duration || service.duration || 30);
                                            const isVarAdded = isQueuedServiceSelected(service.id, variant.id);

                                            return (
                                              <div key={`var-${variant.id}`} className="rounded-lg bg-white border border-slate-200 p-2 flex items-center justify-between text-xs">
                                                <div className="min-w-0">
                                                  <span className="font-bold text-slate-800 text-[11px] truncate block">
                                                    {vName}
                                                  </span>
                                                  <span className="text-[10px] text-slate-500 font-mono">
                                                    {vPrice.toFixed(2)} SAR · {vDuration} min
                                                  </span>
                                                  <ResourceBadgeList
                                                    requirements={resolveEffectiveServiceRequirements(service, variant.id)}
                                                    availability={resourceAvailabilityMap[`cat-var-${variant.id}`]}
                                                    isLoading={isCheckingResources}
                                                    isRtl={isRtl}
                                                    compact
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleServiceSelection(service, variant)}
                                                  className={`px-2 py-1 rounded text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                                                    isVarAdded
                                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                      : 'bg-[#6537C0] text-white hover:bg-[#532ab0]'
                                                  }`}
                                                >
                                                  {isVarAdded ? <Check className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
                                                  <span>{isVarAdded ? (isRtl ? 'مضاف' : 'Added') : (isRtl ? 'إضافة' : 'Add')}</span>
                                                </button>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Mobile Sticky Floating Review Bar at bottom of Catalogue */}
                      {stagedServices.length > 0 && (
                        <div className="lg:hidden p-3 bg-white border-t border-slate-200 flex items-center justify-between shadow-lg shrink-0">
                          <div>
                            <span className="text-xs font-bold text-slate-700 block">
                              {stagedServices.length} {isRtl ? 'خدمات محددة' : 'services queued'}
                            </span>
                            <span className="text-sm font-mono font-black text-[#6537C0]">
                              {appointmentInvoiceSummary.total.toFixed(2)} SAR
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setMobileDrawerTab('booking')}
                            className="px-4 py-2 bg-[#6537C0] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <span>{isRtl ? 'مراجعة الموعد والفاتورة' : 'Review & Schedule'}</span>
                            <span>{isRtl ? '←' : '→'}</span>
                          </button>
                        </div>
                      )}
                    </div>

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
                        }} className={`py-1.5 rounded-lg border font-bold ${blockType === type ? 'bg-[#6537C0] border-[#6537C0] text-white shadow-xs' : 'bg-slate-50 text-slate-500 hover:bg-[#F3EDFC]'}`}>
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
                      <select
                        value={formatBlockStartClockValue(blockStartTime)}
                        onChange={(e) => setBlockStartTime(convertBlockClockToOffset(e.target.value))}
                        className="border p-1.5 rounded font-mono font-bold min-w-[12rem] bg-white"
                      >
                        {blockStartTimeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={blockIsRecurring} onChange={(e) => setBlockIsRecurring(e.target.checked)} className="rounded border-slate-300 text-zinc-900 focus:ring-zinc-900" />
                      <span className="text-xs font-bold text-slate-700">{isRtl ? 'تكرار يومياً' : 'Repeat Everyday'}</span>
                    </label>
                    {blockIsRecurring && (
                      <div className="pl-6 rtl:pr-6 rtl:pl-0">
                        <label className="text-[10px] text-slate-400 block mb-1">{isRtl ? 'تاريخ الانتهاء (اختياري - للجدولة من-إلى)' : 'End Date (Optional - for from-to ranges)'}</label>
                        <input type="date" value={blockEndDate} onChange={(e) => setBlockEndDate(e.target.value)} className="border p-1.5 rounded font-mono font-bold w-full" />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button onClick={handleRequestDismissCreateDrawer} className="py-2 px-4 bg-slate-100 rounded-lg text-slate-600 font-bold">
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    {isEditingBreak && (
                      <button onClick={handleBreakDelete} className="py-2 px-5 bg-rose-600 text-white font-bold rounded-lg shadow-sm">
                        {isRtl ? 'حذف الحظر' : 'Delete Block'}
                      </button>
                    )}
                    <button onClick={handleConfirmBlockSubmit} className="py-2 px-5 bg-[#6537C0] hover:bg-[#532ab0] text-white font-bold rounded-lg shadow-sm transition">
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
              <AnimatePresence>
                {showCartDraftPrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[80] flex items-center justify-center bg-zinc-950/55 px-4 backdrop-blur-sm"
                  >
                    <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-white p-6 shadow-2xl">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl bg-amber-500/10 p-2 text-amber-600">
                          <AlertTriangle size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                            {isRtl ? 'جلسة مبيعات غير مكتملة' : 'Unfinished sale session'}
                          </p>
                          <h4 className="mt-1 text-lg font-black text-slate-900">
                            {isRtl
                              ? `لديك ${cartDraftTypeLabel} غير مكتمل`
                              : `You have an unfinished ${cartDraftTypeLabel}`}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {isRtl
                              ? 'توجد بيانات محفوظة غير مكتملة لهذه العملية. هل تريد المتابعة من حيث توقفت أم تجاهل المسودة وبدء عملية جديدة؟'
                              : 'There is unfinished data for this drawer. Would you like to continue where you left off or discard the draft and start fresh?'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={handleDiscardCartDraft}
                          className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                        >
                          {isRtl ? 'تجاهل وبدء جديد' : 'Discard & Start New'}
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueCartDraft}
                          className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
                        >
                          {isRtl ? 'متابعة المسودة' : 'Continue'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Header */}
              <div className="p-4 bg-[#1D035F] text-white flex items-center justify-between border-b border-[#A379E2]/30">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-[#6537C0] rounded-xl text-white shadow-xs">
                      <ShoppingBag size={16} />
                    </span>
                    <h3 className="text-sm font-black tracking-tight uppercase">
                      {isRtl ? 'صندوق محاسبة المبيعات والبطاقات (POS)' : 'POS Retail & Gift Cards counter'}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white cursor-pointer transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Catalog portion */}
                <div className="w-7/12 border-e border-slate-200 flex flex-col bg-white overflow-hidden">
                  <div className="p-2.5 bg-slate-50 border-b flex items-center justify-between">
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button onClick={() => setCartTab('products')} className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${cartTab === 'products' ? 'bg-[#6537C0] text-white shadow-xs' : 'text-slate-600 hover:text-[#1D035F]'}`}>
                        {isRtl ? 'مستحضرات التجميل 🧴' : 'Cosmetics 🧴'}
                      </button>
                      <button onClick={() => { setCartTab('giftcards'); handleRegenerateGiftCardCode(); }} className={`px-2.5 py-1 text-xs font-bold rounded-md cursor-pointer ${cartTab === 'giftcards' ? 'bg-[#6537C0] text-white shadow-xs' : 'text-slate-600 hover:text-[#1D035F]'}`}>
                        {isRtl ? 'بطاقات الهدايا 🎁' : 'Gift Cards 🎁'}
                      </button>
                    </div>
                  </div>

                      <div className="flex-1 overflow-y-auto p-3">
                    {cartTab === 'products' ? (
                      <div className="space-y-3 animate-fadeIn">
                        <div className="space-y-2 border-b border-slate-200 pb-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                            <input
                              type="text"
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              placeholder={isRtl ? 'ابحث باسم المنتج أو SKU...' : 'Search products by name or SKU...'}
                              className="w-full rounded-xl border border-slate-200 bg-white px-9 py-2 text-xs font-semibold text-slate-700 focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {productCategoryOptions.map((category) => (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => setProductCategoryFilter(category.id)}
                                className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                  productCategoryFilter === category.id
                                    ? 'bg-[#6537C0] text-white border-[#6537C0]'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#6537C0]'
                                }`}
                              >
                                {isRtl ? category.labelAr : category.labelEn}
                              </button>
                            ))}
                          </div>
                        </div>

                        {filteredProductCards.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {filteredProductCards.map((prod) => {
                              const imageSrc = resolveProductImageUrl(prod.imageUrl || prod.primaryImage || prod.image || prod.images?.[0]);
                              return (
                                <button
                                  key={prod.id}
                                  type="button"
                                  disabled={prod.stock === 0}
                                  onClick={() => handleAddProductToCart(prod)}
                                  className={`group text-left rounded-xl border bg-white overflow-hidden flex flex-col transition-all h-full ${
                                    prod.stock === 0 ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#6537C0] hover:shadow-xs cursor-pointer'
                                  }`}
                                >
                                  <div className="aspect-square bg-slate-50 overflow-hidden relative">
                                    <img src={imageSrc || ''} alt={isRtl ? prod.nameAr : prod.nameEn} className="w-full h-full object-cover" />
                                    <span className="absolute top-2 left-2 text-[8px] font-black px-1.5 py-0.5 rounded bg-black/70 text-white">
                                      {prod.stock > 0 ? `${prod.stock}` : (isRtl ? 'نفد' : '0')}
                                    </span>
                                  </div>
                                  <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[8px] font-bold text-[#6537C0] uppercase truncate">
                                          {isRtl ? prod.categoryAr : prod.categoryEn}
                                        </span>
                                        <span className="text-[8px] font-mono text-slate-400 truncate">{prod.sku || '—'}</span>
                                      </div>
                                      <h4 className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-snug">
                                        {isRtl ? prod.nameAr : prod.nameEn}
                                      </h4>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                      <span className="font-mono font-black text-slate-800 text-xs">
                                        {Number(prod.price || 0).toFixed(2)} SAR
                                      </span>
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                        prod.stock === 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {prod.stock === 0 ? (isRtl ? 'غير متاح' : 'Out') : (isRtl ? 'متاح' : 'Live')}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-10 text-center text-[10px] text-slate-500">
                            {isRtl ? 'لا توجد منتجات مطابقة الآن.' : 'No products match your current filters.'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 animate-fadeIn text-xs">
                        <div className="p-3 bg-slate-50 border rounded-lg space-y-3">
                          <div className="flex justify-between items-center border-b pb-1">
                            <span className="font-black text-slate-800">{isRtl ? 'بطاقات الهدايا النشطة' : 'Available Gift Cards'}</span>
                            <span className="text-[10px] font-mono font-bold text-[#6537C0]">{giftCardPackages.length}</span>
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
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#6537C0] hover:bg-[#F3EDFC]"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="truncate font-bold text-slate-800">{displayTitle}</p>
                                        <p className="mt-0.5 text-[10px] text-slate-500">
                                          {isRtl ? 'رصيد' : 'Credit'} {Number(giftCardPackage.walletCreditAmount || 0).toFixed(2)} SAR
                                        </p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <p className="text-[10px] font-bold text-[#6537C0]">
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
                            <span className="text-[10px] font-mono font-bold text-[#6537C0]">{generatedGcCode}</span>
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
                                <button key={v} onClick={() => setGcValue(v)} className={`py-1 rounded font-mono font-bold border text-[11px] ${gcValue === v ? 'bg-[#6537C0] text-white border-[#6537C0]' : 'bg-white text-slate-600'}`}>{v} ر.س</button>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-between pt-1">
                            <button type="button" onClick={handleRegenerateGiftCardCode} className="text-[9px] underline text-slate-500">Regenerate Serial</button>
                            <button type="button" onClick={handleAddGiftCardToCart} className="bg-[#6537C0] hover:bg-[#532ab0] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg shadow-xs transition">+ Issue card</button>
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
                              <span className="text-[8px] font-mono bg-[#F3EDFC] text-[#6537C0] px-1 rounded block w-fit">{item.skuOrCode}</span>
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
                      <div className="flex justify-between pb-1 border-b mb-2">
                        <span className="font-bold text-slate-700">{isRtl ? 'العميل المشتري' : 'POS Customer'}</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setPosCustMode('walkin'); setPosSelectedCustId(''); setPosCustomerSearch(''); }}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${posCustMode === 'walkin' ? 'bg-[#6537C0] text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-[#F3EDFC]'}`}
                          >
                            Walk-in
                          </button>
                          <button
                            onClick={() => { setPosCustMode('existing'); setPosSelectedCustId(''); setPosCustomerSearch(''); }}
                            className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all ${posCustMode === 'existing' ? 'bg-[#6537C0] text-white shadow-xs' : 'bg-slate-100 text-slate-500 hover:bg-[#F3EDFC]'}`}
                          >
                            Registered
                          </button>
                        </div>
                      </div>

                      {posCustMode === 'existing' ? (
                        <div className="space-y-1.5">
                          {/* Search box */}
                          <div className="relative">
                            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              value={posCustomerSearch}
                              onChange={(e) => {
                                setPosCustomerSearch(e.target.value);
                                // If user clears search, also clear selected id so they must re-pick
                                if (!e.target.value) setPosSelectedCustId('');
                              }}
                              placeholder={isRtl ? 'ابحث باسم العميل أو رقم الجوال...' : 'Search by name or phone...'}
                              className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium outline-none focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/15 transition-all"
                            />
                          </div>

                          {/* Customer list */}
                          <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-50">
                            {customers
                              .filter(c => {
                                const q = posCustomerSearch.toLowerCase();
                                return !q
                                  || (c.name || '').toLowerCase().includes(q)
                                  || (c.phone || '').toLowerCase().includes(q)
                                  || (c.email || '').toLowerCase().includes(q);
                              })
                              .map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => { setPosSelectedCustId(c.id); setPosCustomerSearch(c.name || ''); }}
                                  className={`w-full text-left px-2.5 py-2 text-[11px] font-medium hover:bg-[#F3EDFC] transition-all flex items-center justify-between gap-2 ${
                                    posSelectedCustId === c.id
                                      ? 'bg-[#F3EDFC] border-l-2 border-[#6537C0] font-bold text-[#1D035F]'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{c.name}</span>
                                  {c.phone && <span className="text-slate-400 text-[9px] font-mono shrink-0">{c.phone}</span>}
                                  {posSelectedCustId === c.id && <Check size={10} className="text-[#6537C0] shrink-0" />}
                                </button>
                              ))
                            }
                            {customers.filter(c => {
                              const q = posCustomerSearch.toLowerCase();
                              return !q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
                            }).length === 0 && (
                              <div className="px-3 py-4 text-center text-[10px] text-slate-400">
                                {isRtl ? 'لا يوجد عميل مطابق' : 'No matching customer found'}
                              </div>
                            )}
                          </div>

                          {/* Selected indicator */}
                          {posSelectedCustId ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 font-bold">
                              <Check size={10} className="text-emerald-600" />
                              {isRtl ? 'تم الاختيار:' : 'Selected:'} {customers.find(c => c.id === posSelectedCustId)?.name || posSelectedCustId}
                            </div>
                          ) : (
                            <p className="text-[9px] text-amber-600 font-semibold px-1">
                              {isRtl ? '⚠️ يجب اختيار عميل لإتمام الدفع' : '⚠️ You must select a customer to proceed'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {cartItems.some(i => i.type === 'giftcard') ? (
                            <button
                              type="button"
                              onClick={() => setShowWalkinModal(true)}
                              className="flex flex-col text-left px-3 py-2 bg-slate-50 border border-slate-200 hover:border-[#6537C0] rounded-lg transition-all w-full"
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-[10px] font-medium text-slate-500">
                                  {isRtl ? 'بيانات المستلم (زائر)' : 'Recipient Details (Walk-in)'}
                                </span>
                                <span className="text-[#6537C0] text-[10px] font-bold underline">
                                  {posWalkinName ? (isRtl ? 'تعديل' : 'Edit') : (isRtl ? 'إدخال البيانات' : 'Enter Details')}
                                </span>
                              </div>
                              {posWalkinName ? (
                                <div className="text-[11px] font-bold text-slate-800">
                                  {posWalkinName} {posWalkinEmail ? `(${posWalkinEmail})` : ''}
                                </div>
                              ) : (
                                <div className="text-[11px] font-bold text-slate-400">
                                  {isRtl ? 'لم يتم إدخال بيانات (بطاقة مجهولة)' : 'No details entered (Anonymous Card)'}
                                </div>
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-500">
                              <span>👤</span>
                              <span className="font-medium">{isRtl ? 'زائر غير مسجل — Walk-in' : 'Walk-in Guest — Unregistered'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cost Breakdown */}
                    {(() => {
                      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                      const vat = total - (total / 1.15);
                      const subtotal = total - vat;

                      const posSplitSum = (posSplitAmounts.card || 0) + (posSplitAmounts.cash || 0) + (posSplitAmounts.wallet || 0);
                      const posRemaining = Math.max(0, total - posSplitSum);
                      const isPosSplitValid = total > 0 && Math.abs(posSplitSum - total) < 0.01;
                      const isPosSplitComplete = total > 0 && posRemaining === 0 && isPosSplitValid;
                      const hasOverpayment = posSplitSum > total + 0.01;

                      return (
                        <>
                          <div className="p-3 bg-white border rounded-xl space-y-1.5 text-xs font-sans">
                            <div className="flex justify-between text-slate-500">
                              <span>{isRtl ? 'المجموع' : 'Subtotal'}</span>
                              <span className="font-mono font-semibold">{subtotal.toFixed(2)} SAR</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>ZATCA VAT (15%)</span>
                              <span className="font-mono font-semibold">{vat.toFixed(2)} SAR</span>
                            </div>
                            <div className="flex justify-between font-black text-slate-900 border-t pt-1 bg-[#F3EDFC] px-1 py-0.5 rounded text-xs">
                              <span>{isRtl ? 'الصافي النهائي المستحق' : 'Checkout Total'}</span>
                              <span className="font-mono text-[#6537C0] font-black">{total.toFixed(2)} SAR</span>
                            </div>
                          </div>

                          <div className="p-3 bg-white border-t space-y-2 mt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black text-slate-400">{isRtl ? 'بوابة التحصيل مدى' : 'Integrated Mada Gate'}</span>
                              <button onClick={() => setPosSplitActive(!posSplitActive)} className="text-[9px] underline text-slate-500">Split Cash/Card</button>
                            </div>

                            {posSplitActive && (
                              <div className="space-y-3 animate-fadeIn mt-2">
                                {/* Live Summary */}
                                <div className={`p-2 rounded-lg border ${isPosSplitComplete ? 'bg-emerald-50 border-emerald-200' : (hasOverpayment ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}`}>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المطلوب:' : 'Invoice Total:'}</span>
                                    <span className="font-bold font-mono">{total.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المدفوع:' : 'Allocated Amount:'}</span>
                                    <span className={`font-bold font-mono ${hasOverpayment ? 'text-rose-600' : 'text-emerald-600'}`}>{posSplitSum.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] font-black pt-1 border-t border-slate-200 border-dashed">
                                    <span className={hasOverpayment ? 'text-rose-600' : 'text-slate-700'}>{isRtl ? 'المتبقي:' : 'Remaining Balance:'}</span>
                                    <span className={`font-mono ${isPosSplitComplete ? 'text-emerald-600' : (hasOverpayment ? 'text-rose-600' : 'text-amber-600')}`}>
                                      {isPosSplitComplete ? (isRtl ? 'اكتمل التخصيص' : 'Allocation Complete') : `${posRemaining.toFixed(2)}`}
                                    </span>
                                  </div>
                                </div>

                                {/* Inputs */}
                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Mada</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!posSplitAmounts.card && posRemaining > 0) {
                                          setPosSplitAmounts(prev => ({ ...prev, card: parseFloat((posRemaining + (prev.card || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-[#F3EDFC] text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={posSplitAmounts.card || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Cash</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!posSplitAmounts.cash && posRemaining > 0) {
                                          setPosSplitAmounts(prev => ({ ...prev, cash: parseFloat((posRemaining + (prev.cash || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-[#F3EDFC] text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={posSplitAmounts.cash || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Wallet</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!posSplitAmounts.wallet && posRemaining > 0) {
                                          setPosSplitAmounts(prev => ({ ...prev, wallet: parseFloat((posRemaining + (prev.wallet || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-[#F3EDFC] text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={posSplitAmounts.wallet || ''} onChange={(e) => setPosSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                </div>
                              </div>
                            )}

                            {posCheckoutComplete && !completedOrder ? (
                              <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500 text-emerald-800 font-black rounded-xl text-[10px] text-center mt-2">
                                {isRtl ? 'تم إتمام التحصيل بنجاح' : 'Checkout completed successfully'}
                              </div>
                            ) : null}

                            {posCustMode === 'walkin' && cartItems.some(i => i.type === 'giftcard') && !posCheckoutComplete && (
                              <div className="w-full py-2 px-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl text-[10px] text-center my-2 animate-fadeIn">
                                ⚠️ {isRtl
                                  ? 'لن يتم إيداع هذه البطاقة في أي محفظة. سيتم إنشاء رمز استرداد بدلاً من ذلك.'
                                  : 'This gift card will not be credited to any customer wallet. A redemption code will be generated instead.'}
                              </div>
                            )}

                            <button
                              onClick={handleProcessPosCheckout}
                              disabled={posCheckoutComplete || cartItems.length === 0 || (posSplitActive && !isPosSplitValid)}
                              className="w-full mt-2 py-2.5 bg-[#6537C0] hover:bg-[#532ab0] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                      <Receipt size={13} className="text-white" />
                      <span>
                        {posCheckoutComplete
                          ? (isRtl ? 'تم التحصيل' : 'Checkout completed')
                          : (isRtl ? 'فوترة المشتريات وتأكيد استلام السداد' : 'Process Checkout & Generate Receipt')}
                      </span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
                </div>
              </div>

              {/* PRINT RECEIPT OVERLAY PREVIEW */}
              {completedOrder && (
                <div className="absolute inset-0 z-40 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-5 w-80 font-mono text-xs border space-y-3">
                    <div className="border-t-2 border-b-2 border-dashed border-slate-800 py-3 text-center space-y-1">
                      <span className="font-black text-sm tracking-widest block">BARSPA CRM</span>
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

                      {/* Gift card codes section for walk-in receipts */}
                      {completedOrder.items.some((it: any) => it.type === 'giftcard') && (
                        <div className="mt-2 border border-dashed border-[#A379E2]/40 rounded p-1.5 bg-[#F3EDFC]">
                          <p className="text-[8px] font-black text-[#1D035F] mb-1 text-center tracking-wider uppercase">
                            🎁 {isRtl ? 'رموز بطاقات الهدايا' : 'Gift Card Redemption Codes'}
                          </p>
                          {completedOrder.items
                            .filter((it: any) => it.type === 'giftcard')
                            .map((it: any) => (
                              <div key={it.id} className="flex items-center justify-between py-0.5">
                                <span className="text-[8px] text-[#6537C0] truncate flex-1">{it.nameEn}</span>
                                <span className="text-[9px] font-black font-mono text-zinc-900 ml-1 tracking-widest">{it.skuOrCode}</span>
                              </div>
                            ))
                          }
                          <p className="text-[7px] text-[#6537C0] mt-1 text-center">
                            {isRtl
                              ? 'احتفظ بهذا الرمز — يمكن استرداده في أي وقت في المركز'
                              : 'Keep this code — present at the center to redeem'}
                          </p>
                        </div>
                      )}

                      <p className="text-[8px] text-slate-400 mt-2">شكراً لزيارتكم بارسبا 🌸 Thank you for visiting BarSpa</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { addLocalToast('تم محاكاة طباعة الإيصال الورقي الفوري بنجاح!', 'Simulated printed physical receipt successfully!', 'success'); setCompletedOrder(null); }} className="flex-1 py-1.5 bg-[#6537C0] hover:bg-[#532ab0] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition">
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

      {showWalkinModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" onClick={() => setShowWalkinModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 z-10">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="p-2 bg-amber-500/10 rounded-xl">
                <span>👤</span>
              </span>
              <h3 className="text-lg font-black text-slate-800">
                {isRtl ? 'بيانات المستلم (زائر)' : 'Walk-in Recipient Details'}
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                {isRtl
                  ? 'يرجى إدخال بيانات المشتري لضمان إرسال بطاقة الهدية الرقمية بنجاح وعدم فقدانها.'
                  : 'Please enter the buyer details to ensure the digital gift card is sent successfully and not lost.'}
              </p>

              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isRtl ? 'الاسم' : 'Name'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={posWalkinName}
                    onChange={(e) => setPosWalkinName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/15 outline-none"
                    placeholder={isRtl ? 'أدخل اسم المشتري...' : 'Enter buyer name...'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isRtl ? 'البريد الإلكتروني (لإرسال البطاقة)' : 'Email (for digital delivery)'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={posWalkinEmail}
                    onChange={(e) => setPosWalkinEmail(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/15 outline-none"
                    placeholder={isRtl ? 'name@example.com' : 'name@example.com'}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    {isRtl ? 'رقم الجوال (اختياري)' : 'Phone Number (Optional)'}
                  </label>
                  <input
                    type="tel"
                    value={posWalkinPhone}
                    onChange={(e) => setPosWalkinPhone(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-[#6537C0] focus:ring-1 focus:ring-[#6537C0]/15 outline-none"
                    placeholder={isRtl ? '05xxxxxxxx' : '05xxxxxxxx'}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowWalkinModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (!posWalkinName || !posWalkinEmail) {
                    addLocalToast(
                      isRtl ? 'الاسم والبريد الإلكتروني مطلوبان لإرسال البطاقة' : 'Name and Email are required to send the gift card',
                      isRtl ? 'تحقق من البيانات' : 'Check Details',
                      'warning'
                    );
                    return;
                  }
                  setShowWalkinModal(false);
                }}
                className="flex-[2] px-4 py-2 bg-[#6537C0] hover:bg-[#532ab0] text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
              >
                {isRtl ? 'حفظ البيانات ومتابعة' : 'Save Details & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" onClick={() => setShowAssignWarning(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 z-10">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="p-2 bg-amber-500/10 rounded-xl">
                <AlertTriangle size={24} />
              </span>
              <h3 className="text-lg font-black text-slate-800">
                {isRtl ? 'الخدمة غير معينة' : 'Service Not Assigned'}
              </h3>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isRtl
                  ? 'الخدمة المحددة غير معينة للموظف المحدد.'
                  : 'The selected service is not assigned to the selected employee.'}
              </p>
              <p className="font-bold">{isRtl ? 'يرجى إما:' : 'Please either:'}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  {isRtl
                    ? '• اختيار موظف آخر يقوم بتقديم هذه الخدمة.'
                    : '• Select another employee who performs this service.'}
                </li>
                <li>
                  {isRtl
                    ? '• تعيين هذه الخدمة للموظف المحدد أولاً من إدارة الموظفين.'
                    : '• Assign this service to the selected employee first from Employee Management.'}
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignWarning(false)}
                className="px-4 py-2 bg-[#6537C0] text-white rounded-xl text-xs font-bold hover:bg-[#532ab0] transition-all cursor-pointer shadow-sm"
              >
                {isRtl ? 'تغيير الموظف' : 'Change Employee'}
              </button>
              <button
                type="button"
                onClick={() => setShowAssignWarning(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isRtl ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {bookingErrorDialog && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={() => setBookingErrorDialog(null)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative z-10 w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3 text-amber-700">
                <span className="rounded-xl bg-amber-50 p-2">
                  <AlertTriangle size={24} />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">
                    {isRtl ? 'تنبيه الحجز' : 'Booking alert'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {isRtl ? bookingErrorDialog.titleAr : bookingErrorDialog.titleEn}
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {isRtl ? bookingErrorDialog.bodyAr : bookingErrorDialog.bodyEn}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setBookingErrorDialog(null)}
                  className="rounded-xl bg-[#6537C0] hover:bg-[#532ab0] px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                >
                  {isRtl ? 'حسناً' : 'OK'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingHoursDecisionDialog && (
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={bookingHoursDecisionDialog.onCancel}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3 text-slate-900">
                <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
                  <CalendarIcon size={24} />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {isRtl ? 'قرار التمديد' : 'Extension decision'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {isRtl ? bookingHoursDecisionDialog.titleAr : bookingHoursDecisionDialog.titleEn}
                  </h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                {isRtl ? bookingHoursDecisionDialog.bodyAr : bookingHoursDecisionDialog.bodyEn}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={bookingHoursDecisionDialog.onChooseAnotherDay}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {isRtl ? 'اختيار يوم آخر' : 'Choose another day'}
                </button>
                <button
                  type="button"
                  onClick={bookingHoursDecisionDialog.onExtendHours}
                  className="rounded-xl bg-[#6537C0] hover:bg-[#532ab0] px-4 py-2 text-xs font-bold text-white transition shadow-sm"
                >
                  {isRtl
                    ? `تمديد الساعات ${bookingHoursDecisionDialog.extensionMinutes} دقيقة`
                    : `Extend Hours by ${bookingHoursDecisionDialog.extensionMinutes} Minutes`}
                </button>
                <button
                  type="button"
                  onClick={bookingHoursDecisionDialog.onCancel}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rebookPrompt?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRebookPrompt(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
            >
              {/* Unavailable Items Notice (Requirement 1) */}
              {rebookPrompt.unavailableItems.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 border-b border-amber-100 pb-3 text-amber-800">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {isRtl ? 'خدمات سابقة غير متوفرة في القائمة' : 'Historical Services Unavailable'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isRtl
                          ? 'الخدمات التالية من هذا الحجز لم تعد متوفرة في قائمة الخدمات الحالية:'
                          : 'The following services from this appointment are no longer available in the catalogue:'}
                      </p>
                    </div>
                  </div>

                  <div className="my-4 max-h-48 overflow-y-auto space-y-2">
                    {rebookPrompt.unavailableItems.map((item, uIdx) => (
                      <div
                        key={uIdx}
                        className="rounded-xl border border-rose-150 bg-rose-50/60 p-2.5 text-xs text-rose-800 flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          {item.variantName && (
                            <p className="text-[11px] text-slate-600">
                              {isRtl ? `الخيار / الخصلة: ${item.variantName}` : `Variant: ${item.variantName}`}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[10px] font-semibold text-rose-600 bg-white px-2 py-0.5 rounded border border-rose-200">
                          {item.reason}
                        </span>
                      </div>
                    ))}
                  </div>

                  {rebookPrompt.availableItems.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 text-center">
                      <p className="font-semibold text-slate-700">
                        {isRtl
                          ? 'لا تتوفر أي خدمة من خدمات هذا الحجز حالياً، تعذر إتمام إعادة الحجز.'
                          : 'None of the services from this previous appointment are currently available.'}
                      </p>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setRebookPrompt(null)}
                          className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-bold text-slate-800 transition cursor-pointer"
                        >
                          {isRtl ? 'إغلاق' : 'Close'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {isRtl
                          ? `يتطلب المتابعة حذف الخدمات غير المتوفرة وإعادة حجز باقي الخدمات المتاحة (${rebookPrompt.availableItems.length} خدمة).`
                          : `To proceed, remove the unavailable services and rebook the remaining ${rebookPrompt.availableItems.length} available service(s).`}
                      </p>
                      <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRebookPrompt(null)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                        >
                          {isRtl ? 'إلغاء إعادة الحجز' : 'Cancel'}
                        </button>
                        <button
                          type="button"
                          onClick={() => executeApplyRebookedDraft(rebookPrompt.availableItems)}
                          className="rounded-xl bg-[#6537C0] hover:bg-[#522ba3] px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                        >
                          {isRtl
                            ? `حذف غير المتاحة ومتابعة الباقي (${rebookPrompt.availableItems.length})`
                            : `Remove Unavailable & Rebook (${rebookPrompt.availableItems.length})`}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : rebookPrompt.hasExistingDraftConflict ? (
                <>
                  <div className="flex items-center gap-3 border-b border-purple-100 pb-3 text-purple-900">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-[#6537C0]">
                      <RotateCcw className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {isRtl ? 'استبدال المسودة الحالية؟' : 'Replace current draft?'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {isRtl
                          ? 'لديك خدمات محددة في المسودة الحالية. هل ترغب في استبدالها بخدمات هذا الحجز السابق؟'
                          : 'You currently have services staged in your draft. Replace them with this previous appointment?'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRebookPrompt(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      {isRtl ? 'الاحتفاظ بالمسودة الحالية' : 'Keep current draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (rebookPrompt.matchedPkgId) {
                          setStagedServices([]);
                          handleAddPackageToStaged(rebookPrompt.matchedPkgId);
                          setIsFindingAvailableTimes(true);
                          setRebookPrompt(null);
                        } else {
                          executeApplyRebookedDraft(rebookPrompt.availableItems);
                        }
                      }}
                      className="rounded-xl bg-[#6537C0] hover:bg-[#522ba3] px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                    >
                      {isRtl ? 'استبدال المسودة والمتابعة' : 'Replace Draft & Rebook'}
                    </button>
                  </div>
                </>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <SmartConflictModal
        isRtl={isRtl}
        startHour={boardStartHour}
        stylists={stylists}
        canonicalServices={canonicalServices}
        conflictDialog={conflictDialog as any}
        conflictView={conflictView as any}
        bookingRecoveryMode={bookingRecoveryMode}
        setConflictView={setConflictView}
        setConflictDialog={setConflictDialog as any}
        onClose={closeDialog}
        onConfirm={acceptSuggestedChain}
        onSearchDate={selectAlternativeDate}
        onModifyProfessionals={() => {
           setBookingRecoveryMode('modify_professionals');
           closeDialog();
           setCreateStep(3);
        }}
        onSeparateServices={() => {
           setBookingRecoveryMode('separate_services');
           closeDialog();
           setCreateStep(3);
        }}
      />

    </>
  );
}
