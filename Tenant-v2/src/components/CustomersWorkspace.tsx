import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Search, Shield, MapPin, Phone, Mail, Award, Calendar, 
  CreditCard, Wallet, Star, Gift, Tag, Paperclip, MessageSquare, 
  Plus, X, Trash2, Heart, AlertCircle, FileText, CheckCircle2, 
  Send, UserCheck, PlusCircle, Check, Sparkles, Clock, Edit2, 
  ArrowRightLeft, ArrowUpRight, ArrowUpDown, ChevronLeft, ChevronRight,
  Download, Filter, AlertTriangle, RefreshCw, Eye, ShoppingBag, Package
} from 'lucide-react';
import { Language, QuickLaunchRequest } from '../types';
import { useTenantAuth } from '../contexts/TenantAuthContext';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';

interface CustomersWorkspaceProps {
  lang: Language;
  initialSubTab?: CustomerTab;
  quickLaunchRequest?: QuickLaunchRequest | null;
}

type CustomerTab =
  | 'overview'
  | 'history'
  | 'appointments'
  | 'transactions'
  | 'wallet'
  | 'loyalty'
  | 'reviews'
  | 'notes'
  | 'tags'
  | 'documents';

interface CommunicationLog {
  id: string;
  date: string;
  type: 'sms' | 'whatsapp' | 'email';
  sender: string;
  textEn: string;
  textAr: string;
}

interface CustomerProfileData {
  id: string;
  name: string;
  nameAr: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  preferredLanguage?: string;
  email: string;
  phone: string;
  isWalkIn: boolean;
  customerType: 'walk_in' | 'service_only' | 'product_only' | 'both';
  birthdate: string;
  memberSince: string;
  assignedStylist: string;
  assignedStylistAr: string;
  visitsCount: number;
  noShowsCount: number;
  lastVisit: string;
  nextVisit: string;
  spentServices: number;
  spentProducts: number;
  avgTicket: number;
  unpaidBalance: number;
  prefDrink: string;
  prefDrinkAr: string;
  prefTemp: string;
  prefTempAr: string;
  prefChat: string;
  prefChatAr: string;
  allergies: string;
  allergiesAr: string;
  favServices: string[];
  favServicesAr: string[];
  favoriteProducts?: Array<{name: string, count: number}>;
  totalOrders?: number;
  totalProductsPurchased?: number;
  totalSpent?: number;
  communication: CommunicationLog[];
  appointments: Array<{
    id: string;
    service: string;
    serviceAr: string;
    stylist: string;
    stylistAr: string;
    date: string;
    time: string;
    price: number;
    status: 'completed' | 'confirmed' | 'cancelled' | 'no-show';
  }>;
  transactions: Array<{
    id: string;
    date: string;
    type: string;
    typeAr: string;
    amount: number;
    method: string;
    methodAr: string;
    status: 'paid' | 'pending' | 'refunded';
  }>;
  walletBalance: number;
  walletCashback: number;
  loyaltyPoints: number;
  loyaltyTier: 'VIP Royal' | 'Gold Star' | 'Silver Star' | 'First-Timer';
  reviews: Array<{
    id: string;
    date: string;
    service: string;
    serviceAr: string;
    rating: number;
    comment: string;
    commentAr: string;
  }>;
  notes: string[];
  tags: string[];
  documents: Array<{
    id: string;
    name: string;
    date: string;
    size: string;
    type: string;
  }>;
}

interface CustomerStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
  returningRate: number;
  avgBookings: number;
}

export default function CustomersWorkspace({ lang, initialSubTab = 'history', quickLaunchRequest }: CustomersWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { hasPermission } = useTenantAuth();
  const hasViewCustomersPermission = hasPermission('view_customers');

  // -------------------------------------------------------------
  // 1. ROUTING & INSPECTION SYNCHRONIZATION
  // -------------------------------------------------------------
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const handleUrlSync = () => {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/customers/')) {
        const remaining = path.replace('/dashboard/customers/', '');
        const segments = remaining.split('/');
        const id = segments[0];
        if (id && id !== 'customers') {
          setSelectedCustomerId(id);
          if (segments[1] === 'wallet') {
            setActiveSubTab('wallet');
          }
          return;
        }
      }
      setSelectedCustomerId(null);
    };

    handleUrlSync();
    window.addEventListener('popstate', handleUrlSync);
    return () => window.removeEventListener('popstate', handleUrlSync);
  }, []);

  const selectCustomerForInspection = (id: string) => {
    setSelectedCustomerId(id);
    window.history.pushState(null, '', `/dashboard/customers/${id}`);
  };

  const closeInspection = () => {
    setSelectedCustomerId(null);
    window.history.pushState(null, '', '/dashboard/customers');
  };

  // -------------------------------------------------------------
  // 2. MAIN CRM DIRECTORY STATE & FILTERS & SIMULATOR
  // -------------------------------------------------------------
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);

  const [customersList, setCustomersList] = useState<any[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const customerSearchRef = useRef<HTMLInputElement>(null);
  const [loyaltyTierFilter, setLoyaltyTierFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('lastVisit');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new query
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (quickLaunchRequest?.target !== 'customer') {
      return;
    }

    setSelectedCustomerId(null);
    setSearchQuery('');
    setDebouncedSearch('');
    setLoyaltyTierFilter('all');
    setCustomerTypeFilter('all');
    setSortBy('lastVisit');
    setSortOrder('desc');
    setPage(1);
    setActiveSubTab(initialSubTab);
    const timer = window.setTimeout(() => {
      customerSearchRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [quickLaunchRequest?.nonce, initialSubTab]);

  const parseApiResponse = (payload: any) => {
    if (!payload) return null;
    if (payload.success === false && payload.error) return null;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    return payload;
  };

  const getCustomerTypeBadge = (customerType?: string) => {
    switch (customerType) {
      case 'both':
        return { label: isRtl ? 'خدمات ومنتجات' : 'Both', classes: 'bg-zinc-100 text-zinc-800', icon: '📅🛍️' };
      case 'service_only':
        return { label: isRtl ? 'خدمات' : 'Service', classes: 'bg-indigo-50 text-indigo-700', icon: '📅' };
      case 'product_only':
        return { label: isRtl ? 'منتجات' : 'Products', classes: 'bg-rose-50 text-rose-700', icon: '🛍️' };
      case 'walk_in':
        return { label: isRtl ? 'عميل حضوري' : 'Walk-in', classes: 'bg-amber-100 text-amber-800', icon: '🚶' };
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Load KPI Stats
  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      if (!hasViewCustomersPermission) {
        setIsPermissionDenied(true);
        return;
      }
      const data = await tenantApiAdapter.getCustomerStats();
      setStats(data || null);
      setIsPermissionDenied(false);
    } catch (err) {
      console.error("Error loading stats:", err);
      if ((err as any)?.status === 403) {
        setIsPermissionDenied(true);
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Load Main Listing
  const loadCustomersList = async () => {
    try {
      if (!hasViewCustomersPermission) {
        setIsPermissionDenied(true);
        return;
      }
      setIsLoadingList(true);
      setIsError(false);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (loyaltyTierFilter && loyaltyTierFilter !== 'all') params.append('loyaltyTier', loyaltyTierFilter);
      if (customerTypeFilter && customerTypeFilter !== 'all') params.append('customerType', customerTypeFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder.toUpperCase());
      params.append('page', String(page));
      params.append('limit', '20');
      const data = await tenantApiAdapter.getCustomers(Object.fromEntries(params.entries()) as Record<string, string>);
      const customers = Array.isArray(data.customers) ? data.customers : [];
      const pagination = (data.pagination || {}) as { total?: number; totalPages?: number };
      setCustomersList(customers);
      setTotalPages(typeof pagination.totalPages === 'number' ? pagination.totalPages : 1);
      setTotalRecords(typeof pagination.total === 'number' ? pagination.total : customers.length);
      setIsPermissionDenied(false);
    } catch (err) {
      console.error("Error loading customers:", err);
      if ((err as any)?.status === 403) {
        setIsPermissionDenied(true);
      }
      setIsError(true);
      setCustomersList([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [hasViewCustomersPermission]);

  useEffect(() => {
    loadCustomersList();
  }, [debouncedSearch, loyaltyTierFilter, customerTypeFilter, sortBy, sortOrder, page, hasViewCustomersPermission]);

  // Handle Export Programmatically
  const handleCSVExport = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
      if (loyaltyTierFilter && loyaltyTierFilter !== 'all') params.append('loyaltyTier', loyaltyTierFilter);
      if (customerTypeFilter && customerTypeFilter !== 'all') params.append('customerType', customerTypeFilter);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder.toUpperCase());
      const res = await tenantApiAdapter.exportCustomers(Object.fromEntries(params.entries()) as Record<string, string>);
      if (res.status === 403) {
        setIsPermissionDenied(true);
        return;
      }
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Data exported successfully", "تم تصدير البيانات بنجاح إلى ملف excel CSV", "success");
      setIsPermissionDenied(false);
    } catch (err) {
      console.error(err);
      showToast("Export failed", "فشل تصدير البيانات", "info");
    } finally {
      setIsExporting(false);
    }
  };

  // -------------------------------------------------------------
  // 3. INSPECTED CUSTOMER DETAIL STATE & HANDLERS
  // -------------------------------------------------------------
  const [inspectedCustomer, setInspectedCustomer] = useState<CustomerProfileData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isErrorDetail, setIsErrorDetail] = useState(false);

  // Inline Editable Profile Form States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('Female');
  const [editBirthdate, setEditBirthdate] = useState('1995-04-12');
  const [editPreferredLanguage, setEditPreferredLanguage] = useState('ar');
  
  // Inspected Subtab State
  const [activeSubTab, setActiveSubTab] = useState<CustomerTab>(initialSubTab);
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletAction, setWalletAction] = useState<'add' | 'deduct'>('add');
  const [loyaltyAmount, setLoyaltyAmount] = useState('');
  const [loyaltyAction, setLoyaltyAction] = useState<'add' | 'deduct'>('add');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Customer Complete History Workspace states
  const [historyType, setHistoryType] = useState<'all' | 'appointments' | 'purchases'>('all');
  const [historyStatus, setHistoryStatus] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyLimit, setHistoryLimit] = useState<number>(50);

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyMetrics, setHistoryMetrics] = useState<any>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isErrorHistory, setIsErrorHistory] = useState(false);

  // History detail viewer modal (persisted purchase/order data only)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const selectedOrderItems = Array.isArray(selectedOrderDetails?.details?.items)
    ? selectedOrderDetails.details.items.filter(Boolean)
    : [];

  const loadCustomerHistory = async () => {
    if (!selectedCustomerId) return;
    try {
      setIsLoadingHistory(true);
      setIsErrorHistory(false);
      const data = await tenantApiAdapter.getCustomerHistory(selectedCustomerId, {
        type: historyType,
        status: historyStatus,
        startDate: historyStartDate,
        endDate: historyEndDate,
        limit: historyLimit
      });
      setHistoryData(data.history || []);
      setHistoryMetrics(data.summary || data.metrics || null);
      setIsPermissionDenied(false);
    } catch (err) {
      console.error(err);
      if ((err as any)?.status === 403) {
        setIsPermissionDenied(true);
      }
      setIsErrorHistory(true);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'history' && selectedCustomerId) {
      loadCustomerHistory();
    }
  }, [selectedCustomerId, activeSubTab, historyType, historyStatus, historyStartDate, historyEndDate, historyLimit, hasViewCustomersPermission]);

  // Wallet Workspace States
  const [walletHistoryData, setWalletHistoryData] = useState<any | null>(null);
  const [isLoadingWalletHistory, setIsLoadingWalletHistory] = useState(false);
  const [isErrorWalletHistory, setIsErrorWalletHistory] = useState(false);

  const loadWalletHistory = async () => {
    if (!selectedCustomerId) return;
    try {
      setIsLoadingWalletHistory(true);
      setIsErrorWalletHistory(false);
      const data = await tenantApiAdapter.getCustomer(selectedCustomerId, { walletHistory: 'full' });
      setWalletHistoryData(data);
      setIsPermissionDenied(false);
    } catch (err) {
      console.error("Error loading wallet history:", err);
      if ((err as any)?.status === 403) {
        setIsPermissionDenied(true);
      }
      setIsErrorWalletHistory(true);
    } finally {
      setIsLoadingWalletHistory(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'wallet' && selectedCustomerId) {
      loadWalletHistory();
    }
  }, [selectedCustomerId, activeSubTab, hasViewCustomersPermission]);

  // Sync activeSubTab 'wallet' to URL
  useEffect(() => {
    if (selectedCustomerId) {
      if (activeSubTab === 'wallet') {
        const newPath = `/dashboard/customers/${selectedCustomerId}/wallet`;
        if (window.location.pathname !== newPath) {
          window.history.pushState(null, '', newPath);
        }
      } else {
        const newPath = `/dashboard/customers/${selectedCustomerId}`;
        if (window.location.pathname !== newPath && window.location.pathname.endsWith('/wallet')) {
          window.history.pushState(null, '', newPath);
        }
      }
    }
  }, [selectedCustomerId, activeSubTab]);

  // Load Inspected Customer Details
  useEffect(() => {
    if (!selectedCustomerId) {
      setInspectedCustomer(null);
      return;
    }

    const loadDetail = async () => {
      try {
        setIsLoadingDetail(true);
        setIsErrorDetail(false);
        const profile = await tenantApiAdapter.getCustomer(selectedCustomerId, { walletHistory: 'full' });
        setInspectedCustomer(profile as CustomerProfileData);
        setIsPermissionDenied(false);
        
        // Prefill form states on load
        setEditFirstName(profile.firstName || '');
        setEditLastName(profile.lastName || '');
        setEditEmail(profile.email || '');
        setEditPhone(profile.phone || '');
        setEditGender(profile.gender || 'Female');
        setEditBirthdate(profile.birthdate || '');
        setEditPreferredLanguage(profile.preferredLanguage || 'ar');
      } catch (err) {
        console.error(err);
        if ((err as any)?.status === 403) {
          setIsPermissionDenied(true);
        }
        setIsErrorDetail(true);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    loadDetail();
  }, [selectedCustomerId, hasViewCustomersPermission]);

  // Persistent Notes and Tags Saver
  const saveNotesAndTags = async (newNotes: string[], newTags: string[]) => {
    if (!inspectedCustomer) return;
    try {
      const updated = await tenantApiAdapter.updateCustomerNotes(inspectedCustomer.id, {
        notes: newNotes,
        tags: newTags
      });
      setInspectedCustomer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          notes: updated.notes || [],
          tags: updated.tags || []
        };
      });
      loadCustomersList(); // Refresh main list too
      setIsPermissionDenied(false);
    } catch (err: any) {
      console.error(err);
      showToast("Sync Error", "فشل في حفظ الملاحظات والوسوم مع الخادم", "info");
    }
  };

  // Profile Save handler with collision validation
  const handleSaveProfile = async () => {
    if (!inspectedCustomer) return;
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim() || !editPhone.trim()) {
      showToast("Validation Error", "يرجى تعبئة جميع الحقول المطلوبة", "info");
      return;
    }

    try {
      setIsLoadingDetail(true);
      const updated = await tenantApiAdapter.updateCustomerProfile(inspectedCustomer.id, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        gender: editGender,
        birthdate: editBirthdate,
        preferredLanguage: editPreferredLanguage
      });
      setInspectedCustomer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...updated,
          name: updated.name || `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
          firstName: updated.firstName || '',
          lastName: updated.lastName || '',
          email: updated.email || '',
          phone: updated.phone || '',
          gender: updated.gender || '',
          birthdate: updated.birthdate || '',
          preferredLanguage: updated.preferredLanguage || 'ar'
        };
      });

      loadCustomersList(); // Refresh CRM index list
      setIsEditingProfile(false);
      setIsPermissionDenied(false);
      showToast("Profile saved successfully", "تم حفظ وتحديث بيانات العميل بنجاح", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Save failed", "خطأ أثناء الحفظ: البريد أو الهاتف قيد الاستخدام", "info");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Note Append
  const handleAddNote = () => {
    if (!newNote.trim() || !inspectedCustomer) return;
    const updatedNotes = [...inspectedCustomer.notes, newNote.trim()];
    setInspectedCustomer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notes: updatedNotes
      };
    });
    setNewNote('');
    saveNotesAndTags(updatedNotes, inspectedCustomer.tags);
    showToast("Note added successfully", "تمت إضافة الملاحظة الداخلية بنجاح للملف الشخصي", "success");
  };

  // Note Delete
  const handleRemoveNote = (idx: number) => {
    if (!inspectedCustomer) return;
    const updatedNotes = inspectedCustomer.notes.filter((_, i) => i !== idx);
    setInspectedCustomer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        notes: updatedNotes
      };
    });
    saveNotesAndTags(updatedNotes, inspectedCustomer.tags);
    showToast("Note deleted successfully", "تم حذف الملاحظة بنجاح", "info");
  };

  // Tag Append
  const handleAddTag = () => {
    if (!newTag.trim() || !inspectedCustomer) return;
    const cleanTag = newTag.trim();
    if (inspectedCustomer.tags.includes(cleanTag)) {
      setNewTag('');
      return;
    }
    const updatedTags = [...inspectedCustomer.tags, cleanTag];
    setInspectedCustomer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tags: updatedTags
      };
    });
    setNewTag('');
    saveNotesAndTags(inspectedCustomer.notes, updatedTags);
    showToast(`Tag "${cleanTag}" linked`, `تم ربط الوسم "${cleanTag}" بالملف الشخصي`, "success");
  };

  // Tag Remove
  const handleRemoveTag = (tagToRemove: string) => {
    if (!inspectedCustomer) return;
    const updatedTags = inspectedCustomer.tags.filter(t => t !== tagToRemove);
    setInspectedCustomer(prev => {
      if (!prev) return null;
      return {
        ...prev,
        tags: updatedTags
      };
    });
    saveNotesAndTags(inspectedCustomer.notes, updatedTags);
    showToast("Tag unlinked", "تم إلغاء ربط الوسم بنجاح", "info");
  };

  // Wallet Adjust
  const handleWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(walletAmount);
    if (isNaN(val) || val <= 0 || !inspectedCustomer) {
      showToast("Invalid adjustment value", "يرجى كتابة قيمة مالية صحيحة", "info");
      return;
    }

    const change = walletAction === 'add' ? val : -val;
    if (walletAction === 'deduct' && inspectedCustomer.walletBalance < val) {
      showToast("Insufficient wallet funds", "رصيد المحفظة غير كافٍ لإتمام عملية الخصم", "info");
      return;
    }

    setInspectedCustomer(prev => {
      if (!prev) return null;
      const updatedTx = [
        {
          id: `tx-new-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          type: walletAction === 'add' ? 'Manual Wallet Deposit' : 'Manual Wallet Withdrawal',
          typeAr: walletAction === 'add' ? 'إيداع يدوي في المحفظة' : 'سحب يدوي من المحفظة',
          amount: change,
          method: 'System Adjustment',
          methodAr: 'إجراء فني من لوحة التحكم',
          status: 'paid' as const
        },
        ...prev.transactions
      ];

      return {
        ...prev,
        walletBalance: prev.walletBalance + change,
        transactions: updatedTx
      };
    });

    setWalletAmount('');
    showToast(`Wallet adjusted by ${change >= 0 ? '+' : ''}${change} SAR`, `تم تعديل رصيد المحفظة بمقدار ${change} ر.س.`, "success");
  };

  // Loyalty Adjust
  const handleLoyaltySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(loyaltyAmount, 10);
    if (isNaN(pts) || pts <= 0 || !inspectedCustomer) {
      showToast("Invalid points value", "يرجى إدخال عدد نقاط صحيح", "info");
      return;
    }

    const change = loyaltyAction === 'add' ? pts : -pts;
    setInspectedCustomer(prev => {
      if (!prev) return null;
      const finalPoints = Math.max(0, prev.loyaltyPoints + change);
      
      let finalTier = prev.loyaltyTier;
      if (finalPoints >= 3000) finalTier = 'VIP Royal';
      else if (finalPoints >= 1000) finalTier = 'Gold Star';
      else if (finalPoints >= 300) finalTier = 'Silver Star';
      else finalTier = 'First-Timer';

      return {
        ...prev,
        loyaltyPoints: finalPoints,
        loyaltyTier: finalTier
      };
    });

    setLoyaltyAmount('');
    showToast(`Loyalty adjusted by ${change >= 0 ? '+' : ''}${change} pts`, `تم تعديل نقاط الولاء للعميل بمقدار ${change} نقطة`, "success");
  };

  // Document upload simulation
  const handleDocUpload = () => {
    setIsUploadingDoc(true);
    setTimeout(() => {
      setIsUploadingDoc(false);
      if (!inspectedCustomer) return;
      const newDocObj = {
        id: `doc-${Date.now()}`,
        name: `Scalp_Follicle_Scan_${new Date().toISOString().split('T')[0]}.pdf`,
        date: new Date().toISOString().split('T')[0],
        size: '1.4 MB',
        type: 'PDF'
      };
      setInspectedCustomer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          documents: [newDocObj, ...prev.documents]
        };
      });
      showToast("Consultation report uploaded securely", "تم رفع تقرير فحص بصيلات الشعر والاستشارة الطبية بأمان للملف الشخصي", "success");
    }, 1200);
  };

  // -------------------------------------------------------------
  // 4. TOAST STATE
  // -------------------------------------------------------------
  const [toast, setToast] = useState<{ show: boolean; msgEn: string; msgAr: string; type: 'success' | 'info' }>({
    show: false,
    msgEn: '',
    msgAr: '',
    type: 'success'
  });

  const showToast = (en: string, ar: string, type: 'success' | 'info' = 'success') => {
    setToast({ show: true, msgEn: en, msgAr: ar, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  if (isPermissionDenied) {
    return (
      <div className="min-h-screen bg-neutral-50/40 p-4 sm:p-6 lg:p-8 font-sans flex flex-col items-center justify-center" id="refah-customers-module">
        {/* Toast notifications inside fallback view */}
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl border text-xs font-black select-none bg-white border-neutral-100 text-neutral-800"
            >
              <AlertCircle size={15} className="text-zinc-500" />
              <span>{isRtl ? toast.msgAr : toast.msgEn}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-neutral-100 rounded-3xl p-8 text-center shadow-lg"
        >
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-500">
            <Shield size={32} className="stroke-[2.5]" />
          </div>

          <h2 className="text-xl font-extrabold text-neutral-800 tracking-tight mb-2">
            {isRtl ? 'تم تقييد الوصول للملفات' : 'Corporate Security Access Restrained'}
          </h2>
          <p className="text-neutral-400 text-xs font-mono mb-6 uppercase tracking-wider">
            Required Permission: view_customers
          </p>

          <div className="bg-neutral-50 rounded-2xl p-4 text-left space-y-3 mb-6">
            <p className="text-neutral-600 text-xs leading-relaxed">
              <strong>English:</strong> Viewing the corporate customer directories, financial wallet records, or appointment history ledger requires the <code>view_customers</code> permission token. Please check your staff privileges matrix.
            </p>
            <div className="border-t border-neutral-200/50 my-2"></div>
            <p className="text-neutral-600 text-xs leading-relaxed text-right" dir="rtl">
              <strong>العربية:</strong> إن استعراض سجلات العملاء، محافظهم المالية، أو كشوف حركة حجوزاتهم يتطلب صلاحية <code>view_customers</code> الأمنية النشطة. يرجى مراجعة مصفوفة صلاحيات فريق العمل.
            </p>
          </div>

          <div className="space-y-3">
            <div className={`w-full px-4 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm ${
              hasViewCustomersPermission ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
            }`}>
              <Check size={14} className={hasViewCustomersPermission ? 'text-emerald-500' : 'text-rose-500'} />
              <span>
                {hasViewCustomersPermission
                  ? (isRtl ? 'صلاحية العرض مفعلة' : 'Live permission enabled')
                  : (isRtl ? 'صلاحية العرض غير مفعلة' : 'Live permission disabled')}
              </span>
            </div>
            
            {selectedCustomerId && (
              <button
                onClick={closeInspection}
                className="w-full bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                <span>{isRtl ? 'العودة لكتالوج العملاء' : 'Back to general catalog'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/40 p-4 sm:p-6 lg:p-8 font-sans" id="refah-customers-module">
      
      {/* Dynamic Notifications */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl border text-xs font-black select-none ${
              toast.type === 'success' 
                ? 'bg-zinc-900 border-zinc-800 text-amber-400' 
                : 'bg-white border-neutral-100 text-neutral-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={15} className="text-amber-500" /> : <AlertCircle size={15} className="text-zinc-500" />}
            <span>{isRtl ? toast.msgAr : toast.msgEn}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedCustomerId === null ? (
          // =========================================================
          // VIEW A: GENERAL BROWSE-AND-INSPECT DIRECTORY
          // =========================================================
          <motion.div
            key="directory-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header section with interactive permission control and Export Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-100 pb-5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-amber-400">
                  <Users size={18} />
                </div>
                <div>
                  <h1 className="text-lg font-black text-neutral-900 tracking-tight">
                    {isRtl ? 'إدارة قاعدة بيانات العملاء' : 'Customer CRM Directory'}
                  </h1>
                  <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest mt-0.5">
                    {isRtl ? 'عرض كبار الملاك والملفات الشخصية والأمن المالي' : 'Inspect client profiles, financial health and loyalty logs'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Permission Simulator Badge */}
                <div className="flex items-center gap-2 bg-neutral-100/80 border border-neutral-200/60 rounded-xl px-3 py-2 text-xs">
                  <Shield size={14} className={hasViewCustomersPermission ? "text-emerald-500 animate-pulse" : "text-rose-500"} />
                  <span className="font-extrabold text-[10px] text-neutral-500 uppercase tracking-wider">
                    {isRtl ? 'صلاحية العرض' : 'view_customers'}:
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                      hasViewCustomersPermission
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {hasViewCustomersPermission ? (isRtl ? 'نشط' : 'Approved') : (isRtl ? 'ملغى' : 'Revoked')}
                  </span>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleCSVExport}
                  disabled={isExporting || isLoadingList}
                  className="bg-white border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isExporting ? (
                    <RefreshCw size={14} className="animate-spin text-amber-500" />
                  ) : (
                    <Download size={14} className="text-amber-500" />
                  )}
                  <span>{isRtl ? 'تصدير البيانات CSV' : 'Export current dataset'}</span>
                </button>
              </div>
            </div>

            {/* KPI Cards section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Total Customers */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-xs relative overflow-hidden flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                  <Users size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-neutral-400 font-mono font-black uppercase tracking-wider">{isRtl ? 'إجمالي العملاء' : 'Total Customers'}</p>
                  {isLoadingStats ? (
                    <div className="h-6 w-16 bg-neutral-100 animate-pulse rounded-md mt-1" />
                  ) : (
                    <p className="text-xl font-black text-neutral-900 mt-0.5">{stats?.totalCustomers || 0}</p>
                  )}
                </div>
                <div className="absolute right-3 bottom-3 opacity-5 text-neutral-900">
                  <Users size={48} />
                </div>
              </div>

              {/* KPI 2: New Customers This Month */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-xs relative overflow-hidden flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0">
                  <UserCheck size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-neutral-400 font-mono font-black uppercase tracking-wider">{isRtl ? 'عملاء جدد هذا الشهر' : 'New Clients (June)'}</p>
                  {isLoadingStats ? (
                    <div className="h-6 w-16 bg-neutral-100 animate-pulse rounded-md mt-1" />
                  ) : (
                    <p className="text-xl font-black text-neutral-900 mt-0.5">{stats?.newCustomersThisMonth || 0}</p>
                  )}
                </div>
                <div className="absolute right-3 bottom-3 opacity-5 text-neutral-900">
                  <UserCheck size={48} />
                </div>
              </div>

              {/* KPI 3: Returning Rate */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-xs relative overflow-hidden flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                  <Award size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-neutral-400 font-mono font-black uppercase tracking-wider">{isRtl ? 'معدل العودة والولاء' : 'Returning Rate'}</p>
                  {isLoadingStats ? (
                    <div className="h-6 w-16 bg-neutral-100 animate-pulse rounded-md mt-1" />
                  ) : (
                    <p className="text-xl font-black text-neutral-900 mt-0.5">{stats?.returningRate || 0}%</p>
                  )}
                </div>
                <div className="absolute right-3 bottom-3 opacity-5 text-neutral-900">
                  <Award size={48} />
                </div>
              </div>

              {/* KPI 4: Avg Bookings per Customer */}
              <div className="bg-white border border-neutral-100 rounded-2xl p-5 shadow-xs relative overflow-hidden flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-neutral-400 font-mono font-black uppercase tracking-wider">{isRtl ? 'متوسط الحجوزات لكل عميل' : 'Avg Bookings / Client'}</p>
                  {isLoadingStats ? (
                    <div className="h-6 w-16 bg-neutral-100 animate-pulse rounded-md mt-1" />
                  ) : (
                    <p className="text-xl font-black text-neutral-900 mt-0.5">{stats?.avgBookings || 0}</p>
                  )}
                </div>
                <div className="absolute right-3 bottom-3 opacity-5 text-neutral-900">
                  <Calendar size={48} />
                </div>
              </div>
            </div>

            {/* Filters and search section */}
            <div className="bg-white border border-neutral-100 rounded-2xl p-4 shadow-xs flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              
              {/* Search Bar with Debounce */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute top-1/2 -translate-y-1/2 mx-3.5 text-neutral-400" size={16} />
                <input
                  ref={customerSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'ابحث باسم العميل، بريده أو هاتفه...' : 'Search by client name, email, phone...'}
                  className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl pl-10 pr-10 py-2.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 transition-all font-medium"
                />
              </div>

              {/* Advanced Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Loyalty Tier dropdown */}
                <div className="flex items-center gap-1.5">
                  <Filter size={13} className="text-neutral-400 shrink-0" />
                  <select
                    value={loyaltyTierFilter}
                    onChange={(e) => { setLoyaltyTierFilter(e.target.value); setPage(1); }}
                    className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="all">{isRtl ? 'جميع فئات الولاء' : 'All Loyalty Tiers'}</option>
                    <option value="VIP Royal">{isRtl ? 'رويال VIP' : 'VIP Royal'}</option>
                    <option value="Gold Star">{isRtl ? 'نجمة ذهبية' : 'Gold Star'}</option>
                    <option value="Silver Star">{isRtl ? 'نجمة فضية' : 'Silver Star'}</option>
                    <option value="First-Timer">{isRtl ? 'عميل جديد' : 'First-Timer'}</option>
                  </select>
                </div>

                {/* Customer Type dropdown */}
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-neutral-400 shrink-0" />
                  <select
                    value={customerTypeFilter}
                    onChange={(e) => { setCustomerTypeFilter(e.target.value); setPage(1); }}
                    className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="all">{isRtl ? 'جميع أنواع العملاء' : 'All Customer Types'}</option>
                    <option value="walk_in">{isRtl ? 'عميل عابر (Walk-In)' : 'Walk-In'}</option>
                    <option value="service_only">{isRtl ? 'خدمات فقط' : 'Service Only'}</option>
                    <option value="product_only">{isRtl ? 'منتجات فقط' : 'Product Only'}</option>
                    <option value="both">{isRtl ? 'خدمات ومنتجات' : 'Both (Service & Product)'}</option>
                  </select>
                </div>

                {/* Sort dropdown */}
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown size={13} className="text-neutral-400 shrink-0" />
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                    className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-700 outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="name">{isRtl ? 'ترتيب بالاسم' : 'Sort by Name'}</option>
                    <option value="totalBookings">{isRtl ? 'ترتيب بعدد الحجوزات' : 'Sort by Bookings'}</option>
                    <option value="totalSpent">{isRtl ? 'ترتيب بالإنفاق الإجمالي' : 'Sort by Total Spent'}</option>
                    <option value="lastVisit">{isRtl ? 'ترتيب بآخر زيارة' : 'Sort by Last Visit'}</option>
                    <option value="memberSince">{isRtl ? 'ترتيب بتاريخ الانضمام' : 'Sort by Joined Date'}</option>
                  </select>
                </div>

                {/* Sort Order Toggle */}
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-neutral-200 hover:bg-neutral-50 rounded-xl text-neutral-600 transition-all cursor-pointer"
                  title={isRtl ? 'عكس اتجاه الترتيب' : 'Toggle sort order'}
                >
                  <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180 transition-all' : 'transition-all'} />
                </button>
              </div>
            </div>

            {/* Customers table view */}
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-100 font-mono text-neutral-400 uppercase tracking-tight font-black text-[10px]">
                      <th className="px-5 py-3 text-start">{isRtl ? 'العميل' : 'Customer'}</th>
                      <th className="px-4 py-3 text-start">{isRtl ? 'النوع' : 'Type'}</th>
                      <th className="px-4 py-3 text-start">{isRtl ? 'البريد الإلكتروني' : 'Email'}</th>
                      <th className="px-4 py-3 text-start">{isRtl ? 'رقم الهاتف' : 'Phone'}</th>
                      <th className="px-4 py-3 text-center">{isRtl ? 'الحجوزات' : 'Bookings'}</th>
                      <th className="px-4 py-3 text-center text-rose-500">{isRtl ? 'عدم الحضور' : 'No-Show'}</th>
                      <th className="px-4 py-3 text-center">{isRtl ? 'الطلبات' : 'Orders'}</th>
                      <th className="px-4 py-3 text-center">{isRtl ? 'المنتجات' : 'Products'}</th>
                      <th className="px-4 py-3 text-end">{isRtl ? 'إجمالي الإنفاق' : 'Total Spent'}</th>
                      <th className="px-4 py-3 text-center">{isRtl ? 'فئة الولاء' : 'Loyalty Tier'}</th>
                      <th className="px-4 py-3 text-start">{isRtl ? 'آخر زيارة' : 'Last Visit'}</th>
                      <th className="px-5 py-3 text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {isLoadingList ? (
                      // Skeleton loader rows
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="animate-pulse">
                          <td className="px-5 py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-neutral-100" />
                            <div className="space-y-1">
                              <div className="h-3 w-28 bg-neutral-100 rounded" />
                              <div className="h-2 w-16 bg-neutral-100 rounded" />
                            </div>
                          </td>
                          <td className="px-4 py-4"><div className="h-4 w-16 bg-neutral-100 rounded-md" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-32 bg-neutral-100 rounded" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-24 bg-neutral-100 rounded" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-8 bg-neutral-100 rounded mx-auto" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-8 bg-neutral-100 rounded mx-auto" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-8 bg-neutral-100 rounded mx-auto" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-8 bg-neutral-100 rounded mx-auto" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-16 bg-neutral-100 rounded ml-auto" /></td>
                          <td className="px-4 py-4"><div className="h-4 w-20 bg-neutral-100 rounded-md mx-auto" /></td>
                          <td className="px-4 py-4"><div className="h-3 w-20 bg-neutral-100 rounded" /></td>
                          <td className="px-5 py-4"><div className="h-6 w-16 bg-neutral-100 rounded mx-auto" /></td>
                        </tr>
                      ))
                    ) : isError ? (
                      // Error State
                      <tr>
                        <td colSpan={12} className="px-5 py-12 text-center text-rose-500">
                          <div className="flex flex-col items-center gap-2 justify-center">
                            <AlertTriangle size={32} />
                            <p className="font-extrabold">{isRtl ? 'حدث خطأ أثناء تحميل دليل العملاء.' : 'Failed to load customers catalogue.'}</p>
                            <button
                              onClick={loadCustomersList}
                              className="mt-3 bg-zinc-900 text-amber-400 px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-zinc-800 transition-all text-xs"
                            >
                              {isRtl ? 'إعادة المحاولة' : 'Retry'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : customersList.length === 0 ? (
                      // Empty State
                      <tr>
                        <td colSpan={12} className="px-5 py-16 text-center text-neutral-400">
                          <div className="flex flex-col items-center gap-3 justify-center">
                            <Users size={40} className="text-neutral-300" />
                            <p className="font-extrabold text-neutral-600">{isRtl ? 'لا يوجد عملاء يطابقون خيارات البحث.' : 'No customers matched your filter options.'}</p>
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setLoyaltyTierFilter('all');
                                setCustomerTypeFilter('all');
                                setPage(1);
                              }}
                              className="mt-2 bg-neutral-100 text-neutral-700 px-4 py-2 rounded-xl text-[11px] font-black cursor-pointer hover:bg-neutral-200 transition-all"
                            >
                              {isRtl ? 'إعادة تعيين المرشحات' : 'Clear Filter Controls'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // Populated Table rows
                      customersList.map((client) => {
                        const initials = `${client.firstName?.charAt(0) || ''}${client.lastName?.charAt(0) || ''}`;
                        const typeBadge = getCustomerTypeBadge(client.customerType);
                        return (
                          <tr 
                            key={client.id}
                            className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100 cursor-pointer group"
                            onClick={() => selectCustomerForInspection(client.id)}
                          >
                            {/* Avatar or initials + Customer name */}
                            <td className="px-5 py-3.5 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-950 text-amber-400 font-extrabold flex items-center justify-center font-mono text-[11px] border border-zinc-850 shrink-0 overflow-hidden">
                                {client.avatar ? (
                                  <img src={client.avatar} alt={`${client.firstName} ${client.lastName}`} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  <span>{initials || (client.firstName?.charAt(0) || client.lastName?.charAt(0) || '')}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-extrabold text-neutral-800 text-xs tracking-tight group-hover:text-amber-600 transition-all">
                                  {isRtl ? `${client.lastName || ''} ${client.firstName || ''}`.trim() : `${client.firstName || ''} ${client.lastName || ''}`.trim()}
                                </p>
                                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{isRtl ? 'انضم' : 'Joined'} {formatDate(client.memberSince)}</p>
                              </div>
                            </td>

                            {/* Walk-in badge + Customer Type Badge */}
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap gap-1.5">
                                {client.isWalkIn && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded-md font-bold font-mono">
                                    {isRtl ? 'عابر' : 'Walk-In'}
                                  </span>
                                )}
                                {typeBadge ? (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold font-mono ${typeBadge.classes}`}>
                                    {typeBadge.icon} {typeBadge.label}
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold font-mono bg-neutral-100 text-neutral-600">
                                    {isRtl ? 'غير محدد' : 'None'}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-4 py-3.5 font-mono text-neutral-500 text-[11px] max-w-[150px] truncate">{client.email}</td>

                            {/* Phone */}
                            <td className="px-4 py-3.5 font-mono text-neutral-500 text-[11px]">{client.phone}</td>

                            {/* Total Bookings */}
                            <td className="px-4 py-3.5 text-center font-bold font-mono">{client.totalBookings}</td>

                            {/* No-show count */}
                            <td className={`px-4 py-3.5 text-center font-mono font-bold ${client.noShowCount > 0 ? 'text-rose-500 bg-rose-50/10' : 'text-neutral-400'}`}>
                              {client.noShowCount}
                            </td>

                            {/* Total orders */}
                            <td className="px-4 py-3.5 text-center font-mono text-neutral-600">{client.totalOrders ?? 0}</td>

                            {/* Products purchased */}
                            <td className="px-4 py-3.5 text-center font-mono text-neutral-600">{client.totalProductsPurchased ?? 0}</td>

                            {/* Total spent */}
                            <td className="px-4 py-3.5 text-end font-bold font-mono text-neutral-800">
                              {Number(client.totalSpent ?? 0).toLocaleString()} ر.س
                            </td>

                            {/* Loyalty tier */}
                            <td className="px-4 py-3.5 text-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                client.loyaltyTier === 'VIP Royal' ? 'bg-amber-150 text-amber-950 border border-amber-300' :
                                client.loyaltyTier === 'Gold Star' ? 'bg-amber-50 text-amber-800 border border-amber-100' :
                                client.loyaltyTier === 'Silver Star' ? 'bg-neutral-50 text-neutral-800 border border-neutral-200' :
                                'bg-neutral-100 text-neutral-600'
                              }`}>
                                {client.loyaltyTier || (isRtl ? 'غير محدد' : 'N/A')}
                              </span>
                            </td>

                            {/* Last visit */}
                            <td className="px-4 py-3.5 font-mono text-neutral-500 text-[11px]">{formatDate(client.lastVisit)}</td>

                            {/* View / Edit Action */}
                            <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => selectCustomerForInspection(client.id)}
                                className="bg-neutral-50 hover:bg-amber-500 hover:text-white text-neutral-600 p-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 mx-auto border border-neutral-100 cursor-pointer"
                                title={isRtl ? 'عرض وتحرير الملف الشخصي' : 'Inspect Profile'}
                              >
                                <Eye size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              {!isLoadingList && customersList.length > 0 && (
                <div className="bg-neutral-50 border-t border-neutral-100 px-5 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-neutral-500">
                  <div className="text-[11px] font-mono">
                    {isRtl ? (
                      <p>عرض {(page-1)*20 + 1} - {Math.min(page*20, totalRecords)} من إجمالي {totalRecords} عميل</p>
                    ) : (
                      <p>Showing {(page-1)*20 + 1} - {Math.min(page*20, totalRecords)} of {totalRecords} customers</p>
                    )}
                  </div>

                  {/* Pagination Navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 border border-neutral-200 rounded-lg hover:bg-white text-neutral-600 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <ChevronLeft size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>

                    {/* Dynamic page numbers */}
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pNum = i + 1;
                        const isSel = page === pNum;
                        return (
                          <button
                            key={pNum}
                            onClick={() => setPage(pNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              isSel 
                                ? 'bg-zinc-900 text-amber-400' 
                                : 'hover:bg-white text-neutral-600 border border-neutral-250/20'
                            }`}
                          >
                            {pNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 border border-neutral-200 rounded-lg hover:bg-white text-neutral-600 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          // =========================================================
          // VIEW B: DETAILED CRM INSPECTION (9 SUBTABS)
          // =========================================================
          <motion.div
            key="inspection-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Back button and profile title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={closeInspection}
                  className="bg-white border border-neutral-200 hover:bg-neutral-100 p-2.5 rounded-xl text-neutral-600 transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
                </button>
                <div>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-mono font-black uppercase tracking-wider">
                    {isRtl ? 'معلومات العميل الكاملة' : 'CRM FILE CONTEXT'}
                  </span>
                  <h1 className="text-xl font-black text-neutral-900 tracking-tight mt-0.5 uppercase">
                    {isRtl ? 'بطاقة كبار الملاك' : 'Inspect VVIP Directory Details'}
                  </h1>
                </div>
              </div>

              {/* Permission Simulator Badge */}
              <div className="flex items-center gap-2 bg-neutral-100/80 border border-neutral-200/60 rounded-xl px-3 py-2 text-xs self-start sm:self-auto">
                <Shield size={14} className={hasViewCustomersPermission ? "text-emerald-500 animate-pulse" : "text-rose-500"} />
                <span className="font-extrabold text-[10px] text-neutral-500 uppercase tracking-wider">
                  {isRtl ? 'صلاحية العرض' : 'view_customers'}:
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                    hasViewCustomersPermission
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {hasViewCustomersPermission ? (isRtl ? 'نشط' : 'Approved') : (isRtl ? 'ملغى' : 'Revoked')}
                </span>
              </div>
            </div>

            {isLoadingDetail ? (
              // Big skeleton loader for full detailed dashboard
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-4 bg-white border border-neutral-100 rounded-2xl p-6 h-[400px] animate-pulse" />
                <div className="xl:col-span-8 bg-white border border-neutral-100 rounded-2xl p-6 h-[600px] animate-pulse" />
              </div>
            ) : isErrorDetail || !inspectedCustomer ? (
              // Error loading detailed VVIP file
              <div className="bg-white border border-neutral-100 rounded-2xl p-12 text-center text-rose-500 max-w-xl mx-auto shadow-sm">
                <AlertCircle size={40} className="mx-auto text-rose-500 mb-2" />
                <h2 className="text-sm font-black">{isRtl ? 'فشل تحميل مستندات العميل الشخصية' : 'Could not retrieve kbar-al-umala profile'}</h2>
                <p className="text-xs text-neutral-400 mt-1">{isRtl ? 'قد يكون معرف العميل غير صالح أو تم حذفه من قاعدة البيانات.' : 'The requested profile might be offline or non-existent.'}</p>
                <button
                  onClick={closeInspection}
                  className="mt-4 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  {isRtl ? 'العودة للدليل' : 'Return to CRM Index'}
                </button>
              </div>
            ) : (
              // Active detailed CRM Profile Screen
              <>
                {inspectedCustomer.isWalkIn && (
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div className="text-xs">
                      <p className="font-bold">{isRtl ? 'تنبيه: هذا العميل عابر (Walk-In)' : 'Notice: Walk-In Customer Profile'}</p>
                      <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                        {isRtl 
                          ? 'هذا العميل مسجل كعميل عابر بدون حجز مسبق مؤكد. قد لا تتوفر بعض إحصائيات الولاء أو التفضيلات الكاملة.'
                          : 'This client is registered as a walk-in without a formal appointment booking. Some loyalty metrics or advanced preference features may be limited.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* ------------------------------------------------------------- */}
                {/* COLUMN 1: CLIENT CARD & SUMMARY STATS */}
                {/* ------------------------------------------------------------- */}
                {/* LEFT COLUMN: Profile Card, Notes & Tags Card, Wallet Summary Card */}
                <div className="xl:col-span-5 space-y-6">
                  
                  {/* A. Customer Profile Card */}
                  <div className="bg-white rounded-2xl border border-neutral-150/70 p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5">
                        <Users size={15} className="text-amber-500" />
                        {isRtl ? 'ملف العميل التعريفي' : 'Customer Profile'}
                      </h3>
                      <button
                        onClick={() => {
                          setIsEditingProfile(!isEditingProfile);
                        }}
                        className="text-neutral-500 hover:text-zinc-950 p-1.5 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {isEditingProfile ? (
                          <>
                            <X size={13} />
                            <span>{isRtl ? 'إلغاء' : 'Cancel'}</span>
                          </>
                        ) : (
                          <>
                            <Edit2 size={13} />
                            <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {isEditingProfile ? (
                      <div className="space-y-3.5 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'الاسم الأول' : 'First Name'}</label>
                            <input
                              type="text"
                              value={editFirstName}
                              onChange={(e) => setEditFirstName(e.target.value)}
                              className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'الاسم الأخير' : 'Last Name'}</label>
                            <input
                              type="text"
                              value={editLastName}
                              onChange={(e) => setEditLastName(e.target.value)}
                              className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'البريد الإلكتروني' : 'Email Address'}</label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'رقم الجوال' : 'Phone Number'}</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'الجنس' : 'Gender'}</label>
                            <select
                              value={editGender}
                              onChange={(e) => setEditGender(e.target.value)}
                              className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                            >
                              <option value="Female">{isRtl ? 'أنثى' : 'Female'}</option>
                              <option value="Male">{isRtl ? 'ذكر' : 'Male'}</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                            <input
                              type="date"
                              value={editBirthdate}
                              onChange={(e) => setEditBirthdate(e.target.value)}
                              className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'اللغة المفضلة' : 'Preferred Language'}</label>
                          <select
                            value={editPreferredLanguage}
                            onChange={(e) => setEditPreferredLanguage(e.target.value)}
                            className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none"
                          >
                            <option value="ar">{isRtl ? 'العربية' : 'Arabic'}</option>
                            <option value="en">{isRtl ? 'English' : 'English'}</option>
                          </select>
                        </div>

                        <button
                          onClick={handleSaveProfile}
                          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-black py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-xs mt-4"
                        >
                          <Check size={14} className="text-amber-400" />
                          <span>{isRtl ? 'حفظ وتحديث الملف الشخصي' : 'Save Changes'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5 text-xs text-neutral-700">
                        <div className="flex items-center gap-4 py-2 border-b border-neutral-50">
                          <div className="w-10 h-10 rounded-full bg-zinc-950 text-amber-400 font-black text-sm flex items-center justify-center font-mono shrink-0">
                            {inspectedCustomer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-extrabold text-neutral-900 text-sm">{isRtl ? inspectedCustomer.nameAr : inspectedCustomer.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">ID: {inspectedCustomer.id}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'البريد الإلكتروني' : 'Email'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5 truncate">{inspectedCustomer.email}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'رقم الهاتف' : 'Phone'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5">{inspectedCustomer.phone}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'الجنس' : 'Gender'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5">{isRtl ? (inspectedCustomer.gender === 'Male' ? 'ذكر' : 'أنثى') : (inspectedCustomer.gender || 'Female')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'تاريخ الميلاد' : 'Date of Birth'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5 font-mono">{inspectedCustomer.birthdate}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'اللغة المفضلة' : 'Language'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5">{inspectedCustomer.preferredLanguage === 'ar' ? (isRtl ? 'العربية' : 'Arabic') : (isRtl ? 'English' : 'English')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'عضو منذ' : 'Member Since'}</p>
                            <p className="font-semibold text-neutral-800 mt-0.5 font-mono">{inspectedCustomer.memberSince}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* B. Notes and Tags Card */}
                  <div className="bg-white rounded-2xl border border-neutral-150/70 p-5 space-y-4 shadow-xs">
                    <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5 border-b border-neutral-100 pb-3">
                      <FileText size={15} className="text-amber-500" />
                      {isRtl ? 'الملاحظات والوسوم الداخلية' : 'Stylist Notes & Tags'}
                    </h3>

                    {/* Tags Section */}
                    <div className="space-y-2">
                      <label className="text-[10px] text-neutral-400 font-bold uppercase block">{isRtl ? 'الوسوم النشطة بالملف' : 'Linked CRM Tags'}</label>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectedCustomer.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 bg-neutral-100 text-neutral-700 font-bold text-[10px] px-2 py-0.5 rounded-lg border border-neutral-200">
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        {inspectedCustomer.tags.length === 0 && (
                          <p className="text-neutral-400 italic text-[11px]">{isRtl ? 'لا توجد وسوم مرتبطة حالياً.' : 'No active tags linked.'}</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder={isRtl ? 'إضافة وسم جديد...' : 'Add tag...'}
                          className="flex-1 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs outline-none"
                        />
                        <button
                          onClick={handleAddTag}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 rounded-xl text-xs font-black cursor-pointer transition-colors animate-pulse"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-2 pt-2 border-t border-neutral-100">
                      <label className="text-[10px] text-neutral-400 font-bold uppercase block">{isRtl ? 'الملاحظات الفنية المسجلة' : 'Stylist Session Notes'}</label>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {inspectedCustomer.notes.map((note, idx) => (
                          <div key={idx} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 flex items-start justify-between gap-3 text-[11px] text-neutral-700">
                            <p className="font-medium leading-relaxed">{note}</p>
                            <button
                              onClick={() => handleRemoveNote(idx)}
                              className="text-neutral-400 hover:text-rose-600 shrink-0 p-0.5 cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))}
                        {inspectedCustomer.notes.length === 0 && (
                          <p className="text-neutral-400 italic text-[11px]">{isRtl ? 'لا توجد ملاحظات مسجلة.' : 'No notes recorded.'}</p>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder={isRtl ? 'أضف ملاحظة جديدة لملف العميل...' : 'Add stylist note...'}
                          className="flex-1 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-1.5 text-xs outline-none"
                        />
                        <button
                          onClick={handleAddNote}
                          className="bg-zinc-900 hover:bg-zinc-800 text-white px-3 rounded-xl text-xs font-black cursor-pointer transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* C. Wallet Summary Card */}
                  <div className="bg-white rounded-2xl border border-neutral-150/70 p-5 space-y-4 shadow-xs">
                    <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5 border-b border-neutral-100 pb-3">
                      <CreditCard size={15} className="text-amber-500" />
                      {isRtl ? 'محفظة العميل الائتمانية' : 'Wallet Summary'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-center">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'رصيد المحفظة' : 'Wallet Balance'}</p>
                        <p className="text-lg font-black text-neutral-800 mt-1 font-mono">{inspectedCustomer.walletBalance} ر.س</p>
                      </div>
                      <div className="bg-neutral-50/50 p-3 rounded-xl border border-neutral-100 text-center">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'عدد المعاملات' : 'Wallet Entries'}</p>
                        <p className="text-lg font-black text-neutral-800 mt-1 font-mono">{inspectedCustomer.transactions.length}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="text-center">
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'بطاقات هدايا مرسلة' : 'Gift Cards Sent'}</p>
                        <p className="text-xs font-black text-neutral-800 mt-0.5">{inspectedCustomer.giftCardsSent ?? 1}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'بطاقات هدايا مستلمة' : 'Gift Cards Recv'}</p>
                        <p className="text-xs font-black text-neutral-800 mt-0.5">{inspectedCustomer.giftCardsReceived ?? 2}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubTab('transactions');
                        document.getElementById('history-workspace-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full bg-neutral-50 hover:bg-neutral-100 text-neutral-700 font-black py-2.5 rounded-xl text-xs border border-neutral-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <span>{isRtl ? 'عرض سجل كشف الحساب بالكامل' : 'View Full Wallet History'}</span>
                      <ChevronRight size={13} className={isRtl ? 'rotate-180' : ''} />
                    </button>
                  </div>

                </div>

                {/* RIGHT COLUMN: Statistics Card, Preferences Card */}
                <div className="xl:col-span-7 space-y-6">
                  
                  {/* A. Statistics Card */}
                  <div className="bg-white rounded-2xl border border-neutral-150/70 p-5 space-y-4 shadow-xs">
                    <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5 border-b border-neutral-100 pb-3">
                      <Sparkles size={15} className="text-amber-500" />
                      {isRtl ? 'الإحصائيات التشغيلية والمالية' : 'Performance & Financial Metrics'}
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{isRtl ? 'إجمالي الحجوزات' : 'Total Bookings'}</p>
                        <p className="text-2xl font-black text-neutral-800 mt-1 font-mono">{inspectedCustomer.visitsCount}</p>
                      </div>
                      <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{isRtl ? 'الحجوزات المكتملة' : 'Completed Bookings'}</p>
                        <p className="text-2xl font-black text-neutral-800 mt-1 font-mono">
                          {inspectedCustomer.visitsCount - (inspectedCustomer.noShowsCount || 0)}
                        </p>
                      </div>
                      <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{isRtl ? 'إجمالي المشتريات / الطلبات' : 'Total Orders'}</p>
                        <p className="text-2xl font-black text-neutral-800 mt-1 font-mono">{inspectedCustomer.totalOrders ?? 0}</p>
                      </div>
                      <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-100">
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{isRtl ? 'إجمالي المبالغ المدفوعة' : 'Total Spent'}</p>
                        <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{inspectedCustomer.totalSpent} ر.س</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-2 text-center text-xs">
                      <div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'تذاكر الخدمات' : 'Spent Services'}</p>
                        <p className="font-extrabold text-neutral-800 mt-0.5">{inspectedCustomer.spentServices} ر.س</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'شراء منتجات' : 'Spent Products'}</p>
                        <p className="font-extrabold text-neutral-800 mt-0.5">{inspectedCustomer.spentProducts} ر.س</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-rose-400 font-bold uppercase">{isRtl ? 'عدم الحضور' : 'No-Show Count'}</p>
                        <p className="font-extrabold text-rose-600 mt-0.5">{inspectedCustomer.noShowsCount}</p>
                      </div>
                    </div>
                  </div>

                  {/* B. Preferences Card */}
                  <div className="bg-white rounded-2xl border border-neutral-150/70 p-5 space-y-5 shadow-xs">
                    <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5 border-b border-neutral-100 pb-3">
                      <Heart size={15} className="text-amber-500" />
                      {isRtl ? 'تفضيلات العميل والعناية الشخصية' : 'Personalization & Preferences'}
                    </h3>

                    <div className="space-y-4 text-xs">
                      {/* Favorite Services */}
                      <div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2">{isRtl ? 'الخدمات المفضلة' : 'Favorite Services'}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(isRtl ? inspectedCustomer.favServicesAr : inspectedCustomer.favServices).map((srv, idx) => (
                            <span key={idx} className="bg-amber-50 text-amber-800 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-amber-100">
                              {srv}
                            </span>
                          ))}
                          {inspectedCustomer.favServices.length === 0 && (
                            <p className="text-neutral-400 italic">{isRtl ? 'لم تسجل أي خدمات مفضلة بعد' : 'No favorite services recorded.'}</p>
                          )}
                        </div>
                      </div>

                      {/* Favorite Products */}
                      <div>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-2">{isRtl ? 'المنتجات المفضلة' : 'Favorite Products'}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {inspectedCustomer.favoriteProducts && inspectedCustomer.favoriteProducts.length > 0 ? (
                            inspectedCustomer.favoriteProducts.map((prd, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-800 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-blue-100 flex items-center gap-1">
                                {prd.name} <span className="bg-blue-200 text-blue-900 px-1 rounded-sm text-[8px]">{prd.count}</span>
                              </span>
                            ))
                          ) : (
                            <p className="text-neutral-400 italic">{isRtl ? 'لم تسجل أي منتجات مفضلة بعد' : 'No favorite products recorded.'}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-neutral-50 pt-3">
                        <div>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'الأخصائي المفضل' : 'Preferred Stylist'}</p>
                          <p className="font-extrabold text-neutral-800 mt-1">{isRtl ? inspectedCustomer.assignedStylistAr : inspectedCustomer.assignedStylist}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'نوع التسليم المفضل' : 'Preferred Delivery Type'}</p>
                          <p className="font-extrabold text-neutral-800 mt-1">{isRtl ? 'استلام من الصالون مباشرة' : 'Salon Counter Pickup'}</p>
                        </div>
                      </div>

                      {/* Meta Display Section: Tier, Points, Customer Type */}
                      <div className="grid grid-cols-3 gap-3 border-t border-neutral-50 pt-3 text-center">
                        <div className="bg-zinc-50 p-2.5 rounded-xl border border-neutral-100">
                          <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'فئة الولاء' : 'Loyalty Tier'}</p>
                          <span className="bg-amber-100 text-amber-950 text-[10px] font-black px-1.5 py-0.5 rounded border border-amber-300 mt-1 inline-block uppercase font-mono">
                            {inspectedCustomer.loyaltyTier}
                          </span>
                        </div>
                        <div className="bg-zinc-50 p-2.5 rounded-xl border border-neutral-100">
                          <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'نقاط المكافأة' : 'Rewards Points'}</p>
                          <span className="text-xs font-black text-neutral-800 mt-1 block font-mono">
                            {inspectedCustomer.loyaltyPoints} PTS
                          </span>
                        </div>
                        <div className="bg-zinc-50 p-2.5 rounded-xl border border-neutral-100">
                          <p className="text-[9px] text-neutral-400 font-bold uppercase">{isRtl ? 'نوع العميل' : 'Customer Type'}</p>
                          <span className="bg-neutral-200 text-neutral-800 text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block uppercase">
                            {inspectedCustomer.customerType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* BOTTOM SECTION: Full-Width Interaction History Workspace */}
              <div id="history-workspace-section" className="bg-white rounded-2xl border border-neutral-150/70 p-5 shadow-xs mt-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-3 gap-3">
                  <h3 className="text-sm font-black text-neutral-800 flex items-center gap-1.5">
                    <Award size={15} className="text-amber-500" />
                    {isRtl ? 'سجل التفاعلات والنشاط الكامل للعميل' : 'Customer Interaction & CRM Workspace'}
                  </h3>

                  {/* Styled Sub-Tabs Selector */}
                  <div className="flex items-center gap-1 bg-neutral-50 p-1 rounded-xl border border-neutral-200 overflow-x-auto max-w-full">
                    {[
                      { id: 'history', labelEn: 'Complete History 🌟', labelAr: 'السجل الشامل 🌟' },
                      { id: 'overview', labelEn: 'Overview', labelAr: 'نظرة عامة' },
                      { id: 'appointments', labelEn: 'Appointments', labelAr: 'الحجوزات' },
                      { id: 'transactions', labelEn: 'Ledger', labelAr: 'الفواتير' },
                      { id: 'wallet', labelEn: 'Wallet Adjust', labelAr: 'المحفظة' },
                      { id: 'loyalty', labelEn: 'Loyalty Rewards', labelAr: 'نقاط الولاء' },
                      { id: 'reviews', labelEn: 'Reviews', labelAr: 'التقييمات' },
                      { id: 'documents', labelEn: 'Documents', labelAr: 'المستندات' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSubTab(tab.id as CustomerTab)}
                        className={`text-[11px] px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                          activeSubTab === tab.id
                            ? 'bg-zinc-900 text-amber-400 text-white shadow-xs'
                            : 'text-neutral-500 hover:text-zinc-900'
                        }`}
                      >
                        {isRtl ? tab.labelAr : tab.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAB CONTENT CONTAINER */}
                <div className="pt-2 min-h-[220px]">

                  {/* Tab Body */}
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      
                      {/* SUBTAB: COMPLETE HISTORY WORKSPACE */}
                      {activeSubTab === 'history' && (
                        <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                          {/* 1. Workspace Header with metrics */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                            <div>
                              <h3 className="text-sm font-black text-neutral-800 uppercase flex items-center gap-2">
                                <Clock size={16} className="text-amber-500 animate-pulse" />
                                {isRtl ? 'سجل النشاط والتفاعلات الشامل' : 'Complete History Workspace'}
                              </h3>
                              <p className="text-[11px] text-neutral-400 mt-0.5">
                                {isRtl ? 'تتبع فوري ومفصل لجميع الزيارات والحجوزات والطلبات المالية الصادرة للعميل' : 'CRM behavioral log for visits, service bookings, and financial orders'}
                              </p>
                            </div>
                            
                            {/* Actions / Export / Clear */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setHistoryType('all');
                                  setHistoryStatus('all');
                                  setHistoryStartDate('');
                                  setHistoryEndDate('');
                                  setHistoryLimit(50);
                                }}
                                className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <X size={12} />
                                <span>{isRtl ? 'إعادة ضبط التصفية' : 'Reset Filters'}</span>
                              </button>
                            </div>
                          </div>

                          {/* 2. Summary Metrics Dashboard (Header metrics) */}
                          {isLoadingHistory && !historyMetrics ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-pulse">
                              {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl h-14" />
                              ))}
                            </div>
                          ) : isErrorHistory ? (
                            <div className="text-center p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs">
                              {isRtl ? 'فشل تحميل المقاييس الملخصة للتفاعلات.' : 'Could not load summary metrics.'}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                              {/* Total Interactions */}
                              <div className="bg-amber-50/50 border border-amber-100/60 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0">
                                  <ArrowRightLeft size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إجمالي التفاعلات' : 'Interactions'}</p>
                                  <p className="text-base font-black text-neutral-800 font-mono mt-0.5">{historyMetrics?.totalInteractions ?? 0}</p>
                                </div>
                              </div>

                              {/* Total Appointments */}
                              <div className="bg-blue-50/40 border border-blue-100/50 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0">
                                  <Calendar size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إجمالي الحجوزات' : 'Appointments'}</p>
                                  <p className="text-base font-black text-neutral-800 font-mono mt-0.5">{historyMetrics?.totalAppointments ?? 0}</p>
                                </div>
                              </div>

                              {/* Total Orders */}
                              <div className="bg-emerald-50/40 border border-emerald-100/50 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                                  <ShoppingBag size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إجمالي الطلبات' : 'Orders'}</p>
                                  <p className="text-base font-black text-neutral-800 font-mono mt-0.5">{historyMetrics?.totalOrders ?? 0}</p>
                                </div>
                              </div>

                              {/* Total Spent */}
                              <div className="bg-indigo-50/40 border border-indigo-100/50 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700 shrink-0">
                                  <CreditCard size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إجمالي الإنفاق' : 'Total Spent'}</p>
                                  <p className="text-sm font-black text-neutral-800 font-mono mt-0.5 whitespace-nowrap">{historyMetrics?.totalSpent ?? 0} ر.س</p>
                                </div>
                              </div>

                              {/* Appointment Spending */}
                              <div className="bg-purple-50/40 border border-purple-100/50 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg text-purple-700 shrink-0">
                                  <Sparkles size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إنفاق الحجوزات' : 'Booking Spent'}</p>
                                  <p className="text-sm font-black text-neutral-800 font-mono mt-0.5 whitespace-nowrap">{historyMetrics?.appointmentSpending ?? 0} ر.س</p>
                                </div>
                              </div>

                              {/* Order Spending */}
                              <div className="bg-rose-50/40 border border-rose-100/50 p-3 rounded-xl flex items-center gap-3">
                                <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0">
                                  <Package size={14} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] text-neutral-400 font-bold uppercase truncate">{isRtl ? 'إنفاق الطلبات' : 'Order Spent'}</p>
                                  <p className="text-sm font-black text-neutral-800 font-mono mt-0.5 whitespace-nowrap">{historyMetrics?.orderSpending ?? 0} ر.س</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 3. Navigation Tabs and Status Filters / Date Range */}
                          <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-xl space-y-3">
                            {/* Category Tabs: All, Appointments, Purchases */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                              <div className="flex items-center gap-1 bg-neutral-200/60 p-1 rounded-xl w-fit">
                                {[
                                  { id: 'all', labelEn: 'All History', labelAr: 'الكل' },
                                  { id: 'appointments', labelEn: 'Appointments', labelAr: 'الحجوزات' },
                                  { id: 'purchases', labelEn: 'Purchases', labelAr: 'المشتريات' }
                                ].map(t => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setHistoryType(t.id as any)}
                                    className={`text-[10px] px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                                      historyType === t.id
                                        ? 'bg-zinc-900 text-amber-400 shadow-xs'
                                        : 'text-neutral-500 hover:text-zinc-900'
                                    }`}
                                  >
                                    {isRtl ? t.labelAr : t.labelEn}
                                  </button>
                                ))}
                              </div>

                              {/* Status Filters: All, Completed, Pending, Cancelled */}
                              <div className="flex flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                                {[
                                  { id: 'all', labelEn: 'All Statuses', labelAr: 'كل الحالات' },
                                  { id: 'completed', labelEn: 'Completed', labelAr: 'مكتمل' },
                                  { id: 'pending', labelEn: 'Pending', labelAr: 'قيد الانتظار' },
                                  { id: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي' }
                                ].map(st => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => setHistoryStatus(st.id as any)}
                                    className={`text-[9px] px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                      historyStatus === st.id
                                        ? 'bg-white text-zinc-900 shadow-xs'
                                        : 'text-neutral-500 hover:text-neutral-800'
                                    }`}
                                  >
                                    {isRtl ? st.labelAr : st.labelEn}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Date filters and limits row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                              {/* Start Date */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-neutral-400 font-mono uppercase block">
                                  {isRtl ? 'من تاريخ:' : 'Start Date:'}
                                </label>
                                <input
                                  type="date"
                                  value={historyStartDate}
                                  onChange={(e) => setHistoryStartDate(e.target.value)}
                                  className="w-full bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-1.5 text-[10px] outline-none font-mono"
                                />
                              </div>

                              {/* End Date */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-neutral-400 font-mono uppercase block">
                                  {isRtl ? 'إلى تاريخ:' : 'End Date:'}
                                </label>
                                <input
                                  type="date"
                                  value={historyEndDate}
                                  onChange={(e) => setHistoryEndDate(e.target.value)}
                                  className="w-full bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-1.5 text-[10px] outline-none font-mono"
                                />
                              </div>

                              {/* Display Limit */}
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-neutral-400 font-mono uppercase block">
                                  {isRtl ? 'الحد الأقصى للنتائج:' : 'Display Limit:'}
                                </label>
                                <select
                                  value={historyLimit}
                                  onChange={(e) => setHistoryLimit(Number(e.target.value))}
                                  className="w-full bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3 py-1.5 text-[10px] outline-none font-mono"
                                >
                                  <option value={10}>10 {isRtl ? 'سجلات' : 'records'}</option>
                                  <option value={20}>20 {isRtl ? 'سجلات' : 'records'}</option>
                                  <option value={50}>50 {isRtl ? 'سجلات' : 'records'}</option>
                                  <option value={100}>100 {isRtl ? 'سجلات' : 'records'}</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* 4. Scrollable History List */}
                          <div className="border border-neutral-100 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto bg-neutral-50/20">
                            {isLoadingHistory ? (
                              <div className="p-12 text-center space-y-3">
                                <RefreshCw size={20} className="mx-auto text-amber-500 animate-spin" />
                                <p className="text-xs text-neutral-400">{isRtl ? 'جاري تحميل سجل التفاعلات...' : 'Loading complete history...'}</p>
                              </div>
                            ) : isErrorHistory ? (
                              <div className="p-12 text-center text-rose-500 space-y-2 bg-rose-50/20">
                                <AlertCircle size={24} className="mx-auto" />
                                <h4 className="text-xs font-black">{isRtl ? 'حدث خطأ أثناء الاتصال بالخادم' : 'Error querying history'}</h4>
                                <p className="text-[10px] text-neutral-400">{isRtl ? 'يرجى التحقق من اتصال الشبكة وإعادة المحاولة.' : 'Could not query data from server.'}</p>
                              </div>
                            ) : historyData.length === 0 ? (
                              <div className="p-16 text-center text-neutral-400 space-y-2">
                                <Filter size={24} className="mx-auto text-neutral-300" />
                                <h4 className="text-xs font-black text-neutral-700">{isRtl ? 'لا توجد نتائج مطابقة' : 'No records match filters'}</h4>
                                <p className="text-[10px] text-neutral-400">
                                  {isRtl ? 'يرجى تعديل معايير التصفية والتواريخ المعينة.' : 'Try relaxing your status or date range bounds.'}
                                </p>
                              </div>
                            ) : (
                              <div className="divide-y divide-neutral-100 font-medium text-xs">
                                {historyData.map((row) => {
                                  if (row.type === 'appointment') {
                                    return (
                                      <div
                                        key={row.id}
                                        onClick={() => {
                                          window.history.pushState(null, '', '/dashboard/appointments');
                                          window.dispatchEvent(new Event('popstate'));
                                        }}
                                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 border-l-4 border-l-amber-400 transition-all cursor-pointer group"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-100 transition-all">
                                            <Calendar size={14} />
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-extrabold text-neutral-800 text-xs group-hover:text-amber-800 transition-all">
                                                {isRtl ? row.serviceAr : row.service}
                                              </span>
                                              <span className="text-[9px] bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                {isRtl ? 'حجز خدمة' : 'Appointment'}
                                              </span>
                                            </div>
                                            <p className="text-neutral-500 mt-1">
                                              {isRtl ? 'المقدم:' : 'Provider:'} <strong className="text-neutral-700">{isRtl ? row.providerAr : row.provider}</strong>
                                            </p>
                                            <p className="text-[9px] text-neutral-400 font-mono mt-0.5">{row.date}</p>
                                          </div>
                                        </div>

                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                                          <span className="font-mono font-bold text-neutral-900">{row.amount} ر.س</span>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            row.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                            row.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                            'bg-rose-50 text-rose-700'
                                          }`}>
                                            {isRtl 
                                              ? (row.status === 'completed' ? 'مكتمل' : row.status === 'pending' ? 'قيد الانتظار' : 'ملغي') 
                                              : row.status}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Purchase Row
                                    return (
                                      <div
                                        key={row.id}
                                        onClick={() => {
                                          setSelectedOrderDetails(row);
                                        }}
                                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/70 border-l-4 border-l-emerald-400 transition-all cursor-pointer group"
                                      >
                                        <div className="flex items-start gap-3">
                                          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-100 transition-all">
                                            <Package size={14} />
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="font-extrabold text-neutral-800 text-xs group-hover:text-emerald-800 transition-all">
                                                {isRtl ? row.productsAr : row.products}
                                              </span>
                                              <span className="text-[9px] bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                {isRtl ? 'شراء منتج' : 'Purchase'}
                                              </span>
                                            </div>
                                            <p className="text-neutral-500 mt-1 font-mono text-[9px]">
                                              ID: {row.id}
                                            </p>
                                            <p className="text-[9px] text-neutral-400 font-mono mt-0.5">{row.date}</p>
                                          </div>
                                        </div>

                                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0">
                                          <span className="font-mono font-bold text-neutral-900">{row.amount} ر.س</span>
                                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            row.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                            row.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                                            'bg-rose-50 text-rose-700'
                                          }`}>
                                            {isRtl 
                                              ? (row.status === 'completed' ? 'مكتمل' : row.status === 'pending' ? 'قيد الانتظار' : 'ملغي') 
                                              : row.status}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 1: OVERVIEW */}
                      {activeSubTab === 'overview' && (
                        <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                          <div>
                            <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'ملخص النشاط الأخير للعميل' : 'Recent VVIP Context'}</h3>
                            <p className="text-xs text-neutral-400 font-mono mt-0.5">{isRtl ? 'الحالة والملاحظات السريعة المسجلة بالخدمات' : 'Daily brief for check-in stylist'}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="border border-neutral-100 p-4 rounded-xl space-y-3">
                              <h4 className="text-xs font-black text-neutral-700 flex items-center gap-1">
                                <Star size={13} className="text-amber-500" />
                                {isRtl ? 'الخدمات المفضلة' : 'Favorite Salon Services'}
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {(isRtl ? inspectedCustomer.favServicesAr : inspectedCustomer.favServices).map((srv, idx) => (
                                  <span key={idx} className="bg-amber-50 text-amber-800 text-[10px] px-2.5 py-1 rounded-lg font-bold border border-amber-100">
                                    {srv}
                                  </span>
                                ))}
                                {inspectedCustomer.favServices.length === 0 && (
                                  <p className="text-neutral-400 text-xs italic">{isRtl ? 'لم تسجل أي خدمات مفضلة بعد' : 'No favorite services recorded.'}</p>
                                )}
                              </div>
                            </div>

                            <div className="border border-neutral-100 p-4 rounded-xl space-y-3">
                              <h4 className="text-xs font-black text-neutral-700 flex items-center gap-1">
                                <Award size={13} className="text-amber-500" />
                                {isRtl ? 'الفئة والأخصائي المخصص' : 'Loyalty & Styling Care'}
                              </h4>
                              <div className="text-xs space-y-1">
                                <p><span className="text-neutral-400">{isRtl ? 'فئة الولاء:' : 'Current Tier:'}</span> <strong className="text-amber-800">{inspectedCustomer.loyaltyTier}</strong></p>
                                <p><span className="text-neutral-400">{isRtl ? 'أخصائي تجميل مفضل:' : 'Favorite Stylist:'}</span> <strong>{isRtl ? inspectedCustomer.assignedStylistAr : inspectedCustomer.assignedStylist}</strong></p>
                              </div>
                            </div>
                          </div>

                          {/* Communication Logs */}
                          <div className="border border-neutral-100 rounded-xl overflow-hidden">
                            <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
                              <h4 className="text-xs font-black text-neutral-700 flex items-center gap-1.5">
                                <MessageSquare size={13} className="text-amber-500" />
                                {isRtl ? 'أحدث اتصالات الحملات التسويقية والرسائل' : 'Marketing & SMS Outbox'}
                              </h4>
                            </div>
                            <div className="divide-y divide-neutral-50">
                              {inspectedCustomer.communication.map(log => (
                                <div key={log.id} className="p-3.5 flex items-start gap-3 text-xs">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono tracking-wide ${
                                    log.type === 'whatsapp' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                                  }`}>
                                    {log.type.toUpperCase()}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-neutral-700">{isRtl ? log.textAr : log.textEn}</p>
                                    <p className="text-[10px] text-neutral-400 mt-1 font-mono">{log.date} - Sent via system outbox by {log.sender}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 2: APPOINTMENTS */}
                      {activeSubTab === 'appointments' && (
                        <motion.div key="appointments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'تاريخ حجوزات العميل' : 'Appointment Log'}</h3>
                          <div className="border border-neutral-100 rounded-xl overflow-hidden">
                            <table className="w-full text-start text-xs border-collapse">
                              <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100 text-neutral-400 font-mono text-[10px] uppercase font-black">
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'الخدمة' : 'Service'}</th>
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'الأخصائي' : 'Stylist'}</th>
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'التاريخ والوقت' : 'Date & Time'}</th>
                                  <th className="px-4 py-2.5 text-end">{isRtl ? 'السعر' : 'Price'}</th>
                                  <th className="px-4 py-2.5 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-50 font-medium">
                                {inspectedCustomer.appointments.map(ap => (
                                  <tr key={ap.id} className="hover:bg-neutral-50/50">
                                    <td className="px-4 py-3 font-extrabold">{isRtl ? ap.serviceAr : ap.service}</td>
                                    <td className="px-4 py-3">{isRtl ? ap.stylistAr : ap.stylist}</td>
                                    <td className="px-4 py-3 font-mono text-neutral-500">{ap.date} at {ap.time}</td>
                                    <td className="px-4 py-3 text-end font-mono font-bold text-neutral-800">{ap.price} ر.س</td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                        ap.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                        ap.status === 'confirmed' ? 'bg-amber-50 text-amber-700' :
                                        'bg-rose-50 text-rose-700'
                                      }`}>
                                        {ap.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 3: TRANSACTIONS / LEDGER */}
                      {activeSubTab === 'transactions' && (
                        <motion.div key="transactions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'سجل المعاملات والمدفوعات الفني' : 'Invoice & Financial Ledger'}</h3>
                          <div className="border border-neutral-100 rounded-xl overflow-hidden">
                            <table className="w-full text-start text-xs border-collapse">
                              <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100 text-neutral-400 font-mono text-[10px] uppercase font-black">
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'كود الفاتورة' : 'Invoice ID'}</th>
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'نوع البند' : 'Item Type'}</th>
                                  <th className="px-4 py-2.5 text-start">{isRtl ? 'طريقة الدفع' : 'Method'}</th>
                                  <th className="px-4 py-2.5 text-end">{isRtl ? 'المبلغ' : 'Amount'}</th>
                                  <th className="px-4 py-2.5 text-center">{isRtl ? 'الحالة' : 'Status'}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-50 font-medium">
                                {inspectedCustomer.transactions.length > 0 ? (
                                  inspectedCustomer.transactions.map(tx => (
                                    <tr key={tx.id} className="hover:bg-neutral-50/50">
                                      <td className="px-4 py-3 font-mono text-neutral-400 text-[11px]">{tx.id}</td>
                                      <td className="px-4 py-3 font-extrabold">{isRtl ? tx.typeAr : tx.type}</td>
                                      <td className="px-4 py-3">{isRtl ? tx.methodAr : tx.method}</td>
                                      <td className="px-4 py-3 text-end font-mono font-bold text-neutral-800">{tx.amount} ر.س</td>
                                      <td className="px-4 py-3 text-center">
                                        <span className="bg-emerald-50 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                                          {tx.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">
                                      <div className="space-y-2">
                                        <Package size={20} className="mx-auto text-neutral-300" />
                                        <p className="text-xs font-bold text-neutral-700">
                                          {isRtl ? 'لا توجد فواتير أو معاملات محفوظة' : 'No persisted invoices or financial transactions yet.'}
                                        </p>
                                        <p className="text-[10px]">
                                          {isRtl ? 'ستظهر هنا الفواتير الفعلية بمجرد وجود عمليات شراء أو حجوزات مدفوعة.' : 'Real invoice and ledger records will appear here once purchases or paid appointments exist.'}
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 4: WALLET */}
                      {activeSubTab === 'wallet' && (
                        <motion.div key="wallet" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 pb-4 gap-4">
                            <div>
                              <h3 className="text-base font-extrabold text-neutral-900 tracking-tight flex items-center gap-2">
                                <span className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
                                  <ShoppingBag size={16} />
                                </span>
                                {isRtl ? 'محفظة رصيد العميل وسجل المعاملات' : 'Customer Wallet Ledger Workspace'}
                              </h3>
                              <p className="text-xs text-neutral-400 mt-0.5">
                                {isRtl ? 'الاطلاع الشامل على القيود والبطاقات الترويجية المستلمة والمرسلة' : 'Complete read-only financial ledger history, gift cards, and loyalty credits.'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] bg-neutral-100 border border-neutral-200 text-neutral-600 px-2.5 py-1 rounded-md font-mono uppercase tracking-wider font-extrabold">
                                {isRtl ? 'حالة القراءة فقط' : 'READ-ONLY MODE'}
                              </span>
                            </div>
                          </div>

                          {isLoadingWalletHistory ? (
                            /* State A: Loading state */
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                  <div key={i} className="bg-neutral-50 border border-neutral-100 p-4 rounded-xl space-y-3 animate-pulse">
                                    <div className="h-3 w-20 bg-neutral-200 rounded" />
                                    <div className="h-6 w-24 bg-neutral-200 rounded" />
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white border border-neutral-100 rounded-xl p-5 h-64 animate-pulse" />
                                <div className="bg-white border border-neutral-100 rounded-xl p-5 h-64 animate-pulse" />
                              </div>
                            </div>
                          ) : isErrorWalletHistory ? (
                            /* State B: Error state */
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-6 text-center space-y-4 max-w-md mx-auto">
                              <AlertCircle className="mx-auto text-rose-500" size={32} />
                              <div>
                                <h4 className="font-extrabold text-rose-900 text-sm">{isRtl ? 'خطأ في تحميل سجل المحفظة' : 'Failed to Load Wallet Ledger'}</h4>
                                <p className="text-xs text-rose-600 mt-1">{isRtl ? 'واجه النظام مشكلة أثناء محاولة جلب البيانات المالية.' : 'An error occurred while retrieving full wallet history details.'}</p>
                              </div>
                              <button
                                onClick={loadWalletHistory}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all"
                              >
                                {isRtl ? 'إعادة المحاولة' : 'Retry'}
                              </button>
                            </div>
                          ) : !walletHistoryData ? (
                            /* State C: Empty/Null fallback state */
                            <div className="bg-neutral-50 border border-neutral-200 border-dashed rounded-xl p-8 text-center space-y-2">
                              <ShoppingBag className="mx-auto text-neutral-300" size={36} />
                              <h4 className="font-bold text-neutral-700 text-sm">{isRtl ? 'المحفظة فارغة' : 'No Financial Record'}</h4>
                              <p className="text-xs text-neutral-400 max-w-sm mx-auto">{isRtl ? 'لم يتم العثور على أي بيانات رصيد أو قيود للعميل المحدد.' : 'No available wallet ledger or gift cards associated with this client record.'}</p>
                            </div>
                          ) : (
                            <>
                              {/* 4 Summary cards on top */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Card 1: Balance */}
                                <div className="bg-amber-500/5 hover:bg-amber-500/[0.08] transition-colors border border-amber-500/15 p-4 rounded-xl flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">{isRtl ? 'الرصيد المتاح حالياً' : 'Current Balance'}</p>
                                    <p className="text-2xl font-black text-neutral-800 font-mono mt-1">{walletHistoryData.walletBalance} ر.س</p>
                                  </div>
                                  <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                                    <ShoppingBag size={20} />
                                  </div>
                                </div>

                                {/* Card 2: Wallet entries count */}
                                <div className="bg-neutral-50 hover:bg-neutral-100/70 transition-colors border border-neutral-200/60 p-4 rounded-xl flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">{isRtl ? 'عدد قيود المحفظة' : 'Wallet Entries Count'}</p>
                                    <p className="text-2xl font-black text-neutral-800 font-mono mt-1">{walletHistoryData.walletEntriesCount}</p>
                                  </div>
                                  <div className="p-2.5 bg-neutral-100 text-neutral-600 rounded-xl">
                                    <ArrowUpDown size={20} />
                                  </div>
                                </div>

                                {/* Card 3: Gift Cards Sent */}
                                <div className="bg-neutral-50 hover:bg-neutral-100/70 transition-colors border border-neutral-200/60 p-4 rounded-xl flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">{isRtl ? 'البطاقات المرسلة للآخرين' : 'Gift Cards Sent'}</p>
                                    <p className="text-2xl font-black text-neutral-800 font-mono mt-1">{walletHistoryData.giftCardsSent}</p>
                                  </div>
                                  <div className="p-2.5 bg-neutral-100 text-neutral-600 rounded-xl">
                                    <Send size={18} />
                                  </div>
                                </div>

                                {/* Card 4: Gift Cards Received */}
                                <div className="bg-neutral-50 hover:bg-neutral-100/70 transition-colors border border-neutral-200/60 p-4 rounded-xl flex items-center justify-between">
                                  <div>
                                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider">{isRtl ? 'البطاقات المستلمة' : 'Gift Cards Received'}</p>
                                    <p className="text-2xl font-black text-neutral-800 font-mono mt-1">{walletHistoryData.giftCardsReceived}</p>
                                  </div>
                                  <div className="p-2.5 bg-neutral-100 text-neutral-600 rounded-xl">
                                    <Package size={20} />
                                  </div>
                                </div>
                              </div>

                              {/* Empty state conditional */}
                              {(!walletHistoryData.walletLedger || walletHistoryData.walletLedger.length === 0) && 
                               (!walletHistoryData.giftCards || walletHistoryData.giftCards.length === 0) ? (
                                <div className="bg-white border border-neutral-150/70 rounded-xl p-12 text-center space-y-3">
                                  <ShoppingBag size={40} className="text-neutral-300 mx-auto" />
                                  <h4 className="font-extrabold text-neutral-800 text-sm">{isRtl ? 'سجل العمليات فارغ' : 'Wallet History Empty'}</h4>
                                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                                    {isRtl 
                                      ? 'لا توجد معاملات شراء أو قيد ولا توجد بطاقات هدايا مسجلة باسم هذا العميل.' 
                                      : 'No purchase ledger entries or gift cards currently exist for this client profile.'}
                                  </p>
                                </div>
                              ) : (
                                /* Desktop: 2 Panels below, Stack vertically on Mobile */
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                  
                                  {/* Panel 1: Wallet Ledger Rows */}
                                  <div className="bg-white rounded-2xl border border-neutral-150/70 overflow-hidden shadow-xs">
                                    <div className="bg-neutral-50 border-b border-neutral-150 px-5 py-4 flex items-center justify-between">
                                      <div>
                                        <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">{isRtl ? 'سجل قيود رصيد المحفظة المالي' : 'Wallet Ledger Journal'}</h4>
                                        <p className="text-[10px] text-neutral-400 mt-0.5">{isRtl ? 'سجل عمليات الإيداع والخصم الحاصلة على رصيد العميل' : 'Comprehensive audit of deposits, deductions and booking charges'}</p>
                                      </div>
                                      <span className="text-[10px] bg-neutral-200 font-mono font-bold px-2 py-0.5 rounded text-neutral-700">
                                        {walletHistoryData.walletLedger?.length || 0} {isRtl ? 'قيود' : 'entries'}
                                      </span>
                                    </div>

                                    <div className="divide-y divide-neutral-100 overflow-x-auto">
                                      {(!walletHistoryData.walletLedger || walletHistoryData.walletLedger.length === 0) ? (
                                        <div className="p-8 text-center text-neutral-400 text-xs italic">
                                          {isRtl ? 'لا توجد قيود مالية سابقة' : 'No ledger records exist.'}
                                        </div>
                                      ) : (
                                        walletHistoryData.walletLedger.map((row: any) => {
                                          const isCredit = row.type === 'credit';
                                          return (
                                            <div key={row.id} className="p-4 hover:bg-neutral-50/50 transition-colors flex items-center justify-between gap-4 text-xs">
                                              <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    isCredit 
                                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                                      : 'bg-rose-50 text-rose-800 border border-rose-100'
                                                  }`}>
                                                    {isCredit ? (isRtl ? 'إيداع' : 'Credit') : (isRtl ? 'خصم' : 'Debit')}
                                                  </span>
                                                  <span className="font-extrabold text-neutral-800 truncate">{row.referenceType}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono">
                                                  <span>{new Date(row.timestamp).toLocaleString(isRtl ? 'ar-SA' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                                </div>
                                              </div>

                                              <div className="text-right shrink-0">
                                                <p className={`font-mono font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                  {isCredit ? '+' : '-'}{row.amount} ر.س
                                                </p>
                                                <p className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                                                  {isRtl ? 'الرصيد: ' : 'Bal: '} 
                                                  <span className="text-neutral-500 font-bold">{row.balanceBefore}</span>
                                                  <span className="mx-0.5">→</span>
                                                  <span className="text-neutral-700 font-black">{row.balanceAfter} ر.س</span>
                                                </p>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>

                                  {/* Panel 2: Gift Cards Panel */}
                                  <div className="bg-white rounded-2xl border border-neutral-150/70 overflow-hidden shadow-xs">
                                    <div className="bg-neutral-50 border-b border-neutral-150 px-5 py-4 flex items-center justify-between">
                                      <div>
                                        <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">{isRtl ? 'سجل بطاقات الهدايا الترويجية' : 'Gift Cards Registry'}</h4>
                                        <p className="text-[10px] text-neutral-400 mt-0.5">{isRtl ? 'البطاقات المشتراة والنشطة وتفاصيل المكافآت التابعة لها' : 'Purchased packages, claim state and associated bonus balances'}</p>
                                      </div>
                                      <span className="text-[10px] bg-neutral-200 font-mono font-bold px-2 py-0.5 rounded text-neutral-700">
                                        {walletHistoryData.giftCards?.length || 0} {isRtl ? 'بطاقات' : 'cards'}
                                      </span>
                                    </div>

                                    <div className="divide-y divide-neutral-100 overflow-x-auto">
                                      {(!walletHistoryData.giftCards || walletHistoryData.giftCards.length === 0) ? (
                                        <div className="p-8 text-center text-neutral-400 text-xs italic">
                                          {isRtl ? 'لا توجد بطاقات هدايا ترويجية مسجلة' : 'No gift cards exist.'}
                                        </div>
                                      ) : (
                                        walletHistoryData.giftCards.map((gc: any) => {
                                          const statusColors = 
                                            gc.status === 'claimed' 
                                              ? 'bg-neutral-100 text-neutral-600 border border-neutral-200' 
                                              : gc.status === 'active' 
                                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                                              : 'bg-neutral-50 text-neutral-400 border border-neutral-200/60 line-through';
                                          
                                          return (
                                            <div key={gc.id} className="p-4 hover:bg-neutral-50/50 transition-colors space-y-3 text-xs">
                                              {/* Title and Status row */}
                                              <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0">
                                                  <h5 className="font-extrabold text-neutral-800 truncate">
                                                    {isRtl ? gc.packageTitleAr : gc.packageTitle}
                                                  </h5>
                                                  <p className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                                                    <span>ID: {gc.id}</span>
                                                    <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                                                    <span>{isRtl ? 'عبر: ' : 'via '}{gc.deliveryChannel}</span>
                                                  </p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${statusColors}`}>
                                                  {gc.status === 'claimed' ? (isRtl ? 'مستردة' : 'Claimed') : gc.status === 'active' ? (isRtl ? 'نشطة' : 'Active') : (isRtl ? 'منتهية' : 'Expired')}
                                                </span>
                                              </div>

                                              {/* Cost & Credits layout */}
                                              <div className="grid grid-cols-3 gap-2 text-center bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                                                <div>
                                                  <p className="text-[8px] text-neutral-400 uppercase font-extrabold">{isRtl ? 'مبلغ الشراء' : 'Purchase Cost'}</p>
                                                  <p className="font-mono font-extrabold text-neutral-700 mt-0.5">{gc.purchaseAmount} ر.س</p>
                                                </div>
                                                <div>
                                                  <p className="text-[8px] text-neutral-400 uppercase font-extrabold">{isRtl ? 'قيمة الرصيد الكلي' : 'Total Credit'}</p>
                                                  <p className="font-mono font-black text-neutral-900 mt-0.5">{gc.totalCreditAmount} ر.س</p>
                                                </div>
                                                <div>
                                                  <p className="text-[8px] text-neutral-400 uppercase font-extrabold">{isRtl ? 'مكافأة إضافية' : 'Bonus Amount'}</p>
                                                  <p className="font-mono font-extrabold text-emerald-600 mt-0.5">+{gc.bonusAmount} ر.س</p>
                                                </div>
                                              </div>

                                              {/* Timestamps */}
                                              <div className="flex flex-col sm:flex-row justify-between text-[10px] text-neutral-400 font-mono gap-1.5 pt-1">
                                                <p>
                                                  <strong>{isRtl ? 'تاريخ الإنشاء: ' : 'Created: '}</strong>
                                                  {gc.createdDate}
                                                </p>
                                                {gc.claimedDate && (
                                                  <p className="text-emerald-600 font-bold">
                                                    <strong>{isRtl ? 'تاريخ الاستلام: ' : 'Claimed: '}</strong>
                                                    {gc.claimedDate}
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>

                                </div>
                              )}
                            </>
                          )}
                        </motion.div>
                      )}

                      {/* SUBTAB 5: LOYALTY */}
                      {activeSubTab === 'loyalty' && (
                        <motion.div key="loyalty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                          <div>
                            <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'نقاط الولاء وتصنيفات العميل' : 'Loyalty Points Ledger'}</h3>
                            <p className="text-xs text-neutral-400 font-mono mt-0.5">{isRtl ? 'تعديل وتحديث نقاط برامج المكافآت يدويًا للعميل' : 'Override store rewards credit balances'}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Stats */}
                            <div className="bg-neutral-50 border border-neutral-100 p-4 rounded-xl flex flex-col justify-between">
                              <div className="space-y-1">
                                <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'رصيد النقاط الفعالة' : 'Active Point Balance'}</p>
                                <p className="text-3xl font-black text-neutral-800 font-mono mt-1">{inspectedCustomer.loyaltyPoints} PTS</p>
                              </div>
                              <div className="space-y-1 mt-4">
                                <p className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'مستوى الفئة المستحق' : 'Computed Loyalty Tier'}</p>
                                <span className="bg-amber-100 text-amber-950 font-mono border border-amber-300 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase inline-block">
                                  {inspectedCustomer.loyaltyTier}
                                </span>
                              </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleLoyaltySubmit} className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'طبيعة العملية' : 'Loyalty Override Action'}</label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setLoyaltyAction('add')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                      loyaltyAction === 'add' 
                                        ? 'bg-zinc-900 text-amber-400 border-zinc-900' 
                                        : 'bg-white text-neutral-600 border-neutral-200'
                                    }`}
                                  >
                                    {isRtl ? 'إضافة نقاط' : 'Credit Points'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setLoyaltyAction('deduct')}
                                    className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                      loyaltyAction === 'deduct' 
                                        ? 'bg-zinc-900 text-amber-400 border-zinc-900' 
                                        : 'bg-white text-neutral-600 border-neutral-200'
                                    }`}
                                  >
                                    {isRtl ? 'خصم نقاط' : 'Debit Points'}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] text-neutral-400 font-bold uppercase">{isRtl ? 'عدد النقاط المطلوب تعديلها' : 'Points Volume'}</label>
                                <input
                                  type="number"
                                  value={loyaltyAmount}
                                  onChange={(e) => setLoyaltyAmount(e.target.value)}
                                  placeholder="e.g. 100"
                                  className="w-full bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold outline-none"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Award size={14} className="text-amber-500" />
                                <span>{isRtl ? 'حفظ رصيد النقاط المعدل' : 'Update Loyalty Points'}</span>
                              </button>
                            </form>
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 6: REVIEWS */}
                      {activeSubTab === 'reviews' && (
                        <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'تقييمات العميل لصالون رفاه' : 'Client Quality Reviews'}</h3>
                          <div className="space-y-3">
                            {inspectedCustomer.reviews.map(rev => (
                              <div key={rev.id} className="border border-neutral-100 p-4 rounded-xl space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <strong className="text-neutral-800 font-extrabold">{isRtl ? rev.serviceAr : rev.service}</strong>
                                  <div className="flex items-center gap-1 text-amber-500 font-mono font-bold">
                                    <Star size={12} fill="currentColor" />
                                    <span>{rev.rating} / 5</span>
                                  </div>
                                </div>
                                <p className="text-neutral-600 bg-neutral-50 p-2.5 rounded-lg italic">"{isRtl ? rev.commentAr : rev.comment}"</p>
                                <p className="text-[10px] text-neutral-400 font-mono text-end">{rev.date}</p>
                              </div>
                            ))}
                            {inspectedCustomer.reviews.length === 0 && (
                              <p className="text-neutral-400 text-xs italic text-center py-6">{isRtl ? 'لا توجد تقييمات مسجلة للعميل' : 'No service reviews posted.'}</p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 7: NOTES */}
                      {activeSubTab === 'notes' && (
                        <motion.div key="notes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'الملاحظات الداخلية المشتركة' : 'Internal Stylist Notes'}</h3>
                          
                          {/* Note Addition */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              placeholder={isRtl ? 'أضف ملاحظة فنية خاصة بالعميل هنا...' : 'Append critical internal salon note...'}
                              className="flex-1 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button
                              onClick={handleAddNote}
                              className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 rounded-xl text-xs font-black cursor-pointer transition-all shrink-0 flex items-center justify-center"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            {inspectedCustomer.notes.map((note, idx) => (
                              <div key={idx} className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <FileText size={14} className="text-amber-500 shrink-0" />
                                  <p className="text-neutral-700 font-medium">{note}</p>
                                </div>
                                <button
                                  onClick={() => handleRemoveNote(idx)}
                                  className="text-neutral-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                  title={isRtl ? 'حذف الملاحظة' : 'Delete note'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            ))}
                            {inspectedCustomer.notes.length === 0 && (
                              <p className="text-neutral-400 text-xs italic text-center py-6">{isRtl ? 'لا توجد أي ملاحظات داخلية مضافة حالياً.' : 'No active notes assigned to this file.'}</p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 8: TAGS */}
                      {activeSubTab === 'tags' && (
                        <motion.div key="tags" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'نظام الوسوم والشرائح الذكية' : 'CRM Directory Tags'}</h3>
                          
                          {/* Tag Addition */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              placeholder={isRtl ? 'اكتب اسم الوسم (مثال: أظافر، بشرة)...' : 'Type name tag to link (e.g. Color regular)...'}
                              className="flex-1 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border border-neutral-200 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs outline-none"
                            />
                            <button
                              onClick={handleAddTag}
                              className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 rounded-xl text-xs font-black cursor-pointer transition-all shrink-0 flex items-center justify-center"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2.5 pt-2">
                            {inspectedCustomer.tags.map(t => (
                              <div key={t} className="bg-neutral-50 border border-neutral-200/60 rounded-xl pl-2.5 pr-1 py-1 flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                                <Tag size={11} className="text-amber-500 shrink-0" />
                                <span>{t}</span>
                                <button
                                  onClick={() => handleRemoveTag(t)}
                                  className="text-neutral-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md cursor-pointer transition-all"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                            {inspectedCustomer.tags.length === 0 && (
                              <p className="text-neutral-400 text-xs italic py-6 w-full text-center">{isRtl ? 'لا توجد وسوم مرتبطة بالملف الشخصي.' : 'No directory tags linked.'}</p>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* SUBTAB 9: DOCUMENTS */}
                      {activeSubTab === 'documents' && (
                        <motion.div key="documents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-black text-neutral-800 uppercase">{isRtl ? 'المستندات وملفات الاستشارات الطبية' : 'Consultation Records & Clinical PDFs'}</h3>
                              <p className="text-xs text-neutral-400 font-mono mt-0.5">{isRtl ? 'التقارير الطبية المسجلة بأمان وبطاقات القياس والتشخيص' : 'HIPAA safe medical skin scan file records'}</p>
                            </div>
                            
                            {/* Simulated Upload Button */}
                            <button
                              onClick={handleDocUpload}
                              disabled={isUploadingDoc}
                              className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                            >
                              {isUploadingDoc ? (
                                <RefreshCw size={13} className="animate-spin text-amber-400" />
                              ) : (
                                <Paperclip size={13} className="text-amber-400" />
                              )}
                              <span>{isRtl ? 'رفع مستند فحص الشعر' : 'Upload scan report'}</span>
                            </button>
                          </div>

                          <div className="space-y-2">
                            {inspectedCustomer.documents.map(doc => (
                              <div key={doc.id} className="border border-neutral-100 p-3.5 rounded-xl flex items-center justify-between gap-4 text-xs hover:bg-neutral-50/40 transition-all">
                                <div className="flex items-center gap-2.5">
                                  <FileText size={16} className="text-neutral-400 shrink-0" />
                                  <div>
                                    <p className="font-extrabold text-neutral-700">{doc.name}</p>
                                    <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{doc.date} - Size: {doc.size}</p>
                                  </div>
                                </div>
                                <span className="bg-neutral-100 text-neutral-600 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                                  {doc.type}
                                </span>
                              </div>
                            ))}
                            {inspectedCustomer.documents.length === 0 && (
                              <p className="text-neutral-400 text-xs italic text-center py-8">{isRtl ? 'لم يتم رفع مستندات طبية أو تقارير جلدية بعد.' : 'No files or documents uploaded.'}</p>
                            )}
                          </div>
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                </div>

              </div>
            </>
          )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Persisted order/invoice detail modal */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full overflow-hidden text-xs text-neutral-700 dark:text-neutral-300 font-medium"
            >
              {/* Receipt Header */}
              <div className="bg-neutral-900 text-white p-5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] bg-emerald-500 text-white font-mono px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                    {isRtl ? 'فاتورة محفوظة' : 'Persisted Invoice'}
                  </span>
                  <h3 className="text-sm font-black mt-1 font-mono">
                    {selectedOrderDetails.details?.orderNumber || selectedOrderDetails.id}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrderDetails(null)}
                  className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="p-6 space-y-4">
                <div className="text-center py-2 border-b border-dashed border-neutral-205">
                  <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">{isRtl ? 'تاريخ المعاملة' : 'Transaction Date'}</p>
                  <p className="font-mono text-neutral-800 dark:text-neutral-100 font-bold mt-0.5">{selectedOrderDetails.date}</p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-black text-neutral-800 dark:text-neutral-200">{isRtl ? 'المنتجات المشتراة:' : 'Purchased Products:'}</h4>
                  {selectedOrderItems.length > 0 ? (
                    selectedOrderItems.map((item: any, index: number) => {
                      const product = item?.product || {};
                      const productName = isRtl
                        ? product?.name_ar || item?.productNameAr || item?.productName || product?.name || 'منتج'
                        : product?.name_en || item?.productName || item?.productNameAr || product?.name || 'Product';
                      const quantity = Number(item?.quantity || 0);
                      const unitPrice = Number(item?.unitPrice || 0);
                      const totalPrice = Number(item?.totalPrice || (quantity * unitPrice) || 0);

                      return (
                        <div key={`${selectedOrderDetails.id}-${item?.id || index}`} className="bg-neutral-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-neutral-100 flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-neutral-800 dark:text-neutral-100 truncate">{productName}</p>
                            <p className="text-[10px] text-neutral-400 mt-0.5">
                              {isRtl ? `الكمية: ${quantity}` : `Qty: ${quantity}`}
                              {unitPrice ? ` • ${isRtl ? 'سعر الوحدة' : 'Unit'}: ${unitPrice.toFixed(2)} ر.س` : ''}
                            </p>
                          </div>
                          <span className="font-mono font-black text-neutral-900 dark:text-neutral-100 shrink-0">
                            {totalPrice.toFixed(2)} ر.س
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-center text-neutral-400">
                      <Package size={18} className="mx-auto text-neutral-300" />
                      <p className="mt-2 text-xs font-bold text-neutral-700">
                        {isRtl ? 'لا توجد منتجات محفوظة لهذه العملية' : 'No persisted product items found for this record.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-100 pt-3 space-y-1.5 font-mono text-[11px] text-neutral-500">
                  <div className="flex justify-between">
                    <span>{isRtl ? 'الحالة:' : 'Status:'}</span>
                    <span>{selectedOrderDetails.status || selectedOrderDetails.paymentStatus || 'completed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isRtl ? 'المبلغ الإجمالي:' : 'Total Amount:'}</span>
                    <span>{Number(selectedOrderDetails.amount || 0).toFixed(2)} ر.س</span>
                  </div>
                </div>
              </div>

              {/* Receipt Footer close action */}
              <div className="bg-neutral-50 dark:bg-zinc-950/30 px-6 py-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all"
                >
                  {isRtl ? 'إغلاق نافذة الفاتورة' : 'Dismiss Receipt'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
