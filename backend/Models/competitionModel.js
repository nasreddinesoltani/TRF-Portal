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

export const COMPETITION_STATUSES = [
  "draft",
  "published",
  "completed",
  "archived",
];
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

// --- International competition support (scope) ---
export const COMPETITION_SCOPES = [
  "national", // current behaviour (default)
  "international_hosted", // scenario 1 — TRF hosts national teams
  "international_open", // scenario 2 — individuals / Masters
  "international_outbound", // scenario 3 — TRF team abroad
  "international_oaas", // scenario 4 — platform-as-a-service
];
export const PARTICIPATION_MODES = [
  "by_club",
  "by_nation",
  "individual",
  "mixed",
];
export const FOREIGN_ELIGIBILITY_MODES = ["relaxed", "strict", "none"];

// Convenience: every non-"national" scope is treated as international.
export const isInternationalScope = (scopeType) =>
  scopeType && scopeType !== "national";

const localizedNameSchema = new mongoose.Schema(
  {
    en: { type: String, required: true, trim: true },
    fr: { type: String, required: true, trim: true },
    ar: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const organizerSchema = new mongoose.Schema(
  {
    primary: { type: String, trim: true },
    secondary: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
  },
  { _id: false },
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
  { _id: false },
);

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    startTime: { type: Date },
    endTime: { type: Date },
    notes: { type: String, trim: true },
  },
  { _id: false },
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
    registrationOpenDate: { type: Date },
    registrationCloseDate: { type: Date },
    isFinalDay: { type: Boolean, default: false },
    sessions: { type: [sessionSchema], default: [] },
    notes: { type: String, trim: true },
  },
  { _id: false },
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
  { _id: false },
);

const registrationWindowSchema = new mongoose.Schema(
  {
    openAt: { type: Date },
    closeAt: { type: Date },
  },
  { _id: false }
);

// International competition scope. Defaults to "national" so every existing
// competition behaves exactly as before.
const scopeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: COMPETITION_SCOPES,
      default: "national",
      index: true,
    },
    // Alpha-3 / federation code of the body organising the event
    organiserFederation: { type: String, trim: true },
    // Owning federation of the event (TRF for 1/2/3; the foreign fed for 4)
    hostFederation: { type: String, trim: true },
    // ISO alpha-3 of the venue country
    hostCountry: { type: String, trim: true },
    participatingFederations: [{ type: String, trim: true }],
    // false for OaaS (Tunisia does not compete)
    trfParticipates: { type: Boolean, default: true },
    participationMode: {
      type: String,
      enum: PARTICIPATION_MODES,
      default: "by_club",
    },
    foreignEligibilityMode: {
      type: String,
      enum: FOREIGN_ELIGIBILITY_MODES,
      default: "relaxed",
    },
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
    scope: {
      type: scopeSchema,
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
  },
);

competitionSchema.index({ discipline: 1, startDate: 1 });
competitionSchema.index({ status: 1, registrationStatus: 1 });
competitionSchema.index({ "stages.date": 1 });
competitionSchema.index({ "scope.type": 1, startDate: 1 });

const Competition = mongoose.model("Competition", competitionSchema);
export default Competition;
