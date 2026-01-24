import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOADS_ROOT = path.join(__dirname, "../uploads");
export const ATHLETE_UPLOAD_ROOT = path.join(UPLOADS_ROOT, "athletes");

const ensureDirectory = (directoryPath, callback) => {
  fs.promises
    .mkdir(directoryPath, { recursive: true })
    .then(() => callback(null, directoryPath))
    .catch((error) => callback(error));
};

const documentStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    const athleteId = req.params?.id;
    const docType = req.params?.docType;
    if (!athleteId || !docType) {
      callback(new Error("Invalid document route parameters"));
      return;
    }

    const safeDocType = docType
      .toString()
      .replace(/[^a-z0-9_-]/gi, "-")
      .toLowerCase();
    const targetDirectory = path.join(
      ATHLETE_UPLOAD_ROOT,
      athleteId,
      safeDocType
    );
    ensureDirectory(targetDirectory, callback);
  },
  filename: (req, file, callback) => {
    const resolveExtension = () => {
      const explicitExt = path.extname(file.originalname || "").toLowerCase();
      if (explicitExt) {
        return explicitExt;
      }
      if (file.mimetype === "image/jpeg") {
        return ".jpg";
      }
      if (file.mimetype === "image/png") {
        return ".png";
      }
      if (file.mimetype === "application/pdf") {
        return ".pdf";
      }
      return ".bin";
    };

    const sanitise = (value) =>
      value
        .toString()
        .trim()
        .replace(/[^a-z0-9_-]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

    const extension = resolveExtension();
    const normalizedDocType = sanitise(req.params?.docType || "document");
    const licenseNumber = req.athleteUploadContext?.licenseNumber;

    if (normalizedDocType === "photo" && licenseNumber) {
      const base = sanitise(licenseNumber);
      callback(null, `${base || "photo"}${extension}`);
      return;
    }

    const baseName =
      file.fieldname === "file" && normalizedDocType
        ? normalizedDocType
        : sanitise(file.fieldname || "document");
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileBase = baseName || "document";
    callback(null, `${fileBase}-${uniqueSuffix}${extension}`);
  },
});

export const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
