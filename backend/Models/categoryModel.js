import mongoose from "mongoose";

const titlesSchema = new mongoose.Schema(
  {
    ar: { type: String },
    fr: { type: String },
    en: { type: String },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["national", "international"],
      default: "national",
      index: true,
    },
    abbreviation: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    gender: {
      type: String,
      enum: ["men", "women", "mixed"],
      default: "mixed",
      index: true,
    },
    minAge: {
      type: Number,
      min: 0,
      required: true,
    },
    maxAge: {
      type: Number,
      min: 0,
    },
    titles: {
      type: titlesSchema,
      required: true,
      default: () => ({}),
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

categorySchema.index(
  { type: 1, gender: 1, minAge: 1, maxAge: 1 },
  { name: "category_age_band" }
);

const Category = mongoose.model("Category", categorySchema);

export default Category;
