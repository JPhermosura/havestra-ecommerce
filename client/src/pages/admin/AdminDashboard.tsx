import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import axios from "axios";
import {
  User,
  Users,
  ShieldCheck,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  MessageCircle,
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
import { useAuth } from "@/contexts/AuthContext";

type AdminDashboardResponse = {
  stats: {
    users: number;
    sellersPending: number;
    products: number;
    orders: number;
    totalSales: number;
    complaints: number;
    deliveriesActive: number;
  };
  recentActivity: any[];
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { data, isLoading, isError, refetch } =
    useQuery<AdminDashboardResponse>(
      ["adminDashboard"],
      async () => {
        const res = await axios.get("/api/admin/dashboard");
        return res.data;
      },
      { staleTime: 1000 * 60 * 2 }
    );

  const stats = data?.stats;

  const renderSummaryCards = () => {
    if (!stats) return null;
    return (
      <div className="dashboard-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          onClick={() => navigate("/admin/users")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <Users className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-emerald-700 font-medium">Users</p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.users}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/sellers")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <ShieldCheck className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                Seller Approvals
              </p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.sellersPending}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/products")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <Package className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Products</p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.products}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/orders")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <ShoppingCart className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-red-700 font-medium">Orders</p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.orders}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/reports")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <TrendingUp className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-green-700 font-medium">Total Sales</p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                ₱{stats.totalSales.toLocaleString()}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/complaints")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <MessageCircle className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-purple-700 font-medium">Complaints</p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.complaints}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate("/admin/deliveries")}
          className="dashboard-card text-left bg-gradient-to-br from-white to-emerald-50 p-4 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 sm:h-12 sm:w-12">
              <Truck className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div>
              <p className="text-sm text-slate-700 font-medium">
                Active Deliveries
              </p>
              <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                {stats.deliveriesActive}
              </p>
            </div>
          </div>
        </button>
      </div>
    );
  };

  const renderAdminPanels = () => (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="space-y-4 lg:col-span-2 lg:space-y-6">
        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">User Management</h3>
            <Link href="/admin/users" className="text-sm text-emerald-600">
              Manage
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Create, search, suspend or approve buyer and seller accounts.
          </p>
        </section>

        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Products & Categories</h3>
            <Link href="/admin/products" className="text-sm text-emerald-600">
              Manage
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Approve products, edit categories, and review inventory changes.
          </p>
        </section>

        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Orders & Transactions</h3>
            <Link href="/admin/orders" className="text-sm text-emerald-600">
              View
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Monitor orders, refunds, and transaction histories.
          </p>
        </section>
      </div>

      <aside className="space-y-4 lg:space-y-6">
        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Sales Reports</h4>
            <Link href="/admin/reports" className="text-sm text-emerald-600">
              Open
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Quick snapshots and exportable reports.
          </p>
        </section>

        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Complaints & Disputes</h4>
            <Link href="/admin/complaints" className="text-sm text-emerald-600">
              Review
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Track open disputes and escalate where necessary.
          </p>
        </section>

        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Admin Account</h4>
            <Link href="/admin/settings" className="text-sm text-emerald-600">
              Edit
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Update your contact details and password.
          </p>
        </section>

        <section className="dashboard-card bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Audit History</h4>
            <Link href="/admin/audit" className="text-sm text-emerald-600">
              Review
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Review administrative actions and identity decisions.
          </p>
        </section>
      </aside>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-emerald-100/80 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
                <span className="text-white font-bold">H</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-slate-500">
                  Welcome back{user?.name ? `, ${user.name}` : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Admin account dropdown (buyer-style) */}
              {user && (
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
                    <DropdownMenuItem
                      onClick={() => navigate("/admin/settings")}
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

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
        {isLoading ? (
          <div
            role="status"
            className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600"
          >
            Loading admin dashboard...
          </div>
        ) : isError || !data ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-8 text-center"
          >
            <p className="font-medium text-red-700">
              Dashboard data could not be loaded.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Your counts and activity are unavailable; no placeholder totals
              are shown.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <>
            {renderSummaryCards()}
            {renderAdminPanels()}
          </>
        )}

        {data && (
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Recent Activity
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data?.recentActivity || []).length === 0 ? (
                <div className="dashboard-card bg-white p-6 text-center text-slate-500">
                  No recent activity
                </div>
              ) : (
                (data?.recentActivity || []).map((a, idx) => (
                  <div
                    key={idx}
                    className="dashboard-card break-words bg-white p-4"
                  >
                    {a.description || JSON.stringify(a)}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
