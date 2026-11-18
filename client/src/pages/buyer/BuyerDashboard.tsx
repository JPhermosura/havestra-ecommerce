import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Search,
  ChevronRight,
  Package,
  Clock,
  TrendingUp,
  Truck,
  Plus,
  MapPin,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { getProducts, Product } from "@/services/productService";
import BrandWatermark from "@/components/BrandWatermark";
import { placeholderImage, resolveProductImageUrl } from "@/lib/utils";

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
];

function normalizeApiProduct(product: any): Product {
  return {
    id: product._id || product.id || "",
    title: product.title || product.name || "Untitled product",
    price: Number(product.price ?? 0),
    originalPrice: product.originalPrice,
    image: product.image || product.images?.[0] || "/placeholder.png",
    category: product.category || "Other",
    rating: Number(product.rating ?? 0),
    reviews: Number(product.reviews ?? 0),
    description: product.description || "",
    stock: Number(product.stock ?? 0),
    images: product.images || [],
    farmerId: product.farmerId || product.sellerId || "",
    farmerName: product.farmerName || product.sellerName || "Farm Partner",
    farmLocation: product.farmLocation || "",
    availability: product.availability || "available",
  };
}

type BuyerDashboardApiResponse = {
  stats: {
    totalOrders: number;
    pendingOrders: number;
    inTransitOrders: number;
    totalSpent: number;
  };
  featuredProducts: any[];
};

export default function BuyerDashboard() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessingCart, setIsProcessingCart] = useState(false);
  const { addToCart } = useCart();
  const queryClient = useQueryClient();

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    refetch: refetchDashboard,
  } = useQuery<BuyerDashboardApiResponse>(
    ["buyerDashboard"],
    async () => {
      const response = await axios.get("/api/buyer");
      return response.data;
    },
    {
      staleTime: 15_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    }
  );

  const featuredProducts = (dashboardData?.featuredProducts || []).map(
    normalizeApiProduct
  );

  const stats = dashboardData?.stats;

  const handleAddToCart = async (product: Product) => {
    if (isProcessingCart) {
      return;
    }

    setIsProcessingCart(true);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        quantity: 1,
        sellerId: product.farmerId,
        farmerId: product.farmerId,
      });
      queryClient.invalidateQueries(["buyerDashboard"]);
      toast.success("Product added to cart!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to cart");
    } finally {
      setIsProcessingCart(false);
    }
  };

  const handleBuyNow = async (product: Product) => {
    if (isProcessingCart) {
      return;
    }

    setIsProcessingCart(true);
    try {
      await addToCart({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        category: product.category,
        quantity: 1,
        sellerId: product.farmerId,
        farmerId: product.farmerId,
      });
      queryClient.invalidateQueries(["buyerDashboard"]);
      toast.success("Redirecting to checkout...");
      navigate("/checkout");
    } catch (err) {
      console.error(err);
      toast.error("Failed to process order");
    } finally {
      setIsProcessingCart(false);
    }
  };

  const renderProductCard = (product: Product) => (
    <div
      key={product.id}
      className="dashboard-card flex h-full flex-col overflow-hidden bg-white"
    >
      <Link href={`/product/${product.id}`}>
        <div className="relative aspect-square">
          <img
            src={resolveProductImageUrl(product.image, product.title)}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={event => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = placeholderImage;
            }}
          />
          {product.stock <= 10 && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-red-500 text-white border-0">
                Low Stock
              </Badge>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col space-y-3 p-3 sm:p-4">
        <Link href={`/product/${product.id}`} className="block">
          <h3 className="mb-1.5 min-h-10 line-clamp-2 text-sm font-semibold leading-tight text-slate-900 transition-colors group-hover:text-emerald-600 sm:text-base">
            {product.title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{product.farmerName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-sm text-slate-700">
              {product.rating.toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-slate-400">({product.reviews})</span>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-base font-bold text-emerald-600 sm:text-xl">
            ₱{product.price.toLocaleString()}
          </p>
          <p className="shrink-0 text-right text-[11px] text-slate-500 sm:text-xs">
            {product.stock} in stock
          </p>
        </div>
        <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            className="min-h-10 w-full bg-emerald-600 px-2 text-xs hover:bg-emerald-700 sm:text-sm"
            onClick={() => handleAddToCart(product)}
            disabled={isProcessingCart}
          >
            <Plus className="mr-1 h-4 w-4 shrink-0" /> Add to Cart
          </Button>
          <Button
            className="min-h-10 w-full bg-blue-600 px-2 text-xs hover:bg-blue-700 sm:text-sm"
            onClick={() => handleBuyNow(product)}
            disabled={isProcessingCart}
          >
            <Zap className="mr-1 h-4 w-4 shrink-0" /> Buy Now
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSummaryCards = () => {
    const cards = [
      {
        label: "Total Orders",
        description: "All your orders",
        value: stats?.totalOrders,
        icon: Package,
        href: "/orders",
      },
      {
        label: "Pending Orders",
        description: "Awaiting fulfillment",
        value: stats?.pendingOrders,
        icon: Clock,
        href: "/orders?status=Pending",
      },
      {
        label: "In Transit",
        description: "Delivery progress & details",
        value: stats?.inTransitOrders,
        icon: Truck,
        href: "/orders?status=In%20Transit",
      },
      {
        label: "Total Spent",
        description: "Completed deliveries",
        value:
          stats?.totalSpent === undefined
            ? undefined
            : `₱${stats.totalSpent.toLocaleString()}`,
        icon: TrendingUp,
        href: "/orders?status=Delivered",
      },
    ];

    return (
      <section aria-label="Order summary">
        {isDashboardError && (
          <div
            role="alert"
            className="mb-3 flex flex-col gap-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>Order statistics could not be loaded.</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchDashboard()}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Try again
            </Button>
          </div>
        )}
        <div className="dashboard-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map(({ label, description, value, icon: Icon, href }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(href)}
              className="dashboard-card group rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm transition-colors group-hover:bg-emerald-700 sm:h-10 sm:w-10">
                  <Icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-emerald-700 sm:text-sm">
                    {label}
                  </p>
                  <p className="text-xl font-bold text-emerald-950 sm:text-2xl">
                    {isDashboardLoading
                      ? "..."
                      : isDashboardError
                        ? "—"
                        : (value ?? 0)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{description}</p>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const filteredProducts = featuredProducts.filter(
    product =>
      product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.farmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFeaturedProducts = () => (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Featured Products
          </h2>
          {searchQuery && (
            <p className="text-sm text-slate-500 mt-1">
              Found {filteredProducts.length} product
              {filteredProducts.length !== 1 ? "s" : ""} matching "{searchQuery}
              "
            </p>
          )}
        </div>
      </div>
      {isDashboardLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[400px] rounded-2xl bg-slate-200 animate-pulse"
            />
          ))}
        </div>
      ) : isDashboardError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-100 bg-white p-8 text-center text-sm text-red-700"
        >
          Featured products could not be loaded.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
          <Package className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg font-semibold text-slate-900">
            {searchQuery
              ? "No products match your search."
              : "No products available yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(renderProductCard)}
        </div>
      )}
    </section>
  );

  return (
    <div className="dashboard-surface relative isolate min-h-screen">
      <BrandWatermark />
      <Toaster position="top-right" />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-[#fffdf8]/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 py-3 sm:flex sm:gap-6 sm:py-4">
            {/* Logo */}
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5">
              <Link href="/buyer" className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                  <span className="text-lg font-bold text-white">H</span>
                </div>
                <span className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  Havestra
                </span>
              </Link>
            </div>

            {/* Search Bar */}
            <div className="relative col-span-full row-start-2 w-full sm:max-w-3xl sm:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products, categories, farms..."
                className="h-12 rounded-full border border-emerald-100/80 bg-white/80 py-3 pl-12 pr-4 text-sm shadow-inner shadow-emerald-950/5 focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-6 sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
        {/* Summary Cards */}
        {renderSummaryCards()}

        {/* Featured Products */}
        {renderFeaturedProducts()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm text-slate-500">
              © 2026 Havestra. All rights reserved.
            </p>
            <div className="flex items-center justify-center gap-6 mt-4">
              <Link
                href="/buyer"
                className="text-slate-500 hover:text-emerald-600 text-sm"
              >
                About
              </Link>
              <Link
                href="/buyer"
                className="text-slate-500 hover:text-emerald-600 text-sm"
              >
                Contact
              </Link>
              <Link
                href="/buyer"
                className="text-slate-500 hover:text-emerald-600 text-sm"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
