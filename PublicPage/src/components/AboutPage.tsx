import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { StaffCard } from './StaffCard';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Staff } from '../lib/api';

export const AboutPage: React.FC = () => {
  const { tenantId, pageData, tenant } = useTenant();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const aboutUsData = pageData?.aboutUs;

  useEffect(() => {
    const loadStaff = async () => {
      if (!tenantId) return;
      try {
        setLoadingStaff(true);
        const response = await publicAPI.getStaff(tenantId);
        if (response.success && response.staff) {
          setStaff(response.staff);
        } else {
          setStaff([]);
        }
      } catch (error) {
        console.error('Failed to load staff for About Us:', error);
        setStaff([]); // Set empty array on error
      } finally {
        setLoadingStaff(false);
      }
    };
    loadStaff();
  }, [tenantId]);

  // Get facilities images from About Us data
  const galleryImages = aboutUsData?.facilitiesImages?.map((img: string) => {
    // Normalize image path
    const normalizedPath = img.startsWith('/uploads/') ? img : `/uploads/${img}`;
    return {
      url: `http://localhost:5000${normalizedPath}`,
      caption: 'Our Facility',
    };
  }) || [];

  const nextGallerySlide = () => {
    setGalleryIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevGallerySlide = () => {
    setGalleryIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextLightboxImage = () => {
    setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevLightboxImage = () => {
    setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  // Close lightbox on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) {
        closeLightbox();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [lightboxOpen]);

  const storyTitleMap: { [key: string]: string } = {
    'ourStory': 'Our Story',
    'aboutUs': 'About Us',
    'whoWeAre': 'Who We Are',
    'ourJourney': 'Our Journey',
  };

  const currentLocale = 'en'; // TODO: Get actual locale from context/i18n

  // Get banner from pageBanners field (dedicated column), then fallback to About Us hero image
  const aboutBanner = pageData?.pageBanners?.about;
  
  // Normalize banner image path
  const bannerImage = aboutBanner
    ? `http://localhost:5000${aboutBanner.startsWith('/uploads/') ? aboutBanner : `/uploads/${aboutBanner}`}`
    : null;
  
  // Hero image from About Us data (fallback)
  const heroImage = bannerImage || (aboutUsData?.heroImage 
    ? `http://localhost:5000${aboutUsData.heroImage.startsWith('/uploads/') ? aboutUsData.heroImage : `/uploads/${aboutUsData.heroImage}`}`
    : 'https://images.unsplash.com/photo-1754534128045-ea1cfd09fb8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzcGElMjBhbWJpYW5jZXxlbnwxfHx8fDE3NjQzNDkyOTJ8MA&ixlib=rb-4.1.0&q=80&w=1080');

  return (
    <div className="min-h-screen bg-gray-50 mb-8">
      {/* Hero Section */}
      {heroImage && (
        <div
          className="relative h-[400px] bg-cover bg-center flex items-center justify-center mb-16"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="page-container text-center">
            <h1 className="relative z-10 text-white">
              {storyTitleMap[aboutUsData.storyTitle || 'aboutUs'] || 'About Us'}
            </h1>
          </div>
        </div>
      )}

      <div className="page-container pb-20">
        {/* Our Story */}
        {aboutUsData?.storyEn && (
          <section className="mb-12 text-center">
            <h2 className="mb-6">{storyTitleMap[aboutUsData.storyTitle || 'ourStory'] || 'Our Story'}</h2>
            <p className="text-gray-700 max-w-3xl mx-auto leading-relaxed whitespace-pre-line">
              {currentLocale === 'en' ? aboutUsData.storyEn : aboutUsData.storyAr}
            </p>
          </section>
        )}

        {/* Our Mission */}
        {aboutUsData?.missions && aboutUsData.missions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-center mb-8">Our Mission</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {aboutUsData.missions.map((mission: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm text-center">
                  {mission.type === 'icon' && mission.iconName && (
                    <div className="mb-4 text-[var(--color-primary)]">
                      {/* Dynamically render Heroicon - simplified for now */}
                      <div className="w-12 h-12 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl">📋</span>
                      </div>
                    </div>
                  )}
                  {mission.type === 'image' && mission.imageUrl && (
                    <img 
                      src={`http://localhost:5000${mission.imageUrl}`} 
                      alt={mission.titleEn} 
                      className="w-24 h-24 object-cover rounded-full mx-auto mb-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="mb-2">{currentLocale === 'en' ? mission.titleEn : mission.titleAr}</h3>
                  <p className="text-gray-600 text-sm">{currentLocale === 'en' ? mission.detailsEn : mission.detailsAr}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Our Vision */}
        {aboutUsData?.visions && aboutUsData.visions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-center mb-8">Our Vision</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {aboutUsData.visions.map((vision: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm text-center">
                  {vision.type === 'icon' && vision.iconName && (
                    <div className="mb-4 text-[var(--color-primary)]">
                      <div className="w-12 h-12 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl">👁️</span>
                      </div>
                    </div>
                  )}
                  {vision.type === 'image' && vision.imageUrl && (
                    <img 
                      src={`http://localhost:5000${vision.imageUrl}`} 
                      alt={vision.titleEn} 
                      className="w-24 h-24 object-cover rounded-full mx-auto mb-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="mb-2">{currentLocale === 'en' ? vision.titleEn : vision.titleAr}</h3>
                  <p className="text-gray-600 text-sm">{currentLocale === 'en' ? vision.detailsEn : vision.detailsAr}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Our Values */}
        {aboutUsData?.values && aboutUsData.values.length > 0 && (
          <section className="mb-12">
            <h2 className="text-center mb-8">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {aboutUsData.values.map((value: any, index: number) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm text-center">
                  {value.type === 'icon' && value.iconName && (
                    <div className="mb-4 text-[var(--color-primary)]">
                      <div className="w-12 h-12 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                        <span className="text-2xl">💎</span>
                      </div>
                    </div>
                  )}
                  {value.type === 'image' && value.imageUrl && (
                    <img 
                      src={`http://localhost:5000${value.imageUrl}`} 
                      alt={value.titleEn} 
                      className="w-24 h-24 object-cover rounded-full mx-auto mb-4"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                  <h3 className="mb-2">{currentLocale === 'en' ? value.titleEn : value.titleAr}</h3>
                  <p className="text-gray-600 text-sm">{currentLocale === 'en' ? value.detailsEn : value.detailsAr}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Our Facilities */}
        {galleryImages.length > 0 && (
          <section className="mb-12">
            <h2 className="text-center mb-8">Our Facilities</h2>
            {aboutUsData?.facilitiesDescriptionEn && (
              <p className="text-gray-700 max-w-3xl mx-auto leading-relaxed text-center mb-8 whitespace-pre-line">
                {currentLocale === 'en' ? aboutUsData.facilitiesDescriptionEn : aboutUsData.facilitiesDescriptionAr}
              </p>
            )}
            
            {/* Photo Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryImages.map((image, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={image.url}
                    alt={`${image.caption} ${index + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                    style={{ minHeight: '100%', minWidth: '100%' }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                </div>
              ))}
            </div>

            {/* Lightbox Modal */}
            <AnimatePresence>
              {lightboxOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                  onClick={closeLightbox}
                >
                  {/* Close Button - Always visible at top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeLightbox();
                    }}
                    className="fixed top-6 right-6 z-[100] w-14 h-14 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-2 border-white/50"
                    aria-label="Close"
                    style={{ zIndex: 1000 }}
                  >
                    <X className="w-7 h-7 text-gray-900" strokeWidth={2.5} />
                  </button>

                  {/* Navigation Buttons */}
                  {galleryImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevLightboxImage();
                        }}
                        className="fixed left-6 top-1/2 -translate-y-1/2 z-[100] w-14 h-14 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-2 border-white/50"
                        aria-label="Previous image"
                        style={{ zIndex: 1000 }}
                      >
                        <ChevronLeft className="w-7 h-7 text-gray-900" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextLightboxImage();
                        }}
                        className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] w-14 h-14 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-2 border-white/50"
                        aria-label="Next image"
                        style={{ zIndex: 1000 }}
                      >
                        <ChevronRight className="w-7 h-7 text-gray-900" strokeWidth={2.5} />
                      </button>
                    </>
                  )}

                  {/* Image */}
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <img
                      src={galleryImages[lightboxIndex].url}
                      alt={galleryImages[lightboxIndex].caption}
                      className="max-w-full max-h-full object-contain rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </motion.div>

                  {/* Image Counter */}
                  {galleryImages.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                      <span className="text-white text-sm">
                        {lightboxIndex + 1} / {galleryImages.length}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Final Word */}
        {aboutUsData?.finalWordTitleEn && (
          <section className="mb-12 text-center">
            <div className="max-w-3xl mx-auto">
              {aboutUsData.finalWordType === 'icon' && aboutUsData.finalWordIconName && (
                <div className="mb-4 text-[var(--color-primary)]">
                  <div className="w-16 h-16 mx-auto bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center">
                    <span className="text-4xl">✨</span>
                  </div>
                </div>
              )}
              {aboutUsData.finalWordType === 'image' && aboutUsData.finalWordImageUrl && (
                <img 
                  src={`http://localhost:5000${aboutUsData.finalWordImageUrl}`} 
                  alt={aboutUsData.finalWordTitleEn} 
                  className="w-32 h-32 object-cover rounded-full mx-auto mb-4"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
              <h2 className="mb-4">{currentLocale === 'en' ? aboutUsData.finalWordTitleEn : aboutUsData.finalWordTitleAr}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {currentLocale === 'en' ? aboutUsData.finalWordTextEn : aboutUsData.finalWordTextAr}
              </p>
            </div>
          </section>
        )}

        {/* Staff Section */}
        {staff.length > 0 && (
          <section className="py-12 bg-white rounded-xl shadow-sm">
            <h2 className="text-center mb-8">Our Dedicated Team</h2>
            {loadingStaff ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {staff.map((member) => (
                  <StaffCard key={member.id} staff={member} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
