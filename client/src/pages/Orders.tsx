import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface OrderItem {
  productId: string;
  name?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  price?: number;
  totalPrice: number;
  canReview?: boolean;
  reviewed?: boolean;
}

interface Order {
  _id: string;
  orderId: string;
  orderStatus: string;
  status: string;
  deliveryStatus?: string;
  trackingNumber?: string;
  courier?: string;
  estimatedDelivery?: string;
  trackingHistory?: { status: string; timestamp: string }[];
  fulfillments?: Array<{
    status: string;
    itemIndexes: number[];
    trackingNumber?: string;
    courier?: string;
    estimatedDelivery?: string;
  }>;
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

export default function Orders() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDescription, setCancelDescription] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const isBuyer = user?.role === "buyer";
  const queryString = location.includes("?")
    ? location.slice(location.indexOf("?"))
    : window.location.search;
  const statusFilter = new URLSearchParams(queryString).get("status");
  const normalizedFilter = statusFilter?.toLowerCase();

  const fetchOrders = async () => {
    if (!user?.id) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      const endpoint =
        user.role === "seller"
          ? `/api/orders/seller/${user.id}`
          : `/api/orders/buyer/${user.id}`;
      const response = await axios.get(endpoint);
      const fetchedOrders = Array.isArray(response.data)
        ? response.data
        : response.data.orders || [];
      setOrders(fetchedOrders);
    } catch (err) {
      console.error("Unable to load orders");
      setError("Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const canCancel = (status: string) => {
    const normalized = (status || "").toLowerCase();
    return [
      "order placed",
      "payment confirmed",
      "preparing order",
      "packed",
      "pending",
      "confirmed",
      "processing",
    ].includes(normalized);
  };
  const canCancelOrder = (order: Order) =>
    canCancel(order.status || order.orderStatus) &&
    !order.fulfillments?.some(
      fulfillment =>
        fulfillment.status !== "Pending" && fulfillment.status !== "Cancelled"
    );

  const hasStatus = (order: Order, status: string) =>
    order.fulfillments?.some(
      fulfillment => fulfillment.status.toLowerCase() === status
    ) ||
    [order.deliveryStatus, order.status, order.orderStatus]
      .filter(Boolean)
      .some(value => value?.toLowerCase() === status);

  const filteredOrders = normalizedFilter
    ? orders.filter(order => hasStatus(order, normalizedFilter))
    : orders;
  const deliveredTotal = orders.reduce((sum, order) => {
    if (!order.fulfillments?.length) {
      return sum + (hasStatus(order, "delivered") ? order.totalAmount || 0 : 0);
    }
    const deliveredIndexes = new Set(
      order.fulfillments
        .filter(fulfillment => fulfillment.status === "Delivered")
        .flatMap(fulfillment => fulfillment.itemIndexes)
    );
    return (
      sum +
      order.items.reduce(
        (orderTotal, item, index) =>
          orderTotal +
          (deliveredIndexes.has(index)
            ? Number(item.totalPrice) ||
              Number(item.unitPrice ?? item.price ?? 0) * item.quantity
            : 0),
        0
      )
    );
  }, 0);

  const pageTitle =
    normalizedFilter === "delivered"
      ? "Purchase History"
      : normalizedFilter === "pending"
        ? "Pending Orders"
        : normalizedFilter === "in transit"
          ? "Orders In Transit"
          : "My Orders";

  const openCancelDialog = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setCancelDescription("");
    setCancelError("");
    setCancelModalOpen(true);
  };

  const closeCancelDialog = () => {
    setCancelModalOpen(false);
    setCancelOrderId(null);
    setCancelReason("");
    setCancelDescription("");
    setCancelError("");
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderId) {
      setCancelError("No order selected for cancellation.");
      return;
    }
    if (!cancelReason) {
      setCancelError("Please select a reason for cancelling the order.");
      return;
    }

    setCancelLoading(true);
    setCancelError("");

    try {
      await axios.put(`/api/orders/${cancelOrderId}/cancel`, {
        cancelReason,
        cancelDescription,
      });
      await fetchOrders();
      closeCancelDialog();
    } catch (err: any) {
      console.error("Order cancellation failed:", err);
      setCancelError(err?.response?.data?.error || "Unable to cancel order.");
    } finally {
      setCancelLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Please sign in to view your orders
          </h1>
          <p className="text-gray-600 mb-6">
            You need to be logged in to access your order history and tracking
            details.
          </p>
          <Link href="/login">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">
              Go to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="text-gray-600 mt-2">
              {normalizedFilter === "delivered"
                ? "Review completed deliveries and individual transaction amounts."
                : normalizedFilter === "pending"
                  ? "Review orders awaiting fulfillment."
                  : normalizedFilter === "in transit"
                    ? "Follow delivery progress and review your shipment details."
                    : "Track order status, review order details, and follow delivery progress."}
            </p>
            {orders.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500">Completed Purchases</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₱{deliveredTotal.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {cancelError && (
          <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {cancelError}
          </div>
        )}

        {loading ? (
          <p>Loading orders...</p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-5 text-red-700"
          >
            <p>{error}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchOrders()}
              className="mt-3 border-red-200 text-red-700 hover:bg-red-50"
            >
              Try again
            </Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center text-slate-600 shadow-sm">
            {normalizedFilter
              ? `No ${normalizedFilter} orders found.`
              : "No orders found."}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div
                key={order._id || order.orderId}
                className="order-card rounded-3xl bg-white p-6 shadow-sm border border-gray-200"
              >
                <p className="text-sm text-gray-500">
                  <b>Order ID:</b> {order.orderId || order._id}
                </p>
                <p className="text-sm text-gray-500">
                  <b>Status:</b>{" "}
                  {order.deliveryStatus || order.status || order.orderStatus}
                </p>
                {order.fulfillments && order.fulfillments.length > 0 && (
                  <div className="my-3 flex flex-wrap gap-2">
                    {order.fulfillments.map((fulfillment, index) => (
                      <span
                        key={`${fulfillment.status}-${index}`}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800"
                      >
                        Seller {index + 1}: {fulfillment.status}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-lg text-gray-900 mb-4 font-semibold">
                  <b>Total:</b> ₱{order.totalAmount?.toLocaleString()}
                </p>

                {normalizedFilter === "in transit" && (
                  <section
                    aria-label={`Delivery progress for order ${order.orderId}`}
                    className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold text-emerald-950">
                        Delivery progress
                      </h2>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                        {order.deliveryStatus || order.status}
                      </span>
                    </div>
                    <div className="relative mb-4 grid grid-cols-3 text-center text-xs">
                      <div className="absolute left-[16.7%] right-[16.7%] top-2 h-1 rounded-full bg-emerald-200" />
                      <div className="absolute left-[16.7%] top-2 h-1 w-[33.3%] rounded-full bg-emerald-600" />
                      {["Pending", "In Transit", "Delivered"].map(
                        (step, index) => (
                          <div
                            key={step}
                            aria-current={index === 1 ? "step" : undefined}
                            className="relative z-10 flex flex-col items-center gap-2 text-slate-500"
                          >
                            <span
                              className={`h-4 w-4 rounded-full border-2 border-white shadow ${
                                index < 2 ? "bg-emerald-600" : "bg-emerald-200"
                              }`}
                            />
                            <span
                              className={
                                index === 1
                                  ? "font-semibold text-emerald-800"
                                  : ""
                              }
                            >
                              {step}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                      {order.courier && <span>Courier: {order.courier}</span>}
                      {order.trackingNumber && (
                        <span>Tracking: {order.trackingNumber}</span>
                      )}
                      {order.estimatedDelivery && (
                        <span>
                          Estimated delivery:{" "}
                          {new Date(
                            order.estimatedDelivery
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {order.trackingHistory &&
                      order.trackingHistory.length > 0 && (
                        <ol className="mt-3 space-y-1 border-t border-emerald-100 pt-3 text-xs text-slate-600">
                          {order.trackingHistory
                            .slice(-3)
                            .reverse()
                            .map((event, index) => (
                              <li
                                key={`${event.status}-${event.timestamp}-${index}`}
                              >
                                {event.status} ·{" "}
                                {new Date(event.timestamp).toLocaleString()}
                              </li>
                            ))}
                        </ol>
                      )}
                  </section>
                )}

                {order.items?.length ? (
                  order.items.map((item, index) => (
                    <div key={index} className="mb-3 rounded-lg bg-gray-50 p-3">
                      <p className="font-semibold text-gray-900">
                        {item.productName || item.name || "Product"}
                      </p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} x ₱
                        {(item.unitPrice ?? item.price ?? 0).toLocaleString()}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.canReview ? (
                          <Link href={`/product/${item.productId}?review=true`}>
                            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                              Write Review
                            </Button>
                          </Link>
                        ) : item.reviewed ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase text-emerald-800">
                            Reviewed
                          </span>
                        ) : hasStatus(order, "delivered") &&
                          item.productId ? (
                          <Link href={`/product/${item.productId}?review=true`}>
                            <Button
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              Check review options
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">
                    No order item details available.
                  </p>
                )}
                {isBuyer && canCancelOrder(order) && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      You can cancel this order while it is still in an early
                      state.
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        openCancelDialog(order._id || order.orderId)
                      }
                    >
                      Cancel Order
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <Dialog
        open={cancelModalOpen}
        onOpenChange={open => {
          if (!open) {
            closeCancelDialog();
          } else {
            setCancelModalOpen(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Select why you want to cancel this order and confirm to proceed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="cancel-reason">Cancellation reason</Label>
              <Select
                value={cancelReason}
                onValueChange={value => setCancelReason(value)}
              >
                <SelectTrigger id="cancel-reason" className="w-full mt-2">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Changed mind">Changed mind</SelectItem>
                  <SelectItem value="Wrong order">Wrong order</SelectItem>
                  <SelectItem value="Found better price">
                    Found better price
                  </SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(cancelReason === "Other" || cancelReason === "Other") && (
              <div>
                <Label htmlFor="cancel-description">
                  Tell us why you are cancelling
                </Label>
                <Textarea
                  id="cancel-description"
                  value={cancelDescription}
                  onChange={e => setCancelDescription(e.target.value)}
                  placeholder="Write a short explanation"
                  className="mt-2"
                />
              </div>
            )}
            {cancelError && (
              <p className="text-sm text-rose-600">{cancelError}</p>
            )}
          </div>
          <DialogFooter>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={closeCancelDialog}
                disabled={cancelLoading}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={cancelLoading || !cancelReason}
              >
                {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
