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

// Ranking Table Component
const RankingTable = ({ groupKey, entries, groupBy, language = "en" }) => {
  // Determine group title
  let groupTitle = groupKey;
  if (groupBy === "gender") {
    groupTitle = GROUP_LABELS[groupKey]?.[language] || groupKey;
  } else if (groupKey.includes("_")) {
    // category_gender format like "SEN_men"
    const [cat, gen] = groupKey.split("_");
    const genderLabel = gen === "men" ? "Men" : gen === "women" ? "Women" : gen;
    groupTitle = `${cat} ${genderLabel}`;
  }

  const isClubRanking = entries?.[0]?.entityType === "club";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-6">
      {/* Group Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
        <h3 className="text-lg font-bold text-white">{groupTitle}</h3>
        <p className="text-blue-100 text-sm">
          {isClubRanking ? "Club Rankings" : "Athlete Rankings"} •{" "}
          {entries?.length || 0} entries
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {isClubRanking ? "Club" : "Athlete"}
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                Points
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                🥇
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                🥈
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-16">
                🥉
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                Races
              </th>
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
                <td className="px-4 py-3">
                  <PositionBadge position={entry.rank} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-900">
                    {entry.entityName || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                    {entry.totalPoints}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {entry.firstPlaces || 0}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {entry.secondPlaces || 0}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {entry.thirdPlaces || 0}
                </td>
                <td className="px-4 py-3 text-center text-slate-500">
                  {entry.raceCount || 0}
                </td>
              </tr>
            ))}
            {(!entries || entries.length === 0) && (
              <tr>
                <td
                  colSpan={7}
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

  // Fetch ranking data when system changes
  useEffect(() => {
    const fetchRanking = async () => {
      if (!selectedSystemId) {
        setRankingData(null);
        return;
      }

      setRankingLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}?systemId=${selectedSystemId}&summary=true`,
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
  }, [competitionId, selectedSystemId, token]);

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
      doc.addImage(headerData, "PNG", 0, 0, w, h);
      headerHeight = h + 8;
    }

    let yPos = headerHeight;

    // Competition title
    const dateStr = new Date().toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    doc.setFontSize(10);
    doc.setFont(fontName, "normal");
    const compLocation = competition?.venue?.name || "Tunisia";
    doc.text(compLocation, leftMargin, yPos);

    const compTitle =
      competition?.names?.en || competition?.code || "Competition";
    doc.text(compTitle, center, yPos, { align: "center" });
    doc.text(dateStr, rightMargin, yPos, { align: "right" });

    yPos += 3;
    doc.setLineWidth(0.5);
    doc.line(leftMargin, yPos, rightMargin, yPos);
    yPos += 10;

    // Ranking system title
    doc.setFontSize(18);
    doc.setFont(fontName, "bold");
    doc.text(selectedSystem.names?.en || "Rankings", center, yPos, {
      align: "center",
    });

    // Arabic subtitle
    if (arabicFontName && selectedSystem.names?.ar) {
      yPos += 6;
      doc.setFontSize(14);
      doc.setFont(arabicFontName, "normal");
      doc.text(selectedSystem.names.ar, center, yPos, { align: "center" });
      doc.setFont(fontName, "normal");
    }

    yPos += 10;

    // Point table legend
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.text(
      "Points: 1st=20 | 2nd=12 | 3rd=8 | 4th=6 | 5th=4 | 6th=3 | 7th=2 | 8th=1",
      center,
      yPos,
      { align: "center" }
    );
    yPos += 8;

    // Render each group
    const groups = Object.entries(rankingData.rankings || {});

    for (const [groupKey, entries] of groups) {
      // Check if we need a new page
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }

      // Group title
      let groupTitle = groupKey;
      if (rankingData.groupBy === "gender") {
        groupTitle = GROUP_LABELS[groupKey]?.en || groupKey;
      } else if (groupKey.includes("_")) {
        const [cat, gen] = groupKey.split("_");
        const genderLabel =
          gen === "men" ? "Men" : gen === "women" ? "Women" : gen;
        groupTitle = `${cat} ${genderLabel}`;
      }

      doc.setFontSize(14);
      doc.setFont(fontName, "bold");
      doc.text(groupTitle, leftMargin, yPos);
      yPos += 6;

      // Table
      const tableBody = entries.map((entry) => [
        entry.rank,
        entry.entityName || "Unknown",
        entry.totalPoints,
        entry.firstPlaces || 0,
        entry.secondPlaces || 0,
        entry.thirdPlaces || 0,
        entry.raceCount || 0,
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Rank", "Name", "Points", "1st", "2nd", "3rd", "Races"]],
        body: tableBody,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 20, halign: "center", fontStyle: "bold" },
          3: { cellWidth: 15, halign: "center" },
          4: { cellWidth: 15, halign: "center" },
          5: { cellWidth: 15, halign: "center" },
          6: { cellWidth: 18, halign: "center" },
        },
        styles: {
          fontSize: 9,
          cellPadding: 2,
          font: fontName,
        },
        margin: { left: leftMargin, right: 14 },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Footer
    if (footerData) {
      const imgProps = doc.getImageProperties(footerData);
      const ratio = imgProps.width / imgProps.height;
      const w = pageWidth;
      const h = w / ratio;
      doc.addImage(footerData, "PNG", 0, pageHeight - h, w, h);
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
          {selectedSystem && (
            <div className="text-sm text-slate-500">
              <span className="font-medium">Groups by:</span>{" "}
              {selectedSystem.groupBy === "gender"
                ? "Gender (Men's Cup / Women's Cup)"
                : selectedSystem.groupBy === "category"
                ? "Age Category"
                : "Category + Gender"}
              {" • "}
              <span className="font-medium">Journeys:</span>{" "}
              {selectedSystem.journeyMode === "all"
                ? "All"
                : selectedSystem.journeyMode === "final_only"
                ? "Final Only"
                : "Best N"}
            </div>
          )}
        </div>
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
