// ============================================================
//  Shared formatting helpers for the public pages.
//  Entry names/clubs work both with raw results (plain string
//  fields) and with the populated public API payloads where
//  athlete/club are expanded objects.
// ============================================================

import { countryName, flagEmoji } from "./countries";
import { generateRaceCode } from "./rowing";

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/* ── Affiliation (club vs nation) ──────────────────────────── */

/**
 * How entries of a competition affiliate:
 *  - "nation": international championship run by nation → show countries
 *  - "club":   national competition → show clubs
 *  - "mixed":  international regatta with club/nation entries → show the
 *              nation when the athlete has one, otherwise the club
 */
export const getAffiliationMode = (competition) => {
  const scope = competition?.scope || {};
  const participationMode = scope.participationMode;
  const scopeType = String(scope.type || "");

  if (participationMode === "by_nation") return "nation";
  if (participationMode === "by_club") return "club";
  if (scopeType.startsWith("international")) return "mixed";
  return "club";
};

/** Nation code of an entry/lane, resolved from its athlete when needed. */
export const getEntryNationCode = (entry, mode, hostCountry) => {
  if (mode === "club") return "";

  const raw = isObject(entry?.athlete)
    ? entry.athlete.nationalityCode || entry.athlete.nationality || ""
    : "";
  const code = String(entry?.representingNation || raw)
    .trim()
    .toUpperCase();

  if (code) return code;
  // Federations enter their squads in by-nation championships; athletes
  // without a recorded nationality belong to the host delegation.
  if (mode === "nation" && hostCountry) {
    return String(hostCountry).trim().toUpperCase();
  }
  return "";
};

/**
 * Display affiliation for an entry/lane depending on the competition mode:
 * countries (with flag) for international events, clubs for national ones.
 */
export const formatEntryAffiliation = (entry, mode, hostCountry) => {
  const nationCode = getEntryNationCode(entry, mode, hostCountry);
  if (nationCode) {
    const flag = flagEmoji(nationCode);
    const name = countryName(nationCode);
    return flag ? `${flag} ${name}` : name;
  }
  return formatEntryClub(entry);
};

/* ── Race phases (heats → finals) ──────────────────────────── */

const phaseRank = (phase) => {
  const value = String(phase || "").trim();
  if (!value) return 40;
  if (/^final\s*a$/i.test(value)) return 0;
  if (/^final/i.test(value)) return 1;
  if (/^semi/i.test(value)) return 10;
  if (/^heat/i.test(value)) return 20;
  return 30;
};

const phaseNumber = (phase) => {
  const match = String(phase || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

/** True when the phase is a heat (not a semi-final or final). */
export const isHeatPhase = (phase) => /^heat/i.test(String(phase || ""));

/**
 * Partition entries into their race phases, finals first.
 * Returns [{ phase, entries }] sorted Final A → Final B → semis → heats.
 */
export const groupEntriesByPhase = (entries) => {
  const byPhase = new Map();
  (entries || []).forEach((entry) => {
    const phase = String(entry?.phase || "").trim();
    const key = phase || "Results";
    if (!byPhase.has(key)) byPhase.set(key, []);
    byPhase.get(key).push(entry);
  });

  return [...byPhase.entries()]
    .map(([phase, phaseEntries]) => ({ phase, entries: phaseEntries }))
    .sort(
      (a, b) =>
        phaseRank(a.phase) - phaseRank(b.phase) ||
        phaseNumber(a.phase) - phaseNumber(b.phase),
    );
};

/**
 * Podium candidates for a group: entries of its decisive phase (the first
 * final when one exists) so heat times never shadow the medalists.
 */
export const getPodiumEntries = (entries) => {
  const phases = groupEntriesByPhase(entries);
  if (phases.length === 0) return [];
  const decisive = phases.find(
    (p) => /^final/i.test(p.phase) || !isHeatPhase(p.phase),
  );
  return (decisive || phases[0]).entries;
};

/** All distinct phases of a group, finals first ("Final A", "Heat 1"...). */
export const getGroupPhaseLabels = (entries) =>
  groupEntriesByPhase(entries)
    .map((p) => p.phase)
    .filter((phase) => phase && phase !== "Results");

/** Human summary of a group's phases, e.g. "Final A" or "Heats + Final A". */
export const formatPhaseSummary = (entries) => {
  const labels = getGroupPhaseLabels(entries);
  if (labels.length === 0) return "";
  const hasHeat = labels.some((phase) => isHeatPhase(phase));
  const finals = labels.filter((phase) => /^final/i.test(phase));
  if (hasHeat && finals.length > 0) return "Heats + Final";
  if (hasHeat) return "Heats";
  return finals.join(" · ");
};

/** Entry's own phase label, if known ("Heat 1", "Final A"...). */
export const getEntryPhase = (entry) => String(entry?.phase || "").trim();

/**
 * Static qualification rule shown for heats. World Rowing uses several
 * progression schemes depending on crew counts; until a full progression
 * engine is built, the federation applies this simple rule:
 * the winner of each heat qualifies for the final, remaining boats
 * advance by best time.
 */
export const formatProgressionRule = (finalPhase) =>
  finalPhase
    ? `1st of each heat → ${finalPhase} · others by best time`
    : "";

/**
 * Group programme races by their result-group id (eventGroupId), so a
 * result group can show the FULL crews of each heat race, not only the
 * entries kept in the published result group.
 */
export const groupRacesByEventGroupId = (races) => {
  const byGroup = new Map();
  (races || []).forEach((race) => {
    if (!race?.eventGroupId) return;
    if (!byGroup.has(race.eventGroupId)) {
      byGroup.set(race.eventGroupId, { heats: [], final: null });
    }
    const bucket = byGroup.get(race.eventGroupId);
    const phase = String(race.phase || "");
    if (isHeatPhase(phase)) {
      bucket.heats.push(race);
    } else if (/^final/i.test(phase) && !bucket.final) {
      bucket.final = race;
    }
  });
  byGroup.forEach((bucket) => {
    bucket.heats.sort(
      (a, b) =>
        phaseNumber(a.phase) - phaseNumber(b.phase) ||
        new Date(a.startTime || 0) - new Date(b.startTime || 0),
    );
  });
  return byGroup;
};

/**
 * Best display name for a result/race entry:
 * full crew (resolved from the source race lanes) → populated athlete name
 * → stored athlete name (latin/arabic) → club name → source race name.
 */
export const formatEntryName = (entry) => {
  if (!entry) return "Entry";

  // Full crew names annotated by the API for doubles/fours — published
  // entries only carry a single athlete reference.
  if (entry.crewNames) return entry.crewNames;

  if (isObject(entry.athlete)) {
    const latin =
      `${entry.athlete.firstName || ""} ${entry.athlete.lastName || ""}`.trim();
    if (latin) return latin;
    const arabic =
      `${entry.athlete.firstNameAr || ""} ${entry.athlete.lastNameAr || ""}`.trim();
    if (arabic) return arabic;
  }

  if (isObject(entry.crew) && Array.isArray(entry.crew)) {
    const crew = entry.crew
      .map(
        (member) =>
          `${member.firstName || ""} ${member.lastName || ""}`.trim(),
      )
      .filter(Boolean)
      .join(", ");
    if (crew) return crew;
  }

  return (
    entry.athleteName ||
    entry.athleteNameAr ||
    (isObject(entry.club) ? entry.club.name || entry.club.code : "") ||
    entry.clubName ||
    entry.sourceRaceName ||
    "Entry"
  );
};

/** Best display club for a result/race entry (populated or raw). */
export const formatEntryClub = (entry) => {
  if (!entry) return "—";
  return (
    (isObject(entry.club)
      ? entry.club.name || entry.club.nameAr || entry.club.code
      : "") ||
    entry.clubName ||
    entry.clubCode ||
    entry.clubNameAr ||
    "—"
  );
};

/** Compact club label for tight layouts: club code, falling back to name. */
export const formatEntryClubShort = (entry) => {
  if (!entry) return "—";
  const code = isObject(entry.club)
    ? entry.club.code
    : entry.clubCode || "";
  return (
    (code ? String(code).toUpperCase() : "") ||
    (isObject(entry.club)
      ? entry.club.name || entry.club.nameAr
      : "") ||
    entry.clubName ||
    "—"
  );
};

/** Format an elapsed time in milliseconds as m:ss.hh */
export const formatTime = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths
    .toString()
    .padStart(2, "0")}`;
};

/** "27 Sep 2026" */
export const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

/** "09:30" */
export const formatTimeOfDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBA";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/** "27 Sep 2026, 09:30" */
export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/** "Sunday, 27 September 2026" */
export const formatDayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Programme";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

/** "27 Sep" — short date used to disambiguate same-named result groups. */
export const formatShortDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
};

/** Race display label in rowing shorthand, e.g. "JM2x" / "PR3Mix2x" / "LM1x". */
export const formatRaceLabel = (raceOrGroup) => {
  if (!raceOrGroup) return "";
  const category = raceOrGroup.category;
  const boatClass = raceOrGroup.boatClass;

  // Prefer deriving the label from the category/boat-class pair: it is the only
  // way to tell a lightweight event from its open counterpart, because the boat
  // code alone is identical ("1X"). Falls back to the stored eventLabel when
  // the refs are not populated.
  if (isObject(category) && isObject(boatClass)) {
    const derived = generateRaceCode(category, boatClass);
    if (derived) return formatEventLabel(derived);
  }

  if (raceOrGroup.eventLabel) return formatEventLabel(raceOrGroup.eventLabel);

  const categoryCode =
    (isObject(category)
      ? category.abbreviation || category.titles?.en || category.name
      : "") || "";
  const boatCode =
    (isObject(boatClass) ? boatClass.code || boatClass.name : "") || "";
  return formatEventLabel(`${categoryCode} ${boatCode}`);
};

/* ── Event label format ("JM 2X" → "JM2x") ─────────────────── */

/** Boat code with a lowercase sculling X ("2X" → "2x", "4X+" → "4x+"). */
export const formatBoatCode = (code) =>
  String(code || "").replace(/X(\+)?$/, (_match, plus) => `x${plus || ""}`);

/* Full boat-class names for the standard FISA codes. */
const BOAT_CLASS_NAMES = {
  "1X": "Single Sculls",
  "2X": "Double Sculls",
  "4X": "Quadruple Sculls",
  "4X+": "Coxed Quadruple Sculls",
  "2-": "Pair",
  "2+": "Coxed Pair",
  "4-": "Coxless Four",
  "4+": "Coxed Four",
  "8+": "Eight",
  C1X: "Coastal Single Sculls",
  C2X: "Coastal Double Sculls",
  CMIX2X: "Coastal Mixed Double Sculls",
  "C4X+": "Coastal Coxed Quadruple Sculls",
};

/** Full boat-class name from its code ("1X" → "Single Sculls"). */
export const formatBoatClassName = (code) =>
  BOAT_CLASS_NAMES[String(code || "").trim().toUpperCase()] || "";

/**
 * Rowing shorthand event label: no space between category and boat class,
 * lowercase sculling X. "JM 2X" → "JM2x", "PR3Mix 2X" → "PR3Mix2x".
 */
export const formatEventLabel = (label) => {
  const compact = String(label || "").replace(/\s+/g, "");
  if (!compact) return "";
  return formatBoatCode(compact);
};
