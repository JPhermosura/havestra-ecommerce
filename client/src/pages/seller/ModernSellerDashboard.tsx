import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import Profile from "@/pages/Profile";
import NotificationBell from "@/components/NotificationBell";
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

type SellerStats = {
  totalProducts: number;
  totalOrders: number;
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

type ProductForm = {
  name: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  unit: string;
  image: string;
};

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
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

  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    orderId?: string;
    newStatus?: string;
    trackingNumber?: string | undefined;
  } | null>(null);

  // Determine active tab from URL
  useEffect(() => {
    const pathSegment = location.split("/").pop();
    const normalizedPath =
      !pathSegment || pathSegment === "seller" ? "dashboard" : pathSegment;
    setActiveTab(normalizedPath);
  }, [location]);

  const getAuthHeader = () => {
    const token =
      localStorage.getItem("token") || localStorage.getItem("ecommerce_token");
    return { Authorization: `Bearer ${token}` };
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      if (!user?.id) return;
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
    try {
      if (!user?.id) return;
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
      fetchProducts();
      fetchOrders();
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
    setEditingProductId(null);
    localStorage.removeItem("editingProductData");
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
    { enabled: !!user?.id }
  );

  const sellerStats = sellerDashboardData?.stats || {
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalSales: 0,
    totalReviews: 0,
    activeDeliveries: 0,
  };

  const renderStatCards = () => {
    const statCards = [
      {
        icon: Package,
        label: "Products",
        value: products.length,
        route: "/seller/products",
      },
      {
        icon: ShoppingCart,
        label: "Orders",
        value: orders.length,
        route: "/seller/orders",
      },
      {
        icon: TrendingUp,
        label: "Revenue",
        value: `₱${((sellerStats?.totalSales ?? sellerStats?.totalRevenue) || orders.reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0)).toLocaleString()}`,
        route: "/seller/analytics",
      },
      {
        icon: Star,
        label: "Reviews",
        value: sellerStats?.totalReviews ?? 0,
        route: "/seller/reviews",
      },
      {
        icon: Truck,
        label: "Deliveries",
        value: sellerStats?.activeDeliveries ?? 0,
        route: "/seller/deliveries",
      },
    ];

    return (
      <div className="dashboard-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.route)}
            className={`dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm sm:h-12 sm:w-12">
                <card.icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                  {card.value}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const handleSaveProduct = async () => {
    if (
      !productForm.name.trim() ||
      !productForm.category ||
      !productForm.price.trim() ||
      !productForm.image.trim()
    ) {
      toast.error("Product name, category, price, and image are required.");
      return;
    }

    setIsSavingProduct(true);
    try {
      const formData = new FormData();
      const status =
        Number(productForm.stock) > 0 ? "Available" : "Out of Stock";

      formData.append(
        "productData",
        JSON.stringify({
          name: productForm.name.trim(),
          title: productForm.name.trim(),
          category: productForm.category,
          unit: productForm.unit,
          price: Number(productForm.price),
          stock: Number(productForm.stock || 0),
          description: productForm.description.trim(),
          image: productForm.image.trim(),
          status,
          sellerName: user?.name || "",
          farmName: user?.farmName || "",
          farmLocation: user?.farmLocation || "",
        })
      );

      if (editingProductId) {
        await axios.put(`/api/products/${editingProductId}`, formData, {
          headers: getAuthHeader(),
        });
        const existingProduct = products.find(
          product => product._id === editingProductId
        );
        if (
          existingProduct &&
          Number(productForm.stock) !== existingProduct.stock
        ) {
          await axios.patch(
            `/api/products/${editingProductId}/inventory`,
            { stock: Number(productForm.stock) },
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

  const renderDashboard = () => (
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
    </div>
  );

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
            Store analytics
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
                  label: "Sales (last 7 days)",
                  value: `₱${revenueHistory.reduce((sum, day) => sum + day.revenue, 0).toLocaleString()}`,
                },
                {
                  label: "Customers",
                  value: customerMetrics?.totalCustomers ?? 0,
                },
                {
                  label: "Average order value",
                  value: `₱${(customerMetrics?.averageOrderValue ?? 0).toLocaleString()}`,
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
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} />
                      <YAxis
                        width={64}
                        tickLine={false}
                        tickFormatter={value =>
                          `₱${Number(value).toLocaleString()}`
                        }
                      />
                      <Tooltip
                        formatter={value => [
                          `₱${Number(value).toLocaleString()}`,
                          "Sales",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#059669"
                        fill="#a7f3d0"
                        fillOpacity={0.55}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
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
                          <TableCell>
                            ₱{product.price.toLocaleString()}
                          </TableCell>
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
      .filter(order => order.status !== "Cancelled")
      .map(order => {
        const sellerItems = (order.items ?? []).filter(
          (item: any) =>
            String(item.sellerId ?? "") === String(user?.id) ||
            String(item.farmerId ?? "") === String(user?.id)
        );
        return {
          ...order,
          sellerItems,
          sellerAmount: sellerItems.reduce(
            (sum: number, item: any) =>
              sum +
              Number(item.totalPrice ?? item.unitPrice * item.quantity ?? 0),
            0
          ),
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
            ₱{orderValue.toLocaleString()}
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
                        ₱{order.sellerAmount.toLocaleString()}
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

  const renderAddProduct = () => (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {editingProductId ? "Edit Product" : "Add Product"}
        </h1>
        <p className="text-slate-500 mt-1">
          {editingProductId
            ? "Update your product listing."
            : "Create a new product listing for your store."}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-4">
          Seller Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-slate-600">Seller Name</p>
            <p className="font-medium text-slate-900">{user?.name}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Farm Name</p>
            <p className="font-medium text-slate-900">
              {user?.farmName || "Not specified"}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">Farm Location</p>
            <p className="font-medium text-slate-900">
              {user?.farmLocation || "Not specified"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div>
            <Label htmlFor="product-name">Product Name *</Label>
            <Input
              id="product-name"
              value={productForm.name}
              onChange={e =>
                setProductForm({ ...productForm, name: e.target.value })
              }
              placeholder="e.g., Tomato, Cabbage"
            />
          </div>
          <div>
            <Label htmlFor="product-category">Category *</Label>
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
          <div>
            <Label htmlFor="product-unit">Unit *</Label>
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
                <SelectItem value="Piece">Piece</SelectItem>
                <SelectItem value="Bundle">Bundle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="product-price">Price (₱) *</Label>
            <Input
              id="product-price"
              type="number"
              step="0.01"
              value={productForm.price}
              onChange={e =>
                setProductForm({ ...productForm, price: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="product-stock">Stock Quantity *</Label>
            <Input
              id="product-stock"
              type="number"
              value={productForm.stock}
              onChange={e =>
                setProductForm({ ...productForm, stock: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="product-image">Product Image URL *</Label>
            <div className="flex gap-2">
              <Input
                id="product-image"
                value={productForm.image}
                onChange={e =>
                  setProductForm({ ...productForm, image: e.target.value })
                }
                placeholder="https://example.com/image.jpg"
                className="flex-1"
              />
              <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = event => {
                      const dataUrl = event.target?.result as string;
                      setProductForm({ ...productForm, image: dataUrl });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("image-upload")?.click()}
                className="px-4"
              >
                Upload
              </Button>
            </div>
            {productForm.image && (
              <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                <img
                  src={productForm.image}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded"
                />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="product-description">Description *</Label>
            <Textarea
              id="product-description"
              value={productForm.description}
              onChange={e =>
                setProductForm({ ...productForm, description: e.target.value })
              }
              placeholder="Describe your product quality, origin, and special features..."
              className="min-h-[120px]"
            />
          </div>
          <div className="flex items-center gap-3 pt-4">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveProduct}
              disabled={isSavingProduct}
            >
              {isSavingProduct
                ? "Saving..."
                : editingProductId
                  ? "Update Product"
                  : "Add Product"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                navigate("/seller/products");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Products</h2>
          <p className="text-slate-500 mt-1">
            Manage your farm products and inventory
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => navigate("/seller/add-product")}
        >
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      {products.length > 0 ? (
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
                {products.map(product => (
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
                      ₱{product.price.toLocaleString()}
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
                          value={stockDrafts[product._id] ?? product.stock ?? 0}
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
                    <td className="px-6 py-3 space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProduct(product._id)}
                        disabled={isDeletingProduct}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
          <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No products yet</p>
          <p className="mt-4 text-sm text-slate-500">
            Use the dashboard action card to add your first product.
          </p>
        </div>
      )}
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Orders</h2>
        <p className="text-slate-500 mt-1">View and manage customer orders</p>
      </div>

      <Card className="border-0 shadow-lg">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Delivery Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length > 0 ? (
              orders.map(order => (
                <TableRow key={order._id}>
                  <TableCell className="font-medium">
                    #{order._id?.toString().slice(0, 8)}
                  </TableCell>
                  <TableCell>{order.buyerName || "Customer"}</TableCell>
                  <TableCell>
                    ₱{(order.totalAmount || 0).toLocaleString()}
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
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-slate-500"
                >
                  No orders yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

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
                    {order.deliveryStatus !== "In Transit" &&
                      order.deliveryStatus !== "Delivered" && (
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
                    {order.deliveryStatus !== "Pending" && (
                      <Button
                        className="bg-yellow-500 hover:bg-yellow-600 text-black"
                        onClick={() => {
                          setConfirmData({
                            orderId: order._id || order.id,
                            newStatus: "Pending",
                            trackingNumber: order.trackingNumber || undefined,
                          });
                          setConfirmOpen(true);
                        }}
                      >
                        Mark Pending
                      </Button>
                    )}
                    {order.deliveryStatus !== "Delivered" && (
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
    orders: renderOrders,
    profile: () => <Profile />,
    "add-product": renderAddProduct,
    reviews: renderReviews,
    analytics: renderAnalytics,
    deliveries: renderDeliveries,
    settings: () => <Profile />,
    wallet: renderWallet,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white">
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
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                <span className="text-white font-bold">S</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Seller Dashboard
                </h1>
                <p className="hidden text-sm text-slate-500 sm:block">
                  Manage your farm store
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
