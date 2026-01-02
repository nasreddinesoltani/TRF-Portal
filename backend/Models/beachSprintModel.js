import mongoose from "mongoose";

/**
 * Beach Sprint Competition Model
 *
 * Beach Sprint uses a knockout/progression system:
 * Time Trial → (Repechage) → Quarterfinals → Semifinals → Finals → Medals
 *
 * Unlike classic rowing which uses points, Beach Sprint awards medals.
 * Club rankings are based on medal count (Gold > Silver > Bronze).
 */

// Race phases in progression order
const RACE_PHASES = [
  "time_trial", // Initial seeding race
  "repechage", // Second chance for eliminated crews
  "quarterfinal", // QF knockout round
  "semifinal", // SF knockout round
  "final_b", // B Final (typically 3rd/4th or 5th-8th)
  "final_a", // A Final (Gold/Silver)
];

// Progression rules - who advances from each phase
const PROGRESSION_RULES = {
  time_trial: {
    description: "Top N advance directly, others to repechage or eliminated",
    defaultDirectAdvance: 4, // Top 4 advance directly to QF/SF
    defaultToRepechage: 4, // Next 4 go to repechage
  },
  repechage: {
    description: "Winners advance to knockout rounds",
    defaultAdvance: 2, // Top 2 from each repechage heat advance
  },
  quarterfinal: {
    description: "Winners advance to semifinals",
    defaultAdvance: 1, // Winner advances
  },
  semifinal: {
    description: "Winners to Final A, losers to Final B",
    winnersTo: "final_a",
    losersTo: "final_b",
  },
};

// Medal types
const MEDAL_TYPES = ["gold", "silver", "bronze"];

/**
 * Beach Sprint Event Schema
 * Represents a single event category (e.g., "Senior Men 1x", "Junior Women 2x")
 */
const beachSprintEventSchema = new mongoose.Schema(
  {
    // Reference to parent competition
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
    },

    // Event details
    boatClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoatClass",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    gender: {
      type: String,
      enum: ["M", "F", "Mixed"],
      required: true,
    },

    // Event name (auto-generated or custom)
    name: {
      type: String,
      required: true,
    },

    // Progression configuration for this event
    progressionConfig: {
      hasRepechage: { type: Boolean, default: true },
      timeTrialDirectAdvance: { type: Number, default: 4 },
      timeTrialToRepechage: { type: Number, default: 4 },
      repechageAdvance: { type: Number, default: 2 },
    },

    // Current phase of the event
    currentPhase: {
      type: String,
      enum: RACE_PHASES,
      default: "time_trial",
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },

    // Medal results (populated when finals complete)
    medals: {
      gold: {
        athlete: { type: mongoose.Schema.Types.ObjectId, ref: "Athlete" },
        crew: [{ type: mongoose.Schema.Types.ObjectId, ref: "Athlete" }],
        club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
        time: String,
      },
      silver: {
        athlete: { type: mongoose.Schema.Types.ObjectId, ref: "Athlete" },
        crew: [{ type: mongoose.Schema.Types.ObjectId, ref: "Athlete" }],
        club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
        time: String,
      },
      bronze: {
        athlete: { type: mongoose.Schema.Types.ObjectId, ref: "Athlete" },
        crew: [{ type: mongoose.Schema.Types.ObjectId, ref: "Athlete" }],
        club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
        time: String,
      },
    },
  },
  { timestamps: true }
);

/**
 * Beach Sprint Race Schema
 * Individual race within an event (time trial heat, QF, SF, Final)
 */
const beachSprintRaceSchema = new mongoose.Schema(
  {
    // Reference to event
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BeachSprintEvent",
      required: true,
    },

    // Race phase
    phase: {
      type: String,
      enum: RACE_PHASES,
      required: true,
    },

    // Heat number (for phases with multiple heats)
    heatNumber: {
      type: Number,
      default: 1,
    },

    // Race identifier (e.g., "QF1", "SF2", "Final A")
    raceCode: {
      type: String,
      required: true,
    },

    // Scheduled time
    scheduledTime: Date,

    // Actual start time
    startTime: Date,

    // Race status
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },

    // Lanes/entries for this race
    lanes: [
      {
        lane: { type: Number, required: true },

        // For single sculls
        athlete: { type: mongoose.Schema.Types.ObjectId, ref: "Athlete" },

        // For crew boats
        crew: [{ type: mongoose.Schema.Types.ObjectId, ref: "Athlete" }],

        // Club
        club: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },

        // Result
        time: String, // Format: "MM:SS.cc"
        timeInMs: Number, // Time in milliseconds for sorting
        position: Number, // Finishing position
        status: {
          type: String,
          enum: ["ok", "dns", "dnf", "dsq"],
          default: "ok",
        },

        // Progression info
        advancesTo: {
          phase: String, // Next phase (e.g., "semifinal")
          raceCode: String, // Specific race (e.g., "SF1")
        },
      },
    ],

    // Notes
    notes: String,
  },
  { timestamps: true }
);

/**
 * Beach Sprint Club Standing Schema
 * Aggregated medal count for clubs in a competition
 */
const beachSprintStandingSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },

    // Medal counts
    gold: { type: Number, default: 0 },
    silver: { type: Number, default: 0 },
    bronze: { type: Number, default: 0 },

    // Total medals
    total: { type: Number, default: 0 },

    // Rank (calculated)
    rank: Number,

    // Medal details (which events)
    medalDetails: [
      {
        event: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BeachSprintEvent",
        },
        eventName: String,
        medalType: { type: String, enum: MEDAL_TYPES },
      },
    ],
  },
  { timestamps: true }
);

// Indexes
beachSprintEventSchema.index({
  competition: 1,
  boatClass: 1,
  category: 1,
  gender: 1,
});
beachSprintRaceSchema.index({ event: 1, phase: 1, heatNumber: 1 });
beachSprintStandingSchema.index({ competition: 1, club: 1 }, { unique: true });
beachSprintStandingSchema.index({
  competition: 1,
  gold: -1,
  silver: -1,
  bronze: -1,
});

// Virtual for total medals
beachSprintStandingSchema.virtual("totalMedals").get(function () {
  return this.gold + this.silver + this.bronze;
});

// Pre-save to update total
beachSprintStandingSchema.pre("save", function (next) {
  this.total = this.gold + this.silver + this.bronze;
  next();
});

// Static method to get phase display name
beachSprintRaceSchema.statics.getPhaseDisplayName = function (phase) {
  const names = {
    time_trial: "Time Trial",
    repechage: "Repechage",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    final_b: "Final B",
    final_a: "Final A",
  };
  return names[phase] || phase;
};

export const BeachSprintEvent = mongoose.model(
  "BeachSprintEvent",
  beachSprintEventSchema
);
export const BeachSprintRace = mongoose.model(
  "BeachSprintRace",
  beachSprintRaceSchema
);
export const BeachSprintStanding = mongoose.model(
  "BeachSprintStanding",
  beachSprintStandingSchema
);

export { RACE_PHASES, PROGRESSION_RULES, MEDAL_TYPES };
