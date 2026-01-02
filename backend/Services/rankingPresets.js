/**
 * Ranking System Presets
 *
 * Pre-configured ranking systems for common competition types.
 * These can be seeded to the database or used as templates.
 */

export const RANKING_PRESETS = {
  /**
   * Classic Cup - Groups by Gender
   *
   * Men's Cup: All male categories combined (Senior Men, Junior Men, Cadet Men, etc.)
   * Women's Cup: All female categories combined
   *
   * Points go to: Clubs (all boat types)
   * All journeys count
   */
  CLASSIC_CUP: {
    code: "CLASSIC_CUP",
    names: {
      en: "Classic Cup",
      fr: "Coupe Classique",
      ar: "الكأس الكلاسيكية",
    },
    description:
      "Groups all categories by gender for Men's Cup and Women's Cup rankings - Points go to clubs",
    groupBy: "gender",
    discipline: "classic",
    journeyMode: "all",
    pointMode: "crew_club",
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
   * Beach Cup - Groups by Age Category
   *
   * Each age category has its own ranking (Senior Cup, Junior Cup, Cadet Cup, etc.)
   * Combines both genders within each category
   *
   * Points go to: Athletes for skiffs, Clubs for crews
   * All journeys count
   */
  BEACH_CUP: {
    code: "BEACH_CUP",
    names: {
      en: "Beach Cup",
      fr: "Coupe de Beach",
      ar: "كأس الشاطئ",
    },
    description:
      "Groups by age category, combining both genders within each category",
    groupBy: "category",
    discipline: "beach",
    journeyMode: "all",
    pointMode: "mixed",
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
    sortOrder: 2,
  },

  /**
   * Championship Category - Groups by Category + Gender
   *
   * Each category + gender combination is ranked separately
   * Example: Senior Men, Senior Women, Junior Men, Junior Women, etc.
   *
   * Points go to: Athletes for skiffs, Clubs for crews
   * Final journey only counts
   */
  CHAMPIONSHIP_CATEGORY: {
    code: "CHAMPIONSHIP_CAT",
    names: {
      en: "Championship by Category",
      fr: "Championnat par Catégorie",
      ar: "البطولة حسب الفئة",
    },
    description:
      "Each category + gender combination ranked separately, final results only",
    groupBy: "category_gender",
    discipline: null, // Applies to all disciplines
    journeyMode: "final_only",
    pointMode: "mixed",
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "total_time" },
      { priority: 2, method: "more_first_places" },
      { priority: 3, method: "alphabetical" },
    ],
    showTimeDeltas: true,
    showTotalTime: true,
    isPreset: true,
    isActive: true,
    sortOrder: 3,
  },

  /**
   * Coastal Cup - Similar to Classic but for Coastal discipline
   *
   * Groups by gender like Classic Cup but for coastal races
   */
  COASTAL_CUP: {
    code: "COASTAL_CUP",
    names: {
      en: "Coastal Cup",
      fr: "Coupe Coastal",
      ar: "كأس الساحل",
    },
    description: "Coastal discipline cup with gender-based grouping",
    groupBy: "gender",
    discipline: "coastal",
    journeyMode: "all",
    pointMode: "mixed",
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
   * Club Championship - Points go to clubs only
   *
   * All points attributed to clubs regardless of boat type
   * Groups by gender
   */
  CLUB_CHAMPIONSHIP: {
    code: "CLUB_CHAMP",
    names: {
      en: "Club Championship",
      fr: "Championnat des Clubs",
      ar: "بطولة الأندية",
    },
    description: "All points go to clubs, grouped by gender",
    groupBy: "gender",
    discipline: null,
    journeyMode: "all",
    pointMode: "crew_club", // Always club points
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
    sortOrder: 5,
  },

  /**
   * Athlete Championship - Points go to athletes only
   *
   * All points attributed to individual athletes
   * Groups by category + gender
   */
  ATHLETE_CHAMPIONSHIP: {
    code: "ATHLETE_CHAMP",
    names: {
      en: "Athlete Championship",
      fr: "Championnat des Athlètes",
      ar: "بطولة الرياضيين",
    },
    description:
      "All points go to individual athletes, grouped by category + gender",
    groupBy: "category_gender",
    discipline: null,
    journeyMode: "all",
    pointMode: "skiff_athlete", // Always athlete points
    maxScoringPosition: 8,
    dnfGetsPointsIfFewFinishers: true,
    tieBreakers: [
      { priority: 1, method: "more_first_places" },
      { priority: 2, method: "total_time" },
      { priority: 3, method: "alphabetical" },
    ],
    showTimeDeltas: false,
    showTotalTime: false,
    isPreset: true,
    isActive: true,
    sortOrder: 6,
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
