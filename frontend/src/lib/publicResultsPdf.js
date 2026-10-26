// ============================================================
//  Public results PDF export (client-side).
//  Generates PDFs in the SAME official model as the admin
//  race-page export (RaceDetail): federation letterhead on top
//  of every page, sponsors band at the bottom, Arabic event
//  titles (Amiri font), the plain black-framed results table
//  with Rank / Lane / Club / Country / Name / Time (+ delta)
//  / Points, the club-or-nation legend box and the status box.
//
//   - generateRaceResultsPdf   → one event (final + its heats)
//   - generateFullResultsPdf   → one consolidated sheet per event, per journey
//
//  Data comes from the same public API payloads shown on the
//  portal; both generators are async (they fetch the letterhead
//  assets) and never reject — they log and give up on failure.
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { countryName } from "./countries";
import {
  formatRaceLabel,
  getEntryNationCode,
} from "./format";

const RULE_RED = [128, 0, 0];
const INK = [0, 0, 0];
const MUTED = [100, 100, 100];
const LEGEND_LINE_HEIGHT = 4;

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

// ---------------------------------------------------------------------------
// Asset + text helpers (mirrors of the RaceDetail admin exporter)
// ---------------------------------------------------------------------------

const loadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve({
        // Cache the dimensions at load: jsPDF's getImageProperties re-parses
        // the whole multi-megabyte data URL on every call, which makes
        // multi-page exports crawl.
        data: canvas.toDataURL("image/png"),
        width: img.width,
        height: img.height,
        format: "PNG",
      });
    };
    img.onerror = () => resolve(null);
    img.src = `${url}${url.includes("?") ? "&" : "?"}_cb=${Date.now()}`;
  });

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
  } catch {
    return null;
  }
};

const headerImageHeight = (header, pageWidth) => {
  if (!header) return 32;
  return pageWidth / (header.width / header.height) + 3 + 8;
};

const drawLetterhead = (doc, header) => {
  if (!header) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  const h = pageWidth / (header.width / header.height);
  doc.addImage(header.data, header.format, 0, 3, pageWidth, h);
  doc.setDrawColor(...RULE_RED);
  doc.setLineWidth(0.8);
  doc.line(14, h + 5, pageWidth - 14, h + 5);
};

const formatEventTitleWithBoatClass = (category, boatClass, language = "en") => {
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
    if (doc.getTextWidth(text) <= maxWidth) break;
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
  if (!safeText) return { lineCount: 0, yEnd: y };

  let size = initialSize;
  let lines = [safeText];

  while (size >= minSize) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    lines = doc.splitTextToSize(safeText, maxWidth);
    if (lines.length <= maxLines) break;
    size -= 0.5;
  }

  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    doc.setFont(font, style);
    doc.setFontSize(Math.max(size, minSize));
    let lastLine = String(lines[maxLines - 1] || "").trim();
    while (lastLine.length > 0 && doc.getTextWidth(`${lastLine}...`) > maxWidth) {
      lastLine = lastLine.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${lastLine}...`;
  }

  doc.setFont(font, style);
  doc.setFontSize(Math.max(size, minSize));
  lines.forEach((line, index) => {
    doc.text(line, center, y + index * lineGap, { align: "center" });
  });

  return { lineCount: lines.length, yEnd: y + (lines.length - 1) * lineGap };
};

// "45.44" under a minute, "4:45.44" above — exactly the admin format.
const formatElapsedTime = (ms) => {
  if (ms === undefined || ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centis
      .toString()
      .padStart(2, "0")}`;
  }
  return `${seconds}.${centis.toString().padStart(2, "0")}`;
};

const formatAsOfLabel = (value = new Date()) =>
  `As of: ${value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

// ---------------------------------------------------------------------------
// Row building
// ---------------------------------------------------------------------------

const STATUS_PRIORITY = { ok: 0, dnf: 1, dns: 2, abs: 3, dsq: 4, hors_course: 5 };
const statusPriority = (status) => STATUS_PRIORITY[status] ?? 10;

/** "First LAST" — the admin convention (surname capitalised). */
const athleteLabel = (athlete) => {
  if (!isObject(athlete)) return "";
  const first = athlete.firstName || "";
  const last = (athlete.lastName || "").toUpperCase();
  return `${first} ${last}`.trim();
};

/** Crew label with bow/stroke markers, matching the admin PDF. */
const crewNamesLabel = (crewNames) => {
  const members = String(crewNames || "")
    .split(", ")
    .map((name) => name.trim())
    .filter(Boolean);
  if (members.length === 0) return "";
  return members
    .map((name, index) => {
      if (members.length === 1) return name;
      if (index === 0) return `(b) ${name}`;
      if (index === members.length - 1) return `(s) ${name}`;
      return `(${index + 1}) ${name}`;
    })
    .join(" / ");
};

const entryName = (entry) => {
  if (!entry) return "—";
  if (entry.crewNames) return crewNamesLabel(entry.crewNames);
  const name = athleteLabel(entry.athlete);
  if (name) return name;
  return entry.athleteName || "—";
};

const entryClubCode = (entry) => {
  const club = entry?.club;
  if (isObject(club)) {
    return club.code || (club.name || "").slice(0, 3).toUpperCase();
  }
  return (entry?.clubName || "").slice(0, 3).toUpperCase();
};

const entryCountry = (entry, mode, hostCountry) => {
  const code = getEntryNationCode(entry, mode, hostCountry);
  if (code) return code;
  const clubCountry = isObject(entry?.club) ? entry.club.country : "";
  return clubCountry || entryClubCode(entry) || "-";
};

const laneCountry = (lane) => {
  const code = String(lane?.representingNation || "").trim();
  if (code) return code;
  const clubCountry = isObject(lane?.club) ? lane.club.country : "";
  return clubCountry || lane?.clubCode || "-";
};

const sortResultRows = (rows) =>
  rows.sort((a, b) => {
    const p = statusPriority(a.status) - statusPriority(b.status);
    if (p !== 0) return p;
    const posA = Number.isInteger(a.pos) ? a.pos : 999;
    const posB = Number.isInteger(b.pos) ? b.pos : 999;
    if (posA !== posB) return posA - posB;
    return (a.lane || 0) - (b.lane || 0);
  });

const buildEntryRows = ({ entries, mode, hostCountry }) =>
  sortResultRows(
    (entries || []).map((entry) => {
      const status = entry.status || "ok";
      const isHC = status === "hors_course";
      return {
        status,
        isHC,
        pos: isHC
          ? null
          : Number.isInteger(entry.finishPosition)
            ? entry.finishPosition
            : entry.rank ?? null,
        lane: entry.lane || "",
        clubCode: entryClubCode(entry),
        country: entryCountry(entry, mode, hostCountry),
        name: entryName(entry),
        elapsedMs: Number.isFinite(entry.elapsedMs) ? entry.elapsedMs : null,
        points: entry.points ?? "",
      };
    }),
  );

const buildLaneRows = ({ race }) =>
  sortResultRows(
    (race?.lanes || []).map((lane) => {
      const status = lane.result?.status || "ok";
      const isHC = status === "hors_course";
      return {
        status,
        isHC,
        pos: isHC
          ? null
          : Number.isInteger(lane.result?.finishPosition)
            ? lane.result.finishPosition
            : null,
        lane: lane.lane || "",
        clubCode:
          lane.clubCode ||
          (isObject(lane.club) ? lane.club.code : "") ||
          (lane.clubName || "").slice(0, 3).toUpperCase(),
        country: laneCountry(lane),
        name: lane.athleteName || lane.athleteNameAr || "—",
        elapsedMs:
          status === "ok" && Number.isFinite(lane.result?.elapsedMs)
            ? lane.result.elapsedMs
            : null,
        points: "",
      };
    }),
  );

// ---------------------------------------------------------------------------
// Page chrome — event header block, table, status box, legend & footer
// ---------------------------------------------------------------------------

const drawEventHeaderBlock = ({
  doc,
  competition,
  eventLabel,
  eventTitle,
  eventTitleAr,
  eventNumber,
  raceOrder,
  phaseStr,
  startTime,
  distance,
  arabicFontName,
  revised = false,
  yPos: startY,
}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 14;
  const right = pageWidth - 14;
  const center = pageWidth / 2;
  const fontName = "helvetica";
  let yPos = startY;

  doc.setFontSize(14);
  doc.setFont(fontName, "bold");
  doc.text(competition?.names?.en || competition?.code || "Competition", center, yPos, {
    align: "center",
  });

  doc.setFontSize(9);
  doc.setFont(fontName, "normal");
  const location =
    competition?.venue?.name ||
    competition?.venue?.city ||
    competition?.venue?.country ||
    "Tunisia";
  doc.text(String(location), left, yPos);
  // The sheet carries the date its races were actually rowed, not the
  // championship's first day.
  const dateSource =
    startTime?.source ??
    competition?.startDate ??
    null;
  const eventDate = dateSource
    ? new Date(dateSource).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  doc.text(eventDate, right, yPos, { align: "right" });

  yPos += 2;
  doc.setLineWidth(0.5);
  doc.line(left, yPos, right, yPos);
  yPos += 5;

  doc.setFontSize(12);
  doc.setFont(fontName, "bold");
  doc.text(
    Number.isFinite(Number(eventNumber)) && Number(eventNumber) >= 1
      ? `Event ${eventNumber}`
      : `Race ${raceOrder || "1"}`,
    left,
    yPos,
  );
  doc.text("Results", center, yPos, { align: "center" });
  doc.text(eventLabel, right, yPos, { align: "right" });

  // Red REVISED marker between "Results" and the category/boat code.
  if (revised) {
    const labelWidth = doc.getTextWidth(eventLabel);
    const resultsHalfWidth = doc.getTextWidth("Results") / 2;
    const revisedWidth = doc.getTextWidth("REVISED");
    const revisedRight = Math.max(
      center + resultsHalfWidth + 8,
      right - labelWidth - 8,
    );
    const fits =
      revisedRight - revisedWidth > center + resultsHalfWidth + 4 &&
      revisedRight < right - labelWidth;
    doc.setFontSize(fits ? 10 : 8);
    doc.setTextColor(...RULE_RED);
    doc.text("REVISED", revisedRight, yPos, { align: "right" });
    doc.setTextColor(...INK);
    doc.setFontSize(12);
  }

  yPos += 5;
  const titleLayout = drawAdaptiveCenteredTitle({
    doc,
    text: eventTitle,
    center,
    y: yPos,
    maxWidth: right - left,
    font: fontName,
    style: "bold",
    initialSize: 10.5,
    minSize: 8,
    maxLines: 1,
    lineGap: 4,
  });
  yPos = titleLayout.yEnd;

  if (arabicFontName && eventTitleAr) {
    yPos += 5;
    const arabicSize = fitSingleLineFontSize({
      doc,
      text: eventTitleAr,
      maxWidth: 110,
      initialSize: 12,
      minSize: 8.5,
      font: arabicFontName,
      style: "normal",
    });
    doc.setFontSize(arabicSize);
    doc.setFont(arabicFontName, "normal");
    doc.text(eventTitleAr, center, yPos, { align: "center" });
    doc.setFont(fontName, "normal");
    doc.setFontSize(9);
    if (distance) {
      doc.text(`Distance: ${distance}m`, right, yPos, { align: "right" });
    }
  } else if (distance) {
    yPos += 4;
    doc.setFontSize(9);
    doc.text(`Distance: ${distance}m`, center, yPos, { align: "center" });
  }

  yPos += 6;
  doc.setFontSize(9);
  doc.setFont(fontName, "normal");
  doc.text(`Start Time: ${startTime?.label || "00:00"}`, left, yPos);
  doc.setFontSize(10);
  doc.setFont(fontName, "bold");
  doc.text(phaseStr || "Results", center, yPos, { align: "center" });
  doc.setFontSize(9);
  doc.setFont(fontName, "normal");
  doc.text(`Race ${raceOrder || "1"}`, right, yPos, { align: "right" });
  yPos += 2;

  return yPos;
};

const drawResultsTable = ({
  doc,
  rows,
  startY,
  isInternational,
  withCountry = true,
  bottomMargin,
  headerHeight,
}) => {
  const winnerElapsed = rows.find(
    (row) => row.status === "ok" && Number.isFinite(row.elapsedMs),
  )?.elapsedMs;
  const lastFinisher = rows.filter(
    (row) => row.status === "ok" && Number.isFinite(row.elapsedMs),
  ).length;

  const deltaMap = new Map();
  const body = rows.map((row, index) => {
    const effectivePos =
      row.status === "dnf" && !Number.isInteger(row.pos)
        ? lastFinisher + 1
        : row.pos;
    const pos = row.isHC ? "HC" : effectivePos || "-";
    const timeStr = row.isHC
      ? Number.isFinite(row.elapsedMs)
        ? formatElapsedTime(row.elapsedMs)
        : "HC"
      : row.status !== "ok"
        ? String(row.status).toUpperCase()
        : formatElapsedTime(row.elapsedMs);

    if (
      row.status === "ok" &&
      Number.isFinite(row.elapsedMs) &&
      Number.isInteger(effectivePos) &&
      effectivePos > 1 &&
      winnerElapsed
    ) {
      const delta = formatElapsedTime(row.elapsedMs - winnerElapsed);
      if (delta && delta !== "-") deltaMap.set(index, `+${delta}`);
    }

    // Journey-national sheets (like the admin export) omit the Country
    // column; international sheets and the single-event sheet keep it.
    if (isInternational) {
      return [
        String(pos),
        String(row.lane || ""),
        String(row.country),
        String(row.name),
        String(timeStr),
      ];
    }
    return withCountry
      ? [
          String(pos),
          String(row.lane || ""),
          String(row.clubCode || "-"),
          String(row.country),
          String(row.name),
          String(timeStr),
          String(row.points || 0),
        ]
      : [
          String(pos),
          String(row.lane || ""),
          String(row.clubCode || "-"),
          String(row.name),
          String(timeStr),
          String(row.points || 0),
        ];
  });

  const head = isInternational
    ? [["Rank", "Lane", "Country", "Name", "Time"]]
    : withCountry
      ? [["Rank", "Lane", "Club", "Country", "Name", "Time", "Points"]]
      : [["Rank", "Lane", "Club", "Name", "Time", "Points"]];
  const columnStyles = isInternational
    ? {
        0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 12 },
        2: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 75, fontStyle: "bold" },
        4: { cellWidth: 26, halign: "right", fontStyle: "bold", fontSize: 9 },
      }
    : withCountry
      ? {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 12 },
          2: { cellWidth: 25, fontStyle: "bold" },
          3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 70, fontStyle: "bold" },
          5: { cellWidth: 22, halign: "right", fontStyle: "bold", fontSize: 9 },
          6: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        }
      : {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 14 },
          2: { cellWidth: 28, fontStyle: "bold" },
          3: { cellWidth: 82, fontStyle: "bold" },
          4: { cellWidth: 24, halign: "right", fontStyle: "bold", fontSize: 9 },
          5: { cellWidth: 16, halign: "center", fontStyle: "bold" },
        };
  const timeColumnIndex = isInternational ? 4 : withCountry ? 5 : 4;

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "plain",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: INK,
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: INK,
      cellPadding: 1,
    },
    styles: {
      fontSize: 8,
      cellPadding: 0.8,
      minCellHeight: 6.5,
      font: "helvetica",
    },
    columnStyles,
    margin: { left: 14, right: 14, bottom: bottomMargin, top: headerHeight },
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
      if (data.section === "body" && data.column.index === timeColumnIndex) {
        const delta = deltaMap.get(data.row.index);
        if (delta) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...MUTED);
          const pad =
            typeof data.cell.styles.cellPadding === "number"
              ? data.cell.styles.cellPadding
              : data.cell.styles.cellPadding?.right || 0;
          doc.text(
            delta,
            data.cell.x + data.cell.width - pad,
            data.cell.y + data.cell.height - 0.3,
            { align: "right" },
          );
          doc.setFontSize(8);
          doc.setTextColor(...INK);
        }
      }
    },
  });

  return doc.lastAutoTable.finalY + 4;
};

const drawStatusBox = ({ doc, y, text, bottomLimit }) => {
  if (!text || y + 7 >= bottomLimit) return;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.3);
  doc.rect(14, y, pageWidth - 28, 7);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(String(text).slice(0, 110), 16, y + 5);
};

// Status line under the table — reflects the UNOFFICIAL/OFFICIAL lifecycle
// and the REVISED marker.
const resultStatusBoxText = (resultStatus, revised) => {
  const base =
    resultStatus === "unofficial"
      ? "Unofficial Results — subject to jury verification."
      : "Official Results - Times are final.";
  return revised ? `${base} Results revised after publication.` : base;
};

// Legend entries: international → [code, countryName]; national →
// [code, { label, labelAr }]. Arabic labels render in Amiri when loaded.
// `drawnPages` tracks which page indices already carry their letterhead and
// footer: full-competition exports build many sheets in one document, and
// re-stamping every earlier page per sheet would be quadratic.
const drawLegendAndFooter = ({
  doc,
  legendEntries,
  headerData,
  footerData,
  isInternational,
  asOfLabel,
  arabicFontName,
  drawnPages,
}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);

    if (!drawnPages.has(i)) {
      drawnPages.add(i);
      // Letterhead + footer band + as-of. Page numbers are stamped in a final
      // pass (stampPageNumbers) once the page count is final.
      drawLetterhead(doc, headerData);

      if (footerData) {
        const h = pageWidth / (footerData.width / footerData.height);
        doc.addImage(footerData.data, footerData.format, 0, pageHeight - h - 3, pageWidth, h);
        doc.setDrawColor(...RULE_RED);
        doc.setLineWidth(0.8);
        doc.line(14, pageHeight - h - 5, pageWidth - 14, pageHeight - h - 5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(asOfLabel, 14, pageHeight - h - 8);
        doc.setTextColor(...INK);
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...MUTED);
        doc.text(asOfLabel, 14, pageHeight - 8);
        doc.setTextColor(...INK);
      }
    }

    // Legend on the last page.
    if (i === pageCount && legendEntries.length > 0) {
      const boxHeight = legendEntries.length * LEGEND_LINE_HEIGHT + 7;
      const legendY = pageHeight - 35 - boxHeight;
      doc.setDrawColor(...INK);
      doc.setLineWidth(0.3);
      doc.rect(14, legendY, pageWidth - 28, boxHeight);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(isInternational ? "Nations:" : "Legend:", 16, legendY + 5);
      doc.setFontSize(8);
      let lineY = legendY + 9;
      legendEntries.forEach(([code, value]) => {
        const isBilingual = isObject(value);
        doc.setFont("helvetica", "bold");
        doc.text(`${code}: `, 18, lineY);
        const codeWidth = doc.getTextWidth(`${code}: `);
        doc.setFont("helvetica", "normal");
        const label = isBilingual ? value.label || code : String(value || code);
        doc.text(label, 18 + codeWidth, lineY);
        let lineEnd = 18 + codeWidth + doc.getTextWidth(label);
        if (isBilingual && value.labelAr && arabicFontName) {
          doc.setFont(arabicFontName, "normal");
          doc.text(` : ${value.labelAr}`, lineEnd, lineY);
          doc.setFont("helvetica", "normal");
        }
        lineY += LEGEND_LINE_HEIGHT;
      });
    }
  }
};

const safeFileName = (parts) =>
  parts
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 90) + ".pdf";

// ---------------------------------------------------------------------------
// Points — same defaults and lookup as the admin exports
// ---------------------------------------------------------------------------

const DEFAULT_POINT_TABLE = { 1: 20, 2: 12, 3: 8, 4: 6, 5: 4, 6: 3, 7: 2, 8: 1 };

const calculatePoints = (position, customPointTable) => {
  if (!position || position < 1) return 0;
  if (customPointTable && customPointTable.length > 0) {
    const entry = customPointTable.find(
      (e) => Number(e.position) === Number(position),
    );
    return entry ? entry.points : 0;
  }
  return DEFAULT_POINT_TABLE[position] || 0;
};

const fetchActivePointTable = async (discipline) => {
  try {
    const response = await fetch(
      `/api/public/ranking-systems/active?discipline=${encodeURIComponent(discipline || "")}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data.customPointTable) && data.customPointTable.length > 0
      ? data.customPointTable
      : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Journey-sheet building — mirrors the admin race-page export
// ---------------------------------------------------------------------------

const sameLocalDay = (a, b) => {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const laneHasResult = (lane) => {
  const status = lane.result?.status || "ok";
  return Number.isFinite(lane.result?.elapsedMs) || status !== "ok";
};

/** "First LAST" per admin convention; crews get (b)/(s) markers. */
const journeyAthletesLabel = (athletes, fallback) => {
  const members = (athletes || [])
    .map(
      (athlete) =>
        `${athlete?.firstName || ""} ${(athlete?.lastName || "").toUpperCase()}`.trim(),
    )
    .filter(Boolean);
  if (members.length === 0) return fallback || "—";
  return members
    .map((name, index) => {
      if (members.length === 1) return name;
      if (index === 0) return `(b) ${name}`;
      if (index === members.length - 1) return `(s) ${name}`;
      return `(${index + 1}) ${name}`;
    })
    .join("\n");
};

/** "Journey N" while the journey is not the configured final one. */
const journeyPhaseLabel = (competition, journeyValues) => {
  const journey = journeyValues[0] || 1;
  const maxJourney =
    Number(
      competition?.maximumJourney ??
        competition?.maxJourney ??
        competition?.journeysCount,
    ) || null;
  if (maxJourney && journeyValues.every((value) => value >= maxJourney)) {
    return "Final";
  }
  return `Journey ${journeyValues.join(" / ")}`;
};

/**
 * Consolidated ranking of one event's races within a journey: timed crews
 * ranked by time across ALL source races (each row tagged "(Rn)"), then
 * DNF/DNS/ABS/DSQ/HC after — the same convention as the admin export.
 */
const buildJourneySheetRows = ({ races, customPointTable }) => {
  const multiRace = races.length > 1;
  const rows = [];
  races.forEach((race) => {
    (race.lanes || []).forEach((lane) => {
      if (!laneHasResult(lane)) return;
      const status = lane.result?.status || "ok";
      rows.push({
        status,
        isHC: status === "hors_course",
        elapsedMs: Number.isFinite(lane.result?.elapsedMs)
          ? lane.result.elapsedMs
          : null,
        laneNo: lane.lane || "",
        sourceOrder: race.order,
        clubCode:
          lane.clubCode ||
          (lane.clubName || "").slice(0, 3).toUpperCase() ||
          "-",
        crewNumber: lane.crewNumber,
        athletes: Array.isArray(lane.athletes) ? lane.athletes : [],
        nameFallback: lane.athleteName || lane.athleteNameAr || "",
        country:
          String(lane.representingNation || "").trim() ||
          lane.clubCountry ||
          lane.clubCode ||
          "-",
      });
    });
  });

  const ranked = rows
    .filter((row) => row.status === "ok" && Number.isFinite(row.elapsedMs))
    .sort(
      (a, b) =>
        a.elapsedMs - b.elapsedMs || (a.laneNo || 0) - (b.laneNo || 0),
    );
  const consolidatedByRow = new Map();
  ranked.forEach((row, index) => consolidatedByRow.set(row, index + 1));
  const dnfEffectivePosition = ranked.length + 1;
  const winningElapsed = ranked[0]?.elapsedMs;

  rows.sort((a, b) => {
    const posA = consolidatedByRow.get(a);
    const posB = consolidatedByRow.get(b);
    if (posA && posB && posA !== posB) return posA - posB;
    if (Boolean(posA) !== Boolean(posB)) return posA ? -1 : 1;
    return (
      (STATUS_PRIORITY[a.status] ?? 10) - (STATUS_PRIORITY[b.status] ?? 10) ||
      (a.laneNo || 0) - (b.laneNo || 0)
    );
  });

  return rows.map((row) => {
    const pos = row.isHC
      ? null
      : row.status === "dnf"
        ? dnfEffectivePosition
        : consolidatedByRow.get(row) ?? null;
    const delta =
      row.status === "ok" &&
      Number.isFinite(row.elapsedMs) &&
      Number.isInteger(pos) &&
      pos > 1 &&
      winningElapsed
        ? `+${formatElapsedTime(row.elapsedMs - winningElapsed)}`
        : null;

    return {
      status: row.status,
      isHC: row.isHC,
      pos,
      lane:
        multiRace && row.sourceOrder ? `${row.laneNo} (R${row.sourceOrder})` : row.laneNo,
      clubCode:
        row.crewNumber != null && row.athletes.length > 1
          ? `${row.clubCode} ${row.crewNumber}`
          : row.clubCode,
      country: row.country,
      name: journeyAthletesLabel(row.athletes, row.nameFallback),
      elapsedMs: row.elapsedMs,
      points:
        !row.isHC && (row.status === "ok" || row.status === "dnf") && Number.isInteger(pos)
          ? calculatePoints(pos, customPointTable)
          : 0,
    };
  });
};

/** Final pass: "Page i of N" on every page, once the page count is final. */
const stampPageNumbers = (doc, footerData) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  let y = pageHeight - 8;
  if (footerData) {
    const h = pageWidth / (footerData.width / footerData.height);
    y = pageHeight - h - 8;
  }
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, y, { align: "right" });
    doc.setTextColor(...INK);
  }
};

// ---------------------------------------------------------------------------
// Event sheet — one official page-set per result group
// ---------------------------------------------------------------------------

const eventNumberAndOrder = (races) => {
  const source = races.final || races.heats?.[0] || null;
  return {
    eventNumber: source?.eventNumber,
    raceOrder: source?.order || source?.eventNumber || 1,
  };
};

const eventDistance = (races, competition) => {
  const candidates = Array.isArray(races)
    ? races
    : [races?.final, ...(races?.heats || [])].filter(Boolean);
  const override = candidates.find(
    (race) => race?.distanceOverride != null,
  )?.distanceOverride;
  return (
    override ??
    competition?.defaultDistance ??
    competition?.distance ??
    null
  );
};

const eventPhase = (races) => {
  if (races.final?.phase) return races.final.phase;
  const phases = (races.heats || []).map((heat) => heat.phase).filter(Boolean);
  return phases.length ? phases.join(" / ") : "Results";
};

const eventTiming = (racesOrRace) => {
  // Accepts either the { final, heats } bundle (single-event export) or a
  // race / list of races (journey export); falls back to the earliest start
  // time when the primary race has none.
  let candidates = [];
  if (Array.isArray(racesOrRace)) {
    candidates = racesOrRace.map((race) => race?.startTime).filter(Boolean);
  } else if (
    racesOrRace &&
    (racesOrRace.final || Array.isArray(racesOrRace.heats))
  ) {
    const source = racesOrRace.final || racesOrRace.heats?.[0] || null;
    candidates = [source?.startTime].filter(Boolean);
  } else {
    candidates = [racesOrRace?.startTime].filter(Boolean);
  }
  const sorted = candidates
    .slice()
    .sort((a, b) => new Date(a) - new Date(b));
  const source = sorted[0] || null;
  return {
    label: source
      ? new Date(source).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "",
    source,
  };
};

// Clubs of an event with bilingual labels when known: entries carry the
// populated club (name / nameAr / code); heat lanes only code + name.
const collectClubLabels = ({ entries, races }) => {
  const labels = new Map();
  (entries || []).forEach((entry) => {
    const club = entry?.club;
    if (!isObject(club)) return;
    const code = (club.code || (club.name || "").slice(0, 3).toUpperCase()).toUpperCase();
    if (!code) return;
    labels.set(code, { label: club.name || club.nameAr || code, labelAr: club.nameAr || "" });
  });
  (races?.heats || []).forEach((heat) => {
    (heat.lanes || []).forEach((lane) => {
      const code = String(lane.clubCode || "").toUpperCase();
      if (code && !labels.has(code)) {
        labels.set(code, { label: lane.clubName || code, labelAr: "" });
      }
    });
  });
  return labels;
};

const renderEventSheet = ({
  doc,
  competition,
  group,
  races,
  mode,
  hostCountry,
  arabicFontName,
  headerData,
  footerData,
  asOfLabel,
  drawnPages,
  resultStatus = "unofficial",
  revised = false,
  isFirstPage,
}) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  const isInternational =
    Boolean(competition?.scope?.type) && competition.scope.type !== "national";

  if (!isFirstPage) doc.addPage();
  const headerHeight = headerImageHeight(headerData, doc.internal.pageSize.getWidth());

  const eventLabel = formatRaceLabel(group) || "Event";
  const eventTitle = formatEventTitleWithBoatClass(group.category, group.boatClass, "en");
  const eventTitleAr = formatEventTitleWithBoatClass(group.category, group.boatClass, "ar");
  const { eventNumber, raceOrder } = eventNumberAndOrder(races);

  const finalRows = buildEntryRows({
    entries: (group.entries || []).filter(
      (entry) => !/^heat/i.test(String(entry.phase || "")),
    ),
    mode,
    hostCountry,
  });
  const heatRowsList = (races.heats || [])
    .map((heat) => ({ heat, rows: buildLaneRows({ race: heat }) }))
    .filter(({ rows }) => rows.length > 0);

  // Reserve space at the bottom of every page for the legend + footer band.
  const legendEntries = isInternational
    ? [...new Map(
        [...finalRows, ...heatRowsList.flatMap(({ rows }) => rows)].map((row) => [
          String(row.country || "").toUpperCase(),
          countryName(row.country) || row.country,
        ]),
      )]
        .filter(([code]) => code && code !== "-")
        .sort((a, b) => a[0].localeCompare(b[0]))
    : [...collectClubLabels({ entries: group.entries, races })]
        .sort((a, b) => a[0].localeCompare(b[0]));
  const legendHeight =
    legendEntries.length > 0 ? legendEntries.length * LEGEND_LINE_HEIGHT + 7 : 0;
  const legendBottom = pageHeight - 35 - legendHeight;

  let yPos = drawEventHeaderBlock({
    doc,
    competition,
    eventLabel,
    eventTitle,
    eventTitleAr,
    eventNumber,
    raceOrder,
    phaseStr: eventPhase(races),
    startTime: eventTiming(races),
    distance: eventDistance(races, competition),
    arabicFontName,
    revised,
    yPos: headerHeight,
  });

  if (finalRows.length > 0) {
    yPos = drawResultsTable({
      doc,
      rows: finalRows,
      startY: yPos,
      isInternational,
      bottomMargin: 35 + legendHeight + 14,
      headerHeight,
    });
    drawStatusBox({
      doc,
      y: yPos,
      text: resultStatusBoxText(resultStatus, revised),
      bottomLimit: legendBottom,
    });
    yPos += 10;
  }

  heatRowsList.forEach(({ heat, rows }) => {
    if (yPos > legendBottom - 45) {
      doc.addPage();
      yPos = 25;
    }
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.text(`${heat.phase || heat.name} — full results`, 14, yPos + 4);
    yPos += 7;
    yPos = drawResultsTable({
      doc,
      rows,
      startY: yPos,
      isInternational,
      bottomMargin: 35 + legendHeight + 14,
      headerHeight,
    });
    drawStatusBox({
      doc,
      y: yPos,
      text:
        heat.notes ||
        "Progression System: 1st of each heat qualifies for Final A · others by best time.",
      bottomLimit: legendBottom,
    });
    yPos += 10;
  });

  drawLegendAndFooter({
    doc,
    legendEntries,
    headerData,
    footerData,
    isInternational,
    asOfLabel,
    arabicFontName,
    drawnPages,
  });
};

// ---------------------------------------------------------------------------
// Document setup + public API — same signatures as before, now async and
// failure-safe (they log and give up instead of throwing).
// ---------------------------------------------------------------------------

const createDocument = async () => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let arabicFontName = null;
  try {
    const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");
    if (arabicFontBase64) {
      doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      arabicFontName = "Amiri";
    }
  } catch (err) {
    console.warn("Arabic font unavailable for public PDF:", err);
  }
  const [headerData, footerData] = await Promise.all([
    loadImage("/header.png"),
    (async () => (await loadImage("/footer.png")) || (await loadImage("/sponsors.png")))(),
  ]);
  return {
    doc,
    arabicFontName,
    headerData,
    footerData,
    asOfLabel: formatAsOfLabel(),
    drawnPages: new Set(),
  };
};

/**
 * PDF for a single result group (event): final standings + full heat tables,
 * in the official federation letterhead model.
 */
export const generateRaceResultsPdf = async ({
  competition,
  group,
  races,
  mode,
  hostCountry,
}) => {
  try {
    if (!competition || !group) return undefined;
    const { doc, arabicFontName, headerData, footerData, asOfLabel, drawnPages } =
      await createDocument();
    renderEventSheet({
      doc,
      competition,
      group,
      races: races || { heats: [], final: null },
      mode,
      hostCountry,
      arabicFontName,
      headerData,
      footerData,
      asOfLabel,
      drawnPages,
      resultStatus: group.status || "unofficial",
      revised: Boolean(group.revised),
      isFirstPage: true,
    });
    stampPageNumbers(doc, footerData);
    const eventLabel = formatRaceLabel(group) || "Event";
    doc.save(safeFileName(["TRF", competition.code, eventLabel, "results"]));
    return doc;
  } catch (err) {
    console.error("Failed to generate the event results PDF:", err);
    return undefined;
  }
};

/**
 * Full competition results PDF: one official sheet per event. The document
 * opens directly with the first event — no summary pages. `groups` may be a
 * single journey/day's slice (the results page passes one day at a time) and
 * `journeyDate` names the file after that journey.
 */
export const generateFullResultsPdf = async ({
  competition,
  groups,
  programme,
  mode,
  hostCountry,
  journeyDate,
}) => {
  try {
    if (!competition || !programme || programme.length === 0) return undefined;
    const { doc, arabicFontName, headerData, footerData, asOfLabel, drawnPages } =
      await createDocument();
    const customPointTable = await fetchActivePointTable(
      competition?.discipline,
    );
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Per-event status/revised flags from the published groups (sheets are
    // race-driven, so match on eventGroupId).
    const groupMetaByEventId = new Map(
      (groups || []).map((group) => [
        group.eventGroupId,
        {
          resultStatus: group.status || "unofficial",
          revised: Boolean(group.revised),
        },
      ]),
    );

    // The journey's races that actually carry results, in programme order.
    const journeyRaces = programme
      .filter((race) =>
        journeyDate ? sameLocalDay(race.startTime, journeyDate) : true,
      )
      .filter((race) => (race.lanes || []).some(laneHasResult))
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (journeyRaces.length === 0) return undefined;

    const journeyValues = [
      ...new Set(
        journeyRaces
          .map((race) => Number(race.journeyIndex))
          .filter((value) => Number.isFinite(value) && value > 0),
      ),
    ].sort((a, b) => a - b);

    // One consolidated sheet per event (eventGroupId): a race can merge the
    // results of several source races — positions are recomputed by time
    // across all of them, exactly like the admin race-page export. Driving
    // the export from the races (not from the published groups) is what
    // fixes events whose result group holds no entries (blank sheets).
    const byEvent = new Map();
    journeyRaces.forEach((race) => {
      const key = race.eventGroupId || race._id;
      if (!byEvent.has(key)) byEvent.set(key, []);
      byEvent.get(key).push(race);
    });

    let sheetIndex = 0;
    for (const races of byEvent.values()) {
      const primary = races[0];
      if (sheetIndex > 0) doc.addPage();
      sheetIndex += 1;

      const groupMeta = groupMetaByEventId.get(primary.eventGroupId) || {
        resultStatus: "unofficial",
        revised: false,
      };

      const headerHeight = headerImageHeight(headerData, pageWidth);
      const isInternational =
        Boolean(competition?.scope?.type) &&
        competition.scope.type !== "national";

      const rows = buildJourneySheetRows({ races, customPointTable });

      // Legend: nations for international events, bilingual clubs otherwise.
      const legendEntries = isInternational
        ? [
            ...new Map(
              rows.map((row) => [
                String(row.country || "").toUpperCase(),
                countryName(row.country) || row.country,
              ]),
            ),
          ]
            .filter(([code]) => code && code !== "-")
            .sort((a, b) => a[0].localeCompare(b[0]))
        : [
            ...new Map(
              races.flatMap((race) =>
                (race.lanes || [])
                  .filter(laneHasResult)
                  .map((lane) => [
                    String(lane.clubCode || "").toUpperCase(),
                    {
                      label: lane.clubName || lane.clubCode || "",
                      labelAr: lane.clubNameAr || "",
                    },
                  ]),
              ),
            ),
          ]
            .filter(([code]) => code)
            .sort((a, b) => a[0].localeCompare(b[0]));
      const legendHeight =
        legendEntries.length > 0
          ? legendEntries.length * LEGEND_LINE_HEIGHT + 7
          : 0;

      let yPos = drawEventHeaderBlock({
        doc,
        competition,
        eventLabel: formatRaceLabel(primary) || primary.name || "Event",
        eventTitle: formatEventTitleWithBoatClass(
          primary.category,
          primary.boatClass,
          "en",
        ),
        eventTitleAr: formatEventTitleWithBoatClass(
          primary.category,
          primary.boatClass,
          "ar",
        ),
        eventNumber: primary.eventNumber,
        raceOrder: primary.order,
        phaseStr: journeyPhaseLabel(competition, journeyValues),
        startTime: eventTiming(races),
        distance: eventDistance(races, competition),
        arabicFontName,
        revised: groupMeta.revised,
        yPos: headerHeight,
      });

      yPos = drawResultsTable({
        doc,
        rows,
        startY: yPos,
        isInternational,
        withCountry: false,
        bottomMargin: 35 + legendHeight + 14,
        headerHeight,
      });

      drawStatusBox({
        doc,
        y: yPos,
        text: resultStatusBoxText(groupMeta.resultStatus, groupMeta.revised),
        bottomLimit: pageHeight - 35 - legendHeight,
      });

      drawLegendAndFooter({
        doc,
        legendEntries,
        headerData,
        footerData,
        isInternational,
        asOfLabel,
        arabicFontName,
        drawnPages,
      });
    }

    stampPageNumbers(doc, footerData);
    doc.save(
      safeFileName([
        "TRF",
        competition.code,
        "full-results",
        journeyDate
          ? new Date(journeyDate).toLocaleDateString("en-GB").replace(/\s+/g, "-")
          : "",
      ]),
    );
    return doc;
  } catch (err) {
    console.error("Failed to generate the full results PDF:", err);
    return undefined;
  }
};
