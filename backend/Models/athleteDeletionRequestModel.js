import mongoose from "mongoose";

const athleteDeletionRequestSchema = new mongoose.Schema(
  {
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Athlete",
      required: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    decisionNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    decidedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

athleteDeletionRequestSchema.index(
  { athlete: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

const AthleteDeletionRequest = mongoose.model(
  "AthleteDeletionRequest",
  athleteDeletionRequestSchema
);

export default AthleteDeletionRequest;
