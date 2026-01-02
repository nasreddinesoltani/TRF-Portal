#!/usr/bin/env node

// This script creates a test user in the MongoDB database
// Usage: node createTestUser.js

import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  firstNameAr: String,
  lastNameNameAr: String,
  birthDate: Date,
  gender: String,
  category: String,
  cin: String,
  phone: String,
  address: String,
  city: String,
  postalCode: String,
  email: String,
  password: String,
  isAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  role: { type: String, default: "user" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", userSchema);

async function createTestUser() {
  try {
    const dbUrl =
      process.env.URL_DB ||
      "mongodb+srv://soltaninasro:tarajiste18486@cluster0.9zejq23.mongodb.net/?retryWrites=true&w=majority";

    console.log("Connecting to MongoDB...");
    await mongoose.connect(dbUrl);
    console.log("✅ Connected to MongoDB");

    // Check if demo user already exists
    const existingUser = await User.findOne({ email: "demo@example.com" });
    if (existingUser) {
      console.log("⚠️  Demo user already exists!");
      console.log("Email: demo@example.com");
      console.log("Password: password123");
      process.exit(0);
    }

    // Create test user
    const testUser = new User({
      firstName: "Demo",
      lastName: "User",
      firstNameAr: "تجربة",
      lastNameNameAr: "مستخدم",
      birthDate: new Date("1990-01-15"),
      gender: "homme",
      category: "etudiant",
      cin: "12345678901",
      phone: "+216987654321",
      address: "123 Demo Street",
      city: "Tunis",
      postalCode: "1000",
      email: "demo@example.com",
      password: "password123", // Will be hashed automatically
      isActive: true,
      role: "user",
    });

    await testUser.save();
    console.log("✅ Test user created successfully!");
    console.log("\n📝 Login Credentials:");
    console.log("   Email: demo@example.com");
    console.log("   Password: password123");
    console.log("\n🔗 Go to: http://localhost:5174/login");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test user:", error.message);
    process.exit(1);
  }
}

createTestUser();
