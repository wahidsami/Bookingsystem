import React, { useState, useEffect } from 'react';
import { ChevronLeft, User, MapPin, CreditCard, Package, CheckCircle } from 'lucide-react';
import { CheckoutData } from '../types';
import { useCart } from '../context/CartContext';
import { Currency } from './Currency';
import { publicAPI } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { LoginModal } from './LoginModal';

interface CheckoutPageProps {
  onBack: () => void;
  onComplete: (orderNumber: string) => void;
}

type CheckoutStep = 'details' | 'delivery' | 'payment' | 'summary';

export const CheckoutPage: React.FC<CheckoutPageProps> = ({ onBack, onComplete }) => {
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('details');
  const [checkoutData, setCheckoutData] = useState<CheckoutData>({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { tenant } = useTenant();
  const { user, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliveryCharge = checkoutData.deliveryType === 'delivery' ? 30 : 0;
  const subtotal = getCartTotal();
  const vat = subtotal * 0.15;
  const total = subtotal + deliveryCharge + vat;

  // Pre-fill user data when authenticated
  useEffect(() => {
    if (isAuthenticated && user && currentStep === 'details') {
      setCheckoutData(prev => ({
        ...prev,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone,
      }));
    }
  }, [isAuthenticated, user, currentStep]);

  const handleNext = () => {
    const steps: CheckoutStep[] = ['details', 'delivery', 'payment', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];
    
    // Check authentication before proceeding to summary (final step)
    if (nextStep === 'summary' && !isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    const steps: CheckoutStep[] = ['details', 'delivery', 'payment', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      onBack();
    }
  };

  const handleComplete = async () => {
    if (!tenant) {
      setError('Tenant information is missing');
      return;
    }

    if (cartItems.length === 0) {
      setError('Cart is empty');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare order data
      const orderItems = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));

      // Prepare shipping address (send as string for compatibility, but also send individual fields)
      const shippingAddress = checkoutData.deliveryType === 'delivery'
        ? `${checkoutData.street || ''}, ${checkoutData.district || ''}, ${checkoutData.city || ''}${checkoutData.building ? `, ${checkoutData.building}` : ''}`.trim()
        : '';

      // Map payment method - backend expects 'online' or 'cash-on-delivery'
      let paymentMethod: 'online' | 'cash-on-delivery' = 'cash-on-delivery';
      if (checkoutData.paymentMethod === 'online') {
        paymentMethod = 'online';
      } else if (checkoutData.paymentMethod === 'pay-on-delivery') {
        paymentMethod = 'cash-on-delivery';
      } else if (checkoutData.paymentMethod === 'booking-fee') {
        // Booking fee is not supported for orders, default to cash-on-delivery
        paymentMethod = 'cash-on-delivery';
      }

      // Map delivery method - backend expects 'standard' or 'express'
      const deliveryMethod = checkoutData.deliveryType === 'delivery' ? 'standard' : 'standard';

      // Create order - send both shippingAddress (string) and individual fields
      const orderResponse = await publicAPI.createOrder(tenant.id, {
        items: orderItems,
        customerName: checkoutData.fullName || '',
        customerEmail: checkoutData.email || '',
        customerPhone: checkoutData.phone || '',
        shippingAddress: checkoutData.deliveryType === 'delivery' ? shippingAddress : null,
        city: checkoutData.city || '',
        district: checkoutData.district || '',
        street: checkoutData.street || '',
        building: checkoutData.building || '',
        floor: checkoutData.floor || '',
        apartment: checkoutData.apartment || '',
        notes: checkoutData.notes || '',
        postalCode: '',
        deliveryMethod: deliveryMethod,
        paymentMethod: paymentMethod,
        platformUserId: isAuthenticated && user ? user.id : undefined // Pass user ID if authenticated
      });

      if (orderResponse.success) {
        // Clear cart
        clearCart();
        
        // If online payment, redirect to payment page
        if (paymentMethod === 'online' && orderResponse.data) {
          // For now, just complete the order
          // In the future, you might want to redirect to a payment page
          onComplete(orderResponse.data.orderReference || orderResponse.data.orderId);
        } else {
          // For cash on delivery, just complete
          onComplete(orderResponse.data.orderReference || orderResponse.data.orderId);
        }
      } else {
        setError('Failed to create order. Please try again.');
      }
    } catch (err: any) {
      console.error('Order creation error:', err);
      setError(err.message || 'Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'details', label: 'Details', icon: User },
      { key: 'delivery', label: 'Delivery', icon: MapPin },
      { key: 'payment', label: 'Payment', icon: CreditCard },
      { key: 'summary', label: 'Summary', icon: Package },
    ];

    const currentIndex = steps.findIndex((s) => s.key === currentStep);

    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    index <= currentIndex
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  <StepIcon className="w-6 h-6" />
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
          );
        })}
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'details':
        return (
          <div>
            <h3 className="mb-6">Customer Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={checkoutData.fullName || ''}
                  onChange={(e) => setCheckoutData({ ...checkoutData, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block mb-2 text-gray-700">Phone Number *</label>
                <input
                  type="tel"
                  value={checkoutData.phone || ''}
                  onChange={(e) => setCheckoutData({ ...checkoutData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="+966 XX XXX XXXX"
                />
              </div>
              <div>
                <label className="block mb-2 text-gray-700">Email Address *</label>
                <input
                  type="email"
                  value={checkoutData.email || ''}
                  onChange={(e) => setCheckoutData({ ...checkoutData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </div>
        );

      case 'delivery':
        return (
          <div>
            <h3 className="mb-6">Delivery Options</h3>
            <div className="space-y-4 mb-6">
              <button
                onClick={() => setCheckoutData({ ...checkoutData, deliveryType: 'pickup' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  checkoutData.deliveryType === 'pickup'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">In-Store Pickup</h4>
                <p className="text-gray-600 mb-2">Pick up your order from our store</p>
                <p className="text-sm text-green-600">Free</p>
              </button>
              <button
                onClick={() => setCheckoutData({ ...checkoutData, deliveryType: 'delivery' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  checkoutData.deliveryType === 'delivery'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Home Delivery</h4>
                <p className="text-gray-600 mb-2">We deliver to your doorstep</p>
                <p className="text-sm text-[var(--color-primary)]"><Currency amount={30} /></p>
              </button>
            </div>

            {checkoutData.deliveryType === 'delivery' && (
              <div className="space-y-4 bg-gray-50 p-6 rounded-2xl">
                <h4 className="mb-4">Delivery Address</h4>
                <div>
                  <label className="block mb-2 text-gray-700">City *</label>
                  <input
                    type="text"
                    value={checkoutData.city || ''}
                    onChange={(e) => setCheckoutData({ ...checkoutData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="e.g., Riyadh"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-gray-700">District *</label>
                  <input
                    type="text"
                    value={checkoutData.district || ''}
                    onChange={(e) => setCheckoutData({ ...checkoutData, district: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="Enter district"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-gray-700">Street *</label>
                  <input
                    type="text"
                    value={checkoutData.street || ''}
                    onChange={(e) => setCheckoutData({ ...checkoutData, street: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="Enter street name"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-gray-700">Building / Apartment</label>
                  <input
                    type="text"
                    value={checkoutData.building || ''}
                    onChange={(e) => setCheckoutData({ ...checkoutData, building: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    placeholder="Building number, apartment"
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 'payment':
        return (
          <div>
            <h3 className="mb-6">Payment Method</h3>
            <div className="space-y-4">
              <button
                onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: 'pay-on-delivery' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  checkoutData.paymentMethod === 'pay-on-delivery'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Pay on Delivery</h4>
                <p className="text-gray-600">Pay with cash when your order arrives</p>
              </button>
              <button
                onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: 'online' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  checkoutData.paymentMethod === 'online'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Online Payment</h4>
                <p className="text-gray-600">Secure payment with credit/debit card</p>
              </button>
              <button
                onClick={() => setCheckoutData({ ...checkoutData, paymentMethod: 'booking-fee' })}
                className={`w-full p-6 rounded-2xl border-2 transition-all duration-300 text-left ${
                  checkoutData.paymentMethod === 'booking-fee'
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                    : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                }`}
              >
                <h4 className="mb-2">Pay Booking Fee Only</h4>
                <p className="text-gray-600">Pay <Currency amount={50} /> now, rest on delivery</p>
              </button>
            </div>
          </div>
        );

      case 'summary':
        return (
          <div>
            <h3 className="mb-6">Order Summary</h3>
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <h4 className="mb-4">Your Information</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">Name: <span className="text-gray-900">{checkoutData.fullName}</span></p>
                <p className="text-gray-600">Phone: <span className="text-gray-900">{checkoutData.phone}</span></p>
                <p className="text-gray-600">Email: <span className="text-gray-900">{checkoutData.email}</span></p>
                <p className="text-gray-600">
                  Delivery: <span className="text-gray-900 capitalize">{checkoutData.deliveryType?.replace('-', ' ')}</span>
                </p>
                {checkoutData.deliveryType === 'delivery' && (
                  <p className="text-gray-600">
                    Address: <span className="text-gray-900">{checkoutData.street}, {checkoutData.district}, {checkoutData.city}</span>
                  </p>
                )}
                <p className="text-gray-600">
                  Payment: <span className="text-gray-900 capitalize">{checkoutData.paymentMethod?.replace('-', ' ')}</span>
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <h4 className="mb-4">Products</h4>
              <div className="space-y-3">
                {cartItems.map((item) => {
                  // Format image URL - handle different formats
                  const productImageRaw = item.product.image;
                  const productImage = productImageRaw
                    ? productImageRaw.startsWith('http')
                      ? productImageRaw
                      : `http://localhost:5000${productImageRaw.startsWith('/uploads/')
                          ? productImageRaw
                          : productImageRaw.startsWith('/')
                            ? `/uploads${productImageRaw}`
                            : `/uploads/${productImageRaw}`}`
                    : null;

                  return (
                    <div key={item.product.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={item.product.name}
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <p>{item.product.name}</p>
                          <p className="text-gray-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-[var(--color-primary)]"><Currency amount={item.product.price * item.quantity} /></p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border-2 border-[var(--color-gold)] rounded-2xl p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span><Currency amount={subtotal} /></span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Charge</span>
                  <span><Currency amount={deliveryCharge} /></span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (15%)</span>
                  <span><Currency amount={vat} /></span>
                </div>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent"></div>
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="text-2xl text-[var(--color-primary)]"><Currency amount={total} /></span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-[var(--color-primary)] transition-colors duration-300"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl shadow-lg p-8">
          {renderStepIndicator()}
          <div className="mt-8">{renderStepContent()}</div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button
              onClick={currentStep === 'summary' ? handleComplete : handleNext}
              disabled={
                isSubmitting ||
                (currentStep === 'details' && (!checkoutData.fullName || !checkoutData.phone || !checkoutData.email)) ||
                (currentStep === 'delivery' && !checkoutData.deliveryType) ||
                (currentStep === 'payment' && !checkoutData.paymentMethod)
              }
              className="flex-1 px-6 py-3 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting 
                ? 'Processing...' 
                : currentStep === 'summary' 
                  ? 'Confirm & Pay' 
                  : 'Continue'
              }
            </button>
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
            // After login, proceed to summary step
            setCurrentStep('summary');
          }}
        />
      )}
    </div>
  );
};
