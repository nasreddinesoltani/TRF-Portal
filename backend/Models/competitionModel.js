import mongoose from "mongoose";

export const COMPETITION_DISCIPLINES = [
  "classic",
  "coastal",
  "beach",
  "indoor",
];

export const COMPETITION_TYPES = [
  "single_day",
  "multi_day",
  "multi_stage",
  "championship",
];

export const COMPETITION_STATUSES = ["draft", "published", "archived"];
export const REGISTRATION_STATUSES = ["not_open", "open", "closed"];
export const RESULTS_STATUSES = ["pending", "unofficial", "official"];

export const STAGE_TYPES = [
  "stage",
  "journey",
  "heat",
  "quarter_final",
  "semi_final",
  "final",
  "time_trial",
  "other",
];

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
    ar: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const organizerSchema = new mongoose.Schema(
  {
    primary: { type: String, trim: true },
    secondary: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
  },
  { _id: false }
);

const venueSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const stageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: STAGE_TYPES,
      default: "stage",
    },
    order: { type: Number, default: 0 },
    date: { type: Date },
    isFinalDay: { type: Boolean, default: false },
    sessions: { type: [sessionSchema], default: [] },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const categoryDistanceSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    boatClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoatClass",
    },
    distance: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

const registrationWindowSchema = new mongoose.Schema(
  {
    openAt: { type: Date },
    closeAt: { type: Date },
  },
  { _id: false }
);

const competitionSchema = new mongoose.Schema(
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
    discipline: {
      type: String,
      enum: COMPETITION_DISCIPLINES,
      required: true,
      index: true,
    },
    competitionType: {
      type: String,
      enum: COMPETITION_TYPES,
      default: "single_day",
      index: true,
    },
    season: {
      type: Number,
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true },
    venue: {
      type: venueSchema,
      default: () => ({}),
    },
    organizer: {
      type: organizerSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: COMPETITION_STATUSES,
      default: "draft",
      index: true,
    },
    registrationStatus: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: "not_open",
      index: true,
    },
    resultsStatus: {
      type: String,
      enum: RESULTS_STATUSES,
      default: "pending",
      index: true,
    },
    registrationWindow: {
      type: registrationWindowSchema,
      default: () => ({}),
    },
    allowUpCategory: {
      type: Boolean,
      default: true,
    },
    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    allowedBoatClasses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BoatClass",
      },
    ],
    defaultDistance: {
      type: Number,
      min: 0,
    },
    categoryDistances: {
      type: [categoryDistanceSchema],
      default: () => [],
    },
    stages: {
      type: [stageSchema],
      default: () => [],
    },
    notes: {
      type: String,
      trim: true,
    },
    publishedAt: {
      type: Date,
    },
    resultsPublishedAt: {
      type: Date,
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
  }
);

competitionSchema.index({ discipline: 1, startDate: 1 });
competitionSchema.index({ status: 1, registrationStatus: 1 });
competitionSchema.index({ "stages.date": 1 });

const Competition = mongoose.model("Competition", competitionSchema);
export default Competition;
