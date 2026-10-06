// ============================================================
//  Public results PDF export (client-side).
//  Generates print-friendly, white-background PDFs from the
//  same public data shown on the portal:
//   - generateRaceResultsPdf   → one event (final + its heats)
//   - generateFullResultsPdf   → summary page + every event
//  Uses jsPDF + jspdf-autotable, matching the admin exports.
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { countryName } from "./countries";
import {
  formatTime,
  formatDate,
  formatDateTime,
  formatRaceLabel,
  getEntryNationCode,
  groupRacesByEventGroupId,
} from "./format";

const FEDERATION = "TUNISIAN ROWING FEDERATION";
const ACCENT = [0, 122, 158]; // deep cyan used for headings/accents
const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const GREEN = [5, 122, 85];
const RED = [190, 40, 40];

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Affiliation text without emoji (standard PDF fonts cannot render flags). */
const affiliationText = (entryOrLane, mode, hostCountry) => {
  const code = getEntryNationCode(entryOrLane, mode, hostCountry);
  if (code) return countryName(code);
  const club = isObject(entryOrLane?.club)
    ? entryOrLane.club.name || entryOrLane.club.code
    : "";
  return club || entryOrLane?.clubName || "—";
};

const entryName = (entryOrLane) => {
  if (!entryOrLane) return "—";
  // Full crew names annotated by the API for doubles/fours.
  if (entryOrLane.crewNames) return entryOrLane.crewNames;
  if (isObject(entryOrLane.athlete)) {
    const latin = `${entryOrLane.athlete.firstName || ""} ${
      entryOrLane.athlete.lastName || ""
    }`.trim();
    if (latin) return latin;
  }
  return (
    entryOrLane.athleteName ||
    (isObject(entryOrLane.club) ? entryOrLane.club.name : "") ||
    entryOrLane.clubName ||
    "—"
  );
};

const statusLabel = (status) =>
  status && status !== "ok" ? String(status).replace(/_/g, " ").toUpperCase() : "OK";

const safeFileName = (parts) =>
  parts
    .filter(Boolean)
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .slice(0, 90) + ".pdf";

const drawHeader = (doc, competition, subtitle) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text(FEDERATION, pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(14);
  doc.setTextColor(...INK);
  const title = competition?.names?.en || competition?.code || "Competition";
  const titleLines = doc.splitTextToSize(title, pageWidth - 30);
  doc.text(titleLines, pageWidth / 2, 21, { align: "center" });

  let y = 21 + titleLines.length * 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const venue = [
    competition?.venue?.name,
    competition?.venue?.city,
    competition?.venue?.country,
  ]
    .filter(Boolean)
    .join(", ");
  const dates =
    competition?.startDate && competition?.endDate
      ? competition.startDate === competition.endDate ||
        String(competition.startDate).slice(0, 10) ===
          String(competition.endDate).slice(0, 10)
        ? formatDate(competition.startDate)
        : `${formatDate(competition.startDate)} – ${formatDate(
            competition.endDate,
          )}`
      : "";
  const subLine = [venue, dates].filter(Boolean).join("  ·  ");
  if (subLine) {
    doc.text(subLine, pageWidth / 2, y, { align: "center" });
    y += 5;
  }
  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(subtitle, pageWidth / 2, y + 2, { align: "center" });
    y += 7;
  }

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1, pageWidth - 14, y + 1);
  return y + 7;
};

const drawFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Official results — generated from the TRF portal on ${formatDateTime(
        new Date(),
      )}`,
      14,
      pageHeight - 8,
    );
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 8, {
      align: "right",
    });
  }
};

const affiliationColumnLabel = (mode) =>
  mode === "nation" ? "Nation" : mode === "mixed" ? "Club / Nation" : "Club";

const statusColor = (label) =>
  label === "OK" ? GREEN : label === "DSQ" ? RED : [180, 130, 20];

const buildEntryRows = ({ entries, mode, hostCountry }) =>
  (entries || []).map((entry, index) => ({
    pos: entry.finishPosition || entry.rank || index + 1,
    name: entryName(entry),
    affiliation: affiliationText(entry, mode, hostCountry),
    lane: entry.lane || "",
    time:
      entry.status === "ok" && Number.isFinite(entry.elapsedMs)
        ? formatTime(entry.elapsedMs)
        : "—",
    status: statusLabel(entry.status || "ok"),
  }));

const buildLaneRows = ({ race, mode, hostCountry, finalistNames }) =>
  (race?.lanes || [])
    .map((lane) => {
      const name = entryName(lane);
      return {
        pos:
          lane.result?.finishPosition ??
          (Number.isFinite(lane.result?.elapsedMs) ? null : ""),
        name,
        affiliation: affiliationText(lane, mode, hostCountry),
        lane: lane.lane || "",
        time:
          lane.result?.status === "ok" && Number.isFinite(lane.result?.elapsedMs)
            ? formatTime(lane.result.elapsedMs)
            : lane.result?.status
              ? statusLabel(lane.result.status)
              : "—",
        status: statusLabel(lane.result?.status || "ok"),
        qualified: finalistNames.has(name.toLowerCase().trim()),
      };
    })
    .sort((a, b) => {
      const posA = typeof a.pos === "number" ? a.pos : Number.MAX_SAFE_INTEGER;
      const posB = typeof b.pos === "number" ? b.pos : Number.MAX_SAFE_INTEGER;
      if (posA !== posB) return posA - posB;
      return 0;
    });

const drawTable = (
  doc,
  { rows, startY, mode, withQualification },
) => {
  const head = [
    [
      "Pos",
      "Athlete / Crew",
      affiliationColumnLabel(mode),
      "Lane",
      "Time",
      "Status",
      ...(withQualification ? ["Q"] : []),
    ],
  ];
  const body = rows.map((row) => [
    row.pos ?? "",
    row.name,
    row.affiliation,
    row.lane || "",
    row.time,
    row.status,
    ...(withQualification ? [row.qualified ? "Q" : ""] : []),
  ]);

  autoTable(doc, {
    head,
    body,
    startY,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.8,
      textColor: INK,
      lineColor: [222, 228, 236],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [238, 243, 248],
      textColor: INK,
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 42 },
      3: { cellWidth: 12, halign: "center" },
      4: { halign: "right", fontStyle: "bold" },
      5: { halign: "right", fontSize: 7.5 },
      ...(withQualification
        ? { 6: { cellWidth: 10, halign: "center", fontStyle: "bold" } }
        : {}),
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const statusIndex = withQualification ? 5 : 5;
      if (data.column.index === statusIndex) {
        data.cell.styles.textColor = statusColor(
          String(data.cell.raw || "").toUpperCase(),
        );
        data.cell.styles.fontStyle = "bold";
      }
      if (
        withQualification &&
        data.column.index === 6 &&
        String(data.cell.raw).trim() === "Q"
      ) {
        data.cell.styles.textColor = GREEN;
      }
    },
    margin: { left: 14, right: 14 },
  });

  return doc.lastAutoTable.finalY;
};

const phaseHeading = (doc, text, startY) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(text.toUpperCase(), 14, startY + 4);
  return startY + 8;
};

/**
 * PDF for a single result group (event): final standings + full heat tables.
 * `races` = { heats: [...], final: {...} } from groupRacesByEventGroupId().
 */
export const generateRaceResultsPdf = ({ competition, group, races, mode, hostCountry }) => {
  if (!competition || !group) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const eventLabel = formatRaceLabel(group) || "Event";
  let y = drawHeader(doc, competition, `${eventLabel} — Official Results`);

  const finalistNames = new Set();
  (races?.final?.lanes || []).forEach((lane) => {
    finalistNames.add(entryName(lane).toLowerCase().trim());
  });

  const finalEntries = (group.entries || []).filter(
    (entry) => !/^heat/i.test(String(entry.phase || "")),
  );
  const finalRows = finalEntries.length
    ? buildEntryRows({ entries: finalEntries, mode, hostCountry })
    : buildLaneRows({ race: races?.final, mode, hostCountry, finalistNames });

  if (finalRows.length > 0) {
    y = phaseHeading(doc, races?.final?.phase || "Final", y);
    y = drawTable(doc, { rows: finalRows, startY: y, mode });
  }

  (races?.heats || []).forEach((heat) => {
    const rows = buildLaneRows({ race: heat, mode, hostCountry, finalistNames });
    if (rows.length === 0) return;
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 20;
    }
    y = phaseHeading(doc, `${heat.phase || heat.name} — full results`, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "1st of each heat qualifies for Final A · others by best time",
      14,
      y + 1,
    );
    y = drawTable(doc, { rows, startY: y + 3, mode, withQualification: true });
    y += 6;
  });

  drawFooter(doc);
  doc.save(safeFileName(["TRF", competition.code, eventLabel, "results"]));
  return doc;
};

/**
 * Full competition results PDF: a summary page (winner per event) followed
 * by the detailed results of every event.
 */
export const generateFullResultsPdf = ({
  competition,
  groups,
  programme,
  mode,
  hostCountry,
}) => {
  if (!competition || !groups || groups.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const racesByGroup = groupRacesByEventGroupId(programme);
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = drawHeader(doc, competition, "Official Results — Full Summary");

  // ---- Summary page ------------------------------------------------------
  // Same-named events raced in separate sessions get their date appended.
  const groupSessionLabel = (group) => {
    const races = racesByGroup.get(group.eventGroupId);
    const date =
      races?.final?.startTime || races?.heats?.[0]?.startTime || null;
    return date ? formatDate(date) : "";
  };
  const labelCounts = new Map();
  groups.forEach((group) => {
    const label = formatRaceLabel(group) || "Event";
    labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  });
  const groupLabel = (group) => {
    const label = formatRaceLabel(group) || "Event";
    const session = groupSessionLabel(group);
    return (labelCounts.get(label) || 0) > 1 && session
      ? `${label} — ${session}`
      : label;
  };

  const summary = groups.map((group) => {
    const entries = (group.entries || [])
      .slice()
      .sort((a, b) => (a.rank || a.finishPosition || 999) - (b.rank || b.finishPosition || 999));
    const winner = entries[0];
    return {
      label: groupLabel(group),
      winner: winner ? entryName(winner) : "—",
      affiliation: winner ? affiliationText(winner, mode, hostCountry) : "—",
      time:
        winner && winner.status === "ok" && Number.isFinite(winner.elapsedMs)
          ? formatTime(winner.elapsedMs)
          : "—",
    };
  });

  autoTable(doc, {
    head: [["Event", "Winner", affiliationColumnLabel(mode), "Time"]],
    body: summary.map((row) => [row.label, row.winner, row.affiliation, row.time]),
    startY: y,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.8,
      textColor: INK,
      lineColor: [222, 228, 236],
      lineWidth: 0.15,
    },
    headStyles: {
      fillColor: [238, 243, 248],
      textColor: INK,
      fontStyle: "bold",
    },
    columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
    margin: { left: 14, right: 14 },
  });

  // ---- Detailed results ---------------------------------------------------
  const sortedGroups = [...groups].sort((a, b) =>
    String(a.eventLabel || "").localeCompare(String(b.eventLabel || "")),
  );

  sortedGroups.forEach((group) => {
    const races = racesByGroup.get(group.eventGroupId) || { heats: [], final: null };
    doc.addPage();
    let groupY = drawHeader(
      doc,
      competition,
      `${groupLabel(group)} — Official Results`,
    );

    const finalistNames = new Set();
    (races.final?.lanes || []).forEach((lane) => {
      finalistNames.add(entryName(lane).toLowerCase().trim());
    });

    const finalEntries = (group.entries || []).filter(
      (entry) => !/^heat/i.test(String(entry.phase || "")),
    );
    const finalRows = finalEntries.length
      ? buildEntryRows({ entries: finalEntries, mode, hostCountry })
      : buildLaneRows({ race: races.final, mode, hostCountry, finalistNames });

    if (finalRows.length > 0) {
      groupY = phaseHeading(doc, races.final?.phase || "Final", groupY);
      groupY = drawTable(doc, { rows: finalRows, startY: groupY, mode });
      groupY += 6;
    }

    (races.heats || []).forEach((heat) => {
      const rows = buildLaneRows({ race: heat, mode, hostCountry, finalistNames });
      if (rows.length === 0) return;
      if (groupY > pageHeight - 60) {
        doc.addPage();
        groupY = 20;
      }
      groupY = phaseHeading(doc, `${heat.phase || heat.name} — full results`, groupY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text("1st of each heat qualifies for Final A · others by best time", 14, groupY + 1);
      groupY = drawTable(doc, {
        rows,
        startY: groupY + 3,
        mode,
        withQualification: true,
      });
      groupY += 6;
    });
  });

  drawFooter(doc);
  doc.save(safeFileName(["TRF", competition.code, "full-results"]));
  return doc;
};
