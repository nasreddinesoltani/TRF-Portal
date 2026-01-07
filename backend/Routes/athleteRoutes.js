import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import {
  createAthlete,
  deleteAthlete,
  getAthleteDocumentStatus,
  getAthleteStatistics,
  importAthletesFromCsv,
  listAthleteDocuments,
  removeAthleteDocument,
  searchAthletes,
  approveAthleteDocument,
  rejectAthleteDocument,
  updateAthlete,
  updateAthleteLicenseStatus,
  updateAthleteMemberships,
  updateMedicalCertificate,
  uploadAthleteDocument,
  resetAthleteLicenseStatuses,
  syncLicenseCounterHandler,
  bulkUpdateAthleteStatus,
  addSecondaryMembership,
  removeSecondaryMembership,
  getCentreAthletes,
  triggerPhotoImport,
} from "../Controllers/athleteController.js";
import { allowRoles, protect } from "../Middleware/authMiddleware.js";
import { documentUpload } from "../config/upload.js";
import Athlete from "../Models/athleteModel.js";

const router = express.Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const prepareAthleteDocumentUpload = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid athlete identifier" });
    }

    const athlete = await Athlete.findById(id);

    if (!athlete) {
      return res.status(404).json({ message: "Athlete not found" });
    }

    req.athleteUploadContext = athlete;
    return next();
  } catch (error) {
    return next(error);
  }
};

router.get(
  "/",
  protect,
  allowRoles("admin", "club_manager", "jury_president", "umpire"),
  searchAthletes
);
router.get(
  "/stats",
  protect,
  allowRoles("admin", "club_manager", "jury_president", "umpire"),
  getAthleteStatistics
);
router.post("/", protect, allowRoles("admin", "club_manager"), createAthlete);
router.post(
  "/import",
  protect,
  allowRoles("admin"),
  csvUpload.single("file"),
  importAthletesFromCsv
);
router.post(
  "/bulk-status-update",
  protect,
  allowRoles("admin"),
  csvUpload.single("file"),
  bulkUpdateAthleteStatus
);
router.put("/:id", protect, allowRoles("admin", "club_manager"), updateAthlete);
router.patch(
  "/:id/license-status",
  protect,
  allowRoles("admin"),
  updateAthleteLicenseStatus
);
router.patch(
  "/:id/memberships",
  protect,
  allowRoles("admin"),
  updateAthleteMemberships
);
router.get(
  "/:id/documents",
  protect,
  allowRoles("admin", "club_manager", "jury_president", "umpire"),
  listAthleteDocuments
);
router.get(
  "/:id/documents/:docType",
  protect,
  allowRoles("admin", "club_manager", "jury_president", "umpire"),
  getAthleteDocumentStatus
);
router.post(
  "/:id/documents/:docType",
  protect,
  allowRoles("admin", "club_manager"),
  prepareAthleteDocumentUpload,
  documentUpload.single("file"),
  uploadAthleteDocument
);
router.post(
  "/:id/documents/:docType/approve",
  protect,
  allowRoles("admin"),
  approveAthleteDocument
);
router.post(
  "/:id/documents/:docType/reject",
  protect,
  allowRoles("admin"),
  rejectAthleteDocument
);
router.patch(
  "/:id/documents/medical-certificate",
  protect,
  allowRoles("admin"),
  updateMedicalCertificate
);
router.post(
  "/season/reset",
  protect,
  allowRoles("admin"),
  resetAthleteLicenseStatuses
);
router.post(
  "/license-counter/sync",
  protect,
  allowRoles("admin"),
  syncLicenseCounterHandler
);
router.delete(
  "/:id/documents/:docType",
  protect,
  allowRoles("admin"),
  removeAthleteDocument
);
router.post(
  "/import-photos",
  protect,
  allowRoles("admin"),
  triggerPhotoImport
);
router.delete("/:id", protect, allowRoles("admin"), deleteAthlete);

// Dual Membership Routes (Centre de Promotion athletes)
router.post(
  "/secondary-membership",
  protect,
  allowRoles("admin", "federation", "club_manager"),
  addSecondaryMembership
);
router.delete(
  "/secondary-membership",
  protect,
  allowRoles("admin", "federation", "club_manager"),
  removeSecondaryMembership
);
router.get(
  "/centre/:centreId/athletes",
  protect,
  allowRoles("admin", "federation", "club_manager"),
  getCentreAthletes
);
// For club managers to get their own centre's athletes (no centreId needed)
router.get(
  "/centre/athletes",
  protect,
  allowRoles("admin", "federation", "club_manager"),
  getCentreAthletes
);

export default router;
