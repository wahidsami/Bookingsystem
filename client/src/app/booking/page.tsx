"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { api, Service, Staff, Tenant } from "@/lib/api";
import Link from "next/link";
import { Currency } from "@/components/Currency";

interface TimeSlot {
    startTime: string;
    endTime: string;
    available: boolean;
}

function BookingContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const tenantId = searchParams.get("tenantId");
    const serviceIdFromUrl = searchParams.get("serviceId");

    const [step, setStep] = useState(serviceIdFromUrl ? 2 : 1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Data states
    const [tenant, setTenant] = useState<Tenant | null>(null);
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

    // Load tenant data on mount
    useEffect(() => {
        if (tenantId) {
            loadTenantData();
        }
    }, [tenantId]);

    // Auto-select service from URL
    useEffect(() => {
        if (serviceIdFromUrl && services.length > 0 && !selectedService) {
            const service = services.find(s => s.id === serviceIdFromUrl);
            if (service) {
                setSelectedService(service);
                fetchStaff(service.id);
            }
        }
    }, [serviceIdFromUrl, services, selectedService]);

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

            const tenantsResponse = await api.get<{ success: boolean; tenants: Tenant[] }>("/tenants");
            if (tenantsResponse.success && tenantsResponse.tenants) {
                const foundTenant = tenantsResponse.tenants.find(t => t.id === tenantId);
                if (foundTenant) {
                    setTenant(foundTenant);
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

    async function fetchStaff(serviceId?: string) {
        if (!tenantId || !serviceId) return;
        
        try {
            setLoading(true);
            // Fetch only staff assigned to this specific service
            const response = await api.get<{
                success: boolean;
                staff: Staff[];
                count: number;
            }>(`/public/tenant/${tenantId}/services/${serviceId}/staff`);
            if (response.success) {
                setStaff(response.staff || []);
                
                // If no staff available for this service, show a helpful error
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

        try {
            setLoading(true);
            const response = await api.post<{
                success: boolean;
                slots: TimeSlot[];
            }>("/bookings/search", {
                tenantId,
                serviceId: selectedService.id,
                staffId: selectedStaff.id,
                date: selectedDate,
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

    async function fetchTimeSlotsForDate(date: string, staffId: string) {
        if (!selectedService || !tenantId) return;
        
        try {
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
            console.error("Failed to load time slots:", err);
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

    function handleViewServiceDetails(service: Service) {
        if (tenant?.slug) {
            window.open(`http://localhost:3004/t/${tenant.slug}/services/${service.id}`, "_blank");
        }
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
                    appointment.price || Number(selectedService.finalPrice).toString()
                );
                
                const params = new URLSearchParams({
                    appointmentId: appointment.id,
                    amount: amount.toString(),
                    tenantId: tenantId,
                    serviceName: selectedService.name_en,
                    staffName: selectedStaff.name,
                    dateTime: selectedTime.startTime
                });
                
                router.push(`/booking/payment?${params.toString()}`);
            } else {
                setError("Booking failed. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to create booking. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (!tenantId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">No Salon Selected</h2>
                    <p className="text-gray-600 mb-6">Please select a salon to book an appointment</p>
                    <Link
                        href="/tenants"
                        className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Browse Salons
                    </Link>
                </div>
            </div>
        );
    }

    // Helper function to format time slot
    function formatTimeSlot(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    const primaryColor = tenant?.customColors?.primaryColor || "#9333EA";
    const currentStep = serviceIdFromUrl ? step - 1 : step;
    const totalSteps = serviceIdFromUrl ? 3 : 4;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: primaryColor }}
                            >
                                <span className="text-white font-bold text-xl">R</span>
                            </div>
                            <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                                Rifah
                            </span>
                        </Link>
                        <span className="text-sm text-gray-500">
                            Step {currentStep} of {totalSteps}
                        </span>
                    </div>

                    {/* Tenant Info */}
                    {tenant && (
                        <div className="flex items-center gap-4 mb-4">
                            {tenant.logo && (
                                <img
                                    src={tenant.logo.startsWith('/') 
                                        ? `http://localhost:5000${tenant.logo}` 
                                        : `http://localhost:5000/uploads/${tenant.logo}`}
                                    alt={tenant.name}
                                    className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            )}
                            <div>
                                <h2 className="text-lg font-semibold" style={{ color: primaryColor }}>
                                    {tenant.name}
                                </h2>
                                <p className="text-sm text-gray-600">{tenant.location}</p>
                            </div>
                        </div>
                    )}

                    {/* Selected Service Display */}
                    {selectedService && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm text-gray-600">Selected Service</p>
                                    <p className="font-semibold">{selectedService.name_en}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-600">{selectedService.duration} min</p>
                                    <p className="font-bold" style={{ color: primaryColor }}>
                                        <Currency 
                                            amount={selectedService.finalPrice ? Number(selectedService.finalPrice) : 0} 
                                            locale="en"
                                        />
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-4">
                        <div className="flex justify-between mb-2">
                            {!serviceIdFromUrl && (
                                <span className={`text-xs ${step >= 1 ? "font-semibold" : "text-gray-400"}`}>
                                    Service
                                </span>
                            )}
                            <span className={`text-xs ${step >= 2 ? "font-semibold" : "text-gray-400"}`}>
                                Staff
                            </span>
                            <span className={`text-xs ${step >= 3 ? "font-semibold" : "text-gray-400"}`}>
                                Time
                            </span>
                            <span className={`text-xs ${step >= 4 ? "font-semibold" : "text-gray-400"}`}>
                                Confirm
                            </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-300"
                                style={{
                                    width: `${(currentStep / totalSteps) * 100}%`,
                                    backgroundColor: primaryColor,
                                }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                        {error}
                    </div>
                )}

                {/* Step 1: Service Selection */}
                {step === 1 && !serviceIdFromUrl && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Select a Service</h2>
                        <div className="grid gap-4">
                            {services.map((service) => (
                                <div
                                    key={service.id}
                                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-semibold mb-2">
                                                    {service.name_en}
                                                </h3>
                                                <p className="text-gray-600 text-sm mb-2">
                                                    {service.description_en}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm text-gray-500">
                                                {service.duration} min
                                            </span>
                                            <span className="text-lg font-bold" style={{ color: primaryColor }}>
                                                <Currency 
                                                    amount={service.finalPrice ? Number(service.finalPrice) : 0} 
                                                    locale="en"
                                                />
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleServiceSelect(service)}
                                                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-colors"
                                                style={{ backgroundColor: primaryColor }}
                                            >
                                                Select Service
                                            </button>
                                            <button
                                                onClick={() => handleViewServiceDetails(service)}
                                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 2: Staff Selection */}
                {step === 2 && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Choose Your Specialist</h2>
                            {!serviceIdFromUrl && (
                                <button
                                    onClick={() => setStep(1)}
                                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    Change Service
                                </button>
                            )}
                        </div>
                        {loading && staff.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: primaryColor }} />
                                <p className="text-gray-600">Loading specialists...</p>
                            </div>
                        ) : staff.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                                <p className="text-gray-600">No staff available for this service</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {staff.map((member) => (
                                    <div
                                        key={member.id}
                                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => handleStaffSelect(member)}
                                    >
                                        <div className="p-6 flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                                                {(member.image || member.photo) ? (
                                                    <img
                                                        src={`http://localhost:5000/uploads/${member.image || member.photo}`}
                                                        alt={member.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-600 text-2xl font-bold">
                                                        {member.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                                                <div className="flex items-center gap-1 mb-2">
                                                    <span className="text-yellow-500">★</span>
                                                    <span className="font-semibold">
                                                        {Number(member.rating || 0).toFixed(1)}
                                                    </span>
                                                    {member.aiScore && (
                                                        <span className="text-xs text-gray-500 ml-2">
                                                            (AI: {member.aiScore})
                                                        </span>
                                                    )}
                                                </div>
                                                {member.specialization && (
                                                    <p className="text-sm text-gray-600">{member.specialization}</p>
                                                )}
                                            </div>
                                            <button
                                                className="px-6 py-3 text-white rounded-lg hover:opacity-90 transition-colors"
                                                style={{ backgroundColor: primaryColor }}
                                            >
                                                Select
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Time Selection */}
                {step === 3 && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Select Time</h2>
                            <button
                                onClick={() => setStep(2)}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Change Specialist
                            </button>
                        </div>

                        {/* Next Available Slot */}
                        {nextAvailableSlot && !showManualTimeSelection && (
                            <div className="mb-6 p-6 bg-white rounded-lg border-2 shadow-sm" style={{ borderColor: primaryColor }}>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
                                            🎯 Next Available Slot
                                        </h3>
                                        <p className="text-3xl font-bold mb-1">
                                            {new Date(nextAvailableSlot.date).toLocaleDateString("en-US", {
                                                weekday: "long",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                        </p>
                                        <p className="text-xl text-gray-600 font-semibold">
                                            {formatTimeSlot(nextAvailableSlot.slot.startTime)} - {formatTimeSlot(nextAvailableSlot.slot.endTime)}
                                        </p>
                                        {nextAvailableSlot.daysAhead === 0 ? (
                                            <p className="text-sm text-green-600 font-semibold mt-2">
                                                ✓ Available today!
                                            </p>
                                        ) : (
                                            <p className="text-sm text-gray-500 mt-2">
                                                {nextAvailableSlot.daysAhead} day{nextAvailableSlot.daysAhead > 1 ? "s" : ""} from now
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleBookThisSlot}
                                        className="flex-1 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-colors font-semibold"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        Book This Slot
                                    </button>
                                    <button
                                        onClick={() => setShowManualTimeSelection(true)}
                                        className="px-6 py-3 border-2 rounded-lg hover:bg-gray-50 transition-colors"
                                        style={{ borderColor: primaryColor, color: primaryColor }}
                                    >
                                        Choose Different Time
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Manual Time Selection */}
                        {(showManualTimeSelection || !nextAvailableSlot) && (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold mb-4">Select Date</h3>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => handleDateSelect(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-6"
                                />

                                {selectedDate && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Available Time Slots</h3>
                                        {loading ? (
                                            <div className="text-center py-8">
                                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: primaryColor }} />
                                                <p className="text-gray-600">Loading available times...</p>
                                            </div>
                                        ) : timeSlots.length === 0 ? (
                                            <div className="text-center py-8 text-gray-600">
                                                No available time slots for this date
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-3">
                                                {timeSlots
                                                    .filter((slot) => slot.available)
                                                    .map((slot, index) => (
                                                        <button
                                                            key={index}
                                                            onClick={() => handleTimeSelect(slot)}
                                                            className="px-4 py-3 border-2 rounded-lg hover:opacity-90 transition-colors font-semibold"
                                                            style={{
                                                                borderColor: primaryColor,
                                                                backgroundColor:
                                                                    selectedTime?.startTime === slot.startTime
                                                                        ? primaryColor
                                                                        : "white",
                                                                color:
                                                                    selectedTime?.startTime === slot.startTime
                                                                        ? "white"
                                                                        : primaryColor,
                                                            }}
                                                        >
                                                            {formatTimeSlot(slot.startTime)}
                                                        </button>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 4: Confirmation */}
                {step === 4 && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Confirm Your Booking</h2>
                            <button
                                onClick={() => setStep(3)}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Change Time
                            </button>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <div className="space-y-4">
                                <div className="flex justify-between pb-4 border-b">
                                    <span className="text-gray-600">Service:</span>
                                    <span className="font-semibold">{selectedService?.name_en}</span>
                                </div>
                                <div className="flex justify-between pb-4 border-b">
                                    <span className="text-gray-600">Specialist:</span>
                                    <span className="font-semibold">{selectedStaff?.name}</span>
                                </div>
                                <div className="flex justify-between pb-4 border-b">
                                    <span className="text-gray-600">Date:</span>
                                    <span className="font-semibold">
                                        {selectedDate &&
                                            new Date(selectedDate).toLocaleDateString("en-US", {
                                                weekday: "long",
                                                month: "long",
                                                day: "numeric",
                                            })}
                                    </span>
                                </div>
                                <div className="flex justify-between pb-4 border-b">
                                    <span className="text-gray-600">Time:</span>
                                    <span className="font-semibold">
                                        {selectedTime && `${formatTimeSlot(selectedTime.startTime)} - ${formatTimeSlot(selectedTime.endTime)}`}
                                    </span>
                                </div>
                                <div className="flex justify-between pb-4 border-b">
                                    <span className="text-gray-600">Duration:</span>
                                    <span className="font-semibold">{selectedService?.duration} minutes</span>
                                </div>
                                <div className="flex justify-between pt-2">
                                    <span className="font-semibold">Total:</span>
                                    <span className="text-xl font-bold text-primary">
                                        {selectedService && (
                                            <Currency 
                                                amount={Number(selectedService.finalPrice)} 
                                                locale="en"
                                            />
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleBooking}
                            disabled={loading}
                            className="w-full px-8 py-4 rounded-lg text-white font-semibold text-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            style={{ backgroundColor: primaryColor }}
                        >
                            {loading ? "Confirming Booking..." : "Confirm Booking"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function BookingPage() {
    return (
        <ProtectedRoute>
            <BookingContent />
        </ProtectedRoute>
    );
}
