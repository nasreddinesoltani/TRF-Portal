import express from "express";
import {
  getPublicCompetition,
  getPublicCompetitions,
  getPublicCompetitionResults,
  getPublicCompetitionProgramme,
  getPublicLive,
} from "../Controllers/publicController.js";

const router = express.Router();

router.get("/competitions/:competitionId", getPublicCompetition);
router.get("/competitions", getPublicCompetitions);
router.get("/competitions/:competitionId/results", getPublicCompetitionResults);
router.get(
  "/competitions/:competitionId/programme",
  getPublicCompetitionProgramme,
);
router.get("/live", getPublicLive);

export default router;
