import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { toast } from "sonner";

const FLOW = ["Pending", "In Transit", "Delivered"];

const formatDate = (dateValue: string | undefined) => {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

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

export default function DeliveryTracking() {
  const { user } = useAuth();

  const {
    data: orders = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>(
    ["buyerOrders", user?.id],
    async () => {
      if (!user?.id) return [];
      const resp = await axios.get(`/api/orders/buyer/${user.id}`);
      if (!Array.isArray(resp.data)) {
        throw new Error("Unexpected orders response.");
      }
      return resp.data;
    },
    {
      enabled: !!user?.id,
      staleTime: 1000 * 30,
      cacheTime: 1000 * 60,
    }
  );

  if (isLoading)
    return (
      <div
        role="status"
        className="mx-auto min-h-[50dvh] max-w-4xl px-4 py-12 text-center text-slate-600 sm:px-8"
      >
        Loading deliveries...
      </div>
    );

  const trackedOrders = orders
    .map(order => ({
      ...order,
      deliveryStatus: normalizeDeliveryStatus(
        order.deliveryStatus || order.status
      ),
      courier: order.courier || "Havestra Delivery",
      estimatedDelivery:
        order.estimatedDelivery || order.estimated_delivery || "",
      trackingNumber:
        order.trackingNumber || order.tracking_id || order.tracking || "",
      trackingHistory: Array.isArray(order.trackingHistory)
        ? order.trackingHistory
        : [],
    }))
    .filter(
      order =>
        order.deliveryStatus !== "Cancelled" &&
        order.deliveryStatus !== "Delivered"
    );

  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 sm:text-3xl">
          Delivery Tracking
        </h1>
        <p className="mb-6 text-sm text-slate-500 sm:text-base">
          Track your orders and see their latest updates.
        </p>

        {isError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-white p-6 text-center sm:p-8"
          >
            <p className="text-red-700">
              Your delivery information could not be loaded.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : trackedOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center sm:p-8">
            <p className="text-slate-700 font-medium">No active deliveries.</p>
            <p className="mt-2 text-sm text-slate-500">
              Orders will appear here when they have delivery updates.
            </p>
            <Button asChild className="mt-5">
              <Link href="/orders">View my orders</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {trackedOrders.map(order => (
              <Card key={order._id || order.id} className="border">
                <CardHeader>
                  <CardTitle>
                    Order #
                    {order.orderId ||
                      (order._id && String(order._id).slice(-8))}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                    <div className="sm:text-right">
                      <p className="text-sm text-slate-500">Current Status</p>
                      <p className="font-semibold">
                        {order.deliveryStatus || order.status}
                      </p>
                    </div>
                  </div>

                  <ol aria-label="Delivery progress" className="space-y-3">
                    {FLOW.map(step => {
                      const done =
                        (order.trackingHistory || []).some(
                          (h: any) => h.status === step
                        ) ||
                        order.deliveryStatus === step ||
                        order.status === step;
                      return (
                        <li key={step} className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className={`h-5 w-5 shrink-0 rounded-full transition-colors duration-300 ${done ? "bg-emerald-600" : "bg-gray-200"}`}
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
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={`/orders/${order._id || order.id}`}>
                        View Order
                      </Link>
                    </Button>
                    {order.trackingNumber && (
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              order.trackingNumber
                            );
                            toast.success("Tracking number copied.");
                          } catch {
                            toast.error("Could not copy the tracking number.");
                          }
                        }}
                      >
                        Copy Tracking
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
