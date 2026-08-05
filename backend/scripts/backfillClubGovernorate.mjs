/**
 * Backfill the `governorate` field on existing clubs by mapping their `city`
 * (or Arabic name) to a Tunisian governorate.
 *
 * Usage:
 *   node backend/scripts/backfillClubGovernorate.mjs          # apply changes
 *   node backend/scripts/backfillClubGovernorate.mjs --dry    # preview only
 *
 * Clubs that cannot be resolved automatically are listed at the end so an
 * admin can set them manually from the club form.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import Club from "../Models/clubModel.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry");

// Canonical governorate names (Arabic) keyed by lowercase search tokens.
// Tokens can be city names, Arabic city names, or common spellings that may
// appear in a club's `city` field or Arabic name.
const GOVERNORATE_BY_TOKEN = {
  // Tunis
  tunis: "تونس",
  تونس: "تونس",
  "le kram": "تونس",
  carthage: "تونس",
  قرطاج: "تونس",
  // Ariana
  ariana: "أريانة",
  أريانة: "أريانة",
  // Ben Arous
  "ben arous": "بن عروس",
  "بن عروس": "بن عروس",
  rades: "بن عروس",
  رادس: "بن عروس",
  // Manouba
  manouba: "منوبة",
  منوبة: "منوبة",
  // Bizerte
  bizerte: "بنزرت",
  بنزرت: "بنزرت",
  // Nabeul
  nabeul: "نابل",
  نابل: "نابل",
  hammamet: "نابل",
  الحمامات: "نابل",
  kelibia: "نابل",
  قليبية: "نابل",
  // Sousse
  sousse: "سوسة",
  سوسة: "سوسة",
  // Monastir
  monastir: "المنستير",
  المنستير: "المنستير",
  // Mahdia
  mahdia: "المهدية",
  المهدية: "المهدية",
  // Sfax
  sfax: "صفاقس",
  صفاقس: "صفاقس",
  kerkennah: "صفاقس",
  قرقنة: "صفاقس",
  // Gabes
  gabes: "قابس",
  gabès: "قابس",
  قابس: "قابس",
  // Medenine
  medenine: "مدنين",
  مدنين: "مدنين",
  djerba: "مدنين",
  جربة: "مدنين",
  زرزيس: "مدنين",
  zarzis: "مدنين",
  // Jendouba
  jendouba: "جندوبة",
  جندوبة: "جندوبة",
  tabarka: "جندوبة",
  طبرقة: "جندوبة",
  // Beja
  beja: "باجة",
  béja: "باجة",
  باجة: "باجة",
  // Kairouan
  kairouan: "القيروان",
  القيروان: "القيروان",
  // Gafsa
  gafsa: "قفصة",
  قفصة: "قفصة",
  // Tozeur
  tozeur: "توزر",
  توزر: "توزر",
  // Kebili
  kebili: "قبلي",
  قبلي: "قبلي",
};

const resolveGovernorate = (club) => {
  const haystacks = [club.city, club.nameAr, club.name]
    .filter(Boolean)
    .map((value) => value.toString().toLowerCase());

  for (const [token, governorate] of Object.entries(GOVERNORATE_BY_TOKEN)) {
    if (haystacks.some((h) => h.includes(token.toLowerCase()))) {
      return governorate;
    }
  }
  return null;
};

const run = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGO_URI/MONGODB_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB${DRY_RUN ? " (dry run)" : ""}.`);

  const clubs = await Club.find({}).select("name nameAr city governorate");
  let updated = 0;
  const unresolved = [];

  for (const club of clubs) {
    if (club.governorate) {
      continue; // already set
    }
    const governorate = resolveGovernorate(club);
    if (!governorate) {
      unresolved.push(club.name);
      continue;
    }

    console.log(`  ${club.name} -> ${governorate}`);
    if (!DRY_RUN) {
      club.governorate = governorate;
      await club.save();
    }
    updated += 1;
  }

  console.log(`\n${DRY_RUN ? "Would update" : "Updated"} ${updated} club(s).`);
  if (unresolved.length) {
    console.log(
      `\n${unresolved.length} club(s) need manual governorate assignment:`,
    );
    unresolved.forEach((name) => console.log(`  - ${name}`));
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
