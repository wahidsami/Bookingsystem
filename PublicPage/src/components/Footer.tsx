import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Linkedin, Youtube, Video, MessageCircle } from 'lucide-react';
import { useTenant } from '../context/TenantContext';

interface FooterProps {
  onNavigate?: (page: 'home' | 'services' | 'products' | 'about' | 'contact') => void;
}

export const Footer: React.FC<FooterProps> = () => {
  const { tenant, slug } = useTenant();
  const basePath = `/t/${slug}`;

  // Get logo from generalSettings first (public page specific), then fallback to tenant logo
  const { pageData } = useTenant();
  const publicPageLogo = pageData?.generalSettings?.logo;
  const tenantLogoRaw = publicPageLogo || tenant?.logo || tenant?.profileImage;
  
  // Normalize logo path - handle both formats
  const tenantLogo = tenantLogoRaw 
    ? (tenantLogoRaw.startsWith('/uploads/') 
        ? tenantLogoRaw 
        : tenantLogoRaw.startsWith('/') 
          ? `/uploads${tenantLogoRaw}` 
          : `/uploads/${tenantLogoRaw}`)
    : null;
  const tenantName = tenant?.name_en || tenant?.name || 'Business';
  const tenantPhone = tenant?.phone || tenant?.mobile || '';
  const tenantEmail = tenant?.email || '';
  
  // Build address string
  const addressParts = [
    tenant?.buildingNumber,
    tenant?.street,
    tenant?.district,
    tenant?.city,
    tenant?.country
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  // Social media links - only show icons that have actual URLs
  const socialLinks = [
    { url: tenant?.facebookUrl, icon: Facebook, name: 'Facebook' },
    { url: tenant?.instagramUrl, icon: Instagram, name: 'Instagram' },
    { url: tenant?.twitterUrl, icon: Twitter, name: 'Twitter' },
    { url: tenant?.linkedinUrl, icon: Linkedin, name: 'LinkedIn' },
    { url: tenant?.youtubeUrl, icon: Youtube, name: 'YouTube' },
    { url: tenant?.tiktokUrl, icon: Video, name: 'TikTok' }, // Using Video icon as fallback since Tiktok icon doesn't exist in lucide-react
    { url: tenant?.snapchatUrl, icon: MessageCircle, name: 'Snapchat' }, // Using MessageCircle icon as fallback since Snapchat icon doesn't exist in lucide-react
    { url: tenant?.pinterestUrl, icon: Instagram, name: 'Pinterest' }, // Using Instagram icon as fallback since Pinterest icon doesn't exist in lucide-react
  ].filter(link => link.url && link.url.trim() !== ''); // Only show social media icons that have non-empty URLs
  return (
    <footer className="footer-container bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16 mt-8">
      <div className="page-container">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            {tenantLogo ? (
              <img 
                src={`http://localhost:5000${tenantLogo}`}
                alt={tenantName}
                className="h-20 w-auto object-contain mb-4 brightness-0 invert"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            ) : (
              <div className="h-20 flex items-center mb-4">
                <span className="text-2xl font-bold text-white">
                  {tenantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <p className="text-gray-300 mb-4">
              {tenant?.name_en || tenant?.name || 'Welcome to our business'}
            </p>
            {socialLinks.length > 0 && (
              <div className="flex gap-4 flex-wrap">
                {socialLinks.map((link, index) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={index}
                      href={link.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-[var(--color-primary)] transition-colors duration-300"
                      aria-label={link.name}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-white mb-6">Contact Us</h4>
            {tenantPhone || tenantEmail || fullAddress ? (
              <div className="space-y-3">
                {tenantPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
                    <div>
                      <a href={`tel:${tenantPhone}`} className="text-gray-300 hover:text-[var(--color-primary)]">
                        {tenantPhone}
                      </a>
                      {tenant?.mobile && tenant.mobile !== tenantPhone && (
                        <a href={`tel:${tenant.mobile}`} className="block text-gray-300 hover:text-[var(--color-primary)]">
                          {tenant.mobile}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {tenantEmail && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
                    <a href={`mailto:${tenantEmail}`} className="text-gray-300 hover:text-[var(--color-primary)]">
                      {tenantEmail}
                    </a>
                  </div>
                )}
                {fullAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
                    <p className="text-gray-300">{fullAddress}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Contact information not available</p>
            )}
          </div>

          <div>
            <h4 className="text-white mb-6">Quick Links</h4>
            <div className="space-y-3">
              <Link
                to={basePath}
                className="block text-gray-300 hover:text-[var(--color-primary)] transition-colors duration-300"
              >
                Home
              </Link>
              <Link
                to={`${basePath}/services`}
                className="block text-gray-300 hover:text-[var(--color-primary)] transition-colors duration-300"
              >
                Services
              </Link>
              <Link
                to={`${basePath}/products`}
                className="block text-gray-300 hover:text-[var(--color-primary)] transition-colors duration-300"
              >
                Products
              </Link>
              <Link
                to={`${basePath}/about`}
                className="block text-gray-300 hover:text-[var(--color-primary)] transition-colors duration-300"
              >
                About Us
              </Link>
              <Link
                to={`${basePath}/contact`}
                className="block text-gray-300 hover:text-[var(--color-primary)] transition-colors duration-300"
              >
                Contact
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-white mb-6">Opening Hours</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">Saturday - Thursday</p>
                  <p className="text-[var(--color-primary)]">11:00 AM - 12:00 AM</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">Friday</p>
                  <p className="text-[var(--color-primary)]">1:00 PM - 12:00 AM</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-700 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} {tenantName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
