// Product service for the eCommerce platform
import axios from "axios";

export interface Product {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  description: string;
  stock: number;
  images?: string[];
  specifications?: Record<string, string>;
  season?: string;
  weightBased?: boolean;
  weightOptions?: { weight: number; price: number }[];
  // Farmer/Seller information
  farmerId: string;
  farmerName: string;
  farmLocation: string;
  // Product availability
  availability: "available" | "pre-order" | "out-of-season";
  harvestDate?: string; // For pre-orders
  // Pricing tiers
  bulkPricing?: { minQuantity: number; discountPercent: number }[];
  // Additional metadata
  isOrganic?: boolean;
  certifications?: string[];
  farmingMethod?: string; // e.g., "Organic", "Conventional", "Biodynamic"
  traceabilityInfo?: {
    farmLocation: string;
    plantingDate?: string;
    harvestDate?: string;
    processingMethod?: string;
  };
}

export const BUYER_CATEGORIES = ["Fruits", "Vegetables"];
export const CATEGORIES = [...BUYER_CATEGORIES];

export interface Review {
  id: string;
  productId: string;
  orderId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
  isVerified: boolean;
  helpful: number;
  reported: boolean;
  sellerResponse?: {
    comment: string;
    respondedAt: string;
    sellerId: string;
    sellerName: string;
  };
  createdAt: string;
  updatedAt: string;
}

const API_BASE_URL = "/api";

type ApiProduct = {
  _id: string;
  title: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  rating?: number;
  reviews?: number;
  description: string;
  stock: number;
  season?: string;
  weightBased?: boolean;
  weightOptions?: { weight: number; price: number }[];
  farmerId: string;
  farmerName: string;
  farmLocation: string;
  availability?: Product["availability"];
  bulkPricing?: { minQuantity: number; discountPercent: number }[];
  isOrganic?: boolean;
  certifications?: string[];
  farmingMethod?: string;
  harvestDate?: string;
};

// No client-side hard-coded title restrictions — allow backend to control results

function normalizeProduct(p: ApiProduct): Product {
  return {
    id: p._id,
    title: p.title,
    price: p.price,
    originalPrice: p.originalPrice,
    image: p.image,
    images: p.images,
    category: p.category,
    rating: p.rating ?? 0,
    reviews: p.reviews ?? 0,
    description: p.description,
    stock: p.stock,
    season: p.season,
    weightBased: p.weightBased,
    weightOptions: p.weightOptions,
    farmerId: p.farmerId,
    farmerName: p.farmerName,
    farmLocation: p.farmLocation,
    availability: p.availability ?? "available",
    bulkPricing: p.bulkPricing,
    isOrganic: p.isOrganic,
    certifications: p.certifications,
    farmingMethod: p.farmingMethod,
    harvestDate: p.harvestDate,
  };
}

export async function getProducts(
  category?: string,
  search?: string,
  sortBy?: string,
  showAll = false,
  buyerOnly = false,
  farmerId?: string
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (category && category !== "all") params.append("category", category);
  if (search) params.append("search", search);
  if (sortBy) params.append("sortBy", sortBy);
  if (showAll) params.append("showAll", "true");
  if (buyerOnly) params.append("buyerOnly", "true");
  if (farmerId) params.append("farmerId", farmerId);

  const response = await axios.get(
    `${API_BASE_URL}/products?${params.toString()}`
  );
  const payload = response.data as { products: ApiProduct[] } | ApiProduct[];
  const products = Array.isArray(payload) ? payload : payload.products;
  return products.map(normalizeProduct);
}

export interface ReviewEligibility {
  eligible: boolean;
  alreadyReviewed: boolean;
  orderId?: string;
  delivered: boolean;
}

export async function getProductReviews(productId: string): Promise<Review[]> {
  const response = await axios.get(`${API_BASE_URL}/reviews/${productId}`);
  const payload = response.data as { reviews: Review[] };
  return payload.reviews.map(review => ({
    ...review,
    id: (review as any)._id || review.id,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  }));
}

export async function getReviewEligibility(
  productId: string
): Promise<ReviewEligibility> {
  const response = await axios.get(
    `${API_BASE_URL}/reviews/eligible/${productId}`
  );
  return response.data as ReviewEligibility;
}

export async function submitProductReview(data: {
  productId: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  images?: File[];
}): Promise<Review> {
  const formData = new FormData();
  formData.append("productId", data.productId);
  formData.append("orderId", data.orderId);
  formData.append("rating", String(data.rating));
  formData.append("title", data.title);
  formData.append("comment", data.comment);

  data.images?.forEach(image => formData.append("images", image));

  const response = await axios.post(`${API_BASE_URL}/reviews`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  const review = response.data as Review;
  return {
    ...review,
    id: (review as any)._id || review.id,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export async function getFeaturedProducts(): Promise<Product[]> {
  const response = await axios.get(`${API_BASE_URL}/products?limit=6`);
  const payload = response.data as { products: ApiProduct[] } | ApiProduct[];
  const products = Array.isArray(payload) ? payload : payload.products;
  return products.map(normalizeProduct).slice(0, 6);
}

export async function getProductById(id: string): Promise<Product | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/products/${id}`);
    const p = response.data as ApiProduct;
    return normalizeProduct(p);
  } catch {
    return null;
  }
}

export async function getProductsByCategory(
  category: string
): Promise<Product[]> {
  return getProducts(category);
}
