import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/User.js";

dotenv.config();

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/havestra";

async function createAdmin() {
  await mongoose.connect(mongoUri);

  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminPhone = process.env.ADMIN_PHONE || "09000000000";
  const adminName = process.env.ADMIN_NAME || "Havestra Admin";
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();

  const existingByPhone = await UserModel.findOne({ phone: adminPhone });
  const existingByEmail = adminEmail
    ? await UserModel.findOne({ email: adminEmail })
    : null;
  const existing = existingByPhone || existingByEmail;

  if (existing) {
    if (String(existing.role).toLowerCase() === "admin") {
      console.log(`Admin user already exists: ${existing.phone || existing.email}`);
      process.exit(0);
    }
    console.log(`User with ${existing.phone || existing.email} exists but is not admin. Promoting to admin.`);
    existing.role = "admin";
    await existing.save();
    console.log("Promoted existing user to admin.");
    process.exit(0);
  }

  const hashed = await bcrypt.hash(adminPassword, 10);
  const adminData: any = {
    phone: adminPhone,
    password: hashed,
    name: adminName,
    role: "admin",
  };
  if (adminEmail) {
    adminData.email = adminEmail;
  }

  const admin = new UserModel(adminData);

  await admin.save();
  console.log(`Created admin user: ${adminEmail}`);
  process.exit(0);
}

createAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
