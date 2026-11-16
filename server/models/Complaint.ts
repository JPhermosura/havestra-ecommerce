import mongoose, { Schema } from "mongoose";

const ComplaintSchema = new Schema({
  orderId: String,
  complainantId: { type: Schema.Types.ObjectId, ref: "User" },
  defendantId: { type: Schema.Types.ObjectId, ref: "User" },
  subject: String,
  description: String,
  status: { type: String, default: "open" },
  resolvedAt: Date,
  createdAt: { type: Date, default: Date.now },
});

export const ComplaintModel =
  mongoose.models.Complaint || mongoose.model("Complaint", ComplaintSchema);
