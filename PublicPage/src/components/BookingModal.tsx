import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, Calendar, Clock, Home, User, CreditCard, CheckCircle } from 'lucide-react';
import { BookingData } from '../types';
import { publicAPI, Service, Staff } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { Currency } from './Currency';
import { LoginModal } from './LoginModal';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceId?: string;
}

type BookingStep = 'date' | 'time' | 'service-type' | 'staff' | 'customer' | 'payment' | 'confirmation' | 'success';

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, initialServiceId }) => {
  const { tenantId } = useTenant();
  const { user, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState<BookingStep>('date');
  const [bookingData, setBookingData] = useState<BookingData>({
    serviceId: initialServiceId,
  });
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [availableSlots, setAvailableSlots] = useState<Array<{
    startTime: string;
    endTime: string;
    available: boolean;
    staffId?: string;
    staffName?: string;
  }>>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Update serviceId when initialServiceId changes
  useEffect(() => {
    if (initialServiceId) {
      setBookingData(prev => ({ ...prev, serviceId: initialServiceId }));
    }
  }, [initialServiceId]);

  // Load services and staff when modal opens
  useEffect(() => {
    if (isOpen && tenantId) {
      loadServices();
      loadStaff();
    }
  }, [isOpen, tenantId]);

  // Load available slots when date and service are selected
  useEffect(() => {
    if (bookingData.date && bookingData.serviceId && tenantId) {
      loadAvailableSlots();
    } else {
      setAvailableSlots([]);
    }
  }, [bookingData.date, bookingData.serviceId, bookingData.staffId, tenantId]);

  const loadServices = async () => {
    if (!tenantId) return;
    try {
      setLoadingServices(true);
      const response = await publicAPI.getServices(tenantId, {});
      if (response.success) {
        setServices(response.services);
      }
    } catch (err: any) {
      console.error('Failed to load services:', err);
      setError('Failed to load services. Please try again.');
    } finally {
      setLoadingServices(false);
    }
  };

  const loadStaff = async () => {
    if (!tenantId) return;
    try {
      setLoadingStaff(true);
      const response = await publicAPI.getStaff(tenantId);
      if (response.success) {
        setStaff(response.staff);
      }
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      // Don't show error for staff - it's optional
    } finally {
      setLoadingStaff(false);
    }
  };

  const loadAvailableSlots = async () => {
    if (!tenantId || !bookingData.date || !bookingData.serviceId) return;
    try {
      setLoadingSlots(true);
      const response = await publicAPI.searchAvailability(tenantId, {
        serviceId: bookingData.serviceId,
        staffId: bookingData.staffId || null,
        date: bookingData.date
      });
      if (response.success) {
        setAvailableSlots(response.slots.filter(slot => slot.available));
      }
    } catch (err: any) {
      console.error('Failed to load available slots:', err);
      setError('Failed to load available time slots. Please try again.');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  if (!isOpen) return null;

  const selectedService = services.find((s) => s.id === bookingData.serviceId);

  const handleNext = () => {
    const steps: BookingStep[] = ['date', 'time', 'service-type', 'staff', 'customer', 'payment', 'confirmation', 'success'];
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];
    
    console.log('[BookingModal] handleNext called', {
      currentStep,
      currentIndex,
      nextStep,
      bookingData,
      hasDate: !!bookingData.date,
      hasServiceId: !!bookingData.serviceId
    });
    
    // If next step is 'customer' and user is not authenticated, show login modal
    if (nextStep === 'customer' && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(nextStep);
      console.log('[BookingModal] Advanced to step:', nextStep);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['date', 'time', 'service-type', 'staff', 'customer', 'payment', 'confirmation', 'success'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleConfirm = async () => {
    if (!tenantId || !bookingData.serviceId || !bookingData.date || !bookingData.time) {
      setError('Please complete all required fields');
      return;
    }

    try {
      setError(null);
      // Extract customer info from bookingData (will be added in payment step)
      const customerName = bookingData.customerName || 'Guest';
      const customerEmail = bookingData.customerEmail || '';
      const customerPhone = bookingData.customerPhone || '';

      if (!customerEmail || !customerPhone) {
        setError('Email and phone are required');
        return;
      }

      const response = await publicAPI.createBooking(tenantId, {
        serviceId: bookingData.serviceId,
        staffId: bookingData.staffId,
        date: bookingData.date,
        time: bookingData.time,
        serviceType: bookingData.serviceType || 'in-center',
        customerName,
        customerEmail,
        customerPhone,
        specialRequests: bookingData.specialRequests,
        paymentMethod: bookingData.paymentMethod || 'at-center',
        location: bookingData.location,
        platformUserId: isAuthenticated && user ? user.id : undefined // Pass user ID if authenticated
      });

      if (response.success) {
        setCurrentStep('success');
        // Store booking reference for display
        setBookingData({
          ...bookingData,
          bookingReference: response.data.bookingReference
        });
      } else {
        setError('Failed to create booking. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to create booking:', err);
      setError(err.message || 'Failed to create booking. Please try again.');
    }
  };

  const handleClose = () => {
    setCurrentStep('date');
    setBookingData({ serviceId: initialServiceId });
    onClose();
  };

  // Format time slot for display
  const formatTimeSlot = (startTime: string) => {
    const date = new Date(startTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const generateCalendarDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    return days;
  };

    const renderStepIndicator = () => {
    const steps = [
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'service-type', label: 'Type' },
      { key: 'staff', label: 'Staff' },
      { key: 'customer', label: 'Info' },
      { key: 'payment', label: 'Payment' },
      { key: 'confirmation', label: 'Confirm' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);

    return (
      <div className="flex items-center justify-between mb-8 px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  index <= currentIndex
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}
              >
                {index + 1}
              </div>
              <span className="text-xs mt-2 hidden sm:block">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-all duration-300 ${
                  index < currentIndex ? 'bg-[var(--color-primary)]' : 'bg-gray-200'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'date':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Select Date</h3>
            </div>
            <div className="grid grid-cols-7 gap-2 max-h-96 overflow-y-auto">
              {generateCalendarDays().map((date, index) => {
                const dateStr = date.toISOString().split('T')[0];
                const isSelected = bookingData.date === dateStr;
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();

                return (
                  <button
                    key={index}
                    onClick={() => {
                      console.log('[BookingModal] Date selected:', dateStr);
                      setBookingData({ ...bookingData, date: dateStr });
                    }}
                    className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                    }`}
                  >
                    <div className="text-xs text-gray-500">{dayName}</div>
                    <div className={isSelected ? 'text-[var(--color-primary)]' : ''}>{dayNum}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'time':
        if (!bookingData.date || !bookingData.serviceId) {
          return (
            <div className="text-center py-8">
              <p className="text-gray-500">Please select a date first</p>
            </div>
          );
        }

        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Select Time</h3>
            </div>
            {loadingSlots ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading available slots...</p>
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {availableSlots.map((slot) => {
                  const timeStr = formatTimeSlot(slot.startTime);
                  const isSelected = bookingData.time === timeStr;
                  return (
                    <button
                      key={slot.startTime}
                      onClick={() => setBookingData({ ...bookingData, time: timeStr })}
                      className={`p-3 rounded-xl border-2 transition-all duration-300 ${
                        isSelected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                      }`}
                    >
                      {timeStr}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">No available slots for this date</p>
                <p className="text-sm text-gray-400">Please try a different date</p>
              </div>
            )}
          </div>
        );

      case 'service-type':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Home className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Select Service Type</h3>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => setBookingData({ ...bookingData, serviceType: 'in-center' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  bookingData.serviceType === 'in-center'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">At Our Center</h4>
                <p className="text-gray-600">
                  Visit our luxury spa and enjoy our full facilities
                </p>
              </button>
              <button
                onClick={() => setBookingData({ ...bookingData, serviceType: 'home-visit' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  bookingData.serviceType === 'home-visit'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Home Visit</h4>
                <p className="text-gray-600">
                  We come to you for a personalized experience at your location
                </p>
                <p className="text-sm text-[var(--color-primary)] mt-2">+<Currency amount={50} /> service charge</p>
              </button>
            </div>
          </div>
        );

      case 'staff':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Select Performer</h3>
            </div>
            {loadingStaff ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                <button
                  onClick={() => setBookingData({ ...bookingData, staffId: undefined })}
                  className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                    !bookingData.staffId
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                  }`}
                >
                  <h4>No Preference</h4>
                  <p className="text-gray-600 text-sm">We'll assign the best available therapist</p>
                </button>
                {staff.map((member) => {
                  const imageUrl = member.image 
                    ? (member.image.startsWith('http') ? member.image : `http://localhost:5000/uploads/${member.image}`)
                    : 'https://via.placeholder.com/150';
                  return (
                    <button
                      key={member.id}
                      onClick={() => setBookingData({ ...bookingData, staffId: member.id })}
                      className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                        bookingData.staffId === member.id
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                          : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                      }`}
                    >
                      <img
                        src={imageUrl}
                        alt={member.name}
                        className="w-16 h-16 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150';
                        }}
                      />
                      <div className="text-left flex-1">
                        <h4 className="mb-1">{member.name}</h4>
                        <p className="text-sm text-gray-600">{member.specialty || 'Therapist'}</p>
                        {member.rating && (
                          <p className="text-sm text-[var(--color-primary)]">★ {Number(member.rating).toFixed(1)}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'customer':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <User className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Your Information</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  type="text"
                  value={bookingData.customerName || ''}
                  onChange={(e) => setBookingData({ ...bookingData, customerName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  placeholder="Enter your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={bookingData.customerEmail || ''}
                  onChange={(e) => setBookingData({ ...bookingData, customerEmail: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  placeholder="your.email@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  value={bookingData.customerPhone || ''}
                  onChange={(e) => setBookingData({ ...bookingData, customerPhone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  placeholder="+966 5XX XXX XXXX"
                  required
                />
              </div>
              {bookingData.serviceType === 'home-visit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={bookingData.location || ''}
                    onChange={(e) => setBookingData({ ...bookingData, location: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                    placeholder="Enter your address"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Special Requests (Optional)</label>
                <textarea
                  value={bookingData.specialRequests || ''}
                  onChange={(e) => setBookingData({ ...bookingData, specialRequests: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  placeholder="Any special requests or notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 'payment':
        return (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="w-6 h-6 text-[var(--color-primary)]" />
              <h3>Select Payment Method</h3>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'at-center' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  bookingData.paymentMethod === 'at-center'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Pay at Center</h4>
                <p className="text-gray-600">Pay when you arrive for your appointment</p>
              </button>
              <button
                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'online-full' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  bookingData.paymentMethod === 'online-full'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Pay Online (Full Amount)</h4>
                <p className="text-gray-600">Secure online payment with card</p>
              </button>
              <button
                onClick={() => setBookingData({ ...bookingData, paymentMethod: 'booking-fee' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  bookingData.paymentMethod === 'booking-fee'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Pay Booking Fee Only</h4>
                <p className="text-gray-600">Pay <Currency amount={50} /> now, rest at the center</p>
              </button>
            </div>
          </div>
        );

      case 'confirmation':
        const selectedStaff = staff.find((s) => s.id === bookingData.staffId);
        const extraCharge = bookingData.serviceType === 'home-visit' ? 50 : 0;
        const totalPrice = selectedService ? (selectedService.finalPrice || 0) + extraCharge : 0;

        return (
          <div>
            <h3 className="mb-6">Confirm Your Booking</h3>
            <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Service</p>
                <p>{selectedService?.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p>{bookingData.date ? new Date(bookingData.date).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Time</p>
                  <p>{bookingData.time || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Service Type</p>
                <p className="capitalize">{bookingData.serviceType?.replace('-', ' ') || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Therapist</p>
                <p>{selectedStaff ? selectedStaff.name : 'No preference'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                <p className="capitalize">{bookingData.paymentMethod?.replace('-', ' ') || '-'}</p>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <p>Service Price</p>
                  <p><Currency amount={selectedService?.finalPrice || 0} /></p>
                </div>
                {extraCharge > 0 && (
                  <div className="flex justify-between items-center text-sm text-gray-600 mt-2">
                    <p>Home Visit Charge</p>
                    <p><Currency amount={extraCharge} /></p>
                  </div>
                )}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                  <p>Total</p>
                  <p className="text-[var(--color-primary)] text-xl"><Currency amount={totalPrice} /></p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="mb-4">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Your appointment has been successfully booked. We've sent a confirmation to your email.
            </p>
            <div className="bg-gray-50 rounded-2xl p-6 mb-6 text-left max-w-md mx-auto">
              <p className="text-sm text-gray-500 mb-1">Booking Reference</p>
              <p className="text-xl mb-4">{bookingData.bookingReference || 'BOOKING-' + Date.now().toString(36).toUpperCase()}</p>
              <p className="text-sm text-gray-500 mb-1">Appointment Details</p>
              <p>{selectedService?.name_en || selectedService?.name_ar || 'Service'}</p>
              <p className="text-gray-600">
                {bookingData.date ? new Date(bookingData.date).toLocaleDateString() : ''} at {bookingData.time}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-8 py-3 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300"
            >
              Book Another Service
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black/50" onClick={handleClose}></div>

        <div className="relative inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-3xl">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleClose}
              className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-300"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
            {currentStep !== 'success' && renderStepIndicator()}
            <div className="mt-6">{renderStepContent()}</div>

            {currentStep !== 'success' && (
              <div className="flex gap-4 mt-8">
                {currentStep !== 'date' && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-2 px-6 py-3 border-2 border-gray-300 rounded-full hover:border-[var(--color-primary)] transition-all duration-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                  </button>
                )}
                <button
                  onClick={currentStep === 'confirmation' ? handleConfirm : handleNext}
                  disabled={
                    (currentStep === 'date' && !bookingData.date) ||
                    (currentStep === 'time' && !bookingData.time) ||
                    (currentStep === 'service-type' && !bookingData.serviceType) ||
                    (currentStep === 'customer' && (!bookingData.customerName || !bookingData.customerEmail || !bookingData.customerPhone)) ||
                    (currentStep === 'payment' && !bookingData.paymentMethod)
                  }
                  className="flex-1 px-6 py-3 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currentStep === 'confirmation' ? 'Confirm Booking' : 'Continue'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
            // After login, proceed to customer step
            setCurrentStep('customer');
          }}
        />
      )}
    </div>
  );
};
