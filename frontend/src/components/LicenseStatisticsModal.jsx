import { Fragment, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { X, Download, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import {
  STAT_LANGUAGES,
  STAT_LABELS,
  categoryTitle,
  clubName,
  governorateLabel,
} from "../lib/statisticsLabels.js";
import { generateLicenseStatsPdf } from "../lib/licenseStatsPdf.js";

const API_BASE_URL = "";

/**
 * Full-screen dialog that displays the federation license statistics report
 * (club x category x gender, plus category and governorate summaries) with an
 * AR / FR / EN language switcher and a PDF export button.
 */
export default function LicenseStatisticsModal({ open, onClose, season }) {
  const { token } = useAuth();
  const [lang, setLang] = useState("ar");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isRtl = lang === "ar";
  const t = STAT_LABELS[lang] || STAT_LABELS.ar;

  useEffect(() => {
    if (!open || !token) return;

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const query = season ? `?season=${season}` : "";
        const res = await fetch(
          `${API_BASE_URL}/api/athletes/license-statistics${query}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          throw new Error("Failed to load license statistics");
        }
        setReport(await res.json());
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error(err);
          toast.error("Failed to load license statistics");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [open, token, season]);

  const categories = report?.categories || [];

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      await generateLicenseStatsPdf({ report, lang });
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  const grand = report?.grandTotal || { male: 0, female: 0, total: 0 };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div
        className="flex h-full w-full max-w-[95vw] flex-col rounded-2xl bg-white shadow-2xl"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {t.reportTitle}
            </h2>
            <p className="text-sm text-slate-500">
              {t.federation} • {t.season} {report?.season || season || ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language switcher */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {STAT_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    lang === l.code
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleExport}
              disabled={!report || exporting || loading}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t.exportPdf}
            </Button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : !report || (report.clubs || []).length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              {t.noData}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Main cross-tab table */}
              <section>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  {t.byClub}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th
                          rowSpan={2}
                          className="border border-blue-800 px-2 py-1 text-start"
                        >
                          {t.club}
                        </th>
                        {categories.map((c) => (
                          <th
                            key={c.abbreviation}
                            colSpan={2}
                            className="border border-blue-800 px-2 py-1 text-center"
                          >
                            {categoryTitle(c, lang)}
                          </th>
                        ))}
                        <th
                          rowSpan={2}
                          className="border border-blue-800 px-2 py-1 text-center"
                        >
                          {t.total}
                        </th>
                        <th
                          rowSpan={2}
                          className="border border-blue-800 px-2 py-1 text-center"
                        >
                          {t.percent}
                        </th>
                      </tr>
                      <tr className="bg-blue-800 text-white">
                        {categories.map((c) => (
                          <Fragment key={`sub-${c.abbreviation}`}>
                            <th className="border border-blue-700 px-2 py-1 text-center font-normal">
                              {t.male}
                            </th>
                            <th className="border border-blue-700 px-2 py-1 text-center font-normal">
                              {t.female}
                            </th>
                          </Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.clubs.map((club, idx) => (
                        <tr
                          key={club.clubId}
                          className={idx % 2 ? "bg-slate-50" : "bg-white"}
                        >
                          <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">
                            {clubName(club, lang)}
                          </td>
                          {categories.map((c) => {
                            const bucket = club.byCategory?.[
                              c.abbreviation
                            ] || {
                              male: 0,
                              female: 0,
                            };
                            return (
                              <Fragment
                                key={`${club.clubId}-${c.abbreviation}`}
                              >
                                <td className="border border-slate-200 px-2 py-1 text-center">
                                  {bucket.male || 0}
                                </td>
                                <td className="border border-slate-200 px-2 py-1 text-center text-rose-600">
                                  {bucket.female || 0}
                                </td>
                              </Fragment>
                            );
                          })}
                          <td className="border border-slate-200 px-2 py-1 text-center font-bold">
                            {club.total || 0}
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">
                            {club.percent || 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-200 font-bold">
                        <td className="border border-slate-300 px-2 py-1">
                          {t.grandTotal}
                        </td>
                        {categories.map((c) => {
                          const cat = (report.categoryTotals || []).find(
                            (ct) => ct.abbreviation === c.abbreviation,
                          );
                          return (
                            <Fragment key={`tot-${c.abbreviation}`}>
                              <td className="border border-slate-300 px-2 py-1 text-center">
                                {cat?.male || 0}
                              </td>
                              <td className="border border-slate-300 px-2 py-1 text-center">
                                {cat?.female || 0}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {grand.total}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          100%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              {/* Summary tables */}
              <div className="grid gap-8 lg:grid-cols-2">
                {/* By category */}
                <section>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    {t.byCategory}
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="px-3 py-2 text-start">{t.category}</th>
                          <th className="px-3 py-2 text-center">{t.male}</th>
                          <th className="px-3 py-2 text-center">{t.female}</th>
                          <th className="px-3 py-2 text-center">{t.total}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.categoryTotals || []).map((cat, idx) => (
                          <tr
                            key={cat.abbreviation}
                            className={idx % 2 ? "bg-slate-50" : "bg-white"}
                          >
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {categoryTitle(cat, lang)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {cat.male || 0}
                            </td>
                            <td className="px-3 py-2 text-center text-rose-600">
                              {cat.female || 0}
                            </td>
                            <td className="px-3 py-2 text-center font-bold">
                              {cat.total || 0}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 font-bold">
                          <td className="px-3 py-2">{t.grandTotal}</td>
                          <td className="px-3 py-2 text-center">
                            {grand.male}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {grand.female}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {grand.total}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* By governorate */}
                <section>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                    {t.byGovernorate}
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-blue-900 text-white">
                          <th className="px-3 py-2 text-start">
                            {t.governorate}
                          </th>
                          <th className="px-3 py-2 text-center">{t.male}</th>
                          <th className="px-3 py-2 text-center">{t.female}</th>
                          <th className="px-3 py-2 text-center">{t.total}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.governorateTotals || []).map((gov, idx) => (
                          <tr
                            key={gov.governorate}
                            className={idx % 2 ? "bg-slate-50" : "bg-white"}
                          >
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {gov.governorate === "غير محدد"
                                ? t.unknownGovernorate
                                : governorateLabel(gov.governorate, lang)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {gov.male || 0}
                            </td>
                            <td className="px-3 py-2 text-center text-rose-600">
                              {gov.female || 0}
                            </td>
                            <td className="px-3 py-2 text-center font-bold">
                              {gov.total || 0}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-200 font-bold">
                          <td className="px-3 py-2">{t.grandTotal}</td>
                          <td className="px-3 py-2 text-center">
                            {grand.male}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {grand.female}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {grand.total}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
