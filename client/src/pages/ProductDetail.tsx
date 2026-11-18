import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Star, Heart, ShoppingCart, Loader2, Check } from "lucide-react";
import {
  getProductById,
  getProductReviews,
  getProducts,
  getReviewEligibility,
  submitProductReview,
  Product,
  Review,
} from "@/services/productService";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Button } from "@/components/ui/button";
import { resolveProductImageUrl, placeholderImage } from "@/lib/utils";
import { toast } from "sonner";

function isPublicReviewImage(source: string) {
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
    source
  );
}

export default function ProductDetail() {
  const [match, params] = useRoute("/product/:id");
  const [location, navigate] = useLocation();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedWeight, setSelectedWeight] = useState<number | undefined>(
    undefined
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [sellerProducts, setSellerProducts] = useState(0);
  const [isSellerProductsLoading, setIsSellerProductsLoading] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState<string | undefined>(
    undefined
  );
  const [reviewStatusMessage, setReviewStatusMessage] = useState("");
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isProcessingCart, setIsProcessingCart] = useState(false);
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  useEffect(() => {
    const loadProduct = async () => {
      if (!match || !params?.id) return;
      setIsLoading(true);
      try {
        const data = await getProductById(params.id);
        if (data) {
          setProduct(data);
        } else {
          navigate("/404");
        }
      } catch (error) {
        console.error("Failed to load product:", error);
        navigate("/404");
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [match, params?.id, navigate]);

  useEffect(() => {
    const loadProductDetails = async () => {
      if (!product) {
        return;
      }

      setIsReviewsLoading(true);
      setIsSellerProductsLoading(true);

      try {
        const [reviewData, sellerProductsData] = await Promise.all([
          getProductReviews(product.id),
          getProducts(
            undefined,
            undefined,
            undefined,
            true,
            true,
            product.farmerId
          ),
        ]);

        setReviews(reviewData);
        setSellerProducts(sellerProductsData.length);

        if (user?.id) {
          try {
            const eligibility = await getReviewEligibility(product.id);
            setCanReview(eligibility.eligible);
            setReviewOrderId(eligibility.orderId);
            setReviewStatusMessage(
              eligibility.alreadyReviewed
                ? "You have already reviewed this product."
                : eligibility.delivered
                  ? "You may submit a review for this delivered order."
                  : "A review is available after the product has been delivered."
            );
          } catch (eligibilityError) {
            console.warn(
              "Unable to check review eligibility:",
              eligibilityError
            );
            setCanReview(false);
            setReviewStatusMessage(
              "Sign in and purchase the product to leave a review"
            );
          }
        } else {
          setCanReview(false);
          setReviewOrderId(undefined);
          setReviewStatusMessage("Sign in to submit a review");
        }
      } catch (error) {
        console.error("Failed to load product details:", error);
      } finally {
        setIsReviewsLoading(false);
        setIsSellerProductsLoading(false);
      }
    };

    loadProductDetails();
  }, [product, user]);

  useEffect(() => {
    if (location.includes("review=true")) {
      setReviewFormOpen(true);
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Product not found</p>
      </div>
    );
  }

  const images = (product.images || [product.image]).map(src =>
    resolveProductImageUrl(src)
  );
  const inWishlist = isInWishlist(product.id);
  const discountedOriginalPrice =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price
      ? product.originalPrice
      : undefined;
  const discountPercentage =
    discountedOriginalPrice === undefined
      ? 0
      : Math.round(
          ((discountedOriginalPrice - product.price) /
            discountedOriginalPrice) *
            100
        );

  const handleAddToCart = async () => {
    if (isProcessingCart) {
      return;
    }

    const price =
      product.weightBased &&
      selectedWeight !== undefined &&
      product.weightOptions
        ? product.weightOptions.find(opt => opt.weight === selectedWeight)
            ?.price || product.price
        : product.price;

    setIsProcessingCart(true);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price,
        image: product.image,
        quantity,
        category: product.category,
        weight: selectedWeight,
      });
      toast.success(`Added ${quantity} item(s) to cart`);
      setQuantity(1);
    } catch (error) {
      console.error("Failed to add product to cart:", error);
      toast.error("Failed to add product to cart.");
    } finally {
      setIsProcessingCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (isProcessingCart) {
      return;
    }

    const price =
      product.weightBased &&
      selectedWeight !== undefined &&
      product.weightOptions
        ? product.weightOptions.find(opt => opt.weight === selectedWeight)
            ?.price || product.price
        : product.price;

    setIsProcessingCart(true);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price,
        image: product.image,
        quantity,
        category: product.category,
        weight: selectedWeight,
      });
      toast.success(`Added ${quantity} item(s) to cart`);
      setQuantity(1);
      navigate("/checkout");
    } catch (error) {
      console.error("Failed to process buy now:", error);
      toast.error("Failed to process order.");
    } finally {
      setIsProcessingCart(false);
    }
  };

  const handleWishlistToggle = () => {
    if (inWishlist) {
      removeFromWishlist(product.id);
      toast.success("Removed from wishlist");
    } else {
      addToWishlist(product.id);
      toast.success("Added to wishlist");
    }
  };

  const handleReviewImagesChange = (files: FileList | null) => {
    if (!files) {
      setReviewImages([]);
      return;
    }
    const selectedFiles = Array.from(files);
    if (selectedFiles.length > 3) {
      setReviewImages([]);
      toast.error("Choose up to 3 review images.");
      return;
    }
    if (
      selectedFiles.some(
        file =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
      )
    ) {
      setReviewImages([]);
      toast.error("Choose JPG, PNG, or WEBP images up to 5 MB each.");
      return;
    }
    setReviewImages(selectedFiles);
  };

  const handleSubmitReview = async () => {
    if (!reviewOrderId) {
      toast.error("Unable to find the related delivered order.");
      return;
    }
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      toast.error("Please add a title and comment to your review.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      await submitProductReview({
        productId: product.id,
        orderId: reviewOrderId,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        images: reviewImages,
      });
      toast.success("Review submitted successfully");
      setReviewFormOpen(false);
      setReviewTitle("");
      setReviewComment("");
      setReviewImages([]);
      setReviewRating(5);

      const updatedReviews = await getProductReviews(product.id);
      setReviews(updatedReviews);
      const updatedProduct = await getProductById(product.id);
      if (updatedProduct) setProduct(updatedProduct);
      setCanReview(false);
      setReviewStatusMessage("You have already reviewed this product.");
    } catch (submitError: any) {
      console.error("Failed to submit review:", submitError);
      const message =
        submitError?.response?.data?.error ||
        "Unable to submit review at this time.";
      toast.error(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Image Gallery */}
          <div>
            <div className="bg-white rounded-lg overflow-hidden mb-4">
              <img
                src={images[selectedImage]}
                alt={product.title}
                loading="lazy"
                onError={event => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = placeholderImage;
                }}
                className="w-full h-96 object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`border-2 rounded-lg overflow-hidden transition-all ${
                      selectedImage === idx
                        ? "border-emerald-500"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={images[idx]}
                      alt={`${product.title} ${idx}`}
                      loading="lazy"
                      onError={event => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = placeholderImage;
                      }}
                      className="w-full h-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {/* Category & Badge */}
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-2">
              {product.category}
            </p>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {product.title}
            </h1>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={
                      i < Math.floor(product.rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }
                  />
                ))}
              </div>
              <span className="text-gray-600">
                {product.rating} ({product.reviews} reviews)
              </span>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm text-gray-500">Seller</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.farmerName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Products listed</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {isSellerProductsLoading ? "..." : sellerProducts}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
                <span>{product.farmLocation}</span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                  {product.isOrganic ? "Organic farm" : "Fresh produce"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() =>
                    navigate(`/product/${product.id}#seller-profile`)
                  }
                  className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  View Seller Profile
                </Button>
                <Button
                  onClick={() => toast.success("Chat feature coming soon!")}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Chat with Seller
                </Button>
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              {product.weightBased && product.weightOptions ? (
                <div>
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      ₱
                      {selectedWeight !== undefined
                        ? product.weightOptions
                            .find(opt => opt.weight === selectedWeight)
                            ?.price.toFixed(2)
                        : Math.min(
                            ...product.weightOptions.map(opt => opt.price)
                          ).toFixed(2)}
                    </span>
                    {discountedOriginalPrice !== undefined && (
                      <>
                        <span className="text-xl text-gray-500 line-through">
                          ₱{discountedOriginalPrice.toFixed(2)}
                        </span>
                        <span className="text-lg font-bold text-orange-500">
                          Save {discountPercentage}%
                        </span>
                      </>
                    )}
                  </div>

                  {/* Weight Selection */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Select Weight:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {product.weightOptions.map(option => (
                        <button
                          key={option.weight}
                          onClick={() => setSelectedWeight(option.weight)}
                          className={`px-4 py-2 border rounded-lg text-sm font-medium transition-all ${
                            selectedWeight === option.weight
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 hover:border-gray-300 text-gray-700"
                          }`}
                        >
                          {option.weight}kg - ₱{option.price.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-4xl font-bold text-gray-900">
                    ₱{product.price.toFixed(2)}
                  </span>
                  {discountedOriginalPrice !== undefined && (
                    <>
                      <span className="text-xl text-gray-500 line-through">
                        ₱{discountedOriginalPrice.toFixed(2)}
                      </span>
                      <span className="text-lg font-bold text-orange-500">
                        Save {discountPercentage}%
                      </span>
                    </>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600">
                {product.stock > 10
                  ? "In Stock - Free Shipping"
                  : product.stock > 0
                    ? `Only ${product.stock} left in stock`
                    : "Out of Stock"}
              </p>
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-6 leading-relaxed">
              {product.description}
            </p>

            {/* Specifications */}
            {product.specifications && (
              <div className="mb-6 bg-gray-100 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Specifications
                </h3>
                <div className="space-y-2">
                  {Object.entries(product.specifications).map(
                    ([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span className="font-medium text-gray-900">
                          {value}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Quantity & Actions */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <span className="text-gray-700 font-medium">Quantity:</span>
                <div className="flex items-center border border-gray-200 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e =>
                      setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-16 text-center border-0 focus:outline-none"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0 || isProcessingCart}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                >
                  <ShoppingCart size={20} />
                  Add to Cart
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={product.stock === 0 || isProcessingCart}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
                >
                  Buy Now
                </Button>
                <Button
                  onClick={handleWishlistToggle}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                    inWishlist
                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  <Heart
                    size={20}
                    fill={inWishlist ? "currentColor" : "none"}
                  />
                </Button>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Check
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-sm text-blue-900">
                  <strong>Free Shipping</strong> at checkout
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Check
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-sm text-blue-900">
                  <strong>30-Day Returns</strong> - Money back guarantee
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Check
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                  size={18}
                />
                <p className="text-sm text-blue-900">
                  <strong>Secure Checkout</strong> - 100% secure payment
                </p>
              </div>
            </div>
          </div>
        </div>

        {user && (
          <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Share your experience
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Reviews are only accepted after delivery for verified buyers.
                </p>
              </div>
              <div className="text-sm text-gray-600">{reviewStatusMessage}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={() => setReviewFormOpen(state => !state)}
                disabled={!canReview}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {canReview ? "Write a Review" : "Review unavailable"}
              </Button>
              {!canReview && (
                <Button
                  onClick={() => navigate(user ? "/orders" : "/login")}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  {user ? "Check Orders" : "Sign in to review"}
                </Button>
              )}
            </div>

            {reviewFormOpen && (
              <div className="mt-6 space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Rating
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map(score => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setReviewRating(score)}
                          className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                            reviewRating === score
                              ? "border-emerald-500 bg-emerald-600 text-white"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          {score}★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <input
                      type="text"
                      value={reviewTitle}
                      onChange={e => setReviewTitle(e.target.value)}
                      className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="Summarize your experience"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Comment
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 shadow-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Share what you liked or what could be improved"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Photos (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={e => handleReviewImagesChange(e.target.files)}
                    className="mt-2 block w-full text-sm text-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG, or WEBP · Up to 3 images · 5 MB each
                  </p>
                  {reviewImages.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {reviewImages.length} image(s) selected
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    onClick={() => setReviewFormOpen(false)}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={!canReview || isSubmittingReview}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isSubmittingReview ? "Submitting..." : "Submit Review"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews Section */}
        <div className="bg-white rounded-lg shadow-sm p-8" id="seller-profile">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Customer Reviews
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                See verified feedback from buyers who purchased this fresh
                produce.
              </p>
            </div>
            <div className="text-sm text-gray-600">
              {isReviewsLoading
                ? "Loading reviews..."
                : `${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isReviewsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-emerald-500" size={28} />
            </div>
          ) : reviews.length > 0 ? (
            <div className="space-y-6">
              {reviews.map(review => (
                <div
                  key={review.id}
                  className="border-b border-gray-200 pb-6 last:border-0"
                >
                  <div className="flex items-start justify-between mb-2 gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {review.userName}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, j) => (
                          <Star
                            key={j}
                            size={14}
                            className={
                              j < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-200"
                            }
                          />
                        ))}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {review.title && (
                    <p className="mb-1 font-medium text-gray-900">
                      {review.title}
                    </p>
                  )}
                  <p className="text-gray-700 text-sm mb-3">{review.comment}</p>
                  {review.images?.some(isPublicReviewImage) && (
                    <div className="mb-4 flex flex-wrap gap-3">
                      {review.images
                        .filter(isPublicReviewImage)
                        .map((image, index) => (
                          <img
                            key={`${review.id}-image-${index}`}
                            src={image}
                            alt={`${review.title || "Customer"} review photo ${index + 1}`}
                            loading="lazy"
                            className="h-24 w-24 rounded-xl border border-gray-200 object-cover sm:h-28 sm:w-28"
                          />
                        ))}
                    </div>
                  )}
                  {review.sellerResponse && (
                    <div className="bg-emerald-50 rounded-2xl p-4 text-sm text-gray-700">
                      <p className="font-semibold text-emerald-800">
                        Seller response
                      </p>
                      <p>{review.sellerResponse.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-600">
              No reviews yet. Be the first to review this product!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
