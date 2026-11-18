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
import BrandWatermark from "@/components/BrandWatermark";
import BrandMark from "@/components/BrandMark";

type AdminDashboardResponse = {
  stats: {
    users: number;
    buyers: number;
    sellers: number;
    sellersPending: number;
    products: number;
    orders: number;
    totalSales: number;
    complaints: number;
    deliveriesActive: number;
  };
  recentActivity: Array<{ description: string; createdAt: string }>;
  recentTransactions?: Array<{
    orderId: string;
    totalAmount: number;
    paymentStatus: string;
    createdAt: string;
  }>;
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
    const cards = [
      {
        icon: Users,
        label: "Total Users",
        value: stats.users,
        route: "/admin/users",
      },
      {
        icon: User,
        label: "Total Buyers",
        value: stats.buyers,
        route: "/admin/users",
      },
      {
        icon: ShieldCheck,
        label: "Total Sellers",
        value: stats.sellers,
        route: "/admin/sellers",
      },
      {
        icon: ShieldCheck,
        label: "Pending Seller Approvals",
        value: stats.sellersPending,
        route: "/admin/sellers",
      },
      {
        icon: Package,
        label: "Total Products",
        value: stats.products,
        route: "/admin/products",
      },
      {
        icon: ShoppingCart,
        label: "Total Orders",
        value: stats.orders,
        route: "/admin/orders",
      },
      {
        icon: TrendingUp,
        label: "Total Sales",
        value: `₱${stats.totalSales.toLocaleString()}`,
        route: "/admin/reports",
      },
      {
        icon: MessageCircle,
        label: "Open Complaints",
        value: stats.complaints,
        route: "/admin/complaints",
      },
      {
        icon: Truck,
        label: "Active Deliveries",
        value: stats.deliveriesActive,
        route: "/admin/deliveries",
      },
    ];

    return (
      <section aria-labelledby="admin-overview-title" className="space-y-3">
        <h2
          id="admin-overview-title"
          className="text-lg font-semibold text-slate-900"
        >
          Platform overview
        </h2>
        <div className="dashboard-grid grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {cards.map(card => (
            <button
              key={card.label}
              type="button"
              onClick={() => navigate(card.route)}
              className="dashboard-card group rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#16834A] transition-colors group-hover:bg-emerald-700 sm:h-10 sm:w-10">
                  <card.icon className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#16834A] sm:text-sm">
                    {card.label}
                  </p>
                  <p className="text-xl font-bold text-emerald-950 sm:text-2xl">
                    {card.value}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  };

  const renderAdminPanels = () => (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          Platform management
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Dedicated tools for users, listings, orders, and reporting.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {[
          {
            title: "Users",
            href: "/admin/users",
            icon: Users,
          },
          {
            title: "Products",
            href: "/admin/products",
            icon: Package,
          },
          {
            title: "Orders",
            href: "/admin/orders",
            icon: ShoppingCart,
          },
          {
            title: "Reports",
            href: "/admin/reports",
            icon: TrendingUp,
          },
          {
            title: "Audit History",
            href: "/admin/audit",
            icon: ShieldCheck,
          },
        ].map(card => (
          <Link
            key={card.title}
            href={card.href}
            className="dashboard-card group flex min-h-14 items-center gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#16834A] transition-colors group-hover:bg-[#16834A] group-hover:text-white">
              <card.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {card.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="dashboard-surface relative isolate min-h-screen">
      <BrandWatermark />
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
                    Admin dashboard
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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

      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8 lg:px-8">
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
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Platform activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Recent administrative actions.
              </p>
            </div>
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
        {data && (
          <section className="dashboard-card space-y-4 bg-white p-4 sm:p-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Recent transactions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                The latest orders and payment statuses from the marketplace.
              </p>
            </div>
            {(data.recentTransactions || []).length === 0 ? (
              <p className="rounded-xl bg-[#F7F9F5] p-4 text-sm text-slate-500">
                No transactions have been recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentTransactions?.map(transaction => (
                  <div
                    key={transaction.orderId}
                    className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {transaction.orderId}
                      </p>
                      <p className="text-sm text-slate-500">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <span className="font-semibold text-[#16834A]">
                        ₱{transaction.totalAmount.toLocaleString()}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium capitalize text-[#16834A]">
                        {transaction.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
