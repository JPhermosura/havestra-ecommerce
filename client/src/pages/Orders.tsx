import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "wouter";
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
  totalAmount: number;
  createdAt: string;
  items: OrderItem[];
}

export default function Orders() {
  const { user } = useAuth();
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

  const fetchOrders = async () => {
    if (!user?.id) {
      return;
    }

    try {
      setLoading(true);
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
            <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-600 mt-2">
              Track order status, review order details, and follow delivery
              progress.
            </p>
            {orders.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-gray-500">Total Spent</p>
                <p className="text-2xl font-bold text-gray-900">₱{orders.reduce((s, o) => s + (o.totalAmount || 0), 0).toLocaleString()}</p>
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
          <p className="text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <p>No orders found.</p>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <div
                key={order._id || order.orderId}
                className="order-card rounded-3xl bg-white p-6 shadow-sm border border-gray-200"
              >
                <p className="text-sm text-gray-500">
                  <b>Order ID:</b> {order._id || order.orderId}
                </p>
                <p className="text-sm text-gray-500">
                  <b>Status:</b> {order.status || order.orderStatus}
                </p>
                <p className="text-lg text-gray-900 mb-4 font-semibold">
                  <b>Total:</b> ₱{order.totalAmount?.toLocaleString()}
                </p>

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
                        ) : order.status?.toLowerCase() === "delivered" ||
                          order.orderStatus?.toLowerCase() === "delivered" ? (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase text-gray-700">
                            Review available after delivery
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">
                    No order item details available.
                  </p>
                )}
                {isBuyer && canCancel(order.status || order.orderStatus) && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      You can cancel this order while it is still in an early state.
                    </p>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() => openCancelDialog(order._id || order.orderId)}
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
                  <SelectItem value="Found better price">Found better price</SelectItem>
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
