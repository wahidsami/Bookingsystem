"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAppDialog } from "@/components/AppDialogProvider";
import { humanizeValue } from "@/lib/display";

type SupportCategory = {
  id: string;
  name: string;
  nameAr?: string | null;
  color?: string | null;
  icon?: string | null;
  scope?: string | null;
  isActive?: boolean;
};

type SupportAgentProfile = {
  id: string;
  displayName?: string | null;
  displayNameAr?: string | null;
  title?: string | null;
  avatarUrl?: string | null;
  status?: string | null;
  presenceStatus?: string | null;
};

type SupportAttachment = {
  id: string;
  fileName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  fileCategory?: string | null;
  storageUrl?: string | null;
  fileSize?: number | null;
  createdAt?: string | null;
};

type SupportMessage = {
  id: string;
  senderType: "customer" | "support_agent" | "ai" | "system";
  content: string;
  visibility: "public" | "internal";
  replyToMessageId?: string | null;
  replyToMessage?: {
    id: string;
    senderType: string;
    content: string;
    visibility: string;
    createdAt?: string | null;
  } | null;
  attachments?: SupportAttachment[];
  createdAt?: string | null;
};

type SupportTicketEvent = {
  id: string;
  eventType: string;
  actorType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromPriority?: string | null;
  toPriority?: string | null;
  payload?: Record<string, any>;
  occurredAt?: string | null;
  createdAt?: string | null;
};

type SupportTicket = {
  id: string;
  ticketNumber: string;
  tenantId?: string | null;
  customerPlatformUserId?: string | null;
  supportCategoryId?: string | null;
  assignedSupportAgentId?: string | null;
  source?: string | null;
  sourceChannel?: string | null;
  status: string;
  priority: string;
  language?: string | null;
  subject?: string | null;
  subjectAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  lastMessageAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  reopenedAt?: string | null;
  metadata?: Record<string, any>;
  links?: Array<{ id: string; ticketId: string; entityType: string; entityId: string; createdBy?: string | null; createdAt?: string | null }>;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    profileImage?: string | null;
  } | null;
  category?: {
    id: string;
    slug?: string | null;
    scope?: string | null;
    name?: string | null;
    nameAr?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  assignedAgent?: SupportAgentProfile | null;
  messages?: SupportMessage[];
  events?: SupportTicketEvent[];
  unreadCount?: number;
  messageCount?: number;
  attachmentCount?: number;
  latestMessage?: SupportMessage | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CustomerProfile = {
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    walletBalance?: number | null;
    loyaltyPoints?: number | null;
    profileImage?: string | null;
    preferredLanguage?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    createdAt?: string | null;
  } | null;
  bookings?: any[];
  transactions?: any[];
  stats?: any;
};

type TicketFilters = {
  search: string;
  status: string;
  priority: string;
  categoryId: string;
  assigned: "all" | "mine" | "unassigned";
  datePreset: "all" | "today" | "7d" | "30d" | "90d" | "custom";
  dateFrom: string;
  dateTo: string;
  sortBy: "updated_desc" | "updated_asc" | "priority_desc" | "priority_asc" | "unread_desc";
  page: number;
  limit: number;
};

type NewTicketForm = {
  categoryId: string;
  priority: string;
  subject: string;
  initialMessage: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  waiting_for_customer: "Waiting for Customer",
  waiting_for_support: "Waiting for Support",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-slate-700 text-slate-200 border-slate-600",
  open: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  assigned: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  waiting_for_customer: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  waiting_for_support: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  resolved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-zinc-700 text-zinc-200 border-zinc-600",
  reopened: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-slate-700 text-slate-200 border-slate-600",
  medium: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  urgent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const EVENT_LABELS: Record<string, string> = {
  ticket_created: "Ticket Created",
  reply_added: "Reply Added",
  attachment_added: "Attachment Added",
  assigned: "Assigned",
  priority_changed: "Priority Changed",
  status_changed: "Status Changed",
  closed: "Closed",
  reopened: "Reopened",
  category_changed: "Category Changed",
};

function formatRelative(value?: string | null) {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "—";
  }
}

function formatExact(value?: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy, HH:mm");
  } catch {
    return "—";
  }
}

function getTicketDisplayName(ticket: SupportTicket | null) {
  if (!ticket) return "—";
  const name = [ticket.customer?.firstName, ticket.customer?.lastName].filter(Boolean).join(" ").trim();
  return name || ticket.customer?.email || ticket.ticketNumber || "—";
}

function getTicketCategoryName(ticket: SupportTicket | null) {
  if (!ticket) return "—";
  return ticket.category?.nameAr || ticket.category?.name || "Uncategorized";
}

function getBadgeClass(map: Record<string, string>, value?: string | null) {
  return map[(value || "").toLowerCase()] || "bg-white/10 text-white/70 border-white/10";
}

function getTicketActivityDate(ticket: SupportTicket) {
  return ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt || null;
}

function TicketEventRow({ event }: { event: SupportTicketEvent }) {
  const label = EVENT_LABELS[event.eventType] || humanizeValue(event.eventType);
  const details = [
    event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus ? `${STATUS_LABELS[event.fromStatus] || event.fromStatus} → ${STATUS_LABELS[event.toStatus] || event.toStatus}` : null,
    event.fromPriority && event.toPriority && event.fromPriority !== event.toPriority ? `${PRIORITY_LABELS[event.fromPriority] || event.fromPriority} → ${PRIORITY_LABELS[event.toPriority] || event.toPriority}` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-dark-700 bg-dark-800/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          {details.length > 0 && <p className="mt-1 text-xs text-dark-300">{details.join(" • ")}</p>}
          {event.payload?.visibility && (
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-dark-500">
              {String(event.payload.visibility)}
            </p>
          )}
        </div>
        <span className="text-[11px] text-dark-500">{formatExact(event.occurredAt || event.createdAt || null)}</span>
      </div>
    </div>
  );
}

function MessageCard({
  message,
  canReply,
  onReply,
}: {
  message: SupportMessage;
  canReply: boolean;
  onReply: (messageId: string) => void;
}) {
  const isInternal = message.visibility === "internal";
  return (
    <div className={`rounded-2xl border p-4 ${isInternal ? "border-amber-500/30 bg-amber-500/5" : "border-dark-700 bg-dark-800/80"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">
              {message.senderType === "customer"
                ? "Customer"
                : message.senderType === "support_agent"
                  ? "Support Agent"
                  : message.senderType === "ai"
                    ? "AI"
                    : "System"}
            </p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${isInternal ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-white/10 bg-white/5 text-white/70"}`}>
              {isInternal ? "Internal" : "Public"}
            </span>
          </div>
          <p className="mt-1 text-xs text-dark-400">{formatExact(message.createdAt || null)}</p>
        </div>
        {canReply && (
          <button
            type="button"
            onClick={() => onReply(message.id)}
            className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-primary-500 hover:text-white"
          >
            Reply
          </button>
        )}
      </div>

      {message.replyToMessage && (
        <div className="mt-4 rounded-xl border border-dark-700/80 bg-dark-900/60 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dark-500">Replying to...</p>
          <p className="mt-1 text-sm text-dark-200 line-clamp-3">{message.replyToMessage.content}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-dark-100">{message.content}</p>
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.storageUrl || "#"}
                target={attachment.storageUrl ? "_blank" : undefined}
                rel={attachment.storageUrl ? "noreferrer" : undefined}
                className="inline-flex items-center gap-2 rounded-lg border border-dark-700 bg-dark-900/60 px-3 py-2 text-xs text-dark-200 transition hover:border-primary-500 hover:text-white"
              >
                <span aria-hidden>📎</span>
                <span className="max-w-[14rem] truncate">{attachment.originalName || attachment.fileName || "Attachment"}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function SupportOperationsConsole({ initialTicketId = null }: { initialTicketId?: string | null }) {
  const { admin } = useAuth();
  const dialog = useAppDialog();
  const router = useRouter();
  const supportAgentId = admin?.supportAgentProfile?.id || null;
  const canManageSupport = admin?.role === "super_admin" || admin?.role === "support";

  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketPagination, setTicketPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketListLoading, setTicketListLoading] = useState(true);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [customerProfileError, setCustomerProfileError] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [newTicketSubmitting, setNewTicketSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyVisibility, setReplyVisibility] = useState<"public" | "internal">("public");
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [newTicketFiles, setNewTicketFiles] = useState<File[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<TicketFilters>({
    search: "",
    status: "",
    priority: "",
    categoryId: "",
    assigned: "all",
    datePreset: "all",
    dateFrom: "",
    dateTo: "",
    sortBy: "updated_desc",
    page: 1,
    limit: 20,
  });
  const [newTicketForm, setNewTicketForm] = useState<NewTicketForm>({
    categoryId: "",
    priority: "medium",
    subject: "",
    initialMessage: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const newTicketFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentDateRange = useMemo(() => {
    const now = new Date();
    const range = {
      start: null as Date | null,
      end: null as Date | null,
    };

    switch (filters.datePreset) {
      case "today":
        range.start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        range.end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "7d":
        range.start = new Date(now);
        range.start.setDate(range.start.getDate() - 7);
        range.end = now;
        break;
      case "30d":
        range.start = new Date(now);
        range.start.setDate(range.start.getDate() - 30);
        range.end = now;
        break;
      case "90d":
        range.start = new Date(now);
        range.start.setDate(range.start.getDate() - 90);
        range.end = now;
        break;
      case "custom":
        range.start = filters.dateFrom ? new Date(filters.dateFrom) : null;
        range.end = filters.dateTo ? new Date(filters.dateTo) : null;
        break;
      default:
        break;
    }

    return range;
  }, [filters.dateFrom, filters.datePreset, filters.dateTo]);

  const loadCategories = async () => {
    try {
      const response = await adminApi.getSupportCategories();
      if (response.success) {
        setCategories(response.categories || []);
      }
    } catch (error) {
      void error;
    }
  };

  const loadTickets = async (targetPage = filters.page) => {
    try {
      setTicketListLoading(true);
      setTicketError(null);

      const response = await adminApi.getSupportTickets({
        page: targetPage,
        limit: filters.limit,
        search: appliedSearch || undefined,
        status: filters.status || undefined,
        priority: filters.priority || undefined,
        supportCategoryId: filters.categoryId || undefined,
        assignedSupportAgentId: filters.assigned === "mine" ? supportAgentId || undefined : undefined,
      });

      if (response.success) {
        setTickets(response.tickets || []);
        setTicketPagination(response.pagination || { page: 1, limit: filters.limit, total: 0, totalPages: 1 });
        setSelectedTicketIds((current) => current.filter((id) => (response.tickets || []).some((ticket: SupportTicket) => ticket.id === id)));
      } else {
        setTicketError("Failed to load support tickets");
      }
    } catch (error) {
      setTicketError(error instanceof Error ? error.message : "Failed to load support tickets");
      void error;
    } finally {
      setTicketListLoading(false);
    }
  };

  const loadCustomerProfile = async (ticket: SupportTicket) => {
    if (!ticket.customerPlatformUserId) {
      setCustomerProfile(null);
      setCustomerProfileError(null);
      return;
    }

    setCustomerProfileLoading(true);
    setCustomerProfileError(null);
    try {
      const response = await adminApi.getUserDetails(ticket.customerPlatformUserId);
      if (response.success) {
        setCustomerProfile({
          user: response.user,
          bookings: response.bookings || [],
          transactions: response.transactions || [],
          stats: response.stats || null,
        });
      }
    } catch (error) {
      setCustomerProfile(null);
      setCustomerProfileError(error instanceof Error ? error.message : "Failed to load customer context");
      void error;
    } finally {
      setCustomerProfileLoading(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    setTicketLoading(true);
    try {
      const response = await adminApi.getSupportTicket(ticketId);
      if (response.success) {
        const ticket = response.ticket as SupportTicket;
        setSelectedTicket(ticket);
        setReplyToMessageId(null);
        await loadCustomerProfile(ticket);
        await adminApi.markSupportTicketRead(ticketId);
        await loadTickets(ticketPagination.page);
      }
    } catch (error) {
      void error;
      setTicketError(error instanceof Error ? error.message : "Failed to load ticket details");
    } finally {
      setTicketLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadTickets(1);
    setFilters((current) => ({ ...current, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, filters.status, filters.priority, filters.categoryId, filters.assigned, filters.datePreset, filters.dateFrom, filters.dateTo, filters.sortBy, filters.limit, supportAgentId]);

  useEffect(() => {
    if (!selectedTicketId && tickets.length > 0) {
      setSelectedTicketId(tickets[0].id);
      return;
    }

    if (!selectedTicketId && initialTicketId) {
      setSelectedTicketId(initialTicketId);
      return;
    }

    if (selectedTicketId) {
      const ticketInQueue = tickets.find((ticket) => ticket.id === selectedTicketId);
      if (ticketInQueue && !selectedTicket) {
        loadTicketDetails(selectedTicketId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, selectedTicketId, initialTicketId]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      setCustomerProfile(null);
      return;
    }

    loadTicketDetails(selectedTicketId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId]);

  const visibleTickets = useMemo(() => {
    let rows = [...tickets];

    if (filters.assigned === "unassigned") {
      rows = rows.filter((ticket) => !ticket.assignedSupportAgentId);
    }

    if (currentDateRange.start || currentDateRange.end) {
      rows = rows.filter((ticket) => {
        const dateValue = new Date(getTicketActivityDate(ticket) || ticket.updatedAt || ticket.createdAt || Date.now());
        if (currentDateRange.start && dateValue < currentDateRange.start) return false;
        if (currentDateRange.end && dateValue > currentDateRange.end) return false;
        return true;
      });
    }

    rows.sort((a, b) => {
      if (filters.sortBy === "priority_desc" || filters.sortBy === "priority_asc") {
        const weight = { low: 1, medium: 2, high: 3, urgent: 4 } as Record<string, number>;
        const left = weight[(a.priority || "").toLowerCase()] || 0;
        const right = weight[(b.priority || "").toLowerCase()] || 0;
        return filters.sortBy === "priority_desc" ? right - left : left - right;
      }

      if (filters.sortBy === "unread_desc") {
        return Number(b.unreadCount || 0) - Number(a.unreadCount || 0);
      }

      const leftDate = new Date(getTicketActivityDate(a) || a.updatedAt || a.createdAt || 0).getTime();
      const rightDate = new Date(getTicketActivityDate(b) || b.updatedAt || b.createdAt || 0).getTime();
      return filters.sortBy === "updated_asc" ? leftDate - rightDate : rightDate - leftDate;
    });

    return rows;
  }, [currentDateRange.end, currentDateRange.start, filters.assigned, filters.sortBy, tickets]);

  const summary = useMemo(() => {
    const rows = visibleTickets;
    const waitingForSupport = rows.filter((ticket) => ticket.status === "waiting_for_support").length;
    const waitingForMe = rows.filter((ticket) => ticket.assignedSupportAgentId && ticket.assignedSupportAgentId === supportAgentId && ["open", "assigned", "in_progress", "waiting_for_support", "waiting_for_customer", "reopened"].includes(ticket.status)).length;
    return {
      openTickets: rows.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
      waitingForSupport,
      waitingForMe,
      resolved: rows.filter((ticket) => ticket.status === "resolved").length,
      closed: rows.filter((ticket) => ticket.status === "closed").length,
      unreadReplies: rows.reduce((sum, ticket) => sum + Number(ticket.unreadCount || 0), 0),
      recentActivity: rows
        .slice()
        .sort((a, b) => new Date(getTicketActivityDate(b) || b.updatedAt || b.createdAt || 0).getTime() - new Date(getTicketActivityDate(a) || a.updatedAt || a.createdAt || 0).getTime())
        .slice(0, 5),
    };
  }, [supportAgentId, visibleTickets]);

  const selectedCategory = useMemo(() => categories.find((category) => category.id === newTicketForm.categoryId) || null, [categories, newTicketForm.categoryId]);

  const currentTicket = selectedTicket || visibleTickets.find((ticket) => ticket.id === selectedTicketId) || null;

  const timelineItems = useMemo(() => {
    const ticket = selectedTicket;
    if (!ticket) return [];

    const messageItems = (ticket.messages || []).map((message) => ({
      kind: "message" as const,
      id: message.id,
      date: message.createdAt || null,
      data: message,
    }));

    const eventItems = (ticket.events || []).map((event) => ({
      kind: "event" as const,
      id: event.id,
      date: event.occurredAt || event.createdAt || null,
      data: event,
    }));

    return [...messageItems, ...eventItems].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
  }, [selectedTicket]);

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicketId(ticket.id);
    await router.push(`/dashboard/support/${ticket.id}`);
  };

  const handleToggleSelection = (ticketId: string) => {
    setSelectedTicketIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId]
    );
  };

  const handleSelectAllVisible = () => {
    const ids = visibleTickets.map((ticket) => ticket.id);
    setSelectedTicketIds(ids);
  };

  const handleClearSelection = () => setSelectedTicketIds([]);

  const handleBulkRead = async () => {
    if (selectedTicketIds.length === 0) return;
    for (const ticketId of selectedTicketIds) {
      try {
        await adminApi.markSupportTicketRead(ticketId);
      } catch (error) {
        void error;
      }
    }
    await loadTickets(ticketPagination.page);
    if (selectedTicketId) await loadTicketDetails(selectedTicketId);
  };

  const handleBulkClose = async () => {
    if (selectedTicketIds.length === 0) return;
    if (!(await dialog.confirm(`Close ${selectedTicketIds.length} selected ticket(s)?`))) return;

    for (const ticketId of selectedTicketIds) {
      try {
        await adminApi.closeSupportTicket(ticketId);
      } catch (error) {
        void error;
      }
    }
    handleClearSelection();
    await loadTickets(ticketPagination.page);
    if (selectedTicketId) await loadTicketDetails(selectedTicketId);
  };

  const handleAssignToMe = async () => {
    if (!selectedTicket || !supportAgentId) return;
    try {
      await adminApi.assignSupportTicket(selectedTicket.id, supportAgentId);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Assignment failed",
        message: error instanceof Error ? error.message : "Failed to assign ticket",
        tone: "danger",
      });
    }
  };

  const handleUnassign = async () => {
    if (!selectedTicket) return;
    if (!(await dialog.confirm("Unassign this ticket from the current agent?"))) return;

    try {
      await adminApi.unassignSupportTicket(selectedTicket.id);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Unassign failed",
        message: error instanceof Error ? error.message : "Failed to unassign ticket",
        tone: "danger",
      });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await adminApi.changeSupportTicketStatus(selectedTicket.id, status);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Status change failed",
        message: error instanceof Error ? error.message : "Failed to update ticket status",
        tone: "danger",
      });
    }
  };

  const handlePriorityChange = async (priority: string) => {
    if (!selectedTicket) return;
    try {
      await adminApi.changeSupportTicketPriority(selectedTicket.id, priority);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Priority change failed",
        message: error instanceof Error ? error.message : "Failed to update ticket priority",
        tone: "danger",
      });
    }
  };

  const handleCategoryChange = async (supportCategoryId: string) => {
    if (!selectedTicket) return;
    try {
      await adminApi.changeSupportTicketCategory(selectedTicket.id, supportCategoryId || null);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Category change failed",
        message: error instanceof Error ? error.message : "Failed to update ticket category",
        tone: "danger",
      });
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    if (!(await dialog.confirm("Close this ticket?"))) return;
    try {
      await adminApi.closeSupportTicket(selectedTicket.id);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Close failed",
        message: error instanceof Error ? error.message : "Failed to close ticket",
        tone: "danger",
      });
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    try {
      await adminApi.reopenSupportTicket(selectedTicket.id);
      await loadTicketDetails(selectedTicket.id);
      await loadTickets(ticketPagination.page);
    } catch (error) {
      await dialog.alert({
        title: "Reopen failed",
        message: error instanceof Error ? error.message : "Failed to reopen ticket",
        tone: "danger",
      });
    }
  };

  const handleNewTicketSubmit = async () => {
    if (!newTicketForm.subject.trim() || !newTicketForm.initialMessage.trim()) {
      await dialog.alert({
        title: "Missing fields",
        message: "Subject and initial message are required.",
        tone: "danger",
      });
      return;
    }

    setNewTicketSubmitting(true);
    try {
      const response = await adminApi.createSupportTicket(
        {
          supportCategoryId: newTicketForm.categoryId || undefined,
          priority: newTicketForm.priority,
          subject: newTicketForm.subject.trim(),
          description: newTicketForm.initialMessage.trim(),
          source: "dashboard",
          sourceChannel: "support_portal",
          metadata: { createdFrom: "admin_support_console" },
        },
        newTicketFiles
      );

      if (response.success && response.ticket) {
        const ticket = response.ticket as SupportTicket;
        setNewTicketOpen(false);
        setNewTicketForm({
          categoryId: "",
          priority: "medium",
          subject: "",
          initialMessage: "",
        });
        setNewTicketFiles([]);
        await loadTickets(1);
        setSelectedTicketId(ticket.id);
        await router.push(`/dashboard/support/${ticket.id}`);
      }
    } catch (error) {
      await dialog.alert({
        title: "Ticket creation failed",
        message: error instanceof Error ? error.message : "Failed to create support ticket",
        tone: "danger",
      });
    } finally {
      setNewTicketSubmitting(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!selectedTicket || !replyText.trim()) {
      return;
    }

    setReplySubmitting(true);
    try {
      const response = await adminApi.replyToSupportTicket(
        selectedTicket.id,
        {
          content: replyText.trim(),
          visibility: replyVisibility,
          replyToMessageId: replyToMessageId || undefined,
        },
        replyFiles
      );

      if (response.success) {
        setReplyText("");
        setReplyFiles([]);
        setReplyToMessageId(null);
        if (response.ticket) {
          setSelectedTicket(response.ticket as SupportTicket);
        } else {
          await loadTicketDetails(selectedTicket.id);
        }
        await loadTickets(ticketPagination.page);
      }
    } catch (error) {
      await dialog.alert({
        title: "Reply failed",
        message: error instanceof Error ? error.message : "Failed to send reply",
        tone: "danger",
      });
    } finally {
      setReplySubmitting(false);
    }
  };

  const applyFileSelection = (files: FileList | null, setter: Dispatch<SetStateAction<File[]>>) => {
    if (!files || files.length === 0) return;
    setter((current) => [...current, ...Array.from(files)]);
  };

  if (!canManageSupport) {
    return (
      <div className="rounded-2xl border border-dark-700 bg-dark-800/80 p-8 text-center">
        <h2 className="text-xl font-semibold text-white">Support console unavailable</h2>
        <p className="mt-2 text-sm text-dark-300">
          Your account does not have support console access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-dark-700/80 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-primary-300">Support Operations Console</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Conversation Queue</h1>
            <p className="mt-1 text-sm text-dark-300">
              Handle customer issues in a single chronological workspace without threaded distractions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNewTicketOpen(true)}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              + New Ticket
            </button>
            <button
              type="button"
              onClick={() => setSidePanelOpen((current) => !current)}
              className="rounded-xl border border-dark-700 px-4 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              {sidePanelOpen ? "Hide Context" : "Show Context"}
            </button>
            <button
              type="button"
              onClick={() => setAiPanelOpen((current) => !current)}
              className="rounded-xl border border-dark-700 px-4 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white"
            >
              {aiPanelOpen ? "Hide AI" : "AI Preview"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        {/* Queue */}
        <aside className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-2">
            {[
              { label: "Open Tickets", value: summary.openTickets },
              { label: "Waiting for Support", value: summary.waitingForSupport },
              { label: "Waiting for Me", value: summary.waitingForMe },
              { label: "Resolved", value: summary.resolved },
              { label: "Closed", value: summary.closed },
              { label: "Unread Replies", value: summary.unreadReplies },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-dark-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{Number(item.value || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="border-b border-dark-700 px-4 py-4">
              <div className="grid gap-3">
                <label className="space-y-2">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Search</span>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAppliedSearch(searchDraft.trim());
                      setFilters((current) => ({ ...current, page: 1 }));
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={searchDraft}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder="Subject, ticket #, customer..."
                      className="input flex-1"
                    />
                    <button type="submit" className="btn btn-primary btn-sm">
                      Search
                    </button>
                  </form>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Status</span>
                    <select
                      value={filters.status}
                      onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}
                      className="select"
                    >
                      <option value="">All</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Priority</span>
                    <select
                      value={filters.priority}
                      onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value, page: 1 }))}
                      className="select"
                    >
                      <option value="">All</option>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Category</span>
                    <select
                      value={filters.categoryId}
                      onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value, page: 1 }))}
                      className="select"
                    >
                      <option value="">All</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.nameAr || category.name || "Uncategorized"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Assigned</span>
                    <select
                      value={filters.assigned}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          assigned: event.target.value as TicketFilters["assigned"],
                          page: 1
                        }))
                      }
                      className="select"
                    >
                      <option value="all">All</option>
                      <option value="mine">Assigned to me</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Date</span>
                    <select
                      value={filters.datePreset}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          datePreset: event.target.value as TicketFilters["datePreset"],
                          page: 1
                        }))
                      }
                      className="select"
                    >
                      <option value="all">Any time</option>
                      <option value="today">Today</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="90d">Last 90 days</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">Sort</span>
                    <select
                      value={filters.sortBy}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          sortBy: event.target.value as TicketFilters["sortBy"],
                          page: 1
                        }))
                      }
                      className="select"
                    >
                      <option value="updated_desc">Newest</option>
                      <option value="updated_asc">Oldest</option>
                      <option value="priority_desc">Priority High → Low</option>
                      <option value="priority_asc">Priority Low → High</option>
                      <option value="unread_desc">Unread First</option>
                    </select>
                  </label>
                </div>

                {filters.datePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">From</span>
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, page: 1 }))}
                        className="input"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-dark-400">To</span>
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value, page: 1 }))}
                        className="input"
                      />
                    </label>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({
                        search: "",
                        status: "",
                        priority: "",
                        categoryId: "",
                        assigned: "all",
                        datePreset: "all",
                        dateFrom: "",
                        dateTo: "",
                        sortBy: "updated_desc",
                        page: 1,
                        limit: 20,
                      });
                      setSearchDraft("");
                      setAppliedSearch("");
                    }}
                    className="rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
                  >
                    Reset Filters
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-400">Rows</span>
                    <select
                      value={filters.limit}
                      onChange={(event) => setFilters((current) => ({ ...current, limit: parseInt(event.target.value, 10), page: 1 }))}
                      className="select !w-24"
                    >
                      {[10, 20, 50, 100].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-dark-400">
                  {selectedTicketIds.length > 0 ? `${selectedTicketIds.length} selected` : `${visibleTickets.length} visible tickets`}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllVisible}
                    className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
                  >
                    Select Visible
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="rounded-lg border border-dark-700 px-3 py-1.5 text-xs text-dark-200 transition hover:border-dark-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {selectedTicketIds.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-dark-700 bg-dark-900/60 p-3">
                  <button type="button" onClick={handleBulkRead} className="btn btn-secondary btn-sm">
                    Mark Read
                  </button>
                  <button type="button" onClick={handleBulkClose} className="btn btn-danger btn-sm">
                    Close Selected
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {ticketListLoading ? (
                  <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-6 text-center text-dark-400">
                    Loading support queue...
                  </div>
                ) : ticketError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
                    {ticketError}
                  </div>
                ) : visibleTickets.length === 0 ? (
                  <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-6 text-center">
                    <p className="text-white font-semibold">No tickets found</p>
                    <p className="mt-1 text-sm text-dark-400">Try adjusting filters or create a new ticket.</p>
                  </div>
                ) : (
                  visibleTickets.map((ticket) => {
                    const isSelected = ticket.id === selectedTicketId;
                    const isChecked = selectedTicketIds.includes(ticket.id);
                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => handleSelectTicket(ticket)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected ? "border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10" : "border-dark-700 bg-dark-800/70 hover:border-dark-500 hover:bg-dark-800"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <label className="mt-1 flex items-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => {
                                event.stopPropagation();
                                handleToggleSelection(ticket.id);
                              }}
                              onClick={(event) => event.stopPropagation()}
                              className="h-4 w-4 rounded border-dark-500 bg-dark-900 text-primary-500"
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{ticket.subject || ticket.subjectAr || ticket.ticketNumber}</p>
                                <p className="mt-1 text-xs text-dark-400">{getTicketDisplayName(ticket)}</p>
                              </div>
                              {Number(ticket.unreadCount || 0) > 0 && (
                                <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                                  {ticket.unreadCount}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBadgeClass(STATUS_BADGES, ticket.status)}`}>
                                {STATUS_LABELS[ticket.status] || humanizeValue(ticket.status)}
                              </span>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBadgeClass(PRIORITY_BADGES, ticket.priority)}`}>
                                {PRIORITY_LABELS[ticket.priority] || humanizeValue(ticket.priority)}
                              </span>
                              <span className="rounded-full border border-dark-700 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-white/70">
                                {getTicketCategoryName(ticket)}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-dark-400">
                              <span>Updated {formatRelative(getTicketActivityDate(ticket))}</span>
                              <span className="text-right">
                                Assigned: {ticket.assignedAgent?.displayName || "Queue"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-dark-700 pt-4 text-xs text-dark-400">
                <span>
                  Page {ticketPagination.page} of {ticketPagination.totalPages} · {ticketPagination.total.toLocaleString()} tickets
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFilters((current) => ({ ...current, page: Math.max(current.page - 1, 1) }))}
                    disabled={ticketPagination.page <= 1 || ticketListLoading}
                    className="rounded-lg border border-dark-700 px-3 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((current) => ({
                        ...current,
                        page: Math.min(current.page + 1, ticketPagination.totalPages || 1),
                      }))
                    }
                    disabled={ticketPagination.page >= ticketPagination.totalPages || ticketListLoading}
                    className="rounded-lg border border-dark-700 px-3 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Conversation workspace */}
        <main className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-dark-700/80 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-dark-700 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-dark-300">
                    {currentTicket?.ticketNumber || "No ticket selected"}
                  </span>
                  {currentTicket && (
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getBadgeClass(STATUS_BADGES, currentTicket.status)}`}>
                      {STATUS_LABELS[currentTicket.status] || humanizeValue(currentTicket.status)}
                    </span>
                  )}
                  {currentTicket && (
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-medium ${getBadgeClass(PRIORITY_BADGES, currentTicket.priority)}`}>
                      {PRIORITY_LABELS[currentTicket.priority] || humanizeValue(currentTicket.priority)}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {currentTicket?.subject || currentTicket?.subjectAr || "Select a ticket to view the conversation"}
                </h2>
                <p className="mt-2 text-sm text-dark-300">
                  {currentTicket ? `${getTicketDisplayName(currentTicket)} · ${getTicketCategoryName(currentTicket)}` : "Chronological conversation timeline with messages, events, and attachments."}
                </p>
              </div>

              {currentTicket && (
                <div className="flex flex-wrap gap-2">
                  {currentTicket.assignedSupportAgentId === supportAgentId ? (
                    <button type="button" onClick={handleUnassign} className="btn btn-secondary btn-sm">
                      Unassign
                    </button>
                  ) : (
                    <button type="button" onClick={handleAssignToMe} className="btn btn-primary btn-sm" disabled={!supportAgentId}>
                      Assign to me
                    </button>
                  )}
                  <select
                    value={currentTicket.status}
                    onChange={(event) => handleStatusChange(event.target.value)}
                    className="select !w-44"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentTicket.priority}
                    onChange={(event) => handlePriorityChange(event.target.value)}
                    className="select !w-36"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={currentTicket.supportCategoryId || ""}
                    onChange={(event) => handleCategoryChange(event.target.value)}
                    className="select !w-52"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nameAr || category.name || "Category"}
                      </option>
                    ))}
                  </select>
                  {["resolved", "closed"].includes(currentTicket.status) ? (
                    <button type="button" onClick={handleReopenTicket} className="btn btn-success btn-sm">
                      Reopen
                    </button>
                  ) : (
                    <button type="button" onClick={handleCloseTicket} className="btn btn-danger btn-sm">
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>

            {ticketLoading && (
              <div className="px-5 py-6 text-sm text-dark-400">Loading ticket conversation...</div>
            )}

            {!ticketLoading && !selectedTicket && (
              <div className="px-5 py-10 text-center text-dark-400">
                Select a ticket from the queue to open the conversation workspace.
              </div>
            )}

            {selectedTicket && !ticketLoading && (
              <div className="space-y-4 px-5 py-5">
                <div className="flex flex-wrap items-center gap-3 text-xs text-dark-400">
                  <span>Customer: {getTicketDisplayName(selectedTicket)}</span>
                  <span>•</span>
                  <span>Last activity: {formatRelative(getTicketActivityDate(selectedTicket))}</span>
                  <span>•</span>
                  <span>Messages: {selectedTicket.messageCount || (selectedTicket.messages || []).length || 0}</span>
                </div>

                <div className="space-y-3">
                  {timelineItems.length === 0 ? (
                    <div className="rounded-2xl border border-dark-700 bg-dark-800/80 p-8 text-center text-dark-400">
                      No conversation history yet.
                    </div>
                  ) : (
                    timelineItems.map((item) =>
                      item.kind === "message" ? (
                        <MessageCard
                          key={item.id}
                          message={item.data}
                          canReply={true}
                          onReply={(messageId) => setReplyToMessageId(messageId)}
                        />
                      ) : (
                        <TicketEventRow key={item.id} event={item.data} />
                      )
                    )
                  )}
                </div>

                <div className="rounded-2xl border border-dark-700 bg-dark-800/80 p-4">
                  {replyToMessageId && (
                    <div className="mb-4 rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-dark-500">Replying to...</p>
                          <p className="mt-1 text-sm text-dark-200">
                            {selectedTicket.messages?.find((message) => message.id === replyToMessageId)?.content || "Selected reply reference"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyToMessageId(null)}
                          className="rounded-lg border border-dark-700 px-2 py-1 text-xs text-dark-300"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <textarea
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="Write a reply..."
                      rows={5}
                      className="input min-h-[120px]"
                    />

                    <div
                      className="rounded-2xl border border-dashed border-dark-600 bg-dark-900/50 p-4"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        applyFileSelection(event.dataTransfer.files, setReplyFiles);
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">Attachments</p>
                          <p className="text-xs text-dark-400">Drag and drop, paste from clipboard, or choose files.</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-200 transition hover:border-primary-500 hover:text-white"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const clipboardItems = await navigator.clipboard.read();
                                const files: File[] = [];
                                for (const item of clipboardItems) {
                                  for (const type of item.types) {
                                    if (!type.startsWith("image/")) continue;
                                    const blob = await item.getType(type);
                                    files.push(new File([blob], `clipboard-${Date.now()}.png`, { type }));
                                  }
                                }
                                if (files.length > 0) {
                                  setReplyFiles((current) => [...current, ...files]);
                                }
                              } catch (error) {
                                void error;
                              }
                            }}
                            className="rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-200 transition hover:border-primary-500 hover:text-white"
                          >
                            Paste
                          </button>
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => applyFileSelection(event.target.files, setReplyFiles)}
                      />

                      {replyFiles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {replyFiles.map((file, index) => (
                            <span
                              key={`${file.name}-${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-dark-700 bg-dark-800 px-3 py-1 text-xs text-dark-200"
                            >
                              {file.name}
                              <button
                                type="button"
                                onClick={() => setReplyFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                                className="text-dark-400 hover:text-white"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-[0.2em] text-dark-400">Visibility</span>
                        <div className="flex overflow-hidden rounded-lg border border-dark-700">
                          <button
                            type="button"
                            onClick={() => setReplyVisibility("public")}
                            className={`px-3 py-2 text-xs font-medium ${replyVisibility === "public" ? "bg-primary-600 text-white" : "bg-dark-900 text-dark-300"}`}
                          >
                            Public
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyVisibility("internal")}
                            className={`px-3 py-2 text-xs font-medium ${replyVisibility === "internal" ? "bg-amber-600 text-white" : "bg-dark-900 text-dark-300"}`}
                          >
                            Internal
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleReplySubmit}
                        disabled={replySubmitting || !replyText.trim()}
                        className="btn btn-primary"
                      >
                        {replySubmitting ? "Sending..." : "Send Reply"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Context / AI rail */}
        <aside className="space-y-4">
          {sidePanelOpen && (
            <div className="card overflow-hidden">
              <div className="border-b border-dark-700 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-dark-400">Customer Context</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Profile & Links</h3>
              </div>
              <div className="space-y-4 p-4">
                {customerProfileLoading ? (
                  <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4 text-sm text-dark-400">Loading customer profile...</div>
                ) : customerProfileError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{customerProfileError}</div>
                ) : customerProfile?.user ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4">
                      <p className="text-sm font-semibold text-white">
                        {[customerProfile.user.firstName, customerProfile.user.lastName].filter(Boolean).join(" ") || "Customer"}
                      </p>
                      <p className="mt-1 text-xs text-dark-400">{customerProfile.user.email || "No email"}</p>
                      <p className="text-xs text-dark-400">{customerProfile.user.phone || "No phone"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Wallet</p>
                        <p className="mt-1 text-sm text-white">{Number(customerProfile.user.walletBalance || 0).toLocaleString("en-SA", { minimumFractionDigits: 2 })} SAR</p>
                      </div>
                      <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Loyalty</p>
                        <p className="mt-1 text-sm text-white">{Number(customerProfile.user.loyaltyPoints || 0).toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Language</p>
                        <p className="mt-1 text-sm text-white">{customerProfile.user.preferredLanguage || "en"}</p>
                      </div>
                      <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-dark-500">Joined</p>
                        <p className="mt-1 text-sm text-white">{formatExact(customerProfile.user.createdAt || null)}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-dark-500">Business Name</p>
                      <p className="mt-1 text-sm text-white">
                        {selectedTicket?.links?.find((link) => /tenant|business/i.test(link.entityType))?.entityId || "Unavailable"}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-dark-500">Subscription</p>
                      <p className="mt-1 text-sm text-white">
                        {customerProfile.stats?.subscription || "Unavailable"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-dark-500">Linked Entities</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(selectedTicket?.links || []).length > 0 ? (
                          selectedTicket?.links?.map((link) => (
                            <span key={link.id} className="rounded-full border border-dark-700 bg-dark-900/70 px-3 py-1 text-xs text-dark-200">
                              {humanizeValue(link.entityType)}: {link.entityId.slice(0, 8)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-dark-400">No linked entities</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-dark-500">Recent Activity</p>
                      <div className="mt-3 space-y-2">
                        {(customerProfile.bookings || []).slice(0, 3).map((booking, index) => (
                          <div key={`booking-${booking.id || index}`} className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                            <p className="text-sm text-white">{booking.Service?.name_en || booking.serviceName || "Booking"}</p>
                            <p className="mt-1 text-xs text-dark-400">{formatExact(booking.startTime || booking.createdAt || null)}</p>
                          </div>
                        ))}
                        {(customerProfile.transactions || []).slice(0, 3).map((transaction, index) => (
                          <div key={`transaction-${transaction.id || index}`} className="rounded-xl border border-dark-700 bg-dark-900/60 p-3">
                            <p className="text-sm text-white">{humanizeValue(transaction.type)}</p>
                            <p className="mt-1 text-xs text-dark-400">{formatExact(transaction.createdAt || null)}</p>
                          </div>
                        ))}
                        {(customerProfile.bookings || []).length === 0 && (customerProfile.transactions || []).length === 0 && (
                          <div className="text-sm text-dark-400">No recent activity available.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dark-700 bg-dark-800/70 p-4 text-sm text-dark-400">
                    Customer profile will appear when a ticket with a linked customer is selected.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setAiPanelOpen((current) => !current)}
              className="flex w-full items-center justify-between border-b border-dark-700 px-4 py-4 text-left"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-dark-400">AI Assistant</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Reserved Panel</h3>
              </div>
              <span className="text-dark-400">{aiPanelOpen ? "−" : "+"}</span>
            </button>
            {aiPanelOpen && (
              <div className="p-4">
                <div className="rounded-2xl border border-dashed border-dark-600 bg-dark-900/40 p-4 text-sm text-dark-300">
                  AI assistance is reserved for a future release. The support console is already structured to host it without changing the conversation workflow.
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      {newTicketOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-dark-700 bg-dark-900 shadow-2xl">
            <div className="flex items-start justify-between border-b border-dark-700 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-primary-300">New Support Ticket</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Open a new conversation</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewTicketOpen(false)}
                className="rounded-lg border border-dark-700 px-3 py-2 text-sm text-dark-200 transition hover:border-dark-500 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Category</span>
                  <select
                    value={newTicketForm.categoryId}
                    onChange={(event) => setNewTicketForm((current) => ({ ...current, categoryId: event.target.value }))}
                    className="select"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.nameAr || category.name || "Category"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Priority</span>
                  <select
                    value={newTicketForm.priority}
                    onChange={(event) => setNewTicketForm((current) => ({ ...current, priority: event.target.value }))}
                    className="select"
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Subject</span>
                <input
                  value={newTicketForm.subject}
                  onChange={(event) => setNewTicketForm((current) => ({ ...current, subject: event.target.value }))}
                  className="input"
                  placeholder="Ticket subject"
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-xs uppercase tracking-[0.18em] text-dark-400">Initial Message</span>
                <textarea
                  value={newTicketForm.initialMessage}
                  onChange={(event) => setNewTicketForm((current) => ({ ...current, initialMessage: event.target.value }))}
                  className="input min-h-[140px]"
                  placeholder="Describe the issue or request"
                />
              </label>

              <div
                className="rounded-2xl border border-dashed border-dark-600 bg-dark-800/60 p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  applyFileSelection(event.dataTransfer.files, setNewTicketFiles);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Attachments</p>
                    <p className="text-xs text-dark-400">Drop files here or upload from your device.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => newTicketFileInputRef.current?.click()}
                    className="rounded-lg border border-dark-700 px-3 py-2 text-xs text-dark-200 transition hover:border-primary-500 hover:text-white"
                  >
                    Upload Files
                  </button>
                </div>
                <input
                  ref={newTicketFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => applyFileSelection(event.target.files, setNewTicketFiles)}
                />
                {newTicketFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newTicketFiles.map((file, index) => (
                      <span
                        key={`${file.name}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full border border-dark-700 bg-dark-900 px-3 py-1 text-xs text-dark-200"
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() => setNewTicketFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                          className="text-dark-400 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-dark-700 px-6 py-4">
              <button
                type="button"
                onClick={() => setNewTicketOpen(false)}
                className="btn btn-secondary"
                disabled={newTicketSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNewTicketSubmit}
                className="btn btn-primary"
                disabled={newTicketSubmitting}
              >
                {newTicketSubmitting ? "Creating..." : "Create Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
