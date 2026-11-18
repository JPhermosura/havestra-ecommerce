import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { Product } from "@/services/productService";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl, placeholderImage } from "@/lib/utils";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAddingToCart) {
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please log in to add items to cart.");
      navigate("/login");
      return;
    }

    setIsAddingToCart(true);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        quantity: 1,
        category: product.category,
      });
    } catch (error) {
      console.error("Failed to add product to cart:", error);
      toast.error("Failed to add product to cart.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (inWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product.id);
    }
  };

  const discountPercentage = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0;

  const imageSrc = resolveProductImageUrl(product.image, product.title);

  return (
    <Link href={`/product/${product.id}`}>
      <div className="group interactive-card flex h-full flex-col overflow-hidden rounded-3xl border border-emerald-100/80 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl">
        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[#fbfaf4] via-emerald-50 to-lime-50">
          {isImageLoading && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}
          <img
            src={imageSrc}
            alt={product.title}
            loading="lazy"
            onLoad={() => setIsImageLoading(false)}
            onError={event => {
              setIsImageLoading(false);
              event.currentTarget.onerror = null;
              event.currentTarget.src = placeholderImage;
            }}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Discount Badge */}
          {discountPercentage > 0 && (
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-orange-600 text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-sm">
              -{discountPercentage}%
            </div>
          )}

          {/* Wishlist Button */}
          <button
            onClick={handleWishlistToggle}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 w-8 h-8 sm:w-10 sm:h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all duration-200"
          >
            <Heart
              size={16}
              className={
                inWishlist ? "fill-red-500 text-red-500" : "text-gray-400"
              }
            />
          </button>

          {/* Quick Add - Only on Desktop Hover */}
          <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 hidden md:block pointer-events-none group-hover:pointer-events-auto">
            <Button
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              className="w-full rounded-lg bg-[#16834A] py-2 text-white shadow-lg hover:bg-[#116b3c] pointer-events-auto flex items-center justify-center gap-2"
            >
              <ShoppingCart size={16} />
              <span className="text-sm font-semibold">Add to Cart</span>
            </Button>
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#16834A] sm:text-xs">
            {product.category}
          </p>

          {/* Title */}
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-tight text-gray-900 transition-colors group-hover:text-emerald-700 sm:text-base">
            {product.title}
          </h3>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {product.isOrganic && (
              <span className="rounded-full bg-[#16834A] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white sm:text-xs">
                Organic
              </span>
            )}
            <span className="truncate text-[10px] text-gray-500 sm:text-xs">
              By {product.farmerName}
            </span>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={
                    i < Math.floor(product.rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-200"
                  }
                />
              ))}
            </div>
            <span className="text-[10px] sm:text-xs text-gray-500 font-medium">
              {product.rating} ({product.reviews})
            </span>
          </div>

          {/* Price & Stock */}
          <div className="mt-auto">
            <div className="flex items-baseline flex-wrap gap-1.5">
              <span className="text-base font-black text-emerald-800 sm:text-lg">
                ₱{product.price.toLocaleString()}
              </span>
              {product.originalPrice && (
                <span className="text-xs sm:text-sm text-gray-400 line-through font-medium">
                  ₱{product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-2">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  product.stock > 10
                    ? "text-emerald-600 bg-emerald-50"
                    : product.stock > 0
                      ? "text-orange-600 bg-orange-50"
                      : "text-red-600 bg-red-50"
                }`}
              >
                {product.stock > 10
                  ? "In Stock"
                  : product.stock > 0
                    ? `Low Stock (${product.stock})`
                    : "Out of Stock"}
              </span>

              {/* Mobile Add to Cart Icon */}
              <button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="md:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-[#16834A] text-white shadow-md transition-colors hover:bg-[#116b3c] disabled:cursor-not-allowed disabled:bg-emerald-400"
                title="Add to Cart"
                aria-label={`Add ${product.title} to cart`}
              >
                <ShoppingCart size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
