import { Fragment, lazy, Suspense, useState, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  DollarSign,
  Star,
  Truck,
  Settings,
  User,
  Plus,
  TrendingUp,
  Home,
  BarChart3,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MessageSquare,
  Search,
  Filter,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DashboardStatCard from "@/components/DashboardStatCard";
import VerificationStatusBanner from "@/components/VerificationStatusBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import Profile from "@/pages/Profile";
import BrandWatermark from "@/components/BrandWatermark";
import BrandMark from "@/components/BrandMark";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";

const SellerRevenueChart = lazy(
  () => import("@/components/seller/SellerRevenueChart")
);

type SellerStats = {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  inTransitOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalRevenue?: number;
  totalSales?: number;
  totalReviews: number;
  activeDeliveries: number;
};

type SellerDashboardData = {
  stats: SellerStats;
  revenueHistory: Array<{
    date: string;
    revenue: number;
    orders: number;
    productsSold: number;
  }>;
  orderStatusSummary: Array<{ status: string; count: number }>;
  customerMetrics: {
    totalCustomers: number;
    repeatCustomers: number;
    newCustomers: number;
    averageOrderValue: number;
    averageRating: number;
    reviewCount: number;
  };
  productPerformance: Array<{
    name: string;
    price: number;
    stock: number;
    rating: number;
    ordersCount: number;
  }>;
};

type SellerVerificationStatus = {
  status: "not_submitted" | "pending" | "pending_review" | "verified" | "rejected";
  submittedAt?: string | null;
  latestReasonCode?: "blurry_image" | "name_mismatch" | "expired_document" | "unsupported_document" | "other" | null;
  latestReasonNote?: string | null;
  retryAllowed: boolean;
};

type ProductForm = {
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  unit: string;
  image: string;
};

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPeso = (amount: number) =>
  pesoFormatter.format(Number.isFinite(amount) ? amount : 0);

export default function SellerDashboard() {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [products, setProducts] = useState<any[]>([]);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [isDeliveriesLoading, setIsDeliveriesLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("all");
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isProductsLoading, setIsProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isOrdersLoading, setIsOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    stock: "",
    unit: "Piece",
    image: "",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [isTogglingProductId, setIsTogglingProductId] = useState<string | null>(
    null
  );
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(
    null
  );
  const productImageInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    orderId?: string;
    newStatus?: string;
    trackingNumber?: string | undefined;
  } | null>(null);

  useEffect(() => {
    if (!productImageFile) {
      setProductImagePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(productImageFile);
    setProductImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [productImageFile]);

  // Determine active tab from URL
  useEffect(() => {
    const [pathname, query = ""] = location.split("?");
    const pathSegment = pathname.split("/").pop();
    const normalizedPath =
      !pathSegment || pathSegment === "seller" ? "dashboard" : pathSegment;
    setActiveTab(normalizedPath);
    const search = query || window.location.search;
    setFilterStatus(new URLSearchParams(search).get("status") || "all");
  }, [location]);

  const getAuthHeader = () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("ecommerce_token");
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch products
  const fetchProducts = async () => {
    if (!user?.id) return;
    setIsProductsLoading(true);
    setProductsError(null);
    try {
      const response = await axios.get(`/api/products/seller/${user.id}`, {
        headers: getAuthHeader(),
      });
      const fetchedProducts = response.data?.products || [];
      setProducts(fetchedProducts);
      setStockDrafts(
        Object.fromEntries(
          fetchedProducts.map((product: any) => [
            product._id,
            String(product.stock ?? 0),
          ])
        )
      );
    } catch (error) {
      console.error("Error fetching products:", error);
      setProductsError("Products could not be loaded from the server.");
    } finally {
      setIsProductsLoading(false);
    }
  };

  const handleUpdateInventory = async (productId: string) => {
    const rawStock = stockDrafts[productId];
    const stock = Number(rawStock);
    if (!Number.isSafeInteger(stock) || stock < 0) {
      toast.error("Stock must be a non-negative whole number.");
      return;
    }
    try {
      await axios.patch(
        `/api/products/${productId}/inventory`,
        { stock },
        { headers: getAuthHeader() }
      );
      await fetchProducts();
      queryClient.invalidateQueries(["sellerDashboard", user?.id]);
      toast.success("Inventory updated.");
    } catch (error: any) {
      console.error("Failed to update inventory:", error);
      toast.error(
        error?.response?.data?.error || "Unable to update inventory."
      );
    }
  };

  // Fetch orders
  const fetchOrders = async () => {
    if (!user?.id) return;
    setIsOrdersLoading(true);
    setOrdersError(null);
    try {
      const response = await axios.get(`/api/orders/seller/${user.id}`, {
        headers: getAuthHeader(),
      });
      setOrders(
        Array.isArray(response.data)
          ? response.data
          : response.data?.orders || []
      );
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrdersError("Orders could not be loaded from the server.");
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      if (!user?.id) return;
      setIsReviewsLoading(true);
      const response = await axios.get(`/api/seller/reviews/${user.id}`, {
        headers: getAuthHeader(),
      });
      setReviews(response.data?.reviews || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  const fetchDeliveries = async () => {
    try {
      if (!user?.id) return;
      setIsDeliveriesLoading(true);
      const response = await axios.get(`/api/orders/seller/${user.id}`, {
        headers: getAuthHeader(),
      });
      const ordersData = Array.isArray(response.data)
        ? response.data
        : response.data?.orders || [];
      setDeliveries(
        ordersData.filter((order: any) =>
          ["Pending", "In Transit", "Delivered"].includes(
            order.deliveryStatus || "Pending"
          )
        )
      );
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setIsDeliveriesLoading(false);
    }
  };

  const FLOW = ["Pending", "In Transit", "Delivered"];

  const normalizeDeliveryStatus = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("cancel")) return "Cancelled";
    if (normalized.includes("deliver")) return "Delivered";
    if (
      normalized.includes("transit") ||
      normalized.includes("ship") ||
      normalized.includes("out for")
    )
      return "In Transit";
    return "Pending";
  };

  const getSellerOrderItems = (order: any) =>
    (order.items || []).filter(
      (item: any) =>
        String(item.sellerId || "") === String(user?.id || "") ||
        String(item.farmerId || "") === String(user?.id || "")
    );

  const getSellerItemTotal = (item: any) => {
    const lineTotal = Number(item.totalPrice);
    if (
      item.totalPrice !== null &&
      item.totalPrice !== undefined &&
      Number.isFinite(lineTotal)
    ) {
      return lineTotal;
    }
    return Number(item.unitPrice || 0) * Number(item.quantity || 0);
  };

  const getSellerOrderTotal = (order: any) =>
    getSellerOrderItems(order).reduce(
      (sum: number, item: any) => sum + getSellerItemTotal(item),
      0
    );

  const handleUpdateDeliveryStatus = async (
    orderId: string,
    newStatus: string,
    extras: { trackingNumber?: string; courier?: string } = {}
  ) => {
    try {
      await axios.put(
        `/api/orders/${orderId}/status`,
        { status: newStatus, ...extras },
        { headers: getAuthHeader() }
      );
      toast.success(`Order marked ${newStatus}`);
      fetchOrders();
      fetchDeliveries();
      queryClient.invalidateQueries(["sellerDashboard", user?.id]);
    } catch (err) {
      console.error("Failed to update delivery status:", err);
      toast.error("Unable to update delivery status");
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmData?.orderId || !confirmData?.newStatus) return;
    setConfirmOpen(false);
    await handleUpdateDeliveryStatus(
      confirmData.orderId,
      confirmData.newStatus,
      { trackingNumber: confirmData.trackingNumber }
    );
    setConfirmData(null);
  };

  useEffect(() => {
    if (user?.id) {
      void fetchProducts();
      void fetchOrders();
      const refreshInterval = window.setInterval(() => {
        void fetchProducts();
        void fetchOrders();
      }, 30_000);
      return () => window.clearInterval(refreshInterval);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === "reviews") {
      fetchReviews();
    }
    if (activeTab === "deliveries") {
      fetchDeliveries();
    }
  }, [activeTab, user?.id]);

  // Reset form when navigating to add-product, or restore editing data if available
  useEffect(() => {
    if (activeTab === "add-product") {
      // Check if there's editing product data in localStorage
      const editingData = localStorage.getItem("editingProductData");
      if (editingData) {
        try {
          const product = JSON.parse(editingData);
          setProductForm({
            name: product.name,
            category: product.category,
            description: product.description,
            price: product.price,
            stock: product.stock,
            unit: product.unit || "Piece",
            image: product.image,
          });
          setEditingProductId(product._id);
          // Don't clear localStorage here, clear it only after successful save
        } catch (e) {
          console.error("Error parsing editing data:", e);
          resetForm();
        }
      } else if (!editingProductId) {
        // No editing data and not currently editing, so reset form
        resetForm();
      }
    }
  }, [activeTab, editingProductId]);

  const resetForm = () => {
    setProductForm({
      name: "",
      category: "",
      description: "",
      price: "",
      stock: "",
      unit: "Piece",
      image: "",
    });
    setProductImageFile(null);
    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }
    setEditingProductId(null);
    localStorage.removeItem("editingProductData");
  };

  const handleProductImageSelection = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Choose a JPG, JPEG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Product images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setProductImageFile(file);
    setProductForm(current => ({ ...current, image: "" }));
    event.target.value = "";
  };

  const {
    data: sellerDashboardData,
    isLoading: isSellerDashboardLoading,
    isError: isSellerDashboardError,
    refetch: refetchSellerDashboard,
  } = useQuery<SellerDashboardData>(
    ["sellerDashboard", user?.id],
    async () => {
      const res = await axios.get("/api/seller/dashboard", {
        headers: getAuthHeader(),
      });
      return res.data;
    },
    { enabled: !!user?.id, refetchInterval: 30_000 }
  );

  const {
    data: sellerVerification,
    isLoading: isSellerVerificationLoading,
    isError: isSellerVerificationError,
    refetch: refetchSellerVerification,
  } = useQuery<SellerVerificationStatus>(
    ["sellerVerificationStatus", user?.id],
    async () => {
      const response = await axios.get("/api/auth/verification-status", {
        headers: getAuthHeader(),
      });
      return response.data;
    },
    {
      enabled: Boolean(user?.id && user.role === "seller"),
      refetchInterval: 30_000,
    }
  );

  const metricValue = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const rawSellerStats = sellerDashboardData?.stats;
  const sellerStats: SellerStats = {
    totalProducts: metricValue(rawSellerStats?.totalProducts),
    totalOrders: metricValue(rawSellerStats?.totalOrders),
    pendingOrders: metricValue(rawSellerStats?.pendingOrders),
    inTransitOrders: metricValue(rawSellerStats?.inTransitOrders),
    deliveredOrders: metricValue(rawSellerStats?.deliveredOrders),
    cancelledOrders: metricValue(rawSellerStats?.cancelledOrders),
    totalRevenue: metricValue(rawSellerStats?.totalRevenue),
    totalSales: metricValue(rawSellerStats?.totalSales),
    totalReviews: metricValue(rawSellerStats?.totalReviews),
    activeDeliveries: metricValue(rawSellerStats?.activeDeliveries),
  };

  const displaySellerMetric = (value: string | number) =>
    isSellerDashboardError ? "—" : isSellerDashboardLoading ? "…" : value;

  const renderStatCards = () => {
    const statCards = [
      {
        IconComponent: Package,
        title: "Total Products",
        value: displaySellerMetric(sellerStats.totalProducts),
        route: "/seller/products",
      },
      {
        IconComponent: ShoppingCart,
        title: "Total Orders",
        value: displaySellerMetric(sellerStats.totalOrders),
        route: "/seller/orders",
      },
      {
        IconComponent: ShoppingCart,
        title: "Pending Orders",
        value: displaySellerMetric(sellerStats.pendingOrders),
        route: "/seller/orders?status=Pending",
        filterStatus: "Pending",
      },
      {
        IconComponent: TrendingUp,
        title: "Total Sales",
        value: displaySellerMetric(formatPeso(sellerStats.totalSales ?? 0)),
        route: "/seller/analytics",
      },
    ];

    return (
      <div className="dashboard-grid grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map(card => (
          <DashboardStatCard
            key={card.title}
            title={card.title}
            value={card.value}
            IconComponent={card.IconComponent}
            onClick={() => {
              setFilterStatus(card.filterStatus || "all");
              setOrderSearchTerm("");
              navigate(card.route);
            }}
          />
        ))}
      </div>
    );
  };

  const handleSaveProduct = async () => {
    const price = Number(productForm.price);
    const stock = Number(productForm.stock);
    if (
      !productForm.name.trim() ||
      !productForm.category ||
      !productForm.price.trim() ||
      !productForm.description.trim() ||
      !productForm.stock.trim() ||
      (!productImageFile && !productForm.image.trim())
    ) {
      toast.error("Complete all required fields and choose a product image.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Enter a valid product price greater than zero.");
      return;
    }
    if (!Number.isSafeInteger(stock) || stock < 0) {
      toast.error("Stock must be a non-negative whole number.");
      return;
    }

    setIsSavingProduct(true);
    try {
      const formData = new FormData();
      const status = stock > 0 ? "Available" : "Out of Stock";

      formData.append(
        "productData",
        JSON.stringify({
          name: productForm.name.trim(),
          title: productForm.name.trim(),
          category: productForm.category,
          unit: productForm.unit,
          price,
          stock,
          description: productForm.description.trim(),
          image: productImageFile ? undefined : productForm.image.trim(),
          images: productImageFile || productForm.image.trim() ? undefined : [],
          status,
        })
      );
      if (productImageFile) {
        formData.append("images", productImageFile);
      }

      if (editingProductId) {
        await axios.put(`/api/products/${editingProductId}`, formData, {
          headers: getAuthHeader(),
        });
        const existingProduct = products.find(
          product => product._id === editingProductId
        );
        if (existingProduct && stock !== existingProduct.stock) {
          await axios.patch(
            `/api/products/${editingProductId}/inventory`,
            { stock },
            { headers: getAuthHeader() }
          );
        }
        toast.success("Product updated successfully.");
      } else {
        await axios.post("/api/products", formData, {
          headers: getAuthHeader(),
        });
        toast.success("Product submitted for admin review.");
      }

      queryClient.invalidateQueries(["sellerDashboard", user?.id]);
      fetchProducts();
      resetForm();
      navigate("/seller/products");
    } catch (error) {
      console.error("Failed to save product:", error);
      const message =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : undefined;
      toast.error(message || "Unable to save product. Please try again.");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleEditProduct = (product: any) => {
    setProductImageFile(null);
    // Store editing product data in localStorage to persist across renders
    localStorage.setItem(
      "editingProductData",
      JSON.stringify({
        _id: product._id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price.toString(),
        stock: product.stock.toString(),
        unit: product.unit || "Piece",
        image: product.image,
      })
    );

    setProductForm({
      name: product.name,
      category: product.category,
      description: product.description,
      price: product.price.toString(),
      stock: product.stock.toString(),
      unit: product.unit || "Piece",
      image: product.image,
    });
    setEditingProductId(product._id);
    navigate("/seller/add-product");
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    setIsDeletingProduct(true);
    try {
      await axios.delete(`/api/products/${productId}`, {
        headers: getAuthHeader(),
      });
      toast.success("Product deleted successfully.");
      queryClient.invalidateQueries(["sellerDashboard", user?.id]);
      fetchProducts();
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Unable to delete product. Please try again.");
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const handleToggleProductActive = async (product: any) => {
    const isActive = product.isActive !== false;
    setIsTogglingProductId(product._id);
    try {
      await axios.patch(
        `/api/products/${product._id}/active`,
        { isActive: !isActive },
        { headers: getAuthHeader() }
      );
      toast.success(
        isActive ? "Product listing deactivated." : "Product listing activated."
      );
      await fetchProducts();
    } catch (error) {
      console.error("Failed to update product listing status:", error);
      const message =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.error === "string"
          ? error.response.data.error
          : undefined;
      toast.error(message || "Unable to update product listing status.");
    } finally {
      setIsTogglingProductId(null);
    }
  };

  const renderDashboard = () => {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="dashboard-header bg-gradient-to-br from-white via-white to-emerald-50/80">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Your farm at a glance
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">
            Here's an overview of your store
          </p>
        </div>

        {isSellerVerificationError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-amber-900">
              Identity verification status could not be loaded.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchSellerVerification()}
            >
              Retry
            </Button>
          </div>
        ) : isSellerVerificationLoading ? (
          <div role="status" className="text-sm text-slate-500">
            Loading identity verification status...
          </div>
        ) : sellerVerification ? (
          <VerificationStatusBanner
            status={sellerVerification.status}
            latestReasonCode={sellerVerification.latestReasonCode}
            latestReasonNote={sellerVerification.latestReasonNote}
            retryAllowed={sellerVerification.retryAllowed}
            submittedAt={sellerVerification.submittedAt}
            heading="Seller verification"
            onRetry={
              sellerVerification.status === "rejected" &&
              sellerVerification.retryAllowed
                ? () => navigate("/verification")
                : undefined
            }
            onViewStatus={
              sellerVerification.status === "rejected" &&
              sellerVerification.retryAllowed
                ? undefined
                : () => navigate("/verification")
            }
          />
        ) : null}

        {isSellerDashboardError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-red-700">
              Seller metrics could not be loaded. The figures below may be
              incomplete.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetchSellerDashboard()}
            >
              Retry
            </Button>
          </div>
        )}

        {isSellerDashboardLoading && (
          <div role="status" className="text-sm text-slate-500">
            Loading store metrics...
          </div>
        )}

        {renderStatCards()}
        <section className="dashboard-card space-y-4 bg-white p-4 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Order status overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Live delivery status across your orders.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Pending",
                value: displaySellerMetric(sellerStats.pendingOrders),
                status: "Pending",
              },
              {
                label: "In Transit",
                value: displaySellerMetric(sellerStats.inTransitOrders),
                status: "In Transit",
              },
              {
                label: "Delivered",
                value: displaySellerMetric(sellerStats.deliveredOrders),
                status: "Delivered",
              },
              {
                label: "Cancelled",
                value: displaySellerMetric(sellerStats.cancelledOrders),
                status: "Cancelled",
              },
            ].map(status => (
              <button
                key={status.label}
                type="button"
                onClick={() => {
                  setFilterStatus(status.status);
                  setOrderSearchTerm("");
                  navigate(
                    `/seller/orders?status=${encodeURIComponent(status.status)}`
                  );
                }}
                className="rounded-xl border border-emerald-100 bg-[#F7F9F5] p-3 text-left transition-colors hover:border-[#16834A]/40 hover:bg-emerald-50"
              >
                <span className="block text-xs font-medium text-slate-500 sm:text-sm">
                  {status.label}
                </span>
                <span className="mt-1 block text-xl font-bold text-[#16834A] sm:text-2xl">
                  {status.value}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Quick actions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Common tools for managing your farm store.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Add Product",
                icon: Plus,
                route: "/seller/add-product",
              },
              {
                label: "Manage Products",
                icon: Package,
                route: "/seller/products",
              },
              {
                label: "Manage Orders",
                icon: ShoppingCart,
                route: "/seller/orders",
              },
            ].map(action => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  if (action.route === "/seller/orders") {
                    setFilterStatus("all");
                    setOrderSearchTerm("");
                  }
                  navigate(action.route);
                }}
                className="dashboard-card flex min-h-14 items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#16834A]">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="font-semibold text-slate-900">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Customer reviews</h2>
            <p className="mt-1 text-sm text-slate-500">
              Read and respond to feedback on your products.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/seller/reviews")}
            className="shrink-0 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
          >
            <Star className="mr-2 h-4 w-4" />
            View reviews
          </Button>
        </section>
      </div>
    );
  };

  const renderAnalytics = () => {
    const revenueHistory = sellerDashboardData?.revenueHistory ?? [];
    const productPerformance = sellerDashboardData?.productPerformance ?? [];
    const customerMetrics = sellerDashboardData?.customerMetrics;
    const maxRevenue = Math.max(
      1,
      ...revenueHistory.map(entry => Number(entry.revenue) || 0)
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Sales report
          </h2>
          <p className="mt-1 text-slate-500">
            Sales performance and customer activity from your store orders.
          </p>
        </div>

        {isSellerDashboardError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-6"
          >
            <p className="text-red-700">
              Analytics could not be loaded from the server.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void refetchSellerDashboard()}
            >
              Retry
            </Button>
          </div>
        ) : isSellerDashboardLoading ? (
          <div
            role="status"
            className="rounded-2xl bg-white p-8 text-slate-500"
          >
            Loading store analytics...
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total delivered sales",
                  value: formatPeso(sellerStats.totalSales ?? 0),
                },
                {
                  label: "Sales (last 7 days)",
                  value: formatPeso(
                    revenueHistory.reduce((sum, day) => sum + day.revenue, 0)
                  ),
                },
                {
                  label: "Customers",
                  value: customerMetrics?.totalCustomers ?? 0,
                },
                {
                  label: "Average order value",
                  value: formatPeso(customerMetrics?.averageOrderValue ?? 0),
                },
                {
                  label: "Average rating",
                  value: `${(customerMetrics?.averageRating ?? 0).toFixed(1)} / 5`,
                },
              ].map(metric => (
                <article
                  key={metric.label}
                  className="dashboard-card bg-white p-4 sm:p-5"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-emerald-950">
                    {metric.value}
                  </p>
                </article>
              ))}
            </div>

            <section className="dashboard-card bg-white p-4 sm:p-6">
              <h3 className="font-semibold text-slate-900">
                Daily sales · last 7 days
              </h3>
              {revenueHistory.length === 0 ? (
                <p className="mt-5 text-sm text-slate-500">
                  No sales history is available yet.
                </p>
              ) : (
                <div
                  role="img"
                  aria-label="Daily sales chart for the last seven days"
                  className="mt-4 h-64 min-w-0"
                >
                  <Suspense
                    fallback={
                      <div
                        role="status"
                        className="flex h-full items-center justify-center text-sm text-slate-500"
                      >
                        Loading chart...
                      </div>
                    }
                  >
                    <SellerRevenueChart data={revenueHistory} />
                  </Suspense>
                </div>
              )}
            </section>

            <section className="dashboard-card overflow-hidden bg-white">
              <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                <h3 className="font-semibold text-slate-900">
                  Product performance
                </h3>
              </div>
              {productPerformance.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">
                  Add products to see their sales performance here.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Units sold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productPerformance.map(product => (
                        <TableRow key={product.name}>
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell>{formatPeso(product.price)}</TableCell>
                          <TableCell>{product.stock}</TableCell>
                          <TableCell>{product.rating.toFixed(1)}</TableCell>
                          <TableCell>{product.ordersCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    );
  };

  const renderWallet = () => {
    const ledger = orders
      .filter(
        order =>
          normalizeDeliveryStatus(order.deliveryStatus || order.status) ===
          "Delivered"
      )
      .map(order => {
        const sellerItems = getSellerOrderItems(order);
        return {
          ...order,
          sellerItems,
          sellerAmount: getSellerOrderTotal(order),
        };
      })
      .filter(order => order.sellerItems.length > 0);
    const orderValue = ledger.reduce(
      (sum, order) => sum + order.sellerAmount,
      0
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Sales ledger
          </h2>
          <p className="mt-1 text-slate-500">
            Seller-specific amounts from your orders. This app does not process
            payouts or withdrawals.
          </p>
        </div>
        <div className="dashboard-card bg-white p-5 sm:p-6">
          <p className="text-sm font-medium text-slate-500">
            Order value shown in this ledger
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">
            {formatPeso(orderValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            This is not a withdrawable wallet balance.
          </p>
        </div>
        <section className="dashboard-card overflow-hidden bg-white">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
            <h3 className="font-semibold text-slate-900">Order activity</h3>
          </div>
          {ledger.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No sales activity is available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Your items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">
                      Your order value
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map(order => (
                    <TableRow key={order._id || order.id}>
                      <TableCell className="font-medium">
                        {order.orderId ||
                          String(order._id || order.id).slice(-8)}
                      </TableCell>
                      <TableCell>
                        {order.createdAt
                          ? new Date(order.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {order.sellerItems
                          .map(
                            (item: any) =>
                              `${item.productName} × ${item.quantity}`
                          )
                          .join(", ")}
                      </TableCell>
                      <TableCell className="capitalize">
                        {String(order.paymentStatus || "pending").replaceAll(
                          "_",
                          " "
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPeso(order.sellerAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderAddProduct = () => {
    const imagePreview = productImagePreview || productForm.image;

    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            {editingProductId ? "Edit Product" : "Add Product"}
          </h1>
          <p className="mt-1 text-slate-600">
            {editingProductId
              ? "Update your product listing."
              : "Create a new product listing for your store."}
          </p>
        </div>

        {user?.farmName && (
          <p className="text-sm font-medium text-emerald-800">
            Adding product as {user.farmName}
          </p>
        )}

        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="product-name"
                className="text-base font-semibold text-slate-800"
              >
                Product Name *
              </Label>
              <Input
                id="product-name"
                value={productForm.name}
                onChange={e =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                placeholder="e.g., Tomato, Cabbage"
                className="h-12 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="product-category"
                className="text-base font-semibold text-slate-800"
              >
                Category *
              </Label>
              <Select
                value={productForm.category}
                onValueChange={value =>
                  setProductForm({ ...productForm, category: value })
                }
              >
                <SelectTrigger
                  id="product-category"
                  className="h-12 border-slate-300 bg-white text-base text-slate-900"
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900">
                  <SelectItem value="Fruits">Fruits</SelectItem>
                  <SelectItem value="Vegetables">Vegetables</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="product-unit"
                className="text-base font-semibold text-slate-800"
              >
                Unit *
              </Label>
              <Select
                value={productForm.unit}
                onValueChange={value =>
                  setProductForm({ ...productForm, unit: value })
                }
              >
                <SelectTrigger
                  id="product-unit"
                  className="h-12 border-slate-300 bg-white text-base text-slate-900"
                >
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent className="border-slate-200 bg-white text-slate-900">
                  <SelectItem value="Piece">Piece</SelectItem>
                  <SelectItem value="Bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="product-price"
                className="text-base font-semibold text-slate-800"
              >
                Price (₱) *
              </Label>
              <Input
                id="product-price"
                type="number"
                min="0.01"
                step="0.01"
                value={productForm.price}
                onChange={e =>
                  setProductForm({ ...productForm, price: e.target.value })
                }
                placeholder="0.00"
                className="h-12 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="product-stock"
                className="text-base font-semibold text-slate-800"
              >
                Stock Quantity *
              </Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                step="1"
                value={productForm.stock}
                onChange={e =>
                  setProductForm({ ...productForm, stock: e.target.value })
                }
                placeholder="0"
                className="h-12 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="product-image"
                className="text-base font-semibold text-slate-800"
              >
                Product Image *
              </Label>
              <div className="rounded-xl border border-slate-200 bg-[#f7f9f5] p-3">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Product image preview"
                    className="mb-3 h-40 w-full rounded-lg bg-white object-contain"
                  />
                ) : (
                  <p className="mb-3 rounded-lg bg-white px-3 py-8 text-center text-sm text-slate-500">
                    Choose a clear photo of your product.
                  </p>
                )}
                <input
                  ref={productImageInputRef}
                  id="product-image"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleProductImageSelection}
                  className="sr-only"
                  aria-label="Choose product image"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50"
                    onClick={() => productImageInputRef.current?.click()}
                  >
                    {imagePreview ? "Change Image" : "Choose Image"}
                  </Button>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-white text-slate-700"
                      onClick={() => {
                        setProductImageFile(null);
                        setProductForm(current => ({
                          ...current,
                          image: "",
                        }));
                        if (productImageInputRef.current) {
                          productImageInputRef.current.value = "";
                        }
                      }}
                    >
                      Remove Image
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  JPG, JPEG, PNG, or WEBP. Maximum file size: 5 MB.
                </p>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label
                htmlFor="product-description"
                className="text-base font-semibold text-slate-800"
              >
                Description *
              </Label>
              <Textarea
                id="product-description"
                value={productForm.description}
                onChange={e =>
                  setProductForm({
                    ...productForm,
                    description: e.target.value,
                  })
                }
                placeholder="Describe your product quality, origin, and special features..."
                className="min-h-[130px] border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row">
            <Button
              variant="outline"
              className="border-slate-300 bg-white text-slate-800"
              onClick={() => {
                resetForm();
                navigate("/seller/products");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              onClick={handleSaveProduct}
              disabled={isSavingProduct}
            >
              {isSavingProduct
                ? "Saving..."
                : editingProductId
                  ? "Update Product"
                  : "Add Product"}
            </Button>
          </div>
        </section>
      </div>
    );
  };

  const renderProducts = () => {
    const search = productSearchTerm.trim().toLowerCase();
    const filteredProducts = products.filter(product => {
      const matchesSearch = [
        product.name,
        product.title,
        product.category,
      ].some(value =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );
      const matchesStatus =
        productStatusFilter === "all" ||
        (productStatusFilter === "active" && product.isActive !== false) ||
        (productStatusFilter === "deactivated" && product.isActive === false) ||
        product.approvalStatus === productStatusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6">
        <div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Products</h2>
            <p className="mt-1 text-slate-500">
              Manage your farm products and inventory
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={productSearchTerm}
              onChange={event => setProductSearchTerm(event.target.value)}
              placeholder="Search products by name or category"
              aria-label="Search products"
              className="bg-white pl-9"
            />
          </div>
          <Select
            value={productStatusFilter}
            onValueChange={setProductStatusFilter}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filter products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              <SelectItem value="active">Active listings</SelectItem>
              <SelectItem value="deactivated">Deactivated listings</SelectItem>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isProductsLoading && products.length === 0 ? (
          <div role="status" className="rounded-xl bg-white p-8 text-slate-500">
            Loading products...
          </div>
        ) : productsError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-white p-6"
          >
            <p className="text-red-700">{productsError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void fetchProducts()}
            >
              Retry
            </Button>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Image
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Unit
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Stock
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr
                      key={product._id}
                      className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        {product.image && (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <Badge className="bg-blue-100 text-blue-800">
                          {product.category}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-slate-900">
                        {formatPeso(Number(product.price) || 0)}
                      </td>
                      <td className="px-6 py-3 text-slate-900">
                        {product.unit || "Piece"}
                      </td>
                      <td className="px-6 py-3 text-slate-900">
                        <div className="flex min-w-48 items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            aria-label={`Stock for ${product.name}`}
                            value={
                              stockDrafts[product._id] ?? product.stock ?? 0
                            }
                            onChange={event =>
                              setStockDrafts(current => ({
                                ...current,
                                [product._id]: event.target.value,
                              }))
                            }
                            className="w-24"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void handleUpdateInventory(product._id)
                            }
                          >
                            Save
                          </Button>
                        </div>
                        {product.stock > 0 && product.stock <= 5 && (
                          <span className="mt-1 block text-xs font-medium text-amber-700">
                            Low stock (5 or fewer)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            className={
                              product.stock > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {product.stock > 0 ? "Available" : "Out of Stock"}
                          </Badge>
                          <Badge
                            className={
                              product.isActive === false
                                ? "bg-slate-100 text-slate-700"
                                : "bg-emerald-100 text-emerald-800"
                            }
                          >
                            {product.isActive === false
                              ? "Deactivated"
                              : "Active"}
                          </Badge>
                          <Badge
                            className={
                              product.approvalStatus === "rejected"
                                ? "bg-red-100 text-red-800"
                                : product.approvalStatus === "pending"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }
                          >
                            {product.approvalStatus || "approved"}
                          </Badge>
                          {product.moderationReason && (
                            <span className="max-w-48 text-xs text-red-700">
                              {product.moderationReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${product.name}`}
                            title="Edit product"
                            onClick={() => handleEditProduct(product)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={
                              product.isActive === false
                                ? `Activate ${product.name}`
                                : `Deactivate ${product.name}`
                            }
                            title={
                              product.isActive === false
                                ? "Activate listing"
                                : "Deactivate listing"
                            }
                            onClick={() =>
                              void handleToggleProductActive(product)
                            }
                            disabled={isTogglingProductId === product._id}
                          >
                            {product.isActive === false ? (
                              <Eye className="h-4 w-4 text-emerald-700" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-slate-600" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete ${product.name}`}
                            title="Delete product"
                            onClick={() => handleDeleteProduct(product._id)}
                            disabled={isDeletingProduct}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-slate-700">
              {products.length > 0
                ? "No products match your search or filter."
                : "No products yet."}
            </p>
            {products.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                Use the Add Product shortcut on your dashboard to create your
                first listing.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderInventoryOverview = () => {
    const inventoryCards = [
      { label: "Total Products", value: products.length },
      {
        label: "In Stock",
        value: products.filter(product => Number(product.stock) > 0).length,
      },
      {
        label: "Low Stock",
        value: products.filter(
          product => Number(product.stock) > 0 && Number(product.stock) <= 5
        ).length,
      },
      {
        label: "Out of Stock",
        value: products.filter(product => Number(product.stock) <= 0).length,
      },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Inventory overview
          </h2>
          <p className="mt-1 text-slate-500">
            Product and stock levels from your current listings.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {inventoryCards.map(card => (
            <article
              key={card.label}
              className="dashboard-card rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {card.value}
              </p>
            </article>
          ))}
        </div>

        <section className="dashboard-card overflow-hidden bg-white">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
            <h3 className="font-semibold text-slate-900">Product stock</h3>
          </div>
          {products.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              No products are available in your inventory yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Listing status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map(product => (
                    <TableRow key={product._id}>
                      <TableCell className="font-medium">
                        {product.name || product.title}
                      </TableCell>
                      <TableCell>{product.category || "—"}</TableCell>
                      <TableCell>
                        {formatPeso(Number(product.price) || 0)}
                      </TableCell>
                      <TableCell>{Number(product.stock || 0)}</TableCell>
                      <TableCell>
                        {Number(product.stock) > 0
                          ? product.approvalStatus || "Available"
                          : "Out of Stock"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderOrders = () => {
    const search = orderSearchTerm.trim().toLowerCase();
    const filteredOrders = orders.filter(order => {
      const deliveryStatus = normalizeDeliveryStatus(
        order.deliveryStatus || order.status
      );
      const matchesStatus =
        filterStatus === "all" || deliveryStatus === filterStatus;
      const sellerItems = getSellerOrderItems(order);
      const searchFields = [
        order.orderId,
        order._id,
        order.buyerName,
        order.buyerPhone,
        order.buyerEmail,
        ...sellerItems.map((item: any) => item.productName),
      ];
      const matchesSearch = searchFields.some(value =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );
      return matchesStatus && matchesSearch;
    });

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {filterStatus === "all"
              ? "Manage Orders"
              : `${filterStatus} Orders`}
          </h2>
          <p className="mt-1 text-slate-500">
            Review customer orders, payment details, and delivery status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={orderSearchTerm}
              onChange={event => setOrderSearchTerm(event.target.value)}
              placeholder="Search order ID, buyer, or your products"
              aria-label="Search orders"
              className="bg-white pl-9"
            />
          </div>
          <Select
            value={filterStatus}
            onValueChange={status => {
              setFilterStatus(status);
              navigate(
                status === "all"
                  ? "/seller/orders"
                  : `/seller/orders?status=${encodeURIComponent(status)}`
              );
            }}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Transit">In Transit</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isOrdersLoading && orders.length === 0 ? (
          <div role="status" className="rounded-xl bg-white p-8 text-slate-500">
            Loading orders...
          </div>
        ) : ordersError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-white p-6"
          >
            <p className="text-red-700">{ordersError}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => void fetchOrders()}
            >
              Retry
            </Button>
          </div>
        ) : filteredOrders.length > 0 ? (
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Your products</TableHead>
                    <TableHead>Your total</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Order status</TableHead>
                    <TableHead>Delivery status</TableHead>
                    <TableHead>Order date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => {
                    const orderKey = String(order._id || order.orderId);
                    const sellerItems = getSellerOrderItems(order);
                    const deliveryStatus = normalizeDeliveryStatus(
                      order.deliveryStatus || order.status
                    );
                    const paymentMethod =
                      String(order.paymentMethod || "cod").toLowerCase() ===
                      "cod"
                        ? "Cash on Delivery"
                        : String(order.paymentMethod).replaceAll("_", " ");
                    const buyerAddress = [
                      order.buyerAddress?.street,
                      order.buyerAddress?.city,
                      order.buyerAddress?.province,
                      order.buyerAddress?.zipCode,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <Fragment key={orderKey}>
                        <TableRow>
                          <TableCell className="font-medium">
                            {order.orderId ||
                              `#${String(order._id || "").slice(-8)}`}
                          </TableCell>
                          <TableCell>
                            <div className="min-w-32">
                              <p>{order.buyerName || "Customer"}</p>
                              {order.buyerPhone && (
                                <p className="text-xs text-slate-500">
                                  {order.buyerPhone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="min-w-48">
                            {sellerItems
                              .map(
                                (item: any) =>
                                  `${item.productName} × ${item.quantity}`
                              )
                              .join(", ")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-semibold">
                            {formatPeso(getSellerOrderTotal(order))}
                          </TableCell>
                          <TableCell>
                            <div className="min-w-32">
                              <p className="text-sm">{paymentMethod}</p>
                              <p className="text-xs capitalize text-slate-500">
                                {String(
                                  order.paymentStatus || "pending"
                                ).replaceAll("_", " ")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.status || "Order Placed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {order.deliveryStatus || "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-max items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-expanded={expandedOrderId === orderKey}
                                onClick={() =>
                                  setExpandedOrderId(current =>
                                    current === orderKey ? null : orderKey
                                  )
                                }
                              >
                                {expandedOrderId === orderKey
                                  ? "Hide details"
                                  : "Details"}
                              </Button>
                              {deliveryStatus !== "Delivered" &&
                                deliveryStatus !== "Cancelled" && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setConfirmData({
                                        orderId: order._id,
                                        newStatus:
                                          deliveryStatus === "Pending"
                                            ? "In Transit"
                                            : "Delivered",
                                        trackingNumber:
                                          order.trackingNumber || undefined,
                                      });
                                      setConfirmOpen(true);
                                    }}
                                  >
                                    {deliveryStatus === "Pending"
                                      ? "Mark In Transit"
                                      : "Mark Delivered"}
                                  </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedOrderId === orderKey && (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="bg-emerald-50/50 p-4 sm:p-6"
                            >
                              <div className="grid gap-5 md:grid-cols-2">
                                <div className="space-y-2">
                                  <h3 className="font-semibold text-slate-900">
                                    Buyer and payment
                                  </h3>
                                  <p className="text-sm text-slate-700">
                                    {order.buyerName || "Customer"}
                                  </p>
                                  {order.buyerPhone && (
                                    <p className="text-sm text-slate-700">
                                      {order.buyerPhone}
                                    </p>
                                  )}
                                  {order.buyerEmail && (
                                    <p className="break-all text-sm text-slate-700">
                                      {order.buyerEmail}
                                    </p>
                                  )}
                                  {buyerAddress && (
                                    <p className="text-sm text-slate-700">
                                      {buyerAddress}
                                    </p>
                                  )}
                                  <p className="text-sm text-slate-700">
                                    {paymentMethod} ·{" "}
                                    {String(
                                      order.paymentStatus || "pending"
                                    ).replaceAll("_", " ")}
                                  </p>
                                </div>
                                <div>
                                  <h3 className="font-semibold text-slate-900">
                                    Your order items
                                  </h3>
                                  <ul className="mt-2 space-y-2">
                                    {sellerItems.map(
                                      (item: any, index: number) => (
                                        <li
                                          key={`${orderKey}-${item.productId || item.productName}-${index}`}
                                          className="flex justify-between gap-4 text-sm"
                                        >
                                          <span className="text-slate-700">
                                            {item.productName} × {item.quantity}
                                          </span>
                                          <span className="whitespace-nowrap font-medium text-slate-900">
                                            {formatPeso(
                                              getSellerItemTotal(item)
                                            )}
                                          </span>
                                        </li>
                                      )
                                    )}
                                  </ul>
                                  <p className="mt-3 flex justify-between border-t border-emerald-100 pt-3 font-semibold text-slate-900">
                                    <span>Your total</span>
                                    <span>
                                      {formatPeso(getSellerOrderTotal(order))}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            {orders.length === 0
              ? "No orders are available for your products yet."
              : "No orders match your search or status filter."}
          </div>
        )}
      </div>
    );
  };

  const renderReviews = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Reviews</h2>
        <p className="text-slate-500 mt-1">
          See product feedback from buyers and reply when needed.
        </p>
      </div>

      {isReviewsLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          Loading reviews...
        </div>
      ) : reviews.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map(review => (
            <Card key={review._id} className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">
                  {review.product?.name || review.productName || "Product"}
                </CardTitle>
                <CardDescription>
                  {review.buyerName || "Customer"} ·{" "}
                  {new Date(review.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Rating: {review.rating || 0}/5
                  </Badge>
                  <Badge variant="outline">Verified Purchase</Badge>
                </div>
                <p className="text-slate-700">
                  {review.comment || "No comment provided."}
                </p>
                {review.reply ? (
                  <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
                    <p className="text-sm font-medium text-slate-900">
                      Your reply
                    </p>
                    <p>{review.reply}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-slate-700">
                    <p className="text-sm text-slate-500">No reply yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          No reviews have been submitted for your products yet.
        </div>
      )}
    </div>
  );

  const renderDeliveries = () => {
    const normDeliveries = deliveries.map(order => ({
      ...order,
      deliveryStatus: normalizeDeliveryStatus(
        order.deliveryStatus || order.status
      ),
      trackingNumber:
        order.trackingNumber || order.tracking_id || order.tracking || "",
      courier: order.courier || "Havestra Delivery",
    }));

    const pendingCount = normDeliveries.filter(
      order => order.deliveryStatus === "Pending"
    ).length;
    const inTransitCount = normDeliveries.filter(
      order => order.deliveryStatus === "In Transit"
    ).length;
    const deliveredCount = normDeliveries.filter(
      order => order.deliveryStatus === "Delivered"
    ).length;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Deliveries</h2>
          <p className="text-slate-500 mt-1">
            Track active deliveries and shipping status for your orders.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {pendingCount}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">In Transit</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {inTransitCount}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-sm text-slate-500">Delivered</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {deliveredCount}
            </p>
          </div>
        </div>

        {isDeliveriesLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Loading deliveries...
          </div>
        ) : normDeliveries.length > 0 ? (
          <div className="space-y-6">
            {normDeliveries.map(order => (
              <Card key={order._id || order.id} className="border">
                <CardHeader>
                  <CardTitle>
                    Order #
                    {order.orderId ||
                      (order._id && String(order._id).slice(-8))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Tracking Number</p>
                      <p className="font-semibold">
                        {order.trackingNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Courier</p>
                      <p className="font-semibold">
                        {order.courier || "Havestra Delivery"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Current Status</p>
                      <p className="font-semibold">
                        {order.deliveryStatus || order.status}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {FLOW.map(step => {
                      const done =
                        (order.trackingHistory || []).some(
                          (h: any) => h.status === step
                        ) ||
                        order.deliveryStatus === step ||
                        order.status === step;
                      return (
                        <div key={step} className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full ${done ? "bg-emerald-600" : "bg-gray-200"}`}
                          />
                          <div>
                            <div
                              className={`font-medium ${done ? "text-slate-900" : "text-slate-500"}`}
                            >
                              {step}
                            </div>
                            {done && (
                              <div className="text-xs text-slate-400">
                                {(order.trackingHistory || []).find(
                                  (h: any) => h.status === step
                                )?.timestamp
                                  ? new Date(
                                      (order.trackingHistory || []).find(
                                        (h: any) => h.status === step
                                      ).timestamp
                                    ).toLocaleString()
                                  : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => navigate(`/seller/orders`)}>
                      View Orders
                    </Button>
                    <Button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          order.trackingNumber || ""
                        )
                      }
                    >
                      Copy Tracking
                    </Button>
                    {/* Seller actions: move to next stage or mark delivered */}
                    {order.deliveryStatus === "Pending" && (
                      <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => {
                          setConfirmData({
                            orderId: order._id || order.id,
                            newStatus: "In Transit",
                            trackingNumber: order.trackingNumber || undefined,
                          });
                          setConfirmOpen(true);
                        }}
                      >
                        Mark In Transit
                      </Button>
                    )}
                    {order.deliveryStatus === "In Transit" && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          setConfirmData({
                            orderId: order._id || order.id,
                            newStatus: "Delivered",
                            trackingNumber: order.trackingNumber || undefined,
                          });
                          setConfirmOpen(true);
                        }}
                      >
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            No active deliveries currently available.
          </div>
        )}
      </div>
    );
  };

  const renderViews: Record<string, () => React.ReactNode> = {
    dashboard: renderDashboard,
    products: renderProducts,
    inventory: renderInventoryOverview,
    orders: renderOrders,
    "order-summary": renderOrders,
    profile: () => <Profile />,
    "add-product": renderAddProduct,
    reviews: renderReviews,
    analytics: renderAnalytics,
    deliveries: renderDeliveries,
    settings: () => <Profile />,
    wallet: renderWallet,
  };

  return (
    <div className="dashboard-surface relative isolate min-h-screen">
      <BrandWatermark />
      <Toaster position="top-right" />
      <AlertDialog
        open={confirmOpen}
        onOpenChange={open => setConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm status update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark this order as{" "}
              {confirmData?.newStatus}? This will update the delivery status for
              the customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-[#fffdf8]/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg">
                  <BrandMark className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-emerald-900 sm:text-xl">
                    Havestra
                  </h1>
                  <p className="text-xs text-slate-500 sm:text-sm">
                    Seller dashboard
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 duration-200"
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
                    <DropdownMenuItem
                      onClick={() => navigate("/seller/profile")}
                    >
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
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {activeTab !== "dashboard" && (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/seller/dashboard")}
            className="mb-5 border-emerald-200 text-emerald-800 transition-colors hover:bg-emerald-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Seller Dashboard
          </Button>
        )}
        {renderViews[activeTab]?.()}
      </main>
    </div>
  );
}
