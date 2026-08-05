// Shared "Entries Reports" PDF generators used by both the classic rowing
// (CompetitionRaces) and Beach Sprint pages so their output looks identical.
//
// Each generator accepts pre-built plain rows plus the competition object and
// renders a World Rowing style PDF (branded header/footer, Arabic font support,
// bilingual club columns, totals and a club x event matrix).

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE = {
  width: 210,
  height: 297,
  left: 14,
  right: 196,
  center: 105,
};
const FONT = "helvetica";

// ---------------------------------------------------------------------------
// Asset + label helpers
// ---------------------------------------------------------------------------

export const loadImage = (url) =>
  new Promise((resolve) => {
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
    img.src = `${url}${url.includes("?") ? "&" : "?"}_cb=${Date.now()}`;
  });

const getImageFormat = (dataUrl) =>
  String(dataUrl || "").startsWith("data:image/png") ? "PNG" : "JPEG";

export const loadFont = async (url) => {
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

export const formatAsOfLabel = (value = new Date()) =>
  `As of: ${value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

export const buildEntriesReportPdfFileName = (prefix, competition) => {
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

const resolveCompetitionTitle = (competition) =>
  competition?.names?.en ||
  competition?.name ||
  competition?.code ||
  "Competition";

const resolveCompLocation = (competition) =>
  String(
    competition?.location?.name ||
      competition?.venue?.name ||
      (typeof competition?.venue === "string" ? competition.venue : null) ||
      (typeof competition?.location === "string"
        ? competition.location
        : null) ||
      "Location",
  );

const resolveEventDateStr = (competition, globalJourneyFilter) => {
  const dateStr = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const selectedStage = globalJourneyFilter
    ? competition?.stages?.find(
        (s) => String(s.order) === String(globalJourneyFilter),
      )
    : null;
  const effectiveDate =
    selectedStage?.date || selectedStage?.startDate || competition?.startDate;
  return effectiveDate
    ? new Date(effectiveDate).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : dateStr;
};

const registerArabicFont = (doc, arabicFontBase64) => {
  if (!arabicFontBase64) return null;
  try {
    doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
    doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
    return "Amiri";
  } catch (error) {
    console.warn("Could not register Arabic font:", error);
    return null;
  }
};

const computeHeaderHeight = (doc, headerData) => {
  if (!headerData) return 32;
  const headerProps = doc.getImageProperties(headerData);
  return PAGE.width / (headerProps.width / headerProps.height) + 3 + 8;
};

// Paint the branded header/footer/sponsor chrome + page numbers on every page.
const paintChrome = (
  doc,
  {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle = "of", // "of" -> "Page i of n", "slash" -> "Page i/n"
    legendPainter = null,
  },
) => {
  const { width: pageWidth, height: pageHeight, left, right } = PAGE;
  const pageCount = doc.internal.getNumberOfPages();
  const pageLabel = (i) =>
    pageLabelStyle === "slash"
      ? `Page ${i}/${pageCount}`
      : `Page ${i} of ${pageCount}`;

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);

    if (headerData) {
      const imgProps = doc.getImageProperties(headerData);
      const h = pageWidth / (imgProps.width / imgProps.height);
      doc.addImage(headerData, getImageFormat(headerData), 0, 3, pageWidth, h);
      doc.setDrawColor(128, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(left, h + 5, right, h + 5);
    }

    if (footerData) {
      const imgProps = doc.getImageProperties(footerData);
      const h = pageWidth / (imgProps.width / imgProps.height);
      doc.setDrawColor(128, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(left, pageHeight - h - 5, right, pageHeight - h - 5);
      if (legendPainter) legendPainter(pageHeight - h - 5);
      doc.addImage(
        footerData,
        getImageFormat(footerData),
        0,
        pageHeight - h - 3,
        pageWidth,
        h,
      );
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.setTextColor(100);
      doc.text(asOfLabel, left, pageHeight - h - 8);
      doc.text(pageLabel(i), right, pageHeight - h - 8, { align: "right" });
    } else if (sponsorData) {
      const imgProps = doc.getImageProperties(sponsorData);
      const ratio = imgProps.width / imgProps.height;
      let w = 180;
      let h = w / ratio;
      if (h > 20) {
        h = 20;
        w = h * ratio;
      }
      const x = left + (180 - w) / 2;
      doc.setDrawColor(128, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(left, pageHeight - h - 5, right, pageHeight - h - 5);
      if (legendPainter) legendPainter(pageHeight - h - 5);
      doc.addImage(
        sponsorData,
        getImageFormat(sponsorData),
        x,
        pageHeight - h - 3,
        w,
        h,
      );
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.setTextColor(100);
      doc.text(asOfLabel, left, pageHeight - h - 8);
      doc.text(pageLabel(i), right, pageHeight - h - 8, { align: "right" });
    } else {
      doc.setDrawColor(128, 0, 0);
      doc.setLineWidth(0.8);
      doc.line(left, pageHeight - 15, right, pageHeight - 15);
      doc.setFontSize(8);
      doc.setFont(FONT, "normal");
      doc.setTextColor(100);
      doc.text(asOfLabel, left, pageHeight - 8);
      doc.text(pageLabel(i), right, pageHeight - 8, { align: "right" });
    }
  }
};

// ---------------------------------------------------------------------------
// 1) Entry List by Event
// ---------------------------------------------------------------------------

export async function exportEntryListByEventPdf({
  competition,
  rows: inputRows,
  isInternational = false,
  globalJourneyFilter = null,
}) {
  const rows = [...inputRows].sort((a, b) => {
    const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
    const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
    if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
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

  if (!rows.length) return false;

  const asOfLabel = formatAsOfLabel();
  const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);

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
  const arabicFontName = registerArabicFont(doc, arabicFontBase64);

  const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
  const headerHeight = computeHeaderHeight(doc, headerData);
  const compLocation = resolveCompLocation(competition);
  const competitionTitle = resolveCompetitionTitle(competition);

  const drawReportHeader = () => {
    let y = headerHeight;
    doc.setFontSize(14);
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(competitionTitle, center, y, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.text(compLocation, left, y);
    doc.text(eventDateStr, right, y, { align: "right" });

    y += 2;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    y += 6;

    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
    doc.text("Entry List by Event", center, y, { align: "center" });
    y += 5;

    doc.setFontSize(8);
    doc.setFont(FONT, "normal");
    doc.setTextColor(90);
    doc.text(asOfLabel, left, y);
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
    if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
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
      doc.setFont(FONT, "normal");
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
    doc.setFont(FONT, "bold");
    doc.setFontSize(11);
    doc.text(eventNo, left, yPos + 4);
    doc.text(eventCode, right, yPos + 4, { align: "right" });

    doc.setFontSize(8);
    doc.setFont(FONT, "normal");
    doc.text("(Event)", left, yPos + 8);

    doc.setFont(FONT, "bold");
    doc.setFontSize(12);
    doc.text(continued ? `${eventName} (cont.)` : eventName, center, yPos + 8, {
      align: "center",
    });

    doc.setFont(FONT, "bold");
    doc.setFontSize(9);
    doc.text(asOfLabel.replace("As of: ", "As of "), center, yPos + 13, {
      align: "center",
    });

    doc.setLineWidth(0.35);
    doc.setDrawColor(0);
    doc.line(left, yPos + 15, right, yPos + 15);
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
          const key = isInternational
            ? entry.country || "UNK"
            : entry.clubCode || "UNK";
          if (!map.has(key)) map.set(key, { key, athletes: [] });
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

    const cols = isInternational ? 5 : 4;
    const gap = 4;
    const colWidth = (right - left - gap * (cols - 1)) / cols;
    const lineHeight = 4;

    const blocks = groupedEntries.map((item) => {
      const lines = item.athletes.slice(0, 18);
      const h = 4 + lineHeight + lines.length * 3.6;
      return { ...item, lines, blockHeight: Math.max(h, 12) };
    });

    let cursor = 0;
    while (cursor < blocks.length) {
      const rowBlocks = blocks.slice(cursor, cursor + cols);
      const maxH = Math.max(...rowBlocks.map((b) => b.blockHeight));

      if (yPos + maxH > pageHeight - 40) {
        doc.addPage();
        yPos = drawReportHeader();
        drawEventHeader(group, eventIndex, true);
      }

      rowBlocks.forEach((block, idx) => {
        const x = left + idx * (colWidth + gap);
        let lineY = yPos + 4;

        doc.setFont(FONT, "bold");
        doc.setFontSize(10);
        doc.text(block.key, x + 1, lineY);

        doc.setFont(FONT, "normal");
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

  paintChrome(doc, {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle: "of",
  });

  doc.save(buildEntriesReportPdfFileName("EntryListByEvent", competition));
  return true;
}

// ---------------------------------------------------------------------------
// 2) Entries by Event (matrix of event -> club codes + summary + legend)
// ---------------------------------------------------------------------------

export async function exportEntriesByEventPdf({
  competition,
  rows,
  isInternational = false,
  globalJourneyFilter = null,
}) {
  if (!rows.length) return false;

  const asOfLabel = formatAsOfLabel();
  const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);

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
  const arabicFontName = registerArabicFont(doc, arabicFontBase64);

  const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
  const headerHeight = computeHeaderHeight(doc, headerData);
  const compLocation = resolveCompLocation(competition);
  const competitionTitle = resolveCompetitionTitle(competition);

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

    const dimensionCode = isInternational
      ? row.country || "UNK"
      : (row.clubCode || row.clubName || "UNK").trim();
    item.dimensions.add(String(dimensionCode || "UNK").toUpperCase());
  });

  const events = Array.from(byEvent.values())
    .sort((a, b) => {
      const eventNumberA = Number(a.eventNumber || Number.MAX_SAFE_INTEGER);
      const eventNumberB = Number(b.eventNumber || Number.MAX_SAFE_INTEGER);
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
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
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(competitionTitle, center, y, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.text(compLocation, left, y);
    doc.text(eventDateStr, right, y, { align: "right" });

    y += 2;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    y += 6;

    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
    doc.text(`Entries by Event${titleSuffix}`, center, y, { align: "center" });
    y += 7;

    doc.setFontSize(9);
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(asOfLabel.replace(":", "").toUpperCase(), center, y, {
      align: "center",
    });
    y += 3;

    doc.setLineWidth(0.28);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    y += 4;
    return y;
  };

  const availableWidth = right - left;
  const colGap = 1.0;
  const colsPerChunk = 10;
  const colWidth =
    (availableWidth - colGap * (colsPerChunk - 1)) / colsPerChunk;

  const chunks = [];
  for (let i = 0; i < events.length; i += colsPerChunk) {
    chunks.push(events.slice(i, i + colsPerChunk));
  }
  if (!chunks.length) chunks.push([]);

  let yPos = drawPageFrame();

  chunks.forEach((chunk, chunkIndex) => {
    if (chunkIndex > 0) {
      doc.addPage();
      yPos = drawPageFrame(
        chunks.length > 1 ? ` (${chunkIndex + 1}/${chunks.length})` : "",
      );
    }

    const headerRowH = 5.6;
    const listLineH = 3.7;
    const footerReserved = 37;

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

      const maxListHeight = pageHeight - footerReserved - segmentListsY;
      const maxLinesPerSegment = Math.max(
        1,
        Math.floor((maxListHeight - 2) / listLineH),
      );

      chunk.forEach((item, colIndex) => {
        const x = left + colIndex * (colWidth + colGap);

        doc.setLineWidth(0.2);
        doc.setDrawColor(40);
        doc.rect(x, segmentCodesY, colWidth, headerRowH);
        doc.rect(x, segmentNumbersY, colWidth, headerRowH);
        doc.rect(x, segmentCountsY, colWidth, headerRowH);

        doc.setFont(FONT, "bold");
        doc.setFontSize(8);
        doc.text(
          String(item.eventCode || "-"),
          x + colWidth / 2,
          segmentCodesY + 3.9,
          {
            align: "center",
          },
        );

        doc.setFont(FONT, "normal");
        doc.setFontSize(7.3);
        doc.text(
          `(${item.displayEventNumber})`,
          x + colWidth / 2,
          segmentNumbersY + 3.8,
          { align: "center" },
        );

        doc.setFont(FONT, "bold");
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

        doc.setFont(FONT, "normal");
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

  // Summary + legend page.
  doc.addPage();
  let summaryY = drawPageFrame(" (Summary)");

  const dimensionLabelPlural = isInternational ? "Countries" : "Clubs";

  const totalDimensions = new Set(
    rows.map((row) =>
      isInternational
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
      font: FONT,
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
      isInternational
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
    .filter(
      (item) =>
        !String(item.label || "")
          .toLowerCase()
          .startsWith("masters"),
    )
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
        font: FONT,
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

  doc.setFont(FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Legend", left, legendStartY);

  autoTable(doc, {
    startY: legendStartY + 1,
    head: [["Code", "Event", "Event (AR)"]],
    body: legendRows,
    theme: "grid",
    styles: {
      font: FONT,
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
    margin: { left, right: 14, bottom: 38 },
  });

  paintChrome(doc, {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle: "of",
  });

  doc.save(buildEntriesReportPdfFileName("EntriesByEvent", competition));
  return true;
}

// ---------------------------------------------------------------------------
// 3) Number of Entries by Club/Country (summary table + club x event matrix)
// ---------------------------------------------------------------------------

export async function exportNumberOfEntriesByClubPdf({
  competition,
  rows,
  isInternational = false,
  globalJourneyFilter = null,
}) {
  const scopeDimensionLabel = isInternational ? "Country" : "Club";
  const byDimension = new Map();

  rows.forEach((row) => {
    const key = isInternational
      ? row.country || "UNK"
      : (row.clubCode || "UNK").trim();
    const current = byDimension.get(key) || {
      label: key,
      entries: 0,
      athletes: 0,
      athleteKeys: new Set(),
      clubs: new Set(),
      events: new Set(),
      clubNameFr: "",
      clubNameAr: "",
    };
    current.entries += 1;
    // When rows carry unique athlete identifiers (registration data) count
    // distinct athletes so a rower entered in several events is not counted
    // multiple times. Otherwise fall back to summing the per-boat athlete
    // count (classic race rows that don't provide identities).
    if (Array.isArray(row.athleteKeys) && row.athleteKeys.length) {
      row.athleteKeys.forEach((athleteKey) =>
        current.athleteKeys.add(String(athleteKey)),
      );
    } else {
      current.athletes += Number(row.athleteUnitCount || 1);
    }
    current.clubs.add(row.clubCode || row.clubName || "-");
    current.events.add(`${row.eventCode} - ${row.eventName}`);
    if (!current.clubNameFr && row.clubNameFr)
      current.clubNameFr = row.clubNameFr;
    if (!current.clubNameAr && row.clubNameAr)
      current.clubNameAr = row.clubNameAr;
    byDimension.set(key, current);
  });

  // Resolve the displayed athlete count per dimension (distinct + fallback sum).
  byDimension.forEach((row) => {
    row.athletes = row.athleteKeys.size + Number(row.athletes || 0);
  });

  const summaryRows = Array.from(byDimension.values()).sort(
    (a, b) => b.entries - a.entries || a.label.localeCompare(b.label),
  );
  if (!summaryRows.length) return false;

  const asOfLabel = formatAsOfLabel();

  const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);

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
  const arabicFontName = registerArabicFont(doc, arabicFontBase64);

  const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
  const headerHeight = computeHeaderHeight(doc, headerData);
  const compLocation = resolveCompLocation(competition);
  const competitionTitle = resolveCompetitionTitle(competition);

  let yPos = headerHeight;

  doc.setFontSize(14);
  doc.setFont(FONT, "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(competitionTitle, center, yPos, { align: "center" });

  doc.setFontSize(9);
  doc.setFont(FONT, "normal");
  doc.text(compLocation, left, yPos);
  doc.text(eventDateStr, right, yPos, { align: "right" });

  yPos += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0);
  doc.line(left, yPos, right, yPos);
  yPos += 6;

  const reportTitle = `Number of Entries by ${scopeDimensionLabel}`;
  doc.setFontSize(12);
  doc.setFont(FONT, "bold");
  doc.text(reportTitle, center, yPos, { align: "center" });
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont(FONT, "normal");
  doc.setTextColor(90);
  doc.text(asOfLabel, left, yPos);
  yPos += 2;

  const globalHead = isInternational
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
    isInternational
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
    (sum, row) => sum + Number(isInternational ? row.clubs?.size || 0 : 0),
    0,
  );

  globalBody.push(
    isInternational
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

  const globalColumnStyles = isInternational
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
      font: FONT,
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
    margin: { left, right: 14, bottom: 35, top: headerHeight },
    didParseCell: (data) => {
      const totalRowIndex = globalBody.length - 1;
      if (data.section === "body" && data.row.index === totalRowIndex) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 247, 250];
      }
      if (
        !isInternational &&
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

  // Detailed matrix tables.
  const dimensionLabelForRow = (row) =>
    isInternational ? row.country || "UNK" : (row.clubCode || "UNK").trim();

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
      if (eventNumberA !== eventNumberB) return eventNumberA - eventNumberB;
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
    if (!matrixCounts.has(dimension)) matrixCounts.set(dimension, new Map());
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

  const usableWidthForMatrix = right - left;
  const firstColWidthForMatrix = isInternational ? 26 : 22;
  const codeColWidthForMatrix = 14;
  const totalColWidthForMatrix = 10;
  const availableEventWidth =
    usableWidthForMatrix -
    firstColWidthForMatrix -
    codeColWidthForMatrix -
    totalColWidthForMatrix;

  doc.setFont(FONT, "bold");
  doc.setFontSize(6);
  const eventMetaWithWidth = eventMeta.map((event) => {
    const codeWidth = doc.getTextWidth(String(event.code || "-"));
    const eventNumberWidth = doc.getTextWidth(`(${event.displayEventNumber})`);
    const desiredWidth = Math.max(codeWidth, eventNumberWidth) + 2.2;
    return { ...event, colWidth: Math.max(5.4, Math.min(11, desiredWidth)) };
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
  if (currentChunk.length > 0) eventChunks.push(currentChunk);
  if (!eventChunks.length) eventChunks.push([]);

  const drawMatrixPageHeader = () => {
    let y = headerHeight;
    doc.setFontSize(14);
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(competitionTitle, center, y, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.text(compLocation, left, y);
    doc.text(eventDateStr, right, y, { align: "right" });

    y += 2;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    y += 6;
    return y;
  };

  doc.addPage();
  let nextMatrixStartY = drawMatrixPageHeader();

  eventChunks.forEach((chunk, chunkIndex) => {
    const matrixTitle = reportTitle;

    const estimatedRows = orderedDimensions.length + 2;
    const estimatedChunkHeight = 8 + estimatedRows * 4;
    if (nextMatrixStartY + estimatedChunkHeight > pageHeight - 38) {
      doc.addPage();
      nextMatrixStartY = drawMatrixPageHeader();
    }

    let matrixY = nextMatrixStartY;

    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
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
    doc.setFont(FONT, "normal");
    doc.setTextColor(90);
    doc.text(asOfLabel, left, matrixY);
    matrixY += 2;

    const matrixColumnStyles = {
      0: { cellWidth: firstColWidthForMatrix, fontStyle: "bold" },
      [chunk.length + 1]: {
        cellWidth: codeColWidthForMatrix,
        halign: "center",
        fontStyle: "bold",
      },
      [chunk.length + 2]: {
        cellWidth: totalColWidthForMatrix,
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
          isInternational ? "Country" : "Club",
          ...chunk.map(
            (event) => `${event.code}\n(${event.displayEventNumber})`,
          ),
          isInternational ? "Ctry\nCode" : "Club\nCode",
          "Total",
        ],
      ],
      body: matrixBody,
      theme: "grid",
      styles: {
        font: FONT,
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
      margin: { left, right: 14, bottom: 35, top: headerHeight },
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

  paintChrome(doc, {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle: "of",
  });

  doc.save(
    buildEntriesReportPdfFileName(
      isInternational ? "NumberOfEntriesByCountry" : "NumberOfEntriesByClub",
      competition,
    ),
  );
  return true;
}

// ---------------------------------------------------------------------------
// 4) Entry List by Club/Country (per athlete rows grouped by club + legend)
// ---------------------------------------------------------------------------

export async function exportEntryListByClubPdf({
  competition,
  raceRows,
  isInternational = false,
  globalJourneyFilter = null,
}) {
  const scopeDimensionLabel = isInternational ? "Country" : "Club";
  if (!raceRows.length) return false;

  const asOfLabel = formatAsOfLabel();
  const eventDateStr = resolveEventDateStr(competition, globalJourneyFilter);

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

  const { width: pageWidth, height: pageHeight, left, right, center } = PAGE;
  const headerHeight = computeHeaderHeight(doc, headerData);
  const compLocation = resolveCompLocation(competition);
  const competitionTitle = resolveCompetitionTitle(competition);

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
        const codeCompare = `${a.eventCode}`.localeCompare(`${b.eventCode}`);
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
    if (candidateNum < existing.eventNumber)
      existing.eventNumber = candidateNum;
  });

  const legendEvents = Array.from(legendEventMap.values()).sort((a, b) => {
    if (a.eventNumber !== b.eventNumber) return a.eventNumber - b.eventNumber;
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
    const row = { code: item.code, label: item.name };
    if (isFemale && !isMale) femaleLegend.push(row);
    else if (isMale && !isFemale) maleLegend.push(row);
    else if (femaleLegend.length <= maleLegend.length) femaleLegend.push(row);
    else maleLegend.push(row);
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
    const legendX = left;
    const legendW = right - left;
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

    doc.setFont(FONT, "bold");
    doc.setFontSize(6.4);
    doc.setTextColor(0);
    doc.text("Legend:", legendX + 1.4, legendY + 2.8);

    doc.setFont(FONT, "normal");
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
        if (doc.getTextWidth(candidate) <= maxWidth) return candidate;
        trimmed = trimmed.slice(0, -1);
      }
      return ellipsis;
    };

    doc.setFontSize(5.8);
    cols.forEach((col) => {
      col.data.forEach((item, idx) => {
        const y = legendY + headerH + 1.45 + idx * rowH;
        if (!item?.code && !item?.label) return;
        doc.setFont(FONT, "normal");
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
      doc.setFont(FONT, "normal");
      doc.text(seatText, legendX + 1.6, seatY);
    }
  };

  const drawPageHeader = () => {
    let y = headerHeight;
    doc.setFontSize(14);
    doc.setFont(FONT, "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(competitionTitle, center, y, { align: "center" });

    doc.setFontSize(9);
    doc.setFont(FONT, "normal");
    doc.text(compLocation, left, y);
    doc.text(eventDateStr, right, y, { align: "right" });

    y += 2;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    y += 4;

    doc.setFontSize(12);
    doc.setFont(FONT, "bold");
    doc.text(`Entry List by ${scopeDimensionLabel}`, center, y, {
      align: "center",
    });
    y += 4.5;

    doc.setFontSize(9);
    doc.setFont(FONT, "bold");
    doc.text(asOfLabel.replace(":", ""), center, y, { align: "center" });
    y += 3.5;

    doc.setLineWidth(0.28);
    doc.setDrawColor(0);
    doc.line(left, y, right, y);
    return y + 4.5;
  };

  sections.forEach((section, sectionIdx) => {
    if (sectionIdx > 0) doc.addPage();

    let yPos = drawPageHeader();

    doc.setFontSize(11);
    doc.setFont(FONT, "bold");
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
        font: FONT,
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
      margin: { left, right: 14, bottom: 66 },
      didDrawCell: (data) => {
        if (data.section === "head" && data.column.index === 0) {
          const yLine = data.cell.y + data.cell.height;
          doc.setDrawColor(0);
          doc.setLineWidth(0.25);
          doc.line(left, yLine, right, yLine);
        }
        if (
          data.section === "body" &&
          data.column.index === 0 &&
          data.row.index > 0 &&
          data.row.raw?.isEventStart
        ) {
          doc.setDrawColor(0);
          doc.setLineWidth(0.18);
          doc.line(left, data.cell.y, right, data.cell.y);
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
    doc.setFont(FONT, "bold");
    doc.text("Crews:", left, afterTableY);
    doc.text(String(section.crews), left + 18, afterTableY);
    doc.text("Athletes:", left + 48, afterTableY);
    doc.text(String(section.athletes), left + 72, afterTableY);
  });

  paintChrome(doc, {
    headerData,
    footerData,
    sponsorData,
    asOfLabel,
    pageLabelStyle: "slash",
    legendPainter: drawWrLegendBlock,
  });

  doc.save(
    buildEntriesReportPdfFileName(
      isInternational ? "EntryListByCountry" : "EntryListByClub",
      competition,
    ),
  );
  return true;
}
