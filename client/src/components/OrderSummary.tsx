import React from "react";
import { CartItem } from "@/contexts/CartContext";
import { OrderSummary as OrderSummaryType } from "@/types/payment";

interface OrderSummaryProps {
  items: CartItem[];
  deliveryFee?: number;
  taxRate?: number;
}

export default function OrderSummary({
  items,
  deliveryFee = 50,
  taxRate = 0.12,
}: OrderSummaryProps) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = subtotal * taxRate;
  const total = subtotal + deliveryFee + tax;

  const orderSummary: OrderSummaryType = {
    subtotal,
    deliveryFee,
    tax,
    total,
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    })),
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>

      <div className="space-y-3">
        {orderSummary.items.map(item => (
          <div key={item.id} className="flex justify-between items-center">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
            </div>
            <p className="font-medium text-gray-900">
              ₱{(item.price * item.quantity).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">
            ₱{orderSummary.subtotal.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Delivery Fee</span>
          <span className="text-gray-900">
            ₱{orderSummary.deliveryFee.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (12%)</span>
          <span className="text-gray-900">₱{orderSummary.tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-semibold border-t pt-2">
          <span className="text-gray-900">Total</span>
          <span className="text-emerald-600">
            ₱{orderSummary.total.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-4">
        <p>• Prices are in Philippine Peso (₱)</p>
        <p>• Delivery fee may vary based on location</p>
        <p>• Tax included for applicable items</p>
      </div>
    </div>
  );
}
