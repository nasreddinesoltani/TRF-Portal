import mongoose from "mongoose";

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, trim: true },
    fr: { type: String, trim: true },
    ar: { type: String, trim: true },
  },
  { _id: false }
);

const countrySchema = new mongoose.Schema(
  {
    // ISO 3166-1 alpha-3 code, e.g. "TUN", "FRA"
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    // ISO 3166-1 alpha-2 code, e.g. "TN"
    codeAlpha2: {
      type: String,
      uppercase: true,
      trim: true,
    },
    // IOC code (usually == alpha-3)
    iocCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    names: {
      type: localizedNameSchema,
      required: true,
      default: () => ({}),
    },
    flagUrl: {
      type: String,
      trim: true,
    },
    // FISA / continental federation code
    federationCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    federationNames: {
      type: localizedNameSchema,
      default: () => ({}),
    },
    // Marks the owning federation (Tunisia)
    isTrf: {
      type: Boolean,
      default: false,
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

const Country = mongoose.model("Country", countrySchema);
export default Country;
