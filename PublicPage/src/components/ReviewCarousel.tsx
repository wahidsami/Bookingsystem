import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

// TODO: Replace with actual reviews API endpoint when available
// For now, using empty array - component will not render if no reviews
interface Review {
  id: string;
  name: string;
  comment: string;
  rating: number;
  service?: string;
}

export const ReviewCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Placeholder: Reviews will be fetched from API in the future
  // For now, using empty array so component doesn't render
  const reviews: Review[] = [];

  // Don't render if no reviews
  if (reviews.length === 0) {
    return null;
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 2) % reviews.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 2 + reviews.length) % reviews.length);
  };

  return (
    <div className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="mb-4">What Our Guests Say</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Hear from our valued clients about their transformative experiences at JASMIN
          </p>
        </div>
        
        <div className="hidden md:grid md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[var(--color-primary)]/5 to-white rounded-2xl p-8 shadow-md"
            >
              <Quote className="w-10 h-10 text-[var(--color-primary)] mb-4 opacity-50" />
              <p className="text-gray-700 mb-6 italic">{review.comment}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-1">{review.name}</p>
                  <p className="text-sm text-gray-500">{review.service}</p>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-[var(--color-gold)] text-[var(--color-gold)]"
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="md:hidden relative">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-[var(--color-primary)]/5 to-white rounded-2xl p-8 shadow-md"
          >
            <Quote className="w-10 h-10 text-[var(--color-primary)] mb-4 opacity-50" />
            <p className="text-gray-700 mb-6 italic">{reviews[currentIndex % reviews.length].comment}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1">{reviews[currentIndex % reviews.length].name}</p>
                <p className="text-sm text-gray-500">{reviews[currentIndex % reviews.length].service}</p>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: reviews[currentIndex % reviews.length].rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-[var(--color-gold)] text-[var(--color-gold)]"
                  />
                ))}
              </div>
            </div>
          </motion.div>
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prevSlide}
              className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {reviews.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentIndex % reviews.length
                      ? 'w-6 bg-[var(--color-primary)]'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={nextSlide}
              className="w-10 h-10 bg-[var(--color-primary)] text-white rounded-full flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
