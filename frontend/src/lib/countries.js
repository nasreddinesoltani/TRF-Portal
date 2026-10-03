// ============================================================
//  Country helpers for international events.
//  Maps IOC/ISO alpha-3 codes (ALG, TUN, FRA…) to flag emoji
//  and English names. Covers nations commonly met in rowing
//  competitions hosted by or joined by Tunisia.
// ============================================================

const ALPHA3_TO_ALPHA2 = {
  ALG: "DZ", ANG: "AO", CIV: "CI", EGY: "EG", KEN: "KE", LBA: "LY",
  MAR: "MA", SEN: "SN", SOM: "SO", SUD: "SD", TUN: "TN", RSA: "ZA",
  NGR: "NG", GHA: "GH", UGA: "UG", ZIM: "ZW", TZA: "TZ", NAM: "NA",
  BEN: "BJ", TOG: "TG", CMR: "CM", ETH: "ET", MOZ: "MZ", ZAM: "ZM",

  FRA: "FR", GBR: "GB", IRL: "IE", GER: "DE", ITA: "IT", ESP: "ES",
  PRT: "PT", NED: "NL", BEL: "BE", SUI: "CH", AUT: "AT", DEN: "DK",
  NOR: "NO", SWE: "SE", FIN: "FI", POL: "PL", CZE: "CZ", ROU: "RO",
  GRE: "GR", TUR: "TR", HUN: "HU", SRB: "RS", UKR: "UA", RUS: "RU",
  LTU: "LT", LAT: "LV", EST: "EE", HRV: "HR", SVN: "SI", SVK: "SK",
  BUL: "BG", MDA: "MD", BIH: "BA", MKD: "MK", ALB: "AL", MNE: "ME",

  USA: "US", CAN: "CA", MEX: "MX", BRA: "BR", ARG: "AR", CHI: "CL",
  URU: "UY", VEN: "VE", COL: "CO",

  AUS: "AU", NZL: "NZ", JPN: "JP", CHN: "CN", KOR: "KR", IND: "IN",
  THA: "TH", VIE: "VN", PHI: "PH", INA: "ID", MAS: "MY", SGP: "SG",

  KSA: "SA", UAE: "AE", QAT: "QA", KUW: "KW", BHR: "BH", OMN: "OM",
  IRQ: "IQ", JOR: "JO", LBN: "LB", SYR: "SY", YEM: "YE", PLE: "PS",
};

const COUNTRY_NAMES = {
  ALG: "Algeria", ANG: "Angola", CIV: "Côte d'Ivoire", EGY: "Egypt",
  KEN: "Kenya", LBA: "Libya", MAR: "Morocco", SEN: "Senegal",
  SOM: "Somalia", SUD: "Sudan", TUN: "Tunisia", RSA: "South Africa",
  NGR: "Nigeria", GHA: "Ghana", UGA: "Uganda", ZIM: "Zimbabwe",
  TZA: "Tanzania", NAM: "Namibia", BEN: "Benin", TOG: "Togo",
  CMR: "Cameroon", ETH: "Ethiopia", MOZ: "Mozambique", ZAM: "Zambia",

  FRA: "France", GBR: "Great Britain", IRL: "Ireland", GER: "Germany",
  ITA: "Italy", ESP: "Spain", PRT: "Portugal", NED: "Netherlands",
  BEL: "Belgium", SUI: "Switzerland", AUT: "Austria", DEN: "Denmark",
  NOR: "Norway", SWE: "Sweden", FIN: "Finland", POL: "Poland",
  CZE: "Czechia", ROU: "Romania", GRE: "Greece", TUR: "Türkiye",
  HUN: "Hungary", SRB: "Serbia", UKR: "Ukraine", RUS: "Russia",
  LTU: "Lithuania", LAT: "Latvia", EST: "Estonia", HRV: "Croatia",
  SVN: "Slovenia", SVK: "Slovakia", BUL: "Bulgaria", MDA: "Moldova",
  BIH: "Bosnia & Herzegovina", MKD: "North Macedonia", ALB: "Albania",
  MNE: "Montenegro",

  USA: "United States", CAN: "Canada", MEX: "Mexico", BRA: "Brazil",
  ARG: "Argentina", CHI: "Chile", URU: "Uruguay", VEN: "Venezuela",
  COL: "Colombia",

  AUS: "Australia", NZL: "New Zealand", JPN: "Japan", CHN: "China",
  KOR: "South Korea", IND: "India", THA: "Thailand", VIE: "Vietnam",
  PHI: "Philippines", INA: "Indonesia", MAS: "Malaysia", SGP: "Singapore",

  KSA: "Saudi Arabia", UAE: "United Arab Emirates", QAT: "Qatar",
  KUW: "Kuwait", BHR: "Bahrain", OMN: "Oman", IRQ: "Iraq",
  JOR: "Jordan", LBN: "Lebanon", SYR: "Syria", YEM: "Yemen",
  PLE: "Palestine",
};

const flagFromAlpha2 = (alpha2) =>
  String.fromCodePoint(
    ...[...alpha2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );

export const flagEmoji = (code) => {
  const alpha2 = ALPHA3_TO_ALPHA2[String(code || "").toUpperCase()];
  if (!alpha2) return "";
  try {
    return flagFromAlpha2(alpha2);
  } catch {
    return "";
  }
};

export const countryName = (code) =>
  COUNTRY_NAMES[String(code || "").toUpperCase()] ||
  String(code || "").toUpperCase();
