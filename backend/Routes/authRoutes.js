import express from "express";
import {
  registerUser,
  authUser,
  logoutUser,
  changePassword,
} from "../Controllers/userController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", authUser);
router.post("/logout", logoutUser);
router.post("/change-password", protect, changePassword);

export default router;
