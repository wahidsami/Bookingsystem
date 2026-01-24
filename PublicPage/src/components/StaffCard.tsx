import React from 'react';
import { Star } from 'lucide-react';
import { Staff } from '../lib/api';

interface StaffCardProps {
  staff: Staff;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export const StaffCard: React.FC<StaffCardProps> = ({ staff, selectable, selected, onSelect }) => {
  const staffName = staff.name || 'Staff Member';
  
  // Normalize image path - handle different formats:
  // 1. Absolute: /uploads/tenants/staff/filename
  // 2. Relative with slash: /tenants/staff/filename
  // 3. Relative without slash: tenants/staff/filename
  const staffImageRaw = staff.image;
  const staffImage = staffImageRaw 
    ? `http://localhost:5000${staffImageRaw.startsWith('/uploads/') 
        ? staffImageRaw 
        : staffImageRaw.startsWith('/') 
          ? `/uploads${staffImageRaw}` 
          : `/uploads/${staffImageRaw}`}`
    : null;
  
  const rating = typeof staff.rating === 'number' ? staff.rating.toFixed(1) : '5.0';
  const specialties = Array.isArray(staff.skills) ? staff.skills : [];
  const specialty = staff.specialty || (specialties.length > 0 ? specialties[0] : '');

  const CardContent = () => (
    <>
      <div className="relative h-72 overflow-hidden bg-gray-200">
        {staffImage ? (
          <img
            src={staffImage}
            alt={staffName}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20">
            <span className="text-4xl text-[var(--color-primary)] opacity-50">
              {staffName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
          <h4 className="text-white mb-1">{staffName}</h4>
          {specialty && <p className="text-sm text-white/90">{specialty}</p>}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Star className="w-5 h-5 fill-[var(--color-gold)] text-[var(--color-gold)]" />
            <span>{rating}</span>
          </div>
        </div>
        {specialties.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {specialties.slice(0, 3).map((skill: any, index: number) => {
              const skillName = typeof skill === 'string' ? skill : (skill?.en || skill?.name || '');
              if (!skillName) return null;
              return (
                <span
                  key={index}
                  className="px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-sm"
                >
                  {skillName}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  if (selectable) {
    return (
      <div
        onClick={onSelect}
        className={`cursor-pointer bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
          selected ? 'ring-4 ring-[var(--color-primary)]' : ''
        }`}
      >
        <CardContent />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
      <CardContent />
    </div>
  );
};
