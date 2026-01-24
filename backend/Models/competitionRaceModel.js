import mongoose from "mongoose";

export const RACE_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

// Lane result statuses:
// ok  - Finished normally
// dns - Did Not Start (was at the start line but didn't start)
// dnf - Did Not Finish (started but didn't complete)
// dsq - Disqualified
// abs - Absent (did not show up at all)
export const LANE_RESULT_STATUSES = ["ok", "dns", "dnf", "dsq", "abs"];

const laneResultSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: LANE_RESULT_STATUSES,
      default: "ok",
    },
    finishPosition: {
      type: Number,
      min: 1,
    },
    elapsedMs: {
      type: Number,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const laneAssignmentSchema = new mongoose.Schema(
  {
    lane: {
      type: Number,
      required: true,
      min: 1,
      // No max here - discipline-specific limits enforced in controller
      // classic/coastal: 8, beach: 4, indoor: 50
    },
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Athlete",
    },
    crew: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Athlete",
      },
    ],
    crewNumber: {
      type: Number,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    seed: {
      type: Number,
    },
    notes: {
      type: String,
      trim: true,
    },
    result: {
      type: laneResultSchema,
      default: undefined,
    },
  },
  { _id: false },
);

const raceSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    boatClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoatClass",
      index: true,
    },
    journeyIndex: {
      type: Number,
      min: 1,
      required: true,
      index: true,
    },
    sessionLabel: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    startTime: {
      type: Date,
    },
    distanceOverride: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: RACE_STATUSES,
      default: "scheduled",
      index: true,
    },
    lanes: {
      type: [laneAssignmentSchema],
      default: () => [],
      validate: {
        validator(value) {
          if (!Array.isArray(value)) {
            return false;
          }
          const seen = new Set();
          for (const lane of value) {
            if (!lane) {
              continue;
            }
            if (seen.has(lane.lane)) {
              return false;
            }
            seen.add(lane.lane);
          }
          return value.length <= 8;
        },
        message: "Lane assignments must be unique and cannot exceed 8 lanes",
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

raceSchema.index(
  { competition: 1, category: 1, journeyIndex: 1, order: 1 },
  { name: "competition_category_schedule" },
);

raceSchema.index({ competition: 1, "lanes.athlete": 1 });

const CompetitionRace = mongoose.model("CompetitionRace", raceSchema);

export default CompetitionRace;
