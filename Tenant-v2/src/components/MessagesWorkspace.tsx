import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { tenantApiAdapter } from '../lib/tenantApiAdapter';
import { 
  Inbox, Pin, Megaphone, Users, Archive, Search, SlidersHorizontal, 
  Plus, Send, ArrowLeft, ArrowRight, Star, Paperclip, Trash2, 
  ShieldAlert, CheckCircle2, User, MessageSquare, Tag, AlertCircle,
  Clock, Check, Filter, CheckCheck, Sparkles, Smile, X, FileText, 
  Image, RefreshCw, AlertTriangle, HelpCircle
} from 'lucide-react';

interface MessagesWorkspaceProps {
  lang: 'ar' | 'en';
  darkMode?: boolean;
}

interface Attachment {
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'doc';
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

interface Reply {
  id: string;
  senderNameAr: string;
  senderNameEn: string;
  senderRoleAr: string;
  senderRoleEn: string;
  senderAvatar: string;
  body: string;
  timestamp: string;
  reactions?: Reaction[];
}

interface MessageThread {
  id: string;
  senderNameAr: string;
  senderNameEn: string;
  senderRoleAr: string;
  senderRoleEn: string;
  senderAvatar: string;
  titleAr: string;
  titleEn: string;
  body: string;
  timestamp: string;
  isPinned: boolean;
  isArchived: boolean;
  category: 'broadcast' | 'dm' | 'inbox'; // Message categories
  unread: boolean; // Read/Unread state of the thread
  unreadCount: number; // Number of unread replies/items in this thread
  recipientType: 'all_staff' | 'employee' | 'unknown'; // Recipient classification
  recipientNameAr?: string;
  recipientNameEn?: string;
  replies: Reply[];
  attachments?: Attachment[];
  reactions?: Reaction[];
  recipientStatuses?: {
    employeeId: string;
    nameAr: string;
    nameEn: string;
    roleAr: string;
    roleEn: string;
    avatar: string;
    status: 'read' | 'unread';
    readTime?: string;
    deliveredTime?: string;
  }[];
}

export default function MessagesWorkspace({ lang, darkMode = false }: MessagesWorkspaceProps) {
  const isRtl = lang === 'ar';

  const panelTexts = {
    ar: {
      panelTitle: 'تفاصيل المراسلة والتحقق',
      overview: 'نظرة عامة على المراسلة',
      delivery: 'حالة وسجل التسليم',
      recipients: 'قائمة المستلمين والتفاعل',
      actions: 'العمليات والإجراءات',
      resendBtn: 'إعادة إرسال وتحديث',
      resendingBtn: 'جاري الإرسال...',
      deleteBtn: 'حذف المراسلة نهائياً',
      pinBtn: 'تثبيت في الصندوق',
      unpinBtn: 'إلغاء التثبيت',
      pinned: 'مثبتة',
      unpinned: 'غير مثبتة',
      fullSubject: 'الموضوع الكامل',
      fullBody: 'نص المراسلة بالتفصيل',
      createdDate: 'تاريخ الإنشاء والتبليغ',
      senderInfo: 'مُرسل المراسلة',
      recipientType: 'الجهة المستهدفة',
      pinStatus: 'حالة التثبيت',
      sentStatus: 'حالة الإرسال',
      sentSuccess: 'تم التسليم والتبليغ',
      readCount: 'عدد المقروءة',
      unreadCount: 'عدد غير المقروءة',
      readBadge: 'مقروء',
      unreadBadge: 'غير مقروء',
      deliveredBadge: 'تم تسليمها للمستلم',
      notDeliveredBadge: 'جاري التوصيل...',
      unknownRecipient: 'جهة غير مسجلة',
      replies: 'تعليقات ومتابعات الطاقم'
    },
    en: {
      panelTitle: 'Message Ledger Details',
      overview: 'Message Overview',
      delivery: 'Delivery Tracking Metrics',
      recipients: 'Recipient Interaction List',
      actions: 'Operational Actions',
      resendBtn: 'Resend Message',
      resendingBtn: 'Resending...',
      deleteBtn: 'Delete Message',
      pinBtn: 'Pin Message',
      unpinBtn: 'Unpin Message',
      pinned: 'Pinned',
      unpinned: 'Not Pinned',
      fullSubject: 'Full Subject',
      fullBody: 'Full Message Body',
      createdDate: 'Created Date',
      senderInfo: 'Dispatched By',
      recipientType: 'Target Recipient',
      pinStatus: 'Pin Status',
      sentStatus: 'Sent Status',
      sentSuccess: 'Delivered & Dispatched',
      readCount: 'Read count',
      unreadCount: 'Unread count',
      readBadge: 'Read',
      unreadBadge: 'Unread',
      deliveredBadge: 'Delivered',
      notDeliveredBadge: 'Pending',
      unknownRecipient: 'Unknown Party',
      replies: 'Staff Replies & Comments'
    }
  };

  const pt = panelTexts[lang === 'ar' ? 'ar' : 'en'];

  // State for loading, error and data
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<MessageThread[]>([]);

  // Load initial workspace data from API endpoints
  useEffect(() => {
    let active = true;
    const fetchWorkspaceData = async () => {
      setIsLoading(true);
      setIsError(false);
      try {
        const [messagesData, employeesData] = await Promise.all([
          tenantApiAdapter.getMessages(),
          tenantApiAdapter.getEmployees()
        ]);
        if (active) {
          const loadedMessages = messagesData?.data || [];
          setMessages(loadedMessages);
          setStaffMembers(employeesData?.employees || []);
          if (loadedMessages.length > 0) {
            setSelectedMessageId(loadedMessages[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching messages workspace data:', err);
        if (active) {
          setIsError(true);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    fetchWorkspaceData();
    return () => {
      active = false;
    };
  }, []);

  // UI Navigation / Filter States
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'pinned' | 'broadcast' | 'dm' | 'archived'>('inbox');
  
  // Specific filters requested: All, Broadcasts, Direct Messages, Pinned
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'broadcast' | 'dm' | 'pinned'>('all');
  
  const [selectedMessageId, setSelectedMessageId] = useState<string>('msg-1');
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterUnread, setFilterUnread] = useState<boolean>(false);
  
  // Custom compose message states
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeRecipientType, setComposeRecipientType] = useState<'all' | 'single'>('all');
  const [composeEmployeeId, setComposeEmployeeId] = useState<string>('st-1');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composePinned, setComposePinned] = useState<boolean>(false);
  
  // Reply composition
  const [replyText, setReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);

  // Responsive mobile active view: 'folders' | 'list' | 'detail'
  const [mobileActivePanel, setMobileActivePanel] = useState<'folders' | 'list' | 'detail'>('folders');

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // PREMIUM UX STATES
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [composeEmployeeQuery, setComposeEmployeeQuery] = useState<string>('');
  const [mentionDropdownOpen, setMentionDropdownOpen] = useState<boolean>(false);
  const [mentionDropdownSearch, setMentionDropdownSearch] = useState<string>('');
  const [mentionTargetInput, setMentionTargetInput] = useState<'compose' | 'reply' | null>(null);
  const [composeAttachments, setComposeAttachments] = useState<Attachment[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [visibleCount, setVisibleCount] = useState<number>(5);
  const [isExpandingList, setIsExpandingList] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Multi-lingual dictionary
  const dict = {
    ar: {
      title: 'مركز المراسلات الداخلية للطاقم',
      subtitle: 'تواصل وتنسيق تشغيلي آمن وخاص بأعضاء صالون رفاه الفخم',
      search: 'البحث في المراسلات...',
      composeBtn: 'إنشاء رسالة',
      all: 'الكل',
      folders: {
        inbox: 'الوارد العام',
        pinned: 'المثبتة والمفضلة',
        broadcast: 'البث والتعاميم الجماعية',
        dm: 'المراسلات الثنائية',
        archived: 'الأرشيف والمحفوظات'
      },
      filters: {
        all: 'جميع الرسائل',
        broadcasts: 'التعاميم والبث',
        dms: 'الرسائل الثنائية',
        pinned: 'المثبتة فقط'
      },
      recipients: {
        all_staff: 'جميع الموظفين',
        employee: 'موظف خاص',
        unknown: 'جهة غير معروفة'
      },
      states: {
        loading: 'جاري تحميل صندوق المراسلات...',
        errorTitle: 'فشل مزامنة المراسلات الداخلية',
        errorDesc: 'تعذر الاتصال بقاعدة بيانات الاتصال الداخلي لرفاه. يرجى التحقق من الشبكة وإعادة المحاولة.',
        retryBtn: 'إعادة المحاولة',
        emptyTitle: 'لا توجد رسائل متطابقة',
        emptyDesc: 'لم يتم العثور على أي مراسلات تناسب معايير البحث أو الفلتر أو المجلد المحدد حالياً.',
        unreadBadge: 'غير مقروء',
        readBadge: 'مقروء',
        replies: 'الردود والمتابعات',
        to: 'إلى:',
        from: 'من:'
      },
      toast: {
        deleted: '✨ تم حذف وتصفية الرسالة بنجاح من الصندوق!',
        sent: '✨ تم بث المراسلة بنجاح في منصة رفاه الداخلية!',
        replied: '✨ تم إرسال ردك الفوري وتثبيته في سجل المتابعة!'
      },
      composeModal: {
        title: 'إنشاء تعميم أو رسالة داخلية جديدة',
        desc: 'أرسل تعميماً تشغيلياً أو تنبيهاً فورياً لأعضاء طاقم العمل بخصوص مهام صالون رفاه.',
        to: 'المستلم / الفئة المستهدفة',
        allStaff: 'جميع طاقم العمل (بث عام)',
        subjectAr: 'الموضوع بالعربية',
        subjectEn: 'الموضوع بالإنجليزية',
        body: 'نص ومحتوى المراسلة بالتفصيل',
        category: 'نوع المراسلة',
        recipientClass: 'تصنيف المستلم',
        send: 'بث المراسلة الآن',
        cancel: 'إلغاء'
      },
      simulations: {
        title: 'أدوات المحاكاة للمطور',
        loadingToggle: 'حالة التحميل',
        errorToggle: 'حالة الخطأ',
        resetData: 'إعادة تعيين البيانات'
      },
      noSelectedTitle: 'اختر رسالة لعرض تفاصيلها المتقدمة',
      noSelectedDesc: 'انقر على أي رسالة من قائمة المراسلات لقراءة المحتوى الكامل، مراجعة المرفقات، وكتابة الردود والتعليقات المتبادلة.',
      backToFolders: 'المجلدات',
      backToList: 'الرسائل',
      deleteConfirm: 'هل أنت متأكد من حذف هذه المراسلة نهائياً؟',
      repliesTitle: 'مشاركات ومتابعات الفريق'
    },
    en: {
      title: 'Internal Staff Messages',
      subtitle: 'Secure enterprise workspace & collaboration for REFAH Elite team',
      search: 'Search messages...',
      composeBtn: 'Compose Message',
      all: 'All',
      folders: {
        inbox: 'Inbox Log',
        pinned: 'Pinned & Starred',
        broadcast: 'Broadcasts & Circulars',
        dm: 'Direct Conversations',
        archived: 'Archived Storage'
      },
      filters: {
        all: 'All Messages',
        broadcasts: 'Broadcasts',
        dms: 'Direct Messages',
        pinned: 'Pinned'
      },
      recipients: {
        all_staff: 'All Staff',
        employee: 'Employee',
        unknown: 'Unknown'
      },
      states: {
        loading: 'Loading internal staff messages feed...',
        errorTitle: 'System Feed Sync Failed',
        errorDesc: 'Unable to sync with the REFAH internal communications database. Please verify and reload.',
        retryBtn: 'Retry Connection',
        emptyTitle: 'No messages found',
        emptyDesc: 'There are no active threads in this folder matching your current filter options.',
        unreadBadge: 'Unread',
        readBadge: 'Read',
        replies: 'Replies & Activity',
        to: 'To:',
        from: 'From:'
      },
      toast: {
        deleted: '✨ Message thread deleted successfully from inbox!',
        sent: '✨ Message successfully broadcasted to the staff directory!',
        replied: '✨ Reply successfully dispatched to the team!'
      },
      composeModal: {
        title: 'Compose New Internal Message',
        desc: 'Send an enterprise notification, circular, or private note to members of your salon team.',
        to: 'Recipient / Targeted Group',
        allStaff: 'All Registered Staff (General Broadcast)',
        subjectAr: 'Subject (Arabic)',
        subjectEn: 'Subject (English)',
        body: 'Detailed Message Content',
        category: 'Message Type',
        recipientClass: 'Recipient Classification',
        send: 'Dispatch Message Now',
        cancel: 'Cancel'
      },
      simulations: {
        title: 'Dev Simulations Tool',
        loadingToggle: 'Simulate Loading',
        errorToggle: 'Simulate Error',
        resetData: 'Reset Mock Data'
      },
      noSelectedTitle: 'Select a message to display ledger',
      noSelectedDesc: 'Click on any item in the feed list to view its complete logs, recipient classifications, and collaborative team replies.',
      backToFolders: 'Folders',
      backToList: 'Messages',
      deleteConfirm: 'Are you sure you want to permanently delete this thread?',
      repliesTitle: 'Team Replies & Follow-ups'
    }
  };

  const t = dict[lang];

  // Filtering Logic based on activeFolder, activeFilterTab, Search Query, and Unread options
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // 1. Folder Check
      if (activeFolder === 'pinned' && !msg.isPinned) return false;
      if (activeFolder === 'archived' && !msg.isArchived) return false;
      if (activeFolder !== 'pinned' && activeFolder !== 'archived') {
        if (msg.isArchived) return false;
        
        // If a folder like "broadcast" or "dm" is active, narrow down to that category
        if (activeFolder === 'broadcast' && msg.category !== 'broadcast') return false;
        if (activeFolder === 'dm' && msg.category !== 'dm') return false;
      }

      // 2. Specific requested filters tab (All, Broadcasts, Direct Messages, Pinned)
      if (activeFilterTab === 'broadcast' && msg.category !== 'broadcast') return false;
      if (activeFilterTab === 'dm' && msg.category !== 'dm') return false;
      if (activeFilterTab === 'pinned' && !msg.isPinned) return false;

      // 3. Unread option toggle
      if (filterUnread && !msg.unread) return false;

      // 4. Search Query Match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesAr = (msg.senderNameAr + msg.titleAr + msg.body + (msg.recipientNameAr || '')).toLowerCase().includes(query);
        const matchesEn = (msg.senderNameEn + msg.titleEn + msg.body + (msg.recipientNameEn || '')).toLowerCase().includes(query);
        return matchesAr || matchesEn;
      }

      return true;
    });
  }, [messages, activeFolder, activeFilterTab, filterUnread, searchQuery]);

  // Selected Message Thread object
  const selectedMessage = useMemo(() => {
    return messages.find(m => m.id === selectedMessageId);
  }, [messages, selectedMessageId]);

  // Handle selection and mark as read
  const selectMessage = (id: string) => {
    setSelectedMessageId(id);
    setMessages(prev => prev.map(msg => {
      if (msg.id === id && msg.unread) {
        return { ...msg, unread: false, unreadCount: 0 };
      }
      return msg;
    }));
    setMobileActivePanel('detail');
    setIsDetailsOpen(true);
  };

  // Toggle pin
  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages(prev => prev.map(msg => {
      if (msg.id === id) {
        const nextPinned = !msg.isPinned;
        return { ...msg, isPinned: nextPinned };
      }
      return msg;
    }));
  };

  // Close details panel helper
  const closeDetails = () => {
    setIsDetailsOpen(false);
    setMobileActivePanel('list');
  };

  // Delete message card with dynamic state update
  const handleDeleteMessage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const previousMessages = messages;

    // Optimistically update local state
    setMessages(prev => prev.filter(m => m.id !== id));
    showToast(t.toast.deleted);

    // If deleted message was active, close the details panel
    if (selectedMessageId === id) {
      setIsDetailsOpen(false);
      const remaining = messages.filter(m => m.id !== id);
      if (remaining.length > 0) {
        setSelectedMessageId(remaining[0].id);
      } else {
        setSelectedMessageId('');
      }
    }

    try {
      await tenantApiAdapter.deleteMessage(id);
    } catch (err) {
      console.error('Error deleting message:', err);
      showToast(isRtl ? '⚠️ فشل حذف الرسالة من الخادم. تم التراجع.' : '⚠️ Failed to delete message from server. Rolled back.');
      setMessages(previousMessages);
      setSelectedMessageId(id);
      setIsDetailsOpen(true);
    }
  };

  // Reset/sync to original data via backend re-fetch
  const handleResetData = async () => {
    setIsLoading(true);
    setIsDetailsOpen(false);
    setIsError(false);
    try {
      const [messagesData, employeesData] = await Promise.all([
        tenantApiAdapter.getMessages(),
        tenantApiAdapter.getEmployees()
      ]);
      const loadedMessages = messagesData?.data || [];
      setMessages(loadedMessages);
      setStaffMembers(employeesData?.employees || []);
      if (loadedMessages.length > 0) {
        setSelectedMessageId(loadedMessages[0].id);
      } else {
        setSelectedMessageId('');
      }
      setActiveFilterTab('all');
      setActiveFolder('inbox');
      showToast(isRtl ? '✨ تم تحديث ومزامنة البيانات بنجاح!' : '✨ Data successfully synchronized and updated!');
    } catch (err) {
      console.error('Error resetting data:', err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Compose Submit Handler with Optimistic Update
  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeBody.trim()) return;

    const targetStaff = staffMembers.find(sm => sm.id === composeEmployeeId);
    
    let resolvedRecipientType: 'all_staff' | 'employee' | 'unknown' = 'all_staff';
    let resolvedRecipientNameAr = '';
    let resolvedRecipientNameEn = '';

    if (composeRecipientType === 'all') {
      resolvedRecipientType = 'all_staff';
    } else if (composeRecipientType === 'single' && targetStaff) {
      resolvedRecipientType = 'employee';
      resolvedRecipientNameAr = targetStaff.nameAr;
      resolvedRecipientNameEn = targetStaff.nameEn;
    }

    const subjectText = composeSubject.trim() || (isRtl ? 'رسالة جديدة' : 'New Message');

    const resolvedStatuses: any[] = [];
    if (resolvedRecipientType === 'all_staff') {
      staffMembers.forEach(sm => {
        if (sm.id !== 'st-1') { // Ahmad Al-Harthi is sender
          resolvedStatuses.push({
            employeeId: sm.id,
            nameAr: sm.nameAr,
            nameEn: sm.nameEn,
            roleAr: sm.roleAr,
            roleEn: sm.roleEn,
            avatar: sm.avatar,
            status: 'unread',
            deliveredTime: isRtl ? 'الآن' : 'Just now'
          });
        }
      });
    } else if (resolvedRecipientType === 'employee' && targetStaff) {
      resolvedStatuses.push({
        employeeId: targetStaff.id,
        nameAr: targetStaff.nameAr,
        nameEn: targetStaff.nameEn,
        roleAr: targetStaff.roleAr,
        roleEn: targetStaff.roleEn,
        avatar: targetStaff.avatar,
        status: 'unread',
        deliveredTime: isRtl ? 'الآن' : 'Just now'
      });
    }

    const newMsg: MessageThread = {
      id: `msg-${Date.now()}`,
      senderNameAr: isRtl ? 'أحمد الحارثي' : 'Ahmad Al-Harthi',
      senderNameEn: 'Ahmad Al-Harthi',
      senderRoleAr: isRtl ? 'مدير عام الفرع' : 'General Manager',
      senderRoleEn: 'General Manager',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      titleAr: subjectText,
      titleEn: subjectText,
      body: composeBody,
      timestamp: isRtl ? 'الآن' : 'Just now',
      isPinned: composePinned,
      isArchived: false,
      category: composeRecipientType === 'all' ? 'broadcast' : 'dm',
      unread: false, // Sent is automatically read
      unreadCount: 0,
      recipientType: resolvedRecipientType,
      recipientNameAr: resolvedRecipientNameAr,
      recipientNameEn: resolvedRecipientNameEn,
      replies: [],
      recipientStatuses: resolvedStatuses
    };

    const previousMessages = messages;

    // Optimistically update
    setMessages(prev => [newMsg, ...prev]);
    setSelectedMessageId(newMsg.id);
    setIsDetailsOpen(true);
    setIsComposeOpen(false);
    
    // Clear forms
    setComposeRecipientType('all');
    setComposeEmployeeId('st-1');
    setComposeSubject('');
    setComposeBody('');
    setComposePinned(false);

    showToast(t.toast.sent);
    setActiveFolder('inbox');
    setActiveFilterTab('all');
    setMobileActivePanel('detail');

    try {
      await tenantApiAdapter.createMessage(newMsg);

      // Re-fetch list to ensure sync
      const messagesData = await tenantApiAdapter.getMessages();
      setMessages(messagesData?.data || []);
    } catch (err) {
      console.error('Error posting message:', err);
      showToast(isRtl ? '⚠️ فشل إرسال الرسالة إلى الخادم. تم التراجع.' : '⚠️ Failed to send message to server. Rolled back.');
      setMessages(previousMessages);
      setIsDetailsOpen(false);
    }
  };

  // Submit reply message with optimistic delay
  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedMessageId) return;

    setIsSendingReply(true);

    const newReply: Reply = {
      id: `rep-${Date.now()}`,
      senderNameAr: isRtl ? 'أحمد الحارثي' : 'Ahmad Al-Harthi',
      senderNameEn: 'Ahmad Al-Harthi',
      senderRoleAr: isRtl ? 'مدير عام الفرع' : 'General Manager',
      senderRoleEn: 'General Manager',
      senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      body: replyText,
      timestamp: isRtl ? 'الآن' : 'Just now'
    };

    setTimeout(() => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === selectedMessageId) {
          return {
            ...msg,
            replies: [...msg.replies, newReply]
          };
        }
        return msg;
      }));
      setReplyText('');
      setIsSendingReply(false);
      showToast(t.toast.replied);
    }, 400);
  };

  // Simulate resending/re-dispatching the message to all recipients
  const handleResendMessage = (id: string) => {
    setIsResending(true);
    setTimeout(() => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === id) {
          // Reset status values to 'unread' to simulate dispatching again
          const updatedStatuses = msg.recipientStatuses ? msg.recipientStatuses.map(status => ({
            ...status,
            status: 'unread' as const,
            readTime: undefined
          })) : [];
          return {
            ...msg,
            timestamp: isRtl ? 'الآن' : 'Just now',
            recipientStatuses: updatedStatuses
          };
        }
        return msg;
      }));
      setIsResending(false);
      showToast(isRtl ? '✨ تم إعادة إرسال وتحديث المراسلة لجميع المستلمين بنجاح!' : '✨ Message successfully re-dispatched and synchronized!');
    }, 1200);
  };

  return (
    <div className={`space-y-6 ${darkMode ? 'text-zinc-100' : 'text-neutral-800'}`}>
      
      {/* 1. TOAST NOTIFICATION POPUP */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white dark:bg-white dark:text-zinc-950 px-5 py-3 rounded-2xl shadow-xl border border-neutral-800 dark:border-neutral-200 text-xs font-black flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. TOP HEADER PANEL */}
      <div className={`p-4 md:p-6 rounded-2xl border flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
        darkMode ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
      }`}>
        <div className="text-start space-y-1">
          <h2 className="text-lg md:text-xl font-black tracking-tight flex items-center gap-2">
            <MessageSquare className="text-brand-500" size={22} />
            <span>{t.title}</span>
          </h2>
          <p className="text-xs text-neutral-400">
            {t.subtitle}
          </p>
        </div>

        {/* Search, Filters and Compose Button Wrapper */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Simulation Tools Panel directly in header for auditor ease */}
          <div className="flex items-center gap-1.5 p-1 px-2.5 rounded-xl bg-zinc-500/5 dark:bg-zinc-500/10 border border-neutral-200 dark:border-zinc-800 text-[11px] font-bold">
            <span className="text-neutral-400">{t.simulations.title}:</span>
            <button 
              onClick={() => { setIsLoading(!isLoading); setIsError(false); }}
              className={`px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors ${isLoading ? 'bg-brand-500 text-zinc-950' : 'bg-zinc-500/10 hover:bg-zinc-500/20'}`}
            >
              {t.simulations.loadingToggle}
            </button>
            <button 
              onClick={() => { setIsError(!isError); setIsLoading(false); }}
              className={`px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors ${isError ? 'bg-rose-500 text-white' : 'bg-zinc-500/10 hover:bg-zinc-500/20'}`}
            >
              {t.simulations.errorToggle}
            </button>
            <button 
              onClick={handleResetData}
              className="p-1 text-neutral-400 hover:text-white hover:bg-zinc-500/20 rounded-md transition-colors"
              title={t.simulations.resetData}
            >
              <RefreshCw size={11} />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute top-1/2 -translate-y-1/2 text-zinc-400 left-3" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className={`w-full py-2 pl-9 pr-4 rounded-xl border text-xs focus:ring-1 focus:ring-brand-500 outline-hidden font-medium ${
                darkMode ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500' : 'bg-neutral-50 border-neutral-200 placeholder-neutral-400'
              }`}
            />
          </div>

          {/* Unread Only filter */}
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`p-2 py-2 px-3 rounded-xl border text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 ${
              filterUnread
                ? 'bg-brand-500/15 border-brand-500/30 text-brand-400 font-extrabold'
                : darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
            }`}
          >
            <Filter size={12} />
            <span>{filterUnread ? (isRtl ? 'غير المقروء' : 'Unread Only') : t.all}</span>
          </button>

          {/* Compose button */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="p-2 py-2 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-zinc-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 hover:shadow-lg shadow-brand-500/10"
          >
            <Plus size={15} />
            <span>{t.composeBtn}</span>
          </button>
        </div>
      </div>

      {/* 3. THREE-COLUMN MESSAGING GATEWAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[600px]">
        
        {/* ========================================================= */}
        {/* COLUMN A: LEFT SIDEBAR (MESSAGES NAVIGATION) */}
        {/* ========================================================= */}
        <div className={`lg:col-span-3 rounded-2xl border flex flex-col justify-between overflow-hidden ${
          darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
        } ${
          mobileActivePanel !== 'folders' ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-3 space-y-2">
            <div className="px-3 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-start border-b border-neutral-100 dark:border-zinc-800/50">
              {lang === 'ar' ? 'مجلدات صندوق البريد' : 'STAFF MAILBOX SHELF'}
            </div>

            <nav className="space-y-1">
              {[
                { id: 'inbox', label: t.folders.inbox, icon: Inbox, count: messages.filter(m => m.unread && !m.isArchived).length, color: 'text-brand-500 bg-brand-500/5' },
                { id: 'pinned', label: t.folders.pinned, icon: Pin, count: messages.filter(m => m.isPinned && !m.isArchived).length, color: 'text-amber-500 bg-amber-500/5' },
                { id: 'broadcast', label: t.folders.broadcast, icon: Megaphone, count: messages.filter(m => m.category === 'broadcast' && !m.isArchived).length, color: 'text-emerald-500 bg-emerald-500/5' },
                { id: 'dm', label: t.folders.dm, icon: Users, count: messages.filter(m => m.category === 'dm' && !m.isArchived).length, color: 'text-indigo-500 bg-indigo-500/5' },
                { id: 'archived', label: t.folders.archived, icon: Archive, count: messages.filter(m => m.isArchived).length, color: 'text-zinc-500 bg-zinc-500/5' }
              ].map((folder) => {
                const isFolderActive = activeFolder === folder.id;
                const IconComponent = folder.icon;

                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id as any);
                      setMobileActivePanel('list');
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold transition-all text-start group cursor-pointer ${
                      isFolderActive
                        ? 'bg-zinc-950 dark:bg-zinc-900 text-white font-extrabold ring-1 ring-zinc-800 dark:ring-zinc-700/80 shadow-xs'
                        : darkMode ? 'text-zinc-400 hover:text-white hover:bg-zinc-950/25' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`p-1.5 rounded-lg shrink-0 ${isFolderActive ? folder.color : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                        <IconComponent size={14} />
                      </span>
                      <span>{folder.label}</span>
                    </div>

                    {folder.count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                        isFolderActive ? 'bg-brand-500 text-zinc-950' : 'bg-zinc-150 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}>
                        {folder.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Staff Roster widget */}
          <div className="p-4 border-t border-zinc-800/10 dark:border-zinc-800/40 bg-zinc-950/10 dark:bg-zinc-950/30 text-start space-y-3.5">
            <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{lang === 'ar' ? 'طاقم العمل المسجل' : 'STAFF DIRECTORY'}</h4>
            <div className="space-y-2">
              {staffMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-2">
                  <div className="relative">
                    <img src={member.avatar} alt={member.nameEn} className="w-6.5 h-6.5 rounded-full object-cover border border-zinc-800/50" />
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-950" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold truncate text-neutral-700 dark:text-zinc-300">{isRtl ? member.nameAr : member.nameEn}</p>
                    <p className="text-[8px] text-neutral-400 truncate leading-none">{isRtl ? member.roleAr : member.roleEn}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN B: CENTER MESSAGE LIST (CONVERSATIONS FEED WITH FILTERS) */}
        {/* ========================================================= */}
        <div className={`lg:col-span-9 rounded-2xl border flex flex-col overflow-hidden ${
          darkMode ? 'bg-zinc-900/50 border-zinc-800' : 'bg-white border-neutral-150 shadow-xs'
        } ${
          mobileActivePanel === 'folders' ? 'hidden lg:flex' : mobileActivePanel === 'detail' ? 'hidden lg:flex' : 'flex'
        }`}>
          
          {/* Header area with navigation back to folder on Mobile */}
          <div className="p-3 border-b border-zinc-800/10 dark:border-zinc-800/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileActivePanel('folders')}
                className="lg:hidden p-1.5 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 cursor-pointer"
              >
                {isRtl ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
              </button>
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-700 dark:text-zinc-200">
                {t.folders[activeFolder]}
              </h3>
            </div>
            
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-850 dark:bg-zinc-800 text-brand-400 font-mono">
              {filteredMessages.length} {isRtl ? 'رسائل' : 'threads'}
            </span>
          </div>

          {/* REQUESTED TOP FILTERS TABS BAR */}
          <div className="px-3 py-2 bg-neutral-50/50 dark:bg-zinc-950/20 border-b border-zinc-800/10 dark:border-zinc-800/30 flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'all', label: t.filters.all },
              { id: 'broadcast', label: t.filters.broadcasts },
              { id: 'dm', label: t.filters.dms },
              { id: 'pinned', label: t.filters.pinned }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-tight whitespace-nowrap transition-all cursor-pointer ${
                  activeFilterTab === tab.id
                    ? 'bg-brand-500 text-zinc-950 shadow-sm font-extrabold scale-102'
                    : darkMode ? 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-250'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Core messages feed loader / states */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/10 dark:divide-zinc-800/30">
            
            {/* A. LOADING STATE SKELETON */}
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/10 animate-pulse space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800" />
                        <div className="space-y-1.5">
                          <div className="w-20 h-2 bg-zinc-800 rounded" />
                          <div className="w-12 h-1.5 bg-zinc-800 rounded" />
                        </div>
                      </div>
                      <div className="w-10 h-2 bg-zinc-800 rounded" />
                    </div>
                    <div className="w-full h-3 bg-zinc-800 rounded" />
                    <div className="w-3/4 h-2 bg-zinc-800 rounded" />
                    <div className="flex gap-2 pt-1">
                      <div className="w-16 h-4 bg-zinc-800 rounded-full" />
                      <div className="w-20 h-4 bg-zinc-800 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              
              /* B. ERROR STATE VIEW */
              <div className="p-8 text-center space-y-4 my-auto">
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full w-fit mx-auto border border-rose-500/20">
                  <AlertTriangle size={32} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-rose-500">{t.states.errorTitle}</h4>
                  <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
                    {t.states.errorDesc}
                  </p>
                </div>
                <button
                  onClick={() => setIsError(false)}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  {t.states.retryBtn}
                </button>
              </div>

            ) : filteredMessages.length > 0 ? (
              
              /* C. REGULAR RENDER LIST WITH REQUESTED CARDS LOGIC */
              filteredMessages.map((msg) => {
                const isSelected = msg.id === selectedMessageId;
                const displayTitle = isRtl ? msg.titleAr : msg.titleEn;
                const displaySender = isRtl ? msg.senderNameAr : msg.senderNameEn;
                const displayRole = isRtl ? msg.senderRoleAr : msg.senderRoleEn;

                return (
                  <div
                    key={msg.id}
                    onClick={() => selectMessage(msg.id)}
                    className={`p-4 text-start cursor-pointer transition-all relative group border-s-3 ${
                      isSelected
                        ? darkMode ? 'bg-zinc-950/80 border-brand-500' : 'bg-neutral-50/90 border-brand-500 shadow-inner'
                        : msg.unread
                        ? 'bg-brand-500/[0.02] border-s-transparent hover:bg-neutral-50/50 dark:hover:bg-zinc-900/30'
                        : 'border-s-transparent hover:bg-neutral-50/50 dark:hover:bg-zinc-900/30'
                    }`}
                  >
                    
                    {/* Read / Unread color dot indicator */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${msg.unread ? 'bg-brand-500 animate-pulse' : 'bg-neutral-300 dark:bg-zinc-700'}`} />
                      
                      {/* Direct delete action on message card */}
                      <button
                        onClick={(e) => {
                          if (confirm(t.deleteConfirm)) {
                            handleDeleteMessage(msg.id, e);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 bg-rose-500/10 text-rose-500 rounded-md hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                        title={lang === 'ar' ? 'حذف هذه المراسلة' : 'Delete this message'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Avatar of the sender */}
                      <img src={msg.senderAvatar} alt={displaySender} className="w-9 h-9 rounded-full object-cover border border-zinc-800/40 shrink-0" />
                      
                      <div className="flex-1 min-w-0 space-y-1.5">
                        
                        {/* Sender info line */}
                        <div className="flex items-center justify-between pr-4">
                          <div className="min-w-0">
                            <span className={`text-[11px] font-extrabold truncate block ${msg.unread ? 'text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-300'}`}>
                              {displaySender}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-medium">
                              {displayRole}
                            </span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-medium font-mono">
                            {msg.timestamp}
                          </span>
                        </div>

                        {/* Card Subject (Bold & highly legible) */}
                        <h4 className={`text-xs truncate ${msg.unread ? 'font-black text-brand-500' : 'font-bold text-zinc-800 dark:text-zinc-200'}`}>
                          {displayTitle}
                        </h4>

                        {/* Message Preview (truncated body text) */}
                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {msg.body}
                        </p>

                        {/* Bottom Row containing metadata and badges */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          
                          {/* Recipient Classification Badge */}
                          {msg.recipientType === 'all_staff' && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-teal-500/10 text-teal-500 px-2 py-0.5 rounded-md border border-teal-500/20">
                              <Users size={9} />
                              <span>{t.recipients.all_staff}</span>
                            </span>
                          )}

                          {msg.recipientType === 'employee' && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-500/20">
                              <User size={9} />
                              <span className="truncate max-w-[80px]">
                                {isRtl ? (msg.recipientNameAr || 'موظف') : (msg.recipientNameEn || 'Employee')}
                              </span>
                            </span>
                          )}

                          {msg.recipientType === 'unknown' && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <HelpCircle size={9} />
                              <span>{t.recipients.unknown}</span>
                            </span>
                          )}

                          {/* Read/Unread text badge */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            msg.unread 
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/20' 
                              : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                          }`}>
                            {msg.unread ? t.states.unreadBadge : t.states.readBadge}
                          </span>

                          {/* Unread count if present */}
                          {msg.unreadCount > 0 && (
                            <span className="bg-red-500 text-white font-mono font-bold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">
                              {msg.unreadCount}
                            </span>
                          )}

                          {/* Star/Pinned Indicator */}
                          {msg.isPinned && (
                            <span className="text-[8px] bg-amber-500/15 text-amber-500 px-1.5 py-0.5 rounded-md border border-amber-500/20 font-black flex items-center gap-0.5 shrink-0">
                              <Star size={8} fill="currentColor" />
                              <span>PINNED</span>
                            </span>
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                );
              })
            ) : (
              
              /* D. EMPTY STATE VIEW */
              <div className="p-12 text-center space-y-4 my-auto">
                <div className="p-4 bg-zinc-500/5 dark:bg-zinc-950/40 rounded-full w-fit mx-auto border border-neutral-200 dark:border-zinc-800">
                  <Inbox className="text-zinc-500" size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black">{t.states.emptyTitle}</h4>
                  <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">{t.states.emptyDesc}</p>
                </div>
                <button
                  onClick={() => { setSearchQuery(''); setActiveFilterTab('all'); setFilterUnread(false); }}
                  className="px-3 py-1.5 bg-brand-500 text-zinc-950 text-[10px] font-black rounded-lg hover:scale-102 transition-all cursor-pointer"
                >
                  {isRtl ? 'إعادة تعيين الفلاتر والبحث' : 'Reset Filters & Search'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* MESSAGES DETAILS SIDE-OVER PANEL / FULLSCREEN MOBILE */}
        {/* ========================================================= */}
        <AnimatePresence>
          {isDetailsOpen && selectedMessage && (
            <>
              {/* Overlay Backdrop - visible on desktop, hides background slightly */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeDetails}
                className="fixed inset-0 bg-zinc-950/40 dark:bg-zinc-950/60 backdrop-blur-xs z-45 md:block hidden"
              />

              {/* Side Sheet Panel Container */}
              <motion.div
                initial={{ x: isRtl ? '-100%' : '100%' }}
                animate={{ x: 0 }}
                exit={{ x: isRtl ? '-100%' : '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`fixed inset-y-0 ${isRtl ? 'left-0' : 'right-0'} z-50 w-full md:max-w-md bg-white dark:bg-zinc-900 border-neutral-150 dark:border-zinc-800 shadow-2xl flex flex-col h-full overflow-hidden ${
                  isRtl ? 'md:border-e border-s-0' : 'md:border-s border-e-0'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-neutral-100 dark:border-zinc-800/60 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-zinc-900/50">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={closeDetails}
                      className="p-1.5 hover:bg-neutral-200 dark:hover:bg-zinc-800 rounded-xl text-neutral-500 dark:text-zinc-400 cursor-pointer transition-colors animate-pulse"
                      title={isRtl ? 'إغلاق' : 'Close'}
                    >
                      {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                    </button>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-zinc-200">
                        {pt.panelTitle}
                      </h3>
                      <p className="text-[9px] text-neutral-400 uppercase font-mono font-bold tracking-tight">
                        ID: {selectedMessage.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Star/Pinned Badge */}
                    {selectedMessage.isPinned && (
                      <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-0.5">
                        <Star size={9} fill="currentColor" />
                        <span>{isRtl ? 'مثبتة' : 'PINNED'}</span>
                      </span>
                    )}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                      selectedMessage.unread 
                        ? 'bg-rose-500/15 text-rose-500 border border-rose-500/20' 
                        : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/15'
                    }`}>
                      {selectedMessage.unread ? t.states.unreadBadge : t.states.readBadge}
                    </span>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-6 text-start">
                  
                  {/* SECTION 1: OVERVIEW */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-brand-500">
                      <MessageSquare size={12} />
                      <span>{pt.overview}</span>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-150 dark:border-zinc-800 bg-neutral-50/40 dark:bg-zinc-950/15 space-y-4">
                      {/* Full Subject */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">{pt.fullSubject}</span>
                        <h4 className="text-xs md:text-sm font-black text-neutral-800 dark:text-zinc-100 leading-snug">
                          {isRtl ? selectedMessage.titleAr : selectedMessage.titleEn}
                        </h4>
                      </div>

                      {/* Sender */}
                      <div className="space-y-1 pt-1 border-t border-neutral-200/50 dark:border-zinc-800/40">
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">{pt.senderInfo}</span>
                        <div className="flex items-center gap-2.5">
                          <img src={selectedMessage.senderAvatar} alt="Sender" className="w-8 h-8 rounded-full object-cover border border-zinc-800/40" />
                          <div>
                            <span className="text-[11px] font-extrabold text-neutral-800 dark:text-zinc-100 block">
                              {isRtl ? selectedMessage.senderNameAr : selectedMessage.senderNameEn}
                            </span>
                            <span className="text-[9px] text-neutral-400 font-bold block leading-none">
                              {isRtl ? selectedMessage.senderRoleAr : selectedMessage.senderRoleEn}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recipient Classification */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200/50 dark:border-zinc-800/40 text-[11px] font-semibold">
                        <div>
                          <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">{pt.recipientType}</span>
                          <span className="font-extrabold text-brand-500 flex items-center gap-1">
                            {selectedMessage.recipientType === 'all_staff' && (
                              <>
                                <Users size={10} />
                                <span>{t.recipients.all_staff}</span>
                              </>
                            )}
                            {selectedMessage.recipientType === 'employee' && (
                              <>
                                <User size={10} />
                                <span className="truncate max-w-[120px]">
                                  {isRtl ? selectedMessage.recipientNameAr : selectedMessage.recipientNameEn}
                                </span>
                              </>
                            )}
                            {selectedMessage.recipientType === 'unknown' && (
                              <>
                                <HelpCircle size={10} />
                                <span>{pt.unknownRecipient}</span>
                              </>
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-0.5">{pt.createdDate}</span>
                          <span className="text-neutral-700 dark:text-zinc-300 font-bold font-mono">
                            {selectedMessage.timestamp}
                          </span>
                        </div>
                      </div>

                      {/* Pinned status badge line */}
                      <div className="pt-2 border-t border-neutral-200/50 dark:border-zinc-800/40 flex items-center justify-between text-[11px]">
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">{pt.pinStatus}</span>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          selectedMessage.isPinned 
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/15' 
                            : 'bg-neutral-100 dark:bg-zinc-800/50 text-neutral-400'
                        }`}>
                          {selectedMessage.isPinned ? pt.pinned : pt.unpinned}
                        </span>
                      </div>

                      {/* Full Body Content */}
                      <div className="space-y-1.5 pt-3 border-t border-neutral-200/50 dark:border-zinc-800/40">
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block">{pt.fullBody}</span>
                        <div className="p-3 bg-white dark:bg-zinc-950/40 border border-neutral-150 dark:border-zinc-800/50 rounded-lg text-[11px] md:text-xs leading-relaxed font-medium text-neutral-700 dark:text-zinc-200 whitespace-pre-wrap">
                          {selectedMessage.body}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: DELIVERY METRICS */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500">
                      <CheckCheck size={12} />
                      <span>{pt.delivery}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-2.5 rounded-xl border border-neutral-150 dark:border-zinc-800 bg-neutral-50/30 dark:bg-zinc-950/10 text-center space-y-1">
                        <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest block leading-tight">{pt.sentStatus}</span>
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-500 uppercase">
                          <Check size={9} />
                          <span>{pt.sentSuccess}</span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-neutral-150 dark:border-zinc-800 bg-neutral-50/30 dark:bg-zinc-950/10 text-center space-y-1">
                        <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest block leading-tight">{pt.readCount}</span>
                        <span className="text-xs font-black text-neutral-800 dark:text-zinc-100 font-mono">
                          {selectedMessage.recipientType === 'all_staff' 
                            ? (selectedMessage.recipientStatuses ? selectedMessage.recipientStatuses.filter(s => s.status === 'read').length : 3)
                            : (selectedMessage.recipientStatuses && selectedMessage.recipientStatuses[0]?.status === 'read' ? 1 : 0)
                          }
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl border border-neutral-150 dark:border-zinc-800 bg-neutral-50/30 dark:bg-zinc-950/10 text-center space-y-1">
                        <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest block leading-tight">{pt.unreadCount}</span>
                        <span className="text-xs font-black text-rose-500 font-mono">
                          {selectedMessage.recipientType === 'all_staff' 
                            ? (selectedMessage.recipientStatuses ? selectedMessage.recipientStatuses.filter(s => s.status === 'unread').length : 1)
                            : (selectedMessage.recipientStatuses && selectedMessage.recipientStatuses[0]?.status === 'unread' ? 1 : 0)
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: RECIPIENTS LIST */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-500">
                      <Users size={12} />
                      <span>{pt.recipients}</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-neutral-150 dark:border-zinc-800 bg-neutral-50/40 dark:bg-zinc-950/15 space-y-3">
                      {selectedMessage.recipientType === 'all_staff' ? (
                        /* Broadcast recipient list template */
                        <div className="space-y-2.5">
                          {selectedMessage.recipientStatuses && selectedMessage.recipientStatuses.length > 0 ? (
                            selectedMessage.recipientStatuses.map((rec) => (
                              <div key={rec.employeeId} className="flex items-center justify-between gap-2 text-[11px] border-b border-neutral-200/40 dark:border-zinc-800/30 pb-2 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <img src={rec.avatar} alt={rec.nameEn} className="w-6.5 h-6.5 rounded-full object-cover shrink-0" />
                                  <div className="min-w-0">
                                    <span className="font-extrabold text-neutral-800 dark:text-zinc-200 block truncate">
                                      {isRtl ? rec.nameAr : rec.nameEn}
                                    </span>
                                    <span className="text-[8px] text-neutral-400 block leading-none truncate">
                                      {isRtl ? rec.roleAr : rec.roleEn}
                                    </span>
                                  </div>
                                </div>

                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase shrink-0 ${
                                  rec.status === 'read'
                                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                    : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-400'
                                }`}>
                                  {rec.status === 'read' ? (
                                    <>
                                      <CheckCheck size={8} />
                                      <span>{pt.readBadge}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock size={8} />
                                      <span>{pt.unreadBadge}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                            ))
                          ) : (
                            <p className="text-[10px] text-neutral-400 italic text-center py-1">
                              {isRtl ? 'لا يوجد مستلمون مسجلون للبث' : 'No broadcast recipients logged'}
                            </p>
                          )}
                        </div>
                      ) : selectedMessage.recipientType === 'employee' ? (
                        /* Direct message detailed recipient view */
                        <div className="space-y-3.5">
                          {selectedMessage.recipientStatuses && selectedMessage.recipientStatuses.length > 0 ? (
                            selectedMessage.recipientStatuses.map((rec) => {
                              const isRead = rec.status === 'read';
                              return (
                                <div key={rec.employeeId} className="space-y-3">
                                  {/* Employee Profile Header */}
                                  <div className="flex items-center gap-2.5 border-b border-neutral-200/40 dark:border-zinc-800/30 pb-2.5">
                                    <img src={rec.avatar} alt={rec.nameEn} className="w-8 h-8 rounded-full object-cover border border-zinc-800/40 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-extrabold text-neutral-800 dark:text-zinc-200 block truncate">
                                        {isRtl ? rec.nameAr : rec.nameEn}
                                      </span>
                                      <span className="text-[9px] text-neutral-400 block leading-none truncate">
                                        {isRtl ? rec.roleAr : rec.roleEn}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Delivered & Read status steps */}
                                  <div className="space-y-2.5 text-[11px] font-semibold pl-2">
                                    {/* Delivered step */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-zinc-300">
                                        <CheckCheck className="text-emerald-500" size={12} />
                                        <span>{isRtl ? 'تاريخ التوصيل والتبليغ' : 'Delivered'}</span>
                                      </div>
                                      <span className="text-[9px] text-neutral-400 font-mono">
                                        {rec.deliveredTime || selectedMessage.timestamp}
                                      </span>
                                    </div>

                                    {/* Read step */}
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-1.5 text-neutral-700 dark:text-zinc-300">
                                        {isRead ? (
                                          <CheckCheck className="text-brand-500" size={12} />
                                        ) : (
                                          <Clock className="text-neutral-400" size={12} />
                                        )}
                                        <span>{isRtl ? 'حالة القراءة والمطالعة' : 'Read'}</span>
                                      </div>
                                      
                                      {isRead ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-brand-400 font-mono">
                                          <span>{rec.readTime || '9:20 AM'}</span>
                                        </span>
                                      ) : (
                                        <span className="text-[9px] text-neutral-400 italic bg-neutral-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                                          {pt.notDeliveredBadge}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-neutral-300 block font-bold text-xs truncate">
                                    {isRtl ? selectedMessage.recipientNameAr : selectedMessage.recipientNameEn}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-2 text-[11px] font-semibold pl-2 pt-1 border-t border-zinc-850">
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-400">{isRtl ? 'تاريخ التوصيل' : 'Delivered'}</span>
                                  <span className="text-[9px] text-zinc-500 font-mono">{selectedMessage.timestamp}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-400">{isRtl ? 'تاريخ القراءة' : 'Read'}</span>
                                  <span className="text-[9px] text-zinc-500 font-mono">{selectedMessage.timestamp}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Unknown external recipient */
                        <div className="text-center py-2 text-[10px] text-neutral-400 italic font-medium">
                          {isRtl ? 'جهة خارجية غير مسجلة في شجرة طاقم رفاه' : 'External party outside Refah Staff roster.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SECTION 4: ACTIONS */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-500">
                      <SlidersHorizontal size={12} />
                      <span>{pt.actions}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {/* Resend button */}
                      <button
                        onClick={() => handleResendMessage(selectedMessage.id)}
                        disabled={isResending}
                        className={`w-full p-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isResending
                            ? 'bg-neutral-100 dark:bg-zinc-800 text-neutral-400 border-transparent cursor-wait'
                            : 'bg-brand-500 hover:bg-brand-600 text-zinc-950 border-transparent hover:scale-101 hover:shadow-md'
                        }`}
                      >
                        {isResending ? (
                          <>
                            <span className="block w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                            <span>{pt.resendingBtn}</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw size={13} />
                            <span>{pt.resendBtn}</span>
                          </>
                        )}
                      </button>

                      {/* Pin Toggle Button */}
                      <button
                        onClick={(e) => {
                          togglePin(selectedMessage.id, e);
                          showToast(selectedMessage.isPinned ? (isRtl ? '✨ تم إلغاء تثبيت الرسالة' : '✨ Message unpinned!') : (isRtl ? '✨ تم تثبيت الرسالة بنجاح' : '✨ Message pinned successfully!'));
                        }}
                        className={`w-full p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          selectedMessage.isPinned
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-500'
                            : 'bg-neutral-50 dark:bg-zinc-950 border-neutral-200 dark:border-zinc-800 text-neutral-700 dark:text-zinc-200 hover:bg-neutral-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Pin size={13} className={selectedMessage.isPinned ? 'fill-amber-500' : ''} />
                        <span>{selectedMessage.isPinned ? pt.unpinBtn : pt.pinBtn}</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          if (confirm(t.deleteConfirm)) {
                            handleDeleteMessage(selectedMessage.id, e);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer text-xs font-bold"
                      >
                        <Trash2 size={13} />
                        <span>{pt.deleteBtn}</span>
                      </button>
                    </div>
                  </div>

                  {/* REPLIES / COMMENT FEED & REPLY FORM - RE-USED FOR PREMIUM FULLNESS */}
                  <div className="space-y-4 border-t border-neutral-100 dark:border-zinc-800/60 pt-5">
                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                      {pt.replies} ({selectedMessage.replies.length})
                    </h4>

                    {selectedMessage.replies.length > 0 ? (
                      <div className="space-y-3">
                        {selectedMessage.replies.map((rep) => (
                          <div key={rep.id} className="flex gap-2.5 items-start bg-neutral-50 dark:bg-zinc-950/20 p-2.5 rounded-lg border border-neutral-100 dark:border-zinc-850/50">
                            <img src={rep.senderAvatar} alt="Reply avatar" className="w-6.5 h-6.5 rounded-full object-cover shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-neutral-800 dark:text-zinc-200 truncate">
                                  {isRtl ? rep.senderNameAr : rep.senderNameEn}
                                </span>
                                <span className="text-[8px] text-neutral-400 font-mono shrink-0 font-bold">
                                  {rep.timestamp}
                                </span>
                              </div>
                              <p className="text-[10px] text-neutral-600 dark:text-zinc-300 mt-1 leading-relaxed bg-white dark:bg-zinc-950/40 p-2 rounded-md border border-neutral-100/50 dark:border-zinc-900">
                                {rep.body}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-neutral-400 text-center py-2 italic font-medium bg-neutral-50/50 dark:bg-zinc-950/10 rounded-lg p-3">
                        {lang === 'ar' ? 'لا توجد تعقيبات أو متابعات بعد من طاقم رفاه.' : 'No replies or team comments registered yet on this Circular.'}
                      </p>
                    )}

                    <form onSubmit={handleReplySubmit} className="pt-2">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          disabled={isSendingReply}
                          placeholder={lang === 'ar' ? 'اكتب تعليقك لطاقم العمل هنا...' : 'Type a detailed team follow-up here...'}
                          className={`flex-1 py-2 px-3 rounded-lg border text-[11px] focus:ring-1 focus:ring-brand-500 outline-hidden font-medium ${
                            darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200 text-neutral-700'
                          }`}
                        />
                        
                        <button
                          type="submit"
                          disabled={isSendingReply || !replyText.trim()}
                          className={`p-2 rounded-lg transition-all cursor-pointer ${
                            replyText.trim()
                              ? 'bg-brand-500 text-zinc-950 font-bold hover:scale-102'
                              : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 cursor-not-allowed'
                          }`}
                        >
                          {isSendingReply ? (
                            <span className="block w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Send size={12} className={isRtl ? 'rotate-180' : ''} />
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>

      {/* ========================================================= */}
      {/* 4. COMPOSE MESSAGE DIALOG MODAL */}
      {/* ========================================================= */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div 
            id="compose-overlay"
            onClick={() => setIsComposeOpen(false)} 
            className="fixed inset-0 bg-zinc-950/75 backdrop-blur-xs transition-opacity" 
          />
          <div className={`relative w-full h-full md:h-auto md:max-w-xl rounded-none md:rounded-2xl shadow-2xl border flex flex-col transition-all text-start overflow-hidden ${
            darkMode ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-neutral-150 text-neutral-800'
          }`}>
            <div className="flex justify-between items-center border-b border-zinc-800/10 dark:border-zinc-800/30 p-5 shrink-0">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-sm md:text-base flex items-center gap-2">
                  <Sparkles className="text-brand-500 animate-pulse" size={18} />
                  <span>{isRtl ? 'إنشاء رسالة جديدة' : 'Compose New Message'}</span>
                </h3>
                <p className="text-[10px] text-neutral-400">
                  {isRtl ? 'أرسل إشعارًا داخليًا أو رسالة مباشرة لأحد أعضاء الفريق.' : 'Dispatch an internal circular or private message to a teammate.'}
                </p>
              </div>
              <button
                id="close-compose-modal-btn"
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 text-xs font-semibold">
              
              {/* SECTION 1: RECIPIENTS */}
              <div className="space-y-3 p-4 rounded-xl border border-zinc-800/10 dark:border-zinc-800/50 bg-neutral-50/50 dark:bg-zinc-950/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <Users size={12} className="text-brand-500" />
                  <span>{isRtl ? '1. المستلمون' : '1. Recipients'}</span>
                </div>
                
                <div className="space-y-3">
                  <label className="text-neutral-500 dark:text-zinc-400 block mb-1">
                    {isRtl ? 'نوع المستلم' : 'Recipient Group'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      id="recipient-all-btn"
                      type="button"
                      onClick={() => setComposeRecipientType('all')}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        composeRecipientType === 'all'
                          ? 'bg-brand-500 text-zinc-950 font-black border-brand-500 shadow-sm'
                          : darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <Users size={13} />
                      <span>{isRtl ? 'جميع الموظفين' : 'All Employees'}</span>
                    </button>
                    <button
                      id="recipient-single-btn"
                      type="button"
                      onClick={() => setComposeRecipientType('single')}
                      className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        composeRecipientType === 'single'
                          ? 'bg-brand-500 text-zinc-950 font-black border-brand-500 shadow-sm'
                          : darkMode ? 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300' : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                      }`}
                    >
                      <User size={13} />
                      <span>{isRtl ? 'موظف محدد' : 'Single Employee'}</span>
                    </button>
                  </div>

                  {composeRecipientType === 'single' && (
                    <div className="space-y-1.5 pt-2 animate-fadeIn">
                      <label className="text-neutral-400 block">{isRtl ? 'اختر الموظف المستهدف' : 'Select Target Employee'}</label>
                      <select
                        id="employee-selector"
                        value={composeEmployeeId}
                        onChange={(e) => setComposeEmployeeId(e.target.value)}
                        className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold ${
                          darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                        }`}
                      >
                        {staffMembers.map(sm => (
                          <option key={sm.id} value={sm.id}>
                            {isRtl ? `${sm.nameAr} (${sm.roleAr})` : `${sm.nameEn} (${sm.roleEn})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: SUBJECT */}
              <div className="space-y-3 p-4 rounded-xl border border-zinc-800/10 dark:border-zinc-800/50 bg-neutral-50/50 dark:bg-zinc-950/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <Tag size={12} className="text-brand-500" />
                  <span>{isRtl ? '2. الموضوع (اختياري)' : '2. Subject (Optional)'}</span>
                </div>
                
                <div className="space-y-1.5">
                  <input
                    id="message-subject-input"
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder={isRtl ? 'مثال: تحديثات عروض الـ VIP (اختياري)...' : 'e.g. System upgrade notification (optional)...'}
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-bold ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>
              </div>

              {/* SECTION 3: MESSAGE BODY */}
              <div className="space-y-3 p-4 rounded-xl border border-zinc-800/10 dark:border-zinc-800/50 bg-neutral-50/50 dark:bg-zinc-950/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <MessageSquare size={12} className="text-brand-500" />
                  <span>{isRtl ? '3. محتوى الرسالة (مطلوب)' : '3. Message Body (Required)'}</span>
                </div>
                
                <div className="space-y-1.5">
                  <textarea
                    id="message-body-textarea"
                    required
                    rows={4}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={isRtl ? 'اكتب تفاصيل وإرشادات المراسلة بوضوح...' : 'Type detailed message instructions, circular decisions, or requests here...'}
                    className={`w-full p-2.5 rounded-lg border focus:ring-1 focus:ring-brand-500 outline-hidden font-medium leading-relaxed ${
                      darkMode ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-white border-neutral-200'
                    }`}
                  />
                </div>
              </div>

              {/* SECTION 4: MESSAGE OPTIONS */}
              <div className="space-y-3 p-4 rounded-xl border border-zinc-800/10 dark:border-zinc-800/50 bg-neutral-50/50 dark:bg-zinc-950/20">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                  <SlidersHorizontal size={12} className="text-brand-500" />
                  <span>{isRtl ? '4. خيارات الرسالة' : '4. Message Options'}</span>
                </div>
                
                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-500/5 hover:bg-zinc-500/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Pin size={13} className="text-amber-500" />
                    <div>
                      <span className="block text-[11px] font-bold">{isRtl ? 'تثبيت الرسالة في الصندوق' : 'Pin message in Inbox'}</span>
                      <span className="block text-[9px] text-neutral-400 font-medium">
                        {isRtl ? 'سيظهر هذا الإشعار مثبتًا كأولوية قصوى للفريق' : 'Keep this thread pinned on top of the inbox lists'}
                      </span>
                    </div>
                  </div>
                  
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      id="pin-toggle-checkbox"
                      type="checkbox"
                      checked={composePinned}
                      onChange={(e) => setComposePinned(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500" />
                  </label>
                </div>
              </div>

              {/* Action Buttons footer inside scroll form container for safety on smaller phones */}
              <div className="flex justify-end gap-2 text-xs font-bold pt-4 border-t border-zinc-800/15 dark:border-zinc-800/30">
                <button
                  id="cancel-compose-btn"
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-800 text-neutral-400 cursor-pointer hover:bg-neutral-100 dark:hover:bg-zinc-850 font-black transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  id="send-compose-btn"
                  type="submit"
                  disabled={!composeBody.trim()}
                  className={`px-5 py-2.5 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    composeBody.trim()
                      ? 'bg-brand-500 hover:bg-brand-600 text-zinc-950 hover:scale-102 hover:shadow-lg shadow-brand-500/10'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-600 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Send size={13} className={isRtl ? 'rotate-180' : ''} />
                  <span>{isRtl ? 'إرسال المراسلة' : 'Send'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
