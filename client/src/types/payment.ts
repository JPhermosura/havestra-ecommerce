export type PaymentMethod = "cod";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "refunded"
  | "escrow-held"
  | "escrow-released";

export type FlexiblePaymentType =
  | "full"
  | "installment"
  | "partial"
  | "pay-on-harvest";

export interface PaymentDetails {
  method: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  escrowId?: string;
  installments?: Installment[];
  partialPayments?: PartialPayment[];
}

export interface Installment {
  id: string;
  amount: number;
  dueDate: Date;
  status: "pending" | "paid" | "overdue";
}

export interface PartialPayment {
  id: string;
  amount: number;
  paidAt: Date;
  status: "paid";
}

export interface OrderSummary {
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  items: Array<{
    id: string;
    title: string;
    price: number;
    quantity: number;
  }>;
}

export interface FarmerWallet {
  balance: number;
  transactions: WalletTransaction[];
  withdrawals: Withdrawal[];
}

export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  date: Date;
  orderId?: string;
}

export interface Withdrawal {
  id: string;
  amount: number;
  status: "pending" | "completed" | "failed";
  requestedAt: Date;
  completedAt?: Date;
}
