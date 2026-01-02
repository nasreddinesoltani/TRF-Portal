import mongoose from "mongoose";

const transferRequestSchema = new mongoose.Schema(
  {
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Athlete",
      required: true,
    },
    fromClub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    toClub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      trim: true,
    },
    adminNote: {
      type: String,
      trim: true,
    },
    decisionAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

transferRequestSchema.index({ athlete: 1, status: 1 });
transferRequestSchema.index({ fromClub: 1, status: 1 });
transferRequestSchema.index({ toClub: 1, status: 1 });

const TransferRequest = mongoose.model(
  "TransferRequest",
  transferRequestSchema
);

export default TransferRequest;
