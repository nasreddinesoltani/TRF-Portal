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
import {
  Calendar,
  MapPin,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Edit3,
  Trash2,
  FileText,
  Download,
  Ship,
  Award,
  Users,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
  Waves,
  Zap,
  Filter,
  X,
  FileSpreadsheet,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const getBase64ImageFromUrl = async (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
  });
};

import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";

const API_BASE_URL = "";

const DISCIPLINE_OPTIONS = [
  { value: "all", label: "All disciplines" },
  { value: "classic", label: "Classic" },
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
  { value: "completed", label: "Completed" },
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
  completed: "bg-blue-50 text-blue-700 border border-blue-200",
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
    stages: [],
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
        },
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
          Array.isArray(categoriesPayload) ? categoriesPayload : [],
        );
      }
      if (boatClassesResponse.ok) {
        setBoatClasses(
          Array.isArray(boatClassesPayload) ? boatClassesPayload : [],
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
          },
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
            payload.registrationWindow?.openAt,
          ),
          registrationCloseAt: formatDateInput(
            payload.registrationWindow?.closeAt,
          ),
          notes: payload.notes || "",
          allowedCategories: Array.isArray(payload.allowedCategories)
            ? payload.allowedCategories.map(
                (category) =>
                  category?._id?.toString?.() || category?.toString?.() || "",
              )
            : [],
          allowedBoatClasses: Array.isArray(payload.allowedBoatClasses)
            ? payload.allowedBoatClasses.map(
                (boatClass) =>
                  boatClass?._id?.toString?.() || boatClass?.toString?.() || "",
              )
            : [],
          stages: Array.isArray(payload.stages)
            ? payload.stages.map((stage) => ({
                name: stage.name || "",
                date: formatDateInput(stage.date),
                registrationOpenDate: formatDateInput(
                  stage.registrationOpenDate,
                ),
                registrationCloseDate: formatDateInput(
                  stage.registrationCloseDate,
                ),
                order: stage.order,
                isFinalDay: Boolean(stage.isFinalDay),
              }))
            : [],
        });
        setDialogOpen(true);
      } catch (error) {
        console.error("Failed to open competition dialog", error);
        toast.error(error.message);
      }
    },
    [canManage, token],
  );

  const handleStageChange = useCallback((index, field, value) => {
    setFormState((previous) => {
      const newStages = [...(previous.stages || [])];
      newStages[index] = { ...newStages[index], [field]: value };
      return { ...previous, stages: newStages };
    });
  }, []);

  const handleAddStage = useCallback(() => {
    setFormState((previous) => {
      const newStages = [
        ...(previous.stages || []),
        {
          name: "",
          date: "",
          registrationOpenDate: "",
          registrationCloseDate: "",
          isFinalDay: false,
          order: previous.stages?.length ? previous.stages.length + 1 : 1,
        },
      ];
      return { ...previous, stages: newStages };
    });
  }, []);

  const handleRemoveStage = useCallback((index) => {
    setFormState((previous) => {
      const newStages = [...(previous.stages || [])];
      newStages.splice(index, 1);
      return { ...previous, stages: newStages };
    });
  }, []);

  const handleInputChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormState((previous) => {
      const newState = {
        ...previous,
        [name]: type === "checkbox" ? checked : value,
      };
      // Clear allowed boat classes when discipline changes (they may not be valid for new discipline)
      if (name === "discipline" && value !== previous.discipline) {
        newState.allowedBoatClasses = [];
      }
      return newState;
    });
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
      stages:
        formState.competitionType === "championship"
          ? formState.stages.map((stage, idx) => ({
              name: stage.name || `Journey ${idx + 1}`,
              date: stage.date ? new Date(stage.date).toISOString() : undefined,
              registrationOpenDate: stage.registrationOpenDate
                ? new Date(stage.registrationOpenDate).toISOString()
                : undefined,
              registrationCloseDate: stage.registrationCloseDate
                ? new Date(stage.registrationCloseDate).toISOString()
                : undefined,
              order: stage.order ?? idx + 1,
              isFinalDay: Boolean(stage.isFinalDay),
            }))
          : undefined,
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
          `${API_BASE_URL}/api/competitions/${editingId}`,
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
          },
        );
        if (racesRes.ok) {
          const racesData = await racesRes.json();
          const races = Array.isArray(racesData) ? racesData : [];
          raceCount = races.length;
          hasResults = races.some((race) =>
            race.lanes?.some(
              (lane) =>
                lane.time || lane.position || lane.status === "finished",
            ),
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
          },
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
    [canManage, token],
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
          },
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.message || "Failed to update competition status",
          );
        }
        toast.success("Competition status updated");
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to update competition status", error);
        toast.error(error.message);
      }
    },
    [canManage, token],
  );

  const handleCompetitionRowSelected = useCallback(
    (record) => {
      const id = toDocumentId(record);
      if (id) {
        focusCompetitionDetails(id, { scroll: true });
      }
    },
    [focusCompetitionDetails],
  );

  const handleCompetitionRowDeselected = useCallback(
    (record) => {
      const id = toDocumentId(record);
      if (id && id === selectedCompetitionId) {
        focusCompetitionDetails(null);
      }
    },
    [focusCompetitionDetails, selectedCompetitionId],
  );

  const filteredCompetitions = useMemo(() => {
    let result = [...competitions];

    // Order by newest first (descending by startDate, then createdAt)
    result.sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return createdB - createdA;
    });

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((item) => {
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
    }

    return result;
  }, [competitions, searchTerm]);

  const selectedCompetition = useMemo(() => {
    if (!selectedCompetitionId) {
      return null;
    }
    return (
      filteredCompetitions.find(
        (item) => toDocumentId(item) === selectedCompetitionId,
      ) || null
    );
  }, [filteredCompetitions, selectedCompetitionId]);

  const selectedCompetitionDocumentId = useMemo(() => {
    return toDocumentId(selectedCompetition);
  }, [selectedCompetition]);

  const registrationState = useMemo(
    () => computeRegistrationState(selectedCompetition),
    [selectedCompetition],
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
      (item) => toDocumentId(item) === selectedCompetitionId,
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
      { draft: 0, published: 0, archived: 0, unknown: 0 },
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
      selectedCompetition.endDate,
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

  // Filter boat classes by the selected discipline in the form
  const filteredBoatClasses = useMemo(() => {
    if (!formState.discipline) {
      return boatClasses;
    }
    return boatClasses.filter(
      (boatClass) => boatClass.discipline === formState.discipline,
    );
  }, [boatClasses, formState.discipline]);

  const selectedDisciplineLabel = useMemo(() => {
    if (!selectedCompetition?.discipline) {
      return null;
    }
    return (
      DISCIPLINE_OPTIONS.find(
        (option) => option.value === selectedCompetition.discipline,
      )?.label || selectedCompetition.discipline
    );
  }, [selectedCompetition]);

  const selectedTypeLabel = useMemo(() => {
    if (!selectedCompetition?.competitionType) {
      return null;
    }
    return (
      COMPETITION_TYPES.find(
        (option) => option.value === selectedCompetition.competitionType,
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

  // Pagination state for custom card list
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredCompetitions.length / itemsPerPage));
  const paginatedCompetitions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCompetitions.slice(start, start + itemsPerPage);
  }, [filteredCompetitions, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [filteredCompetitions.length]);

  const getDisciplineColor = (discipline) => {
    const map = { classic: "#3b82f6", coastal: "#14b8a6", beach: "#f59e0b", indoor: "#8b5cf6" };
    return map[discipline] || "#64748b";
  };

  const getDisciplineIcon = (discipline) => {
    const icons = { classic: Ship, coastal: Waves, beach: Zap, indoor: Award };
    return icons[discipline] || Trophy;
  };

  // --- PDF Export ---
  const exportSinglePDF = useCallback(async (comp) => {
    if (!comp) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();

    // Load Logo
    const logoBase64 = await getBase64ImageFromUrl("/TRF-AR-EN-Small.png");

    // Header bar
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 36, "F");
    
    if (logoBase64) {
      // Original size 400x87 (~4.6 aspect ratio). Height 16 implies Width ~73.6
      doc.addImage(logoBase64, "PNG", pw - 88, 10, 73.6, 16); 
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Tunisian Rowing Federation", 14, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Competition Detail Report", 14, 24);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 30);

    let y = 48;
    // Competition title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(comp.names?.en || "Unnamed", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Code: ${comp.code || "N/A"}  |  Season: ${comp.season || "N/A"}`, 14, y);
    y += 12;

    // Info table
    const disciplineLabel = DISCIPLINE_OPTIONS.find(o => o.value === comp.discipline)?.label || comp.discipline;
    const typeLabel = COMPETITION_TYPES.find(o => o.value === comp.competitionType)?.label || comp.competitionType;
    const venue = [comp.venue?.name, comp.venue?.city, comp.venue?.country].filter(Boolean).join(", ") || "N/A";
    const dateRange = formatDateRange(comp.startDate, comp.endDate);
    const regState = computeRegistrationState(comp);

    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: [
        ["Status", (comp.status || "draft").charAt(0).toUpperCase() + (comp.status || "draft").slice(1)],
        ["Discipline", disciplineLabel],
        ["Format", typeLabel],
        ["Dates", dateRange],
        ["Venue", venue],
        ["Default Distance", comp.defaultDistance ? `${comp.defaultDistance} m` : "Set per event"],
        ["Up-category", comp.allowUpCategory ? "Allowed" : "Not allowed"],
        ["Registration", regState.label],
        ["Results", RESULTS_STATUS_LABELS[comp.resultsStatus] || "Pending"],
      ],
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = doc.lastAutoTable.finalY + 12;

    // Categories
    if (comp.allowedCategories?.length) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Allowed Categories", 14, y);
      y += 6;
      const catRows = comp.allowedCategories.map(cat => {
        const id = toDocumentId(cat);
        const known = categoryMap[id];
        return [known?.abbreviation || (cat?.abbreviation || ""), known?.name || (cat?.titles?.en || cat?.name || "Category")];
      });
      autoTable(doc, {
        startY: y,
        head: [["Code", "Name"]],
        body: catRows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Boat classes
    if (comp.allowedBoatClasses?.length) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Allowed Boat Classes", 14, y);
      y += 6;
      const bcRows = comp.allowedBoatClasses.map(bc => {
        const id = toDocumentId(bc);
        const known = boatClassMap[id];
        return [known?.code || (bc?.code || ""), known?.name || (bc?.names?.en || bc?.label || "Boat class")];
      });
      autoTable(doc, {
        startY: y,
        head: [["Code", "Name"]],
        body: bcRows,
        theme: "striped",
        headStyles: { fillColor: [20, 184, 166], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // Detailed Journeys for classic rowing championships
    if (comp.competitionType === "championship" && comp.discipline === "classic" && comp.stages?.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Detailed Journeys", 14, y);
      y += 6;
      const stageRows = comp.stages.map((stage, idx) => {
        return [
          stage.order ?? (idx + 1),
          stage.name || `Journey ${idx + 1}`,
          formatDateRange(stage.date, stage.date),
          stage.isFinalDay ? "Yes" : "No"
        ];
      });
      autoTable(doc, {
        startY: y,
        head: [["Order", "Journey Name", "Date", "Final Day"]],
        body: stageRows,
        theme: "striped",
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(241, 245, 249);
    doc.rect(0, ph - 14, pw, 14, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text("TRF Portal — Competition Management System", 14, ph - 6);
    doc.text(`Page 1 of 1`, pw - 14, ph - 6, { align: "right" });

    doc.save(`${comp.code || "competition"}_details.pdf`);
    toast.success("PDF exported successfully");
  }, [categoryMap, boatClassMap]);

  const exportAllPDF = useCallback(async () => {
    if (!filteredCompetitions.length) { toast.warn("No competitions to export"); return; }
    const doc = new jsPDF("landscape");
    const pw = doc.internal.pageSize.getWidth();

    const logoBase64 = await getBase64ImageFromUrl("/TRF-AR-EN-Small.png");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 32, "F");
    
    if (logoBase64) {
      // Original size 400x87 (~4.6 aspect ratio). Height 14 implies Width ~64.4
      doc.addImage(logoBase64, "PNG", pw - 78, 9, 64.4, 14);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Tunisian Rowing Federation — Competition Calendar", 14, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${filteredCompetitions.length} competitions | Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 22);

    const rows = [];
    filteredCompetitions.forEach(c => {
      rows.push([
        c.code || "",
        c.names?.en || "",
        DISCIPLINE_OPTIONS.find(o => o.value === c.discipline)?.label || c.discipline || "",
        formatDateRange(c.startDate, c.endDate),
        [c.venue?.city, c.venue?.country].filter(Boolean).join(", ") || ""
      ]);

      if (c.discipline === "classic" && c.competitionType === "championship" && c.stages?.length > 0) {
        c.stages.forEach((s, idx) => {
          rows.push([
            {
              content: `      - ${s.name || 'Journey ' + (idx + 1)} — ${formatDateRange(s.date, s.date)}${s.isFinalDay ? ' (Final)' : ''}`,
              colSpan: 5,
              styles: { fillColor: [248, 250, 252], textColor: [100, 116, 139], fontStyle: "italic", cellPadding: { top: 2, bottom: 2, left: 14 } }
            }
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: 40,
      head: [["Code", "Name", "Discipline", "Dates", "Venue"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, cellPadding: 4 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 }, 1: { cellWidth: 80 } },
    });

    doc.save("competitions_calendar.pdf");
    toast.success("PDF exported successfully");
  }, [filteredCompetitions]);

  const exportAllExcel = useCallback(async () => {
    if (!filteredCompetitions.length) { toast.warn("No competitions to export"); return; }
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tunisian Rowing Federation";
    workbook.created = new Date();
    
    const sheet = workbook.addWorksheet("Competitions");
    
    // Header Style
    sheet.columns = [
      { header: "Code", key: "code", width: 25 },
      { header: "Name", key: "name", width: 60 },
      { header: "Discipline", key: "discipline", width: 15 },
      { header: "Dates", key: "dates", width: 25 },
      { header: "Venue", key: "venue", width: 40 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    filteredCompetitions.forEach(c => {
      sheet.addRow({
        code: c.code || "",
        name: c.names?.en || "",
        discipline: DISCIPLINE_OPTIONS.find(o => o.value === c.discipline)?.label || "",
        dates: formatDateRange(c.startDate, c.endDate),
        venue: [c.venue?.name, c.venue?.city, c.venue?.country].filter(Boolean).join(", ")
      });

      if (c.discipline === "classic" && c.competitionType === "championship" && c.stages?.length > 0) {
        c.stages.forEach((s, idx) => {
          const journeyRow = sheet.addRow({
            name: `      - ${s.name || 'Journey ' + (idx + 1)} — ${formatDateRange(s.date, s.date)}${s.isFinalDay ? ' (Final)' : ''}`
          });
          sheet.mergeCells(journeyRow.number, 2, journeyRow.number, 5);
          const nameCell = journeyRow.getCell(2);
          nameCell.font = { italic: true, color: { argb: "FF64748B" } };
          nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        });
      }
    });

    // Formatting all rows
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        if (rowNumber > 1) {
          cell.alignment = { vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, "competitions_export.xlsx");
    toast.success("Excel exported successfully");
  }, [filteredCompetitions]);


  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-8 sm:px-6 xl:px-10">
      {/* ─── HERO HEADER ─── */}
      <header className="comp-hero px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Competition Framework
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              Competition Management
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-slate-400">
              Plan national events, control registration windows, and publish official results.
            </p>
            {errorMessage ? <p className="text-xs text-rose-400">{errorMessage}</p> : null}
          </div>
          {canManage && (
            <Button type="button" onClick={openCreateDialog} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-600/25">
              <Plus className="h-4 w-4" /> New Competition
            </Button>
          )}
        </div>
        {/* Stat cards */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-2xl font-bold text-white">{summary.total}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">Total Events</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-emerald-400">{summary.upcoming}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">Upcoming</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-blue-400">{summary.byStatus.published}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">Published</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-bold text-amber-400">{summary.byStatus.draft}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">Drafts</p>
          </div>
        </div>
      </header>

      {/* ─── FILTERS ─── */}
      <section className="filter-section p-6">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filters</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="disciplineFilter" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Discipline</Label>
            <Select id="disciplineFilter" value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value)} className="rounded-xl border-slate-200">
              {DISCIPLINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="statusFilter" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</Label>
            <Select id="statusFilter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border-slate-200">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seasonFilter" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Season</Label>
            <Input id="seasonFilter" placeholder="e.g. 2025" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="searchTerm" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="searchTerm" placeholder="Code, venue, or name" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="comp-search w-full pl-10" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPETITION LIBRARY ─── */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Library header */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Competition Library</h2>
            <p className="text-sm text-slate-500">
              {loading ? "Loading..." : `${filteredCompetitions.length} event${filteredCompetitions.length === 1 ? "" : "s"} found`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportAllExcel} className="export-btn excel">
              <FileSpreadsheet className="h-4 w-4" /> Excel Export
            </button>
            <button type="button" onClick={exportAllPDF} className="export-btn pdf">
              <FileText className="h-4 w-4" /> PDF Export
            </button>
          </div>
        </div>

        {/* Competition cards */}
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                <p className="text-sm text-slate-500">Loading competitions...</p>
              </div>
            </div>
          ) : paginatedCompetitions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">{searchTerm ? "No competitions match your search." : "No competitions found."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedCompetitions.map((comp) => {
                const compId = toDocumentId(comp);
                const isSelected = compId === selectedCompetitionId;
                const compRegState = computeRegistrationState(comp);
                const scheduleLabel = describeScheduleStatus(comp.startDate, comp.endDate);
                const isUpcoming = scheduleLabel.startsWith("Starts");
                const isLive = scheduleLabel === "In progress";
                const isFinished = scheduleLabel.includes("Finished");
                const DIcon = getDisciplineIcon(comp.discipline);
                const disciplineLabel = DISCIPLINE_OPTIONS.find((o) => o.value === comp.discipline)?.label || comp.discipline;
                const typeLabel = COMPETITION_TYPES.find((o) => o.value === comp.competitionType)?.label || comp.competitionType;
                const venueStr = [comp.venue?.name, comp.venue?.city, comp.venue?.country].filter(Boolean).join(" • ");

                return (
                  <div
                    key={compId || comp.code}
                    className={`comp-card discipline-${comp.discipline || "classic"} ${isSelected ? "selected" : ""}`}
                    onClick={() => focusCompetitionDetails(compId, { scroll: true })}
                  >
                    <div className="flex flex-col gap-4 p-5 pl-7 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: info */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: `${getDisciplineColor(comp.discipline)}15` }}>
                          <DIcon className="h-5 w-5" style={{ color: getDisciplineColor(comp.discipline) }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: getDisciplineColor(comp.discipline) }}>{comp.code}</span>
                            <span className={`status-pill ${comp.status || "draft"}`}>
                              <span className={`status-dot ${comp.status || "draft"}`} />
                              {(comp.status || "draft").charAt(0).toUpperCase() + (comp.status || "draft").slice(1)}
                            </span>
                          </div>
                          <h3 className="mt-1 text-sm font-semibold text-slate-900 truncate">{comp.names?.en || "Unnamed"}</h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" /> {formatDateRange(comp.startDate, comp.endDate)}
                            </span>
                            {venueStr && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" /> {venueStr}
                              </span>
                            )}
                            <span className="text-slate-400">{disciplineLabel} • {typeLabel}</span>
                          </div>
                          {comp.competitionType === "championship" && comp.discipline === "classic" && comp.stages?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {comp.stages.map((stage, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[0.625rem] font-medium text-slate-600 border border-slate-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                  {stage.name || `Journey ${idx + 1}`} • {formatDateRange(stage.date, stage.date)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: badges + actions */}
                      <div className="flex flex-shrink-0 items-center gap-3 sm:gap-4" onClick={(e) => e.stopPropagation()}>
                        {/* Countdown badge */}
                        <span className={`countdown-badge ${isLive ? "live" : isFinished ? "finished" : ""}`}>
                          <Clock className="h-3 w-3" /> {scheduleLabel}
                        </span>

                        {/* Registration + Results compact */}
                        <div className="hidden lg:flex flex-col gap-1 text-right">
                          <span className="text-[0.6875rem] text-slate-500">Reg: <span className="font-semibold text-slate-700">{compRegState.label}</span></span>
                          <span className="text-[0.6875rem] text-slate-500">Results: <span className="font-semibold text-slate-700">{RESULTS_STATUS_LABELS[comp.resultsStatus] || "Pending"}</span></span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {canManage && compId && (
                            <>
                              {comp.discipline === "beach" ? (
                                <button type="button" className="action-icon-btn primary" data-tooltip="Beach Sprint" onClick={() => navigate(`/competitions/${compId}/beach-sprint`)}>
                                  <Zap className="h-4 w-4" />
                                </button>
                              ) : (
                                <button type="button" className="action-icon-btn primary" data-tooltip="Plan Races" onClick={() => navigate(`/competitions/${compId}/races`)}>
                                  <Calendar className="h-4 w-4" />
                                </button>
                              )}
                              <button type="button" className="action-icon-btn" data-tooltip="Rankings" onClick={() => navigate(`/competitions/${compId}/rankings`)}>
                                <Trophy className="h-4 w-4" />
                              </button>
                              <button type="button" className="action-icon-btn" data-tooltip="Edit" onClick={() => openEditDialog(comp._id)}>
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button type="button" className="action-icon-btn" data-tooltip="Export PDF" onClick={() => exportSinglePDF(comp)}>
                                <Download className="h-4 w-4" />
                              </button>
                              <button type="button" className="action-icon-btn danger" data-tooltip="Delete" onClick={() => handleDelete(comp._id)}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {!canManage && compId && (
                            <>
                              {compRegState.isOpen && (
                                <Button type="button" variant="secondary" className="text-xs rounded-lg" onClick={() => navigate(`/competitions/${compId}/register`)}>
                                  Register
                                </Button>
                              )}
                              <button type="button" className="action-icon-btn" data-tooltip="View Details" onClick={() => focusCompetitionDetails(compId, { scroll: true })}>
                                <Eye className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredCompetitions.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                <span className="font-semibold text-slate-800">{Math.min(currentPage * itemsPerPage, filteredCompetitions.length)}</span> of{" "}
                <span className="font-semibold text-slate-800">{filteredCompetitions.length}</span>
              </p>
              <div className="flex items-center gap-1">
                <button type="button" className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, currentPage - 3), currentPage + 2).map((p) => (
                  <button key={p} type="button" className={`page-btn ${p === currentPage ? "active" : ""}`} onClick={() => setCurrentPage(p)}>
                    {p}
                  </button>
                ))}
                <button type="button" className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>


        {/* ─── DETAIL PANEL ─── */}
        {selectedCompetition ? (
          <div ref={detailPanelRef} className="detail-glass px-6 py-8">
            <div className="flex flex-col gap-6">
              {/* Header row */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400">
                    <span>{selectedCompetition.code}</span>
                    {selectedCompetition.season && <span>• Season {selectedCompetition.season}</span>}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {selectedCompetition.names?.en || "Unnamed competition"}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {formatDateRange(selectedCompetition.startDate, selectedCompetition.endDate)}
                    {locationLabel ? ` • ${locationLabel}` : ""}
                  </p>
                  {countdownLabel && (
                    <span className={`countdown-badge ${countdownLabel === "In progress" ? "live" : countdownLabel.includes("Finished") ? "finished" : ""}`}>
                      <Clock className="h-3 w-3" /> {countdownLabel}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`status-pill ${selectedCompetition.status || "draft"}`}>
                      <span className={`status-dot ${selectedCompetition.status || "draft"}`} />
                      {(selectedCompetition.status || "draft").charAt(0).toUpperCase() + (selectedCompetition.status || "draft").slice(1)}
                    </span>
                    <span className="status-pill" style={{ background: "#f0f9ff", color: "#0369a1" }}>
                      Registration • {registrationState.label || "Unknown"}
                    </span>
                    <span className="status-pill" style={{ background: "#fefce8", color: "#a16207" }}>
                      Results • {RESULTS_STATUS_LABELS[selectedCompetition.resultsStatus] || "Pending"}
                    </span>
                  </div>

                  {/* Action bar */}
                  {canManage && selectedCompetitionDocumentId && (
                    <div className="floating-actions">
                      <Button type="button" variant="secondary" className="text-xs rounded-lg gap-1.5" onClick={handleOpenRacePlanner}>
                        <Calendar className="h-3.5 w-3.5" /> Plan Races
                      </Button>
                      {selectedCompetition.status !== "published" ? (
                        <Button type="button" className="text-xs rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { status: "published", registrationStatus: selectedCompetition.registrationStatus === "closed" ? "closed" : "open" })}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Publish
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { status: "draft" })}>
                          Revert to Draft
                        </Button>
                      )}
                      {selectedCompetition.status !== "archived" ? (
                        <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { status: "archived" })}>
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { status: "draft" })}>
                          Restore
                        </Button>
                      )}
                      <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { registrationStatus: selectedCompetition.registrationStatus !== "open" ? "open" : "closed" })}>
                        {selectedCompetition.registrationStatus !== "open" ? "Open Reg" : "Close Reg"}
                      </Button>
                      {selectedCompetition.resultsStatus !== "official" ? (
                        <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { resultsStatus: "official" })}>
                          <Award className="h-3.5 w-3.5" /> Mark Official
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" className="text-xs rounded-lg gap-1.5" onClick={() => handleStatusUpdate(selectedCompetitionDocumentId, { resultsStatus: "pending" })}>
                          Reset Results
                        </Button>
                      )}
                      <button type="button" className="export-btn pdf text-xs py-2 px-3" onClick={() => exportSinglePDF(selectedCompetition)}>
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </button>
                      <Button type="button" variant="destructive" className="text-xs rounded-lg gap-1.5" onClick={() => handleDelete(selectedCompetitionDocumentId)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                  {isClubManager && selectedCompetitionDocumentId && (
                    <div className="flex flex-col gap-2 sm:items-end">
                      <Button type="button" variant="secondary" disabled={!selectedCompetitionRegistrationOpen} onClick={() => selectedCompetitionRegistrationOpen ? navigate(`/competitions/${selectedCompetitionDocumentId}/register`) : null}>
                        {selectedCompetitionRegistrationOpen ? "Register athletes" : "Registration closed"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Info cards grid */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Ship className="h-4 w-4 text-blue-500" />
                    <span className="info-label mb-0">Competition Details</span>
                  </div>
                  <div className="space-y-3">
                    <div><p className="info-label">Discipline</p><p className="info-value">{selectedDisciplineLabel || "—"}</p></div>
                    <div><p className="info-label">Format</p><p className="info-value">{selectedTypeLabel || "—"}</p></div>
                    <div><p className="info-label">Default Distance</p><p className="info-value">{defaultDistanceLabel}</p></div>
                    <div><p className="info-label">Up-category</p><p className="info-value">{selectedCompetition.allowUpCategory ? "Allowed" : "Not allowed"}</p></div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-emerald-500" />
                    <span className="info-label mb-0">Allowed Categories</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedCategoryLabels.length ? (
                      allowedCategoryLabels.map((label) => (
                        <span key={label} className="cat-chip">{label}</span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">All categories allowed</span>
                    )}
                  </div>
                </div>

                <div className="info-card">
                  <div className="flex items-center gap-2 mb-3">
                    <Ship className="h-4 w-4 text-teal-500" />
                    <span className="info-label mb-0">Allowed Boat Classes</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allowedBoatClassLabels.length ? (
                      allowedBoatClassLabels.map((label) => (
                        <span key={label} className="cat-chip">{label}</span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">All boat classes allowed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedCompetition.notes && (
                <div className="info-card">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="info-label mb-0">Notes</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{selectedCompetition.notes}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-12 text-center">
            <Trophy className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">Select a competition to see planning details.</p>
          </div>
        )}
      </section>

      {/* ─── CREATE / EDIT DIALOG ─── */}
      {dialogOpen && (
        <div className="dialog-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-10 backdrop-blur-sm">
          <div className="dialog-panel w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {dialogMode === "create" ? "Create Competition" : canManage ? "Edit Competition" : "Competition Details"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Localise the event name, define the season, and configure participation rules.
                </p>
              </div>
              <button type="button" onClick={resetDialog} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="max-h-[75vh] overflow-y-auto px-6 py-6" onSubmit={handleSubmit}>
              {/* Identity section */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <FileText className="h-4 w-4 text-blue-500" /> Identity
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="formCode">Competition code</Label>
                    <Input id="formCode" name="code" value={formState.code} onChange={handleInputChange} placeholder="e.g. TRF-OPEN-25" required disabled={!canManage} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formSeason">Season</Label>
                    <Input id="formSeason" name="season" type="number" min="2000" max="2100" value={formState.season} onChange={handleInputChange} required disabled={!canManage} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formDiscipline">Discipline</Label>
                    <Select id="formDiscipline" name="discipline" value={formState.discipline} onChange={handleInputChange} disabled={!canManage}>
                      {DISCIPLINE_OPTIONS.filter((o) => o.value !== "all").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formType">Competition type</Label>
                    <Select id="formType" name="competitionType" value={formState.competitionType} onChange={handleInputChange} disabled={!canManage}>
                      {COMPETITION_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Name section */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Award className="h-4 w-4 text-emerald-500" /> Event Name
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="formNameEn">English name</Label>
                    <Input id="formNameEn" name="nameEn" value={formState.nameEn} onChange={handleInputChange} required disabled={!canManage} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formNameFr">French name</Label>
                    <Input id="formNameFr" name="nameFr" value={formState.nameFr} onChange={handleInputChange} required disabled={!canManage} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="formNameAr">Arabic name</Label>
                    <Input id="formNameAr" name="nameAr" value={formState.nameAr} onChange={handleInputChange} required disabled={!canManage} />
                  </div>
                </div>
              </div>

              {/* Schedule section */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Calendar className="h-4 w-4 text-purple-500" /> Schedule & Venue
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="formStartDate">Start date</Label><Input id="formStartDate" name="startDate" type="date" value={formState.startDate} onChange={handleInputChange} required disabled={!canManage} /></div>
                  <div className="space-y-2"><Label htmlFor="formEndDate">End date</Label><Input id="formEndDate" name="endDate" type="date" value={formState.endDate} onChange={handleInputChange} required disabled={!canManage} /></div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2"><Label htmlFor="formVenueName">Venue name</Label><Input id="formVenueName" name="venueName" value={formState.venueName} onChange={handleInputChange} placeholder="National Rowing Center" disabled={!canManage} /></div>
                  <div className="space-y-2"><Label htmlFor="formVenueCity">City</Label><Input id="formVenueCity" name="venueCity" value={formState.venueCity} onChange={handleInputChange} disabled={!canManage} /></div>
                  <div className="space-y-2"><Label htmlFor="formVenueCountry">Country</Label><Input id="formVenueCountry" name="venueCountry" value={formState.venueCountry} onChange={handleInputChange} disabled={!canManage} /></div>
                </div>
              </div>

              {/* Registration window */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Users className="h-4 w-4 text-teal-500" /> Registration Window
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="formRegistrationOpen">Registration opens</Label><Input id="formRegistrationOpen" name="registrationOpenAt" type="date" value={formState.registrationOpenAt} onChange={handleInputChange} disabled={!canManage} /></div>
                  <div className="space-y-2"><Label htmlFor="formRegistrationClose">Registration closes</Label><Input id="formRegistrationClose" name="registrationCloseAt" type="date" value={formState.registrationCloseAt} onChange={handleInputChange} disabled={!canManage} /></div>
                </div>
              </div>

              {/* Championship stages */}
              {formState.competitionType === "championship" && (
                <div className="mb-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700"><Trophy className="h-4 w-4 text-amber-500" /> Championship Journeys</h3>
                    {canManage && <button type="button" onClick={handleAddStage} className="text-xs font-semibold text-blue-600 hover:text-blue-800">+ Add Journey</button>}
                  </div>
                  {(!formState.stages || formState.stages.length === 0) && <p className="text-xs text-slate-500 italic">No journeys defined yet.</p>}
                  {formState.stages?.map((stage, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">Journey {idx + 1}</span>
                        {canManage && <button type="button" onClick={() => handleRemoveStage(idx)} className="text-xs text-red-600 hover:text-red-800">Remove</button>}
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Journey Name</Label><Input type="text" placeholder="e.g. Journey 1 - Tunis" value={stage.name} onChange={(e) => handleStageChange(idx, "name", e.target.value)} disabled={!canManage} /></div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Event Date</Label><Input type="date" value={stage.date} onChange={(e) => handleStageChange(idx, "date", e.target.value)} disabled={!canManage} /></div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Registration Opens</Label><Input type="date" value={stage.registrationOpenDate} onChange={(e) => handleStageChange(idx, "registrationOpenDate", e.target.value)} disabled={!canManage} /></div>
                        <div className="space-y-1"><Label className="text-xs text-slate-500">Registration Closes</Label><Input type="date" value={stage.registrationCloseDate} onChange={(e) => handleStageChange(idx, "registrationCloseDate", e.target.value)} disabled={!canManage} /></div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input type="checkbox" id={`stage-final-${idx}`} checked={stage.isFinalDay || false} onChange={(e) => handleStageChange(idx, "isFinalDay", e.target.checked)} disabled={!canManage} />
                        <Label htmlFor={`stage-final-${idx}`} className="text-sm font-medium text-slate-700">Mark as Final Journey</Label>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Race settings */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Zap className="h-4 w-4 text-orange-500" /> Race Settings
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="formDefaultDistance">Default race distance (m)</Label><Input id="formDefaultDistance" name="defaultDistance" type="number" min="0" value={formState.defaultDistance} onChange={handleInputChange} placeholder="2000" disabled={!canManage} /></div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-slate-700">Options</Label>
                    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="allowUpCategory" checked={formState.allowUpCategory} onChange={handleInputChange} disabled={!canManage} /> Allow up-category racing</label>
                  </div>
                </div>
              </div>

              {/* Categories & Boat classes */}
              <div className="mb-6">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Ship className="h-4 w-4 text-cyan-500" /> Participation Rules
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <legend className="text-sm font-semibold text-slate-700">Allowed categories</legend>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                      {categories.length === 0 ? <p className="text-xs text-slate-400">No categories available.</p> : categories.map((cat) => (
                        <label key={cat._id} className="flex items-center gap-2">
                          <input type="checkbox" checked={formState.allowedCategories.includes(cat._id)} onChange={() => handleMultiToggle("allowedCategories", cat._id)} disabled={!canManage} />
                          <span>{cat.abbreviation} • {cat.titles?.en || "Unnamed"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                    <legend className="text-sm font-semibold text-slate-700">Allowed boat classes {formState.discipline && <span className="ml-1 font-normal text-slate-400">({formState.discipline})</span>}</legend>
                    <div className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm text-slate-600">
                      {filteredBoatClasses.length === 0 ? <p className="text-xs text-slate-400">No boat classes for this discipline.</p> : filteredBoatClasses.map((bc) => (
                        <label key={bc._id} className="flex items-center gap-2">
                          <input type="checkbox" checked={formState.allowedBoatClasses.includes(bc._id)} onChange={() => handleMultiToggle("allowedBoatClasses", bc._id)} disabled={!canManage} />
                          <span>{bc.code} • {bc.names?.en || "Unnamed"}{bc.weightClass && bc.weightClass !== "open" ? ` (${bc.weightClass})` : ""}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6 space-y-2">
                <Label htmlFor="formNotes">Notes</Label>
                <textarea id="formNotes" name="notes" value={formState.notes} onChange={handleInputChange} rows={3} disabled={!canManage} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Internal notes, logistics reminders..." />
              </div>

              {canManage && (
                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button type="button" variant="outline" onClick={resetDialog} disabled={dialogSubmitting} className="rounded-xl">Cancel</Button>
                  <Button type="submit" disabled={dialogSubmitting} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-0">
                    {dialogSubmitting ? (dialogMode === "create" ? "Creating..." : "Saving...") : (dialogMode === "create" ? "Create" : "Save Changes")}
                  </Button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompetitionManagement;
