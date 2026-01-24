import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const DOCUMENT_STATE_STYLES = {
  approved: "bg-emerald-50 text-emerald-600 border-emerald-200",
  pending: "bg-amber-50 text-amber-600 border-amber-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
  missing: "bg-slate-100 text-slate-500 border-slate-200",
  expired: "bg-orange-100 text-orange-600 border-orange-200",
};

const ATHLETE_STATUS_STYLES = {
  active: "bg-emerald-50 text-emerald-600 border-emerald-200",
  pending_documents: "bg-amber-50 text-amber-600 border-amber-200",
  expired_medical: "bg-orange-100 text-orange-600 border-orange-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200",
  suspended: "bg-rose-50 text-rose-600 border-rose-200",
};

const roleCanUpload = (role) => role === "admin" || role === "club_manager";
const roleCanDecide = (role) => role === "admin";

const formatDateDisplay = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateInputValue = (value) => {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const prettifyIssue = (issue) =>
  issue
    ? issue
        .toString()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (match) => match.toUpperCase())
    : "";

const normaliseStoragePath = (pathValue) =>
  pathValue ? pathValue.replace(/\\/g, "/") : null;

const sortDefinitions = (definitions, evaluation) => {
  if (!Array.isArray(definitions)) {
    return [];
  }

  const requiresParental = Boolean(evaluation?.requiresParentalAuthorization);
  const athleteIsNew = Boolean(evaluation?.athleteIsNew);

  // Check if new athlete has any approved identity document
  const hasApprovedIdentity =
    athleteIsNew &&
    evaluation?.documentStates &&
    (evaluation.documentStates.birthCertificate === "approved" ||
      evaluation.documentStates.cin === "approved" ||
      evaluation.documentStates.passport === "approved");

  // Identity documents are conditionally required for new athletes (one of them)
  const isIdentityDoc = (key) =>
    ["birthCertificate", "cin", "passport"].includes(key);

  return [...definitions].sort((a, b) => {
    const requiredA =
      Boolean(a?.required) ||
      (a?.key === "parentalAuthorization" && requiresParental) ||
      (isIdentityDoc(a?.key) && athleteIsNew && !hasApprovedIdentity);
    const requiredB =
      Boolean(b?.required) ||
      (b?.key === "parentalAuthorization" && requiresParental) ||
      (isIdentityDoc(b?.key) && athleteIsNew && !hasApprovedIdentity);

    if (requiredA !== requiredB) {
      return requiredA ? -1 : 1;
    }

    return a.label.localeCompare(b.label);
  });
};

const getDocumentState = (docType, evaluation, document) => {
  if (evaluation?.documentStates && docType in evaluation.documentStates) {
    return evaluation.documentStates[docType];
  }
  if (!document) {
    return "missing";
  }
  return document.status || "pending";
};

const isDocumentRequired = (definition, evaluation) => {
  if (!definition) {
    return false;
  }
  if (definition.required) {
    return true;
  }
  if (definition.key === "parentalAuthorization") {
    return Boolean(evaluation?.requiresParentalAuthorization);
  }

  // For new athletes, one identity document is required (Birth Certificate, CIN, or Passport)
  const isIdentityDoc = ["birthCertificate", "cin", "passport"].includes(
    definition.key
  );
  if (isIdentityDoc && evaluation?.athleteIsNew) {
    // Check if any identity document is already approved
    const hasApprovedIdentity =
      evaluation?.documentStates &&
      (evaluation.documentStates.birthCertificate === "approved" ||
        evaluation.documentStates.cin === "approved" ||
        evaluation.documentStates.passport === "approved");
    // Required only if no identity doc is approved yet
    return !hasApprovedIdentity;
  }
  return false;
};

export const AthleteDocumentsDialog = ({
  open,
  athlete,
  token,
  apiBaseUrl,
  currentUserRole,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [definitions, setDefinitions] = useState([]);
  const [documents, setDocuments] = useState({});
  const [evaluation, setEvaluation] = useState(null);
  const [expiryDrafts, setExpiryDrafts] = useState({});
  const [uploading, setUploading] = useState({});
  const [approving, setApproving] = useState({});
  const [rejecting, setRejecting] = useState({});
  const [removing, setRemoving] = useState({});
  const [medicalUpdating, setMedicalUpdating] = useState(false);

  const canUpload = roleCanUpload(currentUserRole);
  const canDecide = roleCanDecide(currentUserRole);

  const resolvedBaseUrl = useMemo(() => {
    if (!apiBaseUrl) {
      return "";
    }
    return apiBaseUrl.replace(/\/$/, "");
  }, [apiBaseUrl]);

  const resetState = useCallback(() => {
    setDefinitions([]);
    setDocuments({});
    setEvaluation(null);
    setExpiryDrafts({});
    setUploading({});
    setApproving({});
    setRejecting({});
    setRemoving({});
    setMedicalUpdating(false);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!athlete?._id || !token) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load documents");
      }

      const evaluationPayload = payload.evaluation || null;
      const docsPayload = payload.documents || {};
      const definitionsPayload = sortDefinitions(
        payload.definitions || [],
        evaluationPayload
      );

      const initialExpiryDrafts = {};
      definitionsPayload.forEach((definition) => {
        const document = docsPayload[definition.key];
        if (definition.requiresExpiry) {
          initialExpiryDrafts[definition.key] = formatDateInputValue(
            document?.expiresAt
          );
        }
      });

      setEvaluation(evaluationPayload);
      setDocuments(docsPayload);
      setDefinitions(definitionsPayload);
      setExpiryDrafts(initialExpiryDrafts);
    } catch (error) {
      console.error("Failed to load athlete documents", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [athlete?._id, resolvedBaseUrl, token]);

  useEffect(() => {
    if (open && athlete?._id) {
      fetchDocuments();
    } else {
      resetState();
    }
  }, [athlete?._id, fetchDocuments, open, resetState]);

  const updateExpiryDraft = useCallback((docType, value) => {
    setExpiryDrafts((previous) => ({ ...previous, [docType]: value }));
  }, []);

  const refreshAfterMutation = useCallback(async () => {
    await fetchDocuments();
    if (typeof onUpdated === "function") {
      try {
        await onUpdated();
      } catch (error) {
        console.error("Parent refresh failed", error);
      }
    }
  }, [fetchDocuments, onUpdated]);

  const handleUpload = useCallback(
    async (docType, file) => {
      if (!file) {
        return;
      }

      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error("File is too large. Maximum size is 10MB.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const definition = definitions.find((item) => item.key === docType);
      if (definition?.requiresExpiry && expiryDrafts[docType]) {
        formData.append("expiresAt", expiryDrafts[docType]);
      }

      try {
        setUploading((previous) => ({ ...previous, [docType]: true }));

        const response = await fetch(
          `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents/${docType}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to upload document");
        }

        toast.success("Document uploaded");
        await refreshAfterMutation();
      } catch (error) {
        console.error("Document upload failed", error);
        toast.error(error.message);
      } finally {
        setUploading((previous) => {
          const next = { ...previous };
          delete next[docType];
          return next;
        });
      }
    },
    [
      athlete?._id,
      definitions,
      expiryDrafts,
      refreshAfterMutation,
      resolvedBaseUrl,
      token,
    ]
  );

  const handleApprove = useCallback(
    async (docType) => {
      const definition = definitions.find((item) => item.key === docType);

      const payload = {};
      if (definition?.requiresExpiry) {
        const expiryValue = expiryDrafts[docType];
        if (!expiryValue) {
          toast.error("Expiry date is required before approval");
          return;
        }
        payload.expiresAt = expiryValue;
      }

      try {
        setApproving((previous) => ({ ...previous, [docType]: true }));

        const response = await fetch(
          `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents/${docType}/approve`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to approve document");
        }

        toast.success("Document approved");
        await refreshAfterMutation();
      } catch (error) {
        console.error("Document approval failed", error);
        toast.error(error.message);
      } finally {
        setApproving((previous) => {
          const next = { ...previous };
          delete next[docType];
          return next;
        });
      }
    },
    [
      athlete?._id,
      definitions,
      expiryDrafts,
      refreshAfterMutation,
      resolvedBaseUrl,
      token,
    ]
  );

  const handleReject = useCallback(
    async (docType) => {
      const reason = window.prompt(
        "Enter rejection reason",
        "Document incomplete"
      );
      if (reason === null) {
        return;
      }

      try {
        setRejecting((previous) => ({ ...previous, [docType]: true }));

        const response = await fetch(
          `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents/${docType}/reject`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ reason }),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to reject document");
        }

        toast.info("Document marked as rejected");
        await refreshAfterMutation();
      } catch (error) {
        console.error("Document rejection failed", error);
        toast.error(error.message);
      } finally {
        setRejecting((previous) => {
          const next = { ...previous };
          delete next[docType];
          return next;
        });
      }
    },
    [athlete?._id, refreshAfterMutation, resolvedBaseUrl, token]
  );

  const handleRemove = useCallback(
    async (docType) => {
      const confirmed = window.confirm("Remove this document file?");
      if (!confirmed) {
        return;
      }

      try {
        setRemoving((previous) => ({ ...previous, [docType]: true }));

        const response = await fetch(
          `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents/${docType}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to remove document");
        }

        toast.success("Document removed");
        await refreshAfterMutation();
      } catch (error) {
        console.error("Remove document failed", error);
        toast.error(error.message);
      } finally {
        setRemoving((previous) => {
          const next = { ...previous };
          delete next[docType];
          return next;
        });
      }
    },
    [athlete?._id, refreshAfterMutation, resolvedBaseUrl, token]
  );

  const handleMedicalUpdate = useCallback(async () => {
    const expiryValue = expiryDrafts.medicalCertificate;
    if (!expiryValue) {
      toast.error("Select an expiry date first");
      return;
    }

    const noteInput = window.prompt(
      "Optional note (leave blank to skip)",
      documents.medicalCertificate?.note || ""
    );
    if (noteInput === null) {
      return;
    }

    try {
      setMedicalUpdating(true);

      const response = await fetch(
        `${resolvedBaseUrl}/api/athletes/${athlete._id}/documents/medical-certificate`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            expiresAt: expiryValue,
            note: noteInput || undefined,
          }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Failed to update certificate");
      }

      toast.success("Medical certificate updated");
      await refreshAfterMutation();
    } catch (error) {
      console.error("Medical certificate update failed", error);
      toast.error(error.message);
    } finally {
      setMedicalUpdating(false);
    }
  }, [
    athlete?._id,
    documents,
    expiryDrafts,
    refreshAfterMutation,
    resolvedBaseUrl,
    token,
  ]);

  if (!open || !athlete) {
    return null;
  }

  const evaluationStatus = (evaluation?.status || athlete.status || "pending")
    .toString()
    .toLowerCase();
  const issueList = Array.isArray(evaluation?.issues)
    ? evaluation.issues.filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Documents for
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {athlete.fullName || `${athlete.firstName} ${athlete.lastName}`}
            </h2>
            <p className="text-sm text-slate-500">
              License {athlete.licenseNumber || "N/A"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                ATHLETE_STATUS_STYLES[evaluationStatus] ||
                DOCUMENT_STATE_STYLES.pending
              }`}
            >
              {prettifyIssue(evaluationStatus || "Pending")}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={fetchDocuments}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {issueList.length ? (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-xs text-amber-700">
            <p className="font-medium">Outstanding items:</p>
            <ul className="ml-4 list-disc">
              {issueList.map((issue) => (
                <li key={issue}>{prettifyIssue(issue)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              Loading documents...
            </div>
          ) : definitions.length ? (
            <div className="space-y-8">
              {/* Grouped definitions */}
              {[
                {
                  label: "Identity & Personal",
                  keys: ["photo", "birthCertificate", "cin", "passport"],
                },
                {
                  label: "Health & Authorizations",
                  keys: ["medicalCertificate", "parentalAuthorization"],
                },
              ].map((section) => {
                const sectionDocs = definitions.filter((d) =>
                  section.keys.includes(d.key)
                );
                if (sectionDocs.length === 0) return null;

                return (
                  <div key={section.label} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        {section.label}
                      </h3>
                      <div className="h-px flex-1 bg-slate-100"></div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {sectionDocs.map((definition) => {
                        const docType = definition.key;
                        const document = documents[docType];
                        const state = getDocumentState(
                          docType,
                          evaluation,
                          document
                        );
                        const required = isDocumentRequired(
                          definition,
                          evaluation
                        );
                        const uploadingState = Boolean(uploading[docType]);
                        const approvingState = Boolean(approving[docType]);
                        const rejectingState = Boolean(rejecting[docType]);
                        const removingState = Boolean(removing[docType]);
                        const docVersion = document?.uploadedAt
                          ? new Date(document.uploadedAt).getTime()
                          : "1";
                        const downloadPath = document?.storagePath
                          ? `${resolvedBaseUrl}/uploads/${normaliseStoragePath(
                              document.storagePath
                            ).replace(/^(uploads\/)+/i, "")}?v=${docVersion}`
                          : null;

                        return (
                          <div
                            key={docType}
                            className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm transition-all hover:shadow-md hover:border-indigo-100"
                          >
                            <div className="space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-[15px] font-bold text-slate-900">
                                    {definition.label}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono uppercase text-slate-400">
                                      {docType}
                                    </span>
                                    {required && (
                                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                                        Required
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span
                                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold shadow-sm ${
                                    DOCUMENT_STATE_STYLES[state] ||
                                    DOCUMENT_STATE_STYLES.pending
                                  }`}
                                >
                                  {prettifyIssue(state)}
                                </span>
                              </div>

                              {document ? (
                                <div className="space-y-2 rounded-xl bg-white p-3.5 text-[11px] text-slate-600 shadow-sm border border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-slate-400">
                                      Uploaded{" "}
                                      {formatDateDisplay(document.uploadedAt) ||
                                        "recently"}
                                    </p>
                                    {downloadPath ? (
                                      <a
                                        href={downloadPath}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                      >
                                        View File
                                      </a>
                                    ) : null}
                                  </div>
                                  {document.fileName ? (
                                    <p className="truncate text-slate-500">
                                      <span className="font-semibold">
                                        File:
                                      </span>{" "}
                                      {document.fileName}
                                    </p>
                                  ) : null}
                                  {document.expiresAt ? (
                                    <p
                                      className={`${
                                        state === "expired"
                                          ? "text-orange-600 font-bold"
                                          : "text-slate-500"
                                      }`}
                                    >
                                      <span className="font-semibold">
                                        Expires:
                                      </span>{" "}
                                      {formatDateDisplay(document.expiresAt)}
                                    </p>
                                  ) : null}
                                  {document.note ? (
                                    <p className="text-slate-500 italic">
                                      <span className="font-semibold not-italic">
                                        Note:
                                      </span>{" "}
                                      {document.note}
                                    </p>
                                  ) : null}
                                  {document.rejectionReason &&
                                  state === "rejected" ? (
                                    <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5 text-rose-700">
                                      <span className="font-bold">
                                        Rejection Reason:
                                      </span>{" "}
                                      {document.rejectionReason}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white/40 p-5 text-center transition-colors">
                                  <svg
                                    className="mb-2 h-8 w-8 text-slate-200"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1.5}
                                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.5l7 7V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                  <p className="text-xs font-semibold text-slate-400">
                                    No document uploaded yet
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="mt-5 space-y-4 pt-4 border-t border-slate-200/50">
                              {/* Actions: Upload before Expiry */}
                              {canUpload ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    id={`${docType}-file-input`}
                                    type="file"
                                    className="hidden"
                                    onChange={(event) => {
                                      const selectedFile =
                                        event.target.files?.[0];
                                      if (selectedFile) {
                                        handleUpload(docType, selectedFile);
                                      }
                                      event.target.value = "";
                                    }}
                                  />
                                  <Label
                                    htmlFor={`${docType}-file-input`}
                                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-indigo-400 hover:bg-slate-50 active:scale-[0.98] ${
                                      uploadingState
                                        ? "opacity-60 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    <svg
                                      className="h-4 w-4 text-slate-400"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                      />
                                    </svg>
                                    {uploadingState
                                      ? "Uploading..."
                                      : "Upload New File"}
                                  </Label>
                                  {document && canDecide ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-10 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold"
                                      onClick={() => handleRemove(docType)}
                                      disabled={removingState}
                                    >
                                      {removingState ? (
                                        "..."
                                      ) : (
                                        <svg
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                      )}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}

                              {definition.requiresExpiry ? (
                                <div className="space-y-2 rounded-xl bg-slate-100/50 p-3 border border-slate-200/40">
                                  <Label
                                    className="text-[10px] font-black uppercase tracking-widest text-slate-400"
                                    htmlFor={`${docType}-expiry`}
                                  >
                                    Document Expiry Date
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id={`${docType}-expiry`}
                                      type="date"
                                      className="h-9 text-xs font-semibold bg-white border-slate-200 shadow-sm focus:ring-indigo-500"
                                      value={expiryDrafts[docType] || ""}
                                      onChange={(event) =>
                                        updateExpiryDraft(
                                          docType,
                                          event.target.value
                                        )
                                      }
                                      disabled={!canUpload && !canDecide}
                                    />
                                    {docType === "medicalCertificate" &&
                                      (canUpload || canDecide) && (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="h-9 px-4 text-[10px] font-black uppercase tracking-tighter shadow-sm"
                                          onClick={handleMedicalUpdate}
                                          disabled={medicalUpdating}
                                        >
                                          {medicalUpdating ? "..." : "Save"}
                                        </Button>
                                      )}
                                  </div>
                                </div>
                              ) : null}

                              {document && canDecide ? (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    className="h-10 flex-1 bg-indigo-600 text-white shadow-md hover:bg-indigo-700 active:scale-[0.98] font-bold text-xs"
                                    onClick={() => handleApprove(docType)}
                                    disabled={approvingState}
                                  >
                                    {approvingState
                                      ? "Approving..."
                                      : "Approve Document"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-10 px-4 border-rose-200 text-rose-600 hover:bg-rose-50 active:scale-[0.98] font-bold text-xs"
                                    onClick={() => handleReject(docType)}
                                    disabled={rejectingState}
                                  >
                                    {rejectingState ? "..." : "Reject"}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-500">
              No document definitions found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AthleteDocumentsDialog;
