"use client";

import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { tenantApi } from "@/lib/api";
// import { useTranslations } from "next-intl"; // Not used for now
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  CalendarIcon, 
  ClockIcon, 
  PauseIcon, 
  NoSymbolIcon, 
  ExclamationCircleIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon 
} from "@heroicons/react/24/outline";

interface Employee {
  id: string;
  name: string;
  isActive: boolean;
}

interface Shift {
  id: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  startDate: string | null;
  endDate: string | null;
  label: string | null;
  isActive: boolean;
}

interface Break {
  id: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  type: 'lunch' | 'prayer' | 'cleaning' | 'other';
  label: string | null;
  isRecurring: boolean;
  isActive: boolean;
}

interface TimeOff {
  id: string;
  startDate: string;
  endDate: string;
  type: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
  reason: string | null;
  isApproved: boolean;
}

interface Override {
  id: string;
  date: string;
  type: 'override' | 'exception';
  startTime: string | null;
  endTime: string | null;
  isAvailable: boolean;
  reason: string | null;
}

type TabType = 'shifts' | 'breaks' | 'timeoff' | 'overrides';

export default function SchedulesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'ar';
  const isRTL = locale === 'ar';

  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('shifts');
  
  // Data states
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  
  // Modal states
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadScheduleData();
    }
  }, [selectedEmployeeId, activeTab]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await tenantApi.getEmployees({ isActive: true });
      // Backend returns { success: true, employees: [...], count: N }
      const employeesList = response.employees || response.data?.employees || [];
      if (response.success && employeesList.length > 0) {
        setEmployees(employeesList);
        if (!selectedEmployeeId) {
          setSelectedEmployeeId(employeesList[0].id);
        }
      } else if (response.success && employeesList.length === 0) {
        // No employees found, but request was successful
        setEmployees([]);
      }
    } catch (err: any) {
      console.error("Failed to load employees:", err);
      alert(err.message || "Failed to load employees. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const loadScheduleData = async () => {
    if (!selectedEmployeeId) return;

    try {
      switch (activeTab) {
        case 'shifts':
          const shiftsRes = await tenantApi.getEmployeeShifts(selectedEmployeeId);
          const shiftsList = shiftsRes.shifts || shiftsRes.data?.shifts || [];
          setShifts(shiftsList);
          break;
        case 'breaks':
          const breaksRes = await tenantApi.getEmployeeBreaks(selectedEmployeeId);
          const breaksList = breaksRes.breaks || breaksRes.data?.breaks || [];
          setBreaks(breaksList);
          break;
        case 'timeoff':
          const timeOffRes = await tenantApi.getEmployeeTimeOff(selectedEmployeeId);
          const timeOffList = timeOffRes.timeOff || timeOffRes.data?.timeOff || [];
          setTimeOff(timeOffList);
          break;
        case 'overrides':
          const overridesRes = await tenantApi.getEmployeeOverrides(selectedEmployeeId);
          const overridesList = overridesRes.overrides || overridesRes.data?.overrides || [];
          setOverrides(overridesList);
          break;
      }
    } catch (err: any) {
      // Silently handle errors - set empty arrays instead of showing alerts
      // This provides a better UX when data doesn't exist yet
      console.warn(`No data available for ${activeTab}:`, err.message);
      switch (activeTab) {
        case 'shifts':
          setShifts([]);
          break;
        case 'breaks':
          setBreaks([]);
          break;
        case 'timeoff':
          setTimeOff([]);
          break;
        case 'overrides':
          setOverrides([]);
          break;
      }
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!selectedEmployeeId) return;
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذا الوردية؟' : 'Are you sure you want to delete this shift?')) return;

    try {
      const response = await tenantApi.deleteEmployeeShift(selectedEmployeeId, shiftId);
      if (response.success) {
        loadScheduleData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete shift');
    }
  };

  const handleDeleteBreak = async (breakId: string) => {
    if (!selectedEmployeeId) return;
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذا الاستراحة؟' : 'Are you sure you want to delete this break?')) return;

    try {
      const response = await tenantApi.deleteEmployeeBreak(selectedEmployeeId, breakId);
      if (response.success) {
        loadScheduleData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete break');
    }
  };

  const handleDeleteTimeOff = async (timeOffId: string) => {
    if (!selectedEmployeeId) return;
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذا الإجازة؟' : 'Are you sure you want to delete this time off?')) return;

    try {
      const response = await tenantApi.deleteEmployeeTimeOff(selectedEmployeeId, timeOffId);
      if (response.success) {
        loadScheduleData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete time off');
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    if (!selectedEmployeeId) return;
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذا الاستثناء؟' : 'Are you sure you want to delete this override?')) return;

    try {
      const response = await tenantApi.deleteEmployeeOverride(selectedEmployeeId, overrideId);
      if (response.success) {
        loadScheduleData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete override');
    }
  };

  const dayNames = locale === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  return (
    <TenantLayout>
      <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {locale === 'ar' ? 'إدارة الجداول' : 'Schedule Management'}
            </h1>
            <p className="text-gray-600">
              {locale === 'ar' 
                ? 'إدارة جداول الموظفين، الاستراحات، الإجازات، والاستثناءات'
                : 'Manage employee schedules, breaks, time off, and exceptions'}
            </p>
          </div>
        </div>

        {/* Employee Selector */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {locale === 'ar' ? 'اختر الموظف' : 'Select Employee'}
          </label>
          <select
            value={selectedEmployeeId || ''}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">{locale === 'ar' ? '-- اختر موظف --' : '-- Select Employee --'}</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {selectedEmployeeId && (
          <>
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className={`flex ${isRTL ? 'flex-row-reverse' : ''} -mb-px`}>
                <button
                  onClick={() => setActiveTab('shifts')}
                  className={`px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === 'shifts'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ClockIcon className="w-4 h-4 inline mr-2" />
                  {locale === 'ar' ? 'الورديات' : 'Shifts'}
                </button>
                <button
                  onClick={() => setActiveTab('breaks')}
                  className={`px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === 'breaks'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <PauseIcon className="w-4 h-4 inline mr-2" />
                  {locale === 'ar' ? 'الاستراحات' : 'Breaks'}
                </button>
                <button
                  onClick={() => setActiveTab('timeoff')}
                  className={`px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === 'timeoff'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <NoSymbolIcon className="w-4 h-4 inline mr-2" />
                  {locale === 'ar' ? 'الإجازات' : 'Time Off'}
                </button>
                <button
                  onClick={() => setActiveTab('overrides')}
                  className={`px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === 'overrides'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <ExclamationCircleIcon className="w-4 h-4 inline mr-2" />
                  {locale === 'ar' ? 'الاستثناءات' : 'Overrides'}
                </button>
              </nav>
            </div>

            {/* Content */}
            <div className="card">
              {activeTab === 'shifts' && (
                <ShiftsTab
                  shifts={shifts}
                  employeeName={selectedEmployee?.name || ''}
                  onAdd={() => { setEditingItem(null); setShowShiftModal(true); }}
                  onEdit={(shift) => { setEditingItem(shift); setShowShiftModal(true); }}
                  onDelete={handleDeleteShift}
                  onRefresh={loadScheduleData}
                  locale={locale}
                  isRTL={isRTL}
                />
              )}

              {activeTab === 'breaks' && (
                <BreaksTab
                  breaks={breaks}
                  employeeName={selectedEmployee?.name || ''}
                  onAdd={() => { setEditingItem(null); setShowBreakModal(true); }}
                  onEdit={(breakItem) => { setEditingItem(breakItem); setShowBreakModal(true); }}
                  onDelete={handleDeleteBreak}
                  onRefresh={loadScheduleData}
                  locale={locale}
                  isRTL={isRTL}
                />
              )}

              {activeTab === 'timeoff' && (
                <TimeOffTab
                  timeOff={timeOff}
                  employeeName={selectedEmployee?.name || ''}
                  onAdd={() => { setEditingItem(null); setShowTimeOffModal(true); }}
                  onEdit={(item) => { setEditingItem(item); setShowTimeOffModal(true); }}
                  onDelete={handleDeleteTimeOff}
                  onRefresh={loadScheduleData}
                  locale={locale}
                  isRTL={isRTL}
                />
              )}

              {activeTab === 'overrides' && (
                <OverridesTab
                  overrides={overrides}
                  employeeName={selectedEmployee?.name || ''}
                  onAdd={() => { setEditingItem(null); setShowOverrideModal(true); }}
                  onEdit={(override) => { setEditingItem(override); setShowOverrideModal(true); }}
                  onDelete={handleDeleteOverride}
                  onRefresh={loadScheduleData}
                  locale={locale}
                  isRTL={isRTL}
                />
              )}
            </div>
          </>
        )}

        {/* Modals */}
        {showShiftModal && selectedEmployeeId && (
          <ShiftModal
            employeeId={selectedEmployeeId}
            employeeName={selectedEmployee?.name || ''}
            shift={editingItem}
            onClose={() => { setShowShiftModal(false); setEditingItem(null); }}
            onSave={() => { setShowShiftModal(false); setEditingItem(null); loadScheduleData(); }}
            locale={locale}
            isRTL={isRTL}
          />
        )}

        {showBreakModal && selectedEmployeeId && (
          <BreakModal
            employeeId={selectedEmployeeId}
            employeeName={selectedEmployee?.name || ''}
            breakItem={editingItem}
            onClose={() => { setShowBreakModal(false); setEditingItem(null); }}
            onSave={() => { setShowBreakModal(false); setEditingItem(null); loadScheduleData(); }}
            locale={locale}
            isRTL={isRTL}
          />
        )}

        {showTimeOffModal && selectedEmployeeId && (
          <TimeOffModal
            employeeId={selectedEmployeeId}
            employeeName={selectedEmployee?.name || ''}
            timeOff={editingItem}
            onClose={() => { setShowTimeOffModal(false); setEditingItem(null); }}
            onSave={() => { setShowTimeOffModal(false); setEditingItem(null); loadScheduleData(); }}
            locale={locale}
            isRTL={isRTL}
          />
        )}

        {showOverrideModal && selectedEmployeeId && (
          <OverrideModal
            employeeId={selectedEmployeeId}
            employeeName={selectedEmployee?.name || ''}
            override={editingItem}
            onClose={() => { setShowOverrideModal(false); setEditingItem(null); }}
            onSave={() => { setShowOverrideModal(false); setEditingItem(null); loadScheduleData(); }}
            locale={locale}
            isRTL={isRTL}
          />
        )}
      </div>
    </TenantLayout>
  );
}

// Shifts Tab Component
function ShiftsTab({ shifts, employeeName, onAdd, onEdit, onDelete, locale, isRTL }: any) {
  const dayNames = locale === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const recurringShifts = shifts.filter((s: Shift) => s.isRecurring);
  const oneTimeShifts = shifts.filter((s: Shift) => !s.isRecurring);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {locale === 'ar' ? `ورديات ${employeeName}` : `${employeeName}'s Shifts`}
        </h2>
        <button
          onClick={onAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {locale === 'ar' ? 'إضافة وردية' : 'Add Shift'}
        </button>
      </div>

      {recurringShifts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">{locale === 'ar' ? 'الورديات الدورية' : 'Recurring Shifts'}</h3>
          <div className="space-y-3">
            {recurringShifts.map((shift: Shift) => (
              <div key={shift.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {shift.dayOfWeek !== null ? dayNames[shift.dayOfWeek] : 'N/A'}
                    {shift.label && ` - ${shift.label}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    {shift.startTime} - {shift.endTime}
                    {shift.startDate && ` (From ${shift.startDate})`}
                    {shift.endDate && ` (Until ${shift.endDate})`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(shift)} className="p-2 text-primary hover:bg-primary/10 rounded">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(shift.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {oneTimeShifts.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">{locale === 'ar' ? 'الورديات المحددة' : 'One-Time Shifts'}</h3>
          <div className="space-y-3">
            {oneTimeShifts.map((shift: Shift) => (
              <div key={shift.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {shift.specificDate || 'N/A'}
                    {shift.label && ` - ${shift.label}`}
                  </div>
                  <div className="text-sm text-gray-600">
                    {shift.startTime} - {shift.endTime}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(shift)} className="p-2 text-primary hover:bg-primary/10 rounded">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(shift.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shifts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-2">
            {locale === 'ar' ? 'لا توجد ورديات' : 'No shifts configured'}
          </div>
          <p className="text-sm text-gray-400">
            {locale === 'ar' 
              ? 'انقر على "إضافة وردية" لبدء إضافة جداول العمل'
              : 'Click "Add Shift" to start adding work schedules'}
          </p>
        </div>
      )}
    </div>
  );
}

// Breaks Tab Component
function BreaksTab({ breaks, employeeName, onAdd, onEdit, onDelete, locale, isRTL }: any) {
  const dayNames = locale === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {locale === 'ar' ? `استراحات ${employeeName}` : `${employeeName}'s Breaks`}
        </h2>
        <button
          onClick={onAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {locale === 'ar' ? 'إضافة استراحة' : 'Add Break'}
        </button>
      </div>

      <div className="space-y-3">
        {breaks.map((breakItem: Break) => (
          <div key={breakItem.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-medium">
                {breakItem.isRecurring && breakItem.dayOfWeek !== null 
                  ? dayNames[breakItem.dayOfWeek]
                  : breakItem.specificDate || 'N/A'}
                {' - '}
                <span className="capitalize">{breakItem.type}</span>
                {breakItem.label && ` (${breakItem.label})`}
              </div>
              <div className="text-sm text-gray-600">
                {breakItem.startTime} - {breakItem.endTime}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(breakItem)} className="p-2 text-primary hover:bg-primary/10 rounded">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(breakItem.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {breaks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {locale === 'ar' ? 'لا توجد استراحات' : 'No breaks configured'}
        </div>
      )}
    </div>
  );
}

// Time Off Tab Component
function TimeOffTab({ timeOff, employeeName, onAdd, onEdit, onDelete, locale, isRTL }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {locale === 'ar' ? `إجازات ${employeeName}` : `${employeeName}'s Time Off`}
        </h2>
        <button
          onClick={onAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {locale === 'ar' ? 'إضافة إجازة' : 'Add Time Off'}
        </button>
      </div>

      <div className="space-y-3">
        {timeOff.map((item: TimeOff) => (
          <div key={item.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-medium capitalize">
                {item.type} - {item.startDate} to {item.endDate}
              </div>
              {item.reason && (
                <div className="text-sm text-gray-600 mt-1">{item.reason}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                {item.isApproved ? (
                  <span className="text-green-600">{locale === 'ar' ? 'موافق عليه' : 'Approved'}</span>
                ) : (
                  <span className="text-yellow-600">{locale === 'ar' ? 'قيد الانتظار' : 'Pending'}</span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(item)} className="p-2 text-primary hover:bg-primary/10 rounded">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {timeOff.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {locale === 'ar' ? 'لا توجد إجازات' : 'No time off records'}
        </div>
      )}
    </div>
  );
}

// Overrides Tab Component
function OverridesTab({ overrides, employeeName, onAdd, onEdit, onDelete, locale, isRTL }: any) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          {locale === 'ar' ? `استثناءات ${employeeName}` : `${employeeName}'s Schedule Overrides`}
        </h2>
        <button
          onClick={onAdd}
          className="btn btn-primary flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {locale === 'ar' ? 'إضافة استثناء' : 'Add Override'}
        </button>
      </div>

      <div className="space-y-3">
        {overrides.map((override: Override) => (
          <div key={override.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
            <div>
              <div className="font-medium">
                {override.date}
                {override.isAvailable ? (
                  override.startTime && override.endTime ? (
                    <span className="text-green-600 ml-2">
                      {override.startTime} - {override.endTime}
                    </span>
                  ) : (
                    <span className="text-green-600 ml-2">{locale === 'ar' ? 'متاح' : 'Available'}</span>
                  )
                ) : (
                  <span className="text-red-600 ml-2">{locale === 'ar' ? 'إجازة' : 'Day Off'}</span>
                )}
              </div>
              {override.reason && (
                <div className="text-sm text-gray-600 mt-1">{override.reason}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(override)} className="p-2 text-primary hover:bg-primary/10 rounded">
                <Edit className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(override.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {overrides.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {locale === 'ar' ? 'لا توجد استثناءات' : 'No overrides configured'}
        </div>
      )}
    </div>
  );
}

// Shift Modal Component
function ShiftModal({ employeeId, employeeName, shift, onClose, onSave, locale, isRTL }: any) {
  const [formData, setFormData] = useState({
    isRecurring: shift?.isRecurring !== false,
    dayOfWeek: shift?.dayOfWeek ?? null,
    specificDate: shift?.specificDate || '',
    startTime: shift?.startTime || '09:00',
    endTime: shift?.endTime || '18:00',
    startDate: shift?.startDate || '',
    endDate: shift?.endDate || '',
    label: shift?.label || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data: any = {
        isRecurring: formData.isRecurring,
        startTime: formData.startTime,
        endTime: formData.endTime,
        label: formData.label || null
      };

      if (formData.isRecurring) {
        data.dayOfWeek = parseInt(formData.dayOfWeek as any) || null;
        data.specificDate = null;
        if (formData.startDate) data.startDate = formData.startDate;
        if (formData.endDate) data.endDate = formData.endDate;
      } else {
        data.dayOfWeek = null;
        data.specificDate = formData.specificDate;
        data.startDate = null;
        data.endDate = null;
      }

      if (shift) {
        await tenantApi.updateEmployeeShift(employeeId, shift.id, data);
      } else {
        await tenantApi.createEmployeeShift(employeeId, data);
      }

      onSave();
    } catch (err: any) {
      alert(err.message || 'Failed to save shift');
    } finally {
      setSaving(false);
    }
  };

  const dayNames = locale === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-2">
          {shift ? (locale === 'ar' ? 'تعديل الوردية' : 'Edit Shift') : (locale === 'ar' ? 'إضافة وردية' : 'Add Shift')}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {locale === 'ar' 
            ? 'حدد نوع الوردية: دورية (تتكرر كل أسبوع) أو لمرة واحدة (تاريخ محدد)'
            : 'Choose shift type: Recurring (repeats weekly) or One-time (specific date)'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="mr-2"
              />
              {locale === 'ar' ? 'وردية دورية (أسبوعية)' : 'Recurring (Weekly)'}
            </label>
          </div>

          {formData.isRecurring ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'يوم الأسبوع' : 'Day of Week'}</label>
                <select
                  value={formData.dayOfWeek ?? ''}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">{locale === 'ar' ? '-- اختر اليوم --' : '-- Select Day --'}</option>
                  {dayNames.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ البدء (اختياري)' : 'Start Date (Optional)'}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'End Date (Optional)'}</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ محدد' : 'Specific Date'}</label>
              <input
                type="date"
                value={formData.specificDate}
                onChange={(e) => setFormData({ ...formData, specificDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت البدء' : 'Start Time'}</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت الانتهاء' : 'End Time'}</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'التسمية (اختياري)' : 'Label (Optional)'}</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder={locale === 'ar' ? 'مثال: وردية صباحية' : 'e.g., Morning Shift'}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Break Modal Component
function BreakModal({ employeeId, employeeName, breakItem, onClose, onSave, locale, isRTL }: any) {
  const [formData, setFormData] = useState({
    isRecurring: breakItem?.isRecurring !== false,
    dayOfWeek: breakItem?.dayOfWeek ?? null,
    specificDate: breakItem?.specificDate || '',
    startTime: breakItem?.startTime || '13:00',
    endTime: breakItem?.endTime || '14:00',
    type: breakItem?.type || 'lunch',
    label: breakItem?.label || '',
    startDate: breakItem?.startDate || '',
    endDate: breakItem?.endDate || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data: any = {
        isRecurring: formData.isRecurring,
        startTime: formData.startTime,
        endTime: formData.endTime,
        type: formData.type,
        label: formData.label || null
      };

      if (formData.isRecurring) {
        data.dayOfWeek = parseInt(formData.dayOfWeek as any) || null;
        data.specificDate = null;
        if (formData.startDate) data.startDate = formData.startDate;
        if (formData.endDate) data.endDate = formData.endDate;
      } else {
        data.dayOfWeek = null;
        data.specificDate = formData.specificDate;
        data.startDate = null;
        data.endDate = null;
      }

      if (breakItem) {
        await tenantApi.updateEmployeeBreak(employeeId, breakItem.id, data);
      } else {
        await tenantApi.createEmployeeBreak(employeeId, data);
      }

      onSave();
    } catch (err: any) {
      alert(err.message || 'Failed to save break');
    } finally {
      setSaving(false);
    }
  };

  const dayNames = locale === 'ar' 
    ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {breakItem ? (locale === 'ar' ? 'تعديل الاستراحة' : 'Edit Break') : (locale === 'ar' ? 'إضافة استراحة' : 'Add Break')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="mr-2"
              />
              {locale === 'ar' ? 'استراحة دورية (أسبوعية)' : 'Recurring (Weekly)'}
            </label>
          </div>

          {formData.isRecurring ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'يوم الأسبوع' : 'Day of Week'}</label>
                <select
                  value={formData.dayOfWeek ?? ''}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">{locale === 'ar' ? '-- اختر اليوم --' : '-- Select Day --'}</option>
                  {dayNames.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ البدء (اختياري)' : 'Start Date (Optional)'}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ الانتهاء (اختياري)' : 'End Date (Optional)'}</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ محدد' : 'Specific Date'}</label>
              <input
                type="date"
                value={formData.specificDate}
                onChange={(e) => setFormData({ ...formData, specificDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'نوع الاستراحة' : 'Break Type'}</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="lunch">{locale === 'ar' ? 'غداء' : 'Lunch'}</option>
              <option value="prayer">{locale === 'ar' ? 'صلاة' : 'Prayer'}</option>
              <option value="cleaning">{locale === 'ar' ? 'تنظيف' : 'Cleaning'}</option>
              <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت البدء' : 'Start Time'}</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت الانتهاء' : 'End Time'}</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'التسمية (اختياري)' : 'Label (Optional)'}</label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder={locale === 'ar' ? 'مثال: استراحة غداء' : 'e.g., Lunch Break'}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Time Off Modal Component
function TimeOffModal({ employeeId, employeeName, timeOff, onClose, onSave, locale, isRTL }: any) {
  const [formData, setFormData] = useState({
    startDate: timeOff?.startDate || '',
    endDate: timeOff?.endDate || '',
    type: timeOff?.type || 'vacation',
    reason: timeOff?.reason || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data = {
        startDate: formData.startDate,
        endDate: formData.endDate,
        type: formData.type,
        reason: formData.reason || null
      };

      if (timeOff) {
        await tenantApi.updateEmployeeTimeOff(employeeId, timeOff.id, data);
      } else {
        await tenantApi.createEmployeeTimeOff(employeeId, data);
      }

      onSave();
    } catch (err: any) {
      alert(err.message || 'Failed to save time off');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {timeOff ? (locale === 'ar' ? 'تعديل الإجازة' : 'Edit Time Off') : (locale === 'ar' ? 'إضافة إجازة' : 'Add Time Off')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'نوع الإجازة' : 'Type'}</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="vacation">{locale === 'ar' ? 'إجازة' : 'Vacation'}</option>
              <option value="sick">{locale === 'ar' ? 'مرض' : 'Sick'}</option>
              <option value="personal">{locale === 'ar' ? 'شخصية' : 'Personal'}</option>
              <option value="training">{locale === 'ar' ? 'تدريب' : 'Training'}</option>
              <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ البدء' : 'Start Date'}</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'السبب (اختياري)' : 'Reason (Optional)'}</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Override Modal Component
function OverrideModal({ employeeId, employeeName, override, onClose, onSave, locale, isRTL }: any) {
  const [formData, setFormData] = useState({
    date: override?.date || '',
    type: override?.type || 'override',
    startTime: override?.startTime || '',
    endTime: override?.endTime || '',
    isAvailable: override?.isAvailable !== false,
    reason: override?.reason || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const data: any = {
        date: formData.date,
        type: formData.type,
        isAvailable: formData.isAvailable,
        reason: formData.reason || null
      };

      if (formData.isAvailable) {
        data.startTime = formData.startTime || null;
        data.endTime = formData.endTime || null;
      } else {
        data.startTime = null;
        data.endTime = null;
      }

      if (override) {
        await tenantApi.updateEmployeeOverride(employeeId, override.id, data);
      } else {
        await tenantApi.createEmployeeOverride(employeeId, data);
      }

      onSave();
    } catch (err: any) {
      alert(err.message || 'Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {override ? (locale === 'ar' ? 'تعديل الاستثناء' : 'Edit Override') : (locale === 'ar' ? 'إضافة استثناء' : 'Add Override')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'التاريخ' : 'Date'}</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                className="mr-2"
              />
              {locale === 'ar' ? 'متاح (إلا إذا كان إجازة)' : 'Available (uncheck for day off)'}
            </label>
          </div>

          {formData.isAvailable && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت البدء' : 'Start Time'}</label>
                <input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'وقت الانتهاء' : 'End Time'}</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">{locale === 'ar' ? 'السبب (اختياري)' : 'Reason (Optional)'}</label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder={locale === 'ar' ? 'مثال: ساعات رمضان' : 'e.g., Ramadan hours'}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

