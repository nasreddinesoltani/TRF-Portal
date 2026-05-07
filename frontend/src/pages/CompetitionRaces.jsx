import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { DataGrid } from "../components/DataGrid";
import { generateRaceCode, formatCategoryAbbreviation } from "../lib/rowing";
import { buildStartListTableBody } from "../lib/startListPdf";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE_URL = "";
const ENTRY_SEARCH_LIMIT = 25;
const DEFAULT_LANES_PER_RACE = 6;

// ==================== WIZARD STEPS ====================
const WIZARD_STEPS = [
  {
    id: 1,
    name: "Event",
    icon: "📋",
    description: "Select category & boat class",
  },
  {
    id: 2,
    name: "Settings",
    icon: "⚙️",
    description: "Configure race parameters",
  },
  { id: 3, name: "Entries", icon: "👥", description: "Manage start list" },
  { id: 4, name: "Preview", icon: "👁️", description: "Review & generate" },
];

// ==================== ICONS ====================
const Icons = {
  ChevronRight: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  ),
  ChevronLeft: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  ),
  Check: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  Save: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  ),
  Upload: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  ),
  Trash: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  GripVertical: () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  ),
  Sparkles: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  ),
  AlertCircle: () => (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Users: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  Trophy: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
      />
    </svg>
  ),
  Clock: () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

// ==================== PROGRESS INDICATOR ====================
const GenerationProgress = ({ isGenerating, progress, stage }) => {
  if (!isGenerating) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 mx-auto">
              <svg className="w-20 h-20 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                />
                <path
                  className="opacity-75 text-blue-600"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Icons.Sparkles />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Generating Races
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {stage || "Processing..."}
            </p>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-400">
            Please wait while we create your races...
          </p>
        </div>
      </div>
    </div>
  );
};

// ==================== PRESET CARD ====================
const PresetCard = ({ preset, isSelected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={`
      group relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200
      ${
        isSelected
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-md"
          : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm"
      }
    `}
  >
    <div className="flex items-center gap-3">
      <span className="text-2xl">{preset.icon}</span>
      <span
        className={`font-semibold ${isSelected ? "text-blue-700" : "text-slate-700"}`}
      >
        {preset.name}
      </span>
    </div>
    <p className="text-xs text-slate-500">{preset.description}</p>
    {isSelected && (
      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
        <Icons.Check />
      </div>
    )}
  </button>
);

// ==================== WIZARD STEP INDICATOR ====================
const WizardStepIndicator = ({
  steps,
  currentStep,
  onStepClick,
  completedSteps,
}) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {steps.map((step, index) => {
      const isCompleted = completedSteps.includes(step.id);
      const isCurrent = currentStep === step.id;
      const isPast = step.id < currentStep;

      return (
        <React.Fragment key={step.id}>
          {index > 0 && (
            <div
              className={`h-0.5 w-8 transition-colors duration-300 ${
                isPast || isCompleted ? "bg-blue-500" : "bg-slate-200"
              }`}
            />
          )}
          <button
            type="button"
            onClick={() => onStepClick(step.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
              ${
                isCurrent
                  ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300 shadow-sm"
                  : isPast || isCompleted
                    ? "bg-green-50 text-green-700 hover:bg-green-100"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }
            `}
          >
            <span
              className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
              ${
                isCurrent
                  ? "bg-blue-500 text-white"
                  : isPast || isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-slate-300 text-slate-600"
              }
            `}
            >
              {isPast || isCompleted ? <Icons.Check /> : step.id}
            </span>
            <span className="hidden sm:block text-sm font-medium">
              {step.name}
            </span>
          </button>
        </React.Fragment>
      );
    })}
  </div>
);

// ==================== HEAT DISTRIBUTION PREVIEW ====================
const HeatDistributionPreview = ({ entries, lanesPerRace, strategy }) => {
  const heats = useMemo(() => {
    if (!entries.length || !lanesPerRace) return [];
    const lanes = parseInt(lanesPerRace) || 6;
    const sortedEntries =
      strategy === "seeded"
        ? [...entries].sort(
            (a, b) => (Number(a.seed) || 999) - (Number(b.seed) || 999),
          )
        : entries;

    const result = [];
    for (let i = 0; i < sortedEntries.length; i += lanes) {
      result.push(sortedEntries.slice(i, i + lanes));
    }
    return result;
  }, [entries, lanesPerRace, strategy]);

  if (!entries.length) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Icons.Users />
        <p className="mt-2 text-sm">Add entries to see heat distribution</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
          <span className="text-lg">🏁</span>
          Heat Distribution Preview
        </h4>
        <span className="text-sm text-slate-500">
          {heats.length} heat{heats.length !== 1 ? "s" : ""} • {entries.length}{" "}
          entries
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {heats.map((heat, heatIndex) => (
          <div
            key={heatIndex}
            className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Heat {heatIndex + 1}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {heat.length} lane{heat.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-1">
              {heat.map((entry, laneIndex) => (
                <div
                  key={entry.uid || entry.id || laneIndex}
                  className="flex items-center gap-2 rounded-md bg-white px-2 py-1 text-xs border border-slate-100"
                >
                  <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                    {laneIndex + 1}
                  </span>
                  <span className="truncate flex-1 font-medium text-slate-700">
                    {entry.athlete?.fullName ||
                      entry.athlete?.name ||
                      `Entry ${entry.seed}`}
                  </span>
                  {entry.clubCode && (
                    <span className="text-slate-400">{entry.clubCode}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== VALIDATION FEEDBACK ====================
const ValidationFeedback = ({ errors, warnings }) => {
  if (!errors?.length && !warnings?.length) return null;

  return (
    <div className="space-y-2 animate-in slide-in-from-top duration-300">
      {errors?.map((error, i) => (
        <div
          key={`err-${i}`}
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700"
        >
          <Icons.AlertCircle />
          {error}
        </div>
      ))}
      {warnings?.map((warning, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-700"
        >
          <Icons.AlertCircle />
          {warning}
        </div>
      ))}
    </div>
  );
};

// TemplateManager removed

// Helper to load image as base64
const loadImage = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("loadImage canvas error:", err);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url; // Set src AFTER handlers to avoid missing cached-image events
  });
};

const getImageFormat = (dataUrl) =>
  String(dataUrl || "").startsWith("data:image/png") ? "PNG" : "JPEG";

const loadFont = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to load font", error);
    return null;
  }
};

const toDocumentId = (value) => {
  if (!value) {
    return null;
  }

  const coerceCandidateToId = (candidate) => {
    if (!candidate) {
      return null;
    }
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (
        !trimmed ||
        trimmed === "[object Object]" ||
        trimmed.includes("<anonymous code>") ||
        /^function\s*\(/i.test(trimmed)
      ) {
        return null;
      }
      return trimmed;
    }
    if (typeof candidate === "number") {
      return String(candidate);
    }
    if (typeof candidate === "function") {
      return null;
    }
    if (typeof candidate?.$oid === "string") {
      return candidate.$oid;
    }
    if (typeof candidate?.toHexString === "function") {
      try {
        return candidate.toHexString();
      } catch {
        return null;
      }
    }
    if (typeof candidate?.toString === "function") {
      try {
        const converted = candidate.toString();
        if (typeof converted !== "string") {
          return null;
        }
        const trimmed = converted.trim();
        if (
          !trimmed ||
          trimmed === "[object Object]" ||
          trimmed.includes("<anonymous code>") ||
          /^function\s*\(/i.test(trimmed)
        ) {
          return null;
        }
        return trimmed;
      } catch {
        return null;
      }
    }
    return null;
  };

  if (typeof value === "string") {
    return coerceCandidateToId(value);
  }
  if (typeof value === "number") {
    return coerceCandidateToId(value);
  }
  if (typeof value === "object") {
    const candidate =
      value._id ||
      value.id ||
      (typeof value.$oid === "string" ? value.$oid : value);
    return coerceCandidateToId(candidate);
  }
  return null;
};

const normalizeStringId = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  const docId = toDocumentId(value);
  if (docId) {
    return docId;
  }

  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }

  try {
    const converted = String(value);
    return converted === "[object Object]" ? "" : converted;
  } catch {
    return "";
  }
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
    (() => {
      const clubId = toDocumentId(clubValue);
      return clubId ? `Club ${clubId.slice(-4)}` : undefined;
    })()
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

// generateRaceCode replaced by shared utility from ../lib/rowing.js

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
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${centis.toString().padStart(2, "0")}`;
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
  { value: "withdrawn", label: "WD (Withdrawn)" },
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

const toSortedUniqueIds = (values) =>
  Array.from(new Set((values || []).filter(Boolean))).sort();

const buildAssignmentKey = ({
  categoryId,
  boatClassId,
  clubId,
  athleteId,
  crewIds,
}) => {
  const normalizedCrewIds = toSortedUniqueIds(crewIds);
  const participantKey = normalizedCrewIds.length
    ? `crew:${normalizedCrewIds.join("|")}`
    : athleteId
      ? `athlete:${athleteId}`
      : "";

  if (!participantKey) {
    return null;
  }

  return [
    categoryId || "-",
    boatClassId || "-",
    clubId || "-",
    participantKey,
  ].join("::");
};

const buildEventAssignmentKey = ({ categoryId, boatClassId }) =>
  [categoryId || "-", boatClassId || "-"].join("::");

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
            key={toDocumentId(athlete) || `crew-${idx}`}
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
  onUnwithdraw,
  onDelete,
  isAdmin,
  showCrewNumber,
}) => {
  const sortedEntries = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => (Number(a.seed) || 0) - (Number(b.seed) || 0)),
    [entries],
  );

  if (!entries.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <Icons.Users />
        </div>
        <p className="text-slate-600 font-medium">Start list is empty</p>
        <p className="text-sm text-slate-400 mt-1">
          Use the search box above to add competitors
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3 w-20">Seed</th>
            <th className="px-3 py-3 w-40">
              {showCrewNumber ? "Crew #" : "Club"}
            </th>
            <th className="px-3 py-3">Athlete</th>
            <th className="px-3 py-3 w-24">Status</th>
            <th className="px-3 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {sortedEntries.map((entry, index) => {
            const isDbEntry = entry.id && !entry.uid?.startsWith("manual-");
            const isWithdrawn = entry.status === "withdrawn";
            return (
              <tr
                key={entry.uid || entry.id || `entry-${index}`}
                className={`
                    transition-all duration-200 group
                    ${isWithdrawn ? "bg-rose-50/50 opacity-60" : "hover:bg-blue-50/50"}
                  `}
              >
                <td className="px-3 py-2 w-20">
                  <Input
                    type="number"
                    min="1"
                    value={entry.seed || ""}
                    placeholder="-"
                    onChange={(event) =>
                      onEntryChange(
                        entry.uid || entry.id,
                        "seed",
                        event.target.value
                          ? parseInt(event.target.value, 10)
                          : undefined,
                      )
                    }
                    className="h-7 w-12 text-center text-xs"
                    disabled={isWithdrawn}
                  />
                </td>
                <td className="px-3 py-2 w-40 text-slate-600 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {entry.clubCode ? (
                      <span className="flex-shrink-0 inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200 min-w-[3.5rem] justify-center">
                        {entry.clubCode}
                      </span>
                    ) : null}
                    {showCrewNumber ? (
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
                        className="h-7 !w-14 text-center text-xs flex-none"
                        disabled={isWithdrawn}
                      />
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span
                      className={`font-semibold ${isWithdrawn ? "text-slate-400 line-through" : "text-slate-800"}`}
                    >
                      {entry.crew && entry.crew.length > 0
                        ? formatCrewName(entry.crew)
                        : formatAthleteName(entry.athlete)}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">
                        {entry.crew && entry.crew.length > 0
                          ? `${entry.crew.length} athletes`
                          : `#${entry.athlete?.licenseNumber || "-"}`}
                      </span>
                      {entry.clubName && (
                        <span className="text-xs text-slate-400">
                          • {entry.clubName}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {isWithdrawn ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      Withdrawn
                    </span>
                  ) : entry.status === "pending" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Pending
                    </span>
                  ) : entry.status === "approved" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Approved
                    </span>
                  ) : isDbEntry ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      {entry.status || "Registered"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      Manual
                    </span>
                  )}
                </td>

                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isDbEntry ? (
                      <>
                        {!isWithdrawn && onWithdraw ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onWithdraw(entry.id)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-7 px-2 text-xs"
                          >
                            Withdraw
                          </Button>
                        ) : null}
                        {isWithdrawn && onUnwithdraw ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onUnwithdraw(entry.id)}
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 h-7 px-2 text-xs"
                          >
                            Undo WD
                          </Button>
                        ) : null}
                        {isAdmin && onDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(entry.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0 rounded-full"
                            title="Delete entry"
                          >
                            ✕
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(entry.uid)}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0 rounded-full"
                        title="Remove manual entry"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
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

  const isCrewLane = Array.isArray(lane?.crew) && lane.crew.length > 1;
  const prefix =
    clubCode && isCrewLane && lane.crewNumber
      ? `${clubCode} ${lane.crewNumber} - `
      : "";

  return `${lane?.lane}. ${prefix}${athleteName}${
    !prefix && clubPart ? clubPart : ""
  }${extrasPart}`;
};

const formatEventTitleWithBoatClass = (
  category,
  boatClass,
  language = "en",
) => {
  const categoryTitle =
    category?.titles?.[language] ||
    category?.titles?.en ||
    category?.abbreviation ||
    "";
  const boatClassTitle =
    (language === "ar"
      ? boatClass?.names?.ar || boatClass?.code
      : boatClass?.names?.en || boatClass?.code) || "";
  return [categoryTitle, boatClassTitle].filter(Boolean).join(" ").trim();
};

const isMasterCategory = (category) => {
  const haystack = [
    category?.abbreviation,
    category?.titles?.en,
    category?.titles?.fr,
    category?.titles?.ar,
    category?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /master|masters|veteran|veterans|ماستر/.test(haystack);
};

const formatRaceCodeForHeader = (raceCode, category) => {
  const normalized = String(raceCode || "").replace(/X/g, "x");
  if (!isMasterCategory(category)) {
    return normalized;
  }

  return normalized.replace(
    /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
    "$1 $2",
  );
};

const formatAsOfLabel = (value = new Date()) =>
  `As of: ${value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

const shouldShowJourney = (competition, races = []) => {
  const textHaystack = [
    competition?.code,
    competition?.name,
    competition?.names?.en,
    competition?.names?.fr,
    competition?.names?.ar,
    competition?.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const isChampionship =
    /championship|championnat|championnats|champion|بطولة/.test(textHaystack);

  const journeyValues = Array.from(
    new Set(
      (races || [])
        .map((race) => Number(race?.journeyIndex))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  );
  const hasMultipleJourneyValues = journeyValues.length > 1;

  const competitionStart = competition?.startDate
    ? new Date(competition.startDate)
    : null;
  const competitionEnd = competition?.endDate
    ? new Date(competition.endDate)
    : null;
  const hasCompetitionMultiDay =
    competitionStart instanceof Date &&
    !Number.isNaN(competitionStart.getTime()) &&
    competitionEnd instanceof Date &&
    !Number.isNaN(competitionEnd.getTime()) &&
    competitionEnd.toDateString() !== competitionStart.toDateString();

  const raceDays = Array.from(
    new Set(
      (races || [])
        .map((race) => {
          if (!race?.startTime) return null;
          const d = new Date(race.startTime);
          return Number.isNaN(d.getTime()) ? null : d.toDateString();
        })
        .filter(Boolean),
    ),
  );
  const hasRaceMultiDay = raceDays.length > 1;

  return (
    isChampionship ||
    hasMultipleJourneyValues ||
    hasCompetitionMultiDay ||
    hasRaceMultiDay
  );
};

const isJourneyPhaseLabel = (phaseLabel) => {
  const normalized = String(phaseLabel || "")
    .trim()
    .toLowerCase();
  return /journey|جولة|رحلة/.test(normalized);
};

const buildCompetitionPdfFileName = (prefix, competition, races) => {
  const normalizeToken = (value) =>
    String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const rawCode = normalizeToken(competition?.code || "COMPETITION");
  const codeParts = rawCode.split("-").filter(Boolean);
  const codeYear = codeParts.find((part) => /^\d{4}$/.test(part));
  const codeWithoutYear = codeParts.filter((part) => !/^\d{4}$/.test(part));

  const title =
    competition?.names?.en || competition?.name || competition?.code || "";
  const titleWords = normalizeToken(title).split("-").filter(Boolean);
  const codeWordSet = new Set(codeWithoutYear);
  const stopWords = new Set(["TUNISIA", "TRF", "CLASSIC"]);

  const titleExtras = titleWords.filter(
    (word) =>
      !/^\d{4}$/.test(word) && !codeWordSet.has(word) && !stopWords.has(word),
  );

  const year =
    codeYear ||
    String(
      competition?.startDate
        ? new Date(competition.startDate).getFullYear()
        : new Date().getFullYear(),
    );

  const journeyValues = Array.from(
    new Set(
      (races || [])
        .map((race) => Number(race?.journeyIndex))
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ).sort((a, b) => a - b);

  const includeJourney = shouldShowJourney(competition, races);

  const journeySegment = journeyValues.length
    ? `Journey-${journeyValues.join("-")}`
    : "Journey-1";

  const baseParts = [
    ...codeWithoutYear,
    ...titleExtras,
    year,
    includeJourney ? journeySegment : null,
  ].filter(Boolean);

  return `${prefix}_${baseParts.join("-")}.pdf`;
};

const buildStartListPdfFileName = (competition, races) =>
  buildCompetitionPdfFileName("StartList", competition, races);

const buildJuryStartListPdfFileName = (competition, races) =>
  buildCompetitionPdfFileName("JuryStartList", competition, races);

const buildResultsPdfFileName = (competition, races) =>
  buildCompetitionPdfFileName("Results", competition, races);

const buildEntriesReportPdfFileName = (prefix, competition) => {
  const year =
    competition?.startDate && !Number.isNaN(new Date(competition.startDate))
      ? new Date(competition.startDate).getFullYear()
      : new Date().getFullYear();
  const code = String(competition?.code || "COMP")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}_${code || "COMP"}-${year}.pdf`;
};

const fitSingleLineFontSize = ({
  doc,
  text,
  maxWidth,
  initialSize,
  minSize,
  font,
  style,
}) => {
  let size = initialSize;
  doc.setFont(font, style);
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) {
      break;
    }
    size -= 0.5;
  }
  return Math.max(size, minSize);
};

const drawAdaptiveCenteredTitle = ({
  doc,
  text,
  center,
  y,
  maxWidth,
  font,
  style = "bold",
  initialSize = 11,
  minSize = 8,
  maxLines = 2,
  lineGap = 4,
}) => {
  const safeText = String(text || "").trim();
  if (!safeText) {
    return { lineCount: 0, yEnd: y };
  }

  let size = initialSize;
  let lines = [safeText];

  while (size >= minSize) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    lines = doc.splitTextToSize(safeText, maxWidth);
    if (lines.length <= maxLines) {
      break;
    }
    size -= 0.5;
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    doc.setFont(font, style);
    doc.setFontSize(Math.max(size, minSize));
    let lastLine = String(lines[maxLines - 1] || "").trim();
    while (
      lastLine.length > 0 &&
      doc.getTextWidth(`${lastLine}...`) > maxWidth
    ) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${lastLine}...`;
  }

  doc.setFont(font, style);
  doc.setFontSize(Math.max(size, minSize));
  lines.forEach((line, index) => {
    doc.text(line, center, y + index * lineGap, { align: "center" });
  });

  return {
    lineCount: lines.length,
    yEnd: y + (lines.length - 1) * lineGap,
  };
};

const isAssignedLane = (lane) => {
  if (!lane) return false;
  if (lane.athlete) return true;
  return Array.isArray(lane.crew) && lane.crew.length > 0;
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

    const raceId = toDocumentId(race);
    if (!raceId) {
      toast.error("Invalid race id");
      return;
    }

    await onSaveResults(raceId, lanes, race.status !== "completed");
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
              {shouldShowJourney(competition, [race]) && race.journeyIndex
                ? `Journey ${race.journeyIndex}`
                : ""}
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

                // Detect if this is a combined race (multiple original races)
                const originalRaceIds = new Set(
                  sortedLanes
                    .map((l) => l.sourceRaceId || l._originalRaceId)
                    .filter(Boolean),
                );
                const isCombinedRace =
                  originalRaceIds.size > 1 ||
                  (originalRaceIds.size === 0 && lanes.length > 0);

                // Find the winning time (first place)
                const winningTime = sortedLanes.find(
                  (l) =>
                    (l.result?.status || "ok") === "ok" && l.result?.elapsedMs,
                )?.result?.elapsedMs;

                const explicitFinisherPositions = sortedLanes
                  .filter((l) => (l.result?.status || "ok") === "ok")
                  .map((l) => l.result?.finishPosition)
                  .filter((p) => Number.isInteger(p) && p > 0);
                const lastFinisherPosition = explicitFinisherPositions.length
                  ? Math.max(...explicitFinisherPositions)
                  : sortedLanes.filter(
                      (l) =>
                        (l.result?.status || "ok") === "ok" &&
                        Number.isFinite(l.result?.elapsedMs),
                    ).length;

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

                  const elapsedMs = lane.result?.elapsedMs;
                  const laneWithdrawn =
                    String(lane?.registrationStatus || "").toLowerCase() ===
                      "withdrawn" ||
                    String(lane?.result?.status || "").toLowerCase() ===
                      "withdrawn";
                  const status = laneWithdrawn
                    ? "withdrawn"
                    : lane.result?.status || "ok";
                  const position =
                    status === "withdrawn"
                      ? null
                      : status === "dnf"
                        ? lane.result?.finishPosition ||
                          lastFinisherPosition + 1
                        : lane.result?.finishPosition;

                  // Calculate time and delta (World Rowing style)
                  const timeStr = elapsedMs
                    ? formatElapsedTime(elapsedMs)
                    : "-";
                  const deltaMs =
                    position > 1 && winningTime && elapsedMs
                      ? elapsedMs - winningTime
                      : null;
                  const deltaStr = deltaMs ? formatDeltaSeconds(deltaMs) : null;

                  // For combined races, show the race order with the lane number
                  const sourceRaceOrder =
                    Number(lane.sourceRaceOrder) ||
                    Number(lane.originalRaceOrder) ||
                    Number(lane._originalRaceOrder) ||
                    null;
                  const laneDisplay =
                    isCombinedRace && sourceRaceOrder
                      ? `${lane.lane} (R${sourceRaceOrder})`
                      : lane.lane;

                  return (
                    <tr
                      key={lane.lane}
                      className={
                        status === "withdrawn"
                          ? "bg-rose-50"
                          : status !== "ok"
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
                      <td className="px-4 py-3 font-medium">{laneDisplay}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold">{clubCode}</span>
                        {clubName && clubCode !== clubName && (
                          <span className="ml-2 text-slate-500">
                            {clubName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{athleteName}</span>
                          {status === "withdrawn" && (
                            <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                              WD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {status !== "ok" ? (
                          <span
                            className={`font-semibold ${status === "withdrawn" ? "text-rose-700" : "text-red-600"}`}
                          >
                            {status === "withdrawn"
                              ? "WITHDRAWN"
                              : status.toUpperCase()}
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
                        {status === "ok" || status === "dnf"
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
                const laneWithdrawn =
                  String(lane?.registrationStatus || "").toLowerCase() ===
                    "withdrawn" ||
                  String(lane?.result?.status || "").toLowerCase() ===
                    "withdrawn";

                return (
                  <tr
                    key={lane.lane}
                    className={laneWithdrawn ? "bg-rose-50" : undefined}
                  >
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{lane.lane}</span>
                        {laneWithdrawn && (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                            WD
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{clubCode}</span>
                      {clubName && clubCode !== clubName && (
                        <span className="ml-2 text-slate-500">{clubName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{athleteName}</span>
                        {laneWithdrawn && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                            Withdrawn
                          </span>
                        )}
                      </div>
                    </td>
                    {showResultsEntry && (
                      <>
                        <td className="px-4 py-3">
                          {laneWithdrawn ? (
                            <span className="font-semibold text-rose-700">
                              WD
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {laneWithdrawn ? (
                            <span className="text-xs font-semibold text-rose-700">
                              Locked
                            </span>
                          ) : (
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
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={
                              laneWithdrawn
                                ? "withdrawn"
                                : formData.status || "ok"
                            }
                            onChange={(e) =>
                              handleResultChange(
                                lane.lane,
                                "status",
                                e.target.value,
                              )
                            }
                            className="w-32"
                            disabled={laneWithdrawn}
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
                            disabled={laneWithdrawn}
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
  const { token, user, loading: authLoading } = useAuth();
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
  const [globalJourneyFilter, setGlobalJourneyFilter] = useState("");
  const initialDataLoadedRef = React.useRef(false);
  const unauthorizedRedirectedRef = React.useRef(false);
  const skipAutoFillAfterGenerateRef = useRef(false);

  const handleUnauthorized = useCallback(
    (message = "Session expired. Please login again.") => {
      if (unauthorizedRedirectedRef.current) {
        return true;
      }
      unauthorizedRedirectedRef.current = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoadingCompetition(false);
      toast.error(message);
      navigate("/login", { replace: true });
      return true;
    },
    [navigate],
  );

  const [entrySearchTerm, setEntrySearchTerm] = useState("");
  const [entrySearchResults, setEntrySearchResults] = useState([]);
  const [entrySearchLoading, setEntrySearchLoading] = useState(false);
  const [entrySearchError, setEntrySearchError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [dbEntryOverrides, setDbEntryOverrides] = useState({}); // Stores local edits for DB entries (keyed by entry ID)
  const [restoringWithdrawnKey, setRestoringWithdrawnKey] = useState("");

  // ==================== WIZARD & UI STATE ====================
  const [wizardStep, setWizardStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStage, setGenerationStage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [expandedSections, setExpandedSections] = useState({
    settings: true,
    advanced: false,
  });

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
    allowJuniorsInSenior: false,
    allowMastersInSenior: false,
    bypassAgeVerification: false,
  });

  // Keep Race Generator journey aligned with the global filter.
  // When a specific journey is selected globally, lock the generator to it.
  useEffect(() => {
    if (!globalJourneyFilter) {
      return;
    }
    setAutoGenState((previous) => {
      const nextJourney = String(globalJourneyFilter);
      if (String(previous.journeyIndex || "") === nextJourney) {
        return previous;
      }
      return {
        ...previous,
        journeyIndex: nextJourney,
      };
    });
  }, [globalJourneyFilter]);

  // Auto-fill configuration when category changes
  useEffect(() => {
    if (!autoGenState.category) return;
    if (skipAutoFillAfterGenerateRef.current) {
      skipAutoFillAfterGenerateRef.current = false;
      return;
    }

    // Find relevant races for this category
    const categoryId = autoGenState.category;
    let relevantRaces = races.filter((r) =>
      typeof r.category === "string"
        ? r.category === categoryId
        : toDocumentId(r.category) === categoryId,
    );

    // If a boat class is selected, filter further by that boat class
    if (autoGenState.boatClass) {
      const bcFilter = relevantRaces.filter((r) =>
        typeof r.boatClass === "string"
          ? r.boatClass === autoGenState.boatClass
          : toDocumentId(r.boatClass) === autoGenState.boatClass,
      );
      // Only apply boat class filter if races exist for it
      if (bcFilter.length > 0) {
        relevantRaces = bcFilter;
      }
    }

    if (relevantRaces.length > 0) {
      // Sort by order to get correct sequence
      const sortedRaces = [...relevantRaces].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      const firstRace = sortedRaces[0];
      const lastRace = sortedRaces[sortedRaces.length - 1];

      // Calculate max lanes (in case they differ)
      const maxLanes = Math.max(
        ...sortedRaces.map(
          (r) => parseInt(r.lanesPerRace || 0) || (r.lanes || []).length,
        ),
      );

      // Calculate interval
      let intervalMinutes = 10;
      if (
        sortedRaces.length > 1 &&
        sortedRaces[0].startTime &&
        sortedRaces[1].startTime
      ) {
        const first = new Date(sortedRaces[0].startTime).getTime();
        const second = new Date(sortedRaces[1].startTime).getTime();
        if (!isNaN(first) && !isNaN(second)) {
          intervalMinutes = Math.round((second - first) / 60000);
        }
      }

      // Format start time
      let startTimeStr = "";
      if (firstRace.startTime) {
        const d = new Date(firstRace.startTime);
        if (!isNaN(d.getTime())) {
          const pad = (n) => n.toString().padStart(2, "0");
          startTimeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      }

      // Resolve distance
      const dist = lastRace.distanceOverride || lastRace.distance;

      // Use the starting race number from the existing block for recall/overwrite
      const startRaceNum = firstRace.order || 1;

      setAutoGenState((prev) => ({
        ...prev,
        // Use existing boatClass selection if present, otherwise infer from last race
        boatClass:
          prev.boatClass || lastRace.boatClass?._id || lastRace.boatClass,
        lanesPerRace: maxLanes > 0 ? maxLanes.toString() : prev.lanesPerRace,
        distance: dist ? dist.toString() : prev.distance,
        intervalMinutes:
          intervalMinutes > 0
            ? intervalMinutes.toString()
            : prev.intervalMinutes,
        startTime: startTimeStr || prev.startTime,
        startRaceNumber: startRaceNum.toString(),
        sessionLabel: firstRace.sessionLabel || prev.sessionLabel,
        racePrefix:
          firstRace.name?.replace(/\s*\d+$/, "").trim() || prev.racePrefix,
      }));
    }
  }, [autoGenState.category, autoGenState.boatClass, races]);

  const [submittingAutoGen, setSubmittingAutoGen] = useState(false);

  const [swapState, setSwapState] = useState({
    sourceRaceId: "",
    sourceLane: "",
    targetRaceId: "",
    targetLane: "",
  });
  const [performingSwap, setPerformingSwap] = useState(false);
  const [scheduleState, setScheduleState] = useState({
    raceId: "",
    order: "",
    startTime: "",
    eventGroupId: "",
    distance: "",
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pendingManualCrew, setPendingManualCrew] = useState([]);
  const [officialResultGroups, setOfficialResultGroups] = useState([]);
  const [loadingOfficialResultGroups, setLoadingOfficialResultGroups] =
    useState(false);
  const [selectedOfficialGroupId, setSelectedOfficialGroupId] = useState("");
  const [provisionalOfficialResult, setProvisionalOfficialResult] =
    useState(null);
  const [showOfficialPreviewTable, setShowOfficialPreviewTable] =
    useState(false);
  const [publishedOfficialResult, setPublishedOfficialResult] = useState(null);
  const [loadingOfficialPreview, setLoadingOfficialPreview] = useState(false);
  const [publishingOfficialResult, setPublishingOfficialResult] =
    useState(false);
  const [unpublishingOfficialResult, setUnpublishingOfficialResult] =
    useState(false);
  const [autoGroupingOfficialResults, setAutoGroupingOfficialResults] =
    useState(false);
  const [publishingAllOfficialResults, setPublishingAllOfficialResults] =
    useState(false);
  const [competitionPenalties, setCompetitionPenalties] = useState([]);
  const [loadingCompetitionPenalties, setLoadingCompetitionPenalties] =
    useState(false);
  const [savingCompetitionPenalty, setSavingCompetitionPenalty] =
    useState(false);
  const [editingPenaltyId, setEditingPenaltyId] = useState("");
  const [deletingPenaltyId, setDeletingPenaltyId] = useState("");
  const [penaltyClubOptions, setPenaltyClubOptions] = useState([]);
  const [loadingPenaltyClubOptions, setLoadingPenaltyClubOptions] =
    useState(false);
  const [penaltyForm, setPenaltyForm] = useState({
    club: "",
    category: "",
    journeyIndex: "",
    penaltyPoints: "",
    targetType: "club",
    firstName: "",
    lastName: "",
    licenseNumber: "",
    role: "",
    observations: "",
  });

  const canManageRaceSchedule =
    user?.role === "admin" || user?.role === "jury_president";

  const selectedOfficialGroup = useMemo(
    () =>
      officialResultGroups.find(
        (group) =>
          normalizeStringId(group.eventGroupId) === selectedOfficialGroupId,
      ) || null,
    [officialResultGroups, selectedOfficialGroupId],
  );

  const officialWorkflowStats = useMemo(() => {
    const total = officialResultGroups.length;
    const ready = officialResultGroups.filter(
      (group) => group.canPublish,
    ).length;
    const published = officialResultGroups.filter(
      (group) => group.published,
    ).length;
    return { total, ready, published };
  }, [officialResultGroups]);

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

  const journeyOptions = useMemo(() => {
    if (!competition?.stages?.length) {
      return [];
    }

    return competition.stages.map((stage, index) => {
      const journeyValue =
        stage.order !== undefined && stage.order !== null
          ? stage.order
          : index + 1;

      return {
        value: String(journeyValue),
        label: stage.name || `Journey ${journeyValue}`,
      };
    });
  }, [competition]);

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
      const catCompare = String(a.catAbbr || "").localeCompare(
        String(b.catAbbr || ""),
      );
      if (catCompare !== 0) return catCompare;
      return String(a.bcCode || "").localeCompare(String(b.bcCode || ""));
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

  const isInternationalCompetition = useMemo(() => {
    const tokens = [
      competition?.scope,
      competition?.competitionScope,
      competition?.level,
      competition?.classification,
      competition?.categoryType,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    if (tokens.some((value) => /international|inter/.test(value))) {
      return true;
    }
    if (tokens.some((value) => /national/.test(value))) {
      return false;
    }

    const allowedCategoryTypes = (competition?.allowedCategories || [])
      .map((categoryRef) => {
        if (categoryRef?.type) {
          return String(categoryRef.type).toLowerCase();
        }
        const categoryId = toDocumentId(categoryRef);
        const match = categories.find(
          (category) => toDocumentId(category) === categoryId,
        );
        return match?.type ? String(match.type).toLowerCase() : null;
      })
      .filter(Boolean);

    if (allowedCategoryTypes.includes("international")) {
      return true;
    }
    if (
      allowedCategoryTypes.length > 0 &&
      allowedCategoryTypes.every((type) => type === "national")
    ) {
      return false;
    }

    const raceCategoryTypes = (races || [])
      .map((race) => {
        if (race?.category?.type) {
          return String(race.category.type).toLowerCase();
        }
        const categoryId = toDocumentId(race?.category);
        const match = categories.find(
          (category) => toDocumentId(category) === categoryId,
        );
        return match?.type ? String(match.type).toLowerCase() : null;
      })
      .filter(Boolean);

    return raceCategoryTypes.includes("international");
  }, [competition, categories, races]);

  const scopeDimensionLabel = isInternationalCompetition ? "Country" : "Club";

  const loadRegistrationSummary = useCallback(async () => {
    if (!token || !competitionId) return;
    setLoadingRegistration(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/registration${globalJourneyFilter ? `?journeyIndex=${globalJourneyFilter}` : ""}`,
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
  }, [competitionId, token, categories, globalJourneyFilter]);

  const loadRankingSystem = useCallback(async () => {
    if (
      authLoading ||
      !token ||
      !competitionId ||
      unauthorizedRedirectedRef.current
    )
      return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rankings/competition/${competitionId}/available-systems`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (response.status === 401) {
        handleUnauthorized(
          data?.message || "Not authorized to access this route",
        );
        return;
      }
      if (response.ok && data.availableSystems?.length > 0) {
        // Pick the first active system as default for point calculation in results
        setActiveRankingSystem(data.availableSystems[0]);
      }
    } catch (error) {
      console.error("Failed to load ranking systems", error);
    }
  }, [authLoading, competitionId, handleUnauthorized, token]);

  const loadCompetition = useCallback(async () => {
    if (
      authLoading ||
      !token ||
      !competitionId ||
      unauthorizedRedirectedRef.current
    ) {
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
      if (response.status === 401) {
        handleUnauthorized(
          payload.message || "Not authorized to access this route",
        );
        return;
      }
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
      if (!unauthorizedRedirectedRef.current) {
        toast.error(error.message);
      }
    } finally {
      setLoadingCompetition(false);
    }
  }, [authLoading, competitionId, handleUnauthorized, token]);

  const loadReferenceData = useCallback(async () => {
    if (authLoading || !token || unauthorizedRedirectedRef.current) {
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
      if (
        categoriesResponse.status === 401 ||
        boatClassesResponse.status === 401
      ) {
        handleUnauthorized("Not authorized to access this route");
        return;
      }
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
  }, [authLoading, handleUnauthorized, token]);

  const loadRaces = useCallback(async () => {
    if (
      authLoading ||
      !token ||
      !competitionId ||
      unauthorizedRedirectedRef.current
    ) {
      return;
    }
    setLoadingRaces(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/races${globalJourneyFilter ? `?journey=${globalJourneyFilter}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const payload = await response.json().catch(() => []);
      if (response.status === 401) {
        handleUnauthorized("Not authorized to access this route");
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load races");
      }
      setRaces(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load races", error);
      if (!unauthorizedRedirectedRef.current) {
        toast.error(error.message);
      }
    } finally {
      setLoadingRaces(false);
    }
  }, [
    authLoading,
    competitionId,
    handleUnauthorized,
    token,
    globalJourneyFilter,
  ]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!token) {
      handleUnauthorized("Please login to access race management.");
    }
  }, [authLoading, handleUnauthorized, token]);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Load races, registration, and ranking after reference data is loaded
  // Global journey filter is also a dependency
  useEffect(() => {
    // Only load registration data once when categories are first available
    // to ensure proper category name resolution and prevent duplicate calls
    if (categories.length > 0) {
      // Run on first load and when globalJourneyFilter changes
      loadRaces();
      loadRegistrationSummary();

      if (!initialDataLoadedRef.current) {
        initialDataLoadedRef.current = true;
        loadRankingSystem();
      }
    }
  }, [
    categories,
    loadRaces,
    loadRegistrationSummary,
    loadRankingSystem,
    globalJourneyFilter,
  ]);

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

  const handleAutoGenFieldChange = (event) => {
    const { name, value, type, checked } = event.target;

    // Special handling for category change to trigger entry loading
    if (name === "category") {
      handleCategorySelect(value);
      setPendingManualCrew([]);
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }

    // Special handling for journey index change to reload entries for that journey
    if (name === "journeyIndex") {
      // If a global journey filter is active, the generator journey is locked to it.
      if (globalJourneyFilter) {
        return;
      }
      if (autoGenState.category) {
        handleCategorySelect(autoGenState.category, null, value);
      } else {
        setAutoGenState((previous) => ({
          ...previous,
          journeyIndex: value,
        }));
      }
      setPendingManualCrew([]);
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }

    setAutoGenState((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
    // Clear pending crew if category or boat class changes to avoid mismatched segments
    if (name === "category" || name === "boatClass") {
      setPendingManualCrew([]);
    }
    // Clear validation on change
    setValidationErrors([]);
    setValidationWarnings([]);
  };

  // Apply preset configuration

  // Toggle section expansion
  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Validate configuration before generation
  const validateConfig = useCallback(() => {
    const errors = [];
    const warnings = [];

    if (!autoGenState.category) {
      errors.push("Please select a category");
    }

    const lanesPerRace = Number(autoGenState.lanesPerRace);
    if (!lanesPerRace || lanesPerRace < 1) {
      errors.push("Lanes per race must be at least 1");
    }

    const journeyIndex = Number(
      globalJourneyFilter || autoGenState.journeyIndex,
    );
    if (!journeyIndex || journeyIndex < 1) {
      errors.push("Journey index must be at least 1");
    }

    // Warnings
    if (autoGenState.overwriteExisting) {
      warnings.push("Existing races will be overwritten");
    }

    if (autoGenState.allowMultipleEntries) {
      warnings.push("Multiple entries per athlete is enabled");
    }

    setValidationErrors(errors);
    setValidationWarnings(warnings);

    return errors.length === 0;
  }, [autoGenState, globalJourneyFilter]);

  // Navigate wizard steps
  const goToStep = useCallback(
    (step) => {
      // Validate before moving forward
      if (step > wizardStep) {
        if (wizardStep === 1 && !autoGenState.category) {
          toast.error("Please select a category first");
          return;
        }
        if (wizardStep === 3 && step === 4) {
          if (!validateConfig()) {
            toast.error("Please fix validation errors");
            return;
          }
        }
        // Mark current step as completed
        setCompletedSteps((prev) =>
          prev.includes(wizardStep) ? prev : [...prev, wizardStep],
        );
      }
      setWizardStep(step);
    },
    [wizardStep, autoGenState.category, validateConfig],
  );

  const handleSwapFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setSwapState((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  const formatDateTimeLocalValue = useCallback((value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, []);

  const handleScheduleRaceChange = useCallback(
    (event) => {
      const raceId = event.target.value;
      if (!raceId) {
        setScheduleState({
          raceId: "",
          order: "",
          startTime: "",
          eventGroupId: "",
          distance: "",
        });
        return;
      }
      const race = races.find((item) => toDocumentId(item) === raceId);
      setScheduleState({
        raceId,
        order: race?.order != null ? String(race.order) : "",
        startTime: formatDateTimeLocalValue(race?.startTime),
        eventGroupId: race?.eventGroupId || "",
        distance: race?.distance != null ? String(race.distance) : "",
      });
    },
    [formatDateTimeLocalValue, races],
  );

  const handleScheduleFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setScheduleState((previous) => ({
      ...previous,
      [name]: value,
    }));
  }, []);

  const submitRaceScheduleUpdate = useCallback(async () => {
    if (!token || !competitionDocumentId || !canManageRaceSchedule) {
      return;
    }

    if (!scheduleState.raceId) {
      toast.error("Select a race to update");
      return;
    }

    const orderValue = Number(scheduleState.order);
    if (!Number.isInteger(orderValue) || orderValue < 1) {
      toast.error("Event number must be a positive integer");
      return;
    }

    if (!scheduleState.startTime) {
      toast.error("Start time is required");
      return;
    }

    setSavingSchedule(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/${scheduleState.raceId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            order: orderValue,
            startTime: scheduleState.startTime,
            eventGroupId: scheduleState.eventGroupId?.trim() || undefined,
            distance: scheduleState.distance ? Number(scheduleState.distance) : undefined,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to update race schedule");
      }

      toast.success("Race schedule updated");
      await loadRaces();
    } catch (error) {
      console.error("Failed to update race schedule", error);
      toast.error(error.message || "Failed to update race schedule");
    } finally {
      setSavingSchedule(false);
    }
  }, [
    canManageRaceSchedule,
    competitionDocumentId,
    loadRaces,
    scheduleState,
    token,
  ]);

  const loadOfficialResultGroups = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }

    setLoadingOfficialResultGroups(true);
    try {
      const params = new URLSearchParams();
      if (globalJourneyFilter) {
        params.append("journeyIndex", globalJourneyFilter);
      }
      const queryString = params.toString();
      const url = `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/groups${queryString ? `?${queryString}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(
          payload.message || "Failed to load official result groups",
        );
      }

      const groups = (Array.isArray(payload) ? payload : [])
        .map((group) => ({
          ...group,
          eventGroupId: normalizeStringId(group?.eventGroupId),
        }))
        .filter((group) => group.eventGroupId);
      setOfficialResultGroups(groups);

      const stillExists = groups.some(
        (group) =>
          normalizeStringId(group.eventGroupId) === selectedOfficialGroupId,
      );
      if (!stillExists) {
        setSelectedOfficialGroupId(normalizeStringId(groups[0]?.eventGroupId));
      }
    } catch (error) {
      console.error("Failed to load official result groups", error);
      toast.error(error.message || "Failed to load official result groups");
    } finally {
      setLoadingOfficialResultGroups(false);
    }
  }, [
    competitionDocumentId,
    globalJourneyFilter,
    selectedOfficialGroupId,
    token,
  ]);

  const loadOfficialPreview = useCallback(async () => {
    if (!token || !competitionDocumentId || !selectedOfficialGroupId) {
      setProvisionalOfficialResult(null);
      setPublishedOfficialResult(null);
      return;
    }

    setLoadingOfficialPreview(true);
    try {
      const params = new URLSearchParams();
      const activeRankingSystemId = toDocumentId(activeRankingSystem);
      if (activeRankingSystemId) {
        params.set("rankingSystemId", activeRankingSystemId);
      }
      const provisionalPath =
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/provisional/${encodeURIComponent(
          selectedOfficialGroupId,
        )}` + (params.toString() ? `?${params.toString()}` : "");

      const [provisionalResponse, officialResponse] = await Promise.all([
        fetch(provisionalPath, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(
          `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/${encodeURIComponent(
            selectedOfficialGroupId,
          )}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      ]);

      const provisionalPayload = await provisionalResponse
        .json()
        .catch(() => null);
      const officialPayload = await officialResponse.json().catch(() => null);

      if (provisionalResponse.status === 404) {
        setProvisionalOfficialResult(null);
        setPublishedOfficialResult(
          officialResponse.ok ? officialPayload : null,
        );
        return;
      }

      if (!provisionalResponse.ok) {
        throw new Error(
          provisionalPayload?.message ||
            "Failed to load provisional official result",
        );
      }

      setProvisionalOfficialResult(provisionalPayload || null);
      setPublishedOfficialResult(officialResponse.ok ? officialPayload : null);
    } catch (error) {
      console.error("Failed to load official preview", error);
      setProvisionalOfficialResult(null);
      setPublishedOfficialResult(null);
      toast.error(error.message || "Failed to load official preview");
    } finally {
      setLoadingOfficialPreview(false);
    }
  }, [
    activeRankingSystem,
    competitionDocumentId,
    selectedOfficialGroupId,
    token,
  ]);

  const publishOfficialResult = useCallback(async () => {
    if (!token || !competitionDocumentId || !selectedOfficialGroupId) {
      return;
    }

    if (!selectedOfficialGroup?.canPublish) {
      toast.error("This event group is not ready. Complete all races first.");
      return;
    }

    const isRepublish = Boolean(publishedOfficialResult);
    const proceed = window.confirm(
      isRepublish
        ? "This will republish and create a new official revision. Continue?"
        : "Publish official results for this event group now?",
    );
    if (!proceed) {
      return;
    }

    setPublishingOfficialResult(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventGroupId: selectedOfficialGroupId,
            rankingSystemId: toDocumentId(activeRankingSystem) || undefined,
            force: isRepublish,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to publish official result");
      }

      toast.success("Official results published");
      await loadOfficialResultGroups();
      await loadOfficialPreview();
    } catch (error) {
      console.error("Failed to publish official results", error);
      toast.error(error.message || "Failed to publish official results");
    } finally {
      setPublishingOfficialResult(false);
    }
  }, [
    activeRankingSystem,
    competitionDocumentId,
    loadOfficialPreview,
    loadOfficialResultGroups,
    publishedOfficialResult,
    selectedOfficialGroup,
    selectedOfficialGroupId,
    token,
  ]);

  const unpublishOfficialResult = useCallback(async () => {
    if (!token || !competitionDocumentId || !selectedOfficialGroupId) {
      return;
    }

    setUnpublishingOfficialResult(true);
    try {
      const proceed = window.confirm(
        "Unpublish official results for this event group? This removes the locked snapshot.",
      );
      if (!proceed) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/${encodeURIComponent(
          selectedOfficialGroupId,
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message || "Failed to unpublish official result",
        );
      }

      toast.success("Official result unpublished");
      await loadOfficialResultGroups();
      await loadOfficialPreview();
    } catch (error) {
      console.error("Failed to unpublish official result", error);
      toast.error(error.message || "Failed to unpublish official result");
    } finally {
      setUnpublishingOfficialResult(false);
    }
  }, [
    competitionDocumentId,
    loadOfficialPreview,
    loadOfficialResultGroups,
    selectedOfficialGroupId,
    token,
  ]);

  const autoAssignOfficialGroups = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }

    const proceed = window.confirm(
      "Auto-assign event groups based on category + boat class + journey for races that have empty group IDs?",
    );
    if (!proceed) {
      return;
    }

    setAutoGroupingOfficialResults(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/auto-group`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rewriteAll: false }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.message || "Failed to auto-assign event groups",
        );
      }

      toast.success(
        `Updated ${payload.updatedCount || 0} races with event groups`,
      );
      await loadRaces();
      await loadOfficialResultGroups();
      await loadOfficialPreview();
    } catch (error) {
      console.error("Failed to auto-assign event groups", error);
      toast.error(error.message || "Failed to auto-assign event groups");
    } finally {
      setAutoGroupingOfficialResults(false);
    }
  }, [
    competitionDocumentId,
    loadOfficialPreview,
    loadOfficialResultGroups,
    loadRaces,
    token,
  ]);

  const publishAllReadyOfficial = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }
    if (officialWorkflowStats.ready === 0) {
      toast.error("No ready event groups to publish.");
      return;
    }

    const proceed = window.confirm(
      `Publish all ready groups now? Ready groups: ${officialWorkflowStats.ready}`,
    );
    if (!proceed) {
      return;
    }

    setPublishingAllOfficialResults(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/official-results/publish-all`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rankingSystemId: activeRankingSystem?._id || undefined,
            force: false,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to publish ready groups");
      }

      toast.success(
        `Published ${payload.publishedGroups || 0} / ${payload.readyGroups || 0} ready groups`,
      );
      await loadOfficialResultGroups();
      await loadOfficialPreview();
    } catch (error) {
      console.error("Failed to publish all ready groups", error);
      toast.error(error.message || "Failed to publish all ready groups");
    } finally {
      setPublishingAllOfficialResults(false);
    }
  }, [
    activeRankingSystem,
    competitionDocumentId,
    loadOfficialPreview,
    loadOfficialResultGroups,
    officialWorkflowStats.ready,
    token,
  ]);

  const loadPenaltyClubOptions = useCallback(async () => {
    if (
      authLoading ||
      !token ||
      !canManageRaceSchedule ||
      unauthorizedRedirectedRef.current
    ) {
      return;
    }

    setLoadingPenaltyClubOptions(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs?isActive=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => []);
      if (response.status === 401) {
        handleUnauthorized("Not authorized to access this route");
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load clubs");
      }

      const clubs = (Array.isArray(payload) ? payload : []).sort((a, b) => {
        const labelA = `${a.code || ""} ${a.name || ""}`.trim();
        const labelB = `${b.code || ""} ${b.name || ""}`.trim();
        return labelA.localeCompare(labelB);
      });
      setPenaltyClubOptions(clubs);
    } catch (error) {
      console.error("Failed to load clubs for penalties", error);
      if (!unauthorizedRedirectedRef.current) {
        toast.error(error.message || "Failed to load clubs");
      }
    } finally {
      setLoadingPenaltyClubOptions(false);
    }
  }, [authLoading, canManageRaceSchedule, handleUnauthorized, token]);

  const loadCompetitionPenalties = useCallback(async () => {
    if (
      authLoading ||
      !token ||
      !competitionDocumentId ||
      !canManageRaceSchedule ||
      unauthorizedRedirectedRef.current
    ) {
      return;
    }

    setLoadingCompetitionPenalties(true);
    try {
      const params = new URLSearchParams();
      if (globalJourneyFilter) {
        params.append("journeyIndex", globalJourneyFilter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/penalties${params.toString() ? `?${params.toString()}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const payload = await response.json().catch(() => []);
      if (response.status === 401) {
        handleUnauthorized("Not authorized to access this route");
        return;
      }
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load penalties");
      }

      setCompetitionPenalties(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load competition penalties", error);
      if (!unauthorizedRedirectedRef.current) {
        toast.error(error.message || "Failed to load penalties");
      }
    } finally {
      setLoadingCompetitionPenalties(false);
    }
  }, [
    authLoading,
    canManageRaceSchedule,
    competitionDocumentId,
    globalJourneyFilter,
    handleUnauthorized,
    token,
  ]);

  const handlePenaltyFieldChange = useCallback((field, value) => {
    setPenaltyForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const resetPenaltyForm = useCallback(() => {
    setPenaltyForm({
      club: "",
      category: "",
      journeyIndex: globalJourneyFilter || "",
      penaltyPoints: "",
      targetType: "club",
      firstName: "",
      lastName: "",
      licenseNumber: "",
      role: "",
      observations: "",
    });
    setEditingPenaltyId("");
  }, [globalJourneyFilter]);

  const startEditPenalty = useCallback((penalty) => {
    setEditingPenaltyId(toDocumentId(penalty) || "");
    setPenaltyForm({
      club: toDocumentId(penalty?.club) || "",
      category: toDocumentId(penalty?.category) || "",
      journeyIndex:
        penalty?.journeyIndex !== undefined && penalty?.journeyIndex !== null
          ? String(penalty.journeyIndex)
          : "",
      penaltyPoints:
        penalty?.penaltyPoints !== undefined && penalty?.penaltyPoints !== null
          ? String(penalty.penaltyPoints)
          : "",
      targetType: penalty?.targetType || "club",
      firstName: penalty?.firstName || "",
      lastName: penalty?.lastName || "",
      licenseNumber: penalty?.licenseNumber || "",
      role: penalty?.role || "",
      observations: penalty?.observations || "",
    });
  }, []);

  const submitCompetitionPenalty = useCallback(async () => {
    if (!token || !competitionDocumentId) {
      return;
    }

    if (!penaltyForm.club) {
      toast.error("Club is required");
      return;
    }

    const penaltyPoints = Number(penaltyForm.penaltyPoints);
    if (!Number.isFinite(penaltyPoints) || penaltyPoints <= 0) {
      toast.error("Penalty points must be a positive number");
      return;
    }

    const journeyIndex =
      penaltyForm.journeyIndex === ""
        ? undefined
        : Number(penaltyForm.journeyIndex);
    if (
      penaltyForm.journeyIndex !== undefined &&
      penaltyForm.journeyIndex !== "" &&
      (!Number.isFinite(journeyIndex) || journeyIndex <= 0)
    ) {
      toast.error("Journey must be a positive number");
      return;
    }

    setSavingCompetitionPenalty(true);
    try {
      const penaltyPayload = {
        club: penaltyForm.club,
        category: penaltyForm.category || undefined,
        journeyIndex,
        penaltyPoints,
        targetType: penaltyForm.targetType || "club",
        firstName: penaltyForm.firstName || undefined,
        lastName: penaltyForm.lastName || undefined,
        licenseNumber: penaltyForm.licenseNumber || undefined,
        role: penaltyForm.role || undefined,
        observations: penaltyForm.observations || undefined,
      };

      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/penalties${editingPenaltyId ? `/${editingPenaltyId}` : ""}`,
        {
          method: editingPenaltyId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(penaltyPayload),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to save penalty");
      }

      toast.success(editingPenaltyId ? "Penalty updated" : "Penalty saved");
      resetPenaltyForm();
      await loadCompetitionPenalties();
    } catch (error) {
      console.error("Failed to save penalty", error);
      toast.error(error.message || "Failed to save penalty");
    } finally {
      setSavingCompetitionPenalty(false);
    }
  }, [
    competitionDocumentId,
    editingPenaltyId,
    loadCompetitionPenalties,
    penaltyForm,
    resetPenaltyForm,
    token,
  ]);

  const deleteCompetitionPenalty = useCallback(
    async (penaltyId) => {
      if (!token || !competitionDocumentId || !penaltyId) {
        return;
      }

      const proceed = window.confirm("Delete this penalty record?");
      if (!proceed) {
        return;
      }

      setDeletingPenaltyId(penaltyId);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionDocumentId}/races/penalties/${penaltyId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to delete penalty");
        }

        toast.success("Penalty deleted");
        await loadCompetitionPenalties();
      } catch (error) {
        console.error("Failed to delete penalty", error);
        toast.error(error.message || "Failed to delete penalty");
      } finally {
        setDeletingPenaltyId("");
      }
    },
    [competitionDocumentId, loadCompetitionPenalties, token],
  );

  useEffect(() => {
    if (!token || !competitionDocumentId || !initialDataLoadedRef.current) {
      return;
    }
    loadOfficialResultGroups();
  }, [
    competitionDocumentId,
    globalJourneyFilter,
    loadOfficialResultGroups,
    races,
    token,
  ]);

  useEffect(() => {
    loadOfficialPreview();
  }, [loadOfficialPreview]);

  useEffect(() => {
    if (!canManageRaceSchedule) {
      return;
    }
    loadPenaltyClubOptions();
    loadCompetitionPenalties();
  }, [
    canManageRaceSchedule,
    globalJourneyFilter,
    loadCompetitionPenalties,
    loadPenaltyClubOptions,
  ]);

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
            const isAlreadyInList = previous.some((entry) => {
              if (entry.athleteId === athleteId) return true;
              if (Array.isArray(entry.crew) && entry.crew.length > 0) {
                return entry.crew.some((m) => toDocumentId(m) === athleteId);
              }
              if (entry.athlete && toDocumentId(entry.athlete) === athleteId)
                return true;
              return false;
            });

            if (isAlreadyInList) {
              toast.warn("Athlete is already in the start list");
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
              journeyIndex:
                globalJourneyFilter || autoGenState.journeyIndex || 1,
            };

            if (finalCrew && finalCrew.length > 0) {
              newEntry.crew = finalCrew;
              newEntry.crewNumber = assignedCrewNumber;
              const firstId = toDocumentId(finalCrew[0]);
              if (firstId) newEntry.athleteId = firstId;
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

  const handleUnwithdrawEntry = useCallback(
    async (entryId) => {
      if (!entryId || !token) return;
      const proceed = window.confirm(
        "Restore this withdrawn entry back to active status?",
      );
      if (!proceed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}/unwithdraw`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to restore entry");
        }

        toast.success("Entry restored");
        const newStats = await loadRegistrationSummary();
        if (autoGenState.category) {
          handleCategorySelect(autoGenState.category, newStats);
        }
      } catch (error) {
        console.error("Failed to restore entry", error);
        toast.error(error.message || "Failed to restore entry");
      }
    },
    [competitionId, token, loadRegistrationSummary, autoGenState.category],
  );

  const handleRestoreWithdrawnLane = useCallback(
    async (indicator) => {
      if (!token || !competitionId || !indicator) {
        return;
      }

      const actionKey = indicator.entryId || indicator.key;
      if (!actionKey) {
        return;
      }

      const proceed = window.confirm(
        "Restore this withdrawn participant to active status?",
      );
      if (!proceed) {
        return;
      }

      setRestoringWithdrawnKey(actionKey);
      try {
        let response;

        if (indicator.entryId) {
          response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}/registration/${indicator.entryId}/unwithdraw`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } else {
          response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}/registration/restore-lane`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                raceId: indicator.raceId,
                lane: indicator.lane,
              }),
            },
          );
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to restore participant");
        }

        toast.success("Withdrawn participant restored");
        await loadRaces();
        const newStats = await loadRegistrationSummary();
        if (autoGenState.category) {
          handleCategorySelect(autoGenState.category, newStats);
        }
      } catch (error) {
        console.error("Failed to restore withdrawn participant", error);
        toast.error(error.message || "Failed to restore participant");
      } finally {
        setRestoringWithdrawnKey("");
      }
    },
    [
      token,
      competitionId,
      loadRaces,
      loadRegistrationSummary,
      autoGenState.category,
    ],
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
    // Start with entries populated by handleCategorySelect (manual + race-sourced)
    let result = [...entries];

    // Also merge database registration entries for the selected category
    // (handles cases where entries exist in registrations but not in existing races)
    if (
      registrationStats &&
      Array.isArray(registrationStats.byCategory) &&
      autoGenState.category
    ) {
      const catId = autoGenState.category;
      const catData = registrationStats.byCategory.find((c) => c.id === catId);
      if (catData && Array.isArray(catData.entries)) {
        const targetJourney =
          Number(globalJourneyFilter || autoGenState.journeyIndex) || 1;
        const validEntries = catData.entries.filter((e) => {
          const eJourney = e.journeyIndex ? Number(e.journeyIndex) : 1;
          // Support competitions without journeys (classic) by showing all or matching Journey 1
          return eJourney === targetJourney;
        });
        const dbEntries = validEntries.map((e, idx) => {
          const entryId = toDocumentId(e.id || e._id);
          const athleteId =
            toDocumentId(e.athlete) ||
            (Array.isArray(e.crew) && e.crew.length > 0
              ? toDocumentId(e.crew[0])
              : null) ||
            entryId;
          const clubObj = e.club || null;

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
            id: entryId,
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

        // Only add DB entries that aren't already present (by athleteId)
        const existingAthleteIds = new Set(
          result.map((e) => e.athleteId).filter(Boolean),
        );
        const uniqueDbEntries = dbEntries.filter(
          (e) => !existingAthleteIds.has(e.athleteId),
        );

        result = [...result, ...uniqueDbEntries];
      }
    }

    // Apply local overrides to any entries already in result
    result = result.map((entry) => {
      const overrides = dbEntryOverrides[entry.id] || {};
      if (Object.keys(overrides).length > 0) {
        return { ...entry, ...overrides };
      }
      return entry;
    });

    // Filter by boat class if selected
    if (autoGenState.boatClass) {
      result = result.filter((entry) => {
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
    globalJourneyFilter,
    registrationStats,
    dbEntryOverrides,
  ]);

  const withdrawnRaceLaneIndicators = useMemo(() => {
    const selectedCategoryId = autoGenState.category;
    if (!selectedCategoryId) {
      return [];
    }

    const selectedBoatClassId = autoGenState.boatClass || null;

    const activeAssignmentKeys = new Set();
    const registrationEventKeys = new Set();
    const withdrawnEntryIdsByAssignmentKey = new Map();

    const selectedCategoryData = registrationStats?.byCategory?.find(
      (cat) => cat.id === selectedCategoryId,
    );
    const selectedCategoryEntries = Array.isArray(selectedCategoryData?.entries)
      ? selectedCategoryData.entries
      : [];

    selectedCategoryEntries.forEach((entry) => {
      const categoryId = toDocumentId(entry?.category) || selectedCategoryId;
      const boatClassId = toDocumentId(entry?.boatClass);
      const crewIds = toSortedUniqueIds(
        (entry?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(entry?.athlete);
      registrationEventKeys.add(
        buildEventAssignmentKey({ categoryId, boatClassId }),
      );

      const assignmentKey = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId: toDocumentId(entry?.club),
        athleteId,
        crewIds,
      });
      if (
        assignmentKey &&
        String(entry?.status || "").toLowerCase() === "withdrawn"
      ) {
        withdrawnEntryIdsByAssignmentKey.set(
          assignmentKey,
          entry.id || entry._id || null,
        );
      }

      if (String(entry?.status || "").toLowerCase() === "withdrawn") {
        return;
      }

      if (assignmentKey) {
        activeAssignmentKeys.add(assignmentKey);
      }
    });

    const seen = new Set();
    const indicators = [];

    races
      .filter((race) => {
        const raceCategoryId = toDocumentId(race?.category);
        if (raceCategoryId !== selectedCategoryId) {
          return false;
        }
        if (!selectedBoatClassId) {
          return true;
        }
        return toDocumentId(race?.boatClass) === selectedBoatClassId;
      })
      .forEach((race) => {
        const raceCategoryId =
          toDocumentId(race?.category) || selectedCategoryId;
        const raceBoatClassId = toDocumentId(race?.boatClass) || null;

        (race?.lanes || []).forEach((lane, laneIndex) => {
          const hasAssignedAthlete = Boolean(lane?.athlete);
          const hasAssignedCrew =
            Array.isArray(lane?.crew) && lane.crew.length > 0;
          if (!hasAssignedAthlete && !hasAssignedCrew) {
            return;
          }

          const categoryId = toDocumentId(lane?.category) || raceCategoryId;
          const boatClassId = toDocumentId(lane?.boatClass) || raceBoatClassId;
          const assignmentKey = buildAssignmentKey({
            categoryId,
            boatClassId,
            clubId: toDocumentId(lane?.club),
            athleteId: hasAssignedCrew ? null : toDocumentId(lane?.athlete),
            crewIds: toSortedUniqueIds(
              (lane?.crew || []).map((member) => toDocumentId(member)),
            ),
          });

          if (!assignmentKey || seen.has(assignmentKey)) {
            return;
          }

          const eventKey = buildEventAssignmentKey({ categoryId, boatClassId });
          const explicitWithdrawn =
            String(lane?.registrationStatus || "").toLowerCase() ===
              "withdrawn" ||
            String(lane?.result?.status || "").toLowerCase() === "withdrawn";
          const inferredWithdrawn =
            registrationEventKeys.has(eventKey) &&
            !activeAssignmentKeys.has(assignmentKey);

          if (!explicitWithdrawn && !inferredWithdrawn) {
            return;
          }

          seen.add(assignmentKey);

          const resolvedCrew = hasAssignedCrew
            ? lane.crew.map((member) => {
                if (member && typeof member === "object") {
                  return member;
                }
                const memberId = toDocumentId(member);
                return memberId
                  ? raceAthleteLookup.get(memberId) || member
                  : member;
              })
            : [];
          const resolvedAthlete = hasAssignedCrew
            ? null
            : lane?.athlete && typeof lane.athlete === "object"
              ? lane.athlete
              : raceAthleteLookup.get(toDocumentId(lane?.athlete));
          const athleteName = hasAssignedCrew
            ? formatCrewName(resolvedCrew) || "Unknown crew"
            : resolvedAthlete
              ? formatAthleteName(resolvedAthlete)
              : "Unknown athlete";

          const laneClubObj =
            lane?.club && typeof lane.club === "object" ? lane.club : null;
          const fallbackClubName = raceClubLookup.get(toDocumentId(lane?.club));

          indicators.push({
            key: assignmentKey,
            entryId:
              withdrawnEntryIdsByAssignmentKey.get(assignmentKey) || null,
            raceId: race?._id,
            athleteName,
            clubCode: laneClubObj?.code || "",
            clubName: laneClubObj?.name || fallbackClubName || "",
            raceOrder: Number(race?.order) || 0,
            lane: Number(lane?.lane) || laneIndex + 1,
          });
        });
      });

    return indicators.sort((a, b) => {
      if (a.raceOrder !== b.raceOrder) {
        return a.raceOrder - b.raceOrder;
      }
      if (a.lane !== b.lane) {
        return a.lane - b.lane;
      }
      return String(a.athleteName || "").localeCompare(
        String(b.athleteName || ""),
      );
    });
  }, [
    autoGenState.category,
    autoGenState.boatClass,
    races,
    registrationStats,
    raceAthleteLookup,
    raceClubLookup,
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
              journeyIndex:
                e.journeyIndex ||
                globalJourneyFilter ||
                autoGenState.journeyIndex ||
                1,
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

    const journeyIndex = Number(
      globalJourneyFilter || autoGenState.journeyIndex,
    );
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
        crewNumber: requiredCrewSize > 1 ? entry.crewNumber : undefined,
        clubId: entry.clubId || undefined,
        seed: entry.seed,
        notes: entry.notes ? entry.notes.toString().trim() : undefined,
      })),
    };

    setSubmittingAutoGen(true);
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStage("Validating entries...");

    try {
      // Simulate progress stages
      setGenerationProgress(20);
      setGenerationStage("Preparing race configuration...");
      await new Promise((r) => setTimeout(r, 300));

      setGenerationProgress(40);
      setGenerationStage("Calculating lane assignments...");

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

      setGenerationProgress(70);
      setGenerationStage("Processing response...");

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to auto-generate races");
      }

      setGenerationProgress(90);
      setGenerationStage("Finalizing races...");
      await new Promise((r) => setTimeout(r, 200));

      setGenerationProgress(100);
      setGenerationStage("Complete!");

      toast.success(
        `🎉 ${Array.isArray(data) ? data.length : 0} race(s) generated successfully!`,
      );

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
      // Reset wizard to step 1 after successful generation
      setWizardStep(1);
      setCompletedSteps([]);
      setSelectedPreset(null);
      // Prevent category auto-fill effect from overwriting incremented next values
      // after races reload.
      skipAutoFillAfterGenerateRef.current = true;
      await loadRaces();
      await loadRegistrationSummary(); // Refresh categories overview
    } catch (error) {
      console.error("Failed to auto-generate races", error);
      toast.error(error.message);
    } finally {
      setSubmittingAutoGen(false);
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStage("");
    }
  }, [
    autoGenState,
    competitionDocumentId,
    competition,
    entries,
    globalJourneyFilter,
    races,
    relevantEntries,
    requiredCrewSize,
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
      const race = races.find((r) => toDocumentId(r) === raceId);
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
            {shouldShowJourney(competition, [props])
              ? `Journey ${props.journeyIndex || 1}`
              : "-"}
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
        template: (props) => {
          const raceId = toDocumentId(props?._id) || toDocumentId(props?.id);

          return (
            <div className="flex items-center justify-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 h-7 px-2 text-xs"
                onClick={() => {
                  if (!raceId) {
                    toast.error("Invalid race id");
                    return;
                  }
                  navigate(`/competitions/${competitionId}/races/${raceId}`);
                }}
              >
                View / Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs"
                onClick={() => {
                  if (!raceId) {
                    toast.error("Invalid race id");
                    return;
                  }
                  handleDeleteRace(raceId);
                }}
              >
                ✕
              </Button>
            </div>
          );
        },
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
      toast.info("Generating Start List PDF...");
      await new Promise((resolve) => setTimeout(resolve, 0));

      // --- GROUP BY START TIME LOGIC ---
      const rawTargetRaces = Array.isArray(racesToExport)
        ? racesToExport
        : sortedRaces;
      const timeMap = new Map();
      rawTargetRaces.forEach((race) => {
        const raceId = toDocumentId(race);
        const timeKey = race.startTime
          ? new Date(race.startTime).getTime().toString()
          : `no-time-${raceId || Math.random()}`;
        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {
            ...race,
            lanes: [...(race.lanes || [])].map((l) => ({
              ...l,
              _originalRaceId: raceId,
              sourceRaceId: raceId,
              sourceRaceOrder: race.order,
            })),
          });
        } else {
          const existing = timeMap.get(timeKey);
          existing.lanes.push(
            ...(race.lanes || []).map((l) => ({
              ...l,
              _originalRaceId: raceId,
              sourceRaceId: raceId,
              sourceRaceOrder: race.order,
            })),
          );
          if (race.order && (!existing.order || race.order < existing.order)) {
            existing.order = race.order;
          }
        }
      });
      const targetRaces = Array.from(timeMap.values()).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      if (!targetRaces.length) {
        toast.info("No races to export");
        return;
      }

      try {
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const asOfLabel = formatAsOfLabel();

        // Load images for header/footer (parallel)
        const [
          headerData,
          footerData,
          logoData,
          sponsorData,
          arabicFontBase64,
        ] = await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/logo.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
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

        // Calculate header height (3mm top margin + 8mm gap after line)
        let headerHeight = 32;
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          headerHeight = pageWidth / (imgProps.width / imgProps.height) + 3 + 8;
        }

        // Event location information

        // Location (safe string extraction)
        const compLocation = String(
          competition?.location?.name ||
            competition?.venue?.name ||
            (typeof competition?.venue === "string"
              ? competition.venue
              : null) ||
            (typeof competition?.location === "string"
              ? competition.location
              : null) ||
            "Location",
        );

        const competitionTitle =
          competition?.names?.en ||
          competition?.name ||
          competition?.code ||
          "Competition";

        // Map to store clubs per page for legend
        const pageClubsMap = new Map();

        for (let raceIndex = 0; raceIndex < targetRaces.length; raceIndex++) {
          const race = targetRaces[raceIndex];
          if (raceIndex > 0) {
            doc.addPage();
          }

          let yPos = headerHeight;

          // Race Header Block
          const categoryId = toDocumentId(race.category);
          const category = categoryId
            ? categories.find((item) => toDocumentId(item) === categoryId)
            : null;
          const boatClassId = toDocumentId(race.boatClass);
          const boatClass = boatClassId
            ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
            : null;

          // --- AGGREGATE ORIGINAL RACE INFO ---
          const distinctOrigIds = Array.from(
            new Set(
              (race.lanes || [])
                .map((l) => l.sourceRaceId || l._originalRaceId)
                .filter(Boolean),
            ),
          );
          const allOrigRaces = distinctOrigIds.length
            ? distinctOrigIds
                .map((id) =>
                  (typeof rawTargetRaces !== "undefined"
                    ? rawTargetRaces
                    : rawRacesWithResults
                  ).find((r) => toDocumentId(r) === toDocumentId(id)),
                )
                .filter(Boolean)
            : [race];
          const origRaceLookup = new Map(
            allOrigRaces
              .map((r) => [toDocumentId(r), r])
              .filter(([id]) => Boolean(id)),
          );

          const distinctEnTitles = new Set();
          const distinctArTitles = new Set();
          const distinctCodes = new Set();
          const distinctOrders = new Set();

          allOrigRaces.forEach((r) => {
            const c = categories.find(
              (x) => toDocumentId(x) === toDocumentId(r.category),
            );
            const b = boatClasses.find(
              (x) => toDocumentId(x) === toDocumentId(r.boatClass),
            );
            const evtEn = formatEventTitleWithBoatClass(c, b, "en");
            const evtAr = formatEventTitleWithBoatClass(c, b, "ar");
            if (evtEn) distinctEnTitles.add(evtEn);
            if (evtAr) distinctArTitles.add(evtAr);
            if (c || b) {
              distinctCodes.add(
                formatRaceCodeForHeader(generateRaceCode(c, b), c),
              );
            }
            if (r.order) distinctOrders.add(r.order);
          });

          let fullEventName = Array.from(distinctEnTitles).join(" / ");
          let fullEventNameAr = Array.from(distinctArTitles).join(" / ");
          let rightHeaderCode = Array.from(distinctCodes).join(" / ");
          let orderStr =
            Array.from(distinctOrders)
              .sort((a, b) => a - b)
              .join(" / ") ||
            race.order ||
            "1";

          // Compute Phase: Journey by journeyIndex, Final only when configured max journey is reached.
          const showJourney = shouldShowJourney(competition, allOrigRaces);
          const explicitNonFinalPhases = Array.from(
            new Set(
              allOrigRaces
                .map((r) => String(r?.phase || "").trim())
                .filter((p) => p && !/^final$/i.test(p))
                .filter((p) => showJourney || !isJourneyPhaseLabel(p)),
            ),
          );
          const journeyValues = Array.from(
            new Set(
              allOrigRaces
                .map((r) => Number(r?.journeyIndex))
                .filter((j) => Number.isFinite(j) && j > 0),
            ),
          ).sort((a, b) => a - b);
          const configuredMaxJourney =
            Number(
              competition?.maximumJourney ??
                competition?.maxJourney ??
                competition?.journeysCount,
            ) || null;

          let phaseStr = "Final";
          if (explicitNonFinalPhases.length > 0) {
            phaseStr = explicitNonFinalPhases.join(" / ");
          } else if (showJourney && journeyValues.length > 0) {
            const reachedConfiguredFinal =
              configuredMaxJourney != null &&
              journeyValues.every((j) => j >= configuredMaxJourney);
            phaseStr = reachedConfiguredFinal
              ? "Final"
              : `Journey ${journeyValues.join(" / ")}`;
          }

          // Use our mapped variables in the template rendering below

          // --- Header Section (matches RaceDetail) ---
          // Competition title centered (14pt bold)
          doc.setFontSize(14);
          doc.setFont(fontName, "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(competitionTitle, center, yPos, { align: "center" });

          // Location left, date right (9pt normal) on same line
          const raceDate = race.startTime || competition?.startDate || new Date();
          const eventDateStr = new Date(raceDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          doc.text(compLocation, leftMargin, yPos);
          doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

          yPos += 2;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(leftMargin, yPos, rightMargin, yPos);
          yPos += 5;

          // --- Line 1: Race order | Start List | Race code (14pt bold) ---
          doc.setFontSize(12);
          doc.setFont(fontName, "bold");
          doc.text(String(orderStr), leftMargin, yPos);
          doc.text("Start List", center, yPos, { align: "center" });
          doc.text(
            rightHeaderCode ||
              formatRaceCodeForHeader(
                generateRaceCode(category, boatClass),
                category,
              ),
            rightMargin,
            yPos,
            {
              align: "right",
            },
          );

          // --- Line 2: (Event) | Category + Boat Class ---
          yPos += 5;
          const eventLabel = "(Event)";
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.text(eventLabel, leftMargin, yPos);
          const eventLabelWidth = doc.getTextWidth(eventLabel);
          const eventStartX = leftMargin + eventLabelWidth + 3;
          const eventLineMaxWidth = rightMargin - eventStartX;
          const eventLineCenter = eventStartX + eventLineMaxWidth / 2;
          fullEventName =
            fullEventName ||
            formatEventTitleWithBoatClass(category, boatClass, "en");
          const eventTitleLayout = drawAdaptiveCenteredTitle({
            doc,
            text: fullEventName,
            center: eventLineCenter,
            y: yPos,
            maxWidth: eventLineMaxWidth,
            font: fontName,
            style: "bold",
            initialSize: 10.5,
            minSize: 8,
            maxLines: 1,
            lineGap: 4,
          });

          // --- Line 3: Arabic text (center) | Distance (right) ---
          const raceDistance =
            race.distanceOverride ??
            race.distance ??
            allOrigRaces.find((r) => r?.distanceOverride != null)
              ?.distanceOverride ??
            competition?.defaultDistance ??
            competition?.distance ??
            null;
          fullEventNameAr =
            fullEventNameAr ||
            formatEventTitleWithBoatClass(category, boatClass, "ar");

          yPos = eventTitleLayout.yEnd;

          if (fullEventNameAr && arabicFontName) {
            yPos += 5;
            const arabicSize = fitSingleLineFontSize({
              doc,
              text: fullEventNameAr,
              maxWidth: 110,
              initialSize: 12,
              minSize: 8.5,
              font: arabicFontName,
              style: "normal",
            });
            doc.setFontSize(arabicSize);
            doc.setFont(arabicFontName, "normal");
            doc.text(fullEventNameAr, center, yPos, { align: "center" });
            doc.setFont(fontName, "normal");
            doc.setFontSize(9);
            if (raceDistance) {
              doc.text(`Distance: ${raceDistance}m`, rightMargin, yPos, {
                align: "right",
              });
            }
          } else if (raceDistance) {
            yPos += 4;
            doc.setFontSize(9);
            doc.text(`Distance: ${raceDistance}m`, center, yPos, {
              align: "center",
            });
          }

          // --- Line 4: Start Time | Journey/Phase | Race # ---
          yPos += 6;
          doc.setFontSize(9);
          doc.setFont(fontName, "bold");
          const startTime = race.startTime
            ? new Date(race.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "00:00";
          doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
          doc.setFontSize(10);
          doc.setFont(fontName, "bold");
          doc.text(phaseStr, center, yPos, { align: "center" });
          doc.setFontSize(9);
          doc.text(`Race ${raceIndex + 1}`, rightMargin, yPos, {
            align: "right",
          });
          yPos += 2;

          // --- Calculate legend for bottom margin ---
          const uniqueClubs = Array.from(
            new Set(
              (race.lanes || [])
                .map((l) => toDocumentId(l.club))
                .filter(Boolean),
            ),
          )
            .map(
              (id) =>
                (race.lanes || []).find((l) => toDocumentId(l.club) === id)
                  ?.club,
            )
            .filter(Boolean)
            .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

          const legendLineHeight = 4;
          const legendBoxHeight =
            uniqueClubs.length > 0
              ? uniqueClubs.length * legendLineHeight + 7
              : 0;
          const bottomMargin = 35 + legendBoxHeight + 14;

          // Store clubs for this page
          pageClubsMap.set(raceIndex + 1, uniqueClubs);

          // --- Helper: format name with uppercase last name ---
          const formatNameForPdf = (a) => {
            if (!a) return "Unknown";
            const first = a.firstName || "";
            const last = (a.lastName || "").toUpperCase();
            return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
          };

          // --- Table ---
          const { tableBody } = buildStartListTableBody({
            lanes: race.lanes || [],
            referenceRace: race,
            originalRaceLookup: origRaceLookup,
            athleteLookup: raceAthleteLookup,
            categories,
            boatClasses,
            toDocumentId,
            generateRaceCode,
            formatName: formatNameForPdf,
          });

          autoTable(doc, {
            startY: yPos,
            head: [["Lane", "Club", "Name", "License", "DOB", "Event"]],
            body: tableBody,
            theme: "plain",
            headStyles: {
              fillColor: [255, 255, 255],
              textColor: [0, 0, 0],
              fontStyle: "bold",
              lineWidth: 0.1,
              lineColor: [0, 0, 0],
              cellPadding: 1,
            },
            styles: {
              fontSize: 9,
              cellPadding: 1,
              font: fontName,
            },
            columnStyles: {
              0: { cellWidth: 15, halign: "center" },
              1: { fontStyle: "bold" },
              2: { fontStyle: "bold" },
              3: { fontStyle: "bold" },
              4: { fontStyle: "bold" },
              5: { fontStyle: "bold" },
            },
            margin: {
              left: leftMargin,
              right: 14,
              bottom: bottomMargin,
              top: headerHeight,
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

          yPos = doc.lastAutoTable.finalY + 4;

          // Progression Rule Box (ensure no overlap with legend)
          const progressionEnd = yPos + 7;
          const legendTop =
            uniqueClubs.length > 0
              ? pageHeight - 35 - (uniqueClubs.length * legendLineHeight + 7)
              : pageHeight - 35;
          if (progressionEnd < legendTop) {
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, yPos, 182, 7);
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            const statusText =
              race.notes || "Progression System: Subject to competition rules.";
            doc.text(statusText, leftMargin + 2, yPos + 5);
          }
        }

        // --- Post-Processing: Add Header, Legend & Footer to ALL Pages ---
        const pageCount = doc.internal.getNumberOfPages();

        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);

          // --- Header Image ---
          if (headerData) {
            const imgProps = doc.getImageProperties(headerData);
            const h = pageWidth / (imgProps.width / imgProps.height);
            doc.addImage(
              headerData,
              getImageFormat(headerData),
              0,
              3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(leftMargin, h + 5, rightMargin, h + 5);
          }

          // --- Legend on each page ---
          const pageClubs = pageClubsMap.get(i) || [];
          if (pageClubs.length > 0) {
            const clubs = [...pageClubs].sort((a, b) =>
              (a.code || "").localeCompare(b.code || ""),
            );

            const lineHeight = 4;
            const boxHeight = clubs.length * lineHeight + 7;
            const legendY = pageHeight - 35 - boxHeight;

            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, legendY, 182, boxHeight);

            doc.setFontSize(9);
            doc.setFont(fontName, "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("Legend:", leftMargin + 2, legendY + 5);

            doc.setFontSize(8);
            let clubY = legendY + 9;

            for (const club of clubs) {
              const code = club.code || "---";
              const frenchName =
                club.name || club.names?.fr || club.names?.en || "";
              const arabicName = club.nameAr || club.names?.ar || "";

              doc.setFont(fontName, "bold");
              doc.text(code + ": ", leftMargin + 4, clubY);

              const codeWidth = doc.getTextWidth(code + ": ");
              doc.setFont(fontName, "normal");
              doc.text(frenchName, leftMargin + 4 + codeWidth, clubY);

              if (arabicName && arabicFontName) {
                const frenchWidth = doc.getTextWidth(frenchName);
                doc.setFont(arabicFontName, "normal");
                doc.text(
                  " : " + arabicName,
                  leftMargin + 4 + codeWidth + frenchWidth,
                  clubY,
                );
                doc.setFont(fontName, "normal");
              }
              clubY += lineHeight;
            }
          }

          // --- Footer Image ---
          if (footerData) {
            const imgProps = doc.getImageProperties(footerData);
            const h = pageWidth / (imgProps.width / imgProps.height);
            doc.addImage(
              footerData,
              getImageFormat(footerData),
              0,
              pageHeight - h - 3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(
              leftMargin,
              pageHeight - h - 5,
              rightMargin,
              pageHeight - h - 5,
            );
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100);
            doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              { align: "right" },
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
              pageHeight - h - 5,
              rightMargin,
              pageHeight - h - 5,
            );
            doc.addImage(
              sponsorData,
              getImageFormat(sponsorData),
              x,
              pageHeight - h - 3,
              w,
              h,
            );
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              {
                align: "right",
              },
            );
          } else {
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(leftMargin, pageHeight - 15, rightMargin, pageHeight - 15);
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(asOfLabel, leftMargin, pageHeight - 8);
            doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
              align: "right",
            });
          }
        }

        doc.save(buildStartListPdfFileName(competition, targetRaces));
        toast.success("Start List PDF exported successfully");
      } catch (err) {
        console.error("exportStartListPDF error:", err);
        toast.error(
          "Failed to export Start List PDF: " +
            (err.message || "Unknown error"),
        );
      }
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

  const exportJuryStartListPDF = useCallback(
    async (racesToExport = null) => {
      toast.info("Generating Jury Start List PDF...");
      await new Promise((resolve) => setTimeout(resolve, 0));

      // --- GROUP BY START TIME LOGIC (same as Start List) ---
      const rawTargetRaces = Array.isArray(racesToExport)
        ? racesToExport
        : sortedRaces;
      const timeMap = new Map();
      rawTargetRaces.forEach((race) => {
        const raceId = toDocumentId(race);
        const timeKey = race.startTime
          ? new Date(race.startTime).getTime().toString()
          : `no-time-${raceId || Math.random()}`;
        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {
            ...race,
            lanes: [...(race.lanes || [])].map((l) => ({
              ...l,
              _originalRaceId: raceId,
            })),
          });
        } else {
          const existing = timeMap.get(timeKey);
          existing.lanes.push(
            ...(race.lanes || []).map((l) => ({
              ...l,
              _originalRaceId: raceId,
            })),
          );
          if (race.order && (!existing.order || race.order < existing.order)) {
            existing.order = race.order;
          }
        }
      });
      const targetRaces = Array.from(timeMap.values()).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      if (!targetRaces.length) {
        toast.info("No races to export");
        return;
      }

      try {
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const asOfLabel = formatAsOfLabel();

        const [
          headerData,
          footerData,
          logoData,
          sponsorData,
          arabicFontBase64,
        ] = await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/logo.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });

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

        let headerHeight = 32;
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          headerHeight = pageWidth / (imgProps.width / imgProps.height) + 3 + 8;
        }

        const compLocation = String(
          competition?.location?.name ||
            competition?.venue?.name ||
            (typeof competition?.venue === "string"
              ? competition.venue
              : null) ||
            (typeof competition?.location === "string"
              ? competition.location
              : null) ||
            "Location",
        );

        const competitionTitle =
          competition?.names?.en ||
          competition?.name ||
          competition?.code ||
          "Competition";

        const pageClubsMap = new Map();

        for (let raceIndex = 0; raceIndex < targetRaces.length; raceIndex++) {
          const race = targetRaces[raceIndex];
          if (raceIndex > 0) {
            doc.addPage();
          }

          let yPos = headerHeight;

          const categoryId = toDocumentId(race.category);
          const category = categoryId
            ? categories.find((item) => toDocumentId(item) === categoryId)
            : null;
          const boatClassId = toDocumentId(race.boatClass);
          const boatClass = boatClassId
            ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
            : null;

          const distinctOrigIds = Array.from(
            new Set(
              (race.lanes || [])
                .map((l) => l.sourceRaceId || l._originalRaceId)
                .filter(Boolean),
            ),
          );
          const allOrigRaces = distinctOrigIds.length
            ? distinctOrigIds
                .map((id) =>
                  rawTargetRaces.find(
                    (r) => toDocumentId(r) === toDocumentId(id),
                  ),
                )
                .filter(Boolean)
            : [race];
          const origRaceLookup = new Map(
            allOrigRaces
              .map((r) => [toDocumentId(r), r])
              .filter(([id]) => Boolean(id)),
          );

          const distinctEnTitles = new Set();
          const distinctArTitles = new Set();
          const distinctCodes = new Set();
          const distinctOrders = new Set();

          allOrigRaces.forEach((r) => {
            const c = categories.find(
              (x) => toDocumentId(x) === toDocumentId(r.category),
            );
            const b = boatClasses.find(
              (x) => toDocumentId(x) === toDocumentId(r.boatClass),
            );
            const evtEn = formatEventTitleWithBoatClass(c, b, "en");
            const evtAr = formatEventTitleWithBoatClass(c, b, "ar");
            if (evtEn) distinctEnTitles.add(evtEn);
            if (evtAr) distinctArTitles.add(evtAr);
            if (c || b) {
              distinctCodes.add(
                formatRaceCodeForHeader(generateRaceCode(c, b), c),
              );
            }
            if (r.order) distinctOrders.add(r.order);
          });

          let fullEventName = Array.from(distinctEnTitles).join(" / ");
          let fullEventNameAr = Array.from(distinctArTitles).join(" / ");
          let rightHeaderCode = Array.from(distinctCodes).join(" / ");
          let orderStr =
            Array.from(distinctOrders)
              .sort((a, b) => a - b)
              .join(" / ") ||
            race.order ||
            "1";

          const showJourney = shouldShowJourney(competition, allOrigRaces);
          const explicitNonFinalPhases = Array.from(
            new Set(
              allOrigRaces
                .map((r) => String(r?.phase || "").trim())
                .filter((p) => p && !/^final$/i.test(p))
                .filter((p) => showJourney || !isJourneyPhaseLabel(p)),
            ),
          );
          const journeyValues = Array.from(
            new Set(
              allOrigRaces
                .map((r) => Number(r?.journeyIndex))
                .filter((j) => Number.isFinite(j) && j > 0),
            ),
          ).sort((a, b) => a - b);
          const configuredMaxJourney =
            Number(
              competition?.maximumJourney ??
                competition?.maxJourney ??
                competition?.journeysCount,
            ) || null;

          let phaseStr = "Final";
          if (explicitNonFinalPhases.length > 0) {
            phaseStr = explicitNonFinalPhases.join(" / ");
          } else if (showJourney && journeyValues.length > 0) {
            const reachedConfiguredFinal =
              configuredMaxJourney != null &&
              journeyValues.every((j) => j >= configuredMaxJourney);
            phaseStr = reachedConfiguredFinal
              ? "Final"
              : `Journey ${journeyValues.join(" / ")}`;
          }

          doc.setFontSize(14);
          doc.setFont(fontName, "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(competitionTitle, center, yPos, { align: "center" });

          const raceDate = race.startTime || competition?.startDate || new Date();
          const eventDateStr = new Date(raceDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          doc.text(compLocation, leftMargin, yPos);
          doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

          yPos += 2;
          doc.setLineWidth(0.5);
          doc.setDrawColor(0);
          doc.line(leftMargin, yPos, rightMargin, yPos);
          yPos += 5;

          doc.setFontSize(12);
          doc.setFont(fontName, "bold");
          doc.text(String(orderStr), leftMargin, yPos);
          doc.text("Jury Start List", center, yPos, { align: "center" });
          doc.text(
            rightHeaderCode ||
              formatRaceCodeForHeader(
                generateRaceCode(category, boatClass),
                category,
              ),
            rightMargin,
            yPos,
            {
              align: "right",
            },
          );

          yPos += 5;
          const eventLabel = "(Event)";
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.text(eventLabel, leftMargin, yPos);
          const eventLabelWidth = doc.getTextWidth(eventLabel);
          const eventStartX = leftMargin + eventLabelWidth + 3;
          const eventLineMaxWidth = rightMargin - eventStartX;
          const eventLineCenter = eventStartX + eventLineMaxWidth / 2;
          fullEventName =
            fullEventName ||
            formatEventTitleWithBoatClass(category, boatClass, "en");
          const eventTitleLayout = drawAdaptiveCenteredTitle({
            doc,
            text: fullEventName,
            center: eventLineCenter,
            y: yPos,
            maxWidth: eventLineMaxWidth,
            font: fontName,
            style: "bold",
            initialSize: 10.5,
            minSize: 8,
            maxLines: 1,
            lineGap: 4,
          });

          const raceDistance =
            race.distanceOverride ??
            race.distance ??
            allOrigRaces.find((r) => r?.distanceOverride != null)
              ?.distanceOverride ??
            competition?.defaultDistance ??
            competition?.distance ??
            null;
          fullEventNameAr =
            fullEventNameAr ||
            formatEventTitleWithBoatClass(category, boatClass, "ar");

          yPos = eventTitleLayout.yEnd;

          if (fullEventNameAr && arabicFontName) {
            yPos += 5;
            const arabicSize = fitSingleLineFontSize({
              doc,
              text: fullEventNameAr,
              maxWidth: 110,
              initialSize: 12,
              minSize: 8.5,
              font: arabicFontName,
              style: "normal",
            });
            doc.setFontSize(arabicSize);
            doc.setFont(arabicFontName, "normal");
            doc.text(fullEventNameAr, center, yPos, { align: "center" });
            doc.setFont(fontName, "normal");
            doc.setFontSize(9);
            if (raceDistance) {
              doc.text(`Distance: ${raceDistance}m`, rightMargin, yPos, {
                align: "right",
              });
            }
          } else if (raceDistance) {
            yPos += 4;
            doc.setFontSize(9);
            doc.text(`Distance: ${raceDistance}m`, center, yPos, {
              align: "center",
            });
          }

          yPos += 6;
          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          const startTime = race.startTime
            ? new Date(race.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "00:00";
          doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
          doc.setFontSize(10);
          doc.setFont(fontName, "bold");
          doc.text(phaseStr, center, yPos, { align: "center" });
          doc.setFontSize(9);
          doc.text(`Race ${raceIndex + 1}`, rightMargin, yPos, {
            align: "right",
          });
          yPos += 2;

          const uniqueClubs = Array.from(
            new Set(
              (race.lanes || [])
                .map((l) => toDocumentId(l.club))
                .filter(Boolean),
            ),
          )
            .map(
              (id) =>
                (race.lanes || []).find((l) => toDocumentId(l.club) === id)
                  ?.club,
            )
            .filter(Boolean)
            .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

          const legendLineHeight = 4;
          const legendBoxHeight =
            uniqueClubs.length > 0
              ? uniqueClubs.length * legendLineHeight + 7
              : 0;
          const bottomMargin = 35 + legendBoxHeight + 20;

          pageClubsMap.set(raceIndex + 1, uniqueClubs);

          const formatNameForPdf = (a) => {
            if (!a) return "Unknown";
            const first = a.firstName || "";
            const last = (a.lastName || "").toUpperCase();
            return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
          };

          const { tableBody } = buildStartListTableBody({
            lanes: race.lanes || [],
            referenceRace: race,
            originalRaceLookup: origRaceLookup,
            athleteLookup: raceAthleteLookup,
            categories,
            boatClasses,
            toDocumentId,
            generateRaceCode,
            formatName: formatNameForPdf,
          });

          const juryTableBody = tableBody.map((row) => [
            row[0] || "",
            row[1] || "",
            row[2] || "",
            "",
            "",
            "",
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Lane", "Club", "Name", "Time", "Observation", "Rank"]],
            body: juryTableBody,
            theme: "plain",
            headStyles: {
              fillColor: [255, 255, 255],
              textColor: [0, 0, 0],
              fontStyle: "bold",
              lineWidth: 0.1,
              lineColor: [0, 0, 0],
              cellPadding: 1,
            },
            styles: {
              fontSize: 8.5,
              cellPadding: 1,
              minCellHeight: 9.5,
              font: fontName,
            },
            columnStyles: {
              0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
              1: { cellWidth: 24, fontStyle: "bold" },
              2: { cellWidth: 64, fontStyle: "bold" },
              3: { cellWidth: 34, halign: "center" },
              4: { cellWidth: 30 },
              5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
            },
            margin: {
              left: leftMargin,
              right: 14,
              bottom: bottomMargin,
              top: headerHeight,
            },
            didParseCell: (data) => {
              if (data.section === "head") {
                data.cell.styles.lineWidth = {
                  top: 0.1,
                  bottom: 0.1,
                  left: 0.1,
                  right: 0.1,
                };
              } else if (data.section === "body") {
                data.cell.styles.lineWidth = {
                  top: 0,
                  bottom: 0.1,
                  left: 0,
                  right: 0,
                };
                data.cell.styles.lineColor = [0, 0, 0];
              }
            },
          });
        }

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);

          if (headerData) {
            const imgProps = doc.getImageProperties(headerData);
            const h = pageWidth / (imgProps.width / imgProps.height);
            doc.addImage(
              headerData,
              getImageFormat(headerData),
              0,
              3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(leftMargin, h + 5, rightMargin, h + 5);
          }

          let legendTopY = null;
          let legendBottomY = null;
          const pageClubs = pageClubsMap.get(i) || [];
          if (pageClubs.length > 0) {
            const clubs = [...pageClubs].sort((a, b) =>
              (a.code || "").localeCompare(b.code || ""),
            );

            const lineHeight = 4;
            const boxHeight = clubs.length * lineHeight + 7;
            const legendY = pageHeight - 35 - boxHeight;
            legendTopY = legendY;
            legendBottomY = legendY + boxHeight;

            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, legendY, 182, boxHeight);

            doc.setFontSize(9);
            doc.setFont(fontName, "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("Legend:", leftMargin + 2, legendY + 5);

            doc.setFontSize(8);
            let clubY = legendY + 9;

            for (const club of clubs) {
              const code = club.code || "---";
              const frenchName =
                club.name || club.names?.fr || club.names?.en || "";
              const arabicName = club.nameAr || club.names?.ar || "";

              doc.setFont(fontName, "bold");
              doc.text(code + ": ", leftMargin + 4, clubY);

              const codeWidth = doc.getTextWidth(code + ": ");
              doc.setFont(fontName, "normal");
              doc.text(frenchName, leftMargin + 4 + codeWidth, clubY);

              if (arabicName && arabicFontName) {
                const frenchWidth = doc.getTextWidth(frenchName);
                doc.setFont(arabicFontName, "normal");
                doc.text(
                  " : " + arabicName,
                  leftMargin + 4 + codeWidth + frenchWidth,
                  clubY,
                );
                doc.setFont(fontName, "normal");
              }
              clubY += lineHeight;
            }
          }

          const drawSignatureSpace = (defaultBaselineY) => {
            let baselineY = defaultBaselineY;
            const signatureLegendGap = 8;
            if (
              Number.isFinite(legendTopY) &&
              Number.isFinite(legendBottomY) &&
              legendBottomY + signatureLegendGap > baselineY
            ) {
              baselineY = Math.max(legendTopY - signatureLegendGap, 20);
            }

            const signatureLabelX = rightMargin - 58;
            const signatureLineStartX = rightMargin - 30;
            const signatureLineEndX = rightMargin - 6;
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont(fontName, "normal");
            doc.text("Signature:", signatureLabelX, baselineY);
            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.line(
              signatureLineStartX,
              baselineY,
              signatureLineEndX,
              baselineY,
            );
          };

          if (footerData) {
            const imgProps = doc.getImageProperties(footerData);
            const h = pageWidth / (imgProps.width / imgProps.height);

            drawSignatureSpace(pageHeight - h - 12);

            doc.addImage(
              footerData,
              getImageFormat(footerData),
              0,
              pageHeight - h - 3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(
              leftMargin,
              pageHeight - h - 5,
              rightMargin,
              pageHeight - h - 5,
            );
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100);
            doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              { align: "right" },
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

            drawSignatureSpace(pageHeight - h - 12);

            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(
              leftMargin,
              pageHeight - h - 5,
              rightMargin,
              pageHeight - h - 5,
            );
            doc.addImage(
              sponsorData,
              getImageFormat(sponsorData),
              x,
              pageHeight - h - 3,
              w,
              h,
            );
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              {
                align: "right",
              },
            );
          } else {
            drawSignatureSpace(pageHeight - 12);

            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(leftMargin, pageHeight - 15, rightMargin, pageHeight - 15);
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100, 100, 100);
            doc.text(asOfLabel, leftMargin, pageHeight - 8);
            doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
              align: "right",
            });
          }
        }

        doc.save(buildJuryStartListPdfFileName(competition, targetRaces));
        toast.success("Jury Start List PDF exported successfully");
      } catch (err) {
        console.error("exportJuryStartListPDF error:", err);
        toast.error(
          "Failed to export Jury Start List PDF: " +
            (err.message || "Unknown error"),
        );
      }
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

      toast.info("Generating Results PDF...");
      await new Promise((resolve) => setTimeout(resolve, 0));

      try {
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const asOfLabel = formatAsOfLabel();

        const [
          headerData,
          footerData,
          logoData,
          sponsorData,
          arabicFontBase64,
        ] = await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/logo.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });

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

        let headerHeight = 32;
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          headerHeight = pageWidth / (imgProps.width / imgProps.height) + 3 + 8;
        }

        let yPos = headerHeight;

        const categoryId = toDocumentId(race.category);
        const category = categoryId
          ? categories.find((item) => toDocumentId(item) === categoryId)
          : null;
        const boatClassId = toDocumentId(race.boatClass);
        const boatClass = boatClassId
          ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
          : null;

        // Event location information

        // Location (safe string extraction)
        const compLocation = String(
          competition?.location?.name ||
            competition?.venue?.name ||
            (typeof competition?.venue === "string"
              ? competition.venue
              : null) ||
            (typeof competition?.location === "string"
              ? competition.location
              : null) ||
            "Location",
        );

        // --- AGGREGATE ORIGINAL RACE INFO ---
        const distinctOrigIds = Array.from(
          new Set(
            (race.lanes || [])
              .map((l) => l.sourceRaceId || l._originalRaceId)
              .filter(Boolean),
          ),
        );
        const allOrigRaces = distinctOrigIds.length
          ? distinctOrigIds
              .map((id) =>
                (typeof rawTargetRaces !== "undefined"
                  ? rawTargetRaces
                  : rawRacesWithResults
                ).find((r) => toDocumentId(r) === toDocumentId(id)),
              )
              .filter(Boolean)
          : [race];

        const distinctEnTitles = new Set();
        const distinctArTitles = new Set();
        const distinctCodes = new Set();
        const distinctOrders = new Set();

        allOrigRaces.forEach((r) => {
          const c = categories.find(
            (x) => toDocumentId(x) === toDocumentId(r.category),
          );
          const b = boatClasses.find(
            (x) => toDocumentId(x) === toDocumentId(r.boatClass),
          );
          const evtEn = formatEventTitleWithBoatClass(c, b, "en");
          const evtAr = formatEventTitleWithBoatClass(c, b, "ar");
          if (evtEn) distinctEnTitles.add(evtEn);
          if (evtAr) distinctArTitles.add(evtAr);
          if (c || b) {
            distinctCodes.add(
              formatRaceCodeForHeader(generateRaceCode(c, b), c),
            );
          }
          if (r.order) distinctOrders.add(r.order);
        });

        let fullEventName = Array.from(distinctEnTitles).join(" / ");
        let fullEventNameAr = Array.from(distinctArTitles).join(" / ");
        let rightHeaderCode = Array.from(distinctCodes).join(" / ");
        let orderStr =
          Array.from(distinctOrders)
            .sort((a, b) => a - b)
            .join(" / ") ||
          race.order ||
          "1";

        // Compute Phase: Journey by journeyIndex, Final only when configured max journey is reached.
        const showJourney = shouldShowJourney(competition, allOrigRaces);
        const explicitNonFinalPhases = Array.from(
          new Set(
            allOrigRaces
              .map((r) => String(r?.phase || "").trim())
              .filter((p) => p && !/^final$/i.test(p))
              .filter((p) => showJourney || !isJourneyPhaseLabel(p)),
          ),
        );
        const journeyValues = Array.from(
          new Set(
            allOrigRaces
              .map((r) => Number(r?.journeyIndex))
              .filter((j) => Number.isFinite(j) && j > 0),
          ),
        ).sort((a, b) => a - b);
        const configuredMaxJourney =
          Number(
            competition?.maximumJourney ??
              competition?.maxJourney ??
              competition?.journeysCount,
          ) || null;

        let phaseStr = "Final";
        if (explicitNonFinalPhases.length > 0) {
          phaseStr = explicitNonFinalPhases.join(" / ");
        } else if (showJourney && journeyValues.length > 0) {
          const reachedConfiguredFinal =
            configuredMaxJourney != null &&
            journeyValues.every((j) => j >= configuredMaxJourney);
          phaseStr = reachedConfiguredFinal
            ? "Final"
            : `Journey ${journeyValues.join(" / ")}`;
        }

        // Use our mapped variables in the template rendering below

        // --- Header Section (matches RaceDetail) ---
        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        const competitionTitle =
          competition?.names?.en ||
          competition?.name ||
          competition?.code ||
          "Competition";
        doc.text(competitionTitle, center, yPos, { align: "center" });

        const raceDate = race.startTime || competition?.startDate || new Date();
        const eventDateStr = new Date(raceDate).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, yPos);
        doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

        yPos += 2;
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPos, rightMargin, yPos);
        yPos += 5;

        // --- Line 1: Race order | Results | Race code ---
        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text(String(orderStr), leftMargin, yPos);
        doc.text("Results", center, yPos, { align: "center" });
        doc.text(
          rightHeaderCode ||
            formatRaceCodeForHeader(
              generateRaceCode(category, boatClass),
              category,
            ),
          rightMargin,
          yPos,
          {
            align: "right",
          },
        );

        // --- Line 2: (Event) | Category + Boat Class ---
        yPos += 5;
        const eventLabel = "(Event)";
        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text(eventLabel, leftMargin, yPos);
        const eventLabelWidth = doc.getTextWidth(eventLabel);
        const eventStartX = leftMargin + eventLabelWidth + 3;
        const eventLineMaxWidth = rightMargin - eventStartX;
        const eventLineCenter = eventStartX + eventLineMaxWidth / 2;
        fullEventName =
          fullEventName ||
          formatEventTitleWithBoatClass(category, boatClass, "en");
        const eventTitleLayout = drawAdaptiveCenteredTitle({
          doc,
          text: fullEventName,
          center: eventLineCenter,
          y: yPos,
          maxWidth: eventLineMaxWidth,
          font: fontName,
          style: "bold",
          initialSize: 10.5,
          minSize: 8,
          maxLines: 1,
          lineGap: 4,
        });

        // --- Line 3: Arabic text (center) | Distance (right) ---
        const raceDistance =
          race.distanceOverride ??
          race.distance ??
          allOrigRaces.find((r) => r?.distanceOverride != null)
            ?.distanceOverride ??
          competition?.defaultDistance ??
          competition?.distance ??
          null;
        fullEventNameAr =
          fullEventNameAr ||
          formatEventTitleWithBoatClass(category, boatClass, "ar");

        yPos = eventTitleLayout.yEnd;

        if (fullEventNameAr && arabicFontName) {
          yPos += 5;
          const arabicSize = fitSingleLineFontSize({
            doc,
            text: fullEventNameAr,
            maxWidth: 110,
            initialSize: 12,
            minSize: 8.5,
            font: arabicFontName,
            style: "normal",
          });
          doc.setFontSize(arabicSize);
          doc.setFont(arabicFontName, "normal");
          doc.text(fullEventNameAr, center, yPos, { align: "center" });
          doc.setFont(fontName, "normal");
          doc.setFontSize(9);
          if (raceDistance) {
            doc.text(`Distance: ${raceDistance}m`, rightMargin, yPos, {
              align: "right",
            });
          }
        } else if (raceDistance) {
          yPos += 4;
          doc.setFontSize(9);
          doc.text(`Distance: ${raceDistance}m`, center, yPos, {
            align: "center",
          });
        }

        // --- Line 4: Start Time | Journey/Phase | Race # ---
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        const startTime = race.startTime
          ? new Date(race.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00";
        doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
        doc.setFontSize(10);
        doc.setFont(fontName, "bold");
        doc.text(phaseStr, center, yPos, { align: "center" });
        doc.setFontSize(9);
        doc.text(`Race ${race.order || "1"}`, rightMargin, yPos, {
          align: "right",
        });
        yPos += 2;

        const exportableLanes = (race?.lanes || []).filter(isAssignedLane);

        // --- Calculate legend for bottom margin ---
        const uniqueClubs = Array.from(
          new Set(
            exportableLanes.map((l) => toDocumentId(l.club)).filter(Boolean),
          ),
        )
          .map(
            (id) =>
              exportableLanes.find((l) => toDocumentId(l.club) === id)?.club,
          )
          .filter(Boolean)
          .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        const legendLineHeight = 4;
        const legendBoxHeight =
          uniqueClubs.length > 0
            ? uniqueClubs.length * legendLineHeight + 7
            : 0;
        const bottomMargin = 35 + legendBoxHeight + 14;

        // --- Helper: format name with uppercase last name ---
        const formatNameForPdf = (a) => {
          if (!a) return "Unknown";
          const first = a.firstName || "";
          const last = (a.lastName || "").toUpperCase();
          return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
        };

        // Sort lanes by result (matching RaceDetail)
        const sortedLanes = [...exportableLanes].sort((a, b) => {
          const statusA = a.result?.status || "ok";
          const statusB = b.result?.status || "ok";
          const priority = { ok: 0, dnf: 1, dns: 2, abs: 3, dsq: 4 };
          const pA = priority[statusA] ?? 10;
          const pB = priority[statusB] ?? 10;
          if (pA !== pB) return pA - pB;
          const posA = a.result?.finishPosition || 999;
          const posB = b.result?.finishPosition || 999;
          if (posA !== posB) return posA - posB;
          return (a.lane || 0) - (b.lane || 0);
        });

        const winningTime = sortedLanes.find(
          (l) => (l.result?.status || "ok") === "ok" && l.result?.elapsedMs,
        )?.result?.elapsedMs;

        const explicitFinisherPositions = sortedLanes
          .filter((l) => (l.result?.status || "ok") === "ok")
          .map((l) => l.result?.finishPosition)
          .filter((p) => Number.isInteger(p) && p > 0);
        const lastFinisherPosition = explicitFinisherPositions.length
          ? Math.max(...explicitFinisherPositions)
          : sortedLanes.filter(
              (l) =>
                (l.result?.status || "ok") === "ok" &&
                Number.isFinite(l.result?.elapsedMs),
            ).length;

        // Build table data (matching RaceDetail)
        const deltaMap = new Map();

        // Detect if this is a combined race
        const originalRaceIds = new Set(
          sortedLanes
            .map((l) => l.sourceRaceId || l._originalRaceId)
            .filter(Boolean),
        );
        const isCombinedRace = originalRaceIds.size > 1;

        const tableBody = sortedLanes.map((lane, rowIdx) => {
          const clubCode =
            lane.club?.code ||
            lane.club?.name?.slice(0, 3).toUpperCase() ||
            "-";
          const isCrewLane = Array.isArray(lane.crew) && lane.crew.length > 1;
          const clubDisplay =
            isCrewLane && lane.crewNumber != null
              ? `${clubCode} ${lane.crewNumber}`
              : clubCode;

          let athleteName = "Unassigned";
          const athleteId = toDocumentId(lane.athlete);
          const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

          const status = lane.result?.status || "ok";
          const effectivePos =
            status === "dnf"
              ? lane.result?.finishPosition || lastFinisherPosition + 1
              : lane.result?.finishPosition;
          const pos = effectivePos || "-";
          let timeStr =
            status !== "ok"
              ? status.toUpperCase()
              : formatElapsedTime(lane.result?.elapsedMs);
          // Store time delta for 2nd place and below (rendered separately)
          if (
            status === "ok" &&
            lane.result?.elapsedMs &&
            pos > 1 &&
            winningTime
          ) {
            const deltaMs = lane.result.elapsedMs - winningTime;
            const deltaStr = formatDeltaSeconds(deltaMs);
            if (deltaStr) deltaMap.set(rowIdx, `+${deltaStr}`);
          }
          let points = 0;
          if ((status === "ok" || status === "dnf") && pos > 0 && pos <= 8) {
            points = calculatePoints(pos, activeRankingSystem);
          }

          if (athlete) {
            athleteName = formatNameForPdf(athlete);
          } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
            athleteName = lane.crew
              .map((m, i, arr) => {
                const mId = toDocumentId(m);
                const member = mId ? raceAthleteLookup.get(mId) : null;
                const name = formatNameForPdf(member);
                let position = "";
                if (arr.length > 1) {
                  if (i === 0) position = "(b) ";
                  else if (i === arr.length - 1) position = "(s) ";
                  else position = `(${i + 1}) `;
                }
                return `${position}${name}`;
              })
              .join("\n");
          }

          const sourceRaceOrder =
            Number(lane.sourceRaceOrder) ||
            Number(lane.originalRaceOrder) ||
            Number(lane._originalRaceOrder) ||
            null;

          const laneDisplay =
            isCombinedRace && sourceRaceOrder
              ? `${lane.lane} (R${sourceRaceOrder})`
              : lane.lane;

          return [pos, laneDisplay, clubDisplay, athleteName, timeStr, points];
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
            cellPadding: 1,
          },
          styles: {
            fontSize: 8,
            cellPadding: 0.8,
            minCellHeight: 6.5,
            font: fontName,
          },
          columnStyles: {
            0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 12 },
            2: { cellWidth: 25, fontStyle: "bold" },
            3: { cellWidth: 88, fontStyle: "bold" },
            4: {
              cellWidth: 22,
              halign: "right",
              fontStyle: "bold",
              fontSize: 9,
            },
            5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          },
          margin: {
            left: leftMargin,
            right: 14,
            bottom: bottomMargin,
            top: headerHeight,
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
          didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const delta = deltaMap.get(data.row.index);
              if (delta) {
                doc.setFontSize(7);
                doc.setFont(fontName, "normal");
                doc.setTextColor(80, 80, 80);
                const pad =
                  typeof data.cell.styles.cellPadding === "number"
                    ? data.cell.styles.cellPadding
                    : data.cell.styles.cellPadding?.right || 0;
                const x = data.cell.x + data.cell.width - pad;
                const y = data.cell.y + data.cell.height - 0.3;
                doc.text(delta, x, y, { align: "right" });
                doc.setFontSize(8);
                doc.setFont(fontName, "normal");
                doc.setTextColor(0, 0, 0);
              }
            }
          },
        });

        yPos = doc.lastAutoTable.finalY + 4;

        // --- Status Box (ensure no overlap with legend) ---
        const progressionEnd = yPos + 7;
        const legendTop =
          uniqueClubs.length > 0
            ? pageHeight - 35 - (uniqueClubs.length * legendLineHeight + 7)
            : pageHeight - 35;
        if (progressionEnd < legendTop) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(leftMargin, yPos, 182, 7);
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.text(
            "Official Results - Times are final.",
            leftMargin + 2,
            yPos + 5,
          );
        }

        // --- Post-Processing: Add Header, Legend & Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);

          // Header Image
          if (headerData) {
            const imgProps = doc.getImageProperties(headerData);
            const h = pageWidth / (imgProps.width / imgProps.height);
            doc.addImage(
              headerData,
              getImageFormat(headerData),
              0,
              3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(leftMargin, h + 5, rightMargin, h + 5);
          }

          // Legend on last page
          if (i === pageCount && uniqueClubs.length > 0) {
            const lineHeight = 4;
            const boxHeight = uniqueClubs.length * lineHeight + 7;
            const legendY = pageHeight - 35 - boxHeight;

            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, legendY, 182, boxHeight);

            doc.setFontSize(9);
            doc.setFont(fontName, "bold");
            doc.setTextColor(0, 0, 0);
            doc.text("Legend:", leftMargin + 2, legendY + 5);

            doc.setFontSize(8);
            let clubY = legendY + 9;
            for (const club of uniqueClubs) {
              const code = club.code || "---";
              const frenchName =
                club.name || club.names?.fr || club.names?.en || "";
              const arabicName = club.nameAr || club.names?.ar || "";

              doc.setFont(fontName, "bold");
              doc.text(code + ": ", leftMargin + 4, clubY);

              const codeWidth = doc.getTextWidth(code + ": ");
              doc.setFont(fontName, "normal");
              doc.text(frenchName, leftMargin + 4 + codeWidth, clubY);

              if (arabicName && arabicFontName) {
                const frenchWidth = doc.getTextWidth(frenchName);
                doc.setFont(arabicFontName, "normal");
                doc.text(
                  " : " + arabicName,
                  leftMargin + 4 + codeWidth + frenchWidth,
                  clubY,
                );
                doc.setFont(fontName, "normal");
              }
              clubY += lineHeight;
            }
          }

          // Footer Image
          if (footerData) {
            const imgProps = doc.getImageProperties(footerData);
            const h = pageWidth / (imgProps.width / imgProps.height);
            doc.addImage(
              footerData,
              getImageFormat(footerData),
              0,
              pageHeight - h - 3,
              pageWidth,
              h,
            );
            doc.setDrawColor(128, 0, 0);
            doc.setLineWidth(0.8);
            doc.line(
              leftMargin,
              pageHeight - h - 5,
              rightMargin,
              pageHeight - h - 5,
            );
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100);
            doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              { align: "right" },
            );
          }
        }

        doc.save(buildResultsPdfFileName(competition, [race]));
        toast.success("Results PDF exported successfully");
      } catch (err) {
        console.error("exportResultsPDF error:", err);
        toast.error(
          "Failed to export Results PDF: " + (err.message || "Unknown error"),
        );
      }
    },
    [
      competition,
      categories,
      boatClasses,
      raceAthleteLookup,
      raceClubLookup,
      eventNumberMap,
      activeRankingSystem,
    ],
  );

  // Export all results to a single PDF
  const exportAllResultsPDF = useCallback(async () => {
    toast.info("Generating Results PDF...");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Filter races that have results (completed or have times)
    const rawRacesWithResults = sortedRaces.filter((race) => {
      const hasResults = (race.lanes || [])
        .filter(isAssignedLane)
        .some(
          (lane) =>
            lane.result?.finishPosition ||
            lane.result?.elapsedMs ||
            lane.result?.status === "ok",
        );
      return race.status === "completed" || hasResults;
    });

    // --- GROUP BY CATEGORY + BOAT CLASS (EVENT) ---
    const resultsEventMap = new Map();
    rawRacesWithResults.forEach((race) => {
      const raceId = toDocumentId(race);
      const categoryId = toDocumentId(race.category) || "unknown";
      const boatClassId = toDocumentId(race.boatClass) || "open";
      const eventKey = `${categoryId}::${boatClassId}`;

      if (!resultsEventMap.has(eventKey)) {
        resultsEventMap.set(eventKey, {
          _id: `event-${eventKey}`,
          ...race,
          _eventKey: eventKey,
          lanes: (race.lanes || []).filter(isAssignedLane).map((l) => ({
            ...l,
            _originalRaceId: raceId,
            sourceRaceId: raceId,
            sourceRaceOrder: race.order,
          })),
        });
      } else {
        const existing = resultsEventMap.get(eventKey);
        existing.lanes.push(
          ...(race.lanes || []).filter(isAssignedLane).map((l) => ({
            ...l,
            _originalRaceId: raceId,
            sourceRaceId: raceId,
            sourceRaceOrder: race.order,
          })),
        );

        // Keep the earliest race order/time as representative for the group.
        if (race.order && (!existing.order || race.order < existing.order)) {
          existing.order = race.order;
        }
        if (
          race.startTime &&
          (!existing.startTime ||
            new Date(race.startTime).getTime() <
              new Date(existing.startTime).getTime())
        ) {
          existing.startTime = race.startTime;
        }
        if (
          race.distanceOverride != null &&
          (existing.distanceOverride == null ||
            Number(race.distanceOverride) > Number(existing.distanceOverride))
        ) {
          existing.distanceOverride = race.distanceOverride;
        }
      }
    });

    const racesWithResults = Array.from(resultsEventMap.values()).sort(
      (a, b) => {
        const aOrder = Number(a.order);
        const bOrder = Number(b.order);
        const hasAOrder = Number.isFinite(aOrder) && aOrder > 0;
        const hasBOrder = Number.isFinite(bOrder) && bOrder > 0;

        if (hasAOrder && hasBOrder && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (hasAOrder !== hasBOrder) {
          return hasAOrder ? -1 : 1;
        }

        const aCat = categories.find(
          (item) => toDocumentId(item) === toDocumentId(a.category),
        );
        const bCat = categories.find(
          (item) => toDocumentId(item) === toDocumentId(b.category),
        );
        const aBc = boatClasses.find(
          (item) => toDocumentId(item) === toDocumentId(a.boatClass),
        );
        const bBc = boatClasses.find(
          (item) => toDocumentId(item) === toDocumentId(b.boatClass),
        );

        const aCode = generateRaceCode(aCat, aBc);
        const bCode = generateRaceCode(bCat, bBc);
        return aCode.localeCompare(bCode);
      },
    );

    if (racesWithResults.length === 0) {
      toast.info("No races with results to export");
      return;
    }

    try {
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const asOfLabel = formatAsOfLabel();

      // Use event date instead of generation date
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      // Load assets in parallel
      const [headerData, footerData, logoData, sponsorData, arabicFontBase64] =
        await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/logo.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

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

      // Header height (reduced spacing)
      let headerHeight = 32;
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        headerHeight = pageWidth / (imgProps.width / imgProps.height) + 3 + 8;
      }

      // Location (safe string extraction)
      const compLocation = String(
        competition?.location?.name ||
          competition?.venue?.name ||
          (typeof competition?.venue === "string" ? competition.venue : null) ||
          (typeof competition?.location === "string"
            ? competition.location
            : null) ||
          "Location",
      );
      const competitionTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";

      // Helper: format name with uppercase last name
      const formatNameForPdf = (a) => {
        if (!a) return "Unknown";
        const first = a.firstName || "";
        const last = (a.lastName || "").toUpperCase();
        return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
      };

      let isFirstRace = true;

      // Track which pages belong to which race (for per-race legends)
      const racePageRanges = [];

      for (const race of racesWithResults) {
        if (!isFirstRace) {
          doc.addPage();
        }
        isFirstRace = false;

        const raceStartPage = doc.internal.getNumberOfPages();

        let yPos = headerHeight;

        const categoryId = toDocumentId(race.category);
        const category = categoryId
          ? categories.find((item) => toDocumentId(item) === categoryId)
          : null;
        const boatClassId = toDocumentId(race.boatClass);
        const boatClass = boatClassId
          ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
          : null;

        // --- AGGREGATE ORIGINAL RACE INFO ---
        const distinctOrigIds = Array.from(
          new Set(
            (race.lanes || [])
              .map((l) => l.sourceRaceId || l._originalRaceId)
              .filter(Boolean),
          ),
        );
        const allOrigRaces = distinctOrigIds.length
          ? distinctOrigIds
              .map((id) =>
                (typeof rawTargetRaces !== "undefined"
                  ? rawTargetRaces
                  : rawRacesWithResults
                ).find((r) => toDocumentId(r) === toDocumentId(id)),
              )
              .filter(Boolean)
          : [race];

        const distinctEnTitles = new Set();
        const distinctArTitles = new Set();
        const distinctCodes = new Set();
        const distinctOrders = new Set();

        allOrigRaces.forEach((r) => {
          const c = categories.find(
            (x) => toDocumentId(x) === toDocumentId(r.category),
          );
          const b = boatClasses.find(
            (x) => toDocumentId(x) === toDocumentId(r.boatClass),
          );
          const evtEn = formatEventTitleWithBoatClass(c, b, "en");
          const evtAr = formatEventTitleWithBoatClass(c, b, "ar");
          if (evtEn) distinctEnTitles.add(evtEn);
          if (evtAr) distinctArTitles.add(evtAr);
          if (c || b) {
            distinctCodes.add(
              formatRaceCodeForHeader(generateRaceCode(c, b), c),
            );
          }
          if (r.order) distinctOrders.add(r.order);
        });

        let fullEventName = Array.from(distinctEnTitles).join(" / ");
        let fullEventNameAr = Array.from(distinctArTitles).join(" / ");
        let rightHeaderCode = Array.from(distinctCodes).join(" / ");
        let orderStr =
          Array.from(distinctOrders)
            .sort((a, b) => a - b)
            .join(" / ") ||
          race.order ||
          "1";

        // Compute Phase: Journey by journeyIndex, Final only when configured max journey is reached.
        const showJourney = shouldShowJourney(competition, allOrigRaces);
        const explicitNonFinalPhases = Array.from(
          new Set(
            allOrigRaces
              .map((r) => String(r?.phase || "").trim())
              .filter((p) => p && !/^final$/i.test(p))
              .filter((p) => showJourney || !isJourneyPhaseLabel(p)),
          ),
        );
        const journeyValues = Array.from(
          new Set(
            allOrigRaces
              .map((r) => Number(r?.journeyIndex))
              .filter((j) => Number.isFinite(j) && j > 0),
          ),
        ).sort((a, b) => a - b);
        const configuredMaxJourney =
          Number(
            competition?.maximumJourney ??
              competition?.maxJourney ??
              competition?.journeysCount,
          ) || null;

        let phaseStr = "Final";
        if (explicitNonFinalPhases.length > 0) {
          phaseStr = explicitNonFinalPhases.join(" / ");
        } else if (showJourney && journeyValues.length > 0) {
          const reachedConfiguredFinal =
            configuredMaxJourney != null &&
            journeyValues.every((j) => j >= configuredMaxJourney);
          phaseStr = reachedConfiguredFinal
            ? "Final"
            : `Journey ${journeyValues.join(" / ")}`;
        }

        // Use our mapped variables in the template rendering below

        // --- Header Section (matches RaceDetail) ---
        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competitionTitle, center, yPos, { align: "center" });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, yPos);
        doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

        yPos += 2;
        doc.setLineWidth(0.5);
        doc.line(leftMargin, yPos, rightMargin, yPos);
        yPos += 5;

        // --- Line 1: Race order | Results | Race code ---
        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text(String(orderStr), leftMargin, yPos);
        doc.text("Results", center, yPos, { align: "center" });
        doc.text(
          rightHeaderCode ||
            formatRaceCodeForHeader(
              generateRaceCode(category, boatClass),
              category,
            ),
          rightMargin,
          yPos,
          {
            align: "right",
          },
        );

        // --- Line 2: (Event) | Category + Boat Class ---
        yPos += 5;
        const eventLabel = "(Event)";
        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text(eventLabel, leftMargin, yPos);
        const eventLabelWidth = doc.getTextWidth(eventLabel);
        const eventStartX = leftMargin + eventLabelWidth + 3;
        const eventLineMaxWidth = rightMargin - eventStartX;
        const eventLineCenter = eventStartX + eventLineMaxWidth / 2;
        fullEventName =
          fullEventName ||
          formatEventTitleWithBoatClass(category, boatClass, "en");
        const eventTitleLayout = drawAdaptiveCenteredTitle({
          doc,
          text: fullEventName,
          center: eventLineCenter,
          y: yPos,
          maxWidth: eventLineMaxWidth,
          font: fontName,
          style: "bold",
          initialSize: 10.5,
          minSize: 8,
          maxLines: 1,
          lineGap: 4,
        });

        // --- Line 3: Arabic text (center) | Distance (right) ---
        const raceDistance =
          race.distanceOverride ??
          race.distance ??
          allOrigRaces.find((r) => r?.distanceOverride != null)
            ?.distanceOverride ??
          competition?.defaultDistance ??
          competition?.distance ??
          null;
        fullEventNameAr =
          fullEventNameAr ||
          formatEventTitleWithBoatClass(category, boatClass, "ar");

        yPos = eventTitleLayout.yEnd;

        if (fullEventNameAr && arabicFontName) {
          yPos += 5;
          const arabicSize = fitSingleLineFontSize({
            doc,
            text: fullEventNameAr,
            maxWidth: 110,
            initialSize: 12,
            minSize: 8.5,
            font: arabicFontName,
            style: "normal",
          });
          doc.setFontSize(arabicSize);
          doc.setFont(arabicFontName, "normal");
          doc.text(fullEventNameAr, center, yPos, { align: "center" });
          doc.setFont(fontName, "normal");
          doc.setFontSize(9);
          if (raceDistance) {
            doc.text(`Distance: ${raceDistance}m`, rightMargin, yPos, {
              align: "right",
            });
          }
        } else if (raceDistance) {
          yPos += 4;
          doc.setFontSize(9);
          doc.text(`Distance: ${raceDistance}m`, center, yPos, {
            align: "center",
          });
        }

        // --- Line 4: Start Time | Journey/Phase | Race # ---
        yPos += 6;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        const startTime = race.startTime
          ? new Date(race.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00";
        doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
        doc.setFontSize(10);
        doc.setFont(fontName, "bold");
        doc.text(phaseStr, center, yPos, { align: "center" });
        doc.setFontSize(9);
        doc.text(`Race ${race.order || "1"}`, rightMargin, yPos, {
          align: "right",
        });
        yPos += 2;

        const allLanes = (race?.lanes || []).filter(isAssignedLane);

        // --- Calculate legend for bottom margin ---
        const uniqueClubs = Array.from(
          new Set(allLanes.map((l) => toDocumentId(l.club)).filter(Boolean)),
        )
          .map((id) => allLanes.find((l) => toDocumentId(l.club) === id)?.club)
          .filter(Boolean)
          .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        const legendLineHeight = 4;
        const legendBoxHeight =
          uniqueClubs.length > 0
            ? uniqueClubs.length * legendLineHeight + 7
            : 0;
        const bottomMargin = 35 + legendBoxHeight + 14;

        // Recompute consolidated event ranking for merged categories:
        // one global 1st/2nd/3rd across all source races in the event group.
        const rankedOkLanes = allLanes
          .filter((lane) => {
            const status = lane.result?.status || "ok";
            return status === "ok" && Number.isFinite(lane.result?.elapsedMs);
          })
          .sort((a, b) => {
            const timeA = Number(a.result?.elapsedMs);
            const timeB = Number(b.result?.elapsedMs);
            if (timeA !== timeB) {
              return timeA - timeB;
            }
            return (a.lane || 0) - (b.lane || 0);
          });

        const consolidatedPositionByLane = new Map();
        rankedOkLanes.forEach((lane, index) => {
          consolidatedPositionByLane.set(lane, index + 1);
        });

        const statusPriority = { ok: 0, dnf: 1, dns: 2, abs: 3, dsq: 4 };
        const sortedLanes = allLanes.sort((a, b) => {
          const posA = consolidatedPositionByLane.get(a);
          const posB = consolidatedPositionByLane.get(b);
          const hasPosA = Number.isInteger(posA);
          const hasPosB = Number.isInteger(posB);

          if (hasPosA && hasPosB && posA !== posB) {
            return posA - posB;
          }
          if (hasPosA !== hasPosB) {
            return hasPosA ? -1 : 1;
          }

          const statusA = a.result?.status || "ok";
          const statusB = b.result?.status || "ok";
          const priorityA = statusPriority[statusA] ?? 10;
          const priorityB = statusPriority[statusB] ?? 10;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          return (a.lane || 0) - (b.lane || 0);
        });

        const winningTime = rankedOkLanes[0]?.result?.elapsedMs;
        const dnfEffectivePosition = rankedOkLanes.length + 1;

        // Detect if this is a combined race
        const originalRaceIds = new Set(
          sortedLanes
            .map((l) => l.sourceRaceId || l._originalRaceId)
            .filter(Boolean),
        );
        const isCombinedRace = originalRaceIds.size > 1;

        // Build table data (matching RaceDetail)
        const deltaMap = new Map();
        const tableBody = sortedLanes.map((lane, rowIdx) => {
          const clubCode =
            lane.club?.code ||
            lane.club?.name?.slice(0, 3).toUpperCase() ||
            "-";
          const isCrewLane = Array.isArray(lane.crew) && lane.crew.length > 1;
          const clubDisplay =
            isCrewLane && lane.crewNumber != null
              ? `${clubCode} ${lane.crewNumber}`
              : clubCode;

          let athleteName = "Unassigned";
          const athleteId = toDocumentId(lane.athlete);
          const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

          const status = lane.result?.status || "ok";
          const consolidatedPos = consolidatedPositionByLane.get(lane);
          const effectivePos =
            status === "dnf" ? dnfEffectivePosition : consolidatedPos;
          const pos = Number.isInteger(effectivePos) ? effectivePos : "-";
          let timeStr =
            status !== "ok"
              ? status.toUpperCase()
              : formatElapsedTime(lane.result?.elapsedMs);
          // Store time delta for 2nd place and below (rendered separately)
          if (
            status === "ok" &&
            lane.result?.elapsedMs &&
            pos > 1 &&
            winningTime
          ) {
            const deltaMs = lane.result.elapsedMs - winningTime;
            const deltaStr = formatDeltaSeconds(deltaMs);
            if (deltaStr) deltaMap.set(rowIdx, `+${deltaStr}`);
          }
          let points = 0;
          if (
            (status === "ok" || status === "dnf") &&
            Number.isInteger(effectivePos)
          ) {
            points = calculatePoints(effectivePos, activeRankingSystem);
          }

          if (athlete) {
            athleteName = formatNameForPdf(athlete);
          } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
            athleteName = lane.crew
              .map((m, i, arr) => {
                const mId = toDocumentId(m);
                const member = mId ? raceAthleteLookup.get(mId) : null;
                const name = formatNameForPdf(member);
                let position = "";
                if (arr.length > 1) {
                  if (i === 0) position = "(b) ";
                  else if (i === arr.length - 1) position = "(s) ";
                  else position = `(${i + 1}) `;
                }
                return `${position}${name}`;
              })
              .join("\n");
          }

          const sourceRaceOrder =
            Number(lane.sourceRaceOrder) ||
            Number(lane.originalRaceOrder) ||
            Number(lane._originalRaceOrder) ||
            null;

          const laneDisplay =
            isCombinedRace && sourceRaceOrder
              ? `${lane.lane} (R${sourceRaceOrder})`
              : lane.lane;

          return [pos, laneDisplay, clubDisplay, athleteName, timeStr, points];
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
            cellPadding: 1,
          },
          styles: {
            fontSize: 8,
            cellPadding: 0.8,
            minCellHeight: 6.5,
            font: fontName,
          },
          columnStyles: {
            0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 12 },
            2: { cellWidth: 25, fontStyle: "bold" },
            3: { cellWidth: 88, fontStyle: "bold" },
            4: {
              cellWidth: 22,
              halign: "right",
              fontStyle: "bold",
              fontSize: 9,
            },
            5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          },
          margin: {
            left: leftMargin,
            right: 14,
            bottom: bottomMargin,
            top: headerHeight,
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
          didDrawCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const delta = deltaMap.get(data.row.index);
              if (delta) {
                doc.setFontSize(7);
                doc.setFont(fontName, "normal");
                doc.setTextColor(80, 80, 80);
                const pad =
                  typeof data.cell.styles.cellPadding === "number"
                    ? data.cell.styles.cellPadding
                    : data.cell.styles.cellPadding?.right || 0;
                const x = data.cell.x + data.cell.width - pad;
                const y = data.cell.y + data.cell.height - 0.3;
                doc.text(delta, x, y, { align: "right" });
                doc.setFontSize(8);
                doc.setFont(fontName, "normal");
                doc.setTextColor(0, 0, 0);
              }
            }
          },
        });

        yPos = doc.lastAutoTable.finalY + 4;

        // --- Status Box (ensure no overlap with legend) ---
        const progressionEnd = yPos + 7;
        const legendTop =
          uniqueClubs.length > 0
            ? pageHeight - 35 - (uniqueClubs.length * legendLineHeight + 7)
            : pageHeight - 35;
        if (progressionEnd < legendTop) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(leftMargin, yPos, 182, 7);
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.text(
            "Official Results - Times are final.",
            leftMargin + 2,
            yPos + 5,
          );
        }

        const raceEndPage = doc.internal.getNumberOfPages();
        racePageRanges.push({
          startPage: raceStartPage,
          endPage: raceEndPage,
          clubs: uniqueClubs,
        });
      }

      // --- Post-Processing: Add Header, Legend & Footer to all pages ---
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);

        // Header Image
        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            headerData,
            getImageFormat(headerData),
            0,
            3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 5, rightMargin, h + 5);
        }

        // Legend on last page of each race
        const raceRange = racePageRanges.find((r) => r.endPage === i);
        if (raceRange && raceRange.clubs.length > 0) {
          const clubs = raceRange.clubs;
          const lineHeight = 4;
          const boxHeight = clubs.length * lineHeight + 7;
          const legendY = pageHeight - 35 - boxHeight;

          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(leftMargin, legendY, 182, boxHeight);

          doc.setFontSize(9);
          doc.setFont(fontName, "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("Legend:", leftMargin + 2, legendY + 5);

          doc.setFontSize(8);
          let clubY = legendY + 9;
          for (const club of clubs) {
            const code = club.code || "---";
            const frenchName =
              club.name || club.names?.fr || club.names?.en || "";
            const arabicName = club.nameAr || club.names?.ar || "";

            doc.setFont(fontName, "bold");
            doc.text(code + ": ", leftMargin + 4, clubY);

            const codeWidth = doc.getTextWidth(code + ": ");
            doc.setFont(fontName, "normal");
            doc.text(frenchName, leftMargin + 4 + codeWidth, clubY);

            if (arabicName && arabicFontName) {
              const frenchWidth = doc.getTextWidth(frenchName);
              doc.setFont(arabicFontName, "normal");
              doc.text(
                " : " + arabicName,
                leftMargin + 4 + codeWidth + frenchWidth,
                clubY,
              );
              doc.setFont(fontName, "normal");
            }
            clubY += lineHeight;
          }
        }

        // Footer Image
        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            footerData,
            getImageFormat(footerData),
            0,
            pageHeight - h - 3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
            { align: "right" },
          );
        }
      }

      doc.save(buildResultsPdfFileName(competition, racesWithResults));
      toast.success(
        `Exported results for ${racesWithResults.length} event category(ies)`,
      );
    } catch (err) {
      console.error("exportAllResultsPDF error:", err);
      toast.error(
        "Failed to export Results PDF: " + (err.message || "Unknown error"),
      );
    }
  }, [
    sortedRaces,
    competition,
    categories,
    boatClasses,
    raceAthleteLookup,
    raceClubLookup,
    eventNumberMap,
    activeRankingSystem,
  ]);

  const normalizeCountryCode = useCallback((value) => {
    if (value === undefined || value === null) {
      return "UNK";
    }
    const raw = String(value).trim();
    if (!raw) {
      return "UNK";
    }
    const compact = raw.replace(/\s+/g, " ");
    if (compact.length <= 4 && /^[a-zA-Z]+$/.test(compact)) {
      return compact.toUpperCase();
    }
    return compact;
  }, []);

  const resolveLaneCountry = useCallback(
    (lane, athleteObj) => {
      const club = lane?.club;
      const candidates = [
        athleteObj?.countryCode,
        athleteObj?.country?.code,
        athleteObj?.country,
        athleteObj?.nationality,
        lane?.countryCode,
        lane?.country,
        club?.countryCode,
        club?.country?.code,
        club?.country,
        club?.nation,
      ];

      const first = candidates.find(
        (item) => item !== undefined && item !== null && String(item).trim(),
      );
      return normalizeCountryCode(first);
    },
    [normalizeCountryCode],
  );

  const collectAssignedEntriesRows = useCallback(() => {
    const rows = [];

    sortedRaces.forEach((race) => {
      const categoryId = toDocumentId(race.category);
      const boatClassId = toDocumentId(race.boatClass);
      const category = categoryId
        ? categories.find((item) => toDocumentId(item) === categoryId)
        : null;
      const boatClass = boatClassId
        ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
        : null;

      const eventCode = generateRaceCode(category, boatClass) || "-";
      const eventName =
        formatEventTitleWithBoatClass(category, boatClass, "en") ||
        race.name ||
        `Race ${race.order || "-"}`;
      const eventNameAr =
        formatEventTitleWithBoatClass(category, boatClass, "ar") || "";

      (race.lanes || []).filter(isAssignedLane).forEach((lane) => {
        const laneAthlete =
          typeof lane.athlete === "object" && lane.athlete?.firstName
            ? lane.athlete
            : raceAthleteLookup.get(toDocumentId(lane.athlete));

        const crewMembers = Array.isArray(lane.crew)
          ? lane.crew
              .map((member) => {
                if (member && typeof member === "object" && member.firstName) {
                  return member;
                }
                return raceAthleteLookup.get(toDocumentId(member));
              })
              .filter(Boolean)
          : [];

        const athleteName = laneAthlete
          ? formatAthleteName(laneAthlete)
          : crewMembers.length
            ? crewMembers.map((member) => formatAthleteName(member)).join(" / ")
            : "Unassigned";
        const athleteUnitCount = laneAthlete
          ? 1
          : crewMembers.length > 0
            ? crewMembers.length
            : 1;

        const clubCode =
          lane?.club?.code ||
          lane?.club?.name?.slice(0, 4).toUpperCase() ||
          "-";
        const clubName = resolveClubLabel(lane?.club) || clubCode;
        const clubNameFr =
          lane?.club?.names?.fr || lane?.club?.nameFr || lane?.club?.name || "";
        const clubNameAr =
          lane?.club?.names?.ar || lane?.club?.nameAr || lane?.club?.name || "";
        const country = resolveLaneCountry(lane, laneAthlete || crewMembers[0]);

        rows.push({
          eventCode,
          eventName,
          eventNameAr,
          eventNumber: Number(race?.order) || null,
          clubCode,
          clubName,
          clubNameFr,
          clubNameAr,
          athleteName,
          country,
          athleteUnitCount,
        });
      });
    });

    return rows;
  }, [
    sortedRaces,
    categories,
    boatClasses,
    raceAthleteLookup,
    resolveLaneCountry,
  ]);

  const exportEntriesReportPdf = useCallback(
    async ({ title, filePrefix, head, body }) => {
      if (!body.length) {
        toast.info("No entries available to export.");
        return;
      }

      try {
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const left = 14;
        const right = pageWidth - 14;
        const center = pageWidth / 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(
          competition?.names?.en || competition?.code || "Competition",
          center,
          16,
          {
            align: "center",
          },
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(title, center, 23, { align: "center" });
        doc.setFontSize(8);
        doc.setTextColor(90);
        doc.text(formatAsOfLabel(), left, 29);

        autoTable(doc, {
          startY: 33,
          head: [head],
          body,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 1.6,
            lineColor: [220, 226, 233],
            lineWidth: 0.1,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [239, 246, 255],
            textColor: [15, 23, 42],
            fontStyle: "bold",
          },
          margin: { left, right, bottom: 18 },
        });

        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i += 1) {
          doc.setPage(i);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(`Page ${i} of ${pages}`, right, pageHeight - 8, {
            align: "right",
          });
        }

        doc.save(buildEntriesReportPdfFileName(filePrefix, competition));
        toast.success(`${title} exported successfully`);
      } catch (error) {
        console.error("exportEntriesReportPdf error:", error);
        toast.error(`Failed to export ${title}`);
      }
    },
    [competition],
  );

  const exportEntryListByEventPDF = useCallback(async () => {
    toast.info("Generating Entry List by Event PDF...");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rows = collectAssignedEntriesRows().sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) {
        return eventNumberA - eventNumberB;
      }
      const eventCompare = `${a.eventCode} ${a.eventName}`.localeCompare(
        `${b.eventCode} ${b.eventName}`,
      );
      if (eventCompare !== 0) return eventCompare;
      const clubCompare = `${a.clubCode} ${a.clubName}`.localeCompare(
        `${b.clubCode} ${b.clubName}`,
      );
      if (clubCompare !== 0) return clubCompare;
      return a.athleteName.localeCompare(b.athleteName);
    });

    if (!rows.length) {
      toast.info("No entries available to export.");
      return;
    }

    try {
      const asOfLabel = formatAsOfLabel();
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      const [headerData, footerData, sponsorData, arabicFontBase64] =
        await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      let arabicFontName = null;
      if (arabicFontBase64) {
        try {
          doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
          doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
          arabicFontName = "Amiri";
        } catch (error) {
          console.warn("Could not register Arabic font for entry list:", error);
        }
      }

      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 14;
      const rightMargin = 196;
      const center = 105;
      const fontName = "helvetica";

      let headerHeight = 32;
      if (headerData) {
        const headerProps = doc.getImageProperties(headerData);
        headerHeight =
          pageWidth / (headerProps.width / headerProps.height) + 3 + 8;
      }

      const compLocation = String(
        competition?.location?.name ||
          competition?.venue?.name ||
          (typeof competition?.venue === "string" ? competition.venue : null) ||
          (typeof competition?.location === "string"
            ? competition.location
            : null) ||
          "Location",
      );

      const competitionTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";

      const drawReportHeader = () => {
        let y = headerHeight;

        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competitionTitle, center, y, { align: "center" });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, y);
        doc.text(eventDateStr, rightMargin, y, { align: "right" });

        y += 2;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);
        y += 6;

        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text("Entry List by Event", center, y, { align: "center" });
        y += 5;

        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.setTextColor(90);
        doc.text(asOfLabel, leftMargin, y);
        y += 2;

        return y;
      };

      const byEvent = Array.from(
        rows
          .reduce((map, row) => {
            const key = `${row.eventCode}||${row.eventName}`;
            if (!map.has(key)) {
              map.set(key, {
                eventCode: row.eventCode,
                eventName: row.eventName,
                eventNumber:
                  Number.isFinite(Number(row.eventNumber)) &&
                  Number(row.eventNumber) > 0
                    ? Number(row.eventNumber)
                    : null,
                entries: [],
              });
            }
            const group = map.get(key);
            const rowEventNumber = Number(row.eventNumber);
            if (Number.isFinite(rowEventNumber) && rowEventNumber > 0) {
              group.eventNumber =
                group.eventNumber == null
                  ? rowEventNumber
                  : Math.min(group.eventNumber, rowEventNumber);
            }
            group.entries.push(row);
            return map;
          }, new Map())
          .values(),
      ).sort((a, b) => {
        const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
        const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
        if (eventNumberA !== eventNumberB) {
          return eventNumberA - eventNumberB;
        }
        return `${a.eventCode} ${a.eventName}`.localeCompare(
          `${b.eventCode} ${b.eventName}`,
        );
      });

      const drawTextSmart = (text, x, y, options = {}) => {
        const value = String(text || "");
        const hasArabic = /[\u0600-\u06FF]/.test(value);
        if (hasArabic && arabicFontName) {
          doc.setFont(arabicFontName, "normal");
          doc.text(value, x, y, options);
          doc.setFont(fontName, "normal");
          return;
        }
        doc.text(value, x, y, options);
      };

      let yPos = drawReportHeader();

      const drawEventHeader = (group, index, continued = false) => {
        const fallbackNumber = index + 1;
        const eventNo = String(
          Number.isFinite(Number(group?.eventNumber)) &&
            Number(group.eventNumber) > 0
            ? Number(group.eventNumber)
            : fallbackNumber,
        );
        const eventCode = String(group.eventCode || "-");
        const eventName = String(group.eventName || "Event");

        doc.setTextColor(0, 0, 0);
        doc.setFont(fontName, "bold");
        doc.setFontSize(11);
        doc.text(eventNo, leftMargin, yPos + 4);
        doc.text(eventCode, rightMargin, yPos + 4, { align: "right" });

        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.text("(Event)", leftMargin, yPos + 8);

        doc.setFont(fontName, "bold");
        doc.setFontSize(12);
        doc.text(
          continued ? `${eventName} (cont.)` : eventName,
          center,
          yPos + 8,
          { align: "center" },
        );

        doc.setFont(fontName, "bold");
        doc.setFontSize(9);
        doc.text(asOfLabel.replace("As of: ", "As of "), center, yPos + 13, {
          align: "center",
        });

        doc.setLineWidth(0.35);
        doc.setDrawColor(0);
        doc.line(leftMargin, yPos + 15, rightMargin, yPos + 15);
        yPos += 18;
      };

      byEvent.forEach((group, eventIndex) => {
        if (yPos + 26 > pageHeight - 40) {
          doc.addPage();
          yPos = drawReportHeader();
        }

        drawEventHeader(group, eventIndex, false);

        const groupedEntries = Array.from(
          group.entries
            .reduce((map, entry) => {
              const key = isInternationalCompetition
                ? entry.country || "UNK"
                : entry.clubCode || "UNK";
              if (!map.has(key)) {
                map.set(key, { key, athletes: [] });
              }
              const target = map.get(key);
              const rawName = String(entry.athleteName || "-");
              const splitNames = rawName
                .split("/")
                .map((part) => part.trim())
                .filter(Boolean);
              if (splitNames.length > 1) {
                splitNames.forEach((name) => target.athletes.push(name));
              } else {
                target.athletes.push(rawName.trim());
              }
              return map;
            }, new Map())
            .values(),
        ).sort((a, b) => a.key.localeCompare(b.key));

        const cols = isInternationalCompetition ? 5 : 4;
        const gap = 4;
        const colWidth = (rightMargin - leftMargin - gap * (cols - 1)) / cols;
        const lineHeight = 4;

        const blocks = groupedEntries.map((item) => {
          const lines = item.athletes.slice(0, 18);
          const h = 4 + lineHeight + lines.length * 3.6;
          return { ...item, lines, blockHeight: Math.max(h, 12) };
        });

        let cursor = 0;
        while (cursor < blocks.length) {
          const row = blocks.slice(cursor, cursor + cols);
          const maxH = Math.max(...row.map((b) => b.blockHeight));

          if (yPos + maxH > pageHeight - 40) {
            doc.addPage();
            yPos = drawReportHeader();
            drawEventHeader(group, eventIndex, true);
          }

          row.forEach((block, idx) => {
            const x = leftMargin + idx * (colWidth + gap);
            let lineY = yPos + 4;

            doc.setFont(fontName, "bold");
            doc.setFontSize(10);
            doc.text(block.key, x + 1, lineY);

            doc.setFont(fontName, "normal");
            doc.setFontSize(8);
            lineY += lineHeight;

            block.lines.forEach((line) => {
              const wrapped = doc.splitTextToSize(
                String(line || "-"),
                colWidth - 1.5,
              );
              wrapped.forEach((part) => {
                drawTextSmart(part, x + 1, lineY);
                lineY += 3.4;
              });
            });
          });

          yPos += maxH + 2;
          cursor += cols;
        }

        yPos += 4;
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);

        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            headerData,
            getImageFormat(headerData),
            0,
            3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 5, rightMargin, h + 5);
        }

        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            footerData,
            getImageFormat(footerData),
            0,
            pageHeight - h - 3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
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
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.addImage(
            sponsorData,
            getImageFormat(sponsorData),
            x,
            pageHeight - h - 3,
            w,
            h,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
            {
              align: "right",
            },
          );
        }
      }

      doc.save(buildEntriesReportPdfFileName("EntryListByEvent", competition));
      toast.success("Entry List by Event exported successfully");
    } catch (error) {
      console.error("exportEntryListByEventPDF error:", error);
      toast.error("Failed to export Entry List by Event");
    }
  }, [collectAssignedEntriesRows, competition, isInternationalCompetition]);

  const exportEntriesByEventPDF = useCallback(async () => {
    toast.info("Generating Entries by Event PDF...");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rows = collectAssignedEntriesRows();
    if (!rows.length) {
      toast.info("No entries available to export.");
      return;
    }

    try {
      const asOfLabel = formatAsOfLabel();
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      const [headerData, footerData, sponsorData, arabicFontBase64] =
        await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      let arabicFontName = null;
      if (arabicFontBase64) {
        try {
          doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
          doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
          arabicFontName = "Amiri";
        } catch (error) {
          console.warn("Could not register Arabic font for legend:", error);
        }
      }

      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 14;
      const rightMargin = 196;
      const center = 105;
      const fontName = "helvetica";

      let headerHeight = 32;
      if (headerData) {
        const headerProps = doc.getImageProperties(headerData);
        headerHeight =
          pageWidth / (headerProps.width / headerProps.height) + 3 + 8;
      }

      const compLocation = String(
        competition?.location?.name ||
          competition?.venue?.name ||
          (typeof competition?.venue === "string" ? competition.venue : null) ||
          (typeof competition?.location === "string"
            ? competition.location
            : null) ||
          "Location",
      );

      const competitionTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";

      const byEvent = new Map();
      rows.forEach((row) => {
        const key = `${row.eventCode}||${row.eventName}`;
        const rowEventNumber = Number(row.eventNumber);
        const normalizedEventNumber =
          Number.isFinite(rowEventNumber) && rowEventNumber > 0
            ? rowEventNumber
            : null;

        if (!byEvent.has(key)) {
          byEvent.set(key, {
            key,
            eventCode: row.eventCode || "-",
            eventName: row.eventName || "-",
            eventNameAr: row.eventNameAr || "",
            eventNumber: normalizedEventNumber,
            dimensions: new Set(),
          });
        }

        const item = byEvent.get(key);
        if (normalizedEventNumber != null) {
          item.eventNumber =
            item.eventNumber == null
              ? normalizedEventNumber
              : Math.min(item.eventNumber, normalizedEventNumber);
        }

        const dimensionCode = isInternationalCompetition
          ? row.country || "UNK"
          : (row.clubCode || row.clubName || "UNK").trim();
        item.dimensions.add(String(dimensionCode || "UNK").toUpperCase());
      });

      const events = Array.from(byEvent.values())
        .sort((a, b) => {
          const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
          const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
          if (eventNumberA !== eventNumberB) {
            return eventNumberA - eventNumberB;
          }
          return `${a.eventCode} ${a.eventName}`.localeCompare(
            `${b.eventCode} ${b.eventName}`,
          );
        })
        .map((event, index) => {
          const list = Array.from(event.dimensions).sort((a, b) =>
            a.localeCompare(b),
          );
          return {
            ...event,
            displayEventNumber:
              Number.isFinite(Number(event.eventNumber)) &&
              Number(event.eventNumber) > 0
                ? Number(event.eventNumber)
                : index + 1,
            list,
            count: list.length,
          };
        });

      const drawPageFrame = (titleSuffix = "") => {
        let y = headerHeight;

        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competitionTitle, center, y, { align: "center" });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, y);
        doc.text(eventDateStr, rightMargin, y, { align: "right" });

        y += 2;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);
        y += 6;

        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text(`Entries by Event${titleSuffix}`, center, y, {
          align: "center",
        });
        y += 7;

        doc.setFontSize(9);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(asOfLabel.replace(":", "").toUpperCase(), center, y, {
          align: "center",
        });
        y += 3;

        doc.setLineWidth(0.28);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);
        y += 4;

        return y;
      };

      const availableWidth = rightMargin - leftMargin;
      const colGap = 1.0;
      const colsPerChunk = 10;
      const colWidth =
        (availableWidth - colGap * (colsPerChunk - 1)) / colsPerChunk;

      const chunks = [];
      for (let i = 0; i < events.length; i += colsPerChunk) {
        chunks.push(events.slice(i, i + colsPerChunk));
      }
      if (!chunks.length) {
        chunks.push([]);
      }

      let yPos = drawPageFrame();

      chunks.forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) {
          doc.addPage();
          yPos = drawPageFrame(
            chunks.length > 1 ? ` (${chunkIndex + 1}/${chunks.length})` : "",
          );
        }

        const headerRowH = 5.6;
        const codesY = yPos;
        const numbersY = codesY + headerRowH;
        const countsY = numbersY + headerRowH;
        const listsY = countsY + headerRowH + 2;
        const listLineH = 3.7;

        const footerReserved = 37;
        const maxListHeight = pageHeight - footerReserved - listsY;
        const maxLinesPerSegment = Math.max(
          1,
          Math.floor((maxListHeight - 2) / listLineH),
        );

        const maxListLen = chunk.reduce(
          (max, item) => Math.max(max, item?.list?.length || 0),
          0,
        );

        let lineOffset = 0;
        while (lineOffset < Math.max(1, maxListLen)) {
          if (lineOffset > 0) {
            doc.addPage();
            yPos = drawPageFrame(
              chunks.length > 1 ? ` (${chunkIndex + 1}/${chunks.length})` : "",
            );
          }

          const segmentCodesY = yPos;
          const segmentNumbersY = segmentCodesY + headerRowH;
          const segmentCountsY = segmentNumbersY + headerRowH;
          const segmentListsY = segmentCountsY + headerRowH + 2;

          chunk.forEach((item, colIndex) => {
            const x = leftMargin + colIndex * (colWidth + colGap);

            doc.setLineWidth(0.2);
            doc.setDrawColor(40);
            doc.rect(x, segmentCodesY, colWidth, headerRowH);
            doc.rect(x, segmentNumbersY, colWidth, headerRowH);
            doc.rect(x, segmentCountsY, colWidth, headerRowH);

            doc.setFont(fontName, "bold");
            doc.setFontSize(8);
            doc.text(
              String(item.eventCode || "-"),
              x + colWidth / 2,
              segmentCodesY + 3.9,
              {
                align: "center",
              },
            );

            doc.setFont(fontName, "normal");
            doc.setFontSize(7.3);
            doc.text(
              `(${item.displayEventNumber})`,
              x + colWidth / 2,
              segmentNumbersY + 3.8,
              { align: "center" },
            );

            doc.setFont(fontName, "bold");
            doc.setFontSize(8.4);
            doc.text(
              String(item.count || 0),
              x + colWidth / 2,
              segmentCountsY + 3.9,
              {
                align: "center",
              },
            );

            const lines = item.list.slice(
              lineOffset,
              lineOffset + maxLinesPerSegment,
            );
            const listHeight = Math.max(8, lines.length * listLineH + 2);
            doc.rect(x, segmentListsY, colWidth, listHeight);

            doc.setFont(fontName, "normal");
            doc.setFontSize(8);
            lines.forEach((code, lineIndex) => {
              doc.text(
                String(code || "-").toUpperCase(),
                x + colWidth / 2,
                segmentListsY + 3.5 + lineIndex * listLineH,
                { align: "center" },
              );
            });
          });

          lineOffset += maxLinesPerSegment;
        }
      });

      // Add a dedicated summary + legend page (World Rowing style page 2 intent).
      doc.addPage();
      let summaryY = drawPageFrame(" (Summary)");

      const dimensionLabelPlural = isInternationalCompetition
        ? "Countries"
        : "Clubs";

      const totalDimensions = new Set(
        rows.map((row) =>
          isInternationalCompetition
            ? row.country || "UNK"
            : (row.clubCode || row.clubName || "UNK").trim(),
        ),
      ).size;
      const totalBoats = rows.length;
      const totalCompetitors = rows.reduce(
        (sum, row) => sum + Number(row.athleteUnitCount || 1),
        0,
      );

      autoTable(doc, {
        startY: summaryY,
        head: [[dimensionLabelPlural, "Events", "Boats", "Competitors"]],
        body: [
          [
            String(totalDimensions),
            String(events.length),
            String(totalBoats),
            String(totalCompetitors),
          ],
        ],
        theme: "grid",
        styles: {
          font: fontName,
          fontSize: 8,
          cellPadding: 1.1,
          lineColor: [60, 60, 60],
          lineWidth: 0.18,
          halign: "center",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          halign: "center",
        },
        margin: { left: 60, right: 60, bottom: 38 },
      });

      const inferGroupLabel = (eventName, eventCode) => {
        const text = String(eventName || "").toLowerCase();
        const code = String(eventCode || "")
          .trim()
          .toUpperCase();
        const hasPara = /para/.test(text) || /^PR\d*/.test(code);
        const hasMasters = /masters?|veteran/.test(text);
        const hasLw = /(light|lw|lightweight)/.test(text);
        const hasWomen = /(women|female|w\b)/.test(text);
        const hasMen = /(men|male|m\b)/.test(text);
        const hasMixed = /mixed|mix/.test(text);

        if (hasPara && hasMixed) return "Para-Rowing Mixed";
        if (hasPara && hasWomen) return "Para-Rowing Women";
        if (hasPara && hasMen) return "Para-Rowing Men";
        if (hasMasters && hasMixed) return "Masters Mixed";
        if (hasMasters && hasWomen) return "Masters Women";
        if (hasMasters && hasMen) return "Masters Men";
        if (hasMasters) return "Masters";
        if (hasLw && hasWomen) return "Lightweight Women";
        if (hasLw && hasMen) return "Lightweight Men";
        if (hasMixed) return "Mixed";
        if (hasWomen) return "Women";
        if (hasMen) return "Men";
        return "Open";
      };

      const byGroup = new Map();
      rows.forEach((row) => {
        const group = inferGroupLabel(row.eventName, row.eventCode);
        if (!byGroup.has(group)) {
          byGroup.set(group, {
            label: group,
            dimensions: new Set(),
            boats: 0,
            competitors: 0,
          });
        }
        const item = byGroup.get(group);
        item.dimensions.add(
          isInternationalCompetition
            ? row.country || "UNK"
            : (row.clubCode || row.clubName || "UNK").trim(),
        );
        item.boats += 1;
        item.competitors += Number(row.athleteUnitCount || 1);
      });

      const aggregateByPrefix = (prefix) =>
        Array.from(byGroup.values()).reduce(
          (acc, item) => {
            if (
              String(item.label || "")
                .toLowerCase()
                .startsWith(prefix)
            ) {
              acc.boats += Number(item.boats || 0);
              acc.competitors += Number(item.competitors || 0);
              item.dimensions.forEach((value) => acc.dimensions.add(value));
            }
            return acc;
          },
          { dimensions: new Set(), boats: 0, competitors: 0 },
        );

      const mastersTotals = aggregateByPrefix("masters");

      const baseGroupSortOrder = new Map([
        ["Lightweight Men", 1],
        ["Lightweight Women", 2],
        ["Men", 3],
        ["Women", 4],
        ["Mixed", 5],
        ["Para-Rowing Men", 6],
        ["Para-Rowing Women", 7],
        ["Para-Rowing Mixed", 8],
        ["Open", 9],
      ]);

      const groupRows = Array.from(byGroup.values())
        .filter((item) => {
          const label = String(item.label || "").toLowerCase();
          return !label.startsWith("masters");
        })
        .sort((a, b) => {
          const orderA = baseGroupSortOrder.get(a.label) || 99;
          const orderB = baseGroupSortOrder.get(b.label) || 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.label.localeCompare(b.label);
        })
        .map((item) => [
          item.label,
          String(item.dimensions.size),
          String(item.boats),
          String(item.competitors),
        ]);

      if (mastersTotals.boats > 0 || mastersTotals.competitors > 0) {
        groupRows.push([
          "Masters",
          String(mastersTotals.dimensions.size),
          String(mastersTotals.boats),
          String(mastersTotals.competitors),
        ]);
      }

      if (groupRows.length) {
        summaryY = (doc.lastAutoTable?.finalY || summaryY) + 5;
        autoTable(doc, {
          startY: summaryY,
          head: [["Group", dimensionLabelPlural, "Boats", "Competitors"]],
          body: groupRows,
          theme: "grid",
          styles: {
            font: fontName,
            fontSize: 7.5,
            cellPadding: 1,
            lineColor: [60, 60, 60],
            lineWidth: 0.15,
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            lineColor: [0, 0, 0],
            lineWidth: 0.18,
          },
          columnStyles: {
            0: { cellWidth: 52, fontStyle: "bold" },
            1: { cellWidth: 24, halign: "center" },
            2: { cellWidth: 24, halign: "center" },
            3: { cellWidth: 28, halign: "center" },
          },
          margin: { left: 56, right: 56, bottom: 38 },
        });
      }

      const legendRows = events.map((event) => [
        String(event.eventCode || "-"),
        `(${event.displayEventNumber}) ${String(event.eventName || "-")}`,
        String(event.eventNameAr || "-"),
      ]);

      let legendStartY = (doc.lastAutoTable?.finalY || summaryY) + 8;
      if (legendStartY > pageHeight - 75) {
        doc.addPage();
        legendStartY = drawPageFrame(" (Legend)");
      }

      doc.setFont(fontName, "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text("Legend", leftMargin, legendStartY);

      autoTable(doc, {
        startY: legendStartY + 1,
        head: [["Code", "Event", "Event (AR)"]],
        body: legendRows,
        theme: "grid",
        styles: {
          font: fontName,
          fontSize: 7,
          cellPadding: 0.9,
          lineColor: [60, 60, 60],
          lineWidth: 0.12,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.16,
        },
        columnStyles: {
          0: { cellWidth: 24, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 78 },
          2: { cellWidth: 80, halign: "right" },
        },
        didParseCell: (data) => {
          if (
            arabicFontName &&
            data.section === "body" &&
            data.column.index === 2
          ) {
            data.cell.styles.font = arabicFontName;
            data.cell.styles.fontStyle = "normal";
            data.cell.styles.halign = "right";
          }
        },
        margin: { left: leftMargin, right: 14, bottom: 38 },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);

        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            headerData,
            getImageFormat(headerData),
            0,
            3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 5, rightMargin, h + 5);
        }

        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            footerData,
            getImageFormat(footerData),
            0,
            pageHeight - h - 3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
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
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.addImage(
            sponsorData,
            getImageFormat(sponsorData),
            x,
            pageHeight - h - 3,
            w,
            h,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
            {
              align: "right",
            },
          );
        }
      }

      doc.save(buildEntriesReportPdfFileName("EntriesByEvent", competition));
      toast.success("Entries by Event exported successfully");
    } catch (error) {
      console.error("exportEntriesByEventPDF error:", error);
      toast.error("Failed to export Entries by Event");
    }
  }, [collectAssignedEntriesRows, competition, isInternationalCompetition]);

  const exportNumberOfEntriesByCountryPDF = useCallback(async () => {
    toast.info(`Generating Number of Entries by ${scopeDimensionLabel} PDF...`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const rows = collectAssignedEntriesRows();
    const byDimension = new Map();

    rows.forEach((row) => {
      const key = isInternationalCompetition
        ? row.country || "UNK"
        : (row.clubCode || "UNK").trim();
      const current = byDimension.get(key) || {
        label: key,
        entries: 0,
        athletes: 0,
        clubs: new Set(),
        events: new Set(),
        clubNameFr: "",
        clubNameAr: "",
      };
      current.entries += 1;
      current.athletes += Number(row.athleteUnitCount || 1);
      current.clubs.add(row.clubCode || row.clubName || "-");
      current.events.add(`${row.eventCode} - ${row.eventName}`);
      if (!current.clubNameFr && row.clubNameFr) {
        current.clubNameFr = row.clubNameFr;
      }
      if (!current.clubNameAr && row.clubNameAr) {
        current.clubNameAr = row.clubNameAr;
      }
      byDimension.set(key, current);
    });

    const summaryRows = Array.from(byDimension.values()).sort(
      (a, b) => b.entries - a.entries || a.label.localeCompare(b.label),
    );

    if (!summaryRows.length) {
      toast.info("No entries available to export.");
      return;
    }

    try {
      const asOfLabel = formatAsOfLabel();
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      const [headerData, footerData, sponsorData, arabicFontBase64] =
        await Promise.all([
          loadImage("/header.png"),
          loadImage("/footer.png"),
          loadImage("/sponsors.png"),
          loadFont("/fonts/Amiri-Regular.ttf"),
        ]);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      let arabicFontName = null;
      if (arabicFontBase64) {
        try {
          doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
          doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
          arabicFontName = "Amiri";
        } catch (error) {
          console.warn("Could not register Arabic font for club names:", error);
        }
      }

      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 14;
      const rightMargin = 196;
      const center = 105;
      const fontName = "helvetica";

      let headerHeight = 32;
      if (headerData) {
        const headerProps = doc.getImageProperties(headerData);
        headerHeight =
          pageWidth / (headerProps.width / headerProps.height) + 3 + 8;
      }

      const compLocation = String(
        competition?.location?.name ||
          competition?.venue?.name ||
          (typeof competition?.venue === "string" ? competition.venue : null) ||
          (typeof competition?.location === "string"
            ? competition.location
            : null) ||
          "Location",
      );

      const competitionTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";

      let yPos = headerHeight;

      doc.setFontSize(14);
      doc.setFont(fontName, "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(competitionTitle, center, yPos, { align: "center" });

      doc.setFontSize(9);
      doc.setFont(fontName, "normal");
      doc.text(compLocation, leftMargin, yPos);
      doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

      yPos += 2;
      doc.setLineWidth(0.5);
      doc.setDrawColor(0);
      doc.line(leftMargin, yPos, rightMargin, yPos);
      yPos += 6;

      const reportTitle = `Number of Entries by ${scopeDimensionLabel}`;
      doc.setFontSize(12);
      doc.setFont(fontName, "bold");
      doc.text(reportTitle, center, yPos, { align: "center" });
      yPos += 5;

      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      doc.setTextColor(90);
      doc.text(asOfLabel, leftMargin, yPos);
      yPos += 2;

      const globalHead = isInternationalCompetition
        ? ["Nbr", scopeDimensionLabel, "Athletes", "Entries", "Clubs"]
        : [
            "Nbr",
            "Club",
            "Club (FR)",
            "Club (AR)",
            "Athletes",
            "Entries",
            "Events",
          ];

      const globalBody = summaryRows.map((row, index) =>
        isInternationalCompetition
          ? [
              String(index + 1),
              row.label,
              String(row.athletes || 0),
              String(row.entries),
              String(row.clubs.size),
            ]
          : [
              String(index + 1),
              row.label,
              row.clubNameFr || "-",
              row.clubNameAr || "-",
              String(row.athletes || 0),
              String(row.entries),
              String(row.events.size),
            ],
      );

      const totalAthletesGlobal = summaryRows.reduce(
        (sum, row) => sum + Number(row.athletes || 0),
        0,
      );
      const totalEntriesGlobal = summaryRows.reduce(
        (sum, row) => sum + Number(row.entries || 0),
        0,
      );
      const totalEventGroups = new Set(
        rows.map((row) => `${row.eventCode || "-"}||${row.eventName || "-"}`),
      ).size;
      const totalLastColumnGlobal = summaryRows.reduce(
        (sum, row) =>
          sum + Number(isInternationalCompetition ? row.clubs?.size || 0 : 0),
        0,
      );

      globalBody.push(
        isInternationalCompetition
          ? [
              "",
              "Total",
              String(totalAthletesGlobal),
              String(totalEntriesGlobal),
              String(totalLastColumnGlobal),
            ]
          : [
              "",
              "Total",
              "",
              "",
              String(totalAthletesGlobal),
              String(totalEntriesGlobal),
              String(totalEventGroups),
            ],
      );

      const globalColumnStyles = isInternationalCompetition
        ? {
            0: { cellWidth: 14, halign: "center" },
            1: { cellWidth: 96 },
            2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
            3: { cellWidth: 20, halign: "center", fontStyle: "bold" },
            4: { cellWidth: 20, halign: "center", fontStyle: "bold" },
          }
        : {
            0: { cellWidth: 12, halign: "center" },
            1: { cellWidth: 16, halign: "center", fontStyle: "bold" },
            2: { cellWidth: 50 },
            3: { cellWidth: 52 },
            4: { cellWidth: 16, halign: "center", fontStyle: "bold" },
            5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
            6: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          };

      autoTable(doc, {
        startY: yPos,
        head: [globalHead],
        body: globalBody,
        theme: "grid",
        styles: {
          font: fontName,
          fontSize: 8,
          cellPadding: 1.2,
          lineColor: [105, 105, 105],
          lineWidth: 0.18,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineColor: [0, 0, 0],
          lineWidth: 0.22,
        },
        columnStyles: globalColumnStyles,
        margin: {
          left: leftMargin,
          right: 14,
          bottom: 35,
          top: headerHeight,
        },
        didParseCell: (data) => {
          const totalRowIndex = globalBody.length - 1;
          if (data.section === "body" && data.row.index === totalRowIndex) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [245, 247, 250];
          }

          if (
            !isInternationalCompetition &&
            arabicFontName &&
            data.section === "body" &&
            data.column.index === 3
          ) {
            data.cell.styles.font = arabicFontName;
            data.cell.styles.fontStyle = "normal";
            data.cell.styles.halign = "right";
          }
        },
      });

      // Add detailed matrix tables (World Rowing style): split event columns into chunks.
      const dimensionLabelForRow = (row) =>
        isInternationalCompetition
          ? row.country || "UNK"
          : (row.clubCode || "UNK").trim();

      const eventMetaMap = new Map();
      rows.forEach((row) => {
        const key = `${row.eventCode}||${row.eventName}`;
        const rowEventNumber = Number(row.eventNumber);
        const normalizedEventNumber =
          Number.isFinite(rowEventNumber) && rowEventNumber > 0
            ? rowEventNumber
            : null;

        if (!eventMetaMap.has(key)) {
          eventMetaMap.set(key, {
            key,
            code: row.eventCode || "-",
            name: row.eventName || "-",
            eventNumber: normalizedEventNumber,
          });
          return;
        }

        const existing = eventMetaMap.get(key);
        if (normalizedEventNumber != null) {
          existing.eventNumber =
            existing.eventNumber == null
              ? normalizedEventNumber
              : Math.min(existing.eventNumber, normalizedEventNumber);
        }
      });

      const eventMeta = Array.from(eventMetaMap.values())
        .sort((a, b) => {
          const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
          const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
          if (eventNumberA !== eventNumberB) {
            return eventNumberA - eventNumberB;
          }
          return `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`);
        })
        .map((event, index) => ({
          ...event,
          displayEventNumber:
            Number.isFinite(Number(event.eventNumber)) &&
            Number(event.eventNumber) > 0
              ? Number(event.eventNumber)
              : index + 1,
        }));

      const matrixCounts = new Map();
      const dimensionAthleteTotals = new Map();
      rows.forEach((row) => {
        const dimension = dimensionLabelForRow(row);
        const eventKey = `${row.eventCode}||${row.eventName}`;
        const athleteUnits = Number(row.athleteUnitCount || 1);
        if (!matrixCounts.has(dimension)) {
          matrixCounts.set(dimension, new Map());
        }
        const bucket = matrixCounts.get(dimension);
        bucket.set(eventKey, (bucket.get(eventKey) || 0) + athleteUnits);
        dimensionAthleteTotals.set(
          dimension,
          (dimensionAthleteTotals.get(dimension) || 0) + athleteUnits,
        );
      });

      const orderedDimensions = summaryRows.map((item) => item.label);
      const grandTotal = Array.from(dimensionAthleteTotals.values()).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
      );

      const codeForDimension = (value) => {
        const text = String(value || "").trim();
        if (!text) return "UNK";
        const match = text.match(/[A-Za-z0-9]{2,4}/);
        return (match ? match[0] : text.slice(0, 4)).toUpperCase();
      };

      const usableWidthForMatrix = rightMargin - leftMargin;
      const firstColWidthForMatrix = isInternationalCompetition ? 26 : 22;
      const codeColWidthForMatrix = 14;
      const totalColWidthForMatrix = 10;
      const availableEventWidth =
        usableWidthForMatrix -
        firstColWidthForMatrix -
        codeColWidthForMatrix -
        totalColWidthForMatrix;

      doc.setFont(fontName, "bold");
      doc.setFontSize(6);
      const eventMetaWithWidth = eventMeta.map((event) => {
        const codeWidth = doc.getTextWidth(String(event.code || "-"));
        const eventNumberWidth = doc.getTextWidth(
          `(${event.displayEventNumber})`,
        );
        const desiredWidth = Math.max(codeWidth, eventNumberWidth) + 2.2;
        return {
          ...event,
          colWidth: Math.max(5.4, Math.min(11, desiredWidth)),
        };
      });

      const eventChunks = [];
      let currentChunk = [];
      let currentChunkWidth = 0;
      eventMetaWithWidth.forEach((event) => {
        if (
          currentChunk.length > 0 &&
          currentChunkWidth + event.colWidth > availableEventWidth
        ) {
          eventChunks.push(currentChunk);
          currentChunk = [];
          currentChunkWidth = 0;
        }
        currentChunk.push(event);
        currentChunkWidth += event.colWidth;
      });
      if (currentChunk.length > 0) {
        eventChunks.push(currentChunk);
      }

      if (!eventChunks.length) {
        eventChunks.push([]);
      }

      const drawMatrixPageHeader = () => {
        let y = headerHeight;
        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competitionTitle, center, y, { align: "center" });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, y);
        doc.text(eventDateStr, rightMargin, y, { align: "right" });

        y += 2;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);
        y += 6;
        return y;
      };

      // Matrix starts from page 2 (global table stays on page 1).
      doc.addPage();
      let nextMatrixStartY = drawMatrixPageHeader();

      eventChunks.forEach((chunk, chunkIndex) => {
        const matrixTitle = reportTitle;

        const estimatedRows = orderedDimensions.length + 2; // data + total + header
        const estimatedChunkHeight = 8 + estimatedRows * 4;
        if (nextMatrixStartY + estimatedChunkHeight > pageHeight - 38) {
          doc.addPage();
          nextMatrixStartY = drawMatrixPageHeader();
        }

        let matrixY = nextMatrixStartY;

        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(
          eventChunks.length > 1
            ? `${matrixTitle} (${chunkIndex + 1}/${eventChunks.length})`
            : matrixTitle,
          center,
          matrixY,
          { align: "center" },
        );
        matrixY += 4;

        doc.setFontSize(8);
        doc.setFont(fontName, "normal");
        doc.setTextColor(90);
        doc.text(asOfLabel, leftMargin, matrixY);
        matrixY += 2;

        const firstColWidth = firstColWidthForMatrix;
        const codeColWidth = codeColWidthForMatrix;
        const totalColWidth = totalColWidthForMatrix;

        const matrixColumnStyles = {
          0: { cellWidth: firstColWidth, fontStyle: "bold" },
          [chunk.length + 1]: {
            cellWidth: codeColWidth,
            halign: "center",
            fontStyle: "bold",
          },
          [chunk.length + 2]: {
            cellWidth: totalColWidth,
            halign: "center",
            fontStyle: "bold",
          },
        };
        chunk.forEach((event, idx) => {
          matrixColumnStyles[idx + 1] = {
            cellWidth: event.colWidth,
            halign: "center",
          };
        });

        const matrixBody = orderedDimensions.map((dimension) => {
          const bucket = matrixCounts.get(dimension) || new Map();
          const chunkValues = chunk.map((event) => bucket.get(event.key) || 0);
          const rowTotal = Number(dimensionAthleteTotals.get(dimension) || 0);
          return [
            dimension,
            ...chunkValues.map((value) => (value > 0 ? String(value) : "")),
            codeForDimension(dimension),
            String(rowTotal),
          ];
        });

        const chunkTotals = chunk.map((event) =>
          orderedDimensions.reduce((sum, dimension) => {
            const bucket = matrixCounts.get(dimension) || new Map();
            return sum + (bucket.get(event.key) || 0);
          }, 0),
        );

        matrixBody.push([
          "Total",
          ...chunkTotals.map((value) => (value > 0 ? String(value) : "0")),
          "",
          String(grandTotal),
        ]);

        autoTable(doc, {
          startY: matrixY,
          head: [
            [
              isInternationalCompetition ? "Country" : "Club",
              ...chunk.map(
                (event) => `${event.code}\n(${event.displayEventNumber})`,
              ),
              isInternationalCompetition ? "Ctry\nCode" : "Club\nCode",
              "Total",
            ],
          ],
          body: matrixBody,
          theme: "grid",
          styles: {
            font: fontName,
            fontSize: 6,
            cellPadding: 0.8,
            lineColor: [50, 50, 50],
            lineWidth: 0.1,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            halign: "center",
          },
          columnStyles: matrixColumnStyles,
          margin: {
            left: leftMargin,
            right: 14,
            bottom: 35,
            top: headerHeight,
          },
          didParseCell: (data) => {
            const totalRowIndex = matrixBody.length - 1;
            if (data.section === "body" && data.row.index === totalRowIndex) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [245, 247, 250];
            }
          },
        });

        nextMatrixStartY = (doc.lastAutoTable?.finalY || matrixY) + 6;
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);

        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            headerData,
            getImageFormat(headerData),
            0,
            3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 5, rightMargin, h + 5);
        }

        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            footerData,
            getImageFormat(footerData),
            0,
            pageHeight - h - 3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
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
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.addImage(
            sponsorData,
            getImageFormat(sponsorData),
            x,
            pageHeight - h - 3,
            w,
            h,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
            {
              align: "right",
            },
          );
        } else {
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, pageHeight - 15, rightMargin, pageHeight - 15);
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - 8);
          doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
            align: "right",
          });
        }
      }

      doc.save(
        buildEntriesReportPdfFileName(
          isInternationalCompetition
            ? "NumberOfEntriesByCountry"
            : "NumberOfEntriesByClub",
          competition,
        ),
      );
      toast.success(`${reportTitle} exported successfully`);
    } catch (error) {
      console.error("exportNumberOfEntriesByDimension error:", error);
      toast.error(
        `Failed to export Number of Entries by ${scopeDimensionLabel}`,
      );
    }
  }, [
    collectAssignedEntriesRows,
    competition,
    isInternationalCompetition,
    scopeDimensionLabel,
  ]);

  const exportEntryListByCountryPDF = useCallback(async () => {
    toast.info(`Generating Entry List by ${scopeDimensionLabel} PDF...`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const raceRows = [];
    const registrationEntriesByCategory = new Map();
    let rowSequence = 0;

    if (registrationStats?.byCategory?.length) {
      registrationStats.byCategory.forEach((cat) => {
        const catId = toDocumentId(cat?.id || cat?._id || cat);
        if (!catId) return;
        const entriesList = Array.isArray(cat?.entries) ? cat.entries : [];
        registrationEntriesByCategory.set(catId, entriesList);
      });
    }

    const seatLabelForIndex = (idx, total) => {
      if (total <= 1) return "";
      if (total === 2) return idx === 0 ? "(b)" : "(s)";
      if (idx === 0) return "(b)";
      if (idx === total - 1) return "(s)";
      return `(${idx + 1})`;
    };

    const formatBirthDate = (value) => {
      if (!value) return "";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      return d
        .toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();
    };

    sortedRaces.forEach((race) => {
      const categoryId = toDocumentId(race.category);
      const boatClassId = toDocumentId(race.boatClass);
      const category = categoryId
        ? categories.find((item) => toDocumentId(item) === categoryId)
        : null;
      const boatClass = boatClassId
        ? boatClasses.find((item) => toDocumentId(item) === boatClassId)
        : null;

      const eventCode = generateRaceCode(category, boatClass) || "-";
      const eventName =
        formatEventTitleWithBoatClass(category, boatClass, "en") ||
        race.name ||
        `Race ${race.order || "-"}`;
      const eventNumber = Number(race?.order) || null;

      (race.lanes || []).filter(isAssignedLane).forEach((lane) => {
        const laneAthlete =
          typeof lane.athlete === "object" && lane.athlete?.firstName
            ? lane.athlete
            : raceAthleteLookup.get(toDocumentId(lane.athlete));

        const crewMembers = Array.isArray(lane.crew)
          ? lane.crew
              .map((member) => {
                if (member && typeof member === "object" && member.firstName) {
                  return member;
                }
                return raceAthleteLookup.get(toDocumentId(member));
              })
              .filter(Boolean)
          : [];

        const clubCode =
          lane?.club?.code ||
          lane?.club?.name?.slice(0, 4).toUpperCase() ||
          "-";
        const clubName = resolveClubLabel(lane?.club) || clubCode;
        const country = resolveLaneCountry(lane, laneAthlete || crewMembers[0]);

        const dimensionKey = isInternationalCompetition
          ? String(country || "UNK").toUpperCase()
          : String(clubCode || "UNK").toUpperCase();
        const dimensionTitle = isInternationalCompetition
          ? `${dimensionKey} - ${clubName}`
          : `${dimensionKey} - ${clubName}`;

        if (laneAthlete) {
          raceRows.push({
            rowSequence: rowSequence++,
            dimensionKey,
            dimensionTitle,
            eventCode,
            eventName,
            eventNumber,
            seat: "",
            athleteName: formatAthleteName(laneAthlete),
            birthDate: formatBirthDate(
              laneAthlete.birthDate ||
                laneAthlete.dateOfBirth ||
                laneAthlete.dob ||
                null,
            ),
            crewCount: 1,
            athleteCount: 1,
          });
          return;
        }

        if (crewMembers.length) {
          const raceCategoryId = toDocumentId(race.category);
          const raceBoatClassId = toDocumentId(race.boatClass);
          const laneClubId = toDocumentId(lane?.club);
          const laneCrewIds = crewMembers.map((member) => toDocumentId(member));
          const laneCrewSignature = laneCrewIds
            .filter(Boolean)
            .sort()
            .join("|");

          const registrationCandidates =
            registrationEntriesByCategory.get(raceCategoryId) || [];

          const matchedRegistrationCrew = registrationCandidates.find(
            (entry) => {
              if (
                !Array.isArray(entry?.crew) ||
                entry.crew.length !== crewMembers.length
              ) {
                return false;
              }

              const entryBoatClassId = toDocumentId(entry?.boatClass);
              if (
                raceBoatClassId &&
                entryBoatClassId &&
                entryBoatClassId !== raceBoatClassId
              ) {
                return false;
              }

              const entryClubId = toDocumentId(entry?.club);
              if (laneClubId && entryClubId && entryClubId !== laneClubId) {
                return false;
              }

              const entryCrewIds = entry.crew.map((member) =>
                toDocumentId(member),
              );
              const entryCrewSignature = entryCrewIds
                .filter(Boolean)
                .sort()
                .join("|");

              return (
                entryCrewSignature && entryCrewSignature === laneCrewSignature
              );
            },
          );

          const registrationOrderMap = new Map(
            (Array.isArray(matchedRegistrationCrew?.crew)
              ? matchedRegistrationCrew.crew
              : []
            ).map((member, index) => [toDocumentId(member), index]),
          );

          const orderedCrewMembers = [...crewMembers].sort((a, b) => {
            const idA = toDocumentId(a);
            const idB = toDocumentId(b);
            const orderA = registrationOrderMap.has(idA)
              ? registrationOrderMap.get(idA)
              : Number.MAX_SAFE_INTEGER;
            const orderB = registrationOrderMap.has(idB)
              ? registrationOrderMap.get(idB)
              : Number.MAX_SAFE_INTEGER;
            if (orderA !== orderB) return orderA - orderB;
            return formatAthleteName(a).localeCompare(formatAthleteName(b));
          });

          orderedCrewMembers.forEach((member, index) => {
            raceRows.push({
              rowSequence: rowSequence++,
              dimensionKey,
              dimensionTitle,
              eventCode,
              eventName,
              eventNumber,
              seat: seatLabelForIndex(index, orderedCrewMembers.length),
              athleteName: formatAthleteName(member),
              birthDate: formatBirthDate(
                member.birthDate || member.dateOfBirth || member.dob || null,
              ),
              crewCount: index === 0 ? 1 : 0,
              athleteCount: 1,
            });
          });
          return;
        }

        raceRows.push({
          rowSequence: rowSequence++,
          dimensionKey,
          dimensionTitle,
          eventCode,
          eventName,
          eventNumber,
          seat: "",
          athleteName: "Unassigned",
          birthDate: "",
          crewCount: 1,
          athleteCount: 1,
        });
      });
    });

    if (!raceRows.length) {
      toast.info("No entries available to export.");
      return;
    }

    try {
      const asOfLabel = formatAsOfLabel();
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : dateStr;

      const [headerData, footerData, sponsorData] = await Promise.all([
        loadImage("/header.png"),
        loadImage("/footer.png"),
        loadImage("/sponsors.png"),
      ]);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const leftMargin = 14;
      const rightMargin = 196;
      const center = 105;
      const fontName = "helvetica";

      let headerHeight = 32;
      if (headerData) {
        const headerProps = doc.getImageProperties(headerData);
        headerHeight =
          pageWidth / (headerProps.width / headerProps.height) + 3 + 8;
      }

      const compLocation = String(
        competition?.location?.name ||
          competition?.venue?.name ||
          (typeof competition?.venue === "string" ? competition.venue : null) ||
          (typeof competition?.location === "string"
            ? competition.location
            : null) ||
          "Location",
      );

      const competitionTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";

      const grouped = new Map();
      raceRows.forEach((row) => {
        if (!grouped.has(row.dimensionKey)) {
          grouped.set(row.dimensionKey, {
            key: row.dimensionKey,
            title: row.dimensionTitle,
            rows: [],
            crews: 0,
            athletes: 0,
          });
        }
        const bucket = grouped.get(row.dimensionKey);
        bucket.rows.push(row);
        bucket.crews += Number(row.crewCount || 0);
        bucket.athletes += Number(row.athleteCount || 0);
      });

      const sections = Array.from(grouped.values())
        .map((section) => ({
          ...section,
          rows: section.rows.sort((a, b) => {
            const numA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
            const numB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
            if (numA !== numB) return numA - numB;
            const codeCompare = `${a.eventCode}`.localeCompare(
              `${b.eventCode}`,
            );
            if (codeCompare !== 0) return codeCompare;
            return Number(a.rowSequence || 0) - Number(b.rowSequence || 0);
          }),
        }))
        .sort((a, b) => a.key.localeCompare(b.key));

      const legendEventMap = new Map();
      raceRows.forEach((row) => {
        const key = `${row.eventCode}||${row.eventName}`;
        if (!legendEventMap.has(key)) {
          legendEventMap.set(key, {
            code: String(row.eventCode || "-").toUpperCase(),
            name: String(row.eventName || "-"),
            eventNumber: Number(row.eventNumber || Number.MAX_SAFE_INTEGER),
          });
          return;
        }
        const existing = legendEventMap.get(key);
        const candidateNum = Number(row.eventNumber || Number.MAX_SAFE_INTEGER);
        if (candidateNum < existing.eventNumber) {
          existing.eventNumber = candidateNum;
        }
      });

      const legendEvents = Array.from(legendEventMap.values()).sort((a, b) => {
        if (a.eventNumber !== b.eventNumber) {
          return a.eventNumber - b.eventNumber;
        }
        return a.code.localeCompare(b.code);
      });

      const femaleLegend = [];
      const maleLegend = [];
      legendEvents.forEach((item) => {
        const code = String(item.code || "").toUpperCase();
        const name = String(item.name || "").toLowerCase();
        const isFemale =
          /women|female/.test(name) || /^(W|LW(?!M)|PR\d?W)/.test(code);
        const isMale = /men|male/.test(name) || /^(M|LM|PR\d?M)/.test(code);

        const row = {
          code: item.code,
          label: item.name,
        };

        if (isFemale && !isMale) {
          femaleLegend.push(row);
        } else if (isMale && !isFemale) {
          maleLegend.push(row);
        } else if (femaleLegend.length <= maleLegend.length) {
          femaleLegend.push(row);
        } else {
          maleLegend.push(row);
        }
      });

      const splitInTwo = (items) => {
        const mid = Math.ceil(items.length / 2);
        return [items.slice(0, mid), items.slice(mid)];
      };

      const [femaleCol1, femaleCol2] = splitInTwo(femaleLegend);
      const [maleCol1, maleCol2] = splitInTwo(maleLegend);

      const hasBowSeat = raceRows.some((row) =>
        /\(b\)/i.test(String(row.seat || "")),
      );
      const hasStrokeSeat = raceRows.some((row) =>
        /\(s\)/i.test(String(row.seat || "")),
      );
      const hasCoxSeat = raceRows.some(
        (row) =>
          /\(c\)/i.test(String(row.seat || "")) ||
          /\bcox\b/i.test(String(row.athleteName || "")),
      );

      const seatLegendItems = [];
      if (hasBowSeat) seatLegendItems.push("b bow");
      if (hasStrokeSeat) seatLegendItems.push("s stroke");
      if (hasCoxSeat) seatLegendItems.push("c cox");

      const drawWrLegendBlock = (footerTopY) => {
        const legendX = leftMargin;
        const legendW = rightMargin - leftMargin;
        const headerH = 5.4;
        const rowH = 2.45;
        const maxRows = Math.max(
          femaleCol1.length,
          femaleCol2.length,
          maleCol1.length,
          maleCol2.length,
          1,
        );
        const seatRowH = seatLegendItems.length > 0 ? 3.0 : 0;
        const legendH = headerH + maxRows * rowH + 1.4 + seatRowH;
        const legendY = footerTopY - legendH - 7;

        const centerGapCompression = 8;
        const sideGap = 0;
        const colW = (legendW + centerGapCompression - sideGap * 2) / 4;
        const codeColOffset = 0.6;
        const labelColOffset = 9.6;
        const x0 = legendX;
        const x1 = x0 + colW + sideGap;
        const x2 = x1 + colW - centerGapCompression;
        const x3 = x2 + colW + sideGap;
        const cols = [
          { x: x0, data: femaleCol1 },
          { x: x1, data: maleCol1 },
          { x: x2, data: femaleCol2 },
          { x: x3, data: maleCol2 },
        ];

        doc.setDrawColor(70);
        doc.setLineWidth(0.16);
        doc.rect(legendX, legendY, legendW, legendH);

        doc.setFont(fontName, "bold");
        doc.setFontSize(6.4);
        doc.setTextColor(0);
        doc.text("Legend:", legendX + 1.4, legendY + 2.8);

        doc.setFont(fontName, "normal");
        doc.setFontSize(6);
        doc.text("F", x0 + 1.4, legendY + 5.0);
        doc.text("Female", x0 + 5.6, legendY + 5.0);
        doc.text("M", x1 + 1.4, legendY + 5.0);
        doc.text("Male", x1 + 5.6, legendY + 5.0);
        doc.text("F", x2 + 1.4, legendY + 5.0);
        doc.text("Female", x2 + 5.6, legendY + 5.0);
        doc.text("M", x3 + 1.4, legendY + 5.0);
        doc.text("Male", x3 + 5.6, legendY + 5.0);

        const toSingleLine = (text, maxWidth) => {
          const value = String(text || "");
          if (!value) return "";
          if (doc.getTextWidth(value) <= maxWidth) return value;

          const ellipsis = "...";
          let trimmed = value;
          while (trimmed.length > 0) {
            const candidate = `${trimmed}${ellipsis}`;
            if (doc.getTextWidth(candidate) <= maxWidth) {
              return candidate;
            }
            trimmed = trimmed.slice(0, -1);
          }
          return ellipsis;
        };

        doc.setFontSize(5.8);
        cols.forEach((col) => {
          col.data.forEach((item, idx) => {
            const y = legendY + headerH + 1.45 + idx * rowH;
            if (!item?.code && !item?.label) {
              return;
            }
            doc.setFont(fontName, "normal");
            doc.text(`${item.code || ""}`, col.x + codeColOffset, y);
            const labelMaxWidth = colW - labelColOffset - 0.4;
            doc.text(
              toSingleLine(item.label, labelMaxWidth),
              col.x + labelColOffset,
              y,
            );
          });
        });

        if (seatLegendItems.length > 0) {
          const seatY = legendY + headerH + maxRows * rowH + 2.2;
          const seatText = seatLegendItems.join("   ");
          doc.setFontSize(6.2);
          doc.setFont(fontName, "normal");
          doc.text(seatText, legendX + 1.6, seatY);
        }
      };

      const drawPageHeader = () => {
        let y = headerHeight;

        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(competitionTitle, center, y, { align: "center" });

        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(compLocation, leftMargin, y);
        doc.text(eventDateStr, rightMargin, y, { align: "right" });

        y += 2;
        doc.setLineWidth(0.5);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);
        y += 4;

        doc.setFontSize(12);
        doc.setFont(fontName, "bold");
        doc.text(`Entry List by ${scopeDimensionLabel}`, center, y, {
          align: "center",
        });
        y += 4.5;

        doc.setFontSize(9);
        doc.setFont(fontName, "bold");
        doc.text(asOfLabel.replace(":", ""), center, y, { align: "center" });
        y += 3.5;

        doc.setLineWidth(0.28);
        doc.setDrawColor(0);
        doc.line(leftMargin, y, rightMargin, y);

        return y + 4.5;
      };

      sections.forEach((section, sectionIdx) => {
        if (sectionIdx > 0) {
          doc.addPage();
        }

        let yPos = drawPageHeader();

        doc.setFontSize(11);
        doc.setFont(fontName, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(section.title, center, yPos, { align: "center" });
        yPos += 5;

        let previousEventKey = null;
        const tableBody = section.rows.map((row) => {
          const eventKey = `${row.eventCode}||${row.eventNumber || ""}`;
          const isEventStart = eventKey !== previousEventKey;
          previousEventKey = eventKey;

          return {
            eventCode: isEventStart ? String(row.eventCode || "-") : "",
            eventNumber:
              isEventStart && row.eventNumber ? String(row.eventNumber) : "",
            seat: String(row.seat || ""),
            athleteName: String(row.athleteName || "-"),
            birthDate: String(row.birthDate || ""),
            isEventStart,
          };
        });

        autoTable(doc, {
          startY: yPos,
          columns: [
            { header: "Event Code", dataKey: "eventCode" },
            { header: "Event Number", dataKey: "eventNumber" },
            { header: "Seat", dataKey: "seat" },
            { header: "Name", dataKey: "athleteName" },
            { header: "Date of Birth", dataKey: "birthDate" },
          ],
          body: tableBody,
          theme: "plain",
          styles: {
            font: fontName,
            fontSize: 8,
            cellPadding: 0.55,
            lineWidth: 0,
            textColor: [20, 20, 20],
          },
          headStyles: {
            textColor: [0, 0, 0],
            fontStyle: "bold",
            fillColor: [255, 255, 255],
            cellPadding: 0.5,
          },
          columnStyles: {
            0: { cellWidth: 24, halign: "left", fontStyle: "bold" },
            1: { cellWidth: 24, halign: "center" },
            2: { cellWidth: 15, halign: "center" },
            3: { cellWidth: 76 },
            4: { cellWidth: 41 },
          },
          margin: { left: leftMargin, right: 14, bottom: 66 },
          didDrawCell: (data) => {
            if (data.section === "head" && data.column.index === 0) {
              const yLine = data.cell.y + data.cell.height;
              doc.setDrawColor(0);
              doc.setLineWidth(0.25);
              doc.line(leftMargin, yLine, rightMargin, yLine);
            }

            if (
              data.section === "body" &&
              data.column.index === 0 &&
              data.row.index > 0 &&
              data.row.raw?.isEventStart
            ) {
              doc.setDrawColor(0);
              doc.setLineWidth(0.18);
              doc.line(leftMargin, data.cell.y, rightMargin, data.cell.y);
            }
          },
          didParseCell: (data) => {
            if (
              data.section === "body" &&
              data.row?.raw &&
              !data.row.raw.isEventStart
            ) {
              data.cell.styles.cellPadding = {
                top: 0.2,
                right: 0.55,
                bottom: 0.2,
                left: 0.55,
              };
            }
          },
        });

        const afterTableY = (doc.lastAutoTable?.finalY || yPos) + 4;
        doc.setFontSize(9);
        doc.setFont(fontName, "bold");
        doc.text("Crews:", leftMargin, afterTableY);
        doc.text(String(section.crews), leftMargin + 18, afterTableY);
        doc.text("Athletes:", leftMargin + 48, afterTableY);
        doc.text(String(section.athletes), leftMargin + 72, afterTableY);
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);

        if (headerData) {
          const imgProps = doc.getImageProperties(headerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            headerData,
            getImageFormat(headerData),
            0,
            3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(leftMargin, h + 5, rightMargin, h + 5);
        }

        if (footerData) {
          const imgProps = doc.getImageProperties(footerData);
          const h = pageWidth / (imgProps.width / imgProps.height);
          doc.addImage(
            footerData,
            getImageFormat(footerData),
            0,
            pageHeight - h - 3,
            pageWidth,
            h,
          );
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          drawWrLegendBlock(pageHeight - h - 5);

          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(`Page ${i}/${pageCount}`, rightMargin, pageHeight - h - 8, {
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
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          drawWrLegendBlock(pageHeight - h - 5);
          doc.addImage(
            sponsorData,
            getImageFormat(sponsorData),
            x,
            pageHeight - h - 3,
            w,
            h,
          );
          doc.setFontSize(8);
          doc.setFont(fontName, "normal");
          doc.setTextColor(100);
          doc.text(asOfLabel, leftMargin, pageHeight - h - 8);
          doc.text(`Page ${i}/${pageCount}`, rightMargin, pageHeight - h - 8, {
            align: "right",
          });
        }
      }

      doc.save(
        buildEntriesReportPdfFileName(
          isInternationalCompetition ? "EntryListByCountry" : "EntryListByClub",
          competition,
        ),
      );
      toast.success(
        `Entry List by ${scopeDimensionLabel} exported successfully`,
      );
    } catch (error) {
      console.error("exportEntryListByCountryPDF error:", error);
      toast.error(`Failed to export Entry List by ${scopeDimensionLabel}`);
    }
  }, [
    sortedRaces,
    categories,
    boatClasses,
    raceAthleteLookup,
    registrationStats,
    resolveLaneCountry,
    isInternationalCompetition,
    scopeDimensionLabel,
    competition,
  ]);

  const handleCategorySelect = (
    categoryId,
    statsOverride = null,
    explicitJourney = null,
  ) => {
    setAutoGenState((prev) => ({
      ...prev,
      category: categoryId,
      ...(explicitJourney !== null ? { journeyIndex: explicitJourney } : {}),
    }));

    // Always clear previous entries when switching categories or journeys
    setEntries([]);

    // Find entries for this category and populate the start list
    const sourceStats = statsOverride || registrationStats;
    let isRaceFallbackSource = false;

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
              const raceId = toDocumentId(race) || `idx-${laneIndex}`;
              entriesFromRaces.push({
                _id: `race-${raceId}-lane-${laneIndex}`,
                athlete: lane.athlete,
                crew: lane.crew || [],
                club: lane.club,
                boatClass: race.boatClass,
                category: race.category,
                seed: lane.seed,
                crewNumber: lane.crewNumber,
                journeyIndex: race.journeyIndex || race.order || 1,
                notes: lane.notes || "",
              });
            }
          });
        });

        if (entriesFromRaces.length > 0) {
          isRaceFallbackSource = true;
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
      const targetJourney =
        explicitJourney !== null
          ? Number(explicitJourney)
          : Number(globalJourneyFilter || autoGenState.journeyIndex) || 1;

      const validEntries = catData.entries.filter((e) => {
        const eJourney = e.journeyIndex ? Number(e.journeyIndex) : 1;
        return eJourney === targetJourney;
      });

      const boatClassCounts = {};

      // Transform entries to the format expected by the start list
      let newEntries = validEntries.map((entry, index) => {
        const entryId = toDocumentId(entry.id || entry._id);
        const isRaceDerivedEntry =
          isRaceFallbackSource || String(entry._id || "").startsWith("race-");

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
          id: isRaceDerivedEntry ? null : entryId,
          uid: isRaceDerivedEntry
            ? entry._id || `race-${index}-${Date.now()}`
            : `db-${entryId || index}`,
          athleteId:
            toDocumentId(entry.athlete) ||
            (entry.crew && entry.crew.length > 0
              ? toDocumentId(entry.crew[0])
              : null) ||
            entryId ||
            entry._id,
          athlete: entry.athlete,
          crew: entry.crew,
          clubId: resolvedClub?._id || resolvedClub || entry.club?._id,
          clubName: resolveClubLabel(resolvedClub) || entry.club?.name,
          clubCode: resolvedClub?.code || entry.club?.code,
          category: entry.category,
          boatClass: entry.boatClass,
          crewNumber: entry.crewNumber,
          status: entry.status,
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
              e.boatClass?._id ||
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
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          {competition?.competitionType === "championship" &&
            competition?.stages?.length > 0 && (
              <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 flex-shrink-0 h-10 shadow-sm">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider min-w-[max-content]">
                  Filter Journey:
                </label>
                <select
                  value={globalJourneyFilter || ""}
                  onChange={(e) => setGlobalJourneyFilter(e.target.value)}
                  className="w-36 h-8 text-sm outline-none border-none focus:ring-0 cursor-pointer bg-transparent text-slate-800"
                >
                  <option value="">All Journeys</option>
                  {competition.stages.map((stage, i) => {
                    const jIndex =
                      stage.order !== undefined && stage.order !== null
                        ? stage.order
                        : i + 1;
                    return (
                      <option key={jIndex} value={jIndex}>
                        {stage.name || `Journey ${jIndex}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(`/competitions/${competitionId}/rankings`)
              }
            >
              🏆 Rankings
            </Button>
            <Button type="button" onClick={loadRaces} disabled={loadingRaces}>
              Refresh races
            </Button>
          </div>
        </div>
      </div>

      {loadingCompetition ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading competition...
        </div>
      ) : competition ? (
        <div className="space-y-6">
          {/* Dashboard Section - Enhanced */}
          <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total Athletes
                </p>
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icons.Users />
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalAthletes || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Registered Clubs
                </p>
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600">🏛️</span>
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalClubs || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Total Entries
                </p>
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600">📋</span>
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {combinedStats?.totalEntries || 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Races Generated
                </p>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-600">🏁</span>
                </div>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {sortedRaces.length || 0}
              </p>
            </div>
          </section>

          {/* Categories Grid - Enhanced */}
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-5 pb-5 pt-3 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Categories Overview
              </h2>
              <span className="text-xs text-slate-400">
                Click to load entries
              </span>
            </div>

            <div className="space-y-4">
              <div>
                {loadingRegistration && !races.length ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading registration data...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {combinedStats?.byCategory?.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategorySelect(cat.id)}
                        className={`
                      inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200
                      ${
                        autoGenState.category === cat.id
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm"
                      }
                    `}
                      >
                        <span className="font-semibold">{cat.name}</span>
                        <span
                          className={`
                      rounded-full px-2 py-0.5 text-xs font-bold
                      ${
                        autoGenState.category === cat.id
                          ? "bg-blue-200 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }
                    `}
                        >
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
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 space-y-1.5">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Entries Reports
                </p>

                <div className="flex flex-wrap gap-2 md:flex-nowrap">
                  {[
                    {
                      label: "Entry List by Event",
                      onClick: exportEntryListByEventPDF,
                    },
                    {
                      label: "Entries by Event",
                      onClick: exportEntriesByEventPDF,
                    },
                    {
                      label: `Number of Entries by ${scopeDimensionLabel}`,
                      onClick: exportNumberOfEntriesByCountryPDF,
                    },
                    {
                      label: `Entry List by ${scopeDimensionLabel}`,
                      onClick: exportEntryListByCountryPDF,
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.onClick}
                      className="group flex min-w-[220px] flex-1 items-center rounded-md border border-slate-200 bg-white text-left hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <span className="flex h-9 w-9 flex-none items-center justify-center bg-sky-500 text-white text-sm font-bold rounded-l-md">
                        PDF
                      </span>
                      <span className="px-3 py-1.5 text-sm font-semibold text-slate-800 group-hover:text-blue-800">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4 items-start">
            {/* LEFT COLUMN: Race Generator + Start List */}
            <div className="space-y-4">
              {/* Generation Progress Overlay */}
              <GenerationProgress
                isGenerating={isGenerating}
                progress={generationProgress}
                stage={generationStage}
              />

              <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-lg overflow-hidden relative">
                {/* Header with gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Icons.Sparkles />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        Race Generator
                      </h2>
                      <p className="text-sm text-slate-500">
                        Create races with automatic lane allocations
                      </p>
                    </div>
                  </div>
                  {/* Quick Stats */}
                  <div className="hidden md:flex items-center gap-3">
                    <div className="text-center px-3 py-1 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs text-blue-600 font-medium">
                        Entries
                      </p>
                      <p className="text-lg font-bold text-blue-700">
                        {relevantEntries.length}
                      </p>
                    </div>
                    <div className="text-center px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100">
                      <p className="text-xs text-indigo-600 font-medium">
                        Heats
                      </p>
                      <p className="text-lg font-bold text-indigo-700">
                        {Math.ceil(
                          relevantEntries.length /
                            (parseInt(autoGenState.lanesPerRace) || 6),
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Validation Feedback */}
                <ValidationFeedback
                  errors={validationErrors}
                  warnings={validationWarnings}
                />

                {/* Main Configuration Grid */}
                <div className="grid gap-3 lg:grid-cols-3 mb-4">
                  {/* Event Selection Card */}
                  <div className="space-y-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-base">📋</span> Event
                    </h3>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="autoCategory"
                          className="text-xs text-slate-500"
                        >
                          Category
                        </Label>
                        <Select
                          id="autoCategory"
                          name="category"
                          value={autoGenState.category}
                          onChange={handleAutoGenFieldChange}
                          className="h-8 text-xs"
                        >
                          <option value="">Select category</option>
                          {allowedCategories.map((category) => {
                            const id = toDocumentId(category);
                            const abbr =
                              category.abbreviation || category.code || "";
                            const fullName = category.titles?.en || "";
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
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="autoBoatClass"
                          className="text-xs text-slate-500"
                        >
                          Boat Class
                        </Label>
                        <Select
                          id="autoBoatClass"
                          name="boatClass"
                          value={autoGenState.boatClass}
                          onChange={handleAutoGenFieldChange}
                          className="h-8 text-xs"
                        >
                          <option value="">All boat classes</option>
                          {allowedBoatClasses.map((boatClass) => {
                            const id = toDocumentId(boatClass);
                            const code = boatClass.code || "";
                            const fullName = boatClass.names?.en || "";
                            const weight = boatClass.weightClass;
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
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoJourney"
                            className="text-xs text-slate-500"
                          >
                            Journey
                          </Label>
                          <Input
                            id="autoJourney"
                            name="journeyIndex"
                            type="number"
                            min="1"
                            value={
                              globalJourneyFilter || autoGenState.journeyIndex
                            }
                            onChange={handleAutoGenFieldChange}
                            className="h-8 text-xs"
                            disabled={Boolean(globalJourneyFilter)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoLaneCount"
                            className="text-xs text-slate-500"
                          >
                            Lanes/Race
                          </Label>
                          <Input
                            id="autoLaneCount"
                            name="lanesPerRace"
                            type="number"
                            min="1"
                            max={getMaxLanesForDiscipline(
                              competition?.discipline,
                            )}
                            value={autoGenState.lanesPerRace}
                            onChange={handleAutoGenFieldChange}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Race Settings Card */}
                  <div className="space-y-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span className="text-base">⚙️</span> Settings
                    </h3>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoStrategy"
                            className="text-xs text-slate-500"
                          >
                            Strategy
                          </Label>
                          <Select
                            id="autoStrategy"
                            name="strategy"
                            value={autoGenState.strategy}
                            onChange={handleAutoGenFieldChange}
                            className="h-8 text-xs"
                          >
                            <option value="random">Random</option>
                            <option value="seeded">Seeded</option>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoPrefix"
                            className="text-xs text-slate-500"
                          >
                            Race Prefix
                          </Label>
                          <Input
                            id="autoPrefix"
                            name="racePrefix"
                            value={autoGenState.racePrefix}
                            onChange={handleAutoGenFieldChange}
                            placeholder="Heat"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="autoSession"
                          className="text-xs text-slate-500"
                        >
                          Session Label
                        </Label>
                        <Input
                          id="autoSession"
                          name="sessionLabel"
                          value={autoGenState.sessionLabel}
                          onChange={handleAutoGenFieldChange}
                          placeholder="Morning programme"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="autoDistance"
                          className="text-xs text-slate-500"
                        >
                          Distance (m)
                        </Label>
                        <Input
                          id="autoDistance"
                          name="distance"
                          type="number"
                          min="0"
                          step="100"
                          value={autoGenState.distance}
                          onChange={handleAutoGenFieldChange}
                          placeholder="Default"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Timing Card */}
                  <div className="space-y-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <Icons.Clock /> Schedule
                    </h3>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="autoStartTime"
                          className="text-xs text-slate-500"
                        >
                          Start Time
                        </Label>
                        <Input
                          id="autoStartTime"
                          name="startTime"
                          type="datetime-local"
                          value={autoGenState.startTime}
                          onChange={handleAutoGenFieldChange}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoInterval"
                            className="text-xs text-slate-500"
                          >
                            Interval (min)
                          </Label>
                          <Input
                            id="autoInterval"
                            name="intervalMinutes"
                            type="number"
                            min="0"
                            value={autoGenState.intervalMinutes}
                            onChange={handleAutoGenFieldChange}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor="autoStartNumber"
                            className="text-xs text-slate-500"
                          >
                            Start Race #
                          </Label>
                          <Input
                            id="autoStartNumber"
                            name="startRaceNumber"
                            type="number"
                            min="1"
                            value={autoGenState.startRaceNumber}
                            onChange={handleAutoGenFieldChange}
                            placeholder="Auto"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      {/* Overwrite toggle */}
                      <label className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:border-slate-300 transition-colors">
                        <input
                          id="autoOverwrite"
                          name="overwriteExisting"
                          type="checkbox"
                          checked={autoGenState.overwriteExisting}
                          onChange={handleAutoGenFieldChange}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">
                          Overwrite existing races
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Advanced Options (Collapsible) */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => toggleSection("advanced")}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
                  >
                    <span
                      className={`transition-transform duration-200 ${expandedSections.advanced ? "rotate-90" : ""}`}
                    >
                      <Icons.ChevronRight />
                    </span>
                    Advanced Options
                  </button>

                  {expandedSections.advanced && (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in duration-200">
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                        <input
                          name="allowJuniorsInSenior"
                          type="checkbox"
                          checked={autoGenState.allowJuniorsInSenior || false}
                          onChange={handleAutoGenFieldChange}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">
                          Allow juniors in senior
                        </span>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-blue-300 transition-colors">
                        <input
                          name="allowMastersInSenior"
                          type="checkbox"
                          checked={autoGenState.allowMastersInSenior || false}
                          onChange={handleAutoGenFieldChange}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-slate-700">
                          Allow masters in senior
                        </span>
                      </label>
                      {(user?.role === "admin" ||
                        user?.role === "jury_president") && (
                        <>
                          <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer hover:border-blue-400 transition-colors">
                            <input
                              name="allowMultipleEntries"
                              type="checkbox"
                              checked={autoGenState.allowMultipleEntries}
                              onChange={handleAutoGenFieldChange}
                              className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-blue-700">
                              Multiple entries/athlete
                            </span>
                          </label>
                          <label className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer hover:border-amber-400 transition-colors">
                            <input
                              name="bypassAgeVerification"
                              type="checkbox"
                              checked={
                                autoGenState.bypassAgeVerification || false
                              }
                              onChange={handleAutoGenFieldChange}
                              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-amber-700">
                              Bypass age check
                            </span>
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Start List Section */}
                <div className="space-y-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <Icons.Users />
                        Start List
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                          {relevantEntries.length} entries
                        </span>
                        {withdrawnRaceLaneIndicators.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                            {withdrawnRaceLaneIndicators.length} withdrawn
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Add competitors by name or license number
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder="🔍 Search athletes..."
                        value={entrySearchTerm}
                        onChange={(event) =>
                          setEntrySearchTerm(event.target.value)
                        }
                        className="w-56 h-8 text-xs"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSortBySeed}
                        disabled={entries.length < 2}
                        title="Sort entries by seed number"
                      >
                        📊 Sort
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearEntries}
                        disabled={!entries.length}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        Clear
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

                  {withdrawnRaceLaneIndicators.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                      <p className="text-xs font-semibold text-rose-700">
                        Withdrawn participants already present in generated race
                        lanes
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-rose-700">
                        {withdrawnRaceLaneIndicators
                          .slice(0, 6)
                          .map((participant) => (
                            <div
                              key={participant.key}
                              className="inline-flex items-center gap-2"
                            >
                              <span>
                                {participant.athleteName}
                                {participant.clubCode
                                  ? ` (${participant.clubCode})`
                                  : ""}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                                onClick={() =>
                                  handleRestoreWithdrawnLane(participant)
                                }
                                disabled={
                                  restoringWithdrawnKey ===
                                  (participant.entryId || participant.key)
                                }
                              >
                                {restoringWithdrawnKey ===
                                (participant.entryId || participant.key)
                                  ? "Restoring..."
                                  : "Undo WD"}
                              </Button>
                            </div>
                          ))}
                        {withdrawnRaceLaneIndicators.length > 6 && (
                          <span>
                            +{withdrawnRaceLaneIndicators.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <EntriesTable
                    entries={relevantEntries}
                    onEntryChange={handleEntryFieldChange}
                    onRemove={handleRemoveEntry}
                    onWithdraw={handleWithdrawEntry}
                    onUnwithdraw={handleUnwithdrawEntry}
                    onDelete={handleDeleteEntry}
                    isAdmin={
                      user?.role === "admin" || user?.role === "jury_president"
                    }
                    showCrewNumber={requiredCrewSize > 1}
                  />
                </div>

                {/* Heat Distribution Preview (Collapsible) */}
                {relevantEntries.length > 0 && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => toggleSection("preview")}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
                    >
                      <span
                        className={`transition-transform duration-200 ${expandedSections.preview ? "rotate-90" : ""}`}
                      >
                        <Icons.ChevronRight />
                      </span>
                      Heat Distribution Preview
                    </button>

                    {expandedSections.preview && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm animate-in fade-in duration-200">
                        <HeatDistributionPreview
                          entries={relevantEntries}
                          lanesPerRace={autoGenState.lanesPerRace}
                          strategy={autoGenState.strategy}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
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
                    disabled={
                      submittingAutoGen ||
                      relevantEntries.length === 0 ||
                      !autoGenState.category
                    }
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg px-6"
                  >
                    <Icons.Sparkles />
                    {submittingAutoGen ? "Generating..." : "Generate Races"}
                  </Button>
                </div>

                {canManageRaceSchedule && (
                  <>
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                      <h3 className="text-xs font-semibold text-slate-900">
                        Official results workflow
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        Step 1: group races. Step 2: review provisional. Step 3:
                        publish locked official results.
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">
                          Groups: {officialWorkflowStats.total}
                        </span>
                        <span className="rounded bg-amber-100 px-2 py-1 text-amber-800">
                          Ready: {officialWorkflowStats.ready}
                        </span>
                        <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-800">
                          Published: {officialWorkflowStats.published}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="officialGroupSelect">
                            Event group
                          </Label>
                          <Select
                            id="officialGroupSelect"
                            value={selectedOfficialGroupId}
                            onChange={(event) =>
                              setSelectedOfficialGroupId(
                                normalizeStringId(event.target.value),
                              )
                            }
                            disabled={loadingOfficialResultGroups}
                          >
                            <option value="">Select event group</option>
                            {officialResultGroups.map((group) => (
                              <option
                                key={group.eventGroupId}
                                value={group.eventGroupId}
                              >
                                {group.eventLabel || group.eventGroupId} (
                                {group.completedRaceCount}/{group.raceCount}{" "}
                                done)
                                {group.published ? " - published" : ""}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={autoAssignOfficialGroups}
                            disabled={autoGroupingOfficialResults}
                          >
                            {autoGroupingOfficialResults
                              ? "Auto-grouping..."
                              : "Auto-group races"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={loadOfficialResultGroups}
                            disabled={loadingOfficialResultGroups}
                          >
                            {loadingOfficialResultGroups
                              ? "Refreshing..."
                              : "Refresh groups"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={loadOfficialPreview}
                            disabled={
                              !selectedOfficialGroupId || loadingOfficialPreview
                            }
                            className="md:col-span-2"
                          >
                            {loadingOfficialPreview
                              ? "Loading..."
                              : "Load preview"}
                          </Button>
                        </div>
                      </div>

                      {selectedOfficialGroup && (
                        <div className="mt-2 text-[11px] text-slate-700">
                          {selectedOfficialGroup.canPublish ? (
                            <span className="font-medium text-emerald-700">
                              Ready to publish: all races in this group are
                              completed.
                            </span>
                          ) : (
                            <span className="font-medium text-amber-700">
                              Not ready: complete all races in this group first
                              ({selectedOfficialGroup.completedRaceCount}/
                              {selectedOfficialGroup.raceCount}).
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                        <Button
                          type="button"
                          onClick={publishOfficialResult}
                          disabled={
                            !selectedOfficialGroupId ||
                            !selectedOfficialGroup?.canPublish ||
                            publishingOfficialResult ||
                            loadingOfficialPreview
                          }
                        >
                          {publishingOfficialResult
                            ? "Publishing..."
                            : "Publish official"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={publishAllReadyOfficial}
                          disabled={
                            publishingAllOfficialResults ||
                            officialWorkflowStats.ready === 0
                          }
                        >
                          {publishingAllOfficialResults
                            ? "Publishing all..."
                            : "Publish all ready"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={unpublishOfficialResult}
                          disabled={
                            !selectedOfficialGroupId ||
                            !publishedOfficialResult ||
                            unpublishingOfficialResult
                          }
                        >
                          {unpublishingOfficialResult
                            ? "Unpublishing..."
                            : "Unpublish"}
                        </Button>
                        {publishedOfficialResult ? (
                          <span className="text-xs text-emerald-700 font-medium md:justify-self-end">
                            Published revision{" "}
                            {publishedOfficialResult.revision}
                          </span>
                        ) : (
                          <span className="hidden md:block" />
                        )}
                      </div>

                      {provisionalOfficialResult?.entries?.length > 0 && (
                        <div className="mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setShowOfficialPreviewTable(
                                (previous) => !previous,
                              )
                            }
                          >
                            {showOfficialPreviewTable
                              ? "Hide provisional table"
                              : "Show provisional table"}
                          </Button>
                        </div>
                      )}

                      {provisionalOfficialResult?.entries?.length > 0 &&
                        showOfficialPreviewTable && (
                          <div className="mt-3 overflow-x-auto rounded border border-emerald-100 bg-white">
                            <table className="min-w-full text-xs">
                              <thead className="bg-emerald-50 text-slate-700">
                                <tr>
                                  <th className="px-2 py-2 text-left">Rank</th>
                                  <th className="px-2 py-2 text-left">
                                    Athlete
                                  </th>
                                  <th className="px-2 py-2 text-left">Club</th>
                                  <th className="px-2 py-2 text-left">Time</th>
                                  <th className="px-2 py-2 text-left">
                                    Status
                                  </th>
                                  <th className="px-2 py-2 text-left">
                                    Points
                                  </th>
                                  <th className="px-2 py-2 text-left">
                                    Source race
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {provisionalOfficialResult.entries.map(
                                  (entry, index) => {
                                    const athleteName =
                                      entry.athleteName ||
                                      `${entry.athlete?.firstName || ""} ${
                                        entry.athlete?.lastName || ""
                                      }`.trim() ||
                                      "-";
                                    const clubName =
                                      entry.clubName ||
                                      entry.club?.name ||
                                      entry.club?.code ||
                                      "-";

                                    return (
                                      <tr
                                        key={
                                          normalizeStringId(entry.athleteId) ||
                                          toDocumentId(entry.athlete) ||
                                          `entry-${index}`
                                        }
                                        className="border-t border-slate-100"
                                      >
                                        <td className="px-2 py-1.5 font-medium">
                                          {entry.rank || "-"}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {athleteName}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {clubName}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {Number.isFinite(entry.elapsedMs)
                                            ? formatElapsedTime(entry.elapsedMs)
                                            : "-"}
                                        </td>
                                        <td className="px-2 py-1.5 uppercase">
                                          {entry.status || "ok"}
                                        </td>
                                        <td className="px-2 py-1.5 font-semibold">
                                          {entry.points || 0}
                                        </td>
                                        <td className="px-2 py-1.5 text-slate-500">
                                          {entry.sourceRaceName || "-"}
                                        </td>
                                      </tr>
                                    );
                                  },
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>

                    <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/40 p-3">
                      <h3 className="text-xs font-semibold text-slate-900">
                        Penalties workflow
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        Create category penalties for clubs or officials. Only
                        club and penalty points are mandatory.
                      </p>

                      <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="penaltyClub">Club *</Label>
                          <Select
                            id="penaltyClub"
                            value={penaltyForm.club}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "club",
                                event.target.value,
                              )
                            }
                            disabled={loadingPenaltyClubOptions}
                          >
                            <option value="">Select club</option>
                            {penaltyClubOptions.map((club, clubIndex) => {
                              const clubId = toDocumentId(club);
                              if (!clubId) {
                                return null;
                              }

                              return (
                                <option
                                  key={clubId || `club-${clubIndex}`}
                                  value={clubId}
                                >
                                  {club.code ? `${club.code} - ` : ""}
                                  {club.name || club.nameAr || "Unnamed club"}
                                </option>
                              );
                            })}
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyCategory">Category</Label>
                          <Select
                            id="penaltyCategory"
                            value={penaltyForm.category}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "category",
                                event.target.value,
                              )
                            }
                          >
                            <option value="">Select category (optional)</option>
                            {allowedCategories.map((category) => {
                              const catId = toDocumentId(category);
                              const catLabel =
                                category?.titles?.en ||
                                category?.abbreviation ||
                                "Unnamed category";
                              return (
                                <option key={catId} value={catId}>
                                  {catLabel}
                                </option>
                              );
                            })}
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyJourney">Journey</Label>
                          <Select
                            id="penaltyJourney"
                            value={penaltyForm.journeyIndex || ""}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "journeyIndex",
                                event.target.value,
                              )
                            }
                          >
                            <option value="">All journeys</option>
                            {journeyOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyPoints">
                            Penalty points *
                          </Label>
                          <Input
                            id="penaltyPoints"
                            type="number"
                            min="0"
                            step="0.01"
                            value={penaltyForm.penaltyPoints}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "penaltyPoints",
                                event.target.value,
                              )
                            }
                            placeholder="ex: 5"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyTargetType">Penalty to</Label>
                          <Select
                            id="penaltyTargetType"
                            value={penaltyForm.targetType}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "targetType",
                                event.target.value,
                              )
                            }
                          >
                            <option value="club">Club</option>
                            <option value="official">Official of club</option>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyFirstName">First name</Label>
                          <Input
                            id="penaltyFirstName"
                            value={penaltyForm.firstName}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "firstName",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyLastName">Last name</Label>
                          <Input
                            id="penaltyLastName"
                            value={penaltyForm.lastName}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "lastName",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyLicenseNumber">
                            License number
                          </Label>
                          <Input
                            id="penaltyLicenseNumber"
                            value={penaltyForm.licenseNumber}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "licenseNumber",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="penaltyRole">Role</Label>
                          <Input
                            id="penaltyRole"
                            value={penaltyForm.role}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "role",
                                event.target.value,
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                          <Label htmlFor="penaltyObservations">
                            Observations
                          </Label>
                          <Input
                            id="penaltyObservations"
                            value={penaltyForm.observations}
                            onChange={(event) =>
                              handlePenaltyFieldChange(
                                "observations",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={submitCompetitionPenalty}
                          disabled={savingCompetitionPenalty}
                        >
                          {savingCompetitionPenalty
                            ? "Saving..."
                            : editingPenaltyId
                              ? "Update penalty"
                              : "Save penalty"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={loadCompetitionPenalties}
                          disabled={loadingCompetitionPenalties}
                        >
                          {loadingCompetitionPenalties
                            ? "Refreshing..."
                            : "Refresh penalties"}
                        </Button>
                        {editingPenaltyId && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={resetPenaltyForm}
                          >
                            Cancel edit
                          </Button>
                        )}
                      </div>

                      <div className="mt-3 overflow-x-auto rounded border border-rose-100 bg-white">
                        <table className="min-w-full text-xs">
                          <thead className="bg-rose-50 text-slate-700">
                            <tr>
                              <th className="px-2 py-2 text-left">Club</th>
                              <th className="px-2 py-2 text-left">Category</th>
                              <th className="px-2 py-2 text-left">Journey</th>
                              <th className="px-2 py-2 text-left">Penalty</th>
                              <th className="px-2 py-2 text-left">To</th>
                              <th className="px-2 py-2 text-left">Person</th>
                              <th className="px-2 py-2 text-left">License</th>
                              <th className="px-2 py-2 text-left">Role</th>
                              <th className="px-2 py-2 text-left">Obs</th>
                              <th className="px-2 py-2 text-left">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {competitionPenalties.map(
                              (penalty, penaltyIndex) => {
                                const penaltyId = toDocumentId(penalty);
                                const clubLabel = penalty?.club
                                  ? `${penalty.club.code ? `${penalty.club.code} - ` : ""}${penalty.club.name || penalty.club.nameAr || "-"}`
                                  : "-";
                                const categoryLabel =
                                  penalty?.category?.titles?.en ||
                                  penalty?.category?.abbreviation ||
                                  "-";
                                const journeyLabel =
                                  journeyOptions.find(
                                    (option) =>
                                      option.value ===
                                      String(penalty?.journeyIndex || ""),
                                  )?.label ||
                                  (penalty?.journeyIndex
                                    ? `Journey ${penalty.journeyIndex}`
                                    : "All journeys");
                                const personName =
                                  `${penalty?.firstName || ""} ${penalty?.lastName || ""}`.trim();

                                return (
                                  <tr
                                    key={penaltyId || `penalty-${penaltyIndex}`}
                                    className="border-t border-slate-100"
                                  >
                                    <td className="px-2 py-1.5">{clubLabel}</td>
                                    <td className="px-2 py-1.5">
                                      {categoryLabel}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {journeyLabel}
                                    </td>
                                    <td className="px-2 py-1.5 font-semibold text-rose-700">
                                      -{Number(penalty.penaltyPoints || 0)}
                                    </td>
                                    <td className="px-2 py-1.5 capitalize">
                                      {penalty.targetType || "club"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {personName || "-"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {penalty.licenseNumber || "-"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      {penalty.role || "-"}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-500">
                                      {penalty.observations || "-"}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            penaltyId &&
                                            startEditPenalty(penalty)
                                          }
                                          disabled={!penaltyId}
                                        >
                                          Edit
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            penaltyId &&
                                            deleteCompetitionPenalty(penaltyId)
                                          }
                                          disabled={
                                            !penaltyId ||
                                            deletingPenaltyId === penaltyId
                                          }
                                        >
                                          {deletingPenaltyId === penaltyId
                                            ? "Deleting..."
                                            : "Delete"}
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              },
                            )}
                            {competitionPenalties.length === 0 && (
                              <tr>
                                <td
                                  className="px-2 py-4 text-center text-slate-500"
                                  colSpan={10}
                                >
                                  {loadingCompetitionPenalties
                                    ? "Loading penalties..."
                                    : "No penalties saved yet."}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            {/* RIGHT COLUMN: Existing Races */}
            <section
              id="existing-races-section"
              className="space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm xl:sticky xl:top-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Icons.Trophy />
                  Races
                  <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    {sortedRaces.length}
                  </span>
                </h2>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={exportStartListPDF}
                    disabled={!sortedRaces.length}
                    title="Export Start List PDF"
                  >
                    📄 Start List
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={exportJuryStartListPDF}
                    disabled={!sortedRaces.length}
                    title="Export Jury Start List PDF"
                  >
                    ✍️ Jury Start List
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => exportAllResultsPDF()}
                    disabled={!sortedRaces.length}
                    title="Export Results PDF"
                  >
                    📊 Results
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={loadRaces}
                    title="Refresh"
                  >
                    🔄
                  </Button>
                </div>
              </div>

              {/* Race Cards List */}
              {loadingRaces ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="ml-2 text-sm text-slate-500">
                    Loading races...
                  </span>
                </div>
              ) : sortedRaces.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  <span className="text-2xl block mb-2">🏁</span>
                  No races scheduled yet
                </div>
              ) : (
                <div
                  className="space-y-2 max-h-[600px] overflow-y-auto pr-1"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {sortedRaces.map((race, index) => {
                    const categoryId = toDocumentId(race.category);
                    const boatClassId = toDocumentId(race.boatClass);
                    const category = categoryId
                      ? categories.find(
                          (item) => toDocumentId(item) === categoryId,
                        )
                      : null;
                    const boatClass = boatClassId
                      ? boatClasses.find(
                          (item) => toDocumentId(item) === boatClassId,
                        )
                      : null;
                    const eventCode = generateRaceCode(category, boatClass);
                    const totalBoats = (race.lanes || []).length;
                    const statusMap = {
                      completed: {
                        bg: "bg-emerald-100",
                        text: "text-emerald-700",
                        label: "✓",
                      },
                      in_progress: {
                        bg: "bg-amber-100",
                        text: "text-amber-700",
                        label: "▶",
                      },
                      scheduled: {
                        bg: "bg-slate-100",
                        text: "text-slate-500",
                        label: "○",
                      },
                    };
                    const st = statusMap[race.status] || statusMap.scheduled;
                    const schedTime = race.startTime
                      ? new Date(race.startTime).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;

                    const raceId = toDocumentId(race);

                    return (
                      <div
                        key={raceId || `race-card-${index}`}
                        className="group flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-200 transition-all duration-150 cursor-pointer"
                        onClick={() => {
                          if (!raceId) {
                            toast.error("Invalid race id");
                            return;
                          }
                          navigate(
                            `/competitions/${competitionId}/races/${raceId}`,
                          );
                        }}
                      >
                        {/* Race # */}
                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {race.order || "-"}
                        </div>

                        {/* Event Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {eventCode}
                            </span>
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded-full ${st.bg} ${st.text} flex items-center justify-center text-[10px] font-bold`}
                            >
                              {st.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-500 truncate">
                              {race.name || "-"}
                            </span>
                            {schedTime && (
                              <span className="flex-shrink-0 text-[10px] text-slate-400">
                                ⏱ {schedTime}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Category Name (English) - Centered in empty space */}
                        <div className="hidden sm:block flex-1 text-center px-2">
                          <span className="text-[11px] font-medium text-slate-500 truncate block">
                            {category?.titles?.en || category?.name || "-"}
                          </span>
                        </div>

                        {/* Boats count */}
                        <div className="flex-shrink-0 text-center">
                          <span className="text-xs font-semibold text-slate-600">
                            {totalBoats}
                          </span>
                          <span className="text-[10px] text-slate-400 block leading-none">
                            boats
                          </span>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-all text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!raceId) {
                              toast.error("Invalid race id");
                              return;
                            }
                            handleDeleteRace(raceId);
                          }}
                          title="Delete race"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                {canManageRaceSchedule && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h3 className="text-xs font-semibold text-slate-900">
                      Quick schedule edit
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Update event number and start time without regenerating
                      races.
                    </p>

                    <div className="mt-3 grid gap-3 grid-cols-1">
                      <div className="space-y-2">
                        <Label htmlFor="scheduleRace">Race</Label>
                        <Select
                          id="scheduleRace"
                          value={scheduleState.raceId}
                          onChange={handleScheduleRaceChange}
                        >
                          <option value="">Select race</option>
                          {sortedRaces.map((race, raceIndex) => {
                            const raceId = toDocumentId(race);
                            if (!raceId) {
                              return null;
                            }

                            return (
                              <option
                                key={raceId || `schedule-race-${raceIndex}`}
                                value={raceId}
                              >
                                {race.name || `Race ${race.order}`}
                              </option>
                            );
                          })}
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="scheduleOrder">Event #</Label>
                          <Input
                            id="scheduleOrder"
                            name="order"
                            type="number"
                            min="1"
                            value={scheduleState.order}
                            onChange={handleScheduleFieldChange}
                            disabled={!scheduleState.raceId}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scheduleStartTime">Start time</Label>
                          <Input
                            id="scheduleStartTime"
                            name="startTime"
                            type="datetime-local"
                            value={scheduleState.startTime}
                            onChange={handleScheduleFieldChange}
                            disabled={!scheduleState.raceId}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="scheduleDistance">Distance (m)</Label>
                          <Input
                            id="scheduleDistance"
                            name="distance"
                            type="number"
                            min="0"
                            placeholder="ex: 2000"
                            value={scheduleState.distance}
                            onChange={handleScheduleFieldChange}
                            disabled={!scheduleState.raceId}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="scheduleEventGroupId">
                          Event group ID
                        </Label>
                        <Input
                          id="scheduleEventGroupId"
                          name="eventGroupId"
                          value={scheduleState.eventGroupId}
                          onChange={handleScheduleFieldChange}
                          disabled={!scheduleState.raceId}
                          placeholder="ex: M36-43_1x_final"
                        />
                        <p className="text-[11px] text-slate-500">
                          Use the same group ID for split races that should
                          produce one official result.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={submitRaceScheduleUpdate}
                        disabled={savingSchedule || !scheduleState.raceId}
                      >
                        {savingSchedule ? "Saving..." : "Save schedule"}
                      </Button>
                    </div>
                  </div>
                )}

                <h3 className="text-xs font-semibold text-slate-900">
                  Quick lane swap
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Move an athlete between lanes or races without regenerating
                  the draw.
                </p>

                <div className="mt-3 grid gap-3 grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="swapSourceRace">Source race</Label>
                    <Select
                      id="swapSourceRace"
                      name="sourceRaceId"
                      value={swapState.sourceRaceId}
                      onChange={handleSwapFieldChange}
                    >
                      <option value="">Select race</option>
                      {sortedRaces.map((race, raceIndex) => {
                        const raceId = toDocumentId(race);
                        if (!raceId) {
                          return null;
                        }

                        return (
                          <option
                            key={raceId || `source-race-${raceIndex}`}
                            value={raceId}
                          >
                            {race.name || `Race ${race.order}`}
                          </option>
                        );
                      })}
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
                          (r) => toDocumentId(r) === swapState.sourceRaceId,
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
                      {sortedRaces.map((race, raceIndex) => {
                        const raceId = toDocumentId(race);
                        if (!raceId) {
                          return null;
                        }

                        return (
                          <option
                            key={raceId || `target-race-${raceIndex}`}
                            value={raceId}
                          >
                            {race.name || `Race ${race.order}`}
                          </option>
                        );
                      })}
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
                          (r) => toDocumentId(r) === swapState.targetRaceId,
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
