import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Mail, MapPin, Clock, CheckCircle, Instagram, Facebook, Twitter, Linkedin, Youtube, Video, MessageCircle, Send } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { publicAPI } from '../lib/api';

export const ContactPage: React.FC = () => {
  const { tenant, tenantId, pageData } = useTenant();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      setSubmitError('Tenant ID is missing.');
      return;
    }

    setLoading(true);
    setSubmitError(null);
    setIsSubmitted(false);

    try {
      const response = await publicAPI.submitContactForm(tenantId, {
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject,
        message: formData.message,
      });

      if (response.success) {
        setIsSubmitted(true);
        setFormData({ fullName: '', email: '', phone: '', subject: '', message: '' });
        setTimeout(() => {
          setIsSubmitted(false);
        }, 5000);
      } else {
        setSubmitError(response.message || 'Failed to send message.');
      }
    } catch (error: any) {
      setSubmitError(error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Build address string from tenant data
  const addressParts = [
    tenant?.buildingNumber,
    tenant?.street,
    tenant?.district,
    tenant?.city,
    tenant?.country
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ') || 'Address not provided';

  // Contact information from tenant data
  const contactCards = [
    {
      icon: Phone,
      title: 'Phone',
      value: tenant?.phone || tenant?.mobile || 'Not provided',
      description: 'Call us for appointments and inquiries',
      link: tenant?.phone || tenant?.mobile ? `tel:${tenant.phone || tenant.mobile}` : '#',
      show: !!(tenant?.phone || tenant?.mobile),
    },
    {
      icon: Mail,
      title: 'Email',
      value: tenant?.email || 'Not provided',
      description: 'Reach us anytime via email',
      link: tenant?.email ? `mailto:${tenant.email}` : '#',
      show: !!tenant?.email,
    },
    {
      icon: MapPin,
      title: 'Location',
      value: fullAddress,
      description: 'Visit our center',
      link: tenant?.googleMapLink || '#map',
      show: !!fullAddress && fullAddress !== 'Address not provided',
    },
  ].filter(card => card.show);

  // Social media links from tenant data - only show icons that have actual URLs/numbers
  const socialLinks = [
    { url: tenant?.facebookUrl, icon: Facebook, name: 'Facebook' },
    { url: tenant?.instagramUrl, icon: Instagram, name: 'Instagram' },
    { url: tenant?.twitterUrl, icon: Twitter, name: 'Twitter' },
    { url: tenant?.linkedinUrl, icon: Linkedin, name: 'LinkedIn' },
    { url: tenant?.youtubeUrl, icon: Youtube, name: 'YouTube' },
    { url: tenant?.tiktokUrl, icon: Video, name: 'TikTok' }, // Using Video icon as fallback since Tiktok icon doesn't exist in lucide-react
    { url: tenant?.snapchatUrl, icon: MessageCircle, name: 'Snapchat' }, // Using MessageCircle icon as fallback since Snapchat icon doesn't exist in lucide-react
    { url: tenant?.pinterestUrl, icon: Instagram, name: 'Pinterest' }, // Using Instagram icon as fallback since Pinterest icon doesn't exist in lucide-react
    { url: tenant?.whatsappNumber, icon: Send, name: 'WhatsApp', isWhatsApp: true },
  ].filter(link => link.url && link.url.trim() !== ''); // Only show social media icons that have non-empty URLs/numbers

  // Working hours from tenant data
  const formatTime = (time: string) => {
    if (!time) return '';
    // Convert 24h format (HH:MM) to 12h format (HH:MM AM/PM)
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getDayName = (dayKey: string, locale: string = 'en') => {
    const dayNames: { [key: string]: { en: string; ar: string } } = {
      sunday: { en: 'Sunday', ar: 'الأحد' },
      monday: { en: 'Monday', ar: 'الإثنين' },
      tuesday: { en: 'Tuesday', ar: 'الثلاثاء' },
      wednesday: { en: 'Wednesday', ar: 'الأربعاء' },
      thursday: { en: 'Thursday', ar: 'الخميس' },
      friday: { en: 'Friday', ar: 'الجمعة' },
      saturday: { en: 'Saturday', ar: 'السبت' },
    };
    return dayNames[dayKey]?.[locale as 'en' | 'ar'] || dayKey;
  };

  // Process working hours from tenant data
  const workingHoursData = tenant?.workingHours || {};
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const workingHours = daysOfWeek.map(dayKey => {
    const dayData = workingHoursData[dayKey] || { isOpen: false, open: '09:00', close: '21:00' };
    return {
      day: dayKey,
      dayName: getDayName(dayKey, 'en'),
      dayNameAr: getDayName(dayKey, 'ar'),
      isOpen: dayData.isOpen !== false,
      open: dayData.open || '09:00',
      close: dayData.close || '21:00',
    };
  });

  // Get banner from pageBanners field (dedicated column), then fallback to About Us hero image or default
  const contactBanner = pageData?.pageBanners?.contact;
  const bannerImage = contactBanner
    ? `http://localhost:5000${contactBanner.startsWith('/uploads/') ? contactBanner : `/uploads/${contactBanner}`}`
    : null;
  
  // Hero image from About Us page data or default (fallback)
  const heroImage = bannerImage || (pageData?.aboutUs?.heroImage 
    ? `http://localhost:5000${pageData.aboutUs.heroImage}`
    : 'https://images.unsplash.com/photo-1619695662967-3e739a597f47?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGElMjBjYW5kbGVzJTIwcmVsYXhhdGlvbnxlbnwxfHx8fDE3NjQzMzQxMDB8MA&ixlib=rb-4.1.0&q=80&w=1080');

  return (
    <div className="min-h-screen bg-gray-50 mb-8">
      <div
        className="relative h-[400px] bg-cover bg-center mb-16"
        style={{ backgroundImage: `url('${heroImage}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40"></div>
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div className="page-container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-white mb-4">Contact Us</h1>
              <p className="text-white/90 text-xl">We're here to help you relax, unwind, and enjoy.</p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="page-container pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Get in Touch</h2>
              <p className="text-gray-600 leading-relaxed text-lg">
                Have questions or need assistance? Our team is here to help. Feel free to contact us through any of the methods below.
              </p>
            </div>

            {/* Contact Cards */}
            <div className="space-y-4">
              {contactCards.map((card, index) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 border border-gray-100"
                  >
                    <div className="p-3 bg-[var(--color-primary)]/10 rounded-full flex-shrink-0">
                      <Icon className="w-6 h-6 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{card.title}</h3>
                      <a 
                        href={card.link} 
                        className="text-[var(--color-primary)] hover:underline font-medium block mb-1"
                      >
                        {card.value}
                      </a>
                      <p className="text-sm text-gray-500">{card.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Social Media */}
            {socialLinks.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Follow Us</h3>
                <div className="flex gap-4 flex-wrap">
                  {socialLinks.map((link, index) => {
                    const Icon = link.icon;
                    const href = link.isWhatsApp && link.url 
                      ? `https://wa.me/${link.url.replace(/[^0-9]/g, '')}`
                      : link.url || '#';
                    return (
                      <a
                        key={index}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-gray-50 rounded-lg text-gray-600 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all duration-300"
                        aria-label={link.name}
                      >
                        <Icon className="w-6 h-6" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Working Hours */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
                  <Clock className="w-6 h-6 text-[var(--color-primary)]" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Opening Hours</h3>
              </div>
              <div className="space-y-2">
                {workingHours.map((day) => {
                  // Map day names to JavaScript getDay() values (0=Sunday, 1=Monday, etc.)
                  const dayIndexMap: { [key: string]: number } = {
                    sunday: 0,
                    monday: 1,
                    tuesday: 2,
                    wednesday: 3,
                    thursday: 4,
                    friday: 5,
                    saturday: 6,
                  };
                  const isToday = new Date().getDay() === dayIndexMap[day.day];
                  return (
                    <div
                      key={day.day}
                      className={`flex items-center justify-between p-3 rounded-lg transition-colors duration-200 ${
                        isToday 
                          ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`font-medium ${isToday ? 'text-[var(--color-primary)]' : 'text-gray-700'}`}>
                          {day.dayName}
                        </span>
                        {isToday && (
                          <span className="text-xs px-2 py-1 bg-[var(--color-primary)] text-white rounded-full font-medium">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {day.isOpen ? (
                          <span className={`font-semibold ${isToday ? 'text-[var(--color-primary)]' : 'text-gray-900'}`}>
                            {formatTime(day.open)} - {formatTime(day.close)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">Closed</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Send Us a Message</h2>
            <p className="text-gray-600 mb-6">Fill out the form below and we'll get back to you as soon as possible.</p>
            {isSubmitted && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Your message has been sent successfully!
              </motion.div>
            )}
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"
              >
                {submitError}
              </motion.div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200"
                  placeholder="+966 50 123 4567"
                />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all duration-200"
                  placeholder="What is your message about?"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-none transition-all duration-200"
                  placeholder="Tell us how we can help you..."
                ></textarea>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-8 py-4 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Map Section */}
      {tenant?.googleMapLink && (
        <section id="map" className="bg-gray-50 py-16 border-t border-gray-200">
          <div className="page-container">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Find Us on the Map</h2>
              <p className="text-gray-600 text-lg">Visit our location or get directions</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
              <div className="h-96 bg-gray-200 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200"></div>
                <div className="relative z-10 text-center">
                  <MapPin className="w-16 h-16 text-[var(--color-primary)] mx-auto mb-4" />
                  <a
                    href={tenant.googleMapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-all duration-300 shadow-lg hover:shadow-xl font-semibold"
                  >
                    <MapPin className="w-5 h-5" />
                    View on Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
