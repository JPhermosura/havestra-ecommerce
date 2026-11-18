import { Link, useLocation } from "wouter";
import { Trash2, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { normalizeImageUrl, placeholderImage } from "@/lib/utils";

export default function Cart() {
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } =
    useCart();
  const [, navigate] = useLocation();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12">
          <div className="flex flex-col items-center justify-center text-center py-16">
            <ShoppingBag size={64} className="text-gray-300 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Cart is Empty
            </h1>
            <p className="text-gray-600 mb-8">
              Add some products to get started!
            </p>
            <Link href="/products" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-6 py-3 rounded-lg transition-colors">
                Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex gap-4 p-6 ${index !== items.length - 1 ? "border-b border-gray-200" : ""}`}
                >
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={normalizeImageUrl(item.image)}
                      alt={item.title}
                      loading="lazy"
                      onError={event => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = placeholderImage;
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.id}`} className="text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors line-clamp-2">
                        {item.title}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.category}
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-2">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity Control */}
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center font-medium text-gray-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="mt-6">
              <Link
                href="/products"
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                ← Continue Shopping
              </Link>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Order Summary
              </h2>

              {/* Summary Details */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>₱{totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Shipping</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>₱{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={() => navigate("/checkout")}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-3 rounded-lg transition-all duration-200 mb-3"
              >
                Proceed to Checkout
              </Button>

              {/* Clear Cart */}
              <Button
                onClick={clearCart}
                className="w-full bg-gray-200 text-gray-900 hover:bg-gray-300 font-medium py-3 rounded-lg transition-all duration-200"
              >
                Clear Cart
              </Button>

              {/* Info Box */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-900">
                  <strong>Free shipping</strong> at checkout.{" "}
                  <strong>30-day returns</strong> on all items.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
