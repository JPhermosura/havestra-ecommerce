import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Package,
  ShoppingCart,
  DollarSign,
  Star,
  Truck,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Upload,
  Settings,
  User as UserIcon,
  Home,
  TrendingUp,
  MessageSquare,
  Search,
  Bell,
  CheckCircle,
  Clock,
  Award,
  Image as ImageIcon,
  LogOut,
  X,
  ChevronRight,
  MoreHorizontal,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Mail,
  Phone,
  MapPin,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { resolveProductImageUrl } from "@/lib/utils";
import { Toaster, toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  harvestSeason: string;
  bulkPricing: { minQuantity: number; discountPercent: number }[];
  status: string;
};

type Order = {
  id: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  items: { productId: string; name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: string;
  deliveryStatus: string;
  orderDate: string;
  deliveryMethod: string;
  trackingNumber?: string;
  courier?: string;
  estimatedDelivery?: string;
  trackingHistory?: Array<{ status: string; timestamp: string }>;
  cancelReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  refundStatus?: string;
};

const SELLER_ORDER_STATUSES = [
  "Pending",
  "In Transit",
  "Delivered",
] as const;
const SELLER_ORDER_FILTERS = [
  "all",
  "Pending",
  "In Transit",
  "Delivered",
  "Cancelled",
] as const;
const STATUS_LABELS: Record<string, string> = {
  "Pending": "Pending",
  "In Transit": "In Transit",
  "Delivered": "Delivered",
  "Cancelled": "Cancelled",
};

const getStatusBadgeClasses = (status: string) => {
  switch (status) {
    case "Pending":
      return "text-blue-700 bg-blue-100 border-blue-200";
    case "In Transit":
      return "text-purple-700 bg-purple-100 border-purple-200";
    case "Delivered":
      return "text-emerald-700 bg-emerald-100 border-emerald-200";
    case "Cancelled":
      return "text-red-700 bg-red-100 border-red-200";
    default:
      return "text-muted-foreground bg-slate-100 border-slate-200";
  }
};

const normalizeStatus = (value: string) => String(value || "").toLowerCase();

const formatOrderAddress = (address: any) => {
  if (!address) return "";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    return `${address.street || ""}${address.street ? ", " : ""}${address.city || ""}${address.city ? ", " : ""}${address.province || ""}${address.zipCode ? " " + address.zipCode : ""}`.trim();
  }
  return "";
};

const normalizeDeliveryStatus = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("deliver")) return "Delivered";
  if (normalized.includes("transit") || normalized.includes("ship") || normalized.includes("out for")) return "In Transit";
  return "Pending";
};

const formatDeliveryDate = (value: string | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatOrderDate = (date: any) => {
  const parsedDate = new Date(date || "");
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown date";
  }
  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

type Review = {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  buyerName: string;
  buyerAvatar: string;
  rating: number;
  comment: string;
  date: string;
  verifiedPurchase: boolean;
  reply?: string;
  replyDate?: string;
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  unit: string;
  harvestSeason: string;
  images: string[];
};

type RevenuePoint = {
  date: string;
  revenue: number;
  orders: number;
  productsSold: number;
};

type OrderStatusBreakdown = {
  status: string;
  count: number;
};

type CustomerMetrics = {
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  averageOrderValue: number;
  averageRating: number;
  reviewCount: number;
};

type SellerAnalyticsData = {
  revenueHistory: RevenuePoint[];
  salesTrends: Array<{ _id: string; revenue: number; orders: number }>;
  orderStatusSummary: OrderStatusBreakdown[];
  customerMetrics: CustomerMetrics;
  productPerformance: Array<{
    name: string;
    price: number;
    stock: number;
    rating: number;
    ordersCount: number;
  }>;
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  processing: "#6366f1",
  shipped: "#0ea5e9",
  delivered: "#10b981",
  cancelled: "#ef4444",
};

// Mock data
const defaultStats = {
  totalSales: 0,
  totalOrders: 0,
  totalProducts: 0,
  totalReviews: 0,
};

const mockSalesData = [
  { day: "Mon", revenue: 1200, orders: 5 },
  { day: "Tue", revenue: 1800, orders: 8 },
  { day: "Wed", revenue: 1500, orders: 6 },
  { day: "Thu", revenue: 2200, orders: 10 },
  { day: "Fri", revenue: 1900, orders: 7 },
  { day: "Sat", revenue: 2800, orders: 12 },
  { day: "Sun", revenue: 1600, orders: 6 },
];

const mockRevenueSummary = {
  today: 850,
  weekly: 10250,
  monthly: 42850,
  total: 125600,
};

const mockStoreHealth = {
  storeRating: 4.7,
  responseRate: 95,
  orderCompletion: 98,
  deliveryPerformance: 96,
};

const sellerMenuItems = [
  { title: "Dashboard", url: "/seller/dashboard", icon: Home },
  { title: "Profile", url: "/seller/profile", icon: UserIcon },
  { title: "Products", url: "/seller/products", icon: Package },
  { title: "Orders", url: "/seller/orders", icon: ShoppingCart },
  { title: "Deliveries", url: "/seller/deliveries", icon: Truck },
  { title: "Reviews", url: "/seller/reviews", icon: Star },
  { title: "Analytics", url: "/seller/analytics", icon: BarChart3 },
  { title: "Settings", url: "/seller/settings", icon: Settings },
];

// Animated Counter Component
const AnimatedCounter = ({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);

    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = "from-emerald-500 to-emerald-600",
}: {
  title: string;
  value: number | string;
  icon: any;
  trend?: "up" | "down";
  trendValue?: string;
  color?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-slate-100"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-sm font-medium ${trend === "up" ? "text-emerald-600" : "text-red-600"}`}
        >
          {trend === "up" ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          {trendValue}
        </div>
      )}
    </div>
    <div>
      <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-slate-900">
        {typeof value === "number" ? (
          <AnimatedCounter value={value} prefix="₱" />
        ) : (
          value
        )}
      </h3>
    </div>
  </motion.div>
);

export default function SellerDashboard() {
  const { user, logout, updateProfile } = useAuth();
  const [location, navigate] = useLocation();
  const [products, setProducts] = useState<Product[]>([]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState(defaultStats);
  const [revenueSummary, setRevenueSummary] = useState({
    today: 0,
    weekly: 0,
    monthly: 0,
    total: 0,
  });
  const [analyticsData, setAnalyticsData] = useState<SellerAnalyticsData>({
    revenueHistory: [],
    salesTrends: [],
    orderStatusSummary: [],
    customerMetrics: {
      totalCustomers: 0,
      repeatCustomers: 0,
      newCustomers: 0,
      averageOrderValue: 0,
      averageRating: 0,
      reviewCount: 0,
    },
    productPerformance: [],
  });
  const [analyticsRange, setAnalyticsRange] = useState<"7d" | "30d" | "90d">(
    "30d"
  );
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReviewToReply, setSelectedReviewToReply] =
    useState<Review | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewRatingFilter, setReviewRatingFilter] = useState<
    "all" | "5" | "4" | "3" | "2" | "1"
  >("all");
  const [reviewSort, setReviewSort] = useState<"newest" | "highest" | "lowest">(
    "newest"
  );
  const [reviewPage, setReviewPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDeliveryOrder, setSelectedDeliveryOrder] = useState<any>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    trackingNumber: "",
    courier: "",
    estimatedDelivery: "",
  });
  const reviewsPerPage = 6;
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    country: user?.country || "",
    zipCode: user?.zipCode || "",
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getAuthHeader = () => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("ecommerce_token") ||
      localStorage.getItem("auth_token");
    return { Authorization: `Bearer ${token}` };
  };

  const isEditing = Boolean(editingProductId);

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    unit: "kg",
    harvestSeason: "",
    images: [] as string[],
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newImages: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = event => {
          if (event.target?.result) {
            newImages.push(event.target.result as string);
            if (newImages.length === files.length) {
              setProductForm(prev => ({
                ...prev,
                images: [...prev.images, ...newImages],
              }));
            }
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const fetchProducts = async () => {
    try {
      if (!user?.id) {
        setProducts([]);
        return;
      }
      const response = await axios.get(`/api/products/seller/${user.id}`);
      const productsData = response.data?.products;
      if (Array.isArray(productsData)) {
        setProducts(
          productsData.map((product: any) => ({
            id: String(product._id || product.id || ""),
            name: product.name || product.title || "",
            description: product.description || product.details || "",
            price: Number(product.price ?? product.unitPrice ?? 0),
            stock: Number(product.stock ?? 0),
            category: product.category || "",
            images: Array.isArray(product.images)
              ? product.images
              : product.image
                ? [product.image]
                : [],
            harvestSeason: product.harvestSeason || product.season || "",
            bulkPricing: Array.isArray(product.bulkPricing)
              ? product.bulkPricing
              : [],
            status: product.status || product.availability || "active",
          }))
        );
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Error fetching seller products:", error);
      setProducts([]);
    }
  };

  const fetchOrders = async () => {
    try {
      if (!user?.id) {
        setOrders([]);
        return;
      }
      const response = await axios.get(`/api/orders/seller/${user.id}`);
      const responseOrders = response.data;
      const ordersData = Array.isArray(responseOrders)
        ? responseOrders
        : Array.isArray(responseOrders?.orders)
          ? responseOrders.orders
          : [];

      const mappedOrders = ordersData.map((order: any) => ({
        id: order._id ? String(order._id) : order.id || order.orderId || "",
        buyerName: order.buyerName || order.buyer?.name || "Customer",
        buyerPhone: order.buyerPhone || order.buyer?.phone || "",
        buyerAddress: formatOrderAddress(order.buyerAddress),
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
              productId: item.productId || item._id || "",
              name: item.productName || item.name || "Product",
              quantity: item.quantity || 0,
              price: item.unitPrice ?? item.price ?? 0,
            }))
          : [],
        totalAmount: order.totalAmount ?? order.total ?? 0,
        status: order.status || order.orderStatus || "Pending",
        orderDate:
          order.createdAt || order.orderDate || new Date().toISOString(),
        deliveryMethod:
          order.shippingMethod || order.deliveryMethod || "Standard Delivery",
        cancelReason:
          order.cancelReason ||
          order.cancel_reason ||
          order.cancellationReason ||
          undefined,
        cancelledAt: order.cancelledAt || order.cancelled_at || undefined,
        cancelledBy: order.cancelledBy || order.cancelled_by || undefined,
        refundStatus: order.refundStatus || order.refund_status || undefined,
      }));

      setOrders(mappedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
    }
  };

  const fetchSellerDashboard = async () => {
    try {
      if (!user?.id) {
        setStats(defaultStats);
        return;
      }
      const response = await axios.get("/api/seller/dashboard", {
        headers: getAuthHeader(),
      });
      const dashboardStats = response.data?.stats;
      if (dashboardStats) {
        setStats({
          totalSales: dashboardStats.totalSales ?? defaultStats.totalSales,
          totalOrders: dashboardStats.totalOrders ?? defaultStats.totalOrders,
          totalProducts:
            dashboardStats.totalProducts ?? defaultStats.totalProducts,
          totalReviews:
            dashboardStats.totalReviews ?? defaultStats.totalReviews,
        });
      }

      // Calculate revenue summary
      const revenueHistory: RevenuePoint[] = Array.isArray(response.data?.revenueHistory)
        ? response.data.revenueHistory.map((item: any) => ({
            date: item._id || item.date || item.day || "",
            revenue: Number(item.revenue ?? 0),
            orders: Number(item.orders ?? 0),
            productsSold: Number(item.productsSold ?? 0),
          }))
        : [];
      setAnalyticsData({
        revenueHistory,
        salesTrends: Array.isArray(response.data?.salesTrends)
          ? response.data.salesTrends
          : [],
        orderStatusSummary: Array.isArray(response.data?.orderStatusSummary)
          ? response.data.orderStatusSummary
          : [],
        customerMetrics: response.data?.customerMetrics || {
          totalCustomers: 0,
          repeatCustomers: 0,
          newCustomers: 0,
          averageOrderValue: 0,
          averageRating: 0,
          reviewCount: 0,
        },
        productPerformance: Array.isArray(response.data?.productPerformance)
          ? response.data.productPerformance.map((item: any) => ({
              name: item.name || item.title || "Product",
              price: Number(item.price ?? 0),
              stock: Number(item.stock ?? 0),
              rating: Number(item.rating ?? 0),
              ordersCount: Number(item.ordersCount ?? 0),
            }))
          : [],
      });

      // Calculate revenue summary (today/weekly/monthly/total
      const today = new Date();
      const todayStr = today.toLocaleDateString('en-US', { weekday: 'short' });
      const todayRevenue = revenueHistory.find((item: RevenuePoint) => item.date === todayStr)?.revenue || 0;
      const weeklyRevenue = revenueHistory.reduce(
        (sum: number, item: RevenuePoint) => sum + item.revenue,
        0
      );
      setRevenueSummary({
        today: todayRevenue,
        weekly: weeklyRevenue,
        monthly: weeklyRevenue * 4,
        total:
          dashboardStats?.totalSales ?? dashboardStats?.revenue ?? 0,
      });
    } catch (err) {
      console.warn(
        "Error fetching seller dashboard, using default stats",
        err
      );
      setStats(defaultStats);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSellerDashboard(),
        fetchOrders(),
        fetchProducts(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const pathSegment = location.split("/").pop();
    const normalizedPath =
      !pathSegment || pathSegment === "seller" || pathSegment === "" ? "dashboard" : pathSegment;
    setActiveTab(normalizedPath);
  }, [location]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      country: user?.country || "",
      zipCode: user?.zipCode || "",
    });
  }, [user]);

  useEffect(() => {
    if (user?.id && activeTab === "dashboard") {
      fetchAllData();
    } else if (user?.id) {
      fetchOrders();
      fetchProducts();
    }
  }, [location, user?.id, activeTab]);

  // React Query: seller products
  const queryClient = useQueryClient();
  const { data: sellerProductsData, refetch: refetchSellerProducts } = useQuery(
    ["sellerProducts", user?.id],
    async () => {
      const resp = await axios.get(`/api/products/seller/${user?.id}`);
      return resp.data?.products || [];
    },
    { enabled: !!user?.id }
  );

  useEffect(() => {
    if (Array.isArray(sellerProductsData)) {
      setProducts(
        sellerProductsData.map((product: any) => ({
          id: String(product._id || product.id || ""),
          name: product.name || product.title || "",
          description: product.description || product.details || "",
          price: Number(product.price ?? product.unitPrice ?? 0),
          stock: Number(product.stock ?? 0),
          category: product.category || "",
          images: Array.isArray(product.images)
            ? product.images
            : product.image
              ? [product.image]
              : [],
          harvestSeason: product.harvestSeason || product.season || "",
          bulkPricing: Array.isArray(product.bulkPricing)
            ? product.bulkPricing
            : [],
          status: product.status || product.availability || "active",
        }))
      );
    }
  }, [sellerProductsData]);

  // React Query: seller reviews
  const {
    data: sellerReviewsData,
    refetch: refetchSellerReviews,
    isLoading: reviewsQueryLoading,
  } = useQuery(
    ["sellerReviews", user?.id],
    async () => {
      const resp = await axios.get(`/api/seller/reviews/${user?.id}`);
      return resp.data?.reviews || [];
    },
    { enabled: !!user?.id && activeTab === "reviews" }
  );

  useEffect(() => {
    if (Array.isArray(sellerReviewsData)) {
      setReviews(
        sellerReviewsData.map((r: any) => ({
          id: String(r._id || r.id || ""),
          productId: String(r.productId),
          productName: r.product?.name || r.productName || "",
          productImage:
            r.product?.image ||
            r.productImage ||
            "https://images.unsplash.com/photo-1546094096-0df2a85e6fcc?w=300&h=200&fit=crop",
          buyerName: r.buyer?.name || r.userName || "Customer",
          buyerAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.buyer?.name || r.userName || "User")}&background=10b981&color=ffffff`,
          rating: Number(r.rating || 0),
          comment: r.comment || "",
          date: r.createdAt || r.date || new Date().toISOString(),
          verifiedPurchase: !!r.isVerified,
          reply: r.sellerResponse?.comment || r.reply || undefined,
          replyDate: r.sellerResponse?.respondedAt || r.replyDate || undefined,
        }))
      );
    }
  }, [sellerReviewsData]);

  // Mutation for posting seller reply
  const replyMutation = useMutation(
    async (payload: { reviewId: string; comment: string }) => {
      const resp = await axios.post("/api/reviews/reply", payload);
      return resp.data;
    },
    {
      onSuccess: () => {
        refetchSellerReviews();
        queryClient.invalidateQueries(["sellerReviews", user?.id]);
        toast.success("Reply posted successfully");
      },
      onError: (err: any) => {
        console.error("Reply error:", err);
        toast.error("Failed to post reply");
      },
    }
  );

  useEffect(() => {
    if (activeTab !== "reviews") {
      return;
    }

    setIsReviewsLoading(true);
    const timer = window.setTimeout(() => setIsReviewsLoading(false), 350);
    return () => window.clearTimeout(timer);
  }, [activeTab]);

  const handleSaveProduct = async () => {
    if (
      !productForm.name ||
      !productForm.price ||
      !productForm.stock ||
      !productForm.category ||
      !productForm.unit
    ) {
      toast.error(
        "Please fill in all required fields: name, price, stock, category, and unit"
      );
      return;
    }

    try {
      // Convert base64 images to files
      const files: File[] = [];
      for (const image of productForm.images) {
        const response = await fetch(image);
        const blob = await response.blob();
        files.push(
          new File([blob], `image-${Date.now()}.png`, { type: "image/png" })
        );
      }

      // Create FormData
      const formData = new FormData();
      files.forEach(file => {
        formData.append("images", file);
      });

      // Add product data as JSON
      const productData = {
        name: productForm.name,
        title: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock),
        category: productForm.category,
        unit: productForm.unit,
        status: "active",
        season: productForm.harvestSeason || "All",
        image:
          productForm.images[0] ||
          "https://images.unsplash.com/photo-1546094096-0df2a85e6fcc?w=400&h=400&fit=crop",
      };

      formData.append("productData", JSON.stringify(productData));

      // Debug log: show what will be sent to the server
      console.log("[seller] submit productData:", productData);
      console.log("[seller] files to upload:", files.map(f => ({ name: f.name, size: f.size })));

      const request = editingProductId
        ? axios.put(`/api/products/${editingProductId}`, formData, {
            headers: getAuthHeader(),
          })
        : axios.post("/api/products", formData, {
            headers: getAuthHeader(),
          });

      await request;

      await fetchProducts();
      refetchSellerProducts(); // Refetch React Query data
      queryClient.invalidateQueries(["sellerProducts", user?.id]); // Invalidate query to refresh
      fetchSellerDashboard();

      setProductForm({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "",
        unit: "kg",
        harvestSeason: "",
        images: [],
      });
      setIsAddProductOpen(false);
      setEditingProductId(null);
      toast.success(
        editingProductId
          ? "Product updated successfully!"
          : "Product created successfully!"
      );
    } catch (error: any) {
      console.error("Error saving product:", error);
      const errorMsg =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to save product";
      toast.error(`Failed to save product: ${errorMsg}`);
    }
  };

  const updateStatus = async (
    orderId: string,
    newStatus: string,
    trackingNumber?: string,
    courier?: string,
    estimatedDelivery?: string
  ) => {
    try {
      if (!SELLER_ORDER_STATUSES.includes(newStatus as any)) {
        toast.error("Invalid status selection");
        return;
      }

      const payload: any = { status: newStatus };
      if (trackingNumber !== undefined) {
        payload.trackingNumber = trackingNumber;
      }
      if (courier !== undefined) {
        payload.courier = courier;
      }
      if (estimatedDelivery !== undefined) {
        payload.estimatedDelivery = estimatedDelivery;
      }

      await axios.put(
        `/api/orders/${orderId}/status`,
        payload,
        { headers: getAuthHeader() }
      );
      await fetchOrders();
      await fetchSellerDashboard();
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error: any) {
      console.error("Error updating order status:", error);
      const message =
        error?.response?.data?.error || "Failed to update order status";
      toast.error(message);
      await fetchOrders();
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      category: product.category,
      unit: "kg",
      harvestSeason: product.harvestSeason,
      images: product.images,
    });
    setIsAddProductOpen(true);
  };

  const handleCloseProductDialog = () => {
    setIsAddProductOpen(false);
    setEditingProductId(null);
    setProductForm({
      name: "",
      description: "",
      price: "",
      stock: "",
      category: "",
      unit: "kg",
      harvestSeason: "",
      images: [],
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!productId) {
      toast.error("Invalid product ID");
      return;
    }

    try {
      await axios.delete(`/api/products/${productId}`, {
        headers: getAuthHeader(),
      });
      setProducts(products.filter(p => p.id !== productId));
      toast.success("Product deleted successfully");
      fetchProducts();
      refetchSellerProducts();
      queryClient.invalidateQueries(["sellerProducts", user?.id]);
      fetchSellerDashboard();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      const errorMsg =
        error?.response?.data?.error || "Failed to delete product";
      toast.error(`Failed to delete product: ${errorMsg}`);
    }
  };

  const filteredProducts = (Array.isArray(products) ? products : []).filter(
    product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterStatus === "all" || product.status === filterStatus)
  );

  const filteredOrders = (Array.isArray(orders) ? orders : []).filter(
    order =>
      order.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterStatus === "all" || order.status === filterStatus)
  );

  const cancelledOrders = useMemo(
    () =>
      Array.isArray(orders)
        ? orders.filter(order => order.status === "cancelled")
        : [],
    [orders]
  );

  const recentCancelledOrders = useMemo(
    () => cancelledOrders.slice(0, 4),
    [cancelledOrders]
  );

  const totalCancelledValue = useMemo(
    () => cancelledOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    [cancelledOrders]
  );

  const reviewRatingCounts = useMemo(() => {
    const counts = [5, 4, 3, 2, 1].map(value => ({
      rating: value,
      count: reviews.filter(review => review.rating === value).length,
    }));
    return counts;
  }, [reviews]);

  const totalReviewCount = reviews.length;
  const averageReviewRating = useMemo(() => {
    if (!reviews.length) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return Number((total / reviews.length).toFixed(1));
  }, [reviews]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(value);

  const filteredRevenueHistory = useMemo(() => {
    const days =
      analyticsRange === "7d" ? 7 : analyticsRange === "30d" ? 30 : 60;
    return analyticsData.revenueHistory.slice(-days).map(item => ({
      ...item,
      date: item.date,
    }));
  }, [analyticsData.revenueHistory, analyticsRange]);

  const topProductsList = useMemo(
    () => analyticsData.productPerformance.slice(0, 5),
    [analyticsData.productPerformance]
  );

  const filteredReviews = useMemo(() => {
    let filtered = reviews;

    if (reviewSearch.trim()) {
      const term = reviewSearch.trim().toLowerCase();
      filtered = filtered.filter(
        review =>
          review.productName.toLowerCase().includes(term) ||
          review.buyerName.toLowerCase().includes(term) ||
          review.comment.toLowerCase().includes(term)
      );
    }

    if (reviewRatingFilter !== "all") {
      filtered = filtered.filter(
        review => String(review.rating) === reviewRatingFilter
      );
    }

    if (reviewSort === "highest") {
      filtered = [...filtered].sort((a, b) => b.rating - a.rating);
    } else if (reviewSort === "lowest") {
      filtered = [...filtered].sort((a, b) => a.rating - b.rating);
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    return filtered;
  }, [reviews, reviewSearch, reviewRatingFilter, reviewSort]);

  const visibleReviews = filteredReviews.slice(0, reviewPage * reviewsPerPage);
  const canLoadMoreReviews = visibleReviews.length < filteredReviews.length;

  const handleLoadMoreReviews = () => {
    setReviewPage(page => page + 1);
  };

  const handleOpenReplyDialog = (review: Review) => {
    setSelectedReviewToReply(review);
    setReplyMessage("");
  };

  const handleSendReply = () => {
    if (!selectedReviewToReply) return;
    const payload = {
      reviewId: selectedReviewToReply.id,
      comment: replyMessage || "Thank you for your review.",
    };
    replyMutation.mutate(payload, {
      onSuccess: () => {
        setSelectedReviewToReply(null);
        setReplyMessage("");
      },
    });
  };

  const inStockProducts = products.filter(p => p.stock > 20);
  const lowStockProducts = products.filter(p => p.stock > 0 && p.stock <= 20);
  const outOfStockProducts = products.filter(p => p.stock === 0);

  const renderDashboard = () => (
    <div className="space-y-8 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Seller Dashboard</h1>
          <p className="text-slate-500">
            View your store performance, manage products, and handle orders.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
            >
              <UserIcon className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" side="bottom" sideOffset={8}>
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.name}</span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/seller/profile")}>
              My Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { logout(); navigate("/login", { replace: true }); }}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              icon: Plus,
              label: "Add Product",
              value: "New",
              onClick: () => setIsAddProductOpen(true),
              color: "from-emerald-500 to-emerald-600",
            },
            {
              icon: Package,
              label: "Products",
              value: stats.totalProducts,
              onClick: () => navigate("/seller/products"),
              color: "from-blue-500 to-blue-600",
            },
            {
              icon: ShoppingCart,
              label: "Orders",
              value: stats.totalOrders,
              onClick: () => navigate("/seller/orders"),
              color: "from-purple-500 to-purple-600",
            },
            {
              icon: BarChart3,
              label: "Revenue",
              value: `₱${revenueSummary.total.toLocaleString()}`,
              onClick: () => navigate("/seller/analytics"),
              color: "from-amber-500 to-amber-600",
            },
            {
              icon: Star,
              label: "Reviews",
              value: stats.totalReviews,
              onClick: () => navigate("/seller/reviews"),
              color: "from-teal-500 to-teal-600",
            },
            {
              icon: Settings,
              label: "Settings",
              value: "Update",
              onClick: () => navigate("/seller/settings"),
              color: "from-slate-500 to-slate-600",
            },
          ].map(action => (
            <motion.button
              key={action.label}
              type="button"
              onClick={action.onClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative z-10 text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md cursor-pointer focus:outline-none"
            >
              <div className="flex items-center justify-between gap-4">
                <div className={`rounded-3xl p-4 bg-gradient-to-br ${action.color}`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {action.label}
                </span>
              </div>
              <p className="mt-6 text-3xl font-bold text-slate-900">
                {action.value}
              </p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Revenue Summary & Charts */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Sales Performance</CardTitle>
            <CardDescription>
              Weekly revenue and orders overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData.revenueHistory}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest order activity</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-full" />
                  </div>
                ))
              ) : filteredOrders.slice(0, 5).length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No orders yet</p>
                </div>
              ) : (
                filteredOrders.slice(0, 5).map(order => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center">
                        <ShoppingCart className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {order.buyerName}
                        </p>
                        <p className="text-sm text-slate-500">
                          Order #{order.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        ₱{order.totalAmount.toLocaleString()}
                      </p>
                      <Badge
                        className={`${getStatusBadgeClasses(order.status)} mt-1`}
                      >
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Best Selling Products */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Best Selling Products</CardTitle>
                <CardDescription>Top performing items</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-4">
                    <Skeleton className="h-14 w-14 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-16 rounded" />
                  </div>
                ))
              ) : filteredProducts.slice(0, 5).length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No products yet</p>
                </div>
              ) : (
                filteredProducts.slice(0, 5).map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200">
                      <img
                        src={
                          resolveProductImageUrl(
                            product.images?.[0],
                            product.name
                          ) ||
                          "https://images.unsplash.com/photo-1546094096-0df2a85e6fcc?w=300&h=300&fit=crop"
                        }
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 truncate">
                        {product.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">
                          ₱{product.price.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-400">•</span>
                        <span
                          className={`text-sm font-medium ${product.stock === 0 ? "text-red-600" : product.stock <= 20 ? "text-orange-600" : "text-emerald-600"}`}
                        >
                          {product.stock} in stock
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-emerald-100 text-emerald-700 border-0">
                        {index + 1 === 1
                          ? "🥇 Top"
                          : index + 1 === 2
                            ? "🥈"
                            : index + 1 === 3
                              ? "🥉"
                              : `#${index + 1}`}
                      </Badge>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <CardTitle>Cancellation Activity</CardTitle>
              <CardDescription>
                Recent buyer cancellations and refund status.
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">
                Cancelled orders this period
              </p>
              <p className="text-2xl font-bold text-red-700">
                {cancelledOrders.length}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cancelledOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No cancelled orders yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCancelledOrders.map(order => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-slate-200 p-4 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      Order #{order.id.slice(0, 8)} • {order.buyerName}
                    </p>
                    <p className="text-sm text-slate-500">
                      Cancelled by {order.cancelledBy || "buyer"} on{" "}
                      {order.cancelledAt
                        ? new Date(order.cancelledAt).toLocaleDateString()
                        : "unknown date"}
                    </p>
                    {order.cancelReason && (
                      <p className="text-sm text-slate-600 mt-1">
                        Reason: {order.cancelReason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900">
                      ₱{order.totalAmount.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500">
                      Refund status: {order.refundStatus || "pending"}
                    </p>
                  </div>
                </div>
              ))}
              {cancelledOrders.length > recentCancelledOrders.length && (
                <p className="text-sm text-slate-500">
                  Showing {recentCancelledOrders.length} of{" "}
                  {cancelledOrders.length} cancelled orders.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Management */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <CardDescription>Monitor your product stock levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* In Stock */}
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-emerald-500 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-emerald-700 font-semibold">In Stock</p>
                  <p className="text-3xl font-bold text-emerald-900">
                    {inStockProducts.length}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {inStockProducts.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm bg-white/50 rounded-lg px-3 py-2"
                  >
                    <span className="text-emerald-800 truncate">{p.name}</span>
                    <span className="text-emerald-700 font-semibold">
                      {p.stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Stock */}
            <div className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl border border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-500 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-orange-700 font-semibold">Low Stock</p>
                  <p className="text-3xl font-bold text-orange-900">
                    {lowStockProducts.length}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {lowStockProducts.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm bg-white/50 rounded-lg px-3 py-2"
                  >
                    <span className="text-orange-800 truncate">{p.name}</span>
                    <span className="text-orange-700 font-semibold">
                      {p.stock}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Out of Stock */}
            <div className="p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl border border-red-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500 rounded-xl">
                  <X className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-red-700 font-semibold">Out of Stock</p>
                  <p className="text-3xl font-bold text-red-900">
                    {outOfStockProducts.length}
                  </p>
                </div>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {outOfStockProducts.slice(0, 3).map(p => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm bg-white/50 rounded-lg px-3 py-2"
                  >
                    <span className="text-red-800 truncate">{p.name}</span>
                    <span className="text-red-700 font-semibold">0</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Health */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Store Health</CardTitle>
          <CardDescription>Performance metrics for your store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                label: "Store Rating",
                value: mockStoreHealth.storeRating,
                icon: Star,
                color: "#10b981",
              },
              {
                label: "Response Rate",
                value: mockStoreHealth.responseRate,
                icon: MessageSquare,
                color: "#3b82f6",
              },
              {
                label: "Order Completion",
                value: mockStoreHealth.orderCompletion,
                icon: CheckCircle,
                color: "#10b981",
              },
              {
                label: "Delivery Performance",
                value: mockStoreHealth.deliveryPerformance,
                icon: Truck,
                color: "#8b5cf6",
              },
            ].map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <metric.icon
                      className="h-5 w-5"
                      style={{ color: metric.color }}
                    />
                    <span className="font-medium text-slate-700">
                      {metric.label}
                    </span>
                  </div>
                  <span
                    className="text-lg font-bold"
                    style={{ color: metric.color }}
                  >
                    {metric.value}%
                  </span>
                </div>
                <Progress
                  value={metric.value}
                  className="h-2"
                  style={
                    {
                      backgroundColor: `${metric.color}20`,
                      "--tw-progress-fill": metric.color,
                    } as React.CSSProperties
                  }
                />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Product Management
          </h2>
          <p className="text-slate-500 mt-1">
            Manage your farm products and inventory
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.length > 0 ? filteredProducts.map(product => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100 group"
          >
            <div className="relative h-48 bg-slate-100">
              <img
                src={
                  resolveProductImageUrl(product.images?.[0], product.name) ||
                  "https://images.unsplash.com/photo-1546094096-0df2a85e6fcc?w=400&h=300&fit=crop"
                }
                alt={product.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9 rounded-xl bg-white/90 hover:bg-red-50 text-red-600"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Badge
                className={`absolute top-3 left-3 ${product.stock === 0 ? "bg-red-500 text-white" : product.stock <= 20 ? "bg-orange-500 text-white" : "bg-emerald-500 text-white"}`}
              >
                {product.stock === 0
                  ? "Out of Stock"
                  : product.stock <= 20
                    ? "Low Stock"
                    : "In Stock"}
              </Badge>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-slate-100 text-slate-700 border-0">
                  {product.category}
                </Badge>
                <span className="text-sm text-slate-500">
                  {product.stock} in stock
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 text-lg mb-1 truncate">
                {product.name}
              </h3>
              <p className="text-2xl font-bold text-emerald-600 mb-4">
                ₱{product.price.toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => handleEditProduct(product)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16">
            <Package className="w-24 h-24 text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Products Yet</h3>
            <p className="text-slate-500 mb-6 text-center max-w-md">
              Start by adding your first product to showcase your farm items!
            </p>
            <Button
              onClick={() => setIsAddProductOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Product
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Order Management</h2>
        <p className="text-slate-500 mt-1">
          View and manage your customer orders
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Filter status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {SELLER_ORDER_FILTERS.map(status => (
              <SelectItem key={status} value={status}>
                {status === "all" ? "All Status" : STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map(order => (
                <TableRow key={order.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    #{order.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{order.buyerName}</TableCell>
                  <TableCell>
                    {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="font-bold">
                    ₱{order.totalAmount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusBadgeClasses(order.status)}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatOrderDate(order.orderDate)}</TableCell>
                  <TableCell className="text-right">
                    {order.status === "cancelled" ? (
                      <Badge className="bg-red-100 text-red-700 border-red-200">
                        Cancelled
                      </Badge>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          defaultValue={order.status}
                          onValueChange={value => updateStatus(order.id, value)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SELLER_ORDER_STATUSES.map(status => (
                              <SelectItem key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );

  const renderReviews = () => (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            Customer Reviews
          </h2>
          <p className="text-slate-500 mt-1">
            {reviews.length} reviews from happy customers
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            <span className="font-bold text-xl">{averageReviewRating}</span>
            <span className="text-slate-500">/5</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select
          value={reviewRatingFilter}
          onValueChange={(v: any) => setReviewRatingFilter(v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Filter by rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map(r => (
              <SelectItem key={r} value={String(r)}>
                {r} Star{r !== 1 ? "s" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewSort} onValueChange={(v: any) => setReviewSort(v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="highest">Highest Rated</SelectItem>
            <SelectItem value="lowest">Lowest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleReviews.map(review => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-slate-100"
          >
            <div className="flex items-start gap-4 mb-4">
              <Avatar className="h-12 w-12 border-2 border-slate-100">
                <AvatarImage src={review.buyerAvatar} />
                <AvatarFallback className="bg-emerald-600">
                  {review.buyerName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-slate-900">
                  {review.buyerName}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-300"}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-slate-500 mb-1">
                Product: {review.productName}
              </p>
              <p className="text-slate-700">{review.comment}</p>
            </div>
            {review.reply ? (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 mb-1">
                  Your Reply
                </p>
                <p className="text-slate-700 text-sm">{review.reply}</p>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => handleOpenReplyDialog(review)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Reply to Review
              </Button>
            )}
          </motion.div>
        ))}
      </div>

      {canLoadMoreReviews && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={handleLoadMoreReviews}
            className="px-8"
          >
            Load More Reviews
          </Button>
        </div>
      )}

      {/* Reply Dialog */}
      <Dialog
        open={!!selectedReviewToReply}
        onOpenChange={open => !open && setSelectedReviewToReply(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>
              Respond to {selectedReviewToReply?.buyerName}'s feedback
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm font-medium text-slate-500 mb-2">
                Customer's Review:
              </p>
              <p className="text-slate-700">{selectedReviewToReply?.comment}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply">Your Reply</Label>
              <Textarea
                id="reply"
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                placeholder="Write a thoughtful reply..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedReviewToReply(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={replyMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {replyMutation.isPending ? "Sending..." : "Send Reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderDeliveries = () => {
    const activeOrders = orders.filter(
      o => o.deliveryStatus !== "Delivered" && o.deliveryStatus !== "Cancelled"
    );
    return (
    <div className="space-y-6 w-full">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Delivery Management</h2>
        <p className="text-slate-500 mt-1">
          Track and update your order deliveries
        </p>
      </div>

      {/* Deliveries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeOrders.length > 0 ? activeOrders.map(order => (
          <Card key={order.id} className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">Order #{order.id.slice(0, 8)}</CardTitle>
                  <CardDescription>{order.buyerName}</CardDescription>
                </div>
                <Badge className={getStatusBadgeClasses(order.deliveryStatus)}>
                  {STATUS_LABELS[order.deliveryStatus] || order.deliveryStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="text-2xl font-bold text-slate-900">
                  ₱{order.totalAmount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">Items: {order.items.length}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-sm text-slate-500">Tracking Number</p>
                  <p className="font-semibold text-slate-900">{order.trackingNumber || "Not assigned"}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-sm text-slate-500">Courier</p>
                  <p className="font-semibold text-slate-900">{order.courier || "Havestra Delivery"}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-sm text-slate-500">Estimated Delivery</p>
                  <p className="font-semibold text-slate-900">{formatDeliveryDate(order.estimatedDelivery)}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4 border border-slate-100">
                  <p className="text-sm text-slate-500">Current Workflow</p>
                  <p className="font-semibold text-slate-900">{order.deliveryStatus}</p>
                </div>
              </div>

              {/* Status Update */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Update Status</p>
                <Select
                  defaultValue={order.deliveryStatus}
                  onValueChange={(value) => {
                    updateStatus(order.id, value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_ORDER_STATUSES.map(status => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Delivery Details Form */}
              <Dialog open={selectedDeliveryOrder?.id === order.id} onOpenChange={(open) => {
                if (!open) setSelectedDeliveryOrder(null);
                else {
                  setSelectedDeliveryOrder(order);
                  setDeliveryForm({
                    trackingNumber: order.trackingNumber || "",
                    courier: order.courier || "Harvestra Delivery",
                    estimatedDelivery: order.estimatedDelivery || "",
                  });
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Truck className="h-4 w-4 mr-2" />
                    Edit Delivery Details
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Delivery Details</DialogTitle>
                    <DialogDescription>
                      Enter tracking number and delivery information
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="trackingNumber">Tracking Number</Label>
                      <Input
                        id="trackingNumber"
                        value={deliveryForm.trackingNumber}
                        onChange={(e) => setDeliveryForm({...deliveryForm, trackingNumber: e.target.value})}
                        placeholder="HV-2025-0001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="courier">Courier</Label>
                      <Input
                        id="courier"
                        value={deliveryForm.courier}
                        onChange={(e) => setDeliveryForm({...deliveryForm, courier: e.target.value})}
                        placeholder="Courier name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimatedDelivery">Estimated Delivery Date</Label>
                      <Input
                        id="estimatedDelivery"
                        type="date"
                        value={deliveryForm.estimatedDelivery}
                        onChange={(e) => setDeliveryForm({...deliveryForm, estimatedDelivery: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedDeliveryOrder(null)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        updateStatus(
                          order.id,
                          order.status,
                          deliveryForm.trackingNumber,
                          deliveryForm.courier,
                          deliveryForm.estimatedDelivery
                        );
                        setSelectedDeliveryOrder(null);
                      }}
                    >
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-100">
            <Truck className="w-24 h-24 text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Active Deliveries</h3>
            <p className="text-slate-500 mb-6 text-center max-w-md">
              All orders have been delivered!
            </p>
          </div>
        )}
      </div>
    </div>
  );
  };

  const renderAnalytics = () => (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">
            Seller Analytics
          </p>
          <h2 className="text-3xl font-bold text-slate-900">
            Performance Overview
          </h2>
          <p className="text-slate-500 max-w-2xl">
            Track revenue, orders and customer health with a premium analytics
            view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
            Updated{" "}
            {new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
          <Button variant="secondary" className="rounded-full px-4 py-2">
            Export report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Revenue"
          value={stats.totalSales}
          icon={DollarSign}
          trend="up"
          trendValue="8.3%"
          color="from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="Orders"
          value={stats.totalOrders}
          icon={ShoppingCart}
          trend="up"
          trendValue="5.9%"
          color="from-sky-500 to-cyan-600"
        />
        <StatCard
          title="Products"
          value={stats.totalProducts}
          icon={Package}
          trend="up"
          trendValue="3.2%"
          color="from-violet-500 to-indigo-600"
        />
        <StatCard
          title="Avg. Order Value"
          value={analyticsData.customerMetrics.averageOrderValue}
          icon={TrendingUp}
          trend="up"
          trendValue="4.8%"
          color="from-amber-500 to-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.75fr_1fr] gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>
                  Revenue performance across the selected window.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1">
                {(["7d", "30d", "90d"] as const).map(range => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setAnalyticsRange(range)}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${analyticsRange === range ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"}`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={filteredRevenueHistory}
                  margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={15}
                  />
                  <YAxis
                    tickFormatter={value =>
                      `₱${Number(value).toLocaleString()}`
                    }
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "none",
                      borderRadius: "14px",
                      boxShadow: "0 12px 30px rgb(15 23 42 / 0.08)",
                    }}
                    formatter={(value: number) => formatCurrency(Number(value))}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    fill="url(#revenueGradient)"
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: "#10b981" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                <p className="text-sm text-slate-500">Last recorded day</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {formatCurrency(
                    filteredRevenueHistory[filteredRevenueHistory.length - 1]
                      ?.revenue || 0
                  )}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                <p className="text-sm text-slate-500">Rolling orders</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {filteredRevenueHistory.reduce(
                    (total, item) => total + item.orders,
                    0
                  )}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                <p className="text-sm text-slate-500">Products sold</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {filteredRevenueHistory.reduce(
                    (total, item) => total + item.productsSold,
                    0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Order Health</CardTitle>
              <CardDescription>
                Review order status distribution for active sales.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total orders</p>
                  <p className="text-3xl font-semibold text-slate-900">
                    {stats.totalOrders}
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {stats.totalOrders} orders
                </div>
              </div>
              <div className="space-y-3">
                {analyticsData.orderStatusSummary.map(status => {
                  const color = ORDER_STATUS_COLORS[status.status] || "#cbd5e1";
                  const total =
                    analyticsData.orderStatusSummary.reduce(
                      (sum, item) => sum + item.count,
                      0
                    ) || 1;
                  const width = Math.round((status.count / total) * 100);
                  return (
                    <div key={status.status} className="space-y-2">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>
                          {STATUS_LABELS[status.status] || status.status}
                        </span>
                        <span>{status.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${width}%`, backgroundColor: color }}
                          className="h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Customer Insights</CardTitle>
              <CardDescription>
                Monitor repeat customers, satisfaction, and reviews.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                  <p className="text-sm text-slate-500">Repeat customers</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {analyticsData.customerMetrics.repeatCustomers}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                  <p className="text-sm text-slate-500">New customers</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {analyticsData.customerMetrics.newCustomers}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                  <p className="text-sm text-slate-500">Customer rating</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {analyticsData.customerMetrics.averageRating.toFixed(1)}/5
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-5 border border-slate-100">
                  <p className="text-sm text-slate-500">Review count</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {analyticsData.customerMetrics.reviewCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Product Performance</CardTitle>
            <CardDescription>Top sellers by units and revenue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topProductsList.length ? (
              <div className="space-y-4">
                {topProductsList.map(product => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4 border border-slate-100"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {product.ordersCount} orders • {product.stock} in stock
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(product.price)}
                      </p>
                      <Badge className="mt-1 bg-emerald-100 text-emerald-700">
                        {product.rating.toFixed(1)} ★
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No product performance data available yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>
              How orders are distributed across fulfillment stages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analyticsData.orderStatusSummary}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={4}
                    stroke="transparent"
                  >
                    {analyticsData.orderStatusSummary.map(entry => (
                      <Cell
                        key={entry.status}
                        fill={ORDER_STATUS_COLORS[entry.status] || "#cbd5e1"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "none",
                      borderRadius: "14px",
                      boxShadow: "0 12px 30px rgb(15 23 42 / 0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {analyticsData.orderStatusSummary.map(status => (
                <div
                  key={status.status}
                  className="rounded-3xl bg-slate-50 p-4 border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900">
                      {STATUS_LABELS[status.status] || status.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {status.count}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      Math.round(
                        (status.count /
                          (analyticsData.orderStatusSummary.reduce(
                            (sum, item) => sum + item.count,
                            0
                          ) || 1)) *
                          100
                      )
                    )}
                    className="h-2 rounded-full"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Revenue Table</CardTitle>
          <CardDescription>
            Daily revenue and order volume for the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Products Sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRevenueHistory
                  .slice(-12)
                  .reverse()
                  .map(item => (
                    <TableRow key={item.date}>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{formatCurrency(item.revenue)}</TableCell>
                      <TableCell>{item.orders}</TableCell>
                      <TableCell>{item.productsSold}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const response = await axios.put("/api/auth/profile", profileForm, {
        headers: getAuthHeader(),
      });
      updateProfile(response.data);
      setProfileForm({
        name: response.data.name || "",
        email: response.data.email || "",
        phone: response.data.phone || "",
        address: response.data.address || "",
        city: response.data.city || "",
        country: response.data.country || "",
        zipCode: response.data.zipCode || "",
      });
      toast.success("Profile updated successfully");
      setIsEditingProfile(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Unable to save profile changes");
    } finally {
      setProfileSaving(false);
    }
  };

  const renderProfile = () => (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-1">
          Manage your seller account information
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <div className="w-28 h-28 bg-emerald-500 rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
              {user?.name?.charAt(0).toUpperCase() || "S"}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 text-center">
              {user?.name || "Seller"}
            </h2>
            <p className="text-sm text-slate-500 text-center">{user?.email}</p>
            <div className="mt-4 text-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                Verified Seller
              </span>
            </div>

            <div className="mt-6 space-y-3 text-slate-700">
              <div className="flex items-center gap-3">
                <UserIcon className="h-4 w-4 text-emerald-600" />
                <span className="text-sm">{user?.name || "Not set"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-emerald-600" />
                <span className="text-sm">{user?.email || "Not set"}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">{user.phone}</span>
                </div>
              )}
              {user?.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm">{user.address}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 hover:bg-red-100 font-medium py-2 rounded-2xl mt-6"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Account Information
                </h2>
                <p className="text-slate-500 mt-1">
                  Update your account details anytime
                </p>
              </div>
              {!isEditingProfile && (
                <Button
                  onClick={() => setIsEditingProfile(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>

            {isEditingProfile ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      value={profileForm.email}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      value={profileForm.country}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={profileForm.address}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={profileForm.city}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      value={profileForm.zipCode}
                      onChange={handleProfileChange}
                      className="border-gray-200"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {profileSaving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileForm({
                        name: user?.name || "",
                        email: user?.email || "",
                        phone: user?.phone || "",
                        address: user?.address || "",
                        city: user?.city || "",
                        country: user?.country || "",
                        zipCode: user?.zipCode || "",
                      });
                    }}
                    className="bg-slate-100 text-slate-900 hover:bg-slate-200"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-900">
                    Personal Information
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Full Name</p>
                      <p className="font-medium text-slate-900">
                        {profileForm.name || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">
                        Email Address
                      </p>
                      <p className="font-medium text-slate-900">
                        {profileForm.email || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">
                        Phone Number
                      </p>
                      <p className="font-medium text-slate-900">
                        {profileForm.phone || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-900">
                    Address
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">
                        Street Address
                      </p>
                      <p className="font-medium text-slate-900">
                        {profileForm.address || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">City</p>
                      <p className="font-medium text-slate-900">
                        {profileForm.city || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Country</p>
                      <p className="font-medium text-slate-900">
                        {profileForm.country || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">ZIP Code</p>
                      <p className="font-medium text-slate-900">
                        {profileForm.zipCode || "Not set"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 mt-1">Manage your store preferences</p>
      </div>

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input
                defaultValue={
                  user?.name ? `${user.name}'s Farm` : "My Farm Store"
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input defaultValue="+63 9XX XXX XXXX" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea
                rows={3}
                defaultValue="Barangay, Municipality, Province, Philippines"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="bg-emerald-600 hover:bg-emerald-700">
        Save Changes
      </Button>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "products":
        return renderProducts();
      case "orders":
        return renderOrders();
      case "profile":
        return renderProfile();
      case "reviews":
        return renderReviews();
      case "analytics":
        return renderAnalytics();
      case "settings":
        return renderSettings();
      case "dashboard":
      default:
        return renderDashboard();
    }
  };

  const renderProductDialog = () => (
    <Dialog
      open={isAddProductOpen}
      onOpenChange={open => {
        if (!open) handleCloseProductDialog();
        setIsAddProductOpen(open);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Product" : "Add New Product"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update product details and save your changes."
              : "Add a new product to your farm store"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={productForm.name}
              onChange={e =>
                setProductForm({ ...productForm, name: e.target.value })
              }
              placeholder="Enter product name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={productForm.category}
              onValueChange={value =>
                setProductForm({ ...productForm, category: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fruits">Fruits</SelectItem>
                <SelectItem value="Vegetables">Vegetables</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Price (₱)</Label>
            <Input
              id="price"
              type="number"
              value={productForm.price}
              onChange={e =>
                setProductForm({ ...productForm, price: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              value={productForm.stock}
              onChange={e =>
                setProductForm({ ...productForm, stock: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Select
              value={productForm.unit}
              onValueChange={value =>
                setProductForm({ ...productForm, unit: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogram (kg)</SelectItem>
                <SelectItem value="piece">Piece</SelectItem>
                <SelectItem value="bundle">Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="images">Product Images</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-all"
              onClick={handleUploadClick}
            >
              {productForm.images.length > 1 && (
                <div className="grid grid-cols-4 gap-3 mb-6 justify-items-center">
                  {productForm.images.slice(1).map((image, idx) => {
                    const origIndex = idx + 1;
                    return (
                      <div
                        key={origIndex}
                        className="relative group w-full max-w-[95px]"
                      >
                        <img
                          src={resolveProductImageUrl(image)}
                          alt={`Product ${origIndex}`}
                          className="w-full h-24 object-cover rounded-xl"
                        />
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setProductForm(prev => ({
                              ...prev,
                              images: prev.images.filter(
                                (_, i) => i !== origIndex
                              ),
                            }));
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {productForm.images.length > 0 ? (
                <img
                  src={resolveProductImageUrl(productForm.images[0])}
                  alt="Preview"
                  className="mx-auto mb-3 w-20 h-20 object-cover rounded-lg"
                />
              ) : (
                <ImageIcon className="h-10 w-10 mx-auto text-slate-400 mb-3" />
              )}
              <p className="text-slate-600 font-medium">
                Click to upload images
              </p>
              <p className="text-sm text-slate-400 mt-1">
                PNG, JPG up to 5MB
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleUploadClick}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={productForm.description}
              onChange={e =>
                setProductForm({
                  ...productForm,
                  description: e.target.value,
                })
              }
              placeholder="Describe your product..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleCloseProductDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveProduct}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isEditing ? "Save Changes" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto w-full max-w-7xl p-6 md:p-8">
        {renderContent()}
        {renderProductDialog()}
      </main>
      <Toaster />
    </div>
  );
}
