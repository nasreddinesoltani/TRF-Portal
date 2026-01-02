import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    season: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "transferred"],
      default: "active",
    },
    membershipType: {
      type: String,
      enum: ["primary", "secondary"],
      default: "primary",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
  },
  { _id: false }
);

const baseDocumentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    storagePath: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    note: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Map,
      of: String,
    },
    expiresAt: {
      type: Date,
    },
  },
  { _id: false }
);

const assignmentTitlesSchema = new mongoose.Schema(
  {
    ar: { type: String },
    fr: { type: String },
    en: { type: String },
  },
  { _id: false }
);

const categoryAssignmentSchema = new mongoose.Schema(
  {
    season: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["national", "international"],
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    abbreviation: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["men", "women", "mixed"],
    },
    titles: {
      type: assignmentTitlesSchema,
      default: () => ({}),
    },
    ageOnCutoff: {
      type: Number,
      min: 0,
    },
  },
  { _id: false, minimize: false }
);

const documentsSchema = new mongoose.Schema(
  {
    photo: { type: baseDocumentSchema },
    birthCertificate: { type: baseDocumentSchema },
    cin: { type: baseDocumentSchema },
    passport: { type: baseDocumentSchema },
    parentalAuthorization: { type: baseDocumentSchema },
    medicalCertificate: { type: baseDocumentSchema },
  },
  { _id: false, minimize: false }
);

const athleteSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    firstNameAr: {
      type: String,
      required: true,
      trim: true,
    },
    lastNameAr: {
      type: String,
      required: true,
      trim: true,
    },
    birthDate: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },
    nationality: {
      type: String,
      trim: true,
    },
    cin: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    passportNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    licenseNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    licenseSequence: {
      type: Number,
      unique: true,
      sparse: true,
    },
    licenseYear: {
      type: Number,
    },
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "pending_documents",
        "expired_medical",
        "suspended",
      ],
      default: "pending_documents",
    },
    licenseStatus: {
      type: String,
      enum: ["active", "inactive", "pending", "suspended"],
      default: "inactive",
      index: true,
    },
    documentsStatus: {
      type: String,
      enum: ["active", "pending_documents", "expired_medical", "suspended"],
      default: "pending_documents",
    },
    documentsIssues: {
      type: [String],
      default: [],
    },
    documentsEvaluatedAt: {
      type: Date,
    },
    documents: {
      type: documentsSchema,
      default: () => ({}),
    },
    categoryAssignments: {
      type: [categoryAssignmentSchema],
      default: () => [],
    },
    memberships: [membershipSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

athleteSchema.index({ firstNameAr: 1, lastNameAr: 1, birthDate: 1 });

const Athlete = mongoose.model("Athlete", athleteSchema);
export default Athlete;
