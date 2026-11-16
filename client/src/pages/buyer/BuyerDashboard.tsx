import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Search,
  User,
  ChevronRight,
  Package,
  ShoppingCart,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getProducts, Product } from "@/services/productService";
import NotificationBell from "@/components/NotificationBell";

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
    orders: number;
    cartItems: number;
    totalSpent: number;
    deliveryTracking: number;
  };
  featuredProducts: any[];
};

export default function BuyerDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessingCart, setIsProcessingCart] = useState(false);
  const { totalItems: cartItemCount, addToCart } = useCart();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: isDashboardLoading } =
    useQuery<BuyerDashboardApiResponse>(
      ["buyerDashboard"],
      async () => {
        const response = await axios.get("/api/buyer");
        return response.data;
      },
      { staleTime: 1000 * 60 * 2 }
    );

  const featuredProducts = (dashboardData?.featuredProducts || []).map(
    normalizeApiProduct
  );

  const stats = dashboardData?.stats ?? {
    totalOrders: 0,
    orders: 0,
    cartItems: cartItemCount,
    totalSpent: 0,
    deliveryTracking: 0,
  };

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
    <div key={product.id} className="dashboard-card overflow-hidden bg-white">
      <Link href={`/product/${product.id}`}>
        <div className="relative aspect-square">
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover"
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
      <div className="p-4 space-y-3">
        <Link href={`/product/${product.id}`} className="block">
          <h3 className="font-semibold text-slate-900 line-clamp-2 mb-1.5 leading-tight group-hover:text-emerald-600 transition-colors">
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
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-emerald-600">
            ₱{product.price.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500">{product.stock} in stock</p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleAddToCart(product)}
            disabled={isProcessingCart}
          >
            <Plus className="h-4 w-4 mr-2" /> Add to Cart
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => handleBuyNow(product)}
            disabled={isProcessingCart}
          >
            <Zap className="h-4 w-4 mr-2" /> Buy Now
          </Button>
        </div>
      </div>
    </div>
  );

  const renderSummaryCards = () => (
    <div className="dashboard-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* Total Orders */}
      <button
        type="button"
        onClick={() => navigate("/orders")}
        className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
            <Package className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-sm text-emerald-700 font-medium">Total Orders</p>
            <p className="text-3xl font-bold text-emerald-900">
              {stats.totalOrders}
            </p>
          </div>
        </div>
      </button>

      {/* Orders (Active) */}
      <button
        type="button"
        onClick={() => navigate("/orders?status=active")}
        className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
            <Package className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700">Orders</p>
            <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              {stats.orders}
            </p>
          </div>
        </div>
      </button>

      {/* Cart Items */}
      <button
        type="button"
        onClick={() => navigate("/cart")}
        className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
            <ShoppingCart className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700">Cart Items</p>
            <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              {stats.cartItems}
            </p>
          </div>
        </div>
      </button>

      {/* Total Spent */}
      <button
        type="button"
        onClick={() => navigate("/orders/history")}
        className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
            <TrendingUp className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700">Total Spent</p>
            <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              ₱{stats.totalSpent.toLocaleString()}
            </p>
          </div>
        </div>
      </button>

      {/* Delivery Tracking */}
      <button
        type="button"
        onClick={() => navigate("/buyer/delivery-tracking")}
        className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
            <Truck className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-700">
              Delivery Tracking
            </p>
            <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
              {stats.deliveryTracking}
            </p>
          </div>
        </div>
      </button>
    </div>
  );

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[400px] rounded-2xl bg-slate-200 animate-pulse"
            />
          ))}
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map(renderProductCard)}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white">
      <Toaster position="top-right" />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-6">
            {/* Logo */}
            <Link href="/buyer" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <span className="text-xl font-bold text-slate-900">Havestra</span>
            </Link>

            {/* Search Bar */}
            <div className="relative order-3 w-full sm:order-none sm:max-w-3xl sm:flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products, categories, farms..."
                className="pl-12 pr-4 py-3 rounded-full bg-slate-50 border-0 focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <NotificationBell />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 duration-200 ease-out"
                >
                  <User className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden p-2"
                align="end"
              >
                <DropdownMenuLabel className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name}</span>
                    <span className="text-xs text-slate-500 truncate">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
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
