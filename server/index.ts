import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import wishlistRoutes from "./routes/wishlist.js";
import orderRoutes from "./routes/orders.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";
import adminUsersRoutes from "./routes/admin-users.js";
import adminApprovalsRoutes from "./routes/admin-approvals.js";
import adminVerificationsRoutes from "./routes/admin-verifications.js";
import adminProductsRoutes from "./routes/admin-products.js";
import adminOrdersRoutes from "./routes/admin-orders.js";
import adminDeliveriesRoutes from "./routes/admin-deliveries.js";
import adminReportsRoutes from "./routes/admin-reports.js";
import adminComplaintsRoutes from "./routes/admin-complaints.js";
import idVerificationRoutes from "./routes/id-verification.js";
import {
  assertPrivateStoragePath,
  purgeExpiredIdDocuments,
} from "./services/idDocuments.js";
import apiErrorHandler from "./middleware/apiErrorHandler.js";
import { createCorsOptions, resolveServerHost } from "./utils/networkConfig.js";

const app = express();
assertPrivateStoragePath();
app.use(cors(createCorsOptions()));
app.use("/api/webhooks", idVerificationRoutes);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/havestra";
const port = Number(process.env.PORT || 5000);
const host = resolveServerHost();

mongoose.set("strictQuery", false);

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin/approvals", adminApprovalsRoutes);
app.use("/api/admin/verifications", adminVerificationsRoutes);
app.use("/api/admin/products", adminProductsRoutes);
app.use("/api/admin/orders", adminOrdersRoutes);
app.use("/api/admin/deliveries", adminDeliveriesRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/admin/complaints", adminComplaintsRoutes);

app.use(express.static(path.join(process.cwd(), "dist", "public")));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/db-status", (_req, res) => {
  const state = mongoose.connection.readyState;
  const statusText =
    state === 1
      ? "connected"
      : state === 2
        ? "connecting"
        : state === 0
          ? "disconnected"
          : state === 3
            ? "disconnecting"
            : "unknown";
  res.json({ status: "ok", mongodb: statusText, state });
});

app.get("/*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "dist", "public", "index.html"));
});

app.use(apiErrorHandler);

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("Database: havestra");
    const runIdDocumentCleanup = () => {
      void purgeExpiredIdDocuments().catch(error => {
        console.error("[IDRetention] Cleanup failed", {
          errorName: error instanceof Error ? error.name : "Error",
        });
      });
    };
    runIdDocumentCleanup();
    const cleanupTimer = setInterval(runIdDocumentCleanup, 24 * 60 * 60 * 1000);
    cleanupTimer.unref();
    app.listen(port, host, () => {
      console.log(`Server listening on http://${host}:${port}`);
    });
  })
  .catch(error => {
    console.error("❌ MongoDB Connection Failed");
    console.error(error);
    process.exit(1);
  });

export default app;
