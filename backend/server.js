import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import userRoutes from "./Routes/userRoutes.js";
import authRoutes from "./Routes/authRoutes.js";
import clubRoutes from "./Routes/clubRoutes.js";
import athleteRoutes from "./Routes/athleteRoutes.js";
import { protect } from "./Middleware/authMiddleware.js";
import transferRoutes from "./Routes/transferRoutes.js";
import athleteDeletionRoutes from "./Routes/athleteDeletionRoutes.js";
import categoryRoutes from "./Routes/categoryRoutes.js";
import boatClassRoutes from "./Routes/boatClassRoutes.js";
import competitionRoutes from "./Routes/competitionRoutes.js";
import competitionRaceRoutes from "./Routes/competitionRaceRoutes.js";
import competitionRegistrationRoutes from "./Routes/competitionRegistrationRoutes.js";
import rankingRoutes from "./Routes/rankingRoutes.js";
import beachSprintRoutes from "./Routes/beachSprintRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded documents
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

connectDB(); // Connect to the database

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

app.use("/api/users", protect, userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/athletes", athleteRoutes);
app.use("/api/athlete-transfers", transferRoutes);
app.use("/api/athlete-deletions", athleteDeletionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/boat-classes", boatClassRoutes);
app.use("/api/competitions/:competitionId/races", competitionRaceRoutes);
app.use(
  "/api/competitions/:competitionId/registration",
  competitionRegistrationRoutes
);
app.use("/api/competitions", competitionRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/beach-sprint", beachSprintRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: "File too large. Maximum size allowed is 10MB.",
      });
    }
    return res.status(400).json({ message: err.message });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// Serve SPA - all non-API routes go to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Serving frontend from dist folder`);
});
