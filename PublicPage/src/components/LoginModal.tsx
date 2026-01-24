/**
 * Login Modal Component for PublicPage
 * Allows users to login without leaving the tenant page
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void; // Optional callback after successful login
  showRegisterLink?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  showRegisterLink = true 
}) => {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login with skipRedirect to stay on current page
      await login(formData.email.trim(), formData.password, { skipRedirect: true });
      
      // Wait a bit for auth state to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reset form
      setFormData({ email: '', password: '' });
      
      // Close modal first
      onClose();
      
      // Then call onSuccess callback (parent can handle what to do next)
      if (onSuccess) {
        // Small delay to ensure modal is closed
        setTimeout(() => {
          onSuccess();
        }, 100);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-scale-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="text-3xl font-bold text-[var(--color-primary)]">Rifah</div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-primary)] mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Sign in to your account to continue
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 text-left">
            <p className="font-semibold mb-1">🔒 Login Required</p>
            <p className="text-xs">Please sign in to book appointments or purchase products. Your bookings and purchases will be saved to your account and synced across all your devices.</p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="modal-email" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Email
            </label>
            <input
              id="modal-email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="ahmed@example.com"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 mb-1 text-left">
              Password
            </label>
            <input
              id="modal-password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.location.href = 'http://localhost:3000/forgot-password';
              }}
              className="text-sm text-[var(--color-primary)] hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-primary)] text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Register Link */}
        {showRegisterLink && (
          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  // Store current page to return after registration
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('rifah_return_after_register', window.location.href);
                  }
                  // Navigate to register page
                  window.location.href = 'http://localhost:3000/register';
                }}
                className="text-[var(--color-primary)] font-semibold hover:underline"
              >
                Register
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
