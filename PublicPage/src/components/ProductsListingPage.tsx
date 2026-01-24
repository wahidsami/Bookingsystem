import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useCart } from '../context/CartContext';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Product } from '../lib/api';

interface ProductsListingPageProps {
  onProductClick?: (productId: string) => void;
}

export const ProductsListingPage: React.FC<ProductsListingPageProps> = () => {
  const { tenantId, slug, tenant, pageData } = useTenant();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const { addToCart } = useCart();

  // Get banner from pageBanners field (dedicated column)
  const productsBanner = pageData?.pageBanners?.products;
  const bannerImage = productsBanner
    ? `http://localhost:5000${productsBanner.startsWith('/uploads/') ? productsBanner : `/uploads/${productsBanner}`}`
    : null;

  useEffect(() => {
    const loadProducts = async () => {
      if (!tenantId) return;

      try {
        setLoading(true);
        const response = await publicAPI.getProducts(tenantId, {});
        if (response.success) {
          setProducts(response.products || []);
        } else {
          setProducts([]);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
        setProducts([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [tenantId]);

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((product) => {
    const categoryMatch = selectedCategory === 'all' || product.category === selectedCategory;
    const priceMatch = product.price >= priceRange[0] && product.price <= priceRange[1];
    return categoryMatch && priceMatch;
  });

  const handleAddToCart = (product: Product) => {
    addToCart({
      id: product.id,
      name: product.name_en,
      price: product.price,
      image: product.images && product.images.length > 0 ? product.images[0] : null,
    });
  };

  const basePath = `/t/${slug}`;

  return (
    <div className="min-h-screen bg-gray-50 mb-8">
      {bannerImage ? (
        <div
          className="relative h-[400px] bg-cover bg-center flex items-center justify-center mb-16"
          style={{ backgroundImage: `url(${bannerImage})` }}
        >
          <div className="absolute inset-0 bg-black/50"></div>
          <div className="page-container text-center relative z-10">
            <h1 className="mb-4 text-white">{tenant?.name_en || 'Beauty Products'}</h1>
            <p className="text-xl text-white/90">Premium products for your natural beauty</p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white py-20 mb-16">
          <div className="page-container text-center">
            <h1 className="mb-4 text-white">{tenant?.name_en || 'Beauty Products'}</h1>
            <p className="text-xl text-white/90">Premium products for your natural beauty</p>
          </div>
        </div>
      )}

      <div className="page-container pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-md p-6 sticky top-24">
              <div className="flex items-center gap-3 mb-6">
                <Filter className="w-5 h-5 text-[var(--color-primary)]" />
                <h3>Filters</h3>
              </div>

              <div className="mb-6">
                <label className="block mb-3">Category</label>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-300 ${
                        selectedCategory === category
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {category === 'all' ? 'All Products' : category}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <label className="block mb-3">Price Range</label>
                <div className="space-y-4">
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                    className="w-full accent-[var(--color-primary)]"
                  />
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>0 SAR</span>
                    <span>{priceRange[1]} SAR</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 mt-6">
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, 1000]);
                  }}
                  className="w-full px-4 py-2 text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading products...</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-gray-600">
                    Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                  </p>
                </div>

                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onViewDetails={() => navigate(`${basePath}/products/${product.id}`)}
                        onAddToCart={() => handleAddToCart(product)}
                      />
                    ))}
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-gray-500 text-lg mb-2">No products available at the moment.</p>
                    <p className="text-sm text-gray-400">Please check back later or contact us for more information.</p>
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-gray-500 text-lg mb-2">No products found matching your filters.</p>
                    <p className="text-sm text-gray-400 mb-4">Try adjusting your filter criteria.</p>
                    <button
                      onClick={() => {
                        setSelectedCategory('all');
                        setPriceRange([0, 1000]);
                      }}
                      className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
