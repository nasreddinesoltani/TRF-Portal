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
            <th className="px-3 py-3 w-40">Crew #</th>
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
                        {!isWithdrawn && onWithdraw && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onWithdraw(entry.id)}
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-7 px-2 text-xs"
                          >
                            Withdraw
                          </Button>
                        )}
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
  const skipAutoFillAfterGenerateRef = useRef(false);

  const [entrySearchTerm, setEntrySearchTerm] = useState("");
  const [entrySearchResults, setEntrySearchResults] = useState([]);
  const [entrySearchLoading, setEntrySearchLoading] = useState(false);
  const [entrySearchError, setEntrySearchError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [dbEntryOverrides, setDbEntryOverrides] = useState({}); // Stores local edits for DB entries (keyed by entry ID)

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
        : r.category?._id === categoryId,
    );

    // If a boat class is selected, filter further by that boat class
    if (autoGenState.boatClass) {
      const bcFilter = relevantRaces.filter((r) =>
        typeof r.boatClass === "string"
          ? r.boatClass === autoGenState.boatClass
          : r.boatClass?._id === autoGenState.boatClass,
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
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [pendingManualCrew, setPendingManualCrew] = useState([]);

  const canManageRaceSchedule =
    user?.role === "admin" || user?.role === "jury_president";

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

    // Special handling for category change to trigger entry loading
    if (name === "category") {
      handleCategorySelect(value);
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
  }, []);

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

    const journeyIndex = Number(autoGenState.journeyIndex);
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
  }, [autoGenState]);

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
        setScheduleState({ raceId: "", order: "", startTime: "" });
        return;
      }
      const race = races.find((item) => item._id === raceId);
      setScheduleState({
        raceId,
        order: race?.order != null ? String(race.order) : "",
        startTime: formatDateTimeLocalValue(race?.startTime),
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
      // --- GROUP BY START TIME LOGIC ---
      const rawTargetRaces = Array.isArray(racesToExport)
        ? racesToExport
        : sortedRaces;
      const timeMap = new Map();
      rawTargetRaces.forEach((race) => {
        const timeKey = race.startTime
          ? new Date(race.startTime).getTime().toString()
          : `no-time-${race._id || Math.random()}`;
        if (!timeMap.has(timeKey)) {
          timeMap.set(timeKey, {
            ...race,
            lanes: [...(race.lanes || [])].map((l) => ({
              ...l,
              _originalRaceId: race._id,
            })),
          });
        } else {
          const existing = timeMap.get(timeKey);
          existing.lanes.push(
            ...(race.lanes || []).map((l) => ({
              ...l,
              _originalRaceId: race._id,
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

      toast.info("Generating Start List PDF...");

      try {
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });

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

        // Use event date instead of generation date
        const eventDateStr = competition?.startDate
          ? new Date(competition.startDate).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : dateStr;

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
              (race.lanes || []).map((l) => l._originalRaceId).filter(Boolean),
            ),
          );
          const allOrigRaces = distinctOrigIds.length
            ? distinctOrigIds
                .map((id) =>
                  (typeof rawTargetRaces !== "undefined"
                    ? rawTargetRaces
                    : rawRacesWithResults
                  ).find((r) => r._id === id),
                )
                .filter(Boolean)
            : [race];
          const origRaceLookup = new Map(
            allOrigRaces.filter((r) => r?._id).map((r) => [String(r._id), r]),
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
            const evtEn = `${c?.titles?.en || ""}`.trim();
            const evtAr = `${c?.titles?.ar || ""}`.trim();
            if (evtEn) distinctEnTitles.add(evtEn);
            if (evtAr) distinctArTitles.add(evtAr);
            if (c || b) distinctCodes.add(generateRaceCode(c, b));
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
          const explicitNonFinalPhases = Array.from(
            new Set(
              allOrigRaces
                .map((r) => String(r?.phase || "").trim())
                .filter((p) => p && !/^final$/i.test(p)),
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
          } else if (journeyValues.length > 0) {
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
            (rightHeaderCode || generateRaceCode(category, boatClass))
              .replace(
                /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
                "$1 $2",
              )
              .replace(/X/g, "x"),
            rightMargin,
            yPos,
            {
              align: "right",
            },
          );

          // --- Line 2: (Event) | Category + Boat Class | Phase ---
          yPos += 5;
          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          doc.text("(Event)", leftMargin, yPos);
          doc.setFontSize(11);
          doc.setFont(fontName, "bold");
          fullEventName =
            fullEventName || `${category?.titles?.en || ""}`.trim();
          doc.text(fullEventName, center, yPos, { align: "center" });
          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          doc.text(phaseStr, rightMargin, yPos, { align: "right" });

          // --- Line 3: Arabic text (center) | Distance (right) ---
          const raceDistance =
            race.distanceOverride ??
            race.distance ??
            allOrigRaces.find((r) => r?.distanceOverride != null)
              ?.distanceOverride ??
            competition?.defaultDistance ??
            competition?.distance ??
            null;
          const catTitleAr = category?.titles?.ar || "";
          fullEventNameAr = fullEventNameAr || `${catTitleAr}`.trim();

          if (fullEventNameAr && arabicFontName) {
            yPos += 6;
            doc.setFontSize(13);
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

          // --- Line 4: Start Time | Race # ---
          yPos += 4;
          doc.setFontSize(9);
          doc.setFont(fontName, "normal");
          const startTime = race.startTime
            ? new Date(race.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "00:00";
          doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
          doc.setFont(fontName, "bold");
          doc.text(`Race ${raceIndex + 1}`, rightMargin, yPos, {
            align: "right",
          });
          yPos += 4;

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
            doc.addImage(headerData, "PNG", 0, 3, pageWidth, h);
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
              "PNG",
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
            doc.setTextColor(100);
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
            doc.addImage(sponsorData, "PNG", x, pageHeight - h - 3, w, h);
            doc.setFontSize(8);
            doc.setFont(fontName, "normal");
            doc.setTextColor(100, 100, 100);
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
            doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - 8, {
              align: "right",
            });
          }
        }

        doc.save(`StartList_${competition?.code || "Competition"}.pdf`);
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

  const exportResultsPDF = useCallback(
    async (race) => {
      if (!race) return;

      toast.info("Generating Results PDF...");

      try {
        const dateStr = new Date().toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });

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

        // Use event date instead of generation date
        const eventDateStr = competition?.startDate
          ? new Date(competition.startDate).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : dateStr;

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
            (race.lanes || []).map((l) => l._originalRaceId).filter(Boolean),
          ),
        );
        const allOrigRaces = distinctOrigIds.length
          ? distinctOrigIds
              .map((id) =>
                (typeof rawTargetRaces !== "undefined"
                  ? rawTargetRaces
                  : rawRacesWithResults
                ).find((r) => r._id === id),
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
          const evtEn = `${c?.titles?.en || ""}`.trim();
          const evtAr = `${c?.titles?.ar || ""}`.trim();
          if (evtEn) distinctEnTitles.add(evtEn);
          if (evtAr) distinctArTitles.add(evtAr);
          if (c || b) distinctCodes.add(generateRaceCode(c, b));
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
        const explicitNonFinalPhases = Array.from(
          new Set(
            allOrigRaces
              .map((r) => String(r?.phase || "").trim())
              .filter((p) => p && !/^final$/i.test(p)),
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
        } else if (journeyValues.length > 0) {
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
          (rightHeaderCode || generateRaceCode(category, boatClass))
            .replace(
              /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
              "$1 $2",
            )
            .replace(/X/g, "x"),
          rightMargin,
          yPos,
          {
            align: "right",
          },
        );

        // --- Line 2: (Event) | Category + Boat Class | Phase ---
        yPos += 5;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text("(Event)", leftMargin, yPos);
        doc.setFontSize(11);
        doc.setFont(fontName, "bold");
        fullEventName = fullEventName || `${category?.titles?.en || ""}`.trim();
        doc.text(fullEventName, center, yPos, { align: "center" });
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(phaseStr, rightMargin, yPos, { align: "right" });

        // --- Line 3: Arabic text (center) | Distance (right) ---
        const raceDistance =
          race.distanceOverride ??
          race.distance ??
          allOrigRaces.find((r) => r?.distanceOverride != null)
            ?.distanceOverride ??
          competition?.defaultDistance ??
          competition?.distance ??
          null;
        const catTitleAr = category?.titles?.ar || "";
        fullEventNameAr = fullEventNameAr || `${catTitleAr}`.trim();

        if (fullEventNameAr && arabicFontName) {
          yPos += 6;
          doc.setFontSize(13);
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

        // --- Line 4: Start Time | Race # ---
        yPos += 4;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        const startTime = race.startTime
          ? new Date(race.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00";
        doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
        doc.setFont(fontName, "bold");
        doc.text(`Race ${race.order || "1"}`, rightMargin, yPos, {
          align: "right",
        });
        yPos += 4;

        // --- Calculate legend for bottom margin ---
        const uniqueClubs = Array.from(
          new Set(
            (race.lanes || []).map((l) => toDocumentId(l.club)).filter(Boolean),
          ),
        )
          .map(
            (id) =>
              (race.lanes || []).find((l) => toDocumentId(l.club) === id)?.club,
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
        const sortedLanes = [...(race?.lanes || [])].sort((a, b) => {
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
          (l) => l.result?.finishPosition === 1 && l.result?.elapsedMs,
        )?.result?.elapsedMs;

        // Build table data (matching RaceDetail)
        const deltaMap = new Map();
        const tableBody = sortedLanes.map((lane, rowIdx) => {
          const clubCode =
            lane.club?.code ||
            lane.club?.name?.slice(0, 3).toUpperCase() ||
            "-";

          let athleteName = "Unassigned";
          const athleteId = toDocumentId(lane.athlete);
          const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

          const pos = lane.result?.finishPosition || "-";
          const status = lane.result?.status || "ok";
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

          const oRace =
            rawRacesWithResults.find((r) => r._id === lane._originalRaceId) ||
            race;

          const lCatId =
            toDocumentId(oRace.category) || toDocumentId(lane?.category);

          const lBcId =
            toDocumentId(oRace.boatClass) || toDocumentId(lane?.boatClass);

          const lCat = categories.find((c) => toDocumentId(c) === lCatId);

          const lBc = boatClasses.find((c) => toDocumentId(c) === lBcId);

          const lEvent = generateRaceCode(lCat, lBc)
            .replace(
              /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
              "$1 $2",
            )
            .replace(/X/g, "x");

          return [
            pos,
            rowIdx + 1,
            clubCode,
            athleteName,
            timeStr,
            points,
            lEvent,
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [["Rank", "Lane", "Club", "Name", "Time", "Points", "Event"]],
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
            3: { fontStyle: "bold" },
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
            doc.addImage(headerData, "PNG", 0, 3, pageWidth, h);
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
              "PNG",
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
            doc.setTextColor(100);
            doc.text(
              `Page ${i} of ${pageCount}`,
              rightMargin,
              pageHeight - h - 8,
              { align: "right" },
            );
          }
        }

        const raceCode = generateRaceCode(category, boatClass);
        doc.save(
          `Results_${competition?.code || "Comp"}_${raceCode}_Race${race.order}.pdf`,
        );
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
    // Filter races that have results (completed or have times)
    const rawRacesWithResults = sortedRaces.filter((race) => {
      const hasResults = race.lanes?.some(
        (lane) =>
          lane.result?.finishPosition ||
          lane.result?.elapsedMs ||
          lane.result?.status === "ok",
      );
      return race.status === "completed" || hasResults;
    });
    // --- GROUP BY START TIME LOGIC ---
    const resultsTimeMap = new Map();
    rawRacesWithResults.forEach((race) => {
      const timeKey = race.startTime
        ? new Date(race.startTime).getTime().toString()
        : `no-time-${race._id || Math.random()}`;
      if (!resultsTimeMap.has(timeKey)) {
        resultsTimeMap.set(timeKey, {
          ...race,
          lanes: [...(race.lanes || [])].map((l) => ({
            ...l,
            _originalRaceId: race._id,
          })),
        });
      } else {
        const existing = resultsTimeMap.get(timeKey);
        existing.lanes.push(
          ...(race.lanes || []).map((l) => ({
            ...l,
            _originalRaceId: race._id,
          })),
        );
        if (race.order && (!existing.order || race.order < existing.order)) {
          existing.order = race.order;
        }
      }
    });
    const racesWithResults = Array.from(resultsTimeMap.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );

    if (racesWithResults.length === 0) {
      toast.info("No races with results to export");
      return;
    }

    toast.info(
      `Generating Results PDF for ${racesWithResults.length} race(s)...`,
    );

    try {
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

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
            (race.lanes || []).map((l) => l._originalRaceId).filter(Boolean),
          ),
        );
        const allOrigRaces = distinctOrigIds.length
          ? distinctOrigIds
              .map((id) =>
                (typeof rawTargetRaces !== "undefined"
                  ? rawTargetRaces
                  : rawRacesWithResults
                ).find((r) => r._id === id),
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
          const evtEn = `${c?.titles?.en || ""}`.trim();
          const evtAr = `${c?.titles?.ar || ""}`.trim();
          if (evtEn) distinctEnTitles.add(evtEn);
          if (evtAr) distinctArTitles.add(evtAr);
          if (c || b) distinctCodes.add(generateRaceCode(c, b));
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
        const explicitNonFinalPhases = Array.from(
          new Set(
            allOrigRaces
              .map((r) => String(r?.phase || "").trim())
              .filter((p) => p && !/^final$/i.test(p)),
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
        } else if (journeyValues.length > 0) {
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
          (rightHeaderCode || generateRaceCode(category, boatClass))
            .replace(
              /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
              "$1 $2",
            )
            .replace(/X/g, "x"),
          rightMargin,
          yPos,
          {
            align: "right",
          },
        );

        // --- Line 2: (Event) | Category + Boat Class | Phase ---
        yPos += 5;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text("(Event)", leftMargin, yPos);
        doc.setFontSize(11);
        doc.setFont(fontName, "bold");
        fullEventName = fullEventName || `${category?.titles?.en || ""}`.trim();
        doc.text(fullEventName, center, yPos, { align: "center" });
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        doc.text(phaseStr, rightMargin, yPos, { align: "right" });

        // --- Line 3: Arabic text (center) | Distance (right) ---
        const raceDistance =
          race.distanceOverride ??
          race.distance ??
          allOrigRaces.find((r) => r?.distanceOverride != null)
            ?.distanceOverride ??
          competition?.defaultDistance ??
          competition?.distance ??
          null;
        const catTitleAr = category?.titles?.ar || "";
        fullEventNameAr = fullEventNameAr || `${catTitleAr}`.trim();

        if (fullEventNameAr && arabicFontName) {
          yPos += 6;
          doc.setFontSize(13);
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

        // --- Line 4: Start Time | Race # ---
        yPos += 4;
        doc.setFontSize(9);
        doc.setFont(fontName, "normal");
        const startTime = race.startTime
          ? new Date(race.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "00:00";
        doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
        doc.setFont(fontName, "bold");
        doc.text(`Race ${race.order || "1"}`, rightMargin, yPos, {
          align: "right",
        });
        yPos += 4;

        // --- Calculate legend for bottom margin ---
        const uniqueClubs = Array.from(
          new Set(
            (race.lanes || []).map((l) => toDocumentId(l.club)).filter(Boolean),
          ),
        )
          .map(
            (id) =>
              (race.lanes || []).find((l) => toDocumentId(l.club) === id)?.club,
          )
          .filter(Boolean)
          .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        const legendLineHeight = 4;
        const legendBoxHeight =
          uniqueClubs.length > 0
            ? uniqueClubs.length * legendLineHeight + 7
            : 0;
        const bottomMargin = 35 + legendBoxHeight + 14;

        // Sort lanes by result (matching RaceDetail)
        const sortedLanes = [...(race?.lanes || [])].sort((a, b) => {
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

        // Find winning time for delta calculation
        const winningTime = sortedLanes.find(
          (l) => l.result?.finishPosition === 1 && l.result?.elapsedMs,
        )?.result?.elapsedMs;

        // Build table data (matching RaceDetail)
        const deltaMap = new Map();
        const tableBody = sortedLanes.map((lane, rowIdx) => {
          const clubCode =
            lane.club?.code ||
            lane.club?.name?.slice(0, 3).toUpperCase() ||
            "-";

          let athleteName = "Unassigned";
          const athleteId = toDocumentId(lane.athlete);
          const athlete = athleteId ? raceAthleteLookup.get(athleteId) : null;

          const pos = lane.result?.finishPosition || "-";
          const status = lane.result?.status || "ok";
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

          const oRace =
            rawRacesWithResults.find((r) => r._id === lane._originalRaceId) ||
            race;

          const lCatId =
            toDocumentId(oRace.category) || toDocumentId(lane?.category);

          const lBcId =
            toDocumentId(oRace.boatClass) || toDocumentId(lane?.boatClass);

          const lCat = categories.find((c) => toDocumentId(c) === lCatId);

          const lBc = boatClasses.find((c) => toDocumentId(c) === lBcId);

          const lEvent = generateRaceCode(lCat, lBc)
            .replace(
              /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
              "$1 $2",
            )
            .replace(/X/g, "x");

          return [
            pos,
            rowIdx + 1,
            clubCode,
            athleteName,
            timeStr,
            points,
            lEvent,
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [["Rank", "Lane", "Club", "Name", "Time", "Points", "Event"]],
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
            3: { fontStyle: "bold" },
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
          doc.addImage(headerData, "PNG", 0, 3, pageWidth, h);
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
          doc.addImage(footerData, "PNG", 0, pageHeight - h - 3, pageWidth, h);
          doc.setDrawColor(128, 0, 0);
          doc.setLineWidth(0.8);
          doc.line(
            leftMargin,
            pageHeight - h - 5,
            rightMargin,
            pageHeight - h - 5,
          );
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(
            `Page ${i} of ${pageCount}`,
            rightMargin,
            pageHeight - h - 8,
            { align: "right" },
          );
        }
      }

      doc.save(`Results_${competition?.code || "Competition"}_All.pdf`);
      toast.success(`Exported results for ${racesWithResults.length} race(s)`);
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

  const handleCategorySelect = (categoryId, statsOverride = null) => {
    setAutoGenState((prev) => ({ ...prev, category: categoryId }));

    // Always clear previous entries when switching categories
    setEntries([]);

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
          <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Categories Overview
              </h2>
              <span className="text-xs text-slate-400">
                Click to load entries
              </span>
            </div>
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
                            value={autoGenState.journeyIndex}
                            onChange={handleAutoGenFieldChange}
                            className="h-8 text-xs"
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
                  {sortedRaces.map((race) => {
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

                    return (
                      <div
                        key={race._id}
                        className="group flex items-center gap-2 p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-200 transition-all duration-150 cursor-pointer"
                        onClick={() =>
                          navigate(
                            `/competitions/${competitionId}/races/${race._id}`,
                          )
                        }
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
                            handleDeleteRace(race._id);
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
                          {sortedRaces.map((race) => (
                            <option key={race._id} value={race._id}>
                              {race.name || `Race ${race.order}`}
                            </option>
                          ))}
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
