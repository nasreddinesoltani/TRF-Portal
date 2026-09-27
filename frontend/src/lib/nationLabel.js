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
//  Country / Club labels for international events
//
//  International competitions accept BOTH national teams and clubs
//  (scope.participationMode can be "mixed"). The Country column
//  therefore shows WHO the entry represents, followed by the
//  crew slot for crew boats:
//
//    * representingType nation/individual -> the country  ("TUN 2")
//    * FOREIGN club (populated country != host) -> the club code ("SIMSC")
//    * domestic club member                 -> their nationality ("TUN")
//    * country-team record                  -> that country  ("UAE 1")
//    * no club / no country known           -> nationality, then club code
//
//  `representingType` (enum: "club" | "nation" | "individual") and the
//  club's `country` field distinguish a foreign club registration from a
//  domestic one: a foreign club carries an explicit non-host country, so
//  its code is printed; a domestic club member is shown their nationality.
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
  representingType,
  crewNumber,
  isCrewLane,
} = {}) => {
  const code = String(clubCode || club?.code || "").trim();
  const nationLabel =
    nation === undefined || nation === null ? "" : String(nation).trim();

  // Precedence for the "Country" column of an international event.
  // A club is treated as a FOREIGN club (print its code) only when it
  // carries an explicit populated country that is not the host nation
  // ("TUN"). Domestic club members are shown their nationality instead.
  const isNationEntry =
    representingType === "nation" || representingType === "individual";
  const isTeam = isCountryTeam(club, code);
  const nationBase = nationLabel && nationLabel !== "-" ? nationLabel : "";
  const clubCountry = String(club?.country || "").trim();
  const isHostCountry = clubCountry.toUpperCase().trim().startsWith("TUN");
  const isForeignClub =
    !isTeam && !!club && !!clubCountry && !isHostCountry;

  let base;
  if (isNationEntry) {
    base = nationBase || code || clubCountry || "";
  } else if (isForeignClub) {
    base = code;
  } else if (nationBase) {
    base = nationBase;
  } else if (isTeam) {
    base = clubCountry || code.replace(/-C$/i, "").trim();
  } else if (code) {
    // Domestic club member (or club with no country info): show host nationality
    base = (isHostCountry || (!clubCountry && !isForeignClub)) ? "TUN" : code;
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
    representingType: lane?.representingType,
    crewNumber: lane?.crewNumber,
    isCrewLane: laneIsCrewBoat(lane),
  });

export default formatNationLabel;
