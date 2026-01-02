/**
 * Beach Sprint Routes
 *
 * API routes for Beach Sprint competition management
 */

import express from "express";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";
import * as beachSprintController from "../Controllers/beachSprintController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// ============ Event Routes ============

// Create new event
router.post(
  "/events",
  allowRoles("admin", "jury_president"),
  beachSprintController.createEvent
);

// Get all events for a competition
router.get(
  "/competitions/:competitionId/events",
  beachSprintController.getCompetitionEvents
);

// Get single event with races
router.get("/events/:eventId", beachSprintController.getEvent);

// Update event
router.put(
  "/events/:eventId",
  allowRoles("admin", "jury_president"),
  beachSprintController.updateEvent
);

// Delete event
router.delete(
  "/events/:eventId",
  allowRoles("admin", "jury_president"),
  beachSprintController.deleteEvent
);

// Get event bracket
router.get("/events/:eventId/bracket", beachSprintController.getEventBracket);

// ============ Race Generation Routes ============

// Generate time trial heats
router.post(
  "/events/:eventId/generate-time-trials",
  allowRoles("admin", "jury_president"),
  beachSprintController.generateTimeTrials
);

// Process time trial progression
router.post(
  "/events/:eventId/process-time-trial",
  allowRoles("admin", "jury_president"),
  beachSprintController.processTimeTrialProgression
);

// Process knockout progression
router.post(
  "/events/:eventId/process-knockout",
  allowRoles("admin", "jury_president"),
  beachSprintController.processKnockoutProgression
);

// Process finals and assign medals
router.post(
  "/events/:eventId/process-finals",
  allowRoles("admin", "jury_president"),
  beachSprintController.processFinalResults
);

// ============ Race Routes ============

// Get all races for an event
router.get("/events/:eventId/races", beachSprintController.getEventRaces);

// Get single race
router.get("/races/:raceId", beachSprintController.getRace);

// Update race
router.put(
  "/races/:raceId",
  allowRoles("admin", "jury_president"),
  beachSprintController.updateRace
);

// Record race results
router.post(
  "/races/:raceId/results",
  allowRoles("admin", "jury_president"),
  beachSprintController.recordRaceResults
);

// ============ Standings Routes ============

// Get club standings for a competition
router.get(
  "/competitions/:competitionId/standings",
  beachSprintController.getClubStandings
);

// Recalculate standings
router.post(
  "/competitions/:competitionId/recalculate-standings",
  allowRoles("admin", "jury_president"),
  beachSprintController.recalculateStandings
);

// ============ Utility Routes ============

// Get available race phases
router.get("/phases", beachSprintController.getRacePhases);

export default router;
