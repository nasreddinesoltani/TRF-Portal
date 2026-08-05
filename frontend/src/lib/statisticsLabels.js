// Multilingual labels for the License Statistics report (AR / FR / EN).
// Category names come from the API (category.titles), governorate names are
// stored in Arabic on the club; everything else is translated here.

export const STAT_LANGUAGES = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
];

export const STAT_LABELS = {
  ar: {
    reportTitle: "إحصائيات المجازين",
    federation: "الجامعة التونسية للتجذيف",
    season: "الموسم",
    club: "النادي",
    governorate: "الولاية",
    category: "الصنف",
    male: "ذكور",
    female: "إناث",
    total: "المجموع",
    percent: "النسبة",
    grandTotal: "المجموع العام",
    byCategory: "الإحصائيات حسب الصنف",
    byGovernorate: "الإحصائيات حسب الولاية",
    byClub: "الإحصائيات حسب النادي",
    generatedOn: "تاريخ الإصدار",
    exportPdf: "تصدير PDF",
    noData: "لا توجد بيانات",
    uncategorized: "غير مصنف",
    unknownGovernorate: "غير محدد",
  },
  fr: {
    reportTitle: "Statistiques des licences",
    federation: "Fédération Tunisienne d'Aviron",
    season: "Saison",
    club: "Club",
    governorate: "Gouvernorat",
    category: "Catégorie",
    male: "Hommes",
    female: "Femmes",
    total: "Total",
    percent: "%",
    grandTotal: "Total général",
    byCategory: "Statistiques par catégorie",
    byGovernorate: "Statistiques par gouvernorat",
    byClub: "Statistiques par club",
    generatedOn: "Généré le",
    exportPdf: "Exporter en PDF",
    noData: "Aucune donnée",
    uncategorized: "Non classé",
    unknownGovernorate: "Non défini",
  },
  en: {
    reportTitle: "License Statistics",
    federation: "Tunisian Rowing Federation",
    season: "Season",
    club: "Club",
    governorate: "Governorate",
    category: "Category",
    male: "Male",
    female: "Female",
    total: "Total",
    percent: "%",
    grandTotal: "Grand Total",
    byCategory: "Statistics by Category",
    byGovernorate: "Statistics by Governorate",
    byClub: "Statistics by Club",
    generatedOn: "Generated on",
    exportPdf: "Export PDF",
    noData: "No data",
    uncategorized: "Uncategorized",
    unknownGovernorate: "Undefined",
  },
};

/**
 * All 24 Tunisian governorates with Arabic, French, and English names.
 * The Arabic key is what is stored on the club document; the FR/EN values
 * are used for display in the license statistics report and PDF export.
 */
export const GOVERNORATE_NAMES = {
  تونس: { ar: "تونس", fr: "Tunis", en: "Tunis" },
  أريانة: { ar: "أريانة", fr: "Ariana", en: "Ariana" },
  "بن عروس": { ar: "بن عروس", fr: "Ben Arous", en: "Ben Arous" },
  منوبة: { ar: "منوبة", fr: "Manouba", en: "Manouba" },
  نابل: { ar: "نابل", fr: "Nabeul", en: "Nabeul" },
  زغوان: { ar: "زغوان", fr: "Zaghouan", en: "Zaghouan" },
  بنزرت: { ar: "بنزرت", fr: "Bizerte", en: "Bizerte" },
  باجة: { ar: "باجة", fr: "Béja", en: "Beja" },
  جندوبة: { ar: "جندوبة", fr: "Jendouba", en: "Jendouba" },
  الكاف: { ar: "الكاف", fr: "Le Kef", en: "Le Kef" },
  سليانة: { ar: "سليانة", fr: "Siliana", en: "Siliana" },
  القيروان: { ar: "القيروان", fr: "Kairouan", en: "Kairouan" },
  القصرين: { ar: "القصرين", fr: "Kasserine", en: "Kasserine" },
  "سيدي بوزيد": { ar: "سيدي بوزيد", fr: "Sidi Bouzid", en: "Sidi Bouzid" },
  سوسة: { ar: "سوسة", fr: "Sousse", en: "Sousse" },
  المنستير: { ar: "المنستير", fr: "Monastir", en: "Monastir" },
  المهدية: { ar: "المهدية", fr: "Mahdia", en: "Mahdia" },
  صفاقس: { ar: "صفاقس", fr: "Sfax", en: "Sfax" },
  قفصة: { ar: "قفصة", fr: "Gafsa", en: "Gafsa" },
  توزر: { ar: "توزر", fr: "Tozeur", en: "Tozeur" },
  قبلي: { ar: "قبلي", fr: "Kebili", en: "Kebili" },
  قابس: { ar: "قابس", fr: "Gabès", en: "Gabes" },
  مدنين: { ar: "مدنين", fr: "Médenine", en: "Medenine" },
  تطاوين: { ar: "تطاوين", fr: "Tataouine", en: "Tataouine" },
};

/**
 * Return the governorate display name for the requested language.
 * Falls back through FR → EN → the raw input string.
 */
export const governorateLabel = (govName, lang) => {
  if (!govName) return "";
  const entry = GOVERNORATE_NAMES[govName];
  if (!entry) return govName;
  return entry[lang] || entry.fr || entry.en || entry.ar || govName;
};

// Resolve a category's display title for the selected language, with fallback.
export const categoryTitle = (category, lang) => {
  if (!category) return "";
  const titles = category.titles || {};
  return (
    titles[lang] ||
    titles.en ||
    titles.fr ||
    titles.ar ||
    category.abbreviation ||
    ""
  );
};

// Resolve a club's display name for the selected language.
export const clubName = (club, lang) => {
  if (!club) return "";
  if (lang === "ar") {
    return club.nameAr || club.name || "";
  }
  return club.name || club.nameAr || "";
};
