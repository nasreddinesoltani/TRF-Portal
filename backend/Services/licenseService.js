import LicenseCounter from "../Models/licenseCounterModel.js";
import Athlete from "../Models/athleteModel.js";

const ATHLETE_LICENSE_KEY = "athlete-license";
const LEGACY_ATHLETE_LICENSE_KEY = "athleteLicense";

const getMaxExistingLicenseSequence = async () => {
  const latestAthlete = await Athlete.findOne({
    licenseSequence: { $ne: null },
  })
    .sort({ licenseSequence: -1 })
    .select("licenseSequence")
    .lean();

  return latestAthlete?.licenseSequence || 0;
};

const getCounterValueByKey = async (key) => {
  const counter = await LicenseCounter.findOne({ key })
    .select("sequenceValue")
    .lean();
  return counter?.sequenceValue || 0;
};

const syncCanonicalCounterToMax = async () => {
  const [maxAthleteSequence, canonicalValue, legacyValue] = await Promise.all([
    getMaxExistingLicenseSequence(),
    getCounterValueByKey(ATHLETE_LICENSE_KEY),
    getCounterValueByKey(LEGACY_ATHLETE_LICENSE_KEY),
  ]);

  const maxSequence = Math.max(maxAthleteSequence, canonicalValue, legacyValue);

  const counter = await LicenseCounter.findOneAndUpdate(
    { key: ATHLETE_LICENSE_KEY },
    { $set: { sequenceValue: maxSequence } },
    { new: true, upsert: true },
  );

  return counter.sequenceValue;
};

export const getNextLicense = async () => {
  await syncCanonicalCounterToMax();

  const counter = await LicenseCounter.findOneAndUpdate(
    { key: ATHLETE_LICENSE_KEY },
    { $inc: { sequenceValue: 1 } },
    { new: true, upsert: true },
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
  return syncCanonicalCounterToMax();
};
