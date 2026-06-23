import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  ArrowLeft,
  Trophy,
  Clock,
  MapPin,
  Calendar,
  FileText,
  Printer,
  Save,
  Edit3,
  X,
  User,
  Shield,
  Hash,
  ChevronRight,
  FlaskConical,
} from "lucide-react";
import { generateRaceCode } from "../lib/rowing";
import {
  buildStartListTableBody,
  sortStartListLanes,
} from "../lib/startListPdf";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE_URL = "";

// Helper to load image as base64
const loadImage = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
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
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    return null;
  }
};

// --- Helpers (extracted from CompetitionRaces) ---

const toDocumentId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const candidate = value._id || value.id;
    if (!candidate) return null;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "number") return String(candidate);
    if (typeof candidate?.$oid === "string") return candidate.$oid;
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
        return typeof converted === "string" ? converted : null;
      } catch {
        return null;
      }
    }
  }
  return null;
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

const getCategoryDisplayName = (category) => {
  if (!category) return "Category";
  return (
    category?.titles?.en ||
    category?.titles?.fr ||
    category?.titles?.ar ||
    category?.name ||
    category?.abbreviation ||
    category?.code ||
    "Category"
  );
};

const getBoatClassDisplayName = (boatClass) => {
  if (!boatClass) return "Boat class";
  return (
    boatClass?.names?.en ||
    boatClass?.names?.fr ||
    boatClass?.names?.ar ||
    boatClass?.name ||
    boatClass?.code ||
    "Boat class"
  );
};

const getClubDisplayName = (club) => {
  if (!club) return "Club";
  return (
    club?.name ||
    club?.names?.en ||
    club?.names?.fr ||
    club?.nameAr ||
    club?.code ||
    "Club"
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
        .map((currentRace) => Number(currentRace?.journeyIndex))
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
        .map((currentRace) => {
          if (!currentRace?.startTime) return null;
          const d = new Date(currentRace.startTime);
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

const formatAthleteName = (athlete) => {
  if (!athlete) return "Unknown athlete";
  // Try English name first
  const parts = [athlete.firstName, athlete.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  // Fallback to Arabic name
  const arabicParts = [athlete.firstNameAr, athlete.lastNameAr].filter(Boolean);
  if (arabicParts.length) return arabicParts.join(" ");
  // Last fallback to license number
  return athlete.licenseNumber || "Unknown athlete";
};

const formatCrewName = (crew) => {
  if (!Array.isArray(crew) || crew.length === 0) return null;
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

const formatElapsedTime = (ms) => {
  if (ms === undefined || ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${centis.toString().padStart(2, "0")}`;
};

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

const parseTimeToMs = (timeStr) => {
  if (!timeStr || timeStr === "-") return undefined;
  const trimmed = timeStr.trim();
  if (!trimmed) return undefined;
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})\.(\d{1,2})$/);
  if (colonMatch) {
    const minutes = parseInt(colonMatch[1], 10);
    const seconds = parseInt(colonMatch[2], 10);
    const centis = parseInt(colonMatch[3].padEnd(2, "0"), 10);
    if (seconds >= 60) return undefined;
    return minutes * 60 * 1000 + seconds * 1000 + centis * 10;
  }
  const secMatch = trimmed.match(/^(\d+)\.(\d{1,2})$/);
  if (secMatch) {
    const seconds = parseInt(secMatch[1], 10);
    const centis = parseInt(secMatch[2].padEnd(2, "0"), 10);
    return seconds * 1000 + centis * 10;
  }
  return undefined;
};

// Auto-format time input: 022360 -> 02:23.60, 02:01:20 -> 02:01.20
const autoFormatTime = (input) => {
  if (!input) return input;
  const trimmed = input.trim();

  // Handle format MM:SS:cc (colon before centiseconds) -> convert to MM:SS.cc
  const doubleColonMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (doubleColonMatch) {
    const mm = doubleColonMatch[1].padStart(2, "0");
    const ss = doubleColonMatch[2];
    const cc = doubleColonMatch[3];
    return `${mm}:${ss}.${cc}`;
  }

  // If already properly formatted (MM:SS.cc), return as-is
  if (/^\d{1,2}:\d{2}\.\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Only digits - auto format
  if (/^\d+$/.test(trimmed)) {
    const padded = trimmed.padStart(6, "0");
    if (padded.length === 6) {
      // MMSSCC format
      const mm = padded.slice(0, 2);
      const ss = padded.slice(2, 4);
      const cc = padded.slice(4, 6);
      return `${mm}:${ss}.${cc}`;
    } else if (padded.length > 6) {
      // Longer input - take last 6 digits
      const last6 = padded.slice(-6);
      const mm = last6.slice(0, 2);
      const ss = last6.slice(2, 4);
      const cc = last6.slice(4, 6);
      return `${mm}:${ss}.${cc}`;
    }
  }

  return trimmed;
};

// generateRaceCode replaced by shared utility from ../lib/rowing.js

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
  if (rankingSystem && rankingSystem.customPointTable?.length > 0) {
    const entry = rankingSystem.customPointTable.find(
      (e) => e.position === position,
    );
    return entry ? entry.points : 0;
  }
  return DEFAULT_POINT_TABLE[position] || 0;
};

const LANE_RESULT_STATUS_OPTIONS = [
  { value: "ok", label: "OK" },
  { value: "hors_course", label: "HC" },
  { value: "withdrawn", label: "WD" },
  { value: "dns", label: "DNS" },
  { value: "dnf", label: "DNF" },
  { value: "dsq", label: "DSQ" },
  { value: "abs", label: "ABS" },
];

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

// --- Main Component ---

const RaceDetail = () => {
  const { competitionId, raceId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "jury_president";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [competition, setCompetition] = useState(null);
  const [race, setRace] = useState(null);
  const [categories, setCategories] = useState([]);
  const [boatClasses, setBoatClasses] = useState([]);
  const [activeRankingSystem, setActiveRankingSystem] = useState(null);
  const [showResultsEntry, setShowResultsEntry] = useState(false);
  const [resultsForm, setResultsForm] = useState({});
  const [timeErrors, setTimeErrors] = useState({});
  const [registrationEntries, setRegistrationEntries] = useState([]);
  const [restoringEntryId, setRestoringEntryId] = useState("");

  const fetchData = useCallback(async () => {
    if (!token || !competitionId || !raceId) return;
    setLoading(true);

    // Helper to validate response and attempt JSON parsing
    const safeJson = async (res, label) => {
      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        let message = `Failed to load ${label} (${res.status})`;
        try {
          if (contentType?.includes("application/json")) {
            const errorData = await res.json();
            message = errorData.message || message;
          }
        } catch (e) {
          /* ignore parse error on error responses */
        }
        throw new Error(message);
      }
      if (!contentType?.includes("application/json")) {
        throw new Error(
          `Invalid response from ${label} (Expected JSON, got ${contentType || "unknown"})`,
        );
      }
      return res.json();
    };

    try {
      const [compRes, raceRes, catRes, boatRes, rankRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/competitions/${competitionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/races/${raceId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        fetch(`${API_BASE_URL}/api/categories?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/boat-classes?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}/available-systems`,
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);

      const [compData, raceData, catData, boatData, rankData] =
        await Promise.all([
          safeJson(compRes, "competition"),
          safeJson(raceRes, "race"),
          safeJson(catRes, "categories"),
          safeJson(boatRes, "boat classes"),
          safeJson(rankRes, "ranking systems"),
        ]);

      setCompetition(compData);
      setRace(raceData);
      setCategories(Array.isArray(catData) ? catData : []);
      setBoatClasses(Array.isArray(boatData) ? boatData : []);

      if (rankData?.availableSystems?.length > 0) {
        setActiveRankingSystem(rankData.availableSystems[0]);
      }

      // Optional source for withdrawn state; do not fail the page if unavailable.
      try {
        const regResponse = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (regResponse.ok) {
          const regPayload = await regResponse.json().catch(() => ({}));
          setRegistrationEntries(
            Array.isArray(regPayload?.entries) ? regPayload.entries : [],
          );
        } else {
          setRegistrationEntries([]);
        }
      } catch {
        setRegistrationEntries([]);
      }

      // Initialize results form
      if (raceData.lanes) {
        const initial = {};
        raceData.lanes.forEach((lane) => {
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
    } catch (err) {
      toast.error(err.message);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [competitionId, raceId, token, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const category = useMemo(() => {
    const catId = toDocumentId(race?.category);
    return categories.find((c) => toDocumentId(c) === catId);
  }, [race, categories]);

  const boatClass = useMemo(() => {
    const boatId = toDocumentId(race?.boatClass);
    return boatClasses.find((b) => toDocumentId(b) === boatId);
  }, [race, boatClasses]);

  const raceEventTitle = useMemo(
    () => formatEventTitleWithBoatClass(category, boatClass, "en"),
    [category, boatClass],
  );

  const raceEventSubtitle = useMemo(
    () =>
      [getCategoryDisplayName(category), getBoatClassDisplayName(boatClass)]
        .filter(Boolean)
        .join(" · "),
    [category, boatClass],
  );

  const calculatedPositions = useMemo(() => {
    const positions = {};
    const validEntries = [];
    Object.entries(resultsForm).forEach(([laneNum, data]) => {
      const ms = parseTimeToMs(data.elapsedTime);
      // HC athletes are excluded from position calculation
      if (ms !== undefined && data.status === "ok") {
        validEntries.push({ lane: parseInt(laneNum, 10), ms });
      }
    });
    validEntries.sort((a, b) => a.ms - b.ms);
    validEntries.forEach((entry, index) => {
      positions[entry.lane] = index + 1;
    });

    // DNF gets position after last finisher
    const lastPos = validEntries.length;
    Object.entries(resultsForm).forEach(([laneNum, data]) => {
      if (data.status === "dnf") {
        positions[laneNum] = lastPos + 1;
      }
    });

    return positions;
  }, [resultsForm]);

  const withdrawnAssignmentKeys = useMemo(() => {
    const keys = new Set();

    registrationEntries.forEach((entry) => {
      if ((entry?.status || "").toLowerCase() !== "withdrawn") {
        return;
      }

      const categoryId = toDocumentId(entry?.category);
      const boatClassId = toDocumentId(entry?.boatClass);
      const clubId = toDocumentId(entry?.club);
      const crewIds = toSortedUniqueIds(
        (entry?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(entry?.athlete);

      const key = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId,
        athleteId,
        crewIds,
      });

      if (key) {
        keys.add(key);
      }
    });

    return keys;
  }, [registrationEntries]);

  const withdrawnEntryByAssignmentKey = useMemo(() => {
    const entryMap = new Map();

    registrationEntries.forEach((entry) => {
      if ((entry?.status || "").toLowerCase() !== "withdrawn") {
        return;
      }

      const categoryId = toDocumentId(entry?.category);
      const boatClassId = toDocumentId(entry?.boatClass);
      const clubId = toDocumentId(entry?.club);
      const crewIds = toSortedUniqueIds(
        (entry?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(entry?.athlete);

      const key = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId,
        athleteId,
        crewIds,
      });

      if (key && !entryMap.has(key)) {
        entryMap.set(key, entry);
      }
    });

    return entryMap;
  }, [registrationEntries]);

  const activeAssignmentKeys = useMemo(() => {
    const keys = new Set();

    registrationEntries.forEach((entry) => {
      if ((entry?.status || "").toLowerCase() === "withdrawn") {
        return;
      }

      const categoryId = toDocumentId(entry?.category);
      const boatClassId = toDocumentId(entry?.boatClass);
      const clubId = toDocumentId(entry?.club);
      const crewIds = toSortedUniqueIds(
        (entry?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(entry?.athlete);

      const key = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId,
        athleteId,
        crewIds,
      });

      if (key) {
        keys.add(key);
      }
    });

    return keys;
  }, [registrationEntries]);

  const registrationEventKeys = useMemo(() => {
    const keys = new Set();

    registrationEntries.forEach((entry) => {
      const eventKey = buildEventAssignmentKey({
        categoryId: toDocumentId(entry?.category),
        boatClassId: toDocumentId(entry?.boatClass),
      });
      keys.add(eventKey);
    });

    return keys;
  }, [registrationEntries]);

  const isLaneWithdrawn = useCallback(
    (lane) => {
      if (!lane) {
        return false;
      }

      const laneResultStatus = String(lane?.result?.status || "").toLowerCase();
      if (
        String(lane?.registrationStatus || "").toLowerCase() === "withdrawn" ||
        laneResultStatus === "withdrawn"
      ) {
        return true;
      }

      const categoryId =
        toDocumentId(lane?.category) || toDocumentId(race?.category);
      const boatClassId =
        toDocumentId(lane?.boatClass) || toDocumentId(race?.boatClass);
      const clubId = toDocumentId(lane?.club);
      const crewIds = toSortedUniqueIds(
        (lane?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(lane?.athlete);

      const key = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId,
        athleteId,
        crewIds,
      });

      if (!key) {
        return false;
      }

      if (withdrawnAssignmentKeys.has(key)) {
        return true;
      }

      const eventKey = buildEventAssignmentKey({ categoryId, boatClassId });
      if (!registrationEventKeys.has(eventKey)) {
        return false;
      }

      return !activeAssignmentKeys.has(key);
    },
    [
      withdrawnAssignmentKeys,
      activeAssignmentKeys,
      registrationEventKeys,
      race?.category,
      race?.boatClass,
    ],
  );

  const getWithdrawnEntryForLane = useCallback(
    (lane) => {
      if (!lane) {
        return null;
      }

      const categoryId =
        toDocumentId(lane?.category) || toDocumentId(race?.category);
      const boatClassId =
        toDocumentId(lane?.boatClass) || toDocumentId(race?.boatClass);
      const clubId = toDocumentId(lane?.club);
      const crewIds = toSortedUniqueIds(
        (lane?.crew || []).map((member) => toDocumentId(member)),
      );
      const athleteId = crewIds.length ? null : toDocumentId(lane?.athlete);

      const key = buildAssignmentKey({
        categoryId,
        boatClassId,
        clubId,
        athleteId,
        crewIds,
      });

      if (!key) {
        return null;
      }

      return withdrawnEntryByAssignmentKey.get(key) || null;
    },
    [withdrawnEntryByAssignmentKey, race?.category, race?.boatClass],
  );

  const handleResultChange = (laneNum, field, value) => {
    setResultsForm((prev) => ({
      ...prev,
      [laneNum]: { ...prev[laneNum], [field]: value },
    }));
  };

  const handleRestoreWithdrawnLane = useCallback(
    async (lane, entryId = null) => {
      if (!token || !competitionId) {
        return;
      }

      const laneNumber = Number(lane?.lane);
      const hasLaneNumber = Number.isInteger(laneNumber) && laneNumber > 0;
      if (!entryId && !hasLaneNumber) {
        toast.error("Unable to restore this lane");
        return;
      }

      const restoreActionKey = entryId || `lane-${laneNumber}`;

      const proceed = window.confirm(
        "Restore this withdrawn entry back to active status?",
      );
      if (!proceed) {
        return;
      }

      setRestoringEntryId(restoreActionKey);
      try {
        let response;

        if (entryId) {
          response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}/unwithdraw`,
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
                raceId,
                lane: laneNumber,
              }),
            },
          );
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to restore entry");
        }

        toast.success("Entry restored from withdrawn status");
        await fetchData();
      } catch (error) {
        console.error("Failed to restore withdrawn entry", error);
        toast.error(error.message || "Failed to restore entry");
      } finally {
        setRestoringEntryId("");
      }
    },
    [competitionId, fetchData, raceId, token],
  );

  const saveResults = async (markCompleted = true) => {
    if (!token || !competitionId || !raceId) return;
    setSaving(true);
    try {
      const lanes = race.lanes.map((lane) => {
        const formData = resultsForm[lane.lane];
        const ms = parseTimeToMs(formData.elapsedTime);
        return {
          lane: lane.lane,
          result: {
            finishPosition: calculatedPositions[lane.lane],
            elapsedMs: ms,
            status: formData.status,
            notes: formData.notes,
          },
        };
      });

      const res = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/races/${raceId}/results`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ lanes, markCompleted }),
        },
      );

      if (!res.ok) throw new Error("Failed to save results");
      toast.success("Results saved successfully");
      setShowResultsEntry(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // --- PDF Export Logic (Full implementation) ---
  const exportPDF = async (isResults = false) => {
    if (!race || !competition) return;
    toast.info(`Generating ${isResults ? "Results" : "Start List"} PDF...`);

    // Single-race export should only use the currently opened race.
    const pseudoRace = {
      ...race,
      lanes: (race.lanes || []).map((l) => ({
        ...l,
        _originalRaceId: race._id,
      })),
    };

    const allOrigRaces = [race];
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
      if (c || b)
        distinctCodes.add(formatRaceCodeForHeader(generateRaceCode(c, b), c));
      if (r.order) distinctOrders.add(r.order);
    });

    let fullEventName =
      `${category?.titles?.en || ""} ${boatClass?.names?.en || ""}`.trim();
    if (!fullEventName) {
      fullEventName = Array.from(distinctEnTitles).join(" / ");
    }
    let fullEventNameAr =
      `${category?.titles?.ar || ""} ${boatClass?.names?.ar || ""}`.trim() ||
      Array.from(distinctArTitles).join(" / ");
    const rightHeaderCode = Array.from(distinctCodes).join(" / ");
    const sequenceOrderStr = String(race?.order || 1);
    const formattedHeaderCode =
      rightHeaderCode ||
      formatRaceCodeForHeader(generateRaceCode(category, boatClass), category);

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

    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const asOfLabel = formatAsOfLabel();

    // Load assets
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
        console.warn("Arabic font fail:", err);
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
      headerHeight = pageWidth / (imgProps.width / imgProps.height) + 3 + 8; // 3mm top margin + 8mm gap after line
    }

    let yPos = headerHeight;

    // --- Header Section ---
    // Use event date instead of generation date
    const eventDateStr = competition.startDate
      ? new Date(competition.startDate).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : dateStr;

    // Competition title in header (bigger, bold)
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    const competitionTitle =
      competition.names?.en ||
      competition.name ||
      competition.code ||
      "Competition";
    doc.text(competitionTitle, center, yPos, { align: "center" });

    // Location and date on same line (smaller)
    doc.setFontSize(9);
    doc.setFont(fontName, "normal");
    const compLocation =
      competition.location?.name ||
      competition.venue?.name ||
      competition.venue ||
      "Location";
    doc.text(String(compLocation), leftMargin, yPos);
    doc.text(eventDateStr, rightMargin, yPos, { align: "right" });

    yPos += 2;
    doc.setLineWidth(0.5);
    doc.line(leftMargin, yPos, rightMargin, yPos);
    yPos += 5;

    // --- Event Details (aligned with race management full results PDF) ---
    // Line 1: Race order | Results/Start List | Race code
    doc.setFontSize(12);
    doc.setFont(fontName, "bold");
    doc.text(
      String(sequenceOrderStr || pseudoRace.order || "1"),
      leftMargin,
      yPos,
    );
    doc.text(isResults ? "Results" : "Start List", center, yPos, {
      align: "center",
    });
    doc.text(formattedHeaderCode, rightMargin, yPos, { align: "right" });

    // Line 2: (Event) | Category + Boat Class
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
      fullEventName || formatEventTitleWithBoatClass(category, boatClass, "en");
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

    // Line 3: Arabic text (center) | Distance (right)
    const raceDistance =
      pseudoRace.distanceOverride ??
      pseudoRace.distance ??
      allOrigRaces.find((r) => r?.distanceOverride != null)?.distanceOverride ??
      competition?.defaultDistance ??
      competition?.distance ??
      null;
    fullEventNameAr =
      fullEventNameAr ||
      formatEventTitleWithBoatClass(category, boatClass, "ar");
    yPos = eventTitleLayout.yEnd;

    if (arabicFontName && fullEventNameAr) {
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
      doc.text(`Distance: ${raceDistance}m`, center, yPos, { align: "center" });
    }

    // Line 4: Start Time | Journey/Phase | Race #
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont(fontName, "normal");
    const startTime = pseudoRace.startTime
      ? new Date(pseudoRace.startTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "00:00";
    doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
    doc.setFontSize(10);
    doc.setFont(fontName, "bold");
    doc.text(phaseStr, center, yPos, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Race ${pseudoRace.order || "1"}`, rightMargin, yPos, {
      align: "right",
    });
    yPos += 2;

    // --- Calculate legend height for bottom margin ---
    const uniqueClubs = Array.from(
      new Set(
        pseudoRace.lanes.map((l) => toDocumentId(l.club)).filter(Boolean),
      ),
    )
      .map(
        (id) => pseudoRace.lanes.find((l) => toDocumentId(l.club) === id).club,
      )
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

    const legendLineHeight = 4;
    const legendBoxHeight =
      uniqueClubs.length > 0 ? uniqueClubs.length * legendLineHeight + 7 : 0;
    // 35 = footer height + margin, 14 = gap + progression box + gap before legend
    const bottomMargin = 35 + legendBoxHeight + 14;

    // --- Table ---
    const sortedStartListLanes = sortStartListLanes({
      lanes: pseudoRace?.lanes || [],
      referenceRace: race,
      originalRaceLookup: origRaceLookup,
      toDocumentId,
    });

    const exportLanes = isResults
      ? [...(pseudoRace?.lanes || [])].sort((a, b) => {
          const statusA = a.result?.status || "ok";
          const statusB = b.result?.status || "ok";

          const priority = {
            ok: 0,
            dnf: 1,
            dns: 2,
            abs: 3,
            dsq: 4,
            hors_course: 5,
          };
          const pA = priority[statusA] ?? 10;
          const pB = priority[statusB] ?? 10;

          if (pA !== pB) return pA - pB;

          const posA = a.result?.finishPosition || 999;
          const posB = b.result?.finishPosition || 999;
          if (posA !== posB) return posA - posB;
          return (a.lane || 0) - (b.lane || 0);
        })
      : sortedStartListLanes;

    // Find winning time for delta calculation
    const winnerElapsed = isResults
      ? exportLanes.find(
          (l) => (l.result?.status || "ok") === "ok" && l.result?.elapsedMs,
        )?.result?.elapsedMs
      : null;

    const explicitFinisherPositions = isResults
      ? exportLanes
          .filter((l) => (l.result?.status || "ok") === "ok")
          .map((l) => l.result?.finishPosition)
          .filter((p) => Number.isInteger(p) && p > 0)
      : [];
    const lastFinisherPosition = explicitFinisherPositions.length
      ? Math.max(...explicitFinisherPositions)
      : exportLanes.filter(
          (l) =>
            (l.result?.status || "ok") === "ok" &&
            Number.isFinite(l.result?.elapsedMs),
        ).length;

    const formatNameForPdf = (a) => {
      if (!a) return "Unknown";
      const first = a.firstName || "";
      const last = (a.lastName || "").toUpperCase();
      return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
    };

    const normalizeMember = (m) => {
      if (!m || typeof m !== "object") return null;
      return m;
    };

    const deltaMap = new Map();
    const resultsTableBody = exportLanes.map((lane, rowIdx) => {
      const athlete = normalizeMember(lane.athlete);
      const clubCode =
        lane.club?.code || lane.club?.name?.slice(0, 3).toUpperCase() || "-";

      let athleteName = "Unassigned";
      if (athlete) {
        athleteName = formatNameForPdf(athlete);
      } else if (Array.isArray(lane.crew) && lane.crew.length > 0) {
        athleteName = lane.crew
          .map((m, i, arr) => {
            const member = normalizeMember(m);
            const name = formatNameForPdf(member);
            let pos = "";
            if (arr.length > 1) {
              if (i === 0) pos = "(b) ";
              else if (i === arr.length - 1) pos = "(s) ";
              else pos = `(${i + 1}) `;
            }
            return `${pos}${name}`;
          })
          .join(" / ");
      }

      const status = lane.result?.status || "ok";
      const isHC = status === "hors_course";
      const effectivePos = isHC
        ? null
        : status === "dnf"
          ? lane.result?.finishPosition || lastFinisherPosition + 1
          : lane.result?.finishPosition;
      const pos = isHC ? "HC" : effectivePos || "-";
      const timeStr = isHC
        ? lane.result?.elapsedMs
          ? formatElapsedTime(lane.result.elapsedMs)
          : "HC"
        : status !== "ok"
          ? status.toUpperCase()
          : formatElapsedTime(lane.result?.elapsedMs);

      if (
        status === "ok" &&
        lane.result?.elapsedMs &&
        effectivePos > 1 &&
        winnerElapsed
      ) {
        const deltaMs = lane.result.elapsedMs - winnerElapsed;
        const deltaStr = formatDeltaSeconds(deltaMs);
        if (deltaStr) deltaMap.set(rowIdx, `+${deltaStr}`);
      }

      // HC athletes get 0 points — they are out of the ranking
      const points =
        !isHC &&
        (status === "ok" || status === "dnf") &&
        effectivePos > 0 &&
        effectivePos <= 8
          ? calculatePoints(effectivePos, activeRankingSystem)
          : 0;

      return [
        String(pos),
        String(lane.lane || ""),
        String(clubCode),
        String(athleteName),
        String(timeStr),
        String(points),
      ];
    });

    const raceAthleteLookup = new Map();
    for (const lane of pseudoRace?.lanes || []) {
      const athleteId = toDocumentId(lane?.athlete);
      if (athleteId && lane?.athlete && typeof lane.athlete === "object") {
        raceAthleteLookup.set(athleteId, lane.athlete);
      }
      if (Array.isArray(lane?.crew)) {
        for (const member of lane.crew) {
          const mId = toDocumentId(member);
          if (mId && member && typeof member === "object") {
            raceAthleteLookup.set(mId, member);
          }
        }
      }
    }

    const { tableBody: fullStartListTableBody } = buildStartListTableBody({
      lanes: exportLanes,
      referenceRace: race,
      originalRaceLookup: origRaceLookup,
      athleteLookup: raceAthleteLookup,
      categories,
      boatClasses,
      toDocumentId,
      generateRaceCode,
      formatName: formatNameForPdf,
      sortLanes: false,
    });

    const startListTableBody = fullStartListTableBody.map((row) =>
      row.slice(0, 5),
    );

    autoTable(doc, {
      startY: yPos,
      head: isResults
        ? [["Rank", "Lane", "Club", "Name", "Time", "Points"]]
        : [["Lane", "Club", "Name", "License", "DOB"]],
      body: isResults ? resultsTableBody : startListTableBody,
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
        ...(isResults
          ? {
              fontSize: 8,
              cellPadding: 0.8,
              minCellHeight: 6.5,
            }
          : {
              fontSize: 9,
              cellPadding: 1,
            }),
        font: fontName,
      },
      columnStyles: isResults
        ? {
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
          }
        : {
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
      didDrawCell: isResults
        ? (data) => {
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
          }
        : undefined,
    });

    yPos = doc.lastAutoTable.finalY + 4;

    // --- Status/Progression Box (ensure no overlap with legend) ---
    const progressionBoxEnd = yPos + 7;
    const legendTop =
      uniqueClubs.length > 0
        ? pageHeight - 35 - (uniqueClubs.length * legendLineHeight + 7)
        : pageHeight - 35;
    if (progressionBoxEnd < legendTop) {
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(leftMargin, yPos, 182, 7);
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      const statusText = isResults
        ? "Official Results - Times are final."
        : race.notes || "Progression System: Subject to competition rules.";
      doc.text(statusText, leftMargin + 2, yPos + 5);
    }

    // --- Footer Logic ---
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
      if (i === pageCount) {
        const uniqueClubs = Array.from(
          new Set(
            pseudoRace.lanes.map((l) => toDocumentId(l.club)).filter(Boolean),
          ),
        )
          .map(
            (id) =>
              pseudoRace.lanes.find((l) => toDocumentId(l.club) === id).club,
          )
          .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        if (uniqueClubs.length > 0) {
          const lineHeight = 4;
          const boxHeight = uniqueClubs.length * lineHeight + 7;
          const legendY = pageHeight - 35 - boxHeight;

          doc.setDrawColor(0);
          doc.setLineWidth(0.3);
          doc.rect(leftMargin, legendY, 182, boxHeight);

          doc.setFontSize(9);
          doc.setFont(fontName, "bold");
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
        doc.text(`Page ${i} of ${pageCount}`, rightMargin, pageHeight - h - 8, {
          align: "right",
        });
      }
    }

    doc.save(
      `${isResults ? "Results" : "StartList"}_${competition.code}_Race${pseudoRace.order}.pdf`,
    );
  };

  if (loading || !race) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-500">
            {loading
              ? "Loading race details..."
              : "Race not found. Redirecting..."}
          </p>
        </div>
      </div>
    );
  }

  const raceCode = generateRaceCode(category, boatClass);
  const assignedLanes = (race?.lanes || []).filter((lane) => {
    const hasAthlete = Boolean(lane?.athlete);
    const hasCrew = Array.isArray(lane?.crew) && lane.crew.length > 0;
    return hasAthlete || hasCrew;
  });

  const sortedLanes = [...assignedLanes].sort((a, b) => {
    const withdrawnA = isLaneWithdrawn(a);
    const withdrawnB = isLaneWithdrawn(b);

    if (withdrawnA !== withdrawnB) {
      return withdrawnA ? 1 : -1;
    }

    if (race?.status === "completed") {
      const statusA = a.result?.status || "ok";
      const statusB = b.result?.status || "ok";

      const priority = {
        ok: 0,
        dnf: 1,
        dns: 2,
        abs: 3,
        dsq: 4,
        hors_course: 5,
      };
      const pA = priority[statusA] ?? 10;
      const pB = priority[statusB] ?? 10;

      if (pA !== pB) return pA - pB;

      const posA = a.result?.finishPosition || 999;
      const posB = b.result?.finishPosition || 999;
      if (posA !== posB) return posA - posB;
    }
    return a.lane - b.lane;
  });

  const winningTime = sortedLanes.find(
    (l) =>
      !isLaneWithdrawn(l) &&
      (l.result?.status || "ok") === "ok" &&
      l.result?.elapsedMs,
  )?.result?.elapsedMs;

  const explicitFinisherPositions = sortedLanes
    .filter((l) => !isLaneWithdrawn(l) && (l.result?.status || "ok") === "ok")
    .map((l) => l.result?.finishPosition)
    .filter((p) => Number.isInteger(p) && p > 0);
  const lastFinisherPosition = explicitFinisherPositions.length
    ? Math.max(...explicitFinisherPositions)
    : sortedLanes.filter(
        (l) =>
          !isLaneWithdrawn(l) &&
          (l.result?.status || "ok") === "ok" &&
          Number.isFinite(l.result?.elapsedMs),
      ).length;

  const withdrawnLaneCount = sortedLanes.filter((lane) =>
    isLaneWithdrawn(lane),
  ).length;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Race {race?.order}
                </span>
                <Badge
                  variant={
                    race?.status === "completed" ? "success" : "secondary"
                  }
                  className="h-5"
                >
                  {race?.status?.toUpperCase()}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-slate-900 line-clamp-1">
                {raceEventTitle || raceCode}
              </h1>
              <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                {raceEventSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !showResultsEntry && (
              <Button
                onClick={() => setShowResultsEntry(true)}
                className="hidden sm:flex"
              >
                <Edit3 className="mr-2 h-4 w-4" /> Enter Results
              </Button>
            )}
            <Button variant="outline" size="icon" className="sm:hidden">
              <Printer className="h-4 w-4" />
            </Button>
            <div className="hidden sm:flex gap-2">
              <Button variant="outline" onClick={() => exportPDF(false)}>
                <FileText className="mr-2 h-4 w-4" /> Start List
              </Button>
              <Button variant="outline" onClick={() => exportPDF(true)}>
                <Trophy className="mr-2 h-4 w-4" /> Results
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Stats & Info */}
          <div className="space-y-6">
            <Card className="overflow-hidden border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-indigo-400" />
                  Event Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Hash className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      Race Code
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {raceCode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      Start Time
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {race?.startTime
                        ? new Date(race.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not Set"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      Phase
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {race?.phase || "Final"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      Distance
                    </p>
                    <p className="text-base font-bold text-slate-900">
                      {race?.distanceOverride ||
                        competition?.defaultDistance ||
                        "-"}{" "}
                      m
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-slate-200">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Competition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <MapPin className="h-5 w-5 text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-700">
                    {competition?.location?.name ||
                      competition?.venue?.name ||
                      (typeof competition?.venue === "string"
                        ? competition.venue
                        : "")}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Calendar className="h-5 w-5 text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-700">
                    {competition?.startDate &&
                      new Date(competition.startDate).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {isAdmin && process.env.NODE_ENV === "development" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-slate-400 hover:text-indigo-600"
                onClick={(e) => {
                  if (e.shiftKey) {
                    // Test 45 lanes logic...
                    toast.info("Development test triggered");
                  }
                }}
              >
                <FlaskConical className="mr-2 h-4 w-4" /> Multi-page Test
                (Shift+Click)
              </Button>
            )}
          </div>

          {/* Right Column: Result Table / Entry Form */}
          <div className="lg:col-span-2">
            {showResultsEntry ? (
              <Card className="border-none shadow-md ring-1 ring-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                  <CardTitle className="text-xl font-bold">
                    Entry Results
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowResultsEntry(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {withdrawnLaneCount > 0 && (
                    <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                      {withdrawnLaneCount} withdrawn entr
                      {withdrawnLaneCount === 1 ? "y" : "ies"} detected for this
                      race. These lanes are marked and locked for result entry.
                    </div>
                  )}

                  <div className="space-y-4">
                    {race?.lanes?.map((lane) => {
                      const laneWithdrawn = isLaneWithdrawn(lane);
                      const withdrawnEntry = laneWithdrawn
                        ? getWithdrawnEntryForLane(lane)
                        : null;
                      const restoreActionKey =
                        withdrawnEntry?.id || `lane-${Number(lane?.lane)}`;
                      const canUndoWithdraw =
                        isAdmin && laneWithdrawn && Number(lane?.lane) > 0;

                      return (
                        <div
                          key={lane.lane}
                          className={`grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-4 sm:items-center ${laneWithdrawn ? "border-rose-200 bg-rose-50/40" : ""}`}
                        >
                          <div className="flex items-center gap-3 sm:col-span-2">
                            <div className="flex flex-col items-center">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                                {lane.lane}
                              </span>
                              {calculatedPositions[lane.lane] && (
                                <span className="mt-1 text-xs font-bold text-indigo-600">
                                  #{calculatedPositions[lane.lane]}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span
                                className={`font-semibold truncate max-w-[200px] ${laneWithdrawn ? "text-rose-700 line-through" : "text-slate-900"}`}
                              >
                                {lane.crew?.length > 0
                                  ? formatCrewName(lane.crew)
                                  : formatAthleteName(lane.athlete)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                  {getClubDisplayName(lane.club)}
                                </span>
                                {laneWithdrawn && (
                                  <Badge className="h-5 border-rose-200 bg-rose-100 px-2 text-[10px] font-bold text-rose-700 hover:bg-rose-100">
                                    Withdrawn
                                  </Badge>
                                )}
                                {canUndoWithdraw && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-5 border-emerald-300 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
                                    onClick={() =>
                                      handleRestoreWithdrawnLane(
                                        lane,
                                        withdrawnEntry?.id || null,
                                      )
                                    }
                                    disabled={
                                      restoringEntryId === restoreActionKey
                                    }
                                  >
                                    {restoringEntryId === restoreActionKey
                                      ? "Restoring..."
                                      : "Undo WD"}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-400">
                              Time
                            </Label>
                            <Input
                              placeholder="MM:SS.cc"
                              value={resultsForm[lane.lane]?.elapsedTime}
                              onChange={(e) =>
                                handleResultChange(
                                  lane.lane,
                                  "elapsedTime",
                                  e.target.value,
                                )
                              }
                              onBlur={(e) => {
                                const formatted = autoFormatTime(
                                  e.target.value,
                                );
                                if (formatted !== e.target.value) {
                                  handleResultChange(
                                    lane.lane,
                                    "elapsedTime",
                                    formatted,
                                  );
                                }
                              }}
                              className="font-mono"
                              disabled={laneWithdrawn}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-slate-400">
                              Status
                            </Label>
                            <Select
                              value={resultsForm[lane.lane]?.status}
                              onChange={(e) =>
                                handleResultChange(
                                  lane.lane,
                                  "status",
                                  e.target.value,
                                )
                              }
                              disabled={laneWithdrawn}
                            >
                              {LANE_RESULT_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowResultsEntry(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => saveResults(false)}
                      disabled={saving}
                    >
                      <Save className="mr-2 h-4 w-4" /> Save Draft
                    </Button>
                    <Button
                      onClick={() => saveResults(true)}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Trophy className="mr-2 h-4 w-4" /> Official Publish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {race?.status === "completed"
                      ? "Official Results"
                      : "Start List"}
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" /> {sortedLanes.length || 0}{" "}
                      Boats
                    </div>
                    {withdrawnLaneCount > 0 && (
                      <Badge className="border-rose-200 bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100">
                        {withdrawnLaneCount} Withdrawn
                      </Badge>
                    )}
                  </div>
                </div>

                {withdrawnLaneCount > 0 && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                    Withdrawn athletes are highlighted and labeled as WD.
                  </div>
                )}

                <div className="space-y-3">
                  {sortedLanes.map((lane, index) => {
                    const laneWithdrawn = isLaneWithdrawn(lane);
                    const withdrawnEntry = laneWithdrawn
                      ? getWithdrawnEntryForLane(lane)
                      : null;
                    const restoreActionKey =
                      withdrawnEntry?.id || `lane-${Number(lane?.lane)}`;
                    const canUndoWithdraw =
                      isAdmin && laneWithdrawn && Number(lane?.lane) > 0;
                    const status = lane.result?.status || "ok";
                    const isHC = status === "hors_course";
                    const effectivePos = isHC
                      ? null
                      : status === "dnf"
                        ? lane.result?.finishPosition ||
                          lastFinisherPosition + 1
                        : lane.result?.finishPosition;
                    const isWinner =
                      !laneWithdrawn && !isHC && effectivePos === 1;

                    // HC athletes get no points
                    const points = isHC
                      ? 0
                      : calculatePoints(effectivePos, activeRankingSystem);

                    return (
                      <div
                        key={lane.lane}
                        className={`group relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md ${isWinner ? "ring-2 ring-indigo-500" : ""} ${laneWithdrawn ? "border border-rose-200 bg-rose-50/40" : ""} ${isHC ? "border border-amber-200 bg-amber-50/40" : ""}`}
                      >
                        {/* Rank / Lane Indicator */}
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${isWinner ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : isHC ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}
                          >
                            {race?.status === "completed"
                              ? laneWithdrawn
                                ? "WD"
                                : isHC
                                  ? "HC"
                                  : effectivePos || "-"
                              : lane.lane}
                          </span>
                          <span className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                            {race?.status === "completed" ? "Rank" : "Lane"}
                          </span>
                        </div>

                        {/* Athlete / Crew Detail */}
                        <div className="flex flex-1 flex-col min-w-0">
                          <h4
                            className={`text-base font-bold truncate ${laneWithdrawn ? "text-rose-700 line-through" : "text-slate-900"}`}
                          >
                            {lane.crew?.length > 0
                              ? formatCrewName(lane.crew)
                              : formatAthleteName(lane.athlete)}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold px-1.5 py-0"
                            >
                              {lane.club?.code || "???"}
                            </Badge>
                            <span className="text-xs text-slate-500 truncate">
                              {getClubDisplayName(lane.club)}
                            </span>
                            {laneWithdrawn && (
                              <Badge className="h-5 border-rose-200 bg-rose-100 px-2 text-[10px] font-bold text-rose-700 hover:bg-rose-100">
                                Withdrawn
                              </Badge>
                            )}
                            {isHC && (
                              <Badge className="h-5 border-amber-200 bg-amber-100 px-2 text-[10px] font-bold text-amber-700 hover:bg-amber-100">
                                Hors Course
                              </Badge>
                            )}
                            {canUndoWithdraw && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-5 border-emerald-300 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
                                onClick={() =>
                                  handleRestoreWithdrawnLane(
                                    lane,
                                    withdrawnEntry?.id || null,
                                  )
                                }
                                disabled={restoringEntryId === restoreActionKey}
                              >
                                {restoringEntryId === restoreActionKey
                                  ? "Restoring..."
                                  : "Undo WD"}
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Timing & Points */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-baseline gap-1 text-right">
                            <p
                              className={`text-lg font-black tracking-tight ${laneWithdrawn ? "text-rose-700" : isHC ? "text-amber-600" : isWinner ? "text-indigo-600" : "text-slate-900"}`}
                            >
                              {laneWithdrawn
                                ? "WD"
                                : isHC
                                  ? lane.result?.elapsedMs
                                    ? formatElapsedTime(lane.result.elapsedMs)
                                    : "HC"
                                  : status !== "ok"
                                    ? status.toUpperCase()
                                    : lane.result?.elapsedMs
                                      ? formatElapsedTime(lane.result.elapsedMs)
                                      : "-"}
                            </p>
                          </div>
                          {race.status === "completed" &&
                            !laneWithdrawn &&
                            !isHC &&
                            (status === "ok" || status === "dnf") && (
                              <div className="flex items-center gap-2">
                                {status === "ok" &&
                                  lane.result?.finishPosition > 1 &&
                                  winningTime &&
                                  lane.result?.elapsedMs && (
                                    <span className="text-xs font-medium text-rose-500">
                                      +
                                      {formatDeltaSeconds(
                                        lane.result.elapsedMs - winningTime,
                                      )}
                                    </span>
                                  )}
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none font-bold">
                                  {points} PTS
                                </Badge>
                              </div>
                            )}
                          {race.status === "completed" && isHC && (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none font-bold">
                              0 PTS
                            </Badge>
                          )}
                        </div>

                        <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-indigo-400" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RaceDetail;
