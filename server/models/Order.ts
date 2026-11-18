import mongoose, { Schema, model } from "mongoose";

const AddressSchema = new Schema(
  {
    street: { type: String },
    city: { type: String },
    province: { type: String },
    zipCode: { type: String },
  },
  { _id: false }
);

const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productImage: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User" },
    farmerId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const SellerFulfillmentSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    itemIndexes: { type: [Number], default: [] },
    status: {
      type: String,
      enum: ["Pending", "In Transit", "Delivered", "Cancelled"],
      default: "Pending",
    },
    stockStatus: {
      type: String,
      enum: ["reserved", "released", "consumed", "legacy"],
      required: true,
    },
    trackingNumber: { type: String },
    courier: { type: String },
    estimatedDelivery: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    trackingHistory: {
      type: [
        {
          status: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    buyerName: { type: String, required: true },
    buyerPhone: { type: String, required: true },
    buyerEmail: { type: String },
    buyerAddress: { type: AddressSchema, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, default: "pending" },
    stockReservationStatus: {
      type: String,
      enum: ["reserved", "released", "consumed"],
      required: false,
    },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "Order Placed",
        "Payment Confirmed",
        "Preparing Order",
        "Packed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Order Placed",
    },
    refundStatus: { type: String },
    cancelReason: { type: String },
    cancelDescription: { type: String },
    cancelledBy: { type: String },
    cancelledAt: { type: Date },
    items: { type: [OrderItemSchema], default: [] },
    fulfillments: { type: [SellerFulfillmentSchema], default: [] },
    // Delivery tracking fields
    trackingNumber: { type: String },
    courier: { type: String, default: "Havestra Delivery" },
    estimatedDelivery: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    // Current delivery status separate from order lifecycle status
    deliveryStatus: { type: String, default: "Pending" },
    // Tracking history entries (status, timestamp)
    trackingHistory: {
      type: [
        {
          status: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const OrderModel = mongoose.models.Order || model("Order", OrderSchema);
