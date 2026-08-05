const fs = require('fs');
const file = 'Tenant-v2/src/components/ReportsWorkspace.tsx';
let content = fs.readFileSync(file, 'utf8');

const insertion1 = `  const [currentPage, setCurrentPage] = useState(1);
  const [drillDownId, setDrillDownId] = useState<string | null>(null);

  // Filter Drawer State
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftSelectedEmployee, setDraftSelectedEmployee] = useState('all');
  const [draftSelectedService, setDraftSelectedService] = useState('all');
  const [draftSelectedPaymentMethod, setDraftSelectedPaymentMethod] = useState('all');
  const [draftDateRange, setDraftDateRange] = useState('last_30_days');
  const [draftCustomDateFrom, setDraftCustomDateFrom] = useState('');
  const [draftCustomDateTo, setDraftCustomDateTo] = useState('');
  const [draftSavedPreset, setDraftSavedPreset] = useState('');

  // Custom Toast State`;

content = content.replace(
  /  const \[currentPage, setCurrentPage\] = useState\(1\);\s*const \[drillDownId, setDrillDownId\] = useState<string \| null>\(null\);\s*\/\/ Custom Toast State/,
  insertion1
);

const searchBlockStart = '<div className="w-px h-5 bg-neutral-200" />';
const searchBlockEnd = '        {/* LOADING SHIMMER EFFECT AREA */}';

const startIndex = content.indexOf(searchBlockStart);
const endIndex = content.indexOf(searchBlockEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement2 = `<div className="w-px h-5 bg-neutral-200" />
              <button
                onClick={() => handleExport('print')}
                className="p-2 hover:bg-white rounded-lg text-neutral-600 hover:text-indigo-600 transition-all cursor-pointer"
                title="Print Report Data"
              >
                <Printer size={15} />
              </button>
              <div className="w-px h-5 bg-neutral-200" />
              <button
                onClick={() => {
                  setDraftSearchTerm(searchTerm);
                  setDraftSelectedEmployee(selectedEmployee);
                  setDraftSelectedService(selectedService);
                  setDraftSelectedPaymentMethod(selectedPaymentMethod);
                  setDraftDateRange(dateRange);
                  setDraftCustomDateFrom(customDateFrom);
                  setDraftCustomDateTo(customDateTo);
                  setIsFilterDrawerOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Filter size={15} />
                {isRtl ? 'الفلاتر' : 'Filters'}
              </button>
            </div>
          </div>
        </div>

        {/* LOADING SHIMMER EFFECT AREA */}`;
    content = content.substring(0, startIndex) + replacement2 + content.substring(endIndex + searchBlockEnd.length);
} else {
    console.error('Could not find chunk 2 markers');
    process.exit(1);
}

// Now append the drawer UI right before the final </div> of the component.
// We will look for `      </div>\n\n    </div>\n  );\n}`
const endOfComponentMarker = `      </div>\n\n    </div>\n  );\n}`;
const drawerUI = `

      {/* FILTER DRAWER OVERLAY */}
      <AnimatePresence>
        {isFilterDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm"
              onClick={() => setIsFilterDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: isRtl ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '-100%' : '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={\`fixed top-0 \${isRtl ? 'left-0' : 'right-0'} h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-\${isRtl ? 'r' : 'l'} border-slate-100\`}
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-3 text-slate-800">
                  <Filter size={20} className="text-amber-500" />
                  <h2 className="text-lg font-black tracking-tight">{isRtl ? 'فلاتر التقرير' : 'Report Filters'}</h2>
                </div>
                <button
                  onClick={() => setIsFilterDrawerOpen(false)}
                  className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Search */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{isRtl ? 'بحث' : 'Search'}</label>
                  <div className="relative">
                    <Search className={\`absolute \${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate-400\`} size={16} />
                    <input
                      type="text"
                      placeholder={isRtl ? 'بحث في التقرير...' : 'Search report...'}
                      value={draftSearchTerm}
                      onChange={(e) => setDraftSearchTerm(e.target.value)}
                      className={\`w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 \${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} text-sm font-semibold outline-none focus:border-amber-400 transition-colors\`}
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{isRtl ? 'الفترة' : 'Date Range'}</label>
                  <select
                    value={draftDateRange}
                    onChange={(e) => setDraftDateRange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
                  >
                    {[{id: 'today', labelEn: 'Today', labelAr: 'اليوم'}, {id: 'yesterday', labelEn: 'Yesterday', labelAr: 'الأمس'}, {id: 'last_7_days', labelEn: 'Last 7 Days', labelAr: 'آخر 7 أيام'}, {id: 'this_month', labelEn: 'This Month', labelAr: 'هذا الشهر'}, {id: 'last_month', labelEn: 'Last Month', labelAr: 'الشهر الماضي'}, {id: 'last_30_days', labelEn: 'Last 30 Days', labelAr: 'آخر 30 يوم'}, {id: 'custom', labelEn: 'Custom Date', labelAr: 'تاريخ مخصص'}].map(dr => (
                      <option key={dr.id} value={dr.id}>{isRtl ? dr.labelAr : dr.labelEn}</option>
                    ))}
                  </select>
                </div>

                {/* Custom Dates */}
                {draftDateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'من تاريخ' : 'Date From'}</label>
                      <input
                        type="date"
                        value={draftCustomDateFrom}
                        onChange={(e) => setDraftCustomDateFrom(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isRtl ? 'إلى تاريخ' : 'Date To'}</label>
                      <input
                        type="date"
                        value={draftCustomDateTo}
                        onChange={(e) => setDraftCustomDateTo(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}

                <div className="w-full h-px bg-slate-100" />

                {/* Saved Views / Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-2">
                    <Award size={14} className="text-amber-500" />
                    {isRtl ? 'تقارير محفوظة' : 'Saved Reports'}
                  </label>
                  <select
                    value={draftSavedPreset}
                    onChange={(e) => {
                      setDraftSavedPreset(e.target.value);
                      const val = e.target.value;
                      if (val === 'end_of_day') {
                        setDraftDateRange('today');
                        setDraftSelectedEmployee('all');
                        setDraftSelectedService('all');
                      } else if (val === 'monthly_sales') {
                        setDraftDateRange('this_month');
                        setDraftSelectedEmployee('all');
                        setDraftSelectedService('all');
                      } else if (val === 'staff_performance') {
                        setDraftDateRange('last_30_days');
                        setDraftSelectedService('all');
                      }
                    }}
                    className="w-full bg-amber-50/50 border border-amber-200 rounded-xl p-2.5 text-sm font-black text-amber-800 outline-none focus:border-amber-400"
                  >
                    <option value="" disabled>{isRtl ? 'اختر تقرير محفوظ...' : 'Saved Presets...'}</option>
                    {[{id: 'end_of_day', labelEn: 'End of Day Summary', labelAr: 'ملخص نهاية اليوم'}, {id: 'monthly_sales', labelEn: 'Monthly Sales Review', labelAr: 'مراجعة مبيعات الشهر'}, {id: 'staff_performance', labelEn: 'Staff Performance (30d)', labelAr: 'أداء الموظفين (30 يوم)'}].map(sr => (
                      <option key={sr.id} value={sr.id}>{isRtl ? sr.labelAr : sr.labelEn}</option>
                    ))}
                  </select>
                </div>

                <div className="w-full h-px bg-slate-100" />

                {/* Employee Drop */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{isRtl ? 'الموظف' : 'Employee'}</label>
                  <select
                    value={draftSelectedEmployee}
                    onChange={(e) => setDraftSelectedEmployee(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
                  >
                    <option value="all">👑 {isRtl ? 'كل الموظفين' : 'All Employees'}</option>
                    {employeesList.slice(1).map(emp => (
                      <option key={emp.id} value={emp.id}>{isRtl ? emp.nameAr : emp.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* Service Drop */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{isRtl ? 'الخدمة' : 'Service'}</label>
                  <select
                    value={draftSelectedService}
                    onChange={(e) => setDraftSelectedService(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
                  >
                    <option value="all">✨ {isRtl ? 'كل الخدمات' : 'All Services'}</option>
                    {serviceCategories.slice(1).map(cat => (
                      <option key={cat.id} value={cat.id}>{isRtl ? cat.nameAr : cat.nameEn}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Drop */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <select
                    value={draftSelectedPaymentMethod}
                    onChange={(e) => setDraftSelectedPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-amber-400"
                  >
                    {paymentMethodOptions.map(m => (
                      <option key={m.id} value={m.id}>{isRtl ? m.nameAr : m.nameEn}</option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    // Reset
                    setDraftSearchTerm('');
                    setDraftSelectedEmployee('all');
                    setDraftSelectedService('all');
                    setDraftSelectedPaymentMethod('all');
                    setDraftDateRange('last_30_days');
                    setDraftCustomDateFrom('');
                    setDraftCustomDateTo('');
                    setDraftSavedPreset('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  {isRtl ? 'إعادة ضبط' : 'Reset'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsFilterDrawerOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isRtl ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={() => {
                      setSearchTerm(draftSearchTerm);
                      setSelectedEmployee(draftSelectedEmployee);
                      setSelectedService(draftSelectedService);
                      setSelectedPaymentMethod(draftSelectedPaymentMethod);
                      setDateRange(draftDateRange);
                      setCustomDateFrom(draftCustomDateFrom);
                      setCustomDateTo(draftCustomDateTo);
                      
                      // Process Preset selection as the original did
                      if (draftSavedPreset === 'end_of_day') {
                        setDateRange('today');
                        setSelectedEmployee('all');
                        setSelectedService('all');
                      } else if (draftSavedPreset === 'monthly_sales') {
                        setDateRange('this_month');
                        setSelectedEmployee('all');
                        setSelectedService('all');
                      } else if (draftSavedPreset === 'staff_performance') {
                        setDateRange('last_30_days');
                        setSelectedService('all');
                      }

                      setCurrentPage(1);
                      setIsFilterDrawerOpen(false);
                    }}
                    className="px-6 py-2 text-xs font-black text-white bg-amber-500 rounded-lg shadow-sm hover:bg-amber-600 hover:shadow transition-all cursor-pointer"
                  >
                    {isRtl ? 'تطبيق' : 'Apply'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
`;

if (content.includes(endOfComponentMarker)) {
    content = content.replace(endOfComponentMarker, drawerUI + endOfComponentMarker);
} else {
    // If it doesn't match EXACTLY, find the last \`</div>\`
    const lastIndex = content.lastIndexOf('</div>');
    const veryLastIndex = content.lastIndexOf('</div>', lastIndex - 1);
    content = content.substring(0, veryLastIndex) + drawerUI + content.substring(veryLastIndex);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched ReportsWorkspace.tsx part 2');
