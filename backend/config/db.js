import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Fail fast instead of buffering forever if Atlas is unreachable
      serverSelectionTimeoutMS: 10000,
      autoIndex: process.env.NODE_ENV !== 'production', // build indexes manually in prod
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    console.log(`MongoDB database: ${conn.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

export default connectDB;
