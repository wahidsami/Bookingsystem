import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Search, Loader2 } from 'lucide-react';
import { publicAPI, Tenant } from '../lib/api';

export const TenantListPage: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await publicAPI.getAllTenants();
      if (response.success && response.tenants) {
        setTenants(response.tenants);
      } else {
        setError('Failed to load tenants');
      }
    } catch (err: any) {
      console.error('Failed to load tenants:', err);
      setError(err.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const searchLower = searchTerm.toLowerCase();
    return (
      tenant.name_en?.toLowerCase().includes(searchLower) ||
      tenant.name_ar?.toLowerCase().includes(searchLower) ||
      tenant.slug?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[var(--color-primary)] mx-auto mb-4" />
          <p className="text-gray-600">Loading tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-700 font-semibold mb-2">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={loadTenants}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Browse Our Partners
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover amazing salons, spas, and beauty services. Click on any partner to view their services and book an appointment.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>
        </div>

        {/* Tenants Grid */}
        {filteredTenants.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">
              {searchTerm ? 'No tenants found matching your search.' : 'No tenants available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTenants.map((tenant) => (
              <Link
                key={tenant.id}
                to={`/t/${tenant.slug}`}
                className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                <div className="p-6">
                  {/* Tenant Logo/Image */}
                  <div className="mb-4 h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {(tenant as any).logo || (tenant as any).profileImage ? (
                      <img
                        src={`http://localhost:5000/uploads/${(tenant as any).logo || (tenant as any).profileImage}`}
                        alt={tenant.name_en || tenant.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/10 flex items-center justify-center">
                        <Building2 className="w-12 h-12 text-[var(--color-primary)]" />
                      </div>
                    )}
                  </div>

                  {/* Tenant Info */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[var(--color-primary)] transition-colors">
                    {tenant.name_en || tenant.name}
                  </h3>
                  {tenant.name_ar && (
                    <p className="text-sm text-gray-500 mb-3">{tenant.name_ar}</p>
                  )}
                  {tenant.description_en && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {tenant.description_en}
                    </p>
                  )}

                  {/* View Button */}
                  <div className="flex items-center text-[var(--color-primary)] font-semibold group-hover:gap-2 transition-all">
                    <span>View Services</span>
                    <svg
                      className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
