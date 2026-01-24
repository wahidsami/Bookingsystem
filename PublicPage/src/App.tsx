/**
 * Main App Component
 * Sets up React Router with tenant slug support
 */

import React from 'react';
import { BrowserRouter, Routes, Route, useParams, Navigate, useNavigate } from 'react-router-dom';
import { TenantProvider, useTenant } from './context/TenantContext';
import { TemplateWrapper } from './components/TemplateWrapper';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { ServicesPage } from './components/ServicesPage';
import { ServiceDetailPage } from './components/ServiceDetailPage';
import { ProductsListingPage } from './components/ProductsListingPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { AboutPage } from './components/AboutPage';
import { ContactPage } from './components/ContactPage';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutPage } from './components/CheckoutPage';
import { OrderSuccessPage } from './components/OrderSuccessPage';
import { BookingModal } from './components/BookingModal';
import { ChatbotButton } from './components/ChatbotButton';
import { Footer } from './components/Footer';
import { TenantListPage } from './components/TenantListPage';

// Tenant Route Wrapper - extracts slug from URL and provides tenant context
function TenantRouteWrapper({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    return <Navigate to="/" replace />;
  }

  return (
    <TenantProvider slug={slug}>
      <TemplateWrapper>
        {children}
      </TemplateWrapper>
    </TenantProvider>
  );
}

// App Content - renders pages based on route
function AppContent() {
  const { loading, error, sections, slug } = useTenant();
  const navigate = useNavigate();
  const [isBookingModalOpen, setIsBookingModalOpen] = React.useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null);
  
  const basePath = `/t/${slug}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Tenant not found or failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <div className="min-h-screen bg-white">
          <Header onCartClick={() => setIsCartDrawerOpen(true)} />
        
        <Routes>
          <Route
            path="/"
            element={
              <LandingPage
                onBookNow={() => setIsBookingModalOpen(true)}
                onServiceClick={(serviceId) => {
                  navigate(`${basePath}/services/${serviceId}`);
                }}
                onProductClick={(productId) => {
                  navigate(`${basePath}/products/${productId}`);
                }}
              />
            }
          />
          <Route
            path="/services"
            element={
              sections.services ? (
                <ServicesPage
                  onServiceClick={(serviceId) => {
                    setSelectedServiceId(serviceId);
                    setIsBookingModalOpen(true);
                  }}
                />
              ) : null
            }
          />
          <Route
            path="/services/:id"
            element={
              <ServiceDetailPage
                onBookNow={(serviceId) => {
                  setSelectedServiceId(serviceId);
                  setIsBookingModalOpen(true);
                }}
              />
            }
          />
          <Route
            path="/products"
            element={
              sections.products ? (
                <ProductsListingPage />
              ) : null
            }
          />
          <Route
            path="/products/:id"
            element={<ProductDetailPage />}
          />
          <Route
            path="/about"
            element={<AboutPage />}
          />
          <Route
            path="/contact"
            element={<ContactPage />}
          />
          <Route
            path="/checkout"
            element={
              <CheckoutPage
                onBack={() => navigate(`${basePath}/products`)}
                onComplete={(orderNumber) => {
                  navigate(`${basePath}/order-success?order=${orderNumber}`);
                }}
              />
            }
          />
          <Route
            path="/order-success"
            element={<OrderSuccessPage />}
          />
        </Routes>

        <Footer />
        <ChatbotButton />

        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedServiceId(null);
          }}
          initialServiceId={selectedServiceId || undefined}
        />

        <CartDrawer
          isOpen={isCartDrawerOpen}
          onClose={() => setIsCartDrawerOpen(false)}
          onCheckout={() => {
            setIsCartDrawerOpen(false);
            navigate(`${basePath}/checkout`);
          }}
        />
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

// Main App - sets up routing
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root route - show tenant list */}
        <Route
          path="/"
          element={<TenantListPage />}
        />
        {/* Tenant routes: /t/:slug or /tenant/:slug */}
        <Route
          path="/t/:slug/*"
          element={
            <TenantRouteWrapper>
              <AppContent />
            </TenantRouteWrapper>
          }
        />
        <Route
          path="/tenant/:slug/*"
          element={
            <TenantRouteWrapper>
              <AppContent />
            </TenantRouteWrapper>
          }
        />
        {/* Default route - redirect to tenant list */}
        <Route
          path="*"
          element={<TenantListPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}
