import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "../models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/havestra";

async function ensureDemoAccount(account: {
  phone: string;
  email?: string;
  password: string;
  name: string;
  role: "buyer" | "seller";
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  isFarmer?: boolean;
  farmName?: string;
  farmLocation?: string;
}) {
  const identityConditions: Array<{ phone?: string; email?: string }> = [
    { phone: account.phone },
  ];
  if (account.email) identityConditions.push({ email: account.email });

  const existing = await UserModel.findOne({ $or: identityConditions });
  if (existing) {
    console.log(`Demo ${account.role} account already exists.`);
    return;
  }

  const { password, ...profile } = account;
  await UserModel.create({
    ...profile,
    password: await bcrypt.hash(password, 10),
  });
  console.log(`Created demo ${account.role} account.`);
}

async function seed() {
  try {
    await mongoose.connect(mongoUri);

    await ensureDemoAccount({
      phone: "09171234567",
      password: "buyer123",
      name: "Havestra Buyer",
      role: "buyer",
      address: "Brgy. San Juan",
      city: "Iloilo",
      country: "Philippines",
      zipCode: "5000",
    });

    await ensureDemoAccount({
      email: "seller@example.com",
      phone: "09171234568",
      password: "seller123",
      name: "Havestra Seller",
      role: "seller",
      isFarmer: true,
      farmName: "Sunrise Farms",
      farmLocation: "Western Visayas",
    });

    console.log(
      "Account seeding complete. Existing users and marketplace data were preserved. Run db:seed-admin separately to ensure the admin account."
    );
  } catch (error) {
    console.error("Account seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seed();
