/**
 * Ranking Routes
 *
 * Routes for ranking system management and competition ranking calculations.
 */

import express from "express";
import { protect, admin } from "../Middleware/authMiddleware.js";
import {
  getRankingSystems,
  getRankingSystemById,
  createRankingSystem,
  updateRankingSystem,
  deleteRankingSystem,
  getPresets,
  syncPresets,
  getCompetitionRanking,
  getCompetitionGroupRanking,
  getAvailableSystemsForCompetition,
} from "../Controllers/rankingController.js";

const router = express.Router();

// === Ranking Systems CRUD ===

// Get all ranking systems (public)
router.get("/systems", getRankingSystems);

// Get a specific ranking system (public)
router.get("/systems/:id", getRankingSystemById);

// Create a new ranking system (admin only)
router.post("/systems", protect, admin, createRankingSystem);

// Update a ranking system (admin only)
router.put("/systems/:id", protect, admin, updateRankingSystem);

// Delete a ranking system (admin only)
router.delete("/systems/:id", protect, admin, deleteRankingSystem);

// === Presets ===

// Get preset configurations (public)
router.get("/presets", getPresets);

// Sync presets to database (admin only)
router.post("/presets/sync", protect, admin, syncPresets);

// === Competition Rankings ===

// Get full ranking for a competition (public)
router.get("/competition/:competitionId", getCompetitionRanking);

// Get ranking for a specific group (public)
router.get(
  "/competition/:competitionId/group/:groupKey",
  getCompetitionGroupRanking
);

// Get available ranking systems for a competition (public)
router.get(
  "/competition/:competitionId/available-systems",
  getAvailableSystemsForCompetition
);

export default router;
