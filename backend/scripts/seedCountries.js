/**
 * Seed the Country collection with nations relevant to TRF international events.
 *
 * Usage:
 *   node scripts/seedCountries.js
 *
 * Idempotent: upserts by `code` (ISO 3166-1 alpha-3). Re-runnable safely.
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Country from "../Models/countryModel.js";

dotenv.config({ path: "./.env" });

// Tunisia first (owning federation), then African / Arab / Mediterranean /
// major rowing nations. Names follow the trilingual (EN/FR/AR) pattern.
const COUNTRIES = [
  {
    code: "TUN",
    codeAlpha2: "TN",
    iocCode: "TUN",
    names: { en: "Tunisia", fr: "Tunisie", ar: "تونس" },
    federationCode: "FTTA",
    federationNames: {
      en: "Tunisian Rowing Federation",
      fr: "Fédération Tunisienne d'Aviron",
      ar: "الجامعة التونسية للتجديف",
    },
    isTrf: true,
    sortOrder: 0,
  },
  // --- North Africa ---
  { code: "DZA", codeAlpha2: "DZ", iocCode: "ALG", names: { en: "Algeria", fr: "Algérie", ar: "الجزائر" }, sortOrder: 10 },
  { code: "EGY", codeAlpha2: "EG", iocCode: "EGY", names: { en: "Egypt", fr: "Égypte", ar: "مصر" }, sortOrder: 11 },
  { code: "LBY", codeAlpha2: "LY", iocCode: "LBA", names: { en: "Libya", fr: "Libye", ar: "ليبيا" }, sortOrder: 12 },
  { code: "MAR", codeAlpha2: "MA", iocCode: "MAR", names: { en: "Morocco", fr: "Maroc", ar: "المغرب" }, sortOrder: 13 },
  // --- West Africa (incl. OaaS-relevant) ---
  { code: "TOGO", codeAlpha2: "TG", iocCode: "TOG", names: { en: "Togo", fr: "Togo", ar: "توغو" }, sortOrder: 20 },
  { code: "NGA", codeAlpha2: "NG", iocCode: "NGR", names: { en: "Nigeria", fr: "Nigéria", ar: "نيجيريا" }, sortOrder: 21 },
  { code: "SEN", codeAlpha2: "SN", iocCode: "SEN", names: { en: "Senegal", fr: "Sénégal", ar: "السنغال" }, sortOrder: 22 },
  { code: "CIV", codeAlpha2: "CI", iocCode: "CIV", names: { en: "Côte d'Ivoire", fr: "Côte d'Ivoire", ar: "ساحل العاج" }, sortOrder: 23 },
  { code: "GHA", codeAlpha2: "GH", iocCode: "GHA", names: { en: "Ghana", fr: "Ghana", ar: "غانا" }, sortOrder: 24 },
  { code: "CMR", codeAlpha2: "CM", iocCode: "CMR", names: { en: "Cameroon", fr: "Cameroun", ar: "الكاميرون" }, sortOrder: 25 },
  // --- East Africa ---
  { code: "KEN", codeAlpha2: "KE", iocCode: "KEN", names: { en: "Kenya", fr: "Kenya", ar: "كينيا" }, sortOrder: 30 },
  { code: "UGA", codeAlpha2: "UG", iocCode: "UGA", names: { en: "Uganda", fr: "Ouganda", ar: "أوغندا" }, sortOrder: 31 },
  { code: "ETH", codeAlpha2: "ET", iocCode: "ETH", names: { en: "Ethiopia", fr: "Éthiopie", ar: "إثيوبيا" }, sortOrder: 32 },
  { code: "TZA", codeAlpha2: "TZ", iocCode: "TAN", names: { en: "Tanzania", fr: "Tanzanie", ar: "تنزانيا" }, sortOrder: 33 },
  // --- Arab world ---
  { code: "SAU", codeAlpha2: "SA", iocCode: "KSA", names: { en: "Saudi Arabia", fr: "Arabie saoudite", ar: "السعودية" }, sortOrder: 40 },
  { code: "QAT", codeAlpha2: "QA", iocCode: "QAT", names: { en: "Qatar", fr: "Qatar", ar: "قطر" }, sortOrder: 41 },
  { code: "UAE", codeAlpha2: "AE", iocCode: "UAE", names: { en: "United Arab Emirates", fr: "Émirats arabes unis", ar: "الإمارات" }, sortOrder: 42 },
  { code: "JOR", codeAlpha2: "JO", iocCode: "JOR", names: { en: "Jordan", fr: "Jordanie", ar: "الأردن" }, sortOrder: 43 },
  { code: "IRQ", codeAlpha2: "IQ", iocCode: "IRQ", names: { en: "Iraq", fr: "Irak", ar: "العراق" }, sortOrder: 44 },
  // --- Mediterranean ---
  { code: "FRA", codeAlpha2: "FR", iocCode: "FRA", names: { en: "France", fr: "France", ar: "فرنسا" }, sortOrder: 50 },
  { code: "ITA", codeAlpha2: "IT", iocCode: "ITA", names: { en: "Italy", fr: "Italie", ar: "إيطاليا" }, sortOrder: 51 },
  { code: "ESP", codeAlpha2: "ES", iocCode: "ESP", names: { en: "Spain", fr: "Espagne", ar: "إسبانيا" }, sortOrder: 52 },
  { code: "PRT", codeAlpha2: "PT", iocCode: "POR", names: { en: "Portugal", fr: "Portugal", ar: "البرتغال" }, sortOrder: 53 },
  { code: "GRC", codeAlpha2: "GR", iocCode: "GRE", names: { en: "Greece", fr: "Grèce", ar: "اليونان" }, sortOrder: 54 },
  { code: "TUR", codeAlpha2: "TR", iocCode: "TUR", names: { en: "Turkey", fr: "Turquie", ar: "تركيا" }, sortOrder: 55 },
  { code: "MLT", codeAlpha2: "MT", iocCode: "MLT", names: { en: "Malta", fr: "Malte", ar: "مالطا" }, sortOrder: 56 },
  // --- Major rowing nations ---
  { code: "GBR", codeAlpha2: "GB", iocCode: "GBR", names: { en: "United Kingdom", fr: "Royaume-Uni", ar: "المملكة المتحدة" }, sortOrder: 60 },
  { code: "DEU", codeAlpha2: "DE", iocCode: "GER", names: { en: "Germany", fr: "Allemagne", ar: "ألمانيا" }, sortOrder: 61 },
  { code: "NLD", codeAlpha2: "NL", iocCode: "NED", names: { en: "Netherlands", fr: "Pays-Bas", ar: "هولندا" }, sortOrder: 62 },
  { code: "USA", codeAlpha2: "US", iocCode: "USA", names: { en: "United States", fr: "États-Unis", ar: "الولايات المتحدة" }, sortOrder: 63 },
  { code: "AUS", codeAlpha2: "AU", iocCode: "AUS", names: { en: "Australia", fr: "Australie", ar: "أستراليا" }, sortOrder: 64 },
  { code: "NZL", codeAlpha2: "NZ", iocCode: "NZL", names: { en: "New Zealand", fr: "Nouvelle-Zélande", ar: "نيوزيلندا" }, sortOrder: 65 },
  { code: "CAN", codeAlpha2: "CA", iocCode: "CAN", names: { en: "Canada", fr: "Canada", ar: "كندا" }, sortOrder: 66 },
  { code: "ROU", codeAlpha2: "RO", iocCode: "ROU", names: { en: "Romania", fr: "Roumanie", ar: "رومانيا" }, sortOrder: 67 },
];

const seedCountries = async () => {
  await connectDB();

  let created = 0;
  let updated = 0;

  for (const data of COUNTRIES) {
    const existing = await Country.findOne({ code: data.code });
    if (existing) {
      // Update known fields but keep user-managed ones (flagUrl etc.)
      Object.assign(existing, {
        codeAlpha2: data.codeAlpha2 ?? existing.codeAlpha2,
        iocCode: data.iocCode ?? existing.iocCode,
        names: { ...existing.names?.toObject?.() ?? {}, ...data.names },
        federationCode: data.federationCode ?? existing.federationCode,
        federationNames: data.federationNames
          ? { ...existing.federationNames?.toObject?.() ?? {}, ...data.federationNames }
          : existing.federationNames,
        isTrf: data.isTrf ?? existing.isTrf,
        sortOrder: data.sortOrder ?? existing.sortOrder,
      });
      await existing.save();
      updated += 1;
    } else {
      await Country.create(data);
      created += 1;
    }
  }

  console.log(
    `✓ Country seed complete — ${created} created, ${updated} updated (total: ${COUNTRIES.length})`
  );
};

seedCountries()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
