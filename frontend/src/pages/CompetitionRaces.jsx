import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { DataGrid } from "../components/DataGrid";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE_URL = "";
const ENTRY_SEARCH_LIMIT = 25;
const DEFAULT_LANES_PER_RACE = 6;

// Helper to load image as base64
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null); // Resolve null on error to keep going
  });
};

const loadFont = async (url) => {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error("Failed to load font", error);
    return null;
  }
};

const toDocumentId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    const candidate = value._id || value.id;
    if (!candidate) {
      return null;
    }
    if (typeof candidate === "string") {
      return candidate;
    }
    if (candidate.toString) {
      return candidate.toString();
    }
  }
  return null;
};

const normalizeGender = (g) => {
  if (!g) return null;
  const s = String(g).trim().toLowerCase();
  if (!s) return null;
  if (s === "women" || s === "woman" || s === "female" || s === "f")
    return "women";
  if (s === "men" || s === "man" || s === "male" || s === "m") return "men";
  if (s === "mixed" || s === "mix") return "mixed";
  return s; // fallback - return raw normalized string
};

/**
 * Calculate athlete's age for a given season year.
 * Age is calculated as of December 31 of the season year (World Rowing standard).
 * @param {Object} athlete - Athlete object with birthDate
 * @param {number} [seasonYear] - The season year to calculate age for. Defaults to current year.
 * @returns {number|null} Age in years, or null if birthDate is invalid
 */
const getAge = (athlete, seasonYear) => {
  if (!athlete || !athlete.birthDate) return null;
  try {
    const bd = new Date(athlete.birthDate);
    // Use provided season year or default to current year
    const targetYear = seasonYear || new Date().getFullYear();
    // Calculate age as of Dec 31 of the season year (standard cutoff)
    const cutoffDate = new Date(targetYear, 11, 31); // Dec 31
    let age = cutoffDate.getFullYear() - bd.getFullYear();
    // Adjust if birthday hasn't occurred by cutoff date
    const m = cutoffDate.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && cutoffDate.getDate() < bd.getDate())) age--;
    return Number.isFinite(age) ? age : null;
  } catch (err) {
    return null;
  }
};

const normaliseStrategy = (value) => (value === "seeded" ? "seeded" : "random");

// Lane limits by discipline - must match backend limits
// Beach/Indoor: 100 for time trials and ergometer events with many participants
const LANE_LIMITS = { classic: 8, coastal: 20, beach: 100, indoor: 100 };
const getMaxLanesForDiscipline = (discipline) => LANE_LIMITS[discipline] || 8;

const deriveClubId = (athlete) => {
  if (!athlete) {
    return undefined;
  }
  const memberships = Array.isArray(athlete.memberships)
    ? athlete.memberships
    : [];

  // Always use active membership for club context, prioritizing standard clubs over promotion centers
  const activeMemberships = memberships.filter(
    (membership) => membership?.status === "active" && membership.club,
  );

  // Try to find a 'club' type specifically, otherwise fall back to first active
  const activeMembership =
    activeMemberships.find((m) => m.club?.type === "club") ||
    activeMemberships[0];

  if (activeMembership?.club) {
    return toDocumentId(activeMembership.club) || undefined;
  }
  if (athlete.club) {
    return toDocumentId(athlete.club) || undefined;
  }
  const fallbackMembership = memberships.find((membership) => membership?.club);
  if (fallbackMembership?.club) {
    return toDocumentId(fallbackMembership.club) || undefined;
  }
  return undefined;
};

const resolveClubLabel = (clubValue) => {
  if (!clubValue) {
    return undefined;
  }
  if (typeof clubValue === "string") {
    return `Club ${clubValue.slice(-4)}`;
  }
  return (
    clubValue.name ||
    clubValue.label ||
    clubValue.code ||
    (clubValue._id ? `Club ${String(clubValue._id).slice(-4)}` : undefined)
  );
};

const makeClubCodeFromName = (name) => {
  if (!name || typeof name !== "string") return undefined;
  // Prefer first 4 letters of the name (excluding stopwords), else initials
  const stop = new Set(["de", "la", "les", "des", "du", "of", "the", "and"]);
  const parts = name
    .replace(/[()\-.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !stop.has(w.toLowerCase()));
  if (!parts.length) return undefined;
  // Try first 4 letters of the first non-stopword part
  const firstWord = parts[0];
  if (firstWord && firstWord.length >= 4) {
    return firstWord.slice(0, 4).toUpperCase();
  }
  // Else, use up to 4 initials
  const initials = parts
    .slice(0, 4)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  return initials || undefined;
};

const formatAthleteName = (athlete) => {
  if (!athlete) {
    return "Unknown athlete";
  }
  const parts = [athlete.firstName, athlete.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  return athlete.licenseNumber || "Unknown athlete";
};

/**
 * Generate World Rowing style race code
 * - Senior categories: M1x, W2x, M8+ (no category prefix, just gender + boat)
 * - Lightweight: LM1x, LW2x (L + gender + boat)
 * - U23 Lightweight: BLM1x, BLW2x (category + L + gender + boat)
 * - Other categories: JM1x, BW2x, bM4x (category abbreviation + boat)
 *
 * For coastal/beach boats that already include gender (CM1x, CW1x, CMix2x),
 * we use them directly without adding category prefix for Senior,
 * or add category prefix for non-Senior categories.
 *
 * @param {Object} category - Category object with abbreviation, gender, type
 * @param {Object} boatClass - BoatClass object with code, weightClass
 * @returns {string} Race code like "M1x", "LM1x", "JW2x", "CM1x", etc.
 */
const generateRaceCode = (category, boatClass) => {
  let boatCode = boatClass?.code || "1X";
  const catAbbr = category?.abbreviation || "";
  const catGender = category?.gender || "mixed";
  const weightClass = boatClass?.weightClass || "open";

  // Check if boat code starts with L (legacy lightweight code like LW1x, LM1x)
  // In this case, extract the pure boat code (1x, 2x) for proper formatting
  const hasLegacyLightweightPrefix =
    boatCode.match(/^L[MW]?\d/i) || boatCode.match(/^LW?\d/i);
  if (hasLegacyLightweightPrefix) {
    // Remove the L or LW/LM prefix to get the pure boat code
    boatCode = boatCode.replace(/^L[MW]?/i, "");
  }

  // Determine if this is a lightweight boat
  const isLightweight =
    weightClass === "lightweight" || hasLegacyLightweightPrefix;

  // Check if this is a coastal/beach boat (already has gender in code)
  const isCoastalBoat = boatCode.startsWith("C") || boatCode.startsWith("c");

  // Senior categories (SM, SW, Senior, or abbreviations starting with S for senior)
  // For international standard: Senior uses M/W directly without category prefix
  const isSeniorCategory =
    catAbbr.toUpperCase() === "SM" ||
    catAbbr.toUpperCase() === "SW" ||
    catAbbr.toUpperCase() === "S" ||
    (category?.titles?.en || "").toLowerCase().includes("senior");

  // Gender prefix for race codes
  const genderPrefix =
    catGender === "women" ? "W" : catGender === "mixed" ? "Mix" : "M";

  if (isSeniorCategory) {
    if (isCoastalBoat) {
      // Coastal boats already have gender: CM1x, CW1x, CMix2x
      // For lightweight coastal, prefix with L
      return isLightweight ? `L${boatCode}` : boatCode;
    }
    // For classic boats, use [L]M/W + boat code (World Rowing senior standard)
    // LM1x for Lightweight Men, M1x for Open Men
    return isLightweight
      ? `L${genderPrefix}${boatCode}`
      : `${genderPrefix}${boatCode}`;
  }

  // For non-senior categories, use category abbreviation + boat code
  // Examples: JM1x (Junior Men), BW2x (U23 Women), bM4x (Benjamin Male)
  // For lightweight: JLM1x (Junior Lightweight Men), BLW1x (U23 Lightweight Women)
  if (isCoastalBoat) {
    // For coastal boats with non-senior category, prefix with category
    // e.g., JCM1x for Junior Coastal Men's Solo
    return isLightweight ? `${catAbbr}L${boatCode}` : `${catAbbr}${boatCode}`;
  }

  // Standard format: category abbreviation + [L if lightweight] + gender + boat
  // For lightweight non-senior: BLM1x (U23 Lightweight Men), JLW2x (Junior Lightweight Women)
  // Note: If catAbbr already includes gender (JM, JW, BM, BW), we use it directly
  // Otherwise, we need to construct it properly
  const catHasGender =
    catAbbr.endsWith("M") || catAbbr.endsWith("W") || catAbbr.endsWith("Mix");

  if (catHasGender) {
    // Category already has gender suffix (JM, JW, BM, BW, etc.)
    // For lightweight, insert L before the gender: JM -> JLM, BW -> BLW
    if (isLightweight) {
      const catBase = catAbbr.slice(0, -1); // Remove the gender suffix (M, W)
      const catGenderSuffix = catAbbr.slice(-1); // Get the gender suffix
      return `${catBase}L${catGenderSuffix}${boatCode}`;
    }
    return `${catAbbr}${boatCode}`;
  }

  // Category doesn't have gender suffix, add gender
  return isLightweight
    ? `${catAbbr}L${genderPrefix}${boatCode}`
    : `${catAbbr}${genderPrefix}${boatCode}`;
};

// Format milliseconds to MM:SS.cc or SS.cc (centiseconds - 2 digits)
const formatElapsedTime = (ms) => {
  if (ms === undefined || ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10); // Convert to centiseconds (2 digits)
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis
      .toString()
      .padStart(2, "0")}`;
  }
  return `${seconds}.${centis.toString().padStart(2, "0")}`;
};

// Format delta time in seconds only (World Rowing style: "6.21", "14.72")
const formatDeltaSeconds = (ms) => {
  if (ms === undefined || ms === null || ms <= 0) return "";
  const totalSeconds = ms / 1000;
  return totalSeconds.toFixed(2);
};

// Parse time string to milliseconds (supports MM:SS.cc or SS.cc - centiseconds)
const parseTimeToMs = (timeStr) => {
  if (!timeStr || timeStr === "-") return undefined;
  const trimmed = timeStr.trim();
  if (!trimmed) return undefined;

  // Try MM:SS.cc format (centiseconds)
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})\.(\d{1,2})$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    const centis = parseInt(colonMatch[3].padEnd(2, "0"), 10);
    if (seconds >= 60) return undefined; // Invalid seconds
    return minutes * 60 * 1000 + seconds * 1000 + centis * 10;
  }

  // Try MM:SS format (no centiseconds)
  const colonNoMillis = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonNoMillis) {
    const minutes = parseInt(colonNoMillis[1], 10);
    const seconds = parseInt(colonNoMillis[2], 10);
    if (seconds >= 60) return undefined; // Invalid seconds
    return minutes * 60 * 1000 + seconds * 1000;
  }

  // Try SS.cc format (centiseconds)
  const secMatch = trimmed.match(/^(\d+)\.(\d{1,2})$/);
  if (secMatch) {
    const seconds = parseInt(secMatch[1], 10);
    const centis = parseInt(secMatch[2].padEnd(2, "0"), 10);
    return seconds * 1000 + centis * 10;
  }

  // Try just seconds
  const justSec = parseInt(trimmed, 10);
  if (!isNaN(justSec)) {
    return justSec * 1000;
  }

  return undefined;
};

// Auto-format time input as user types (e.g., "12345" -> "1:23.45")
const formatTimeInput = (value) => {
  // Remove non-numeric characters except : and .
  const cleaned = value.replace(/[^\d.:]/g, "");

  // If already formatted with : or ., return as is
  if (cleaned.includes(":") || cleaned.includes(".")) {
    return cleaned;
  }

  // Auto-format raw digits: assume last 2 are centiseconds, next 2 are seconds, rest are minutes
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 2) {
    // Just centiseconds or less
    return `0.${digits.padStart(2, "0")}`;
  }
  if (digits.length <= 4) {
    // Seconds and centiseconds
    const centis = digits.slice(-2);
    const secs = digits.slice(0, -2);
    return `${parseInt(secs, 10)}.${centis}`;
  }
  // Minutes, seconds, and centiseconds
  const centis = digits.slice(-2);
  const secs = digits.slice(-4, -2);
  const mins = digits.slice(0, -4);
  return `${parseInt(mins, 10)}:${secs.padStart(2, "0")}.${centis}`;
};

const DEFAULT_POINT_TABLE = {
  1: 20,
  2: 12,
  3: 8,
  4: 6,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};

const calculatePoints = (position, rankingSystem = null) => {
  if (!position || position < 1) return 0;

  // Use effective point table if ranking system is provided
  if (rankingSystem) {
    if (
      rankingSystem.customPointTable &&
      rankingSystem.customPointTable.length > 0
    ) {
      const entry = rankingSystem.customPointTable.find(
        (e) => e.position === position,
      );
      return entry ? entry.points : 0;
    }
    // Fallback if system has its own defaults or effective point table structure
    // (matches the backend implementation logic)
  }

  return DEFAULT_POINT_TABLE[position] || 0;
};

const LANE_RESULT_STATUS_OPTIONS = [
  { value: "ok", label: "OK" },
  { value: "dns", label: "DNS (Did Not Start)" },
  { value: "dnf", label: "DNF (Did Not Finish)" },
  { value: "dsq", label: "DSQ (Disqualified)" },
  { value: "abs", label: "ABS (Absent)" },
];

const formatCrewName = (crew) => {
  if (!Array.isArray(crew) || crew.length === 0) {
    return null;
  }
  return crew
    .map((member, index, arr) => {
      const name = formatAthleteName(member);
      let pos = "";
      if (arr.length > 1) {
        if (index === 0) pos = "(b) ";
        else if (index === arr.length - 1) pos = "(s) ";
        else pos = `(${index + 1}) `;
      }
      return `${pos}${name}`;
    })
    .join(" / ");
};

const SearchResultsList = ({ term, results, loading, error, onPick }) => {
  if (!term) {
    return null;
  }
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        Searching athletes...
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!results.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
        No matching athletes.
      </div>
    );
  }
  return (
    <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {results.map((athlete) => {
        const athleteId = toDocumentId(athlete);
        const name = formatAthleteName(athlete);
        return (
          <button
            key={athleteId}
            type="button"
            onClick={() => onPick(athlete)}
            className="flex w-full items-center justify-between rounded-md bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            <span>
              {name}
              {athlete.licenseNumber ? (
                <span className="ml-2 text-xs text-slate-500">
                  {athlete.licenseNumber}
                </span>
              ) : null}
            </span>
            <span className="text-xs text-slate-400">Add</span>
          </button>
        );
      })}
    </div>
  );
};

const PendingManualCrewDisplay = ({ crew, requiredSize, onCancel }) => {
  if (!crew || crew.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-blue-900">
            Pending Crew ({crew.length}/{requiredSize})
          </h4>
          <p className="text-xs text-blue-700">
            Add {requiredSize - crew.length} more athlete
            {requiredSize - crew.length === 1 ? "" : "s"} to complete the entry.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="text-blue-700 hover:bg-blue-100 hover:text-blue-800"
        >
          Cancel
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {crew.map((athlete, idx) => (
          <li
            key={athlete._id || idx}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm border border-blue-100"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                {idx + 1}
              </span>
              <span className="font-medium text-slate-800">
                {formatAthleteName(athlete)}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              License {athlete.licenseNumber || "-"}
            </span>
          </li>
        ))}
        {Array.from({ length: requiredSize - crew.length }).map((_, idx) => (
          <li
            key={`empty-${idx}`}
            className="flex items-center gap-3 rounded-lg border border-dashed border-blue-200 px-3 py-2 text-sm text-blue-300"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-blue-200 text-[10px] font-bold">
              {crew.length + idx + 1}
            </span>
            <span>Waiting for athlete...</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const EntriesTable = ({
  entries,
  onEntryChange,
  onRemove,
  onWithdraw,
  onDelete,
  isAdmin,
}) => {
  if (!entries.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Start list empty. Use the search box to add competitors.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2 w-24">Seed</th>
            <th className="px-3 py-2 w-36">Crew #</th>
            <th className="px-3 py-2">Athlete</th>
            <th className="px-3 py-2 w-24">Status</th>
            <th className="px-3 py-2 w-28">Notes</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {entries
            .slice()
            .sort((a, b) => (Number(a.seed) || 0) - (Number(b.seed) || 0))
            .map((entry, index) => {
              const isDbEntry = entry.id && !entry.uid?.startsWith("manual-");
              const isWithdrawn = entry.status === "withdrawn";

              return (
                <tr
                  key={entry.uid || entry.id || `entry-${index}`}
                  className={isWithdrawn ? "bg-rose-50 opacity-60" : ""}
                >
                  <td className="px-4 py-2 w-24">
                    <Input
                      type="number"
                      min="1"
                      value={entry.seed}
                      onChange={(event) =>
                        onEntryChange(
                          entry.uid || entry.id,
                          "seed",
                          event.target.value,
                        )
                      }
                      className="h-8 w-16 text-center"
                      disabled={isWithdrawn}
                    />
                  </td>
                  <td className="px-3 py-2 w-36 text-slate-600 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {entry.clubCode ? (
                        <span className="font-semibold text-slate-700 text-sm">
                          {entry.clubCode}
                        </span>
                      ) : null}
                      <Input
                        type="number"
                        min="1"
                        value={entry.crewNumber || ""}
                        placeholder="-"
                        onChange={(event) =>
                          onEntryChange(
                            entry.uid || entry.id,
                            "crewNumber",
                            event.target.value
                              ? parseInt(event.target.value, 10)
                              : undefined,
                          )
                        }
                        className="h-8 w-14 text-center"
                        disabled={isWithdrawn}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span
                        className={`font-medium ${isWithdrawn ? "text-slate-500 line-through" : "text-slate-800"}`}
                      >
                        {entry.crew && entry.crew.length > 0
                          ? formatCrewName(entry.crew)
                          : formatAthleteName(entry.athlete)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {entry.crew && entry.crew.length > 0
                          ? `${entry.crew.length} athletes`
                          : `License ${entry.athlete?.licenseNumber || "-"}`}
                      </span>
                      {entry.clubName ? (
                        <span className="text-xs text-slate-400">
                          {entry.clubName}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {isWithdrawn ? (
                      <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">
                        Withdrawn
                      </span>
                    ) : entry.status === "pending" ? (
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    ) : entry.status === "approved" ? (
                      <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Approved
                      </span>
                    ) : isDbEntry ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {entry.status || "Registered"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Manual</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={entry.notes || ""}
                      onChange={(event) =>
                        onEntryChange(
                          entry.uid || entry.id,
                          "notes",
                          event.target.value,
                        )
                      }
                      className="h-8 w-24"
                      placeholder="-"
                      disabled={isWithdrawn}
                    />
                  </td>
                  <td className="px-3 py-2 text-right space-x-1">
                    {isDbEntry ? (
                      <>
                        {!isWithdrawn && onWithdraw && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onWithdraw(entry.id)}
                            className="text-amber-600 hover:text-amber-700"
                          >
                            Withdraw
                          </Button>
                        )}
                        {isAdmin && onDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Permanently delete this entry for ${formatAthleteName(entry.athlete)}? This cannot be undone.`,
                                )
                              ) {
                                onDelete(entry.id);
                              }
                            }}
                            className="text-rose-600 hover:text-rose-700"
                          >
                            Delete
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onRemove(entry.uid)}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

const describeLane = (lane, athleteLookup, clubLookup) => {
  const athleteId = toDocumentId(lane?.athlete);
  const athlete = athleteId ? athleteLookup.get(athleteId) : null;

  let athleteName = "Unassigned";
  if (athlete) {
    athleteName = formatAthleteName(athlete);
  } else if (Array.isArray(lane?.crew) && lane.crew.length > 0) {
    const crewNames = lane.crew.map((member, index, arr) => {
      const mId = toDocumentId(member);
      const m = mId
        ? athleteLookup.get(mId)
        : typeof member === "object"
          ? member
          : null;
      const name = m ? formatAthleteName(m) : "Unknown";
      let pos = "";
      if (arr.length > 1) {
        if (index === 0) pos = "(b) ";
        else if (index === arr.length - 1) pos = "(s) ";
        else pos = `(${index + 1}) `;
      }
      return `${pos}${name}`;
    });
    athleteName = crewNames.join(", ");
  }

  const clubId = toDocumentId(lane?.club);
  const clubName = clubId ? clubLookup.get(clubId) : null;
  const clubCode = lane?.club?.code || clubName;

  const seedLabel = lane?.seed ? `Seed ${lane.seed}` : null;
  const extras = [seedLabel].filter(Boolean).join(" - ");
  const clubPart = clubName ? ` (${clubName})` : "";
  const extrasPart = extras ? ` - ${extras}` : "";

  const prefix =
    clubCode && lane.crewNumber ? `${clubCode} ${lane.crewNumber} - ` : "";

  return `${lane?.lane}. ${prefix}${athleteName}${
    !prefix && clubPart ? clubPart : ""
  }${extrasPart}`;
};

const RaceInfoView = ({
  race,
  competition,
  categories,
  boatClasses,
  onBack,
  raceAthleteLookup,
  raceClubLookup,
  onExportPDF,
  onExportResultsPDF,
  onSaveResults,
  savingResults,
  activeRankingSystem,
}) => {
  const [showResultsEntry, setShowResultsEntry] = useState(false);
  const [resultsForm, setResultsForm] = useState({});
  const [timeErrors, setTimeErrors] = useState({});

  // Initialize results form from existing race data
  useEffect(() => {
    if (race?.lanes) {
      const initial = {};
      race.lanes.forEach((lane) => {
        initial[lane.lane] = {
          elapsedTime: lane.result?.elapsedMs
            ? formatElapsedTime(lane.result.elapsedMs)
            : "",
          status: lane.result?.status || "ok",
          notes: lane.result?.notes || "",
        };
      });
      setResultsForm(initial);
    }
  }, [race]);

  // Auto-calculate positions based on times
  const calculatedPositions = useMemo(() => {
    const positions = {};
    const validEntries = [];

    Object.entries(resultsForm).forEach(([laneNum, data]) => {
      const ms = parseTimeToMs(data.elapsedTime);
      if (ms !== undefined && data.status === "ok") {
        validEntries.push({ lane: parseInt(laneNum, 10), ms });
      }
    });

    // Sort by time (fastest first)
    validEntries.sort((a, b) => a.ms - b.ms);

    // Assign positions
    validEntries.forEach((entry, index) => {
      positions[entry.lane] = index + 1;
    });

    return positions;
  }, [resultsForm]);

  const handleResultChange = (laneNum, field, value) => {
    setResultsForm((prev) => ({
      ...prev,
      [laneNum]: {
        ...prev[laneNum],
        [field]: value,
      },
    }));
  };

  const handleTimeBlur = (laneNum) => {
    const currentValue = resultsForm[laneNum]?.elapsedTime || "";

    // If empty, clear any error
    if (!currentValue.trim()) {
      setTimeErrors((prev) => ({ ...prev, [laneNum]: null }));
      return;
    }

    // Auto-format if raw digits
    let valueToValidate = currentValue;
    if (!currentValue.includes(":") && !currentValue.includes(".")) {
      valueToValidate = formatTimeInput(currentValue);
      handleResultChange(laneNum, "elapsedTime", valueToValidate);
    }

    // Validate the time format
    const ms = parseTimeToMs(valueToValidate);
    if (ms === undefined) {
      setTimeErrors((prev) => ({
        ...prev,
        [laneNum]:
          "Invalid format. Use M:SS.cc (e.g., 2:15.34) or SS.cc (e.g., 45.67). Seconds must be < 60.",
      }));
    } else {
      setTimeErrors((prev) => ({ ...prev, [laneNum]: null }));
    }
  };

  const handleSaveResults = async () => {
    // Validate that at least one lane has a valid time for OK status
    const hasValidTime = Object.entries(resultsForm).some(([, data]) => {
      if (data.status !== "ok") return true; // DNS/DNF/DSQ don't need times
      const ms = parseTimeToMs(data.elapsedTime);
      return ms !== undefined && ms > 0;
    });

    if (!hasValidTime) {
      toast.error(
        "Please enter valid times for at least one athlete (format: M:SS.cc or SS.cc)",
      );
      return;
    }

    // Convert form data to API format, using calculated positions
    // NOTE: Backend expects status/finishPosition/elapsedMs at top level, not nested in result
    const lanes = Object.entries(resultsForm).map(([laneNum, data]) => {
      const laneInt = parseInt(laneNum, 10);
      const elapsedMs = parseTimeToMs(data.elapsedTime);
      return {
        lane: laneInt,
        status: data.status || "ok",
        finishPosition: calculatedPositions[laneInt] || undefined,
        elapsedMs: elapsedMs,
        notes: data.notes || undefined,
      };
    });

    await onSaveResults(race._id, lanes, race.status !== "completed");
    setShowResultsEntry(false);
  };

  if (!race) return null;

  const categoryId = toDocumentId(race.category);
  const boatClassId = toDocumentId(race.boatClass);
  const category = categoryId
    ? categories.find((item) => toDocumentId(item) === categoryId)
    : null;
  const boatClass = boatClassId
    ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
    : null;

  const eventCode = generateRaceCode(category, boatClass);
  const eventName = `${category?.titles?.en || "Category"} ${
    boatClass?.names?.en || "Boat"
  }`;

  const raceDate = race.startTime
    ? new Date(race.startTime).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
  const raceTime = race.startTime
    ? new Date(race.startTime).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  const lanes = (race.lanes || []).sort((a, b) => a.lane - b.lane);
  const seedTeams = lanes.filter((l) => l.seed).length;
  const notSeedTeams = lanes.filter((l) => !l.seed).length;

  return (
    <div className="space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Info</h1>
          <span className="text-xl font-semibold text-slate-700">
            {race.name || `Race ${race.order}`}
          </span>
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
              race.status === "completed"
                ? "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20"
                : race.status === "in_progress"
                  ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10"
                  : "bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-500/10"
            }`}
          >
            {race.status || "Scheduled"}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showResultsEntry ? "default" : "outline"}
            onClick={() => setShowResultsEntry(!showResultsEntry)}
          >
            {showResultsEntry ? "Hide Results Entry" : "Enter Results"}
          </Button>
          {race.status === "completed" && (
            <div className="flex gap-1">
              <Button variant="outline" onClick={onExportResultsPDF}>
                Export Results PDF
              </Button>
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-slate-400 opacity-20 hover:opacity-100"
                  onClick={(e) => {
                    if (e.shiftKey) {
                      const mockRace = {
                        ...race,
                        name: "Multi-page Legend Test",
                        lanes: Array.from({ length: 45 }, (_, i) => ({
                          lane: (i % 8) + 1,
                          result: {
                            finishPosition: i + 1,
                            status: "ok",
                            elapsedMs: 120000 + i * 1500,
                          },
                          club: race.lanes?.[0]?.club || {
                            code: "TEST",
                            name: "Test Club",
                          },
                          athlete: race.lanes?.[0]?.athlete || {
                            firstName: "Test",
                            lastName: `Athlete ${i + 1}`,
                          },
                        })),
                      };
                      onExportResultsPDF(mockRace);
                    } else {
                      toast.info(
                        "Shift + Click this button to test multi-page legend placement",
                      );
                    }
                  }}
                  title="Shift + Click to test multi-page export"
                >
                  🧪
                </Button>
              )}
            </div>
          )}
          <Button variant="outline" onClick={onExportPDF}>
            Export Start List
          </Button>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Regatta Code</span>
            <span className="text-slate-600">{competition?.code || "-"}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Regatta Name</span>
            <span className="text-slate-600">
              {competition?.names?.en || "-"}
            </span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Event Code</span>
            <span className="text-slate-600">{eventCode}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Event Name</span>
            <span className="text-slate-600">{eventName}</span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Race Time</span>
            <span className="text-slate-600">{raceTime}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Total Boats</span>
            <span className="text-slate-600">{lanes.length}</span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Seed Teams</span>
            <span className="text-slate-600">{seedTeams}</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Not Seed Teams</span>
            <span className="text-slate-600">{notSeedTeams}</span>
          </div>

          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Prog. System</span>
            <span className="text-slate-600">-</span>
          </div>
          <div className="grid grid-cols-[140px_1fr] gap-2">
            <span className="font-semibold text-slate-900">Legend</span>
            <span className="text-slate-600">
              {race.sessionLabel || "-"}{" "}
              {race.journeyIndex ? `Journey ${race.journeyIndex}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Results Table - shown when race is completed and not in edit mode */}
      {race.status === "completed" && !showResultsEntry && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-900">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Lane</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Athlete</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {(() => {
                // Sort lanes by finish position for results view
                const sortedLanes = [...lanes].sort((a, b) => {
                  const aPos = a.result?.finishPosition ?? 999;
                  const bPos = b.result?.finishPosition ?? 999;
                  if (aPos !== bPos) return aPos - bPos;
                  const aTime = a.result?.elapsedMs ?? Infinity;
                  const bTime = b.result?.elapsedMs ?? Infinity;
                  return aTime - bTime;
                });

                // Find the winning time (first place)
                const winningTime = sortedLanes.find(
                  (l) => l.result?.finishPosition === 1 && l.result?.elapsedMs,
                )?.result?.elapsedMs;

                return sortedLanes.map((lane) => {
                  // Use populated club data directly from lane (backend populates this)
                  const clubName = lane.club?.name || lane.club?.code || "";
                  const clubCode =
                    lane.club?.code || clubName.slice(0, 4).toUpperCase();

                  let athleteName = "Unassigned";
                  // Use populated athlete data directly from lane first
                  const athleteObj =
                    typeof lane.athlete === "object" && lane.athlete?.firstName
                      ? lane.athlete
                      : raceAthleteLookup.get(toDocumentId(lane.athlete));

                  if (athleteObj) {
                    athleteName = formatAthleteName(athleteObj);
                  } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
                    athleteName = lane.crew
                      .map((member) => {
                        // Use populated member data directly first
                        const memberObj =
                          typeof member === "object" && member?.firstName
                            ? member
                            : raceAthleteLookup.get(toDocumentId(member));
                        return memberObj
                          ? formatAthleteName(memberObj)
                          : "Unknown";
                      })
                      .join(", ");
                  }

                  const position = lane.result?.finishPosition;
                  const elapsedMs = lane.result?.elapsedMs;
                  const status = lane.result?.status || "ok";

                  // Calculate time and delta (World Rowing style)
                  const timeStr = elapsedMs
                    ? formatElapsedTime(elapsedMs)
                    : "-";
                  const deltaMs =
                    position > 1 && winningTime && elapsedMs
                      ? elapsedMs - winningTime
                      : null;
                  const deltaStr = deltaMs ? formatDeltaSeconds(deltaMs) : null;

                  return (
                    <tr
                      key={lane.lane}
                      className={
                        status !== "ok"
                          ? "bg-amber-50"
                          : position === 1
                            ? "bg-amber-50"
                            : undefined
                      }
                    >
                      <td className="px-4 py-3">
                        <span
                          className={
                            position === 1
                              ? "font-bold text-amber-600"
                              : position === 2
                                ? "font-semibold text-slate-500"
                                : position === 3
                                  ? "font-semibold text-orange-700"
                                  : ""
                          }
                        >
                          {position || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{lane.lane}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{clubCode}</span>
                        {clubName && clubCode !== clubName && (
                          <span className="ml-2 text-slate-500">
                            {clubName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{athleteName}</td>
                      <td className="px-4 py-3">
                        {status !== "ok" ? (
                          <span className="font-semibold text-red-600">
                            {status.toUpperCase()}
                          </span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-mono font-bold">
                              {timeStr}
                            </span>
                            {deltaStr && (
                              <span className="font-mono text-sm text-slate-500">
                                {deltaStr}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {status === "ok"
                          ? calculatePoints(position, activeRankingSystem)
                          : 0}
                      </td>
                    </tr>
                  );
                });
              })()}
              {lanes.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No participants assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Start List / Entry Table - shown when race is not completed or in edit mode */}
      {(race.status !== "completed" || showResultsEntry) && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 font-semibold text-slate-900">
              <tr>
                <th className="px-4 py-3">Lane</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Athlete</th>
                {showResultsEntry && (
                  <>
                    <th className="px-4 py-3">Position</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Notes</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {lanes.map((lane) => {
                // Use populated club data directly from lane (backend populates this)
                const clubName = lane.club?.name || lane.club?.code || "";
                const clubCode =
                  lane.club?.code || clubName.slice(0, 4).toUpperCase();

                let athleteName = "Unassigned";
                // Use populated athlete data directly from lane first
                const athleteObj =
                  typeof lane.athlete === "object" && lane.athlete?.firstName
                    ? lane.athlete
                    : raceAthleteLookup.get(toDocumentId(lane.athlete));

                if (athleteObj) {
                  athleteName = formatAthleteName(athleteObj);
                } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
                  athleteName = lane.crew
                    .map((member) => {
                      const memberObj =
                        typeof member === "object" && member?.firstName
                          ? member
                          : raceAthleteLookup.get(toDocumentId(member));
                      return memberObj
                        ? formatAthleteName(memberObj)
                        : "Unknown";
                    })
                    .join(", ");
                }

                const formData = resultsForm[lane.lane] || {};
                const timeError = timeErrors[lane.lane];

                return (
                  <tr key={lane.lane}>
                    <td className="px-4 py-3 font-medium">{lane.lane}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{clubCode}</span>
                      {clubName && clubCode !== clubName && (
                        <span className="ml-2 text-slate-500">{clubName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{athleteName}</td>
                    {showResultsEntry && (
                      <>
                        <td className="px-4 py-3">
                          <span
                            className={
                              calculatedPositions[lane.lane] === 1
                                ? "font-bold text-amber-600"
                                : calculatedPositions[lane.lane] === 2
                                  ? "font-semibold text-slate-500"
                                  : calculatedPositions[lane.lane] === 3
                                    ? "font-semibold text-orange-700"
                                    : ""
                            }
                          >
                            {calculatedPositions[lane.lane] || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <Input
                              type="text"
                              className={`w-28 ${
                                timeError
                                  ? "border-red-500 focus:ring-red-500"
                                  : ""
                              }`}
                              value={formData.elapsedTime || ""}
                              onChange={(e) =>
                                handleResultChange(
                                  lane.lane,
                                  "elapsedTime",
                                  e.target.value,
                                )
                              }
                              onBlur={() => handleTimeBlur(lane.lane)}
                              placeholder="M:SS.cc"
                            />
                            {timeError && (
                              <p className="text-xs text-red-600">
                                {timeError}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={formData.status || "ok"}
                            onChange={(e) =>
                              handleResultChange(
                                lane.lane,
                                "status",
                                e.target.value,
                              )
                            }
                            className="w-32"
                          >
                            {LANE_RESULT_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            className="w-32"
                            value={formData.notes || ""}
                            onChange={(e) =>
                              handleResultChange(
                                lane.lane,
                                "notes",
                                e.target.value,
                              )
                            }
                            placeholder="Notes"
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {lanes.length === 0 && (
                <tr>
                  <td
                    colSpan={showResultsEntry ? 7 : 3}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No participants assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {showResultsEntry && lanes.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">
                Enter times in M:SS.cc format (e.g., 2:15.34) or SS.cc (e.g.,
                135.34). Seconds must be less than 60.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResultsEntry(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveResults} disabled={savingResults}>
                  {savingResults
                    ? "Saving..."
                    : "Save Results & Mark Completed"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CompetitionRaces = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { competitionId } = useParams();

  const [competition, setCompetition] = useState(null);
  const [categories, setCategories] = useState([]);
  const [boatClasses, setBoatClasses] = useState([]);
  const [races, setRaces] = useState([]);

  const [loadingCompetition, setLoadingCompetition] = useState(true);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [loadingRegistration, setLoadingRegistration] = useState(false);
  const [registrationStats, setRegistrationStats] = useState(null);
  const [activeRankingSystem, setActiveRankingSystem] = useState(null);
  const initialDataLoadedRef = React.useRef(false);

  const [entrySearchTerm, setEntrySearchTerm] = useState("");
  const [entrySearchResults, setEntrySearchResults] = useState([]);
  const [entrySearchLoading, setEntrySearchLoading] = useState(false);
  const [entrySearchError, setEntrySearchError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [dbEntryOverrides, setDbEntryOverrides] = useState({}); // Stores local edits for DB entries (keyed by entry ID)

  const [autoGenState, setAutoGenState] = useState({
    category: "",
    boatClass: "",
    journeyIndex: "1",
    sessionLabel: "",
    racePrefix: "",
    strategy: "random",
    lanesPerRace: DEFAULT_LANES_PER_RACE.toString(),
    overwriteExisting: true,
    startRaceNumber: "",
    startTime: "",
    intervalMinutes: "10",
    distance: "",
    allowMultipleEntries: false,
  });

  const [submittingAutoGen, setSubmittingAutoGen] = useState(false);

  const [swapState, setSwapState] = useState({
    sourceRaceId: "",
    sourceLane: "",
    targetRaceId: "",
    targetLane: "",
  });
  const [performingSwap, setPerformingSwap] = useState(false);
  const [pendingManualCrew, setPendingManualCrew] = useState([]);

  const requiredCrewSize = useMemo(() => {
    if (!autoGenState.boatClass) return 1;
    const bc = boatClasses.find(
      (b) => toDocumentId(b) === autoGenState.boatClass,
    );
    return bc?.crewSize || 1;
  }, [autoGenState.boatClass, boatClasses]);

  const competitionDocumentId = useMemo(
    () => toDocumentId(competition),
    [competition],
  );

  const allowedCategories = useMemo(() => {
    if (!competition?.allowedCategories?.length) {
      return categories;
    }
    const allowedSet = new Set(
      competition.allowedCategories
        .map((category) => toDocumentId(category))
        .filter(Boolean),
    );
    return categories.filter((category) =>
      allowedSet.has(toDocumentId(category)),
    );
  }, [categories, competition]);

  const allowedBoatClasses = useMemo(() => {
    if (!competition?.allowedBoatClasses?.length) {
      return boatClasses;
    }
    const allowedSet = new Set(
      competition.allowedBoatClasses
        .map((boatClass) => toDocumentId(boatClass))
        .filter(Boolean),
    );
    return boatClasses.filter((boatClass) =>
      allowedSet.has(toDocumentId(boatClass)),
    );
  }, [boatClasses, competition]);

  const eventNumberMap = useMemo(() => {
    const map = new Map();
    // Key: categoryId_boatClassId
    // Value: event number

    // Helper to generate key
    const getKey = (catId, bcId) => `${catId}_${bcId || "null"}`;

    // Collect all unique combinations from races
    const combinations = [];
    const seen = new Set();

    // If we have allowed categories/boat classes, we could use them to define order
    // But usually we want to number the events that actually exist or are allowed.
    // Let's try to build a list of all potential events from allowed lists if available
    if (
      competition?.allowedCategories?.length > 0 &&
      competition?.allowedBoatClasses?.length > 0
    ) {
      competition.allowedCategories.forEach((cat) => {
        competition.allowedBoatClasses.forEach((bc) => {
          const key = getKey(toDocumentId(cat), toDocumentId(bc));
          if (!seen.has(key)) {
            combinations.push({
              cat,
              bc,
              key,
              catAbbr: cat.abbreviation || "",
              bcCode: bc.code || "",
            });
            seen.add(key);
          }
        });
      });
    } else {
      // Fallback: use races
      races.forEach((race) => {
        const catId = toDocumentId(race.category);
        const bcId = toDocumentId(race.boatClass);
        const key = getKey(catId, bcId);
        if (!seen.has(key)) {
          const cat = categories.find((c) => toDocumentId(c) === catId);
          const bc = boatClasses.find((b) => toDocumentId(b) === bcId);
          combinations.push({
            cat,
            bc,
            key,
            catAbbr: cat?.abbreviation || "",
            bcCode: bc?.code || "",
          });
          seen.add(key);
        }
      });
    }

    // Sort combinations
    combinations.sort((a, b) => {
      const catCompare = a.catAbbr.localeCompare(b.catAbbr);
      if (catCompare !== 0) return catCompare;
      return a.bcCode.localeCompare(b.bcCode);
    });

    // Assign numbers
    combinations.forEach((item, index) => {
      map.set(item.key, index + 1);
    });

    return map;
  }, [competition, races, categories, boatClasses]);

  const raceClubLookup = useMemo(() => {
    const map = new Map();
    races.forEach((race) => {
      (race.lanes || []).forEach((lane) => {
        const clubId = toDocumentId(lane?.club);
        if (!clubId) {
          return;
        }
        if (lane.club && typeof lane.club === "object") {
          map.set(clubId, resolveClubLabel(lane.club));
        } else if (!map.has(clubId)) {
          map.set(clubId, `Club ${clubId.slice(-4)}`);
        }
      });
    });
    entries.forEach((entry) => {
      if (entry.clubId && entry.clubName) {
        map.set(entry.clubId, entry.clubName);
      }
    });
    return map;
  }, [entries, races]);

  const raceAthleteLookup = useMemo(() => {
    const map = new Map();
    races.forEach((race) => {
      (race.lanes || []).forEach((lane) => {
        const athleteId = toDocumentId(lane?.athlete);
        if (athleteId && lane.athlete && typeof lane.athlete === "object") {
          map.set(athleteId, lane.athlete);
        }
        if (Array.isArray(lane.crew)) {
          lane.crew.forEach((member) => {
            const memberId = toDocumentId(member);
            if (memberId && typeof member === "object") {
              map.set(memberId, member);
            }
          });
        }
      });
    });
    entries.forEach((entry) => {
      if (entry.athlete) {
        map.set(entry.athleteId, entry.athlete);
      }
    });
    return map;
  }, [entries, races]);

  // Combined stats from registration entries AND race lane assignments
  // This ensures old competitions with races but no formal registrations still show stats
  const combinedStats = useMemo(() => {
    // Merge registration stats with race stats to show all categories
    const athleteIds = new Set();
    const clubIds = new Set();
    const categoryCounts = {};

    // First, add stats from registration entries
    if (registrationStats?.byCategory?.length > 0) {
      registrationStats.byCategory.forEach((cat) => {
        if (!categoryCounts[cat.id]) {
          categoryCounts[cat.id] = {
            id: cat.id,
            name: cat.name,
            count: 0,
            entries: cat.entries || [],
          };
        }
        categoryCounts[cat.id].count += cat.count;
      });
    }

    // Then, add/merge stats from races (for categories not in registration or additional entries)
    if (races && races.length > 0) {
      races.forEach((race) => {
        const catId = toDocumentId(race.category);
        const catObj = race.category;

        // Get category name
        let catName = "Unknown";
        if (catObj && typeof catObj === "object") {
          catName =
            catObj.abbreviation ||
            catObj.titles?.en ||
            catObj.name ||
            "Unknown";
        } else if (catId && categories.length > 0) {
          const foundCat = categories.find((c) => toDocumentId(c) === catId);
          if (foundCat) {
            catName =
              foundCat.abbreviation ||
              foundCat.titles?.en ||
              foundCat.name ||
              "Unknown";
          }
        }

        (race.lanes || []).forEach((lane) => {
          // Count clubs
          const clubId = toDocumentId(lane?.club);
          if (clubId) {
            clubIds.add(clubId);
          }

          // Count athletes from single athlete lanes
          const athleteId = toDocumentId(lane?.athlete);
          if (athleteId) {
            athleteIds.add(athleteId);
          }

          // Count athletes from crew lanes
          if (Array.isArray(lane.crew)) {
            lane.crew.forEach((member) => {
              const memberId = toDocumentId(member);
              if (memberId) {
                athleteIds.add(memberId);
              }
            });
          }

          // Add category from races if not already in categoryCounts
          if (
            (athleteId || (lane.crew && lane.crew.length > 0)) &&
            !categoryCounts[catId]
          ) {
            categoryCounts[catId] = {
              id: catId,
              name: catName,
              count: 0,
              entries: [],
            };
          }
          // Only count race entries if category wasn't in registration stats
          if (
            (athleteId || (lane.crew && lane.crew.length > 0)) &&
            !registrationStats?.byCategory?.some((c) => c.id === catId)
          ) {
            categoryCounts[catId].count++;
          }
        });
      });
    }

    // Calculate totals
    const totalFromCategories = Object.values(categoryCounts).reduce(
      (sum, cat) => sum + cat.count,
      0,
    );

    // Use the maximum between registration stats and race-calculated counts
    // This ensures we show accurate numbers even when races have more entries than registrations
    // (e.g., old competitions where entries were deleted after races were generated)
    const totalAthletes = Math.max(
      registrationStats?.totalAthletes || 0,
      athleteIds.size,
    );
    const totalClubs = Math.max(
      registrationStats?.totalClubs || 0,
      clubIds.size,
    );
    const totalEntries = Math.max(
      registrationStats?.totalEntries || 0,
      totalFromCategories,
    );

    return {
      totalEntries,
      totalAthletes,
      totalClubs,
      byCategory: Object.values(categoryCounts).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }, [registrationStats, races, categories]);

  const loadRegistrationSummary = useCallback(async () => {
    if (!token || !competitionId) return;
    setLoadingRegistration(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (response.ok) {
        // Process stats - include all entries (including withdrawn) for admin management
        const rawEntries = Array.isArray(data.entries) ? data.entries : [];
        // Keep all entries - admins need to see withdrawn ones to delete them
        const allEntries = rawEntries;

        const clubs = new Set();
        const categoryCounts = {};
        let athleteCount = 0;

        allEntries.forEach((entry) => {
          const clubId =
            entry.club?._id ||
            entry.club?.id ||
            (typeof entry.club === "string" ? entry.club : null);
          if (clubId) clubs.add(clubId);

          let catId =
            entry.category?._id ||
            entry.category?.id ||
            (typeof entry.category === "string" ? entry.category : "unknown");

          let catName =
            entry.category?.abbreviation ||
            entry.category?.titles?.en ||
            entry.category?.name ||
            "Unknown";

          // Fallback: if category is just an ID, try to find it in the loaded categories
          if (
            catName === "Unknown" &&
            categories.length > 0 &&
            catId !== "unknown"
          ) {
            const foundCat = categories.find((c) => toDocumentId(c) === catId);
            if (foundCat) {
              catName =
                foundCat.abbreviation ||
                foundCat.titles?.en ||
                foundCat.name ||
                "Unknown";
            }
          }

          if (!categoryCounts[catId]) {
            categoryCounts[catId] = {
              id: catId,
              name: catName,
              count: 0,
              entries: [],
            };
          }
          categoryCounts[catId].count++;
          categoryCounts[catId].entries.push(entry);

          // Count athletes (single or crew)
          if (entry.crew && entry.crew.length > 0) {
            athleteCount += entry.crew.length;
          } else if (entry.athlete) {
            athleteCount += 1;
          }
        });

        const stats = {
          totalEntries: allEntries.length,
          totalAthletes: athleteCount,
          totalClubs: clubs.size,
          byCategory: Object.values(categoryCounts).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
        };

        setRegistrationStats(stats);
        return stats;
      }
      return null;
    } catch (error) {
      console.error("Failed to load registration summary", error);
    } finally {
      setLoadingRegistration(false);
    }
  }, [competitionId, token, categories]);

  const loadRankingSystem = useCallback(async () => {
    if (!token || !competitionId) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rankings/competition/${competitionId}/available-systems`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (response.ok && data.availableSystems?.length > 0) {
        // Pick the first active system as default for point calculation in results
        setActiveRankingSystem(data.availableSystems[0]);
      }
    } catch (error) {
      console.error("Failed to load ranking systems", error);
    }
  }, [competitionId, token]);

  const loadCompetition = useCallback(async () => {
    if (!token || !competitionId) {
      return;
    }
    setLoadingCompetition(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load competition");
      }
      setCompetition(payload);
      setEntries([]);
      setAutoGenState((previous) => ({
        ...previous,
        journeyIndex: "1",
      }));
    } catch (error) {
      console.error("Failed to load competition", error);
      toast.error(error.message);
    } finally {
      setLoadingCompetition(false);
    }
  }, [competitionId, token]);

  const loadReferenceData = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const [categoriesResponse, boatClassesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/categories?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/boat-classes?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const categoriesPayload = await categoriesResponse.json().catch(() => []);
      const boatClassesPayload = await boatClassesResponse
        .json()
        .catch(() => []);
      if (categoriesResponse.ok) {
        setCategories(
          Array.isArray(categoriesPayload) ? categoriesPayload : [],
        );
      }
      if (boatClassesResponse.ok) {
        setBoatClasses(
          Array.isArray(boatClassesPayload) ? boatClassesPayload : [],
        );
      }
    } catch (error) {
      console.error("Failed to load race reference data", error);
    }
  }, [token]);

  const loadRaces = useCallback(async () => {
    if (!token || !competitionId) {
      return;
    }
    setLoadingRaces(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/races`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load races");
      }
      setRaces(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load races", error);
      toast.error(error.message);
    } finally {
      setLoadingRaces(false);
    }
  }, [competitionId, token]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load races, registration, and ranking after reference data is loaded
  useEffect(() => {
    // Only load registration data once when categories are first available
    // to ensure proper category name resolution and prevent duplicate calls
    if (categories.length > 0 && !initialDataLoadedRef.current) {
      initialDataLoadedRef.current = true;
      loadRaces();
      loadRegistrationSummary();
      loadRankingSystem();
    }
  }, [categories, loadRaces, loadRegistrationSummary, loadRankingSystem]);

  useEffect(() => {
    if (!token || !entrySearchTerm.trim()) {
      setEntrySearchResults([]);
      setEntrySearchLoading(false);
      setEntrySearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEntrySearchLoading(true);
      setEntrySearchError(null);
      try {
        const params = new URLSearchParams();
        params.set("q", entrySearchTerm.trim());
        params.set("limit", ENTRY_SEARCH_LIMIT.toString());
        const response = await fetch(
          `${API_BASE_URL}/api/athletes?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const payload = await response.json().catch(() => []);
        if (!response.ok) {
          throw new Error(payload.message || "Failed to search athletes");
        }
        setEntrySearchResults(Array.isArray(payload) ? payload : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to search athletes", error);
          setEntrySearchError(error.message);
        }
      } finally {
        setEntrySearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [entrySearchTerm, token]);

  const handleAutoGenFieldChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setAutoGenState((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear pending crew if category or boat class changes to avoid mismatched segments
    if (name === "category" || name === "boatClass") {
      setPendingManualCrew([]);
    }
  }, []);

  const handleSwapFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setSwapState((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  const handleAddEntry = useCallback(
    async (athlete) => {
      const athleteId = toDocumentId(athlete);
      if (!athleteId) {
        return;
      }

      // Check if age verification should be bypassed (admin/jury only)
      const bypassAge = autoGenState.bypassAgeVerification || false;

      // Validate gender and category if a category is selected
      if (autoGenState.category) {
        const selectedCategory = categories.find(
          (cat) => toDocumentId(cat) === autoGenState.category,
        );

        if (selectedCategory) {
          // Check gender compatibility, but bypass for allowed juniors/masters in senior
          const athleteGender = normalizeGender(athlete.gender);
          const categoryGender = normalizeGender(selectedCategory.gender);
          const catAbbr = (selectedCategory.abbreviation || "").toLowerCase();
          const isSenior =
            (selectedCategory.titles?.en || "")
              .toLowerCase()
              .includes("senior") ||
            catAbbr === "w" ||
            catAbbr === "m" ||
            catAbbr === "sw" ||
            catAbbr === "sm" ||
            catAbbr.startsWith("s");
          const allowJuniors = autoGenState.allowJuniorsInSenior;
          const allowMasters = autoGenState.allowMastersInSenior;
          const isJunior =
            (athlete.category?.toLowerCase?.() || "").includes("junior") ||
            athlete.isJunior === true;
          let isMaster =
            (athlete.category?.toLowerCase?.() || "").includes("master") ||
            athlete.isMaster === true;
          // Use competition's season year for age calculation (important for past competitions)
          const competitionSeason = competition?.season
            ? Number(competition.season)
            : undefined;
          const athleteAge = getAge(athlete, competitionSeason);
          // If age indicates a master (commonly 27+), consider as master
          if (!isMaster && athleteAge !== null && athleteAge >= 27) {
            isMaster = true;
          }

          // Allow any gender for mixed category
          if (categoryGender && categoryGender !== "mixed") {
            // Bypass gender check for allowed juniors/masters in senior
            if (
              !(
                isSenior &&
                ((allowJuniors && isJunior) || (allowMasters && isMaster))
              )
            ) {
              if (athleteGender && athleteGender !== categoryGender) {
                const genderLabel =
                  categoryGender === "women" ? "Women" : "Men";
                toast.error(
                  `${formatAthleteName(
                    athlete,
                  )} cannot be added to a ${genderLabel}'s category`,
                );
                return;
              }
            }
          }

          // Check age compatibility using `getAge` (more robust parsing)
          // Skip age check if bypass is enabled
          if (!bypassAge) {
            // Use competition's season year for age calculation
            const age = getAge(athlete, competitionSeason);
            if (age !== null) {
              const minAge = selectedCategory.minAge;
              const maxAge = selectedCategory.maxAge;
              // Update master detection based on computed age (masters commonly start at 27)
              if (!isMaster && typeof age === "number" && age >= 27) {
                isMaster = true;
              }

              // If category is senior and allowJuniorsInSenior is checked, skip upper age check for juniors
              if (minAge !== undefined && age < minAge) {
                toast.error(
                  `${formatAthleteName(athlete)} is too young for ${
                    selectedCategory.titles?.en || selectedCategory.abbreviation
                  } (minimum age: ${minAge})`,
                );
                return;
              }

              if (
                maxAge !== undefined &&
                age > maxAge &&
                !(
                  isSenior &&
                  ((allowJuniors && isJunior) || (allowMasters && isMaster))
                )
              ) {
                toast.error(
                  `${formatAthleteName(athlete)} is too old for ${
                    selectedCategory.titles?.en || selectedCategory.abbreviation
                  } (maximum age: ${maxAge})`,
                );
                return;
              }
            }
          }
        }
      }

      // Determine club info synchronously
      const nextSeed = (entries || []).length + 1;
      const clubId = deriveClubId(athlete);
      let clubName;
      const memberships = Array.isArray(athlete.memberships)
        ? athlete.memberships
        : [];
      // Always use active membership for club context, prioritizing standard clubs over promotion centers
      const activeMemberships = memberships.filter(
        (membership) => membership?.status === "active" && membership.club,
      );
      // Try to find a 'club' type specifically, otherwise fall back to first active
      const activeMembership =
        activeMemberships.find((m) => m.club?.type === "club") ||
        activeMemberships[0];
      const resolvedClub =
        activeMembership?.club ||
        athlete.club ||
        memberships.find((item) => item?.club)?.club;
      if (resolvedClub) {
        clubName = resolveClubLabel(resolvedClub);
      }

      // Check registrationStats and (if needed) fetch registration summary to
      // see if this athlete is part of a registered crew. Do this before
      // calling setEntries so we don't use `await` inside a state updater.
      let crew = null;
      let crewNumber = undefined;
      try {
        const catId = autoGenState.category;
        if (
          registrationStats &&
          Array.isArray(registrationStats.byCategory) &&
          catId
        ) {
          const catData = registrationStats.byCategory.find(
            (c) => toDocumentId(c.id) === catId,
          );
          if (catData && Array.isArray(catData.entries)) {
            const matched = catData.entries.find((e) => {
              const aId = toDocumentId(e.athlete) || null;
              if (aId && aId === athleteId) return true;
              if (Array.isArray(e.crew) && e.crew.length > 0) {
                return e.crew.some((m) => toDocumentId(m) === athleteId);
              }
              return false;
            });
            if (matched) {
              crew = Array.isArray(matched.crew) ? matched.crew : null;
              crewNumber = matched.crewNumber;
            }
          }
        }
        // If not found in cache, fetch remote registration summary and re-check
        if (!crew) {
          try {
            // Use promise chaining instead of `await` to avoid parser issues
            fetch(
              `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
              .then((resp) => {
                if (!resp.ok) return null;
                return resp.json().catch(() => null);
              })
              .then((payload) => {
                if (!payload) return;
                const remoteEntries = Array.isArray(payload.entries)
                  ? payload.entries
                  : [];
                const matchedRemote = remoteEntries.find((e) => {
                  const aId = toDocumentId(e.athlete) || null;
                  if (aId && aId === athleteId) return true;
                  if (Array.isArray(e.crew) && e.crew.length > 0) {
                    return e.crew.some((m) => toDocumentId(m) === athleteId);
                  }
                  return false;
                });
                if (matchedRemote) {
                  crew = Array.isArray(matchedRemote.crew)
                    ? matchedRemote.crew
                    : null;
                  crewNumber = matchedRemote.crewNumber;
                }
              })
              .catch(() => {
                // ignore fetch errors
              });
          } catch (err) {
            // ignore lookup errors
          }
        }
      } catch (err) {
        // ignore lookup errors
      }

      // Helper to add entry after optionally resolving crew member objects
      const addEntryWithCrew = (crewArr, crewNum) => {
        // Resolve crew members to populated objects where possible
        const resolvedCrew = Array.isArray(crewArr)
          ? crewArr.map((m) => {
              const mid = toDocumentId(m);
              const obj = raceAthleteLookup.get(mid);
              if (obj) return obj;
              if (typeof m === "object" && (m.firstName || m.lastName))
                return m;
              return { _id: mid };
            })
          : [];

        // Collect IDs that still need resolution (no name fields)
        const missingIds = Array.from(
          new Set(
            resolvedCrew
              .filter((r) => r && !r.firstName && !r.lastName && r._id)
              .map((r) => r._id),
          ),
        );

        const finalizeAndSet = (finalCrew) => {
          setEntries((previous) => {
            if (previous.some((entry) => entry.athleteId === athleteId)) {
              toast.warn("Athlete already in start list");
              return previous;
            }
            const seed = previous.length + 1;
            // Always use resolvedClub.code for clubCodeValue
            let clubCodeValue = undefined;
            if (
              resolvedClub &&
              typeof resolvedClub === "object" &&
              resolvedClub.code
            ) {
              clubCodeValue = resolvedClub.code;
            } else {
              clubCodeValue = undefined;
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  "[manual-add] Missing club code for club",
                  resolvedClub,
                );
              }
            }

            // Always assign crew number based on the current club in the race, regardless of athlete's previous club
            let assignedCrewNumber = crewNum;
            if (
              assignedCrewNumber === undefined ||
              assignedCrewNumber === null
            ) {
              // Helper to extract numeric suffix from various crewNumber formats
              const parseCrewNumber = (val) => {
                if (val === undefined || val === null) return null;
                const s = String(val).trim();
                if (!s) return null;
                // Prefer a trailing numeric group (e.g. "CNMT 1", "(CNMT) 1", "1")
                const m = s.match(/(\d+)\s*$/);
                if (m) return Number(m[1]);
                // Try extracting any digits in the value (fallback)
                const digits = s.replace(/[^0-9]/g, "");
                if (digits) {
                  const asNum = Number(digits);
                  return Number.isFinite(asNum) ? asNum : null;
                }
                return null;
              };

              // Build a set of normalized identifiers for a club-like object
              const getClubIdentifiers = (
                clubObj,
                clubIdFallback,
                clubCodeFallback,
                nameFallback,
              ) => {
                const ids = new Set();
                const add = (v) => {
                  if (!v && v !== 0) return;
                  try {
                    const s = String(v).trim().toLowerCase();
                    if (s) ids.add(s);
                  } catch (err) {
                    // ignore
                  }
                };
                if (clubObj) {
                  if (typeof clubObj === "string") add(clubObj);
                  else {
                    add(clubObj._id || clubObj.id);
                    add(clubObj.code);
                    add(clubObj.name);
                    // also add derived code from name
                    try {
                      const derived = makeClubCodeFromName(clubObj.name);
                      if (derived) add(derived);
                    } catch (err) {}
                  }
                }
                // Use the PASSED parameters, not outer scope variables!
                add(clubIdFallback);
                add(clubCodeFallback);
                add(nameFallback);
                return ids;
              };

              // Helper to check if two entries (or an entry and target context) belong to the same club
              const isSameClub = (
                entryClubCode,
                entryClubId,
                targetClubCode,
                targetClubId,
                entryIdentifiers,
                targetIdentifiers,
              ) => {
                // 1. Direct Code Match (strongest signal)
                if (entryClubCode && targetClubCode) {
                  // If both have codes, compare them directly
                  return (
                    String(entryClubCode).trim().toUpperCase() ===
                    String(targetClubCode).trim().toUpperCase()
                  );
                }
                // 2. Direct ID Match (if we have IDs but no codes)
                if (entryClubId && targetClubId) {
                  return String(entryClubId) === String(targetClubId);
                }
                // 3. Fallback: Identifier Intersection (only if no codes and no IDs)
                if (entryIdentifiers && targetIdentifiers) {
                  return [...entryIdentifiers].some((x) =>
                    targetIdentifiers.has(x),
                  );
                }
                return false;
              };

              // Always use resolvedClub (active membership) for club context
              const clubIdStr = clubId ? toDocumentId(clubId) : null;
              const targetIds = getClubIdentifiers(
                resolvedClub,
                clubIdStr,
                clubCodeValue,
                clubName,
              );

              // Only consider entries in the current race for the current club
              const numsFromEntries = previous
                .map((e) => {
                  const entryClubObj = e.club || null;
                  const entryClubId =
                    toDocumentId(e.clubId) || toDocumentId(e.club);
                  const entryClubCode = e.clubCode || e.club?.code;

                  // Optimization: parse number first
                  const num = parseCrewNumber(e.crewNumber);
                  if (!Number.isFinite(num)) return null;

                  const entryClubName = e.clubName || e.club?.name || null;
                  const entryIds = getClubIdentifiers(
                    entryClubObj,
                    entryClubId,
                    entryClubCode,
                    entryClubName,
                  );

                  if (
                    isSameClub(
                      entryClubCode,
                      entryClubId,
                      clubCodeValue,
                      clubIdStr,
                      entryIds,
                      targetIds,
                    )
                  ) {
                    return num;
                  }
                  return null;
                })
                .filter((n) => Number.isFinite(n));

              // Also inspect existing races' lanes - but only in the SAME CATEGORY
              const numsFromRaces = [];
              const currentCategoryId = autoGenState.category;
              try {
                (races || []).forEach((r) => {
                  // Only consider races in the same category
                  const raceCatId = toDocumentId(r.category);
                  if (currentCategoryId && raceCatId !== currentCategoryId) {
                    return; // Skip races from other categories
                  }

                  (r.lanes || []).forEach((lane) => {
                    const laneClubObj = lane?.club || null;
                    const laneClubId = toDocumentId(lane?.club);
                    const laneClubCode = lane?.club?.code || lane?.clubCode;

                    const laneIdentifiers = getClubIdentifiers(
                      laneClubObj,
                      laneClubId,
                      laneClubCode,
                      lane?.clubName || lane?.club?.name,
                    );

                    if (
                      isSameClub(
                        laneClubCode,
                        laneClubId,
                        clubCodeValue,
                        clubIdStr,
                        laneIdentifiers,
                        targetIds,
                      )
                    ) {
                      const n = parseCrewNumber(lane.crewNumber);
                      if (Number.isFinite(n)) numsFromRaces.push(n);
                    }
                  });
                });
              } catch (err) {
                // ignore race scanning errors
              }

              // Inspect registration stats for the same club in this category
              const numsFromRegistrations = [];
              if (
                registrationStats &&
                Array.isArray(registrationStats.byCategory) &&
                autoGenState.category
              ) {
                const catId = autoGenState.category;
                const catData = registrationStats.byCategory.find(
                  (c) => toDocumentId(c.id) === catId,
                );
                if (catData && Array.isArray(catData.entries)) {
                  catData.entries.forEach((e) => {
                    // Skip withdrawn entries - their crew numbers are freed up
                    if (e.status === "withdrawn" || e.status === "rejected") {
                      return;
                    }

                    // Check if entry belongs to the same club
                    const entryClubObj = e.club || null;
                    const entryClubId = toDocumentId(e.club);
                    const entryClubCode = e.clubCode || e.club?.code;

                    const entryIdentifiers = getClubIdentifiers(
                      entryClubObj,
                      entryClubId,
                      entryClubCode,
                      e.clubName || e.club?.name,
                    );

                    const matched = isSameClub(
                      entryClubCode,
                      entryClubId,
                      clubCodeValue,
                      clubIdStr,
                      entryIdentifiers,
                      targetIds,
                    );

                    if (matched) {
                      const n = parseCrewNumber(e.crewNumber);
                      if (Number.isFinite(n)) numsFromRegistrations.push(n);
                    }
                  });
                }
              }

              const allNums = numsFromEntries
                .concat(numsFromRaces)
                .concat(numsFromRegistrations);

              const maxNum = allNums.length ? Math.max(...allNums) : 0;
              // If we found at least one existing numeric crew number, increment
              if (maxNum > 0) {
                assignedCrewNumber = maxNum + 1;
              } else if ((clubIdStr || clubCodeValue) && allNums.length === 0) {
                // If nothing numeric found but we have club context, start at 1
                assignedCrewNumber = 1;
              }
            }

            const newEntry = {
              uid: `manual-${athleteId}`,
              athleteId: athleteId,
              athlete,
              clubId,
              clubName,
              clubCode: clubCodeValue,
              seed,
              notes: "",
            };

            if (finalCrew && finalCrew.length > 0) {
              newEntry.crew = finalCrew;
              newEntry.crewNumber = assignedCrewNumber;
              const firstId = toDocumentId(finalCrew[0]);
              if (firstId) newEntry.athleteId = firstId;
            } else if (
              assignedCrewNumber !== undefined &&
              assignedCrewNumber !== null
            ) {
              // Single-athlete entry but assign crew number for the club
              newEntry.crewNumber = assignedCrewNumber;
            }

            return [...previous, newEntry];
          });
        };

        if (missingIds.length === 0) {
          // Nothing to fetch, finalize immediately
          finalizeAndSet(resolvedCrew);
          return;
        }

        // Try batch-fetching missing athletes by IDs. If the API doesn't
        // support batch, fall back to fetching individually.
        const tryBatchUrl = `${API_BASE_URL}/api/athletes?ids=${missingIds.join(
          ",",
        )}`;
        fetch(tryBatchUrl, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => (r.ok ? r.json().catch(() => []) : null))
          .then((payload) => {
            if (!payload || !Array.isArray(payload) || payload.length === 0) {
              // Batch not available or returned nothing — fetch individually
              return Promise.all(
                missingIds.map((id) =>
                  fetch(`${API_BASE_URL}/api/athletes/${id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                    .then((rr) => (rr.ok ? rr.json().catch(() => null) : null))
                    .catch(() => null),
                ),
              ).then((arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []));
            }
            return payload;
          })
          .then((fetched) => {
            const fetchedArr = Array.isArray(fetched) ? fetched : [];
            // Populate lookup cache and replace placeholders
            fetchedArr.forEach((a) => {
              const id = toDocumentId(a);
              if (id) {
                try {
                  raceAthleteLookup.set(id, a);
                } catch (err) {
                  // ignore mutation errors
                }
              }
            });
            const finalCrew = resolvedCrew.map((r) => {
              if (!r) return r;
              const mid = toDocumentId(r);
              const cached = mid ? raceAthleteLookup.get(mid) : null;
              return cached || r;
            });
            finalizeAndSet(finalCrew);
          })
          .catch(() => {
            // In case of errors, proceed with best-effort resolvedCrew
            finalizeAndSet(resolvedCrew);
          });
      };

      // If we already found crew from registrationStats, add now; otherwise
      // attempt to fetch remote registration and then add when available.
      if (crew) {
        addEntryWithCrew(crew, crewNumber);
      } else {
        if (requiredCrewSize > 1) {
          // Build manual crew
          setPendingManualCrew((prev) => {
            if (prev.some((a) => toDocumentId(a) === athleteId)) {
              toast.warn("Athlete already in pending crew");
              return prev;
            }
            const updated = [...prev, athlete];
            if (updated.length === requiredCrewSize) {
              // Crew complete, finalize
              addEntryWithCrew(updated, undefined);
              return [];
            }
            toast.info(
              `Athlete added to pending crew (${updated.length}/${requiredCrewSize})`,
            );
            return updated;
          });
          return;
        }

        // Remote fetch (promise chain) to find a matching registration entry
        fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
          .then((resp) => (resp.ok ? resp.json().catch(() => null) : null))
          .then((payload) => {
            const remoteEntries = Array.isArray(payload?.entries)
              ? payload.entries
              : [];
            const matchedRemote = remoteEntries.find((e) => {
              const aId = toDocumentId(e.athlete) || null;
              if (aId && aId === athleteId) return true;
              if (Array.isArray(e.crew) && e.crew.length > 0) {
                return e.crew.some((m) => toDocumentId(m) === athleteId);
              }
              return false;
            });
            if (matchedRemote) {
              addEntryWithCrew(matchedRemote.crew, matchedRemote.crewNumber);
            } else {
              addEntryWithCrew(null, undefined);
            }
          })
          .catch(() => {
            addEntryWithCrew(null, undefined);
          });
      }
    },
    [
      autoGenState.category,
      autoGenState.allowJuniorsInSenior,
      autoGenState.allowMastersInSenior,
      autoGenState.bypassAgeVerification,
      categories,
      registrationStats,
      raceAthleteLookup,
      raceClubLookup,
      token,
      competitionId,
      requiredCrewSize,
      setPendingManualCrew,
      competition,
    ],
  );

  const handleRemoveEntry = useCallback((uid) => {
    setEntries((previous) =>
      previous.filter((entry) => entry.uid !== uid && entry.id !== uid),
    );
  }, []);

  const handleWithdrawEntry = useCallback(
    async (entryId) => {
      if (!entryId || !token) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}/withdraw`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to withdraw entry");
        }
        toast.success("Entry withdrawn");
        // Refresh registration data
        const newStats = await loadRegistrationSummary();
        // Re-select category to refresh the start list
        if (autoGenState.category) {
          handleCategorySelect(autoGenState.category, newStats);
        }
      } catch (error) {
        console.error("Failed to withdraw entry", error);
        toast.error(error.message);
      }
    },
    [competitionId, token, loadRegistrationSummary, autoGenState.category],
  );

  const handleDeleteEntry = useCallback(
    async (entryId) => {
      if (!entryId || !token) return;
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to delete entry");
        }
        toast.success("Entry permanently deleted");
        // Refresh registration data
        const newStats = await loadRegistrationSummary();
        // Re-select category to refresh the start list
        if (autoGenState.category) {
          handleCategorySelect(autoGenState.category, newStats);
        }
      } catch (error) {
        console.error("Failed to delete entry", error);
        toast.error(error.message);
      }
    },
    [competitionId, token, loadRegistrationSummary, autoGenState.category],
  );

  const handleEntryFieldChange = useCallback((uid, field, value) => {
    if (!uid) return;

    // Check if it's a database entry (uid starts with "db-")
    if (uid.toString().startsWith("db-")) {
      const realId = uid.replace("db-", "");
      setDbEntryOverrides((prev) => ({
        ...prev,
        [realId]: {
          ...prev[realId],
          [field]: value,
        },
      }));
      return;
    }

    setEntries((previous) =>
      previous.map((entry) => {
        if (entry.uid !== uid) {
          return entry;
        }
        if (field === "seed") {
          const numeric = Number(value);
          return {
            ...entry,
            seed: Number.isFinite(numeric) ? numeric : entry.seed,
          };
        }
        return {
          ...entry,
          [field]: value,
        };
      }),
    );
  }, []);

  const handleClearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  const handleSortBySeed = useCallback(() => {
    setEntries((previous) =>
      [...previous].sort((a, b) => {
        const seedA = Number(a.seed) || 0;
        const seedB = Number(b.seed) || 0;
        return seedA - seedB;
      }),
    );
  }, []);

  const relevantEntries = useMemo(() => {
    // Start with manual entries
    let result = [...entries];

    // Add database entries from registrationStats for the selected category
    if (
      registrationStats &&
      Array.isArray(registrationStats.byCategory) &&
      autoGenState.category
    ) {
      const catId = autoGenState.category;
      const catData = registrationStats.byCategory.find(
        (c) => toDocumentId(c.id) === catId,
      );
      if (catData && Array.isArray(catData.entries)) {
        // Map database entries to the same format as manual entries
        const dbEntries = catData.entries.map((e, idx) => {
          const athleteId = toDocumentId(e.athlete);
          const clubObj = e.club || null;
          const entryId = toDocumentId(e.id || e._id);

          // Apply overrides if any
          const overrides = dbEntryOverrides[entryId] || {};

          // Prefer the athlete's current club / active membership club when present
          const memberships = Array.isArray(e.athlete?.memberships)
            ? e.athlete.memberships
            : [];
          const activeMemberships = memberships.filter(
            (m) => m?.status === "active" && m.club,
          );
          const activeMembership =
            activeMemberships.find((m) => m.club?.type === "club") ||
            activeMemberships[0];
          const resolvedClub =
            activeMembership?.club || e.athlete?.club || clubObj || null;

          return {
            id: entryId, // Database entry ID for withdraw/delete
            uid: `db-${entryId || idx}`,
            athleteId,
            athlete: e.athlete,
            crew: e.crew,
            clubId: toDocumentId(resolvedClub) || toDocumentId(clubObj),
            clubCode: resolvedClub?.code || e.clubCode || clubObj?.code,
            clubName:
              resolveClubLabel(resolvedClub) || e.clubName || clubObj?.name,
            crewNumber: e.crewNumber,
            status: e.status,
            seed:
              overrides.seed !== undefined ? overrides.seed : e.seed || idx + 1,
            notes:
              overrides.notes !== undefined ? overrides.notes : e.notes || "",
            boatClass: e.boatClass,
          };
        });

        // Filter out any database entries that are already in manual entries (by athleteId)
        const manualAthleteIds = new Set(
          result.map((e) => e.athleteId).filter(Boolean),
        );
        const uniqueDbEntries = dbEntries.filter(
          (e) => !manualAthleteIds.has(e.athleteId),
        );

        result = [...result, ...uniqueDbEntries];
      }
    }

    // Filter by boat class if selected
    if (autoGenState.boatClass) {
      result = result.filter((entry) => {
        // Keep entries without boatClass or matching boatClass
        return (
          !entry.boatClass ||
          entry.boatClass.id === autoGenState.boatClass ||
          entry.boatClass === autoGenState.boatClass ||
          toDocumentId(entry.boatClass) === autoGenState.boatClass
        );
      });
    }

    return result;
  }, [
    entries,
    autoGenState.boatClass,
    autoGenState.category,
    registrationStats,
    dbEntryOverrides,
  ]);

  const handleSaveEntries = useCallback(async () => {
    // 1. Identify modified DB entries
    const modifiedIds = Object.keys(dbEntryOverrides);
    // 2. Identify NEW manual entries
    const newManualEntries = entries.filter(
      (e) => e.uid && e.uid.toString().startsWith("manual-"),
    );
    // 3. Identify entries loaded from races (need to be saved as new registration entries)
    const raceLoadedEntries = entries.filter(
      (e) => e.uid && e.uid.toString().startsWith("race-"),
    );

    if (
      modifiedIds.length === 0 &&
      newManualEntries.length === 0 &&
      raceLoadedEntries.length === 0
    ) {
      toast.info("No changes to save");
      return;
    }

    try {
      let successCount = 0;

      // 3. Loop and update each modified DB entry
      for (const id of modifiedIds) {
        const changes = dbEntryOverrides[id];
        // Skip if empty
        if (Object.keys(changes).length === 0) continue;

        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(changes),
          },
        );
        if (!response.ok) {
          const errPayload = await response.json().catch(() => ({}));
          throw new Error(
            errPayload.message || "Failed to save changes for entry",
          );
        }
        successCount++;
      }

      // 4. Create NEW manual entries AND race-loaded entries (Batched by Club)
      const allNewEntries = [...newManualEntries, ...raceLoadedEntries];
      if (allNewEntries.length > 0) {
        // Group by Club ID to satisfy backend requirement for "A club context"
        const entriesByClub = {};
        for (const e of allNewEntries) {
          const cId = e.clubId;
          // If no club ID, we might need a fallback or it will fail.
          // Assuming all valid entries have clubId from selector.
          const key = cId ? String(cId) : "unknown";
          if (!entriesByClub[key]) entriesByClub[key] = [];
          entriesByClub[key].push(e);
        }

        for (const [cId, clubEntries] of Object.entries(entriesByClub)) {
          if (cId === "unknown") {
            // Skipping entries without club context
            console.warn("Skipping entries without club context:", clubEntries);
            continue;
          }

          const payload = {
            entries: clubEntries.map((e) => ({
              athleteId: e.athleteId,
              crewIds: e.crew ? e.crew.map((c) => c.id || c._id) : [],
              categoryId: autoGenState.category,
              boatClassId: autoGenState.boatClass,
              notes: e.notes,
              seed: e.seed,
            })),
            clubId: cId, // Pass clubId so backend resolves context
            bypassEligibility: true, // Allow admins to bypass eligibility rules (e.g. Master in Senior)
            bypassMultipleEntries: autoGenState.allowMultipleEntries, // Allow multiple registrations if checked
          };

          const response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            },
          );

          if (!response.ok) {
            const errPayload = await response.json().catch(() => ({}));
            // Log error but try to continue with other batches?
            // Or throw to stop? Throwing is safer to alert user.
            throw new Error(
              errPayload.message || `Failed to save entries for club ${cId}`,
            );
          }
          successCount += clubEntries.length;
        }

        // Clear manual and race-loaded entries from state as they are now in DB
        setEntries((prev) =>
          prev.filter(
            (e) =>
              !e.uid.toString().startsWith("manual-") &&
              !e.uid.toString().startsWith("race-"),
          ),
        );
      }

      if (successCount > 0) {
        toast.success(`Saved ${successCount} entries`);
        setDbEntryOverrides({}); // Clear overrides
        const newStats = await loadRegistrationSummary(); // Reload to get fresh data
        // Re-apply category select to refresh view
        if (autoGenState.category) {
          handleCategorySelect(autoGenState.category, newStats);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [
    dbEntryOverrides,
    entries,
    competitionId,
    token,
    loadRegistrationSummary,
    autoGenState.category,
    autoGenState.boatClass,
  ]);

  const submitAutoGeneration = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }
    if (!autoGenState.category) {
      toast.error("Select a category before generating races");
      return;
    }
    if (!relevantEntries.length) {
      toast.error("Add at least one athlete entry");
      return;
    }

    // Check for mixed boat classes if no boat class selected
    if (!autoGenState.boatClass) {
      const boatClasses = new Set(
        relevantEntries
          .map((e) => e.boatClass?.id || e.boatClass)
          .filter(Boolean),
      );
      if (boatClasses.size > 1) {
        toast.error(
          "Entries contain multiple boat classes. Please select a specific boat class.",
        );
        return;
      }
    }

    const journeyIndex = Number(autoGenState.journeyIndex);
    if (!Number.isInteger(journeyIndex) || journeyIndex < 1) {
      toast.error("Journey index must be a positive integer");
      return;
    }
    const maxLanes = getMaxLanesForDiscipline(competition?.discipline);
    const lanesPerRace = Number(autoGenState.lanesPerRace);
    if (
      !Number.isInteger(lanesPerRace) ||
      lanesPerRace < 1 ||
      lanesPerRace > maxLanes
    ) {
      toast.error(`Lanes per race must be between 1 and ${maxLanes}`);
      return;
    }

    // Check for existing races that would be overwritten
    if (autoGenState.overwriteExisting) {
      const categoryId = autoGenState.category;
      const boatClassId = autoGenState.boatClass;
      const journeyVal = journeyIndex;

      // Find races that match the filter (same as backend deleteMany filter)
      const matchingRaces = races.filter((r) => {
        const rCatId = toDocumentId(r.category);
        const rBoatId = toDocumentId(r.boatClass);
        const rJourney = r.journeyIndex;

        if (rCatId !== categoryId) return false;
        if (rJourney !== journeyVal) return false;
        if (boatClassId && rBoatId !== boatClassId) return false;
        return true;
      });

      if (matchingRaces.length > 0) {
        const completedRaces = matchingRaces.filter(
          (r) => r.status === "completed",
        );
        const racesWithResults = matchingRaces.filter((r) =>
          r.lanes?.some((l) => l.result?.elapsedMs || l.result?.finishPosition),
        );

        let warningMsg = `This will delete ${matchingRaces.length} existing race(s).`;
        if (completedRaces.length > 0) {
          warningMsg += `\n\n⚠️ ${completedRaces.length} race(s) have status "completed".`;
        }
        if (racesWithResults.length > 0) {
          warningMsg += `\n⚠️ ${racesWithResults.length} race(s) have entered results that will be LOST.`;
        }
        warningMsg += "\n\nAre you sure you want to continue?";

        if (!window.confirm(warningMsg)) {
          return;
        }
      }
    }

    const payload = {
      category: autoGenState.category,
      boatClass: autoGenState.boatClass || undefined,
      journeyIndex,
      sessionLabel: autoGenState.sessionLabel.trim() || undefined,
      racePrefix: autoGenState.racePrefix.trim() || undefined,
      strategy: normaliseStrategy(autoGenState.strategy),
      lanesPerRace,
      overwriteExisting: Boolean(autoGenState.overwriteExisting),
      startRaceNumber: autoGenState.startRaceNumber
        ? Number(autoGenState.startRaceNumber)
        : undefined,
      startTime: autoGenState.startTime || undefined,
      intervalMinutes: autoGenState.intervalMinutes
        ? Number(autoGenState.intervalMinutes)
        : 0,
      distance: autoGenState.distance
        ? Number(autoGenState.distance)
        : undefined,
      entries: relevantEntries.map((entry) => ({
        athleteId: entry.athleteId,
        crew: entry.crew ? entry.crew.map((c) => c.id || c._id) : [],
        crewNumber: entry.crewNumber,
        clubId: entry.clubId || undefined,
        seed: entry.seed,
        notes: entry.notes ? entry.notes.toString().trim() : undefined,
      })),
    };

    setSubmittingAutoGen(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/auto-generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to auto-generate races");
      }
      toast.success("Races generated successfully");

      // Update auto-gen state for the next batch (increment time and race number)
      if (Array.isArray(data) && data.length > 0) {
        const lastRace = data[data.length - 1];
        const nextOrder = (lastRace.order || 0) + 1;

        let nextTimeStr = autoGenState.startTime;
        if (lastRace.startTime) {
          const lastDate = new Date(lastRace.startTime);
          const interval = Number(autoGenState.intervalMinutes) || 0;
          const nextDate = new Date(lastDate.getTime() + interval * 60000);

          // Format for datetime-local input (YYYY-MM-DDThh:mm)
          const pad = (n) => n.toString().padStart(2, "0");
          const year = nextDate.getFullYear();
          const month = pad(nextDate.getMonth() + 1);
          const day = pad(nextDate.getDate());
          const hours = pad(nextDate.getHours());
          const minutes = pad(nextDate.getMinutes());
          nextTimeStr = `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        setAutoGenState((prev) => ({
          ...prev,
          startRaceNumber: nextOrder.toString(),
          startTime: nextTimeStr,
        }));
      }

      // setEntries([]); // Keep entries to allow generating other boat classes
      setEntrySearchTerm("");
      await loadRaces();
      await loadRegistrationSummary(); // Refresh categories overview
    } catch (error) {
      console.error("Failed to auto-generate races", error);
      toast.error(error.message);
    } finally {
      setSubmittingAutoGen(false);
    }
  }, [
    autoGenState,
    competitionDocumentId,
    entries,
    loadRaces,
    loadRegistrationSummary,
    token,
  ]);

  const submitLaneSwap = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }
    const sourceLane = Number(swapState.sourceLane);
    const targetLane = Number(swapState.targetLane);
    if (!swapState.sourceRaceId || !swapState.targetRaceId) {
      toast.error("Select source and target races");
      return;
    }
    if (
      !Number.isInteger(sourceLane) ||
      !Number.isInteger(targetLane) ||
      sourceLane < 1 ||
      sourceLane > 8 ||
      targetLane < 1 ||
      targetLane > 8
    ) {
      toast.error("Lane numbers must be between 1 and 8");
      return;
    }

    setPerformingSwap(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/lane-swaps`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            source: { raceId: swapState.sourceRaceId, lane: sourceLane },
            target: { raceId: swapState.targetRaceId, lane: targetLane },
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to swap lanes");
      }
      toast.success("Lane swap completed");
      await loadRaces();
    } catch (error) {
      console.error("Failed to swap lanes", error);
      toast.error(error.message);
    } finally {
      setPerformingSwap(false);
    }
  }, [competitionDocumentId, loadRaces, swapState, token]);

  const handleDeleteRace = useCallback(
    async (raceId) => {
      // Find the race to check if it has results
      const race = races.find((r) => r._id === raceId);
      const hasResults = race?.lanes?.some(
        (lane) => lane.time || lane.position || lane.status === "finished",
      );

      let confirmMessage = "Are you sure you want to delete this race?";
      if (hasResults) {
        confirmMessage =
          "⚠️ WARNING: This race has results recorded!\n\n" +
          "Deleting it will permanently remove all times and positions.\n\n" +
          "Are you sure you want to delete this race?";
      }

      if (!window.confirm(confirmMessage)) {
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/${raceId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Failed to delete race");
        }
        toast.success("Race deleted successfully");
        await loadRaces();
      } catch (error) {
        console.error("Failed to delete race", error);
        toast.error(error.message);
      }
    },
    [competitionDocumentId, token, loadRaces, races],
  );

  const raceColumns = useMemo(
    () => [
      {
        field: "order",
        headerText: "#",
        width: 60,
        textAlign: "Center",
        template: (props) => (
          <span className="font-semibold text-slate-700">
            {props.order || "-"}
          </span>
        ),
      },
      {
        field: "event",
        headerText: "Event",
        width: 280,
        template: (props) => {
          const categoryId = toDocumentId(props.category);
          const boatClassId = toDocumentId(props.boatClass);
          const category = categoryId
            ? categories.find((item) => toDocumentId(item) === categoryId)
            : null;
          const boatClass = boatClassId
            ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
            : null;

          // Use generateRaceCode for proper World Rowing code formatting (handles lightweight)
          const eventCode = generateRaceCode(category, boatClass);
          const catTitle = category?.titles?.en || "";
          const boatName = boatClass?.names?.en || "";

          return (
            <div className="flex flex-col py-1">
              <span className="font-semibold text-slate-900">
                {eventCode}
                <span className="ml-2 font-normal text-slate-500">
                  {catTitle} {boatName}
                </span>
              </span>
              {(category?.titles?.ar || boatClass?.names?.ar) && (
                <span className="text-xs text-slate-400" dir="rtl">
                  {boatClass?.names?.ar} {category?.titles?.ar}
                </span>
              )}
            </div>
          );
        },
      },
      {
        field: "round",
        headerText: "Round",
        width: 130,
        template: (props) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-700">
              {props.name || "-"}
            </span>
            {props.sessionLabel && (
              <span className="text-xs text-slate-400">
                {props.sessionLabel}
              </span>
            )}
          </div>
        ),
      },
      {
        field: "boats",
        headerText: "Boats",
        width: 70,
        textAlign: "Center",
        template: (props) => {
          const total = (props.lanes || []).length;
          const seeded = (props.lanes || []).filter((l) => l.seed).length;
          return (
            <div className="flex flex-col items-center">
              <span className="font-semibold text-slate-700">{total}</span>
              {seeded > 0 && (
                <span className="text-xs text-slate-400">{seeded} seeded</span>
              )}
            </div>
          );
        },
      },
      {
        field: "journeyIndex",
        headerText: "Journey",
        width: 90,
        textAlign: "Center",
        template: (props) => (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Journey {props.journeyIndex || 1}
          </span>
        ),
      },
      {
        field: "schedule",
        headerText: "Schedule",
        width: 130,
        template: (props) => {
          if (!props.startTime)
            return <span className="text-slate-400">Not set</span>;
          const date = new Date(props.startTime);
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-700">
                {date.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className="text-xs text-slate-500">
                {date.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        },
      },
      {
        field: "distance",
        headerText: "Dist.",
        width: 70,
        textAlign: "Center",
        template: (props) => {
          const dist = props.distanceOverride || competition?.defaultDistance;
          if (!dist) return <span className="text-slate-400">-</span>;
          return (
            <span className="text-sm font-medium text-slate-700">{dist}m</span>
          );
        },
      },
      {
        field: "status",
        headerText: "Status",
        width: 110,
        textAlign: "Center",
        template: (props) => {
          const statusConfig = {
            completed: {
              bg: "bg-emerald-50",
              text: "text-emerald-700",
              ring: "ring-emerald-600/20",
              label: "Completed",
            },
            in_progress: {
              bg: "bg-amber-50",
              text: "text-amber-700",
              ring: "ring-amber-600/20",
              label: "In Progress",
            },
            scheduled: {
              bg: "bg-slate-50",
              text: "text-slate-600",
              ring: "ring-slate-500/10",
              label: "Scheduled",
            },
          };
          const config = statusConfig[props.status] || statusConfig.scheduled;
          return (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text} ring-1 ring-inset ${config.ring}`}
            >
              {config.label}
            </span>
          );
        },
      },
      {
        field: "actions",
        headerText: "",
        width: 140,
        textAlign: "Center",
        template: (props) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 px-2 text-xs"
              onClick={() =>
                navigate(`/competitions/${competitionId}/races/${props._id}`)
              }
            >
              View / Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
              onClick={() => handleDeleteRace(props._id)}
            >
              ✕
            </Button>
          </div>
        ),
      },
    ],
    [boatClasses, categories, handleDeleteRace],
  );

  const sortedRaces = useMemo(() => {
    return races.slice().sort((a, b) => {
      if (a.journeyIndex !== b.journeyIndex) {
        return (a.journeyIndex || 0) - (b.journeyIndex || 0);
      }
      if (a.order !== b.order) {
        return (a.order || 0) - (b.order || 0);
      }
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [races]);

  const filteredEntryResults = useMemo(() => {
    if (!entries.length) {
      return entrySearchResults;
    }
    const existingIds = new Set(entries.map((entry) => entry.athleteId));
    return entrySearchResults.filter((athlete) => {
      const id = toDocumentId(athlete);
      return id && !existingIds.has(id);
    });
  }, [entries, entrySearchResults]);

  const exportStartListPDF = useCallback(
    async (racesToExport = null) => {
      const targetRaces = Array.isArray(racesToExport)
        ? racesToExport
        : sortedRaces;

      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Load images for header/footer
      const headerData = await loadImage("/header.png");
      const footerData = await loadImage("/footer.png");
      const logoData = await loadImage("/logo.png");
      const sponsorData = await loadImage("/sponsors.png");

      // Load Arabic font
      const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Register Arabic font if loaded successfully
      let arabicFontName = null;
      if (arabicFontBase64) {
        try {
          doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
          doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
          arabicFontName = "Amiri";
        } catch (err) {
          console.warn("Could not register Arabic font:", err);
        }
      }

      // Use helvetica as the default font (supports basic Latin characters)
      const fontName = "helvetica";

      const title = competition?.names?.en || competition?.code || "Start List";

      // Calculate header height
      let headerHeight = 30;
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const ratio = imgProps.width / imgProps.height;
        const w = 210;
        const h = w / ratio;
        // Space for header image + separation line + margin
        headerHeight = h + 8;
      }

      let yPos = headerHeight;

      // Map to store clubs per page for legend
      const pageClubsMap = new Map();

      for (let raceIndex = 0; raceIndex < targetRaces.length; raceIndex++) {
        const race = targetRaces[raceIndex];
        if (raceIndex > 0) {
          doc.addPage();
          yPos = headerHeight;
        }

        // Race Header Block
        const categoryId = toDocumentId(race.category);
        const category = categoryId
          ? categories.find((item) => toDocumentId(item) === categoryId)
          : null;

        const boatClassId = toDocumentId(race.boatClass);
        const boatClass = boatClassId
          ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
          : null;

        // --- Race Header (World Rowing Style) ---
        const leftMargin = 14;
        const rightMargin = 196;
        const center = 105;

        // 1. Competition Info (Location | Date)
        doc.setFontSize(10);
        doc.setFont(fontName, "normal");
        doc.setTextColor(0, 0, 0);

        let compLocation = "Location";
        if (competition?.location) {
          if (typeof competition.location === "string") {
            compLocation = competition.location;
          } else if (typeof competition.location === "object") {
            compLocation =
              competition.location.name ||
              competition.location.city ||
              competition.venue ||
              "Location";
          }
        } else if (competition?.venue) {
          compLocation = String(competition.venue);
        }

        doc.text(String(compLocation), leftMargin, yPos);
        // Competition title centered
        const compTitle = competition?.names?.en || competition?.code || "";
        doc.text(String(compTitle), center, yPos, { align: "center" });
        doc.text(String(dateStr), rightMargin, yPos, { align: "right" });

        yPos += 3;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(leftMargin, yPos, rightMargin, yPos);
        yPos += 8;

        // 2. Event Header Row: Event Num | Start List | Event Code
        const eventKey = `${categoryId}_${boatClassId || "null"}`;
        const eventNum =
          eventNumberMap.get(eventKey) ||
          category?.order ||
          category?.number ||
          "1";

        doc.setFontSize(16);
        doc.setFont(fontName, "bold");
        doc.text(String(eventNum), leftMargin, yPos);

        doc.setFontSize(18);
        doc.text("Start List", center, yPos, { align: "center" });

        const eventCode = generateRaceCode(category, boatClass);
        doc.setFontSize(16);
        doc.text(String(eventCode), rightMargin, yPos, { align: "right" });

        // 3. Second Row: (Event) | Category Name | Phase
        yPos += 6;
        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text("(Event)", leftMargin, yPos);

        const catTitle = category?.titles?.en || "Category";
        const boatTitle = boatClass?.names?.en || "";
        const fullEventName = `${catTitle} ${boatTitle}`.trim();

        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text(fullEventName, center, yPos, { align: "center" });

        const phaseName = race.phase || "BM 1";
        doc.text(String(phaseName), rightMargin, yPos, { align: "right" });

        // Arabic subtitle using Arabic font
        const catTitleAr = category?.titles?.ar || "";
        const boatTitleAr = boatClass?.names?.ar || "";
        const fullEventNameAr = `${catTitleAr} ${boatTitleAr}`.trim();

        if (fullEventNameAr && arabicFontName) {
          yPos += 5;
          doc.setFontSize(11);
          doc.setFont(arabicFontName, "normal");
          doc.text(fullEventNameAr, center, yPos, { align: "center" });
          doc.setFont(fontName, "normal"); // Reset to default font
          yPos += 3; // Extra space after Arabic
        }

        // 4. Third Row: Start Time | As of Date | Race X
        yPos += 5;
        doc.setFontSize(10);
        doc.setFont(fontName, "normal");

        let startTimeStr = "09:00";
        if (race.startTime) {
          const d = new Date(race.startTime);
          const hours = d.getHours().toString().padStart(2, "0");
          const minutes = d.getMinutes().toString().padStart(2, "0");
          startTimeStr = `${hours}:${minutes}`;
        }

        doc.text(`Start Time: ${startTimeStr}`, leftMargin, yPos);
        doc.text(`As of ${dateStr}`, center, yPos, { align: "center" });

        const raceNum = race.order || race.number || "1";
        doc.setFont(fontName, "bold");
        doc.text(`Race ${raceNum}`, rightMargin, yPos, { align: "right" });

        yPos += 8;

        // 5. Table
        const tableBody = (race.lanes || [])
          .sort((a, b) => a.lane - b.lane)
          .map((lane) => {
            let athleteName = "Unassigned";
            const athleteId = toDocumentId(lane?.athlete);
            const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

            if (athlete) {
              athleteName = formatAthleteName(athlete);
            } else if (Array.isArray(lane?.crew) && lane.crew.length > 0) {
              athleteName = lane.crew
                .map((member, index, arr) => {
                  const mId = toDocumentId(member);
                  const m = mId
                    ? raceAthleteLookup.get(mId)
                    : typeof member === "object"
                      ? member
                      : null;
                  const name = m ? formatAthleteName(m) : "Unknown";
                  let pos = "";
                  if (arr.length > 1) {
                    if (index === 0) pos = "(b) ";
                    else if (index === arr.length - 1) pos = "(s) ";
                    else pos = `(${index + 1}) `;
                  }
                  return `${pos}${name}`;
                })
                .join("\n");
            }

            const clubId = toDocumentId(lane?.club);
            const clubName = clubId
              ? raceClubLookup.get(clubId)
              : lane?.club?.code || "";
            let clubCode =
              lane?.club?.code || clubName.slice(0, 3).toUpperCase();
            if (lane.crewNumber) {
              clubCode += ` (${lane.crewNumber})`;
            }

            let license = "";
            let dob = "";

            if (athlete) {
              license = athlete.licenseNumber || "";
              dob = athlete.birthDate
                ? new Date(athlete.birthDate).toLocaleDateString("en-GB")
                : "";
            } else if (Array.isArray(lane?.crew) && lane.crew.length > 0) {
              const members = lane.crew
                .map((m) => {
                  const mId = toDocumentId(m);
                  return mId
                    ? raceAthleteLookup.get(mId)
                    : typeof m === "object"
                      ? m
                      : null;
                })
                .filter(Boolean);
              license = members.map((m) => m.licenseNumber || "-").join("\n");
              dob = members
                .map((m) =>
                  m.birthDate
                    ? new Date(m.birthDate).toLocaleDateString("en-GB")
                    : "-",
                )
                .join("\n");
            }

            return [lane.lane, clubCode, athleteName, license, dob];
          });

        autoTable(doc, {
          startY: yPos,
          head: [["Lane", "Club", "Name", "License", "DOB"]],
          body: tableBody,
          theme: "plain",
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
          },
          bodyStyles: {
            textColor: [0, 0, 0],
            lineWidth: 0,
          },
          columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 30, fontStyle: "bold" },
            2: { cellWidth: "auto" },
            3: { cellWidth: 25, halign: "center" },
            4: { cellWidth: 25, halign: "center" },
          },
          styles: {
            fontSize: 10,
            cellPadding: 3,
            font: fontName,
          },
          margin: {
            left: leftMargin,
            right: 14,
            bottom: 30,
            top: headerHeight,
          },
          didDrawPage: (data) => {
            yPos = data.cursor.y;
          },
          didParseCell: (data) => {
            if (data.section === "head") {
              data.cell.styles.lineWidth = {
                top: 0.1,
                bottom: 0.1,
                left: 0.1,
                right: 0.1,
              };
            }
          },
        });

        yPos = doc.lastAutoTable.finalY + 8;

        // Progression Rule Box
        doc.setDrawColor(0);
        doc.setLineWidth(0.3);
        doc.rect(leftMargin, yPos, 182, 7);
        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text(
          "Progression System: 1-2 to Final A, 3-4 to Final B, others eliminated.",
          leftMargin + 2,
          yPos + 5,
        );

        // Collect clubs for this race (will be drawn in footer)
        const raceClubs = [];
        (race.lanes || []).forEach((lane) => {
          if (lane?.club && typeof lane.club === "object") {
            const clubId = toDocumentId(lane.club);
            if (clubId && !raceClubs.find((c) => toDocumentId(c) === clubId)) {
              raceClubs.push(lane.club);
            }
          }
        });
        // Store clubs for this page (page index = raceIndex + 1)
        pageClubsMap.set(raceIndex + 1, raceClubs);
      }

      // --- Post-Processing: Add Header & Footer to ALL Pages ---
      const pageCount = doc.internal.getNumberOfPages();
      const pageHeight = doc.internal.pageSize.height;

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // --- Header ---
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const ratio = imgProps.width / imgProps.height;
          const w = 210;
          const h = w / ratio;
          doc.addImage(headerData, "PNG", 0, 0, w, h);
          // Draw separation line below header (dark red/maroon like original)
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(14, h + 2, 196, h + 2);
        } else if (logoData) {
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, 210, 25, "F");
          const imgProps = doc.getImageProperties(logoData);
          const ratio = imgProps.width / imgProps.height;
          let w = 20;
          let h = 20;
          if (ratio > 1) h = w / ratio;
          else w = h * ratio;
          doc.addImage(logoData, "PNG", 14, 2.5, w, h);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(title, 40, 15);
          // Draw separation line
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(14, 24, 196, 24);
        }

        // --- Club Legend Box (above footer) ---
        const pageClubs = pageClubsMap.get(i) || [];
        if (pageClubs.length > 0 && i === pageCount) {
          const clubs = [...pageClubs].sort((a, b) => {
            const codeA = a.code || "";
            const codeB = b.code || "";
            return codeA.localeCompare(codeB);
          });

          const lineHeight = 5;
          const boxHeight = clubs.length * lineHeight + 10;
          const legendY = pageHeight - 38 - boxHeight;

          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(14, legendY, 182, boxHeight);

          // Legend title
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("Legend:", 16, legendY + 5);

          // Club entries
          doc.setFontSize(8);
          let clubY = legendY + 10;

          for (const club of clubs) {
            const code = club.code || "---";
            const frenchName =
              club.name || club.names?.fr || club.names?.en || "";
            const arabicName = club.nameAr || club.names?.ar || "";

            // CODE: French Name : Arabic Name
            doc.setFont("helvetica", "bold");
            doc.text(code + ": ", 18, clubY);

            const codeWidth = doc.getTextWidth(code + ": ");
            doc.setFont("helvetica", "normal");
            doc.text(frenchName, 18 + codeWidth, clubY);

            // Arabic name
            if (arabicName && arabicFontName) {
              const frenchWidth = doc.getTextWidth(frenchName);
              doc.setFont(arabicFontName, "normal");
              doc.text(" : " + arabicName, 18 + codeWidth + frenchWidth, clubY);
              doc.setFont("helvetica", "normal");
            }

            clubY += lineHeight;
          }
        }

        // --- Footer ---
        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const ratio = imgProps.width / imgProps.height;
          const w = 210;
          const h = w / ratio;
          // Draw separation line above footer
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(14, pageHeight - h - 3, 196, pageHeight - h - 3);
          // Footer image
          doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
          // Small page number below the line, above the footer image
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Page ${i} of ${pageCount}`, 196, pageHeight - h - 6, {
            align: "right",
          });
        } else if (sponsorData) {
          const imgProps = doc.getImageProperties(sponsorData);
          const ratio = imgProps.width / imgProps.height;
          let w = 180;
          let h = w / ratio;
          if (h > 20) {
            h = 20;
            w = h * ratio;
          }
          const x = 14 + (180 - w) / 2;
          // Draw separation line above sponsors
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(14, pageHeight - h - 8, 196, pageHeight - h - 8);
          // Sponsors image
          doc.addImage(sponsorData, "PNG", x, pageHeight - h - 3, w, h);
          // Small page number
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Page ${i} of ${pageCount}`, 196, pageHeight - h - 11, {
            align: "right",
          });
        } else {
          // No footer images - draw simple footer line and page number
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(14, pageHeight - 15, 196, pageHeight - 15);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Page ${i} of ${pageCount}`, 196, pageHeight - 8, {
            align: "right",
          });
        }
      }

      doc.save(`StartList_${competition?.code || "Competition"}.pdf`);
    },
    [
      sortedRaces,
      competition,
      categories,
      boatClasses,
      raceAthleteLookup,
      raceClubLookup,
      eventNumberMap,
    ],
  );

  const exportResultsPDF = useCallback(
    async (race) => {
      if (!race) return;

      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Load images for header/footer
      const headerData = await loadImage("/header.png");
      const footerData = await loadImage("/footer.png");
      const logoData = await loadImage("/logo.png");
      const sponsorData = await loadImage("/sponsors.png");

      // Load Arabic font
      const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Register Arabic font if loaded successfully
      let arabicFontName = null;
      if (arabicFontBase64) {
        try {
          doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
          doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
          arabicFontName = "Amiri";
        } catch (err) {
          console.warn("Could not register Arabic font:", err);
        }
      }

      const fontName = "helvetica";
      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 14;
      const rightMargin = 196;
      const center = 105;

      // Calculate header height
      let headerHeight = 30;
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        headerHeight = h + 8;
      }

      let yPos = headerHeight;

      // Race info
      const categoryId = toDocumentId(race.category);
      const category = categoryId
        ? categories.find((item) => toDocumentId(item) === categoryId)
        : null;
      const boatClassId = toDocumentId(race.boatClass);
      const boatClass = boatClassId
        ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
        : null;

      // --- Race Header (World Rowing Style) ---
      // 1. Competition Info (Location | Date)
      doc.setFontSize(9);
      doc.setFont(fontName, "normal");
      doc.setTextColor(0, 0, 0);

      let compLocation = "Location";
      if (competition?.location) {
        if (typeof competition.location === "string") {
          compLocation = competition.location;
        } else if (typeof competition.location === "object") {
          compLocation =
            competition.location.name ||
            competition.location.city ||
            competition.venue ||
            "Location";
        }
      } else if (competition?.venue) {
        compLocation = String(competition.venue);
      }

      doc.text(String(compLocation), leftMargin, yPos);
      const compTitle = competition?.names?.en || competition?.code || "";
      doc.text(String(compTitle), center, yPos, { align: "center" });
      doc.text(String(dateStr), rightMargin, yPos, { align: "right" });

      yPos += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(leftMargin, yPos, rightMargin, yPos);
      yPos += 5;

      // 2. Event Header Row: Event Num | Results | Event Code
      const eventKey = `${categoryId}_${boatClassId || "null"}`;
      const eventNum =
        eventNumberMap.get(eventKey) ||
        category?.order ||
        category?.number ||
        "1";

      doc.setFontSize(14);
      doc.setFont(fontName, "bold");
      doc.text(String(eventNum), leftMargin, yPos);

      doc.setFontSize(16);
      doc.text("Results", center, yPos, { align: "center" });

      const eventCode = generateRaceCode(category, boatClass);
      doc.setFontSize(14);
      doc.text(String(eventCode), rightMargin, yPos, { align: "right" });

      // 3. Second Row: (Event) | Category Name | Phase
      yPos += 4;
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      doc.text("(Event)", leftMargin, yPos);

      const catTitle = category?.titles?.en || "Category";
      const boatTitle = boatClass?.names?.en || "";
      const fullEventName = `${catTitle} ${boatTitle}`.trim();

      doc.setFontSize(11);
      doc.setFont(fontName, "bold");
      doc.text(fullEventName, center, yPos, { align: "center" });

      const phaseName = race.phase || "BM 1";
      doc.text(String(phaseName), rightMargin, yPos, { align: "right" });

      // Arabic subtitle using Arabic font
      const catTitleAr = category?.titles?.ar || "";
      const boatTitleAr = boatClass?.names?.ar || "";
      const fullEventNameAr = `${catTitleAr} ${boatTitleAr}`.trim();

      if (fullEventNameAr && arabicFontName) {
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont(arabicFontName, "normal");
        doc.text(fullEventNameAr, center, yPos, { align: "center" });
        doc.setFont(fontName, "normal");
        yPos += 2;
      }

      // 4. Third Row: Start Time | As of Date | Race X
      yPos += 3;
      doc.setFontSize(9);
      doc.setFont(fontName, "normal");

      let startTimeStr = "09:00";
      if (race.startTime) {
        const d = new Date(race.startTime);
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        startTimeStr = `${hours}:${minutes}`;
      }

      doc.text(`Start Time: ${startTimeStr}`, leftMargin, yPos);
      doc.text(`As of ${dateStr}`, center, yPos, { align: "center" });

      const raceNum = race.order || race.number || "1";
      doc.setFont(fontName, "bold");
      doc.text(`Race ${raceNum}`, rightMargin, yPos, { align: "right" });

      yPos += 5;

      // Sort lanes by finish position (results)
      const sortedLanes = [...(race.lanes || [])].sort((a, b) => {
        const aPos = a.result?.finishPosition ?? 999;
        const bPos = b.result?.finishPosition ?? 999;
        if (aPos !== bPos) return aPos - bPos;
        const aTime = a.result?.elapsedMs ?? Infinity;
        const bTime = b.result?.elapsedMs ?? Infinity;
        return aTime - bTime;
      });

      // Find the winning time (first place)
      const winningTime = sortedLanes.find(
        (l) => l.result?.finishPosition === 1 && l.result?.elapsedMs,
      )?.result?.elapsedMs;

      // Build table data (World Rowing style)
      const tableBody = sortedLanes.map((lane) => {
        const clubId = toDocumentId(lane.club);
        const clubCode =
          lane.club?.code ||
          (clubId ? raceClubLookup.get(clubId)?.slice(0, 3).toUpperCase() : "");

        let athleteName = "Unassigned";
        const athleteId = toDocumentId(lane.athlete);
        const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

        if (athlete) {
          athleteName = formatAthleteName(athlete);
        } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
          athleteName = lane.crew
            .map((m, index, arr) => {
              const mId = toDocumentId(m);
              const member = mId ? raceAthleteLookup.get(mId) : null;
              const name = member ? formatAthleteName(member) : "Unknown";
              let pos = "";
              if (arr.length > 1) {
                if (index === 0) pos = "(b) ";
                else if (index === arr.length - 1) pos = "(s) ";
                else pos = `(${index + 1}) `;
              }
              return `${pos}${name}`;
            })
            .join("\n");
        }

        const position = lane.result?.finishPosition || "-";
        const elapsedMs = lane.result?.elapsedMs;
        const status = lane.result?.status || "ok";

        // Time with delta below for 2nd+
        let timeDisplay = "-";
        if (status !== "ok") {
          timeDisplay = status.toUpperCase();
        } else if (elapsedMs) {
          timeDisplay = formatElapsedTime(elapsedMs);
          if (position > 1 && winningTime) {
            const deltaMs = elapsedMs - winningTime;
            const deltaStr = formatDeltaSeconds(deltaMs);
            if (deltaStr) {
              timeDisplay += `\n${deltaStr}`;
            }
          }
        }

        const points =
          status === "ok" ? calculatePoints(position, activeRankingSystem) : 0;

        return [
          position,
          lane.lane,
          clubCode,
          athleteName,
          timeDisplay,
          points,
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Rank", "Lane", "Club", "Name", "Time", "Points"]],
        body: tableBody,
        theme: "plain",
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineWidth: 0.1,
          lineColor: [0, 0, 0],
        },
        bodyStyles: {
          textColor: [0, 0, 0],
          lineWidth: 0,
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 14, halign: "center" },
          2: { cellWidth: 25, fontStyle: "bold" },
          3: { cellWidth: "auto" },
          4: { cellWidth: 35, halign: "right" },
          5: { cellWidth: 20, halign: "center" },
        },
        styles: {
          fontSize: 8,
          cellPadding: 1,
          font: fontName,
        },
        margin: { left: leftMargin, right: 14, bottom: 30, top: headerHeight },
        didDrawPage: (data) => {
          yPos = data.cursor.y;
        },
        didParseCell: (data) => {
          if (data.section === "head") {
            data.cell.styles.lineWidth = {
              top: 0.1,
              bottom: 0.1,
              left: 0.1,
              right: 0.1,
            };
          }
        },
      });

      yPos = doc.lastAutoTable.finalY + 8;

      // Progression Rule Box (optional for results)
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(leftMargin, yPos, 182, 7);
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      doc.text("Official Results - Times are final.", leftMargin + 2, yPos + 5);

      // Collect clubs for legend
      const raceClubs = [];
      (race.lanes || []).forEach((lane) => {
        if (lane?.club && typeof lane.club === "object") {
          const clubId = toDocumentId(lane.club);
          if (clubId && !raceClubs.find((c) => toDocumentId(c) === clubId)) {
            raceClubs.push(lane.club);
          }
        }
      });

      // --- Post-Processing: Add Header & Footer ---
      const pageCount = doc.internal.getNumberOfPages();

      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // --- Header ---
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const ratio = imgProps.width / imgProps.height;
          const w = pageWidth;
          const h = w / ratio;
          doc.addImage(headerData, "PNG", 0, 0, w, h);
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 2, rightMargin, h + 2);
        } else if (logoData) {
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pageWidth, 25, "F");
          const imgProps = doc.getImageProperties(logoData);
          const ratio = imgProps.width / imgProps.height;
          let w = 20;
          let h = 20;
          if (ratio > 1) h = w / ratio;
          else w = h * ratio;
          doc.addImage(logoData, "PNG", leftMargin, 2.5, w, h);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(competition?.names?.en || "Results", 40, 15);
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, 24, rightMargin, 24);
        }

        // --- Club Legend Box (above footer) ---
        if (raceClubs.length > 0 && i === pageCount) {
          const clubs = [...raceClubs].sort((a, b) => {
            const codeA = a.code || "";
            const codeB = b.code || "";
            return codeA.localeCompare(codeB);
          });

          const lineHeight = 4;
          const boxHeight = clubs.length * lineHeight + 7;
          const legendY = pageHeight - 38 - boxHeight;

          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(leftMargin, legendY, 182, boxHeight);

          // Legend title
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("Legend:", leftMargin + 2, legendY + 5);

          // Club entries
          doc.setFontSize(8);
          let clubY = legendY + 9;

          for (const club of clubs) {
            const code = club.code || "---";
            const frenchName =
              club.name || club.names?.fr || club.names?.en || "";
            const arabicName = club.nameAr || club.names?.ar || "";

            // CODE: French Name : Arabic Name
            doc.setFont("helvetica", "bold");
            doc.text(code + ": ", leftMargin + 4, clubY);

            const codeWidth = doc.getTextWidth(code + ": ");
            doc.setFont("helvetica", "normal");
            doc.text(frenchName, leftMargin + 4 + codeWidth, clubY);

            // Arabic name
            if (arabicName && arabicFontName) {
              const frenchWidth = doc.getTextWidth(frenchName);
              doc.setFont(arabicFontName, "normal");
              doc.text(
                " : " + arabicName,
                leftMargin + 4 + codeWidth + frenchWidth,
                clubY,
              );
              doc.setFont("helvetica", "normal");
            }

            clubY += lineHeight;
          }
        }

        // --- Footer ---
        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const ratio = imgProps.width / imgProps.height;
          const w = pageWidth;
          const h = w / ratio;
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 3,
            rightMargin,
            pageHeight - h - 3,
          );
          doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 6,
            {
              align: "right",
            },
          );
        } else if (sponsorData) {
          const imgProps = doc.getImageProperties(sponsorData);
          const ratio = imgProps.width / imgProps.height;
          let w = 180;
          let h = w / ratio;
          if (h > 20) {
            h = 20;
            w = h * ratio;
          }
          const x = leftMargin + (180 - w) / 2;
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 8,
            rightMargin,
            pageHeight - h - 8,
          );
          doc.addImage(sponsorData, "PNG", x, pageHeight - h - 3, w, h);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 11,
            {
              align: "right",
            },
          );
        } else {
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, pageHeight - 15, rightMargin, pageHeight - 15);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
            align: "right",
          });
        }
      }

      const raceCode = generateRaceCode(category, boatClass);
      const raceName = race.name || `Race ${race.order}`;
      doc.save(
        `Results_${competition?.code || "Comp"}_${raceCode}_${raceName.replace(
          /\s+/g,
          "_",
        )}.pdf`,
      );
    },
    [
      competition,
      categories,
      boatClasses,
      raceAthleteLookup,
      raceClubLookup,
      eventNumberMap,
    ],
  );

  // Export all results to a single PDF
  const exportAllResultsPDF = useCallback(async () => {
    // Filter races that have results (completed or have times)
    const racesWithResults = sortedRaces.filter((race) => {
      const hasResults = race.lanes?.some(
        (lane) =>
          lane.result?.finishPosition ||
          lane.result?.elapsedMs ||
          lane.result?.status === "ok",
      );
      return race.status === "completed" || hasResults;
    });

    if (racesWithResults.length === 0) {
      toast.info("No races with results to export");
      return;
    }

    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // Load images for header/footer
    const headerData = await loadImage("/header.png");
    const footerData = await loadImage("/footer.png");
    const logoData = await loadImage("/logo.png");
    const sponsorData = await loadImage("/sponsors.png");

    // Load Arabic font
    const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Register Arabic font if loaded successfully
    let arabicFontName = null;
    if (arabicFontBase64) {
      try {
        doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
        arabicFontName = "Amiri";
      } catch (err) {
        console.warn("Could not register Arabic font:", err);
      }
    }

    const fontName = "helvetica";
    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 14;
    const rightMargin = 196;
    const center = 105;

    // Calculate header height
    let headerHeight = 30;
    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      const ratio = imgProps.width / imgProps.height;
      const w = pageWidth;
      const h = w / ratio;
      headerHeight = h + 8;
    }

    let isFirstRace = true;

    for (const race of racesWithResults) {
      if (!isFirstRace) {
        doc.addPage();
      }
      isFirstRace = false;

      let yPos = headerHeight;

      // Race info
      const categoryId = toDocumentId(race.category);
      const category = categoryId
        ? categories.find((item) => toDocumentId(item) === categoryId)
        : null;
      const boatClassId = toDocumentId(race.boatClass);
      const boatClass = boatClassId
        ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
        : null;

      // --- Race Header ---
      doc.setFontSize(10);
      doc.setFont(fontName, "normal");
      doc.setTextColor(0, 0, 0);

      let compLocation = "Location";
      if (competition?.location) {
        if (typeof competition.location === "string") {
          compLocation = competition.location;
        } else if (typeof competition.location === "object") {
          compLocation =
            competition.location.name ||
            competition.location.city ||
            competition.venue ||
            "Location";
        }
      } else if (competition?.venue) {
        compLocation = String(competition.venue);
      }

      doc.text(String(compLocation), leftMargin, yPos);
      const compTitle = competition?.names?.en || competition?.code || "";
      doc.text(String(compTitle), center, yPos, { align: "center" });
      doc.text(String(dateStr), rightMargin, yPos, { align: "right" });

      yPos += 3;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(leftMargin, yPos, rightMargin, yPos);
      yPos += 8;

      // Event Header
      const eventKey = `${categoryId}_${boatClassId || "null"}`;
      const eventNum =
        eventNumberMap.get(eventKey) ||
        category?.order ||
        category?.number ||
        "1";

      doc.setFontSize(16);
      doc.setFont(fontName, "bold");
      doc.text(String(eventNum), leftMargin, yPos);

      doc.setFontSize(18);
      doc.text("Results", center, yPos, { align: "center" });

      const eventCode = generateRaceCode(category, boatClass);
      doc.setFontSize(16);
      doc.text(String(eventCode), rightMargin, yPos, { align: "right" });

      yPos += 6;
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      doc.text("(Event)", leftMargin, yPos);

      const catTitle = category?.titles?.en || "Category";
      const boatTitle = boatClass?.names?.en || "";
      const fullEventName = `${catTitle} ${boatTitle}`.trim();

      doc.setFontSize(12);
      doc.setFont(fontName, "bold");
      doc.text(fullEventName, center, yPos, { align: "center" });

      const phaseName = race.name || "Final";
      doc.text(String(phaseName), rightMargin, yPos, { align: "right" });

      // Arabic subtitle
      const catTitleAr = category?.titles?.ar || "";
      const boatTitleAr = boatClass?.names?.ar || "";
      const fullEventNameAr = `${catTitleAr} ${boatTitleAr}`.trim();

      if (fullEventNameAr && arabicFontName) {
        yPos += 5;
        doc.setFontSize(11);
        doc.setFont(arabicFontName, "normal");
        doc.text(fullEventNameAr, center, yPos, { align: "center" });
        doc.setFont(fontName, "normal");
        yPos += 3;
      }

      yPos += 5;
      doc.setFontSize(10);
      doc.setFont(fontName, "normal");

      let startTimeStr = "09:00";
      if (race.startTime) {
        const d = new Date(race.startTime);
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        startTimeStr = `${hours}:${minutes}`;
      }

      doc.text(`Start Time: ${startTimeStr}`, leftMargin, yPos);
      doc.text(`Race ${race.order || "-"}`, rightMargin, yPos, {
        align: "right",
      });
      yPos += 8;

      // Results table
      const sortedLanes = [...(race.lanes || [])].sort((a, b) => {
        if (a.position && b.position) return a.position - b.position;
        if (a.position) return -1;
        if (b.position) return 1;
        return (a.lane || 0) - (b.lane || 0);
      });

      const tableBody = sortedLanes.map((lane) => {
        const athleteId = toDocumentId(lane.athlete);
        const athleteData = athleteId ? raceAthleteLookup.get(athleteId) : null;
        const clubId = toDocumentId(lane.club);
        const clubData = clubId ? raceClubLookup.get(clubId) : lane.club;

        const athleteName = athleteData
          ? `${athleteData.firstName || ""} ${
              athleteData.lastName || ""
            }`.trim()
          : lane.athleteName || "-";
        const clubCode = clubData?.code || clubData?.name || "-";

        const position = lane.result?.finishPosition;
        const elapsedMs = lane.result?.elapsedMs;
        const status = lane.result?.status || "ok";

        let timeStr = "-";
        if (status !== "ok") {
          timeStr = status.toUpperCase();
        } else if (elapsedMs) {
          timeStr = formatElapsedTime(elapsedMs);
        }

        const points =
          position && status === "ok"
            ? calculatePoints(position, activeRankingSystem)
            : 0;

        return [
          position || "-",
          lane.lane || "-",
          clubCode,
          athleteName,
          timeStr,
          points,
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Pos", "Lane", "Club", "Athlete", "Time", "Points"]],
        body: tableBody,
        theme: "plain",
        styles: {
          fontSize: 8,
          cellPadding: 1,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          font: fontName,
        },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          lineWidth: 0.1,
          font: fontName,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 14 },
          1: { halign: "center", cellWidth: 14 },
          2: { halign: "center", cellWidth: 20 },
          3: { halign: "left", cellWidth: "auto" },
          4: { halign: "center", cellWidth: 30 },
          5: { halign: "center", cellWidth: 20 },
        },
        margin: { left: leftMargin, right: 14, bottom: 30, top: headerHeight },
      });
    }

    // Add headers and footers to all pages
    const pageCount = doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Header
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        doc.addImage(headerData, "PNG", 0, 0, w, h);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(leftMargin, h + 2, rightMargin, h + 2);
      } else if (logoData) {
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, 25, "F");
        const imgProps = doc.getImageProperties(logoData);
        const ratio = imgProps.width / imgProps.height;
        let w = 20;
        let h = 20;
        if (ratio > 1) h = w / ratio;
        else w = h * ratio;
        doc.addImage(logoData, "PNG", leftMargin, 2.5, w, h);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competition?.names?.en || "Results", 40, 15);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(leftMargin, 24, rightMargin, 24);
      }

      // Footer
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(
          leftMargin,
          pageHeight - h - 3,
          rightMargin,
          pageHeight - h - 3,
        );
        doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - h - 6, {
          align: "right",
        });
      } else if (sponsorData) {
        const imgProps = doc.getImageProperties(sponsorData);
        const ratio = imgProps.width / imgProps.height;
        let w = 180;
        let h = w / ratio;
        if (h > 20) {
          h = 20;
          w = h * ratio;
        }
        const x = leftMargin + (180 - w) / 2;
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(
          leftMargin,
          pageHeight - h - 8,
          rightMargin,
          pageHeight - h - 8,
        );
        doc.addImage(sponsorData, "PNG", x, pageHeight - h - 3, w, h);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          rightMargin,
          pageHeight - h - 11,
          {
            align: "right",
          },
        );
      } else {
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(leftMargin, pageHeight - 15, rightMargin, pageHeight - 15);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
          align: "right",
        });
      }
    }

    doc.save(`Results_${competition?.code || "Competition"}_All.pdf`);
    toast.success(`Exported results for ${racesWithResults.length} race(s)`);
  }, [
    sortedRaces,
    competition,
    categories,
    boatClasses,
    raceAthleteLookup,
    raceClubLookup,
    eventNumberMap,
  ]);

  const handleCategorySelect = (categoryId, statsOverride = null) => {
    setAutoGenState((prev) => ({ ...prev, category: categoryId }));
    // Find entries for this category and populate the start list
    const sourceStats = statsOverride || registrationStats;

    // First check if we have registration entries for this category
    let catData = sourceStats?.byCategory?.find((c) => c.id === categoryId);
    let hasRegistrationEntries = catData?.entries?.length > 0;

    // If no registration entries, try to build entries from existing races
    if (!hasRegistrationEntries) {
      // Filter and sort races by order to get correct sequence
      const existingRaces = races
        .filter((r) => {
          const rCatId = toDocumentId(r.category);
          return rCatId === categoryId;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      if (existingRaces.length > 0) {
        // Extract race settings from existing races (sorted by order)
        const firstRace = existingRaces[0];
        const lastRace = existingRaces[existingRaces.length - 1];

        // Calculate max lanes from existing races
        const maxLanesInRaces = Math.max(
          ...existingRaces.map((r) => (r.lanes || []).length),
        );

        // Extract start time from first race
        let startTimeStr = "";
        if (firstRace.startTime) {
          const startDate = new Date(firstRace.startTime);
          if (!isNaN(startDate.getTime())) {
            const pad = (n) => n.toString().padStart(2, "0");
            startTimeStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`;
          }
        }

        // Calculate interval between races
        let intervalMinutes = 10;
        if (
          existingRaces.length > 1 &&
          firstRace.startTime &&
          existingRaces[1].startTime
        ) {
          const first = new Date(firstRace.startTime).getTime();
          const second = new Date(existingRaces[1].startTime).getTime();
          if (!isNaN(first) && !isNaN(second)) {
            intervalMinutes = Math.round((second - first) / 60000);
          }
        }

        // Get boat class from first race
        const raceBoatClassId = toDocumentId(firstRace.boatClass);

        // Get distance from first race (if set)
        const raceDistance = firstRace.distanceOverride;

        // Update auto-gen state with race settings
        setAutoGenState((prev) => ({
          ...prev,
          lanesPerRace:
            maxLanesInRaces > 0
              ? maxLanesInRaces.toString()
              : prev.lanesPerRace,
          startTime: startTimeStr || prev.startTime,
          intervalMinutes:
            intervalMinutes > 0
              ? intervalMinutes.toString()
              : prev.intervalMinutes,
          startRaceNumber: firstRace.order
            ? firstRace.order.toString()
            : prev.startRaceNumber,
          sessionLabel: firstRace.sessionLabel || prev.sessionLabel,
          racePrefix:
            firstRace.name?.replace(/\s*\d+$/, "").trim() || prev.racePrefix,
          boatClass: raceBoatClassId || prev.boatClass,
          journeyIndex: firstRace.journeyIndex
            ? firstRace.journeyIndex.toString()
            : prev.journeyIndex,
          distance: raceDistance ? raceDistance.toString() : prev.distance,
        }));

        // Build entries from race lanes
        const entriesFromRaces = [];
        const seenAthletes = new Set();

        existingRaces.forEach((race) => {
          (race.lanes || []).forEach((lane, laneIndex) => {
            const athleteId = toDocumentId(lane.athlete);
            const crewKey =
              lane.crew?.length > 0
                ? lane.crew.map((c) => toDocumentId(c)).join("-")
                : athleteId;

            if (crewKey && !seenAthletes.has(crewKey)) {
              seenAthletes.add(crewKey);
              entriesFromRaces.push({
                _id: `race-${race._id}-lane-${laneIndex}`,
                athlete: lane.athlete,
                crew: lane.crew || [],
                club: lane.club,
                boatClass: race.boatClass,
                category: race.category,
                seed: lane.seed,
                crewNumber: lane.crewNumber,
                notes: lane.notes || "",
              });
            }
          });
        });

        if (entriesFromRaces.length > 0) {
          // Get category name
          const catObj = existingRaces[0]?.category;
          let catName = "Unknown";
          if (catObj && typeof catObj === "object") {
            catName =
              catObj.abbreviation ||
              catObj.titles?.en ||
              catObj.name ||
              "Unknown";
          } else if (categoryId && categories.length > 0) {
            const foundCat = categories.find(
              (c) => toDocumentId(c) === categoryId,
            );
            if (foundCat) {
              catName =
                foundCat.abbreviation ||
                foundCat.titles?.en ||
                foundCat.name ||
                "Unknown";
            }
          }

          catData = {
            id: categoryId,
            name: catName,
            count: entriesFromRaces.length,
            entries: entriesFromRaces,
          };
          hasRegistrationEntries = true; // We now have entries from races
        }
      }
    }

    if (catData && catData.entries?.length > 0) {
      const boatClassCounts = {};

      // Transform entries to the format expected by the start list
      let newEntries = catData.entries.map((entry, index) => {
        // Prefer the athlete's current club / active membership club when present
        const memberships = Array.isArray(entry.athlete?.memberships)
          ? entry.athlete.memberships
          : [];
        // Always use active membership for club context, prioritizing standard clubs over promotion centers
        const activeMemberships = memberships.filter(
          (membership) => membership?.status === "active" && membership.club,
        );
        // Try to find a 'club' type specifically, otherwise fall back to first active
        const activeMembership =
          activeMemberships.find((m) => m.club?.type === "club") ||
          activeMemberships[0];
        const resolvedClub =
          activeMembership?.club || entry.athlete?.club || entry.club || null;

        // Determine boat class ID for seeding
        const bcId =
          entry.boatClass?._id ||
          entry.boatClass?.id ||
          (typeof entry.boatClass === "string" ? entry.boatClass : "unknown");
        if (!boatClassCounts[bcId]) {
          boatClassCounts[bcId] = 0;
        }
        boatClassCounts[bcId]++;

        return {
          id: entry._id,
          uid: entry._id || `gen-${index}-${Date.now()}`,
          athleteId:
            toDocumentId(entry.athlete) ||
            (entry.crew && entry.crew.length > 0
              ? toDocumentId(entry.crew[0])
              : null) ||
            entry._id,
          athlete: entry.athlete,
          crew: entry.crew,
          clubId: resolvedClub?._id || resolvedClub || entry.club?._id,
          clubName: resolveClubLabel(resolvedClub) || entry.club?.name,
          clubCode: resolvedClub?.code || entry.club?.code,
          category: entry.category,
          boatClass: entry.boatClass,
          crewNumber: entry.crewNumber,
          seed: boatClassCounts[bcId], // Seed per boat class
          notes: entry.notes || "",
        };
      });

      // Check for existing races to preserve seeds/bibs
      const existingRaces = races.filter((r) => {
        const rCatId = toDocumentId(r.category);
        return rCatId === categoryId;
      });

      if (existingRaces.length > 0) {
        const assignmentMap = new Map();
        existingRaces.forEach((race) => {
          if (race.lanes) {
            race.lanes.forEach((lane) => {
              let key = null;
              if (lane.athlete) {
                key = toDocumentId(lane.athlete);
              } else if (lane.crew && lane.crew.length > 0) {
                key = toDocumentId(lane.crew[0]);
              }

              if (key) {
                assignmentMap.set(key, {
                  seed: lane.seed,
                  crewNumber: lane.crewNumber,
                });
              }
            });
          }
        });

        newEntries = newEntries.map((entry) => {
          const existing = assignmentMap.get(entry.athleteId);
          if (existing) {
            return {
              ...entry,
              seed: existing.seed || entry.seed,
              crewNumber: existing.crewNumber ?? entry.crewNumber,
            };
          }
          return entry;
        });
      }

      setEntries(newEntries);

      // Auto-select boat class if all entries share the same one
      const uniqueBoatClasses = new Set(
        catData.entries
          .map(
            (e) =>
              e.boatClass?.id ||
              (typeof e.boatClass === "string" ? e.boatClass : null),
          )
          .filter(Boolean),
      );

      setAutoGenState((prev) => {
        if (uniqueBoatClasses.size === 1) {
          const singleBoatClassId = uniqueBoatClasses.values().next().value;
          // Always lock to the single available boat class
          return {
            ...prev,
            boatClass: singleBoatClassId,
          };
        }

        // If multiple boat classes, check if current selection is still valid
        if (prev.boatClass && uniqueBoatClasses.has(prev.boatClass)) {
          return prev;
        }

        // Otherwise reset if invalid or empty
        return {
          ...prev,
          boatClass: "",
        };
      });

      toast.info(`Loaded ${newEntries.length} entries for ${catData.name}`);
    }
  };

  if (!competitionId) {
    return (
      <div className="px-6 py-10">
        <p className="text-sm text-slate-600">
          Invalid competition identifier supplied.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Race planner
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {competition?.names?.en || competition?.code || "Competition"}
          </h1>
          {competition?.season ? (
            <p className="text-sm text-slate-500">
              Season {competition.season} - {competition.code}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/competitions/${competitionId}/rankings`)}
          >
            🏆 Rankings
          </Button>
          <Button type="button" onClick={loadRaces} disabled={loadingRaces}>
            Refresh races
          </Button>
        </div>
      </div>

      {loadingCompetition ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading competition...
        </div>
      ) : competition ? (
        <div className="space-y-6">
          {/* Dashboard Section */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Athletes
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalAthletes || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Registered Clubs
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalClubs || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total Entries
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalEntries || 0}
              </p>
            </div>
          </section>

          {/* Categories Grid - Compact */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Categories Overview
            </h2>
            {loadingRegistration && !races.length ? (
              <p className="text-sm text-slate-500">
                Loading registration data...
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {combinedStats?.byCategory?.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="font-semibold">{cat.name}</span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                      {cat.count}
                    </span>
                  </button>
                ))}
                {!combinedStats?.byCategory?.length && (
                  <p className="text-sm text-slate-500">
                    No registrations found for this competition.
                  </p>
                )}
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section className="space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  Auto-generate races
                </h2>
                <p className="text-sm text-slate-500">
                  Choose the category, add eligible athletes, and create races
                  with automatic lane allocations.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="autoCategory">Category</Label>
                  <Select
                    id="autoCategory"
                    name="category"
                    value={autoGenState.category}
                    onChange={handleAutoGenFieldChange}
                  >
                    <option value="">Select category</option>
                    {allowedCategories.map((category) => {
                      const id = toDocumentId(category);
                      const abbr = category.abbreviation || category.code || "";
                      const fullName = category.titles?.en || "";
                      // Show "Abbr - Full Name" for clarity
                      const label = fullName
                        ? `${abbr} - ${fullName}`
                        : abbr || `Category ${id?.slice(-4)}`;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoBoatClass">Boat class</Label>
                  <Select
                    id="autoBoatClass"
                    name="boatClass"
                    value={autoGenState.boatClass}
                    onChange={handleAutoGenFieldChange}
                  >
                    <option value="">All boat classes</option>
                    {allowedBoatClasses.map((boatClass) => {
                      const id = toDocumentId(boatClass);
                      const code = boatClass.code || "";
                      const fullName = boatClass.names?.en || "";
                      const weight = boatClass.weightClass;
                      // Show "Code - Full Name (Weight)" to distinguish open vs lightweight
                      const weightSuffix =
                        weight && weight !== "open"
                          ? ` (${weight.charAt(0).toUpperCase() + weight.slice(1)})`
                          : "";
                      const label = fullName
                        ? `${code} - ${fullName}${weightSuffix}`
                        : code || `Boat class ${id?.slice(-4)}`;
                      return (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      );
                    })}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoJourney">Journey index</Label>
                  <Input
                    id="autoJourney"
                    name="journeyIndex"
                    type="number"
                    min="1"
                    value={autoGenState.journeyIndex}
                    onChange={handleAutoGenFieldChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoLaneCount">Lanes per race</Label>
                  <Input
                    id="autoLaneCount"
                    name="lanesPerRace"
                    type="number"
                    min="1"
                    max={getMaxLanesForDiscipline(competition?.discipline)}
                    value={autoGenState.lanesPerRace}
                    onChange={handleAutoGenFieldChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoStrategy">Seeding strategy</Label>
                  <Select
                    id="autoStrategy"
                    name="strategy"
                    value={autoGenState.strategy}
                    onChange={handleAutoGenFieldChange}
                  >
                    <option value="random">Random lane draw</option>
                    <option value="seeded">Use provided seeds</option>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoSession">Session label</Label>
                  <Input
                    id="autoSession"
                    name="sessionLabel"
                    value={autoGenState.sessionLabel}
                    onChange={handleAutoGenFieldChange}
                    placeholder="Morning programme"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoPrefix">Race prefix</Label>
                  <Input
                    id="autoPrefix"
                    name="racePrefix"
                    value={autoGenState.racePrefix}
                    onChange={handleAutoGenFieldChange}
                    placeholder="Heat"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoStartNumber">Start Race #</Label>
                  <Input
                    id="autoStartNumber"
                    name="startRaceNumber"
                    type="number"
                    min="1"
                    value={autoGenState.startRaceNumber}
                    onChange={handleAutoGenFieldChange}
                    placeholder="Auto"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoStartTime">Start Time</Label>
                  <Input
                    id="autoStartTime"
                    name="startTime"
                    type="datetime-local"
                    value={autoGenState.startTime}
                    onChange={handleAutoGenFieldChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoInterval">Interval (min)</Label>
                  <Input
                    id="autoInterval"
                    name="intervalMinutes"
                    type="number"
                    min="0"
                    value={autoGenState.intervalMinutes}
                    onChange={handleAutoGenFieldChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="autoDistance">Distance (m)</Label>
                  <Input
                    id="autoDistance"
                    name="distance"
                    type="number"
                    min="0"
                    step="100"
                    value={autoGenState.distance}
                    onChange={handleAutoGenFieldChange}
                    placeholder="Default"
                  />
                </div>

                <div className="flex items-center gap-2 pb-2">
                  <input
                    id="autoOverwrite"
                    name="overwriteExisting"
                    type="checkbox"
                    checked={autoGenState.overwriteExisting}
                    onChange={handleAutoGenFieldChange}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  <Label htmlFor="autoOverwrite" className="text-sm">
                    Overwrite existing
                  </Label>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    id="allowJuniorsInSenior"
                    name="allowJuniorsInSenior"
                    type="checkbox"
                    checked={autoGenState.allowJuniorsInSenior || false}
                    onChange={handleAutoGenFieldChange}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  <Label htmlFor="allowJuniorsInSenior" className="text-sm">
                    Allow juniors in senior category
                  </Label>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    id="allowMastersInSenior"
                    name="allowMastersInSenior"
                    type="checkbox"
                    checked={autoGenState.allowMastersInSenior || false}
                    onChange={handleAutoGenFieldChange}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  <Label htmlFor="allowMastersInSenior" className="text-sm">
                    Allow masters in senior category
                  </Label>
                </div>
                {(user?.role === "admin" ||
                  user?.role === "jury_president") && (
                  <div className="flex items-center gap-2 pb-2 text-blue-600">
                    <input
                      id="allowMultipleEntries"
                      name="allowMultipleEntries"
                      type="checkbox"
                      checked={autoGenState.allowMultipleEntries}
                      onChange={handleAutoGenFieldChange}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Label
                      htmlFor="allowMultipleEntries"
                      className="text-sm font-medium"
                    >
                      Allow multiple entries per athlete
                    </Label>
                  </div>
                )}
                {(user?.role === "admin" ||
                  user?.role === "jury_president") && (
                  <div className="flex items-center gap-2 pb-2 text-amber-600">
                    <input
                      id="bypassAgeVerification"
                      name="bypassAgeVerification"
                      type="checkbox"
                      checked={autoGenState.bypassAgeVerification || false}
                      onChange={handleAutoGenFieldChange}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <Label
                      htmlFor="bypassAgeVerification"
                      className="text-sm font-medium"
                    >
                      Bypass age verification (for past competitions)
                    </Label>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Start list ({relevantEntries.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add competitors by name or license number, then adjust
                      seeds before generating.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search athletes..."
                      value={entrySearchTerm}
                      onChange={(event) =>
                        setEntrySearchTerm(event.target.value)
                      }
                      className="w-56"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSortBySeed}
                      disabled={entries.length < 2}
                      title="Sort entries by seed number"
                    >
                      Sort by Seed
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleClearEntries}
                      disabled={!entries.length}
                    >
                      Clear list
                    </Button>
                  </div>
                </div>

                <SearchResultsList
                  term={entrySearchTerm.trim()}
                  results={filteredEntryResults}
                  loading={entrySearchLoading}
                  error={entrySearchError}
                  onPick={handleAddEntry}
                />

                <PendingManualCrewDisplay
                  crew={pendingManualCrew}
                  requiredSize={requiredCrewSize}
                  onCancel={() => setPendingManualCrew([])}
                />

                <EntriesTable
                  entries={relevantEntries}
                  onEntryChange={handleEntryFieldChange}
                  onRemove={handleRemoveEntry}
                  onWithdraw={handleWithdrawEntry}
                  onDelete={handleDeleteEntry}
                  isAdmin={
                    user?.role === "admin" || user?.role === "jury_president"
                  }
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSaveEntries}
                  disabled={
                    Object.keys(dbEntryOverrides).length === 0 &&
                    entries.length === 0
                  }
                >
                  Save Changes
                </Button>
                <Button
                  type="button"
                  onClick={submitAutoGeneration}
                  disabled={submittingAutoGen}
                >
                  {submittingAutoGen ? "Generating..." : "Generate races"}
                </Button>
              </div>
            </section>

            <section
              id="existing-races-section"
              className="space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Existing races ({sortedRaces.length})
                </h2>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportStartListPDF}
                    disabled={!sortedRaces.length}
                  >
                    Export Start List
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => exportAllResultsPDF()}
                    disabled={!sortedRaces.length}
                  >
                    Export Results
                  </Button>
                  <Button type="button" variant="ghost" onClick={loadRaces}>
                    Refresh
                  </Button>
                </div>
              </div>

              <DataGrid
                data={sortedRaces}
                columns={raceColumns}
                loading={loadingRaces}
                emptyMessage="No races scheduled yet"
                pageSize={8}
                gridId="competition-races-grid"
              />

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">
                  Quick lane swap
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Move an athlete between lanes or races without regenerating
                  the draw.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="swapSourceRace">Source race</Label>
                    <Select
                      id="swapSourceRace"
                      name="sourceRaceId"
                      value={swapState.sourceRaceId}
                      onChange={handleSwapFieldChange}
                    >
                      <option value="">Select race</option>
                      {sortedRaces.map((race) => (
                        <option key={race._id} value={race._id}>
                          {race.name || `Race ${race.order}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swapSourceLane">Source lane</Label>
                    <Select
                      id="swapSourceLane"
                      name="sourceLane"
                      value={swapState.sourceLane}
                      onChange={handleSwapFieldChange}
                      disabled={!swapState.sourceRaceId}
                    >
                      <option value="">Select lane</option>
                      {(() => {
                        const race = sortedRaces.find(
                          (r) => r._id === swapState.sourceRaceId,
                        );
                        if (!race) return null;
                        return Array.from({ length: 8 }, (_, i) => i + 1).map(
                          (laneNum) => {
                            const lane = race.lanes?.find(
                              (l) => l.lane === laneNum,
                            );
                            const label = lane
                              ? describeLane(
                                  lane,
                                  raceAthleteLookup,
                                  raceClubLookup,
                                )
                              : `${laneNum}. Empty`;
                            return (
                              <option key={laneNum} value={laneNum}>
                                {label}
                              </option>
                            );
                          },
                        );
                      })()}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swapTargetRace">Target race</Label>
                    <Select
                      id="swapTargetRace"
                      name="targetRaceId"
                      value={swapState.targetRaceId}
                      onChange={handleSwapFieldChange}
                    >
                      <option value="">Select race</option>
                      {sortedRaces.map((race) => (
                        <option key={race._id} value={race._id}>
                          {race.name || `Race ${race.order}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="swapTargetLane">Target lane</Label>
                    <Select
                      id="swapTargetLane"
                      name="targetLane"
                      value={swapState.targetLane}
                      onChange={handleSwapFieldChange}
                      disabled={!swapState.targetRaceId}
                    >
                      <option value="">Select lane</option>
                      {(() => {
                        const race = sortedRaces.find(
                          (r) => r._id === swapState.targetRaceId,
                        );
                        if (!race) return null;
                        return Array.from({ length: 8 }, (_, i) => i + 1).map(
                          (laneNum) => {
                            const lane = race.lanes?.find(
                              (l) => l.lane === laneNum,
                            );
                            const label = lane
                              ? describeLane(
                                  lane,
                                  raceAthleteLookup,
                                  raceClubLookup,
                                )
                              : `${laneNum}. Empty`;
                            return (
                              <option key={laneNum} value={laneNum}>
                                {label}
                              </option>
                            );
                          },
                        );
                      })()}
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={submitLaneSwap}
                    disabled={performingSwap}
                  >
                    {performingSwap ? "Swapping..." : "Swap lanes"}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Competition not found.
        </div>
      )}
    </div>
  );
};

export default CompetitionRaces;
