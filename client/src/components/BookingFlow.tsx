"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, Service, Staff, Tenant } from "@/lib/api";
import { Currency } from "@/components/Currency";
import { useLanguage } from "@/contexts/LanguageContext";
import { PaymentModal } from "@/components/PaymentModal";

interface TimeSlot {
    startTime: string;
    endTime: string;
    available: boolean;
}

interface BookingFlowProps {
    tenantId: string;
    tenant?: Tenant | null;
    serviceId?: string; // Pre-select service
    staffId?: string; // Pre-select staff
    onComplete?: (appointmentId: string, amount: number) => void;
    onCancel?: () => void;
    mode?: 'modal' | 'inline'; // Display mode
}

export function BookingFlow({
    tenantId,
    tenant,
    serviceId,
    staffId,
    onComplete,
    onCancel,
    mode = 'modal'
}: BookingFlowProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { locale, t } = useLanguage();
    const [step, setStep] = useState(serviceId ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Data states
    const [tenantData, setTenantData] = useState<Tenant | null>(tenant || null);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    // Selection states
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);

    // Next available slot state
    const [nextAvailableSlot, setNextAvailableSlot] = useState<{
        slot: TimeSlot;
        date: string;
        daysAhead: number;
    } | null>(null);
    const [showManualTimeSelection, setShowManualTimeSelection] = useState(false);

    // Payment state
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [bookingData, setBookingData] = useState<{
        appointmentId: string;
        amount: number;
        serviceName: string;
        staffName: string;
        dateTime: string;
    } | null>(null);

    // Load tenant data on mount
    useEffect(() => {
        if (tenantId) {
            loadTenantData();
        }
    }, [tenantId]);

    // Auto-select service from props
    useEffect(() => {
        if (serviceId && services.length > 0 && !selectedService) {
            const service = services.find(s => s.id === serviceId);
            if (service) {
                setSelectedService(service);
                fetchStaff(service.id);
            }
        }
    }, [serviceId, services, selectedService]);

    // Fetch time slots when date/staff/service changes
    useEffect(() => {
        if (selectedDate && selectedStaff && selectedService) {
            fetchTimeSlots();
        }
    }, [selectedDate, selectedStaff, selectedService]);

    async function loadTenantData() {
        try {
            setLoading(true);
            setError("");

            if (!tenantData) {
                const tenantsResponse = await api.get<{ success: boolean; tenants: Tenant[] }>("/tenants");
                if (tenantsResponse.success && tenantsResponse.tenants) {
                    const foundTenant = tenantsResponse.tenants.find(t => t.id === tenantId);
                    if (foundTenant) {
                        setTenantData(foundTenant);
                    }
                }
            }

            const servicesResponse = await api.get<{
                success: boolean;
                services: Service[];
            }>(`/public/tenant/${tenantId}/services`);
            if (servicesResponse.success) {
                setServices(servicesResponse.services || []);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load salon data");
        } finally {
            setLoading(false);
        }
    }

    async function fetchStaff(serviceId: string) {
        if (!tenantId || !serviceId) return;

        try {
            setLoading(true);
            const response = await api.get<{
                success: boolean;
                staff: Staff[];
                count: number;
            }>(`/public/tenant/${tenantId}/services/${serviceId}/staff`);
            if (response.success) {
                setStaff(response.staff || []);

                if (response.staff.length === 0) {
                    setError("No staff members are currently assigned to this service. Please contact the salon.");
                }
            }
        } catch (err: any) {
            console.error("Failed to load staff:", err);
            setError(err.message || "Failed to load available staff for this service");
            setStaff([]);
        } finally {
            setLoading(false);
        }
    }

    async function fetchTimeSlots() {
        if (!selectedService || !selectedStaff || !selectedDate || !tenantId) return;
        await fetchTimeSlotsForDate(selectedDate, selectedStaff.id);
    }

    async function fetchTimeSlotsForDate(date: string, staffId: string) {
        if (!selectedService || !tenantId) return;

        try {
            setLoading(true);
            const response = await api.post<{
                success: boolean;
                slots: TimeSlot[];
            }>("/bookings/search", {
                tenantId,
                serviceId: selectedService.id,
                staffId: staffId,
                date: date,
            });

            if (response.success) {
                setTimeSlots(response.slots || []);
            }
        } catch (err: any) {
            setError(err.message || "Failed to load available time slots");
        } finally {
            setLoading(false);
        }
    }

    async function fetchNextAvailableSlot(staffId: string) {
        if (!selectedService || !tenantId) return;

        try {
            setLoading(true);
            const url = `/bookings/next-available?tenantId=${tenantId}&serviceId=${selectedService.id}&staffId=${staffId}`;
            const response = await api.get<{
                success: boolean;
                slot: TimeSlot | null;
                date: string | null;
                daysAhead: number | null;
                message?: string;
            }>(url);

            if (response.success && response.slot && response.date && response.daysAhead !== null) {
                setNextAvailableSlot({
                    slot: response.slot,
                    date: response.date,
                    daysAhead: response.daysAhead
                });
                setSelectedDate(response.date);
                setSelectedTime(response.slot);
                // Fetch time slots for the selected date
                await fetchTimeSlotsForDate(response.date, staffId);
            }
        } catch (err: any) {
            console.error("Failed to fetch next available slot:", err);
        } finally {
            setLoading(false);
        }
    }

    function handleServiceSelect(service: Service) {
        setSelectedService(service);
        fetchStaff(service.id);
        setStep(2);
    }

    async function handleStaffSelect(staffMember: Staff) {
        setSelectedStaff(staffMember);

        if (selectedService && tenantId) {
            await fetchNextAvailableSlot(staffMember.id);
        }

        setStep(3);
    }

    function handleDateSelect(date: string) {
        setSelectedDate(date);
        setShowManualTimeSelection(true);
    }

    function handleTimeSelect(slot: TimeSlot) {
        setSelectedTime(slot);
        setStep(4);
    }

    function handleBookThisSlot() {
        if (nextAvailableSlot) {
            setStep(4);
        }
    }

    async function handleBooking() {
        if (!selectedService || !selectedStaff || !selectedTime || !tenantId) {
            setError("Please complete all steps");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await api.post<{
                success: boolean;
                message: string;
                appointment: any;
            }>("/bookings/create", {
                tenantId,
                serviceId: selectedService.id,
                staffId: selectedStaff.id,
                startTime: selectedTime.startTime,
            });

            if (response.success && response.appointment) {
                const appointment = response.appointment;
                const amount = parseFloat(
                    appointment.price || Number(selectedService.basePrice).toString()
                );

                // If modal mode, show payment modal
                if (mode === 'modal') {
                    setBookingData({
                        appointmentId: appointment.id,
                        amount: amount,
                        serviceName: selectedService.name_en,
                        staffName: selectedStaff.name,
                        dateTime: selectedTime.startTime
                    });
                    setShowPaymentModal(true);
                } else if (onComplete) {
                    // Callback mode
                    onComplete(appointment.id, amount);
                } else {
                    // Otherwise, redirect to payment page (inline mode)
                    const params = new URLSearchParams({
                        appointmentId: appointment.id,
                        amount: amount.toString(),
                        tenantId: tenantId,
                        serviceName: selectedService.name_en,
                        staffName: selectedStaff.name,
                        dateTime: selectedTime.startTime
                    });
                    router.push(`/booking/payment?${params.toString()}`);
                }
            } else {
                setError("Booking failed. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to create booking. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function formatTimeSlot(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    const primaryColor = tenantData?.customColors?.primaryColor || "#9333EA";
    const currentStep = serviceId ? step - 1 : step;
    const totalSteps = serviceId ? 3 : 4;

    // Modal mode rendering
    if (mode === 'modal') {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Book Appointment</h2>
                            <p className="text-sm text-gray-500">Step {currentStep} of {totalSteps}</p>
                        </div>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="Close"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {loading && step === 1 && (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
                            </div>
                        )}

                        {/* Step 1: Service Selection */}
                        {step === 1 && !loading && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Select a Service</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {services.map((service) => (
                                        <button
                                            key={service.id}
                                            onClick={() => handleServiceSelect(service)}
                                            className="text-start p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 mb-1">
                                                        {locale === 'ar' ? service.name_ar : service.name_en}
                                                    </h4>
                                                    {service.description_en && (
                                                        <p className="text-sm text-gray-600 mb-2">
                                                            {locale === 'ar' ? service.description_ar : service.description_en}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <span>{service.duration} min</span>
                                                        <span className="font-bold text-primary">
                                                            <Currency amount={service.basePrice ? Number(service.basePrice) : 0} locale={locale} />
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Staff Selection */}
                        {step === 2 && selectedService && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Select a Staff Member</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {staff.map((staffMember) => (
                                        <button
                                            key={staffMember.id}
                                            onClick={() => handleStaffSelect(staffMember)}
                                            className="text-start p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-md transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                {staffMember.photo || staffMember.image ? (
                                                    <img
                                                        src={`http://localhost:5000${(staffMember.photo || staffMember.image)?.startsWith('/') ? (staffMember.photo || staffMember.image) : `/uploads/${staffMember.photo || staffMember.image}`}`}
                                                        alt={staffMember.name}
                                                        className="w-16 h-16 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                                                        <span className="text-primary font-semibold text-lg">
                                                            {staffMember.name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900">{staffMember.name}</h4>
                                                    {staffMember.specialization && (
                                                        <p className="text-sm text-gray-600 line-clamp-2">{staffMember.specialization}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Date & Time Selection */}
                        {step === 3 && selectedService && selectedStaff && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Select Date & Time</h3>

                                {nextAvailableSlot && !showManualTimeSelection && (
                                    <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                                        <p className="text-sm text-gray-700 mb-2">
                                            Next available slot for {selectedStaff.name}:
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {new Date(nextAvailableSlot.date).toLocaleDateString('en-US', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                                <p className="text-primary font-bold">
                                                    {formatTimeSlot(nextAvailableSlot.slot.startTime)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleBookThisSlot}
                                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                                            >
                                                Book This Slot
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setShowManualTimeSelection(true)}
                                            className="mt-3 text-sm text-primary hover:underline"
                                        >
                                            Choose a different time
                                        </button>
                                    </div>
                                )}

                                {showManualTimeSelection && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Select Date
                                            </label>
                                            <input
                                                type="date"
                                                min={new Date().toISOString().split('T')[0]}
                                                value={selectedDate}
                                                onChange={(e) => handleDateSelect(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                        </div>

                                        {selectedDate && timeSlots.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Available Times
                                                </label>
                                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                                    {timeSlots
                                                        .filter(slot => slot.available)
                                                        .map((slot, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => handleTimeSelect(slot)}
                                                                className={`px-4 py-2 border rounded-lg transition-colors ${selectedTime?.startTime === slot.startTime
                                                                    ? 'bg-primary text-white border-primary'
                                                                    : 'border-gray-300 hover:border-primary'
                                                                    }`}
                                                            >
                                                                {formatTimeSlot(slot.startTime)}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 4: Booking Summary */}
                        {step === 4 && selectedService && selectedStaff && selectedTime && (
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-4">Booking Summary</h3>
                                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <p className="text-sm text-gray-600">Service</p>
                                        <p className="font-semibold text-gray-900">
                                            {locale === 'ar' ? selectedService.name_ar : selectedService.name_en}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Staff</p>
                                        <p className="font-semibold text-gray-900">{selectedStaff.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Date & Time</p>
                                        <p className="font-semibold text-gray-900">
                                            {new Date(selectedTime.startTime).toLocaleString('en-US', {
                                                weekday: 'long',
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Duration</p>
                                        <p className="font-semibold text-gray-900">{selectedService.duration} minutes</p>
                                    </div>
                                    <div className="pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-semibold text-gray-900">Total</p>
                                            <p className="text-2xl font-bold" style={{ color: primaryColor }}>
                                                <Currency amount={selectedService.basePrice ? Number(selectedService.basePrice) : 0} locale={locale} />
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleBooking}
                                    disabled={loading}
                                    className="w-full mt-6 px-6 py-3 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: primaryColor }}
                                >
                                    {loading ? t("common.loading") : "Confirm Booking"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Modal */}
                {showPaymentModal && bookingData && (
                    <PaymentModal
                        isOpen={showPaymentModal}
                        onClose={() => {
                            setShowPaymentModal(false);
                            if (onCancel) onCancel();
                        }}
                        type="booking"
                        orderData={{
                            appointmentId: bookingData.appointmentId,
                            amount: bookingData.amount,
                            tenantId: tenantId,
                            serviceName: bookingData.serviceName,
                            staffName: bookingData.staffName,
                            dateTime: bookingData.dateTime
                        }}
                        onSuccess={(transaction) => {
                            setShowPaymentModal(false);
                            if (onComplete) {
                                onComplete(bookingData.appointmentId, bookingData.amount);
                            }
                            if (onCancel) onCancel();
                        }}
                    />
                )}
            </div>
        );
    }

    // Inline mode rendering (for future use)
    return null;
}
