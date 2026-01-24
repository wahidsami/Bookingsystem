import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { HeroSlider } from './HeroSlider';
import { ServiceCard } from './ServiceCard';
import { ProductsSection } from './ProductsSection';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Service, Product } from '../lib/api';

interface LandingPageProps {
  onBookNow: () => void;
  onServiceClick: (serviceId: string) => void;
  onProductClick: (productId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onBookNow,
  onServiceClick,
  onProductClick,
}) => {
  const { tenantId, slug, sections } = useTenant();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!tenantId) return;

      try {
        setLoading(true);
        const [servicesRes, productsRes] = await Promise.allSettled([
          sections.services ? publicAPI.getServices(tenantId, {}) : Promise.resolve({ success: true, services: [] }),
          sections.products ? publicAPI.getProducts(tenantId, {}) : Promise.resolve({ success: true, products: [] })
        ]);

        // Handle services
        if (servicesRes.status === 'fulfilled' && servicesRes.value.success) {
          setServices(servicesRes.value.services.slice(0, 6));
        } else {
          console.warn('Failed to load services:', servicesRes.status === 'rejected' ? servicesRes.reason : 'Unknown error');
          setServices([]);
        }

        // Handle products
        if (productsRes.status === 'fulfilled' && productsRes.value.success) {
          setProducts(productsRes.value.products.slice(0, 8));
        } else {
          console.warn('Failed to load products:', productsRes.status === 'rejected' ? productsRes.reason : 'Unknown error');
          setProducts([]);
        }
      } catch (error) {
        console.error('Failed to load landing page data:', error);
        setServices([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, sections.services, sections.products]);

  const basePath = `/t/${slug}`;

  return (
    <div className="main-content">
      {sections.heroSlider && (
        <HeroSlider 
          onBookNowClick={onBookNow} 
          onExploreClick={() => navigate(`${basePath}/services`)} 
        />
      )}

      {sections.services && (
        <section className="py-20 bg-white">
          <div className="page-container">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
                <p className="text-[var(--color-primary)] tracking-widest uppercase">Our Services</p>
                <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
              </div>
              <h2 className="mb-4">Featured Treatments</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Discover our carefully curated selection of premium spa treatments designed to pamper your body and soul
              </p>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : services.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {services.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onClick={() => onServiceClick(service.id)}
                    />
                  ))}
                </div>
                <div className="text-center mt-12">
                  <button
                    onClick={() => navigate(`${basePath}/services`)}
                    className="px-8 py-3 border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300"
                  >
                    View All Services
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-2">No services available at the moment.</p>
                <p className="text-sm text-gray-400">Please check back later or contact us for more information.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {sections.products && (
        <ProductsSection 
          products={products}
          loading={loading}
          onViewAllProducts={() => navigate(`${basePath}/products`)}
          onProductClick={onProductClick}
        />
      )}
    </div>
  );
};
