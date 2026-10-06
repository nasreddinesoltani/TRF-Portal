/**
 * Event label helpers.
 *
 * A "lightweight" boat is identified by `boatClass.weightClass`, never by the
 * boat code: a lightweight single scull keeps the code "1X" and is only
 * distinguished from the open single scull by its weight class. Building
 * labels as `"<category> <code>"` therefore silently drops the lightweight
 * marker ("M 1X" instead of "LM 1X") and makes open and lightweight events
 * indistinguishable to the user.
 *
 * The category part is derived exactly like `generateRaceCode` in
 * frontend/src/lib/rowing.js so backend-generated labels and frontend-derived
 * labels never disagree. Labels keep a space between the category and the boat
 * code; the public UI compacts it when rendering ("LM 1X" → "LM1x").
 */

const SENIOR_ABBREVIATIONS = ["M", "W", "SM", "SW", "S"];

const asString = (value) => String(value || "").trim();

/** Strip a legacy lightweight prefix from a boat code ("LW1x" → "1X"). */
const normalizeBoatCode = (code) => {
  const value = asString(code);
  const legacy = value.match(/^L[MW]?\d/i) || value.match(/^LW?\d/i);
  if (legacy) return value.replace(/^L[MW]?/i, "");
  return value;
};

/** True for boat codes that already encode lightweight (legacy data). */
export const hasLegacyLightweightCode = (code) =>
  Boolean(asString(code).match(/^L[MW]?\d/i) || asString(code).match(/^LW?\d/i));

/**
 * Category part of an event label, including the lightweight marker.
 * "M" → "LM", "W" → "LW", "BM" → "BLM", "JM" → "JLM", "M50-59" → "LM50-59".
 */
export const buildEventCategoryLabel = (category, boatClass) => {
  const abbreviation = asString(category?.abbreviation);
  const gender = asString(category?.gender) || "mixed";
  const isLightweight =
    asString(boatClass?.weightClass) === "lightweight" ||
    hasLegacyLightweightCode(boatClass?.code);

  const genderPrefix = gender === "women" ? "W" : gender === "mixed" ? "Mix" : "M";
  const isSenior =
    SENIOR_ABBREVIATIONS.includes(abbreviation.toUpperCase()) ||
    asString(category?.titles?.en).toLowerCase().includes("senior");

  // Seniors are written as bare M/W in World Rowing shorthand, so the
  // lightweight marker goes in front of the gender letter.
  if (isSenior) {
    return isLightweight ? `L${genderPrefix}` : genderPrefix;
  }

  // Abbreviations that already carry their gender (JM, BW, CM…) or that start
  // with it (M50-59, MM, MW) must not gain a second gender letter.
  const hasGenderSuffix = /[MmWw]$|Mix$/i.test(abbreviation);
  const hasGenderPrefix = /^[MmWw]|Mix/i.test(abbreviation);

  if (isLightweight) {
    if (abbreviation.toLowerCase().endsWith("mix")) {
      return `${abbreviation.slice(0, -3)}LMix`;
    }
    if (hasGenderSuffix && !hasGenderPrefix) {
      return `${abbreviation.slice(0, -1)}L${abbreviation.slice(-1)}`;
    }
    if (hasGenderPrefix) {
      return `L${abbreviation}`;
    }
    return `${abbreviation}L${genderPrefix}`;
  }

  if (hasGenderSuffix || hasGenderPrefix) return abbreviation;
  return `${abbreviation}${genderPrefix}`;
};

/**
 * Full event label, e.g. "LM 1X" for a lightweight men's single sculls event
 * and "M 1X" for the open equivalent.
 */
export const buildEventLabel = (category, boatClass) => {
  const boatPart = normalizeBoatCode(boatClass?.code);
  const categoryPart = buildEventCategoryLabel(category, boatClass);
  return `${categoryPart} ${boatPart}`.trim();
};