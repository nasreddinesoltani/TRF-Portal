import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { toast } from "react-toastify";

import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { DataGrid } from "../components/DataGrid";
import AthleteDocumentsDialog from "../components/AthleteDocumentsDialog";
import {
  getAthleteInitials,
  getAthletePhotoUrl,
  getAthleteLicenseLabel,
} from "../lib/athlete";

const API_BASE_URL = "";

const LICENSE_STATUS_BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-600 border border-amber-200",
  inactive: "bg-gray-100 text-gray-500 border border-gray-200",
  suspended: "bg-rose-50 text-rose-600 border border-rose-200",
  pending_documents: "bg-amber-50 text-amber-600 border border-amber-200",
  expired_medical: "bg-orange-100 text-orange-600 border border-orange-200",
};

const LICENSE_STATUS_LABELS = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  suspended: "Suspended",
  pending_documents: "Pending Documents",
  expired_medical: "Expired Medical",
  transferred: "Transferred",
};

const ATHLETE_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
  { value: "transferred", label: "Transferred" },
];

const MEMBERSHIP_FILTER_OPTIONS = [
  { value: "all", label: "Any membership status" },
  ...ATHLETE_STATUS_OPTIONS,
];

const LICENSE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Any license status" },
  { value: "active", label: "License active" },
  { value: "pending", label: "License pending" },
  { value: "inactive", label: "License inactive" },
  { value: "suspended", label: "License suspended" },
  { value: "needs_attention", label: "Documents need attention" },
  { value: "pending_documents", label: "Documents pending" },
  { value: "expired_medical", label: "Medical expired" },
];

const GENDER_FILTER_OPTIONS = [
  { value: "all", label: "Any gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const LICENSE_ATTENTION_STATUSES = [
  "pending_documents",
  "expired_medical",
  "suspended",
];

const DEFAULT_GLOBAL_STATISTICS = {
  total: 0,
  licensed: 0,
  byStatus: {
    active: 0,
    pending_documents: 0,
    expired_medical: 0,
    suspended: 0,
    inactive: 0,
  },
  byGender: {
    male: 0,
    female: 0,
    unknown: 0,
  },
  attention: {
    total: 0,
    pendingDocuments: 0,
    expiredMedical: 0,
    suspended: 0,
  },
  uniqueClubs: 0,
  lastUpdated: null,
};

const defaultForm = {
  firstName: "",
  lastName: "",
  firstNameAr: "",
  lastNameAr: "",
  birthDate: "",
  gender: "male",
  nationality: "",
  cin: "",
  passportNumber: "",
};

const todayIsoDate = () => new Date().toISOString().split("T")[0];

const formatDisplayDate = (value) => {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatIssueLabel = (issue) => {
  if (!issue) {
    return "";
  }

  return issue
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const formatDate = (value) => formatDisplayDate(value);

const computePercentage = (value, total) => {
  const numerator = Number(value);
  const denominator = Number(total);
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    !denominator
  ) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatLicenseStatus = (status) => {
  if (!status) {
    return LICENSE_STATUS_LABELS.pending_documents;
  }

  const key = status.toString().toLowerCase();
  if (key === "needs_attention") {
    return "Needs attention";
  }

  return LICENSE_STATUS_LABELS[key] || LICENSE_STATUS_LABELS.pending_documents;
};

const resolveAthleteName = (athlete) => {
  if (!athlete) {
    return "Unnamed athlete";
  }

  const firstName = (athlete.firstName || "").trim();
  const lastName = (athlete.lastName || "").trim();
  const arabicFirst = (athlete.firstNameAr || "").trim();
  const arabicLast = (athlete.lastNameAr || "").trim();

  const latin = [firstName, lastName].filter(Boolean).join(" ");
  const arabic = [arabicFirst, arabicLast].filter(Boolean).join(" ");

  if (latin) {
    return latin;
  }

  if (arabic) {
    return arabic;
  }

  if (athlete.licenseNumber) {
    return `License ${athlete.licenseNumber}`;
  }

  return "Unnamed athlete";
};

const extractClubIdentifier = (club) => {
  if (!club) {
    return "";
  }
  if (typeof club === "string") {
    return club;
  }
  if (typeof club === "object") {
    return club._id || club.id || club.clubId || "";
  }
  return "";
};

const Modal = ({ open, title, description, onClose, children, footer }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <span className="sr-only">Close</span>X
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>
        {footer ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const InfoField = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</p>
  </div>
);

const FilterChip = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
    {children}
  </span>
);

const CreateAthlete = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const userClubId = user?.clubId || "";
  const userClubName = user?.clubName || "";
  const currentSeasonYear = useMemo(() => new Date().getFullYear(), []);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchBirthDate, setSearchBirthDate] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);

  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [editClubId, setEditClubId] = useState("");

  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(false);

  const [formData, setFormData] = useState(defaultForm);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [duplicateAthlete, setDuplicateAthlete] = useState(null);
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [createdAthlete, setCreatedAthlete] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [documentDialog, setDocumentDialog] = useState({
    open: false,
    athlete: null,
  });

  const [globalStatistics, setGlobalStatistics] = useState(
    DEFAULT_GLOBAL_STATISTICS,
  );
  const [globalStatsLoading, setGlobalStatsLoading] = useState(false);
  const [globalStatsRefreshKey, setGlobalStatsRefreshKey] = useState(0);

  const selectedAthleteRef = useRef(null);
  const selectedAthleteSectionRef = useRef(null);

  const refreshGlobalStatistics = useCallback(() => {
    setGlobalStatsRefreshKey((previous) => previous + 1);
  }, []);

  const resolveClubName = useCallback(
    (club) => {
      if (!club) {
        return "";
      }

      if (typeof club === "string") {
        const match = clubs.find((candidate) => candidate._id === club);
        return match?.name || "";
      }

      if (typeof club === "object") {
        return club.name || club.title || "";
      }

      return "";
    },
    [clubs],
  );

  const resetForm = useCallback(() => {
    setFormData({ ...defaultForm });
    setDuplicateAthlete(null);
    setDuplicateMessage("");
    setCreatedAthlete(null);
    setSelectedClubId((previous) => {
      if (isAdmin) {
        return previous || clubs[0]?._id || "";
      }
      return userClubId;
    });
  }, [clubs, isAdmin, userClubId]);

  const initializeEditState = useCallback((athlete) => {
    if (!athlete) {
      setEditFormData(null);
      setEditClubId("");
      return;
    }

    setEditFormData({
      firstName: athlete.firstName || "",
      lastName: athlete.lastName || "",
      firstNameAr: athlete.firstNameAr || "",
      lastNameAr: athlete.lastNameAr || "",
      birthDate: athlete.birthDate
        ? new Date(athlete.birthDate).toISOString().split("T")[0]
        : "",
      gender: athlete.gender || "male",
      nationality: athlete.nationality || "",
      cin: athlete.cin || "",
      passportNumber: athlete.passportNumber || "",
    });

    const activeMembership = Array.isArray(athlete.memberships)
      ? athlete.memberships.find(
          (membership) => (membership?.status || "").toLowerCase() === "active",
        )
      : null;

    const membershipClubId =
      extractClubIdentifier(activeMembership?.club) ||
      athlete.membershipClubId ||
      "";

    setEditClubId(membershipClubId);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedClubId(userClubId);
      return;
    }

    const controller = new AbortController();

    async function loadClubs() {
      try {
        setClubsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/clubs?limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load clubs");
        }

        const payload = await response.json();
        const items = Array.isArray(payload) ? payload : payload?.clubs || [];
        setClubs(items);
        setSelectedClubId((previous) => previous || items[0]?._id || "");
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.error(error);
        toast.error(error.message || "Unable to load clubs");
      } finally {
        setClubsLoading(false);
      }
    }

    loadClubs();
    return () => controller.abort();
  }, [isAdmin, token, userClubId]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const controller = new AbortController();

    async function loadGlobalStats() {
      try {
        setGlobalStatsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/athletes/stats`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load global athlete statistics");
        }

        const payload = await response.json();
        // Use current season stats for more relevant data
        const seasonStats = payload?.season || {};
        setGlobalStatistics({
          // Use season-specific stats when available, fallback to global
          total: seasonStats?.total ?? payload?.total ?? 0,
          licensed: seasonStats?.licensed ?? payload?.licensed ?? 0,
          byStatus: {
            active:
              seasonStats?.byStatus?.active ?? payload?.byStatus?.active ?? 0,
            pending_documents:
              seasonStats?.byStatus?.pending_documents ??
              payload?.byStatus?.pending_documents ??
              0,
            expired_medical:
              seasonStats?.byStatus?.expired_medical ??
              payload?.byStatus?.expired_medical ??
              0,
            suspended:
              seasonStats?.byStatus?.suspended ??
              payload?.byStatus?.suspended ??
              0,
            inactive:
              seasonStats?.byStatus?.inactive ??
              payload?.byStatus?.inactive ??
              0,
          },
          byGender: {
            male: seasonStats?.byGender?.male ?? payload?.byGender?.male ?? 0,
            female:
              seasonStats?.byGender?.female ?? payload?.byGender?.female ?? 0,
            unknown:
              seasonStats?.byGender?.unknown ?? payload?.byGender?.unknown ?? 0,
          },
          attention: {
            total:
              seasonStats?.attention?.total ?? payload?.attention?.total ?? 0,
            pendingDocuments:
              seasonStats?.attention?.pendingDocuments ??
              payload?.attention?.pendingDocuments ??
              0,
            expiredMedical:
              seasonStats?.attention?.expiredMedical ??
              payload?.attention?.expiredMedical ??
              0,
            suspended:
              seasonStats?.attention?.suspended ??
              payload?.attention?.suspended ??
              0,
          },
          uniqueClubs: payload?.uniqueClubs ?? 0,
          lastUpdated: payload?.lastUpdated ?? null,
          currentSeason: payload?.currentSeason ?? new Date().getFullYear(),
          // Keep global totals for reference
          globalTotal: payload?.total ?? 0,
        });
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.error(error);
        toast.error(
          error.message || "Unable to load global athlete statistics",
        );
      } finally {
        setGlobalStatsLoading(false);
      }
    }

    loadGlobalStats();
    return () => controller.abort();
  }, [token, globalStatsRefreshKey]);

  useEffect(() => {
    const trimmedTerm = searchTerm.trim();
    const hasTerm = trimmedTerm.length >= 2;
    const hasDate = Boolean(searchBirthDate);
    const hasFilters =
      membershipFilter !== "all" ||
      licenseFilter !== "all" ||
      genderFilter !== "all";

    if (!hasTerm && !hasDate && !hasFilters) {
      setSearchResults([]);
      setSelectedAthlete(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    async function fetchResults() {
      try {
        setIsSearching(true);
        const params = new URLSearchParams();
        params.set("limit", "200");

        if (hasTerm) {
          params.set("q", trimmedTerm);
        }
        if (hasDate) {
          params.set("birthDate", searchBirthDate);
        }
        if (membershipFilter !== "all") {
          params.set("membershipStatus", membershipFilter);
        }
        if (licenseFilter !== "all") {
          if (licenseFilter === "needs_attention") {
            params.set("attention", "true");
          } else {
            params.set("licenseStatus", licenseFilter);
          }
        }
        if (genderFilter !== "all") {
          params.set("gender", genderFilter);
        }

        const response = await fetch(
          `${API_BASE_URL}/api/athletes?${params.toString()}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Failed to search athletes");
        }

        const payload = await response.json();
        const list = Array.isArray(payload) ? payload : payload?.athletes || [];

        setSearchResults(list);

        const currentSelected = selectedAthleteRef.current;

        if (list.length === 1) {
          const [single] = list;
          if (!currentSelected || currentSelected._id !== single._id) {
            setSelectedAthlete(single);
          }
        } else if (
          currentSelected &&
          !list.some((candidate) => candidate._id === currentSelected._id)
        ) {
          setSelectedAthlete(null);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.error(error);
        toast.error(error.message || "Unable to search athletes");
      } finally {
        setIsSearching(false);
      }
    }

    fetchResults();
    return () => controller.abort();
  }, [
    searchTerm,
    searchBirthDate,
    membershipFilter,
    licenseFilter,
    genderFilter,
    searchRefreshKey,
    token,
  ]);

  useEffect(() => {
    initializeEditState(selectedAthlete);
  }, [selectedAthlete, initializeEditState]);

  useEffect(() => {
    selectedAthleteRef.current = selectedAthlete;
  }, [selectedAthlete]);
  const filteredSearchResults = useMemo(() => {
    const documentStatusKeys = new Set([
      "pending_documents",
      "expired_medical",
    ]);

    return searchResults.filter((athlete) => {
      const genderMatches =
        genderFilter === "all" ||
        (athlete.gender || "").toLowerCase() === genderFilter;

      const licenseStatusKey = (athlete.licenseStatus || "inactive")
        .toString()
        .toLowerCase();
      const documentStatusKey = (
        athlete.documentsStatus ||
        athlete.documentEvaluation?.status ||
        athlete.status ||
        "pending_documents"
      )
        .toString()
        .toLowerCase();

      const licenseMatches = (() => {
        if (licenseFilter === "all") {
          return true;
        }

        if (licenseFilter === "needs_attention") {
          return (
            LICENSE_ATTENTION_STATUSES.includes(documentStatusKey) ||
            licenseStatusKey === "suspended"
          );
        }

        if (documentStatusKeys.has(licenseFilter)) {
          return documentStatusKey === licenseFilter;
        }

        return licenseStatusKey === licenseFilter;
      })();

      const membershipStatuses = new Set();
      if (athlete.membershipStatus) {
        membershipStatuses.add(athlete.membershipStatus.toLowerCase());
      }
      if (Array.isArray(athlete.memberships)) {
        athlete.memberships.forEach((membership) => {
          if (membership?.status) {
            membershipStatuses.add(membership.status.toLowerCase());
          }
        });
      }

      const membershipMatches =
        membershipFilter === "all" || membershipStatuses.has(membershipFilter);

      return genderMatches && licenseMatches && membershipMatches;
    });
  }, [searchResults, genderFilter, licenseFilter, membershipFilter]);

  const activeSearchTags = useMemo(() => {
    const tags = [];
    const trimmed = searchTerm.trim();

    if (trimmed) {
      tags.push({ key: "term", label: `Search: ${trimmed}` });
    }
    if (searchBirthDate) {
      tags.push({
        key: "birthDate",
        label: `Birth date: ${formatDate(searchBirthDate)}`,
      });
    }
    if (membershipFilter !== "all") {
      const option = MEMBERSHIP_FILTER_OPTIONS.find(
        (candidate) => candidate.value === membershipFilter,
      );
      tags.push({
        key: "membership",
        label: `Membership: ${option?.label || membershipFilter}`,
      });
    }
    if (licenseFilter !== "all") {
      const option = LICENSE_STATUS_FILTER_OPTIONS.find(
        (candidate) => candidate.value === licenseFilter,
      );
      const label =
        licenseFilter === "needs_attention"
          ? "Needs attention"
          : option?.label || licenseFilter;
      tags.push({ key: "license", label: `License: ${label}` });
    }
    if (genderFilter !== "all") {
      const option = GENDER_FILTER_OPTIONS.find(
        (candidate) => candidate.value === genderFilter,
      );
      tags.push({
        key: "gender",
        label: `Gender: ${option?.label || genderFilter}`,
      });
    }

    return tags;
  }, [
    searchTerm,
    searchBirthDate,
    membershipFilter,
    licenseFilter,
    genderFilter,
  ]);

  const hasSearchFilters = activeSearchTags.length > 0;

  const hasAnySearchCriteria = useMemo(() => {
    return (
      hasSearchFilters || Boolean(searchTerm.trim()) || Boolean(searchBirthDate)
    );
  }, [hasSearchFilters, searchTerm, searchBirthDate]);

  const rosterStatistics = useMemo(() => {
    const total = filteredSearchResults.length;
    let activeCount = 0;
    let attentionCount = 0;
    let femaleCount = 0;
    const clubIdentifiers = new Set();
    let lastUpdatedTimestamp = null;

    filteredSearchResults.forEach((athlete) => {
      const statusKey = (athlete.status || "pending_documents")
        .toString()
        .toLowerCase();

      if (statusKey === "active") {
        activeCount += 1;
      }

      if (LICENSE_ATTENTION_STATUSES.includes(statusKey)) {
        attentionCount += 1;
      }

      if ((athlete.gender || "").toLowerCase() === "female") {
        femaleCount += 1;
      }

      if (Array.isArray(athlete.memberships)) {
        athlete.memberships.forEach((membership) => {
          const identifier = extractClubIdentifier(membership?.club);
          if (identifier) {
            clubIdentifiers.add(identifier.toString());
          }
        });
      }

      if (athlete.membershipClubId) {
        clubIdentifiers.add(athlete.membershipClubId.toString());
      }

      const updatedReference = athlete.updatedAt || athlete.createdAt;
      if (updatedReference) {
        const timestamp = new Date(updatedReference).getTime();
        if (!Number.isNaN(timestamp)) {
          if (!lastUpdatedTimestamp || timestamp > lastUpdatedTimestamp) {
            lastUpdatedTimestamp = timestamp;
          }
        }
      }
    });

    return {
      total,
      active: activeCount,
      attention: attentionCount,
      female: femaleCount,
      male: Math.max(total - femaleCount, 0),
      uniqueClubs: clubIdentifiers.size,
      lastUpdatedTimestamp,
    };
  }, [filteredSearchResults]);

  const canAccessDocuments = useMemo(() => {
    const allowedRoles = ["admin", "club_manager", "jury_president", "umpire"];
    return allowedRoles.includes(user?.role);
  }, [user?.role]);

  const globalTotalAthletes = globalStatistics?.total ?? 0;
  const globalUniqueClubs = globalStatistics?.uniqueClubs ?? 0;
  const globalActiveCount = globalStatistics?.byStatus?.active ?? 0;
  const globalAttentionCount = globalStatistics?.attention?.total ?? 0;
  const globalFemaleCount = globalStatistics?.byGender?.female ?? 0;
  const globalMaleCount = globalStatistics?.byGender?.male ?? 0;
  const globalUnknownGenderCount = globalStatistics?.byGender?.unknown ?? 0;
  const globalPendingDocumentsCount =
    globalStatistics?.attention?.pendingDocuments ?? 0;
  const globalExpiredMedicalCount =
    globalStatistics?.attention?.expiredMedical ?? 0;
  const globalSuspendedCount = globalStatistics?.attention?.suspended ?? 0;
  const globalLicenseCoveragePercent = computePercentage(
    globalStatistics?.licensed ?? 0,
    globalTotalAthletes,
  );
  const globalActivePercent = computePercentage(
    globalActiveCount,
    globalTotalAthletes,
  );
  const globalAttentionPercent = computePercentage(
    globalAttentionCount,
    globalTotalAthletes,
  );
  const globalSnapshotLastUpdated = globalStatistics?.lastUpdated
    ? formatDisplayDate(globalStatistics.lastUpdated)
    : null;

  const selectedAthletePhotoUrl = useMemo(
    () => getAthletePhotoUrl(selectedAthlete),
    [selectedAthlete],
  );

  const selectedAthleteInitials = useMemo(
    () => getAthleteInitials(selectedAthlete),
    [selectedAthlete],
  );

  const selectedAthleteNationalCategory = useMemo(() => {
    if (
      !selectedAthlete ||
      !Array.isArray(selectedAthlete.categoryAssignments)
    ) {
      return null;
    }

    return (
      selectedAthlete.categoryAssignments.find(
        (assignment) =>
          assignment?.type === "national" &&
          Number(assignment?.season) === Number(currentSeasonYear),
      ) || null
    );
  }, [selectedAthlete, currentSeasonYear]);

  const selectedAthleteNationalCategoryLabel = useMemo(() => {
    if (!selectedAthleteNationalCategory) {
      return "Not assigned";
    }

    const abbreviation = selectedAthleteNationalCategory.abbreviation;
    const title =
      selectedAthleteNationalCategory.titles?.en ||
      selectedAthleteNationalCategory.titles?.fr ||
      selectedAthleteNationalCategory.titles?.ar ||
      null;

    const pieces = [];
    if (abbreviation) {
      pieces.push(abbreviation);
    }
    if (title) {
      pieces.push(title);
    }

    return pieces.join(" • ") || "Not assigned";
  }, [selectedAthleteNationalCategory]);

  const activeMembership = useMemo(() => {
    if (!selectedAthlete || !Array.isArray(selectedAthlete.memberships)) {
      return null;
    }

    return (
      selectedAthlete.memberships.find(
        (membership) => (membership?.status || "").toLowerCase() === "active",
      ) ||
      selectedAthlete.memberships[0] ||
      null
    );
  }, [selectedAthlete]);

  const activeClubName = useMemo(() => {
    if (!selectedAthlete) {
      return "";
    }
    const membershipClub =
      extractClubIdentifier(activeMembership?.club) ||
      selectedAthlete.membershipClubId ||
      "";
    return (
      resolveClubName(activeMembership?.club) ||
      resolveClubName(membershipClub) ||
      userClubName
    );
  }, [activeMembership, resolveClubName, selectedAthlete, userClubName]);

  const canSubmit = useMemo(() => {
    return (
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.firstNameAr.trim() &&
      formData.lastNameAr.trim() &&
      formData.birthDate &&
      formData.gender &&
      (isAdmin ? selectedClubId : userClubId)
    );
  }, [formData, isAdmin, selectedClubId, userClubId]);

  const canUpdate = useMemo(() => {
    if (!editFormData) {
      return false;
    }
    return (
      editFormData.firstName.trim() &&
      editFormData.lastName.trim() &&
      editFormData.firstNameAr.trim() &&
      editFormData.lastNameAr.trim() &&
      editFormData.birthDate &&
      editFormData.gender
    );
  }, [editFormData]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleClubSelectChange = (event) => {
    setSelectedClubId(event.target.value);
  };

  const handleEditInputChange = (event) => {
    const { name, value } = event.target;
    setEditFormData((previous) =>
      previous ? { ...previous, [name]: value } : previous,
    );
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchBirthDate("");
    setMembershipFilter("all");
    setLicenseFilter("all");
    setGenderFilter("all");
    setSearchResults([]);
    setSelectedAthlete(null);
    setEditFormData(null);
    setEditClubId("");
  };

  const handleViewAthlete = useCallback((athlete) => {
    setSelectedAthlete(athlete || null);
    // Scroll to the details section after a short delay to allow render
    if (athlete) {
      setTimeout(() => {
        selectedAthleteSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, []);

  const handleRowDeselected = useCallback(() => {
    setSelectedAthlete(null);
  }, []);

  const handleOpenDocumentDialog = useCallback(
    (athlete) => {
      if (!canAccessDocuments) {
        toast.error("You do not have permission to manage documents.");
        return;
      }
      if (!athlete) {
        return;
      }
      setDocumentDialog({ open: true, athlete });
    },
    [canAccessDocuments],
  );

  const handleCloseDocumentDialog = useCallback(() => {
    setDocumentDialog({ open: false, athlete: null });
  }, []);

  const handleDocumentsUpdated = useCallback(() => {
    setSearchRefreshKey((previous) => previous + 1);
    refreshGlobalStatistics();
  }, [refreshGlobalStatistics]);

  const handleResetEdit = () => {
    initializeEditState(selectedAthlete);
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setDuplicateAthlete(null);
    setDuplicateMessage("");
  };

  const effectiveCreateClubId = isAdmin ? selectedClubId : userClubId;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      toast.error("Please complete the required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      setDuplicateAthlete(null);
      setDuplicateMessage("");

      if (!effectiveCreateClubId) {
        toast.error("Please select a club for this athlete");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/athletes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          cin: formData.cin.trim() || undefined,
          passportNumber: formData.passportNumber.trim() || undefined,
          membership: {
            clubId: effectiveCreateClubId,
          },
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        setDuplicateAthlete(data.athlete);
        setDuplicateMessage(data.message || "Athlete already exists");
        toast.warning(data.message || "Athlete already exists");
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to create athlete");
      }

      setCreatedAthlete(data.athlete);
      setSelectedAthlete(data.athlete);
      setSearchResults((previous) => {
        const list = Array.isArray(previous) ? previous : [];
        const exists = list.some((item) => item._id === data.athlete._id);
        if (exists) {
          return list.map((item) =>
            item._id === data.athlete._id ? data.athlete : item,
          );
        }
        return [data.athlete, ...list];
      });
      setSearchRefreshKey((previous) => previous + 1);
      refreshGlobalStatistics();
      toast.success("Athlete created successfully");
      resetForm();
      setCreateDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAthlete = async (event) => {
    event.preventDefault();

    if (!selectedAthlete || !editFormData) {
      toast.error("Select an athlete to update");
      return;
    }

    try {
      setIsUpdating(true);

      const payload = {
        ...editFormData,
        cin: (editFormData.cin || "").trim(),
        passportNumber: (editFormData.passportNumber || "").trim(),
      };

      if (editClubId) {
        payload.membership = { clubId: editClubId };
      }

      const response = await fetch(
        `${API_BASE_URL}/api/athletes/${selectedAthlete._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (response.status === 409) {
        toast.warning(
          data.message || "Conflict detected while updating athlete",
        );
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to update athlete");
      }

      setSelectedAthlete(data.athlete);
      setSearchResults((previous) =>
        Array.isArray(previous)
          ? previous.map((item) =>
              item._id === data.athlete._id ? data.athlete : item,
            )
          : [data.athlete],
      );
      setSearchRefreshKey((previous) => previous + 1);
      refreshGlobalStatistics();
      toast.success("Athlete updated successfully");
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAthlete = async () => {
    if (!selectedAthlete) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this athlete?",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);

      const response = await fetch(
        `${API_BASE_URL}/api/athletes/${selectedAthlete._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete athlete");
      }

      toast.success("Athlete deleted successfully");
      setSearchResults((previous) =>
        Array.isArray(previous)
          ? previous.filter((item) => item._id !== selectedAthlete._id)
          : [],
      );
      setSelectedAthlete(null);
      setEditFormData(null);
      setEditClubId("");
      setDuplicateAthlete(null);
      setDuplicateMessage("");
      setCreatedAthlete(null);
      setSearchRefreshKey((previous) => previous + 1);
      refreshGlobalStatistics();
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const renderAthleteCell = useCallback((athlete) => {
    if (!athlete) {
      return null;
    }

    const photoUrl = getAthletePhotoUrl(athlete);
    const initials = getAthleteInitials(athlete);
    const latinName = `${athlete.firstName || ""} ${athlete.lastName || ""}`
      .trim()
      .replace(/\s+/g, " ");
    const arabicName = `${athlete.firstNameAr || ""} ${
      athlete.lastNameAr || ""
    }`
      .trim()
      .replace(/\s+/g, " ");
    const birthLabel = formatDisplayDate(athlete.birthDate) || "Birthdate TBD";
    const genderLabel = athlete.gender
      ? athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1)
      : "Gender TBD";

    return (
      <div className="flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={getAthleteLicenseLabel(athlete)}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
                const fallback = event.currentTarget.nextElementSibling;
                if (fallback) {
                  fallback.classList.remove("hidden");
                }
              }}
            />
          ) : null}
          <span
            className={clsx(
              "text-xs font-semibold text-slate-500",
              photoUrl ? "hidden" : "",
            )}
          >
            {initials}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-slate-900">
            {resolveAthleteName(athlete)}
          </span>
          {arabicName ? (
            <span className="text-xs text-slate-500">{arabicName}</span>
          ) : null}
          <span className="text-[11px] uppercase tracking-wide text-slate-400">
            {latinName || "Name pending"}
          </span>
          <span className="text-[11px] text-slate-400">
            {birthLabel} • {genderLabel}
          </span>
        </div>
      </div>
    );
  }, []);

  const renderIdentifiersCell = useCallback(
    (athlete) => {
      if (!athlete) {
        return null;
      }

      const assignments = Array.isArray(athlete.categoryAssignments)
        ? athlete.categoryAssignments
        : [];

      const nationalAssignment = assignments.find(
        (assignment) =>
          assignment?.type === "national" &&
          Number(assignment?.season) === Number(currentSeasonYear),
      );

      const badges = [
        nationalAssignment && nationalAssignment.abbreviation
          ? {
              key: `national-${nationalAssignment.abbreviation}`,
              label: `Nat. ${nationalAssignment.abbreviation}`,
              tone: "indigo",
            }
          : null,
        athlete.licenseNumber
          ? {
              key: "license",
              label: `License ${athlete.licenseNumber}`,
              tone: "emerald",
            }
          : null,
        athlete.cin
          ? { key: "cin", label: `CIN ${athlete.cin}`, tone: "slate" }
          : null,
        athlete.passportNumber
          ? {
              key: "passport",
              label: `Passport ${athlete.passportNumber}`,
              tone: "slate",
            }
          : null,
      ].filter(Boolean);

      if (!badges.length) {
        return (
          <span className="text-xs text-slate-400">No identifiers on file</span>
        );
      }

      const toneClassMap = {
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
        indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
        slate: "border-slate-200 bg-slate-50 text-slate-600",
      };

      return (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge.key}
              className={clsx(
                "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium",
                toneClassMap[badge.tone] || toneClassMap.slate,
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      );
    },
    [currentSeasonYear],
  );

  const renderMembershipCell = useCallback(
    (athlete) => {
      if (!athlete) {
        return null;
      }

      const memberships = Array.isArray(athlete.memberships)
        ? athlete.memberships
        : [];

      if (memberships.length === 0) {
        const membershipStatus = athlete.membershipStatus
          ? formatLicenseStatus(athlete.membershipStatus)
          : "No club assigned";
        return (
          <span className="text-xs text-slate-400">{membershipStatus}</span>
        );
      }

      return (
        <div className="flex flex-col gap-1 text-xs text-slate-600">
          {memberships.slice(0, 2).map((membership) => {
            const clubName =
              resolveClubName(membership?.club) || "Unknown club";
            const statusLabel = membership?.status
              ? formatLicenseStatus(membership.status)
              : "Status unknown";
            const membershipKey = `${
              extractClubIdentifier(membership?.club) || "club"
            }-${(membership?.status || "status").toLowerCase()}`;

            return (
              <span
                key={membershipKey}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="font-medium text-slate-900">{clubName}</span>
                <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] uppercase tracking-wide text-slate-500">
                  {statusLabel}
                </span>
              </span>
            );
          })}
          {memberships.length > 2 ? (
            <span className="text-[11px] text-slate-400">
              +{memberships.length - 2} more club(s)
            </span>
          ) : null}
        </div>
      );
    },
    [resolveClubName],
  );

  const renderNationalCategoryCell = useCallback(
    (athlete) => {
      if (!athlete) {
        return null;
      }

      const assignments = Array.isArray(athlete.categoryAssignments)
        ? athlete.categoryAssignments
        : [];

      const nationalAssignment = assignments.find(
        (assignment) =>
          assignment?.type === "national" &&
          Number(assignment?.season) === Number(currentSeasonYear),
      );

      if (!nationalAssignment) {
        return <span className="text-xs text-slate-400">Not assigned</span>;
      }

      const title =
        nationalAssignment.titles?.en ||
        nationalAssignment.titles?.fr ||
        nationalAssignment.titles?.ar ||
        null;

      return (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-700">
            {nationalAssignment.abbreviation || "Unassigned"}
          </span>
          {title ? <span className="text-slate-500">{title}</span> : null}
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            Season {nationalAssignment.season}
          </span>
        </div>
      );
    },
    [currentSeasonYear],
  );

  const renderLicenseStatusCell = useCallback((athlete) => {
    if (!athlete) {
      return null;
    }

    const licenseKey = (athlete.licenseStatus || "inactive")
      .toString()
      .toLowerCase();
    const licenseLabel =
      LICENSE_STATUS_LABELS[licenseKey] ||
      licenseKey.charAt(0).toUpperCase() + licenseKey.slice(1);
    const licenseClasses =
      LICENSE_STATUS_BADGE_STYLES[licenseKey] ||
      LICENSE_STATUS_BADGE_STYLES.inactive;

    const documentsKey = (
      athlete.documentsStatus ||
      athlete.documentEvaluation?.status ||
      athlete.status ||
      "pending_documents"
    )
      .toString()
      .toLowerCase();
    const documentsLabel =
      LICENSE_STATUS_LABELS[documentsKey] ||
      documentsKey
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
    const documentsClasses =
      LICENSE_STATUS_BADGE_STYLES[documentsKey] ||
      LICENSE_STATUS_BADGE_STYLES.pending_documents;

    const issues = Array.isArray(athlete.documentsIssues)
      ? athlete.documentsIssues
      : Array.isArray(athlete.documentEvaluation?.issues)
        ? athlete.documentEvaluation.issues
        : [];

    const updatedLabel = formatDisplayDate(athlete.updatedAt) || "Recently";

    return (
      <div className="flex flex-col gap-1">
        <span
          className={clsx(
            "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold capitalize",
            licenseClasses,
          )}
        >
          {`License: ${licenseLabel}`}
        </span>
        <span
          className={clsx(
            "inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold capitalize",
            documentsClasses,
          )}
        >
          {`Documents: ${documentsLabel}`}
        </span>
        {documentsKey !== "active" && issues.length ? (
          <span className="text-[11px] text-amber-600">
            {formatIssueLabel(issues[0])}
            {issues.length > 1 ? ` +${issues.length - 1} more` : ""}
          </span>
        ) : null}
        <span className="text-[11px] text-slate-400">
          Updated {updatedLabel}
        </span>
      </div>
    );
  }, []);

  const renderCreatedCell = useCallback((athlete) => {
    if (!athlete) {
      return null;
    }

    const createdLabel = formatDisplayDate(athlete.createdAt) || "Unknown";
    const updatedLabel = athlete.updatedAt
      ? formatDisplayDate(athlete.updatedAt)
      : null;

    return (
      <div className="flex flex-col gap-1 text-xs text-slate-500">
        <span>Created {createdLabel}</span>
        {updatedLabel ? (
          <span className="text-[11px] text-slate-400">
            Updated {updatedLabel}
          </span>
        ) : null}
      </div>
    );
  }, []);

  const renderActionsCell = useCallback(
    (athlete) => {
      if (!athlete) {
        return null;
      }

      const handleDetailsClick = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        handleViewAthlete(athlete);
      };

      const handleDocumentsClick = (event) => {
        event?.preventDefault();
        event?.stopPropagation();
        handleOpenDocumentDialog(athlete);
      };

      return (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDetailsClick}
          >
            Details
          </Button>
          {canAccessDocuments ? (
            <Button type="button" size="sm" onClick={handleDocumentsClick}>
              Documents
            </Button>
          ) : null}
        </div>
      );
    },
    [canAccessDocuments, handleOpenDocumentDialog, handleViewAthlete],
  );

  const gridColumns = useMemo(
    () => [
      {
        headerText: "Athlete",
        field: "fullName",
        width: 220,
        template: renderAthleteCell,
      },
      {
        headerText: "Identifiers",
        field: "licenseNumber",
        width: 160,
        template: renderIdentifiersCell,
      },
      {
        headerText: "Membership",
        field: "membershipStatus",
        width: 250,
        template: renderMembershipCell,
      },
      {
        headerText: "National category",
        field: "nationalCategory",
        width: 140,
        template: renderNationalCategoryCell,
      },
      {
        headerText: "License status",
        field: "status",
        width: 220,
        template: renderLicenseStatusCell,
      },
      {
        headerText: "Created",
        field: "createdAt",
        width: 140,
        template: renderCreatedCell,
      },
      {
        headerText: "Actions",
        width: 160,
        template: renderActionsCell,
      },
    ],
    [
      renderAthleteCell,
      renderIdentifiersCell,
      renderMembershipCell,
      renderNationalCategoryCell,
      renderLicenseStatusCell,
      renderCreatedCell,
      renderActionsCell,
    ],
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!rosterStatistics.lastUpdatedTimestamp) {
      return null;
    }
    return formatDisplayDate(rosterStatistics.lastUpdatedTimestamp);
  }, [rosterStatistics.lastUpdatedTimestamp]);

  const gridEmptyMessage = useMemo(() => {
    if (hasSearchFilters) {
      return "No athletes match the current filters.";
    }
    return "Apply filters or search to load athletes.";
  }, [hasSearchFilters]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Athlete management
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Athlete workspace
          </h1>
          <p className="text-sm text-slate-500">
            Review your list, track documentation, and register new athletes
            from a single hub.
          </p>
          {lastUpdatedLabel ? (
            <p className="text-xs text-slate-400">
              Last updated {lastUpdatedLabel}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={handleOpenCreateDialog}>
            Add athlete
          </Button>
        </div>
      </header>

      {/* Modern Dashboard Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">
                Season {globalStatistics?.currentSeason || currentSeasonYear}{" "}
                Overview
              </h2>
              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                Current Season
              </span>
            </div>
            <p className="text-sm text-slate-400">
              Active athletes with memberships in the current season
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {globalStatsLoading
              ? "Updating..."
              : globalSnapshotLastUpdated
                ? `Last updated ${globalSnapshotLastUpdated}`
                : ""}
          </span>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Athletes Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl transition-all group-hover:bg-blue-500/30" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-white">
                    {globalStatsLoading
                      ? "..."
                      : formatNumber(globalTotalAthletes)}
                  </p>
                  <p className="text-sm font-medium text-slate-400">
                    Total Athletes
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-700">
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </span>
                <span>{formatNumber(globalUniqueClubs)} clubs registered</span>
              </div>
            </div>
          </div>

          {/* Active Licenses Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl transition-all group-hover:bg-emerald-500/30" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20">
                  <svg
                    className="h-6 w-6 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-emerald-400">
                    {globalStatsLoading
                      ? "..."
                      : formatNumber(globalActiveCount)}
                  </p>
                  <p className="text-sm font-medium text-slate-400">
                    Active Licenses
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Coverage</span>
                  <span className="font-semibold text-emerald-400">
                    {globalActivePercent}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(globalActivePercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Needs Attention Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-amber-500/20 blur-2xl transition-all group-hover:bg-amber-500/30" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
                  <svg
                    className="h-6 w-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-bold text-amber-400">
                    {globalStatsLoading
                      ? "..."
                      : formatNumber(globalAttentionCount)}
                  </p>
                  <p className="text-sm font-medium text-slate-400">
                    Need Attention
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  {formatNumber(globalPendingDocumentsCount)} pending
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                  {formatNumber(globalExpiredMedicalCount)} expired
                </span>
              </div>
            </div>
          </div>

          {/* Gender Distribution Card */}
          <div className="group relative overflow-hidden rounded-2xl bg-white/10 p-6 backdrop-blur-sm transition-all hover:bg-white/15">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl transition-all group-hover:bg-purple-500/30" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                  <svg
                    className="h-6 w-6 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Gender Split
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-pink-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-pink-400" />
                    Female
                  </span>
                  <span className="font-semibold text-white">
                    {formatNumber(globalFemaleCount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-blue-300">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-400" />
                    Male
                  </span>
                  <span className="font-semibold text-white">
                    {formatNumber(globalMaleCount)}
                  </span>
                </div>
                {globalUnknownGenderCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-slate-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      Unknown
                    </span>
                    <span className="font-semibold text-white">
                      {formatNumber(globalUnknownGenderCount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                <svg
                  className="h-5 w-5 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Find Athletes
                </h2>
                <p className="text-sm text-slate-500">
                  Search by name, license, or filter by status
                </p>
              </div>
            </div>
            {rosterStatistics.total > 0 && (
              <div className="flex items-center gap-4 rounded-xl bg-slate-100 px-4 py-2">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">
                    {rosterStatistics.total}
                  </p>
                  <p className="text-xs text-slate-500">Results</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">
                    {rosterStatistics.active}
                  </p>
                  <p className="text-xs text-slate-500">Active</p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-600">
                    {rosterStatistics.attention}
                  </p>
                  <p className="text-xs text-slate-500">Attention</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label
                htmlFor="searchTerm"
                className="text-xs font-medium text-slate-600"
              >
                Search term
              </Label>
              <div className="relative">
                <Input
                  id="searchTerm"
                  placeholder="Name, license, CIN..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                />
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="searchBirthDate"
                className="text-xs font-medium text-slate-600"
              >
                Birth date
              </Label>
              <Input
                id="searchBirthDate"
                type="date"
                value={searchBirthDate}
                onChange={(event) => setSearchBirthDate(event.target.value)}
                max={todayIsoDate()}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="membershipFilter"
                className="text-xs font-medium text-slate-600"
              >
                Membership
              </Label>
              <Select
                id="membershipFilter"
                value={membershipFilter}
                onChange={(event) => setMembershipFilter(event.target.value)}
              >
                {MEMBERSHIP_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="licenseFilter"
                className="text-xs font-medium text-slate-600"
              >
                License status
              </Label>
              <Select
                id="licenseFilter"
                value={licenseFilter}
                onChange={(event) => setLicenseFilter(event.target.value)}
              >
                {LICENSE_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="genderFilter"
                className="text-xs font-medium text-slate-600"
              >
                Gender
              </Label>
              <Select
                id="genderFilter"
                value={genderFilter}
                onChange={(event) => setGenderFilter(event.target.value)}
              >
                {GENDER_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {isSearching ? (
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Searching...
                </span>
              ) : (
                <span className="text-sm text-slate-500">
                  {filteredSearchResults.length
                    ? `Found ${filteredSearchResults.length} athlete${filteredSearchResults.length === 1 ? "" : "s"}`
                    : "Enter search criteria to find athletes"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasSearchFilters &&
                activeSearchTags.map((tag) => (
                  <span
                    key={tag.key}
                    className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20"
                  >
                    {tag.label}
                  </span>
                ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                disabled={!hasAnySearchCriteria}
                className="text-slate-500 hover:text-slate-700"
              >
                Reset filters
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <svg
                className="h-5 w-5 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Athlete List
              </h2>
              <p className="text-sm text-slate-500">
                View, filter, and export athlete data
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAnySearchCriteria && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {filteredSearchResults.length} result
                {filteredSearchResults.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <DataGrid
            data={filteredSearchResults}
            columns={gridColumns}
            loading={isSearching}
            gridId="create-athlete-grid"
            emptyMessage={gridEmptyMessage}
            onRowSelected={handleViewAthlete}
            onRowDeselected={handleRowDeselected}
          />
        </div>
      </section>

      {createdAthlete ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700 shadow-sm">
          <p className="font-semibold">Athlete created successfully</p>
          <p className="mt-1">
            Assigned license number:{" "}
            <strong>{createdAthlete.licenseNumber}</strong>
            {createdAthlete.cin ? (
              <>
                {" "}
                • CIN: <strong>{createdAthlete.cin}</strong>
              </>
            ) : null}
            {createdAthlete.passportNumber ? (
              <>
                {" "}
                • Passport: <strong>{createdAthlete.passportNumber}</strong>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {selectedAthlete ? (
        <section
          ref={selectedAthleteSectionRef}
          className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"
        >
          {/* Athlete Profile Card - Modern Design */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 px-6 py-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMCAwdi02aC02djZoNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
              <div className="relative flex items-start gap-4">
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur-sm">
                    {selectedAthletePhotoUrl ? (
                      <img
                        src={selectedAthletePhotoUrl}
                        alt={getAthleteLicenseLabel(selectedAthlete)}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback =
                            event.currentTarget.nextElementSibling;
                          if (fallback) {
                            fallback.classList.remove("hidden");
                          }
                        }}
                      />
                    ) : null}
                    <span
                      className={clsx(
                        "text-xl font-bold text-white",
                        selectedAthletePhotoUrl ? "hidden" : "",
                      )}
                    >
                      {selectedAthleteInitials}
                    </span>
                  </div>
                  {/* Status indicator */}
                  <div
                    className={clsx(
                      "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white",
                      selectedAthlete.status === "active"
                        ? "bg-emerald-500"
                        : selectedAthlete.status === "pending_documents"
                          ? "bg-amber-500"
                          : selectedAthlete.status === "expired_medical"
                            ? "bg-orange-500"
                            : selectedAthlete.status === "suspended"
                              ? "bg-red-500"
                              : "bg-slate-400",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white truncate">
                    {resolveAthleteName(selectedAthlete)}
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    {getAthleteLicenseLabel(selectedAthlete)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={clsx(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        selectedAthlete.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : selectedAthlete.status === "pending_documents"
                            ? "bg-amber-500/20 text-amber-300"
                            : selectedAthlete.status === "expired_medical"
                              ? "bg-orange-500/20 text-orange-300"
                              : selectedAthlete.status === "suspended"
                                ? "bg-red-500/20 text-red-300"
                                : "bg-slate-500/20 text-slate-300",
                      )}
                    >
                      {formatLicenseStatus(selectedAthlete.status)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Action buttons */}
              <div className="absolute right-4 top-4 flex items-center gap-2">
                {canAccessDocuments && (
                  <button
                    type="button"
                    onClick={() => handleOpenDocumentDialog(selectedAthlete)}
                    className="rounded-lg bg-white/10 p-2 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
                    title="Open documents"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedAthlete(null)}
                  className="rounded-lg bg-white/10 p-2 text-white/80 backdrop-blur-sm transition-all hover:bg-white/20 hover:text-white"
                  title="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Info Grid */}
            <div className="p-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Birth Date
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(selectedAthlete.birthDate) || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Gender</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">
                    {selectedAthlete.gender || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">
                    Nationality
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {selectedAthlete.nationality || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs font-medium text-blue-600">
                    National Category ({currentSeasonYear})
                  </p>
                  <p className="mt-1 text-sm font-semibold text-blue-900">
                    {selectedAthleteNationalCategoryLabel}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">CIN</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 font-mono">
                    {selectedAthlete.cin || "-"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-medium text-slate-500">Passport</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 font-mono">
                    {selectedAthlete.passportNumber || "-"}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
                <span>
                  Created: {formatDate(selectedAthlete.createdAt) || "Unknown"}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>
                  Updated: {formatDate(selectedAthlete.updatedAt) || "Unknown"}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>Club: {activeClubName || "-"}</span>
              </div>

              {/* Membership History */}
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Membership History
                </h3>
                <div className="mt-3 space-y-2">
                  {selectedAthlete.memberships?.length ? (
                    selectedAthlete.memberships.map((membership) => {
                      const clubName =
                        resolveClubName(membership?.club) || "Unknown club";
                      const statusLabel = membership?.status
                        ? formatLicenseStatus(membership.status)
                        : "Unknown";
                      const membershipKey =
                        membership._id ||
                        `${extractClubIdentifier(membership?.club)}-${membership?.status || "status"}`;
                      const isActive = membership?.status === "active";
                      return (
                        <div
                          key={membershipKey}
                          className={clsx(
                            "flex items-center justify-between rounded-xl border px-4 py-3 transition-all",
                            isActive
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-slate-200 bg-white",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                isActive
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
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
                                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">
                                {clubName}
                              </p>
                              {membership.updatedAt && (
                                <p className="text-xs text-slate-500">
                                  Updated{" "}
                                  {formatDisplayDate(membership.updatedAt)}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                              isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                      No club history recorded
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {editFormData ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Edit Form Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Update Athlete
                    </h3>
                    <p className="text-sm text-slate-500">
                      Edit athlete information
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetEdit}
                    disabled={isUpdating || isDeleting}
                    className="text-slate-500"
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteAthlete}
                    disabled={isUpdating || isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleUpdateAthlete} className="p-6 space-y-6">
                {/* Profile Photo */}
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100">
                      {getAthletePhotoUrl(selectedAthlete) ? (
                        <img
                          src={getAthletePhotoUrl(selectedAthlete)}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const span =
                              e.currentTarget.parentNode.querySelector("span");
                            if (span) span.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className="text-2xl font-bold text-slate-400"
                        style={{
                          display: getAthletePhotoUrl(selectedAthlete)
                            ? "none"
                            : "flex",
                        }}
                      >
                        {getAthleteInitials(selectedAthlete)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Name Fields */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Name Information
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editFirstName"
                        className="text-xs font-medium text-slate-600"
                      >
                        First name (Latin)
                      </Label>
                      <Input
                        id="editFirstName"
                        name="firstName"
                        value={editFormData.firstName}
                        onChange={handleEditInputChange}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editLastName"
                        className="text-xs font-medium text-slate-600"
                      >
                        Last name (Latin)
                      </Label>
                      <Input
                        id="editLastName"
                        name="lastName"
                        value={editFormData.lastName}
                        onChange={handleEditInputChange}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editFirstNameAr"
                        className="text-xs font-medium text-slate-600"
                      >
                        First name (Arabic)
                      </Label>
                      <Input
                        id="editFirstNameAr"
                        name="firstNameAr"
                        value={editFormData.firstNameAr}
                        onChange={handleEditInputChange}
                        required
                        className="h-10 text-right"
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editLastNameAr"
                        className="text-xs font-medium text-slate-600"
                      >
                        Last name (Arabic)
                      </Label>
                      <Input
                        id="editLastNameAr"
                        name="lastNameAr"
                        value={editFormData.lastNameAr}
                        onChange={handleEditInputChange}
                        required
                        className="h-10 text-right"
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Personal Details
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editBirthDate"
                        className="text-xs font-medium text-slate-600"
                      >
                        Birth date
                      </Label>
                      <Input
                        id="editBirthDate"
                        name="birthDate"
                        type="date"
                        value={editFormData.birthDate}
                        onChange={handleEditInputChange}
                        max={todayIsoDate()}
                        required
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editGender"
                        className="text-xs font-medium text-slate-600"
                      >
                        Gender
                      </Label>
                      <Select
                        id="editGender"
                        name="gender"
                        value={editFormData.gender}
                        onChange={handleEditInputChange}
                        className="h-10"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editNationality"
                        className="text-xs font-medium text-slate-600"
                      >
                        Nationality
                      </Label>
                      <Input
                        id="editNationality"
                        name="nationality"
                        value={editFormData.nationality || ""}
                        onChange={handleEditInputChange}
                        placeholder="Optional"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editClub"
                        className="text-xs font-medium text-slate-600"
                      >
                        Club
                      </Label>
                      {isAdmin ? (
                        <Select
                          id="editClub"
                          value={editClubId}
                          onChange={(event) =>
                            setEditClubId(event.target.value)
                          }
                          required
                          className="h-10"
                        >
                          <option value="">Select a club</option>
                          {editClubId &&
                            !clubs.some((club) => club._id === editClubId) && (
                              <option value={editClubId}>
                                {resolveClubName(activeMembership?.club) ||
                                  "Current club"}
                              </option>
                            )}
                          {clubs.map((club) => (
                            <option key={club._id} value={club._id}>
                              {club.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          value={activeClubName || userClubName || "-"}
                          disabled
                          readOnly
                          className="h-10 bg-slate-50"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Identity Documents */}
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Identity Documents
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editCin"
                        className="text-xs font-medium text-slate-600"
                      >
                        National ID / CIN
                      </Label>
                      <Input
                        id="editCin"
                        name="cin"
                        value={editFormData.cin}
                        onChange={handleEditInputChange}
                        placeholder="Leave blank to remove"
                        className="h-10 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="editPassport"
                        className="text-xs font-medium text-slate-600"
                      >
                        Passport number
                      </Label>
                      <Input
                        id="editPassport"
                        name="passportNumber"
                        value={editFormData.passportNumber}
                        onChange={handleEditInputChange}
                        placeholder="Optional"
                        className="h-10 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <Button
                    type="submit"
                    disabled={!canUpdate || isUpdating || isDeleting}
                    className="min-w-[140px]"
                  >
                    {isUpdating ? (
                      <span className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      <Modal
        open={createDialogOpen}
        title="Register an athlete"
        description="Capture essential identity information and assign the athlete to a club."
        onClose={handleCloseCreateDialog}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseCreateDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-athlete-form"
              disabled={!canSubmit || isSubmitting || clubsLoading}
            >
              {isSubmitting ? "Creating..." : "Create athlete"}
            </Button>
          </>
        }
      >
        {duplicateAthlete ? (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-semibold">Possible duplicate detected</p>
            <p className="mt-1">
              {duplicateMessage ||
                "An athlete with the same Arabic name and birth date already exists."}{" "}
              License:{" "}
              <strong>{duplicateAthlete.licenseNumber || "Pending"}</strong>
              {duplicateAthlete.cin ? (
                <>
                  {" "}
                  | CIN: <strong>{duplicateAthlete.cin}</strong>
                </>
              ) : null}
              {duplicateAthlete.passportNumber ? (
                <>
                  {" "}
                  | Passport: <strong>{duplicateAthlete.passportNumber}</strong>
                </>
              ) : null}
            </p>
          </div>
        ) : null}
        <form
          id="create-athlete-form"
          className="grid gap-4 md:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="space-y-2">
            <Label htmlFor="firstName">First name (Latin)</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name (Latin)</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstNameAr">First name (Arabic)</Label>
            <Input
              id="firstNameAr"
              name="firstNameAr"
              value={formData.firstNameAr}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastNameAr">Last name (Arabic)</Label>
            <Input
              id="lastNameAr"
              name="lastNameAr"
              value={formData.lastNameAr}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthDate">Birth date</Label>
            <Input
              id="birthDate"
              name="birthDate"
              type="date"
              value={formData.birthDate}
              max={todayIsoDate()}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              name="nationality"
              value={formData.nationality}
              onChange={handleInputChange}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cin">National ID / CIN</Label>
            <Input
              id="cin"
              name="cin"
              value={formData.cin}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passportNumber">Passport number</Label>
            <Input
              id="passportNumber"
              name="passportNumber"
              value={formData.passportNumber}
              onChange={handleInputChange}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clubId">Club</Label>
            {isAdmin ? (
              <Select
                id="clubId"
                value={selectedClubId}
                onChange={handleClubSelectChange}
                required
                disabled={clubsLoading}
              >
                <option value="">Select a club</option>
                {clubs.map((club) => (
                  <option key={club._id} value={club._id}>
                    {club.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={userClubName || "-"} disabled readOnly />
            )}
          </div>
        </form>
      </Modal>

      <AthleteDocumentsDialog
        open={documentDialog.open}
        onClose={handleCloseDocumentDialog}
        onUpdated={handleDocumentsUpdated}
        athlete={documentDialog.athlete}
        token={token}
        apiBaseUrl={API_BASE_URL}
        currentUserRole={user?.role}
      />
    </div>
  );
};

export default CreateAthlete;
