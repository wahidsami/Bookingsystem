import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useCart } from '../context/CartContext';
import { Product } from '../lib/api';
import { useTenant } from '../context/TenantContext';

interface ProductsSectionProps {
  products: Product[];
  loading: boolean;
  onViewAllProducts: () => void;
  onProductClick: (productId: string) => void;
}

export const ProductsSection: React.FC<ProductsSectionProps> = ({
  products,
  loading,
  onViewAllProducts,
  onProductClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { addToCart } = useCart();
  const { tenant } = useTenant();
  const featuredProducts = products.slice(0, 4);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % featuredProducts.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + featuredProducts.length) % featuredProducts.length);
  };

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name_en,
      price: product.price,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
    });
  };

  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-br from-[var(--color-primary)]/5 to-white">
        <div className="page-container">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        </div>
      </section>
    );
  }

  if (featuredProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-20 bg-gradient-to-br from-[var(--color-primary)]/5 to-white">
      <div className="page-container">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
            <p className="text-[var(--color-primary)] tracking-widest uppercase">{tenant?.name_en || 'Beauty Products'}</p>
            <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
          </div>
          <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent mx-auto mb-6"></div>
          <h2 className="mb-4">Curated for Your Beauty</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover our exclusive collection of premium beauty products, crafted with natural ingredients and luxury in mind
          </p>
        </div>

        <div className="hidden md:grid md:grid-cols-4 gap-6 mb-12">
          {featuredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <ProductCard
                product={product}
                onViewDetails={() => onProductClick(product.id)}
                onAddToCart={() => handleAddToCart(product)}
                featured
              />
            </motion.div>
          ))}
        </div>

        <div className="md:hidden relative mb-12">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <ProductCard
              product={featuredProducts[currentIndex]}
              onViewDetails={() => onProductClick(featuredProducts[currentIndex].id)}
              onAddToCart={() => handleAddToCart(featuredProducts[currentIndex])}
              featured
            />
          </motion.div>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-lg z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-all duration-300 shadow-lg z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {featuredProducts.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'w-6 bg-[var(--color-primary)]' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="text-center mt-16">
          <button
            onClick={onViewAllProducts}
            className="px-8 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            View All Products
          </button>
        </div>
      </div>
    </section>
  );
};
