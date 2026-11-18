import { useRoute, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderDetailsData {
  _id: string;
  orderId: string;
  orderStatus: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  buyerAddress: {
    street: string;
    city: string;
    province: string;
    zipCode: string;
  };
  paymentMethod: string;
  paymentStatus?: string;
  deliveryStatus?: string;
  trackingNumber?: string;
  courier?: string;
  estimatedDelivery?: string;
  trackingHistory?: Array<{ status: string; timestamp: string }>;
  fulfillments?: Array<{
    sellerId: string;
    status: string;
    itemIndexes: number[];
    trackingNumber?: string;
    courier?: string;
    estimatedDelivery?: string;
    trackingHistory?: Array<{ status: string; timestamp: string }>;
  }>;
  items: OrderItem[];
  cancelReason?: string;
  cancelDescription?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  refundStatus?: string;
}

export default function OrderDetails() {
  const [match, params] = useRoute("/orders/:id");
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<OrderDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelDescription, setCancelDescription] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const orderId = params?.id;
  const { user } = useAuth();
  let backPath = "/orders";
  if (user?.role === "seller") backPath = "/seller/orders";
  else if (user?.role === "admin") backPath = "/admin/orders";
  const orderStatusLabel = order
    ? order.deliveryStatus || order.orderStatus || order.status || "pending"
    : "pending";
  const normalizedOrderStatus = orderStatusLabel.toLowerCase();
  const canCancelOrder = [
    "order placed",
    "payment confirmed",
    "preparing order",
    "packed",
    "pending",
    "confirmed",
    "processing",
  ].includes(normalizedOrderStatus);
  const canCancelCurrentOrder =
    canCancelOrder &&
    !order?.fulfillments?.some(fulfillment => fulfillment.status !== "Pending");

  useEffect(() => {
    const fetchOrder = async () => {
      if (!match || !orderId) {
        return;
      }
      try {
        setLoading(true);
        const response = await axios.get(`/api/orders/id/${orderId}`);
        setOrder(response.data);
      } catch (err) {
        setError("Unable to load order details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [match, orderId]);

  const handleCancelOrder = async () => {
    if (!order) return;
    if (!cancelReason) {
      setCancelError("Please select a reason for cancelling the order.");
      return;
    }
    if (cancelReason.toLowerCase() === "other" && !cancelDescription.trim()) {
      setCancelError(
        "Please provide a description for your cancellation reason."
      );
      return;
    }

    setCancelError("");
    setCancelLoading(true);

    try {
      const response = await axios.put(`/api/orders/${order._id}/cancel`, {
        cancelReason,
        cancelDescription:
          cancelReason.toLowerCase() === "other" ? cancelDescription : "",
      });

      setOrder(response.data);
      setCancelModalOpen(false);
    } catch (err: any) {
      setCancelError(err?.response?.data?.error || "Unable to cancel order");
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Loading order details
          </h1>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Order Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            We couldn't load the order details for this ID.
          </p>
          <Button
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => navigate(backPath)}
          >
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Order {order.orderId}
            </h1>
            <p className="text-gray-600 mt-2">
              Details for your selected order.
            </p>
          </div>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => navigate(backPath)}
          >
            Back to Orders
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">Order Placed</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={
                    normalizedOrderStatus === "delivered"
                      ? "default"
                      : normalizedOrderStatus === "cancelled"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {order.orderStatus || order.status}
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="mt-2 font-semibold text-gray-900">
                    {order.paymentMethod}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-gray-500">Order Total</p>
                  <p className="mt-2 font-semibold text-gray-900">
                    ₱{order.totalAmount.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm text-gray-500">Shipping Address</p>
                  <p className="mt-2 text-gray-900">
                    {order.buyerAddress?.street}
                    <br />
                    {order.buyerAddress?.city}, {order.buyerAddress?.province}{" "}
                    {order.buyerAddress?.zipCode}
                  </p>
                </div>
              </div>
            </div>

            <section
              aria-labelledby="order-progress-heading"
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="order-progress-heading"
                className="mb-4 text-xl font-semibold text-gray-900"
              >
                Order progress
              </h2>
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-500">Delivery status</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {order.deliveryStatus || order.status}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Courier</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {order.courier || "Havestra Delivery"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tracking number</p>
                  <p className="mt-1 font-semibold text-gray-900">
                    {order.trackingNumber || "Not assigned yet"}
                  </p>
                </div>
              </div>
              {order.estimatedDelivery && (
                <p className="mb-4 text-sm text-gray-600">
                  Estimated delivery:{" "}
                  {new Date(order.estimatedDelivery).toLocaleDateString()}
                </p>
              )}
              <ol className="space-y-3" aria-label="Order tracking history">
                {(order.trackingHistory || [])
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.timestamp).getTime() -
                      new Date(b.timestamp).getTime()
                  )
                  .map((entry, index) => (
                    <li
                      key={`${entry.timestamp}-${index}`}
                      className="flex items-start gap-3"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-600"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {entry.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                {(order.trackingHistory || []).length === 0 && (
                  <li className="text-sm text-gray-500">
                    Tracking updates will appear here when the order changes
                    status.
                  </li>
                )}
              </ol>
            </section>

            {order.fulfillments && order.fulfillments.length > 0 && (
              <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold text-gray-900">
                  Seller delivery progress
                </h2>
                <div className="space-y-4">
                  {order.fulfillments.map((fulfillment, index) => {
                    const sellerItems = fulfillment.itemIndexes
                      .map(itemIndex => order.items[itemIndex])
                      .filter(Boolean);
                    return (
                      <article
                        key={`${fulfillment.sellerId}-${index}`}
                        className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-gray-900">
                            Seller {index + 1}
                          </h3>
                          <Badge
                            variant={
                              fulfillment.status === "Cancelled"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {fulfillment.status}
                          </Badge>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm text-gray-700">
                          {sellerItems.map((item, itemIndex) => (
                            <li key={`${item.productId}-${itemIndex}`}>
                              {item.productName} × {item.quantity}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                          {fulfillment.courier && (
                            <span>Courier: {fulfillment.courier}</span>
                          )}
                          {fulfillment.trackingNumber && (
                            <span>Tracking: {fulfillment.trackingNumber}</span>
                          )}
                          {fulfillment.estimatedDelivery && (
                            <span>
                              Estimated delivery:{" "}
                              {new Date(
                                fulfillment.estimatedDelivery
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {fulfillment.trackingHistory?.length ? (
                          <ol className="mt-3 space-y-1 border-t border-emerald-100 pt-3 text-xs text-gray-600">
                            {fulfillment.trackingHistory
                              .slice()
                              .reverse()
                              .map((entry, entryIndex) => (
                                <li key={`${entry.timestamp}-${entryIndex}`}>
                                  {entry.status} ·{" "}
                                  {new Date(entry.timestamp).toLocaleString()}
                                </li>
                              ))}
                          </ol>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {canCancelCurrentOrder && (
              <div className="rounded-3xl bg-rose-50 p-6 shadow-sm border border-rose-100 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-sm text-rose-700">Need to cancel?</p>
                    <p className="mt-1 text-slate-700">
                      You can cancel this order while it is still pending,
                      confirmed, or processing.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full md:w-auto"
                    onClick={() => setCancelModalOpen(true)}
                  >
                    Cancel Order
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Items in this order
              </h2>
              <div className="space-y-4">
                {order.items.map(item => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-4 rounded-3xl bg-slate-50 p-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.productName}
                      </p>
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ₱{item.unitPrice.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        Total: ₱{item.totalPrice.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Shipping details
              </h2>
              <p className="text-sm text-gray-600">
                {order.buyerAddress?.street}
                <br />
                {order.buyerAddress?.city}, {order.buyerAddress?.province}{" "}
                {order.buyerAddress?.zipCode}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Help</h2>
              <p className="text-sm text-gray-600">
                If you need help with this order, contact customer support or
                visit the help center.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Choose why you want to cancel and confirm to cancel the order.
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
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="changed mind">Changed mind</SelectItem>
                  <SelectItem value="wrong order">Wrong order</SelectItem>
                  <SelectItem value="found better price">
                    Found better price
                  </SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cancelReason === "other" && (
              <div>
                <Label htmlFor="cancel-description">
                  Please describe why you are cancelling
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
                onClick={() => setCancelModalOpen(false)}
                disabled={cancelLoading}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelOrder}
                disabled={cancelLoading}
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
