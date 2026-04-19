import mongoose from "mongoose";

const competitionPenaltySchema = new mongoose.Schema(
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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    penaltyPoints: {
      type: Number,
      required: true,
      min: 0,
    },
    targetType: {
      type: String,
      enum: ["club", "official"],
      default: "club",
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    observations: {
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

competitionPenaltySchema.index(
  { competition: 1, club: 1, category: 1, isActive: 1 },
  { name: "competition_penalty_lookup" },
);

const CompetitionPenalty = mongoose.model(
  "CompetitionPenalty",
  competitionPenaltySchema,
);

export default CompetitionPenalty;
