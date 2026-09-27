import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/pathology_billing';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(MONGO_URI);
    console.log(`✅ [MongoDB Mongoose]: Connected to ${MONGO_URI}`);
  } catch (error: any) {
    console.error(`❌ [MongoDB Connection Error]:`, error.message);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
