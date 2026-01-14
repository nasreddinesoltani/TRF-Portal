import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { DataGrid } from "../components/DataGrid";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const API_BASE_URL = "";

const REGISTRATION_STATUS_LABELS = {
  not_open: "Not open",
  open: "Open",
  closed: "Closed",
};

const ENTRY_STATUS_META = {
  pending: {
    label: "Pending review",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  approved: {
    label: "Approved",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-700",
  },
  withdrawn: {
    label: "Withdrawn",
    badgeClass: "border border-slate-300 bg-slate-200 text-slate-600",
  },
};

const toDocumentId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object") {
    const candidate = value._id || value.id;
    if (!candidate) {
      return null;
    }
    if (typeof candidate === "string") {
      return candidate;
    }
    if (candidate.toString) {
      return candidate.toString();
    }
  }
  return null;
};

const normaliseCategory = (category) => {
  if (!category) {
    return null;
  }
  const id = toDocumentId(category);
  if (!id) {
    return null;
  }
  return {
    id,
    abbreviation: category.abbreviation || category.code || "",
    title: category.titles?.en || category.name || category.description || "",
  };
};

const normaliseBoatClass = (boatClass) => {
  if (!boatClass) {
    return null;
  }
  const id = toDocumentId(boatClass);
  if (!id) {
    return null;
  }
  return {
    id,
    code: boatClass.code || "",
    name: boatClass.names?.en || boatClass.label || "",
    seats: boatClass.seats || boatClass.crewSize || 1,
  };
};

const CompetitionRegistration = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { competitionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const roleCanManageEntries =
    user?.role === "admin" || user?.role === "jury_president";
  const isClubManager = user?.role === "club_manager";
  const userClubId = user?.clubId || "";

  const [clubIdOverride, setClubIdOverride] = useState(() =>
    !isClubManager ? searchParams.get("clubId") || "" : ""
  );
  const resolvedClubId = isClubManager ? userClubId : clubIdOverride;

  const [clubs, setClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(false);

  const [summary, setSummary] = useState(null);
  const [competition, setCompetition] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [club, setClub] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [boatClasses, setBoatClasses] = useState([]);
  const [loadingBoatClasses, setLoadingBoatClasses] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedBoatClassId, setSelectedBoatClassId] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState([]);
  const [entryNotes, setEntryNotes] = useState("");

  const [eligibleAthletes, setEligibleAthletes] = useState([]);
  const [loadingEligible, setLoadingEligible] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [savingEntry, setSavingEntry] = useState(false);
  const [actionEntryId, setActionEntryId] = useState(null);

  const currentClubParam = useMemo(
    () => (isClubManager ? userClubId : searchParams.get("clubId") || ""),
    [isClubManager, searchParams, userClubId]
  );

  useEffect(() => {
    if (isClubManager) {
      return;
    }
    setClubIdOverride((previous) =>
      previous === currentClubParam ? previous : currentClubParam
    );
  }, [currentClubParam, isClubManager]);

  useEffect(() => {
    if (isClubManager) {
      setClubIdOverride("");
    }
  }, [isClubManager, userClubId]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const loadClubs = useCallback(async () => {
    if (!token || !roleCanManageEntries) {
      return;
    }
    setLoadingClubs(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load clubs");
      }
      setClubs(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load clubs", error);
      toast.error(error.message);
    } finally {
      setLoadingClubs(false);
    }
  }, [roleCanManageEntries, token]);

  const loadCategories = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingCategories(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/categories?includeInactive=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load categories");
      }
      setCategories(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load categories", error);
    } finally {
      setLoadingCategories(false);
    }
  }, [token]);

  const loadBoatClasses = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoadingBoatClasses(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/boat-classes?includeInactive=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load boat classes");
      }
      setBoatClasses(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load boat classes", error);
    } finally {
      setLoadingBoatClasses(false);
    }
  }, [token]);

  const loadSummary = useCallback(
    async (showLoading = true) => {
      if (!competitionId || !token) {
        return;
      }
      if (showLoading) {
        setLoadingSummary(true);
      }
      try {
        const params = new URLSearchParams();
        if (resolvedClubId) {
          params.set("clubId", resolvedClubId);
        }
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration${
            params.size ? `?${params.toString()}` : ""
          }`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            payload.message || "Failed to load registration summary"
          );
        }
        setSummary(payload);
        setCompetition(payload.competition || null);
        setPermissions(payload.permissions || null);
        setClub(payload.club || null);
        setEntries(Array.isArray(payload.entries) ? payload.entries : []);
      } catch (error) {
        console.error("Failed to load registration summary", error);
        toast.error(error.message);
        setSummary(null);
        setCompetition(null);
        setPermissions(null);
        setClub(null);
        setEntries([]);
      } finally {
        if (showLoading) {
          setLoadingSummary(false);
        }
      }
    },
    [competitionId, resolvedClubId, token]
  );

  const summaryCanSubmit = permissions?.canSubmit === true;
  const summaryCanWithdraw = permissions?.canWithdraw === true;
  const summaryCanManageEntries = permissions?.canManageEntries === true;

  const loadEligibleAthletes = useCallback(async () => {
    if (!competitionId || !token || !selectedCategoryId || !summaryCanSubmit) {
      setEligibleAthletes([]);
      return;
    }
    if (!resolvedClubId && !isClubManager) {
      setEligibleAthletes([]);
      return;
    }
    setLoadingEligible(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("category", selectedCategoryId);
      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      }
      if (resolvedClubId) {
        params.set("clubId", resolvedClubId);
      }
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/registration/eligible?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const payload = await response.json().catch(() => ({ athletes: [] }));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load eligible athletes");
      }
      setEligibleAthletes(
        Array.isArray(payload.athletes) ? payload.athletes : []
      );
    } catch (error) {
      console.error("Failed to load eligible athletes", error);
      toast.error(error.message);
      setEligibleAthletes([]);
    } finally {
      setLoadingEligible(false);
    }
  }, [
    competitionId,
    debouncedSearch,
    isClubManager,
    resolvedClubId,
    selectedCategoryId,
    summaryCanSubmit,
    token,
  ]);

  useEffect(() => {
    if (roleCanManageEntries) {
      loadClubs();
    }
  }, [loadClubs, roleCanManageEntries]);

  useEffect(() => {
    loadCategories();
    loadBoatClasses();
  }, [loadBoatClasses, loadCategories]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadEligibleAthletes();
  }, [loadEligibleAthletes]);

  useEffect(() => {
    setSelectedAthlete(null);
    setEntryNotes("");
  }, [resolvedClubId, selectedCategoryId]);

  useEffect(() => {
    if (!summaryCanSubmit) {
      setSelectedAthlete(null);
    }
  }, [summaryCanSubmit]);

  const availableCategories = useMemo(() => {
    if (summary?.competition?.allowedCategories?.length) {
      return summary.competition.allowedCategories
        .map(normaliseCategory)
        .filter(Boolean);
    }
    return categories.map(normaliseCategory).filter(Boolean);
  }, [categories, summary]);

  useEffect(() => {
    if (!availableCategories.length) {
      setSelectedCategoryId(null);
      return;
    }
    setSelectedCategoryId((previous) => {
      if (previous && availableCategories.some((cat) => cat.id === previous)) {
        return previous;
      }
      return availableCategories[0].id;
    });
  }, [availableCategories]);

  const availableBoatClasses = useMemo(() => {
    if (summary?.competition?.allowedBoatClasses?.length) {
      return summary.competition.allowedBoatClasses
        .map(normaliseBoatClass)
        .filter(Boolean);
    }
    return boatClasses.map(normaliseBoatClass).filter(Boolean);
  }, [boatClasses, summary]);

  useEffect(() => {
    if (!availableBoatClasses.length) {
      setSelectedBoatClassId("");
      return;
    }
    setSelectedBoatClassId((previous) => {
      if (previous && availableBoatClasses.some((bc) => bc.id === previous)) {
        return previous;
      }
      if (availableBoatClasses.length === 1) {
        return availableBoatClasses[0].id;
      }
      return "";
    });
  }, [availableBoatClasses]);

  const entryStatusCounts = useMemo(() => {
    return entries.reduce(
      (accumulator, entry) => {
        const key = entry.status || "unknown";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      },
      { pending: 0, approved: 0, rejected: 0, withdrawn: 0 }
    );
  }, [entries]);

  const handleClubChange = useCallback(
    (event) => {
      if (isClubManager) {
        return;
      }
      const nextValue = event.target.value;
      setClubIdOverride(nextValue);
      setSelectedAthlete(null);
      setEntryNotes("");
      setSearchTerm("");
      setDebouncedSearch("");
      if (nextValue) {
        setSearchParams({ clubId: nextValue }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    },
    [isClubManager, setSearchParams]
  );

  const requiredCrewSize = useMemo(() => {
    if (!selectedBoatClassId) return 1;
    const bc = availableBoatClasses.find((b) => b.id === selectedBoatClassId);
    return bc?.seats || 1;
  }, [selectedBoatClassId, availableBoatClasses]);

  const handleEligibleSelected = useCallback(
    (record) => {
      if (!record) return;

      if (requiredCrewSize === 1) {
        setSelectedAthlete(record);
        setSelectedCrew([record]);
      } else {
        setSelectedCrew((prev) => {
          // Avoid duplicates if the grid fires multiple times
          if (prev.find((p) => p?.athlete?.id === record.athlete.id)) {
            return prev;
          }
          if (prev.length >= requiredCrewSize) {
            toast.warning(`Maximum crew size is ${requiredCrewSize}`);
            return prev;
          }
          return [...prev, record];
        });
      }
    },
    [requiredCrewSize]
  );

  const handleEligibleDeselected = useCallback(
    (record) => {
      if (requiredCrewSize === 1) {
        setSelectedAthlete(null);
        setSelectedCrew([]);
      }
      // For crews, we don't auto-remove on deselect because Single selection mode
      // deselects the previous row when a new one is clicked.
      // Removal is handled via the remove button in the crew list.
    },
    [requiredCrewSize]
  );

  const removeCrewMember = useCallback((index) => {
    setSelectedCrew((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const moveCrewMember = useCallback((index, direction) => {
    setSelectedCrew((prev) => {
      const newCrew = [...prev];
      if (direction === -1 && index > 0) {
        [newCrew[index], newCrew[index - 1]] = [
          newCrew[index - 1],
          newCrew[index],
        ];
      } else if (direction === 1 && index < newCrew.length - 1) {
        [newCrew[index], newCrew[index + 1]] = [
          newCrew[index + 1],
          newCrew[index],
        ];
      }
      return newCrew;
    });
  }, []);

  const getSeatLabel = (index, total) => {
    const seatNumber = index + 1;
    if (seatNumber === 1) return "Bow (1)";
    if (seatNumber === total) return `Stroke (${total})`;
    return `Seat ${seatNumber}`;
  };

  const handleRowDrop = useCallback(
    (args) => {
      // args.data contains the dragged records
      const records = Array.isArray(args.data) ? args.data : [args.data];
      if (!records.length) return;

      if (requiredCrewSize === 1) {
        // For single boats, replace the selection with the first dragged item
        const record = records[0];
        setSelectedAthlete(record);
        setSelectedCrew([record]);
      } else {
        // For team boats, add unique athletes up to the limit
        setSelectedCrew((prev) => {
          const newCrew = [...prev];
          let addedCount = 0;

          for (const record of records) {
            if (!record?.athlete) continue;
            if (newCrew.length >= requiredCrewSize) break;
            if (!newCrew.find((p) => p?.athlete?.id === record.athlete.id)) {
              newCrew.push(record);
              addedCount++;
            }
          }

          if (
            addedCount < records.length &&
            newCrew.length >= requiredCrewSize
          ) {
            toast.warning(`Maximum crew size is ${requiredCrewSize}`);
          }
          return newCrew;
        });
      }
    },
    [requiredCrewSize]
  );

  const handleSubmitEntry = useCallback(async () => {
    if (!summaryCanSubmit) {
      toast.error("Registration is currently disabled for this club");
      return;
    }

    const crewToSubmit =
      requiredCrewSize === 1
        ? selectedAthlete
          ? [selectedAthlete]
          : []
        : selectedCrew;

    if (crewToSubmit.length === 0) {
      toast.warning("Select athlete(s) to register");
      return;
    }

    if (crewToSubmit.length !== requiredCrewSize) {
      toast.warning(`Please select exactly ${requiredCrewSize} athletes`);
      return;
    }

    if (!selectedCategoryId) {
      toast.warning("Select a category before submitting");
      return;
    }
    if (!isClubManager && !resolvedClubId) {
      toast.warning("Choose a club to submit entries");
      return;
    }

    const crewIds = crewToSubmit.map((a) => a.athlete?.id).filter(Boolean);
    if (crewIds.length !== crewToSubmit.length) {
      toast.error("Some athlete data is missing identifiers");
      return;
    }

    const trimmedNotes = entryNotes.trim();
    const payload = {
      entries: [
        {
          crewIds,
          categoryId: selectedCategoryId,
          boatClassId: selectedBoatClassId || undefined,
          notes: trimmedNotes || undefined,
        },
      ],
      ...(isClubManager ? {} : { clubId: resolvedClubId }),
    };

    setSavingEntry(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/competitions/${competitionId}/registration`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to create competition entry");
      }
      toast.success("Entry submitted successfully");
      setEntryNotes("");
      setSelectedAthlete(null);
      setSelectedCrew([]);
      await loadSummary(false);
      await loadEligibleAthletes();
    } catch (error) {
      console.error("Failed to create competition entry", error);
      toast.error(error.message);
    } finally {
      setSavingEntry(false);
    }
  }, [
    competitionId,
    entryNotes,
    isClubManager,
    loadEligibleAthletes,
    loadSummary,
    resolvedClubId,
    selectedAthlete,
    selectedCrew,
    requiredCrewSize,
    selectedBoatClassId,
    selectedCategoryId,
    summaryCanSubmit,
    token,
  ]);

  const handleUpdateStatus = useCallback(
    async (entryId, newStatus) => {
      if (!summaryCanManageEntries) return;
      setActionEntryId(entryId);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}/status`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to update entry status");
        }
        toast.success(`Entry ${newStatus}`);
        await loadSummary(false);
      } catch (error) {
        console.error("Failed to update entry status", error);
        toast.error(error.message);
      } finally {
        setActionEntryId(null);
      }
    },
    [competitionId, loadSummary, summaryCanManageEntries, token]
  );

  const handleWithdrawEntry = useCallback(
    async (entryId) => {
      if (!summaryCanWithdraw && !summaryCanManageEntries) return;
      if (!window.confirm("Are you sure you want to withdraw this entry?")) {
        return;
      }
      setActionEntryId(entryId);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entryId}/withdraw`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to withdraw entry");
        }
        toast.success("Entry withdrawn");
        await loadSummary(false);
      } catch (error) {
        console.error("Failed to withdraw entry", error);
        toast.error(error.message);
      } finally {
        setActionEntryId(null);
      }
    },
    [
      competitionId,
      loadSummary,
      summaryCanManageEntries,
      summaryCanWithdraw,
      token,
    ]
  );

  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const handleApproveAll = useCallback(async () => {
    if (!summaryCanManageEntries) return;
    const pendingEntries = entries.filter((e) => e.status === "pending");
    if (!pendingEntries.length) return;

    if (
      !window.confirm(
        `Are you sure you want to approve ${pendingEntries.length} pending entries?`
      )
    ) {
      return;
    }

    setIsProcessingAll(true);
    let successCount = 0;

    try {
      // Process sequentially to ensure stability
      for (const entry of pendingEntries) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/competitions/${competitionId}/registration/${entry.id}/status`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ status: "approved" }),
            }
          );
          if (response.ok) successCount++;
        } catch (e) {
          console.error(e);
        }
      }
      toast.success(`Approved ${successCount} entries`);
      await loadSummary(false);
    } catch (error) {
      toast.error("Failed to complete bulk approval");
    } finally {
      setIsProcessingAll(false);
    }
  }, [competitionId, entries, loadSummary, summaryCanManageEntries, token]);

  const entryColumns = useMemo(() => {
    const columnList = [
      {
        headerText: "Athlete / Crew",
        width: 240,
        template: (entry) => {
          if (entry?.crew && entry.crew.length > 1) {
            const teamName =
              entry.club?.code && entry.crewNumber
                ? `${entry.club.code} ${entry.crewNumber}`
                : `${entry.crew.length} Athletes`;
            return (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">
                  {teamName}
                </p>
                <div
                  className="text-xs text-slate-500 truncate"
                  title={entry.crew
                    .map((a) => `${a.firstName} ${a.lastName}`)
                    .join(", ")}
                >
                  {entry.crew
                    .map((a) => `${a.firstName} ${a.lastName}`)
                    .join(", ")}
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">
                {`${entry?.athlete?.firstName || ""} ${
                  entry?.athlete?.lastName || ""
                }`.trim() || "Unnamed athlete"}
              </p>
              <p className="text-xs text-slate-500">
                {entry?.athlete?.licenseNumber || "No license"}
              </p>
            </div>
          );
        },
      },
    ];

    if (!club?.id) {
      columnList.push({
        headerText: "Club",
        width: 180,
        template: (entry) => (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-800">
              {entry?.club?.name || "—"}
            </p>
            <p className="text-xs text-slate-500">{entry?.club?.code || ""}</p>
          </div>
        ),
      });
    }

    columnList.push(
      {
        headerText: "Category",
        width: 180,
        template: (entry) => (
          <div className="space-y-1">
            <span className="text-sm font-medium text-slate-800">
              {entry?.category?.abbreviation || "—"}
            </span>
            <p className="text-xs text-slate-500">
              {entry?.category?.titles?.en || ""}
            </p>
          </div>
        ),
      },
      {
        headerText: "Status",
        width: 160,
        template: (entry) => {
          const meta = ENTRY_STATUS_META[entry?.status] || {
            label: entry?.status || "Unknown",
            badgeClass: "border border-slate-200 bg-slate-100 text-slate-600",
          };
          return (
            <span
              className={clsx(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                meta.badgeClass
              )}
            >
              {meta.label}
            </span>
          );
        },
      },
      {
        headerText: "Submitted",
        width: 200,
        template: (entry) => {
          const submitted = entry?.submittedAt
            ? new Date(entry.submittedAt).toLocaleString()
            : "—";
          const reviewer = entry?.reviewedAt
            ? new Date(entry.reviewedAt).toLocaleString()
            : null;
          return (
            <div className="space-y-1 text-xs text-slate-500">
              <p>Submitted {submitted}</p>
              {reviewer ? <p>Reviewed {reviewer}</p> : null}
            </div>
          );
        },
      },
      {
        headerText: "Actions",
        width: 260,
        template: (entry) => {
          const isProcessing = actionEntryId === entry?.id;
          const buttons = [];

          if (
            summaryCanManageEntries &&
            entry?.status !== "approved" &&
            entry?.status !== "withdrawn"
          ) {
            buttons.push(
              <Button
                key="approve"
                type="button"
                variant="secondary"
                disabled={isProcessing}
                onClick={() => handleUpdateStatus(entry.id, "approved")}
              >
                {isProcessing ? "Working..." : "Approve"}
              </Button>
            );
          }

          if (
            summaryCanManageEntries &&
            entry?.status !== "rejected" &&
            entry?.status !== "withdrawn"
          ) {
            buttons.push(
              <Button
                key="reject"
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={() => handleUpdateStatus(entry.id, "rejected")}
              >
                {isProcessing ? "Working..." : "Reject"}
              </Button>
            );
          }

          const closeAt = competition?.registrationWindow?.closeAt
            ? new Date(competition.registrationWindow.closeAt)
            : null;
          const now = new Date();
          const isBeforeDeadline = closeAt && now <= closeAt;

          if (
            (summaryCanWithdraw || summaryCanManageEntries) &&
            (entry?.status !== "withdrawn" || isBeforeDeadline)
          ) {
            const label = isBeforeDeadline ? "Delete" : "Withdraw";

            buttons.push(
              <Button
                key="withdraw"
                type="button"
                variant="destructive"
                disabled={isProcessing}
                onClick={() => handleWithdrawEntry(entry.id)}
              >
                {isProcessing ? "Working..." : label}
              </Button>
            );
          }

          if (!buttons.length) {
            return <span className="text-xs text-slate-400">No actions</span>;
          }

          return <div className="flex flex-wrap gap-2">{buttons}</div>;
        },
      }
    );

    return columnList;
  }, [
    actionEntryId,
    club?.id,
    competition,
    handleUpdateStatus,
    handleWithdrawEntry,
    summaryCanManageEntries,
    summaryCanWithdraw,
  ]);

  const eligibleColumns = useMemo(
    () => [
      {
        field: "athlete.firstName",
        headerText: "First Name",
        width: 120,
      },
      {
        field: "athlete.lastName",
        headerText: "Last Name",
        width: 120,
      },
      {
        field: "athlete.licenseNumber",
        headerText: "License",
        width: 100,
      },
      {
        field: "athlete.gender",
        headerText: "Gender",
        width: 80,
      },
      {
        field: "assignment.ageOnCutoff",
        headerText: "Age",
        width: 60,
        textAlign: "Center",
      },
    ],
    []
  );

  const registrationStatus = competition?.registrationStatus || "not_open";
  const registrationLabel =
    REGISTRATION_STATUS_LABELS[registrationStatus] || registrationStatus;

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Competition registration
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {competition?.names?.en || competition?.code || "Competition"}
          </h1>
          <p className="text-sm text-slate-500">
            Manage athlete entries and review club submissions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isClubManager ? (
            <div className="flex items-center gap-2">
              <Select
                value={clubIdOverride}
                onChange={handleClubChange}
                disabled={loadingClubs}
                className="w-56"
              >
                <option value="">All clubs</option>
                {clubs.map((clubOption) => (
                  <option key={clubOption._id} value={clubOption._id}>
                    {clubOption.name}{" "}
                    {clubOption.code ? `(${clubOption.code})` : ""}
                  </option>
                ))}
              </Select>
              {loadingClubs ? (
                <span className="text-xs text-slate-500">Loading...</span>
              ) : null}
            </div>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </div>

      {loadingSummary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading registration workspace…
        </div>
      ) : summary ? (
        <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
          <section className="space-y-6">
            {summaryCanSubmit ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Eligible athletes
                    </h2>
                    <p className="text-sm text-slate-500">
                      Select a category, search your list, and submit entries.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    {eligibleAthletes.length} athlete
                    {eligibleAthletes.length === 1 ? "" : "s"} listed
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr),minmax(220px,1fr)] xl:grid-cols-[minmax(240px,1fr),minmax(240px,1fr),minmax(200px,1fr)]">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </label>
                    <Select
                      value={selectedCategoryId || ""}
                      onChange={(event) =>
                        setSelectedCategoryId(event.target.value || null)
                      }
                      disabled={availableCategories.length === 0}
                    >
                      {availableCategories.length === 0 ? (
                        <option value="">No categories available</option>
                      ) : null}
                      {availableCategories.map((categoryOption) => (
                        <option
                          key={categoryOption.id}
                          value={categoryOption.id}
                        >
                          {categoryOption.abbreviation ||
                            categoryOption.title ||
                            "Category"}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Boat class{" "}
                      {requiredCrewSize > 1
                        ? `(${requiredCrewSize} seats)`
                        : ""}
                    </label>
                    <Select
                      value={selectedBoatClassId}
                      onChange={(event) => {
                        setSelectedBoatClassId(event.target.value);
                        setSelectedAthlete(null);
                        setSelectedCrew([]);
                      }}
                      disabled={!availableBoatClasses.length}
                    >
                      <option value="">Any class</option>
                      {availableBoatClasses.map((boatClassOption) => (
                        <option
                          key={boatClassOption.id}
                          value={boatClassOption.id}
                        >
                          {boatClassOption.code ||
                            boatClassOption.name ||
                            "Boat class"}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Search athletes
                    </label>
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search by name or license"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white">
                  <DataGrid
                    key={`grid-${requiredCrewSize}`}
                    data={eligibleAthletes}
                    columns={eligibleColumns}
                    loading={loadingEligible}
                    emptyMessage={
                      selectedCategoryId
                        ? "No eligible athletes for this category"
                        : "Select a category to load athletes"
                    }
                    gridId="competition-registration-eligible"
                    pageSize={8}
                    selectionType="Single"
                    onRowSelected={handleEligibleSelected}
                    onRowDeselected={handleEligibleDeselected}
                    allowRowDragAndDrop={true}
                    onRowDrop={handleRowDrop}
                    rowDropTargetID="crew-drop-target"
                  />
                </div>

                <div
                  id="crew-drop-target"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  {selectedAthlete || selectedCrew.length > 0 ? (
                    <div className="space-y-4">
                      {requiredCrewSize > 1 ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-900 mb-2">
                            Selected Crew ({selectedCrew.length}/
                            {requiredCrewSize})
                          </p>
                          <ul className="space-y-2">
                            {selectedCrew.map((member, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-slate-700 flex items-center justify-between bg-white p-2 rounded border border-slate-200"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveCrewMember(idx, -1)}
                                      disabled={idx === 0}
                                      className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move Up"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="m18 15-6-6-6 6" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveCrewMember(idx, 1)}
                                      disabled={idx === selectedCrew.length - 1}
                                      className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      title="Move Down"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="m6 9 6 6 6-6" />
                                      </svg>
                                    </button>
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-900 block text-xs">
                                      {getSeatLabel(idx, requiredCrewSize)}
                                    </span>
                                    <span>
                                      {member.athlete?.firstName}{" "}
                                      {member.athlete?.lastName}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500">
                                    {member.athlete?.licenseNumber}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeCrewMember(idx)}
                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                    title="Remove"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M18 6 6 18" />
                                      <path d="m6 6 18 18" />
                                    </svg>
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {`${selectedAthlete?.athlete?.firstName || ""} ${
                              selectedAthlete?.athlete?.lastName || ""
                            }`.trim() || "Selected athlete"}
                          </p>
                          <p className="text-xs text-slate-500">
                            License{" "}
                            {selectedAthlete?.athlete?.licenseNumber || "—"}
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Notes (optional)
                          </label>
                          <textarea
                            value={entryNotes}
                            onChange={(event) =>
                              setEntryNotes(event.target.value)
                            }
                            rows={3}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                            placeholder="Add internal remarks for officials"
                          />
                        </div>
                        {requiredCrewSize === 1 && selectedAthlete && (
                          <div className="space-y-2 text-sm text-slate-600">
                            <p>
                              <span className="font-semibold text-slate-800">
                                Assigned category:
                              </span>{" "}
                              {selectedAthlete.category?.abbreviation || "—"}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-800">
                                Age on cutoff:
                              </span>{" "}
                              {selectedAthlete.assignment?.ageOnCutoff ?? "—"}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-800">
                                Gender:
                              </span>{" "}
                              {selectedAthlete.athlete?.gender || "—"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setSelectedAthlete(null);
                            setSelectedCrew([]);
                            setEntryNotes("");
                          }}
                          disabled={savingEntry}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSubmitEntry}
                          disabled={
                            savingEntry ||
                            (requiredCrewSize > 1 &&
                              selectedCrew.length !== requiredCrewSize)
                          }
                        >
                          {savingEntry ? "Submitting…" : "Submit entry"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Select{" "}
                      {requiredCrewSize > 1
                        ? `athletes (${requiredCrewSize} needed)`
                        : "an athlete"}{" "}
                      from the table above to prepare a submission.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">
                  Registration unavailable
                </h2>
                {registrationStatus !== "open" ? (
                  <p>
                    Registration is currently {registrationLabel}. You can
                    review submitted entries below.
                  </p>
                ) : !resolvedClubId && !isClubManager ? (
                  <p>
                    Select a club to start registering athletes for this
                    competition.
                  </p>
                ) : (
                  <p>
                    You do not have permission to submit entries for this
                    competition.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Submitted entries
                  </h2>
                  <span className="text-xs text-slate-500">
                    {entries.length} total
                  </span>
                </div>
                {summaryCanManageEntries && entryStatusCounts.pending > 0 && (
                  <Button
                    size="sm"
                    onClick={handleApproveAll}
                    disabled={isProcessingAll}
                  >
                    {isProcessingAll ? "Approving..." : "Approve All Pending"}
                  </Button>
                )}
              </div>
              <DataGrid
                data={entries}
                columns={entryColumns}
                loading={loadingSummary && !entries.length}
                emptyMessage="No entries have been submitted yet"
                gridId="competition-registration-entries"
                pageSize={10}
              />
            </div>
          </section>

          <aside className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">
                Event overview
              </h2>
              <p className="text-sm text-slate-500">
                {competition?.names?.en || competition?.code || "Competition"}
              </p>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-800">
                  Registration:
                </span>{" "}
                {registrationLabel}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Window:</span>{" "}
                {competition?.registrationWindow?.openAt
                  ? new Date(
                      competition.registrationWindow.openAt
                    ).toLocaleString()
                  : "TBD"}
                {competition?.registrationWindow?.closeAt
                  ? ` → ${new Date(
                      competition.registrationWindow.closeAt
                    ).toLocaleString()}`
                  : ""}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Schedule:</span>{" "}
                {competition?.startDate
                  ? new Date(competition.startDate).toLocaleDateString()
                  : "TBD"}
                {competition?.endDate
                  ? ` → ${new Date(competition.endDate).toLocaleDateString()}`
                  : ""}
              </p>
              <p>
                <span className="font-semibold text-slate-800">Season:</span>{" "}
                {competition?.season || "—"}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  Discipline:
                </span>{" "}
                {competition?.discipline || "—"}
              </p>
              <p>
                <span className="font-semibold text-slate-800">
                  Club context:
                </span>{" "}
                {club?.name || (isClubManager ? "Your club" : "All clubs")}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Entry status overview
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(entryStatusCounts).map(([status, count]) => {
                  const meta = ENTRY_STATUS_META[status] || {
                    label: status,
                    badgeClass:
                      "border border-slate-200 bg-slate-100 text-slate-600",
                  };
                  return (
                    <div
                      key={status}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {meta.label}
                      </span>
                      <span className="text-xl font-semibold text-slate-900">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Categories in scope
              </h3>
              {availableCategories.length ? (
                <div className="flex flex-wrap gap-2">
                  {availableCategories.slice(0, 8).map((category) => (
                    <span
                      key={category.id}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {category.abbreviation || category.title || "Category"}
                    </span>
                  ))}
                  {availableCategories.length > 8 ? (
                    <span className="text-xs text-slate-500">
                      +{availableCategories.length - 8} more
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No category restrictions.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Boat classes
              </h3>
              {availableBoatClasses.length ? (
                <div className="flex flex-wrap gap-2">
                  {availableBoatClasses.slice(0, 8).map((boatClass) => (
                    <span
                      key={boatClass.id}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {boatClass.code || boatClass.name || "Boat class"}
                    </span>
                  ))}
                  {availableBoatClasses.length > 8 ? (
                    <span className="text-xs text-slate-500">
                      +{availableBoatClasses.length - 8} more
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  All boat classes allowed.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Registration summary unavailable.
        </div>
      )}
    </div>
  );
};

export default CompetitionRegistration;
