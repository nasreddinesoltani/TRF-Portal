/**
 * Formats a category abbreviation with a Lightweight or Para prefix if applicable.
 * @param {Object} category - Category object with abbreviation
 * @param {Object} boatClass - BoatClass object with weightClass
 * @returns {string} Formatted abbreviation (e.g., "BLM", "LM", "PR1M")
 */
export const formatCategoryAbbreviation = (category, boatClass) => {
  if (!category) return "";
  let abbr = category.abbreviation || "";
  
  // Lightweight handling
  if (boatClass?.weightClass === "lightweight") {
    // Return early if already has L prefix (case insensitive)
    if (/^[Ll]/.test(abbr)) return abbr;
    
    // Rowing standard: for U23 (B) or Junior (J), insert L after the category prefix
    // e.g., BM -> BLM, bM -> bLM, JW -> JLW
    if (/^[BJbj]/.test(abbr)) {
      return abbr[0] + "L" + abbr.slice(1);
    }
    
    // For Seniors (M, W) or others, just prefix with L
    // e.g., M -> LM, W -> LW
    return "L" + abbr;
  }
  
  return abbr;
};

/**
 * Generate World Rowing style race code
 * - Senior categories: M1x, W2x, M8+ (no category prefix, just gender + boat)
 * - Lightweight: LM1x, LW2x (L + gender + boat)
 * - U23 Lightweight: BLM1x, BLW2x (category + L + gender + boat)
 * - Other categories: JM1x, BW2x, bM4x (category abbreviation + boat)
 * 
 * @param {Object} category - Category object
 * @param {Object} boatClass - BoatClass object
 * @returns {string} Race code like "M1x", "LM1x", "BLM2x", etc.
 */
export const generateRaceCode = (category, boatClass) => {
  let boatCode = boatClass?.code || "1X";
  const catAbbr = category?.abbreviation || "";
  const catGender = category?.gender || "mixed";
  const weightClass = boatClass?.weightClass || "open";

  // Check if boat code starts with L (legacy lightweight code like LW1x, LM1x)
  const hasLegacyLightweightPrefix =
    boatCode.match(/^L[MW]?\d/i) || boatCode.match(/^LW?\d/i);
  if (hasLegacyLightweightPrefix) {
    boatCode = boatCode.replace(/^L[MW]?/i, "");
  }

  const isLightweight =
    weightClass === "lightweight" || hasLegacyLightweightPrefix;

  // Senior categories (SM, SW, Senior, or abbreviations starting with S for senior)
  // World Rowing also uses M/W directly for Open Seniors
  const isSeniorCategory =
    ["M", "W", "SM", "SW", "S"].includes(catAbbr.toUpperCase()) ||
    (category?.titles?.en || "").toLowerCase().includes("senior");

  const genderPrefix =
    catGender === "women" ? "W" : catGender === "mixed" ? "Mix" : "M";

  if (isSeniorCategory) {
    // For classic boats, use [L]M/W + boat code (World Rowing senior standard)
    return isLightweight
      ? `L${genderPrefix}${boatCode}`
      : `${genderPrefix}${boatCode}`;
  }

  // Detect if the category abbreviation already includes gender info
  // suffix style: JM, JW, BM, BW, CM, CW (ends with gender)
  // prefix style: M50-59, W36-43, MM, MW (starts with gender)
  const hasGenderSuffix = /[MmWw]$|Mix$/i.test(catAbbr);
  const hasGenderPrefix = /^[MmWw]|Mix/i.test(catAbbr);

  if (isLightweight) {
    if (catAbbr.toLowerCase().endsWith("mix")) {
      return `${catAbbr.slice(0, -3)}LMix${boatCode}`;
    }
    // For BM -> BLM, JW -> JLW (suffix style, not starting with gender)
    if (hasGenderSuffix && !hasGenderPrefix) {
      const catBase = catAbbr.slice(0, -1);
      const catGenderSuffix = catAbbr.slice(-1);
      return `${catBase}L${catGenderSuffix}${boatCode}`;
    }
    // For M50-59 -> LM50-59, MM -> LMM (starts with gender)
    if (hasGenderPrefix) {
      return `L${catAbbr}${boatCode}`;
    }
    // Fallback: U17 -> U17LM
    return `${catAbbr}L${genderPrefix}${boatCode}`;
  }

  // Open weight: use existing gender if present, otherwise append it
  if (hasGenderSuffix || hasGenderPrefix) {
    return `${catAbbr}${boatCode}`;
  }

  return `${catAbbr}${genderPrefix}${boatCode}`;
};
