import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { useCountries } from "../hooks/useCountries";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { generateRaceCode } from "../lib/rowing";

const API_BASE_URL = "";

// Helper to load image as base64
const loadImage = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // 2480px ≈ 300 DPI for a full-width A4 banner (210mm) — the previous
      // 1200px cap + JPEG 0.80 re-encode made the federation logo look blurry.
      // Never upscale. JPEG quality 0.92 stays visually crisp at 300 DPI and
      // keeps the PDF small: jsPDF passes JPEGs straight through as DCT
      // streams, while re-encoded PNGs balloon to tens of MB. White backing
      // first so any transparent header area stays white on the page.
      const MAX_WIDTH = 2480;
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => resolve(null);
    img.src = `${url}${url.includes("?") ? "&" : "?"}_cb=${Date.now()}`;
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

  if (groupBy === "global") {
    return language === "ar"
      ? "الترتيب العام"
      : language === "fr"
        ? "Classement Global"
        : "Global Ranking";
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
  includePenalties = false,
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
    language,
  );

  const { countryFlag, countryLabel } = useCountries();

  // Determine ranking type
  const isAthleteRanking = entries?.[0]?.entityType === "athlete";
  const isNationRanking = entries?.[0]?.entityType === "nation";
  const isMixedRanking = entries?.[0]?.entityType === "mixed";
  const isCrewRanking = entries?.[0]?.entityType === "crew";
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
    if (entry.entityType === "nation") {
      const nationCode = entry.entityId || entry.entity?.code;
      return countryLabel(nationCode) || nationCode || "Unknown";
    }
    if (entry.entityType === "mixed") {
      if (entry.entityKind === "nation") {
        const nationCode = entry.nationCode || entry.entity?.code;
        return countryLabel(nationCode) || nationCode || "Unknown";
      }
      return (
        entry.entity?.name ||
        entry.entity?.names?.fr ||
        entry.entity?.names?.en ||
        entry.entity?.code ||
        "Unknown Club"
      );
    }
    if (entry.entityType === "crew") {
      // Crew slot: show "EPT 1", "ASL 2", etc.
      return (
        entry.entity?.name ||
        entry.entity?.label ||
        `${entry.entity?.club?.name || entry.entity?.club?.code || "?"} ${entry.entity?.crewNumber ?? ""}`.trim() ||
        "Unknown Crew"
      );
    }
    // Default: club
    return entry.entity?.name || entry.entity?.names?.fr || entry.entity?.names?.en || entry.entity?.code || "Unknown Club";
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
    const footerData = await loadImage("/sponsors.png");

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
      doc.addImage(headerData, "JPEG", 0, 0, w, h);
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
      tableHeaders = [
        "#",
        isNationRanking
          ? "Country"
          : isMixedRanking
            ? "Nation / Club"
            : "Club",
        "Gold",
        "Silver",
        "Bronze",
        "Total",
      ];
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
      tableHeaders = includePenalties
        ? ["#", "Club", "Penalties", "Total", "1st", "2nd", "3rd", "Races"]
        : ["#", "Club", "Points", "1st", "2nd", "3rd", "Races"];
      tableBody = entries.map((entry) => [
        entry.rank,
        getEntityName(entry),
        ...(includePenalties ? [entry.penaltyPoints || 0] : []),
        entry.totalPoints,
        entry.positionCounts?.[1] || 0,
        entry.positionCounts?.[2] || 0,
        entry.positionCounts?.[3] || 0,
        entry.raceCount || entry.raceResults?.length || 0,
      ]);

      columnStyles = {
        0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
        1: { cellWidth: "auto" },
        ...(includePenalties
          ? {
              2: { cellWidth: 16, halign: "center" },
              3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
              4: { cellWidth: 12, halign: "center" },
              5: { cellWidth: 12, halign: "center" },
              6: { cellWidth: 12, halign: "center" },
              7: { cellWidth: 14, halign: "center" },
            }
          : {
              2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
              3: { cellWidth: 12, halign: "center" },
              4: { cellWidth: 12, halign: "center" },
              5: { cellWidth: 12, halign: "center" },
              6: { cellWidth: 14, halign: "center" },
            }),
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
      margin: { left: leftMargin, right: 10, bottom: bottomMargin },
    });

    // Add footer to every page (sponsors image, or a minimal drawn fallback
    // with page numbers when the image is unavailable)
    const tablePageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= tablePageCount; i++) {
      doc.setPage(i);
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        doc.addImage(footerData, "JPEG", 0, pageHeight - h, w, h);
      } else {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(leftMargin, pageHeight - 14, rightMargin, pageHeight - 14);
        doc.setFontSize(7);
        doc.setFont(fontName, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          competition?.names?.en || competition?.code || "TRF Portal",
          leftMargin,
          pageHeight - 9,
        );
        doc.text(`Page ${i} / ${tablePageCount}`, rightMargin, pageHeight - 9, {
          align: "right",
        });
        doc.setTextColor(0, 0, 0);
      }
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
                : isCrewRanking
                  ? "🚣 Crew Rankings"
                  : "🏢 Club Rankings"}{" "}
            • {entries?.length || 0}{" "}
            {isAthleteRanking
              ? "athletes"
              : isNationRanking
                ? "countries"
                : isMixedRanking
                  ? "nations & clubs"
                  : isCrewRanking
                    ? "crews"
                    : "clubs"}
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
                {isAthleteRanking
                  ? "Athlete"
                  : isNationRanking
                    ? "Country"
                    : isMixedRanking
                      ? "Nation / Club"
                      : isCrewRanking
                        ? "Crew"
                        : "Club"}
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
                  {includePenalties && (
                    <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                      Penalties
                    </th>
                  )}
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-20">
                    Total
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
                  {(() => {
                    const isNationRow =
                      isNationRanking ||
                      (isMixedRanking && entry.entityKind === "nation");
                    const nationCode = isNationRow
                      ? entry.nationCode ||
                        (isMixedRanking ? entry.entity?.code : entry.entityId) ||
                        entry.entity?.code
                      : null;
                    if (isNationRow && nationCode) {
                      return (
                        <span className="font-medium text-slate-900 inline-flex items-center gap-2">
                          <img
                            src={countryFlag(nationCode)}
                            alt={nationCode || ""}
                            className="inline-block w-[18px] h-[12px]"
                          />
                          {getEntityName({ ...entry, nationCode })}
                        </span>
                      );
                    }
                    return (
                      <span className="font-medium text-slate-900 inline-flex items-center gap-2">
                        {isMixedRanking && entry.entityKind === "club" && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-100 text-blue-700 text-xs font-bold">
                            🏢
                          </span>
                        )}
                        {getEntityName(entry)}
                      </span>
                    );
                  })()}
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
                    {includePenalties && (
                      <td className="px-3 py-3 text-center text-slate-600">
                        {entry.penaltyPoints || 0}
                      </td>
                    )}
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
                        : includePenalties
                          ? 8
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

// Top 3 Medal List — per-event podium tables in the federation document style:
// centered event title with the boat code on the right, then a bordered
// Rank | Ctry Code / Club | Name table.
const PodiumsView = ({ podiumData, countryFlag }) => {
  const events = (podiumData?.categories || []).flatMap(({ groupKey, events: categoryEvents }) =>
    categoryEvents.map((event) => ({
      ...event,
      categoryMeta: podiumData.groupMetadata?.[groupKey] || {},
    })),
  );

  const formatEventTitle = (event) => {
    const categoryName =
      event.categoryMeta?.categoryNames?.en ||
      event.categoryMeta?.categoryAbbr ||
      "";
    const boatName = event.boatClass?.names?.en || event.boatClass?.code || "";
    return `${categoryName} ${boatName}`.trim();
  };

  const formatEventCode = (event) => {
    const meta = event.categoryMeta || {};
    return (
      generateRaceCode(
        {
          abbreviation: meta.categoryAbbr,
          gender: meta.gender,
          titles: meta.categoryNames,
        },
        event.boatClass || {},
      ) || "—"
    );
  };

  const formatEventAffiliation = (event, entry) => {
    if (event.nationMode) {
      return entry.countryCode || entry.representingNation || entry.clubCode || "—";
    }
    return entry.clubCode || entry.clubName || "—";
  };

  return (
    <div>
      {events.map((event) => {
        // International events always show country codes: decided by the
        // competition scope or the category type — never by per-lane flags
        // alone, which international races often leave unset.
        const nationMode =
          podiumData.isInternational === true ||
          event.categoryMeta?.categoryType === "international" ||
          (event.podium || []).some(
            (entry) => entry.representingType === "nation",
          );
        event.nationMode = nationMode;
        const fullClubName = (entry) =>
          entry.clubName || entry.clubCode || "—";
        return (
          <div
            key={event.eventKey}
            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-6"
          >
            {/* Event title + boat code, like the printed medal list */}
            <div className="relative px-4 py-3 border-b border-slate-300">
              <h3 className="text-center text-base font-bold text-slate-900 px-24">
                {formatEventTitle(event)}
              </h3>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-900">
                {formatEventCode(event)}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="px-3 py-2.5 w-20 text-center text-sm font-bold text-slate-900">
                    Rank
                  </th>
                  <th className="px-3 py-2.5 w-36 text-center text-sm font-bold text-slate-900">
                    {nationMode ? "Ctry Code" : "Club"}
                  </th>
                  <th className="px-3 py-2.5 text-center text-sm font-bold text-slate-900">
                    Name
                  </th>
                </tr>
              </thead>
              <tbody>
                {(event.podium || []).map((entry) => {
                  const names = (entry.name || "")
                    .split(", ")
                    .filter(Boolean);
                  return (
                    <tr
                      key={entry.position}
                      className="border-b border-slate-200 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 text-center text-sm text-slate-800">
                        {entry.position}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center text-sm text-slate-800"
                        title={
                          nationMode
                            ? entry.countryCode || entry.representingNation || ""
                            : fullClubName(entry)
                        }
                      >
                        {nationMode ? (
                          <span className="inline-flex items-center justify-center gap-2">
                            {countryFlag &&
                              (entry.countryCode ||
                                entry.representingNation) && (
                                <img
                                  src={
                                    countryFlag(
                                      entry.countryCode ||
                                        entry.representingNation,
                                    ) || undefined
                                  }
                                  alt=""
                                  className="w-5 h-3.5 object-cover rounded-sm"
                                />
                              )}
                            {formatEventAffiliation(event, entry)}
                          </span>
                        ) : (
                          formatEventAffiliation(event, entry)
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-slate-900">
                        {names.length > 1
                          ? names.map((name, i) => <div key={i}>{name}</div>)
                          : names[0] || "—"}
                      </td>
                    </tr>
                  );
                })}
                {(event.podium || []).length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-3 text-center text-sm text-slate-400"
                    >
                      No finishers recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
};

// Main Component
export default function CompetitionRankings() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const { countryLabel, countryFlag } = useCountries();
  const unauthorizedRedirectedRef = React.useRef(false);

  // State
  const [competition, setCompetition] = useState(null);
  const [rankingSystems, setRankingSystems] = useState([]);
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [rankingData, setRankingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [includeMasters, setIncludeMasters] = useState(true);
  const [includePenalties, setIncludePenalties] = useState(false);
  const [viewMode, setViewMode] = useState("rankings"); // "rankings" | "podiums"
  const [podiumData, setPodiumData] = useState(null);
  const [podiumLoading, setPodiumLoading] = useState(false);

  const handleUnauthorized = useCallback(
    (message = "Session expired. Please login again.") => {
      if (unauthorizedRedirectedRef.current) {
        return true;
      }
      unauthorizedRedirectedRef.current = true;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setLoading(false);
      toast.error(message);
      navigate("/login", { replace: true });
      return true;
    },
    [navigate],
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!token) {
      handleUnauthorized("Please login to access competition rankings.");
    }
  }, [authLoading, handleUnauthorized, token]);

  // Fetch competition details
  useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.status === 401) {
          handleUnauthorized("Not authorized to access this route");
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setCompetition(data);
        }
      } catch (error) {
        console.error("Error fetching competition:", error);
        toast.error("Failed to load competition");
      }
    };

    if (competitionId && token && !authLoading) {
      fetchCompetition();
    }
  }, [authLoading, competitionId, handleUnauthorized, token]);

  // Fetch available ranking systems
  useEffect(() => {
    const fetchRankingSystems = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}/available-systems`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.status === 401) {
          handleUnauthorized("Not authorized to access this route");
          return;
        }
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

    if (competitionId && token && !authLoading) {
      fetchRankingSystems();
    }
  }, [authLoading, competitionId, handleUnauthorized, token]);

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
          `${API_BASE_URL}/api/rankings/competition/${competitionId}?systemId=${selectedSystemId}&summary=true&includeMasters=${includeMasters}&includePenalties=${includePenalties}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.status === 401) {
          handleUnauthorized("Not authorized to access this route");
          return;
        }
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

    if (selectedSystemId && token && !authLoading) {
      fetchRanking();
    }
  }, [
    authLoading,
    competitionId,
    handleUnauthorized,
    selectedSystemId,
    includeMasters,
    includePenalties,
    token,
  ]);

  // Fetch podiums when the podiums view is opened or Include Masters changes
  useEffect(() => {
    const fetchPodiums = async () => {
      setPodiumLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rankings/competition/${competitionId}/podiums?includeMasters=${includeMasters}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.status === 401) {
          handleUnauthorized("Not authorized to access this route");
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setPodiumData(data);
        } else {
          toast.error("Failed to load podiums");
        }
      } catch (error) {
        console.error("Error fetching podiums:", error);
        toast.error("Failed to load podiums");
      } finally {
        setPodiumLoading(false);
      }
    };

    if (viewMode === "podiums" && competitionId && token && !authLoading) {
      fetchPodiums();
    }
  }, [
    authLoading,
    competitionId,
    handleUnauthorized,
    includeMasters,
    token,
    viewMode,
  ]);

  // Get selected system info
  const selectedSystem = useMemo(() => {
    return rankingSystems.find((s) => s._id === selectedSystemId);
  }, [rankingSystems, selectedSystemId]);

  // Export PDF
  const exportPDF = useCallback(async () => {
    const getMedalHeader = () => ({
      1: "Gold",
      2: "Silver",
      3: "Bronze",
    });

    if (!rankingData || !selectedSystem) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    // Load assets
    const headerData = await loadImage("/header.png");
    const footerData = await loadImage("/sponsors.png");
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
    const isNationRanking = rankingData.entityType === "nation";
    const isMixedRanking = rankingData.entityType === "mixed";
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
        doc.addImage(headerData, "JPEG", 0, 0, w, h);
      }

      let y = headerHeight;

      // Competition info section
      const eventDateStr = competition?.startDate
        ? new Date(competition.startDate).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });

      doc.setFontSize(14);
      doc.setFont(fontName, "bold");
      const compTitle =
        competition?.names?.en ||
        competition?.name ||
        competition?.code ||
        "Competition";
      doc.text(compTitle, center, y, { align: "center" });

      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      const compLocation =
        competition?.location?.name ||
        competition?.venue?.name ||
        competition?.venue ||
        "Location";
      doc.text(compLocation, leftMargin, y);
      doc.text(eventDateStr, rightMargin, y, { align: "right" });

      y += 2;
      doc.setLineWidth(0.5);
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
            { align: "center" },
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

    // Function to add footer and legend to a page
    const addFooter = (isLastPage = false, pageNo = 1, totalPages = 1) => {
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const ratio = imgProps.width / imgProps.height;
        const w = pageWidth;
        const h = w / ratio;
        doc.addImage(footerData, "JPEG", 0, pageHeight - h, w, h);
      } else {
        // No footer image available — draw a minimal footer so every
        // exported PDF still carries one, with page numbers.
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(leftMargin, pageHeight - 14, rightMargin, pageHeight - 14);
        doc.setFontSize(7);
        doc.setFont(fontName, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          competition?.names?.en || competition?.code || "TRF Portal",
          leftMargin,
          pageHeight - 9,
        );
        doc.text(`Page ${pageNo} / ${totalPages}`, rightMargin, pageHeight - 9, {
          align: "right",
        });
        doc.setTextColor(0, 0, 0);
      }

      // Add legend on the last page
      if (isLastPage) {
        if (isNationRanking) {
          // Collect unique nations
          const nationsSet = new Set();
          Object.values(rankingData.rankings || {}).forEach((entries) => {
            entries.forEach((entry) => {
              if (entry.nationCode) nationsSet.add(entry.nationCode);
            });
          });
          const uniqueNations = Array.from(nationsSet).sort((a, b) =>
            a.localeCompare(b),
          );

          if (uniqueNations.length > 0) {
            const lineHeight = 4;
            const boxHeight = uniqueNations.length * lineHeight + 7;
            const legendY = pageHeight - 38 - boxHeight;

            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, legendY, 190, boxHeight);

            doc.setFontSize(9);
            doc.setFont(fontName, "bold");
            doc.text("Legend:", leftMargin + 2, legendY + 5);

            doc.setFontSize(8);
            let nationY = legendY + 9;

            for (const code of uniqueNations) {
              const name = countryLabel ? countryLabel(code) || code : code;
              doc.setFont(fontName, "bold");
              doc.text(code + ": ", leftMargin + 4, nationY);
              const codeWidth = doc.getTextWidth(code + ": ");
              doc.setFont(fontName, "normal");
              doc.text(name, leftMargin + 4 + codeWidth, nationY);
              nationY += lineHeight;
            }
          }
        } else {
          // Club/athlete legend
          const clubsMap = new Map();
          Object.values(rankingData.rankings || {}).forEach((entries) => {
            entries.forEach((entry) => {
              const isClubRow =
                entry.entityType === "club" ||
                (entry.entityType === "mixed" &&
                  entry.entityKind === "club");
              if (isClubRow && entry.entity?._id) {
                const id = entry.entity._id.toString();
                if (!clubsMap.has(id)) {
                  clubsMap.set(id, entry.entity);
                }
              } else if (entry.entityType === "athlete" && entry.club?._id) {
                const id = entry.club._id.toString();
                if (!clubsMap.has(id)) {
                  clubsMap.set(id, entry.club);
                }
              }
            });
          });

          const uniqueClubs = Array.from(clubsMap.values()).sort((a, b) =>
            (a.code || "").localeCompare(b.code || ""),
          );

          if (uniqueClubs.length > 0) {
            const lineHeight = 4;
            const boxHeight = uniqueClubs.length * lineHeight + 7;
            const legendY = pageHeight - 38 - boxHeight;

            doc.setDrawColor(0);
            doc.setLineWidth(0.3);
            doc.rect(leftMargin, legendY, 190, boxHeight);

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

      if (entry.entityType === "nation") {
        const nationCode = entry.entityId || entry.entity?.code;
        return countryLabel(nationCode) || nationCode || "Unknown";
      }

      if (entry.entityType === "mixed") {
        if (entry.entityKind === "nation") {
          const nationCode = entry.nationCode || entry.entity?.code;
          return countryLabel(nationCode) || nationCode || "Unknown";
        }
        return (
          entry.entity?.name ||
          entry.entity?.names?.fr ||
          entry.entity?.names?.en ||
          entry.entity?.code ||
          "Unknown Club"
        );
      }

      return entry.entity?.name || entry.entity?.names?.fr || entry.entity?.names?.en || entry.entity?.code || (entry.entityType === "crew" ? "Unknown Crew" : "Unknown Club");
    };

    // Start rendering
    let yPos = addHeader(true);

    // Calculate usable page area (between header and footer)
    const contentBottom = pageHeight - footerHeight - 5;

    // Render each group
    const groups = Object.entries(rankingData.rankings || {});

    for (const [groupKey, entries] of groups) {
      // Check if we need a new page
      if (yPos > contentBottom - 40) {
        doc.addPage();
        yPos = addHeader(false);
      }

      // Group title - use full category name from metadata
      const metadata = rankingData.groupMetadata?.[groupKey];
      const groupTitle = buildGroupTitle(
        groupKey,
        rankingData.groupBy,
        metadata,
        "en",
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
        tableHeaders = [
          "#",
          isNationRanking
            ? "Country"
            : isMixedRanking
              ? "Nation / Club"
              : "Club",
          "Gold",
          "Silver",
          "Bronze",
          "Total",
        ];
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
        tableHeaders = rankingData.includePenalties
          ? ["#", "Club", "Penalties", "Total", "1st", "2nd", "3rd", "Races"]
          : ["#", "Club", "Points", "1st", "2nd", "3rd", "Races"];
        tableBody = entries.map((entry) => [
          entry.rank,
          getEntityName(entry),
          ...(rankingData.includePenalties ? [entry.penaltyPoints || 0] : []),
          entry.totalPoints,
          entry.positionCounts?.[1] || 0,
          entry.positionCounts?.[2] || 0,
          entry.positionCounts?.[3] || 0,
          entry.raceCount || entry.raceResults?.length || 0,
        ]);

        columnStyles = rankingData.includePenalties
          ? {
              0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
              1: { cellWidth: "auto" },
              2: { cellWidth: 16, halign: "center" },
              3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
              4: { cellWidth: 12, halign: "center" },
              5: { cellWidth: 12, halign: "center" },
              6: { cellWidth: 12, halign: "center" },
              7: { cellWidth: 14, halign: "center" },
            }
          : {
              0: { cellWidth: 8, halign: "center", fontStyle: "bold" },
              1: { cellWidth: "auto" },
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
        margin: { left: leftMargin, right: 10, bottom: bottomMargin },
        // Handle page breaks with header/footer
        didDrawPage: (data) => {
          // Add header and footer to new pages created by autoTable
          if (data.pageNumber > 1) {
            addHeader(false);
          }
          // Note: Footer is added at the very end of the main loop or on page additions
        },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i === pageCount, i, pageCount);
    }

    // Save
    const fileName = `Rankings_${competition?.code || "competition"}_${
      selectedSystem.code
    }.pdf`;
    doc.save(fileName);
    toast.success("PDF exported successfully");
  }, [rankingData, selectedSystem, competition]);

  // Export the Top 3 Medal List PDF (federation document style)
  const exportPodiumsPDF = useCallback(async () => {
    if (!podiumData) return;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const headerData = await loadImage("/header.png");
    const footerData = await loadImage("/sponsors.png");

    const fontName = "helvetica";
    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 10;
    const rightMargin = 200;
    const center = 105;
    const bottomMargin = 30;

    let headerHeight = 25;
    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      headerHeight = pageWidth / (imgProps.width / imgProps.height) + 5;
    }

    const addHeader = () => {
      if (headerData) {
        const imgProps = doc.getImageProperties(headerData);
        const w = pageWidth;
        const h = w / (imgProps.width / imgProps.height);
        doc.addImage(headerData, "JPEG", 0, 0, w, h);
      }
      let y = headerHeight;
      doc.setFontSize(14);
      doc.setFont(fontName, "bold");
      const compTitle =
        competition?.names?.en || competition?.name || competition?.code || "Competition";
      doc.text(compTitle, center, y, { align: "center" });
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");
      const compLocation =
        competition?.location?.name || competition?.venue?.name || competition?.venue || "";
      doc.text(compLocation, leftMargin, y);

      // Date range like the printed medal list ("11 - 14 September 2025")
      const start = competition?.startDate ? new Date(competition.startDate) : null;
      const end = competition?.endDate ? new Date(competition.endDate) : null;
      let dateStr = "";
      if (start && !Number.isNaN(start.getTime())) {
        if (end && !Number.isNaN(end.getTime())) {
          const sameMonth =
            start.getMonth() === end.getMonth() &&
            start.getFullYear() === end.getFullYear();
          dateStr = sameMonth
            ? `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString(
                "en-GB",
                { month: "long", year: "numeric" },
              )}`
            : `${start.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })} - ${end.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`;
        } else {
          dateStr = start.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
        }
      }
      if (dateStr) {
        doc.text(dateStr, rightMargin, y, { align: "right" });
      }

      y += 2;
      doc.setLineWidth(0.5);
      doc.line(leftMargin, y, rightMargin, y);
    };

    const addFooter = (pageNo = 1, totalPages = 1) => {
      if (footerData) {
        const imgProps = doc.getImageProperties(footerData);
        const w = pageWidth;
        const h = w / (imgProps.width / imgProps.height);
        doc.addImage(footerData, "JPEG", 0, pageHeight - h, w, h);
      } else {
        // No footer image available — draw a minimal footer so every
        // exported PDF still carries one, with page numbers.
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(leftMargin, pageHeight - 14, rightMargin, pageHeight - 14);
        doc.setFontSize(7);
        doc.setFont(fontName, "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(
          competition?.names?.en || competition?.code || "TRF Portal",
          leftMargin,
          pageHeight - 9,
        );
        doc.text(`Page ${pageNo} / ${totalPages}`, rightMargin, pageHeight - 9, {
          align: "right",
        });
        doc.setTextColor(0, 0, 0);
      }
    };

    const events = (podiumData.categories || []).flatMap(
      ({ groupKey, events: categoryEvents }) =>
        categoryEvents.map((event) => ({
          ...event,
          categoryMeta: podiumData.groupMetadata?.[groupKey] || {},
        })),
    );

    const formatEventTitle = (event) => {
      const categoryName =
        event.categoryMeta?.categoryNames?.en ||
        event.categoryMeta?.categoryAbbr ||
        "";
      const boatName = event.boatClass?.names?.en || event.boatClass?.code || "";
      return `${categoryName} ${boatName}`.trim();
    };

    const formatEventCode = (event) => {
      const meta = event.categoryMeta || {};
      return (
        generateRaceCode(
          {
            abbreviation: meta.categoryAbbr,
            gender: meta.gender,
            titles: meta.categoryNames,
          },
          event.boatClass || {},
        ) || "—"
      );
    };

    addHeader();
    let yPos = headerHeight + 10;
    doc.setFontSize(16);
    doc.setFont(fontName, "bold");
    doc.text("Top 3 Medal List", center, yPos, { align: "center" });
    yPos += 10;

    if (events.length === 0) {
      doc.setFontSize(10);
      doc.setFont(fontName, "normal");
      doc.text("No podiums available yet.", center, yPos, { align: "center" });
    }

    for (const event of events) {
      // Mirror the on-screen rule: competition scope / category type decides
      // country display — per-lane representing flags are often unset.
      const nationMode =
        podiumData.isInternational === true ||
        event.categoryMeta?.categoryType === "international" ||
        (event.podium || []).some(
          (entry) => entry.representingType === "nation",
        );

      // Estimate the block height (title + table head + crew name lines) so a
      // section is never split from its heading across a page break.
      const nameLines = (event.podium || []).reduce(
        (sum, entry) =>
          sum + Math.max(1, (entry.name || "").split(", ").length),
        0,
      );
      const blockHeight = 10 + 10 + nameLines * 11 + 6;
      if (yPos + blockHeight > pageHeight - bottomMargin) {
        doc.addPage();
        addHeader();
        yPos = headerHeight + 10;
      }

      doc.setFontSize(12);
      doc.setFont(fontName, "bold");
      doc.text(formatEventTitle(event), center, yPos, { align: "center" });
      doc.text(formatEventCode(event), rightMargin, yPos, { align: "right" });
      yPos += 3;

      const rows = (event.podium || []).map((entry) => [
        String(entry.position),
        nationMode
          ? (
              entry.countryCode ||
              entry.representingNation ||
              entry.clubCode ||
              "—"
            ).toUpperCase()
          : (entry.clubCode || entry.clubName || "—").toUpperCase(),
        (entry.name || "—")
          .split(", ")
          .map((name) => name.toUpperCase())
          .join("\n"),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Rank", nationMode ? "Ctry Code" : "Club", "Name"]],
        body: rows,
        theme: "grid",
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          fontSize: 10,
          lineWidth: 0.4,
          lineColor: [0, 0, 0],
        },
        columnStyles: {
          0: { cellWidth: 22, halign: "center" },
          1: { cellWidth: 32, halign: "center" },
          2: { cellWidth: "auto", halign: "left" },
        },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          minCellHeight: 10,
          font: fontName,
          textColor: [0, 0, 0],
          lineWidth: 0.3,
          lineColor: [0, 0, 0],
        },
        margin: {
          left: leftMargin,
          right: 10,
          bottom: bottomMargin,
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addHeader();
          }
        },
      });

      yPos = doc.lastAutoTable.finalY + 10;
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i, pageCount);
    }

    const fileName = `Top3_Medal_List_${competition?.code || "competition"}.pdf`;
    doc.save(fileName);
    toast.success("PDF exported successfully");
  }, [podiumData, competition]);

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
            onClick={() => navigate(-1)}
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
            onClick={viewMode === "podiums" ? exportPodiumsPDF : exportPDF}
            disabled={
              viewMode === "podiums"
                ? !podiumData || podiumLoading
                : !rankingData || rankingLoading
            }
          >
            📄 Export PDF
          </Button>
        </div>
      </div>

      {/* Ranking System Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        {/* View Toggle */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("rankings")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "rankings"
                  ? "bg-white shadow text-blue-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📊 Full Rankings
            </button>
            <button
              onClick={() => setViewMode("podiums")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "podiums"
                  ? "bg-white shadow text-amber-700"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🥇 Top 3 Medal List
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {viewMode === "rankings" && (
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
          )}

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

          {viewMode === "rankings" && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includePenalties"
                checked={includePenalties}
                onChange={(e) => setIncludePenalties(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <Label
                htmlFor="includePenalties"
                className="text-sm text-slate-700 cursor-pointer"
              >
                Include Penalties
              </Label>
            </div>
          )}
        </div>

        {viewMode === "rankings" && selectedSystem && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500">
            <span className="font-medium">Entity:</span>{" "}
            {selectedSystem.entityType === "athlete"
              ? "Athletes"
              : selectedSystem.entityType === "nation"
                ? "Nations"
                : selectedSystem.entityType === "crew"
                  ? "Crews (boat slots)"
                  : selectedSystem.entityType === "mixed"
                    ? "Nations + Clubs"
                    : "Clubs"}
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
            {selectedSystem.boatClassFilter === "crew_only" && (
              <span className="ml-2 text-blue-600">(Crew boats only)</span>
            )}
          </div>
        )}
      </div>

      {/* Point Table Legend (rankings view only) */}
      {viewMode === "rankings" && <PointTableLegend />}

      {/* Loading State */}
      {viewMode === "rankings" && rankingLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-500">Calculating rankings...</span>
        </div>
      )}

      {/* Podiums Loading State */}
      {viewMode === "podiums" && podiumLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          <span className="ml-3 text-slate-500">Loading podiums...</span>
        </div>
      )}

      {/* Podiums Display */}
      {viewMode === "podiums" && !podiumLoading && podiumData && (
        <div>
          {(podiumData.categories || []).length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
              <div className="text-4xl mb-4">🥇</div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                No Podiums Available
              </h3>
              <p className="text-slate-500">
                There are no completed finals yet. Podiums will appear once
                final races are completed.
              </p>
            </div>
          ) : (
            <PodiumsView podiumData={podiumData} countryFlag={countryFlag} />
          )}
        </div>
      )}

      {/* Rankings Display */}
      {viewMode === "rankings" && !rankingLoading && rankingData && (
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
                includePenalties={rankingData.includePenalties === true}
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
      {viewMode === "rankings" && !rankingLoading && !selectedSystemId && (
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
      {viewMode === "rankings" && rankingData?.generatedAt && (
        <div className="mt-4 text-center text-sm text-slate-400">
          Rankings generated at{" "}
          {new Date(rankingData.generatedAt).toLocaleString()}
        </div>
      )}
      {viewMode === "podiums" && podiumData?.generatedAt && (
        <div className="mt-4 text-center text-sm text-slate-400">
          Podiums generated at{" "}
          {new Date(podiumData.generatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}
