"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { api, Service, Staff, Tenant } from "@/lib/api";
import Link from "next/link";

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

    // Tenant data
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

    // Selected values
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);

    // Load tenant and services on mount
    useEffect(() => {
        if (tenantId) {
            loadTenantData();
        } else {
            setError("No salon selected. Please select a salon first.");
        }
    }, [tenantId]);

    // Auto-select service if serviceId is in URL
    useEffect(() => {
        if (serviceIdFromUrl && services.length > 0 && !selectedService) {
            const service = services.find(s => s.id === serviceIdFromUrl);
            if (service) {
                setSelectedService(service);
                fetchStaff(service.id);
            }
        }
    }, [serviceIdFromUrl, services]);

    async function loadTenantData() {
        try {
            setLoading(true);
            setError("");

            // Find tenant in the public list first
            const tenantsResponse = await api.get<{ success: boolean; tenants: Tenant[] }>(`/tenants`);
            if (tenantsResponse.success && tenantsResponse.tenants) {
                const foundTenant = tenantsResponse.tenants.find(t => t.id === tenantId);
                if (foundTenant) {
                    setTenant(foundTenant);
                }
            }

            // Load tenant services using public API
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
        if (!tenantId) return;
        
        try {
            setLoading(true);
            // Fetch all staff for the tenant who can perform this service
            const response = await api.get<{
                success: boolean;
                staff: Staff[];
            }>(`/public/tenant/${tenantId}/staff`);
            if (response.success) {
                // For now, show all staff (later we can filter by service capability)
                setStaff(response.staff || []);
            }
        } catch (err: any) {
            console.error("Failed to load staff:", err);
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

    function handleServiceSelect(service: Service) {
        setSelectedService(service);
        fetchStaff(service.id);
        setStep(2);
    }

    function handleViewServiceDetails(service: Service) {
        if (tenant?.slug) {
            window.open(`http://localhost:3004/t/${tenant.slug}/services/${service.id}`, '_blank');
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
            console.error('Failed to load time slots:', err);
        }
    }

    async function handleStaffSelect(staffMember: Staff) {
        setSelectedStaff(staffMember);
        
        // Auto-fetch next available slot
        if (selectedService && tenantId) {
            try {
                setLoading(true);
                const response = await api.get<{
                    success: boolean;
                    slot: TimeSlot | null;
                    date: string | null;
                    daysAhead: number | null;
                    message?: string;
                }>(`/bookings/next-available?tenantId=${tenantId}&serviceId=${selectedService.id}&staffId=${staffMember.id}`);
                
                if (response.success && response.slot && response.date) {
                    // Auto-select the next available slot
                    setSelectedDate(response.date);
                    setSelectedTime(response.slot);
                    // Fetch all slots for that date for the calendar
                    await fetchTimeSlotsForDate(response.date, staffMember.id);
                }
            } catch (err: any) {
                console.error('Failed to fetch next available slot:', err);
                // Continue anyway - user can manually select
            } finally {
                setLoading(false);
            }
        }
        
        setStep(3);
    }

    function handleDateSelect(date: string) {
        setSelectedDate(date);
    }

    function handleTimeSelect(slot: TimeSlot) {
        setSelectedTime(slot);
        setStep(4);
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
                // Redirect to payment page
                const appointment = response.appointment;
                const amount = parseFloat(appointment.price || Number(selectedService.finalPrice).toString());
                const paymentUrl = `/booking/payment?appointmentId=${appointment.id}&amount=${amount}&tenantId=${tenantId}` +
                    `&serviceName=${encodeURIComponent(selectedService.name_en)}` +
                    `&staffName=${encodeURIComponent(selectedStaff.name)}` +
                    `&dateTime=${encodeURIComponent(selectedTime.startTime)}`;
                router.push(paymentUrl);
            } else {
                setError("Booking failed. Please try again.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to create booking. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (selectedDate && selectedStaff && selectedService) {
            fetchTimeSlots();
        }
        // eslint-disable-next-line
    }, [selectedDate, selectedStaff, selectedService]);

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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
            {/* Header */}
            <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: tenant?.customColors?.primaryColor || '#9333EA' }}
                            >
                                <span className="text-white font-bold text-xl">R</span>
                            </div>
                            <span className="text-2xl font-bold" style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}>Rifah</span>
                        </Link>
                        <span className="text-sm text-gray-500">Step {serviceIdFromUrl ? step - 1 : step} of {serviceIdFromUrl ? 3 : 4}</span>
                    </div>
                    {tenant && (
                        <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
                            {tenant.logo && (
                                <div className="w-16 h-16 bg-white rounded-lg shadow-sm flex items-center justify-center p-2">
                                    <img
                                        src={`http://localhost:5000${tenant.logo.startsWith('/') ? tenant.logo : `/uploads/${tenant.logo}`}`}
                                        alt={tenant.name}
                                        className="max-w-full max-h-full object-contain"
                                    />
                                </div>
                            )}
                            <div className="flex-1">
                                <h2 className="font-bold text-lg">{tenant.name}</h2>
                                {tenant.city && <p className="text-sm text-gray-600">📍 {tenant.city}</p>}
                                {selectedService && (
                                    <p className="text-sm mt-1" style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}>
                                        Service: {selectedService.name_en}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <div className="container mx-auto px-4 py-12 max-w-6xl">
                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex justify-between mb-2">
                        {(serviceIdFromUrl ? ["Time", "Staff", "Confirm"] : ["Service", "Time", "Staff", "Confirm"]).map((label, i) => {
                            const actualStep = serviceIdFromUrl ? step - 1 : step;
                            const isActive = actualStep > i;
                            return (
                                <div
                                    key={i}
                                    className="text-sm font-medium"
                                    style={{ color: isActive ? (tenant?.customColors?.primaryColor || '#9333EA') : '#9CA3AF' }}
                                >
                                    {label}
                                </div>
                            );
                        })}
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500"
                            style={{ 
                                width: `${((serviceIdFromUrl ? step - 1 : step) / (serviceIdFromUrl ? 3 : 4)) * 100}%`,
                                backgroundColor: tenant?.customColors?.primaryColor || '#9333EA'
                            }}
                        />
                    </div>
                </div>

                {/* Step 1: Select Service */}
                {step === 1 && (
                    <div className="animate-fade-in">
                        <h2 className="text-3xl font-bold mb-2">Choose a Service</h2>
                        <p className="text-gray-600 mb-8">
                            Select the service you'd like to book at {tenant?.name}
                        </p>

                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-4 text-gray-600">Loading services...</p>
                            </div>
                        ) : services.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600">No services available</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {services.map((service) => (
                                    <div
                                        key={service.id}
                                        className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow"
                                    >
                                        <h3 className="text-xl font-semibold mb-2">{service.name_en}</h3>
                                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                                            {service.description_en}
                                        </p>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm text-gray-500">{service.duration} min</span>
                                            <span className="text-lg font-bold" style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}>
                                                {service.finalPrice ? Number(service.finalPrice).toFixed(2) : '0.00'} SAR
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleServiceSelect(service)}
                                                className="flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
                                                style={{ backgroundColor: tenant?.customColors?.primaryColor || '#9333EA' }}
                                            >
                                                Select
                                            </button>
                                            <button
                                                onClick={() => handleViewServiceDetails(service)}
                                                className="px-4 py-2 border-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                                                style={{ 
                                                    borderColor: tenant?.customColors?.primaryColor || '#9333EA',
                                                    color: tenant?.customColors?.primaryColor || '#9333EA'
                                                }}
                                            >
                                                About
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 2: Select Staff */}
                {step === 2 && (
                    <div className="animate-fade-in">
                        <Link
                            href={`/tenant/${tenant?.slug}#services`}
                            className="mb-4 hover:underline flex items-center gap-2"
                            style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}
                        >
                            ← Back to Services
                        </Link>
                        <h2 className="text-3xl font-bold mb-2">Choose Your Specialist</h2>
                        <p className="text-gray-600 mb-8">
                            AI-recommended based on your preferences
                        </p>

                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-4 text-gray-600">Loading specialists...</p>
                            </div>
                        ) : staff.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600">No staff available</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {staff.map((member) => (
                                    <div
                                        key={member.id}
                                        onClick={() => handleStaffSelect(member)}
                                        className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl hover:scale-105 transition-all border border-gray-100 relative"
                                    >
                                        {member.recommended && (
                                            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-accent text-white text-xs font-semibold">
                                                Recommended
                                            </div>
                                        )}
                                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold mb-4">
                                            {member.name[0]}
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">{member.name}</h3>
                                        <div className="flex items-center gap-1 mb-2">
                                            <span className="text-yellow-500">★</span>
                                            <span className="font-semibold">{Number(member.rating || 0).toFixed(1)}</span>
                                            {member.aiScore && (
                                                <span className="text-xs text-gray-500 ml-2">
                                                    (AI: {member.aiScore})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {member.skills.slice(0, 3).map((skill, i) => (
                                                <span
                                                    key={i}
                                                    className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 3: Select Date & Time */}
                {step === 3 && (
                    <div className="animate-fade-in">
                        <button
                            onClick={() => setStep(2)}
                            className="mb-4 hover:underline flex items-center gap-2"
                            style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}
                        >
                            ← Back to Staff
                        </button>
                        <h2 className="text-3xl font-bold mb-2">Pick Date & Time</h2>
                        <p className="text-gray-600 mb-8">
                            {selectedTime && selectedDate ? 
                                "We found the next available slot for you!" : 
                                "Choose your preferred appointment time"}
                        </p>

                        {/* Next Available Slot Suggestion */}
                        {selectedTime && selectedDate && (
                            <div 
                                className="mb-8 p-6 rounded-xl border-2 shadow-lg max-w-2xl mx-auto"
                                style={{ 
                                    borderColor: tenant?.customColors?.primaryColor || '#9333EA',
                                    backgroundColor: `${tenant?.customColors?.primaryColor || '#9333EA'}10`
                                }}
                            >
                                <div className="flex items-center justify-between flex-wrap gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">⚡</span>
                                            <h3 className="text-xl font-bold">Next Available Slot</h3>
                                        </div>
                                        <p className="text-gray-600 mb-3">
                                            {new Date(selectedDate).toLocaleDateString('en-US', { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </p>
                                        <p className="text-3xl font-bold" style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}>
                                            {new Date(selectedTime.startTime).toLocaleTimeString('en-US', { 
                                                hour: 'numeric', 
                                                minute: '2-digit',
                                                hour12: true 
                                            })}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setStep(4)}
                                        className="px-8 py-4 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
                                        style={{ backgroundColor: tenant?.customColors?.primaryColor || '#9333EA' }}
                                    >
                                        Book This Slot →
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedDate("");
                                        setSelectedTime(null);
                                        setTimeSlots([]);
                                    }}
                                    className="mt-4 text-sm underline hover:no-underline"
                                    style={{ color: tenant?.customColors?.primaryColor || '#9333EA' }}
                                >
                                    Choose a different time
                                </button>
                            </div>
                        )}

                        {/* Manual Date & Time Selection */}
                        {(!selectedTime || !selectedDate) && (
                            <div className="max-w-2xl mx-auto">
                                <div className="mb-8">
                                    <label className="block text-sm font-medium mb-2 text-gray-700">
                                        Select Date
                                    </label>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => handleDateSelect(e.target.value)}
                                        min={new Date().toISOString().split("T")[0]}
                                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>

                            {loading && (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    <p className="mt-4 text-gray-600">Loading available slots...</p>
                                </div>
                            )}

                                {!loading && timeSlots.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium mb-4 text-gray-700">
                                            Available Time Slots
                                        </label>
                                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                            {timeSlots.map((slot, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleTimeSelect(slot)}
                                                    className="px-4 py-3 rounded-lg border-2 hover:opacity-90 transition-all font-medium text-white"
                                                    style={{ 
                                                        backgroundColor: tenant?.customColors?.primaryColor || '#9333EA',
                                                        borderColor: tenant?.customColors?.primaryColor || '#9333EA'
                                                    }}
                                                >
                                                    {new Date(slot.startTime).toLocaleTimeString("en-US", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {!loading && selectedDate && timeSlots.length === 0 && (
                                    <div className="text-center py-8 text-gray-600">
                                        No available slots for this date. Please try another day.
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {/* Step 4: Confirm Booking */}
                {step === 4 && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <button
                            onClick={() => setStep(3)}
                            className="mb-4 text-primary hover:underline flex items-center gap-2"
                        >
                            ← Back to Time Selection
                        </button>
                        <h2 className="text-3xl font-bold mb-2">Confirm Your Booking</h2>
                        <p className="text-gray-600 mb-8">Review and complete your appointment</p>

                        {/* Booking Summary */}
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-100">
                            <h3 className="font-semibold mb-4 text-lg">Booking Summary</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Salon:</span>
                                    <span className="font-medium">{tenant?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Service:</span>
                                    <span className="font-medium">{selectedService?.name_en}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Specialist:</span>
                                    <span className="font-medium">{selectedStaff?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Date:</span>
                                    <span className="font-medium">
                                        {selectedDate && new Date(selectedDate).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Time:</span>
                                    <span className="font-medium">
                                        {selectedTime &&
                                            new Date(selectedTime.startTime).toLocaleTimeString("en-US", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                    </span>
                                </div>
                                <div className="flex justify-between pt-3 border-t border-gray-200">
                                    <span className="font-semibold">Total:</span>
                                    <span className="text-xl font-bold text-primary">
                                        {selectedService &&
                                            parseFloat(Number(selectedService.finalPrice).toString()).toFixed(2)}{" "}
                                        SAR
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-100">
                            <h3 className="font-semibold mb-4 text-lg">Your Details</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Name:</span>
                                    <span className="font-medium">
                                        {user?.firstName} {user?.lastName}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Email:</span>
                                    <span className="font-medium">{user?.email}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Phone:</span>
                                    <span className="font-medium">{user?.phone}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleBooking}
                            disabled={loading}
                            className="w-full px-8 py-4 rounded-lg bg-primary text-white font-semibold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
