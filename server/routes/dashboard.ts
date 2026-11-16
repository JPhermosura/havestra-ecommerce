import { Router } from "express";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { ReviewModel } from "../models/Review.js";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/buyer", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;

  // Get stats
  const totalOrders = await OrderModel.countDocuments({ buyerId: user._id });
  const orders = await OrderModel.countDocuments({
    buyerId: user._id,
    deliveryStatus: { $in: ["Pending", "In Transit"] },
  });
  const cartItems = user.cart?.length || 0;
  const totalSpentResult = await OrderModel.aggregate([
    { $match: { buyerId: user._id, status: "Delivered" } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
  const totalSpent = totalSpentResult[0]?.total || 0;

  // Calculate delivery tracking count for active shipment updates
  const deliveryTracking = await OrderModel.countDocuments({
    buyerId: user._id,
    $or: [
      { deliveryStatus: { $in: ["Pending", "In Transit"] } },
      {
        status: {
          $in: [
            "Order Placed",
            "Payment Confirmed",
            "Preparing Order",
            "Packed",
            "Shipped",
            "Out for Delivery",
          ],
        },
      },
    ],
  });

  // Featured products: 6 products
  const featuredProducts = await ProductModel.find({
    status: { $ne: "inactive" },
    approvalStatus: { $nin: ["pending", "rejected"] },
  })
    .sort({ rating: -1, createdAt: -1 })
    .limit(6);

  return res.json({
    stats: {
      totalOrders,
      orders,
      cartItems,
      totalSpent,
      deliveryTracking,
    },
    featuredProducts,
  });
});

router.get("/seller/dashboard", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;
  const sellerItemsMatch = {
    $or: [{ "items.sellerId": user._id }, { "items.farmerId": user._id }],
  };
  const sellerOrderCount = await OrderModel.countDocuments(sellerItemsMatch);
  const products = await ProductModel.find({
    sellerId: user._id,
    status: { $ne: "inactive" },
  });
  const orders = await OrderModel.find(sellerItemsMatch)
    .sort({ createdAt: -1 })
    .limit(5);

  const orderStatusSummary = await OrderModel.aggregate([
    { $match: sellerItemsMatch },
    { $group: { _id: "$deliveryStatus", count: { $sum: 1 } } },
  ]);

  const customerMetricsAgg = await OrderModel.aggregate([
    { $match: sellerItemsMatch },
    { $unwind: "$items" },
    {
      $match: {
        $or: [{ "items.sellerId": user._id }, { "items.farmerId": user._id }],
      },
    },
    {
      $group: {
        _id: "$buyerId",
        orderIds: { $addToSet: "$_id" },
        spent: {
          $sum: {
            $ifNull: [
              "$items.totalPrice",
              { $multiply: ["$items.unitPrice", "$items.quantity"] },
            ],
          },
        },
      },
    },
    { $project: { orders: { $size: "$orderIds" }, spent: 1 } },
  ]);

  const totalCustomers = customerMetricsAgg.length;
  const repeatCustomers = customerMetricsAgg.filter(
    (entry: any) => entry.orders > 1
  ).length;
  const newCustomers = customerMetricsAgg.filter(
    (entry: any) => entry.orders === 1
  ).length;
  const totalRevenue = customerMetricsAgg.reduce(
    (sum: number, entry: any) => sum + entry.spent,
    0
  );
  const averageOrderValue =
    sellerOrderCount > 0 ? totalRevenue / sellerOrderCount : 0;

  const customerMetrics = {
    totalCustomers,
    repeatCustomers,
    newCustomers,
    averageOrderValue,
    averageRating: 0,
    reviewCount: await ReviewModel.countDocuments({
      "sellerResponse.sellerId": user._id,
    }),
  };

  // Generate daily revenue history for last 7 days
  const last7Days: string[] = [];
  const today = new Date();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // First, create our array of last 7 days (day names)
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayName = dayNames[date.getDay()];
    last7Days.push(dayName);
  }

  // Get orders for last 7 days
  const recentOrders = await OrderModel.find({
    ...sellerItemsMatch,
    createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
  });

  // Process orders in JavaScript to group by day
  const dailyMap: Record<
    string,
    { revenue: number; orders: number; productsSold: number }
  > = {};
  last7Days.forEach(day => {
    dailyMap[day] = { revenue: 0, orders: 0, productsSold: 0 };
  });

  recentOrders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    const dayName = dayNames[orderDate.getDay()];
    const sellerItems = (order.items || []).filter(
      (item: any) =>
        String(item.sellerId || "") === user._id.toString() ||
        String(item.farmerId || "") === user._id.toString()
    );
    if (dailyMap[dayName]) {
      dailyMap[dayName].revenue += sellerItems.reduce(
        (sum: number, item: any) =>
          sum + (item.totalPrice || item.unitPrice * item.quantity || 0),
        0
      );
      dailyMap[dayName].orders += 1;
      dailyMap[dayName].productsSold += sellerItems.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );
    }
  });

  // Create the final revenueHistory array in the order of last7Days
  const revenueHistory = last7Days.map(day => ({
    date: day,
    revenue: dailyMap[day].revenue,
    orders: dailyMap[day].orders,
    productsSold: dailyMap[day].productsSold,
  }));

  const salesTrends = revenueHistory.map(item => ({
    _id: item.date,
    revenue: item.revenue,
    orders: item.orders,
  }));

  // Fix order status summary format
  const formattedStatusSummary = orderStatusSummary.map((item: any) => ({
    status: item._id,
    count: item.count,
  }));

  // Calculate product performance (number of times product was ordered)
  const productOrdersCount = await OrderModel.aggregate([
    { $match: sellerItemsMatch },
    { $unwind: "$items" },
    {
      $match: {
        $or: [{ "items.sellerId": user._id }, { "items.farmerId": user._id }],
      },
    },
    { $group: { _id: "$items.productId", count: { $sum: "$items.quantity" } } },
  ]);

  const productPerformanceMap: Record<string, number> = {};
  productOrdersCount.forEach((item: any) => {
    productPerformanceMap[String(item._id)] = item.count;
  });

  const productPerformance = products.map(product => ({
    name: product.name,
    price: product.price,
    stock: product.stock,
    rating: product.rating,
    ordersCount: productPerformanceMap[String(product._id)] || 0,
  }));

  // Calculate average rating from reviews
  const sellerReviews = await ReviewModel.aggregate([
    { $match: { productId: { $in: products.map(p => p._id) } } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const averageRating = sellerReviews[0]?.avgRating || 0;
  const reviewCount = sellerReviews[0]?.totalReviews || 0;

  // Update customer metrics with real average rating
  const updatedCustomerMetrics = {
    ...customerMetrics,
    averageRating: Number(averageRating.toFixed(1)),
    reviewCount,
  };

  // Final stats
  const activeDeliveriesCount = await OrderModel.countDocuments({
    ...sellerItemsMatch,
    deliveryStatus: { $in: ["Pending", "In Transit"] },
  });

  const stats = {
    totalSales: totalRevenue,
    totalOrders: sellerOrderCount,
    totalProducts: products.length,
    totalReviews: reviewCount,
    activeDeliveries: activeDeliveriesCount,
  };

  return res.json({
    stats,
    revenueHistory,
    salesTrends,
    orderStatusSummary: formattedStatusSummary,
    customerMetrics: updatedCustomerMetrics,
    productPerformance,
    products,
    orders,
  });
});

router.get(
  "/seller/reviews/:sellerId",
  requireAuth,
  async (req: AuthRequest, res) => {
    // Get all products from the seller
    const sellerProducts = await ProductModel.find({
      sellerId: req.params.sellerId,
    }).select("_id");
    const productIds = sellerProducts.map(p => p._id);

    // Get reviews for those products
    const reviews = await ReviewModel.find({
      productId: { $in: productIds },
    }).sort({ createdAt: -1 });

    // Format reviews with product info
    const formattedReviews = reviews.map(review => {
      // Find product for this review
      const product = sellerProducts.find(
        p => String(p._id) === String(review.productId)
      );
      return {
        ...review.toObject(),
        product,
      };
    });

    return res.json({ reviews: formattedReviews });
  }
);

// Admin endpoints removed (system uses Buyer and Seller portals only)

export default router;
