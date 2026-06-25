import express from "express";
import {
  listCountries,
  getCountryByCode,
  createCountry,
  updateCountry,
  deleteCountry,
} from "../Controllers/countryController.js";
import { protect, allowRoles } from "../Middleware/authMiddleware.js";

const router = express.Router();

// Public reads (no auth)
router.get("/", listCountries);
router.get("/:code", getCountryByCode);

// Admin CRUD
router.use(protect);
router.post("/", allowRoles("admin"), createCountry);
router.put("/:id", allowRoles("admin"), updateCountry);
router.delete("/:id", allowRoles("admin"), deleteCountry);

export default router;
