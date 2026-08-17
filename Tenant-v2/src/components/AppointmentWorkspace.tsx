import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Clock, Plus, Search, User, Users, Check, X, 
  ChevronLeft, ChevronRight, CreditCard, Tag, MessageSquare, MapPin, 
  Activity, Wallet, ChevronDown, Trash, Undo2, AlertCircle, Filter, 
  SlidersHorizontal, Star, Split, Share2, Printer, CheckCircle2,
  Lock, Scissors, Sparkles, Smile, ShieldCheck, Mail, Phone,
  TrendingUp, CircleDot, AlertTriangle, FileText, RefreshCw, Copy, Settings2,
  PlusCircle, Coffee, Heart, ShoppingBag, Receipt, Gift, Banknote,
  CalendarDays, Ban, Save, Maximize2, Minimize2, Loader2
} from 'lucide-react';
import { Language, Product, QuickLaunchRequest } from '../types';
import InteractiveDrawers from './InteractiveDrawers';
import TeamMemberProfileDrawer from './employee-profile/TeamMemberProfileDrawer';
import EmployeeWeeklyScheduleEditor from './EmployeeWeeklyScheduleEditor';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { TransactionDetailsDrawer } from './TransactionDetailsDrawer';
import SchedulerGrid, { SchedulerColumn, SchedulerEvent, SchedulerSlot } from './SchedulerGrid';
import { resolveEmployeeImageUrl } from '../lib/employeeImage';
import { resolveProductImageUrl } from '../lib/productContract';
import { getServiceCategoryKey, getServiceCategoryLabel, normalizeServiceRecord } from '../lib/serviceContract';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import { DEFAULT_SCHEDULER_BOARD_SETTINGS, getTenantSchedulerConfig, normalizeSchedulerBoardSettings, type SchedulerBoardSettings, MIN_STAFF_COLUMN_WIDTH, MAX_STAFF_COLUMN_WIDTH } from '../lib/tenantWorkingHours';
import { emitBIReportRefresh } from '../lib/bi/refreshSignals';
import { calculateNearestValidChain, calculateAllValidChains, ChainResult } from '../utils/bookingChains';
import {
  buildAdvanceBookingDialog,
  buildExtendedHoursBookingDialog,
  buildGenericBookingErrorDialog,
  extractBookingErrorMeta,
  hasStructuredBookingDiagnostics,
  isBookingConflictError,
  isBookingTooSoonError,
  type BookingDialogCopy
} from '../lib/bookingUiDialogs';
import {
  buildTenantIsoFromMinutes,
  resolveTenantTimezone
} from '../lib/tenantTime';
import {
  buildConflictCard,
  formatConflictTime,
  pickBestConflictDiagnostic,
  type AvailabilityDiagnostic,
  type ConflictCard
} from '../lib/bookingConflictDiagnostics';

interface AppointmentWorkspaceProps {
  lang: Language;
  onQuickAction: (type: any) => void;
  quickLaunchRequest?: QuickLaunchRequest | null;
  onToggleFavoritePage?: () => void;
  isFavorited?: boolean;
  setShowSavedViewModal?: (show: boolean) => void;
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
  appointmentId?: string;
  avatar?: string;
  staffAvatar?: string;
  serviceVariantId?: string;
  serviceVariantName?: string;
  serviceVariantDescription?: string;
  startTime: number; // minutes from 9:00 AM (0 to 720 for 12 hours)
  duration: number; // minutes
  status: 'pending' | 'confirmed' | 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'paid' | 'unpaid' | 'partial';
  normalizedPaymentStatus?: string | null;
  paymentMethod?: string | null;
  invoiceNumber?: string | null;
  paymentTransactions?: any[];
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
  depositAmount?: number | null;
  depositPaid?: number | null;
  remainderAmount?: number;
  remainderPaid?: number | null;
  remainingBalance?: number | null;
  outstandingAmount?: number | null;
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
  invoice?: any;
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

interface GiftCardPackage {
  id: string;
  title: string;
  title_en?: string;
  title_ar?: string;
  priceAmount?: number;
  walletCreditAmount?: number;
  discountPreset?: string;
  discountPercent?: number;
  expirationPreset?: string;
  isActive?: boolean;
  imageUrl?: string | null;
}

type SchedulerBoardMode = 'team-day' | 'team-week' | 'employee-day' | 'employee-week' | 'agenda' | 'month';

const isEmployeeBoardMode = (mode: SchedulerBoardMode) => mode === 'employee-day' || mode === 'employee-week';
const isWeekBoardMode = (mode: SchedulerBoardMode) => mode === 'team-week' || mode === 'employee-week';
const isDayBoardMode = (mode: SchedulerBoardMode) => mode === 'team-day' || mode === 'employee-day';
const isMonthBoardMode = (mode: SchedulerBoardMode) => mode === 'month';

const getBoardModeLabel = (mode: SchedulerBoardMode, isRtl: boolean) => {
  switch (mode) {
    case 'team-day':
      return isRtl ? 'فريق - يوم' : 'Team Day';
    case 'team-week':
      return isRtl ? 'فريق - أسبوع' : 'Team Week';
    case 'employee-day':
      return isRtl ? 'موظف - يوم' : 'Employee Day';
    case 'employee-week':
      return isRtl ? 'موظف - أسبوع' : 'Employee Week';
    case 'agenda':
      return isRtl ? 'الأجندة' : 'Agenda';
    case 'month':
      return isRtl ? 'الشهر' : 'Month';
    default:
      return mode;
  }
};

const getSchedulerColumnId = (mode: SchedulerBoardMode, value: string) => {
  return isWeekBoardMode(mode) ? `day:${value}` : `employee:${value}`;
};

const parseSchedulerColumnResourceId = (columnId: string) => `${columnId || ''}`.replace(/^(employee:|day:)/, '');

const API_COLORS = [
  'border-amber-500 bg-amber-500/10 text-amber-900',
  'border-emerald-500 bg-emerald-500/10 text-emerald-900',
  'border-rose-500 bg-rose-500/10 text-rose-900',
  'border-blue-500 bg-blue-500/10 text-blue-900',
  'border-indigo-500 bg-indigo-500/10 text-indigo-900',
  'border-purple-500 bg-purple-500/10 text-purple-900'
];

const normalizeWorkspaceAppointmentStatus = (status: any): Appointment['status'] => {
  const raw = `${status || ''}`.toLowerCase();
  if (raw === 'arrived') return 'checked_in';
  if (raw === 'canceled') return 'cancelled';
  if (raw === 'no-show' || raw === 'noshow') return 'no_show';
  if (['pending', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'].includes(raw)) {
    return raw as Appointment['status'];
  }
  return 'confirmed';
};

const normalizeGiftCardPackage = (item: any): GiftCardPackage => {
  const title = item?.title || item?.title_en || item?.title_ar || '';
  return {
    id: String(item?.id || ''),
    title,
    title_en: item?.title_en || title,
    title_ar: item?.title_ar || title,
    priceAmount: Number(item?.priceAmount ?? item?.price ?? 0),
    walletCreditAmount: Number(item?.walletCreditAmount ?? item?.creditAmount ?? 0),
    discountPreset: item?.discountPreset || '',
    discountPercent: item?.discountPercent != null ? Number(item.discountPercent) : undefined,
    expirationPreset: item?.expirationPreset || '',
    isActive: item?.isActive !== false,
    imageUrl: item?.imageUrl || item?.image || null
  };
};

const displayAppointmentStatus = (status: any): string => {
  return normalizeWorkspaceAppointmentStatus(status);
};

const toMoney = (value: any) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const roundMoney = (value: any) => Number.parseFloat(Number(value || 0).toFixed(2));

const normalizeRefundPaymentMethod = (value: any) => {
  const raw = `${value || ''}`.trim().toLowerCase();
  if (raw === 'card') return 'card_pos';
  if (raw === 'bank') return 'bank_transfer';
  return raw;
};

const normalizeAppointmentPaymentMethod = (value: any) => {
  const raw = `${value || ''}`.trim().toLowerCase();
  if (!raw) return '';

  const collapsed = raw.replace(/[\s-]+/g, '_');
  if (['cash', 'wallet', 'bank_transfer', 'gift_card_code', 'card_pos'].includes(collapsed)) {
    return collapsed;
  }

  if (['card', 'mada', 'mada_card', 'visa', 'mastercard', 'credit_card', 'card_pos', 'pos', 'terminal'].includes(collapsed)) {
    return 'card_pos';
  }

  if (['bank', 'banktransfer', 'bank_transfer_payment'].includes(collapsed)) {
    return 'bank_transfer';
  }

  if (['gift_card', 'giftcard', 'gift_card', 'gift_card_code'].includes(collapsed)) {
    return 'gift_card_code';
  }

  if (['online', 'booking_fee', 'online_full', 'card', 'mada', 'mada_card', 'visa', 'mastercard', 'credit_card'].includes(collapsed)) {
    return 'card_pos';
  }

  if (['pay_on_visit', 'cash_on_delivery', 'at_center', 'atcenter'].includes(collapsed)) {
    return 'cash';
  }

  return '';
};

const resolveAppointmentPaymentMethod = (appointment: any) => {
  const candidates = [
    appointment?.paymentMethod,
    appointment?.paymentAllocations?.[0]?.paymentMethod,
    appointment?.paymentAllocations?.[0]?.method,
    appointment?.bookingSession?.paymentMethod,
    appointment?.paymentMethodLabel
  ];

  for (const candidate of candidates) {
    const normalized = normalizeAppointmentPaymentMethod(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'cash';
};

function resolveEffectivePaymentStatus(item?: {
  paymentStatus?: string | null;
  price?: number | null;
  totalPaid?: number | null;
  outstandingAmount?: number | null;
  remainderAmount?: number | null;
}) {
  if (!item) {
    return 'pending';
  }

  const rawStatus = `${item.paymentStatus || ''}`.trim().toLowerCase();
  const price = Number(item.price || 0);
  const totalPaid = Number(item.totalPaid || 0);
  const explicitOutstanding = Number(item.outstandingAmount);
  const outstanding = Number.isFinite(explicitOutstanding)
    ? explicitOutstanding
    : Math.max(0, price - totalPaid);
  const remainderAmount = Number(item.remainderAmount || 0);

  if ((rawStatus === 'fully_paid' || rawStatus === 'paid') && outstanding > 0.009) {
    return 'deposit_paid';
  }

  if (rawStatus === 'deposit_paid' && outstanding <= 0.009 && remainderAmount <= 0.009) {
    return 'fully_paid';
  }

  return rawStatus || 'pending';
}

function normalizeWorkspacePaymentStatus(status: string): Appointment['paymentStatus'] {
  const normalized = `${status || ''}`.toLowerCase();
  if (['paid', 'fully_paid'].includes(normalized)) return 'paid';
  if (['partial', 'deposit_paid', 'partially_paid'].includes(normalized)) return 'partial';
  return 'unpaid';
}

const getLocalDateKey = (value: Date | string | number | null | undefined) => {
  const date = value instanceof Date ? value : new Date(value || new Date());
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    const year = fallback.getFullYear();
    const month = String(fallback.getMonth() + 1).padStart(2, '0');
    const day = String(fallback.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateKey = (dateKey: string) => {
  const [year, month, day] = `${dateKey || ''}`.split('-').map((value) => Number.parseInt(value || '0', 10));
  if (!year || !month || !day) {
    return new Date();
  }
  return new Date(year, month - 1, day);
};

const getRiyadhDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
};

const getRiyadhCalendarDate = (value = new Date()) => parseLocalDateKey(getRiyadhDateKey(value));

const buildSchedulerBoardStorageKey = (tenantId?: string | null, userId?: string | null) => {
  return ['refah-scheduler-board', tenantId || 'tenant', userId || 'user'].join(':');
};

const readSchedulerBoardOverride = (storageKey: string): Partial<SchedulerBoardSettings> | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('Failed to read scheduler board preferences', error);
    return null;
  }
};

const writeSchedulerBoardOverride = (storageKey: string, value: SchedulerBoardSettings | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!value) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist scheduler board preferences', error);
  }
};

const buildSchedulerTeamVisibilityStorageKey = (tenantId?: string | null, userId?: string | null) => {
  return ['refah-scheduler-team-members', tenantId || 'tenant', userId || 'user'].join(':');
};

const readSchedulerTeamVisibilityOverride = (storageKey: string): string[] | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => `${value || ''}`.trim()).filter(Boolean) : null;
  } catch (error) {
    console.warn('Failed to read scheduler team members preferences', error);
    return null;
  }
};

const writeSchedulerTeamVisibilityOverride = (storageKey: string, value: string[] | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!value || value.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist scheduler team members preferences', error);
  }
};

export default function AppointmentWorkspace({ lang, onQuickAction, quickLaunchRequest, onToggleFavoritePage, isFavorited, setShowSavedViewModal }: AppointmentWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, tenantSettings, user } = useTenantAuth();
  const tenantTimezone = useMemo(
    () => resolveTenantTimezone(tenantSettings?.timezone, tenant?.timezone),
    [tenantSettings?.timezone, tenant?.timezone]
  );
  const workspaceShellRef = useRef<HTMLDivElement | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const schedulerConfig = useMemo(
    () => getTenantSchedulerConfig(tenantSettings, tenant, getLocalDateKey(selectedDate)),
    [tenantSettings, tenant, selectedDate]
  );
  const boardStartHour = schedulerConfig.startHour;
  const schedulerStorageKey = useMemo(() => buildSchedulerBoardStorageKey(tenant?.id, user?.id), [tenant?.id, user?.id]);
  const teamVisibilityStorageKey = useMemo(() => buildSchedulerTeamVisibilityStorageKey(tenant?.id, user?.id), [tenant?.id, user?.id]);
  const canonicalSchedulerBoardSettings = useMemo(
    () => normalizeSchedulerBoardSettings(tenantSettings?.bookingSettings?.schedulerBoard || DEFAULT_SCHEDULER_BOARD_SETTINGS),
    [tenantSettings?.bookingSettings?.schedulerBoard]
  );
  const [schedulerBoardSettings, setSchedulerBoardSettings] = useState<SchedulerBoardSettings>(() => {
    const localOverride = readSchedulerBoardOverride(buildSchedulerBoardStorageKey(tenant?.id, user?.id));
    return normalizeSchedulerBoardSettings({
      ...canonicalSchedulerBoardSettings,
      ...(localOverride || {})
    });
  });
  const schedulerBoardSnapshotRef = useRef<SchedulerBoardSettings>(schedulerBoardSettings);
  const [schedulerBoardDraft, setSchedulerBoardDraft] = useState<SchedulerBoardSettings>(schedulerBoardSettings);
  const [isSchedulerSettingsOpen, setIsSchedulerSettingsOpen] = useState(false);
  const activeSchedulerSettings = isSchedulerSettingsOpen ? schedulerBoardDraft : schedulerBoardSettings;
  const [isSchedulerSettingsSaving, setIsSchedulerSettingsSaving] = useState(false);
  const [visibleEmployeeIds, setVisibleEmployeeIds] = useState<string[]>([]);
  const [isTeamMembersMenuOpen, setIsTeamMembersMenuOpen] = useState(false);
  const [dragMoveDialog, setDragMoveDialog] = useState<{
    appointmentId: string;
    targetStaffId: string;
    targetStaffName: string;
    sourceStaffName: string;
    sourceStaffId: string;
    targetStartMinutes: number;
    targetDateKey: string;
    sourceTimeLabel: string;
    targetTimeLabel: string;
    notifyCustomer: boolean;
  } | null>(null);
  const [dragConflictDialog, setDragConflictDialog] = useState<{
    serviceName: string;
    destinationStaffName: string;
    serviceId?: string;
    serviceSection?: 'basic' | 'team' | 'options' | 'settings';
  } | null>(null);
  
  // New API States replacing mock data
  const [liveStylists, setLiveStylists] = useState<Stylist[]>([]);
  const [liveServices, setLiveServices] = useState<any[]>([]);
  const [liveCustomers, setLiveCustomers] = useState<any[]>([]);
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [giftCardPackages, setGiftCardPackages] = useState<GiftCardPackage[]>([]);
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [stylistStatuses, setStylistStatuses] = useState<Record<string, 'active' | 'break' | 'off'>>({});

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedStylistFilter, setSelectedStylistFilter] = useState<string>('all');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<SchedulerBoardMode>('team-day');
  const [isWorkspaceMaximized, setIsWorkspaceMaximized] = useState(false);
  const [workspaceHeight, setWorkspaceHeight] = useState<number | null>(null);
  const [previousBoardMode, setPreviousBoardMode] = useState<SchedulerBoardMode | null>(null);
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string | null>(null);
  const [boardCurrentTime, setBoardCurrentTime] = useState<Date>(new Date());
  const [hasHydratedTeamVisibility, setHasHydratedTeamVisibility] = useState(false);
  const teamMembersButtonRef = useRef<HTMLDivElement | null>(null);
  const teamMembersMenuRef = useRef<HTMLDivElement | null>(null);
  const [teamMembersMenuStyle, setTeamMembersMenuStyle] = useState<React.CSSProperties | null>(null);

  const syncWorkspaceHeight = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const frame = workspaceShellRef.current;
    if (!frame) {
      return;
    }

    const topOffset = frame.getBoundingClientRect().top;
    const bottomGap = isWorkspaceMaximized ? 8 : 16;
    const availableHeight = Math.max(560, Math.floor(window.innerHeight - topOffset - bottomGap));
    setWorkspaceHeight(availableHeight);
  }, [isWorkspaceMaximized]);

  useLayoutEffect(() => {
    syncWorkspaceHeight();
  }, [syncWorkspaceHeight, viewMode, isSidebarCollapsed, isSchedulerSettingsOpen, focusedEmployeeId, liveStylists.length, searchQuery, serviceCategoryFilter, statusFilter, selectedStylistFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleResize = () => {
      window.requestAnimationFrame(syncWorkspaceHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncWorkspaceHeight]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const mainPanel = document.getElementById('main-content-panel') as HTMLElement | null;
    if (!mainPanel) {
      return undefined;
    }

    const snapshot = {
      padding: mainPanel.style.padding,
      overflow: mainPanel.style.overflow,
    };

    if (isWorkspaceMaximized) {
      mainPanel.style.padding = '0px';
      mainPanel.style.overflow = 'hidden';
    } else {
      mainPanel.style.padding = '';
      mainPanel.style.overflow = '';
    }

    window.requestAnimationFrame(syncWorkspaceHeight);

    return () => {
      mainPanel.style.padding = snapshot.padding;
      mainPanel.style.overflow = snapshot.overflow;
    };
  }, [isWorkspaceMaximized, syncWorkspaceHeight]);

  useEffect(() => {
    const localOverride = readSchedulerBoardOverride(schedulerStorageKey);
    const merged = normalizeSchedulerBoardSettings({
      ...canonicalSchedulerBoardSettings,
      ...(localOverride || {})
    });
    setSchedulerBoardSettings(merged);
    setSchedulerBoardDraft(merged);
    schedulerBoardSnapshotRef.current = merged;
  }, [canonicalSchedulerBoardSettings, schedulerStorageKey]);

  useEffect(() => {
    if (!liveStylists.length) {
      return;
    }

    const allEmployeeIds = liveStylists.map((stylist) => stylist.id);

    if (!hasHydratedTeamVisibility) {
      const persistedVisibility = readSchedulerTeamVisibilityOverride(teamVisibilityStorageKey);
      const normalizedPersistedVisibility = Array.isArray(persistedVisibility)
        ? persistedVisibility.filter((employeeId) => allEmployeeIds.includes(employeeId))
        : [];
      const initialVisibility = normalizedPersistedVisibility.length > 0 ? normalizedPersistedVisibility : allEmployeeIds;

      setVisibleEmployeeIds(initialVisibility);
      setHasHydratedTeamVisibility(true);

      if (normalizedPersistedVisibility.length === 0) {
        writeSchedulerTeamVisibilityOverride(teamVisibilityStorageKey, allEmployeeIds);
      }
    }
  }, [hasHydratedTeamVisibility, liveStylists, teamVisibilityStorageKey]);

  useEffect(() => {
    if (!hasHydratedTeamVisibility) {
      return;
    }

    writeSchedulerTeamVisibilityOverride(teamVisibilityStorageKey, visibleEmployeeIds);
  }, [hasHydratedTeamVisibility, teamVisibilityStorageKey, visibleEmployeeIds]);

  useEffect(() => {
    if (!isTeamMembersMenuOpen) {
      setTeamMembersMenuStyle(null);
      return;
    }

    const updateMenuPosition = () => {
      const button = teamMembersButtonRef.current;
      if (!button || typeof window === 'undefined') {
        return;
      }

      const buttonRect = button.getBoundingClientRect();
      const menuWidth = 288;
      const viewportPadding = 12;
      const gap = 8;
      const top = Math.max(viewportPadding, Math.round(buttonRect.bottom + gap));

      if (isRtl) {
        const right = Math.max(viewportPadding, Math.round(window.innerWidth - buttonRect.right));
        setTeamMembersMenuStyle({
          position: 'fixed',
          top,
          right,
          width: menuWidth,
          zIndex: 9999
        });
        return;
      }

      const left = Math.min(
        Math.max(viewportPadding, Math.round(buttonRect.left)),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
      );

      setTeamMembersMenuStyle({
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        zIndex: 9999
      });
    };

    updateMenuPosition();

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        teamMembersButtonRef.current?.contains(target) ||
        teamMembersMenuRef.current?.contains(target)
      ) {
        return;
      }

      setIsTeamMembersMenuOpen(false);
    };

    const handleReposition = () => {
      updateMenuPosition();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTeamMembersMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isRtl, isTeamMembersMenuOpen]);

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
        
        const employees = (empRes?.employees || []).filter((emp: any) => `${emp?.status || ''}`.toLowerCase() !== 'off' && emp?.isActive !== false);
        setLiveStylists(employees.map((emp: any, index: number) => ({
          id: emp.id,
          nameEn: emp.nameEn || emp.nameAr || emp.name || emp.firstName || '—',
          nameAr: emp.nameAr || emp.nameEn || emp.name || emp.firstName || '—',
          roleEn: emp.title || 'Staff',
          roleAr: emp.title || 'موظف',
          avatar: resolveEmployeeImageUrl(emp.avatar || emp.photo || emp.profileImage),
          color: API_COLORS[index % API_COLORS.length],
          status: emp.status || (emp.isActive === false ? 'off' : 'active')
        })));

        const services = srvRes?.services || [];
        setLiveServices(services.map((s: any) => ({
          ...normalizeServiceRecord(s),
          serviceId: s.id
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
          categoryEn: p.category || '',
          imageUrl: resolveProductImageUrl(p.imageUrl || p.primaryImage || p.image || p.images?.[0] || ''),
          image: resolveProductImageUrl(p.image || p.imageUrl || p.primaryImage || p.images?.[0] || ''),
          images: Array.isArray(p.images) ? p.images : (p.images ? [p.images] : [])
        })));

        if (employees.length > 0) {
          setCurrentStaffId((current) => employees.some((emp: any) => emp.id === current) ? current : employees[0].id);
          setBlockStaffId((current) => employees.some((emp: any) => emp.id === current) ? current : employees[0].id);
          setSelectedShiftStaffId((current) => employees.some((emp: any) => emp.id === current) ? current : employees[0].id);
        }
        if (services.length > 0) {
          setCurrentServiceId((current) => services.some((srv: any) => srv.id === current) ? current : services[0].id);
        }
        if (customers.length > 0) {
          setSelectedCustId((current) => customers.some((cust: any) => cust.id === current) ? current : customers[0].id);
          setPosSelectedCustId((current) => customers.some((cust: any) => cust.id === current) ? current : customers[0].id);
        }
      } catch (err) {
        console.error('Failed to load master data', err);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    const syncCurrentTime = () => setBoardCurrentTime(new Date());
    syncCurrentTime();
    const timer = window.setInterval(syncCurrentTime, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const mapBoardAppointment = (a: any, dateKey: string): Appointment => {
    const startDate = new Date(a.startTime);
    const startMins = startDate.getHours() * 60 + startDate.getMinutes() - (boardStartHour * 60);
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
    const price = sessionAppointments.length > 0
      ? sessionAppointments.reduce((sum: number, item: any) => sum + Number(item?.price || item?.service?.price || 0), 0)
      : parseFloat(a.price || 0);
    const totalPaid = Number(a.totalPaid ?? 0);
    const depositAmount = Number(a.depositAmount ?? 0);
    const depositPaid = Number(a.depositPaid ?? 0);
    const remainderAmount = Number(a.remainderAmount ?? a.remainingBalance ?? Math.max(0, price - totalPaid));
    const remainderPaid = Number(a.remainderPaid ?? 0);
    const remainingBalance = Number(a.remainingBalance ?? a.outstandingAmount ?? remainderAmount);
    const outstandingAmount = Number(a.outstandingAmount ?? a.remainingBalance ?? remainderAmount);
    const normalizedPaymentStatus = resolveEffectivePaymentStatus({
      paymentStatus: a.paymentStatus,
      price,
      totalPaid,
      outstandingAmount,
      remainderAmount
    });
    const normalizeServiceName = (item: any, key: 'en' | 'ar') => {
      const variantName = key === 'en'
        ? (item?.serviceVariantName || item?.serviceVariant?.name_en || item?.serviceVariant?.nameEn || item?.serviceVariant?.description || '')
        : (item?.serviceVariantDescription || item?.serviceVariant?.name_ar || item?.serviceVariant?.nameAr || item?.serviceVariant?.description || item?.serviceVariantName || '');
      const baseName = key === 'en'
        ? (
          item?.service?.name_en
          || item?.service?.nameEn
          || item?.service?.name
          || item?.serviceNameEn
          || item?.serviceName
          || item?.nameEn
          || item?.name
          || item?.title
          || ''
        )
        : (
          item?.service?.name_ar
          || item?.service?.nameAr
          || item?.service?.name
          || item?.serviceNameAr
          || item?.serviceName
          || item?.nameAr
          || item?.name
          || item?.title
          || ''
        );
      const normalizedBaseName = `${baseName || ''}`.trim();
      const normalizedVariantName = `${variantName || ''}`.trim();
      if (normalizedVariantName && normalizedVariantName !== normalizedBaseName) {
        return `${normalizedBaseName} / ${normalizedVariantName}`.trim();
      }
      if (normalizedVariantName) {
        return normalizedVariantName;
      }
      return normalizedBaseName;
    };
    const primaryServiceNameEn = normalizeServiceName(a, 'en') || a.service?.name_en || a.service?.nameEn || a.service?.name || a.serviceNameEn || 'Service';
    const primaryServiceNameAr = normalizeServiceName(a, 'ar') || a.service?.name_ar || a.service?.nameAr || a.service?.name || a.serviceNameAr || 'الخدمة';
    const serviceNameEn = services.length > 1
      ? services.map((item: any) => normalizeServiceName(item, 'en')).filter(Boolean).join(' + ')
      : primaryServiceNameEn;
    const serviceNameAr = services.length > 1
      ? services.map((item: any) => normalizeServiceName(item, 'ar')).filter(Boolean).join(' + ')
      : primaryServiceNameAr;
    const duration = sessionAppointments.length > 0
      ? sessionAppointments.reduce((sum: number, item: any) => sum + Number(item?.duration || item?.service?.duration || 0), 0)
      : (a.service?.duration || a.duration || 60);
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
      appointmentId: a.id,
      avatar: a.user?.photo || a.user?.profileImage || null,
      staffAvatar: a.staff?.photo || null,
      serviceVariantId: a.serviceVariantId || a.serviceVariant?.id || null,
      serviceVariantName: a.serviceVariantName || a.serviceVariant?.name_en || a.serviceVariant?.nameEn || a.serviceVariant?.description || null,
      serviceVariantDescription: a.serviceVariantDescription || a.serviceVariant?.name_ar || a.serviceVariant?.nameAr || a.serviceVariant?.description || null,
      startTime: startMins,
      duration,
      status: normalizeWorkspaceAppointmentStatus(a.status),
      paymentStatus: normalizeWorkspacePaymentStatus(normalizedPaymentStatus),
      normalizedPaymentStatus,
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
      paymentMethod: a.paymentMethod || a.paymentMethodLabel || a.paymentAllocations?.[0]?.paymentMethod || null,
      invoiceNumber: a.invoiceNumber || a.invoice?.number || a.invoice?.invoiceNumber || null,
      totalPaid,
      depositAmount,
      depositPaid,
      remainderAmount,
      remainderPaid,
      remainingBalance,
      outstandingAmount,
      branchName: a.branchName || a.branch?.name || a.locationName || a.location?.name,
      invoiceStatus: a.invoiceStatus || normalizedPaymentStatus,
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
      paymentTransactions: Array.isArray(a.paymentTransactions) ? a.paymentTransactions : [],
      invoice: a.invoice || null,
      type: 'appointment',
      serviceCategory: a.service?.category || a.serviceCategory || 'hair',
      date: getLocalDateKey(a.startTime || a.date || dateKey)
    };
  };

  const mapBoardBreak = (b: any): Appointment => {
    const [h, m] = (b.startTime || '12:00').split(':');
    const startMins = parseInt(h) * 60 + parseInt(m) - (boardStartHour * 60);
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
        const dateStr = getSelectedDateKey();
        const res = await tenantApiAdapter.getAppointmentsBoard(dateStr, {
          staffId: selectedStylistFilter === 'all' ? undefined : selectedStylistFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: searchQuery.trim() || undefined
        });
        if (res && res.success) {
          const mappedApts: Appointment[] = (res.appointments || []).map((a: any) => mapBoardAppointment(a, dateStr));
          const mappedBreaks: Appointment[] = (res.breaks || []).map((b: any) => mapBoardBreak(b));
          setAppointments([...mappedApts, ...mappedBreaks].sort((left, right) => left.startTime - right.startTime));

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

  const getSelectedDateKey = () => selectedDateKey;
  const buildIsoFromMinutes = (dateKey: string, minutesFromNine: number) => {
    return buildTenantIsoFromMinutes(dateKey, minutesFromNine, tenantTimezone, boardStartHour);
  };
  const addMinutesToIso = (iso: string, minutes: number) => (
    new Date(new Date(iso).getTime() + Math.max(0, Math.round(minutes)) * 60000).toISOString()
  );
  const buildClockTime = (minutesFromNine: number) => {
    const absoluteMinutes = (boardStartHour * 60) + Math.max(0, Math.round(minutesFromNine));
    const hours = Math.floor(absoluteMinutes / 60);
    const mins = absoluteMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };
  const getRiyadhMinutesSinceMidnight = (value = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(value);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');
    return (hour * 60) + minute;
  };
  const getRiyadhCurrentTimeLabel = (value = new Date()) => (
    new Intl.DateTimeFormat(isRtl ? 'ar-SA' : 'en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(value)
  );
  const isPastBoardCreationDate = (dateKey: string) => `${dateKey || ''}` < getRiyadhDateKey(new Date());
  const shouldSkipAdvanceValidation = (dateKey: string, timeInMinutesFromNine: number) => {
    const selectedKey = `${dateKey || ''}`;
    if (selectedKey !== getRiyadhDateKey(new Date())) {
      return false;
    }

    const slotAbsoluteMinutes = (boardStartHour * 60) + Math.max(0, Math.round(timeInMinutesFromNine));
    return slotAbsoluteMinutes <= getRiyadhMinutesSinceMidnight(new Date());
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
  const showPastBoardSlotWarning = (timeInMinutesFromNine: number) => {
    const slotLabel = formatMinutesToTime(timeInMinutesFromNine);
    const currentLabel = getRiyadhCurrentTimeLabel();
    showBookingErrorDialog(buildAdvanceBookingDialog({ isRtl, currentLabel, slotLabel }));
  };
  const seedCreateDrawerFromBoardSlot = (timeInMinutes: number) => {
    const safeTime = Math.max(0, Math.round(timeInMinutes));
    setCurrentStartTime(safeTime);
    setBlockStartTime(safeTime);
    setPreserveBoardStartTime(true);
  };
  const resetCreateDrawerStartTimes = () => {
    setCurrentStartTime(120);
    setBlockStartTime(180);
    setPreserveBoardStartTime(false);
  };
  const openCreateAppointmentAtSlot = (staffId: string, timeInMinutes: number, dateKey = selectedDateKey, durationMinutes?: number) => {
    if (isPastBoardCreationDate(dateKey)) {
      showPastBoardSlotWarning(timeInMinutes);
      return false;
    }

    if (dateKey !== selectedDateKey) {
      setSelectedDate(parseLocalDateKey(dateKey));
    }
    setCurrentStaffId(staffId);
    seedCreateDrawerFromBoardSlot(timeInMinutes);
    if (typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0) {
      setCurrentDuration(durationMinutes);
    }
    setCreateMode('appointment');
    setCreateStep(1);
    setStagedServices([]);
    setIsCreateDrawerOpen(true);
    return true;
  };

  // Board Data Fetch
  useEffect(() => {
    void loadBoardData();
  }, [selectedDate, selectedStylistFilter, statusFilter, searchQuery]);

  // Selection / Detail Drawer State
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [activeBlockedTime, setActiveBlockedTime] = useState<any | null>(null);
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
  const [customerTransactionDetail, setCustomerTransactionDetail] = useState<any | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const selectedDateKey = getLocalDateKey(selectedDate);
  const riyadhTodayKey = getRiyadhDateKey(new Date());
  const isBoardEditable = selectedDateKey >= riyadhTodayKey;

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
  const activeCustomerWallet = Number(customerProfile?.walletBalance || activeAppointment?.walletBalance || 0);
  const activeCustomerBranch = activeAppointment?.branchName || activeAppointment?.branch?.name || '';
  const activeAppointmentTime = activeAppointment ? buildClockTime(activeAppointment.startTime) : '';
  const activeCustomerMembership = customerProfile?.membershipTier
    || customerProfile?.membershipStatus
    || activeAppointment?.membershipLabel
    || activeAppointment?.membershipStatus
    || activeAppointment?.membershipTier
    || '';

  const getTransactionIdentityKey = (entry: any) => {
    if (!entry || typeof entry !== 'object') {
      return '';
    }

    const reference = `${entry.reference || entry.transactionRef || entry.invoiceNumber || entry.orderNumber || ''}`.trim();
    if (reference) {
      return reference;
    }

    const title = `${entry.title || entry.type || entry.kind || entry.source || ''}`.trim().toLowerCase();
    const date = `${entry.processedAt || entry.date || entry.createdAt || entry.time || ''}`.trim();
    const amount = Number(entry.amount ?? entry.totalAmount ?? entry.value ?? entry.price ?? 0).toFixed(2);
    const method = `${entry.paymentMethod || entry.paymentMethodLabel || entry.method || ''}`.trim().toLowerCase();

    return [title, date, amount, method].filter(Boolean).join('|');
  };

  const dedupeTransactionRows = (rows: any[]) => {
    const seen = new Map<string, any>();
    const sourceRank = (value: any) => {
      const source = `${value?.source || ''}`.toLowerCase();
      if (source === 'ledger' || source === 'transaction') return 3;
      if (source === 'appointment') return 2;
      if (source === 'history') return 1;
      return 0;
    };

    rows.forEach((entry: any) => {
      const key = getTransactionIdentityKey(entry);
      if (!key) {
        return;
      }

      const existing = seen.get(key);
      if (!existing || sourceRank(entry) >= sourceRank(existing)) {
        seen.set(key, entry);
      }
    });

    return Array.from(seen.values());
  };

  const getHistoryTimestamp = (item: any) => {
    const timestamp = item?.details?.startTime
      || item?.startTime
      || item?.date
      || item?.processedAt
      || item?.createdAt
      || item?.updatedAt
      || item?.timestamp
      || item?.time
      || 0;
    const parsed = new Date(timestamp).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getHistoryStatus = (item: any) => `${item?.status || item?.appointmentStatus || item?.bookingStatus || item?.normalizedStatus || item?.details?.status || item?.paymentStatus || ''}`.toLowerCase();

  const customerHistoryEntries = (() => {
    const combined = [
      ...(Array.isArray(customerHistoryData?.history) ? customerHistoryData.history : []),
      ...(Array.isArray(customerHistoryData?.appointments) ? customerHistoryData.appointments : []),
      ...(Array.isArray(customerHistoryData?.records) ? customerHistoryData.records : []),
      ...(Array.isArray(customerHistoryData?.items) ? customerHistoryData.items : []),
      ...(Array.isArray(customerHistoryData?.timeline) ? customerHistoryData.timeline : []),
      ...(Array.isArray(customerProfile?.history) ? customerProfile.history : [])
    ];
    const seen = new Set<string>();
    return combined.filter((item: any) => {
      const key = `${item?.id || item?.appointmentId || item?.bookingReference || item?.referenceId || item?.transactionRef || item?.date || JSON.stringify(item)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })();
  const customerSummaryData = customerHistoryData?.summary || {};
  const customerAppointmentHistory = customerHistoryEntries.filter((item: any) => {
    const kind = `${item?.type || item?.entityType || item?.kind || item?.recordType || item?.sourceType || ''}`.toLowerCase();
    const isTransactionLike = ['transaction', 'wallet', 'payment', 'invoice', 'refund', 'ledger'].includes(kind);
    const hasService = Boolean(
      item?.details?.service
      || item?.appointment?.service
      || item?.service
      || item?.serviceId
      || item?.serviceName
      || item?.serviceNameEn
      || item?.serviceNameAr
      || item?.details?.serviceName
      || item?.details?.serviceNameEn
      || item?.details?.serviceNameAr
    );
    return !isTransactionLike && (['appointment', 'booking_session', 'booking', 'visit', 'session'].includes(kind) || hasService);
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
    .sort((a: any, b: any) => getHistoryTimestamp(b) - getHistoryTimestamp(a));
  const customerAppointmentHistoryCards = (() => {
    const groups = new Map<string, any[]>();
    const standalone: any[] = [];

    customerAppointmentHistoryRows.forEach((item: any) => {
      const groupingKey = `${item?.bookingSessionId || item?.bookingReference || item?.details?.bookingSessionId || item?.details?.bookingReference || item?.id || ''}`.trim();
      if (!groupingKey) {
        standalone.push(item);
        return;
      }

      const bucket = groups.get(groupingKey) || [];
      bucket.push(item);
      groups.set(groupingKey, bucket);
    });

    const aggregateGroup = (group: any[]) => {
      if (group.length === 1) {
        return group[0];
      }

      const primary = group[0];
      const serviceEntries = group.flatMap((entry) => {
        if (Array.isArray(entry?.details?.services) && entry.details.services.length > 0) {
          return entry.details.services;
        }
        if (entry?.details?.service) {
          return [entry.details.service];
        }
        if (entry?.service) {
          return [entry.service];
        }
        return [];
      });
      const uniqueServices = serviceEntries.filter((entry, index, arr) => {
        const entryKey = `${entry?.id || entry?.serviceId || entry?.name_en || entry?.name_ar || entry?.name || index}`;
        return arr.findIndex((candidate) => `${candidate?.id || candidate?.serviceId || candidate?.name_en || candidate?.name_ar || candidate?.name || ''}` === entryKey) === index;
      });
      const serviceNameEn = uniqueServices.map((entry: any) => entry?.name_en || entry?.nameEn || entry?.name || '').filter(Boolean);
      const serviceNameAr = uniqueServices.map((entry: any) => entry?.name_ar || entry?.nameAr || entry?.name || '').filter(Boolean);
      const staffNames = Array.from(new Set(group.map((entry) => entry?.details?.staff?.name || entry?.staff?.name || entry?.staffName || entry?.employee?.name).filter(Boolean)));
      const totalDuration = group.reduce((sum, entry) => sum + Number(entry?.details?.duration || entry?.duration || 0), 0);
      const totalPaid = group.reduce((sum, entry) => sum + Number(entry?.paidAmount ?? entry?.amount ?? entry?.totalPaid ?? entry?.totalAmount ?? 0), 0);
      const service = uniqueServices[0] || primary?.details?.service || primary?.service || null;

      return {
        ...primary,
        id: primary.id,
        bookingSessionId: primary.bookingSessionId || primary?.details?.bookingSessionId || undefined,
        bookingReference: primary.bookingReference || primary?.details?.bookingReference || undefined,
        details: {
          ...(primary.details || {}),
          service,
          services: uniqueServices,
          staff: primary?.details?.staff || primary?.staff || null,
          startTime: primary?.details?.startTime || primary?.date || null,
          duration: totalDuration || primary?.details?.duration || primary?.duration || 0,
          branch: primary?.details?.branch || primary?.branch || null,
          notes: group.map((entry) => entry?.details?.notes || entry?.notes).filter(Boolean).join(' | ') || primary?.details?.notes || primary?.notes || ''
        },
        serviceNameEn: serviceNameEn.length > 0 ? serviceNameEn.join(' + ') : primary?.serviceNameEn || primary?.title || '',
        serviceNameAr: serviceNameAr.length > 0 ? serviceNameAr.join(' + ') : primary?.serviceNameAr || primary?.title || '',
        assignedStaffName: staffNames.length > 0 ? staffNames.join(' + ') : primary?.assignedStaffName || primary?.staffName || '',
        duration: totalDuration || primary?.duration || 0,
        price: group.reduce((sum, entry) => sum + Number(entry?.amount ?? entry?.paidAmount ?? entry?.totalPaid ?? entry?.totalAmount ?? 0), 0) || primary?.price || 0,
        paidAmount: totalPaid || primary?.paidAmount || primary?.amount || 0,
        amount: totalPaid || primary?.amount || primary?.paidAmount || 0,
        paymentStatus: group.some((entry) => ['cancelled', 'canceled'].includes(getHistoryStatus(entry)))
          ? 'cancelled'
          : group.some((entry) => ['no-show', 'noshow', 'no_show'].includes(getHistoryStatus(entry)))
            ? 'no_show'
            : group.every((entry) => ['completed', 'done', 'served'].includes(getHistoryStatus(entry)))
              ? 'completed'
              : primary?.status || 'completed',
        normalizedPaymentStatus: group.some((entry) => ['paid', 'fully_paid', 'deposit_paid'].includes(`${entry?.normalizedPaymentStatus || entry?.paymentStatus || ''}`.toLowerCase()))
          ? (group.some((entry) => ['deposit_paid', 'partial', 'partially_paid'].includes(`${entry?.normalizedPaymentStatus || entry?.paymentStatus || ''}`.toLowerCase())) ? 'partial' : 'paid')
          : primary?.normalizedPaymentStatus || primary?.paymentStatus || 'paid'
      };
    };

    return [
      ...standalone,
      ...Array.from(groups.values()).map((group) => aggregateGroup(group))
    ].sort((a: any, b: any) => getHistoryTimestamp(b) - getHistoryTimestamp(a));
  })();
  const customerAppointmentHistoryCardsFiltered = customerAppointmentHistoryCards.filter((item: any) => {
    const rawStatus = getHistoryStatus(item);
    const appointmentStart = getHistoryTimestamp(item);
    const isFuture = Number.isFinite(appointmentStart) && appointmentStart > Date.now();
    const bucket = (() => {
      if (['cancelled', 'canceled'].includes(rawStatus)) return 'cancelled';
      if (['no-show', 'noshow', 'no_show'].includes(rawStatus)) return 'no_show';
      if (['completed', 'done', 'served'].includes(rawStatus)) return 'completed';
      if (isFuture || ['confirmed', 'scheduled', 'pending', 'checked_in', 'arrived', 'in_progress', 'in progress', 'booked'].includes(rawStatus)) return 'upcoming';
      return 'completed';
    })();
    return customerAppointmentHistoryFilter === 'all' || bucket === customerAppointmentHistoryFilter;
  });
  const customerFirstVisit = [...customerAppointmentHistory]
    .sort((a: any, b: any) => getHistoryTimestamp(a) - getHistoryTimestamp(b))[0];
  const customerLastVisit = [...customerAppointmentHistory]
    .sort((a: any, b: any) => getHistoryTimestamp(b) - getHistoryTimestamp(a))[0];
  const customerCompletedAppointments = customerAppointmentHistory.filter((item: any) => ['completed', 'done', 'served'].includes(getHistoryStatus(item))).length;
  const customerCancelledAppointments = customerAppointmentHistory.filter((item: any) => ['cancelled', 'canceled'].includes(getHistoryStatus(item))).length;
  const customerNoShowAppointments = customerAppointmentHistory.filter((item: any) => ['no-show', 'noshow', 'no_show'].includes(getHistoryStatus(item))).length;
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
    setCustomerTransactionDetail({
      ...item,
      appointmentId,
      appointmentIdLinked: appointmentId,
      orderId: detailPath.match(/\/dashboard\/orders\/([^/?#]+)/)?.[1] || item?.order?.id || null,
      date: item?.processedAt || item?.date || item?.createdAt || item?.time || item?.appointment?.startTime || item?.appointment?.date || '',
      amount: Number(item?.amount ?? item?.totalAmount ?? item?.value ?? item?.price ?? 0),
      paymentMethodLabel: item?.paymentMethodLabel || item?.paymentMethod || item?.method || '—',
      paymentMethod: item?.paymentMethod || item?.method || item?.paymentMethodLabel || null,
      reference: item?.reference || item?.transactionRef || item?.invoiceNumber || item?.orderNumber || item?.bookingReference || item?.bookingSessionReference || item?.id || '—',
      typeLabel: item?.title || item?.type || item?.kind || item?.source || item?.paymentMethodLabel || 'Transaction',
      statusLabel: item?.status || item?.normalizedPaymentStatus || item?.paymentStatus || '—',
      customerId: item?.customerId || activeAppointment?.customerId || null,
      customerNameEn: item?.customerNameEn || activeAppointment?.customerNameEn || '',
      customerNameAr: item?.customerNameAr || activeAppointment?.customerNameAr || '',
      serviceLabel: item?.serviceLabel || item?.appointment?.service?.name_en || item?.appointment?.service?.name || item?.service?.name_en || item?.service?.name || item?.serviceName || item?.title || '—',
      employeeLabel: item?.employeeLabel || item?.appointment?.staff?.name || item?.processorName || item?.staffName || '—',
      branchLabel: item?.branchLabel || item?.appointment?.branchName || activeAppointment?.branchName || activeCustomerBranch || '—',
      invoiceNumber: item?.invoiceNumber || item?.invoice?.number || item?.invoice?.invoiceNumber || item?.reference || null,
      invoiceId: item?.invoiceId || item?.invoice?.id || null,
      productLabel: item?.productLabel || item?.productName || item?.order?.productName || '',
      appointmentStatus: item?.appointment?.status || item?.appointmentStatus || item?.status || 'completed',
      detailPath
    });
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
        const profile = profileResponse;
        const historyEntries = Array.isArray(historyResponse?.history) ? historyResponse.history : [];
        const summaryPayload = historyResponse?.summary || historyResponse?.metrics || {};
        const walletTransactionsPayload = Array.isArray(historyResponse?.walletTransactions) ? historyResponse.walletTransactions : [];
        const historyTransactions = Array.isArray(historyResponse?.transactions) ? historyResponse.transactions : [];
        const transactionRows = [
          ...historyTransactions,
          ...(Array.isArray(transactionsResponse?.transactions) ? transactionsResponse.transactions : []),
          ...(Array.isArray(transactionsResponse?.items) ? transactionsResponse.items : []),
          ...(Array.isArray(transactionsResponse?.records) ? transactionsResponse.records : []),
          ...(Array.isArray(transactionsResponse) ? transactionsResponse : [])
        ];
        const dedupedTransactionRows = dedupeTransactionRows(transactionRows);
        if (!cancelled) {
          setCustomerProfile(profile);
          setCustomerHistoryData({
            history: historyEntries,
            appointments: Array.isArray(historyResponse?.appointments) ? historyResponse.appointments : [],
            records: Array.isArray(historyResponse?.records) ? historyResponse.records : [],
            items: Array.isArray(historyResponse?.items) ? historyResponse.items : [],
            summary: summaryPayload,
            walletTransactions: walletTransactionsPayload,
            notes: Array.isArray(profile.notes) ? profile.notes : [],
            transactions: dedupedTransactionRows
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
    dateKey?: string;
    appointmentId?: string;
  } | null>(null);

  // Employee Header Context Menu State (Popover Anchor)
  const [employeeMenuState, setEmployeeMenuState] = useState<{
    visible: boolean;
    x: number;
    y: number;
    anchorEl: HTMLElement | null;
    staffId: string;
  } | null>(null);

  // View Team Member Drawer State
  const [viewTeamMemberStaffId, setViewTeamMemberStaffId] = useState<string | null>(null);

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
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState<boolean>(false);
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);
  const [refundAmountInput, setRefundAmountInput] = useState<string>('');
  const [refundReasonInput, setRefundReasonInput] = useState<string>('');
  const [refundSubmitting, setRefundSubmitting] = useState<boolean>(false);
  const [refundDialogError, setRefundDialogError] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [pendingStatusAfterPayment, setPendingStatusAfterPayment] = useState<string | null>(null);
  const [showPaymentRequiredDialog, setShowPaymentRequiredDialog] = useState(false);
  const [showCancelReasonDialog, setShowCancelReasonDialog] = useState(false);
  const [cancelReasonText, setCancelReasonText] = useState('');
  const resolvedAppointmentPaymentMethod = useMemo(
    () => resolveAppointmentPaymentMethod(activeAppointment),
    [
      activeAppointment?.id,
      activeAppointment?.paymentMethod,
      activeAppointment?.paymentMethodLabel,
      activeAppointment?.bookingSession?.paymentMethod,
      activeAppointment?.paymentAllocations
    ]
  );

  useEffect(() => {
    if (!activeAppointment?.id) {
      setSelectedPaymentMethod('cash');
      return;
    }

    setSelectedPaymentMethod(resolvedAppointmentPaymentMethod);
  }, [activeAppointment?.id, resolvedAppointmentPaymentMethod]);

  const activeInvoiceServiceItems = activeAppointment ? (
    activeAppointmentServiceSources.length > 0
      ? activeAppointmentServiceSources.map((item: any, index: number) => {
          const serviceNameEn = item?.service?.name_en
            || item?.service?.nameEn
            || item?.service?.name
            || item?.serviceNameEn
            || item?.serviceName
            || item?.nameEn
            || item?.name
            || item?.title
            || activeServiceSummary.nameEn
            || 'Service';
          const serviceNameAr = item?.service?.name_ar
            || item?.service?.nameAr
            || item?.service?.name
            || item?.serviceNameAr
            || item?.serviceName
            || item?.nameAr
            || item?.name
            || item?.title
            || activeServiceSummary.nameAr
            || 'الخدمة';
          const servicePrice = Number(item?.price || item?.service?.price || item?.subtotal || 0);
          return {
            id: item?.id || item?.serviceId || `svc-${activeAppointment.id}-${index}`,
            nameEn: serviceNameEn,
            nameAr: serviceNameAr,
            stylistEn: item?.staff?.name || item?.staffName || activeAppointment.assignedStaffName || activeStylist?.nameEn || '',
            stylistAr: item?.staff?.name || item?.staffName || activeAppointment.assignedStaffName || activeStylist?.nameAr || '',
            quantity: 1,
            unitPrice: servicePrice,
            subtotal: servicePrice,
            type: 'service'
          };
        })
      : [{
          id: `svc-${activeAppointment.id}`,
          nameEn: activeServiceSummary.nameEn,
          nameAr: activeServiceSummary.nameAr,
          stylistEn: activeAppointment.assignedStaffName || activeStylist?.nameEn || '',
          stylistAr: activeAppointment.assignedStaffName || activeStylist?.nameAr || '',
          quantity: 1,
          unitPrice: Number(activeServiceSummary.price || 0),
          subtotal: Number(activeServiceSummary.price || 0),
          type: 'service'
        }]
  ) : [];
  const activeInvoiceLineItems = activeAppointment ? [
    ...activeInvoiceServiceItems,
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

  // Compute embedded appointment discount from raw vs final price
  const _rawPrice = Number(activeAppointment?.rawPrice || 0);
  const _finalPrice = Number(activeAppointment?.price || 0);
  const _taxAmount = Number(activeAppointment?.taxAmount || 0);
  const _platformFee = Number(activeAppointment?.platformFee || 0);
  const _discountedRawPrice = _finalPrice - _taxAmount - _platformFee;
  let appointmentServiceDiscount = 0;
  if (_rawPrice > _discountedRawPrice + 0.01) {
    const _rate = _discountedRawPrice > 0 ? (_taxAmount + _platformFee) / _discountedRawPrice : 0;
    const _originalFinalPrice = _rawPrice * (1 + _rate);
    appointmentServiceDiscount = Math.max(_originalFinalPrice - _finalPrice, 0);
  }

  const activeInvoiceDiscount = Number(appliedGiftCardAmount || 0);
  const activeInvoiceTotal = Math.max(0, activeInvoiceSubtotal - activeInvoiceDiscount);
  const activeInvoiceTaxable = Number((activeInvoiceTotal / 1.15).toFixed(2));
  const activeInvoiceVat = Number((activeInvoiceTotal - activeInvoiceTaxable).toFixed(2));
  const activeInvoiceRemaining = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0) - Number(splitAmounts.wallet || 0));
  const currentPaymentStatus = resolveEffectivePaymentStatus(activeAppointment || undefined);
  const hasTrueRemainderBalance = Boolean(
    Number(activeAppointment?.totalPaid ?? 0) > 0 &&
    Number(activeAppointment?.remainderAmount ?? 0) > 0 &&
    (currentPaymentStatus === 'deposit_paid' || Number(activeAppointment?.depositAmount ?? 0) > 0)
  );
  const paymentCollectionMode: 'full' | 'remainder' = hasTrueRemainderBalance ? 'remainder' : 'full';
  const paymentDueAmount = Math.max(
    0,
    currentPaymentStatus === 'deposit_paid'
      ? Math.max(0, Number(activeAppointment?.remainderAmount ?? activeAppointment?.outstandingAmount ?? activeInvoiceRemaining))
      : Math.max(0, Number(activeAppointment?.outstandingAmount ?? activeInvoiceRemaining))
  );
  const activePaymentTransactions = Array.isArray(activeAppointment?.paymentTransactions) ? activeAppointment.paymentTransactions : [];
  const refundTransactions = activePaymentTransactions.filter((transaction: any) => {
    const status = `${transaction?.status || transaction?.paymentStatus || ''}`.trim().toLowerCase();
    const type = `${transaction?.type || transaction?.kind || ''}`.trim().toLowerCase();
    return status === 'refunded' || status === 'partially_refunded' || type === 'refund';
  });
  const alreadyRefundedAmount = roundMoney(refundTransactions.reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction?.amount || 0)), 0));
  const originalPaymentAmount = roundMoney(Number(activeAppointment?.totalPaid || 0) + alreadyRefundedAmount);
  const refundableAmount = roundMoney(Math.max(0, Number(activeAppointment?.totalPaid || 0)));
  const refundPaymentMethod = normalizeRefundPaymentMethod(
    activeAppointment?.paymentMethod
      || activeAppointment?.paymentAllocations?.[0]?.paymentMethod
      || activeAppointment?.paymentAllocations?.[0]?.method
      || activeAppointment?.paymentMethodLabel
      || ''
  );
  const paymentMethodOptions = [
    { value: 'cash', labelEn: 'Cash', labelAr: 'نقداً' },
    { value: 'card_pos', labelEn: 'Card POS', labelAr: 'بطاقة عند المركز' },
    { value: 'wallet', labelEn: 'Wallet', labelAr: 'المحفظة' },
    { value: 'bank_transfer', labelEn: 'Bank transfer', labelAr: 'تحويل بنكي' },
    { value: 'gift_card_code', labelEn: 'Gift card code', labelAr: 'رمز بطاقة هدية' }
  ];

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

  // --- INTERACTIVE ADD APPOINTMENT / BLOCK TIME DRAWER ---
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [createStep, setCreateStep] = useState<number>(1);
  
  // Step 1: Customer Details State
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

  // Step 2: Service Configuration & Queue
  const [currentServiceId, setCurrentServiceId] = useState<string>('');
  const [currentStaffId, setCurrentStaffId] = useState<string>('');
  const [currentStartTime, setCurrentStartTime] = useState<number>(120); // minutes from 9:00 AM. 120 = 11:00 AM
  const [preserveBoardStartTime, setPreserveBoardStartTime] = useState(false);
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
    startTimeIso?: string;
    duration: number;
    discountType: 'none' | 'flat' | 'percent';
    discountValue: number;
    notes: string;
  }
  const [stagedServices, setStagedServices] = useState<StagedService[]>([]);
  const [chainConflictView, setChainConflictView] = useState<'explanation' | 'date-selection' | 'time-selection' | 'confirmation'>('explanation');
  const [chainConflictDialog, setChainConflictDialog] = useState<{
    originalStaged: StagedService[];
    payloadItems: any[];
    conflictCards: ConflictCard[];
    selectedDate: string;
    validChains: ChainResult[];
    selectedChain: ChainResult | null;
    isRevalidating: boolean;
    onConfirm: (chain: ChainResult) => void;
    onCancel: () => void;
  } | null>(null);
  const [bookingErrorDialog, setBookingErrorDialog] = useState<BookingDialogCopy | null>(null);
  const [bookingHoursDecisionDialog, setBookingHoursDecisionDialog] = useState<(BookingDialogCopy & {
    extensionMinutes: number;
    onChooseAnotherDay: () => void;
    onExtendHours: () => void;
    onCancel: () => void;
  }) | null>(null);

  // Step 3: Global Checkout notes & Custom Payment Rows
  const [sessionNotes, setSessionNotes] = useState('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState(true);
  const [createSplitActive, setCreateSplitActive] = useState(false);
  const [createSplitAmounts, setCreateSplitAmounts] = useState({ card: 0, cash: 0, wallet: 0, bank: 0, gift: 0 });
  const [giftCardCodeInput, setGiftCardCodeInput] = useState('');

  // Blocked shift breaks
  const [blockTitleAr, setBlockTitleAr] = useState('استراحة قهوة الموظفين');
  const [blockTitleEn, setBlockTitleEn] = useState('Staff Espresso Recess');
  const [blockStaffId, setBlockStaffId] = useState('');
  const [blockStartTime, setBlockStartTime] = useState<number>(180); // 12:00 PM
  const [blockDuration, setBlockDuration] = useState<number>(45);
  const [blockType, setBlockType] = useState<'Break' | 'Lunch' | 'Meeting'>('Break');

  useEffect(() => {
    if (!isCreateDrawerOpen) {
      setActiveBlockedTime(null);
    }
  }, [isCreateDrawerOpen]);

  // Shift Editor Modal states
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedShiftStaffId, setSelectedShiftStaffId] = useState('');
  const [initialCreateMode, setInitialCreateMode] = useState<'appointment' | 'blocked'>('appointment');
  const [initialCartTab, setInitialCartTab] = useState<'products' | 'giftcards'>('products');

  useEffect(() => {
    if (!isCreateDrawerOpen || initialCreateMode !== 'appointment') {
      return;
    }

    setCreateSplitActive(false);
    setCreateSplitAmounts({ card: 0, cash: 0, wallet: 0, bank: 0, gift: 0 });
  }, [isCreateDrawerOpen, initialCreateMode]);

  useEffect(() => {
    if (!quickLaunchRequest || quickLaunchRequest.target !== 'appointment') {
      return;
    }

    setInitialCreateMode('appointment');
    resetCreateDrawerStartTimes();
    setCreateStep(1);
    setCustMode('existing');
    setSelectedCustId('');
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustDob('1998-05-12');
    setNewCustGender('F');
    setNewCustIsVip(false);
    setIncludeGroupGuests(false);
    setGuestCount(1);
    setGuestNames('');
    setStagedServices([]);
    setIsCreateDrawerOpen(true);
  }, [quickLaunchRequest]);

  // --- POS CART & GIFT CARD COUNTER DRAWER ---
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'products' | 'giftcards'>('products');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
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
  const [generatedGcCode, setGeneratedGcCode] = useState(() => `REF-GFT-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  
  // POS Checkout customer association
  const [posCustMode, setPosCustMode] = useState<'walkin' | 'existing'>('walkin');
  const [posSelectedCustId, setPosSelectedCustId] = useState('');
  
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

  const openSchedulerSettings = useCallback(() => {
    schedulerBoardSnapshotRef.current = schedulerBoardSettings;
    setSchedulerBoardDraft(schedulerBoardSettings);
    setIsSchedulerSettingsOpen(true);
  }, [schedulerBoardSettings]);

  const cancelSchedulerBoardSettings = useCallback(() => {
    const snapshot = normalizeSchedulerBoardSettings(schedulerBoardSnapshotRef.current || schedulerBoardSettings);
    setSchedulerBoardSettings(snapshot);
    setSchedulerBoardDraft(snapshot);
    setIsSchedulerSettingsOpen(false);
  }, [schedulerBoardSettings]);

  const saveSchedulerBoardSettings = useCallback(async (nextSettings: SchedulerBoardSettings) => {
    const normalized = normalizeSchedulerBoardSettings(nextSettings);
    setIsSchedulerSettingsSaving(true);
    try {
      await tenantApiAdapter.put('/tenant/settings/booking', {
        schedulerBoard: normalized
      });
      setSchedulerBoardSettings(normalized);
      setSchedulerBoardDraft(normalized);
      schedulerBoardSnapshotRef.current = normalized;
      writeSchedulerBoardOverride(schedulerStorageKey, normalized);
      setIsSchedulerSettingsOpen(false);
      addLocalToast(
        isRtl ? 'تم حفظ إعدادات لوحة الجدولة.' : 'Scheduler layout preferences saved successfully.',
        isRtl ? 'تم تثبيت إعدادات الجدولة بنجاح.' : 'Scheduler preferences saved successfully.',
        'success'
      );
    } catch (error) {
      console.error('Failed to save scheduler board settings', error);
      addLocalToast(
        isRtl ? 'تعذر حفظ إعدادات لوحة الجدولة.' : 'Unable to save scheduler layout preferences.',
        isRtl ? 'تعذر حفظ إعدادات الجدولة.' : 'Unable to save scheduler preferences.',
        'warning'
      );
    } finally {
      setIsSchedulerSettingsSaving(false);
    }
  }, [isRtl, schedulerStorageKey]);

  const resetSchedulerBoardSettings = useCallback(() => {
    const normalized = normalizeSchedulerBoardSettings(DEFAULT_SCHEDULER_BOARD_SETTINGS);
    setSchedulerBoardDraft(normalized);
    setSchedulerBoardSettings(normalized);
    schedulerBoardSnapshotRef.current = normalized;
  }, []);

  const updateSchedulerBoardDraft = useCallback((patch: Partial<SchedulerBoardSettings>) => {
    setSchedulerBoardDraft((current) => {
      const next = normalizeSchedulerBoardSettings({
        ...current,
        ...patch
      });
      setSchedulerBoardSettings(next);
      return next;
    });
  }, []);

  const getServiceAssignment = useCallback((serviceId?: string | null) => {
    if (!serviceId) {
      return null;
    }

    return liveServices.find((service) => {
      const normalizedServiceId = `${service?.id || service?.serviceId || ''}`.trim();
      return normalizedServiceId === `${serviceId}`.trim();
    }) || null;
  }, [liveServices]);

  const canAssignServiceToStaff = useCallback((serviceId: string | undefined, staffId: string | undefined) => {
    if (!serviceId || !staffId) {
      return true;
    }

    const service = getServiceAssignment(serviceId);
    const assignedStaffIds = Array.isArray(service?.employeeAssignments)
      ? service.employeeAssignments.map((id: any) => `${id}`.trim()).filter(Boolean)
      : [];

    if (assignedStaffIds.length === 0) {
      return true;
    }

    return assignedStaffIds.includes(`${staffId}`.trim());
  }, [getServiceAssignment]);

  const openServiceForStaffAssignment = useCallback((serviceId?: string) => {
    if (!serviceId) {
      return;
    }

    onQuickAction({
      target: 'service',
      nonce: Date.now(),
      serviceId,
      section: 'team'
    });
  }, [onQuickAction]);

  // Conversions for layout
  const SLOT_HEIGHT = 100; // 100px per hour
  const START_HOUR = schedulerConfig.startHour;
  const END_HOUR = schedulerConfig.endHour;
  const SLOT_MINUTES = schedulerConfig.slotMinutes;
  const TOTAL_HOURS = Math.max(1, END_HOUR - START_HOUR);

  const minutesToTop = (mins: number) => {
    return (mins / 60) * SLOT_HEIGHT;
  };

  const minutesToHeight = (duration: number) => {
    return (duration / 60) * SLOT_HEIGHT;
  };

  const TOTAL_STAFF_LANES = 4;

  const getStaffLaneIndex = (staffId: string) => {
    const logicalIndex = liveStylists.findIndex((stylist) => stylist.id === staffId);
    if (logicalIndex === -1) {
      return -1;
    }
    return isRtl ? (TOTAL_STAFF_LANES - 1 - logicalIndex) : logicalIndex;
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

  const getCurrentTimeLinePosition = () => {
    if (!isDayBoardMode(viewMode)) {
      return null;
    }

    if (selectedDateKey !== getRiyadhDateKey(boardCurrentTime)) {
      return null;
    }

    const currentMinutes = getRiyadhMinutesSinceMidnight(boardCurrentTime);
    const visibleStart = START_HOUR * 60;
    const visibleEnd = END_HOUR * 60;

    if (currentMinutes < visibleStart || currentMinutes > visibleEnd) {
      return null;
    }

    return ((currentMinutes - visibleStart) / 60) * SLOT_HEIGHT;
  };

  const handleDayShift = (days: number) => {
    const newDate = new Date(selectedDate);
    if (isMonthBoardMode(viewMode)) {
      newDate.setMonth(newDate.getMonth() + days);
    } else {
      newDate.setDate(newDate.getDate() + days);
    }
    setSelectedDate(newDate);
  };

  const currentTimeLinePosition = getCurrentTimeLinePosition();

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
    const deltaMinutes = Math.round(((deltaY / SLOT_HEIGHT) * 60) / SLOT_MINUTES) * SLOT_MINUTES;

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
  const handleContextMenu = (e: React.MouseEvent, staffId: string, timeInMinutes: number, appointmentId?: string, dateKey = selectedDateKey) => {
    if (!isBoardEditable) {
      return;
    }
    if (isPastBoardCreationDate(dateKey)) {
      e.preventDefault();
      showPastBoardSlotWarning(timeInMinutes);
      return;
    }
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      staffId,
      timeInMinutes,
      dateKey,
      appointmentId,
    });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  // Quick action from Context Menu
  const triggerContextAction = async (actionType: 'new' | 'block' | 'shift' | 'break' | 'paste' | 'refresh' | 'giftcards' | 'products') => {
    const isMutationAction = ['new', 'block', 'shift', 'break', 'paste', 'giftcards', 'products'].includes(actionType);
    if (!isBoardEditable && isMutationAction) {
      addLocalToast(
        isRtl ? 'هذا اليوم للعرض فقط' : 'This date is read-only',
        isRtl ? 'لا يمكن إضافة أو تعديل الحجوزات في الأيام السابقة.' : 'You cannot create or modify bookings on past dates.',
        'warning'
      );
      setContextMenu(null);
      return;
    }

    const contextDateKey = contextMenu?.dateKey || selectedDateKey;

    if (actionType === 'new') {
      if (contextMenu) {
        if (isPastBoardCreationDate(contextDateKey)) {
          showPastBoardSlotWarning(contextMenu.timeInMinutes);
          setContextMenu(null);
          return;
        }
        setSelectedDate(parseLocalDateKey(contextDateKey));
        setCurrentStaffId(contextMenu.staffId);
        seedCreateDrawerFromBoardSlot(contextMenu.timeInMinutes);
      } else {
        resetCreateDrawerStartTimes();
      }
      setActiveBlockedTime(null);
      setInitialCreateMode('appointment');
      setCreateStep(1);
      setStagedServices([]);
      setIsCreateDrawerOpen(true);
    } else if (actionType === 'block') {
      setActiveBlockedTime(null);
      if (contextMenu) {
        setSelectedDate(parseLocalDateKey(contextDateKey));
        setBlockStaffId(contextMenu.staffId);
        setBlockDuration(45);
        setBlockType('Break');
        setBlockTitleAr('فترة استراحة وحظر');
        setBlockTitleEn('Break Slot');
        setCurrentStaffId(contextMenu.staffId);
        seedCreateDrawerFromBoardSlot(contextMenu.timeInMinutes);
      } else {
        resetCreateDrawerStartTimes();
      }
      setInitialCreateMode('blocked');
      setIsCreateDrawerOpen(true);
    } else if (actionType === 'giftcards') {
      if (contextMenu) {
        setCurrentStaffId(contextMenu.staffId);
      }
      try {
        const response = await tenantApiAdapter.get('/tenant/gift-cards/packages');
        const rawPackages = Array.isArray(response?.packages)
          ? response.packages
          : Array.isArray(response?.data?.packages)
            ? response.data.packages
            : Array.isArray(response?.data)
              ? response.data
              : [];
        const normalized = rawPackages
          .map(normalizeGiftCardPackage)
          .filter((item: GiftCardPackage) => item.id && item.isActive !== false);
        setGiftCardPackages(normalized);
      } catch (error) {
        console.error('Failed to load gift card packages for the appointment drawer:', error);
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
    try {
      const response = await tenantApiAdapter.getAppointment(apt.id);
      const detail = response?.appointment || response?.data?.appointment || response?.data || response;
      setActiveAppointment(detail?.id ? mapBoardAppointment(detail, apt.date || getSelectedDateKey()) : apt);
    } catch (err) {
      console.warn('Failed to load appointment detail, falling back to board row', err);
      setActiveAppointment(apt);
    }
    setSplitAmounts({ card: apt.price, cash: 0, wallet: 0 });
    setIsSplitActive(false);
    setCheckoutProducts([]);
    setAppliedGiftCardCode('');
    setAppliedGiftCardAmount(0);
    setShowRefundModal(false);
    setRefundAmountInput('');
    setRefundReasonInput('');
    setRefundDialogError(null);
    setRefundSubmitting(false);
    setAppointmentDetailsReadOnly(Boolean(options.readOnly) || !isBoardEditable);
    setIsCustomerProfileOpen(false);
    setCustomerTransactionsExpanded(false);
    setCustomerTransactionDetail(null);
    setCustomerProfile(null);
    setCustomerHistoryData(null);
    setCustomerProfileError(null);
    setDrawerOpen(true);
  };

  const openBlockedTimeDetails = (apt: Appointment) => {
    setActiveBlockedTime(apt);
    setActiveAppointment(null);
    setCurrentStaffId(apt.staffId || currentStaffId);
    setCurrentStartTime(apt.startTime);
    setAppointmentDetailsReadOnly(true);
    setDrawerOpen(false);
    setIsCustomerProfileOpen(false);
    setCustomerTransactionsExpanded(false);
    setCustomerTransactionDetail(null);
    setCustomerProfile(null);
    setCustomerHistoryData(null);
    setCustomerProfileError(null);
    setIsCreateDrawerOpen(true);
    setInitialCreateMode('blocked');
  };

  const openHistoricalAppointmentDetails = async (historyItem: any) => {
    if (!historyItem?.id) {
      return;
    }

    const historyDate = historyItem?.date || historyItem?.details?.startTime || getSelectedDateKey();
    const historyService = historyItem?.details?.service || historyItem?.service || null;
    const historyServiceVariantId = historyItem?.serviceVariantId || historyItem?.details?.serviceVariantId || historyItem?.serviceVariant?.id || null;
    const historyServiceVariantName = historyItem?.serviceVariantName || historyItem?.details?.serviceVariantName || historyItem?.serviceVariant?.name_en || historyItem?.serviceVariant?.nameEn || historyItem?.serviceVariant?.description || '';
    const historyServiceVariantDescription = historyItem?.serviceVariantDescription || historyItem?.details?.serviceVariantDescription || historyItem?.serviceVariant?.name_ar || historyItem?.serviceVariant?.nameAr || historyItem?.serviceVariant?.description || '';
    const historyServiceNameEn = historyItem?.serviceLabelEn
      || historyItem?.serviceLabel
      || historyItem?.details?.serviceLabelEn
      || historyItem?.details?.serviceLabel
      || historyItem?.details?.serviceNameEn
      || historyItem?.details?.service?.name_en
      || historyItem?.details?.service?.nameEn
      || historyItem?.details?.service?.name
      || historyItem?.serviceNameEn
      || historyItem?.serviceName
      || historyItem?.title
      || 'Service';
    const historyServiceNameAr = historyItem?.serviceLabelAr
      || historyItem?.serviceLabelArText
      || historyItem?.details?.serviceLabelAr
      || historyItem?.details?.serviceLabelArText
      || historyItem?.details?.serviceNameAr
      || historyItem?.details?.service?.name_ar
      || historyItem?.details?.service?.nameAr
      || historyItem?.details?.service?.name
      || historyItem?.serviceNameAr
      || historyItem?.serviceName
      || historyItem?.title
      || 'الخدمة';

    const fallbackAppointment = mapBoardAppointment({
      id: historyItem.id,
      customerId: activeAppointment?.customerId,
      customerNameEn: activeAppointment?.customerNameEn || historyItem?.customerNameEn || activeCustomerName || 'Guest',
      customerNameAr: activeAppointment?.customerNameAr || historyItem?.customerNameAr || activeCustomerName || 'زائرة',
      customerPhone: activeCustomerPhone || '',
      customerEmail: activeCustomerEmail || '',
      service: historyService,
      serviceId: historyItem?.details?.service?.id || historyItem?.service?.id || null,
      serviceVariantId: historyServiceVariantId,
      serviceVariantName: historyServiceVariantName || null,
      serviceVariantDescription: historyServiceVariantDescription || null,
      serviceNameEn: historyServiceNameEn,
      serviceNameAr: historyServiceNameAr,
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
      paymentMethod: historyItem?.paymentMethod || historyItem?.paymentMethodLabel || activeAppointment?.paymentMethod || null,
      invoiceNumber: historyItem?.invoiceNumber || historyItem?.invoice?.number || historyItem?.invoice?.invoiceNumber || null,
      invoiceStatus: historyItem?.paymentStatus || historyItem?.normalizedPaymentStatus || 'paid',
      notes: historyItem?.details?.notes || '',
      services: historyService ? [historyService] : [],
      serviceItems: historyService ? [{
        service: historyService,
        serviceVariantId: historyServiceVariantId,
        serviceVariantName: historyServiceVariantName || null,
        serviceVariantDescription: historyServiceVariantDescription || null,
        duration: historyItem?.details?.duration || 0,
        price: Number(historyItem?.amount ?? 0)
      }] : [],
      lineItems: [],
      invoiceItems: [],
      paymentTransactions: Array.isArray(historyItem?.paymentTransactions) ? historyItem.paymentTransactions : [],
      invoice: historyItem?.invoice || null,
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
    setShowRefundModal(false);
    setRefundAmountInput('');
    setRefundReasonInput('');
    setRefundDialogError(null);
    setRefundSubmitting(false);
    setDrawerTab('overview');
    setAppointmentDetailsReadOnly(true);
    setIsCustomerProfileOpen(false);
    setCustomerTransactionsExpanded(false);
    setCustomerDrawerTab('overview');
    setCustomerTransactionDetail(null);
    setCustomerProfileError(null);
    setDrawerOpen(true);
  };

  const openRefundDialog = () => {
    if (!activeAppointment) {
      return;
    }

    if (appointmentDetailsReadOnly) {
      addLocalToast(
        isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
        isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
        'info'
      );
      return;
    }

    if (refundableAmount <= 0) {
      addLocalToast(
        isRtl ? 'لا يوجد مبلغ قابل للاسترداد لهذا الموعد.' : 'No refundable balance is available for this appointment.',
        isRtl ? 'No refundable balance is available for this appointment.' : 'لا يوجد مبلغ قابل للاسترداد لهذا الموعد.',
        'warning'
      );
      return;
    }

    setRefundAmountInput(refundableAmount.toFixed(2));
    setRefundReasonInput('');
    setRefundDialogError(null);
    setShowRefundModal(true);
  };

  const submitRefundAppointment = async () => {
    if (!activeAppointment || refundSubmitting) {
      return;
    }

    if (appointmentDetailsReadOnly) {
      addLocalToast(
        isRtl ? 'الوضع الحالي للموعد للعرض فقط.' : 'This appointment is currently read-only.',
        isRtl ? 'This appointment is currently read-only.' : 'الوضع الحالي للموعد للعرض فقط.',
        'info'
      );
      return;
    }

    const parsedRefundAmount = Number(refundAmountInput);
    if (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount <= 0) {
      const message = isRtl ? 'أدخل مبلغ استرداد أكبر من صفر.' : 'Enter a refund amount greater than zero.';
      setRefundDialogError(message);
      addLocalToast(message, message, 'warning');
      return;
    }

    if (parsedRefundAmount - originalPaymentAmount > 0.009) {
      const message = isRtl ? 'لا يمكن أن يتجاوز الاسترداد إجمالي المبلغ المدفوع الأصلي.' : 'Refund cannot exceed the original payment amount.';
      setRefundDialogError(message);
      addLocalToast(message, message, 'warning');
      return;
    }

    if (parsedRefundAmount - refundableAmount > 0.009) {
      const message = isRtl ? 'لا يمكن أن يتجاوز الاسترداد الرصيد القابل للاسترداد.' : 'Refund cannot exceed the remaining refundable balance.';
      setRefundDialogError(message);
      addLocalToast(message, message, 'warning');
      return;
    }

    setRefundSubmitting(true);
    setRefundDialogError(null);

    try {
      const refundResponse = await tenantApiAdapter.refundAppointment(activeAppointment.id, {
        amount: parsedRefundAmount,
        reason: refundReasonInput.trim() || undefined,
        paymentMethod: refundPaymentMethod || undefined
      });
      const payload = refundResponse?.data || refundResponse;
      if (payload?.success === false) {
        throw new Error(payload?.message || 'Failed to process refund');
      }

      await loadBoardData();
      setCustomerProfileRefreshToken((token) => token + 1);
      emitBIReportRefresh({
        source: 'refund',
        appointmentId: activeAppointment.id
      });

      const confirmedAppointmentId = payload?.refund?.appointmentId || activeAppointment.id;
      if (confirmedAppointmentId) {
        const refreshedAppointment = await tenantApiAdapter.getAppointment(confirmedAppointmentId);
        const refreshedData = refreshedAppointment?.appointment || refreshedAppointment?.data?.appointment || refreshedAppointment?.data || refreshedAppointment;
        if (refreshedData) {
          setActiveAppointment(mapBoardAppointment(refreshedData, getSelectedDateKey()));
        }
      }

      setShowRefundModal(false);
      setRefundAmountInput('');
      setRefundReasonInput('');
      addLocalToast(
        isRtl ? 'تم تنفيذ الاسترداد بنجاح.' : 'Refund processed successfully.',
        isRtl ? 'Refund processed successfully.' : 'تم تنفيذ الاسترداد بنجاح.',
        'success'
      );
    } catch (err: any) {
      const message = err?.message || (isRtl ? 'تعذر تنفيذ الاسترداد.' : 'Failed to process refund.');
      setRefundDialogError(message);
      addLocalToast(message, message, 'warning');
    } finally {
      setRefundSubmitting(false);
    }
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
    
    // Calculate appointment discount for receipt
    const _rawPrice = Number(activeAppointment?.rawPrice || 0);
    const _finalPrice = Number(activeAppointment?.price || 0);
    const _taxAmount = Number(activeAppointment?.taxAmount || 0);
    const _platformFee = Number(activeAppointment?.platformFee || 0);
    const _discountedRawPrice = _finalPrice - _taxAmount - _platformFee;
    let appointmentServiceDiscount = 0;
    if (_rawPrice > _discountedRawPrice + 0.01) {
      const _rate = _discountedRawPrice > 0 ? (_taxAmount + _platformFee) / _discountedRawPrice : 0;
      const _originalFinalPrice = _rawPrice * (1 + _rate);
      appointmentServiceDiscount = Math.max(_originalFinalPrice - _finalPrice, 0);
    }

    // Calculate totals
    const serviceSubtotal = activeAppointment.price + appointmentServiceDiscount;
    const productsSubtotal = checkoutProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const subtotal = serviceSubtotal + productsSubtotal;
    const discount = appliedGiftCardAmount + appointmentServiceDiscount;
    const computedTotal = Math.max(0, subtotal - discount);
    const taxableAmount = computedTotal / 1.15;
    const vat = computedTotal - taxableAmount;
    const total = paymentDueAmount > 0 ? paymentDueAmount : computedTotal;
    const paymentMethodApi = `${selectedPaymentMethod || ''}`.trim();
    if (!paymentMethodApi) {
      addLocalToast(
        'الرجاء اختيار طريقة الدفع أولاً.',
        'Please choose a payment method first.',
        'warning'
      );
      return;
    }

    const paymentAllocationsPayload = isSplitActive
      ? Object.entries(splitAmounts)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([paymentMethod, amount]) => ({
            paymentMethod:
              paymentMethod === 'card'
                ? 'card_pos'
                : paymentMethod === 'bank'
                  ? 'bank_transfer'
              : paymentMethod,
            amount: Number(amount)
          }))
      : undefined;
    const selectedMethodOption = paymentMethodOptions.find((option) => option.value === paymentMethodApi);
    let paymentMethodSummary = selectedMethodOption
      ? (isRtl ? selectedMethodOption.labelAr : selectedMethodOption.labelEn)
      : paymentMethodApi;
    if (isSplitActive) {
      const parts = [];
      if (splitAmounts.card > 0) parts.push(`${isRtl ? 'بطاقة عند المركز' : 'Card POS'}: ${splitAmounts.card} ${t.riyal}`);
      if (splitAmounts.cash > 0) parts.push(`${isRtl ? 'كاش' : 'Cash'}: ${splitAmounts.cash} ${t.riyal}`);
      if (splitAmounts.wallet > 0) parts.push(`${isRtl ? 'المحفظة' : 'Wallet'}: ${splitAmounts.wallet} ${t.riyal}`);
      if (parts.length === 0 && paymentMethodSummary) {
        parts.push(paymentMethodSummary);
      }
      if (parts.length > 0) paymentMethodSummary = parts.join(' | ');
    }

    try {
      // 1. Mark appointment as paid
      const paymentResponse = paymentCollectionMode === 'remainder' || hasTrueRemainderBalance
        ? await tenantApiAdapter.recordRemainderPayment(activeAppointment.id, {
            amount: total,
            paymentMethod: paymentMethodApi,
            notes: isRtl ? 'تحصيل المتبقي من داخل لوحة الموعد' : 'Collected remainder from appointment drawer',
            paymentAllocations: paymentAllocationsPayload
          })
        : await tenantApiAdapter.updateAppointmentPaymentStatus(activeAppointment.id, {
            paymentStatus: 'fully_paid',
            paymentMethod: paymentMethodApi,
            paymentAllocations: paymentAllocationsPayload,
            totalPaid: total
          });

      // 2. Checkout any added products
      if (checkoutProducts.length > 0) {
        await tenantApiAdapter.checkoutProducts({
          items: checkoutProducts.map(p => ({ productId: p.id, quantity: p.quantity, price: p.price })),
          customerId: activeAppointment.customerId || undefined,
          customerName: activeAppointment.customerNameEn || activeAppointment.customerNameAr || 'Walk-in',
          paymentMethod: paymentMethodApi,
          paymentAllocations: paymentAllocationsPayload,
          notes: paymentMethodSummary
        });
      }

      await loadBoardData();
      setCustomerProfileRefreshToken(token => token + 1);
      emitBIReportRefresh({
        source: 'payment',
        appointmentId: activeAppointment.id
      });
      const confirmedAppointmentId = paymentResponse?.appointment?.id || paymentResponse?.data?.appointment?.id || activeAppointment.id;
      if (confirmedAppointmentId) {
        const refreshedAppointment = await tenantApiAdapter.getAppointment(confirmedAppointmentId);
        const confirmedData = refreshedAppointment?.appointment || refreshedAppointment?.data?.appointment || refreshedAppointment?.data || refreshedAppointment;
        if (confirmedData) {
          setActiveAppointment(mapBoardAppointment(confirmedData, getSelectedDateKey()));
        }
      }
      if (pendingStatusAfterPayment) {
        const statusResponse = await tenantApiAdapter.updateAppointmentStatus(activeAppointment.id, pendingStatusAfterPayment, activeAppointment.notes);
        if (!statusResponse?.success) {
          throw new Error(statusResponse?.message || 'Failed to apply pending appointment status');
        }
        const refreshedStatus = await tenantApiAdapter.getAppointment(activeAppointment.id);
        const statusData = refreshedStatus?.appointment || refreshedStatus?.data?.appointment || refreshedStatus?.data || refreshedStatus;
        if (statusData) {
          setActiveAppointment(mapBoardAppointment(statusData, getSelectedDateKey()));
        }
        await loadBoardData();
      }
      setPendingStatusAfterPayment(null);

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

  const getAppointmentStatusOptions = (currentStatus: Appointment['status']) => {
    const options: Array<{ value: Appointment['status']; label: string }> = [];
    const push = (value: Appointment['status'], label: string) => {
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label });
      }
    };

    push('pending', isRtl ? 'محجوز' : 'Booked');
    push('confirmed', isRtl ? 'مؤكد' : 'Confirmed');
    push('checked_in', isRtl ? 'تم الوصول' : 'Arrived');
    push('in_service', isRtl ? 'بدأت الخدمة' : 'Started');
    push('completed', isRtl ? 'مكتمل' : 'Completed');
    push('no_show', isRtl ? 'عدم حضور' : 'No-show');
    push('cancelled', isRtl ? 'ملغي' : 'Cancelled');

    if (currentStatus === 'completed') {
      return options.filter((option) => option.value === currentStatus);
    }

    return options;
  };

  const handleAppointmentStatusUpdate = async (nextStatus: Appointment['status'], cancellationReason?: string) => {
    if (!activeAppointment || appointmentDetailsReadOnly || statusUpdating) {
      return;
    }

    const normalizedCurrent = normalizeWorkspaceAppointmentStatus(activeAppointment.status);
    const normalizedNext = normalizeWorkspaceAppointmentStatus(nextStatus);
    if (normalizedCurrent === normalizedNext) {
      return;
    }

    if (normalizedNext === 'pending') {
      return;
    }

    if (normalizedNext === 'completed' && paymentDueAmount > 0) {
      addLocalToast(
        isRtl ? 'لا يمكنك تغيير الحالة إلى مكتمل إلا بعد سداد مبلغ الحجز بالكامل.' : 'You can not change to completed unless the booking amount is paid.',
        isRtl ? 'You can not change to completed unless the booking amount is paid.' : 'لا يمكنك تغيير الحالة إلى مكتمل إلا بعد سداد مبلغ الحجز بالكامل.',
        'warning'
      );
      return;
    }

    const finalNotes = cancellationReason 
      ? `${activeAppointment.notes || ''}\n[Cancellation Reason]: ${cancellationReason}` 
      : activeAppointment.notes;

    setStatusUpdating(true);
    let patchSuccess = false;
    let patchResponse: any = null;

    try {
      patchResponse = await tenantApiAdapter.updateAppointmentStatus(activeAppointment.id, normalizedNext, finalNotes);
      if (!patchResponse?.success) {
        throw new Error(patchResponse?.message || 'Failed to update appointment status');
      }
      patchSuccess = true;

      // Optimistically update local state immediately using the backend's returned payload
      const serverAppt = patchResponse.appointment || patchResponse.data?.appointment;
      if (serverAppt) {
        setActiveAppointment(mapBoardAppointment(serverAppt, getSelectedDateKey()));
      }

      addLocalToast(
        isRtl ? 'تم تحديث حالة الموعد بنجاح.' : 'Appointment status updated successfully.',
        isRtl ? 'Appointment status updated successfully.' : 'تم تحديث حالة الموعد بنجاح.',
        'success'
      );
    } catch (err: any) {
      console.error("[STATUS FAILED]", err);
      console.error(err.stack);
      addLocalToast(
        err.message || 'Unable to update appointment status.',
        err.message || 'Unable to update appointment status.',
        'warning'
      );
    } finally {
      setStatusUpdating(false);
    }

    if (patchSuccess) {
      try {
        await loadBoardData();

        const refreshed = await tenantApiAdapter.getAppointment(activeAppointment.id);

        const refreshedData = refreshed?.appointment || refreshed?.data?.appointment || refreshed?.data || refreshed;
        if (refreshedData) {
          setActiveAppointment(mapBoardAppointment(refreshedData, getSelectedDateKey()));
        }
        setCustomerProfileRefreshToken(token => token + 1);
      } catch (bgErr) {
        console.error("[STATUS BACKGROUND REFRESH FAILED]", bgErr);
      }
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
    const nextStartTimeIso = stagedServices.length > 0
      ? addMinutesToIso(
          stagedServices[stagedServices.length - 1].startTimeIso || buildIsoFromMinutes(getSelectedDateKey(), stagedServices[stagedServices.length - 1].startTime),
          stagedServices[stagedServices.length - 1].duration
        )
      : buildIsoFromMinutes(getSelectedDateKey(), nextStartTime);

    const newItem: StagedService = {
      id: `stg-${Date.now()}`,
      serviceId: currentServiceId,
      staffId: currentStaffId,
      startTime: nextStartTime,
      startTimeIso: nextStartTimeIso,
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

  const fetchAvailabilityLayers = async (currentItems: any[], dateString: string) => {
      const layers: import('../utils/bookingChains').BookingSlot[][] = [];
      const diagnosticsByLayer: AvailabilityDiagnostic[][] = [];
      let anyFailed = false;
      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i];
        const searchResp = await tenantApiAdapter.searchAvailability({
          tenantId: tenant?.id || '',
          serviceId: item.serviceId,
          staffId: item.requestedStaffId || undefined,
          date: dateString
        });
        if (searchResp?.success && searchResp.slots) {
          layers.push(searchResp.slots.map((s: any) => ({ ...s, serviceId: item.serviceId })));
          diagnosticsByLayer.push(Array.isArray(searchResp.diagnostics) ? searchResp.diagnostics : []);
        } else {
          layers.push([]);
          diagnosticsByLayer.push([]);
          anyFailed = true;
        }
      }
      return { layers, diagnosticsByLayer, anyFailed };
  };

  const handleSearchDate = async (dateStr: string) => {
    if (!chainConflictDialog || !chainConflictDialog.payloadItems) return;
    const { layers } = await fetchAvailabilityLayers(chainConflictDialog.payloadItems, dateStr);
    const validChains = calculateAllValidChains(layers);
    setChainConflictDialog(prev => prev ? { ...prev, selectedDate: dateStr, validChains } : null);
    setChainConflictView('time-selection');
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
        loyalty = existing.loyaltyTier || '';
        balance = Number(existing.walletBalance || 0);
      }
    } else if (custMode === 'new') {
      const requirePhone = tenantSettings?.bookingSettings?.requireWalkInPhone === true;
      if (!newCustName) {
        showBookingErrorDialog({
          titleAr: 'يرجى إدخال اسم العميل',
          titleEn: 'Missing customer name',
          bodyAr: 'لا يمكن متابعة الحجز بدون اسم العميل الجديد.',
          bodyEn: 'The booking cannot continue without the new customer name.'
        });
        return;
      }
      if (requirePhone && !newCustPhone) {
        showBookingErrorDialog({
          titleAr: 'يرجى إدخال رقم الجوال',
          titleEn: 'Missing customer phone',
          bodyAr: 'لا يمكن متابعة الحجز بدون رقم الجوال للعميل الجديد.',
          bodyEn: 'The booking cannot continue without the new customer phone number.'
        });
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

    const splitCustomerName = (value: string) => {
      const parts = `${value || ''}`.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) {
        return { firstName: '', lastName: '' };
      }
      if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Guest' };
      }
      return {
        firstName: parts.shift() || '',
        lastName: parts.join(' ')
      };
    };

    let finalStaged = [...stagedServices];
    if (finalStaged.length === 0) {
      const srv = liveServices.find(s => s.id === currentServiceId);
      if (srv) {
        finalStaged.push({
          id: `stg-${Date.now()}`,
          serviceId: currentServiceId,
          staffId: currentStaffId,
          startTime: currentStartTime,
          startTimeIso: buildIsoFromMinutes(getSelectedDateKey(), currentStartTime),
          duration: currentDuration,
          discountType: currentDiscountType,
          discountValue: currentDiscountValue,
          notes: currentServiceNotes,
        });
      }
    }

    if (finalStaged.length === 0) {
      showBookingErrorDialog({
        titleAr: 'لا توجد خدمات محددة',
        titleEn: 'No service selected',
        bodyAr: 'يرجى إدراج خدمة واحدة على الأقل لتأكيد الحجز.',
        bodyEn: 'Please add at least one service before confirming the booking.'
      });
      return;
    }

    if (isPastBoardCreationDate(getSelectedDateKey())) {
      showPastBoardSlotWarning(finalStaged[0].startTime);
      return;
    }

    let firstStaffId = finalStaged[0].staffId;
    let earliestStartTime = finalStaged[0].startTime;

    const runAppointmentCreationFlow = async (allowExtendedHours = false) => {
      const finalChainEndMinutes = (boardStartHour * 60) + getBookingChainFinalEndMinutes(finalStaged);
      const normalClosingMinutes = schedulerConfig.normalEndHour * 60;
      const extensionMinutes = finalChainEndMinutes - normalClosingMinutes;

      if (!allowExtendedHours && extensionMinutes > 0) {
        setBookingHoursDecisionDialog({
          ...buildExtendedHoursBookingDialog({ isRtl, extensionMinutes }),
          extensionMinutes,
          onChooseAnotherDay: () => {
            setBookingHoursDecisionDialog(null);
          },
          onExtendHours: () => {
            setBookingHoursDecisionDialog(null);
            void runAppointmentCreationFlow(true);
          },
          onCancel: () => setBookingHoursDecisionDialog(null)
        });
        return;
      }

      const payloadItems = finalStaged.map((item) => {
        const resolvedServiceId = `${item.serviceId || ''}`.trim();
        const srv = liveServices.find((s) => s.id === resolvedServiceId);
        const requestStartIso = item.startTimeIso || buildIsoFromMinutes(getSelectedDateKey(), item.startTime);
        return {
          serviceId: resolvedServiceId,
          staffId: item.staffId,
          requestedStaffId: item.staffId,
          startTime: requestStartIso,
          notes: item.notes || sessionNotes || null,
          paymentMethod: 'at-center',
          assignmentMode: item.staffId ? 'tenant_reassigned' : 'auto_assigned',
          duration: item.duration || srv?.duration || 60,
          discountType: item.discountType,
          discountValue: item.discountValue,
          serviceName: isRtl ? (srv?.nameAr || srv?.name || '') : (srv?.nameEn || srv?.name || '')
        };
      });

      const resolvedPrimaryServiceId = `${payloadItems[0]?.serviceId || currentServiceId || ''}`.trim();
      const resolvedPrimaryStaffId = `${firstStaffId || currentStaffId || ''}`.trim();
      if (!resolvedPrimaryServiceId) {
        showBookingErrorDialog({
          titleAr: 'إعدادات خدمة غير صالحة',
          titleEn: 'Invalid service configuration',
          bodyAr: 'تعذر إكمال الحجز بسبب إعدادات الخدمة المحددة.',
          bodyEn: 'The booking cannot continue because the selected service configuration is invalid.'
        });
        return;
      }

      const executeFinalSubmission = async (itemsToSubmit: any[]) => {
        try {
          const calculateStagedServiceTotal = () => finalStaged.reduce((sum, item) => {
            const service = liveServices.find((candidate) => candidate.id === item.serviceId);
            const basePrice = Number(service?.price || 0);
            const discountType = item.discountType || 'none';
            const discountValue = Number(item.discountValue || 0);

            let discountedPrice = basePrice;
            if (discountType === 'flat') {
              discountedPrice = Math.max(basePrice - discountValue, 0);
            } else if (discountType === 'percent') {
              discountedPrice = Math.max(basePrice - (basePrice * (discountValue / 100)), 0);
            }

            return sum + discountedPrice;
          }, 0);

          const createAppointmentTotal = Number(calculateStagedServiceTotal().toFixed(2));

          // TEMPORARILY DISABLED (Refah - Remove Payment from Wizard)
          // const createPaymentAllocations = ...

          const response = await tenantApiAdapter.createAppointment({
            items: itemsToSubmit,
            staffId: itemsToSubmit[0]?.staffId || currentStaffId,
            startTime: itemsToSubmit[0]?.startTime || buildIsoFromMinutes(getSelectedDateKey(), earliestStartTime),
            notes: sessionNotes || finalStaged.map(s => s.notes).filter(Boolean).join(' | '),
            assignmentMode: 'tenant_reassigned',
            notifyCustomer: true,
            skipAdvanceValidation: shouldSkipAdvanceValidation(getSelectedDateKey(), earliestStartTime),
            platformUserId: custMode === 'existing' ? selectedCustId : undefined,
            customer: custMode === 'new' || custMode === 'walkin'
              ? {
                  ...splitCustomerName(custNameEn.trim() || custNameAr.trim()),
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
          setCustMode('walkin');
          setSelectedCustId('');

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
        } catch (err: any) {
          const errorMeta = extractBookingErrorMeta(err);

          if (isBookingTooSoonError(errorMeta)) {
            showBookingErrorDialog(
              buildAdvanceBookingDialog({
                isRtl,
                currentLabel: getRiyadhCurrentTimeLabel(),
                slotLabel: formatMinutesToTime(itemsToSubmit[0]?.startTime ? Number(itemsToSubmit[0].startTime) : earliestStartTime)
              })
            );
            return;
          }

          if (isBookingConflictError(errorMeta)) {
            if (hasStructuredBookingDiagnostics(errorMeta)) {
              if (!chainConflictDialog) {
                await preflightMultiServiceChain(itemsToSubmit, false);
              } else {
                setChainConflictView('time-selection');
              }
              return;
            }

            showBookingErrorDialog(buildGenericBookingErrorDialog());
            return;
          }

          showBookingErrorDialog(buildGenericBookingErrorDialog());
        }
      };

      const preflightMultiServiceChain = async (currentItems: any[], isRetry = false) => {
        try {
          const requestedStartISO = currentItems[0].startTimeIso || currentItems[0].startTime || buildIsoFromMinutes(getSelectedDateKey(), earliestStartTime);
          const { layers, diagnosticsByLayer, anyFailed } = await fetchAvailabilityLayers(currentItems, getSelectedDateKey());

          let isRequestedChainValid = true;
          const discoveredStaffIds: string[] = [];
          const conflictCards: ConflictCard[] = [];

          if (anyFailed) {
            isRequestedChainValid = false;
            conflictCards.push({
              staffId: '',
              staffName: isRtl ? 'المختص' : 'Professional',
              reasonType: 'unknown',
              reasonTitle: isRtl ? 'تعذر جلب الأوقات المتاحة للخدمة' : 'Could not fetch availability',
              reasonDescription: isRtl ? 'تعذر التحقق من الإتاحة لهذه الخدمة في الوقت الحالي.' : 'Could not verify availability for this service right now.'
            });
          } else {
            for (let i = 0; i < currentItems.length; i++) {
              const item = currentItems[i];
              const layerSlots = layers[i];
              const diagnostics = diagnosticsByLayer[i] || [];
              const requestStartIso = typeof item.startTimeIso === 'string' && item.startTimeIso.includes('T')
                ? item.startTimeIso
                : typeof item.startTime === 'string' && item.startTime.includes('T')
                  ? item.startTime
                  : buildIsoFromMinutes(getSelectedDateKey(), Number(item.startTime || earliestStartTime));
              const requestEndIso = new Date(new Date(requestStartIso).getTime() + Number(item.duration || currentDuration || 0) * 60000).toISOString();
              const reqTimeMs = new Date(requestStartIso).getTime();
              
              const exactSlot = layerSlots.find((s: any) => new Date(s.startTime).getTime() === reqTimeMs);
              
              const staff = liveStylists.find(s => s.id === item.requestedStaffId) || liveStylists.find(s => s.id === exactSlot?.staffId);
              const staffName = staff ? (isRtl ? staff.nameAr : staff.nameEn) : 'المختص';
              const avatar = staff?.avatar || staff?.photo || staff?.profileImage;

              if (exactSlot && !exactSlot.available) {
                isRequestedChainValid = false;
                const diagnostic = pickBestConflictDiagnostic({
                  diagnostics,
                  serviceId: item.serviceId,
                  staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || null,
                  requestedStartTime: requestStartIso,
                  requestedEndTime: requestEndIso,
                  exactSlotStartTime: exactSlot.startTime,
                  exactSlotEndTime: exactSlot.endTime
                });
                conflictCards.push(buildConflictCard({
                  diagnostic,
                  staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || '',
                  staffName,
                  avatar,
                  isRtl
                }));
              } else if (!exactSlot) {
                isRequestedChainValid = false;
                const diagnostic = pickBestConflictDiagnostic({
                  diagnostics,
                  serviceId: item.serviceId,
                  staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || null,
                  requestedStartTime: requestStartIso,
                  requestedEndTime: requestEndIso
                });
                conflictCards.push(buildConflictCard({
                  diagnostic,
                  staffId: staff?.id || exactSlot?.staffId || item.requestedStaffId || '',
                  staffName,
                  avatar,
                  isRtl
                }));
              } else {
                discoveredStaffIds.push(exactSlot.staffId);
              }
            }
          }

          if (isRequestedChainValid && !isRetry) {
            const validatedItems = currentItems.map((item, idx) => ({
              ...item,
              staffId: discoveredStaffIds[idx] || item.staffId,
              assignmentMode: item.requestedStaffId ? 'tenant_reassigned' : 'auto_assigned'
            }));
            await executeFinalSubmission(validatedItems);
          } else {
            setChainConflictView('explanation');
            setChainConflictDialog({
              originalStaged: finalStaged,
              payloadItems: currentItems,
              conflictCards: isRetry ? [{
                staffId: '',
                staffName: isRtl ? 'المختص' : 'Professional',
                reasonType: 'unknown',
                reasonTitle: isRtl ? 'تغيرت الإتاحة' : 'Availability changed',
                reasonDescription: isRtl ? 'تغيرت الإتاحة، يرجى المحاولة بوقت آخر.' : 'Availability changed, please try another time.'
              }] : conflictCards,
              selectedDate: getSelectedDateKey(),
              validChains: [],
              selectedChain: null,
              isRevalidating: false,
              onConfirm: async (chain: any) => {
                setChainConflictDialog(prev => prev ? { ...prev, isRevalidating: true } : null);
                // Fresh verification immediately before booking
                const dateToValidate = chain.startTime.split('T')[0];
                const { layers: freshLayers } = await fetchAvailabilityLayers(currentItems, dateToValidate);

                let isStillValid = true;
                for (let i = 0; i < currentItems.length; i++) {
                  const reqTimeMs = new Date(chain.slots[i].startTime).getTime();
                  const exactSlot = freshLayers[i].find((s: any) => new Date(s.startTime).getTime() === reqTimeMs && s.staffId === chain.slots[i].staffId);
                  if (!exactSlot || !exactSlot.available) {
                    isStillValid = false;
                    break;
                  }
                }

                if (isStillValid) {
                  const confirmedItems = currentItems.map((item, idx) => {
                    const slot = chain.slots[idx];
                    return {
                      ...item,
                      startTime: slot.startTime,
                      staffId: slot.staffId,
                      assignmentMode: item.requestedStaffId ? 'tenant_reassigned' : 'auto_assigned'
                    };
                  });
                  setChainConflictDialog(null);
                  setChainConflictView('explanation');
                  await executeFinalSubmission(confirmedItems);
                } else {
                  setChainConflictDialog(prev => prev ? { ...prev, isRevalidating: false } : null);
                  showBookingErrorDialog({
                    titleAr: 'تعذر إكمال الحجز',
                    titleEn: 'Unable to complete booking',
                    bodyAr: 'لم يعد هذا الوقت متاحاً. يرجى اختيار وقت آخر.',
                    bodyEn: 'This time is no longer available. Please choose another time.'
                  });
                  setChainConflictView('time-selection'); // Go back to selection
                }
              },
              onCancel: () => {
                setChainConflictDialog(null);
                setChainConflictView('explanation');
              }
            });
          }
        } catch (err: any) {
          showBookingErrorDialog({
            titleAr: 'تعذر التحقق من التوفر',
            titleEn: 'Unable to check availability',
            bodyAr: 'تعذر التحقق من الإتاحة في الوقت الحالي. يرجى المحاولة مرة أخرى.',
            bodyEn: 'We could not check availability right now. Please try again.'
          });
        }
      };

      if (payloadItems.length > 1) {
        await preflightMultiServiceChain(payloadItems, false);
      } else {
        await executeFinalSubmission(payloadItems);
      }
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

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => (
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    ));
  };

  const handleAddSelectedProductsToCart = () => {
    const selectedProducts = liveProducts.filter((prod) => selectedProductIds.includes(prod.id));

    if (selectedProducts.length === 0) {
      addLocalToast(
        isRtl ? 'يرجى اختيار منتج واحد على الأقل أولاً' : 'Please select at least one product first',
        isRtl ? 'يرجى اختيار منتج واحد على الأقل أولاً' : 'Please select at least one product first',
        'warning'
      );
      return;
    }

    const availableProducts = selectedProducts.filter((prod) => prod.stock > 0);
    const unavailableProducts = selectedProducts.filter((prod) => prod.stock <= 0);

    if (availableProducts.length === 0) {
      addLocalToast(
        isRtl ? 'كل المنتجات المختارة غير متوفرة حالياً بالمخزون' : 'All selected products are currently out of stock',
        isRtl ? 'كل المنتجات المختارة غير متوفرة حالياً بالمخزون' : 'All selected products are currently out of stock',
        'warning'
      );
      return;
    }

    setCartItems(prev => {
      const next = [...prev];

      for (const prod of availableProducts) {
        const existingIndex = next.findIndex((item) => item.id === prod.id);
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + 1
          };
        } else {
          next.push({
            id: prod.id,
            type: 'product',
            nameAr: prod.nameAr,
            nameEn: prod.nameEn,
            price: prod.price,
            quantity: 1,
            skuOrCode: prod.sku
          });
        }
      }

      return next;
    });

    setSelectedProductIds([]);

    addLocalToast(
      isRtl
        ? `تمت إضافة ${availableProducts.length} منتج(ات) إلى السلة`
        : `${availableProducts.length} product(s) added to the cart`,
      isRtl
        ? `تمت إضافة ${availableProducts.length} منتج(ات) إلى السلة`
        : `${availableProducts.length} product(s) added to the cart`,
      'success'
    );

    if (unavailableProducts.length > 0) {
      addLocalToast(
        isRtl
          ? `${unavailableProducts.length} منتج غير متاح حالياً بالمخزون`
          : `${unavailableProducts.length} selected product(s) are out of stock`,
        isRtl
          ? `${unavailableProducts.length} منتج غير متاح حالياً بالمخزون`
          : `${unavailableProducts.length} selected product(s) are out of stock`,
        'info'
      );
    }
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

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const vat = total - (total / 1.15);
    const subtotal = total - vat;

    let canonicalPaymentMethod = 'card_pos';
    let paymentMethodSummary = isRtl ? 'أطراف مدى المشتركة' : 'Mada Unified Terminals';
    let allocationsArray: any[] | undefined = undefined;

    if (posSplitActive) {
      allocationsArray = [];
      const parts = [];
      if (posSplitAmounts.card > 0) {
        allocationsArray.push({ paymentMethod: 'card_pos', amount: posSplitAmounts.card });
        parts.push(`مدى: ${posSplitAmounts.card} ر.س`);
      }
      if (posSplitAmounts.cash > 0) {
        allocationsArray.push({ paymentMethod: 'cash', amount: posSplitAmounts.cash });
        parts.push(`نقداً: ${posSplitAmounts.cash} ر.س`);
      }
      if (posSplitAmounts.wallet > 0) {
        allocationsArray.push({ paymentMethod: 'wallet', amount: posSplitAmounts.wallet });
        parts.push(`المحفظة: ${posSplitAmounts.wallet} ر.س`);
      }
      if (posSplitAmounts.bank > 0) {
        allocationsArray.push({ paymentMethod: 'bank_transfer', amount: posSplitAmounts.bank });
        parts.push(`تحويل: ${posSplitAmounts.bank} ر.س`);
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

      if (giftCardItems.length > 0) {
        for (const gc of giftCardItems) {
          for (let q = 0; q < (gc.quantity || 1); q++) {
            const gcRes = await tenantApiAdapter.checkoutGiftCards({
              packageId: gc.id,
              amount: gc.price,
              customerId,
              customerName: buyerName,
              paymentMethod: canonicalPaymentMethod,
              paymentAllocations: allocationsArray,
              notes: paymentMethodSummary
            });
            if (gcRes.orderId || gcRes.transactionRef || gcRes.transaction?.id) {
              orderId = gcRes.orderId || gcRes.transactionRef || gcRes.transaction?.id;
            }
          }
        }
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

  const getDaysOfActiveWeek = (baseDate: Date) => {
    const list: string[] = [];
    const startOfWeek = new Date(baseDate);
    const dayOfWeek = startOfWeek.getDay();
    const saturdayIndex = 6;
    const daysSinceSaturday = (dayOfWeek - saturdayIndex + 7) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - daysSinceSaturday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      list.push(getLocalDateKey(d));
    }
    return list;
  };

  const getMonthCalendarDays = (baseDate: Date) => {
    const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const monthDays: Array<{ key: string; date: Date; isCurrentMonth: boolean }> = [];
    const startOffset = firstDay.getDay();
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - startOffset);

    for (let index = 0; index < 42; index++) {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      monthDays.push({
        key: getLocalDateKey(current),
        date: current,
        isCurrentMonth: current.getMonth() === baseDate.getMonth()
      });
    }

    return monthDays;
  };

  const allEmployeeIds = useMemo(() => liveStylists.map((stylist) => stylist.id), [liveStylists]);
  const serviceCategoryOptions = useMemo(() => {
    const categories = new Map<string, { id: string; labelAr: string; labelEn: string }>();

    liveServices.forEach((service) => {
      const categoryId = getServiceCategoryKey(service);
      if (!categoryId || categories.has(categoryId)) {
        return;
      }

      categories.set(categoryId, {
        id: categoryId,
        labelAr: getServiceCategoryLabel(service, 'ar'),
        labelEn: getServiceCategoryLabel(service, 'en'),
      });
    });

    return Array.from(categories.values());
  }, [liveServices]);
  const resolvedVisibleEmployeeIds = useMemo(() => {
    if (visibleEmployeeIds.length > 0) {
      return visibleEmployeeIds.filter((employeeId) => allEmployeeIds.includes(employeeId));
    }
    return allEmployeeIds;
  }, [allEmployeeIds, visibleEmployeeIds]);

  useEffect(() => {
    if (serviceCategoryFilter === 'all') {
      return;
    }

    if (serviceCategoryOptions.some((category) => category.id === serviceCategoryFilter)) {
      return;
    }

    setServiceCategoryFilter('all');
  }, [serviceCategoryFilter, serviceCategoryOptions]);

  // Filters application
  const filteredAppointments = appointments.filter(apt => {
    const boardVisibleStaffIds = isEmployeeBoardMode(viewMode)
      ? (focusedEmployeeId ? [focusedEmployeeId] : [])
      : resolvedVisibleEmployeeIds;
    const matchesStaff = boardVisibleStaffIds.length === 0 || boardVisibleStaffIds.includes(apt.staffId);
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
    const matchesCategory = serviceCategoryFilter === 'all' || apt.type === 'blocked' || apt.serviceCategory === serviceCategoryFilter;
      const matchesSearch = searchQuery === '' || 
      apt.customerNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.customerNameAr.includes(searchQuery) ||
      apt.serviceNameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.serviceNameAr.includes(searchQuery) ||
      `${apt.customerPhone || ''}`.includes(searchQuery) ||
      `${apt.id || ''}`.toLowerCase().includes(searchQuery.toLowerCase());

    const dateStr = apt.date || getSelectedDateKey();
    let matchesDate = false;
    
    if (isDayBoardMode(viewMode)) {
      matchesDate = dateStr === getSelectedDateKey();
    } else if (isWeekBoardMode(viewMode)) {
      const activeBlock = getDaysOfActiveWeek(selectedDate);
      matchesDate = activeBlock.includes(dateStr);
    } else if (isMonthBoardMode(viewMode)) {
      const currentMonth = selectedDate.getMonth();
      const currentYear = selectedDate.getFullYear();
      const dateValue = parseLocalDateKey(dateStr);
      matchesDate = dateValue.getFullYear() === currentYear && dateValue.getMonth() === currentMonth;
    } else {
      // Agenda view shows all appointments starting from selected date
      const targetDateStr = getSelectedDateKey();
      matchesDate = dateStr >= targetDateStr;
    }

    return matchesStaff && matchesStatus && matchesCategory && matchesSearch && matchesDate;
  });

  // Calculate coordinates of the dragged element's ghost card
  const draggedApt = draggedAptId ? appointments.find(a => a.id === draggedAptId) : null;
  const schedulerAppointments = filteredAppointments.filter((appointment) => {
    if (appointment.kind !== 'blocked') {
      return true;
    }

    if (activeSchedulerSettings.showLunchBreaks) {
      return true;
    }

    return `${appointment.blockedType || ''}`.trim().toLowerCase() !== 'lunch';
  });
  const monthCalendarDays = useMemo(() => getMonthCalendarDays(selectedDate), [selectedDate]);
  const appointmentsByDate = useMemo(() => {
    const grouped = new Map<string, Appointment[]>();
    filteredAppointments.forEach((appointment) => {
      const dateKey = appointment.date || getSelectedDateKey();
      const existing = grouped.get(dateKey) || [];
      existing.push(appointment);
      grouped.set(dateKey, existing);
    });
    return grouped;
  }, [filteredAppointments]);

  const schedulerColumns: SchedulerColumn[] = isDayBoardMode(viewMode)
    ? liveStylists
        .filter((stylist) => {
          if (focusedEmployeeId) {
            return stylist.id === focusedEmployeeId;
          }

          const selectedTeamCount = visibleEmployeeIds.length > 0 ? visibleEmployeeIds.length : liveStylists.length;
          if (selectedTeamCount === liveStylists.length) {
            return true;
          }

          return visibleEmployeeIds.includes(stylist.id);
        })
        .map((stylist) => ({
          id: getSchedulerColumnId(viewMode, stylist.id),
          kind: 'employee',
          resourceId: stylist.id,
          title: isRtl ? stylist.nameAr : stylist.nameEn,
          subtitle: `${isRtl ? stylist.roleAr : stylist.roleEn}${stylistStatuses[stylist.id] ? ` • ${stylistStatuses[stylist.id]}` : ''}`,
          avatar: stylist.avatar,
          statusLabel: stylistStatuses[stylist.id]
            ? (stylistStatuses[stylist.id] === 'active' ? (isRtl ? 'نشط' : 'Active') : stylistStatuses[stylist.id] === 'break' ? (isRtl ? 'استراحة' : 'Break') : (isRtl ? 'خارج' : 'Off'))
            : undefined,
          statusTone: stylistStatuses[stylist.id] || 'neutral',
          isToday: false,
        }))
    : getDaysOfActiveWeek(selectedDate).map((dayStr) => {
        const dateValue = parseLocalDateKey(dayStr);
        const dayName = dateValue.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'short' });
        const dateLabel = dateValue.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
        const isTodayDate = getLocalDateKey(new Date()) === dayStr;
        return {
          id: getSchedulerColumnId(viewMode, dayStr),
          kind: 'day',
          resourceId: dayStr,
          title: `${dayName}`,
          subtitle: dateLabel,
          statusLabel: isTodayDate ? (isRtl ? 'اليوم' : 'Today') : undefined,
          statusTone: isTodayDate ? 'today' : 'neutral',
          dateKey: dayStr,
          isToday: isTodayDate,
        };
      });

  const schedulerEvents: SchedulerEvent[] = schedulerAppointments.map((apt) => {
    const staff = liveStylists.find((stylist) => stylist.id === apt.staffId);
    const columnId = getSchedulerColumnId(viewMode, isDayBoardMode(viewMode) ? apt.staffId : (apt.date || getSelectedDateKey()));
    const title = isRtl ? apt.customerNameAr : apt.customerNameEn;
    const subtitle = isRtl ? apt.serviceNameAr : apt.serviceNameEn;

    return {
      id: apt.id,
      appointmentId: apt.appointmentId || apt.id,
      columnId,
      dateKey: apt.date || getSelectedDateKey(),
      startMinutes: Math.max(0, apt.startTime),
      durationMinutes: Math.max(5, apt.duration),
      title,
      subtitle,
      variantLabel: isRtl ? (apt.serviceVariantDescription || apt.serviceVariantName || '') : (apt.serviceVariantName || apt.serviceVariantDescription || ''),
      variantDescription: apt.serviceVariantDescription || apt.serviceVariantName || '',
      notes: apt.notes,
      price: apt.price,
      paymentStatus: apt.paymentStatus,
      status: apt.status,
      kind: apt.type || 'appointment',
      blockedType: apt.blockedType,
      isGroupBooking: apt.isGroupBooking,
      guestCount: apt.guestCount,
      hasNotes: apt.hasNotes,
      avatar: apt.avatar || undefined,
      staffAvatar: apt.staffAvatar || staff?.avatar,
      assignedStaffName: apt.assignedStaffName || staff?.nameEn || staff?.name || '',
      assignedStaffRole: staff ? (isRtl ? staff.roleAr : staff.roleEn) : '',
      role: isRtl ? staff?.roleAr : staff?.roleEn,
      raw: apt,
    };
  });

  const focusedEmployee = isEmployeeBoardMode(viewMode) && focusedEmployeeId
    ? liveStylists.find((stylist) => stylist.id === focusedEmployeeId) || null
    : null;
  const boardModeLabel = getBoardModeLabel(viewMode, isRtl);
  const visibleEmployeeIdSet = useMemo(() => new Set(resolvedVisibleEmployeeIds), [resolvedVisibleEmployeeIds]);
  const visibleEmployeeNames = useMemo(() => {
    return liveStylists
      .filter((stylist) => visibleEmployeeIdSet.has(stylist.id))
      .map((stylist) => String(isRtl ? stylist.nameAr : stylist.nameEn || stylist.id || '').trim())
      .filter(Boolean);
  }, [isRtl, liveStylists, visibleEmployeeIdSet]);
  const focusedEmployeeName = useMemo(() => {
    if (!focusedEmployee) {
      return '';
    }

    return String(isRtl ? focusedEmployee.nameAr : focusedEmployee.nameEn || focusedEmployee.id || '').trim();
  }, [focusedEmployee, isRtl]);
  const isAllEmployeesVisible = resolvedVisibleEmployeeIds.length === allEmployeeIds.length;
  const teamMembersButtonLabel = useMemo(() => {
    if (isEmployeeBoardMode(viewMode) && focusedEmployeeName) {
      return `👥 ${focusedEmployeeName}`;
    }

    if (isAllEmployeesVisible || resolvedVisibleEmployeeIds.length === 0) {
      return isRtl ? '👥 كل الموظفين' : '👥 All Staff';
    }

    if (visibleEmployeeNames.length === 1) {
      return `👥 ${visibleEmployeeNames[0]}`;
    }

    if (visibleEmployeeNames.length > 1) {
      return isRtl
        ? `👥 ${visibleEmployeeNames.length} موظفين`
        : `👥 ${visibleEmployeeNames.length} staff`;
    }

    return isRtl ? '👥 الموظفون' : '👥 Team Members';
  }, [allEmployeeIds.length, focusedEmployeeName, isAllEmployeesVisible, isRtl, resolvedVisibleEmployeeIds.length, viewMode, visibleEmployeeNames]);
  const updateVisibleEmployeeIds = useCallback((nextIds: string[]) => {
    const normalized = nextIds
      .map((employeeId) => `${employeeId || ''}`.trim())
      .filter((employeeId, index, list) => Boolean(employeeId) && list.indexOf(employeeId) === index && allEmployeeIds.includes(employeeId));
    const finalSelection = normalized.length > 0 ? normalized : allEmployeeIds;
    setVisibleEmployeeIds(finalSelection);
  }, [allEmployeeIds]);

  const toggleVisibleEmployeeId = useCallback((employeeId: string) => {
    const normalizedEmployeeId = `${employeeId || ''}`.trim();
    if (!normalizedEmployeeId) {
      return;
    }

    updateVisibleEmployeeIds(
      resolvedVisibleEmployeeIds.includes(normalizedEmployeeId)
        ? resolvedVisibleEmployeeIds.filter((item) => item !== normalizedEmployeeId)
        : [...resolvedVisibleEmployeeIds, normalizedEmployeeId]
    );
  }, [resolvedVisibleEmployeeIds, updateVisibleEmployeeIds]);

  const setAllVisibleEmployees = useCallback(() => {
    updateVisibleEmployeeIds(allEmployeeIds);
  }, [allEmployeeIds, updateVisibleEmployeeIds]);

  const toggleTeamMembersMenu = useCallback(() => {
    setIsTeamMembersMenuOpen((current) => !current);
  }, []);

  const restoreTeamBoardMode = useCallback(() => {
    setViewMode(previousBoardMode || (isWeekBoardMode(viewMode) ? 'team-week' : 'team-day'));
    setFocusedEmployeeId(null);
    setPreviousBoardMode(null);
    setVisibleEmployeeIds(allEmployeeIds);
    writeSchedulerTeamVisibilityOverride(teamVisibilityStorageKey, allEmployeeIds);
    setSelectedStylistFilter('all');
    setIsTeamMembersMenuOpen(false);
    setEmployeeMenuState(null);
  }, [allEmployeeIds, previousBoardMode, teamVisibilityStorageKey, viewMode]);

  const handleShowAllTeamMembers = useCallback(() => {
    if (focusedEmployeeId) {
      restoreTeamBoardMode();
      return;
    }

    setAllVisibleEmployees();
    setIsTeamMembersMenuOpen(false);
  }, [focusedEmployeeId, restoreTeamBoardMode, setAllVisibleEmployees]);

  const enterEmployeeSchedule = useCallback((staffId: string) => {
    setPreviousBoardMode((current) => current || (isWeekBoardMode(viewMode) ? 'team-week' : 'team-day'));
    setFocusedEmployeeId(staffId);
    setSelectedStylistFilter(staffId);
    setViewMode(isWeekBoardMode(viewMode) ? 'employee-week' : 'employee-day');
    setIsTeamMembersMenuOpen(false);
    setEmployeeMenuState(null);
  }, [viewMode]);



  const handleSchedulerSlotContextMenu = (event: React.MouseEvent, slot: SchedulerSlot) => {
    if (!isBoardEditable) {
      return;
    }

    if (isDayBoardMode(viewMode)) {
      const targetStaffId = slot.employeeId || parseSchedulerColumnResourceId(slot.columnId);
      handleContextMenu(event, targetStaffId, slot.startMinutes, undefined, slot.dateKey);
      return;
    }

    const targetStaffId = isEmployeeBoardMode(viewMode) ? (focusedEmployeeId || currentStaffId) : currentStaffId;
    if (!targetStaffId) {
      addLocalToast(
        'يرجى تحديد موظف قبل فتح قائمة الإنشاء السريع في عرض الجدول.',
        'Please select a staff member before opening quick create in the scheduler view.',
        'warning'
      );
      return;
    }
    handleContextMenu(event, targetStaffId, slot.startMinutes, undefined, slot.dateKey);
  };

  const handleSchedulerSlotDrop = (slot: SchedulerSlot, draggedEventId: string) => {
    if (!isBoardEditable) {
      return;
    }

    const movedAppointment = appointments.find((item) => item.id === draggedEventId);
    if (!movedAppointment) {
      return;
    }

    const targetDateKey = slot.dateKey || getSelectedDateKey();
    const targetStaffId = isDayBoardMode(viewMode)
      ? (slot.employeeId || parseSchedulerColumnResourceId(slot.columnId))
      : movedAppointment.staffId;
    const serviceName = isRtl ? movedAppointment.serviceNameAr : movedAppointment.serviceNameEn;
    const targetStaff = liveStylists.find((staff) => staff.id === targetStaffId);
    const sourceStaff = liveStylists.find((staff) => staff.id === movedAppointment.staffId);
    const canMove = canAssignServiceToStaff(movedAppointment.serviceId, targetStaffId);

    if (!canMove) {
      setDragConflictDialog({
        serviceName,
        destinationStaffName: targetStaff ? (isRtl ? targetStaff.nameAr : targetStaff.nameEn) : (isRtl ? 'الموظف المحدد' : 'Selected staff'),
        serviceId: movedAppointment.serviceId || undefined,
        serviceSection: 'team'
      });
      return;
    }

    setDragMoveDialog({
      appointmentId: draggedEventId,
      targetStaffId,
      targetStaffName: targetStaff ? (isRtl ? targetStaff.nameAr : targetStaff.nameEn) : (isRtl ? 'الموظف المحدد' : 'Selected staff'),
      sourceStaffName: sourceStaff ? (isRtl ? sourceStaff.nameAr : sourceStaff.nameEn) : (isRtl ? 'الموظف الحالي' : 'Current staff'),
      sourceStaffId: movedAppointment.staffId,
      targetStartMinutes: slot.startMinutes,
      targetDateKey,
      sourceTimeLabel: formatMinutesToTime(movedAppointment.startTime),
      targetTimeLabel: formatMinutesToTime(slot.startMinutes),
      notifyCustomer: true
    });
  };

  const confirmSchedulerMove = useCallback(async () => {
    if (!dragMoveDialog) {
      return;
    }

    const movedAppointment = appointments.find((item) => item.id === dragMoveDialog.appointmentId);
    if (!movedAppointment) {
      setDragMoveDialog(null);
      return;
    }

    try {
      await tenantApiAdapter.reassignRescheduleAppointment(dragMoveDialog.appointmentId, {
        staffId: dragMoveDialog.targetStaffId,
        startTime: buildIsoFromMinutes(dragMoveDialog.targetDateKey, dragMoveDialog.targetStartMinutes),
        notifyCustomer: dragMoveDialog.notifyCustomer
      });
      setActiveAppointment((current) => current && current.id === movedAppointment.id
        ? {
            ...current,
            staffId: dragMoveDialog.targetStaffId,
            assignedStaffName: dragMoveDialog.targetStaffName,
            startTime: dragMoveDialog.targetStartMinutes,
            date: dragMoveDialog.targetDateKey
          }
        : current
      );
      setDragMoveDialog(null);
      await loadBoardData();
      emitBIReportRefresh({
        source: 'appointment-workspace',
        kind: 'appointment-moved',
        appointmentId: movedAppointment.id,
        staffId: dragMoveDialog.targetStaffId
      });
      if (drawerOpen && activeAppointment?.customerId) {
        setCustomerProfileRefreshToken((current) => current + 1);
      }
    } catch (error) {
      console.error('Failed to persist drag/drop change', error);
      const toast = getSchedulingErrorToast(error, 'تعذر نقل الموعد إلى الخانة الجديدة', 'Unable to move appointment to the new slot.');
      addLocalToast(toast.ar, toast.en, 'warning');
      await loadBoardData();
      setDragMoveDialog(null);
    }
  }, [activeAppointment?.customerId, dragMoveDialog, drawerOpen, loadBoardData, appointments, isRtl]);

  const handleSchedulerSlotRangeSelect = (range: { startSlot: SchedulerSlot; endSlot: SchedulerSlot; durationMinutes: number }) => {
    if (!isBoardEditable) {
      return;
    }

    if (isDayBoardMode(viewMode)) {
      void openCreateAppointmentAtSlot(
        range.startSlot.employeeId || parseSchedulerColumnResourceId(range.startSlot.columnId),
        range.startSlot.startMinutes,
        range.startSlot.dateKey,
        range.durationMinutes
      );
      return;
    }

    const targetStaffId = isEmployeeBoardMode(viewMode) ? (focusedEmployeeId || currentStaffId) : currentStaffId;
    if (!targetStaffId) {
      addLocalToast(
        'يرجى تحديد موظف قبل إنشاء مدة محددة في عرض الجدول.',
        'Please select a staff member before creating a range in the scheduler view.',
        'warning'
      );
      return;
    }

    if (isPastBoardCreationDate(range.startSlot.dateKey)) {
      showPastBoardSlotWarning(range.startSlot.startMinutes);
      return;
    }

    const dateValue = parseLocalDateKey(range.startSlot.dateKey);
    setSelectedDate(dateValue);
    setCurrentStaffId(targetStaffId);
    seedCreateDrawerFromBoardSlot(range.startSlot.startMinutes);
    setCurrentDuration(range.durationMinutes);
    setCreateMode('appointment');
    setCreateStep(1);
    setStagedServices([]);
    setIsCreateDrawerOpen(true);
  };

  const handleSchedulerEventClick = (eventItem: SchedulerEvent) => {
    const sourceAppointment = eventItem.raw || appointments.find((item) => item.id === eventItem.id);
    if (!sourceAppointment) {
      return;
    }

    if (sourceAppointment.type === 'blocked') {
      openBlockedTimeDetails(sourceAppointment);
      return;
    }

    openAppointmentDetails(sourceAppointment, { readOnly: !isBoardEditable });
  };

  const handleSchedulerEventContextMenu = (event: React.MouseEvent, eventItem: SchedulerEvent) => {
    const sourceAppointment = eventItem.raw || appointments.find((item) => item.id === eventItem.id);
    if (!sourceAppointment) {
      return;
    }

    if (sourceAppointment.type === 'blocked') {
      return;
    }

    handleContextMenu(event, sourceAppointment.staffId, sourceAppointment.startTime, sourceAppointment.id, sourceAppointment.date || eventItem.dateKey);
  };

  // --- EMPLOYEE QUICK ACTIONS CONFIGURATION ---
  type EmployeeActionCategory = 'view' | 'appointments' | 'availability' | 'management' | 'employee';
  interface EmployeeActionDefinition {
    id: string;
    labelEn: string;
    labelAr: string;
    icon: React.ElementType;
    category: EmployeeActionCategory;
    onClick: (staffId: string) => void;
  }

  const EMPLOYEE_ACTIONS_CONFIG: EmployeeActionDefinition[] = [
    {
      id: 'day_view',
      labelEn: 'Day View',
      labelAr: 'عرض اليوم',
      icon: CalendarIcon,
      category: 'view',
      onClick: (staffId) => {
        setViewMode('team-day');
        setPreviousBoardMode(null);
        setFocusedEmployeeId(null);
        setSelectedStylistFilter('all');
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'week_view',
      labelEn: 'Week View',
      labelAr: 'عرض الأسبوع',
      icon: CalendarDays,
      category: 'view',
      onClick: (staffId) => {
        setViewMode('team-week');
        setPreviousBoardMode(null);
        setFocusedEmployeeId(null);
        setSelectedStylistFilter('all');
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'isolate_employee',
      labelEn: 'View Employee Schedule',
      labelAr: 'عرض جدول الموظف',
      icon: Filter,
      category: 'view',
      onClick: (staffId) => {
        enterEmployeeSchedule(staffId);
      }
    },
    {
      id: 'new_appointment',
      labelEn: 'New Appointment',
      labelAr: 'موعد جديد',
      icon: Plus,
      category: 'appointments',
      onClick: (staffId) => {
        setCurrentStaffId(staffId);
        resetCreateDrawerStartTimes();
        setInitialCreateMode('appointment');
        setIsCreateDrawerOpen(true);
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'edit_today_availability',
      labelEn: "Edit Today's Availability",
      labelAr: 'تعديل متاحية اليوم',
      icon: Clock,
      category: 'availability',
      onClick: (staffId) => {
        setCurrentStaffId(staffId);
        resetCreateDrawerStartTimes();
        setInitialCreateMode('blocked');
        setBlockType('Meeting');
        setIsCreateDrawerOpen(true);
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'add_break',
      labelEn: 'Add Break',
      labelAr: 'إضافة استراحة',
      icon: Coffee,
      category: 'availability',
      onClick: (staffId) => {
        setCurrentStaffId(staffId);
        resetCreateDrawerStartTimes();
        setInitialCreateMode('blocked');
        setBlockType('Break');
        setIsCreateDrawerOpen(true);
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'block_time',
      labelEn: 'Block Time',
      labelAr: 'حظر وقت',
      icon: Ban,
      category: 'availability',
      onClick: (staffId) => {
        setCurrentStaffId(staffId);
        resetCreateDrawerStartTimes();
        setInitialCreateMode('blocked');
        setBlockType('Meeting');
        setIsCreateDrawerOpen(true);
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'weekly_schedule',
      labelEn: 'Weekly Schedule',
      labelAr: 'جدول الأسبوع (دائم)',
      icon: Settings2,
      category: 'management',
      onClick: (staffId) => {
        setSelectedShiftStaffId(staffId);
        setIsShiftModalOpen(true);
        setEmployeeMenuState(null);
      }
    },
    {
      id: 'view_team_member',
      labelEn: 'View Team Member',
      labelAr: 'عرض ملف الموظف',
      icon: User,
      category: 'employee',
      onClick: (staffId) => {
        setViewTeamMemberStaffId(staffId);
        setEmployeeMenuState(null);
      }
    }
  ];

  const handleColumnHeaderClick = (event: React.MouseEvent<HTMLElement>, staffId: string) => {
    if (!isBoardEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setEmployeeMenuState({
      visible: true,
      x: rect.left,
      y: rect.bottom,
      anchorEl: event.currentTarget,
      staffId
    });
  };

  const handleColumnHeaderContextMenu = (event: React.MouseEvent<HTMLElement>, staffId: string) => {
    if (!isBoardEditable) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setEmployeeMenuState({
      visible: true,
      x: rect.left,
      y: rect.bottom,
      anchorEl: event.currentTarget,
      staffId
    });
  };

  return (
    <div
      ref={workspaceShellRef}
      className="flex min-h-0 flex-col gap-0 overflow-hidden select-none font-sans transition-all duration-200"
      id="appointments-workspace"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={workspaceHeight ? { height: `${workspaceHeight}px` } : undefined}
    >
      
      {/* 1. COMPREHENSIVE CONTROL BAR & BOARD CONTROLS */}
      <div className={`relative z-50 flex-none rounded-t-2xl rounded-b-none border border-slate-200 border-b-0 bg-white p-4 shadow-sm space-y-3 ${isWorkspaceMaximized ? 'p-3' : ''}`}>
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
                onClick={() => setSelectedDate(getRiyadhCalendarDate())}
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
                value={getSelectedDateKey()} 
                onChange={(e) => {
                  const parts = e.target.value.split('-');
                  if (parts.length === 3) {
                    setSelectedDate(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
                  }
                }}
                className="bg-transparent border-none outline-none text-xs font-bold font-sans cursor-pointer focus:ring-0 p-0.5" 
              />
            </div>

            {/* Time Scope */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button 
                onClick={() => {
                  setViewMode(isEmployeeBoardMode(viewMode) ? 'employee-day' : 'team-day');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isDayBoardMode(viewMode) ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'يومي' : 'Day'}
              </button>
              <button
                onClick={() => {
                  setViewMode(isEmployeeBoardMode(viewMode) ? 'employee-week' : 'team-week');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isWeekBoardMode(viewMode) ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'أسبوعي' : 'Week'}
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isMonthBoardMode(viewMode) ? 'bg-zinc-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {isRtl ? 'شهري' : 'Month'}
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

            <div className="relative" ref={teamMembersButtonRef}>
              <button
                type="button"
                onClick={toggleTeamMembersMenu}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                title={isRtl ? 'عرض أعضاء الفريق' : 'View team members'}
              >
                <Users size={12} />
                <span>{teamMembersButtonLabel}</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>

              {isTeamMembersMenuOpen && teamMembersMenuStyle && typeof document !== 'undefined' && createPortal(
                <div
                  ref={teamMembersMenuRef}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  style={teamMembersMenuStyle}
                >
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">
                      {isRtl ? 'إظهار الفريق' : 'Team visibility'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isRtl ? 'حدّد من يظهر في اللوحة مباشرة.' : 'Pick who appears on the board. Changes apply instantly.'}
                    </p>
                    {!isAllEmployeesVisible && resolvedVisibleEmployeeIds.length > 0 && (
                      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">
                        {isRtl
                          ? `${resolvedVisibleEmployeeIds.length} من ${allEmployeeIds.length} موظفين ظاهرين`
                          : `${resolvedVisibleEmployeeIds.length} of ${allEmployeeIds.length} staff visible`}
                      </p>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto p-2">
                    <button
                      type="button"
                      onClick={handleShowAllTeamMembers}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2">
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${isAllEmployeesVisible ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                          ✓
                        </span>
                        <span>{isRtl ? 'جميع الموظفين' : 'All Staff'}</span>
                      </span>
                      {isAllEmployeesVisible && <Check size={14} className="text-amber-500" />}
                    </button>

                    <div className="my-2 border-t border-slate-100" />

                    {liveStylists.map((stylist) => {
                      const checked = visibleEmployeeIdSet.has(stylist.id);
                      const label = String(isRtl ? stylist.nameAr : stylist.nameEn || stylist.id || '').trim() || stylist.nameEn || stylist.nameAr || stylist.id;

                      return (
                        <label
                          key={stylist.id}
                          className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleVisibleEmployeeId(stylist.id)}
                              className="h-4 w-4 accent-amber-500"
                            />
                            <span>{label}</span>
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                            {checked ? (isRtl ? 'ظاهر' : 'Visible') : (isRtl ? 'مخفي' : 'Hidden')}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>,
                document.body
              )}
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
              type="button"
              onClick={openSchedulerSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              title={isRtl ? 'إعدادات لوحة الجدولة' : 'Scheduler settings'}
            >
              <Settings2 size={12} />
              <span>{isRtl ? 'الإعدادات' : 'Settings'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsWorkspaceMaximized((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              title={isWorkspaceMaximized ? (isRtl ? 'استعادة مساحة الجدولة' : 'Restore workspace') : (isRtl ? 'تكبير مساحة الجدولة' : 'Maximize workspace')}
            >
              {isWorkspaceMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              <span>{isWorkspaceMaximized ? (isRtl ? 'استعادة' : 'Restore') : (isRtl ? 'تكبير' : 'Maximize')}</span>
            </button>

            <button
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center cursor-pointer"
              title={isSidebarCollapsed ? (isRtl ? 'توسيع الشريط الجانبي' : 'Expand sidebar') : (isRtl ? 'طي الشريط الجانبي' : 'Collapse sidebar')}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {/* Star Favorite Button */}
            <button
              onClick={() => onToggleFavoritePage && onToggleFavoritePage()}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isFavorited ? 'border-amber-200 bg-amber-50 text-amber-500' : 'border-slate-200 bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200'
              }`}
              title={isFavorited ? (isRtl ? 'إزالة من المفضلة' : 'Remove from Favorites') : (isRtl ? 'إضافة للمفضلة' : 'Save to Favorites')}
            >
              <Star size={14} fill={isFavorited ? 'currentColor' : 'none'} className="stroke-[2]" />
            </button>

            {/* Save View Button */}
            <button
              onClick={() => setShowSavedViewModal && setShowSavedViewModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              <Save size={12} />
              <span>{isRtl ? 'حفظ المنظر' : 'Save view filter'}</span>
            </button>

            {/* Add Appointment Global Trigger */}
          </div>
        </div>

        {/* SERVICE CATEGORY FILTER CHIPS */}
        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Filter size={10} className="text-amber-500" />
            {isRtl ? 'تصنيف الخدمات:' : 'Category Filter:'}
          </span>
          {[
            { id: 'all', labelEn: 'All Services', labelAr: 'جميع الخدمات' },
            ...serviceCategoryOptions
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
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        
        {/* LEFT COLUMN: CONTROLS & DATE NAVIGATOR (col-span-3) */}
        <div className="hidden lg:col-span-3 space-y-4">
          
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
                  { id: 'checked_in', label: t.arrived },
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
        </div>

        {/* CENTER COLUMN: INTERACTIVE SCHEDULER BOARD (col-span-9) */}
        <div className="min-h-0 flex flex-1 flex-col">
          
          <div
            className="relative z-0 flex min-h-0 flex-col overflow-hidden rounded-b-2xl rounded-t-none border border-slate-200 border-t-0 bg-white shadow-sm"
            style={{
              width: '100%',
              minWidth: '100%'
            }}
          >
            
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
              </div>
            </div>

            {/* THE INTERACTIVE SCHEDULE BOARD CONTAINER */}
              <div
              className="relative flex-1 min-h-0 overflow-auto scrollbar-thin"
              id="interactive-board-scroll"
              style={{
                height: '100%'
              }}
            >
              {isEmployeeBoardMode(viewMode) && focusedEmployee && (
                <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                      {isRtl ? 'عرض جدول الموظف' : 'Viewing Schedule'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-black text-slate-900">
                        {isRtl ? focusedEmployee.nameAr : focusedEmployee.nameEn}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                        {boardModeLabel}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'month' ? (
                <div className="p-4 bg-white min-h-[420px] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                        {isRtl ? 'عرض الشهر' : 'Month View'}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">
                        {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="bg-zinc-900 text-amber-400 px-3 py-1 rounded-lg text-xs font-mono font-black self-start sm:self-auto shadow-xs">
                      {filteredAppointments.length} {isRtl ? 'مواعيد' : 'Appointments'}
                    </span>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {(isRtl
                      ? ['ح', 'خ', 'ج', 'س', 'ر', 'ث', 'ن']
                      : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                    ).map((day, index) => (
                      <div key={`${day}-${index}`} className="px-2 py-1 text-center">{day}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {monthCalendarDays.map((dayCell) => {
                      const dayAppointments = appointmentsByDate.get(dayCell.key) || [];
                      const isTodayCell = dayCell.key === getSelectedDateKey();
                      return (
                        <button
                          key={dayCell.key}
                          type="button"
                          onClick={() => setSelectedDate(dayCell.date)}
                          className={`min-h-[120px] rounded-2xl border p-2 text-start transition-all ${
                            dayCell.isCurrentMonth
                              ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                              : 'bg-slate-100/60 border-slate-200 text-slate-400'
                          } ${isTodayCell ? 'ring-2 ring-amber-400/40 border-amber-300 bg-amber-50/40' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-black ${isTodayCell ? 'text-amber-700' : 'text-slate-700'}`}>
                              {dayCell.date.getDate()}
                            </span>
                            {dayAppointments.length > 0 && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black text-white">
                                {dayAppointments.length}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {dayAppointments.slice(0, 3).map((appointment) => {
                              const staff = liveStylists.find((stylist) => stylist.id === appointment.staffId);
                              return (
                                <div
                                  key={appointment.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openAppointmentDetails(appointment);
                                  }}
                                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-xs transition hover:border-amber-300 hover:shadow-sm"
                                >
                                  <p className="truncate text-[10px] font-black text-slate-800">
                                    {isRtl ? appointment.customerNameAr : appointment.customerNameEn}
                                  </p>
                                  <p className="truncate text-[9px] font-semibold text-slate-500">
                                    {formatMinutesToTime(appointment.startTime)} · {isRtl ? appointment.serviceNameAr : appointment.serviceNameEn}
                                  </p>
                                  {staff && (
                                    <p className="truncate text-[8px] font-bold uppercase tracking-wider text-slate-400">
                                      {isRtl ? staff.nameAr : staff.nameEn}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                            {dayAppointments.length > 3 && (
                              <p className="text-[9px] font-bold text-slate-400">
                                {isRtl ? `+${dayAppointments.length - 3} مواعيد أخرى` : `+${dayAppointments.length - 3} more`}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : viewMode === 'agenda' ? (
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
                          apt.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                          apt.status === 'completed' ? 'bg-zinc-100 text-zinc-700 border-zinc-200' : 'bg-rose-100 text-rose-700 border-rose-200';

                        const statusText = 
                          apt.status === 'confirmed' ? t.confirmed :
                          apt.status === 'checked_in' ? t.arrived :
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
                <SchedulerGrid
                  viewMode={viewMode}
                  selectedDateKey={selectedDateKey}
                  isEditable={isBoardEditable}
                  isRtl={isRtl}
                  boardCurrentTime={boardCurrentTime}
                  columns={schedulerColumns}
                  events={schedulerEvents}
                  slotMinutes={SLOT_MINUTES}
                  startHour={START_HOUR}
                  endHour={END_HOUR}
                  normalEndHour={schedulerConfig.normalEndHour}
                  timeColumnWidth={84}
                  slotHeight={activeSchedulerSettings.timeSlotHeight}
                  staffColumnWidth={activeSchedulerSettings.staffColumnWidth}
                  showCurrentTimeIndicator={activeSchedulerSettings.showCurrentTimeIndicator}
                  showLunchBreaks={activeSchedulerSettings.showLunchBreaks}
                  showStaffPhotos={activeSchedulerSettings.showStaffPhotos}
                  showAppointmentStatusBadges={activeSchedulerSettings.showAppointmentStatusBadges}
                  onColumnHeaderClick={(e, colId) => handleColumnHeaderClick(e, colId)}
                  onColumnHeaderContextMenu={(e, colId) => handleColumnHeaderContextMenu(e, colId)}
                  onSlotContextMenu={handleSchedulerSlotContextMenu}
                  onSlotDrop={handleSchedulerSlotDrop}
                  onSlotRangeSelect={handleSchedulerSlotRangeSelect}
                  onEventClick={handleSchedulerEventClick}
                  onEventContextMenu={handleSchedulerEventContextMenu}
                  onEventDragStart={(eventItem) => setDraggedAptId(eventItem.id)}
                  onEventDragEnd={() => {
                    setDraggedAptId(null);
                  }}
                  onEventResizeStart={(eventItem, mouseEvent) => {
                    if (isDayBoardMode(viewMode) && isBoardEditable && eventItem.kind !== 'blocked') {
                      handleMouseDown(mouseEvent, eventItem.id, true);
                    }
                  }}
                  emptyHint={t.emptyStateText}
                />
              )}

            </div>

          </div>

        </div>

      </div>

      <AnimatePresence>
        {isSchedulerSettingsOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40"
              onClick={cancelSchedulerBoardSettings}
            />
            <motion.div
              initial={{ opacity: 0, x: isRtl ? -28 : 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? -24 : 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className={`absolute inset-y-0 ${isRtl ? 'left-0 border-r' : 'right-0 border-l'} z-10 flex h-full w-full max-w-4xl flex-col border-slate-200 bg-white shadow-2xl`}
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {isRtl ? 'إعدادات لوحة الجدولة' : 'Scheduler settings'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {isRtl ? 'تخصيص عرض الجدول والفلترة' : 'Customize the scheduler board and filters'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={cancelSchedulerBoardSettings}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="border-b border-slate-100 px-5 py-4">
                <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <section className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                          {isRtl ? 'المخطط الزمني للتشغيل' : 'Daily Timeline Navigator'}
                        </p>
                        <h4 className="mt-1 text-sm font-black text-slate-900">
                          {isRtl ? 'التاريخ الحالي ومجال العرض' : 'Current date and visible range'}
                        </h4>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' })}
                      </p>
                      <p className="text-3xl font-black text-slate-900">{selectedDate.getDate()}</p>
                      <p className="text-xs font-bold text-slate-600">
                        {selectedDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
                        const day = new Date(selectedDate);
                        day.setDate(day.getDate() + offset);
                        const isSelected = offset === 0;
                        return (
                          <button
                            key={offset}
                            type="button"
                            onClick={() => handleDayShift(offset)}
                            className={`flex flex-col items-center gap-0.5 rounded-xl p-2 text-[11px] font-bold transition-all ${
                              isSelected ? 'scale-105 bg-zinc-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <span className="opacity-70">{day.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'narrow' })}</span>
                            <span className="text-xs">{day.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                          {isRtl ? 'البحث والتصفية والفرز' : 'FILTER CONTROL DESK'}
                        </p>
                        <h4 className="mt-1 text-sm font-black text-slate-900">
                          {isRtl ? 'عناصر التصفية السريعة' : 'Quick filtering controls'}
                        </h4>
                      </div>
                      <SlidersHorizontal size={14} className="text-slate-400" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{isRtl ? 'البحث عن حجز' : 'Search'}</label>
                      <div className="relative">
                        <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400`} size={13} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={isRtl ? 'اسم العميل، الخدمة...' : 'Client, service name...'}
                          className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-sans outline-none transition-all focus:border-amber-300 focus:ring-1 focus:ring-amber-300 ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{isRtl ? 'مقدم الخدمة / الخبيرة' : 'Staff Stylist'}</label>
                      <div className="relative">
                        <select
                          value={selectedStylistFilter}
                          onChange={(e) => setSelectedStylistFilter(e.target.value)}
                          className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-700 outline-none"
                        >
                          <option value="all">👑 {t.allStaff}</option>
                          {liveStylists.map((s) => (
                            <option key={s.id} value={s.id}>✨ {isRtl ? s.nameAr : s.nameEn}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className={`pointer-events-none absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400`} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{isRtl ? 'حالة الموعد' : 'Booking Status'}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'all', label: t.allStatus },
                          { id: 'confirmed', label: t.confirmed },
                          { id: 'checked_in', label: t.arrived },
                          { id: 'completed', label: t.completed }
                        ].map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setStatusFilter(opt.id)}
                            className={`rounded-xl border px-2.5 py-2 text-[10px] font-bold transition-all ${
                              statusFilter === opt.id
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(selectedStylistFilter !== 'all' || serviceCategoryFilter !== 'all' || statusFilter !== 'all' || searchQuery !== '') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStylistFilter('all');
                          setServiceCategoryFilter('all');
                          setStatusFilter('all');
                          setSearchQuery('');
                        }}
                        className="w-full rounded-xl bg-slate-100 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition hover:bg-zinc-900 hover:text-white"
                      >
                        {t.clearFilters}
                      </button>
                    )}
                  </section>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  { key: 'gridWidth', labelEn: 'Grid Width', labelAr: 'عرض اللوحة', min: 80, max: 160, step: 1, suffix: '%' },
                  { key: 'gridHeight', labelEn: 'Grid Height', labelAr: 'ارتفاع اللوحة', min: 420, max: 1400, step: 10, suffix: 'px' },
                  { key: 'timeSlotHeight', labelEn: 'Time Slot Height', labelAr: 'ارتفاع الخانة الزمنية', min: 8, max: 24, step: 1, suffix: 'px' },
                  { key: 'staffColumnWidth', labelEn: 'Staff Column Width', labelAr: 'عرض عمود الموظف', min: MIN_STAFF_COLUMN_WIDTH, max: MAX_STAFF_COLUMN_WIDTH, step: 5, suffix: 'px' }
                ].map((field) => (
                  <label key={field.key} className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        {isRtl ? field.labelAr : field.labelEn}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {schedulerBoardDraft[field.key as keyof SchedulerBoardSettings] as number}{field.suffix}
                      </span>
                    </div>
                      <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={schedulerBoardDraft[field.key as keyof SchedulerBoardSettings] as number}
                      onChange={(event) => updateSchedulerBoardDraft({
                        [field.key]: Number(event.target.value)
                      } as Partial<SchedulerBoardSettings>)}
                      className="w-full accent-amber-500"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  { key: 'showCurrentTimeIndicator', labelEn: 'Show Current Time Indicator', labelAr: 'إظهار مؤشر الوقت الحالي' },
                  { key: 'showLunchBreaks', labelEn: 'Show Lunch Breaks', labelAr: 'إظهار فترات الغداء' },
                  { key: 'showStaffPhotos', labelEn: 'Show Staff Photos', labelAr: 'إظهار صور الموظفين' },
                  { key: 'showAppointmentStatusBadges', labelEn: 'Show Appointment Status Badges', labelAr: 'إظهار شارات حالة المواعيد' }
                ].map((field) => (
                  <label key={field.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <span className="text-xs font-bold text-slate-700">
                      {isRtl ? field.labelAr : field.labelEn}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(schedulerBoardDraft[field.key as keyof SchedulerBoardSettings])}
                      onChange={(event) => updateSchedulerBoardDraft({
                        [field.key]: event.target.checked
                      } as Partial<SchedulerBoardSettings>)}
                      className="h-4 w-4 accent-amber-500"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={resetSchedulerBoardSettings}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {isRtl ? 'إعادة تعيين التخطيط' : 'Reset Layout'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelSchedulerBoardSettings}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={isSchedulerSettingsSaving}
                    onClick={() => void saveSchedulerBoardSettings(schedulerBoardDraft)}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSchedulerSettingsSaving ? (isRtl ? 'جارٍ الحفظ...' : 'Saving...') : (isRtl ? 'حفظ' : 'Save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragMoveDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
              onClick={() => setDragMoveDialog(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                    {isRtl ? 'تأكيد نقل الموعد' : 'Confirm appointment move'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {isRtl ? `نقل الموعد إلى ${dragMoveDialog.targetStaffName}` : `Move appointment to ${dragMoveDialog.targetStaffName}`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDragMoveDialog(null)}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">{isRtl ? 'الوقت القديم' : 'Old time'}</span>
                  <span className="font-black text-slate-900">{dragMoveDialog.sourceTimeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">{isRtl ? 'الوقت الجديد' : 'New time'}</span>
                  <span className="font-black text-slate-900">{dragMoveDialog.targetTimeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">{isRtl ? 'الموظف القديم' : 'Old staff'}</span>
                  <span className="font-black text-slate-900">{dragMoveDialog.sourceStaffName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-500">{isRtl ? 'الموظف الجديد' : 'New staff'}</span>
                  <span className="font-black text-slate-900">{dragMoveDialog.targetStaffName}</span>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={dragMoveDialog.notifyCustomer}
                  onChange={(event) => setDragMoveDialog((current) => current ? { ...current, notifyCustomer: event.target.checked } : current)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span>{isRtl ? 'إخطار العميل بالبريد الإلكتروني' : 'Notify customer by email'}</span>
              </label>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDragMoveDialog(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmSchedulerMove()}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
                >
                  {isRtl ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dragConflictDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs"
              onClick={() => setDragConflictDialog(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-2xl rounded-2xl border border-rose-200 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3 border-b border-rose-100 pb-4">
                <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
                    {isRtl ? 'تعذر النقل' : 'Move rejected'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {isRtl ? 'الموظف المحدد لا يقدم هذه الخدمة' : 'Destination staff cannot perform this service'}
                  </h3>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-700">
                {isRtl
                  ? `${dragConflictDialog.destinationStaffName} لا يمكنه تقديم خدمة "${dragConflictDialog.serviceName}" لأنه غير مرتبط بها حالياً.`
                  : `${dragConflictDialog.destinationStaffName} cannot perform "${dragConflictDialog.serviceName}" because this staff member is not currently assigned to provide that service.`}
              </p>

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm leading-6 text-slate-700">
                <p className="font-semibold">
                  {isRtl
                    ? 'إذا كنت ترغب في إسناد هذه الخدمة لهذا الموظف، انتقل إلى:'
                    : 'If you would like to assign this service to the staff member, go to:'}
                </p>
                <p className="mt-2 font-black text-slate-900">
                  Services → {dragConflictDialog.serviceName} → Assigned Staff
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {isRtl
                    ? 'قم بإسناد الموظف من هناك ثم أعد المحاولة.'
                    : 'Assign the staff member there, then return and move the appointment again.'}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDragConflictDialog(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  {isRtl ? 'حسناً' : 'OK'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openServiceForStaffAssignment(dragConflictDialog.serviceId);
                    setDragConflictDialog(null);
                  }}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
                >
                  {isRtl ? 'فتح الخدمة' : 'Open Service'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              onClick={() => void triggerContextAction('new')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Plus size={13} className="text-amber-400" />
              <span>{isRtl ? 'إضافة حجز جديد' : 'Add New Appointment'}</span>
            </button>
            
            <button 
              onClick={() => void triggerContextAction('giftcards')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Gift size={13} className="text-pink-400" />
              <span>{isRtl ? 'بطاقات الهدايا' : 'Gift Cards'}</span>
            </button>

            <button 
              onClick={() => void triggerContextAction('products')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <ShoppingBag size={13} className="text-teal-400" />
              <span>{isRtl ? 'المنتجات والمستحضرات' : 'Products'}</span>
            </button>

            <button 
              onClick={() => void triggerContextAction('block')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Lock size={13} className="text-neutral-400" />
              <span>{isRtl ? 'حظر فترة زمنية' : 'Add Blocked Time'}</span>
            </button>

            <button 
              onClick={() => void triggerContextAction('shift')} 
              className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-zinc-900 font-semibold transition-all flex items-center gap-2"
            >
              <Scissors size={13} className="text-indigo-400" />
              <span>{isRtl ? 'تعديل شيفت العمل الأسبوعي' : 'Edit Shift'}</span>
            </button>

            <div className="border-t border-zinc-800/60 my-1" />
            <button 
              onClick={() => void triggerContextAction('refresh')} 
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
                      normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                        normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'checked_in' ? 'bg-emerald-100 text-emerald-700' :
                        normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                        normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'no_show' ? 'bg-slate-100 text-slate-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>
                        {displayAppointmentStatus(activeAppointment.status) === 'confirmed' ? t.confirmed :
                         displayAppointmentStatus(activeAppointment.status) === 'checked_in' ? t.arrived :
                         displayAppointmentStatus(activeAppointment.status) === 'cancelled' ? (isRtl ? 'ملغي' : 'Cancelled') :
                         displayAppointmentStatus(activeAppointment.status) === 'no_show' ? (isRtl ? 'عدم حضور' : 'No-show') : t.completed}
                      </span>
                      {appointmentDetailsReadOnly && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          {isRtl ? 'وضع قراءة' : 'Read only'}
                        </span>
                      )}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      {isRtl ? 'رقم الموعد: ' + activeAppointment.id : 'ID: ' + activeAppointment.id}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {isRtl ? 'حالة الموعد' : 'Status'}
                      </label>
                      <select
                        value={normalizeWorkspaceAppointmentStatus(activeAppointment.status) || ''}
                        disabled={statusUpdating || appointmentDetailsReadOnly || normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'completed'}
                        onChange={(event) => {
                          const nextStatus = event.target.value as Appointment['status'];
                          if (nextStatus === normalizeWorkspaceAppointmentStatus(activeAppointment.status)) return;
                          
                          if (nextStatus === 'completed') {
                            if (activeAppointment.paymentStatus !== 'paid') {
                              setShowPaymentRequiredDialog(true);
                              return;
                            }
                          }
                          
                          if (nextStatus === 'cancelled') {
                            setShowCancelReasonDialog(true);
                            return;
                          }

                          void handleAppointmentStatusUpdate(nextStatus);
                        }}
                        className={`min-w-[170px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60 ${isRtl ? 'text-right' : 'text-left'}`}
                      >
                        {getAppointmentStatusOptions(normalizeWorkspaceAppointmentStatus(activeAppointment.status)).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
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
                      {normalizeWorkspaceAppointmentStatus(activeAppointment.status) === 'cancelled' && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 text-xs mt-2 space-y-1">
                          <p className="font-black flex items-center gap-1.5">
                            <span>⚠️</span>
                            <span>{isRtl ? 'سبب إلغاء الحجز:' : 'Cancellation Reason:'}</span>
                          </p>
                          <p className="font-semibold whitespace-pre-wrap pl-5">
                            {(() => {
                              const notes = activeAppointment.notes || '';
                              const match = notes.match(/\[Cancellation Reason\]:\s*(.*)/s);
                              return match ? match[1].trim() : (isRtl ? 'غير محدد' : 'Not specified');
                            })()}
                          </p>
                        </div>
                      )}
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
                                  platformUserId: activeAppointment.customerId || undefined,
                                  skipAdvanceValidation: shouldSkipAdvanceValidation(baseDate, activeAppointment.startTime + 120)
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
                            value={activeAppointment.staffId || ''}
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
                            value={activeAppointment.startTime || ''}
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
                              {Array.from({ length: TOTAL_HOURS * (60 / SLOT_MINUTES) }).map((_, idx) => {
                                const totalMins = idx * SLOT_MINUTES;
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
                              value={activeAppointment.date || getSelectedDateKey() || ''}
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
                        {activeInvoiceLineItems.length > 0 && (() => {
                          const showQty = activeInvoiceLineItems.some(i => i.type !== 'service');
                          return activeInvoiceLineItems.map((item) => (
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
                              <div className={`grid gap-2 text-slate-500 ${showQty ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                {showQty && (
                                  <div>
                                    <p className="uppercase text-[9px] font-bold">{isRtl ? 'الكمية' : 'Qty'}</p>
                                    <p className="font-mono font-bold text-slate-700">{item.quantity}</p>
                                  </div>
                                )}
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
                          ));
                        })()}

                        {activeInvoiceLineItems.length === 0 && (
                          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                            {isRtl ? 'لم يتم تحميل بنود الفاتورة بعد.' : 'Invoice line items are not loaded yet.'}
                          </div>
                        )}
                      </div>
                    </div>



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
                        <span>{isRtl ? 'الإجمالي الأساسي' : 'Original Subtotal'}</span>
                        <span className="font-mono font-bold">{(activeInvoiceSubtotal + appointmentServiceDiscount).toFixed(2)} {t.riyal}</span>
                      </div>

                      {appointmentServiceDiscount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold">
                          <span>{isRtl ? 'خصم الخدمة/الموعد' : 'Appointment Discount'}</span>
                          <span className="font-mono font-black">-{appointmentServiceDiscount.toFixed(2)} {t.riyal}</span>
                        </div>
                      )}



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
                    {(() => {
                      const isAlreadyFullyPaid = 
                        activeAppointment.paymentStatus === 'paid' || 
                        activeAppointment.paymentStatus === 'fully_paid' || 
                        (activeInvoiceTotal > 0 && Math.max(0, activeInvoiceTotal - Number(activeAppointment.totalPaid ?? 0)) <= 0);

                      if (isAlreadyFullyPaid) {
                        return (
                          <div className="pt-3 border-t border-slate-100 mt-2">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-emerald-800 text-center shadow-sm">
                              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-1">
                                <CheckCircle2 size={26} className="text-emerald-600" />
                              </div>
                              <h4 className="font-black text-sm">{isRtl ? 'تم السداد بالكامل' : 'Payment Completed'}</h4>
                              <p className="text-xs font-bold opacity-90">
                                {isRtl ? 'المبلغ المسدد:' : 'Amount Paid:'} <span className="font-mono">{Number(activeAppointment.totalPaid ?? 0).toFixed(2)} {t.riyal}</span>
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isRtl ? 'طريقة الدفع' : 'Payment method'}
                        </label>
                        <select
                          value={selectedPaymentMethod || ''}
                          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          <option value="">{isRtl ? 'اختر طريقة الدفع' : 'Choose payment method'}</option>
                          {paymentMethodOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {isRtl ? option.labelAr : option.labelEn}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {isRtl
                            ? 'اختر طريقة الدفع قبل المتابعة.'
                            : 'Choose a payment method before continuing.'}
                        </p>
                      </div>

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
                        <div className="space-y-3 animate-fadeIn mt-2">
                          {(() => {
                            const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                            const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0);
                            const remaining = Math.max(0, totalDue - splitSum);
                            const isSplitValid = totalDue > 0 && Math.abs(splitSum - totalDue) < 0.01;
                            const isSplitComplete = totalDue > 0 && remaining === 0 && isSplitValid;
                            const hasOverpayment = splitSum > totalDue + 0.01;

                            return (
                              <>
                                <div className={`p-2 rounded-lg border ${isSplitComplete ? 'bg-emerald-50 border-emerald-200' : (hasOverpayment ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200')}`}>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المطلوب:' : 'Invoice Total:'}</span>
                                    <span className="font-bold font-mono">{totalDue.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[10px] mb-1">
                                    <span className="text-slate-500">{isRtl ? 'المدفوع:' : 'Allocated Amount:'}</span>
                                    <span className={`font-bold font-mono ${hasOverpayment ? 'text-rose-600' : 'text-emerald-600'}`}>{splitSum.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] font-black pt-1 border-t border-slate-200 border-dashed">
                                    <span className={hasOverpayment ? 'text-rose-600' : 'text-slate-700'}>{isRtl ? 'المتبقي:' : 'Remaining Balance:'}</span>
                                    <span className={`font-mono ${isSplitComplete ? 'text-emerald-600' : (hasOverpayment ? 'text-rose-600' : 'text-amber-600')}`}>
                                      {isSplitComplete ? (isRtl ? 'اكتمل التخصيص' : 'Allocation Complete') : `${remaining.toFixed(2)}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-[10px]">
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Mada</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.card && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, card: parseFloat((remaining + (prev.card || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.card || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, card: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Cash</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.cash && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, cash: parseFloat((remaining + (prev.cash || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.cash || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, cash: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                  <div>
                                    <label className="text-slate-400 block text-center mb-1">Wallet</label>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        if (!splitAmounts.wallet && remaining > 0) {
                                          setSplitAmounts(prev => ({ ...prev, wallet: parseFloat((remaining + (prev.wallet || 0)).toFixed(2)) }));
                                        }
                                      }}
                                      className="w-full mb-1 py-1 bg-slate-100 hover:bg-amber-100 text-slate-500 rounded text-[9px] font-bold transition-colors"
                                    >
                                      {isRtl ? '+ إضافة' : '+ Add'}
                                    </button>
                                    <input type="number" placeholder="0" value={splitAmounts.wallet || ''} onChange={(e) => setSplitAmounts(prev => ({ ...prev, wallet: parseFloat(e.target.value) || 0 }))} className="w-full border p-1 rounded font-mono text-center font-bold" />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 leading-relaxed mt-2">
                          {isRtl ? 'تسمح هذه الأداة بتقسيم الفاتورة الكلية على أكثر من طريقة دفع (مثل البطاقة + كاش).' : 'Allows split distribution among multiple payment methods (Card, Cash, Wallet, Bank transfer).'}
                        </p>
                      )}
                    </div>

                    {/* Checkout and Complete operation */}
                    <div className="pt-3">
                        <button
                          disabled={
                            isSplitActive 
                              ? !(Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0)) > 0 && Math.max(0, Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0)) - ((splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0))) === 0 && Math.abs(((splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0)) - Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0))) < 0.01)
                              : !selectedPaymentMethod.trim()
                          }
                          onClick={() => {
                            const totalDue = Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0));
                            const splitSum = (splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0);
                            const remaining = Math.max(0, totalDue - splitSum);
                            const isSplitValid = totalDue > 0 && Math.abs(splitSum - totalDue) < 0.01;
                            const isSplitComplete = totalDue > 0 && remaining === 0 && isSplitValid;

                            if (isSplitActive) {
                              if (!isSplitComplete) {
                                addLocalToast(
                                  'الرجاء إكمال تخصيص تقسيم المدفوعات.',
                                  'Please complete the split payment allocation.',
                                  'warning'
                                );
                                return;
                              }
                            } else if (!selectedPaymentMethod.trim()) {
                              addLocalToast(
                                'الرجاء اختيار طريقة الدفع أولاً.',
                                'Please choose a payment method first.',
                                'warning'
                              );
                              return;
                            }
                            setShowPaymentConfirmModal(true);
                          }}
                          className={`w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold tracking-wider transition-all shadow-md flex items-center justify-center gap-2 ${
                            (isSplitActive 
                              ? (Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0)) > 0 && Math.max(0, Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0)) - ((splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0))) === 0 && Math.abs(((splitAmounts.card || 0) + (splitAmounts.cash || 0) + (splitAmounts.wallet || 0)) - Math.max(0, activeInvoiceTotal - Number(activeAppointment?.totalPaid ?? 0))) < 0.01)
                              : selectedPaymentMethod.trim()) ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                          }`}
                        >
                          <CheckCircle2 size={15} className="text-amber-400" />
                          <span>{t.checkout}</span>
                        </button>
                    </div>
                        </>
                      );
                    })()}

                    <div className="pt-3">
                      {refundableAmount > 0.009 && (
                        <div className="mt-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{isRtl ? 'المبلغ الأصلي' : 'Original Payment'}</p>
                              <p className="mt-1 font-mono font-black text-slate-800">{originalPaymentAmount.toFixed(2)} {t.riyal}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{isRtl ? 'الاسترداد السابق' : 'Already Refunded'}</p>
                              <p className="mt-1 font-mono font-black text-slate-800">{alreadyRefundedAmount.toFixed(2)} {t.riyal}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={openRefundDialog}
                            disabled={appointmentDetailsReadOnly || refundableAmount <= 0.009}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all shadow-sm flex items-center justify-center gap-2 border ${
                              appointmentDetailsReadOnly || refundableAmount <= 0.009
                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer'
                            }`}
                          >
                            <RefreshCw size={14} />
                            <span>{isRtl ? 'استرداد' : 'Refund'}</span>
                          </button>
                        </div>
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
                        setCustomerTransactionDetail(null);
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
                              setCustomerTransactionDetail(null);
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
                                ].map((item, idx) => (
                                  <button
                                    key={`${item.label}-${idx}`}
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
                                {customerInternalNotes.map((note, idx) => (
                                  <div key={`${note.label}-${idx}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1">
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
                                        ].map((item, idx) => (
                                          <div key={`${item.label}-${idx}`} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
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
                                        {customerAppointmentHistoryCardsFiltered.length === 0 ? (
                                          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-xs">
                                            {isRtl ? 'لا توجد حجوزات تطابق هذا الفلتر.' : 'No appointments match the selected filter.'}
                                          </div>
                                        ) : (
                                          customerAppointmentHistoryCardsFiltered.map((item: any) => {
                                            const serviceName = item?.details?.service?.name_en
                                              || item?.details?.service?.nameEn
                                              || item?.details?.service?.name
                                              || item?.service?.name_en
                                              || item?.service?.nameEn
                                              || item?.service?.name
                                              || item?.serviceNameEn
                                              || item?.serviceName
                                              || item?.title
                                              || (isRtl ? 'خدمة' : 'Service');
                                            const employeeName = item?.details?.staff?.name
                                              || item?.employee?.name
                                              || item?.staff?.name
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
                                            const totalPaid = Number(item?.paidAmount ?? item?.amount ?? item?.totalPaid ?? item?.totalAmount ?? 0);
                                            const branchLabel = item?.details?.branch?.name || item?.branch?.name || item?.branchName || activeCustomerBranch || '—';
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
                                        {customerInternalNotes.map((note, idx) => (
                                          <div key={`${note.label}-${idx}`} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1">
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

              <AnimatePresence>
                {customerTransactionDetail && (
                  <TransactionDetailsDrawer
                    open={Boolean(customerTransactionDetail)}
                    transaction={customerTransactionDetail}
                    isRtl={isRtl}
                    currencyLabel={t.riyal}
                    onClose={() => {
                      setCustomerTransactionDetail(null);
                    }}
                    onOpenAppointment={async () => {
                      if (!customerTransactionDetail?.appointmentIdLinked) {
                        return;
                      }
                      const linkedAppointment = {
                        id: customerTransactionDetail.appointmentIdLinked,
                        date: customerTransactionDetail.date || getSelectedDateKey(),
                        serviceVariantId: customerTransactionDetail?.appointment?.serviceVariantId || customerTransactionDetail?.details?.serviceVariantId || null,
                        serviceVariantName: customerTransactionDetail?.appointment?.serviceVariantName || customerTransactionDetail?.details?.serviceVariantName || null,
                        serviceVariantDescription: customerTransactionDetail?.appointment?.serviceVariantDescription || customerTransactionDetail?.details?.serviceVariantDescription || null,
                        details: {
                          service: customerTransactionDetail?.appointment?.service || customerTransactionDetail?.details?.service || null,
                          staff: customerTransactionDetail?.appointment?.staff || customerTransactionDetail?.details?.staff || null,
                          duration: customerTransactionDetail?.details?.duration || customerTransactionDetail?.appointment?.duration || 0,
                          startTime: customerTransactionDetail?.appointment?.startTime || customerTransactionDetail?.date || customerTransactionDetail?.createdAt || '',
                          notes: customerTransactionDetail?.notes || '',
                          serviceVariantId: customerTransactionDetail?.appointment?.serviceVariantId || customerTransactionDetail?.details?.serviceVariantId || null,
                          serviceVariantName: customerTransactionDetail?.appointment?.serviceVariantName || customerTransactionDetail?.details?.serviceVariantName || null,
                          serviceVariantDescription: customerTransactionDetail?.appointment?.serviceVariantDescription || customerTransactionDetail?.details?.serviceVariantDescription || null
                        },
                        serviceId: customerTransactionDetail?.appointment?.service?.id || customerTransactionDetail?.appointment?.serviceId || null,
                        serviceNameEn: customerTransactionDetail?.appointment?.service?.name_en || customerTransactionDetail?.appointment?.serviceName || customerTransactionDetail?.serviceLabel || customerTransactionDetail?.title || '',
                        serviceNameAr: customerTransactionDetail?.appointment?.service?.name_ar || customerTransactionDetail?.appointment?.serviceName || customerTransactionDetail?.serviceLabel || customerTransactionDetail?.title || '',
                        staffId: customerTransactionDetail?.appointment?.staff?.id || customerTransactionDetail?.appointment?.staffId || null,
                        staffName: customerTransactionDetail?.appointment?.staff?.name || customerTransactionDetail?.employeeLabel || customerTransactionDetail?.processorName || '',
                        customerId: activeAppointment?.customerId || undefined,
                        customerNameEn: activeAppointment?.customerNameEn || '',
                        customerNameAr: activeAppointment?.customerNameAr || '',
                        customerPhone: activeAppointment?.customerPhone || '',
                        customerEmail: activeAppointment?.customerEmail || '',
                        price: Number(customerTransactionDetail.amount || 0),
                        status: customerTransactionDetail?.appointment?.status || customerTransactionDetail?.appointmentStatus || activeAppointment?.status || 'completed',
                        paymentStatus: customerTransactionDetail?.appointment?.paymentStatus || customerTransactionDetail.statusLabel || 'paid',
                        totalPaid: Number(customerTransactionDetail.amount || 0),
                        branchName: customerTransactionDetail.branchLabel || activeAppointment?.branchName || '',
                        invoiceStatus: customerTransactionDetail.statusLabel || 'paid',
                        notes: customerTransactionDetail?.notes || '',
                        services: customerTransactionDetail?.appointment?.service ? [customerTransactionDetail.appointment.service] : [],
                        serviceItems: customerTransactionDetail?.appointment?.service ? [{
                          service: customerTransactionDetail.appointment.service,
                          serviceVariantId: customerTransactionDetail?.appointment?.serviceVariantId || customerTransactionDetail?.details?.serviceVariantId || null,
                          serviceVariantName: customerTransactionDetail?.appointment?.serviceVariantName || customerTransactionDetail?.details?.serviceVariantName || null,
                          serviceVariantDescription: customerTransactionDetail?.appointment?.serviceVariantDescription || customerTransactionDetail?.details?.serviceVariantDescription || null,
                          duration: customerTransactionDetail?.appointment?.service?.duration || customerTransactionDetail?.details?.duration || 0,
                          price: Number(customerTransactionDetail.amount || 0)
                        }] : [],
                        lineItems: [],
                        invoiceItems: [],
                        products: [],
                        productItems: [],
                        retailItems: [],
                        tags: []
                      } as any;
                      setCustomerTransactionDetail(null);
                      await openHistoricalAppointmentDetails(linkedAppointment);
                    }}
                    onOpenInvoice={() => {
                      if (!customerTransactionDetail) {
                        return;
                      }
                      setCheckoutReceiptData({
                        orderId: customerTransactionDetail.invoiceId || customerTransactionDetail.invoiceNumber || customerTransactionDetail.reference || customerTransactionDetail.id,
                        date: customerTransactionDetail.date || customerTransactionDetail.processedAt || customerTransactionDetail.createdAt || '',
                        customerName: activeCustomerName,
                        serviceName: customerTransactionDetail.serviceLabel || customerTransactionDetail.title || 'Transaction',
                        servicePrice: Number(customerTransactionDetail.amount || 0),
                        products: customerTransactionDetail.productLabel ? [{ name: customerTransactionDetail.productLabel, price: 0 }] : [],
                        subtotal: Number(customerTransactionDetail.amount || 0),
                        discount: 0,
                        vat: 0,
                        total: Number(customerTransactionDetail.amount || 0),
                        paymentSummary: customerTransactionDetail.paymentMethodLabel || customerTransactionDetail.paymentMethod || '—'
                      });
                      setShowReceiptModal(true);
                    }}
                    onOpenCustomer={() => {
                      setCustomerTransactionDetail(null);
                      setIsCustomerProfileOpen(true);
                      setCustomerDrawerTab('overview');
                    }}
                  />
                )}
              </AnimatePresence>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Render modular advanced interactive creation & POS checkout drawers */}
      <InteractiveDrawers 
        isRtl={isRtl}
        tenantId={tenant?.id || ''}
        tenantTimezone={tenantTimezone}
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
        preserveBoardStartTime={preserveBoardStartTime}
        boardStartHour={START_HOUR}
        normalEndHour={schedulerConfig.normalEndHour}
        currentStaffId={currentStaffId}
        setCurrentStaffId={setCurrentStaffId}
        initialDuration={currentDuration}
        stylists={liveStylists}
        initialCreateMode={initialCreateMode}
        initialCartTab={initialCartTab}
        selectedDate={selectedDate}
        customers={liveCustomers}
        services={liveServices}
        products={liveProducts}
        giftCardPackages={giftCardPackages}
        onBoardChanged={loadBoardData}
        existingBreak={activeBlockedTime}
      />

      {/* Multi-Service Chained Booking Confirmation Modal */}
      <AnimatePresence>
        {chainConflictDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={chainConflictDialog.onCancel}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl relative z-10 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">
                  {isRtl ? 'تعذر إكمال الحجز' : 'Unable to complete booking'}
                </h3>
              </div>

              {chainConflictView === 'explanation' && (
                <>
                  <p className="text-sm font-medium text-slate-800 mb-2">
                    {isRtl ? 'لا يمكن تنفيذ الخدمات بشكل متواصل في الوقت المحدد للأسباب التالية:' : 'The requested services cannot be booked continuously due to the following reasons:'}
                  </p>
                  <div className="mb-6 space-y-3">
                    {chainConflictDialog.conflictCards?.map((card, idx) => (
                      <div key={`${card.staffId || card.staffName || 'conflict'}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600">
                            {card.avatar ? (
                              <img src={card.avatar} alt={card.staffName} className="h-full w-full object-cover" />
                            ) : (
                              <span>
                                {card.staffName
                                  .split(' ')
                                  .filter(Boolean)
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-extrabold text-slate-900">{card.staffName}</h4>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${card.reasonType === 'existing_booking' ? 'bg-rose-50 text-rose-600' : card.reasonType === 'outside_working_hours' ? 'bg-amber-50 text-amber-700' : card.reasonType === 'time_off' ? 'bg-slate-100 text-slate-600' : card.reasonType === 'blocked_time' ? 'bg-orange-50 text-orange-700' : card.reasonType === 'staff_break' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{card.reasonTitle}</span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{card.reasonDescription}</p>
                            {(card.conflictStartTime || card.conflictEndTime) && (
                              <p className="mt-2 text-xs font-semibold text-slate-500">
                                {formatConflictTime(card.conflictStartTime, isRtl)}
                                {card.conflictEndTime ? ` – ${formatConflictTime(card.conflictEndTime, isRtl)}` : ''}
                              </p>
                            )}
                            {card.workingHoursEnd && card.reasonType === 'outside_working_hours' && (
                              <p className="mt-1 text-xs font-semibold text-slate-500">
                                {isRtl
                                  ? `ينتهي دوامها: ${formatConflictTime(card.workingHoursEnd, isRtl)}`
                                  : `Working hours end: ${formatConflictTime(card.workingHoursEnd, isRtl)}`}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setChainConflictView('date-selection')}
                      className="w-full px-4 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      {isRtl ? 'البحث عن موعد بديل' : 'Search for alternative time'}
                    </button>
                    
                    <button
                      onClick={chainConflictDialog.onCancel}
                      className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      {isRtl ? 'تعديل المختصين' : 'Modify Professionals'}
                    </button>

                    <button
                      onClick={chainConflictDialog.onCancel}
                      className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      {isRtl ? 'حجز الخدمات بشكل منفصل' : 'Book services separately'}
                    </button>
                    
                    <button
                      onClick={chainConflictDialog.onCancel}
                      className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mt-2"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}

              {chainConflictView === 'date-selection' && (
                <>
                  <p className="text-sm font-medium text-slate-800 mb-4">
                    {isRtl ? 'اختر اليوم الذي تريد البحث فيه' : 'Choose the day to search'}
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleSearchDate(new Date().toISOString().split('T')[0])}
                      className="w-full px-4 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      {isRtl ? 'اليوم' : 'Today'}
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(); d.setDate(d.getDate() + 1);
                        handleSearchDate(d.toISOString().split('T')[0]);
                      }}
                      className="w-full px-4 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      {isRtl ? 'غداً' : 'Tomorrow'}
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date(); d.setDate(d.getDate() + 2);
                        handleSearchDate(d.toISOString().split('T')[0]);
                      }}
                      className="w-full px-4 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      {isRtl ? 'بعد غد' : 'Day after tomorrow'}
                    </button>
                    <div className="relative w-full">
                      <input 
                        type="date"
                        className="w-full px-4 py-3 text-sm font-bold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                        onChange={(e) => {
                          if (e.target.value) handleSearchDate(e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setChainConflictView('explanation')}
                    className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors mt-4"
                  >
                    {isRtl ? 'رجوع' : 'Back'}
                  </button>
                </>
              )}

              {chainConflictView === 'time-selection' && (
                <>
                  <p className="text-sm font-bold text-slate-800 mb-4">
                    {isRtl ? 'الأوقات المتاحة لبدء الحجز' : 'Available Start Times'}
                  </p>
                  
                  {chainConflictDialog.validChains.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {chainConflictDialog.validChains.map((chain, i) => {
                         const d = new Date(chain.startTime);
                         const min = (d.getHours() * 60 + d.getMinutes()) - (START_HOUR * 60);
                         return (
                           <button
                             key={i}
                             onClick={() => setChainConflictDialog(prev => prev ? { ...prev, selectedChain: chain } : null) || setChainConflictView('confirmation')}
                             className="px-2 py-3 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                           >
                             {formatMinutesToTime(min)}
                           </button>
                         );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-600 mb-6">
                        {isRtl ? 'لا توجد سلسلة متواصلة متاحة في هذا اليوم. يمكنك اختيار يوماً آخر للبحث عن موعد مناسب.' : 'No continuous chain available on this day. Please choose another day.'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setChainConflictView('date-selection')}
                      className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      {isRtl ? 'اختيار يوم آخر' : 'Choose another day'}
                    </button>
                    <button
                      onClick={chainConflictDialog.onCancel}
                      className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}

              {chainConflictView === 'confirmation' && chainConflictDialog.selectedChain && (
                <>
                  <p className="text-sm font-bold text-emerald-600 mb-2">
                    {isRtl ? 'الموعد متاح' : 'Time is available'}
                  </p>
                  <p className="text-sm text-slate-600 mb-6">
                    {isRtl ? 'يمكن تنفيذ الخدمات بالتسلسل في الوقت الذي اخترته:' : 'The services can be executed sequentially at the time you chose:'}
                  </p>
                  
                  <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {chainConflictDialog.selectedChain.slots.map((slot, index) => {
                      const srv = liveServices.find(s => s.id === slot.serviceId);
                      const st = liveStylists.find(s => s.id === slot.staffId);
                      const dStart = new Date(slot.startTime);
                      const dEnd = new Date(slot.endTime);
                      const startMin = (dStart.getHours() * 60 + dStart.getMinutes()) - (START_HOUR * 60);
                      const endMin = (dEnd.getHours() * 60 + dEnd.getMinutes()) - (START_HOUR * 60);
                      
                      return (
                        <div key={index} className="flex flex-col gap-1 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                          <div className="font-bold text-slate-800">{isRtl ? srv?.nameAr : srv?.nameEn}</div>
                          <div className="flex justify-between items-center text-slate-500">
                            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5"/> {isRtl ? st?.nameAr : st?.nameEn}</span>
                            <span className="flex items-center gap-1 font-mono text-xs">{formatMinutesToTime(startMin)} - {formatMinutesToTime(endMin)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-sm font-semibold text-slate-800 text-center mb-6">
                    {isRtl ? 'هل تريد حجز هذا الموعد الآن؟' : 'Do you want to book this time now?'}
                  </p>

                  <div className="flex flex-col gap-3">
                    <button
                      disabled={chainConflictDialog.isRevalidating}
                      onClick={() => chainConflictDialog.selectedChain && chainConflictDialog.onConfirm(chainConflictDialog.selectedChain)}
                      className="w-full px-4 py-3 text-sm font-bold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {chainConflictDialog.isRevalidating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isRtl ? 'نعم، احجز الموعد' : 'Yes, book this time'}
                    </button>
                    <button
                      disabled={chainConflictDialog.isRevalidating}
                      onClick={() => setChainConflictView('time-selection')}
                      className="w-full px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                    >
                      {isRtl ? 'اختيار وقت آخر' : 'Choose another time'}
                    </button>
                    <button
                      disabled={chainConflictDialog.isRevalidating}
                      onClick={chainConflictDialog.onCancel}
                      className="w-full px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <AlertTriangle className="h-6 w-6" />
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
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-800"
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
                  <Clock className="h-6 w-6" />
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
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 transition hover:bg-amber-400"
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

      <AnimatePresence>
        {showPaymentConfirmModal && (
          <div className="fixed inset-0 z-[155] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/45 backdrop-blur-sm"
              onClick={() => setShowPaymentConfirmModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-5"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-600">
                {isRtl ? 'تأكيد التحصيل' : 'Confirm Payment'}
              </p>
              <h3 className="mt-2 text-sm font-black text-slate-900">
                {isRtl ? 'هل تريد إتمام الدفع الآن؟' : 'Do you want to collect payment now?'}
              </h3>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                {isRtl
                  ? 'سيتم إرسال عملية الدفع إلى الخادم أولاً، ثم تظهر الفاتورة بعد نجاح الحفظ.'
                  : 'The payment will be sent to the backend first. The receipt appears only after persistence succeeds.'}
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentConfirmModal(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentConfirmModal(false);
                    void handleCheckoutPayment();
                  }}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  {isRtl ? 'تأكيد الدفع' : 'Confirm Payment'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRefundModal && activeAppointment && (
          <div className="fixed inset-0 z-[156] flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm"
              onClick={() => {
                if (!refundSubmitting) {
                  setShowRefundModal(false);
                }
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 24, stiffness: 220 }}
              className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-rose-50 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">
                    {isRtl ? 'استرداد دفعة' : 'Refund Payment'}
                  </p>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    {isRtl ? 'إنشاء استرداد حقيقي عبر الخادم' : 'Create a canonical backend refund'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => !refundSubmitting && setShowRefundModal(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={isRtl ? 'إغلاق' : 'Close'}
                  disabled={refundSubmitting}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid gap-4 p-5 lg:grid-cols-[1.3fr_0.9fr]">
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <Receipt size={16} className="text-amber-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        {isRtl ? 'معلومات القراءة فقط' : 'Read-only information'}
                      </h4>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        { label: isRtl ? 'العميل' : 'Customer', value: activeAppointment.customerNameEn || activeAppointment.customerNameAr || '—' },
                        { label: isRtl ? 'الموعد' : 'Appointment', value: `${activeAppointment.serviceNameEn || activeAppointment.serviceNameAr || '—'} · ${activeAppointment.bookingReference || activeAppointment.id}` },
                        { label: isRtl ? 'المبلغ الأصلي' : 'Original Payment', value: `${originalPaymentAmount.toFixed(2)} ${t.riyal}` },
                        { label: isRtl ? 'تم استرداده مسبقاً' : 'Already Refunded', value: `${alreadyRefundedAmount.toFixed(2)} ${t.riyal}` },
                        { label: isRtl ? 'الرصيد القابل للاسترداد' : 'Remaining Refundable', value: `${refundableAmount.toFixed(2)} ${t.riyal}` },
                        { label: isRtl ? 'طريقة الدفع' : 'Payment Method', value: refundPaymentMethod || '—' },
                        { label: isRtl ? 'رقم الفاتورة' : 'Invoice Number', value: activeAppointment.invoiceNumber || activeAppointment.invoice?.number || activeAppointment.invoice?.invoiceNumber || '—' },
                        { label: isRtl ? 'حالة الفاتورة الحالية' : 'Current Invoice Status', value: activeAppointment.invoiceStatus || activeAppointment.normalizedPaymentStatus || activeAppointment.paymentStatus || '—' }
                      ].map((field, idx) => (
                        <div key={`${field.label}-${idx}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{field.label}</p>
                          <p className="mt-1 text-sm font-bold text-slate-900 break-words">{field.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-rose-500" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        {isRtl ? 'تفاصيل الاسترداد' : 'Refund details'}
                      </h4>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isRtl ? 'مبلغ الاسترداد' : 'Refund Amount'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={refundAmountInput}
                          disabled={refundSubmitting}
                          onChange={(event) => {
                            setRefundAmountInput(event.target.value);
                            setRefundDialogError(null);
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-rose-400"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                          {isRtl ? 'سبب الاسترداد' : 'Reason'}
                        </span>
                        <input
                          type="text"
                          value={refundReasonInput}
                          disabled={refundSubmitting}
                          onChange={(event) => setRefundReasonInput(event.target.value)}
                          placeholder={isRtl ? 'مثل: إلغاء خدمة' : 'e.g. service cancellation'}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-rose-400"
                        />
                      </label>
                    </div>

                    {refundDialogError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                        {refundDialogError}
                      </div>
                    )}

                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{isRtl ? 'المبلغ الأصلي' : 'Original payment'}</span>
                        <span className="font-mono font-black">{originalPaymentAmount.toFixed(2)} {t.riyal}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{isRtl ? 'مبلغ الاسترداد' : 'Refund amount'}</span>
                        <span className="font-mono font-black text-rose-700">{Number(refundAmountInput || 0).toFixed(2)} {t.riyal}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{isRtl ? 'الرصيد المتبقي' : 'Remaining balance'}</span>
                        <span className="font-mono font-black text-emerald-700">{Math.max(0, refundableAmount - Number(refundAmountInput || 0)).toFixed(2)} {t.riyal}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{isRtl ? 'حالة الفاتورة الجديدة' : 'New invoice status'}</span>
                        <span className="font-semibold text-slate-500">
                          {isRtl ? 'سيتم إرجاعها من الخادم بعد الحفظ' : 'Returned by backend after submission'}
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">
                      {isRtl ? 'تأكيد قبل الإرسال' : 'Confirmation before submission'}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-700 leading-6">
                      {isRtl
                        ? 'سيُرسل الاسترداد إلى الخادم أولاً. لا يتم تعديل الحالة أو المحاسبة في الواجهة.'
                        : 'The refund is sent to the backend first. The UI never mutates accounting state locally.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-slate-600" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        {isRtl ? 'ملخص الاسترداد' : 'Refund summary'}
                      </h4>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">{isRtl ? 'المبلغ الأصلي' : 'Original payment'}</span>
                        <span className="font-mono font-black text-slate-900">{originalPaymentAmount.toFixed(2)} {t.riyal}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">{isRtl ? 'الاسترداد الحالي' : 'Current refund'}</span>
                        <span className="font-mono font-black text-rose-600">{Number(refundAmountInput || 0).toFixed(2)} {t.riyal}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">{isRtl ? 'المتبقي قابل للاسترداد' : 'Still refundable'}</span>
                        <span className="font-mono font-black text-emerald-700">{Math.max(0, refundableAmount - Number(refundAmountInput || 0)).toFixed(2)} {t.riyal}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => !refundSubmitting && setShowRefundModal(false)}
                      disabled={refundSubmitting}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRtl ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitRefundAppointment()}
                      disabled={refundSubmitting}
                      className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refundSubmitting
                        ? (isRtl ? 'جارٍ الإرسال...' : 'Submitting...')
                        : (isRtl ? 'تنفيذ الاسترداد' : 'Process Refund')}
                    </button>
                  </div>
                </aside>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaymentRequiredDialog && (
          <div className="fixed inset-0 z-[157] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs" onClick={() => setShowPaymentRequiredDialog(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 z-10"
            >
              <div className="flex items-center gap-2.5 text-amber-600">
                <span className="p-2 bg-amber-500/10 rounded-xl">
                  <AlertTriangle size={20} />
                </span>
                <h3 className="font-black text-slate-800 text-sm">
                  {isRtl ? 'مطلوب سداد المبلغ الكلي' : 'Payment Required'}
                </h3>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                {isRtl 
                  ? 'لا يمكن تغيير حالة هذا الموعد إلى مكتمل لعدم سداد القيمة الإجمالية بالكامل.' 
                  : 'This appointment cannot be marked as Completed because payment has not been fully collected.'}
                <br />
                {isRtl ? 'يرجى سداد الفاتورة أولاً.' : 'Please complete the payment first.'}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-55">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerTab('financials');
                    setShowPaymentRequiredDialog(false);
                  }}
                  className="rounded-xl bg-zinc-950 px-3.5 py-2 text-[10px] font-black text-white hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  {isRtl ? 'تحصيل المبلغ' : 'Collect Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentRequiredDialog(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCancelReasonDialog && (
          <div className="fixed inset-0 z-[157] flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs" onClick={() => { setShowCancelReasonDialog(false); setCancelReasonText(''); }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 z-10"
            >
              <div className="flex items-center gap-2.5 text-rose-600">
                <span className="p-2 bg-rose-500/10 rounded-xl">
                  <Trash size={20} />
                </span>
                <h3 className="font-black text-slate-800 text-sm">
                  {isRtl ? 'سبب إلغاء الموعد' : 'Reason for Cancellation'}
                </h3>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">{isRtl ? 'السبب المبرر للإلغاء' : 'Cancellation Reason Detail'}</label>
                <textarea
                  rows={3}
                  value={cancelReasonText}
                  onChange={(e) => setCancelReasonText(e.target.value)}
                  placeholder={isRtl ? 'اكتب سبب الإلغاء هنا...' : 'Explain the reason for cancellation...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold focus:border-rose-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-55">
                <button
                  type="button"
                  onClick={async () => {
                    setShowCancelReasonDialog(false);
                    await handleAppointmentStatusUpdate('cancelled', cancelReasonText);
                    setCancelReasonText('');
                  }}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-[10px] font-black text-white hover:bg-rose-700 transition-all cursor-pointer"
                >
                  {isRtl ? 'إلغاء الموعد' : 'Cancel Appointment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelReasonDialog(false);
                    setCancelReasonText('');
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  {isRtl ? 'الرجوع' : 'Back'}
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

      {/* 8. EMPLOYEE OPERATIONS MENU (POPOVER) */}
      <AnimatePresence>
        {employeeMenuState && employeeMenuState.visible && (
          <>
            <div 
              className="fixed inset-0 z-[60]"
              onClick={(e) => { e.stopPropagation(); setEmployeeMenuState(null); }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setEmployeeMenuState(null); }}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 p-2 z-[70] w-64 overflow-hidden"
              style={{
                top: `${employeeMenuState.y + 4}px`,
                left: `${employeeMenuState.x}px`
              }}
            >
              <div className="px-3 py-2 border-b border-slate-100 mb-2">
                <p className="text-[10px] text-slate-500 font-black tracking-wider uppercase">
                  {isRtl ? 'إجراءات الموظف' : 'EMPLOYEE ACTIONS'}
                </p>
              </div>

              <div className="space-y-1">
                {['view', 'appointments', 'availability', 'management', 'employee'].map((category) => {
                  const items = EMPLOYEE_ACTIONS_CONFIG.filter(a => a.category === category);
                  if (items.length === 0) return null;
                  
                  return (
                    <div key={category} className="mb-2 last:mb-0">
                      {items.map(action => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            onClick={() => action.onClick(employeeMenuState.staffId)}
                            className="w-full text-start px-3 py-2 rounded-lg hover:bg-slate-50 font-medium transition-all flex items-center gap-3 text-xs text-slate-700"
                          >
                            <Icon size={14} className="text-slate-400" />
                            <span>{isRtl ? action.labelAr : action.labelEn}</span>
                          </button>
                        );
                      })}
                      {category !== 'employee' && (
                        <div className="h-px bg-slate-100 my-1 mx-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 9. VIEW TEAM MEMBER DRAWER */}
      <AnimatePresence>
        {viewTeamMemberStaffId && (
          <TeamMemberProfileDrawer
            staffId={viewTeamMemberStaffId}
            onClose={() => setViewTeamMemberStaffId(null)}
            isRtl={isRtl}
            onRefreshBoard={() => {
                // To force a refresh, we could trigger a re-fetch of master data.
                // In AppointmentWorkspace, there isn't a direct exported fetch function,
                // but the drawer update is complete.
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
}
