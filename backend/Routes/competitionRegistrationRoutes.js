import express from "express";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";
import {
  getRegistrationSummary,
  listEligibleAthletes,
  createCompetitionEntries,
  updateEntryStatus,
  withdrawEntry,
  deleteEntry,
  updateEntry,
} from "../Controllers/competitionRegistrationController.js";

const router = express.Router({ mergeParams: true });

router.get(
  "/",
  protect,
  allowRoles("admin", "jury_president", "club_manager"),
  getRegistrationSummary
);

router.get(
  "/eligible",
  protect,
  allowRoles("admin", "jury_president", "club_manager"),
  listEligibleAthletes
);

router.post(
  "/",
  protect,
  allowRoles("admin", "jury_president", "club_manager"),
  createCompetitionEntries
);

router.patch(
  "/:entryId/status",
  protect,
  allowRoles("admin", "jury_president"),
  updateEntryStatus
);

router.put(
  "/:entryId",
  protect,
  allowRoles("admin", "jury_president"),
  updateEntry
);

router.post(
  "/:entryId/withdraw",
  protect,
  allowRoles("admin", "jury_president", "club_manager"),
  withdrawEntry
);

router.delete(
  "/:entryId",
  protect,
  allowRoles("admin", "jury_president"),
  deleteEntry
);

export default router;
