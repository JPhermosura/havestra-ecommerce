import React from "react";
import { Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentMethod } from "@/types/payment";

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}

const paymentMethods = [
  {
    id: "cod" as PaymentMethod,
    name: "Cash on Delivery",
    description: "Pay when you receive your order",
    icon: Truck,
    color: "bg-orange-500",
  },
];

export default function PaymentMethodSelector({
  selectedMethod,
  onMethodChange,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        Select Payment Method
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map(method => {
          const Icon = method.icon;
          return (
            <Card
              key={method.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedMethod === method.id
                  ? "ring-2 ring-emerald-500 bg-emerald-50"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => onMethodChange(method.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 ${method.color} rounded-full flex items-center justify-center`}
                  >
                    <Icon className="text-white" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{method.name}</h4>
                    <p className="text-sm text-gray-600">
                      {method.description}
                    </p>
                  </div>
                  {selectedMethod === method.id && (
                    <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
