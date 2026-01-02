import express from "express";
import {
  createClub,
  listClubs,
  updateClubStatus,
  getClubById,
  updateClub,
  deleteClub,
  getClubSummary,
  getClubDetailsWithAthletes,
  updateClubAthleteStatus,
} from "../Controllers/clubController.js";
import { protect, admin, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, admin, createClub);
router.get(
  "/",
  protect,
  allowRoles("admin", "jury_president", "club_manager"),
  listClubs
);
router.get(
  "/mine",
  protect,
  allowRoles("admin", "club_manager"),
  getClubSummary
);
router.get(
  "/:id/details",
  protect,
  allowRoles("admin", "club_manager", "jury_president"),
  getClubDetailsWithAthletes
);
router.get("/:id", protect, admin, getClubById);
router.put("/:id", protect, admin, updateClub);
router.patch("/:id/status", protect, admin, updateClubStatus);
router.patch(
  "/:clubId/athletes/:athleteId/status",
  protect,
  allowRoles("admin", "club_manager"),
  updateClubAthleteStatus
);
router.delete("/:id", protect, admin, deleteClub);

export default router;
