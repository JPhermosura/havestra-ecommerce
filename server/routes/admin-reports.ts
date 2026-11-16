import express from "express";
import { OrderModel } from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

function getDateFilter(query: express.Request["query"]) {
  const startDate = query.startDate;
  const endDate = query.endDate;
  if (startDate === undefined && endDate === undefined)
    return { filter: {}, error: null };
  if (typeof startDate !== "string" || typeof endDate !== "string") {
    return {
      filter: null,
      error: "Provide both startDate and endDate as YYYY-MM-DD.",
    };
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== startDate ||
    end.toISOString().slice(0, 10) !== endDate ||
    start > end
  ) {
    return {
      filter: null,
      error:
        "Dates must be valid YYYY-MM-DD values, and startDate cannot be after endDate.",
    };
  }

  end.setUTCDate(end.getUTCDate() + 1);
  const dateRange = { $gte: start, $lt: end };
  return {
    filter: {
      $or: [
        { deliveredAt: dateRange },
        { deliveredAt: null, createdAt: dateRange },
      ],
    },
    error: null,
  };
}

// Simple sales summary endpoints
router.get("/summary", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const dateFilter = getDateFilter(req.query);
    if (dateFilter.error)
      return res.status(400).json({ error: dateFilter.error });
    const match = { status: "Delivered", ...dateFilter.filter };
    // Total delivered sales and order count for the selected range.
    const totalSalesAgg = await OrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
    ]);
    const total = totalSalesAgg[0] || { total: 0, count: 0 };

    // sales by month
    const monthsAgg = await OrderModel.aggregate([
      { $match: match },
      {
        $addFields: { reportDate: { $ifNull: ["$deliveredAt", "$createdAt"] } },
      },
      {
        $group: {
          _id: {
            year: { $year: "$reportDate" },
            month: { $month: "$reportDate" },
          },
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
    ]);

    res.json({
      totalSales: total.total,
      totalOrders: total.count,
      monthly: monthsAgg,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sales summary" });
  }
});

// Sales by seller (top performers)
router.get(
  "/by-seller",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const dateFilter = getDateFilter(req.query);
      if (dateFilter.error)
        return res.status(400).json({ error: dateFilter.error });
      const agg = await OrderModel.aggregate([
        { $unwind: "$items" },
        { $match: { status: "Delivered", ...dateFilter.filter } },
        {
          $group: {
            _id: "$items.sellerId",
            sales: { $sum: "$items.totalPrice" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { sales: -1 } },
        { $limit: 20 },
      ]);
      res.json({ sellers: agg });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch seller performance" });
    }
  }
);

export default router;
