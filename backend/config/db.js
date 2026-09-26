const mongoose = require('mongoose');

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`MongoDB connection error (percobaan ${attempt}/${MAX_RETRIES}):`, error.message);
      if (attempt === MAX_RETRIES) {
        console.error('MongoDB gagal terhubung setelah semua percobaan.');
        process.exit(1);
      }
      await sleep(RETRY_DELAY_MS);
    }
  }
};

module.exports = connectDB;