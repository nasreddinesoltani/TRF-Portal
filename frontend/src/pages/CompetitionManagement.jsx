import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { DataGrid } from "../components/DataGrid";

const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

const DISCIPLINE_OPTIONS = [
  { value: "all", label: "All disciplines" },
  { value: "classic", label: "Classic / flatwater" },
  { value: "coastal", label: "Coastal" },
  { value: "beach", label: "Beach sprint" },
  { value: "indoor", label: "Indoor" },
];

const COMPETITION_TYPES = [
  { value: "single_day", label: "Single day" },
  { value: "multi_day", label: "Multi-day" },
  { value: "multi_stage", label: "Multi-stage season" },
  { value: "championship", label: "Championship" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const REGISTRATION_STATUS_LABELS = {
  not_open: "Not open",
  open: "Open",
  closed: "Closed",
};

const RESULTS_STATUS_LABELS = {
  pending: "Pending",
  unofficial: "Unofficial",
  official: "Official",
};

const STATUS_BADGES = {
  draft: "bg-slate-100 text-slate-600 border border-slate-200",
  published: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  archived: "bg-amber-50 text-amber-600 border border-amber-200",
};

const REGISTRATION_BADGES = {
  not_open: "bg-slate-200 text-slate-700",
  open: "bg-blue-100 text-blue-700",
  closed: "bg-slate-300 text-slate-600",
};

const RESULTS_BADGES = {
  pending: "bg-slate-200 text-slate-600",
  unofficial: "bg-amber-100 text-amber-700",
  official: "bg-emerald-100 text-emerald-700",
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

const describeScheduleStatus = (startDate, endDate) => {
  if (!startDate) {
    return "Schedule to be confirmed";
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return "Schedule to be confirmed";
  }

  const now = new Date();
  const diffToStart = start.getTime() - now.getTime();

  if (diffToStart > 0) {
    const days = Math.ceil(diffToStart / MS_PER_DAY);
    return `Starts in ${days} day${days === 1 ? "" : "s"}`;
  }

  const end = endDate ? new Date(endDate) : null;
  if (end && !Number.isNaN(end.getTime())) {
    const diffToEnd = end.getTime() - now.getTime();
    if (diffToEnd >= 0) {
      return "In progress";
    }
    const daysAgo = Math.ceil(Math.abs(diffToEnd) / MS_PER_DAY);
    return `Finished ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
  }

  return "In progress";
};

const formatDateInput = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

const formatDateRange = (startDate, endDate) => {
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const startLabel = startDate
    ? dateFormatter.format(new Date(startDate))
    : null;
  const endLabel = endDate ? dateFormatter.format(new Date(endDate)) : null;

  if (startLabel && endLabel) {
    if (startLabel === endLabel) {
      return startLabel;
    }
    return `${startLabel} – ${endLabel}`;
  }

  if (startLabel || endLabel) {
    return startLabel || endLabel;
  }

  return "Dates to be confirmed";
};

const formatDisplayDate = (value) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const computeRegistrationState = (competition) => {
  if (!competition) {
    return {
      key: "not_open",
      label: "Not open",
      isOpen: false,
    };
  }

  const explicitStatus = competition.registrationStatus;
  if (explicitStatus === "open") {
    return { key: "open", label: "Open", isOpen: true };
  }

  if (explicitStatus === "closed") {
    return { key: "closed", label: "Closed", isOpen: false };
  }

  const openAtRaw = competition.registrationWindow?.openAt;
  const closeAtRaw = competition.registrationWindow?.closeAt;

  const openAt = openAtRaw ? new Date(openAtRaw) : null;
  const closeAt = closeAtRaw ? new Date(closeAtRaw) : null;

  const openAtValid = openAt && !Number.isNaN(openAt.getTime()) ? openAt : null;
  const closeAtValid =
    closeAt && !Number.isNaN(closeAt.getTime()) ? closeAt : null;

  const now = new Date();

  const withinWindow =
    (!openAtValid || openAtValid <= now) &&
    (!closeAtValid || closeAtValid >= now);

  if (withinWindow && (openAtValid || closeAtValid)) {
    const label = openAtValid || closeAtValid ? "Open (per schedule)" : "Open";
    return {
      key: "open",
      label,
      isOpen: true,
    };
  }

  if (openAtValid && openAtValid > now) {
    return {
      key: "not_open",
      label: `Opens ${formatDisplayDate(openAtValid)}`.trim(),
      isOpen: false,
    };
  }

  if (closeAtValid && closeAtValid < now) {
    return {
      key: "closed",
      label: "Closed",
      isOpen: false,
    };
  }

  return {
    key: explicitStatus || "not_open",
    label: REGISTRATION_STATUS_LABELS[explicitStatus] || "Not open",
    isOpen: false,
  };
};

const createDefaultFormState = () => {
  const year = new Date().getFullYear();
  return {
    code: "",
    discipline: "classic",
    competitionType: "single_day",
    season: year.toString(),
    nameEn: "",
    nameFr: "",
    nameAr: "",
    startDate: "",
    endDate: "",
    venueName: "",
    venueCity: "",
    venueCountry: "",
    defaultDistance: "",
    allowUpCategory: true,
    registrationOpenAt: "",
    registrationCloseAt: "",
    notes: "",
    allowedCategories: [],
    allowedBoatClasses: [],
  };
};

const CompetitionManagement = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [formState, setFormState] = useState(createDefaultFormState());
  const [editingId, setEditingId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [boatClasses, setBoatClasses] = useState([]);

  const [selectedCompetitionId, setSelectedCompetitionId] = useState(null);

  const detailPanelRef = useRef(null);
  const scrollToDetailRef = useRef(false);

  const isAdmin = user?.role === "admin";
  const isJury = user?.role === "jury_president";
  const isClubManager = user?.role === "club_manager";
  const canManage = isAdmin || isJury;
  const canViewCalendar = Boolean(token);

  const loadCompetitions = useCallback(async () => {
    if (!token) {
      setCompetitions([]);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (disciplineFilter !== "all") {
        params.set("discipline", disciplineFilter);
      }
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }
      if (seasonFilter.trim()) {
        params.set("season", seasonFilter.trim());
      }

      const query = params.toString();
      const response = await fetch(
        `${API_BASE_URL}/api/competitions${query ? `?${query}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load competitions");
      }

      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
        ? payload.items
        : [];
      setCompetitions(items);
    } catch (error) {
      console.error("Failed to load competitions", error);
      setErrorMessage(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [disciplineFilter, seasonFilter, statusFilter, token]);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions, refreshKey]);

  const loadReferenceData = useCallback(async () => {
    if (!token) {
      setCategories([]);
      setBoatClasses([]);
      return;
    }

    try {
      const [categoriesResponse, boatClassesResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/categories?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/api/boat-classes?includeInactive=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const categoriesPayload = await categoriesResponse.json().catch(() => []);
      const boatClassesPayload = await boatClassesResponse
        .json()
        .catch(() => []);

      if (categoriesResponse.ok) {
        setCategories(
          Array.isArray(categoriesPayload) ? categoriesPayload : []
        );
      }
      if (boatClassesResponse.ok) {
        setBoatClasses(
          Array.isArray(boatClassesPayload) ? boatClassesPayload : []
        );
      }
    } catch (error) {
      console.error("Failed to load competition reference data", error);
    }
  }, [token]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  const focusCompetitionDetails = useCallback((competitionId, options = {}) => {
    setSelectedCompetitionId(competitionId);
    scrollToDetailRef.current =
      Boolean(competitionId) && Boolean(options?.scroll);
  }, []);

  const categoryMap = useMemo(() => {
    return categories.reduce((accumulator, category) => {
      const id = toDocumentId(category);
      if (id) {
        accumulator[id] = {
          abbreviation: category.abbreviation || category.code || "",
          name: category.titles?.en || category.name || "",
        };
      }
      return accumulator;
    }, {});
  }, [categories]);

  const boatClassMap = useMemo(() => {
    return boatClasses.reduce((accumulator, boatClass) => {
      const id = toDocumentId(boatClass);
      if (id) {
        accumulator[id] = {
          code: boatClass.code || "",
          name: boatClass.names?.en || boatClass.label || "",
        };
      }
      return accumulator;
    }, {});
  }, [boatClasses]);

  const resetDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogMode("create");
    setFormState(createDefaultFormState());
    setDialogSubmitting(false);
    setEditingId(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    if (!canManage) {
      return;
    }
    setDialogMode("create");
    setFormState(createDefaultFormState());
    setEditingId(null);
    setDialogOpen(true);
  }, [canManage]);

  const openEditDialog = useCallback(
    async (competitionId) => {
      if (!competitionId || !canManage) {
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || "Failed to load competition");
        }

        setDialogMode("edit");
        setEditingId(competitionId);
        setFormState({
          code: payload.code || "",
          discipline: payload.discipline || "classic",
          competitionType: payload.competitionType || "single_day",
          season:
            payload.season?.toString() || new Date().getFullYear().toString(),
          nameEn: payload.names?.en || "",
          nameFr: payload.names?.fr || "",
          nameAr: payload.names?.ar || "",
          startDate: formatDateInput(payload.startDate),
          endDate: formatDateInput(payload.endDate),
          venueName: payload.venue?.name || "",
          venueCity: payload.venue?.city || "",
          venueCountry: payload.venue?.country || "",
          defaultDistance:
            payload.defaultDistance !== undefined
              ? payload.defaultDistance.toString()
              : "",
          allowUpCategory: Boolean(payload.allowUpCategory),
          registrationOpenAt: formatDateInput(
            payload.registrationWindow?.openAt
          ),
          registrationCloseAt: formatDateInput(
            payload.registrationWindow?.closeAt
          ),
          notes: payload.notes || "",
          allowedCategories: Array.isArray(payload.allowedCategories)
            ? payload.allowedCategories.map(
                (category) =>
                  category?._id?.toString?.() || category?.toString?.() || ""
              )
            : [],
          allowedBoatClasses: Array.isArray(payload.allowedBoatClasses)
            ? payload.allowedBoatClasses.map(
                (boatClass) =>
                  boatClass?._id?.toString?.() || boatClass?.toString?.() || ""
              )
            : [],
        });
        setDialogOpen(true);
      } catch (error) {
        console.error("Failed to open competition dialog", error);
        toast.error(error.message);
      }
    },
    [canManage, token]
  );

  const handleInputChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleMultiToggle = useCallback((field, value) => {
    setFormState((previous) => {
      const current = new Set(previous[field] || []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return {
        ...previous,
        [field]: Array.from(current),
      };
    });
  }, []);

  const submitCompetition = async (method, endpoint) => {
    const payload = {
      code: formState.code.trim(),
      discipline: formState.discipline,
      competitionType: formState.competitionType,
      season: Number(formState.season),
      names: {
        en: formState.nameEn.trim(),
        fr: formState.nameFr.trim(),
        ar: formState.nameAr.trim(),
      },
      startDate: formState.startDate
        ? new Date(formState.startDate).toISOString()
        : undefined,
      endDate: formState.endDate
        ? new Date(formState.endDate).toISOString()
        : undefined,
      venue: {
        name: formState.venueName.trim() || undefined,
        city: formState.venueCity.trim() || undefined,
        country: formState.venueCountry.trim() || undefined,
      },
      allowUpCategory: Boolean(formState.allowUpCategory),
      allowedCategories: formState.allowedCategories,
      allowedBoatClasses: formState.allowedBoatClasses,
      defaultDistance: formState.defaultDistance
        ? Number(formState.defaultDistance)
        : undefined,
      notes: formState.notes.trim() || undefined,
      registrationWindow: {
        openAt: formState.registrationOpenAt
          ? new Date(formState.registrationOpenAt).toISOString()
          : undefined,
        closeAt: formState.registrationCloseAt
          ? new Date(formState.registrationCloseAt).toISOString()
          : undefined,
      },
    };

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Failed to save competition");
    }

    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) {
      toast.error("You do not have permission to modify competitions");
      return;
    }

    if (!formState.code.trim()) {
      toast.error("Competition code is required");
      return;
    }

    if (
      !formState.nameEn.trim() ||
      !formState.nameFr.trim() ||
      !formState.nameAr.trim()
    ) {
      toast.error("Competition names in all languages are required");
      return;
    }

    if (!formState.startDate || !formState.endDate) {
      toast.error("Start and end date are required");
      return;
    }

    setDialogSubmitting(true);

    try {
      if (dialogMode === "create") {
        await submitCompetition("POST", `${API_BASE_URL}/api/competitions`);
        toast.success("Competition created");
      } else if (editingId) {
        await submitCompetition(
          "PUT",
          `${API_BASE_URL}/api/competitions/${editingId}`
        );
        toast.success("Competition updated");
      }
      resetDialog();
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      console.error("Failed to save competition", error);
      toast.error(error.message);
      setDialogSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (competitionId) => {
      if (!canManage || !competitionId) {
        return;
      }

      // First, check if competition has races with results
      let hasResults = false;
      let raceCount = 0;
      try {
        const racesRes = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/races`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (racesRes.ok) {
          const racesData = await racesRes.json();
          const races = Array.isArray(racesData) ? racesData : [];
          raceCount = races.length;
          hasResults = races.some((race) =>
            race.lanes?.some(
              (lane) => lane.time || lane.position || lane.status === "finished"
            )
          );
        }
      } catch (err) {
        console.warn("Could not check for results", err);
      }

      let confirmMessage =
        "Delete this competition? This action cannot be undone.";
      if (hasResults) {
        confirmMessage =
          "⚠️ WARNING: This competition has recorded RESULTS!\n\n" +
          `It contains ${raceCount} race(s) with times and positions.\n` +
          "Deleting it will permanently remove ALL race data and results.\n\n" +
          "Are you absolutely sure you want to delete this competition?";
      } else if (raceCount > 0) {
        confirmMessage =
          `This competition has ${raceCount} race(s) scheduled.\n\n` +
          "Delete this competition? This action cannot be undone.";
      }

      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to delete competition");
        }
        toast.success("Competition deleted");
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to delete competition", error);
        toast.error(error.message);
      }
    },
    [canManage, token]
  );

  const handleStatusUpdate = useCallback(
    async (competitionId, updates) => {
      if (!canManage || !competitionId) {
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(updates),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.message || "Failed to update competition status"
          );
        }
        toast.success("Competition status updated");
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to update competition status", error);
        toast.error(error.message);
      }
    },
    [canManage, token]
  );

  const handleCompetitionRowSelected = useCallback(
    (record) => {
      const id = toDocumentId(record);
      if (id) {
        focusCompetitionDetails(id, { scroll: true });
      }
    },
    [focusCompetitionDetails]
  );

  const handleCompetitionRowDeselected = useCallback(
    (record) => {
      const id = toDocumentId(record);
      if (id && id === selectedCompetitionId) {
        focusCompetitionDetails(null);
      }
    },
    [focusCompetitionDetails, selectedCompetitionId]
  );

  const filteredCompetitions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return competitions;
    }
    return competitions.filter((item) => {
      const values = [
        item.code,
        item?.names?.en,
        item?.names?.fr,
        item?.names?.ar,
        item?.venue?.name,
        item?.venue?.city,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return values.some((value) => value.includes(term));
    });
  }, [competitions, searchTerm]);

  const selectedCompetition = useMemo(() => {
    if (!selectedCompetitionId) {
      return null;
    }
    return (
      filteredCompetitions.find(
        (item) => toDocumentId(item) === selectedCompetitionId
      ) || null
    );
  }, [filteredCompetitions, selectedCompetitionId]);

  const selectedCompetitionDocumentId = useMemo(() => {
    return toDocumentId(selectedCompetition);
  }, [selectedCompetition]);

  const registrationState = useMemo(
    () => computeRegistrationState(selectedCompetition),
    [selectedCompetition]
  );

  const selectedCompetitionRegistrationOpen = registrationState.isOpen;

  if (!canViewCalendar) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
          Competition calendar access is not enabled for your role.
        </div>
      </div>
    );
  }

  const handleOpenRacePlanner = useCallback(() => {
    if (!selectedCompetitionDocumentId) {
      toast.warn("Select a competition to plan races");
      return;
    }
    navigate(`/competitions/${selectedCompetitionDocumentId}/races`);
  }, [navigate, selectedCompetitionDocumentId]);

  useEffect(() => {
    if (filteredCompetitions.length === 0) {
      if (selectedCompetitionId) {
        focusCompetitionDetails(null);
      }
      return;
    }

    const exists = filteredCompetitions.some(
      (item) => toDocumentId(item) === selectedCompetitionId
    );

    if (!exists) {
      const firstId = toDocumentId(filteredCompetitions[0]);
      if (firstId) {
        focusCompetitionDetails(firstId);
      }
    }
  }, [filteredCompetitions, focusCompetitionDetails, selectedCompetitionId]);

  useEffect(() => {
    if (!selectedCompetitionId) {
      return;
    }
    if (!scrollToDetailRef.current) {
      return;
    }
    scrollToDetailRef.current = false;
    detailPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [selectedCompetitionId]);

  const summary = useMemo(() => {
    const total = filteredCompetitions.length;
    const byStatus = filteredCompetitions.reduce(
      (accumulator, item) => {
        const key = item.status || "unknown";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      },
      { draft: 0, published: 0, archived: 0, unknown: 0 }
    );
    const upcoming = filteredCompetitions.filter((item) => {
      if (!item.startDate) {
        return false;
      }
      return new Date(item.startDate) >= new Date();
    }).length;
    return { total, byStatus, upcoming };
  }, [filteredCompetitions]);

  const countdownLabel = useMemo(() => {
    if (!selectedCompetition) {
      return null;
    }
    return describeScheduleStatus(
      selectedCompetition.startDate,
      selectedCompetition.endDate
    );
  }, [selectedCompetition]);

  const allowedCategoryLabels = useMemo(() => {
    if (!selectedCompetition?.allowedCategories?.length) {
      return [];
    }
    const seen = new Set();
    return selectedCompetition.allowedCategories
      .map((category) => {
        const id = toDocumentId(category);
        if (!id || seen.has(id)) {
          return null;
        }
        seen.add(id);

        const known = categoryMap[id];
        if (known) {
          return [known.abbreviation, known.name].filter(Boolean).join(" • ");
        }

        if (category && typeof category === "object") {
          const fallback = [
            category.abbreviation || category.code,
            category.titles?.en || category.name || category.label,
          ]
            .filter(Boolean)
            .join(" • ");
          if (fallback) {
            return fallback;
          }
        }
        return `Category ${id.slice(-4)}`;
      })
      .filter(Boolean);
  }, [categoryMap, selectedCompetition]);

  const allowedBoatClassLabels = useMemo(() => {
    if (!selectedCompetition?.allowedBoatClasses?.length) {
      return [];
    }
    const seen = new Set();
    return selectedCompetition.allowedBoatClasses
      .map((boatClass) => {
        const id = toDocumentId(boatClass);
        if (!id || seen.has(id)) {
          return null;
        }
        seen.add(id);

        const known = boatClassMap[id];
        if (known) {
          return [known.code, known.name].filter(Boolean).join(" • ");
        }

        if (boatClass && typeof boatClass === "object") {
          const fallback = [
            boatClass.code,
            boatClass.names?.en || boatClass.label,
          ]
            .filter(Boolean)
            .join(" • ");
          if (fallback) {
            return fallback;
          }
        }
        return `Boat class ${id.slice(-4)}`;
      })
      .filter(Boolean);
  }, [boatClassMap, selectedCompetition]);

  const selectedDisciplineLabel = useMemo(() => {
    if (!selectedCompetition?.discipline) {
      return null;
    }
    return (
      DISCIPLINE_OPTIONS.find(
        (option) => option.value === selectedCompetition.discipline
      )?.label || selectedCompetition.discipline
    );
  }, [selectedCompetition]);

  const selectedTypeLabel = useMemo(() => {
    if (!selectedCompetition?.competitionType) {
      return null;
    }
    return (
      COMPETITION_TYPES.find(
        (option) => option.value === selectedCompetition.competitionType
      )?.label || selectedCompetition.competitionType
    );
  }, [selectedCompetition]);

  const locationLabel = useMemo(() => {
    if (!selectedCompetition?.venue) {
      return null;
    }
    const chunks = [
      selectedCompetition.venue.name,
      selectedCompetition.venue.city,
      selectedCompetition.venue.country,
    ].filter(Boolean);
    return chunks.length ? chunks.join(" • ") : null;
  }, [selectedCompetition]);

  const defaultDistanceLabel = useMemo(() => {
    if (
      selectedCompetition?.defaultDistance !== undefined &&
      selectedCompetition?.defaultDistance !== null
    ) {
      return `${selectedCompetition.defaultDistance} m`;
    }
    return "Set per event";
  }, [selectedCompetition]);

  const renderStatusCell = useCallback((competition) => {
    if (!competition) {
      return null;
    }
    const statusClass =
      STATUS_BADGES[competition.status] || STATUS_BADGES.draft;
    const registrationState = computeRegistrationState(competition);
    const registrationLabel = registrationState.label || "Unknown";
    const resultsLabel =
      RESULTS_STATUS_LABELS[competition.resultsStatus] || "Unknown";
    return (
      <div className="flex flex-col gap-2 text-xs">
        <span
          className={clsx(
            "inline-flex w-fit items-center rounded-full px-3 py-1 font-semibold",
            statusClass
          )}
        >
          {competition.status || "Draft"}
        </span>
        <span className="text-slate-600">
          Registration • {registrationLabel}
        </span>
        <span className="text-slate-600">Results • {resultsLabel}</span>
      </div>
    );
  }, []);

  const renderScheduleCell = useCallback((competition) => {
    if (!competition) {
      return null;
    }
    const range = formatDateRange(competition.startDate, competition.endDate);
    const venueChunks = [
      competition.venue?.name,
      competition.venue?.city,
      competition.venue?.country,
    ]
      .filter(Boolean)
      .join(" • ");
    return (
      <div className="flex flex-col text-sm text-slate-700">
        <span className="font-medium">{range}</span>
        {venueChunks ? (
          <span className="text-xs text-slate-500">{venueChunks}</span>
        ) : null}
      </div>
    );
  }, []);

  const renderDisciplineCell = useCallback((competition) => {
    if (!competition) {
      return null;
    }
    const disciplineLabel =
      DISCIPLINE_OPTIONS.find(
        (option) => option.value === competition.discipline
      )?.label || competition.discipline;
    const typeLabel =
      COMPETITION_TYPES.find(
        (option) => option.value === competition.competitionType
      )?.label || competition.competitionType;
    return (
      <div className="flex flex-col gap-1 text-xs text-slate-600">
        <span className="text-sm font-semibold text-slate-900">
          {competition.code}
        </span>
        <span className="text-sm text-slate-700">
          {competition.names?.en || "Unnamed"}
        </span>
        <span>{disciplineLabel}</span>
        <span>{typeLabel}</span>
      </div>
    );
  }, []);

  const renderActionsCell = useCallback(
    (competition) => {
      if (!competition) {
        return null;
      }
      const competitionId = toDocumentId(competition);
      const registrationState = computeRegistrationState(competition);
      const actions = [];
      if (canManage) {
        if (competitionId) {
          // Show Beach Sprint button for beach discipline
          if (competition.discipline === "beach") {
            actions.push(
              <Button
                key="beach-sprint"
                type="button"
                variant="secondary"
                onClick={() =>
                  navigate(`/competitions/${competitionId}/beach-sprint`)
                }
              >
                🏖️ Beach Sprint
              </Button>
            );
          } else {
            actions.push(
              <Button
                key="plan"
                type="button"
                variant="secondary"
                onClick={() => navigate(`/competitions/${competitionId}/races`)}
              >
                Plan races
              </Button>
            );
          }
          actions.push(
            <Button
              key="rankings"
              type="button"
              variant="outline"
              onClick={() =>
                navigate(`/competitions/${competitionId}/rankings`)
              }
            >
              🏆 Rankings
            </Button>
          );
        }
        actions.push(
          <Button
            key="edit"
            type="button"
            variant="outline"
            onClick={() => openEditDialog(competition._id)}
          >
            Edit
          </Button>
        );
        if (competition.status !== "published") {
          actions.push(
            <Button
              key="publish"
              type="button"
              variant="secondary"
              onClick={() =>
                handleStatusUpdate(competition._id, {
                  status: "published",
                  registrationStatus: competition.registrationStatus || "open",
                })
              }
            >
              Publish
            </Button>
          );
        }
        if (competition.registrationStatus !== "closed") {
          actions.push(
            <Button
              key="closeReg"
              type="button"
              variant="secondary"
              onClick={() =>
                handleStatusUpdate(competition._id, {
                  registrationStatus: "closed",
                })
              }
            >
              Close registration
            </Button>
          );
        }
        if (competition.resultsStatus !== "official") {
          actions.push(
            <Button
              key="official"
              type="button"
              variant="secondary"
              onClick={() =>
                handleStatusUpdate(competition._id, {
                  resultsStatus: "official",
                })
              }
            >
              Mark official
            </Button>
          );
        }
        actions.push(
          <Button
            key="delete"
            type="button"
            variant="destructive"
            onClick={() => handleDelete(competition._id)}
          >
            Delete
          </Button>
        );
      } else {
        if (competitionId && registrationState.isOpen) {
          actions.push(
            <Button
              key="register"
              type="button"
              variant="secondary"
              onClick={() =>
                navigate(`/competitions/${competitionId}/register`)
              }
            >
              Register athletes
            </Button>
          );
        }
        if (competitionId) {
          actions.push(
            <Button
              key="view"
              type="button"
              variant="outline"
              onClick={() =>
                focusCompetitionDetails(competitionId, { scroll: true })
              }
            >
              View details
            </Button>
          );
        }
      }
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {actions}
        </div>
      );
    },
    [
      canManage,
      handleDelete,
      handleStatusUpdate,
      navigate,
      openEditDialog,
      focusCompetitionDetails,
    ]
  );

  const columns = useMemo(
    () => [
      {
        headerText: "Competition",
        width: 240,
        template: renderDisciplineCell,
      },
      {
        headerText: "Schedule",
        width: 220,
        template: renderScheduleCell,
      },
      {
        headerText: "Status",
        width: 220,
        template: renderStatusCell,
      },
      {
        headerText: "Actions",
        width: 320,
        template: renderActionsCell,
      },
    ],
    [
      renderActionsCell,
      renderDisciplineCell,
      renderScheduleCell,
      renderStatusCell,
    ]
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-8 sm:px-6 xl:px-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Competition framework
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Competition management
          </h1>
          <p className="text-sm text-slate-500">
            Plan national events, control registration windows, and publish
            official results.
          </p>
          {isClubManager ? (
            <p className="text-xs text-slate-500">
              Browse the federation calendar and register eligible club athletes
              when events open for entries.
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-xs text-rose-500">{errorMessage}</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={openCreateDialog}>
              New competition
            </Button>
          </div>
        ) : null}
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="disciplineFilter">Discipline</Label>
            <Select
              id="disciplineFilter"
              value={disciplineFilter}
              onChange={(event) => setDisciplineFilter(event.target.value)}
            >
              {DISCIPLINE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="statusFilter">Status</Label>
            <Select
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seasonFilter">Season</Label>
            <Input
              id="seasonFilter"
              placeholder="e.g. 2025"
              value={seasonFilter}
              onChange={(event) => setSeasonFilter(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchTerm">Search</Label>
            <Input
              id="searchTerm"
              placeholder="Code, venue, or name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">
              {summary.total}
            </span>{" "}
            competitions • Upcoming {summary.upcoming}
          </p>
          <p className="mt-1">
            Draft {summary.byStatus.draft}, Published{" "}
            {summary.byStatus.published}, Archived {summary.byStatus.archived}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Competition library
            </h2>
            <p className="text-sm text-slate-500">
              Manage events across the federation calendar.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {loading
              ? "Loading competitions..."
              : `${filteredCompetitions.length} event${
                  filteredCompetitions.length === 1 ? "" : "s"
                }`}
          </span>
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <DataGrid
            data={filteredCompetitions}
            columns={columns}
            loading={loading}
            gridId="competition-management-grid"
            onRowSelected={handleCompetitionRowSelected}
            onRowDeselected={handleCompetitionRowDeselected}
            emptyMessage={
              searchTerm
                ? "No competitions match the current search."
                : "No competitions found."
            }
          />
        </div>
        {selectedCompetition ? (
          <div
            ref={detailPanelRef}
            className="border-t border-slate-100 bg-slate-50/70 px-6 py-6"
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-400">
                    <span>{selectedCompetition.code}</span>
                    {selectedCompetition.season ? (
                      <span>• Season {selectedCompetition.season}</span>
                    ) : null}
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    {selectedCompetition.names?.en || "Unnamed competition"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {formatDateRange(
                      selectedCompetition.startDate,
                      selectedCompetition.endDate
                    )}
                    {locationLabel ? ` • ${locationLabel}` : ""}
                  </p>
                  {countdownLabel ? (
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {countdownLabel}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        STATUS_BADGES[selectedCompetition.status] ||
                          STATUS_BADGES.draft
                      )}
                    >
                      {selectedCompetition.status || "Draft"}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        REGISTRATION_BADGES[registrationState.key] ||
                          REGISTRATION_BADGES.not_open
                      )}
                    >
                      Registration • {registrationState.label || "Unknown"}
                    </span>
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                        RESULTS_BADGES[selectedCompetition.resultsStatus] ||
                          RESULTS_BADGES.pending
                      )}
                    >
                      Results •{" "}
                      {RESULTS_STATUS_LABELS[
                        selectedCompetition.resultsStatus
                      ] || "Unknown"}
                    </span>
                  </div>

                  {canManage && selectedCompetitionDocumentId ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleOpenRacePlanner}
                      >
                        Plan races
                      </Button>
                      {selectedCompetition.status !== "published" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              status: "published",
                              registrationStatus:
                                selectedCompetition.registrationStatus ===
                                "closed"
                                  ? "closed"
                                  : "open",
                            })
                          }
                        >
                          Publish now
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              status: "draft",
                            })
                          }
                        >
                          Revert to draft
                        </Button>
                      )}

                      {selectedCompetition.status !== "archived" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              status: "archived",
                            })
                          }
                        >
                          Archive
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              status: "draft",
                            })
                          }
                        >
                          Restore
                        </Button>
                      )}

                      {selectedCompetition.registrationStatus !== "open" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              registrationStatus: "open",
                            })
                          }
                        >
                          Open registration
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              registrationStatus: "closed",
                            })
                          }
                        >
                          Close registration
                        </Button>
                      )}

                      {selectedCompetition.resultsStatus !== "official" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              resultsStatus: "official",
                            })
                          }
                        >
                          Mark official
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          onClick={() =>
                            handleStatusUpdate(selectedCompetitionDocumentId, {
                              resultsStatus: "pending",
                            })
                          }
                        >
                          Reset results
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          handleDelete(selectedCompetitionDocumentId)
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  ) : isClubManager && selectedCompetitionDocumentId ? (
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!selectedCompetitionRegistrationOpen}
                        onClick={() =>
                          selectedCompetitionRegistrationOpen
                            ? navigate(
                                `/competitions/${selectedCompetitionDocumentId}/register`
                              )
                            : null
                        }
                      >
                        {selectedCompetitionRegistrationOpen
                          ? "Register athletes"
                          : "Registration closed"}
                      </Button>
                      {!selectedCompetitionRegistrationOpen ? (
                        <p className="max-w-xs text-right text-xs text-slate-500">
                          Registration opens once the federation enables the
                          event. You can still review the competition programme
                          below.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Discipline
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedDisciplineLabel || "—"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                    Format
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedTypeLabel || "—"}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                    Default distance
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {defaultDistanceLabel}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.28em] text-slate-400">
                    Up-category
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {selectedCompetition.allowUpCategory
                      ? "Allowed"
                      : "Not allowed"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Allowed categories
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allowedCategoryLabels.length ? (
                      allowedCategoryLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        All categories allowed
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Allowed boat classes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allowedBoatClassLabels.length ? (
                      allowedBoatClassLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        All boat classes allowed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedCompetition.notes ? (
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Notes
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {selectedCompetition.notes}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-500">
            Select a competition to see planning details.
          </div>
        )}
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {dialogMode === "create"
                    ? "Create competition"
                    : canManage
                    ? "Edit competition"
                    : "Competition details"}
                </h2>
                <p className="text-sm text-slate-500">
                  Localise the event name, define the season, and configure
                  participation rules.
                </p>
              </div>
              <button
                type="button"
                onClick={resetDialog}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="sr-only">Close</span>X
              </button>
            </div>
            <form
              className="max-h-[75vh] overflow-y-auto px-6 py-6"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formCode">Competition code</Label>
                  <Input
                    id="formCode"
                    name="code"
                    value={formState.code}
                    onChange={handleInputChange}
                    placeholder="e.g. TRF-OPEN-25"
                    required
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formSeason">Season</Label>
                  <Input
                    id="formSeason"
                    name="season"
                    type="number"
                    min="2000"
                    max="2100"
                    value={formState.season}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formDiscipline">Discipline</Label>
                  <Select
                    id="formDiscipline"
                    name="discipline"
                    value={formState.discipline}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  >
                    {DISCIPLINE_OPTIONS.filter(
                      (option) => option.value !== "all"
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formType">Competition type</Label>
                  <Select
                    id="formType"
                    name="competitionType"
                    value={formState.competitionType}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  >
                    {COMPETITION_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="formNameEn">English name</Label>
                  <Input
                    id="formNameEn"
                    name="nameEn"
                    value={formState.nameEn}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formNameFr">French name</Label>
                  <Input
                    id="formNameFr"
                    name="nameFr"
                    value={formState.nameFr}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formNameAr">Arabic name</Label>
                  <Input
                    id="formNameAr"
                    name="nameAr"
                    value={formState.nameAr}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formStartDate">Start date</Label>
                  <Input
                    id="formStartDate"
                    name="startDate"
                    type="date"
                    value={formState.startDate}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formEndDate">End date</Label>
                  <Input
                    id="formEndDate"
                    name="endDate"
                    type="date"
                    value={formState.endDate}
                    onChange={handleInputChange}
                    required
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="formVenueName">Venue name</Label>
                  <Input
                    id="formVenueName"
                    name="venueName"
                    value={formState.venueName}
                    onChange={handleInputChange}
                    placeholder="National Rowing Center"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formVenueCity">City</Label>
                  <Input
                    id="formVenueCity"
                    name="venueCity"
                    value={formState.venueCity}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formVenueCountry">Country</Label>
                  <Input
                    id="formVenueCountry"
                    name="venueCountry"
                    value={formState.venueCountry}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formRegistrationOpen">
                    Registration opens
                  </Label>
                  <Input
                    id="formRegistrationOpen"
                    name="registrationOpenAt"
                    type="date"
                    value={formState.registrationOpenAt}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formRegistrationClose">
                    Registration closes
                  </Label>
                  <Input
                    id="formRegistrationClose"
                    name="registrationCloseAt"
                    type="date"
                    value={formState.registrationCloseAt}
                    onChange={handleInputChange}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formDefaultDistance">
                    Default race distance (m)
                  </Label>
                  <Input
                    id="formDefaultDistance"
                    name="defaultDistance"
                    type="number"
                    min="0"
                    value={formState.defaultDistance}
                    onChange={handleInputChange}
                    placeholder="2000"
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-700">
                    Options
                  </Label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="allowUpCategory"
                      checked={formState.allowUpCategory}
                      onChange={handleInputChange}
                      disabled={!canManage}
                    />
                    Allow athletes to race in superior category if permitted
                  </label>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <legend className="text-sm font-semibold text-slate-700">
                    Allowed categories
                  </legend>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                    {categories.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No categories loaded or available.
                      </p>
                    ) : (
                      categories.map((category) => (
                        <label
                          key={category._id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={formState.allowedCategories.includes(
                              category._id
                            )}
                            onChange={() =>
                              handleMultiToggle(
                                "allowedCategories",
                                category._id
                              )
                            }
                            disabled={!canManage}
                          />
                          <span>
                            {category.abbreviation} •{" "}
                            {category.titles?.en || "Unnamed"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>

                <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <legend className="text-sm font-semibold text-slate-700">
                    Allowed boat classes
                  </legend>
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                    {boatClasses.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No boat classes available.
                      </p>
                    ) : (
                      boatClasses.map((boatClass) => (
                        <label
                          key={boatClass._id}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={formState.allowedBoatClasses.includes(
                              boatClass._id
                            )}
                            onChange={() =>
                              handleMultiToggle(
                                "allowedBoatClasses",
                                boatClass._id
                              )
                            }
                            disabled={!canManage}
                          />
                          <span>
                            {boatClass.code} •{" "}
                            {boatClass.names?.en || "Unnamed"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
              </div>

              <div className="mt-6 space-y-2">
                <Label htmlFor="formNotes">Notes</Label>
                <textarea
                  id="formNotes"
                  name="notes"
                  value={formState.notes}
                  onChange={handleInputChange}
                  rows={4}
                  disabled={!canManage}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  placeholder="Internal notes, logistics reminders, or broadcast info."
                />
              </div>

              {canManage ? (
                <div className="mt-6 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetDialog}
                    disabled={dialogSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={dialogSubmitting}>
                    {dialogSubmitting
                      ? dialogMode === "create"
                        ? "Creating..."
                        : "Saving..."
                      : dialogMode === "create"
                      ? "Create"
                      : "Save changes"}
                  </Button>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CompetitionManagement;
