import mongoose from "mongoose";

const licenseCounterSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    sequenceValue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const LicenseCounter = mongoose.model("LicenseCounter", licenseCounterSchema);
export default LicenseCounter;
