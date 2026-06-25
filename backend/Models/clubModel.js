import mongoose from "mongoose";

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nameAr: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["club", "country", "centre_de_promotion", "ecole_federale"],
      required: true,
      default: "club",
    },
    // --- Federation identity (international support) ---
    // ISO 3166-1 alpha-3 country code. A `type:"country"` club represents a
    // national federation/team and carries the nation's identity here.
    country: {
      type: String,
      trim: true,
      index: true,
    },
    countryName: {
      type: String,
      trim: true,
    },
    iocCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    federationCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    flagUrl: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    seasonActivation: {
      from: { type: Date },
      to: { type: Date },
    },
    contacts: {
      primaryName: { type: String, trim: true },
      primaryPhone: { type: String, trim: true },
    },
    parentClub: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

clubSchema.index({ nameAr: 1 });

const Club = mongoose.model("Club", clubSchema);
export default Club;
