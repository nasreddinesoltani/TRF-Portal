/**
 * Ranking System Presets
 *
 * Pre-configured ranking systems for common competition types.
 * These can be seeded to the database or used as templates.
 *
 * KEY CONCEPTS:
 * - entityType: "club" = clubs collect points, "athlete" = individual ranking
 * - boatClassFilter: "all" = all boats, "skiff_only" = only single-person boats
 * - groupBy: how to group results (gender, category, category_gender)
 */

export const RANKING_PRESETS = {
  /**
   * Club Ranking by Gender (Men's Cup / Women's Cup)
   * - All categories combined per gender
   * - Clubs collect all points from their athletes
   * - All boat classes count
   */
  CLUB_BY_GENDER: {
    code: "CLUB_BY_GENDER",
    names: {
      en: "Club Ranking by Gender",
      fr: "Classement Club par Genre",
      ar: "ترتيب النوادي حسب الجنس",
    },
    description:
      "Men's Cup / Women's Cup - Clubs collect points from all their athletes across all categories and boat classes.",
    groupBy: "gender",
    entityType: "club",
    boatClassFilter: "all",
    includeMastersDefault: true,
    discipline: null,
    journeyMode: "all",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "more_second_places" },
      { priority: 3, method: "total_time" },
      { priority: 4, method: "alphabetical" },
    ],
    showTimeDeltas: false,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 1,
  },

  /**
   * Club Ranking by Category+Gender
   * - Each category+gender separate (Junior Men, Senior Women, etc.)
   * - Clubs collect all points from their athletes (skiff + double + quad)
   */
  CLUB_BY_CATEGORY_GENDER: {
    code: "CLUB_BY_CAT_GENDER",
    names: {
      en: "Club Ranking by Category",
      fr: "Classement Club par Catégorie",
      ar: "ترتيب النوادي حسب الفئة",
    },
    description:
      "Junior Men, Senior Women, etc. - Clubs collect all boat class points within each category+gender group.",
    groupBy: "category_gender",
    entityType: "club",
    boatClassFilter: "all",
    includeMastersDefault: true,
    discipline: null,
    journeyMode: "all",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "more_second_places" },
      { priority: 3, method: "total_time" },
      { priority: 4, method: "alphabetical" },
    ],
    showTimeDeltas: true,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 2,
  },

  /**
   * Athlete Ranking by Category (for qualification)
   * - Each category+gender separate
   * - Individual athletes ranked
   * - SKIFF ONLY - doubles/quads don't count (those points go to boat/club)
   */
  ATHLETE_BY_CATEGORY: {
    code: "ATHLETE_BY_CAT",
    names: {
      en: "Athlete Ranking (Skiff only)",
      fr: "Classement Athlète (Skiff uniquement)",
      ar: "ترتيب الرياضيين (سكيف فقط)",
    },
    description:
      "Individual athlete ranking for qualification. Only skiff (1-person) boat results count.",
    groupBy: "category_gender",
    entityType: "athlete",
    boatClassFilter: "skiff_only",
    includeMastersDefault: true,
    discipline: null,
    journeyMode: "all",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "more_second_places" },
      { priority: 3, method: "total_time" },
      { priority: 4, method: "alphabetical" },
    ],
    showTimeDeltas: true,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 3,
  },

  /**
   * Club Ranking by Category (both genders combined)
   * - Senior, Junior, Cadet, etc. (men + women together)
   * - Clubs collect all points
   */
  CLUB_BY_CATEGORY: {
    code: "CLUB_BY_CATEGORY",
    names: {
      en: "Club Ranking by Age Category",
      fr: "Classement Club par Catégorie d'âge",
      ar: "ترتيب النوادي حسب فئة العمر",
    },
    description:
      "Senior Cup, Junior Cup, etc. - Both genders combined within each age category.",
    groupBy: "category",
    entityType: "club",
    boatClassFilter: "all",
    includeMastersDefault: true,
    discipline: null,
    journeyMode: "all",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "more_second_places" },
      { priority: 3, method: "total_time" },
      { priority: 4, method: "alphabetical" },
    ],
    showTimeDeltas: false,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 4,
  },

  /**
   * Beach Medal Ranking by Category
   * - Senior, Junior, Cadet, etc. (men + women together)
   * - Counts medals (gold/silver/bronze) instead of points
   * - Sorted by most golds, then silvers, then bronzes (like Olympic medal table)
   */
  BEACH_MEDALS: {
    code: "BEACH_MEDALS",
    names: {
      en: "Beach Medals by Category",
      fr: "Médailles Beach par Catégorie",
      ar: "ميداليات الشاطئ حسب الفئة",
    },
    description:
      "Medal count ranking for beach competitions. Sorted by gold medals, then silver, then bronze.",
    groupBy: "category",
    entityType: "club",
    boatClassFilter: "all",
    scoringMode: "medals",
    includeMastersDefault: true,
    discipline: "beach",
    journeyMode: "all",
    maxScoringPosition: 3, // Only top 3 get medals
    dnfGetsPointsIfFewFinishers: false,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "more_second_places" },
      { priority: 3, method: "total_time" },
      { priority: 4, method: "alphabetical" },
    ],
    showTimeDeltas: false,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 5,
  },
};

/**
 * Get all preset ranking systems
 * @returns {Array} Array of preset configurations
 */
export function getAllPresets() {
  return Object.values(RANKING_PRESETS);
}

/**
 * Get a specific preset by code
 * @param {string} code - Preset code (e.g., "CLASSIC_CUP")
 * @returns {object|null} Preset configuration or null
 */
export function getPresetByCode(code) {
  return RANKING_PRESETS[code] || null;
}

/**
 * Get presets for a specific discipline
 * @param {string} discipline - Discipline name
 * @returns {Array} Matching presets
 */
export function getPresetsForDiscipline(discipline) {
  return Object.values(RANKING_PRESETS).filter(
    (preset) => preset.discipline === discipline || preset.discipline === null
  );
}

export default RANKING_PRESETS;
