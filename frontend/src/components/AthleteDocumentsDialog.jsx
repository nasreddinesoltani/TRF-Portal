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

  return [...definitions].sort((a, b) => {
    const requiredA =
      Boolean(a?.required) ||
      (a?.key === "parentalAuthorization" && requiresParental);
    const requiredB =
      Boolean(b?.required) ||
      (b?.key === "parentalAuthorization" && requiresParental);

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
            <div className="grid gap-4 md:grid-cols-2">
              {definitions.map((definition) => {
                const docType = definition.key;
                const document = documents[docType];
                const state = getDocumentState(docType, evaluation, document);
                const required = isDocumentRequired(definition, evaluation);
                const uploadingState = Boolean(uploading[docType]);
                const approvingState = Boolean(approving[docType]);
                const rejectingState = Boolean(rejecting[docType]);
                const removingState = Boolean(removing[docType]);
                const downloadPath = document?.storagePath
                  ? `${resolvedBaseUrl}/uploads/${normaliseStoragePath(
                      document.storagePath
                    )}`
                  : null;

                return (
                  <div
                    key={docType}
                    className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {definition.label}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {docType}
                            {required ? " • Required" : ""}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                            DOCUMENT_STATE_STYLES[state] ||
                            DOCUMENT_STATE_STYLES.pending
                          }`}
                        >
                          {prettifyIssue(state)}
                        </span>
                      </div>

                      {document ? (
                        <div className="space-y-2 rounded-lg bg-white p-3 text-xs text-slate-600">
                          <p>
                            Uploaded{" "}
                            {formatDateDisplay(document.uploadedAt) ||
                              "recently"}
                          </p>
                          {document.fileName ? (
                            <p className="truncate">
                              File: {document.fileName}
                            </p>
                          ) : null}
                          {document.expiresAt ? (
                            <p>
                              Expires {formatDateDisplay(document.expiresAt)}
                            </p>
                          ) : null}
                          {document.note ? <p>Note: {document.note}</p> : null}
                          {document.rejectionReason && state === "rejected" ? (
                            <p className="text-rose-600">
                              Reason: {document.rejectionReason}
                            </p>
                          ) : null}
                          {downloadPath ? (
                            <a
                              href={downloadPath}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-xs font-medium text-indigo-600 hover:underline"
                            >
                              Open file
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-xs text-slate-500">
                          No document uploaded yet.
                        </p>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      {definition.requiresExpiry ? (
                        <div className="space-y-1">
                          <Label
                            className="text-xs"
                            htmlFor={`${docType}-expiry`}
                          >
                            Expiry date
                          </Label>
                          <Input
                            id={`${docType}-expiry`}
                            type="date"
                            value={expiryDrafts[docType] || ""}
                            onChange={(event) =>
                              updateExpiryDraft(docType, event.target.value)
                            }
                            disabled={!canUpload && !canDecide}
                          />
                        </div>
                      ) : null}

                      {canUpload ? (
                        <div className="flex items-center gap-2">
                          <input
                            id={`${docType}-file-input`}
                            type="file"
                            className="hidden"
                            onChange={(event) => {
                              const selectedFile = event.target.files?.[0];
                              if (selectedFile) {
                                handleUpload(docType, selectedFile);
                              }
                              event.target.value = "";
                            }}
                          />
                          <Label
                            htmlFor={`${docType}-file-input`}
                            className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 ${
                              uploadingState ? "opacity-60" : ""
                            }`}
                          >
                            {uploadingState ? "Uploading..." : "Upload file"}
                          </Label>
                          {document && canDecide ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleRemove(docType)}
                              disabled={removingState}
                            >
                              {removingState ? "Removing..." : "Remove"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      {document && canDecide ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => handleApprove(docType)}
                            disabled={approvingState}
                          >
                            {approvingState ? "Approving..." : "Approve"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleReject(docType)}
                            disabled={rejectingState}
                          >
                            {rejectingState ? "Rejecting..." : "Reject"}
                          </Button>
                        </div>
                      ) : null}

                      {docType === "medicalCertificate" && canDecide ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleMedicalUpdate}
                          disabled={medicalUpdating}
                        >
                          {medicalUpdating
                            ? "Updating..."
                            : "Update medical info"}
                        </Button>
                      ) : null}
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
