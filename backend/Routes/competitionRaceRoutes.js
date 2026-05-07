import express from "express";
import {
  listRaces,
  getRace,
  createRace,
  updateRace,
  deleteRace,
  updateRaceLanes,
  recordRaceResults,
  swapRaceLanes,
  computeCompetitionRankings,
  autoGenerateRaces,
  combineRaces,
  listOfficialResultGroups,
  getProvisionalEventResults,
  getOfficialEventResults,
  publishOfficialEventResults,
  unpublishOfficialEventResults,
  autoAssignEventGroups,
  publishAllReadyOfficialResults,
  listCompetitionPenalties,
  createCompetitionPenalty,
  updateCompetitionPenalty,
  deleteCompetitionPenalty,
  backfillSourceRaceMetadata,
} from "../Controllers/competitionRaceController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

// Env-protected backfill trigger (no JWT required)
// Call with header: 'x-backfill-secret: <secret>' where <secret> === process.env.BACKFILL_SECRET
router.post(
  "/admin/backfill-source-races/trigger-secret",
  async (req, res, next) => {
    try {
      const secret =
        req.headers["x-backfill-secret"] || req.headers["x-backfill_secret"];
      if (!process.env.BACKFILL_SECRET) {
        return res
          .status(500)
          .json({ message: "Server misconfigured: BACKFILL_SECRET not set" });
      }
      if (!secret || secret !== process.env.BACKFILL_SECRET) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // forward to controller handler
      return backfillSourceRaceMetadata(req, res, next);
    } catch (err) {
      next(err);
    }
  },
);

router.use(protect);

router
  .route("/")
  .get(allowRoles("admin", "jury_president"), listRaces)
  .post(allowRoles("admin", "jury_president"), createRace);

router
  .route("/rankings")
  .get(allowRoles("admin", "jury_president"), computeCompetitionRankings)
  .post(allowRoles("admin", "jury_president"), computeCompetitionRankings);

router
  .route("/lane-swaps")
  .post(allowRoles("admin", "jury_president"), swapRaceLanes);

router
  .route("/combine")
  .post(allowRoles("admin", "jury_president"), combineRaces);

router
  .route("/official-results/groups")
  .get(allowRoles("admin", "jury_president"), listOfficialResultGroups);

router
  .route("/official-results/provisional/:eventGroupId")
  .get(allowRoles("admin", "jury_president"), getProvisionalEventResults);

router
  .route("/official-results/:eventGroupId")
  .get(allowRoles("admin", "jury_president"), getOfficialEventResults)
  .delete(allowRoles("admin", "jury_president"), unpublishOfficialEventResults);

router
  .route("/official-results/publish")
  .post(allowRoles("admin", "jury_president"), publishOfficialEventResults);

router
  .route("/official-results/publish-all")
  .post(allowRoles("admin", "jury_president"), publishAllReadyOfficialResults);

router
  .route("/official-results/auto-group")
  .post(allowRoles("admin", "jury_president"), autoAssignEventGroups);

router
  .route("/penalties")
  .get(allowRoles("admin", "jury_president"), listCompetitionPenalties)
  .post(allowRoles("admin", "jury_president"), createCompetitionPenalty);

router
  .route("/penalties/:penaltyId")
  .patch(allowRoles("admin", "jury_president"), updateCompetitionPenalty)
  .delete(allowRoles("admin", "jury_president"), deleteCompetitionPenalty);

// Admin backfill endpoint
router
  .route("/admin/backfill-source-races")
  .post(protect, allowRoles("admin"), backfillSourceRaceMetadata);

router
  .route("/auto-generate")
  .post(allowRoles("admin", "jury_president"), autoGenerateRaces);

router
  .route("/:raceId")
  .get(allowRoles("admin", "jury_president", "club_manager", "coach"), getRace)
  .patch(allowRoles("admin", "jury_president"), updateRace)
  .delete(allowRoles("admin", "jury_president"), deleteRace);

router
  .route("/:raceId/lanes")
  .put(allowRoles("admin", "jury_president"), updateRaceLanes);

router
  .route("/:raceId/results")
  .put(allowRoles("admin", "jury_president"), recordRaceResults);

export default router;
