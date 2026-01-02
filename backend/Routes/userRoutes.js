import express from "express";
import {
  getAllUsers,
  registerUser,
  authUser,
  logoutUser,
  deleteUser,
  updateUser,
  adminResetPassword,
} from "../Controllers/userController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getAllUsers);
router.post("/register", registerUser);
router.post("/login", authUser);
router.post("/logout", logoutUser);
router.delete("/:id", deleteUser);
router.put("/:id", updateUser);
router.post(
  "/:id/reset-password",
  protect,
  allowRoles("admin"),
  adminResetPassword
);

export default router;
