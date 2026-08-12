const fs = require('fs');

const filePath = 'src/components/AppointmentWorkspace.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  "import { emitBIReportRefresh } from '../lib/bi/refreshSignals';",
  "import { emitBIReportRefresh } from '../lib/bi/refreshSignals';\nimport { calculateNearestValidChain, ChainResult } from '../utils/bookingChains';"
);

// 2. Add state variable
content = content.replace(
  "const [stagedServices, setStagedServices] = useState<StagedService[]>([]);",
  `const [stagedServices, setStagedServices] = useState<StagedService[]>([]);
  const [chainConflictDialog, setChainConflictDialog] = useState<{
    proposedChain: ChainResult;
    originalStaged: StagedService[];
    onConfirm: (chain: ChainResult) => void;
    onCancel: () => void;
  } | null>(null);`
);

// 3. Render Modal
content = content.replace(
  "{/* Render Roster / Employee Weekly Schedule Editor Modal */}",
  `{/* Multi-Service Chained Booking Confirmation Modal */}
      <AnimatePresence>
        {chainConflictDialog && (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4 text-amber-600">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-lg font-bold">
                  {isRtl ? 'تعديل جدول الحجز المتسلسل' : 'Chained Booking Schedule Adjustment'}
                </h3>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                {isRtl 
                  ? 'تعذر توفير الأخصائيات والأوقات المطلوبة بالضبط لهذه السلسلة من الخدمات. النظام يقترح السلسلة المتوفرة التالية للحفاظ على استمرارية رحلة العميل:'
                  : 'The requested staff and times are not perfectly available for this chain of services. The system proposes the following valid sequence to maintain a continuous journey:'}
              </p>
              
              <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {chainConflictDialog.proposedChain.chain.map((slot, index) => {
                  const srv = liveServices.find(s => s.id === slot.serviceId);
                  const st = liveStylists.find(s => s.id === slot.staffId);
                  return (
                    <div key={index} className="flex flex-col gap-1 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                      <div className="font-semibold text-slate-800">{isRtl ? srv?.nameAr : srv?.nameEn}</div>
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> {formatMinutesToTime(slot.startTime)}</span>
                        <span className="flex items-center gap-1"><User className="w-3.5 h-3.5"/> {isRtl ? st?.nameAr : st?.nameEn}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={chainConflictDialog.onCancel}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={() => chainConflictDialog.onConfirm(chainConflictDialog.proposedChain)}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  {isRtl ? 'تأكيد الحجز بهذا الاقتراح' : 'Confirm with Proposed Times'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Render Roster / Employee Weekly Schedule Editor Modal */}`
);

// 4. Modify handleConfirmAppointmentCreation
const targetStr = `    void (async () => {
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
          items: payloadItems,
          staffId: resolvedPrimaryStaffId,
          startTime: buildIsoFromMinutes(getSelectedDateKey(), earliestStartTime),
          notes: sessionNotes || finalStaged.map(s => s.notes).filter(Boolean).join(' | '),
          assignmentMode: 'tenant_reassigned',
          notifyCustomer: true,
          skipAdvanceValidation: shouldSkipAdvanceValidation(getSelectedDateKey(), earliestStartTime),
          // paymentMethod: 'at-center',
          // paymentAllocations: undefined,
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
          \`تم إدراج الموعد الجديد لـ \${custNameAr} بنجاح على مخطط لوحة التشغيل! 🗓️\`,
          \`Successfully scheduled new appointment for \${custNameEn}! 🗓️\`,
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
    })();`;

const replacement = `    const executeCreation = async (stagedItemsToCreate: StagedService[]) => {
      try {
        const payloadItemsToCreate = stagedItemsToCreate.map((item) => {
          const resolvedServiceId = \`\${item.serviceId || ''}\`.trim();
          const srv = liveServices.find(s => s.id === resolvedServiceId);
          return {
            serviceId: resolvedServiceId,
            staffId: item.staffId,
            requestedStaffId: item.staffId,
            startTime: buildIsoFromMinutes(getSelectedDateKey(), item.startTime),
            notes: item.notes || sessionNotes || null,
            paymentMethod: 'at-center',
            assignmentMode: item.staffId ? 'tenant_reassigned' : 'auto_assigned',
            duration: item.duration || srv?.duration || 60,
            discountType: item.discountType,
            discountValue: item.discountValue,
            serviceName: isRtl ? (srv?.nameAr || srv?.name || '') : (srv?.nameEn || srv?.name || '')
          };
        });

        const resolvedPrimaryStaffIdToCreate = \`\${stagedItemsToCreate[0].staffId || currentStaffId || ''}\`.trim();
        const earliestStartTimeToCreate = stagedItemsToCreate[0].startTime;

        const calculateStagedServiceTotal = () => stagedItemsToCreate.reduce((sum, item) => {
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
        
        const response = await tenantApiAdapter.createAppointment({
          items: payloadItemsToCreate,
          staffId: resolvedPrimaryStaffIdToCreate,
          startTime: buildIsoFromMinutes(getSelectedDateKey(), earliestStartTimeToCreate),
          notes: sessionNotes || stagedItemsToCreate.map(s => s.notes).filter(Boolean).join(' | '),
          assignmentMode: 'tenant_reassigned',
          notifyCustomer: true,
          skipAdvanceValidation: shouldSkipAdvanceValidation(getSelectedDateKey(), earliestStartTimeToCreate),
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
          \`تم إدراج الموعد الجديد لـ \${custNameAr} بنجاح على مخطط لوحة التشغيل! 🗓️\`,
          \`Successfully scheduled new appointment for \${custNameEn}! 🗓️\`,
          'success'
        );
      } catch (err: any) {
        console.error('Failed to create appointment', err);
        const errMsg = \`\${err?.message || err || ''}\`.toLowerCase();
        if (errMsg.includes('conflict') || errMsg.includes('not available')) {
            if (stagedItemsToCreate.length > 1) {
                await runChainedBookingCheck(stagedItemsToCreate, true);
                return;
            }
        }
        addLocalToast(
          'تعذر إنشاء الموعد الجديد',
          'Failed to create appointment',
          'warning'
        );
      }
    };

    const runChainedBookingCheck = async (stagedItems: StagedService[], isRetry: boolean = false) => {
        try {
            const dateIso = buildIsoFromMinutes(getSelectedDateKey(), earliestStartTime).split('T')[0];
            const requestedSequence = stagedItems.map(item => ({
                serviceId: item.serviceId,
                staffId: item.staffId || undefined,
                duration: item.duration || 60
            }));
            
            const allAvailabilities = [];
            for (const req of requestedSequence) {
                const availResponse = await tenantApiAdapter.searchAvailability({
                    serviceId: req.serviceId,
                    staffId: req.staffId,
                    date: dateIso
                });
                allAvailabilities.push(availResponse?.slots || []);
            }
            
            const solverResult = calculateNearestValidChain({
                requestedSequence,
                availableSlotsByService: allAvailabilities,
                targetStartTime: earliestStartTime
            });
            
            if (!solverResult.found) {
                addLocalToast('لا توجد مواعيد متاحة لهذه السلسلة من الخدمات', 'No available slots for this sequence of services', 'warning');
                return;
            }
            
            let isPerfectMatch = solverResult.chain[0].startTime === earliestStartTime;
            if (isPerfectMatch) {
                for (let i = 0; i < stagedItems.length; i++) {
                    const reqStaff = stagedItems[i].staffId;
                    const assignedStaff = solverResult.chain[i].staffId;
                    if (reqStaff && reqStaff !== assignedStaff) {
                        isPerfectMatch = false;
                        break;
                    }
                }
            }
            
            if (!isPerfectMatch || isRetry) {
                setChainConflictDialog({
                    proposedChain: solverResult,
                    originalStaged: stagedItems,
                    onConfirm: (chain) => {
                        setChainConflictDialog(null);
                        const updatedStaged = stagedItems.map((s, idx) => ({
                            ...s,
                            staffId: chain.chain[idx].staffId,
                            startTime: chain.chain[idx].startTime
                        }));
                        executeCreation(updatedStaged);
                    },
                    onCancel: () => {
                        setChainConflictDialog(null);
                    }
                });
                return;
            } else {
                const finalStagedToCreate = stagedItems.map((s, idx) => ({
                    ...s,
                    staffId: solverResult.chain[idx].staffId,
                    startTime: solverResult.chain[idx].startTime
                }));
                await executeCreation(finalStagedToCreate);
            }
        } catch (err) {
            console.error('Failed to run availability search', err);
            addLocalToast('خطأ أثناء البحث عن المواعيد', 'Failed to search for appointments', 'warning');
        }
    };

    void (async () => {
        if (finalStaged.length > 1) {
            await runChainedBookingCheck(finalStaged, false);
        } else {
            await executeCreation(finalStaged);
        }
    })();`;

content = content.replace(targetStr, replacement);
fs.writeFileSync(filePath, content, 'utf8');
