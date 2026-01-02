import express from "express";
import {
  listBoatClasses,
  getBoatClassById,
  createBoatClass,
  updateBoatClass,
  deleteBoatClass,
  bootstrapBoatClasses,
} from "../Controllers/boatClassController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, listBoatClasses);

router.get(
  "/:id",
  protect,
  allowRoles("admin", "jury_president"),
  getBoatClassById
);

router.post(
  "/",
  protect,
  allowRoles("admin", "jury_president"),
  createBoatClass
);

router.post(
  "/bootstrap",
  protect,
  allowRoles("admin", "jury_president"),
  bootstrapBoatClasses
);

router.put(
  "/:id",
  protect,
  allowRoles("admin", "jury_president"),
  updateBoatClass
);

router.delete(
  "/:id",
  protect,
  allowRoles("admin", "jury_president"),
  deleteBoatClass
);

export default router;
