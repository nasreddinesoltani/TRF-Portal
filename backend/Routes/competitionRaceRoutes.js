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
} from "../Controllers/competitionRaceController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router({ mergeParams: true });

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
