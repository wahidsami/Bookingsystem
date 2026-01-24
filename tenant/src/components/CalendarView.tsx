"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partially_refunded';
  price: number;
  notes?: string;
  service: {
    id: string;
    name_en: string;
    name_ar: string;
    duration: number;
  };
  staff: {
    id: string;
    name: string;
    photo?: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    photo?: string;
  };
}

interface CalendarViewProps {
  appointments: Appointment[];
  employees: Array<{ id: string; name: string; photo?: string }>;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  locale: string;
  isRTL: boolean;
  t: (key: string) => string;
}

// Time configuration
const START_HOUR = 6; // 6 AM
const END_HOUR = 22; // 10 PM
const MINUTES_PER_SLOT = 30; // 30-minute intervals
const PIXELS_PER_HOUR = 60; // 60px per hour
const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60; // 1px per minute

export function CalendarView({
  appointments,
  employees,
  selectedDate,
  onDateChange,
  locale,
  isRTL,
  t
}: CalendarViewProps) {
  const router = useRouter();
  const params = useParams();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [visibleStaffIds, setVisibleStaffIds] = useState<Set<string>>(
    new Set(employees.map(emp => emp.id))
  );

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Filter appointments for selected date
  // Use local date comparison to avoid timezone issues
  const dayAppointments = useMemo(() => {
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startTime);
      const aptYear = aptDate.getFullYear();
      const aptMonth = aptDate.getMonth();
      const aptDay = aptDate.getDate();
      
      return aptYear === selectedYear && 
             aptMonth === selectedMonth && 
             aptDay === selectedDay;
    });
  }, [appointments, selectedDate]);

  // Filter visible staff
  const visibleStaff = useMemo(() => {
    return employees.filter(emp => visibleStaffIds.has(emp.id));
  }, [employees, visibleStaffIds]);

  // Generate time slots
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      for (let minute = 0; minute < 60; minute += MINUTES_PER_SLOT) {
        slots.push({
          hour,
          minute,
          label: formatTime(hour, minute, locale),
          position: (hour - START_HOUR) * PIXELS_PER_HOUR + minute * PIXELS_PER_MINUTE
        });
      }
    }
    return slots;
  }, [locale]);

  // Calculate appointment position and height
  const getAppointmentStyle = (appointment: Appointment) => {
    const start = new Date(appointment.startTime);
    const end = new Date(appointment.endTime);
    
    const startHour = start.getHours();
    const startMinute = start.getMinutes();
    const endHour = end.getHours();
    const endMinute = end.getMinutes();

    // Check if appointment is on selected date (using local date comparison)
    const aptYear = start.getFullYear();
    const aptMonth = start.getMonth();
    const aptDay = start.getDate();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    
    if (aptYear !== selectedYear || aptMonth !== selectedMonth || aptDay !== selectedDay) {
      return { display: 'none' };
    }

    const top = (startHour - START_HOUR) * PIXELS_PER_HOUR + startMinute * PIXELS_PER_MINUTE;
    const duration = (endHour - startHour) * 60 + (endMinute - startMinute);
    const height = duration * PIXELS_PER_MINUTE;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 40)}px`, // Minimum 40px height
      position: 'absolute' as const,
      width: 'calc(100% - 8px)',
      left: '4px',
      right: '4px'
    };
  };

  // Get appointment color based on status
  const getAppointmentColor = (appointment: Appointment) => {
    switch (appointment.status) {
      case 'confirmed':
        return 'bg-purple-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      case 'no_show':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    // Compare local dates
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDay = now.getDate();
    
    if (selectedYear !== nowYear || selectedMonth !== nowMonth || selectedDay !== nowDay) {
      return null; // Don't show current time line if not today
    }

    const hour = now.getHours();
    const minute = now.getMinutes();
    const position = (hour - START_HOUR) * PIXELS_PER_HOUR + minute * PIXELS_PER_MINUTE;

    if (hour < START_HOUR || hour >= END_HOUR) {
      return null; // Outside visible range
    }

    return position;
  };

  // Date navigation
  const goToToday = () => {
    onDateChange(new Date());
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const isToday = () => {
    const today = new Date();
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = selectedDate.getMonth();
    const selectedDay = selectedDate.getDate();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDay = today.getDate();
    
    return selectedYear === todayYear && 
           selectedMonth === todayMonth && 
           selectedDay === todayDay;
  };

  // Toggle staff visibility
  const toggleStaffVisibility = (staffId: string) => {
    setVisibleStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const handleAppointmentClick = (appointmentId: string) => {
    router.push(`/${params.locale}/dashboard/appointments/${appointmentId}`);
  };

  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR;
  const currentTimePosition = getCurrentTimePosition();

  return (
    <div className="space-y-4">
      {/* Date Navigation */}
      <div className={`flex flex-col md:flex-row items-start md:items-center justify-between bg-white rounded-lg p-4 shadow-sm gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors text-sm ${
              isToday()
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('today')}
          </button>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              onClick={goToPreviousDay}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
              </svg>
            </button>
            <div className="px-4 py-2 font-semibold text-gray-900 min-w-[120px] text-center text-sm md:text-base">
              {formatDate(selectedDate, locale)}
            </div>
            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRTL ? "M15 19l-7-7-7 7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Staff Filter */}
        <div className={`flex flex-col md:flex-row items-start md:items-center gap-2 w-full md:w-auto ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <span className="text-sm text-gray-600 whitespace-nowrap">{t('scheduledTeam')}:</span>
          <div className="flex flex-wrap gap-2">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => toggleStaffVisibility(emp.id)}
                className={`px-3 py-1 rounded-lg text-xs md:text-sm transition-colors ${
                  visibleStaffIds.has(emp.id)
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
                title={emp.name}
              >
                {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full">
            {/* Time Column */}
            <div className="flex-shrink-0 w-16 md:w-20 border-r border-gray-200 sticky left-0 z-20 bg-white">
              <div className="h-24 md:h-20 border-b border-gray-200 bg-gray-50"></div>
              <div className="relative" style={{ height: `${totalHeight}px` }}>
                {timeSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="absolute text-xs text-gray-500 px-1 md:px-2 z-10 bg-white"
                    style={{ top: `${slot.position}px`, transform: 'translateY(-50%)' }}
                  >
                    {slot.label}
                  </div>
                ))}
                {/* Dotted lines for each time slot */}
                {timeSlots.map((slot, index) => (
                  <div
                    key={`line-${index}`}
                    className="absolute left-0 right-0 border-t border-dotted border-gray-300"
                    style={{ top: `${slot.position}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Staff Columns */}
            {visibleStaff.length === 0 ? (
              <div className="flex-1 p-8 text-center text-gray-500">
                {t('noStaffSelected')}
              </div>
            ) : (
              visibleStaff.map(staff => {
                const staffAppointments = dayAppointments.filter(
                  apt => apt.staff.id === staff.id
                );

                return (
                  <div
                    key={staff.id}
                    className="flex-shrink-0 border-r border-gray-200"
                    style={{ minWidth: '180px', width: '180px' }}
                  >
                    {/* Staff Header */}
                    <div className="h-24 md:h-20 border-b border-gray-200 bg-gray-50 p-2 md:p-3 flex flex-col items-center justify-center">
                      <div className="flex-shrink-0 mb-1.5 relative">
                        {staff.photo ? (
                          <>
                            <img
                              src={staff.photo.startsWith('/') ? `http://localhost:5000${staff.photo}` : `http://localhost:5000/uploads/${staff.photo}`}
                              alt={staff.name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center border-2 border-white shadow-sm hidden">
                              <span className="text-primary font-semibold text-xs">
                                {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white shadow-sm">
                            <span className="text-primary font-semibold text-xs">
                              {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-gray-900 text-center px-1 w-full flex items-center justify-center" style={{ 
                        minHeight: '2.5rem',
                        lineHeight: '1.3'
                      }} title={staff.name}>
                        <div className="break-words" style={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          hyphens: 'auto',
                          textOverflow: 'ellipsis'
                        }}>
                          {staff.name}
                        </div>
                      </div>
                    </div>

                    {/* Appointments Column */}
                    <div className="relative" style={{ height: `${totalHeight}px` }}>
                      {/* Dotted lines for each time slot (extend into columns) */}
                      {timeSlots.map((slot, index) => (
                        <div
                          key={`column-line-${index}`}
                          className="absolute left-0 right-0 border-t border-dotted border-gray-200 pointer-events-none"
                          style={{ top: `${slot.position}px` }}
                        />
                      ))}

                      {/* Current Time Indicator */}
                      {currentTimePosition !== null && (
                        <div
                          className="absolute left-0 right-0 z-10 pointer-events-none"
                          style={{ top: `${currentTimePosition}px` }}
                        >
                          <div className="h-0.5 bg-red-500 relative">
                            <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full"></div>
                          </div>
                        </div>
                      )}

                      {/* Appointment Blocks */}
                      {staffAppointments.map(appointment => {
                        const userName = appointment.user
                          ? `${appointment.user.firstName} ${appointment.user.lastName}`.trim()
                          : t('unknownCustomer');
                        const serviceName = locale === 'ar' 
                          ? appointment.service.name_ar 
                          : appointment.service.name_en;
                        const startTime = new Date(appointment.startTime);
                        const endTime = new Date(appointment.endTime);
                        const timeLabel = `${formatTime(startTime.getHours(), startTime.getMinutes(), locale)} - ${formatTime(endTime.getHours(), endTime.getMinutes(), locale)}`;

                        const style = getAppointmentStyle(appointment);
                        const minHeight = Math.max(parseFloat(style.height as string), 60);
                        const userInitials = appointment.user
                          ? `${appointment.user.firstName?.[0] || ''}${appointment.user.lastName?.[0] || ''}`.toUpperCase() || '?'
                          : '?';
                        
                        // Debug: Log user photo data (remove in production)
                        if (appointment.user && process.env.NODE_ENV === 'development') {
                          const photoValue = appointment.user.photo;
                          console.log(`[DEBUG] User: ${userName}`);
                          console.log(`[DEBUG] Photo value:`, photoValue);
                          console.log(`[DEBUG] Photo type:`, typeof photoValue);
                          console.log(`[DEBUG] Has photo:`, !!photoValue);
                          if (photoValue) {
                            const photoPath = photoValue.startsWith('/') 
                              ? `http://localhost:5000${photoValue}` 
                              : `http://localhost:5000/uploads/${photoValue}`;
                            console.log(`[DEBUG] Photo URL:`, photoPath);
                          } else {
                            console.log(`[DEBUG] No photo value for ${userName}`);
                          }
                        }
                        
                        return (
                          <div
                            key={appointment.id}
                            onClick={() => handleAppointmentClick(appointment.id)}
                            className={`${getAppointmentColor(appointment)} text-white rounded-lg cursor-pointer hover:opacity-90 transition-all shadow-md hover:shadow-lg overflow-hidden border border-white/20`}
                            style={{ ...style, height: `${minHeight}px` }}
                            title={`${userName} - ${serviceName} - ${timeLabel}`}
                          >
                            <div className="p-2 h-full flex flex-col">
                              {/* User Avatar and Name Row */}
                              <div className="flex items-center gap-2 mb-1.5 flex-shrink-0">
                                <div className="relative flex-shrink-0 w-6 h-6">
                                  {(() => {
                                    const userPhoto = appointment.user?.photo;
                                    const hasValidPhoto = userPhoto && typeof userPhoto === 'string' && userPhoto.trim() !== '';
                                    
                                    if (!hasValidPhoto && process.env.NODE_ENV === 'development') {
                                      console.log(`[AVATAR] No valid photo for ${userName}, using initials. Photo value:`, userPhoto);
                                    }
                                    
                                    if (hasValidPhoto) {
                                      const photoUrl = userPhoto.startsWith('/') 
                                        ? `http://localhost:5000${userPhoto}` 
                                        : `http://localhost:5000/uploads/${userPhoto}`;
                                      
                                      return (
                                        <>
                                          <img
                                            src={photoUrl}
                                            alt={userName}
                                            className="w-6 h-6 rounded-full object-cover border border-white/30 relative z-10"
                                            onError={(e) => {
                                              console.error(`[AVATAR ERROR] Failed to load avatar for ${userName} from:`, photoUrl);
                                              const img = e.currentTarget;
                                              img.style.display = 'none';
                                              const fallback = img.parentElement?.querySelector('.avatar-fallback') as HTMLElement;
                                              if (fallback) {
                                                fallback.style.display = 'flex';
                                              }
                                            }}
                                            onLoad={() => {
                                              console.log(`[AVATAR SUCCESS] Avatar loaded for ${userName}`);
                                            }}
                                          />
                                          <div 
                                            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30 hidden avatar-fallback absolute inset-0"
                                            data-appointment-id={appointment.id}
                                          >
                                            <span className="text-xs font-semibold">{userInitials}</span>
                                          </div>
                                        </>
                                      );
                                    } else {
                                      return (
                                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center border border-white/30">
                                          <span className="text-xs font-semibold">{userInitials}</span>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold truncate leading-tight">{userName}</div>
                                </div>
                              </div>

                              {/* Service Name */}
                              <div className="text-xs font-medium opacity-95 truncate leading-tight mb-1">
                                {serviceName}
                              </div>

                              {/* Time Range */}
                              <div className="text-xs opacity-80 leading-tight flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {timeLabel}
                              </div>

                              {/* Notes (if available and space permits) */}
                              {appointment.notes && minHeight > 80 && (
                                <div className="text-xs opacity-75 mt-1.5 flex items-start gap-1 leading-tight">
                                  <span>💬</span>
                                  <span className="line-clamp-2">{appointment.notes}</span>
                                </div>
                              )}

                              {/* Status indicator dot */}
                              <div className="mt-auto pt-1 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-white/60"></div>
                                <span className="text-xs opacity-75 capitalize">{appointment.status}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatTime(hour: number, minute: number, locale: string): string {
  const date = new Date();
  date.setHours(hour, minute, 0);
  return date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}
