import dns from "node:dns";
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.URL_DB || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MongoDB connection string is not configured");
    }

    if (mongoUri.startsWith("mongodb+srv://")) {
      const dnsServers = (process.env.MONGO_DNS_SERVERS || "")
        .split(",")
        .map((server) => server.trim())
        .filter(Boolean);

      if (dnsServers.length > 0) {
        dns.setServers(dnsServers);
      }
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
// This code connects to a MongoDB database using Mongoose.
