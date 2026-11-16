import mongoose from "mongoose";
import dotenv from "dotenv";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { ReviewModel } from "../models/Review.js";
import { UserModel } from "../models/User.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/havestra";
const confirmDeletion = process.argv.includes("--confirm");
const sampleReviewComments = [
  "Excellent quality rice! Very fragrant and cooks perfectly.",
  "Great product, would buy again!",
  "The sweetest mangoes I've ever tasted! 10/10",
];
const sampleProductNames = ["Organic Mountain Rice", "Fresh Mangoes"];

async function removeSeedData() {
  try {
    await mongoose.connect(mongoUri);

    const [buyer, seller, adminCount] = await Promise.all([
      UserModel.findOne({ phone: "09171234567", role: "buyer" }).select(
        "_id cart"
      ),
      UserModel.findOne({ phone: "09171234568", role: "seller" }).select(
        "_id cart"
      ),
      UserModel.countDocuments({ role: "admin" }),
    ]);

    const products = seller
      ? await ProductModel.find({
          sellerId: seller._id,
          $or: [
            {
              name: "Organic Mountain Rice",
              title: "Premium organic mountain rice",
              description:
                "Freshly harvested, high-quality rice from Havestra farmers.",
              price: 2400,
              image:
                "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop",
            },
            {
              name: "Fresh Mangoes",
              title: "Sweet Philippine mangoes",
              description: "Juicy mangoes grown in fertile fields.",
              price: 1800,
              image:
                "https://images.unsplash.com/photo-1518552787537-112e9c95c0ed?w=600&auto=format&fit=crop",
            },
          ],
        }).select("_id name")
      : [];
    const productIds = products.map(product => product._id);
    const demoAccounts = [buyer, seller].filter(
      (account): account is NonNullable<typeof account> => Boolean(account)
    );
    const matchingDemoCartItems = demoAccounts.flatMap(account =>
      (account.cart ?? []).filter((item: { productName: string }) =>
        sampleProductNames.includes(item.productName)
      )
    );

    const orderFilter = {
      $or: [
        ...(buyer
          ? [
              {
                orderId: "ORD-TEST-001",
                buyerId: buyer._id,
                buyerName: "Havestra Buyer",
                buyerPhone: "09171234567",
                totalAmount: 4200,
                status: "Order Placed",
                items: {
                  $elemMatch: {
                    productName: "Organic Mountain Rice",
                    quantity: 1,
                    totalPrice: 2400,
                  },
                },
              },
              {
                _id: new mongoose.Types.ObjectId("6a73f4b12fbcd4aa918b60f5"),
                orderId: "ORD-0T5TQJZ0",
                buyerId: buyer._id,
                buyerName: "Havestra Buyer",
                buyerPhone: "09171234567",
                totalAmount: 1800,
                status: "Order Placed",
                items: {
                  $elemMatch: {
                    productName: "Fresh Mangoes",
                    quantity: 1,
                    totalPrice: 1800,
                  },
                },
              },
            ]
          : []),
      ],
    };

    const reviewFilter =
      buyer && productIds.length > 0
        ? {
            userId: buyer._id,
            productId: { $in: productIds },
            comment: { $in: sampleReviewComments },
          }
        : { _id: { $exists: false } };

    const [orderCount, reviewCount] = await Promise.all([
      OrderModel.countDocuments(orderFilter),
      ReviewModel.countDocuments(reviewFilter),
    ]);

    console.log(
      `Matched ${products.length} seeded products, ${orderCount} seeded order(s), ${reviewCount} seeded review(s), and ${matchingDemoCartItems.length} seeded cart item(s) on demo accounts.`
    );
    console.log(
      `Accounts preserved: demo buyer ${buyer ? "present" : "not found"}, demo seller ${seller ? "present" : "not found"}, admin accounts ${adminCount}.`
    );

    if (!confirmDeletion) {
      console.log(
        "Dry run only. Re-run with --confirm to remove these exact matches."
      );
      return;
    }

    const [reviews, orders, removedProducts, updatedDemoAccounts] =
      await Promise.all([
        ReviewModel.deleteMany(reviewFilter),
        orderFilter.$or.length > 0
          ? OrderModel.deleteMany(orderFilter)
          : Promise.resolve({ deletedCount: 0 }),
        productIds.length > 0
          ? ProductModel.deleteMany({ _id: { $in: productIds } })
          : Promise.resolve({ deletedCount: 0 }),
        demoAccounts.length > 0
          ? UserModel.updateMany(
              {
                _id: { $in: demoAccounts.map(account => account._id) },
                "cart.productName": { $in: sampleProductNames },
              },
              { $pull: { cart: { productName: { $in: sampleProductNames } } } }
            )
          : Promise.resolve({ modifiedCount: 0 }),
      ]);

    console.log(
      `Removed ${removedProducts.deletedCount} seeded products, ${orders.deletedCount} seeded order(s), ${reviews.deletedCount} seeded review(s), and ${matchingDemoCartItems.length} seeded cart item(s). Demo account profiles were not changed (${updatedDemoAccounts.modifiedCount} account(s) updated).`
    );
  } catch (error) {
    console.error("Seed data cleanup failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void removeSeedData();
