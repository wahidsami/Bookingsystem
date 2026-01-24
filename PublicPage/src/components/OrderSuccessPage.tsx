import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Home, ShoppingBag } from 'lucide-react';
import { useTenant } from '../context/TenantContext';

export const OrderSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenant } = useTenant();
  const orderNumber = searchParams.get('order') || 'N/A';
  const basePath = tenant ? `/t/${tenant.slug}` : '';

  const handleContinueShopping = () => {
    navigate(`${basePath}/products`);
  };

  const handleGoHome = () => {
    navigate(`${basePath}/`);
  };
  const expectedDeliveryDate = new Date();
  expectedDeliveryDate.setDate(expectedDeliveryDate.getDate() + 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-primary)]/10 to-white flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-14 h-14 text-white" />
          </div>

          <h1 className="mb-4">Order Placed Successfully!</h1>
          <p className="text-gray-600 mb-8 text-lg">
            Thank you for your purchase. Your order has been confirmed and will be processed shortly.
          </p>

          <div className="bg-gradient-to-br from-[var(--color-primary)]/10 to-white rounded-2xl p-6 mb-8 text-left">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Order Number</span>
                <span className="text-xl text-[var(--color-primary)]">{orderNumber}</span>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Expected Delivery</span>
                <span>{expectedDeliveryDate.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-primary)]/5 rounded-2xl p-6 mb-8">
            <p className="text-sm text-gray-600">
              A confirmation email has been sent to your email address with order details and tracking information.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleContinueShopping}
              className="flex-1 px-8 py-3 border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-5 h-5" />
              Continue Shopping
            </button>
            <button
              onClick={handleGoHome}
              className="flex-1 px-8 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Home
            </button>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            Need help? Contact us at{' '}
            <a href="tel:+966123456789" className="text-[var(--color-primary)] hover:underline">
              +966 12 345 6789
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
