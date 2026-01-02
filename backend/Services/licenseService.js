import LicenseCounter from "../Models/licenseCounterModel.js";
import Athlete from "../Models/athleteModel.js";

const ATHLETE_LICENSE_KEY = "athlete-license";

export const getNextLicense = async () => {
  const counter = await LicenseCounter.findOneAndUpdate(
    { key: ATHLETE_LICENSE_KEY },
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true }
  );

  const sequence = counter.sequenceValue;
  const year = new Date().getFullYear() % 100; // last two digits
  const yearSuffix = year.toString().padStart(2, "0");

  return {
    sequence,
    licenseNumber: `${sequence}-${yearSuffix}`,
    year: Number(yearSuffix),
  };
};

export const syncLicenseCounter = async () => {
  const latestAthlete = await Athlete.findOne({
    licenseSequence: { $ne: null },
  })
    .sort({ licenseSequence: -1 })
    .select("licenseSequence")
    .lean();

  const maxSequence = latestAthlete?.licenseSequence || 0;

  const counter = await LicenseCounter.findOneAndUpdate(
    { key: ATHLETE_LICENSE_KEY },
    { $set: { sequenceValue: maxSequence } },
    { new: true, upsert: true }
  );

  return counter.sequenceValue;
};
