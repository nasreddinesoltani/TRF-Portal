import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
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
import countryRoutes from "./Routes/countryRoutes.js";
import publicRoutes from "./Routes/publicRoutes.js";
import mongoose from "mongoose";
import { syncAllCompetitionRegistrationStatuses } from "./Services/registrationStatusService.js";
import Competition from "./Models/competitionModel.js";

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

const startCompetitionRegistrationStatusSync = () => {
  const syncIntervalMs =
    Number(process.env.REGISTRATION_STATUS_SYNC_INTERVAL_MS) || 5 * 60 * 1000;

  const runSync = async () => {
    try {
      const result = await syncAllCompetitionRegistrationStatuses();
      if (result.updatedCount > 0) {
        console.log(
          `Synced ${result.updatedCount}/${result.scannedCount} competition registration statuses`,
        );
      }
    } catch (error) {
      console.error("Failed to sync competition registration statuses", error);
    }
  };

  const scheduleSync = () => {
    void runSync();
    setInterval(() => {
      void runSync();
    }, syncIntervalMs);
  };

  if (mongoose.connection.readyState === 1) {
    scheduleSync();
    return;
  }

  mongoose.connection.once("open", scheduleSync);
};

startCompetitionRegistrationStatusSync();

// Test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Minimal health route for monitoring and uptime checks
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Temporary debug route to check computed registration status (no auth required)
app.get("/api/debug/registration-status/:competitionId", async (req, res) => {
  try {
    const competition = await Competition.findById(
      req.params.competitionId,
    ).lean();
    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    const { computeCompetitionRegistrationStatus } =
      await import("./Services/registrationStatusService.js");
    const computedStatus = computeCompetitionRegistrationStatus(competition);

    res.json({
      competitionId: competition._id.toString(),
      code: competition.code,
      registrationWindow: competition.registrationWindow || {},
      storedRegistrationStatus: competition.registrationStatus,
      computedRegistrationStatus: computedStatus,
      now: new Date().toISOString(),
      noteIfMismatch:
        competition.registrationStatus !== computedStatus
          ? "MISMATCH: stored != computed"
          : "OK",
    });
  } catch (error) {
    console.error("Debug endpoint error:", error);
    res
      .status(500)
      .json({ message: "Error", error: error.message || String(error) });
  }
});

app.use("/api/public", publicRoutes);
app.use("/api/public", (await import("./Routes/publicDebugRoutes.js")).default);

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
  competitionRegistrationRoutes,
);
app.use("/api/competitions", competitionRoutes);
app.use("/api/rankings", rankingRoutes);
app.use("/api/beach-sprint", beachSprintRoutes);
app.use("/api/countries", countryRoutes);

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

// Return proper JSON 404 for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found" });
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
