import mongoose from "mongoose";

/**
 * Ranking System Model
 *
 * Configurable ranking systems for different competition types.
 * Examples:
 * - CLASSIC_CUP: Group by gender (Men's Cup, Women's Cup)
 * - BEACH_CUP: Group by age category
 * - CHAMPIONSHIP: Group by category + gender
 */

// How to group results for ranking
export const GROUP_BY_OPTIONS = [
  "gender", // Men's Cup, Women's Cup (combines all age categories per gender)
  "category", // Each age category ranked separately (e.g., Senior, Junior, Cadet)
  "category_gender", // Each category + gender combination (e.g., Senior Men, Senior Women)
];

// Which journeys to count
export const JOURNEY_MODE_OPTIONS = [
  "all", // All journeys count toward ranking
  "final_only", // Only final journey results count
  "best_n", // Best N results count (requires bestNCount field)
];

// Point attribution mode
export const POINT_MODE_OPTIONS = [
  "skiff_athlete", // Skiff (1-person) boats: points go to athlete
  "crew_club", // Crew boats: points go to club
  "mixed", // Automatic based on crewSize: skiff → athlete, crew → club
];

// Standard point table (position → points)
export const DEFAULT_POINT_TABLE = {
  1: 20,
  2: 12,
  3: 8,
  4: 6,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
  // 9+ = 0 points
};

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
    ar: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// Tie-breaker rules (in order of priority)
const tieBreakerSchema = new mongoose.Schema(
  {
    priority: { type: Number, required: true, min: 1 },
    method: {
      type: String,
      enum: [
        "total_time", // Lower total time wins
        "best_time", // Best single time wins
        "more_first_places", // More 1st places wins
        "more_second_places", // Then more 2nd places, etc.
        "head_to_head", // Direct comparison in shared races
        "alphabetical", // Last resort: alphabetical by name
      ],
      required: true,
    },
  },
  { _id: false }
);

// Custom point table entry
const pointTableEntrySchema = new mongoose.Schema(
  {
    position: { type: Number, required: true, min: 1 },
    points: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const rankingSystemSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    names: {
      type: localizedNameSchema,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // === Grouping Configuration ===
    groupBy: {
      type: String,
      enum: GROUP_BY_OPTIONS,
      required: true,
    },

    // === Boat Class Filter ===
    // If empty, all boat classes are included
    // If specified, only these boat classes count toward this ranking
    allowedBoatClasses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BoatClass",
      },
    ],

    // === Discipline Filter ===
    // If specified, only competitions of this discipline use this ranking
    discipline: {
      type: String,
      enum: ["classic", "coastal", "beach", "indoor", null],
      default: null,
    },

    // === Journey Configuration ===
    journeyMode: {
      type: String,
      enum: JOURNEY_MODE_OPTIONS,
      default: "all",
    },
    bestNCount: {
      type: Number,
      min: 1,
      default: null, // Only used when journeyMode = "best_n"
    },

    // === Point Attribution ===
    pointMode: {
      type: String,
      enum: POINT_MODE_OPTIONS,
      default: "mixed",
    },

    // === Point Table ===
    // Custom point table (overrides DEFAULT_POINT_TABLE)
    customPointTable: {
      type: [pointTableEntrySchema],
      default: () => [],
    },

    // Maximum position that earns points (0 = unlimited, use point table)
    maxScoringPosition: {
      type: Number,
      default: 8,
      min: 0,
    },

    // === DNF Special Rules ===
    // DNF gets points only if fewer than maxScoringPosition boats finished
    // DNF shares position after last finisher
    dnfGetsPointsIfFewFinishers: {
      type: Boolean,
      default: true,
    },

    // === Qualifying Rules ===
    // Top N crews qualify for final/next stage
    qualifyTopN: {
      type: Number,
      default: null, // null = no qualification limit
      min: 1,
    },

    // === Tie-Breaker Rules ===
    tieBreakers: {
      type: [tieBreakerSchema],
      default: () => [
        { priority: 1, method: "more_first_places" },
        { priority: 2, method: "more_second_places" },
        { priority: 3, method: "total_time" },
        { priority: 4, method: "alphabetical" },
      ],
    },

    // === Display Options ===
    showTimeDeltas: {
      type: Boolean,
      default: true,
    },
    showTotalTime: {
      type: Boolean,
      default: false, // Usually false for point-based rankings
    },

    // === System Fields ===
    isPreset: {
      type: Boolean,
      default: false, // true for built-in presets like CLASSIC_CUP
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to get effective point table (custom or default)
rankingSystemSchema.virtual("effectivePointTable").get(function () {
  if (this.customPointTable && this.customPointTable.length > 0) {
    const table = {};
    this.customPointTable.forEach((entry) => {
      table[entry.position] = entry.points;
    });
    return table;
  }
  return DEFAULT_POINT_TABLE;
});

// Helper method to get points for a position
rankingSystemSchema.methods.getPointsForPosition = function (position) {
  if (!position || position < 1) return 0;
  const table = this.effectivePointTable;
  return table[position] || 0;
};

// Helper method to check if a boat class is allowed
rankingSystemSchema.methods.isBoatClassAllowed = function (boatClassId) {
  if (!this.allowedBoatClasses || this.allowedBoatClasses.length === 0) {
    return true; // All allowed if none specified
  }
  return this.allowedBoatClasses.some(
    (bc) => bc.toString() === boatClassId.toString()
  );
};

// Note: code index is already created by unique: true on the field
rankingSystemSchema.index({ discipline: 1, isActive: 1 });

const RankingSystem = mongoose.model("RankingSystem", rankingSystemSchema);
export default RankingSystem;
