import mongoose from "mongoose";

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
    ar: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const boatClassSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    discipline: {
      type: String,
      enum: ["classic", "coastal", "beach", "indoor"],
      required: true,
      index: true,
    },
    names: {
      type: localizedNameSchema,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    crewSize: {
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    coxswain: {
      type: Boolean,
      default: false,
    },
    sculling: {
      type: Boolean,
      default: false,
    },
    relay: {
      type: Boolean,
      default: false,
    },
    runSegment: {
      type: Boolean,
      default: false,
    },
    weightClass: {
      type: String,
      enum: ["open", "lightweight", "para"],
      default: "open",
    },
    allowedGenders: {
      type: [String],
      enum: ["men", "women", "mixed"],
      default: ["men", "women", "mixed"],
    },
    tags: {
      type: [String],
      default: [],
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

boatClassSchema.index({ discipline: 1, code: 1 }, { unique: true });

const BoatClass = mongoose.model("BoatClass", boatClassSchema);
export default BoatClass;
