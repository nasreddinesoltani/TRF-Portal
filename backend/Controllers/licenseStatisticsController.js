import asyncHandler from "express-async-handler";
import Athlete from "../Models/athleteModel.js";
import Club from "../Models/clubModel.js";
import Category from "../Models/categoryModel.js";
import { getSeasonYear } from "../Services/categoryAssignmentService.js";

const UNCATEGORIZED_KEY = "__uncategorized__";
const UNKNOWN_GOVERNORATE = "غير محدد";

// Club display ordering used across the federation dashboards.
const CLUB_TYPE_ORDER = {
  club: 0,
  ecole_federale: 1,
  centre_de_promotion: 2,
  country: 3,
};

// @desc    Federation license statistics report (club x category x gender,
//          plus category totals and governorate totals). Mirrors the legacy
//          Excel-based "Statistiques des licences" sheet, rendered in AR/FR/EN.
// @route   GET /api/athletes/license-statistics?season=YYYY
// @access  Admin
export const getLicenseStatisticsReport = asyncHandler(async (req, res) => {
  const requestedSeason = Number.parseInt(req.query.season, 10);
  const season = Number.isNaN(requestedSeason)
    ? getSeasonYear()
    : requestedSeason;

  // Load the national category catalogue so we can order the columns by age
  // band and expose multilingual titles for the report.
  const allCategories = await Category.find({ type: "national" })
    .select("abbreviation titles gender minAge maxAge isPara")
    .sort({ minAge: 1, maxAge: 1 })
    .lean();

  // Excluded columns:
  //  - Masters (27+) and Under-23: those athletes are all counted as Senior.
  //  - Mixed categories: not meaningful in a gender-split report.
  //  - Para categories: para athletes are counted within their normal category.
  const isExcludedCategory = (category) => {
    if (category?.gender === "mixed") return true;
    if (category?.isPara) return true;
    const haystack = [
      category?.abbreviation,
      category?.titles?.en,
      category?.titles?.fr,
      category?.titles?.ar,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /master|veteran|vétéran|u23|under\s*23|moins de 23|mixed|mixte|mixt|para|handi|معوق|مختلط|ماستر|كهول/.test(
      haystack,
    );
  };

  const categories = allCategories.filter(
    (category) => !isExcludedCategory(category),
  );

  // National categories are gender-specific (e.g. "Under 13 Men" and
  // "Under 13 Women" are two separate records). The report shows ONE column
  // per age band, split into Male/Female by the athlete's actual gender — so
  // we merge the men/women variants of a band into a single column and strip
  // the gender word from the displayed title.
  const stripGender = (value = "") =>
    value
      .replace(
        /\b(men|women|male|female|boys|girls|man|woman|hommes|femmes|homme|femme|garçons|filles|masculin|féminin|feminin)\b/gi,
        "",
      )
      .replace(/ذكور|إناث|ذكر|أنثى|رجال|سيدات|بنات|فتيات|آنسات/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/[\s\-/(),]+$/g, "")
      .replace(/^[\s\-/(),]+/g, "")
      .trim();

  const bandKeyOf = (category) =>
    `${category.minAge ?? 0}-${category.maxAge ?? "inf"}`;

  const bandOrder = [];
  const bandByKey = new Map();
  const abbrevToBand = new Map();

  // The column header should use the MALE noun of the category (e.g. الصغار,
  // الأواسط, الكبار — not the female الصغريات, الوسطيات, الكبريات). So when a
  // band already exists, we override its title as soon as we meet the male
  // variant of the same age band.
  const titlesFrom = (category) => ({
    ar: stripGender(category.titles?.ar || ""),
    fr: stripGender(category.titles?.fr || ""),
    en: stripGender(category.titles?.en || category.abbreviation),
  });
  const isMaleCategory = (category) => {
    const g = (category?.gender || "").toLowerCase();
    return g === "male" || g === "men" || g === "m";
  };

  categories.forEach((category) => {
    const key = bandKeyOf(category);
    abbrevToBand.set(category.abbreviation, key);
    if (!bandByKey.has(key)) {
      const band = {
        abbreviation: key,
        minAge: category.minAge ?? 0,
        titles: titlesFrom(category),
        _titleIsMale: isMaleCategory(category),
      };
      bandByKey.set(key, band);
      bandOrder.push(band);
    } else {
      // Prefer the male variant's noun for the column header.
      const band = bandByKey.get(key);
      if (!band._titleIsMale && isMaleCategory(category)) {
        band.titles = titlesFrom(category);
        band._titleIsMale = true;
      }
    }
  });

  const categoryOrder = bandOrder;

  // Athletes counted are those holding an active/pending membership in the
  // season. We reduce to that single membership so each athlete is attributed
  // to exactly one club, and pick the national category assignment.
  const rows = await Athlete.aggregate([
    {
      $match: {
        memberships: {
          $elemMatch: { season, status: { $in: ["active", "pending"] } },
        },
      },
    },
    {
      $addFields: {
        _seasonMembership: {
          $first: {
            $filter: {
              input: "$memberships",
              as: "m",
              cond: {
                $and: [
                  { $eq: ["$$m.season", season] },
                  { $in: ["$$m.status", ["active", "pending"]] },
                ],
              },
            },
          },
        },
        _seasonAssignment: {
          $first: {
            $filter: {
              input: { $ifNull: ["$categoryAssignments", []] },
              as: "a",
              cond: {
                $and: [
                  { $eq: ["$$a.type", "national"] },
                  { $eq: ["$$a.season", season] },
                ],
              },
            },
          },
        },
      },
    },
    {
      $group: {
        _id: {
          club: "$_seasonMembership.club",
          abbreviation: "$_seasonAssignment.abbreviation",
          gender: { $toLower: { $ifNull: ["$gender", "unknown"] } },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Fetch club metadata (active only, matching dashboard club counts).
  const clubs = await Club.find({ isActive: true })
    .select("name nameAr code type governorate city")
    .lean();
  const clubMap = new Map(clubs.map((club) => [club._id.toString(), club]));

  const emptyCategoryBucket = () => {
    const bucket = {};
    categoryOrder.forEach((category) => {
      bucket[category.abbreviation] = { male: 0, female: 0 };
    });
    return bucket;
  };

  const clubStats = new Map();
  const categoryTotals = new Map(
    categoryOrder.map((category) => [
      category.abbreviation,
      { ...category, male: 0, female: 0, total: 0 },
    ]),
  );
  const governorateTotals = new Map();
  let grandMale = 0;
  let grandFemale = 0;

  rows.forEach((row) => {
    const clubId = row._id.club ? row._id.club.toString() : null;
    // Map the athlete's gender-specific category abbreviation to its merged
    // age-band key so men's and women's variants share one column.
    const abbreviation =
      abbrevToBand.get(row._id.abbreviation) ||
      row._id.abbreviation ||
      UNCATEGORIZED_KEY;
    const gender = row._id.gender === "female" ? "female" : "male";
    const count = row.count || 0;

    // Per-club aggregation
    if (clubId && clubMap.has(clubId)) {
      if (!clubStats.has(clubId)) {
        const club = clubMap.get(clubId);
        clubStats.set(clubId, {
          clubId,
          name: club.name,
          nameAr: club.nameAr || "",
          code: club.code || "",
          type: club.type || "club",
          governorate: club.governorate || "",
          city: club.city || "",
          byCategory: emptyCategoryBucket(),
          male: 0,
          female: 0,
          total: 0,
        });
      }
      const entry = clubStats.get(clubId);
      if (entry.byCategory[abbreviation]) {
        entry.byCategory[abbreviation][gender] += count;
      }
      entry[gender] += count;
      entry.total += count;
    }

    // Category totals
    if (categoryTotals.has(abbreviation)) {
      const catTotal = categoryTotals.get(abbreviation);
      catTotal[gender] += count;
      catTotal.total += count;
    }

    // Governorate totals (based on the club's governorate)
    const governorate =
      (clubId && clubMap.get(clubId)?.governorate) || UNKNOWN_GOVERNORATE;
    if (!governorateTotals.has(governorate)) {
      governorateTotals.set(governorate, {
        governorate,
        male: 0,
        female: 0,
        total: 0,
      });
    }
    const govEntry = governorateTotals.get(governorate);
    govEntry[gender] += count;
    govEntry.total += count;

    grandMale += gender === "male" ? count : 0;
    grandFemale += gender === "female" ? count : 0;
  });

  const grandTotal = grandMale + grandFemale;

  // Exclude clubs that have no governorate assigned (per user request).
  const clubsPayload = [...clubStats.values()]
    .filter((entry) => entry.governorate && entry.governorate.trim().length > 0)
    .map((entry) => ({
      ...entry,
      percent:
        grandTotal > 0 ? Math.round((entry.total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => {
      const typeA = CLUB_TYPE_ORDER[a.type] ?? 99;
      const typeB = CLUB_TYPE_ORDER[b.type] ?? 99;
      if (typeA !== typeB) return typeA - typeB;
      return b.total - a.total;
    });

  return res.json({
    season,
    generatedAt: new Date().toISOString(),
    categories: categoryOrder,
    clubs: clubsPayload,
    categoryTotals: categoryOrder.map((category) =>
      categoryTotals.get(category.abbreviation),
    ),
    governorateTotals: [...governorateTotals.values()].sort(
      (a, b) => b.total - a.total,
    ),
    grandTotal: { male: grandMale, female: grandFemale, total: grandTotal },
  });
});
