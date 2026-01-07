import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMPORT_DIR = path.join(__dirname, "../uploads/photos_import");
const DEST_DIR = path.join(__dirname, "../uploads/photos_organized");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const ensureDir = async (dir) => {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
};

const processFile = async (filename) => {
  // Extract license number from filename (e.g., "12345.jpg" -> "12345")
  // Assume filename starts with license number
  const licenseNumber = path.parse(filename).name;
  
  // Find athlete
  const athlete = await Athlete.findOne({ licenseNumber }).populate("memberships.club");
  
  if (!athlete) {
    console.warn(`[SKIP] No athlete found for license: ${licenseNumber} (File: ${filename})`);
    return;
  }

  // Get active or most recent club
  // We need the club code
  let club = null;
  
  // Try to find active primary membership
  const activeMembership = athlete.memberships.find(m => m.status === 'active' && m.membershipType === 'primary');
  
  if (activeMembership && activeMembership.club) {
      if (activeMembership.club.code) {
          club = activeMembership.club;
      } else {
           // Fetch full club if code missing? (populated?)
           // populate('memberships.club') should give us the doc
           club = activeMembership.club;
      }
  }

  // If no active, use most recent
  if (!club && athlete.memberships.length > 0) {
      // Sort memberships by date desc?
      // For now just pick the last one
      const lastMembership = athlete.memberships[athlete.memberships.length - 1];
       if (lastMembership.club) {
          club = lastMembership.club;
      }
  }

  if (!club || !club.code) {
      console.warn(`[SKIP] No club/code found for athlete: ${athlete.firstName} ${athlete.lastName} (${licenseNumber})`);
      return;
  }

  const clubCode = club.code;
  const clubDir = path.join(DEST_DIR, clubCode);
  
  await ensureDir(clubDir);

  const srcPath = path.join(IMPORT_DIR, filename);
  const ext = path.parse(filename).ext;
  const destFilename = `${licenseNumber}${ext}`;
  const destPath = path.join(clubDir, destFilename);

  // Move file
  await fs.rename(srcPath, destPath);

  // Update Athlete DB using updateOne to bypass full validation of legacy data
  const relativePath = path.relative(path.join(__dirname, ".."), destPath).replace(/\\/g, "/");
  const url = `/${relativePath}`;

  const photoDoc = {
      url: url,
      storagePath: relativePath,
      fileName: destFilename,
      status: "approved",
      verifiedAt: new Date(),
      note: "Bulk imported from legacy photos"
  };

  await Athlete.updateOne(
      { _id: athlete._id },
      { $set: { "documents.photo": photoDoc } }
  );

  console.log(`[SUCCESS] Imported photo for ${athlete.firstName} ${athlete.lastName} (${clubCode}) -> ${destPath}`);
};

export const importPhotos = async ({ useExistingConnection = false } = {}) => {
  if (!useExistingConnection) {
    await connectDB();
  }
  
  await ensureDir(IMPORT_DIR);
  await ensureDir(DEST_DIR);

  console.log(`Scanning import directory: ${IMPORT_DIR}`);
  
  const results = { processed: 0, errors: [] };

  try {
      const files = await fs.readdir(IMPORT_DIR);
      
      for (const file of files) {
          if (file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".png") || file.toLowerCase().endsWith(".jpeg")) {
              await processFile(file);
              results.processed++;
          }
      }
      
      console.log(`Finished processing ${results.processed} files.`);

  } catch (err) {
      console.error("Error scanning directory:", err);
      results.errors.push(err.message);
  }

  if (!useExistingConnection) {
      process.exit();
  }
  
  return results;
};

// Check if running directly (CLI)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
    importPhotos({ useExistingConnection: false });
}
