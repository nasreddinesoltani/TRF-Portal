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
  if (typeof value === "object") {
    const candidate = value._id || value.id;
    if (!candidate) return null;
    return typeof candidate === "string" ? candidate : candidate.toString();
  }
  return null;
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

const generateRaceCode = (category, boatClass) => {
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
  const isCoastalBoat = boatCode.startsWith("C") || boatCode.startsWith("c");
  const isSeniorCategory =
    catAbbr.toUpperCase() === "SM" ||
    catAbbr.toUpperCase() === "SW" ||
    catAbbr.toUpperCase() === "S" ||
    (category?.titles?.en || "").toLowerCase().includes("senior");

  const genderPrefix =
    catGender === "women" ? "W" : catGender === "mixed" ? "Mix" : "M";

  if (isSeniorCategory) {
    if (isCoastalBoat) {
      return isLightweight ? `L${boatCode}` : boatCode;
    }
    return isLightweight
      ? `L${genderPrefix}${boatCode}`
      : `${genderPrefix}${boatCode}`;
  }

  if (isCoastalBoat) {
    return isLightweight ? `${catAbbr}L${boatCode}` : `${catAbbr}${boatCode}`;
  }

  const catHasGender =
    catAbbr.endsWith("M") || catAbbr.endsWith("W") || catAbbr.endsWith("Mix");
  if (catHasGender && isLightweight) {
    const catBase = catAbbr.slice(0, -1);
    const catGenderSuffix = catAbbr.slice(-1);
    return `${catBase}L${catGenderSuffix}${boatCode}`;
  }
  if (catHasGender) {
    return `${catAbbr}${boatCode}`;
  }
  return isLightweight
    ? `${catAbbr}L${genderPrefix}${boatCode}`
    : `${catAbbr}${genderPrefix}${boatCode}`;
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
  { value: "dns", label: "DNS" },
  { value: "dnf", label: "DNF" },
  { value: "dsq", label: "DSQ" },
  { value: "abs", label: "ABS" },
];

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
      navigate(`/competitions/${competitionId}/races`);
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

  const calculatedPositions = useMemo(() => {
    const positions = {};
    const validEntries = [];
    Object.entries(resultsForm).forEach(([laneNum, data]) => {
      const ms = parseTimeToMs(data.elapsedTime);
      if (ms !== undefined && data.status === "ok") {
        validEntries.push({ lane: parseInt(laneNum, 10), ms });
      }
    });
    validEntries.sort((a, b) => a.ms - b.ms);
    validEntries.forEach((entry, index) => {
      positions[entry.lane] = index + 1;
    });
    return positions;
  }, [resultsForm]);

  const handleResultChange = (laneNum, field, value) => {
    setResultsForm((prev) => ({
      ...prev,
      [laneNum]: { ...prev[laneNum], [field]: value },
    }));
  };

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

    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

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

    let headerHeight = 35;
    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      headerHeight = pageWidth / (imgProps.width / imgProps.height) + 5 + 8; // 5mm top margin + 8mm after line
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

    // --- Event Details (original layout) ---
    // Line 1: Race order | Results/Start List | Race code
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    doc.text(String(race.order || "1"), leftMargin, yPos);
    doc.text(isResults ? "Results" : "Start List", center, yPos, {
      align: "center",
    });
    doc.text(generateRaceCode(category, boatClass), rightMargin, yPos, {
      align: "right",
    });

    // Line 2: (Event) | Category + Boat Class | Phase
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont(fontName, "normal");
    doc.text("(Event)", leftMargin, yPos);
    doc.setFontSize(12);
    doc.setFont(fontName, "bold");
    const fullEventName =
      `${category?.titles?.en || ""} ${boatClass?.names?.en || ""}`.trim();
    doc.text(fullEventName, center, yPos, { align: "center" });
    doc.setFontSize(9);
    doc.setFont(fontName, "normal");
    doc.text(race.phase || "Final", rightMargin, yPos, { align: "right" });

    // Line 3: Arabic text (center) | Distance (right)
    const raceDistance = race.distanceOverride || competition?.defaultDistance;
    if (arabicFontName && (category?.titles?.ar || boatClass?.names?.ar)) {
      yPos += 6;
      doc.setFontSize(14);
      doc.setFont(arabicFontName, "normal");
      doc.text(
        `${category?.titles?.ar || ""} ${boatClass?.names?.ar || ""}`.trim(),
        center,
        yPos,
        { align: "center" },
      );
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

    // Line 4: Start Time | Race #
    yPos += 4;
    doc.setFontSize(9);
    const startTime = race.startTime
      ? new Date(race.startTime).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "00:00";
    doc.text(`Start Time: ${startTime}`, leftMargin, yPos);
    doc.setFont(fontName, "bold");
    doc.text(`Race ${race.order}`, rightMargin, yPos, { align: "right" });
    yPos += 4;

    // --- Calculate legend height for bottom margin ---
    const uniqueClubs = Array.from(
      new Set(race.lanes.map((l) => toDocumentId(l.club)).filter(Boolean)),
    )
      .map((id) => race.lanes.find((l) => toDocumentId(l.club) === id).club)
      .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

    const legendLineHeight = 4;
    const legendBoxHeight =
      uniqueClubs.length > 0 ? uniqueClubs.length * legendLineHeight + 7 : 0;
    // 38 = footer height + margin, add legend box height
    const bottomMargin = 38 + legendBoxHeight + 5;

    // --- Table ---
    // For results, sort by position. For start list, ALWAYS sort by lane.
    const exportLanes = [...(race?.lanes || [])].sort((a, b) => {
      if (isResults) {
        const posA = a.result?.finishPosition || 999;
        const posB = b.result?.finishPosition || 999;
        if (posA !== posB) return posA - posB;
      }
      return (a.lane || 0) - (b.lane || 0);
    });

    const tableBody = exportLanes.map((lane) => {
      const athlete = lane.athlete;
      const clubCode =
        lane.club?.code || lane.club?.name?.slice(0, 3).toUpperCase() || "-";

      let athleteName = "Unassigned";
      let license = "";
      let dob = "";
      let timeStr = "";
      let points = 0;

      if (isResults) {
        const pos = lane.result?.finishPosition || "-";
        const status = lane.result?.status || "ok";
        timeStr =
          status !== "ok"
            ? status.toUpperCase()
            : formatElapsedTime(lane.result?.elapsedMs);
        if (
          status === "ok" &&
          pos > 1 &&
          winningTime &&
          lane.result?.elapsedMs
        ) {
          timeStr += `\n${formatDeltaSeconds(lane.result.elapsedMs - winningTime)}`;
        }
        points = calculatePoints(pos, activeRankingSystem);
      }

      // Helper to format name with uppercase last name
      const formatNameForPdf = (a) => {
        if (!a) return "Unknown";
        const first = a.firstName || "";
        const last = (a.lastName || "").toUpperCase();
        return `${first} ${last}`.trim() || a.licenseNumber || "Unknown";
      };

      if (athlete) {
        athleteName = formatNameForPdf(athlete);
        license = athlete.licenseNumber || "";
        dob = athlete.birthDate
          ? new Date(athlete.birthDate).toLocaleDateString("en-GB")
          : "";
      } else if (lane.crew?.length > 0) {
        athleteName = lane.crew
          .map((m, i, arr) => {
            const name = formatNameForPdf(m);
            let pos = "";
            if (arr.length > 1) {
              if (i === 0) pos = "(b) ";
              else if (i === arr.length - 1) pos = "(s) ";
              else pos = `(${i + 1}) `;
            }
            return `${pos}${name}`;
          })
          .join("\n");
        license = lane.crew.map((m) => m.licenseNumber || "-").join("\n");
        dob = lane.crew
          .map((m) =>
            m.birthDate
              ? new Date(m.birthDate).toLocaleDateString("en-GB")
              : "-",
          )
          .join("\n");
      }

      return isResults
        ? [
            lane.result?.finishPosition || "-",
            lane.lane,
            clubCode,
            athleteName,
            timeStr,
            points,
          ]
        : [lane.lane, clubCode, athleteName, license, dob];
    });

    autoTable(doc, {
      startY: yPos,
      head: isResults
        ? [["Rank", "Lane", "Club", "Name", "Time", "Points"]]
        : [["Lane", "Club", "Name", "License", "DOB"]],
      body: tableBody,
      theme: "plain",
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
        cellPadding: 1.5,
      },
      styles: {
        fontSize: isResults ? 8 : 9,
        cellPadding: isResults ? 1 : 1.5,
        font: fontName,
      },
      columnStyles: isResults
        ? {
            0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
            2: { fontStyle: "bold" },
            3: { fontStyle: "bold" },
            4: { halign: "right" },
            5: { halign: "center", fontStyle: "bold" },
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
    });

    yPos = doc.lastAutoTable.finalY + 8;

    // --- Status/Progression Box ---
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(leftMargin, yPos, 182, 7);
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    const statusText = isResults
      ? "Official Results - Times are final."
      : race.notes || "Progression System: Subject to competition rules.";
    doc.text(statusText, leftMargin + 2, yPos + 5);

    // --- Footer Logic ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Header Image
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const h = pageWidth / (imgProps.width / imgProps.height);
        doc.addImage(headerData, "PNG", 0, 5, pageWidth, h);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(leftMargin, h + 7, rightMargin, h + 7);
      }

      // Legend on last page
      if (i === pageCount) {
        const uniqueClubs = Array.from(
          new Set(race.lanes.map((l) => toDocumentId(l.club)).filter(Boolean)),
        )
          .map((id) => race.lanes.find((l) => toDocumentId(l.club) === id).club)
          .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

        if (uniqueClubs.length > 0) {
          const lineHeight = 4;
          const boxHeight = uniqueClubs.length * lineHeight + 7;
          const legendY = pageHeight - 38 - boxHeight;

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
        doc.addImage(footerData, "PNG", 0, pageHeight - h - 5, pageWidth, h);
        doc.setDrawColor(128, 0, 0);
        doc.setLineWidth(0.8);
        doc.line(
          leftMargin,
          pageHeight - h - 8,
          rightMargin,
          pageHeight - h - 8,
        );
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(
          `Page ${i} of ${pageCount}`,
          rightMargin,
          pageHeight - h - 11,
          {
            align: "right",
          },
        );
      }
    }

    doc.save(
      `${isResults ? "Results" : "StartList"}_${competition.code}_Race${race.order}.pdf`,
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
  const sortedLanes = [...(race?.lanes || [])].sort((a, b) => {
    if (race?.status === "completed") {
      const posA = a.result?.finishPosition || 999;
      const posB = b.result?.finishPosition || 999;
      return posA - posB;
    }
    return a.lane - b.lane;
  });

  const winningTime = sortedLanes.find((l) => l.result?.finishPosition === 1)
    ?.result?.elapsedMs;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header Bar */}
      <div className="sticky top-0 z-10 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/competitions/${competitionId}/races`)}
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
                {category?.titles?.en} {boatClass?.names?.en}
              </h1>
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
                  <div className="space-y-4">
                    {race?.lanes?.map((lane) => (
                      <div
                        key={lane.lane}
                        className="grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-4 sm:items-center"
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
                            <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                              {lane.crew?.length > 0
                                ? formatCrewName(lane.crew)
                                : formatAthleteName(lane.athlete)}
                            </span>
                            <span className="text-xs text-slate-500 uppercase">
                              {lane.club?.code}
                            </span>
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
                              const formatted = autoFormatTime(e.target.value);
                              if (formatted !== e.target.value) {
                                handleResultChange(
                                  lane.lane,
                                  "elapsedTime",
                                  formatted,
                                );
                              }
                            }}
                            className="font-mono"
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
                          >
                            {LANE_RESULT_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    ))}
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
                      <User className="h-3 w-3" /> {race?.lanes?.length || 0}{" "}
                      Boats
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {sortedLanes.map((lane, index) => {
                    const status = lane.result?.status || "ok";
                    const isWinner = lane.result?.finishPosition === 1;
                    const points = calculatePoints(
                      lane.result?.finishPosition,
                      activeRankingSystem,
                    );

                    return (
                      <div
                        key={lane.lane}
                        className={`group relative flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-md ${isWinner ? "ring-2 ring-indigo-500" : ""}`}
                      >
                        {/* Rank / Lane Indicator */}
                        <div className="flex flex-col items-center justify-center">
                          <span
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${isWinner ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 text-slate-400"}`}
                          >
                            {race?.status === "completed"
                              ? lane.result?.finishPosition || "-"
                              : lane.lane}
                          </span>
                          <span className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                            {race?.status === "completed" ? "Rank" : "Lane"}
                          </span>
                        </div>

                        {/* Athlete / Crew Detail */}
                        <div className="flex flex-1 flex-col min-w-0">
                          <h4 className="text-base font-bold text-slate-900 truncate">
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
                              {lane.club?.name}
                            </span>
                          </div>
                        </div>

                        {/* Timing & Points */}
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-baseline gap-1 text-right">
                            <p
                              className={`text-lg font-black tracking-tight ${isWinner ? "text-indigo-600" : "text-slate-900"}`}
                            >
                              {status !== "ok"
                                ? status.toUpperCase()
                                : lane.result?.elapsedMs
                                  ? formatElapsedTime(lane.result.elapsedMs)
                                  : "-"}
                            </p>
                          </div>
                          {race.status === "completed" && status === "ok" && (
                            <div className="flex items-center gap-2">
                              {lane.result?.finishPosition > 1 &&
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
