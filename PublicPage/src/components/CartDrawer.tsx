import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Currency } from './Currency';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, onCheckout }) => {
  const { cartItems, updateQuantity, removeFromCart, getCartTotal } = useCart();

  const deliveryCharge = 30;
  const subtotal = getCartTotal();
  const total = subtotal + deliveryCharge;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-6 h-6 text-[var(--color-primary)]" />
            <h3>Shopping Cart</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">Your cart is empty</p>
              <button
                onClick={onClose}
                className="px-6 py-2 text-[var(--color-primary)] hover:underline"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={`${item.product.id}-${item.selectedSize || 'default'}`}
                    className="flex gap-4 bg-gray-50 rounded-xl p-4"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <h4 className="mb-1">{item.product.name}</h4>
                      {item.selectedSize && (
                        <p className="text-sm text-gray-500 mb-2">Size: {item.selectedSize}</p>
                      )}
                      <p className="text-[var(--color-primary)]"><Currency amount={item.product.price} /></p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 border border-gray-300 rounded flex items-center justify-center hover:border-[var(--color-primary)] transition-colors duration-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 border border-gray-300 rounded flex items-center justify-center hover:border-[var(--color-primary)] transition-colors duration-300"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="self-start p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-300"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 p-6">
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span><Currency amount={subtotal} /></span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>Delivery Charge</span>
                  <span><Currency amount={deliveryCharge} /></span>
                </div>
                <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent"></div>
                <div className="flex items-center justify-between">
                  <span>Total</span>
                  <span className="text-xl text-[var(--color-primary)]"><Currency amount={total} /></span>
                </div>
              </div>
              <button
                onClick={onCheckout}
                className="w-full px-6 py-3 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white rounded-full hover:shadow-xl transition-all duration-300"
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};
