import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Phone, ShoppingBag, User, LogOut } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { LoginModal } from './LoginModal';

interface HeaderProps {
  onCartClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onCartClick }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { getCartCount } = useCart();
  const { tenant, slug } = useTenant();
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const cartCount = getCartCount();

  const basePath = `/t/${slug}`;
  const currentPath = location.pathname;

  // Get logo from generalSettings first (public page specific), then fallback to tenant logo
  const { pageData } = useTenant();
  const publicPageLogo = pageData?.generalSettings?.logo;
  const tenantLogoRaw = publicPageLogo || tenant?.logo || tenant?.profileImage;
  
  // Normalize logo path - handle both formats:
  // 1. Absolute: /uploads/tenants/logos/filename
  // 2. Relative: tenants/logos/filename (from registration)
  const tenantLogo = tenantLogoRaw 
    ? (tenantLogoRaw.startsWith('/uploads/') 
        ? tenantLogoRaw 
        : tenantLogoRaw.startsWith('/') 
          ? `/uploads${tenantLogoRaw}` 
          : `/uploads/${tenantLogoRaw}`)
    : null;
  const tenantName = tenant?.name_en || tenant?.name || 'Business';
  const tenantPhone = tenant?.phone || tenant?.mobile || '';

  return (
    <header className="header-container bg-white shadow-sm sticky top-0 z-40">
      <div className="page-container">
        <div className="flex items-center justify-between h-20">
          <Link
            to={basePath}
            className="flex items-center group"
          >
            {tenantLogo ? (
              <img 
                src={`http://localhost:5000${tenantLogo}`}
                alt={tenantName}
                className="h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  // Fallback to text if image fails
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('.logo-fallback')) {
                    const fallback = document.createElement('div');
                    fallback.className = 'logo-fallback text-xl font-bold text-[var(--color-primary)]';
                    fallback.textContent = tenantName.charAt(0).toUpperCase();
                    parent.appendChild(fallback);
                  }
                }}
              />
            ) : (
              <div className="h-16 flex items-center">
                <span className="text-xl font-bold text-[var(--color-primary)]">
                  {tenantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to={basePath}
              className={`hover:text-[var(--color-primary)] transition-colors duration-300 ${
                currentPath === basePath ? 'text-[var(--color-primary)]' : ''
              }`}
            >
              Home
            </Link>
            <Link
              to={`${basePath}/services`}
              className={`hover:text-[var(--color-primary)] transition-colors duration-300 ${
                currentPath.startsWith(`${basePath}/services`) ? 'text-[var(--color-primary)]' : ''
              }`}
            >
              Services
            </Link>
            <Link
              to={`${basePath}/products`}
              className={`hover:text-[var(--color-primary)] transition-colors duration-300 ${
                currentPath.startsWith(`${basePath}/products`) ? 'text-[var(--color-primary)]' : ''
              }`}
            >
              Products
            </Link>
            <Link
              to={`${basePath}/about`}
              className={`hover:text-[var(--color-primary)] transition-colors duration-300 ${
                currentPath.startsWith(`${basePath}/about`) ? 'text-[var(--color-primary)]' : ''
              }`}
            >
              About
            </Link>
            <Link
              to={`${basePath}/contact`}
              className={`hover:text-[var(--color-primary)] transition-colors duration-300 ${
                currentPath.startsWith(`${basePath}/contact`) ? 'text-[var(--color-primary)]' : ''
              }`}
            >
              Contact
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-6">
            {tenantPhone && (
              <a
                href={`tel:${tenantPhone}`}
                className="flex items-center gap-2 text-[var(--color-primary)]"
              >
                <Phone className="w-5 h-5" />
                <span>{tenantPhone}</span>
              </a>
            )}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/20 transition-colors"
                >
                  {user.photo ? (
                    <img
                      src={user.photo.startsWith('/') ? `http://localhost:5000${user.photo}` : `http://localhost:5000/uploads/${user.photo}`}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center hidden">
                    <span className="text-[var(--color-primary)] font-semibold text-sm">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </span>
                  </div>
                  <span className="font-medium hidden sm:inline">
                    {user.firstName} {user.lastName}
                  </span>
                  <User className="w-4 h-4" />
                </button>
                
                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                    <a
                      href="http://localhost:3000/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      My Dashboard
                    </a>
                    <a
                      href="http://localhost:3000/dashboard/bookings"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      My Bookings
                    </a>
                    <a
                      href="http://localhost:3000/dashboard/purchases"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      My Purchases
                    </a>
                    <a
                      href="http://localhost:3000/dashboard/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Profile
                    </a>
                    <hr className="my-2" />
                    <button
                      onClick={async () => {
                        await logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            <button
              onClick={onCartClick}
              className="relative p-2 hover:bg-gray-100 rounded-full transition-colors duration-300"
            >
              <ShoppingBag className="w-6 h-6 text-[var(--color-primary)]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-primary)] text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={onCartClick}
              className="relative p-2"
            >
              <ShoppingBag className="w-6 h-6 text-[var(--color-primary)]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-primary)] text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col gap-4">
              <Link
                to={basePath}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-left py-2 hover:text-[var(--color-primary)] transition-colors duration-300 ${
                  currentPath === basePath ? 'text-[var(--color-primary)]' : ''
                }`}
              >
                Home
              </Link>
              <Link
                to={`${basePath}/services`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-left py-2 hover:text-[var(--color-primary)] transition-colors duration-300 ${
                  currentPath.startsWith(`${basePath}/services`) ? 'text-[var(--color-primary)]' : ''
                }`}
              >
                Services
              </Link>
              <Link
                to={`${basePath}/products`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-left py-2 hover:text-[var(--color-primary)] transition-colors duration-300 ${
                  currentPath.startsWith(`${basePath}/products`) ? 'text-[var(--color-primary)]' : ''
                }`}
              >
                Products
              </Link>
              <Link
                to={`${basePath}/about`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-left py-2 hover:text-[var(--color-primary)] transition-colors duration-300 ${
                  currentPath.startsWith(`${basePath}/about`) ? 'text-[var(--color-primary)]' : ''
                }`}
              >
                About
              </Link>
              <Link
                to={`${basePath}/contact`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-left py-2 hover:text-[var(--color-primary)] transition-colors duration-300 ${
                  currentPath.startsWith(`${basePath}/contact`) ? 'text-[var(--color-primary)]' : ''
                }`}
              >
                Contact
              </Link>
              {tenantPhone && (
                <a
                  href={`tel:${tenantPhone}`}
                  className="flex items-center gap-2 py-2 text-[var(--color-primary)]"
                >
                  <Phone className="w-5 h-5" />
                  <span>{tenantPhone}</span>
                </a>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => {
            setShowLoginModal(false);
          }}
        />
      )}
    </header>
  );
};
