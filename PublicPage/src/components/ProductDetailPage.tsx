import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart, Package, Minus, Plus, ChevronLeft } from 'lucide-react';
import { ProductCard } from './ProductCard';
import { useCart } from '../context/CartContext';
import { useTenant } from '../context/TenantContext';
import { publicAPI, Product } from '../lib/api';
import { Currency } from './Currency';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId, slug } = useTenant();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    const loadProduct = async () => {
      if (!tenantId || !id) return;

      try {
        setLoading(true);
        const response = await publicAPI.getProduct(tenantId, id);
        
        if (response.success && response.product) {
          setProduct(response.product);
          if (response.product.images && response.product.images.length > 0) {
            setSelectedImage(0);
          }

          // Load related products (same category)
          const productsResponse = await publicAPI.getProducts(tenantId, { category: response.product.category });
          if (productsResponse.success) {
            const related = productsResponse.products
              .filter(p => p.id !== response.product.id && p.category === response.product.category)
              .slice(0, 3);
            setRelatedProducts(related);
          }
        }
      } catch (error) {
        console.error('Failed to load product:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [tenantId, id]);

  const basePath = `/t/${slug}`;

  if (loading) {
    return (
      <div className="main-content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="main-content min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Product not found</p>
          <button
            onClick={() => navigate(`${basePath}/products`)}
            className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-full"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const productName = product.name_en || product.name_ar || 'Product';
  const productDescription = product.description_en || product.description_ar || '';
  const productImages = product.images?.map(img => `http://localhost:5000${img}`) || [];
  const productIngredients = product.ingredients_en || product.ingredients_ar || '';
  const productHowToUse = product.howToUse_en || product.howToUse_ar || '';
  const productFeatures = product.features_en || product.features_ar || '';
  const inStock = product.stock > 0 && product.isAvailable;
  const rating = typeof product.rating === 'number' ? product.rating.toFixed(1) : '5.0';

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: productName,
      price: product.price,
      image: productImages[0] || null,
    }, quantity);
  };

  const handleBuyNow = () => {
    addToCart({
      id: product.id,
      name: productName,
      price: product.price,
      image: productImages[0] || null,
    }, quantity);
    navigate(`${basePath}/checkout`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner Section */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white py-20">
        <div className="page-container text-center">
          <h1 className="mb-4 text-white">{productName}</h1>
          <p className="text-xl text-white/90">
            {productDescription ? (productDescription.length > 100 ? productDescription.substring(0, 100) + '...' : productDescription) : 'Premium Quality Product'}
          </p>
        </div>
      </div>

      <div className="page-container py-12">
        <button
          onClick={() => navigate(`${basePath}/products`)}
          className="mb-8 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-all duration-300 shadow-md"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Products
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 bg-white rounded-2xl shadow-md p-8">
          <div>
            {productImages.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl overflow-hidden shadow-lg mb-4">
                  <img
                    src={productImages[selectedImage]}
                    alt={productName}
                    className="w-full h-96 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                {productImages.length > 1 && (
                  <div className="grid grid-cols-4 gap-4">
                    {productImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                          selectedImage === index
                            ? 'border-[var(--color-primary)]'
                            : 'border-gray-200 hover:border-[var(--color-primary)]/50'
                        }`}
                      >
                        <img 
                          src={image} 
                          alt={`${productName} ${index + 1}`} 
                          className="w-full h-20 object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-secondary)]/20 rounded-2xl h-96 flex items-center justify-center">
                <span className="text-6xl text-[var(--color-primary)] opacity-50">
                  {productName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-md p-8">
              {product.rating && (
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 fill-[var(--color-gold)] text-[var(--color-gold)]" />
                  <span>{rating}</span>
                </div>
              )}

              <h1 className="mb-4">{productName}</h1>
              <p className="text-gray-600 mb-6 text-lg">{productDescription}</p>

              <div className="border-t border-gray-200 pt-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-3xl text-[var(--color-primary)]"><Currency amount={product.price || 0} /></span>
                  {inStock ? (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">In Stock ({product.stock} available)</span>
                  ) : (
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm">Out of Stock</span>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block mb-3">Quantity</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:border-[var(--color-primary)] transition-all duration-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl w-12 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      disabled={!inStock || quantity >= product.stock}
                      className="w-10 h-10 border-2 border-gray-300 rounded-lg flex items-center justify-center hover:border-[var(--color-primary)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleAddToCart}
                    disabled={!inStock}
                    className="flex-1 px-6 py-3 border-2 border-[var(--color-primary)] text-[var(--color-primary)] rounded-full hover:bg-[var(--color-primary)] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={!inStock}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Buy Now
                  </button>
                </div>
              </div>

              {productFeatures && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="mb-4">Key Features</h3>
                  <ul className="space-y-2">
                    {productFeatures.split('\n').filter(f => f.trim()).map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-gray-700">{feature.trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {(productIngredients || productHowToUse) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {productIngredients && (
              <div className="bg-white rounded-2xl shadow-md p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-6 h-6 text-[var(--color-primary)]" />
                  <h3>Ingredients</h3>
                </div>
                <p className="text-gray-700 whitespace-pre-line">{productIngredients}</p>
              </div>
            )}

            {productHowToUse && (
              <div className="bg-white rounded-2xl shadow-md p-8">
                <h3 className="mb-4">How to Use</h3>
                <p className="text-gray-700 whitespace-pre-line">{productHowToUse}</p>
              </div>
            )}
          </div>
        )}

        {relatedProducts.length > 0 && (
          <div>
            <h2 className="mb-8 text-center">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard
                  key={relatedProduct.id}
                  product={relatedProduct}
                  onViewDetails={() => navigate(`${basePath}/products/${relatedProduct.id}`)}
                  onAddToCart={() => {
                    addToCart({
                      id: relatedProduct.id,
                      name: relatedProduct.name_en || relatedProduct.name_ar || 'Product',
                      price: relatedProduct.price,
                      image: relatedProduct.images && relatedProduct.images.length > 0 
                        ? `http://localhost:5000${relatedProduct.images[0]}` 
                        : null,
                    });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
