import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Star, DollarSign, ChevronLeft } from 'lucide-react';
import { StaffCard } from './StaffCard';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Service, Staff } from '../lib/api';
import { Currency } from './Currency';

interface ServiceDetailPageProps {
  onBookNow?: (serviceId: string) => void;
}

export const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({
  onBookNow,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId, slug } = useTenant();
  const [service, setService] = useState<Service | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadService = async () => {
      if (!tenantId || !id) return;

      try {
        setLoading(true);
        const [serviceRes, staffRes] = await Promise.all([
          publicAPI.getService(tenantId, id),
          publicAPI.getStaff(tenantId)
        ]);

        if (serviceRes.success) {
          setService(serviceRes.service);
        }
        if (staffRes.success) {
          setStaff(staffRes.staff);
        }
      } catch (error) {
        console.error('Failed to load service:', error);
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [tenantId, id]);

  const basePath = `/t/${slug}`;

  if (loading) {
    return (
      <div className="main-content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading service...</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="main-content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Service not found</p>
          <button
            onClick={() => navigate(`${basePath}/services`)}
            className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-full"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const serviceName = service.name_en || service.name_ar || 'Service';
  const serviceDescription = service.description_en || service.description_ar || '';
  
  // Normalize image path - handle different formats:
  // 1. Absolute: /uploads/tenants/services/filename
  // 2. Relative with slash: /tenants/services/filename
  // 3. Relative without slash: tenants/services/filename
  const serviceImageRaw = service.image;
  const serviceImage = serviceImageRaw 
    ? `http://localhost:5000${serviceImageRaw.startsWith('/uploads/') 
        ? serviceImageRaw 
        : serviceImageRaw.startsWith('/') 
          ? `/uploads${serviceImageRaw}` 
          : `/uploads/${serviceImageRaw}`}`
    : null;
  
  const rating = typeof service.rating === 'number' ? service.rating.toFixed(1) : '5.0';

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="relative h-96 bg-cover bg-center mb-16"
        style={{ backgroundImage: serviceImage ? `url(${serviceImage})` : 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <button
          onClick={() => navigate(`${basePath}/services`)}
          className="absolute top-8 left-8 z-20 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all duration-300"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <div className="relative z-10 h-full flex items-end">
          <div className="page-container pb-12 text-white">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-6 h-6 fill-[var(--color-gold)] text-[var(--color-gold)]" />
              <span className="text-xl">{rating}</span>
            </div>
            <h1 className="text-white mb-4">{serviceName}</h1>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{service.duration} minutes</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                <span>From <Currency amount={service.finalPrice || 0} /></span>
              </div>
              {service.category && (
                <div className="px-4 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                  {service.category}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-container pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-md p-8 mb-8">
              <h2 className="mb-6">About This Treatment</h2>
              <p className="text-gray-700 leading-relaxed mb-6 whitespace-pre-line">{serviceDescription}</p>
              
              {service.whatToExpect && service.whatToExpect.length > 0 && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="mb-4">What to Expect</h3>
                  <ul className="space-y-3 text-gray-700">
                    {service.whatToExpect.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full mt-2 flex-shrink-0"></span>
                        <span>{item.en || item.ar}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {service.benefits && service.benefits.length > 0 && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="mb-4">Benefits</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {service.benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Star className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <span className="text-gray-700">{benefit.en || benefit.ar}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {staff.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md p-8">
                <h2 className="mb-6">Our Expert Therapists</h2>
                <p className="text-gray-600 mb-6">
                  Choose from our certified professionals or let us select the best match for you
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {staff.slice(0, 4).map((member) => (
                    <StaffCard key={member.id} staff={member} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md p-8 sticky top-8">
              <h3 className="mb-6">Book This Treatment</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-gray-600">Duration</span>
                  <span>{service.duration} minutes</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                  <span className="text-gray-600">Price</span>
                  <span className="text-xl text-[var(--color-primary)]"><Currency amount={service.finalPrice || 0} /></span>
                </div>
                {service.category && (
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="text-gray-600">Category</span>
                    <span>{service.category}</span>
                  </div>
                )}
                {(service.availableInCenter || service.availableHomeVisit) && (
                  <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <span className="text-gray-600">Availability</span>
                    <div className="flex gap-2">
                      {service.availableInCenter && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">In Center</span>
                      )}
                      {service.availableHomeVisit && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Home Visit</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => onBookNow ? onBookNow(service.id) : navigate(`${basePath}/services`)}
                className="w-full px-6 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Book Now
              </button>
              <p className="text-sm text-gray-500 text-center mt-4">
                {service.availableInCenter && service.availableHomeVisit 
                  ? 'Available for in-center and home visit services'
                  : service.availableInCenter 
                    ? 'Available for in-center services'
                    : service.availableHomeVisit
                      ? 'Available for home visit services'
                      : 'Contact us for availability'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
