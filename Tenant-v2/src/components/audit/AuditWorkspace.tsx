import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  History, Search, Filter, Calendar, User, Activity, 
  ChevronLeft, ChevronRight, X, AlertCircle, RefreshCw,
  Eye, FileText, ArrowRightLeft, ShieldAlert
} from 'lucide-react';
import { Language } from '../../types';
import { tenantApiAdapter } from '../../lib/tenantApiAdapter';

interface AuditWorkspaceProps {
  lang: Language;
  darkMode?: boolean;
}

export default function AuditWorkspace({ lang, darkMode = false }: AuditWorkspaceProps) {
  const isRtl = lang === 'ar';
  
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    entityType: '',
    entityId: '',
    action: '',
    performedByType: '',
    performedById: '',
    operationId: '',
    correlationId: '',
    from: '',
    to: ''
  });

  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        page,
        limit: 20
      };
      const res = await tenantApiAdapter.getAuditLogs(params);
      if (res.success) {
        setLogs(res.data?.logs || []);
        setTotalPages(res.data?.pagination?.totalPages || 1);
        setTotalRecords(res.data?.pagination?.total || 0);
      } else {
        setError(res.error || (isRtl ? 'حدث خطأ أثناء جلب السجلات' : 'Failed to fetch logs'));
      }
    } catch (err: any) {
      setError(err.message || (isRtl ? 'حدث خطأ غير متوقع' : 'Unexpected error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      entityType: '',
      entityId: '',
      action: '',
      performedByType: '',
      performedById: '',
      operationId: '',
      correlationId: '',
      from: '',
      to: ''
    });
    setPage(1);
  };

  const viewDetails = async (id: string) => {
    setSelectedLogId(id);
    setLoadingDetail(true);
    try {
      const res = await tenantApiAdapter.getAuditLog(id);
      if (res.success) {
        setSelectedLog(res.data?.log);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(isRtl ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    if (action.includes('UPDATE')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
    if (action.includes('DELETE')) return 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-200 dark:border-rose-800';
    return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
  };

  const baseStyles = {
    bg: darkMode ? 'bg-zinc-900' : 'bg-white',
    border: darkMode ? 'border-zinc-800' : 'border-neutral-200',
    text: darkMode ? 'text-zinc-100' : 'text-neutral-900',
    textMuted: darkMode ? 'text-zinc-400' : 'text-neutral-500',
    bgMuted: darkMode ? 'bg-zinc-800/50' : 'bg-neutral-50',
    inputBg: darkMode ? 'bg-zinc-950/50' : 'bg-white',
  };

  return (
    <div className={`space-y-6 ${baseStyles.text}`}>
      {/* Header */}
      <div className={`p-6 rounded-2xl border ${baseStyles.bg} ${baseStyles.border} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-brand-50 dark:bg-brand-950/30 text-brand-600 rounded-xl">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">{isRtl ? 'سجل العمليات' : 'Audit & Operations'}</h1>
            <p className={`text-sm ${baseStyles.textMuted}`}>
              {isRtl 
                ? 'تتبع تاريخ العمليات والتغييرات بشكل آمن وموثوق'
                : 'Securely track operational history and system changes'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fetchLogs()}
            className={`p-2.5 rounded-xl border ${baseStyles.border} hover:${baseStyles.bgMuted} transition-colors`}
            title={isRtl ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${showFilters ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/30 dark:border-brand-800 dark:text-brand-400' : `${baseStyles.border} hover:${baseStyles.bgMuted}`} transition-colors font-semibold text-sm`}
          >
            <Filter size={18} />
            <span>{isRtl ? 'تصفية النتائج' : 'Filters'}</span>
            {(Object.values(filters).some(v => v !== '')) && (
              <span className="w-2 h-2 rounded-full bg-brand-500 ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`p-5 rounded-2xl border ${baseStyles.bg} ${baseStyles.border} shadow-sm`}>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="filter-entityType" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'نوع الكيان' : 'Entity Type'}</label>
                  <input
                    id="filter-entityType"
                    type="text"
                    value={filters.entityType}
                    onChange={(e) => handleFilterChange('entityType', e.target.value)}
                    placeholder="e.g. Booking, Payment"
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-action" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'نوع العملية' : 'Action'}</label>
                  <input
                    id="filter-action"
                    type="text"
                    value={filters.action}
                    onChange={(e) => handleFilterChange('action', e.target.value)}
                    placeholder="e.g. CREATE, UPDATE"
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-entityId" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'معرف الكيان' : 'Entity ID'}</label>
                  <input
                    id="filter-entityId"
                    type="text"
                    value={filters.entityId}
                    onChange={(e) => handleFilterChange('entityId', e.target.value)}
                    placeholder="UUID..."
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-actorType" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'نوع المنفذ' : 'Actor Type'}</label>
                  <select
                    id="filter-actorType"
                    value={filters.performedByType}
                    onChange={(e) => handleFilterChange('performedByType', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  >
                    <option value="">{isRtl ? 'الكل' : 'All'}</option>
                    <option value="tenant_user">{isRtl ? 'مستخدم مستأجر' : 'Tenant User'}</option>
                    <option value="customer">{isRtl ? 'عميل' : 'Customer'}</option>
                    <option value="system">{isRtl ? 'نظام' : 'System'}</option>
                    <option value="super_admin">{isRtl ? 'مدير نظام' : 'Super Admin'}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="filter-operationId" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'معرف العملية' : 'Operation ID'}</label>
                  <input
                    id="filter-operationId"
                    type="text"
                    value={filters.operationId}
                    onChange={(e) => handleFilterChange('operationId', e.target.value)}
                    placeholder="op_..."
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none font-mono text-xs`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-correlationId" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'معرف الارتباط' : 'Correlation ID'}</label>
                  <input
                    id="filter-correlationId"
                    type="text"
                    value={filters.correlationId}
                    onChange={(e) => handleFilterChange('correlationId', e.target.value)}
                    placeholder="corr_..."
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none font-mono text-xs`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-from" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'من تاريخ' : 'From Date'}</label>
                  <input
                    id="filter-from"
                    type="date"
                    value={filters.from}
                    onChange={(e) => handleFilterChange('from', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="filter-to" className={`block text-xs font-bold mb-1.5 ${baseStyles.textMuted}`}>{isRtl ? 'إلى تاريخ' : 'To Date'}</label>
                  <input
                    id="filter-to"
                    type="date"
                    value={filters.to}
                    onChange={(e) => handleFilterChange('to', e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border ${baseStyles.border} ${baseStyles.inputBg} text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none`}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2 border-t pt-4 dark:border-zinc-800">
                <button
                  onClick={clearFilters}
                  className={`px-4 py-2 rounded-xl border ${baseStyles.border} hover:${baseStyles.bgMuted} text-sm font-semibold transition-colors`}
                >
                  {isRtl ? 'مسح الفلاتر' : 'Clear Filters'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table Content */}
      <div className={`rounded-2xl border ${baseStyles.bg} ${baseStyles.border} shadow-sm overflow-hidden flex flex-col`}>
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-rose-500 mb-3" size={32} />
            <h3 className="font-bold text-rose-700 dark:text-rose-400">{isRtl ? 'خطأ' : 'Error'}</h3>
            <p className={`mt-1 ${baseStyles.textMuted}`}>{error}</p>
            <button onClick={fetchLogs} className="mt-4 px-4 py-2 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-xl font-semibold text-sm hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors">
              {isRtl ? 'إعادة المحاولة' : 'Try Again'}
            </button>
          </div>
        ) : loading ? (
          <div className="p-12 text-center flex flex-col items-center">
            <RefreshCw className="animate-spin text-brand-500 mb-4" size={32} />
            <p className={`font-semibold ${baseStyles.textMuted}`}>{isRtl ? 'جاري التحميل...' : 'Loading audit logs...'}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <ShieldAlert className={`mb-4 ${baseStyles.textMuted} opacity-30`} size={48} />
            <h3 className="font-bold text-lg mb-1">{isRtl ? 'لا توجد سجلات' : 'No audit records found'}</h3>
            <p className={baseStyles.textMuted}>
              {isRtl ? 'لم يتم العثور على أي عمليات تطابق معايير البحث' : 'No operations match your search criteria'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className={`${baseStyles.bgMuted} border-b ${baseStyles.border}`}>
                <tr>
                  <th className={`px-4 py-3 font-semibold ${baseStyles.textMuted} ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'التاريخ والوقت' : 'Timestamp'}</th>
                  <th className={`px-4 py-3 font-semibold ${baseStyles.textMuted} ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'العملية' : 'Action'}</th>
                  <th className={`px-4 py-3 font-semibold ${baseStyles.textMuted} ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'الكيان' : 'Entity'}</th>
                  <th className={`px-4 py-3 font-semibold ${baseStyles.textMuted} ${isRtl ? 'text-right' : 'text-left'}`}>{isRtl ? 'المنفذ' : 'Actor'}</th>
                  <th className={`px-4 py-3 font-semibold ${baseStyles.textMuted} text-center`}>{isRtl ? 'إجراء' : 'View'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
                {logs.map((log) => (
                  <tr key={log.id} className={`hover:${baseStyles.bgMuted} transition-colors group cursor-pointer`} onClick={() => viewDetails(log.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs md:text-sm">{formatDate(log.createdAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] md:text-xs font-bold border ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{log.entityType}</div>
                      <div className={`text-[10px] md:text-xs font-mono mt-0.5 truncate max-w-[120px] md:max-w-[180px] ${baseStyles.textMuted}`} title={log.entityId}>
                        {log.entityId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${baseStyles.bg} border ${baseStyles.border}`}>
                          <User size={12} className={baseStyles.textMuted} />
                        </div>
                        <div>
                          <div className="font-semibold text-xs capitalize text-brand-600 dark:text-brand-400">{log.performedByType.replace('_', ' ')}</div>
                          {log.performedById && (
                            <div className={`text-[10px] font-mono mt-0.5 ${baseStyles.textMuted}`}>{log.performedById.slice(0, 8)}...</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30`}
                        onClick={(e) => { e.stopPropagation(); viewDetails(log.id); }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`p-4 border-t ${baseStyles.border} flex items-center justify-between`}>
            <div className={`text-xs ${baseStyles.textMuted}`}>
              {isRtl ? `إجمالي ${totalRecords} سجل` : `Total ${totalRecords} records`}
            </div>
            <div className="flex items-center gap-1">
              <button 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className={`p-1.5 rounded-lg border ${baseStyles.border} hover:${baseStyles.bgMuted} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
              <div className="px-3 py-1 text-sm font-semibold">
                {page} / {totalPages}
              </div>
              <button 
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className={`p-1.5 rounded-lg border ${baseStyles.border} hover:${baseStyles.bgMuted} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Drawer */}
      <AnimatePresence>
        {selectedLogId && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm"
              onClick={() => setSelectedLogId(null)}
            />
            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`relative w-full max-w-lg h-full ${baseStyles.bg} shadow-2xl border-l ${baseStyles.border} flex flex-col z-10`}
            >
              <div className={`p-5 flex items-center justify-between border-b ${baseStyles.border}`}>
                <h3 className="font-bold text-lg">{isRtl ? 'تفاصيل العملية' : 'Audit Details'}</h3>
                <button 
                  onClick={() => setSelectedLogId(null)}
                  className={`p-2 rounded-xl hover:${baseStyles.bgMuted} transition-colors`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {loadingDetail || !selectedLog ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-3">
                    <RefreshCw className="animate-spin text-brand-500" size={24} />
                    <span className={`text-sm ${baseStyles.textMuted}`}>{isRtl ? 'جاري تحميل التفاصيل...' : 'Loading details...'}</span>
                  </div>
                ) : (
                  <>
                    {/* Basic Meta */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${getActionColor(selectedLog.action)}`}>
                          {selectedLog.action}
                        </span>
                        <span className={`text-sm font-semibold ${baseStyles.textMuted}`}>
                          {formatDate(selectedLog.createdAt)}
                        </span>
                      </div>
                      
                      <div className={`grid grid-cols-2 gap-4 p-4 rounded-xl ${baseStyles.bgMuted} border ${baseStyles.border}`}>
                        <div>
                          <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${baseStyles.textMuted}`}>{isRtl ? 'الكيان' : 'Entity'}</p>
                          <p className="font-bold text-sm">{selectedLog.entityType}</p>
                          <p className="text-xs font-mono mt-1 opacity-70 break-all">{selectedLog.entityId}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${baseStyles.textMuted}`}>{isRtl ? 'المنفذ' : 'Actor'}</p>
                          <p className="font-bold text-sm capitalize">{selectedLog.performedByType.replace('_', ' ')}</p>
                          <p className="text-xs font-mono mt-1 opacity-70 break-all">{selectedLog.performedById}</p>
                        </div>
                      </div>
                    </div>

                    {/* Operational Boundaries */}
                    {(selectedLog.operationId || selectedLog.correlationId || selectedLog.requestId) && (
                      <div>
                        <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${baseStyles.textMuted}`}>
                          <Activity size={14} />
                          {isRtl ? 'سياق العملية' : 'Operation Context'}
                        </h4>
                        <div className="space-y-3">
                          {selectedLog.operationId && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold">Operation ID</span>
                              <div className="flex gap-2">
                                <span className={`flex-1 font-mono text-xs p-2 rounded-lg ${baseStyles.bgMuted} border ${baseStyles.border} break-all`}>
                                  {selectedLog.operationId}
                                </span>
                                <button 
                                  onClick={() => {
                                    handleFilterChange('operationId', selectedLog.operationId);
                                    setSelectedLogId(null);
                                  }}
                                  className={`p-2 rounded-lg border ${baseStyles.border} text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors`}
                                  title={isRtl ? 'عرض كل أحداث هذه العملية' : 'View all events for this operation'}
                                >
                                  <Search size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                          {selectedLog.correlationId && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold">Correlation ID</span>
                              <div className="flex gap-2">
                                <span className={`flex-1 font-mono text-xs p-2 rounded-lg ${baseStyles.bgMuted} border ${baseStyles.border} break-all`}>
                                  {selectedLog.correlationId}
                                </span>
                                <button 
                                  onClick={() => {
                                    handleFilterChange('correlationId', selectedLog.correlationId);
                                    setSelectedLogId(null);
                                  }}
                                  className={`p-2 rounded-lg border ${baseStyles.border} text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors`}
                                  title={isRtl ? 'تتبع مسار العملية كاملة' : 'Trace full correlation chain'}
                                >
                                  <Search size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                          {selectedLog.requestId && (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs font-semibold">Request ID</span>
                              <span className={`font-mono text-xs p-2 rounded-lg ${baseStyles.bgMuted} border ${baseStyles.border} break-all`}>
                                {selectedLog.requestId}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Changes Details */}
                    <div>
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${baseStyles.textMuted}`}>
                        <FileText size={14} />
                        {isRtl ? 'التفاصيل الدقيقة' : 'Payload Details'}
                      </h4>
                      <div className="space-y-4">
                        {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                          <div>
                            <span className="text-xs font-semibold mb-1 block">Context Metadata</span>
                            <pre className={`text-[10px] p-3 rounded-xl overflow-x-auto ${baseStyles.bgMuted} border ${baseStyles.border}`}>
                              {JSON.stringify(selectedLog.details, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {(selectedLog.previousValue || selectedLog.newValue) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedLog.previousValue && Object.keys(selectedLog.previousValue).length > 0 && (
                              <div>
                                <span className="text-xs font-semibold text-rose-600 mb-1 block flex items-center gap-1">
                                  <ArrowRightLeft size={12} className="rotate-90 md:rotate-0 md:hidden" />
                                  Previous
                                </span>
                                <pre className={`text-[10px] p-3 rounded-xl overflow-x-auto bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50`}>
                                  {JSON.stringify(selectedLog.previousValue, null, 2)}
                                </pre>
                              </div>
                            )}
                            {selectedLog.newValue && Object.keys(selectedLog.newValue).length > 0 && (
                              <div>
                                <span className="text-xs font-semibold text-emerald-600 mb-1 block">New</span>
                                <pre className={`text-[10px] p-3 rounded-xl overflow-x-auto bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50`}>
                                  {JSON.stringify(selectedLog.newValue, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
