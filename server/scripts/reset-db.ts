import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../models/User.js";
import { ProductModel } from "../models/Product.js";
import { OrderModel } from "../models/Order.js";
import { ReviewModel } from "../models/Review.js";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/havestra";

async function reset() {
  await mongoose.connect(mongoUri);
  await Promise.all([
    UserModel.deleteMany({}),
    ProductModel.deleteMany({}),
    OrderModel.deleteMany({}),
    ReviewModel.deleteMany({}),
  ]);
  console.log("Database reset complete");
  process.exit(0);
}

reset().catch(error => {
  console.error(error);
  process.exit(1);
});
