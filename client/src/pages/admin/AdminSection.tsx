import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Users from "./Users";
import Approvals from "./Approvals";
import Products from "./Products";
import Orders from "./Orders";
import Deliveries from "./Deliveries";
import Reports from "./Reports";
import Complaints from "./Complaints";
import AdminSettings from "./AdminSettings";
import AuditHistory from "./AuditHistory";

const sectionMap: Record<string, { title: string; description: string }> = {
  users: {
    title: "User Management",
    description:
      "Create, review, and manage buyer and seller accounts including approvals and suspensions.",
  },
  sellers: {
    title: "Seller Approvals",
    description:
      "Review seller requests, approve verified farms, and manage seller accounts.",
  },
  products: {
    title: "Product Management",
    description:
      "View and approve new product listings, update product details, and manage inventory.",
  },
  orders: {
    title: "Order Management",
    description:
      "Track orders, update order statuses, and publish delivery tracking updates.",
  },
  reports: {
    title: "Sales Reports",
    description:
      "View sales summaries, export reports, and monitor key business metrics.",
  },
  complaints: {
    title: "Complaints & Disputes",
    description:
      "Review customer complaints, escalate issues, and resolve disputes.",
  },
  deliveries: {
    title: "Active Deliveries",
    description:
      "Monitor delivery status, assign drivers, and manage active shipments.",
  },
  settings: {
    title: "Admin Account Settings",
    description: "Update your admin profile and change your password.",
  },
  audit: {
    title: "Admin Audit History",
    description:
      "Review administrative activity and identity verification decisions.",
  },
};

export default function AdminSection() {
  const [location, navigate] = useLocation();
  const path = location.replace(/^\/admin\/?/, "");
  const sectionKey = path.split("/")[0];
  const section = sectionMap[sectionKey] || {
    title: "Admin Section",
    description:
      "Use the admin dashboard cards to navigate to specific administration tools.",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 via-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              {section.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
              {section.description}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full border-emerald-200 text-emerald-800 transition-colors hover:bg-emerald-50 sm:w-auto"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {sectionKey === "users" ? (
          <Users />
        ) : sectionKey === "sellers" ? (
          <Approvals />
        ) : sectionKey === "products" ? (
          <Products />
        ) : sectionKey === "orders" ? (
          <Orders />
        ) : sectionKey === "deliveries" ? (
          <Deliveries />
        ) : sectionKey === "reports" ? (
          <Reports />
        ) : sectionKey === "complaints" ? (
          <Complaints />
        ) : sectionKey === "settings" ? (
          <AdminSettings />
        ) : sectionKey === "audit" ? (
          <AuditHistory />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            This admin page is not available.
          </div>
        )}
      </div>
    </div>
  );
}
