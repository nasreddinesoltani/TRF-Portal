import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE_URL = "";

// Helper to load image as base64
const loadImage = (url) => {
  return new Promise((resolve) => {
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
    img.onerror = () => resolve(null);
  });
};

// Load font as base64
const loadFont = async (url) => {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error("Failed to load font", error);
    return null;
  }
};

// Group display names
const GROUP_LABELS = {
  men: { en: "Men's Cup", fr: "Coupe Hommes", ar: "كأس الرجال" },
  women: { en: "Women's Cup", fr: "Coupe Femmes", ar: "كأس السيدات" },
  mixed: { en: "Mixed Cup", fr: "Coupe Mixte", ar: "كأس مختلط" },
};

// Medal colors
const MEDAL_COLORS = {
  1: "bg-yellow-400 text-yellow-900",
  2: "bg-gray-300 text-gray-800",
  3: "bg-amber-600 text-amber-100",
};

// Position badge component
const PositionBadge = ({ position }) => {
  if (position <= 3) {
    return (
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${MEDAL_COLORS[position]}`}
      >
        {position}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold">
      {position}
    </span>
  );
};

// Helper to build group title from metadata
const buildGroupTitle = (groupKey, groupBy, metadata, language = "en") => {
  if (groupBy === "gender") {
    return GROUP_LABELS[groupKey]?.[language] || groupKey;
  }

  // Get full category name from metadata
  const categoryName =
    metadata?.categoryNames?.[language] ||
    metadata?.categoryNames?.en ||
    metadata?.categoryAbbr ||
    groupKey.split("_")[0];

  if (groupBy === "category") {
    return categoryName;
  }

  // category_gender format
  if (groupKey.includes("_")) {
    const gen = metadata?.gender || groupKey.split("_")[1];
    const genderLabel = gen === "men" ? "Men" : gen === "women" ? "Women" : gen;

    // Check if category name already ends with the gender to avoid duplication
    // e.g., "Under 13 Men" should not become "Under 13 Men Men"
    const lowerCategoryName = categoryName.toLowerCase();
    if (
      lowerCategoryName.endsWith(" men") ||
      lowerCategoryName.endsWith(" women") ||
      lowerCategoryName.endsWith(" mixed")
    ) {
      return categoryName;
    }

    return `${categoryName} ${genderLabel}`;
  }

  return categoryName;
};

// Ranking Table Component
const RankingTable = ({
  groupKey,
  entries,
  groupBy,
  language = "en",
  scoringMode = "points",
  groupMetadata = {},
  stages = [],
  competition = null,
  rankingSystemName = "",
}) => {
  // Determine group title using metadata for full category names
  const groupTitle = buildGroupTitle(
    groupKey,
    groupBy,
    groupMetadata,
    language
  );

  // Determine if this is athlete or club ranking
  const isAthleteRanking = entries?.[0]?.entityType === "athlete";
  const isMedalMode = scoringMode === "medals";
  const hasMultipleJourneys = stages.length > 1;

  // Get entity name for display
  const getEntityName = (entry) => {
    if (entry.entityType === "athlete") {
      return (
        entry.entity?.fullName ||
        `${entry.entity?.firstName || ""} ${
          entry.entity?.lastName || ""
        }`.trim() ||
        "Unknown Athlete"
      );
    }
    return entry.entity?.name || "Unknown Club";
  };

  // Get club name for athlete entries
  const getClubName = (entry) => {
    if (entry.entityType === "athlete" && entry.club) {
      return entry.club?.name || "";
    }
    return null;
  };

  // Export single table to PDF
  const exportTablePDF = async () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Load assets
    const headerData = await loadImage("/header.png");
    const footerData = await loadImage("/footer.png");

    const fontName = "helvetica";
    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 10;
    const rightMargin = 200;
    const center = 105;
    const bottomMargin = 30;

    // Add header image
    let yPos = 25;
    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      const ratio = imgProps.width / imgProps.height;
      const w = pageWidth;
      const h = w / ratio;
      doc.addImage(headerData, "PNG", 0, 0, w, h);
      yPos = h + 5;
    }

    // Competition info line
    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    const compLocation = competition?.venue?.name || "Tunisia";
    doc.text(compLocation, leftMargin, yPos);

    const compTitle =
      competition?.names?.en || competition?.code || "Competition";
    doc.text(compTitle, center, yPos, { align: "center" });
    doc.text(dateStr, rightMargin, yPos, { align: "right" });

    yPos += 2;
    doc.setLineWidth(0.3);
    doc.line(leftMargin, yPos, rightMargin, yPos);
    yPos += 8;

    // Title
    doc.setFontSize(14);
    doc.setFont(fontName, "bold");
    doc.text(groupTitle, center, yPos, { align: "center" });
    yPos += 6;

    // Subtitle (ranking system name)
    if (rankingSystemName) {
      doc.setFontSize(9);
      doc.setFont(fontName, "normal");
      doc.text(rankingSystemName, center, yPos, { align: "center" });
      yPos += 6;
    }

    // Build table
    let tableHeaders;
    let tableBody;
    let columnStyles;

    if (isAthleteRanking) {
      if (hasMultipleJourneys) {
        tableHeaders = ["#", "Athlete", "Club"];
        stages.forEach((stage, idx) => {
          tableHeaders.push(stage.name || `J${idx + 1}`);
        });
        tableHeaders.push("Total");

        tableBody = entries.map((entry) => {
          const row = [
            entry.rank,
            getEntityName(entry),
            getClubName(entry) || "-",
          ];
          stages.forEach((stage, idx) => {
            row.push(entry.journeyPoints?.[idx] || 0);
          });
          row.push(entry.totalPoints);
          return row;
        });

        columnStyles = {
          0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 45 },
        };
        let col = 3;
        stages.forEach(() => {
          columnStyles[col] = { cellWidth: 14, halign: "center" };
          col++;
        });
        columnStyles[col] = {
          cellWidth: 16,
          halign: "center",
          fontStyle: "bold",
        };
      } else {
        tableHeaders = ["#", "Athlete", "Club", "Points"];
        tableBody = entries.map((entry) => [
          entry.rank,
          getEntityName(entry),
          getClubName(entry) || "-",
          entry.totalPoints,
        ]);

        columnStyles = {
          0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 55 },
          3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        };
      }
    } else if (isMedalMode) {
      tableHeaders = ["#", "Club", "🥇", "🥈", "🥉", "Total"];
      tableBody = entries.map((entry) => [
        entry.rank,
        getEntityName(entry),
        entry.positionCounts?.[1] || 0,
        entry.positionCounts?.[2] || 0,
        entry.positionCounts?.[3] || 0,
        entry.medals?.total ||
          (entry.positionCounts?.[1] || 0) +
            (entry.positionCounts?.[2] || 0) +
            (entry.positionCounts?.[3] || 0),
      ]);

      columnStyles = {
        0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      };
    } else {
      tableHeaders = ["#", "Club", "Points", "1st", "2nd", "3rd", "Races"];
      tableBody = entries.map((entry) => [
        entry.rank,
        getEntityName(entry),
        entry.totalPoints,
        entry.positionCounts?.[1] || 0,
        entry.positionCounts?.[2] || 0,
        entry.positionCounts?.[3] || 0,
        entry.raceCount || entry.raceResults?.length || 0,
      ]);

      columnStyles = {
        0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 12, halign: "center" },
        4: { cellWidth: 12, halign: "center" },
        5: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 14, halign: "center" },
      };
    }

    // Header color
    const headerColor = isMedalMode
      ? [245, 158, 11]
      : isAthleteRanking
      ? [16, 185, 129]
      : [59, 130, 246];

    autoTable(doc, {
      startY: yPos,
      head: [tableHeaders],
      body: tableBody,
      theme: "striped",
      headStyles: {
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
      },
      columnStyles: columnStyles,
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        font: fontName,
      },
      margin: { left: leftMargin, right: 10 },
    });

    // Add footer
    if (footerData) {
      const imgProps = doc.getImageProperties(footerData);
      const ratio = imgProps.width / imgProps.height;
      const w = pageWidth;
      const h = w / ratio;
      doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
    }

    // Save
    const safeTitle = groupTitle.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${competition?.code || "ranking"}_${safeTitle}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Group Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isMedalMode
            ? "bg-gradient-to-r from-amber-500 to-amber-600"
            : isAthleteRanking
            ? "bg-gradient-to-r from-emerald-600 to-emerald-700"
            : "bg-gradient-to-r from-blue-600 to-blue-700"
        }`}
      >
        <div>
          <h3 className="text-lg font-bold text-white">{groupTitle}</h3>
          <p
            className={`text-sm ${
              isMedalMode
                ? "text-amber-100"
                : isAthleteRanking
                ? "text-emerald-100"
                : "text-blue-100"
            }`}
          >
            {isMedalMode
              ? "🏅 Medal Rankings"
              : isAthleteRanking
              ? "🏃 Athlete Rankings"
              : "🏢 Club Rankings"}{" "}
            • {entries?.length || 0} {isAthleteRanking ? "athletes" : "clubs"}
          </p>
        </div>
        <button
          onClick={exportTablePDF}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isMedalMode
              ? "bg-amber-700 hover:bg-amber-800 text-white"
              : isAthleteRanking
              ? "bg-emerald-800 hover:bg-emerald-900 text-white"
              : "bg-blue-800 hover:bg-blue-900 text-white"
          }`}
          title="Export this table to PDF"
        >
          📄 PDF
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-14">
                Rank
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {isAthleteRanking ? "Athlete" : "Club"}
              </th>
              {isAthleteRanking && (
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Club
                </th>
              )}
              {/* For athlete ranking with multiple journeys, show journey columns */}
              {isAthleteRanking && hasMultipleJourneys ? (
                <>
                  {stages.map((stage, idx) => (
                    <th
                      key={idx}
                      className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16"
                      title={stage.name}
                    >
                      {stage.name || `J${idx + 1}`}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                    Total
                  </th>
                </>
              ) : isAthleteRanking ? (
                /* Single journey athlete ranking - just show Points */
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                  Points
                </th>
              ) : isMedalMode ? (
                /* Medal mode */
                <>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                    🥇
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                    🥈
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                    🥉
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                    Total
                  </th>
                </>
              ) : (
                /* Club ranking */
                <>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                    Points
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-14">
                    🥇
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-14">
                    🥈
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-14">
                    🥉
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                    Races
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries?.map((entry, idx) => (
              <tr
                key={entry.entityId || idx}
                className={`hover:bg-slate-50 transition-colors ${
                  entry.rank <= 3 ? "bg-amber-50/30" : ""
                }`}
              >
                <td className="px-3 py-3">
                  <PositionBadge position={entry.rank} />
                </td>
                <td className="px-3 py-3">
                  <span className="font-medium text-slate-900">
                    {getEntityName(entry)}
                  </span>
                </td>
                {isAthleteRanking && (
                  <td className="px-3 py-3 text-slate-600 text-sm">
                    {getClubName(entry) || "-"}
                  </td>
                )}
                {/* Athlete ranking with multiple journeys */}
                {isAthleteRanking && hasMultipleJourneys ? (
                  <>
                    {stages.map((stage, idx) => (
                      <td
                        key={idx}
                        className="px-2 py-3 text-center text-slate-600"
                      >
                        {entry.journeyPoints?.[idx] || 0}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">
                        {entry.totalPoints}
                      </span>
                    </td>
                  </>
                ) : isAthleteRanking ? (
                  /* Single journey athlete ranking */
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">
                      {entry.totalPoints}
                    </span>
                  </td>
                ) : isMedalMode ? (
                  /* Medal mode */
                  <>
                    <td className="px-3 py-3 text-center text-slate-600 font-medium">
                      {entry.positionCounts?.[1] || 0}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600 font-medium">
                      {entry.positionCounts?.[2] || 0}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600 font-medium">
                      {entry.positionCounts?.[3] || 0}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-800">
                        {entry.medals?.total ||
                          (entry.positionCounts?.[1] || 0) +
                            (entry.positionCounts?.[2] || 0) +
                            (entry.positionCounts?.[3] || 0)}
                      </span>
                    </td>
                  </>
                ) : (
                  /* Club ranking */
                  <>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full font-bold bg-blue-100 text-blue-800">
                        {entry.totalPoints}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {entry.positionCounts?.[1] || 0}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {entry.positionCounts?.[2] || 0}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-600">
                      {entry.positionCounts?.[3] || 0}
                    </td>
                    <td className="px-3 py-3 text-center text-slate-500">
                      {entry.raceCount || entry.raceResults?.length || 0}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {(!entries || entries.length === 0) && (
              <tr>
                <td
                  colSpan={
                    isAthleteRanking
                      ? hasMultipleJourneys
                        ? 4 + stages.length
                        : 4
                      : isMedalMode
                      ? 6
                      : 7
                  }
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No ranking data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Point Table Legend
const PointTableLegend = () => (
  <div className="bg-slate-50 rounded-lg p-4 mb-6">
    <h4 className="font-semibold text-slate-700 mb-2">Point Table</h4>
    <div className="flex flex-wrap gap-3 text-sm">
      {[
        { pos: "1st", pts: 20 },
        { pos: "2nd", pts: 12 },
        { pos: "3rd", pts: 8 },
        { pos: "4th", pts: 6 },
        { pos: "5th", pts: 4 },
        { pos: "6th", pts: 3 },
        { pos: "7th", pts: 2 },
        { pos: "8th", pts: 1 },
      ].map(({ pos, pts }) => (
        <span
          key={pos}
          className="bg-white px-2 py-1 rounded border border-slate-200"
        >
          <span className="font-medium">{pos}:</span> {pts} pts
        </span>
      ))}
      <span className="bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">
        9th+: 0 pts
      </span>
    </div>
  </div>
);

// Main Component
export default function CompetitionRankings() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  // State
  const [competition, setCompetition] = useState(null);
  const [rankingSystems, setRankingSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [rankingData, setRankingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [includeMasters, setIncludeMasters] = useState(true);

  // Fetch competition details
  useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setCompetition(data);
        }
      } catch (error) {
        console.error("Error fetching competition:", error);
        toast.error("Failed to load competition");
      }
    };

    if (competitionId && token) {
      fetchCompetition();
    }
  }, [competitionId, token]);

  // Fetch available ranking systems
  useEffect(() => {
    const fetchRankingSystems = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}/available-systems`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setRankingSystems(data.availableSystems || []);
          // Auto-select first system
          if (data.availableSystems?.length > 0) {
            setSelectedSystemId(data.availableSystems[0]._id);
          }
        }
      } catch (error) {
        console.error("Error fetching ranking systems:", error);
      } finally {
        setLoading(false);
      }
    };

    if (competitionId && token) {
      fetchRankingSystems();
    }
  }, [competitionId, token]);

  // Fetch ranking data when system or includeMasters changes
  useEffect(() => {
    const fetchRanking = async () => {
      if (!selectedSystemId) {
        setRankingData(null);
        return;
      }

      setRankingLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}?systemId=${selectedSystemId}&summary=true&includeMasters=${includeMasters}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setRankingData(data);
        } else {
          toast.error("Failed to load ranking");
        }
      } catch (error) {
        console.error("Error fetching ranking:", error);
        toast.error("Failed to load ranking");
      } finally {
        setRankingLoading(false);
      }
    };

    if (selectedSystemId && token) {
      fetchRanking();
    }
  }, [competitionId, selectedSystemId, includeMasters, token]);

  // Get selected system info
  const selectedSystem = useMemo(() => {
    return rankingSystems.find((s) => s._id === selectedSystemId);
  }, [rankingSystems, selectedSystemId]);

  // Export PDF
  const exportPDF = useCallback(async () => {
    if (!rankingData || !selectedSystem) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Load assets
    const headerData = await loadImage("/header.png");
    const footerData = await loadImage("/footer.png");
    const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");

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
    const leftMargin = 10;
    const rightMargin = 200;
    const center = 105;
    const bottomMargin = 30; // 30mm margin for footer

    // Determine entity type and scoring mode
    const isAthleteRanking = rankingData.entityType === "athlete";
    const isMedalMode = rankingData.scoringMode === "medals";

    // Get journey/stage info
    const stages = rankingData.stages || [];
    const hasMultipleJourneys = stages.length > 1;

    // Calculate header/footer dimensions
    let headerHeight = 25;
    let footerHeight = bottomMargin;

    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      const ratio = imgProps.width / imgProps.height;
      const h = pageWidth / ratio;
      headerHeight = h + 5;
    }

    // Function to add header to a page
    const addHeader = (isFirstPage = false) => {
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        doc.addImage(headerData, "PNG", 0, 0, w, h);
      }

      let y = headerHeight;

      // Competition info line
      const dateStr = new Date().toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      const compLocation = competition?.venue?.name || "Tunisia";
      doc.text(compLocation, leftMargin, y);

      const compTitle =
        competition?.names?.en || competition?.code || "Competition";
      doc.text(compTitle, center, y, { align: "center" });
      doc.text(dateStr, rightMargin, y, { align: "right" });

      y += 2;
      doc.setLineWidth(0.3);
      doc.line(leftMargin, y, rightMargin, y);

      // Only show title on first page
      if (isFirstPage) {
        y += 8;

        // Ranking system title
        doc.setFontSize(14);
        doc.setFont(fontName, "bold");
        doc.text(selectedSystem.names?.en || "Rankings", center, y, {
          align: "center",
        });

        // Arabic subtitle
        if (arabicFontName && selectedSystem.names?.ar) {
          y += 5;
          doc.setFontSize(11);
          doc.setFont(arabicFontName, "normal");
          doc.text(selectedSystem.names.ar, center, y, { align: "center" });
          doc.setFont(fontName, "normal");
        }

        y += 8;

        // Point table legend (skip for medal mode and athlete ranking)
        if (!isMedalMode && !isAthleteRanking) {
          doc.setFontSize(7);
          doc.setFont(fontName, "normal");
          doc.text(
            "Points: 1st=20 | 2nd=12 | 3rd=8 | 4th=6 | 5th=4 | 6th=3 | 7th=2 | 8th=1",
            center,
            y,
            { align: "center" }
          );
          y += 6;
        } else {
          y += 2;
        }
      } else {
        y += 6;
      }

      return y;
    };

    // Function to add footer to a page
    const addFooter = () => {
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        // Position footer with proper margin
        doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
      }
    };

    // Get entity name for display
    const getEntityName = (entry) => {
      if (entry.entityType === "athlete") {
        return (
          entry.entity?.fullName ||
          `${entry.entity?.firstName || ""} ${
            entry.entity?.lastName || ""
          }`.trim() ||
          "Unknown Athlete"
        );
      }
      return entry.entity?.name || "Unknown Club";
    };

    // Start rendering
    let yPos = addHeader(true);
    addFooter();

    // Calculate usable page area (between header and footer)
    const contentBottom = pageHeight - footerHeight - 5;

    // Render each group
    const groups = Object.entries(rankingData.rankings || {});

    for (const [groupKey, entries] of groups) {
      // Check if we need a new page
      if (yPos > contentBottom - 40) {
        doc.addPage();
        yPos = addHeader(false);
        addFooter();
      }

      // Group title - use full category name from metadata
      const metadata = rankingData.groupMetadata?.[groupKey];
      const groupTitle = buildGroupTitle(
        groupKey,
        rankingData.groupBy,
        metadata,
        "en"
      );

      doc.setFontSize(11);
      doc.setFont(fontName, "bold");
      doc.text(groupTitle, leftMargin, yPos);
      yPos += 5;

      // Build table data and headers based on entity type
      let tableHeaders;
      let tableBody;
      let columnStyles;

      if (isAthleteRanking) {
        // ATHLETE RANKING: Show journey points instead of 1st/2nd/3rd
        if (hasMultipleJourneys) {
          // Multiple journeys: Rank | Athlete | Club | J1 | J2 | ... | Total
          tableHeaders = ["#", "Athlete", "Club"];
          stages.forEach((stage, idx) => {
            tableHeaders.push(stage.name || `J${idx + 1}`);
          });
          tableHeaders.push("Total");

          tableBody = entries.map((entry) => {
            const row = [
              entry.rank,
              getEntityName(entry),
              entry.club?.name || "-",
            ];
            stages.forEach((stage, idx) => {
              row.push(entry.journeyPoints?.[idx] || 0);
            });
            row.push(entry.totalPoints);
            return row;
          });

          // Column styles for athlete with journeys
          columnStyles = {
            0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
            1: { cellWidth: "auto" }, // Athlete name - auto expand
            2: { cellWidth: 45 }, // Club - wider column
          };
          let col = 3;
          stages.forEach(() => {
            columnStyles[col] = { cellWidth: 14, halign: "center" };
            col++;
          });
          columnStyles[col] = {
            cellWidth: 16,
            halign: "center",
            fontStyle: "bold",
          }; // Total
        } else {
          // Single journey: Rank | Athlete | Club | Points
          tableHeaders = ["#", "Athlete", "Club", "Points"];
          tableBody = entries.map((entry) => [
            entry.rank,
            getEntityName(entry),
            entry.club?.name || "-",
            entry.totalPoints,
          ]);

          columnStyles = {
            0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 55 }, // Club - wider column
            3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          };
        }
      } else if (isMedalMode) {
        // MEDAL MODE: Rank | Club | 🥇 | 🥈 | 🥉 | Total
        tableHeaders = ["#", "Club", "🥇", "🥈", "🥉", "Total"];
        tableBody = entries.map((entry) => [
          entry.rank,
          getEntityName(entry),
          entry.positionCounts?.[1] || 0,
          entry.positionCounts?.[2] || 0,
          entry.positionCounts?.[3] || 0,
          entry.medals?.total ||
            (entry.positionCounts?.[1] || 0) +
              (entry.positionCounts?.[2] || 0) +
              (entry.positionCounts?.[3] || 0),
        ]);

        columnStyles = {
          0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" }, // Club - auto expand
          2: { cellWidth: 14, halign: "center" },
          3: { cellWidth: 14, halign: "center" },
          4: { cellWidth: 14, halign: "center" },
          5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        };
      } else {
        // CLUB RANKING: Rank | Club | Points | 1st | 2nd | 3rd | Races
        tableHeaders = ["#", "Club", "Points", "1st", "2nd", "3rd", "Races"];
        tableBody = entries.map((entry) => [
          entry.rank,
          getEntityName(entry),
          entry.totalPoints,
          entry.positionCounts?.[1] || 0,
          entry.positionCounts?.[2] || 0,
          entry.positionCounts?.[3] || 0,
          entry.raceCount || entry.raceResults?.length || 0,
        ]);

        columnStyles = {
          0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" }, // Club - auto expand
          2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 12, halign: "center" },
          4: { cellWidth: 12, halign: "center" },
          5: { cellWidth: 12, halign: "center" },
          6: { cellWidth: 14, halign: "center" },
        };
      }

      // Header color based on mode
      const headerColor = isMedalMode
        ? [245, 158, 11] // Amber for medals
        : isAthleteRanking
        ? [16, 185, 129] // Emerald for athletes
        : [59, 130, 246]; // Blue for clubs

      autoTable(doc, {
        startY: yPos,
        head: [tableHeaders],
        body: tableBody,
        theme: "striped",
        headStyles: {
          fillColor: headerColor,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7,
        },
        columnStyles: columnStyles,
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
          font: fontName,
        },
        margin: { left: leftMargin, right: 10 },
        // Handle page breaks with header/footer
        didDrawPage: (data) => {
          // Add header and footer to new pages created by autoTable
          if (data.pageNumber > 1) {
            addHeader(false);
            addFooter();
          }
        },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Save
    const fileName = `Rankings_${competition?.code || "competition"}_${
      selectedSystem.code
    }.pdf`;
    doc.save(fileName);
    toast.success("PDF exported successfully");
  }, [rankingData, selectedSystem, competition]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(`/competitions/${competitionId}/races`)}
            className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-flex items-center gap-1"
          >
            ← Back to Races
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {competition?.names?.en || "Competition"} - Rankings
          </h1>
          <p className="text-slate-500">
            View point-based rankings for this competition
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={exportPDF}
            disabled={!rankingData || rankingLoading}
          >
            📄 Export PDF
          </Button>
        </div>
      </div>

      {/* Ranking System Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm font-medium text-slate-700 mb-1">
              Ranking System
            </Label>
            <Select
              value={selectedSystemId}
              onChange={(e) => setSelectedSystemId(e.target.value)}
              className="w-full"
            >
              <option value="">Select a ranking system...</option>
              {rankingSystems.map((system) => (
                <option key={system._id} value={system._id}>
                  {system.names?.en || system.code} ({system.groupBy})
                </option>
              ))}
            </Select>
          </div>

          {/* Masters Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includeMasters"
              checked={includeMasters}
              onChange={(e) => setIncludeMasters(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <Label
              htmlFor="includeMasters"
              className="text-sm text-slate-700 cursor-pointer"
            >
              Include Masters
            </Label>
          </div>
        </div>

        {selectedSystem && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500">
            <span className="font-medium">Entity:</span>{" "}
            {selectedSystem.entityType === "athlete" ? "Athletes" : "Clubs"}
            {" • "}
            <span className="font-medium">Groups by:</span>{" "}
            {selectedSystem.groupBy === "gender"
              ? "Gender"
              : selectedSystem.groupBy === "category"
              ? "Age Category"
              : "Category + Gender"}
            {selectedSystem.boatClassFilter === "skiff_only" && (
              <span className="ml-2 text-amber-600">(Skiff only)</span>
            )}
          </div>
        )}
      </div>

      {/* Point Table Legend */}
      <PointTableLegend />

      {/* Loading State */}
      {rankingLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-500">Calculating rankings...</span>
        </div>
      )}

      {/* Rankings Display */}
      {!rankingLoading && rankingData && (
        <div>
          {Object.entries(rankingData.rankings || {}).length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                No Rankings Available
              </h3>
              <p className="text-slate-500">
                There are no completed races with results yet. Rankings will
                appear once race results are entered.
              </p>
            </div>
          ) : (
            Object.entries(rankingData.rankings).map(([groupKey, entries]) => (
              <RankingTable
                key={groupKey}
                groupKey={groupKey}
                entries={entries}
                groupBy={rankingData.groupBy}
                scoringMode={rankingData.scoringMode || "points"}
                groupMetadata={rankingData.groupMetadata?.[groupKey]}
                stages={rankingData.stages || []}
                competition={competition}
                rankingSystemName={selectedSystem?.names?.en || ""}
              />
            ))
          )}
        </div>
      )}

      {/* No System Selected */}
      {!rankingLoading && !selectedSystemId && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Select a Ranking System
          </h3>
          <p className="text-slate-500">
            Choose a ranking system above to view the competition rankings.
          </p>
        </div>
      )}

      {/* Generation Info */}
      {rankingData?.generatedAt && (
        <div className="mt-4 text-center text-sm text-slate-400">
          Rankings generated at{" "}
          {new Date(rankingData.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
