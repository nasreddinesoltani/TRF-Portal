// ============================================================
//  International race labels
//  A nation can enter more than one crew in the same category /
//  boat class (e.g. two TUN crews in U17W2x). The crew slot
//  (`crewNumber`, stored on the entry and propagated to race
//  lanes) is what tells those crews apart on start lists and
//  results, following the usual "TUN 1" / "TUN 2" convention.
// ============================================================

// True when the lane holds a multi-person crew (2x, 4x, 8+, ...).
// Singles never carry a crew number.
export const laneIsCrewBoat = (lane) =>
  Array.isArray(lane?.crew) && lane.crew.length > 1;

// Appends the crew slot to a nation label for crew boats:
//   ("TUN", { crewNumber: 2, isCrewLane: true })  -> "TUN 2"
//   ("TUN", { crewNumber: 1, isCrewLane: false }) -> "TUN"
//   ("-",   { crewNumber: 2, isCrewLane: true })  -> "-"
export const formatNationLabel = (label, { crewNumber, isCrewLane } = {}) => {
  const base = label === undefined || label === null ? "" : String(label).trim();
  if (!base || base === "-") {
    return base;
  }

  const hasNumber =
    crewNumber !== undefined &&
    crewNumber !== null &&
    String(crewNumber).trim() !== "";

  if (!isCrewLane || !hasNumber) {
    return base;
  }

  return `${base} ${String(crewNumber).trim()}`;
};

// Convenience: build the label straight from a lane + resolved nation.
export const formatLaneNationLabel = (label, lane) =>
  formatNationLabel(label, {
    crewNumber: lane?.crewNumber,
    isCrewLane: laneIsCrewBoat(lane),
  });

// ============================================================
//  Country labels for international events
//
//  International competitions accept BOTH national teams and clubs
//  (scope.participationMode can be "mixed"). The Country column
//  therefore always shows the country of the athlete / crew,
//  followed by the crew slot for crew boats:
//
//    * country known            -> the country   ("TUN 2")
//    * country on the club      -> that country  ("UAE 1")
//    * country team record      -> team country  ("UAE 2")
//    * no country anywhere      -> the club code ("EPT 2") — last resort
//
//  A regular club code is club identity, never a country, so it must
//  never outrank a resolved nation. Legends are keyed on countries,
//  so printing a club code here would leave the entry unlabelled.
// ============================================================

const CLUB_TYPES_WITH_CLUB_CODE = [
  "club",
  "centre_de_promotion",
  "ecole_federale",
];

// Country teams are stored as clubs with type "country" (e.g. code "UAE-C",
// name "UAE National Team"). When the club type is not available we fall back
// to the "-C" suffix convention used for those records.
export const isCountryTeam = (club, clubCode) => {
  const type = club?.type ? String(club.type).trim().toLowerCase() : "";
  if (type === "country") {
    return true;
  }
  if (CLUB_TYPES_WITH_CLUB_CODE.includes(type)) {
    return false;
  }
  const code = String(clubCode || club?.code || "").trim();
  return /-C$/i.test(code);
};

export const resolveEntryLabel = ({
  club,
  clubCode,
  nation,
  crewNumber,
  isCrewLane,
} = {}) => {
  const code = String(clubCode || club?.code || "").trim();
  const nationLabel =
    nation === undefined || nation === null ? "" : String(nation).trim();

  // Precedence for the "Country" column of an international event:
  //   1. the country already resolved for the athlete / crew
  //   2. the country attached to the club record
  //   3. the club code of a national-team record, minus its "-C" suffix
  //   4. the club code — LAST RESORT only
  //
  // A regular club code is club identity, never a country. It must never
  // outrank a resolved nation, otherwise start lists print club codes
  // (e.g. "EPT") in the Country column and those entries end up missing
  // from the legend, which is keyed on countries.
  const isTeam = isCountryTeam(club, code);
  const nationBase = nationLabel && nationLabel !== "-" ? nationLabel : "";
  const clubCountry = String(club?.country || "").trim();

  let base;
  if (nationBase) {
    base = nationBase;
  } else if (clubCountry) {
    base = clubCountry;
  } else if (isTeam) {
    base = code.replace(/-C$/i, "").trim();
  } else if (code) {
    base = code;
  } else {
    base = "";
  }

  return formatNationLabel(base, { crewNumber, isCrewLane });
};

// Convenience for race lanes (PDF export + on-screen views).
export const resolveLaneEntryLabel = (nation, lane) =>
  resolveEntryLabel({
    club: lane?.club,
    clubCode: lane?.club?.code,
    nation,
    crewNumber: lane?.crewNumber,
    isCrewLane: laneIsCrewBoat(lane),
  });

export default formatNationLabel;
