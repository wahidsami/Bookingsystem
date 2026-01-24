import React from 'react';
import { Star, ShoppingCart, Eye } from 'lucide-react';
import { Product } from '../lib/api';
import { Currency } from './Currency';

interface ProductCardProps {
  product: Product;
  onViewDetails: () => void;
  onAddToCart: () => void;
  featured?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewDetails,
  onAddToCart,
  featured,
}) => {
  const productName = product.name_en || product.name_ar || 'Product';
  const productDescription = product.description_en || product.description_ar || '';
  
  // Normalize image path - handle different formats:
  // 1. Absolute: /uploads/tenants/products/filename
  // 2. Relative with slash: /tenants/products/filename
  // 3. Relative without slash: tenants/products/filename
  const productImageRaw = product.images && product.images.length > 0 ? product.images[0] : null;
  const productImage = productImageRaw 
    ? `http://localhost:5000${productImageRaw.startsWith('/uploads/') 
        ? productImageRaw 
        : productImageRaw.startsWith('/') 
          ? `/uploads${productImageRaw}` 
          : `/uploads/${productImageRaw}`}`
    : null;
  
  const inStock = product.stock > 0 && product.isAvailable;

  if (featured) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        <div className="relative h-64 overflow-hidden bg-gray-200">
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20">
              <span className="text-4xl text-[var(--color-primary)] opacity-50">
                {productName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white bg-red-500 px-4 py-2 rounded-full">Out of Stock</span>
            </div>
          )}
        </div>
        <div className="p-6">
          <h4 className="mb-2">{productName}</h4>
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{productDescription}</p>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-primary)] text-xl"><Currency amount={product.price || 0} /></span>
            <button
              onClick={onViewDetails}
              className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300"
            >
              View
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="relative h-64 overflow-hidden group bg-gray-200">
        {productImage ? (
          <img
            src={productImage}
            alt={productName}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20">
            <span className="text-4xl text-[var(--color-primary)] opacity-50">
              {productName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white bg-red-500 px-4 py-2 rounded-full">Out of Stock</span>
          </div>
        )}
        {product.rating && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
            <Star className="w-4 h-4 fill-[var(--color-gold)] text-[var(--color-gold)]" />
            <span className="text-sm">{typeof product.rating === 'number' ? product.rating.toFixed(1) : product.rating}</span>
          </div>
        )}
      </div>
      <div className="p-6">
        <div className="mb-3">
          <h4 className="mb-1">{productName}</h4>
          {product.category && (
            <span className="text-xs px-3 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full">
              {product.category}
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{productDescription}</p>
        <div className="flex items-center justify-between mb-4">
          <span className="text-[var(--color-primary)] text-xl"><Currency amount={product.price || 0} /></span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className="flex-1 px-4 py-2 border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          {inStock && (
            <button
              onClick={onAddToCart}
              className="flex-1 px-4 py-2 bg-[var(--color-primary)] text-white rounded-full hover:bg-[var(--color-primary-dark)] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
