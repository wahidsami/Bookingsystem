import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { 
  UserCheck, Calendar, TrendingUp, DollarSign, Clock, Star, 
  Settings, Award, Sparkles, Check, X, Download, ShieldCheck, Mail, Phone,
  ArrowLeft, Plus, Trash2, User, Upload, Search, Filter, SlidersHorizontal, Lock, CheckSquare, Square, Globe, Shield, Info
} from 'lucide-react';
import { Language, QuickLaunchRequest } from '../types';

interface TeamsWorkspaceProps {
  lang: Language;
  addEmployeeTrigger?: number;
  onAddEmployeeTriggerReset?: () => void;
  quickLaunchRequest?: QuickLaunchRequest | null;
}

export type TeamSubTab =
  | 'profile'
  | 'schedule'
  | 'performance'
  | 'revenue'
  | 'availability'
  | 'reviews'
  | 'payroll';

export interface TeamMemberData {
  id: string;
  nameEn: string;
  nameAr: string;
  roleEn: string;
  roleAr: string;
  avatar: string;
  rating: number;
  status: 'active' | 'break' | 'off';
  email: string;
  phone: string;
  joinedDate: string;
  bioEn: string;
  bioAr: string;
  experienceEn: string;
  experienceAr: string;
  nationalityAr: string;
  nationalityEn: string;
  gender: 'female' | 'male';
  position: 'service-provider' | 'dashboard-admin';
  specialtiesEn: string[];
  specialtiesAr: string[];
  languagesEn: string[];
  languagesAr: string[];

  // Financial fields
  baseSalary: number;
  commissionRatePct: number;
  serviceCommissionEnabled: boolean;
  productCommissionEnabled: boolean;

  // Schedule fields
  scheduleVisibilityWeeks: number;
  schedule: Array<{
    dayEn: string;
    dayAr: string;
    hours: string;
    status: 'working' | 'off';
    slots: Array<{ time: string; customer: string; service: string; status: 'booked' | 'empty' }>;
    subShifts?: Array<{
      id: string;
      label: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
  scheduleDraft?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleContinues?: boolean;
  draftShifts?: Array<{
    id: string;
    dayOfWeek: number;
    specificDate: string | null;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
    startDate: string | null;
    endDate: string | null;
    label: string;
    isActive: boolean;
    isDraft: boolean;
  }>;

  // Access fields
  staffAppPassword?: string;
  isActive?: boolean;
  dashboardPermissions: {
    view_dashboard: boolean;
    manage_appointments: boolean;
    view_employees: boolean;
    manage_financials: boolean;
    view_reports: boolean;
    manage_settings: boolean;
    
    // Detailed permission keys from REFAH Access Section Guide
    view_appointments?: boolean;
    view_schedules?: boolean;
    view_customers?: boolean;
    view_services?: boolean;
    view_products?: boolean;
    view_orders?: boolean;
    view_financial?: boolean;
    view_bills?: boolean;
    view_pos?: boolean;
    view_messages?: boolean;
    view_reviews?: boolean;
    view_hot_deals?: boolean;
    view_notifications?: boolean;
    view_payroll?: boolean;
    view_subscription?: boolean;
    view_settings?: boolean;
    manage_accounts?: boolean;
  };

  // Performance stats
  bookingsCount: number;
  utilizationRate: number; // %
  retentionRate: number; // %
  noShowCount: number;
  servicesSales: number;
  productSales: number;
  tips: number;
  reviewsList: Array<{
    id: string;
    customer: string;
    service: string;
    rating: number;
    textEn: string;
    textAr: string;
    date: string;
  }>;
}

// Preset Avatars for Elite Refah Staff
const presetAvatars = [
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1594744803329-e58b31de215f?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200'
];

const defaultTeamMember: TeamMemberData = {
  id: '',
  nameEn: 'Unknown',
  nameAr: 'غير معروف',
  roleEn: 'Staff',
  roleAr: 'موظف',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  rating: 5,
  status: 'active',
  email: '',
  phone: '',
  joinedDate: new Date().toISOString().split('T')[0],
  bioEn: '',
  bioAr: '',
  experienceEn: '',
  experienceAr: '',
  nationalityAr: 'سعودية',
  nationalityEn: 'Saudi',
  gender: 'female',
  position: 'service-provider',
  specialtiesEn: [],
  specialtiesAr: [],
  languagesEn: ['English', 'Arabic'],
  languagesAr: ['الإنجليزية', 'العربية'],
  baseSalary: 0,
  commissionRatePct: 0,
  serviceCommissionEnabled: false,
  productCommissionEnabled: false,
  scheduleVisibilityWeeks: 2,
  schedule: [],
  dashboardPermissions: {
    view_dashboard: true,
    manage_appointments: false,
    view_employees: false,
    manage_financials: false,
    view_reports: false,
    manage_settings: false,
    view_appointments: false,
    view_schedules: false,
    view_customers: false,
    view_services: false,
    view_products: false,
    view_orders: false,
    view_financial: false,
    view_bills: false,
    view_pos: false,
    view_messages: false,
    view_reviews: false,
    view_hot_deals: false,
    view_notifications: false,
    view_payroll: false,
    view_subscription: false,
    view_settings: false,
    manage_accounts: false
  },
  bookingsCount: 0,
  utilizationRate: 0,
  retentionRate: 0,
  noShowCount: 0,
  servicesSales: 0,
  productSales: 0,
  tips: 0,
  reviewsList: []
};

export default function TeamsWorkspace({ 
  lang, 
  addEmployeeTrigger = 0, 
  onAddEmployeeTriggerReset,
  quickLaunchRequest
}: TeamsWorkspaceProps) {
  const isRtl = lang === 'ar';

  // State Management
  const [selectedMemberId, setSelectedMemberId] = useState<string>('emp-1');
  const [activeSubTab, setActiveSubTab] = useState<TeamSubTab>('profile');
  const [activeView, setActiveView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  
  // Guided form editor active section
  const [activeFormSection, setActiveFormSection] = useState<'basic' | 'bio' | 'finance' | 'schedule' | 'access'>('basic');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [positionFilter, setPositionFilter] = useState<'all' | 'service-provider' | 'dashboard-admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'break' | 'off'>('all');
  const [sortBy, setSortBy] = useState<'none' | 'name-asc' | 'name-desc' | 'rating-desc' | 'bookings-desc'>('none');

  // Quota Subscription Limit Check (Max 20 members)
  const quotaLimit = 20;

  // Complete Form Data State
  const [formData, setFormData] = useState<TeamMemberData>({
    id: '',
    nameEn: '',
    nameAr: '',
    roleEn: '',
    roleAr: '',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    rating: 5.0,
    status: 'active',
    email: '',
    phone: '',
    joinedDate: new Date().toISOString().split('T')[0],
    bioEn: '',
    bioAr: '',
    experienceEn: '',
    experienceAr: '',
    nationalityAr: 'سعودية',
    nationalityEn: 'Saudi',
    gender: 'female',
    position: 'service-provider',
    specialtiesEn: [],
    specialtiesAr: [],
    languagesEn: ['English', 'Arabic'],
    languagesAr: ['الإنجليزية', 'العربية'],
    baseSalary: 6000,
    commissionRatePct: 15,
    serviceCommissionEnabled: true,
    productCommissionEnabled: false,
    scheduleVisibilityWeeks: 2,
    schedule: [
      { dayEn: 'Sunday', dayAr: 'الأحد', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [] },
      { dayEn: 'Monday', dayAr: 'الاثنين', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [] },
      { dayEn: 'Tuesday', dayAr: 'الثلاثاء', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [] },
      { dayEn: 'Wednesday', dayAr: 'الأربعاء', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [] },
      { dayEn: 'Thursday', dayAr: 'الخميس', hours: '10:00 AM - 09:00 PM', status: 'working', slots: [] },
      { dayEn: 'Friday', dayAr: 'الجمعة', hours: 'Day Off', status: 'off', slots: [] }
    ],
    staffAppPassword: 'Password123!',
    dashboardPermissions: {
      view_dashboard: true,
      manage_appointments: true,
      view_employees: true,
      manage_financials: false,
      view_reports: false,
      manage_settings: false
    },
    bookingsCount: 0,
    utilizationRate: 100,
    retentionRate: 100,
    noShowCount: 0,
    servicesSales: 0,
    productSales: 0,
    tips: 0,
    reviewsList: []
  });

  // Custom Toast Notification State
  const [toasts, setToasts] = useState<Array<{ id: string; msgEn: string; msgAr: string; type: 'success' | 'info' | 'error' }>>([]);
  
  const triggerToast = (en: string, ar: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msgEn: en, msgAr: ar, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Raw mock Team members (preserving old dataset and enriching it)
  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTeamMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const data = await tenantApiAdapter.getEmployees();
      const mapped: TeamMemberData[] = (data?.employees || []).map((emp: any) => ({
        id: emp.id,
        nameEn: emp.name || '',
        nameAr: emp.name || '',
        roleEn: emp.role_en || emp.position || 'Staff',
        roleAr: emp.role_ar || emp.position || 'موظف',
        avatar: emp.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        rating: parseFloat(emp.rating || 5.0),
        status: emp.isActive ? 'active' : 'off',
        email: emp.email || '',
        phone: emp.phone || '',
        joinedDate: emp.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        bioEn: emp.bio_en || '',
        bioAr: emp.bio_ar || '',
        experienceEn: '',
        experienceAr: '',
        nationalityAr: emp.nationality || '',
        nationalityEn: emp.nationality || '',
        gender: emp.gender === 'male' ? 'male' : 'female',
        position: emp.position === 'admin' ? 'dashboard-admin' : 'service-provider',
        specialtiesEn: emp.specialties_en || [],
        specialtiesAr: emp.specialties_ar || [],
        languagesEn: emp.languages_en || [],
        languagesAr: emp.languages_ar || [],
        baseSalary: parseFloat(emp.baseSalary || 0),
        commissionRatePct: parseFloat(emp.commissionRate || 0),
        serviceCommissionEnabled: true,
        productCommissionEnabled: false,
        scheduleVisibilityWeeks: 2,
        schedule: [],
        bookingsCount: parseInt(emp.reviewsCount || 0),
        utilizationRate: 100,
        retentionRate: 100,
        noShowCount: 0,
        servicesSales: 0,
        productSales: 0,
        tips: 0,
        dashboardPermissions: {
          view_dashboard: true,
          manage_appointments: true,
          view_employees: true,
          manage_financials: false,
          view_reports: false,
          manage_settings: false
        },
        reviewsList: []
      }));
      setTeamMembers(mapped);
      if (mapped.length > 0) {
        setSelectedMemberId(prev => prev === 'emp-1' ? mapped[0].id : prev);
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to load team directory', 'فشل في تحميل قائمة الموظفين', 'error');
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  // Handle outside trigger to open add form
  useEffect(() => {
    if (addEmployeeTrigger > 0) {
      handleOpenAddForm();
      if (onAddEmployeeTriggerReset) {
        onAddEmployeeTriggerReset();
      }
    }
  }, [addEmployeeTrigger]);

  useEffect(() => {
    if (quickLaunchRequest?.target !== 'employee') {
      return;
    }

    handleOpenAddForm();
  }, [quickLaunchRequest?.nonce]);

  const activeMember = useMemo(() => {
    return teamMembers.find(t => t.id === selectedMemberId) || teamMembers[0] || defaultTeamMember;
  }, [teamMembers, selectedMemberId]);

  // Search & Filtered Directory List
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = query === '' ||
        m.nameEn.toLowerCase().includes(query) ||
        m.nameAr.toLowerCase().includes(query) ||
        m.roleEn.toLowerCase().includes(query) ||
        m.roleAr.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.phone.includes(query);

      const matchGender = genderFilter === 'all' || m.gender === genderFilter;
      const matchPosition = positionFilter === 'all' || m.position === positionFilter;
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;

      return matchSearch && matchGender && matchPosition && matchStatus;
    }).sort((a, b) => {
      if (sortBy === 'name-asc') {
        return (isRtl ? a.nameAr : a.nameEn).localeCompare(isRtl ? b.nameAr : b.nameEn);
      }
      if (sortBy === 'name-desc') {
        return (isRtl ? b.nameAr : b.nameEn).localeCompare(isRtl ? a.nameAr : a.nameEn);
      }
      if (sortBy === 'rating-desc') {
        return b.rating - a.rating;
      }
      if (sortBy === 'bookings-desc') {
        return b.bookingsCount - a.bookingsCount;
      }
      return 0;
    });
  }, [teamMembers, searchQuery, genderFilter, positionFilter, statusFilter, sortBy, isRtl]);

  // Form Open Triggers
  const handleOpenAddForm = () => {
    if (teamMembers.length >= quotaLimit) {
      triggerToast(
        `Subscription team limit of ${quotaLimit} reached! Upgrade plan to add more.`,
        `لقد بلغت الحد الأقصى لباقة الاشتراك (${quotaLimit} أعضاء). يرجى ترقية الباقة لتعيين المزيد.`,
        'error'
      );
      return;
    }
    setFormMode('add');
    setFormData({
      id: '',
      nameEn: '',
      nameAr: '',
      roleEn: '',
      roleAr: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      rating: 5.0,
      status: 'active',
      email: '',
      phone: '',
      joinedDate: new Date().toISOString().split('T')[0],
      bioEn: '',
      bioAr: '',
      experienceEn: '',
      experienceAr: '',
      nationalityAr: 'سعودية',
      nationalityEn: 'Saudi',
      gender: 'female',
      position: 'service-provider',
      specialtiesEn: [],
      specialtiesAr: [],
      languagesEn: ['English', 'Arabic'],
      languagesAr: ['الإنجليزية', 'العربية'],
      baseSalary: 6000,
      commissionRatePct: 15,
      serviceCommissionEnabled: true,
      productCommissionEnabled: false,
      scheduleVisibilityWeeks: 2,
      scheduleDraft: false,
      scheduleStartDate: new Date().toISOString().split('T')[0],
      scheduleEndDate: '',
      scheduleContinues: true,
      draftShifts: [],
      schedule: [
        { dayEn: 'Sunday', dayAr: 'الأحد', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [], subShifts: [] },
        { dayEn: 'Monday', dayAr: 'الاثنين', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [], subShifts: [] },
        { dayEn: 'Tuesday', dayAr: 'الثلاثاء', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [], subShifts: [] },
        { dayEn: 'Wednesday', dayAr: 'الأربعاء', hours: '10:00 AM - 08:00 PM', status: 'working', slots: [], subShifts: [] },
        { dayEn: 'Thursday', dayAr: 'الخميس', hours: '10:00 AM - 09:00 PM', status: 'working', slots: [], subShifts: [] },
        { dayEn: 'Friday', dayAr: 'الجمعة', hours: 'Day Off', status: 'off', slots: [], subShifts: [] }
      ],
      staffAppPassword: 'Password123!',
      isActive: true,
      dashboardPermissions: {
        view_dashboard: true,
        manage_appointments: true,
        view_employees: true,
        manage_financials: false,
        view_reports: false,
        manage_settings: false,
        
        // Detailed permissions defaulting
        view_appointments: true,
        view_schedules: true,
        view_customers: true,
        view_services: false,
        view_products: false,
        view_orders: false,
        view_financial: false,
        view_bills: false,
        view_pos: false,
        view_messages: false,
        view_reviews: false,
        view_hot_deals: false,
        view_notifications: true,
        view_payroll: false,
        view_subscription: false,
        view_settings: false,
        manage_accounts: false
      },
      bookingsCount: 0,
      utilizationRate: 100,
      retentionRate: 100,
      noShowCount: 0,
      servicesSales: 0,
      productSales: 0,
      tips: 0,
      reviewsList: []
    });
    setActiveFormSection('basic');
    setActiveView('form');
  };

  const handleOpenEditForm = (member: TeamMemberData) => {
    setFormMode('edit');
    setFormData({
      ...member,
      specialtiesEn: [...member.specialtiesEn],
      specialtiesAr: [...member.specialtiesAr],
      languagesEn: [...member.languagesEn],
      languagesAr: [...member.languagesAr],
      scheduleDraft: member.scheduleDraft ?? false,
      scheduleStartDate: member.scheduleStartDate ?? member.joinedDate ?? new Date().toISOString().split('T')[0],
      scheduleEndDate: member.scheduleEndDate ?? '',
      scheduleContinues: member.scheduleContinues ?? true,
      draftShifts: member.draftShifts ?? [],
      schedule: member.schedule.map(s => ({ 
        ...s, 
        slots: [...s.slots],
        subShifts: s.subShifts ? s.subShifts.map(sub => ({ ...sub })) : []
      })),
      isActive: member.isActive ?? true,
      dashboardPermissions: { 
        view_dashboard: member.dashboardPermissions.view_dashboard ?? true,
        manage_appointments: member.dashboardPermissions.manage_appointments ?? true,
        view_employees: member.dashboardPermissions.view_employees ?? true,
        manage_financials: member.dashboardPermissions.manage_financials ?? false,
        view_reports: member.dashboardPermissions.view_reports ?? false,
        manage_settings: member.dashboardPermissions.manage_settings ?? false,
        
        // Extended permissions with safe fallbacks
        view_appointments: member.dashboardPermissions.view_appointments ?? member.dashboardPermissions.manage_appointments ?? true,
        view_schedules: member.dashboardPermissions.view_schedules ?? member.dashboardPermissions.view_employees ?? true,
        view_customers: member.dashboardPermissions.view_customers ?? true,
        view_services: member.dashboardPermissions.view_services ?? false,
        view_products: member.dashboardPermissions.view_products ?? false,
        view_orders: member.dashboardPermissions.view_orders ?? false,
        view_financial: member.dashboardPermissions.view_financial ?? member.dashboardPermissions.manage_financials ?? false,
        view_bills: member.dashboardPermissions.view_bills ?? false,
        view_pos: member.dashboardPermissions.view_pos ?? false,
        view_messages: member.dashboardPermissions.view_messages ?? false,
        view_reviews: member.dashboardPermissions.view_reviews ?? false,
        view_hot_deals: member.dashboardPermissions.view_hot_deals ?? false,
        view_notifications: member.dashboardPermissions.view_notifications ?? true,
        view_payroll: member.dashboardPermissions.view_payroll ?? false,
        view_subscription: member.dashboardPermissions.view_subscription ?? false,
        view_settings: member.dashboardPermissions.view_settings ?? member.dashboardPermissions.manage_settings ?? false,
        manage_accounts: member.dashboardPermissions.manage_accounts ?? false
      }
    });
    setActiveFormSection('basic');
    setActiveView('form');
  };

  // Toggle Live Duty Status on active member
  const handleLiveStatusChange = (newStatus: 'active' | 'break' | 'off') => {
    setTeamMembers(prev => prev.map(m => {
      if (m.id === activeMember.id) {
        return { ...m, status: newStatus };
      }
      return m;
    }));
    triggerToast(
      `Duty status updated to ${newStatus.toUpperCase()}`,
      `تم تحديث حالة العضو إلى ${newStatus === 'active' ? 'نشط في العمل' : newStatus === 'break' ? 'في استراحة' : 'خارج الخدمة'}`,
      'info'
    );
  };

  // Save Team Member Action
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nameEn && !formData.nameAr) {
      triggerToast('Full Name is required.', 'الاسم بالكامل مطلوب.', 'error');
      return;
    }
    if (!formData.phone) {
      triggerToast('Phone number is required.', 'رقم الهاتف مطلوب.', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        name: formData.nameEn || formData.nameAr,
        email: formData.email,
        phone: formData.phone,
        gender: formData.gender,
        position: formData.position === 'dashboard-admin' ? 'admin' : 'staff',
        nationality: formData.nationalityEn || formData.nationalityAr,
        bio_en: formData.bioEn,
        bio_ar: formData.bioAr,
        role_en: formData.roleEn,
        role_ar: formData.roleAr,
        baseSalary: formData.baseSalary,
        commissionRate: formData.commissionRatePct,
        specialties_en: formData.specialtiesEn,
        specialties_ar: formData.specialtiesAr,
        languages_en: formData.languagesEn,
        languages_ar: formData.languagesAr,
        isActive: formData.status === 'active'
      };

      if (formMode === 'add') {
        await tenantApiAdapter.createEmployee(payload);
        triggerToast(
          `Team member "${payload.name}" added successfully!`,
          `تم إضافة عضو الفريق الجديد "${payload.name}" بنجاح!`,
          'success'
        );
      } else {
        await tenantApiAdapter.updateEmployee(formData.id, payload);
        triggerToast(
          `Team member "${payload.name}" updated successfully!`,
          `تم تحديث بيانات عضو الفريق "${payload.name}" بنجاح!`,
          'success'
        );
      }
      
      // Refresh list
      fetchTeamMembers();
      setActiveView('list');
    } catch (err) {
      console.error(err);
      triggerToast('Failed to save team member.', 'حدث خطأ أثناء حفظ بيانات العضو.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Guarded Deletion Action
  const handleDeleteMember = async (id: string) => {
    const target = teamMembers.find(t => t.id === id);
    if (!target) return;

    // Business rule validation: Do not delete if active/booked appointments exist
    if (target.bookingsCount > 0) {
      triggerToast(
        `Cannot delete "${target.nameEn}". Team member has active/completed bookings in ledger.`,
        `لا يمكن حذف ملف "${target.nameAr}". العضو مرتبط بحجوزات ومبيعات مسجلة ومؤكدة مسبقاً.`,
        'error'
      );
      return;
    }

    try {
      setIsSaving(true);
      await tenantApiAdapter.deleteEmployee(id);
      triggerToast(
        `Staff profile deleted successfully.`,
        `تم إزالة ملف الموظفة بالكامل من المستودع بنجاح.`,
        'success'
      );
      
      // Refresh list
      fetchTeamMembers();
    } catch (err) {
      console.error(err);
      triggerToast('Failed to delete team member.', 'فشل في حذف العضو.', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  // Specialty Helper Adders
  const [newSpecialty, setNewSpecialty] = useState('');
  const handleAddSpecialty = () => {
    if (!newSpecialty.trim()) return;
    const cleanSpec = newSpecialty.trim();
    if (!formData.specialtiesEn.includes(cleanSpec)) {
      setFormData(prev => ({
        ...prev,
        specialtiesEn: [...prev.specialtiesEn, cleanSpec],
        specialtiesAr: [...prev.specialtiesAr, cleanSpec]
      }));
    }
    setNewSpecialty('');
  };

  const handleRemoveSpecialty = (index: number) => {
    setFormData(prev => ({
      ...prev,
      specialtiesEn: prev.specialtiesEn.filter((_, i) => i !== index),
      specialtiesAr: prev.specialtiesAr.filter((_, i) => i !== index)
    }));
  };

  // Languages Helper Adders
  const [newLangInput, setNewLangInput] = useState('');
  const handleAddLanguage = () => {
    if (!newLangInput.trim()) return;
    const cleanLang = newLangInput.trim();
    if (!formData.languagesEn.includes(cleanLang)) {
      setFormData(prev => ({
        ...prev,
        languagesEn: [...prev.languagesEn, cleanLang],
        languagesAr: [...prev.languagesAr, cleanLang]
      }));
    }
    setNewLangInput('');
  };

  const handleRemoveLanguage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      languagesEn: prev.languagesEn.filter((_, i) => i !== index),
      languagesAr: prev.languagesAr.filter((_, i) => i !== index)
    }));
  };

  // AI Fill / Copy Assistance
  const handleAIAssistFill = () => {
    if (!formData.nameEn && !formData.nameAr) {
      triggerToast(
        'Please input at least one full name to allow context writing.',
        'يرجى إدخال اسم بلغة واحدة على الأقل لتمكين توليد الوصف والسير الذاتية.',
        'error'
      );
      return;
    }
    const name = formData.nameEn || formData.nameAr;
    triggerToast('AI generating professional wellness bio, experience metrics and skills...', 'الذكاء الاصطناعي يقوم بصياغة التفاصيل المهنية والمهارات الفنية...', 'info');

    setTimeout(() => {
      setFormData(prev => ({
        ...prev,
        bioEn: `A master practitioner of premier beauty, specializing in luxury treatment routines. Holds advanced certificates with a flawless client retention history.`,
        bioAr: `أخصائية وخبيرة معتمدة محلياً ودولياً في العناية المتكاملة والحلول التجميلية الفاخرة. تمتلك سجلاً حافلاً بالتميز والعملاء الدائمين.`,
        experienceEn: '6 Years',
        experienceAr: '٦ سنوات',
        specialtiesEn: prev.specialtiesEn.length > 0 ? prev.specialtiesEn : ['Thermal Hydration', 'Elite Balayage', 'Nail Overlay'],
        specialtiesAr: prev.specialtiesAr.length > 0 ? prev.specialtiesAr : ['الترطيب الحراري الشامل', 'البالياج السويسري', 'بناء الجل للأظافر']
      }));
      triggerToast('AI assistance profiles filled!', 'تم صياغة السيرة الذاتية والتخصصات بواسطة الذكاء الاصطناعي بنجاح.', 'success');
    }, 1100);
  };

  // Schedule Shift Timings Helper
  const handleScheduleDayToggle = (dayIndex: number) => {
    setFormData(prev => {
      const updated = [...prev.schedule];
      const target = updated[dayIndex];
      const nextStatus = target.status === 'working' ? 'off' : 'working';
      updated[dayIndex] = {
        ...target,
        status: nextStatus,
        hours: nextStatus === 'off' ? 'Day Off' : '10:00 AM - 08:00 PM'
      };
      return { ...prev, schedule: updated };
    });
  };

  const handleScheduleHoursChange = (dayIndex: number, val: string) => {
    setFormData(prev => {
      const updated = [...prev.schedule];
      updated[dayIndex] = {
        ...updated[dayIndex],
        hours: val
      };
      return { ...prev, schedule: updated };
    });
  };

  const handleAddSubShift = (dayIndex: number) => {
    setFormData(prev => {
      const updated = [...prev.schedule];
      const day = updated[dayIndex];
      const subShifts = day.subShifts ? [...day.subShifts] : [];
      subShifts.push({
        id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: isRtl ? 'شيفت مسائي' : 'Evening Shift',
        startTime: '06:00 PM',
        endTime: '09:00 PM'
      });
      updated[dayIndex] = { ...day, subShifts };
      return { ...prev, schedule: updated };
    });
  };

  const handleRemoveSubShift = (dayIndex: number, subShiftId: string) => {
    setFormData(prev => {
      const updated = [...prev.schedule];
      const day = updated[dayIndex];
      if (day.subShifts) {
        updated[dayIndex] = {
          ...day,
          subShifts: day.subShifts.filter(s => s.id !== subShiftId)
        };
      }
      return { ...prev, schedule: updated };
    });
  };

  const handleSubShiftChange = (dayIndex: number, subShiftId: string, field: 'label' | 'startTime' | 'endTime', value: string) => {
    setFormData(prev => {
      const updated = [...prev.schedule];
      const day = updated[dayIndex];
      if (day.subShifts) {
        updated[dayIndex] = {
          ...day,
          subShifts: day.subShifts.map(s => s.id === subShiftId ? { ...s, [field]: value } : s)
        };
      }
      return { ...prev, schedule: updated };
    });
  };

  const applyRolePreset = (preset: string) => {
    const emptyPerms = {
      view_dashboard: false,
      manage_appointments: false,
      view_employees: false,
      manage_financials: false,
      view_reports: false,
      manage_settings: false,
      view_appointments: false,
      view_schedules: false,
      view_customers: false,
      view_services: false,
      view_products: false,
      view_orders: false,
      view_financial: false,
      view_bills: false,
      view_pos: false,
      view_messages: false,
      view_reviews: false,
      view_hot_deals: false,
      view_notifications: false,
      view_payroll: false,
      view_subscription: false,
      view_settings: false,
      manage_accounts: false
    };
    
    let updated = { ...emptyPerms };
    
    if (preset === 'manager') {
      Object.keys(updated).forEach(k => { updated[k as keyof typeof updated] = true; });
    } else if (preset === 'accountant') {
      updated.view_dashboard = true;
      updated.view_financial = true;
      updated.view_reports = true;
      updated.view_payroll = true;
      updated.view_bills = true;
      updated.manage_financials = true;
    } else if (preset === 'receptionist') {
      updated.view_dashboard = true;
      updated.view_appointments = true;
      updated.manage_appointments = true;
      updated.view_schedules = true;
      updated.view_customers = true;
      updated.view_messages = true;
      updated.view_notifications = true;
    } else if (preset === 'marketing') {
      updated.view_dashboard = true;
      updated.view_reports = true;
      updated.view_hot_deals = true;
      updated.view_reviews = true;
    } else if (preset === 'hr') {
      updated.view_dashboard = true;
      updated.view_employees = true;
      updated.view_payroll = true;
      updated.view_schedules = true;
    } else if (preset === 'service-provider') {
      updated.view_dashboard = true;
      updated.view_schedules = true;
      updated.view_appointments = true;
      updated.view_reviews = true;
    }
    
    setFormData(p => ({
      ...p,
      dashboardPermissions: {
        ...p.dashboardPermissions,
        ...updated
      }
    }));
  };

  // Net Payable salary calculations
  const serviceCommEarned = Math.round((activeMember.servicesSales * activeMember.commissionRatePct) / 100);
  const productCommEarned = activeMember.productCommissionEnabled ? Math.round((activeMember.productSales * 5) / 100) : 0;
  const netPayrollTotal = activeMember.baseSalary + serviceCommEarned + productCommEarned + activeMember.tips;

  // Export CSV Payslip
  const handleExportPayslip = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `Refah Beauty Salon - Official Teams Payslip\r\n`;
    csvContent += `Employee: ${activeMember.nameEn} (${activeMember.nameAr})\r\n`;
    csvContent += `Position: ${activeMember.roleEn}\r\n`;
    csvContent += `Base Salary: SAR ${activeMember.baseSalary}\r\n`;
    csvContent += `Service Commission (${activeMember.commissionRatePct}%): SAR ${serviceCommEarned}\r\n`;
    csvContent += `Product Commission (5% flat if active): SAR ${productCommEarned}\r\n`;
    csvContent += `Tips Reconciled: SAR ${activeMember.tips}\r\n`;
    csvContent += `Net Payable Salary: SAR ${netPayrollTotal}\r\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payslip_${activeMember.nameEn.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast("Payslip CSV exported successfully.", "تم إنتاج وتصدير كشف الراتب والمستحقات بنجاح.");
  };

  return (
    <div className="space-y-6 font-sans text-neutral-800" id="teams-workspace-crm-module">
      
      {/* Dynamic Notifications Stack */}
      <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex flex-col gap-3 max-w-sm w-full`}>
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 35, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              className="bg-white border border-slate-200/95 shadow-2xl p-4 rounded-xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className={`absolute top-0 bottom-0 w-1 ${isRtl ? 'right-0' : 'left-0'} ${
                t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'
              }`} />
              <span className={`p-1.5 rounded-lg shrink-0 ${
                t.type === 'success' ? 'bg-emerald-50 text-emerald-600' : t.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {t.type === 'success' ? <Check size={14} /> : <Info size={14} />}
              </span>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-black text-neutral-800 leading-normal">
                  {isRtl ? t.msgAr : t.msgEn}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {activeView === 'list' ? (
        <div className="space-y-6" id="teams-directory-dashboard-view">
          
          {/* Subscription & Information Header Block */}
          <div className="bg-gradient-to-r from-zinc-950 via-neutral-900 to-slate-950 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transform translate-x-12 -translate-y-6">
              <UserCheck size={240} />
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-black tracking-widest bg-amber-400/20 border border-amber-400/20 px-2.5 py-1 rounded-full text-amber-300">
                    {isRtl ? 'باقة إدارة الكوادر المتكاملة' : 'Enterprise Team Manager Ledger'}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-500/30 px-2 py-0.5 rounded text-emerald-200 border border-emerald-500/20">
                    {isRtl ? 'البرنامج موثق وممتثل للعمل' : 'Qiwa WPS Compliant'}
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black font-sans leading-tight">
                  {isRtl ? 'إدارة الفرق وجداول الموظفين وصلاحيات الوصول' : 'Teams Hub & Workforce Scheduler'}
                </h2>
                <p className="text-xs text-neutral-300 max-w-2xl">
                  {isRtl 
                    ? 'قم بإدارة فريق عمل الصالون الفني والوصول اللحظي ومراقبة كشوف الرواتب ومسيرات حماية الأجور المعتمدة.' 
                    : 'Configure specialists directory, manage live rosters, dispatch staff app credentials and track Unified payroll payouts.'}
                </p>
              </div>

              {/* Quota limit tracker */}
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0 md:w-64 space-y-2">
                <div className="flex justify-between text-xs font-black">
                  <span>{isRtl ? 'حصة الفريق المستهلكة' : 'Teams Quota Used'}</span>
                  <span>{teamMembers.length} / {quotaLimit}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500" 
                    style={{ width: `${(teamMembers.length / quotaLimit) * 100}%` }}
                  />
                </div>
                <p className="text-[9px] text-neutral-400 font-bold">
                  {isRtl 
                    ? `متبقي لك تعيين ${quotaLimit - teamMembers.length} موظفين في باقتك` 
                    : `You can add ${quotaLimit - teamMembers.length} more specialists.`}
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Search & Directory Filters Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-3.5 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'ابحث بالاسم، البريد، الجوال، أو المسمى المهني...' : 'Search specialists by name, role, email or phone...'}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:ring-1 focus:ring-zinc-900 rounded-xl pl-9 pr-4 py-2.5 text-xs text-neutral-800 font-bold"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3.5 text-neutral-400 hover:text-neutral-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtering Stack */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Position / Role type filter */}
                <select
                  value={positionFilter}
                  onChange={e => setPositionFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-zinc-900 text-xs font-bold text-neutral-700 py-2.5 px-3 rounded-xl"
                >
                  <option value="all">{isRtl ? 'كل أنواع الوظائف' : 'All Access Types'}</option>
                  <option value="service-provider">{isRtl ? 'كادر فني (تطبيق)' : 'Service Provider'}</option>
                  <option value="dashboard-admin">{isRtl ? 'إدارة (لوحة تحكم)' : 'Dashboard Admin'}</option>
                </select>

                {/* Duty status filter */}
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-zinc-900 text-xs font-bold text-neutral-700 py-2.5 px-3 rounded-xl"
                >
                  <option value="all">{isRtl ? 'كل الحالات اللحظية' : 'All Live States'}</option>
                  <option value="active">{isRtl ? 'نشط في العمل' : 'Active Duty'}</option>
                  <option value="break">{isRtl ? 'في استراحة' : 'On Break'}</option>
                  <option value="off">{isRtl ? 'خارج العمل' : 'Off Duty'}</option>
                </select>

                {/* Sorter */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-zinc-900 text-xs font-bold text-neutral-700 py-2.5 px-3 rounded-xl"
                >
                  <option value="none">{isRtl ? 'ترتيب افتراضي' : 'Default Sorting'}</option>
                  <option value="name-asc">{isRtl ? 'الاسم: أ - ي' : 'Name: A - Z'}</option>
                  <option value="name-desc">{isRtl ? 'الاسم: ي - أ' : 'Name: Z - A'}</option>
                  <option value="rating-desc">{isRtl ? 'الأعلى تقييماً' : 'Highest Rated ★'}</option>
                  <option value="bookings-desc">{isRtl ? 'الأكثر حجوزات' : 'Most Bookings'}</option>
                </select>

                {/* Clear triggers */}
                {(searchQuery !== '' || positionFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'none') && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setPositionFilter('all');
                      setStatusFilter('all');
                      setSortBy('none');
                    }}
                    className="p-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
                  >
                    {isRtl ? 'إعادة ضبط' : 'Reset'}
                  </button>
                )}

                {/* Onboard Team Member Button */}
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-neutral-900 text-white font-black text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} className="text-amber-400" />
                  <span>{isRtl ? 'تعيين موظف جديد' : 'Add Team Member'}</span>
                </button>

              </div>
            </div>
          </div>

          {/* Master Detail Grid Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Team Directory Directory Index */}
            <div className="xl:col-span-4 space-y-3">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1 block">
                {isRtl ? `دليل الكادر (${filteredMembers.length})` : `Team Index List (${filteredMembers.length})`}
              </span>
              
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-xs p-2 space-y-1">
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-400 font-bold">
                    {isRtl ? 'لا يوجد أعضاء يطابقون خيارات البحث.' : 'No team members match filters.'}
                  </div>
                ) : (
                  filteredMembers.map(member => {
                    const isSelected = member.id === selectedMemberId;
                    return (
                      <div
                        key={member.id}
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`w-full p-3 rounded-xl text-start transition-all cursor-pointer flex items-center gap-3 border group ${
                          isSelected 
                            ? 'bg-zinc-950 text-white border-zinc-950 shadow-md' 
                            : 'bg-white text-neutral-600 hover:bg-neutral-50 border-neutral-100/70'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-neutral-100 bg-neutral-100 relative">
                          <img src={member.avatar} alt={member.nameEn} className="w-full h-full object-cover" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-xs truncate">{isRtl ? member.nameAr : member.nameEn}</p>
                          <p className={`text-[10px] font-bold truncate mt-0.5 ${isSelected ? 'text-amber-300' : 'text-neutral-400'}`}>
                            {isRtl ? member.roleAr : member.roleEn}
                          </p>
                          
                          {/* Mini badges */}
                          <div className="flex gap-2 mt-1 items-center">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                              member.position === 'service-provider' 
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {member.position === 'service-provider' ? (isRtl ? 'مقدم خدمة' : 'Provider') : (isRtl ? 'إدارة' : 'Admin')}
                            </span>
                            <span className="text-[8px] text-neutral-400 font-bold flex items-center gap-0.5">
                              ⭐ {member.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>

                        {/* Status Dots or actions */}
                        <div className="flex flex-col items-end gap-2.5 shrink-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            member.status === 'active' ? 'bg-emerald-500' : member.status === 'break' ? 'bg-amber-500' : 'bg-neutral-300'
                          }`} />

                          {/* Quick delete with confirmation block */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMember(member.id);
                            }}
                            className={`p-1 text-neutral-400 hover:text-rose-500 rounded transition-colors ${
                              isSelected ? 'group-hover:block hidden' : ''
                            }`}
                            title={isRtl ? 'حذف ملف الموظف' : 'Delete Member Record'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Tabbed Member Profile Workspace Details */}
            <div className="xl:col-span-8 space-y-4">
              
              {/* Upper Header info card */}
              <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 border border-neutral-100 bg-neutral-100 relative">
                    <img src={activeMember.avatar} alt={activeMember.nameEn} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-neutral-800">{isRtl ? activeMember.nameAr : activeMember.nameEn}</h2>
                    <p className="text-xs text-indigo-600 font-extrabold mt-0.5">{isRtl ? activeMember.roleAr : activeMember.roleEn}</p>
                    <p className="text-[10px] text-neutral-400 font-bold">{isRtl ? 'تاريخ المباشرة: ' : 'Joined Refah: '} {activeMember.joinedDate}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleOpenEditForm(activeMember)}
                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <Settings size={14} />
                    <span>{isRtl ? 'إدارة وتعديل الملف المهني كامل' : 'Edit Full Roster Profile'}</span>
                  </button>

                  {/* Active duty controller */}
                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                    {[
                      { id: 'active', labelEn: 'On Duty', labelAr: 'في العمل' },
                      { id: 'break', labelEn: 'On Break', labelAr: 'استراحة' },
                      { id: 'off', labelEn: 'Off Duty', labelAr: 'خارج الخدمة' }
                    ].map(st => {
                      const isCurrent = activeMember.status === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleLiveStatusChange(st.id as any)}
                          className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all cursor-pointer ${
                            isCurrent 
                              ? 'bg-zinc-950 text-white shadow-2xs' 
                              : 'bg-white text-neutral-500 hover:bg-neutral-100'
                          }`}
                        >
                          {isRtl ? st.labelAr : st.labelEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Roster Tabbed Subnavigation */}
              <div className="flex flex-wrap gap-1 border-b border-neutral-100 pb-2">
                {[
                  { id: 'profile', labelEn: 'Roster Profile', labelAr: 'الملف المهني', icon: Sparkles },
                  { id: 'schedule', labelEn: 'Shift Matrix', labelAr: 'جدول المواعيد والشيفت', icon: Calendar },
                  { id: 'performance', labelEn: 'KPI Stats', labelAr: 'الأداء والتقييم', icon: TrendingUp },
                  { id: 'revenue', labelEn: 'Commissions', labelAr: 'الإيرادات والعمولات', icon: DollarSign },
                  { id: 'availability', labelEn: 'Working Hours', labelAr: 'ساعات العمل والمغادرات', icon: Clock },
                  { id: 'reviews', labelEn: 'Client Reviews', labelAr: 'آراء العملاء', icon: Star },
                  { id: 'payroll', labelEn: 'Payroll Hub', labelAr: 'مسير الرواتب المعتمد', icon: ShieldCheck }
                ].map(tab => {
                  const isSel = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id as TeamSubTab)}
                      className={`p-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                        isSel 
                          ? 'bg-zinc-950 text-white font-extrabold shadow-sm' 
                          : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                      }`}
                    >
                      <tab.icon size={13} className={isSel ? 'text-amber-400' : 'text-neutral-400'} />
                      <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
                    </button>
                  );
                })}
              </div>

              {/* Workspace detailed content cards */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-xs min-h-[350px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSubTab + '-' + activeMember.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.1 }}
                    className="space-y-5"
                  >
                    {/* 1. PROFILE CARD */}
                    {activeSubTab === 'profile' && (
                      <div className="space-y-5 text-xs font-semibold text-neutral-600">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{isRtl ? 'النبذة المهنية والذاتية' : 'Staff Bio / Biography'}</p>
                          <p className="text-neutral-800 text-xs font-medium leading-relaxed italic">
                            "{isRtl ? activeMember.bioAr || 'لم تكتب نبذة بعد.' : activeMember.bioEn || 'No bio written yet.'}"
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-slate-50 pb-1">{isRtl ? 'بيانات الاتصال والهوية' : 'Identity & Contact info'}</p>
                            <div className="space-y-2 text-neutral-700">
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-400 flex items-center gap-1"><Mail size={12} /> {isRtl ? 'البريد الإلكتروني' : 'Email:'}</span>
                                <span className="font-mono font-bold">{activeMember.email || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-400 flex items-center gap-1"><Phone size={12} /> {isRtl ? 'رقم الجوال' : 'Phone:'}</span>
                                <span className="font-mono font-bold">{activeMember.phone || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-400 flex items-center gap-1"><Globe size={12} /> {isRtl ? 'الجنسية والوطن' : 'Nationality:'}</span>
                                <span className="font-bold">{isRtl ? activeMember.nationalityAr : activeMember.nationalityEn}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-400 flex items-center gap-1"><User size={12} /> {isRtl ? 'الجنس' : 'Gender:'}</span>
                                <span className="font-bold">{activeMember.gender === 'female' ? (isRtl ? 'أنثى' : 'Female') : (isRtl ? 'ذكر' : 'Male')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-slate-50 pb-1 mb-2">{isRtl ? 'التخصصات والمهارات الفنية' : 'Specialties & Expertises'}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(isRtl ? activeMember.specialtiesAr : activeMember.specialtiesEn).length === 0 ? (
                                  <span className="text-neutral-400 text-[11px] italic">{isRtl ? 'لا توجد تخصصات مضافة' : 'No specialties added yet.'}</span>
                                ) : (
                                  (isRtl ? activeMember.specialtiesAr : activeMember.specialtiesEn).map((sp, idx) => (
                                    <span key={idx} className="bg-indigo-50 text-indigo-900 border border-indigo-100 px-2.5 py-1 rounded-lg text-[10px] font-extrabold">
                                      💎 {sp}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider border-b border-slate-50 pb-1 mb-2">{isRtl ? 'اللغات المتحدثة' : 'Spoken Languages'}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(isRtl ? activeMember.languagesAr : activeMember.languagesEn).map((lg, idx) => (
                                  <span key={idx} className="bg-slate-100 text-neutral-700 px-2 py-0.5 rounded text-[9px] font-bold">
                                    🌍 {lg}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. SCHEDULE MATRIX */}
                    {activeSubTab === 'schedule' && (
                      <div className="space-y-4">
                        {activeMember.schedule.length === 0 ? (
                          <div className="text-center py-12 space-y-2">
                            <Calendar size={32} className="text-neutral-300 mx-auto" />
                            <p className="text-xs text-neutral-400 font-bold">{isRtl ? 'لا توجد مواعيد مجدولة أو شيفتات عمل معينة لهذا الموظف.' : 'No active shifts or scheduled bookings registered for today.'}</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {activeMember.schedule.map((day, idx) => (
                              <div key={idx} className="border border-neutral-100 rounded-xl overflow-hidden text-xs">
                                <div className="bg-neutral-50 p-2.5 px-3 flex justify-between font-bold text-neutral-700">
                                  <span>📅 {isRtl ? day.dayAr : day.dayEn}</span>
                                  <span className="text-[10px] text-amber-800 bg-amber-50 px-2 rounded-full font-mono font-black">{day.hours}</span>
                                </div>

                                <div className="p-3 divide-y divide-neutral-100">
                                  {day.slots.length === 0 ? (
                                    <p className="text-neutral-400 text-[10px] py-1.5">{isRtl ? 'لا توجد حجوزات عملاء - الساعات شاغرة ومتاحة للطلب' : 'No client bookings - time slots are open and ready for reserve'}</p>
                                  ) : (
                                    day.slots.map((slot, sIdx) => (
                                      <div key={sIdx} className="py-2 flex justify-between items-center">
                                        <span className="font-mono text-neutral-400 font-bold">{slot.time}</span>
                                        {slot.status === 'booked' ? (
                                          <div className="text-end">
                                            <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black inline-block">
                                              BOOKED
                                            </span>
                                            <p className="text-[10px] text-neutral-600 font-bold mt-0.5">{slot.customer} • {slot.service}</p>
                                          </div>
                                        ) : (
                                          <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded">
                                            AVAILABLE
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. KPI PERFORMANCE METRICS */}
                    {activeSubTab === 'performance' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">{isRtl ? 'حجوزات هذا الشهر' : 'Total Bookings'}</span>
                            <p className="text-xl font-black text-neutral-800 font-mono mt-0.5">{activeMember.bookingsCount}</p>
                          </div>
                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">{isRtl ? 'نسبة استغلال الوقت' : 'Time Utilization'}</span>
                            <p className="text-xl font-black text-neutral-800 font-mono mt-0.5">{activeMember.utilizationRate}%</p>
                          </div>
                          <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider block">{isRtl ? 'نسبة الاحتفاظ بالعملاء' : 'Customer Return Rate'}</span>
                            <p className="text-xl font-black text-neutral-800 font-mono mt-0.5">{activeMember.retentionRate}%</p>
                          </div>
                          <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                            <span className="text-[9px] font-bold text-rose-500 uppercase tracking-wider block">{isRtl ? 'مرات عدم حضور العميل' : 'No-Show Incidents'}</span>
                            <p className="text-xl font-black text-rose-700 font-mono mt-0.5">{activeMember.noShowCount}</p>
                          </div>
                        </div>

                        {/* Progress bars visualizer */}
                        <div className="space-y-3 bg-neutral-50/50 p-4 rounded-xl border border-neutral-100 text-xs">
                          <p className="font-extrabold text-[10px] text-neutral-400 uppercase tracking-wider">{isRtl ? 'مخطط تحليل كفاءة وإنتاجية الكادر' : 'Staff Efficiency KPI Gauge'}</p>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between font-bold text-neutral-600">
                              <span>{isRtl ? 'معدل الحجوزات الممتلئة من الجدول' : ' Roster Booking Utilization Capacity'}</span>
                              <span className="font-mono">{activeMember.utilizationRate}%</span>
                            </div>
                            <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-zinc-950 h-full" style={{ width: `${activeMember.utilizationRate}%` }} />
                            </div>
                          </div>

                          <div className="space-y-1 pt-2">
                            <div className="flex justify-between font-bold text-neutral-600">
                              <span>{isRtl ? 'معدل عودة العميل لإعادة الخدمة' : 'Client Return & Loyalty Ratio'}</span>
                              <span className="font-mono">{activeMember.retentionRate}%</span>
                            </div>
                            <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full" style={{ width: `${activeMember.retentionRate}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. REVENUE & COMMISSION */}
                    {activeSubTab === 'revenue' && (
                      <div className="space-y-4">
                        {/* Threshold Settings Info Block */}
                        <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-2 text-xs">
                          <p className="font-black text-[10px] text-neutral-400 uppercase tracking-wider">{isRtl ? 'إعدادات وقواعد العمولات النشطة' : 'Active Commissions Threshold Rules'}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-neutral-600 font-bold">
                            <div className="flex justify-between bg-white p-2 rounded border border-neutral-150">
                              <span>{isRtl ? 'حالة عمولة الخدمات:' : 'Service Commission Status:'}</span>
                              <span className={activeMember.serviceCommissionEnabled ? 'text-emerald-600' : 'text-rose-500'}>
                                {activeMember.serviceCommissionEnabled ? (isRtl ? 'نشط ومفعل' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}
                              </span>
                            </div>
                            <div className="flex justify-between bg-white p-2 rounded border border-neutral-150">
                              <span>{isRtl ? 'حالة عمولة مبيعات المنتجات (٥٪):' : 'Product Sales Commission (5%):'}</span>
                              <span className={activeMember.productCommissionEnabled ? 'text-emerald-600' : 'text-rose-500'}>
                                {activeMember.productCommissionEnabled ? (isRtl ? 'نشط ومفعل' : 'Active') : (isRtl ? 'معطل' : 'Disabled')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Calculations */}
                        <div className="border border-neutral-100 rounded-xl overflow-hidden text-xs">
                          <div className="bg-neutral-50 p-2.5 font-bold text-neutral-700">
                            💰 {isRtl ? 'كشف تفاصيل الأرباح والمبيعات المحققة' : 'Gross Performance Revenue Breakdown'}
                          </div>
                          <div className="p-4 space-y-3 font-semibold text-neutral-600">
                            <div className="flex justify-between">
                              <span>{isRtl ? 'مبيعات الخدمات الإجمالية للعملاء:' : 'Gross Service Value Produced:'}</span>
                              <span className="font-mono text-neutral-800">{activeMember.servicesSales.toLocaleString()} SAR</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{isRtl ? 'العمولة المستحقة على الخدمات:' : 'Calculated Service Commission:'}</span>
                              <span className="font-mono text-emerald-600 font-bold">
                                {activeMember.serviceCommissionEnabled ? `+${serviceCommEarned.toLocaleString()} SAR (${activeMember.commissionRatePct}%)` : '0 SAR (Disabled)'}
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-neutral-100">
                              <span>{isRtl ? 'إجمالي مبيعات المنتجات بالتجزئة:' : 'Gross Products Value Sold:'}</span>
                              <span className="font-mono text-neutral-800">{activeMember.productSales.toLocaleString()} SAR</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{isRtl ? 'العمولة المستحقة على مبيعات المنتجات:' : 'Calculated Product Commission:'}</span>
                              <span className="font-mono text-emerald-600 font-bold">
                                {activeMember.productCommissionEnabled ? `+${productCommEarned.toLocaleString()} SAR (5%)` : '0 SAR (Disabled)'}
                              </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-neutral-100">
                              <span>{isRtl ? 'إجمالي مبالغ البخشيش المحصلة:' : 'Tips & Direct Gratuities:'}</span>
                              <span className="font-mono text-neutral-800">+{activeMember.tips.toLocaleString()} SAR</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. AVAILABILITY HOURS */}
                    {activeSubTab === 'availability' && (
                      <div className="space-y-3 text-xs font-bold text-neutral-600">
                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">{isRtl ? 'أوقات العمل الأسبوعية المعتمدة' : 'Official Registered Weekly Shifts'}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {activeMember.schedule.map((day, idx) => (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex justify-between items-center">
                              <span className="text-neutral-700">📅 {isRtl ? day.dayAr : day.dayEn}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-neutral-500">{day.hours}</span>
                                <span className={`w-2 h-2 rounded-full ${day.status === 'working' ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 6. REVIEWS */}
                    {activeSubTab === 'reviews' && (
                      <div className="space-y-3">
                        {activeMember.reviewsList.length === 0 ? (
                          <p className="text-xs text-neutral-400 italic text-center py-6">{isRtl ? 'لا توجد مراجعات أو تقييمات مسجلة لهذا العضو حتى الآن.' : 'No direct client feedback reviews logged yet.'}</p>
                        ) : (
                          activeMember.reviewsList.map(rev => (
                            <div key={rev.id} className="bg-neutral-50/70 p-3 rounded-xl border border-neutral-100 space-y-2 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-neutral-700">👤 {rev.customer}</span>
                                <span className="font-mono text-neutral-400 text-[10px]">{rev.date}</span>
                              </div>
                              <div className="flex items-center gap-0.5 text-amber-500">
                                {Array.from({ length: Math.floor(rev.rating) }).map((_, i) => (
                                  <Star key={i} size={11} fill="currentColor" />
                                ))}
                              </div>
                              <p className="text-neutral-600 font-medium italic">
                                "{isRtl ? rev.textAr : rev.textEn}"
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* 7. PAYROLL HUB */}
                    {activeSubTab === 'payroll' && (
                      <div className="space-y-4">
                        <div className="bg-zinc-950 text-white p-5 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">{isRtl ? 'Unified Monthly Net Payable' : 'Unified Monthly Net Payable'}</span>
                              <h4 className="text-2xl font-black text-amber-400 font-mono tracking-tight mt-1">
                                {netPayrollTotal.toLocaleString()} <span className="text-xs font-bold text-neutral-400">SAR</span>
                              </h4>
                            </div>
                            <button
                              onClick={handleExportPayslip}
                              className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-white font-bold p-2 px-4 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                              <Download size={13} />
                              <span>{isRtl ? 'تصدير الكشف (CSV)' : 'Payslip CSV'}</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-850 text-center text-xs">
                            <div>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase block">{isRtl ? 'الراتب الأساسي' : 'Base Salary'}</span>
                              <p className="font-mono font-bold text-white mt-0.5">{activeMember.baseSalary.toLocaleString()} SAR</p>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase block">{isRtl ? 'العمولة المستحقة' : 'Commissions'}</span>
                              <p className="font-mono font-bold text-emerald-400 mt-0.5">+{(serviceCommEarned + productCommEarned).toLocaleString()} SAR</p>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-neutral-400 uppercase block">{isRtl ? 'البخشيش الفعلي' : 'Tips Collected'}</span>
                              <p className="font-mono font-bold text-white mt-0.5">+{activeMember.tips.toLocaleString()} SAR</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200/50 p-3 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                          <Award size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-black text-[10px] uppercase tracking-wider">{isRtl ? 'الالتزام بمكتب العمل السعودي ونظام حماية الأجور (WPS)' : 'Saudi Qiwa & WPS Compliance Note'}</p>
                            <p className="text-[11px] font-medium mt-0.5">
                              {isRtl 
                                ? 'يتم معالجة مسيرات رواتب موظفي رفاه وصرفها عبر نظام حماية الأجور (WPS) المعتمد لمواءمة متطلبات بوابة قوى وتفادي الغرامات المالية.' 
                                : 'Salary disbursement is logged and aligned with the Ministry of Human Resources Wage Protection requirements via bank payroll proxy portals.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>
          </div>

        </div>
      ) : (
        /* GUIDED MULTI-SECTION ROSTER PROFILE FORM */
        <div className="bg-white rounded-3xl border border-neutral-200/60 shadow-md overflow-hidden animate-fade-in" id="roster-guided-form-editor">
          
          {/* Header Panel */}
          <div className="bg-zinc-950 text-white p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView('list')}
                className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer border border-neutral-800"
              >
                <ArrowLeft size={16} className={isRtl ? 'transform rotate-180' : ''} />
              </button>
              <div>
                <span className="text-[9px] uppercase tracking-widest text-amber-400 font-black block">
                  {isRtl ? 'بوابة تعيين وتهيئة الكادر' : 'REFAH TEAM ROSTER CREATOR'}
                </span>
                <h2 className="text-base font-black">
                  {formMode === 'add' 
                    ? (isRtl ? 'تعيين وتهيئة عضو فريق جديد' : 'Onboard & Setup New Team Member')
                    : (isRtl ? `تحديث الملف المهني: ${formData.nameAr || formData.nameEn}` : `Configure Profile: ${formData.nameEn || formData.nameAr}`)}
                </h2>
              </div>
            </div>

            {/* AI Assist button */}
            <button
              type="button"
              onClick={handleAIAssistFill}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-white/10"
            >
              <Sparkles size={13} className="text-amber-300" />
              <span>{isRtl ? 'توليد النبذة بالذكاء الاصطناعي' : 'AI Context Generator'}</span>
            </button>
          </div>

          {/* Form Content layout with Guided Section Navigator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
            
            {/* Left guided Section Navigator Sidebar */}
            <div className="lg:col-span-3 bg-slate-50/50 border-r border-slate-150 p-4 space-y-1">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-1.5 pb-2 block">
                {isRtl ? 'خطوات التهيئة المعيارية' : 'Standard Onboarding Steps'}
              </span>

              {[
                { id: 'basic', labelEn: '1. Basic Identity', labelAr: '١. الهوية والاتصال', icon: User },
                { id: 'bio', labelEn: '2. Bio & Specialties', labelAr: '٢. النبذة والخبرات', icon: Sparkles },
                { id: 'finance', labelEn: '3. Finance Rules', labelAr: '٣. قواعد المستحقات والرواتب', icon: DollarSign },
                { id: 'schedule', labelEn: '4. Shift Matrix', labelAr: '٤. جدول العمل والشيفت', icon: Calendar },
                { id: 'access', labelEn: '5. Access Paths & Security', labelAr: '٥. الأمن والوصول اللحظي', icon: Shield }
              ].map(sec => {
                const isActive = activeFormSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveFormSection(sec.id as any)}
                    className={`w-full text-start px-3.5 py-3 rounded-xl text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-zinc-950 text-white shadow-sm' 
                        : 'text-neutral-500 hover:bg-slate-100 hover:text-neutral-800'
                    }`}
                  >
                    <sec.icon size={13} className={isActive ? 'text-amber-400' : 'text-neutral-400'} />
                    <span>{isRtl ? sec.labelAr : sec.labelEn}</span>
                  </button>
                );
              })}

              <div className="pt-6 px-1 text-[10px] text-neutral-400 space-y-1">
                <p className="font-extrabold text-amber-600 uppercase">🛡️ {isRtl ? 'مستودع آمن بالكامل' : 'SECURE VAULT WORKSPACE'}</p>
                <p className="leading-relaxed font-medium">All personal records and dashboard permission tokens are protected with certified 256-bit encryption before saving.</p>
              </div>
            </div>

            {/* Right Main form edit body */}
            <form onSubmit={handleSaveMember} className="lg:col-span-9 p-6 bg-white space-y-6 flex flex-col justify-between">
              
              <div className="space-y-6">
                
                {/* 1. BASIC IDENTITY SECTION */}
                {activeFormSection === 'basic' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border-b border-neutral-100 pb-2">
                      <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'المعلومات والبيانات الشخصية والاتصال' : 'Personal Identity & Contact Info'}</h4>
                      <p className="text-[11px] text-neutral-400 font-medium">Define basic demographic details, contact routing, and the organizational position.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'الاسم بالكامل (بالعربية) *' : 'Full Name (Arabic) *'}</label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={formData.nameAr}
                          onChange={e => setFormData(p => ({ ...p, nameAr: e.target.value }))}
                          placeholder="مثال: نادين الحربي"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'الاسم بالكامل (بالإنجليزي) *' : 'Full Name (English) *'}</label>
                        <input
                          type="text"
                          required
                          value={formData.nameEn}
                          onChange={e => setFormData(p => ({ ...p, nameEn: e.target.value }))}
                          placeholder="e.g. Nadeen Al-Harbi"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'المسمى الوظيفي المعتمد (بالعربية)' : 'Designated Role (Arabic)'}</label>
                        <input
                          type="text"
                          value={formData.roleAr}
                          onChange={e => setFormData(p => ({ ...p, roleAr: e.target.value }))}
                          placeholder="كبار خبيرات تلوين وتسريح الشعر"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'المسمى الوظيفي المعتمد (بالإنجليزي)' : 'Designated Role (English)'}</label>
                        <input
                          type="text"
                          value={formData.roleEn}
                          onChange={e => setFormData(p => ({ ...p, roleEn: e.target.value }))}
                          placeholder="Senior Master Colorist"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'البريد الإلكتروني للعمل' : 'Work Email Address'}</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                          placeholder="e.g. employee@refah.sa"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'رقم هاتف الجوال الموثق *' : ' Saudi Verified Phone *'}</label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+966 54 888 1234"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'الجنسية والبلد *' : 'Nationality *'}</label>
                        <input
                          type="text"
                          required
                          value={isRtl ? formData.nationalityAr : formData.nationalityEn}
                          onChange={e => setFormData(p => isRtl ? ({ ...p, nationalityAr: e.target.value }) : ({ ...p, nationalityEn: e.target.value }))}
                          placeholder={isRtl ? 'سعودية' : 'Saudi'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'الجنس *' : 'Gender *'}</label>
                        <select
                          value={formData.gender}
                          onChange={e => setFormData(p => ({ ...p, gender: e.target.value as any }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1 focus:ring-zinc-900"
                        >
                          <option value="female">{isRtl ? 'أنثى' : 'Female'}</option>
                          <option value="male">{isRtl ? 'ذكر' : 'Male'}</option>
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مسار الوصول والوظيفة التنظيمية *' : 'Roster Position & Security Level *'}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, position: 'service-provider' }))}
                            className={`p-3 rounded-xl text-xs font-black text-start transition-all cursor-pointer border ${
                              formData.position === 'service-provider'
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                : 'bg-white hover:bg-neutral-50 text-neutral-600 border-slate-200'
                            }`}
                          >
                            <p>{isRtl ? 'مقدم خدمة فنية (تطبيق رفاه)' : 'Service Provider (Staff App Access)'}</p>
                            <span className="text-[9px] font-bold text-neutral-400 mt-1 block">Renders in booking screens, can receive client appointments and use the Staff App password path.</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, position: 'dashboard-admin' }))}
                            className={`p-3 rounded-xl text-xs font-black text-start transition-all cursor-pointer border ${
                              formData.position === 'dashboard-admin'
                                ? 'bg-zinc-950 text-white border-zinc-950 shadow-sm'
                                : 'bg-white hover:bg-neutral-50 text-neutral-600 border-slate-200'
                            }`}
                          >
                            <p>{isRtl ? 'إدارة لوحة التحكم وصلاحيات الفروع' : 'Dashboard Admin (Dashboard Access)'}</p>
                            <span className="text-[9px] font-bold text-neutral-400 mt-1 block">Grants admin login privileges. Use standard dashboard module permission checklist.</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. BIOGRAPHY & SPECIALTIES */}
                {activeFormSection === 'bio' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border-b border-neutral-100 pb-2">
                      <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'النبذة المهنية وسيرة العمل والتخصصات' : 'Biography & Expertises'}</h4>
                      <p className="text-[11px] text-neutral-400 font-medium">Compose the public stylist biography, specialties catalog, and upload their workspace photo avatar.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'النبذة المهنية باللغة العربية' : 'Arabic Bio'}</label>
                        <textarea
                          value={formData.bioAr}
                          onChange={e => setFormData(p => ({ ...p, bioAr: e.target.value }))}
                          placeholder="أخصائية تجميل وعناية وتلوين شعر محترفة..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white h-20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'النبذة المهنية باللغة الإنجليزية' : 'English Bio'}</label>
                        <textarea
                          value={formData.bioEn}
                          onChange={e => setFormData(p => ({ ...p, bioEn: e.target.value }))}
                          placeholder="Professional master aesthetician and color specialist..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white h-20"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مستويات الخبرة بالأعوام' : 'Experience Years'}</label>
                        <input
                          type="text"
                          value={isRtl ? formData.experienceAr : formData.experienceEn}
                          onChange={e => setFormData(p => isRtl ? ({ ...p, experienceAr: e.target.value }) : ({ ...p, experienceEn: e.target.value }))}
                          placeholder={isRtl ? '٨ سنوات' : '8 Years'}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white focus:ring-1"
                        />
                      </div>

                      {/* Specialties adding tags */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'التخصصات والخدمات المتقنة' : 'Specialties Tag Hub'}</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newSpecialty}
                            onChange={e => setNewSpecialty(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddSpecialty())}
                            placeholder={isRtl ? 'مثال: بالياج سويسري' : 'e.g. Swiss Balayage'}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleAddSpecialty}
                            className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {formData.specialtiesEn.map((sp, i) => (
                            <span key={i} className="bg-indigo-50 text-indigo-900 px-2 py-1 rounded text-[9px] font-black flex items-center gap-1.5 border border-indigo-100">
                              <span>{sp}</span>
                              <button type="button" onClick={() => handleRemoveSpecialty(i)} className="text-indigo-400 hover:text-rose-500"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Spoken Languages adding tags */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'اللغات المتحدثة' : 'Spoken Languages Tag Hub'}</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newLangInput}
                            onChange={e => setNewLangInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddLanguage())}
                            placeholder={isRtl ? 'مثال: الفرنسية' : 'e.g. French'}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold"
                          />
                          <button
                            type="button"
                            onClick={handleAddLanguage}
                            className="px-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {formData.languagesEn.map((lg, i) => (
                            <span key={i} className="bg-slate-100 text-neutral-800 px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1.5 border border-slate-200">
                              <span>{lg}</span>
                              <button type="button" onClick={() => handleRemoveLanguage(i)} className="text-neutral-400 hover:text-rose-500"><X size={10} /></button>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Photo Avatar Preset selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'صورة الهوية المهنية (اختر من المعرض المعتمد)' : 'Photo Avatar Gallery'}</label>
                        <div className="flex items-center gap-3">
                          <img src={formData.avatar} alt="Current" className="w-12 h-12 rounded-xl object-cover border border-neutral-200 shadow-sm" />
                          <div className="grid grid-cols-6 gap-1 flex-1">
                            {presetAvatars.map((av, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, avatar: av }))}
                                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer ${
                                  formData.avatar === av ? 'border-zinc-950 scale-105' : 'border-neutral-200'
                                }`}
                              >
                                <img src={av} alt="Preset avatar option" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="url"
                          value={formData.avatar}
                          onChange={e => setFormData(p => ({ ...p, avatar: e.target.value }))}
                          placeholder="Or paste custom image web URL..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[10px] font-mono"
                        />
                      </div>

                    </div>
                  </div>
                )}

                {/* 3. FINANCE FIELDS */}
                {activeFormSection === 'finance' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border-b border-neutral-100 pb-2">
                      <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'إعدادات المستحقات والرواتب والعمولات' : 'Financial Compensation Rules'}</h4>
                      <p className="text-[11px] text-neutral-400 font-medium">Reconcile official WPS contracts, define base salary levels, service commission rates, and enable product retail payouts.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'الراتب الأساسي الشهري (SAR) *' : 'Contracted Monthly Base Salary (SAR) *'}</label>
                        <input
                          type="number"
                          required
                          value={formData.baseSalary}
                          onChange={e => setFormData(p => ({ ...p, baseSalary: Math.max(0, parseInt(e.target.value) || 0) }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'نسبة عمولة حجز الخدمات %' : 'Service Commissions Percentage %'}</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={formData.commissionRatePct}
                            onChange={e => setFormData(p => ({ ...p, commissionRatePct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800 focus:bg-white pr-8 text-center"
                          />
                          <span className="absolute right-3.5 top-3 text-neutral-400 font-mono">%</span>
                        </div>
                      </div>

                      {/* Financial Toggles */}
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'قوانين وقنوات احتساب العمولات النشطة' : 'Active Financial Compensation Channels'}</label>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, serviceCommissionEnabled: !p.serviceCommissionEnabled }))}
                            className={`p-4 rounded-2xl text-xs font-black text-start transition-all cursor-pointer border flex items-center gap-3 ${
                              formData.serviceCommissionEnabled 
                                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' 
                                : 'bg-slate-50 text-neutral-500 border-slate-200'
                            }`}
                          >
                            {formData.serviceCommissionEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
                            <div>
                              <p>{isRtl ? 'احتساب عمولة الخدمات الفنية' : 'Enable Service Booking Commission'}</p>
                              <span className="text-[9px] font-bold text-neutral-400 block mt-0.5">Applies selected {formData.commissionRatePct}% to the stylist gross services total.</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, productCommissionEnabled: !p.productCommissionEnabled }))}
                            className={`p-4 rounded-2xl text-xs font-black text-start transition-all cursor-pointer border flex items-center gap-3 ${
                              formData.productCommissionEnabled 
                                ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' 
                                : 'bg-slate-50 text-neutral-500 border-slate-200'
                            }`}
                          >
                            {formData.productCommissionEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
                            <div>
                              <p>{isRtl ? 'تفعيل عمولة بيع مستحضرات التجزئة (٥٪)' : 'Enable Product Retail Commission (5% Flat)'}</p>
                              <span className="text-[9px] font-bold text-neutral-400 block mt-0.5">Grants a 5% incentive commission on all premium shelf product items sold to checkout clients.</span>
                            </div>
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* 4. SCHEDULE CONFIGURATION */}
                {activeFormSection === 'schedule' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border-b border-neutral-100 pb-2 flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'إعداد وجدولة شيفتات العمل الأسبوعية' : 'Weekly Shifts & Roster Scheduler'}</h4>
                        <p className="text-[11px] text-neutral-400 font-medium">Assign weekly operational shifts, date ranges, and define visibility parameters for the Staff App schedules.</p>
                      </div>
                      
                      {/* Draft Shift status indicator */}
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, scheduleDraft: !p.scheduleDraft }))}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black cursor-pointer transition-all border flex items-center gap-1.5 ${
                          formData.scheduleDraft
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${formData.scheduleDraft ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {formData.scheduleDraft 
                          ? (isRtl ? 'وضع المسودة (مخفي)' : 'Draft Mode (Hidden)') 
                          : (isRtl ? 'منشور (نشط للعملاء)' : 'Published (Live to Clients)')}
                      </button>
                    </div>

                    {/* Date-Range and Visibility Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      
                      {/* Visibility select */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مدى رؤية جدول العمل (بالأسابيع)' : 'Staff App Visibility Range'}</label>
                        <select
                          value={formData.scheduleVisibilityWeeks}
                          onChange={e => setFormData(p => ({ ...p, scheduleVisibilityWeeks: parseInt(e.target.value) || 2 }))}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-neutral-800"
                        >
                          <option value="1">{isRtl ? 'أسبوع واحد مقبل' : '1 Week Ahead'}</option>
                          <option value="2">{isRtl ? 'أسبوعين (موصى به)' : '2 Weeks Ahead (Recommended)'}</option>
                          <option value="3">{isRtl ? '٣ أسابيع متتالية' : '3 Weeks Ahead'}</option>
                          <option value="4">{isRtl ? 'شهر كامل (٤ أسابيع)' : '4 Weeks Ahead (Full Month)'}</option>
                        </select>
                      </div>

                      {/* Start Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تاريخ بدء تفعيل الجدول' : 'Schedule Start Date'}</label>
                        <input
                          type="date"
                          value={formData.scheduleStartDate || ''}
                          onChange={e => setFormData(p => ({ ...p, scheduleStartDate: e.target.value }))}
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-neutral-800"
                        />
                      </div>

                      {/* End Date */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تاريخ انتهاء الجدول' : 'Schedule End Date'}</label>
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, scheduleContinues: !p.scheduleContinues, scheduleEndDate: !p.scheduleContinues ? '' : p.scheduleEndDate }))}
                            className={`text-[9px] font-black underline cursor-pointer ${formData.scheduleContinues ? 'text-indigo-600' : 'text-neutral-400'}`}
                          >
                            {isRtl ? 'بلا تاريخ نهاية' : 'Set Continuous'}
                          </button>
                        </div>
                        {formData.scheduleContinues ? (
                          <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-700 font-black text-center">
                            {isRtl ? 'جدول مستمر مفتوح النهاية ♾️' : 'Continuous / Open-Ended ♾️'}
                          </div>
                        ) : (
                          <input
                            type="date"
                            value={formData.scheduleEndDate || ''}
                            onChange={e => setFormData(p => ({ ...p, scheduleEndDate: e.target.value }))}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-neutral-800"
                          />
                        )}
                      </div>

                    </div>

                    {/* Weekly Schedule Planner */}
                    <div className="space-y-3">
                      <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'ساعات العمل اليومية وتعيين الإجازات' : 'Configure Weekly Daily Hours'}</label>
                      <div className="space-y-2">
                        {formData.schedule.map((day, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleScheduleDayToggle(idx)}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer transition-all ${
                                    day.status === 'working' 
                                      ? 'bg-zinc-950 text-white' 
                                      : 'bg-rose-50 text-rose-600 border border-rose-200'
                                  }`}
                                >
                                  {isRtl ? day.dayAr : day.dayEn}
                                </button>
                                <span className="text-[10px] text-neutral-400 font-bold">
                                  {day.status === 'working' ? (isRtl ? 'يوم عمل نشط' : 'Active Working Day') : (isRtl ? 'يوم إجازة رسمي' : 'Weekly Day Off')}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                                <input
                                  type="text"
                                  disabled={day.status !== 'working'}
                                  value={day.hours}
                                  onChange={e => handleScheduleHoursChange(idx, e.target.value)}
                                  className={`flex-1 text-center font-bold text-xs font-mono p-2 rounded-xl border transition-all ${
                                    day.status === 'working'
                                      ? 'bg-white border-slate-200 text-neutral-800 focus:ring-1 focus:ring-zinc-900'
                                      : 'bg-neutral-100 border-neutral-100 text-neutral-400 cursor-not-allowed'
                                  }`}
                                />
                                {day.status === 'working' && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddSubShift(idx)}
                                    className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-black rounded-xl cursor-pointer transition-all whitespace-nowrap flex items-center gap-1"
                                  >
                                    <Plus size={11} />
                                    <span>{isRtl ? 'شيفت فرعي' : '+ Sub Shift'}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Sub-Shifts Container */}
                            {day.status === 'working' && day.subShifts && day.subShifts.length > 0 && (
                              <div className="pl-6 border-l-2 border-indigo-100 space-y-2 mt-2 animate-fade-in">
                                <p className="text-[10px] text-indigo-700 font-black tracking-wider uppercase mb-1">{isRtl ? 'الشيفتات والكتل الإضافية المقررة لهذا اليوم:' : 'Scheduled Daily Sub Shifts:'}</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {day.subShifts.map((sub) => (
                                    <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-indigo-100/70 flex items-center gap-2">
                                      <select
                                        value={sub.label}
                                        onChange={e => handleSubShiftChange(idx, sub.id, 'label', e.target.value)}
                                        className="bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-black text-neutral-800"
                                      >
                                        <option value="Morning Shift">{isRtl ? 'شيفت صباحي' : 'Morning Shift'}</option>
                                        <option value="Evening Shift">{isRtl ? 'شيفت مسائي' : 'Evening Shift'}</option>
                                        <option value="Overtime Shift">{isRtl ? 'شيفت إضافي' : 'Overtime Shift'}</option>
                                        <option value="Restock & Prep">{isRtl ? 'تجهيز وتحضير' : 'Restock & Prep'}</option>
                                      </select>
                                      <input
                                        type="text"
                                        value={sub.startTime}
                                        onChange={e => handleSubShiftChange(idx, sub.id, 'startTime', e.target.value)}
                                        className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                                        placeholder="09:00 AM"
                                      />
                                      <span className="text-[10px] text-neutral-400 font-black font-mono">→</span>
                                      <input
                                        type="text"
                                        value={sub.endTime}
                                        onChange={e => handleSubShiftChange(idx, sub.id, 'endTime', e.target.value)}
                                        className="w-16 text-center bg-slate-50 border border-slate-150 rounded-lg p-1 text-[10px] font-bold font-mono"
                                        placeholder="01:00 PM"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSubShift(idx, sub.id)}
                                        className="p-1 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

                {/* 5. ACCESS PATHS & DASHBOARD PERMISSIONS */}
                {activeFormSection === 'access' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="border-b border-neutral-100 pb-2">
                      <h4 className="text-xs font-black text-zinc-950 uppercase tracking-wider">{isRtl ? 'أمان النظام ومسارات الوصول والصلاحيات' : 'Security Accounts & Access Authorization'}</h4>
                      <p className="text-[11px] text-neutral-400 font-medium font-mono">Reconcile login paths based on organization position role. Set staff app passcodes or allocate precise dashboard module permissions.</p>
                    </div>

                    {/* Account Status Toggle (Active vs Suspended) */}
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between text-xs gap-3">
                      <div>
                        <p className="font-extrabold text-neutral-800">{isRtl ? 'حالة نشاط الحساب وصلاحية الدخول' : 'Account Activation & Credential Status'}</p>
                        <span className="text-[10px] text-neutral-400 font-bold block mt-0.5">
                          {formData.isActive 
                            ? (isRtl ? 'الحساب مفعل ويمكنه تسجيل الدخول فوراً' : 'Account active. Authorized to establish secure connection.')
                            : (isRtl ? 'الحساب معطل حالياً ومحجوب عن النظام' : 'Account temporarily frozen. Revokes all system privileges.')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(p => ({ ...p, isActive: !p.isActive }))}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                          formData.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {formData.isActive ? (isRtl ? '● نشط ومصرح' : '● ACTIVE / ENABLED') : (isRtl ? '○ معطل وموقوف' : '○ DISABLED / SUSPENDED')}
                      </button>
                    </div>

                    {formData.position === 'service-provider' ? (
                      /* Staff App passcode credentials path */
                      <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 space-y-4 text-xs font-bold">
                        <div className="flex items-center gap-2 text-indigo-900">
                          <Lock size={15} />
                          <span>{isRtl ? 'تطبيق الكادر الفني للهواتف (Refah Staff App)' : 'Refah Staff Mobile Application Access'}</span>
                        </div>
                        <p className="text-neutral-600 text-[11px] leading-relaxed font-medium">
                          Because this roster position is flagged as a <strong>Service Provider</strong>, they will log into the Refah mobile app. Set their access passcode below.
                        </p>

                        <div className="space-y-1.5 max-w-sm">
                          <label className="text-[10px] text-indigo-900 font-extrabold block">{isRtl ? 'رمز المرور المؤقت للتطبيق (الحد الأدنى ٨ خانات) *' : 'Temporary App Password (Min 8 Characters) *'}</label>
                          <input
                            type="text"
                            required
                            minLength={8}
                            value={formData.staffAppPassword}
                            onChange={e => setFormData(p => ({ ...p, staffAppPassword: e.target.value }))}
                            className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-xs font-bold font-mono text-neutral-800 focus:ring-1 focus:ring-indigo-500"
                          />
                          {formData.staffAppPassword && formData.staffAppPassword.length < 8 && (
                            <p className="text-rose-600 text-[10px] font-bold mt-1">
                              {isRtl ? '⚠️ يجب أن يتكون الرمز من ٨ خانات على الأقل!' : '⚠️ Password must be at least 8 characters long!'}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Dashboard Admin permissions matrix with Role Presets */
                      <div className="space-y-4">
                        <div className="p-4 bg-amber-50/40 rounded-2xl border border-amber-200/40 text-xs font-bold text-amber-900 space-y-1">
                          <p className="flex items-center gap-1.5"><Shield size={14} /> {isRtl ? 'بوابة لوحة تحكم الإدارة العليا والموظفين' : 'Tenant Admin Dashboard Access Link'}</p>
                          <p className="text-[11px] text-neutral-600 leading-normal font-medium">This specialist is designated as a <strong>Dashboard Admin</strong>. Select a predefined role preset or customize module permissions manually.</p>
                        </div>

                        {/* Role Presets */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'تطبيق قالب صلاحيات جاهز' : 'Apply Role Preset Template'}</label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { key: 'manager', labelEn: 'General Manager', labelAr: 'مدير عام الفرع' },
                              { key: 'accountant', labelEn: 'Accountant', labelAr: 'المحاسب المالي' },
                              { key: 'receptionist', labelEn: 'Receptionist / Front Desk', labelAr: 'موظف الاستقبال' },
                              { key: 'marketing', labelEn: 'Marketing Planner', labelAr: 'التسويق والعروض' },
                              { key: 'hr', labelEn: 'HR / Personnel', labelAr: 'شؤون الموظفين' },
                              { key: 'service-provider', labelEn: 'Senior Specialist', labelAr: 'الأخصائية الكبرى' }
                            ].map(preset => (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => applyRolePreset(preset.key)}
                                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-lg text-[10px] font-black cursor-pointer transition-all border border-neutral-200"
                              >
                                {isRtl ? preset.labelAr : preset.labelEn}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Detailed Permission Grid (All 20 keys) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-neutral-500 font-extrabold block">{isRtl ? 'مصفوفة التراخيص والصلاحيات التفصيلية (٢٠ مفتاح)' : 'Granular Dashboard Permission Matrix (20 Keys)'}</label>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-1">
                            {[
                              { key: 'view_dashboard', labelEn: 'Access Main Dashboard', labelAr: 'الوصول للوحة التحكم الرئيسية' },
                              { key: 'view_appointments', labelEn: 'Manage Customer Appointments', labelAr: 'إدارة وحجز مواعيد العملاء' },
                              { key: 'view_schedules', labelEn: 'Manage Shifts & Rosters', labelAr: 'إدارة جداول وشيفتات الموظفين' },
                              { key: 'view_employees', labelEn: 'Manage Team Directory', labelAr: 'عرض وإدارة ملفات الموظفين' },
                              { key: 'view_customers', labelEn: 'Manage Client Profile Records', labelAr: 'سجلات وملفات العملاء' },
                              { key: 'view_services', labelEn: 'Configure Service Catalog', labelAr: 'إعداد وتحديث قائمة الخدمات' },
                              { key: 'view_products', labelEn: 'Manage Premium Products Inventory', labelAr: 'مستودع ومخزن المنتجات' },
                              { key: 'view_orders', labelEn: 'Track Client Orders & Invoices', labelAr: 'مبيعات وفواتير الخدمات بالتفصيل' },
                              { key: 'view_financial', labelEn: 'Reconcile Financial Ledgers', labelAr: 'السجلات المالية وحساب العمولات' },
                              { key: 'view_bills', labelEn: 'Manage Operating Branch Expenses', labelAr: 'المصاريف وفواتير التشغيل اليومية' },
                              { key: 'view_pos', labelEn: 'Access Cashier Register (POS)', labelAr: 'بوابة المبيعات المباشرة كاشير' },
                              { key: 'view_messages', labelEn: 'Client Messaging & Chats', labelAr: 'رسائل ومحادثات العملاء' },
                              { key: 'view_reviews', labelEn: 'Moderate Client Reviews', labelAr: 'تقييمات وملاحظات العملاء' },
                              { key: 'view_hot_deals', labelEn: 'Campaigns & Dynamic Promos', labelAr: 'الحملات التسويقية والعروض الخاصة' },
                              { key: 'view_notifications', labelEn: 'Access Workspace Notifications', labelAr: 'تنبيهات وإشعارات الفرع' },
                              { key: 'view_reports', labelEn: 'Analytical Performance Reports', labelAr: 'التقارير الإحصائية والتحليلات' },
                              { key: 'view_payroll', labelEn: 'Manage Payroll & Base Salaries', labelAr: 'مسيرات الرواتب والمستحقات والعمولات' },
                              { key: 'view_subscription', labelEn: 'Configure Plan & Subscription', labelAr: 'باقة الاشتراك والحدود المسموحة' },
                              { key: 'view_settings', labelEn: 'Configure core portal settings', labelAr: 'إعداد خصائص ومحددات النظام' },
                              { key: 'manage_accounts', labelEn: 'Security & Staff Access Accounts', labelAr: 'أمن حسابات المشرفين والمدراء' }
                            ].map(perm => {
                              const isChecked = !!(formData.dashboardPermissions as any)[perm.key];
                              return (
                                <button
                                  key={perm.key}
                                  type="button"
                                  onClick={() => setFormData(prev => ({
                                    ...prev,
                                    dashboardPermissions: {
                                      ...prev.dashboardPermissions,
                                      [perm.key]: !isChecked,
                                      // Mirror to existing legacy keys for backward compatibility
                                      ...(perm.key === 'view_appointments' ? { manage_appointments: !isChecked } : {}),
                                      ...(perm.key === 'view_financial' ? { manage_financials: !isChecked } : {}),
                                      ...(perm.key === 'view_settings' ? { manage_settings: !isChecked } : {})
                                    }
                                  }))}
                                  className={`p-3 rounded-xl text-xs font-black text-start transition-all cursor-pointer border flex items-center justify-between gap-3 ${
                                    isChecked
                                      ? 'bg-zinc-900 border-zinc-950 text-white shadow-sm'
                                      : 'bg-white hover:bg-neutral-50 text-neutral-500 border-slate-200'
                                  }`}
                                >
                                  <span className="truncate">{isRtl ? perm.labelAr : perm.labelEn}</span>
                                  {isChecked ? (
                                    <CheckSquare size={15} className="text-indigo-400 shrink-0" />
                                  ) : (
                                    <Square size={15} className="text-neutral-300 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Step Navigation Actions footer panel */}
              <div className="pt-6 border-t border-slate-100 flex justify-between items-center mt-6">
                
                {/* Back Cancel triggers */}
                <button
                  type="button"
                  onClick={() => setActiveView('list')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-neutral-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
                >
                  {isRtl ? 'تراجع والعودة للقائمة' : 'Back to Directory'}
                </button>

                {/* Confirm Save triggers */}
                <div className="flex gap-2">
                  {activeFormSection !== 'access' ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Progress forward
                        const steps: Array<'basic' | 'bio' | 'finance' | 'schedule' | 'access'> = ['basic', 'bio', 'finance', 'schedule', 'access'];
                        const idx = steps.indexOf(activeFormSection);
                        if (idx !== -1 && idx < steps.length - 1) {
                          setActiveFormSection(steps[idx + 1]);
                        }
                      }}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl text-xs font-black cursor-pointer transition-all"
                    >
                      {isRtl ? 'الخطوة التالية' : 'Next Step'}
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-600/10 flex items-center gap-1.5 animate-bounce-short"
                    >
                      <Check size={14} />
                      <span>{formMode === 'add' ? (isRtl ? 'تعيين ونشر الملف المكتمل' : 'Deploy Completed Profile') : (isRtl ? 'حفظ وحقن التعديلات' : 'Commit Changes')}</span>
                    </button>
                  )}
                </div>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
