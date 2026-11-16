import React from "react";
import { Shield, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentStatus } from "@/types/payment";

interface EscrowStatusProps {
  status: PaymentStatus;
  escrowId?: string;
  amount: number;
  releaseDate?: Date;
  farmerName?: string;
}

export default function EscrowStatus({
  status,
  escrowId,
  amount,
  releaseDate,
  farmerName,
}: EscrowStatusProps) {
  const getStatusConfig = (status: PaymentStatus) => {
    switch (status) {
      case "escrow-held":
        return {
          icon: Shield,
          color: "text-blue-600",
          bgColor: "bg-blue-100",
          title: "Payment Held in Escrow",
          description:
            "Your payment is securely held by the platform until delivery confirmation.",
        };
      case "escrow-released":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-100",
          title: "Payment Released",
          description: "Payment has been released to the farmer.",
        };
      case "completed":
        return {
          icon: CheckCircle,
          color: "text-green-600",
          bgColor: "bg-green-100",
          title: "Transaction Completed",
          description: "Your order has been completed successfully.",
        };
      case "pending":
        return {
          icon: Clock,
          color: "text-yellow-600",
          bgColor: "bg-yellow-100",
          title: "Payment Processing",
          description: "Your payment is being processed.",
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-red-600",
          bgColor: "bg-red-100",
          title: "Payment Issue",
          description: "There may be an issue with your payment.",
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div
            className={`w-8 h-8 ${config.bgColor} rounded-full flex items-center justify-center`}
          >
            <Icon className={config.color} size={16} />
          </div>
          {config.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600">{config.description}</p>

        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Amount Held:</span>
            <span className="font-medium">₱{amount.toFixed(2)}</span>
          </div>
          {escrowId && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Escrow ID:</span>
              <span className="font-mono text-sm">{escrowId}</span>
            </div>
          )}
          {farmerName && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Farmer:</span>
              <span className="font-medium">{farmerName}</span>
            </div>
          )}
          {releaseDate && status === "escrow-held" && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Expected Release:</span>
              <span className="font-medium">
                {new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }).format(releaseDate)}
              </span>
            </div>
          )}
        </div>

        {status === "escrow-held" && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Escrow Protection
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Funds are held securely by the platform</li>
              <li>• Released only after delivery confirmation</li>
              <li>• Protected against fraud and disputes</li>
              <li>• Farmer receives payment after successful delivery</li>
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Secure Escrow Service
          </Badge>
          <Badge variant="outline" className="text-xs">
            SSL Encrypted
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
