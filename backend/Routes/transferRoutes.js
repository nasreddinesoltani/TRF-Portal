import express from "express";
import {
  createTransferRequest,
  listTransferRequests,
  updateTransferRequest,
} from "../Controllers/transferController.js";
import { allowRoles, protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  allowRoles("admin", "club_manager"),
  createTransferRequest
);

router.get(
  "/",
  protect,
  allowRoles("admin", "club_manager", "jury_president"),
  listTransferRequests
);

router.patch(
  "/:id",
  protect,
  allowRoles("admin", "jury_president"),
  updateTransferRequest
);

export default router;
