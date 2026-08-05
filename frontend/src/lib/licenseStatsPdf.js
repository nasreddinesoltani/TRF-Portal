import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  STAT_LABELS,
  categoryTitle,
  clubName,
  governorateLabel,
} from "./statisticsLabels.js";

// Load a font file and return its base64 payload (for jsPDF VFS registration).
const loadFont = async (url) => {
  try {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (error) {
    console.error("Failed to load Amiri font", error);
    return null;
  }
};

/**
 * Generate and download the License Statistics PDF for the given report data
 * and language. Uses jsPDF + autoTable to match the rest of the app, and the
 * bundled Amiri font (public/fonts/Amiri-Regular.ttf) for Arabic text.
 * For Arabic (RTL) the table columns are reversed so the report reads
 * right-to-left, matching the legacy Excel layout.
 */
export const generateLicenseStatsPdf = async ({ report, lang = "ar" }) => {
  if (!report) return;

  const t = STAT_LABELS[lang] || STAT_LABELS.ar;
  const isRtl = lang === "ar";
  const categories = report.categories || [];

  // Reverse a row for RTL so it reads right-to-left.
  const rtl = (arr) => (isRtl ? [...arr].reverse() : arr);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Register Arabic font (falls back to helvetica if it can't be loaded).
  const arabicFontBase64 = await loadFont("/fonts/Amiri-Regular.ttf");
  let font = "helvetica";
  if (arabicFontBase64) {
    try {
      doc.addFileToVFS("Amiri-Regular.ttf", arabicFontBase64);
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      // Alias bold + italic to the same file so any bold fallback (e.g. table
      // headers/footers) still renders Arabic correctly instead of garbling.
      doc.addFont("Amiri-Regular.ttf", "Amiri", "bold");
      doc.addFont("Amiri-Regular.ttf", "Amiri", "italic");
      font = "Amiri";
    } catch (error) {
      console.error("Failed to register Amiri font", error);
    }
  }

  // ---- Title block -------------------------------------------------------
  doc.setFont(font, "normal");
  doc.setFontSize(15);
  doc.text(
    `${t.reportTitle} — ${t.season} ${report.season}`,
    pageWidth / 2,
    14,
    { align: "center" },
  );
  doc.setFontSize(10);
  doc.text(t.federation, pageWidth / 2, 20, { align: "center" });

  // Always use Latin (en-GB) numerals for the date so it is not visually
  // reversed inside the RTL Arabic layout.
  const generatedOn = report.generatedAt
    ? new Date(report.generatedAt).toLocaleDateString("en-GB")
    : "";
  doc.setFontSize(8);
  doc.text(`${t.generatedOn}: ${generatedOn}`, pageWidth / 2, 25, {
    align: "center",
  });

  // ---- Main table: club x category x gender ------------------------------
  const topHeader = [
    { content: t.club, rowSpan: 2 },
    ...categories.map((c) => ({
      content: categoryTitle(c, lang),
      colSpan: 2,
      styles: { halign: "center" },
    })),
    { content: t.total, rowSpan: 2 },
    { content: t.percent, rowSpan: 2 },
  ];
  const subHeader = categories.flatMap(() => [
    { content: t.male, styles: { halign: "center" } },
    { content: t.female, styles: { halign: "center" } },
  ]);

  const body = (report.clubs || []).map((club) => {
    const cells = [clubName(club, lang)];
    categories.forEach((c) => {
      const bucket = club.byCategory?.[c.abbreviation] || {
        male: 0,
        female: 0,
      };
      cells.push(bucket.male || 0, bucket.female || 0);
    });
    cells.push(club.total || 0, `${club.percent || 0}%`);
    return cells;
  });

  // Grand total footer row for the main table.
  const footerCells = [t.grandTotal];
  categories.forEach((c) => {
    const cat = (report.categoryTotals || []).find(
      (ct) => ct.abbreviation === c.abbreviation,
    );
    footerCells.push(cat?.male || 0, cat?.female || 0);
  });
  footerCells.push(
    report.grandTotal?.total || 0,
    `${report.grandTotal?.total ? 100 : 0}%`,
  );

  // The club column is index 0 for LTR, or the last column for RTL.
  const columnCount = 1 + categories.length * 2 + 2;
  const clubColIndex = isRtl ? columnCount - 1 : 0;

  autoTable(doc, {
    startY: 30,
    head: [rtl(topHeader), rtl(subHeader)],
    body: body.map((row) => rtl(row)),
    foot: [rtl(footerCells)],
    theme: "grid",
    styles: {
      font,
      fontStyle: "normal",
      fontSize: 7,
      cellPadding: 1,
      halign: "center",
    },
    headStyles: {
      font,
      fontStyle: "normal",
      fillColor: [30, 64, 129],
      textColor: 255,
      fontSize: 7,
      halign: "center",
    },
    footStyles: {
      font,
      fontStyle: "normal",
      fillColor: [226, 232, 240],
      textColor: 20,
      fontSize: 7,
    },
    columnStyles: {
      [clubColIndex]: { halign: isRtl ? "right" : "left", cellWidth: 40 },
    },
  });

  // ---- Summary tables: by category & by governorate ----------------------
  const y = (doc.lastAutoTable?.finalY || 30) + 8;

  const categorySummaryBody = (report.categoryTotals || []).map((cat) =>
    rtl([
      categoryTitle(cat, lang),
      cat.male || 0,
      cat.female || 0,
      cat.total || 0,
    ]),
  );
  categorySummaryBody.push(
    rtl([
      t.grandTotal,
      report.grandTotal?.male || 0,
      report.grandTotal?.female || 0,
      report.grandTotal?.total || 0,
    ]),
  );

  const governorateSummaryBody = (report.governorateTotals || []).map((gov) =>
    rtl([
      gov.governorate === "غير محدد"
        ? t.unknownGovernorate
        : governorateLabel(gov.governorate, lang),
      gov.male || 0,
      gov.female || 0,
      gov.total || 0,
    ]),
  );
  governorateSummaryBody.push(
    rtl([
      t.grandTotal,
      report.grandTotal?.male || 0,
      report.grandTotal?.female || 0,
      report.grandTotal?.total || 0,
    ]),
  );

  const summaryHead = [rtl([t.category, t.male, t.female, t.total])];
  const govHead = [rtl([t.governorate, t.male, t.female, t.total])];

  // Label column is index 0 for LTR, last (index 3) for RTL.
  const labelColIndex = isRtl ? 3 : 0;
  const summaryStyles = {
    font,
    fontStyle: "normal",
    fontSize: 8,
    cellPadding: 1.5,
    halign: "center",
  };
  const summaryHeadStyles = {
    font,
    fontStyle: "normal",
    fillColor: [30, 64, 129],
    textColor: 255,
    halign: "center",
  };
  const summaryColumnStyles = {
    [labelColIndex]: { halign: isRtl ? "right" : "left" },
  };

  const half = pageWidth / 2;

  autoTable(doc, {
    startY: y,
    margin: { left: 10, right: half + 2 },
    head: summaryHead,
    body: categorySummaryBody,
    theme: "grid",
    styles: summaryStyles,
    headStyles: summaryHeadStyles,
    columnStyles: summaryColumnStyles,
  });

  autoTable(doc, {
    startY: y,
    margin: { left: half + 2, right: 10 },
    head: govHead,
    body: governorateSummaryBody,
    theme: "grid",
    styles: summaryStyles,
    headStyles: summaryHeadStyles,
    columnStyles: summaryColumnStyles,
  });

  doc.save(`license_statistics_${report.season}_${lang}.pdf`);
};
