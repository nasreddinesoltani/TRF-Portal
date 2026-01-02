import express from "express";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  recalculateNationalCategories,
} from "../Controllers/categoryController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  allowRoles("admin", "club_manager", "jury_president", "umpire"),
  listCategories
);

router.post("/", allowRoles("admin"), createCategory);
router.put("/:id", allowRoles("admin"), updateCategory);
router.delete("/:id", allowRoles("admin"), deleteCategory);

router.post(
  "/national/recalculate",
  allowRoles("admin"),
  recalculateNationalCategories
);

export default router;
