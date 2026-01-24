import React from 'react';
import { Clock, Star } from 'lucide-react';
import { Service } from '../lib/api';
import { Currency } from './Currency';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
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
    <div
      onClick={onClick}
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
    >
      <div className="relative h-64 overflow-hidden bg-gray-200">
        {serviceImage ? (
          <img
            src={serviceImage}
            alt={serviceName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20">
            <span className="text-4xl text-[var(--color-primary)] opacity-50">
              {serviceName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
          <Star className="w-4 h-4 fill-[var(--color-gold)] text-[var(--color-gold)]" />
          <span className="text-sm">{rating}</span>
        </div>
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h4 className="flex-1">{serviceName}</h4>
        </div>
        <p className="text-gray-600 mb-4 line-clamp-2">{serviceDescription}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{service.duration} mins</span>
          </div>
          <div className="text-[var(--color-primary)]">
            From <span className="text-xl"><Currency amount={service.finalPrice || 0} /></span>
          </div>
        </div>
      </div>
    </div>
  );
};
