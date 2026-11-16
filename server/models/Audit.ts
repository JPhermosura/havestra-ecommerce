import mongoose from "mongoose";

const AuditSchema = new mongoose.Schema(
  {
    actorEmail: { type: String },
    actorPhone: { type: String },
    action: { type: String, required: true },
    targetEmail: { type: String },
    targetPhone: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "admin_audits" }
);

export const AuditModel = mongoose.models.Audit || mongoose.model("Audit", AuditSchema);
