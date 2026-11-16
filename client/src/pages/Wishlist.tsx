import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { getProductById, Product } from "@/services/productService";
import { Button } from "@/components/ui/button";
import { normalizeImageUrl, placeholderImage } from "@/lib/utils";
import { toast } from "sonner";

export default function Wishlist() {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      try {
        const loadedProducts = await Promise.all(
          wishlistItems.map(id => getProductById(id))
        );
        setProducts(loadedProducts.filter(p => p !== null) as Product[]);
      } catch (error) {
        console.error("Failed to load wishlist products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (wishlistItems.length > 0) {
      loadProducts();
    } else {
      setProducts([]);
      setIsLoading(false);
    }
  }, [wishlistItems]);

  const handleAddToCart = async (product: Product) => {
    if (addingProductId) {
      return;
    }

    setAddingProductId(product.id);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: 1,
        category: product.category,
      });
      toast.success("Added to cart");
    } catch (error) {
      console.error("Failed to add wishlist product to cart:", error);
      toast.error("Failed to add to cart");
    } finally {
      setAddingProductId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading wishlist...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12">
          <div className="flex flex-col items-center justify-center text-center py-16">
            <Heart size={64} className="text-gray-300 mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Wishlist is Empty
            </h1>
            <p className="text-gray-600 mb-8">
              Save your favorite items to view them later
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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
          <Button
            onClick={clearWishlist}
            className="bg-red-100 text-red-600 hover:bg-red-200 font-medium"
          >
            Clear Wishlist
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => (
            <div key={product.id} className="product-card overflow-hidden">
              {/* Image Container */}
              <div className="relative bg-gray-100 aspect-square overflow-hidden">
                <img
                  src={normalizeImageUrl(product.image)}
                  alt={product.title}
                  loading="lazy"
                  onError={event => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = placeholderImage;
                  }}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />

                {/* Remove Button */}
                <button
                  onClick={() => removeFromWishlist(product.id)}
                  className="absolute top-3 right-3 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 hover:scale-110"
                >
                  <Trash2 size={18} className="text-red-500" />
                </button>

                {/* Add to Cart Button */}
                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={addingProductId === product.id}
                  className="absolute bottom-0 left-0 right-0 bg-emerald-500 hover:bg-emerald-600 text-white py-2 flex items-center justify-center gap-2 transition-all duration-200 translate-y-full group-hover:translate-y-0 disabled:cursor-not-allowed disabled:bg-emerald-400"
                >
                  <ShoppingCart size={16} />
                  <span className="text-sm font-medium">Add to Cart</span>
                </button>
              </div>

              {/* Product Info */}
              <div className="p-4">
                {/* Category */}
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                  {product.category}
                </p>

                {/* Title */}
                <Link href={`/product/${product.id}`}>
                  <a className="font-semibold text-gray-900 line-clamp-2 mb-2 hover:text-emerald-600 transition-colors">
                    {product.title}
                  </a>
                </Link>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-gray-900">
                    ₱{product.price.toFixed(2)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-sm text-gray-500 line-through">
                      ₱{product.originalPrice.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Stock Status */}
                <p className="text-xs text-gray-500 mt-2">
                  {product.stock > 10
                    ? "In Stock"
                    : product.stock > 0
                      ? `Only ${product.stock} left`
                      : "Out of Stock"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
