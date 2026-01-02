import express from "express";
import {
  createAthleteDeletionRequest,
  listAthleteDeletionRequests,
  updateAthleteDeletionRequest,
} from "../Controllers/athleteDeletionController.js";
import { allowRoles, protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  allowRoles("club_manager", "admin"),
  createAthleteDeletionRequest
);

router.get(
  "/",
  protect,
  allowRoles("club_manager", "admin"),
  listAthleteDeletionRequests
);

router.patch(
  "/:id",
  protect,
  allowRoles("admin"),
  updateAthleteDeletionRequest
);

export default router;
