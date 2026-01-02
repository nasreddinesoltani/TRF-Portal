import express from "express";
import {
  listCompetitions,
  getCompetitionById,
  createCompetition,
  updateCompetition,
  updateCompetitionStatus,
  deleteCompetition,
} from "../Controllers/competitionController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listCompetitions);
router.get("/:id", protect, getCompetitionById);

router.post(
  "/",
  protect,
  allowRoles("admin", "jury_president"),
  createCompetition
);

router.put(
  "/:id",
  protect,
  allowRoles("admin", "jury_president"),
  updateCompetition
);

router.patch(
  "/:id/status",
  protect,
  allowRoles("admin", "jury_president"),
  updateCompetitionStatus
);

router.delete("/:id", protect, allowRoles("admin"), deleteCompetition);

export default router;
