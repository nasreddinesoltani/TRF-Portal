import mongoose from "mongoose";

export const COMPETITION_ENTRY_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
];

const competitionEntrySchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
      index: true,
    },
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Athlete",
      index: true,
    },
    crew: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Athlete",
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    boatClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoatClass",
    },
    crewNumber: {
      type: Number,
      default: 1,
    },
    seed: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: COMPETITION_ENTRY_STATUSES,
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    reviewerNotes: {
      type: String,
      trim: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    metadata: {
      type: Map,
      of: String,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Uniqueness is now handled in the controller to support crew boats
// competitionEntrySchema.index(
//   { competition: 1, athlete: 1 },
//   { unique: true, name: "unique_competition_athlete" }
// );

competitionEntrySchema.index({ competition: 1, club: 1, category: 1 });
competitionEntrySchema.index({ competition: 1, status: 1 });

const CompetitionEntry = mongoose.model(
  "CompetitionEntry",
  competitionEntrySchema
);

export default CompetitionEntry;
