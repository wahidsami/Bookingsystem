import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { useNavigate } from 'react-router-dom';

interface HeroSliderProps {
  onBookNowClick: () => void;
  onExploreClick: () => void;
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ onBookNowClick, onExploreClick }) => {
  const { pageData, slug } = useTenant();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroSliders = pageData?.heroSliders || [];
  
  // Debug: Log hero slider data (only once when data changes)
  React.useEffect(() => {
    if (heroSliders.length > 0) {
      console.log('Hero Sliders Data:', heroSliders);
      heroSliders.forEach((slide, index) => {
        console.log(`Slide ${index + 1} - Alignment: ${slide.textAlignment || 'center'}`, slide);
      });
    } else {
      console.log('No hero sliders found, using defaults');
    }
  }, [heroSliders.length]); // Only log when the number of slides changes
  
  // Default slide if no hero sliders
  const defaultSlides = [
    {
      backgroundImage: null,
      taglineEn: 'Welcome',
      taglineAr: 'مرحباً',
      heroTitleEn: 'Experience Excellence',
      heroTitleAr: 'اختبر التميز',
      subtitleEn: 'Your journey to wellness begins here',
      subtitleAr: 'رحلتك نحو العافية تبدأ من هنا',
      ctaButtonTextEn: 'Book Now',
      ctaButtonTextAr: 'احجز الآن',
      ctaButtonType: null,
      ctaButtonItemId: null,
      textAlignment: 'center',
      heroTitleColor: '#FFFFFF',
      subtitleColor: '#FFFFFF',
    }
  ];

  // Filter out slides with empty or invalid data
  const validSlides = heroSliders.filter(slide => 
    slide && (slide.heroTitleEn || slide.heroTitleAr || slide.taglineEn || slide.taglineAr)
  );

  const slides = validSlides.length > 0 ? validSlides : defaultSlides;

  useEffect(() => {
    if (slides.length > 1) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [slides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleCTAClick = (slide: any) => {
    if (slide.ctaButtonType && slide.ctaButtonItemId) {
      if (slide.ctaButtonType === 'service') {
        navigate(`${basePath}/services/${slide.ctaButtonItemId}`);
      } else if (slide.ctaButtonType === 'product') {
        navigate(`${basePath}/products/${slide.ctaButtonItemId}`);
      }
    } else {
      onBookNowClick();
    }
  };

  const getAlignmentClasses = (alignment: string) => {
    switch (alignment) {
      case 'left': 
        return {
          container: 'items-center justify-start', // Vertically centered, horizontally left
          text: 'text-left',
          content: 'items-start'
        };
      case 'right': 
        return {
          container: 'items-center justify-end', // Vertically centered, horizontally right
          text: 'text-right',
          content: 'items-end'
        };
      default: 
        return {
          container: 'items-center justify-center', // Vertically and horizontally centered
          text: 'text-center',
          content: 'items-center'
        };
    }
  };

  const basePath = `/t/${slug}`;

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {slides.map((slide, index) => (
          index === currentSlide && (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: slide.backgroundImage
                    ? `url(http://localhost:5000${slide.backgroundImage.startsWith('/uploads/') ? slide.backgroundImage : slide.backgroundImage.startsWith('/') ? `/uploads${slide.backgroundImage}` : `/uploads/${slide.backgroundImage}`})`
                    : 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)'
                }}
              >
                <div className="absolute inset-0 bg-black/40"></div>
              </div>
              {(() => {
                const alignment = slide.textAlignment || 'center';
                const alignmentClasses = getAlignmentClasses(alignment);
                
                // Content container positioning - the outer div handles horizontal positioning
                // Inner div just needs to be full width within its container
                return (
                  <div className={`relative z-10 flex ${alignmentClasses.container} h-full px-4 md:px-8 lg:px-16`}>
                    <div className={`max-w-4xl w-full flex flex-col ${alignmentClasses.content}`}>
                      {(slide.taglineEn || slide.taglineAr) && (
                        <motion.p
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className={`mb-4 text-[var(--color-primary)] tracking-widest uppercase text-sm font-semibold ${alignmentClasses.text}`}
                        >
                          {slide.taglineEn || slide.taglineAr}
                        </motion.p>
                      )}
                      {(slide.heroTitleEn || slide.heroTitleAr) && (
                        <motion.h1
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className={`mb-6 text-4xl md:text-5xl lg:text-6xl font-bold leading-tight ${alignmentClasses.text}`}
                          style={{ color: slide.heroTitleColor || '#FFFFFF' }}
                        >
                          {slide.heroTitleEn || slide.heroTitleAr}
                        </motion.h1>
                      )}
                      {(slide.subtitleEn || slide.subtitleAr) && (
                        <motion.p
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className={`mb-8 text-lg md:text-xl opacity-90 max-w-2xl ${alignmentClasses.text} ${
                            alignment === 'right' ? 'ml-auto' : alignment === 'center' ? 'mx-auto' : ''
                          }`}
                          style={{ color: slide.subtitleColor || '#FFFFFF' }}
                        >
                          {slide.subtitleEn || slide.subtitleAr}
                        </motion.p>
                      )}
                      {(slide.ctaButtonTextEn || slide.ctaButtonTextAr) && (
                        <motion.div
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          className={`flex gap-4 ${
                            alignment === 'left' ? 'justify-start' : alignment === 'right' ? 'justify-end' : 'justify-center'
                          }`}
                        >
                          <button
                            onClick={() => handleCTAClick(slide)}
                            className="px-8 py-3 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300 shadow-lg hover:shadow-xl font-semibold"
                          >
                            {slide.ctaButtonTextEn || slide.ctaButtonTextAr}
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )
        ))}
      </AnimatePresence>

      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all duration-300"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-8 bg-[var(--color-primary)]'
                    : 'bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
