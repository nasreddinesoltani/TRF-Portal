import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../Models/userModel.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

// Debug: Check if MONGO_URI or URL_DB is loaded
const mongoUri = process.env.MONGO_URI || process.env.URL_DB;

if (!mongoUri) {
  console.error("Error: MONGO_URI or URL_DB is not defined in .env file");
  console.error("Looking for .env at:", path.join(__dirname, "../.env"));
  process.exit(1);
}

const resetPassword = async () => {
  try {
    const email = process.argv[2];
    const newPassword = process.argv[3];

    if (!email || !newPassword) {
      console.log("Usage: node resetPassword.js <email> <newPassword>");
      process.exit(1);
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    const user = await User.findOne({ email });

    if (!user) {
      console.log(`User with email ${email} not found.`);
      process.exit(1);
    }

    console.log(
      `Found user: ${user.firstName} ${user.lastName} (${user.email})`
    );

    // The pre-save hook in userModel.js will handle the hashing
    user.password = newPassword;
    user.mustChangePassword = true; // Force them to change it next time

    await user.save();

    console.log("Password reset successfully.");
    console.log("User must change password on next login: YES");

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

resetPassword();
