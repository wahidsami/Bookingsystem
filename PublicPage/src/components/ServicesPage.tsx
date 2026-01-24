import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Service } from '../lib/api';

interface ServicesPageProps {
  onServiceClick: (serviceId: string) => void;
}

export const ServicesPage: React.FC<ServicesPageProps> = ({ onServiceClick }) => {
  const { tenantId, slug, pageData } = useTenant();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<string>('all');
  const [durationRange, setDurationRange] = useState<string>('all');

  // Get banner from pageBanners field (dedicated column)
  const servicesBanner = pageData?.pageBanners?.services;
  const bannerImage = servicesBanner
    ? `http://localhost:5000${servicesBanner.startsWith('/uploads/') ? servicesBanner : `/uploads/${servicesBanner}`}`
    : null;

  useEffect(() => {
    const loadServices = async () => {
      if (!tenantId) return;

      try {
        setLoading(true);
        const response = await publicAPI.getServices(tenantId, {});
        if (response.success) {
          setServices(response.services || []);
        } else {
          setServices([]);
        }
      } catch (error) {
        console.error('Failed to load services:', error);
        setServices([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadServices();
  }, [tenantId]);

  const categories = ['all', ...Array.from(new Set(services.map((s) => s.category)))];

  const filteredServices = services.filter((service) => {
    const categoryMatch = selectedCategory === 'all' || service.category === selectedCategory;
    
    const priceMatch =
      priceRange === 'all' ||
      (priceRange === 'low' && service.finalPrice < 300) ||
      (priceRange === 'medium' && service.finalPrice >= 300 && service.finalPrice < 400) ||
      (priceRange === 'high' && service.finalPrice >= 400);
    
    const durationMatch =
      durationRange === 'all' ||
      (durationRange === 'short' && service.duration < 60) ||
      (durationRange === 'medium' && service.duration >= 60 && service.duration < 80) ||
      (durationRange === 'long' && service.duration >= 80);

    return categoryMatch && priceMatch && durationMatch;
  });

  const basePath = `/t/${slug}`;

  return (
    <div className="min-h-screen bg-gray-50 mb-8">
      {bannerImage ? (
        <div
          className="relative h-[400px] bg-cover bg-center flex items-center justify-center mb-16"
          style={{ backgroundImage: `url(${bannerImage})` }}
        >
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="page-container text-center relative z-10">
            <h1 className="mb-4 text-white">Our Services</h1>
            <p className="text-xl text-white/90">
              Choose from our extensive menu of premium treatments
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white py-20 mb-16">
          <div className="page-container text-center">
            <h1 className="mb-4 text-white">Our Services</h1>
            <p className="text-xl text-white/90">
              Choose from our extensive menu of premium treatments
            </p>
          </div>
        </div>
      )}

      <div className="page-container pb-20">
        <div className="bg-white rounded-2xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-[var(--color-primary)]" />
            <h3>Filter Services</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Price Range</label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="all">All Prices</option>
                <option value="low">Under 300 SAR</option>
                <option value="medium">300-400 SAR</option>
                <option value="high">400+ SAR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">Duration</label>
              <select
                value={durationRange}
                onChange={(e) => setDurationRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="all">All Durations</option>
                <option value="short">Under 60 mins</option>
                <option value="medium">60-80 mins</option>
                <option value="long">80+ mins</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading services...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-600">
                Showing {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'}
              </p>
            </div>

            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredServices.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onClick={() => navigate(`${basePath}/services/${service.id}`)}
                  />
                ))}
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg mb-2">No services available at the moment.</p>
                <p className="text-sm text-gray-400">Please check back later or contact us for more information.</p>
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg mb-2">No services found matching your filters.</p>
                <p className="text-sm text-gray-400 mb-4">Try adjusting your filter criteria.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange('all');
                    setDurationRange('all');
                  }}
                  className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
