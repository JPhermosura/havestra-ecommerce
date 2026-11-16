import { useState } from "react";
import axios from "axios";
import { useLocation } from "wouter";
import { Loader2, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";
import OrderSummary from "@/components/OrderSummary";
import EscrowStatus from "@/components/EscrowStatus";
import { PaymentMethod, PaymentStatus } from "@/types/payment";

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, totalPrice, clearCart } = useCart();
  const { user, updateProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orderReference, setOrderReference] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [receiptItems, setReceiptItems] = useState<
    Array<{
      id: string;
      title: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>
  >([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    city: user?.city || "",
    country: user?.country || "",
    zipCode: user?.zipCode || "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateShipping = () => {
    const missing = [];
    if (!formData.name) missing.push("Full Name");
    if (!formData.phone) missing.push("Phone");
    if (!formData.address) missing.push("Street Address");
    if (!formData.city) missing.push("City");
    if (!formData.country) missing.push("Country");
    if (!formData.zipCode) missing.push("ZIP Code");
    return missing;
  };

  const handleNext = () => {
    console.log("handleNext called. Current step:", step);
    if (step === 1) {
      const missing = validateShipping();
      if (missing.length > 0) {
        console.warn("Shipping validation failed. Missing fields:", missing);
        toast.error(`Missing: ${missing.join(", ")}`);
        return;
      }
      setStep(2);
      toast.success("Proceeding to payment...");
      return;
    }

    if (step === 2) {
      processPayment();
      return;
    }
  };

  const handleBack = () => {
    setStep(prevStep => (prevStep > 1 ? ((prevStep - 1) as 1 | 2 | 3) : 1));
  };

  const prepareOrderItems = () => {
    if (!items || items.length === 0) {
      return [];
    }

    return items.map(item => ({
      productId: item.id,
      quantity: item.quantity,
    }));
  };

  const processPayment = async () => {
    console.log(
      "processPayment started. User:",
      user?.id,
      "Items:",
      items.length
    );

    if (!user) {
      toast.error("Please log in before placing an order.");
      return;
    }

    const orderItems = prepareOrderItems();
    if (orderItems.length === 0) {
      toast.error("Your cart is empty. Add items before placing an order.");
      return;
    }

    setIsLoading(true);
    try {
      const shippingAddress = {
        street: formData.address,
        city: formData.city,
        province: formData.country || "",
        zipCode: formData.zipCode,
      };

      console.log("Creating order with items:", orderItems);
      const orderResponse = await axios.post("/api/orders", {
        items: orderItems,
        shippingAddress,
        paymentMethod,
      });

      const order = orderResponse.data;
      console.log("Order created successfully:", order.orderId);
      setOrderReference(order.orderId || order._id || "");
      setOrderTotal(order.totalAmount || order.total || null);
      setReceiptItems(
        (order.items || []).map((item: any, index: number) => ({
          id: String(item.productId || item._id || index),
          title: item.productName || item.name || `Item ${index + 1}`,
          quantity: item.quantity || 1,
          unitPrice: item.unitPrice || 0,
          totalPrice:
            item.totalPrice || (item.quantity || 1) * (item.unitPrice || 0),
        }))
      );

      await clearCart();
      setStep(3);
      toast.success("Order placed successfully! Displaying receipt...");
      // Auto-navigate after 3 seconds to let user see the receipt
      setTimeout(() => navigate("/buyer/orders"), 3000);
      return;
    } catch (error: any) {
      console.error("Order processing failed:", error);
      toast.error(error.response?.data?.error || "Order processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  if (items.length === 0 && step < 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Your cart is empty</p>
          <Button
            onClick={() => navigate("/products")}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container py-12">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="text-emerald-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Order Confirmed!
            </h1>
            <p className="text-gray-600 mb-6">
              Thank you for your purchase. Your order has been placed
              successfully.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Order Number:</strong> #
                {orderReference ||
                  Math.random().toString(36).substr(2, 9).toUpperCase()}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Contact:</strong> {formData.phone || formData.email}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Payment Method:</strong>{" "}
                {paymentMethod.replace("-", " ").toUpperCase()}
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-gray-900 mb-4">
                Receipt
              </p>
              <div className="space-y-3">
                {receiptItems.length > 0 ? (
                  receiptItems.map(item => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start gap-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {item.title}
                        </p>
                        <p className="text-sm text-gray-600">
                          Qty: {item.quantity} × ₱{item.unitPrice.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900">
                        ₱{item.totalPrice.toFixed(2)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">
                    Receipt details are unavailable.
                  </p>
                )}
              </div>

              <div className="border-t mt-4 pt-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    ₱
                    {receiptItems
                      .reduce((sum, item) => sum + item.totalPrice, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span>₱50.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (12%)</span>
                  <span>
                    ₱
                    {(
                      receiptItems.reduce(
                        (sum, item) => sum + item.totalPrice,
                        0
                      ) * 0.12
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total</span>
                  <span>
                    ₱{orderTotal !== null ? orderTotal.toFixed(2) : "0.00"}
                  </span>
                </div>
              </div>
            </div>
            {paymentStatus === "escrow-held" && (
              <EscrowStatus
                status={paymentStatus}
                escrowId="ESC-123456"
                amount={totalPrice * 1.12 + 50}
                releaseDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                farmerName="Juan Dela Cruz"
              />
            )}
            <p className="text-sm text-gray-600 mb-6">
              A confirmation email has been sent to {formData.email}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/buyer/orders")}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg transition"
              >
                View My Orders
              </button>
              <button
                onClick={() => navigate("/products")}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-3 rounded-lg transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            {/* Progress Steps */}
            <div className="flex gap-4 mb-8">
              <div
                className={`flex-1 pb-4 border-b-2 ${
                  step === 1 || step === 2
                    ? "border-emerald-500"
                    : "border-gray-200"
                }`}
              >
                <p className="font-semibold text-gray-900">Shipping</p>
              </div>
              <div
                className={`flex-1 pb-4 border-b-2 ${
                  step === 2 ? "border-emerald-500" : "border-gray-200"
                }`}
              >
                <p className="font-semibold text-gray-900">Payment</p>
              </div>
              <div
                className={`flex-1 pb-4 border-b-2 ${
                  (step as number) === 3
                    ? "border-emerald-500"
                    : "border-gray-200"
                }`}
              >
                <p className="font-semibold text-gray-900">Confirmation</p>
              </div>
            </div>

            {/* Shipping Form */}
            {step === 1 && (
              <form className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Shipping Address
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+63 912 345 6789"
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <Input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      placeholder="Philippines"
                      className="border-gray-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address *
                    </label>
                    <Input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Brgy. Mabini, Kabankalan City"
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <Input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="Kabankalan"
                      className="border-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP Code *
                    </label>
                    <Input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      placeholder="10001"
                      className="border-gray-200"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg"
                >
                  Continue to Payment
                </Button>
              </form>
            )}

            {/* Payment Form */}
            {step === 2 && (
              <div className="space-y-6">
                <form className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Payment Details
                  </h2>

                  <div className="space-y-6">
                    <PaymentMethodSelector
                      selectedMethod={paymentMethod}
                      onMethodChange={setPaymentMethod}
                    />

                    <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100 text-gray-700">
                      <p className="font-medium mb-2">Cash on Delivery</p>
                      <p>
                        Pay in cash when your order is delivered to your
                        doorstep. No advance payment required.
                      </p>
                      <p className="text-sm mt-2">• Exact change preferred</p>
                      <p className="text-sm">
                        • Delivery person will provide receipt
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Button
                      type="button"
                      onClick={handleBack}
                      className="flex-1 bg-gray-200 text-gray-900 hover:bg-gray-300 font-medium py-3 rounded-lg"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isLoading}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Place Order"
                      )}
                    </Button>
                  </div>
                </form>

                {/* Escrow Status for applicable payments */}
                {paymentStatus === "escrow-held" && (
                  <EscrowStatus
                    status={paymentStatus}
                    escrowId="ESC-123456"
                    amount={totalPrice * 1.12}
                    releaseDate={
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    } // 30 days
                    farmerName="Juan Dela Cruz"
                  />
                )}
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary items={items} deliveryFee={50} taxRate={0.12} />
          </div>
        </div>
      </div>
    </div>
  );
}
