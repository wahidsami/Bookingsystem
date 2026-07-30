import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Clock3,
  CloudUpload,
  FilePlus2,
  Filter,
  Flag,
  Inbox,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  User,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { Language } from '../types';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { useTenantAuth } from '../contexts/TenantAuthContext';

type SupportSection = 'home' | 'tickets';
type TicketSort = 'updated_desc' | 'updated_asc' | 'priority_desc' | 'priority_asc' | 'unread_desc' | 'unread_asc';

const STATUS_OPTIONS = [
  'open',
  'assigned',
  'in_progress',
  'waiting_for_customer',
  'waiting_for_support',
  'resolved',
  'closed',
  'reopened'
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

function toText(value: any, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function safeDate(value: any) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDateTime(value: any, lang: Language) {
  const date = safeDate(value);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function formatDateOnly(value: any, lang: Language) {
  const date = safeDate(value);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium'
  }).format(date);
}

function formatRelative(value: any, lang: Language) {
  const date = safeDate(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) {
    return lang === 'ar' ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return lang === 'ar' ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
  }

  return lang === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
}

function getStatusLabel(status: string, lang: Language) {
  const normalized = `${status || ''}`.toLowerCase();
  const map: Record<string, { ar: string; en: string; tone: string }> = {
    open: { ar: 'مفتوح', en: 'Open', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
    assigned: { ar: 'مُسند', en: 'Assigned', tone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    in_progress: { ar: 'قيد العمل', en: 'In Progress', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    waiting_for_customer: { ar: 'بانتظار العميل', en: 'Waiting for Customer', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
    waiting_for_support: { ar: 'بانتظار الدعم', en: 'Waiting for Support', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
    resolved: { ar: 'تم الحل', en: 'Resolved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    closed: { ar: 'مغلق', en: 'Closed', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
    reopened: { ar: 'أعيد فتحه', en: 'Reopened', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
    draft: { ar: 'مسودة', en: 'Draft', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' }
  };

  const item = map[normalized] || { ar: normalized || 'غير معروف', en: normalized || 'Unknown', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
  return {
    label: lang === 'ar' ? item.ar : item.en,
    tone: item.tone
  };
}

function getPriorityLabel(priority: string, lang: Language) {
  const normalized = `${priority || ''}`.toLowerCase();
  const map: Record<string, { ar: string; en: string; tone: string }> = {
    low: { ar: 'منخفض', en: 'Low', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    medium: { ar: 'متوسط', en: 'Medium', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
    high: { ar: 'عالٍ', en: 'High', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
    urgent: { ar: 'عاجل', en: 'Urgent', tone: 'bg-rose-50 text-rose-700 border-rose-200' }
  };
  const item = map[normalized] || { ar: normalized || 'غير معروف', en: normalized || 'Unknown', tone: 'bg-zinc-100 text-zinc-700 border-zinc-200' };
  return {
    label: lang === 'ar' ? item.ar : item.en,
    tone: item.tone
  };
}

function normalizeTicketListResponse(response: any) {
  const data = response?.data || response || {};
  const tickets = Array.isArray(data.tickets) ? data.tickets : Array.isArray(data.items) ? data.items : Array.isArray(data.rows) ? data.rows : [];
  const pagination = data.pagination || data.meta?.pagination || {
    page: Number(data.page || 1),
    limit: Number(data.limit || tickets.length || 20),
    total: Number(data.total || tickets.length || 0),
    totalPages: Number(data.totalPages || data.pages || 1)
  };
  return { tickets, pagination };
}

function normalizeCategoriesResponse(response: any) {
  const data = response?.data || response || {};
  const categories = Array.isArray(data.categories) ? data.categories : Array.isArray(data.rows) ? data.rows : Array.isArray(data.items) ? data.items : [];
  return categories;
}

function normalizeTicketResponse(response: any) {
  const data = response?.data || response || {};
  return data.ticket || data;
}

function extractTicketInitial(text: string, fallback: string) {
  const normalized = `${text || ''}`.trim();
  return normalized || fallback;
}

function buildFileListPayload(files: File[]) {
  return files.map((file) => ({
    file,
    id: `${file.name}-${file.size}-${file.lastModified}`
  }));
}

interface SupportWorkspaceProps {
  lang: Language;
  darkMode?: boolean;
}

interface SupportTicket {
  id: string;
  ticketNumber?: string;
  status?: string;
  priority?: string;
  subject?: string;
  subjectAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  source?: string;
  sourceChannel?: string;
  customer?: { id: string; firstName?: string; lastName?: string; email?: string; phone?: string; profileImage?: string | null } | null;
  category?: { id: string; name?: string; nameAr?: string | null; slug?: string; color?: string | null; icon?: string | null } | null;
  assignedAgent?: { id: string; displayName?: string; displayNameAr?: string | null; title?: string | null; avatarUrl?: string | null; status?: string } | null;
  unreadCount?: number;
  messageCount?: number;
  latestMessage?: any;
  messages?: Array<any>;
  readStates?: Array<any>;
  updatedAt?: string;
  createdAt?: string;
}

export default function SupportWorkspace({ lang, darkMode = false }: SupportWorkspaceProps) {
  const isRtl = lang === 'ar';
  const { tenant, account, user } = useTenantAuth();

  const [section, setSection] = useState<SupportSection>('home');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [summaryTickets, setSummaryTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortKey, setSortKey] = useState<TicketSort>('updated_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [ticketDrawerOpen, setTicketDrawerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<any | null>(null);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [composerSending, setComposerSending] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState('medium');
  const [newTicketMessage, setNewTicketMessage] = useState('');
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [newTicketSubmitting, setNewTicketSubmitting] = useState(false);
  const [newTicketValidation, setNewTicketValidation] = useState<string | null>(null);
  const [detailActionBusy, setDetailActionBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newTicketFileInputRef = useRef<HTMLInputElement | null>(null);

  const actorCustomerId = useMemo(() => {
    const candidate = tenant?.id || account?.id || user?.id || null;
    return candidate ? String(candidate) : null;
  }, [account?.id, tenant?.id, user?.id]);

  const activeCategoryMap = useMemo(() => {
    const map = new Map<string, any>();
    categories.forEach((category) => {
      if (category?.id) {
        map.set(String(category.id), category);
      }
    });
    return map;
  }, [categories]);

  const sortedTickets = useMemo(() => {
    const source = [...tickets];
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const unreadWeight = (ticket: SupportTicket) => Number(ticket.unreadCount || 0);
    const updatedWeight = (ticket: SupportTicket) => safeDate(ticket.updatedAt || ticket.latestMessage?.createdAt || ticket.createdAt).getTime();

    source.sort((a, b) => {
      switch (sortKey) {
        case 'updated_asc':
          return updatedWeight(a) - updatedWeight(b);
        case 'updated_desc':
          return updatedWeight(b) - updatedWeight(a);
        case 'priority_asc':
          return (priorityWeight[a.priority || 'medium'] || 2) - (priorityWeight[b.priority || 'medium'] || 2);
        case 'priority_desc':
          return (priorityWeight[b.priority || 'medium'] || 2) - (priorityWeight[a.priority || 'medium'] || 2);
        case 'unread_asc':
          return unreadWeight(a) - unreadWeight(b);
        case 'unread_desc':
          return unreadWeight(b) - unreadWeight(a);
        default:
          return 0;
      }
    });

    return source;
  }, [tickets, sortKey]);

  const homeMetrics = useMemo(() => {
    const items = summaryTickets;
    const openTickets = items.filter((ticket) => ['open', 'assigned', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'reopened', 'draft'].includes(`${ticket.status || ''}`)).length;
    const waitingForSupport = items.filter((ticket) => `${ticket.status || ''}` === 'waiting_for_support').length;
    const waitingForMe = items.filter((ticket) => ['assigned', 'in_progress', 'waiting_for_customer'].includes(`${ticket.status || ''}`)).length;
    const resolved = items.filter((ticket) => `${ticket.status || ''}` === 'resolved').length;
    const closed = items.filter((ticket) => `${ticket.status || ''}` === 'closed').length;
    const unreadReplies = items.reduce((sum, ticket) => sum + Number(ticket.unreadCount || 0), 0);
    const recentActivity = [...items]
      .sort((a, b) => safeDate(b.updatedAt || b.latestMessage?.createdAt || b.createdAt).getTime() - safeDate(a.updatedAt || a.latestMessage?.createdAt || a.createdAt).getTime())
      .slice(0, 6);

    return { openTickets, waitingForSupport, waitingForMe, resolved, closed, unreadReplies, recentActivity };
  }, [summaryTickets]);

  const supportTitle = isRtl ? 'الدعم' : 'Support';
  const supportDescription = isRtl
    ? 'عرض محادثات الدعم وإدارتها بطريقة حديثة وسلسة.'
    : 'Manage support conversations in a premium ticketing workspace.';

  const loadCategories = async () => {
    try {
      const response = await tenantApiAdapter.getSupportCategories({ limit: 100 });
      setCategories(normalizeCategoriesResponse(response));
    } catch (err) {
      console.error('Failed to load support categories', err);
    }
  };

  const loadSummaryTickets = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const response = await tenantApiAdapter.getSupportTickets({
        limit: 100,
        page: 1
      });
      const normalized = normalizeTicketListResponse(response);
      setSummaryTickets(normalized.tickets);
    } catch (err: any) {
      setSummaryError(err?.message || (isRtl ? 'تعذر تحميل ملخص الدعم' : 'Failed to load support summary'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    setError(null);
    try {
      const response = await tenantApiAdapter.getSupportTickets({
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        supportCategoryId: categoryFilter || undefined,
        page,
        limit
      });
      const normalized = normalizeTicketListResponse(response);
      setTickets(normalized.tickets);
      setTotal(Number(normalized.pagination?.total || normalized.tickets.length || 0));
      setPage(Number(normalized.pagination?.page || page));
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر تحميل التذاكر' : 'Failed to load support tickets'));
    } finally {
      setTicketsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadTickets(), loadSummaryTickets()]);
  };

  useEffect(() => {
    void loadCategories();
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, priorityFilter, categoryFilter, page, limit]);

  useEffect(() => {
    if (section === 'home') {
      void loadSummaryTickets();
    }
  }, [section]);

  useEffect(() => {
    if (!ticketDrawerOpen || !selectedTicketId) return;

    let mounted = true;
    const loadTicket = async () => {
      setDetailLoading(true);
      try {
        const response = await tenantApiAdapter.getSupportTicket(selectedTicketId);
        const ticket = normalizeTicketResponse(response);
        if (mounted) {
          setSelectedTicket(ticket);
          if (ticket?.messages?.length) {
            const latestVisible = [...ticket.messages].sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime())[0];
            if (latestVisible) {
              setReplyTarget((current) => current && current.id === latestVisible.id ? current : null);
            }
          }
        }
        void tenantApiAdapter.markSupportTicketRead(selectedTicketId).catch(() => undefined);
        await loadTickets();
        await loadSummaryTickets();
      } catch (err: any) {
        console.error('Failed to load support ticket details', err);
        if (mounted) {
          setSelectedTicket(null);
          setError(err?.message || (isRtl ? 'تعذر تحميل تفاصيل التذكرة' : 'Failed to load support ticket details'));
        }
      } finally {
        if (mounted) {
          setDetailLoading(false);
        }
      }
    };

    void loadTicket();

    return () => {
      mounted = false;
    };
  }, [ticketDrawerOpen, selectedTicketId]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setSortKey('updated_desc');
    setPage(1);
  };

  const openTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketDrawerOpen(true);
  };

  const closeTicketDrawer = () => {
    setTicketDrawerOpen(false);
    setSelectedTicketId(null);
    setSelectedTicket(null);
    setReplyText('');
    setReplyTarget(null);
    setReplyFiles([]);
  };

  const closeNewTicket = () => {
    setNewTicketOpen(false);
    setNewTicketValidation(null);
    setNewTicketSubject('');
    setNewTicketCategory('');
    setNewTicketPriority('medium');
    setNewTicketMessage('');
    setNewTicketFiles([]);
  };

  const triggerReplyFilePicker = () => {
    fileInputRef.current?.click();
  };

  const triggerNewTicketFilePicker = () => {
    newTicketFileInputRef.current?.click();
  };

  const mergeFiles = (current: File[], added: File[]) => {
    const byKey = new Map<string, File>();
    [...current, ...added].forEach((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      byKey.set(key, file);
    });
    return Array.from(byKey.values());
  };

  const readFiles = (list: FileList | null | undefined) => Array.from(list || []).filter(Boolean);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || composerSending) return;
    const text = replyText.trim();
    if (!text && replyFiles.length === 0) return;

    setComposerSending(true);
    try {
      const formData = new FormData();
      formData.append('content', text || ' ');
      formData.append('visibility', 'public');
      if (replyTarget?.id) {
        formData.append('replyToMessageId', replyTarget.id);
      }
      replyFiles.forEach((file) => formData.append('attachments', file));
      await tenantApiAdapter.replyToSupportTicket(selectedTicketId, formData);
      setReplyText('');
      setReplyTarget(null);
      setReplyFiles([]);
      const refreshed = await tenantApiAdapter.getSupportTicket(selectedTicketId);
      setSelectedTicket(normalizeTicketResponse(refreshed));
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر إرسال الرد' : 'Failed to send reply'));
    } finally {
      setComposerSending(false);
    }
  };

  const handleTicketStatusChange = async (status: string) => {
    if (!selectedTicketId) return;
    setDetailActionBusy(true);
    try {
      await tenantApiAdapter.changeSupportTicketStatus(selectedTicketId, status);
      const refreshed = await tenantApiAdapter.getSupportTicket(selectedTicketId);
      setSelectedTicket(normalizeTicketResponse(refreshed));
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر تحديث الحالة' : 'Failed to update ticket status'));
    } finally {
      setDetailActionBusy(false);
    }
  };

  const handleTicketPriorityChange = async (priority: string) => {
    if (!selectedTicketId) return;
    setDetailActionBusy(true);
    try {
      await tenantApiAdapter.changeSupportTicketPriority(selectedTicketId, priority);
      const refreshed = await tenantApiAdapter.getSupportTicket(selectedTicketId);
      setSelectedTicket(normalizeTicketResponse(refreshed));
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر تحديث الأولوية' : 'Failed to update ticket priority'));
    } finally {
      setDetailActionBusy(false);
    }
  };

  const handleTicketCategoryChange = async (supportCategoryId: string) => {
    if (!selectedTicketId) return;
    setDetailActionBusy(true);
    try {
      await tenantApiAdapter.changeSupportTicketCategory(selectedTicketId, supportCategoryId || null);
      const refreshed = await tenantApiAdapter.getSupportTicket(selectedTicketId);
      setSelectedTicket(normalizeTicketResponse(refreshed));
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر تحديث التصنيف' : 'Failed to update ticket category'));
    } finally {
      setDetailActionBusy(false);
    }
  };

  const handleToggleResolvedState = async () => {
    if (!selectedTicketId || !ticketDrawerTicket) return;
    setDetailActionBusy(true);
    try {
      if (ticketDrawerTicket.status === 'closed') {
        await tenantApiAdapter.reopenSupportTicket(ticketDrawerTicket.id);
      } else {
        await tenantApiAdapter.closeSupportTicket(ticketDrawerTicket.id);
      }
      const refreshed = await tenantApiAdapter.getSupportTicket(ticketDrawerTicket.id);
      setSelectedTicket(normalizeTicketResponse(refreshed));
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || (isRtl ? 'تعذر تغيير حالة التذكرة' : 'Failed to update ticket state'));
    } finally {
      setDetailActionBusy(false);
    }
  };

  const handleNewTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTicketSubmitting) return;
    setNewTicketValidation(null);

    const subject = newTicketSubject.trim();
    const message = newTicketMessage.trim();
    const customerPlatformUserId = actorCustomerId;

    if (!newTicketCategory) {
      setNewTicketValidation(isRtl ? 'اختر تصنيفاً للتذكرة.' : 'Please choose a ticket category.');
      return;
    }
    if (!subject) {
      setNewTicketValidation(isRtl ? 'العنوان مطلوب.' : 'Subject is required.');
      return;
    }
    if (!message) {
      setNewTicketValidation(isRtl ? 'الرسالة الأولى مطلوبة.' : 'Initial message is required.');
      return;
    }
    if (!customerPlatformUserId) {
      setNewTicketValidation(isRtl ? 'تعذر تحديد صاحب التذكرة من الجلسة الحالية.' : 'Unable to determine the ticket owner from the current session.');
      return;
    }

    setNewTicketSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('tenantId', toText(tenant?.id || tenant?.tenantId || account?.tenantId || user?.tenantId || ''));
      formData.append('customerPlatformUserId', customerPlatformUserId);
      formData.append('supportCategoryId', newTicketCategory);
      formData.append('priority', newTicketPriority);
      formData.append('subject', subject);
      formData.append('description', message);
      formData.append('source', 'dashboard');
      formData.append('sourceChannel', 'tenant_dashboard');
      newTicketFiles.forEach((file) => formData.append('attachments', file));
      const response = await tenantApiAdapter.createSupportTicket(formData);
      const ticket = normalizeTicketResponse(response);
      closeNewTicket();
      await refreshAll();
      if (ticket?.id) {
        setSection('tickets');
        openTicket(ticket.id);
      }
    } catch (err: any) {
      setNewTicketValidation(err?.message || (isRtl ? 'تعذر إنشاء التذكرة' : 'Failed to create support ticket'));
    } finally {
      setNewTicketSubmitting(false);
    }
  };

  const sectionChips = [
    { id: 'home' as const, labelAr: 'الرئيسية', labelEn: 'Support Home', icon: <Inbox size={16} /> },
    { id: 'tickets' as const, labelAr: 'قائمة التذاكر', labelEn: 'Ticket List', icon: <Ticket size={16} /> }
  ];

  const renderSummaryCard = (titleAr: string, titleEn: string, value: number, icon: React.ReactNode, tone: string, subtitleAr?: string, subtitleEn?: string) => (
    <div className={`rounded-2xl border p-5 shadow-sm ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">{isRtl ? titleAr : titleEn}</p>
          <p className={`text-3xl font-black font-mono ${tone}`}>{value}</p>
          {(subtitleAr || subtitleEn) && (
            <p className="text-xs text-neutral-400">{isRtl ? subtitleAr : subtitleEn}</p>
          )}
        </div>
        <div className={`p-3 rounded-2xl border ${tone} bg-opacity-10`}>
          {icon}
        </div>
      </div>
    </div>
  );

  const ticketDrawerTicket = selectedTicket || tickets.find((ticket) => ticket.id === selectedTicketId) || null;

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-6 shadow-sm ${darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-100 text-neutral-900'}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-brand-600">
              <MessageSquare size={14} />
              <span>{supportTitle}</span>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">{isRtl ? 'مركز المحادثات والدعم' : 'Conversation-first support workspace'}</h1>
              <p className="text-sm text-neutral-500 max-w-2xl">{supportDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void refreshAll()}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors ${darkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-neutral-200 hover:bg-neutral-50'}`}
            >
              <RefreshCw size={14} />
              <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
            </button>
            <button
              onClick={() => setNewTicketOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-brand-700"
            >
              <Plus size={14} />
              <span>{isRtl ? 'تذكرة جديدة' : 'New Ticket'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sectionChips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setSection(chip.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
              section === chip.id
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                : darkMode ? 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {chip.icon}
            <span>{isRtl ? chip.labelAr : chip.labelEn}</span>
          </button>
        ))}
      </div>

      {section === 'home' && (
        <div className="space-y-6">
          {(summaryError || error) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {summaryError || error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {renderSummaryCard(isRtl ? 'التذاكر المفتوحة' : 'Open Tickets', 'Open Tickets', homeMetrics.openTickets, <Ticket size={18} />, 'text-sky-600', isRtl ? 'نشطة حالياً' : 'Active now', 'Currently active')}
            {renderSummaryCard(isRtl ? 'بانتظار الدعم' : 'Waiting for Support', 'Waiting for Support', homeMetrics.waitingForSupport, <AlertCircle size={18} />, 'text-violet-600', isRtl ? 'تحتاج متابعة' : 'Needs follow-up', 'Needs follow-up')}
            {renderSummaryCard(isRtl ? 'بانتظارّي' : 'Waiting for Me', 'Waiting for Me', homeMetrics.waitingForMe, <UserCheck size={18} />, 'text-amber-600', isRtl ? 'منسوبة للفريق' : 'Assigned to team', 'Assigned to team')}
            {renderSummaryCard(isRtl ? 'الردود غير المقروءة' : 'Unread Replies', 'Unread Replies', homeMetrics.unreadReplies, <Sparkles size={18} />, 'text-emerald-600', isRtl ? 'محادثات بحاجة فتح' : 'Conversations awaiting review', 'Requires review')}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {renderSummaryCard(isRtl ? 'تم الحل' : 'Resolved', 'Resolved', homeMetrics.resolved, <Check size={18} />, 'text-emerald-600')}
            {renderSummaryCard(isRtl ? 'المغلقة' : 'Closed', 'Closed', homeMetrics.closed, <X size={18} />, 'text-zinc-600')}
            {renderSummaryCard(isRtl ? 'النشاط الأخير' : 'Recent Activity', 'Recent Activity', homeMetrics.recentActivity.length, <Clock3 size={18} />, 'text-brand-600', isRtl ? 'أحدث الحركات في المحادثات' : 'Latest ticket updates', 'Latest ticket updates')}
          </div>

          <div className={`rounded-2xl border p-5 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'}`}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'النشاط الحديث' : 'Recent Activity'}</h3>
                <p className="mt-1 text-xs text-neutral-500">{isRtl ? 'آخر التذاكر والتحديثات' : 'Latest ticket updates and conversation activity'}</p>
              </div>
              <button
                onClick={() => setSection('tickets')}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <span>{isRtl ? 'عرض التذاكر' : 'View tickets'}</span>
                <ArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
              </button>
            </div>
            <div className="space-y-3">
              {summaryLoading ? (
                <div className="flex items-center gap-3 text-sm text-neutral-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{isRtl ? 'جاري تحميل النشاط...' : 'Loading recent activity...'}</span>
                </div>
              ) : homeMetrics.recentActivity.length > 0 ? (
                homeMetrics.recentActivity.map((ticket) => {
                  const statusMeta = getStatusLabel(ticket.status || 'open', lang);
                  const priorityMeta = getPriorityLabel(ticket.priority || 'medium', lang);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => {
                        setSection('tickets');
                        openTicket(ticket.id);
                      }}
                      className={`w-full rounded-2xl border p-4 text-start transition-colors hover:border-brand-300 ${darkMode ? 'border-zinc-800 bg-zinc-950/30 hover:bg-zinc-800/60' : 'border-neutral-100 bg-neutral-50/60 hover:bg-neutral-50'}`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold">{ticket.ticketNumber || ticket.id}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusMeta.tone}`}>{statusMeta.label}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityMeta.tone}`}>{priorityMeta.label}</span>
                            {Number(ticket.unreadCount || 0) > 0 && (
                              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                                {isRtl ? `غير مقروء ${ticket.unreadCount}` : `${ticket.unreadCount} unread`}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold">{isRtl ? ticket.subjectAr || ticket.subject : ticket.subject || ticket.subjectAr}</p>
                          <p className="mt-1 text-xs text-neutral-500">{ticket.category?.nameAr || ticket.category?.name || (isRtl ? 'بدون تصنيف' : 'Uncategorized')}</p>
                        </div>
                        <div className="text-xs text-neutral-400">
                          {formatRelative(ticket.latestMessage?.createdAt || ticket.updatedAt || ticket.createdAt, lang)}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-400">
                  {isRtl ? 'لا توجد تذاكر حديثة حالياً' : 'No recent tickets yet'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'tickets' && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 ${darkMode ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-neutral-100'}`}>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'بحث' : 'Search'}</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setPage(1);
                      setSearch(e.target.value);
                    }}
                    placeholder={isRtl ? 'ابحث برقم التذكرة أو العنوان...' : 'Search by ticket number or subject...'}
                    className={`w-full rounded-xl border px-10 py-3 text-sm outline-none transition-colors ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100 placeholder:text-zinc-500' : 'border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400'}`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'الحالة' : 'Status'}</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStatusFilter(e.target.value);
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition-colors ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                >
                  <option value="">{isRtl ? 'كل الحالات' : 'All statuses'}</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{getStatusLabel(status, lang).label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'الأولوية' : 'Priority'}</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPage(1);
                    setPriorityFilter(e.target.value);
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition-colors ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                >
                  <option value="">{isRtl ? 'كل الأولويات' : 'All priorities'}</option>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>{getPriorityLabel(priority, lang).label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'التصنيف' : 'Category'}</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setPage(1);
                    setCategoryFilter(e.target.value);
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition-colors ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                >
                  <option value="">{isRtl ? 'كل التصنيفات' : 'All categories'}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {isRtl ? category.nameAr || category.name : category.name || category.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setNewTicketOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
              >
                <FilePlus2 size={14} />
                <span>{isRtl ? 'تذكرة جديدة' : 'New Ticket'}</span>
              </button>
              <button
                onClick={resetFilters}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${darkMode ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
              >
                <Filter size={14} />
                <span>{isRtl ? 'إعادة التصفية' : 'Reset'}</span>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'الترتيب' : 'Sort'}</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as TicketSort)}
                  className={`rounded-xl border px-3 py-2 text-xs outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                >
                  <option value="updated_desc">{isRtl ? 'الأحدث أولاً' : 'Newest first'}</option>
                  <option value="updated_asc">{isRtl ? 'الأقدم أولاً' : 'Oldest first'}</option>
                  <option value="priority_desc">{isRtl ? 'الأعلى أولوية' : 'Priority high to low'}</option>
                  <option value="priority_asc">{isRtl ? 'الأقل أولوية' : 'Priority low to high'}</option>
                  <option value="unread_desc">{isRtl ? 'غير المقروء أولاً' : 'Unread first'}</option>
                  <option value="unread_asc">{isRtl ? 'المقروء أولاً' : 'Read first'}</option>
                </select>
              </div>
            </div>
          </div>

          {(error || summaryError) && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error || summaryError}
            </div>
          )}

          <div className={`overflow-hidden rounded-2xl border ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-neutral-100 bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-neutral-100 text-sm">
                <thead className={`${darkMode ? 'bg-zinc-950/40' : 'bg-neutral-50'}`}>
                  <tr className="text-start text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
                    <th className="px-4 py-4 text-start">{isRtl ? 'التذكرة' : 'Ticket'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'الموضوع' : 'Subject'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'التصنيف' : 'Category'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'الأولوية' : 'Priority'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'غير مقروء' : 'Unread'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'آخر تحديث' : 'Updated'}</th>
                    <th className="px-4 py-4 text-start">{isRtl ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {ticketsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          <span>{isRtl ? 'جارٍ تحميل التذاكر...' : 'Loading tickets...'}</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedTickets.length > 0 ? (
                    sortedTickets.map((ticket) => {
                      const statusMeta = getStatusLabel(ticket.status || 'open', lang);
                      const priorityMeta = getPriorityLabel(ticket.priority || 'medium', lang);
                      const categoryName = ticket.category?.nameAr || ticket.category?.name || (isRtl ? 'بدون تصنيف' : 'Uncategorized');
                      return (
                        <tr key={ticket.id} className={`${darkMode ? 'hover:bg-zinc-950/30' : 'hover:bg-neutral-50'} transition-colors`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                                <Ticket size={16} />
                              </div>
                              <div>
                                <button onClick={() => openTicket(ticket.id)} className="text-sm font-black hover:text-brand-600">
                                  {ticket.ticketNumber || ticket.id}
                                </button>
                                <p className="mt-0.5 text-xs text-neutral-400">{formatDateOnly(ticket.createdAt || ticket.updatedAt, lang)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="max-w-sm">
                              <p className="truncate font-semibold">{isRtl ? ticket.subjectAr || ticket.subject : ticket.subject || ticket.subjectAr}</p>
                              <p className="mt-1 truncate text-xs text-neutral-400">{isRtl ? ticket.descriptionAr || ticket.description : ticket.description || ticket.descriptionAr}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold">{categoryName}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${priorityMeta.tone}`}>{priorityMeta.label}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusMeta.tone}`}>{statusMeta.label}</span>
                          </td>
                          <td className="px-4 py-4 text-xs font-bold text-brand-600">{Number(ticket.unreadCount || 0)}</td>
                          <td className="px-4 py-4 text-xs text-neutral-500">{formatRelative(ticket.updatedAt || ticket.latestMessage?.createdAt || ticket.createdAt, lang)}</td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => openTicket(ticket.id)}
                              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                            >
                              <span>{isRtl ? 'فتح' : 'Open'}</span>
                              <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-neutral-400">
                        <div className="space-y-2">
                          <p className="font-bold text-neutral-500">{isRtl ? 'لا توجد تذاكر تطابق الفلاتر الحالية' : 'No tickets match the current filters'}</p>
                          <p className="text-xs">{isRtl ? 'جرّب تعديل البحث أو إعادة التصفية' : 'Try adjusting your search or resetting filters'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={`flex flex-col gap-3 border-t px-4 py-4 text-xs md:flex-row md:items-center md:justify-between ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
              <div className="text-neutral-500">
                {isRtl
                  ? `عرض ${tickets.length} من أصل ${total} تذكرة`
                  : `Showing ${tickets.length} of ${total} tickets`}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(1)} disabled={page <= 1} className="rounded-lg border px-2.5 py-1.5 font-bold disabled:opacity-40">
                  {isRtl ? 'الأولى' : 'First'}
                </button>
                <button onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="rounded-lg border px-2.5 py-1.5 font-bold disabled:opacity-40">
                  {isRtl ? 'السابق' : 'Previous'}
                </button>
                <span className="px-2 py-1 text-neutral-500">
                  {page} / {Math.max(1, Math.ceil(total / limit) || 1)}
                </span>
                <button onClick={() => setPage((prev) => Math.min(Math.max(1, Math.ceil(total / limit) || 1), prev + 1))} disabled={page >= Math.max(1, Math.ceil(total / limit) || 1)} className="rounded-lg border px-2.5 py-1.5 font-bold disabled:opacity-40">
                  {isRtl ? 'التالي' : 'Next'}
                </button>
                <button onClick={() => setPage(Math.max(1, Math.ceil(total / limit) || 1))} disabled={page >= Math.max(1, Math.ceil(total / limit) || 1)} className="rounded-lg border px-2.5 py-1.5 font-bold disabled:opacity-40">
                  {isRtl ? 'الأخيرة' : 'Last'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {ticketDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
          >
            <div className="absolute inset-0 bg-neutral-950/50 backdrop-blur-sm" onClick={closeTicketDrawer} />
            <motion.aside
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className={`absolute top-0 h-full w-full max-w-4xl overflow-hidden border-l shadow-2xl ${isRtl ? 'left-0 border-l-0 border-r' : 'right-0 border-r-0 border-l'} ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
            >
              <div className={`flex items-center justify-between border-b px-5 py-4 ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-600">{isRtl ? 'محادثة الدعم' : 'Support Conversation'}</p>
                  <h3 className="mt-1 text-lg font-black">{ticketDrawerTicket?.ticketNumber || ticketDrawerTicket?.subject || (isRtl ? 'تفاصيل التذكرة' : 'Ticket Details')}</h3>
                </div>
                <button onClick={closeTicketDrawer} className={`rounded-xl border p-2 ${darkMode ? 'border-zinc-800 hover:bg-zinc-900' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                  <X size={18} />
                </button>
              </div>

              {detailLoading && !ticketDrawerTicket ? (
                <div className="flex h-[calc(100%-4rem)] items-center justify-center text-neutral-400">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>{isRtl ? 'جارٍ تحميل المحادثة...' : 'Loading conversation...'}</span>
                  </div>
                </div>
              ) : ticketDrawerTicket ? (
                <div className="grid h-[calc(100%-4rem)] grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className={`flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
                    <div className={`space-y-4 border-b p-5 ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getStatusLabel(ticketDrawerTicket.status || 'open', lang).tone}`}>
                          {getStatusLabel(ticketDrawerTicket.status || 'open', lang).label}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${getPriorityLabel(ticketDrawerTicket.priority || 'medium', lang).tone}`}>
                          {getPriorityLabel(ticketDrawerTicket.priority || 'medium', lang).label}
                        </span>
                        {Number(ticketDrawerTicket.unreadCount || 0) > 0 && (
                          <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                            {isRtl ? `غير مقروء ${ticketDrawerTicket.unreadCount}` : `${ticketDrawerTicket.unreadCount} unread`}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-neutral-500">{isRtl ? ticketDrawerTicket.subjectAr || ticketDrawerTicket.subject : ticketDrawerTicket.subject || ticketDrawerTicket.subjectAr}</p>

                      <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                        <div className={`rounded-2xl border p-3 ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-neutral-50/60'}`}>
                          <p className="text-neutral-400">{isRtl ? 'التصنيف' : 'Category'}</p>
                          <p className="mt-1 font-bold">{ticketDrawerTicket.category?.nameAr || ticketDrawerTicket.category?.name || (isRtl ? 'غير مصنف' : 'Uncategorized')}</p>
                        </div>
                        <div className={`rounded-2xl border p-3 ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-neutral-50/60'}`}>
                          <p className="text-neutral-400">{isRtl ? 'الرسائل' : 'Messages'}</p>
                          <p className="mt-1 font-bold">{Number(ticketDrawerTicket.messageCount || ticketDrawerTicket.messages?.length || 0)}</p>
                        </div>
                        <div className={`rounded-2xl border p-3 ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-neutral-50/60'}`}>
                          <p className="text-neutral-400">{isRtl ? 'مستلم' : 'Created'}</p>
                          <p className="mt-1 font-bold">{formatRelative(ticketDrawerTicket.createdAt, lang)}</p>
                        </div>
                        <div className={`rounded-2xl border p-3 ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-neutral-50/60'}`}>
                          <p className="text-neutral-400">{isRtl ? 'آخر تحديث' : 'Updated'}</p>
                          <p className="mt-1 font-bold">{formatRelative(ticketDrawerTicket.updatedAt || ticketDrawerTicket.latestMessage?.createdAt || ticketDrawerTicket.createdAt, lang)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={ticketDrawerTicket.status || 'open'}
                          onChange={(e) => void handleTicketStatusChange(e.target.value)}
                          disabled={detailActionBusy}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{getStatusLabel(status, lang).label}</option>
                          ))}
                        </select>
                        <select
                          value={ticketDrawerTicket.priority || 'medium'}
                          onChange={(e) => void handleTicketPriorityChange(e.target.value)}
                          disabled={detailActionBusy}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
                        >
                          {PRIORITY_OPTIONS.map((priority) => (
                            <option key={priority} value={priority}>{getPriorityLabel(priority, lang).label}</option>
                          ))}
                        </select>
                        <select
                          value={ticketDrawerTicket.category?.id || ''}
                          onChange={(e) => void handleTicketCategoryChange(e.target.value)}
                          disabled={detailActionBusy}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
                        >
                          <option value="">{isRtl ? 'بدون تصنيف' : 'Uncategorized'}</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {isRtl ? category.nameAr || category.name : category.name || category.nameAr}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => void handleToggleResolvedState()}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-800'}`}
                        >
                          {ticketDrawerTicket.status === 'closed' ? (isRtl ? 'إعادة فتح' : 'Reopen') : (isRtl ? 'إغلاق' : 'Close')}
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="space-y-4">
                        {(ticketDrawerTicket.messages || []).length > 0 ? (
                          [...(ticketDrawerTicket.messages || [])].sort((a, b) => safeDate(a.createdAt).getTime() - safeDate(b.createdAt).getTime()).map((message) => {
                            const isInternal = `${message.visibility || 'public'}` === 'internal';
                            return (
                              <div key={message.id} className={`rounded-2xl border p-4 ${isInternal ? (darkMode ? 'border-violet-900 bg-violet-950/20' : 'border-violet-200 bg-violet-50/40') : (darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-100 bg-white')}`}>
                                {message.replyToMessage && (
                                  <div className={`mb-3 rounded-xl border-l-4 border-brand-500 px-3 py-2 text-xs ${darkMode ? 'bg-zinc-900/60' : 'bg-neutral-50'}`}>
                                    <p className="font-bold text-brand-600">{isRtl ? 'رد على' : 'Replying to...'}</p>
                                    <p className="mt-1 line-clamp-2 text-neutral-500">{message.replyToMessage.content}</p>
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                                      <User size={16} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold">{message.senderType === 'customer' ? (isRtl ? 'العميل' : 'Customer') : message.senderType === 'support_agent' ? (isRtl ? 'موظف الدعم' : 'Support Agent') : message.senderType === 'ai' ? 'AI' : (isRtl ? 'النظام' : 'System')}</p>
                                      <p className="text-[11px] text-neutral-400">{formatDateTime(message.createdAt, lang)}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                                    <span className={`rounded-full border px-2 py-0.5 font-bold ${isInternal ? 'border-violet-200 text-violet-600' : 'border-neutral-200 text-neutral-500'}`}>
                                      {isInternal ? (isRtl ? 'داخلي' : 'Internal') : (isRtl ? 'عام' : 'Public')}
                                    </span>
                                    <button
                                      onClick={() => setReplyTarget(message)}
                                      className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5 font-bold text-neutral-500 hover:bg-neutral-50"
                                    >
                                      <MessageSquare size={12} />
                                      <span>{isRtl ? 'رد' : 'Reply'}</span>
                                    </button>
                                  </div>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-700 dark:text-zinc-200">{message.content}</p>
                                {(message.attachments || []).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {message.attachments.map((attachment: any) => (
                                      <a
                                        key={attachment.id}
                                        href={attachment.storageUrl || attachment.storagePath || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                      >
                                        <Paperclip size={12} />
                                        <span className="max-w-[12rem] truncate">{attachment.originalName || attachment.fileName}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
                            {isRtl ? 'لا توجد رسائل بعد' : 'No messages yet'}
                          </div>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleReplySubmit} className={`border-t p-5 ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
                      {replyTarget && (
                        <div className={`mb-3 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-950/20 dark:text-brand-300`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black">{isRtl ? 'رد على' : 'Replying to...'}</p>
                              <p className="mt-1 line-clamp-2">{replyTarget.content}</p>
                            </div>
                            <button type="button" onClick={() => setReplyTarget(null)} className="rounded-lg p-1 hover:bg-brand-100 dark:hover:bg-brand-950/40">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                      <div
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const dropped = readFiles(event.dataTransfer.files);
                          if (dropped.length > 0) {
                            setReplyFiles((prev) => mergeFiles(prev, dropped));
                          }
                        }}
                        className={`rounded-2xl border p-4 ${darkMode ? 'border-zinc-800 bg-zinc-950/30' : 'border-neutral-200 bg-neutral-50/40'}`}
                      >
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onPaste={(event) => {
                            const pasted = Array.from(event.clipboardData?.files || []) as File[];
                            if (pasted.length > 0) {
                              setReplyFiles((prev) => mergeFiles(prev, pasted));
                            }
                          }}
                          placeholder={isRtl ? 'اكتب ردك هنا...' : 'Write your reply here...'}
                          className={`min-h-[130px] w-full resize-none rounded-xl border px-3 py-3 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500' : 'border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400'}`}
                        />

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = readFiles(e.target.files);
                              if (files.length > 0) {
                                setReplyFiles((prev) => mergeFiles(prev, files));
                              }
                              e.currentTarget.value = '';
                            }}
                          />
                          <button
                            type="button"
                            onClick={triggerReplyFilePicker}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                          >
                            <CloudUpload size={14} />
                            <span>{isRtl ? 'إرفاق ملفات' : 'Upload files'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard?.read) {
                                void navigator.clipboard.read().then(async (items) => {
                                  const files: File[] = [];
                                  for (const item of items) {
                                    for (const type of item.types) {
                                      if (type.startsWith('image/')) {
                                        const blob = await item.getType(type);
                                        files.push(new File([blob], `clipboard-${Date.now()}.png`, { type }));
                                      }
                                    }
                                  }
                                  if (files.length > 0) {
                                    setReplyFiles((prev) => mergeFiles(prev, files));
                                  }
                                });
                              }
                            }}
                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                          >
                            <ClipboardPaste size={14} />
                            <span>{isRtl ? 'لصق من الحافظة' : 'Paste'}</span>
                          </button>
                          <button
                            type="submit"
                            disabled={composerSending || (!replyText.trim() && replyFiles.length === 0)}
                            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {composerSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                            <span>{isRtl ? 'إرسال الرد' : 'Send Reply'}</span>
                          </button>
                        </div>

                        {replyFiles.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {buildFileListPayload(replyFiles).map((item) => (
                              <div
                                key={item.id}
                                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 dark:border-zinc-700 dark:text-zinc-300"
                              >
                                <Paperclip size={12} />
                                <span className="max-w-[12rem] truncate">{item.file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => setReplyFiles((prev) => prev.filter((file) => file.name !== item.file.name || file.size !== item.file.size || file.lastModified !== item.file.lastModified))}
                                  className="rounded-full p-0.5 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className={`flex flex-col gap-4 overflow-y-auto p-5 ${darkMode ? 'bg-zinc-950/40' : 'bg-neutral-50/40'}`}>
                    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-neutral-100 bg-white'}`}>
                      <h4 className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">{isRtl ? 'المعلومات العامة' : 'General'}</h4>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-neutral-500">{isRtl ? 'العميل' : 'Customer'}</span>
                          <span className="font-bold">{ticketDrawerTicket.customer ? `${ticketDrawerTicket.customer.firstName || ''} ${ticketDrawerTicket.customer.lastName || ''}`.trim() || ticketDrawerTicket.customer.email || ticketDrawerTicket.customer.phone : (isRtl ? 'غير متوفر' : 'Unavailable')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-neutral-500">{isRtl ? 'القناة' : 'Source'}</span>
                          <span className="font-bold">{toText(ticketDrawerTicket.sourceChannel || ticketDrawerTicket.source, isRtl ? 'غير متوفر' : 'Unavailable')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-neutral-500">{isRtl ? 'الملكيّة' : 'Assigned To'}</span>
                          <span className="font-bold">{ticketDrawerTicket.assignedAgent?.displayNameAr || ticketDrawerTicket.assignedAgent?.displayName || (isRtl ? 'غير معيّن' : 'Unassigned')}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-neutral-500">{isRtl ? 'آخر رسالة' : 'Latest Message'}</span>
                          <span className="font-bold">{ticketDrawerTicket.latestMessage ? formatRelative(ticketDrawerTicket.latestMessage.createdAt, lang) : (isRtl ? 'لا توجد' : 'None')}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`rounded-2xl border p-4 ${darkMode ? 'border-zinc-800 bg-zinc-900' : 'border-neutral-100 bg-white'}`}>
                      <h4 className="text-xs font-black uppercase tracking-[0.22em] text-neutral-400">{isRtl ? 'المحادثة' : 'Conversation'}</h4>
                      <div className="mt-4 space-y-3 text-sm">
                        {(ticketDrawerTicket.messages || []).slice().sort((a, b) => safeDate(a.createdAt).getTime() - safeDate(b.createdAt).getTime()).map((message) => (
                          <button
                            key={message.id}
                            onClick={() => setReplyTarget(message)}
                            className={`w-full rounded-2xl border px-3 py-3 text-start ${darkMode ? 'border-zinc-800 bg-zinc-950/30 hover:bg-zinc-800/30' : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100'}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-bold">{message.senderType === 'customer' ? (isRtl ? 'العميل' : 'Customer') : message.senderType === 'support_agent' ? (isRtl ? 'فريق الدعم' : 'Support Agent') : message.senderType === 'ai' ? 'AI' : (isRtl ? 'النظام' : 'System')}</span>
                              <span className="text-[11px] text-neutral-400">{formatRelative(message.createdAt, lang)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{message.content}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[calc(100%-4rem)] items-center justify-center text-neutral-400">
                  {isRtl ? 'اختر تذكرة لعرض المحادثة' : 'Choose a ticket to view the conversation'}
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newTicketOpen && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-neutral-950/50 backdrop-blur-sm" onClick={closeNewTicket} />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className={`absolute left-1/2 top-1/2 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border shadow-2xl ${darkMode ? 'border-zinc-800 bg-zinc-950 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
            >
              <div className={`flex items-center justify-between border-b px-6 py-4 ${darkMode ? 'border-zinc-800' : 'border-neutral-100'}`}>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-600">{isRtl ? 'تذكرة جديدة' : 'New Ticket'}</p>
                  <h3 className="mt-1 text-lg font-black">{isRtl ? 'إنشاء تذكرة دعم' : 'Create support ticket'}</h3>
                </div>
                <button onClick={closeNewTicket} className={`rounded-xl border p-2 ${darkMode ? 'border-zinc-800 hover:bg-zinc-900' : 'border-neutral-200 hover:bg-neutral-50'}`}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleNewTicketSubmit} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'التصنيف' : 'Category'}</label>
                    <select
                      value={newTicketCategory}
                      onChange={(e) => setNewTicketCategory(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                    >
                      <option value="">{isRtl ? 'اختر تصنيفاً' : 'Choose a category'}</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {isRtl ? category.nameAr || category.name : category.name || category.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'الأولوية' : 'Priority'}</label>
                    <select
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value)}
                      className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100' : 'border-neutral-200 bg-white text-neutral-900'}`}
                    >
                      {PRIORITY_OPTIONS.map((priority) => (
                        <option key={priority} value={priority}>{getPriorityLabel(priority, lang).label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'العنوان' : 'Subject'}</label>
                  <input
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    placeholder={isRtl ? 'اكتب عنوان التذكرة...' : 'Write a ticket subject...'}
                    className={`w-full rounded-xl border px-3 py-3 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100 placeholder:text-zinc-500' : 'border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400'}`}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">{isRtl ? 'الرسالة الأولى' : 'Initial Message'}</label>
                  <textarea
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    placeholder={isRtl ? 'صف المشكلة أو الطلب...' : 'Describe the issue or request...'}
                    className={`min-h-[150px] w-full rounded-xl border px-3 py-3 text-sm outline-none ${darkMode ? 'border-zinc-800 bg-zinc-950/40 text-zinc-100 placeholder:text-zinc-500' : 'border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400'}`}
                  />
                </div>

                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const dropped = readFiles(event.dataTransfer.files);
                    if (dropped.length > 0) {
                      setNewTicketFiles((prev) => mergeFiles(prev, dropped));
                    }
                  }}
                  className={`rounded-2xl border border-dashed p-4 ${darkMode ? 'border-zinc-700 bg-zinc-950/20' : 'border-neutral-200 bg-neutral-50/50'}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={newTicketFileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = readFiles(e.target.files);
                        if (files.length > 0) {
                          setNewTicketFiles((prev) => mergeFiles(prev, files));
                        }
                        e.currentTarget.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={triggerNewTicketFilePicker}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${darkMode ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-800' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                    >
                      <Paperclip size={14} />
                      <span>{isRtl ? 'إرفاق ملفات' : 'Attach files'}</span>
                    </button>
                    <span className="text-xs text-neutral-400">{isRtl ? 'يمكنك السحب والإفلات أو اللصق من الحافظة' : 'Drag and drop or paste clipboard images'}</span>
                  </div>
                  {newTicketFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {buildFileListPayload(newTicketFiles).map((item) => (
                        <div
                          key={item.id}
                          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 dark:border-zinc-700 dark:text-zinc-300"
                        >
                          <Paperclip size={12} />
                          <span className="max-w-[12rem] truncate">{item.file.name}</span>
                          <button
                            type="button"
                            onClick={() => setNewTicketFiles((prev) => prev.filter((file) => file.name !== item.file.name || file.size !== item.file.size || file.lastModified !== item.file.lastModified))}
                            className="rounded-full p-0.5 hover:bg-neutral-100 dark:hover:bg-zinc-800"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {newTicketValidation && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {newTicketValidation}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t pt-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={closeNewTicket}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold ${darkMode ? 'border-zinc-800 text-zinc-300 hover:bg-zinc-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={newTicketSubmitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {newTicketSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{isRtl ? 'إنشاء' : 'Create Ticket'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
