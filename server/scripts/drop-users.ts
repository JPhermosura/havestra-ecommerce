import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoUri =
  process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/havestra";

async function dropCollection() {
  try {
    await mongoose.connect(mongoUri);
    await mongoose.connection.collection('users').drop();
    console.log('✅ Users collection and indexes dropped');
    process.exit(0);
  } catch (err: any) {
    console.log('Collection does not exist or error:', err.message);
    process.exit(0);
  }
}

dropCollection();
