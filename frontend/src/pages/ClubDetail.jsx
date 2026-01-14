import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { DataGrid } from "../components/DataGrid";
import AthleteDocumentsDialog from "../components/AthleteDocumentsDialog";
import { useAuth } from "../contexts/AuthContext";
import {
  getAthleteInitials,
  getAthletePhotoUrl,
  getAthleteLicenseLabel,
} from "../lib/athlete";

const API_BASE_URL = "";

const EMPTY_ATHLETE_GROUP = {
  active: [],
  pending: [],
  inactive: [],
  transferred: [],
};

const EMPTY_COUNTS = {
  active: 0,
  pending: 0,
  inactive: 0,
  transferred: 0,
};

const STATUS_BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-600 ring-amber-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  transferred: "bg-indigo-50 text-indigo-600 ring-indigo-200",
};

const LICENSE_STATUS_BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending_documents: "bg-amber-50 text-amber-600 ring-amber-200",
  pending: "bg-amber-50 text-amber-600 ring-amber-200",
  expired_medical: "bg-orange-100 text-orange-600 ring-orange-200",
  suspended: "bg-rose-50 text-rose-600 ring-rose-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
};

const LICENSE_STATUS_LABELS = {
  active: "Active",
  pending_documents: "Pending Documents",
  pending: "Pending",
  expired_medical: "Expired Medical",
  suspended: "Suspended",
  inactive: "Inactive",
};

const CLUB_TYPE_OPTIONS = [
  { value: "club", label: "Club" },
  { value: "country", label: "Country" },
  { value: "centre_de_promotion", label: "Centre de promotion" },
  { value: "ecole_federale", label: "Ecole federale" },
];

const CLUB_TYPE_LABELS = CLUB_TYPE_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const ATHLETE_SECTIONS = [
  {
    key: "active",
    label: "Active Memberships",
    description: "Athletes with active club affiliation",
    cardClasses: "border-emerald-200 bg-emerald-50",
    badgeClasses: "bg-emerald-500",
  },
  {
    key: "eligible",
    label: "Eligible to Compete",
    description: "Licensed athletes ready for competition",
    cardClasses: "border-blue-200 bg-blue-50",
    badgeClasses: "bg-blue-500",
  },
  {
    key: "inactive",
    label: "Inactive / Expired",
    description: "Athletes requiring renewal or activation",
    cardClasses: "border-slate-200 bg-white",
    badgeClasses: "bg-slate-500",
  },
  {
    key: "transferred",
    label: "Transferred Out",
    description: "Moved to another club",
    cardClasses: "border-indigo-200 bg-indigo-50",
    badgeClasses: "bg-indigo-500",
  },
];

const ATHLETE_EMPTY_MESSAGES = {
  active: "No active memberships found",
  eligible: "No eligible athletes found",
  pending: "No pending approval requests",
  inactive: "No inactive athletes found",
  transferred: "No transferred athletes found",
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

const MANUAL_LICENSE_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
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

const DOCUMENT_DEFINITION_SUMMARY = [
  {
    key: "photo",
    label: "Athlete Photo",
    description: "Recent portrait used on the official license card.",
    required: true,
  },
  {
    key: "birthCertificate",
    label: "Birth Certificate",
    description: "Proof of identity and age issued by civil authorities.",
    required: true,
  },
  {
    key: "cin",
    label: "National ID (CIN)",
    description:
      "Preferred identity document for athletes with national ID numbers.",
    required: false,
  },
  {
    key: "passport",
    label: "Passport",
    description:
      "Accepted in place of CIN. Upload the most recent passport scan.",
    required: false,
  },
  {
    key: "parentalAuthorization",
    label: "Parental Authorization",
    description:
      "Parental consent form. Mandatory for athletes younger than 19.",
    required: false,
    conditional: true,
  },
  {
    key: "medicalCertificate",
    label: "Medical Certificate",
    description:
      "Federation-compliant medical check carried out by an approved doctor. Must include an expiry date.",
    required: true,
    requiresExpiry: true,
  },
];

const GENDER_OPTIONS = [
  { value: "", label: "Select gender" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const formatDisplayDate = (value) => {
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

const formatIssueLabel = (issue) => {
  if (!issue) {
    return "";
  }

  return issue
    .toString()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const resolvePersonName = (person) => {
  if (!person) {
    return "Unknown";
  }

  if (person.fullName) {
    return person.fullName;
  }

  const parts = [person.firstName, person.lastName].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }

  return "Unknown";
};

const getClubInitials = (name, fallback) => {
  if (name) {
    const letters = name
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment[0])
      .join("");

    if (letters) {
      return letters.slice(0, 2).toUpperCase();
    }
  }

  if (fallback) {
    return fallback.slice(0, 2).toUpperCase();
  }

  return "CL";
};

const ClubLogoPreview = ({ name, code, logoUrl }) => {
  const initials = getClubInitials(name, code);

  if (logoUrl) {
    return (
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <img
          src={logoUrl}
          alt={`${name || "Club"} logo`}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
            const fallbackNode = event.currentTarget.nextElementSibling;
            if (fallbackNode) {
              fallbackNode.classList.remove("hidden");
            }
          }}
        />
        <span className="hidden text-sm font-semibold text-slate-500">
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-semibold text-slate-500">
      {initials}
    </div>
  );
};

const DetailItem = ({ label, children }) => (
  <div className="space-y-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="text-sm text-slate-900">{children ?? "--"}</div>
  </div>
);

const buildPermissions = (payload) => ({
  canManageAthletes: Boolean(payload?.canManageAthletes),
  canDecideTransfers: Boolean(payload?.canDecideTransfers),
  canApproveDeletions: Boolean(payload?.canApproveDeletions),
  canRequestDeletions: Boolean(payload?.canRequestDeletions),
  canManageDualMembership: Boolean(payload?.canManageDualMembership),
});

// Card-style athlete display component
const AthleteCard = ({
  athlete,
  permissions,
  isAdmin,
  clubs,
  canViewDocuments,
  onOpenDocuments,
  onEdit,
  onTransfer,
  onRequestDelete,
  onAdminDelete,
  onStatusChange,
  onLicenseStatusChange,
  statusUpdating,
  licenseStatusUpdating,
}) => {
  const photoUrl = getAthletePhotoUrl(athlete);
  const initials = getAthleteInitials(athlete);
  const birthDate = formatDisplayDate(athlete.birthDate) || "N/A";
  const gender = athlete.gender
    ? athlete.gender.charAt(0).toUpperCase() + athlete.gender.slice(1)
    : "--";

  const membershipStatus = (
    athlete.membershipStatus || "inactive"
  ).toLowerCase();
  const membershipStyle =
    STATUS_BADGE_STYLES[membershipStatus] || STATUS_BADGE_STYLES.inactive;

  const licenseStatus = (athlete.licenseStatus || "inactive")
    .toString()
    .toLowerCase();
  const licenseStyle =
    LICENSE_STATUS_BADGE_STYLES[licenseStatus] ||
    LICENSE_STATUS_BADGE_STYLES.inactive;
  const licenseLabel = LICENSE_STATUS_LABELS[licenseStatus] || licenseStatus;

  const documentsStatus = (
    athlete.documentsStatus ||
    athlete.documentEvaluation?.status ||
    athlete.status ||
    "pending_documents"
  )
    .toString()
    .toLowerCase();
  const documentsStyle =
    LICENSE_STATUS_BADGE_STYLES[documentsStatus] ||
    LICENSE_STATUS_BADGE_STYLES.pending_documents;
  const documentsLabel =
    LICENSE_STATUS_LABELS[documentsStatus] ||
    documentsStatus
      .split("_")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  const issues = Array.isArray(athlete.documentsIssues)
    ? athlete.documentsIssues
    : Array.isArray(athlete.documentEvaluation?.issues)
    ? athlete.documentEvaluation.issues
    : [];

  const hasTransferTargets = clubs.length > 1;

  // Status border color based on membership
  const borderColor =
    {
      active: "border-l-emerald-500",
      pending: "border-l-amber-500",
      inactive: "border-l-slate-300",
      transferred: "border-l-indigo-500",
    }[membershipStatus] || "border-l-slate-300";

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md border-l-4 ${borderColor}`}
    >
      {/* Top: Photo + Name + Status */}
      <div className="flex items-center gap-3">
        {/* Photo */}
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={athlete.fullName}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fallback = e.currentTarget.nextElementSibling;
                if (fallback) fallback.classList.remove("hidden");
              }}
            />
          ) : null}
          <span
            className={
              photoUrl ? "hidden" : "text-xs font-semibold text-slate-400"
            }
          >
            {initials}
          </span>
        </div>

        {/* Name & Info */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900 leading-tight">
            {athlete.fullName || "Unnamed"}
          </h3>
          {athlete.fullNameAr && (
            <p className="text-xs text-slate-500 leading-tight">
              {athlete.fullNameAr}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-0.5">
            {gender} • {birthDate}{" "}
            {athlete.licenseNumber && `• ${athlete.licenseNumber}`}
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${licenseStyle}`}
          >
            {licenseLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${documentsStyle}`}
          >
            {documentsLabel}
          </span>
        </div>
      </div>

      {/* Document Issues / Missing Items */}
      {documentsStatus !== "active" && (
        <div className="mt-3 space-y-1.5">
          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue, idx) => {
                const issueStr = issue.toString().toLowerCase();
                const isMissing = issueStr.includes("required") || issueStr.includes("missing");
                const isExpired = issueStr.includes("expired");
                const isPending = issueStr.includes("not_approved") || issueStr.includes("pending");

                let labelText = formatIssueLabel(issue);
                let statusGroup = "pending"; // Default

                if (isMissing) {
                  labelText = `Missing: ${labelText.replace(/ Required| Missing/g, "")}`;
                  statusGroup = "critical";
                } else if (isExpired) {
                  labelText = `Expired: ${labelText.replace(/ Expired/g, "")}`;
                  statusGroup = "critical";
                } else if (isPending) {
                  labelText = `Pending: ${labelText.replace(/ Not Approved| Pending/g, "")}`;
                  statusGroup = "warning";
                }

                return (
                  <span
                    key={idx}
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-tight shadow-sm border ${
                      statusGroup === "critical"
                        ? "bg-rose-50 text-rose-600 border-rose-100"
                        : "bg-amber-50 text-amber-600 border-amber-100"
                    }`}
                  >
                    {statusGroup === "critical" ? "❌ " : "⏳ "}
                    {labelText}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 italic bg-slate-50 rounded px-2 py-1 flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
              </span>
              Verification in progress...
            </div>
          )}
        </div>
      )}

      {/* Bottom: Actions - Two rows */}
      <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
        {/* Row 1: Action Buttons */}
        <div className="flex items-center gap-1">
          {canViewDocuments && (
            <Button
              variant="outline"
              size="sm"
              className={`h-6 px-2 text-[10px] shadow-sm transition-all ${
                documentsStatus !== "active"
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 animate-pulse-subtle"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
              onClick={() => onOpenDocuments(athlete)}
            >
              Docs {documentsStatus !== "active" && `(${issues.length})`}
            </Button>
          )}
          {permissions.canManageAthletes && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => onEdit(athlete)}
            >
              Edit
            </Button>
          )}
          {permissions.canManageAthletes && hasTransferTargets && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              onClick={() => onTransfer(athlete)}
            >
              Transfer
            </Button>
          )}
          {(permissions.canApproveDeletions || isAdmin) && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => onAdminDelete(athlete)}
            >
              Delete
            </Button>
          )}
        </div>

        {/* Row 2: Status Controls */}
        {(permissions.canManageAthletes || isAdmin) && (
          <div className="flex items-center gap-4">
            {permissions.canManageAthletes && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">Membership:</span>
                <select
                  value={membershipStatus}
                  onChange={(e) => onStatusChange(athlete._id, e.target.value)}
                  disabled={statusUpdating}
                  className="text-xs h-6 px-1 border border-slate-200 rounded bg-white"
                >
                  {ATHLETE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500">License:</span>
                <select
                  value={licenseStatus}
                  onChange={(e) =>
                    onLicenseStatusChange(athlete._id, e.target.value)
                  }
                  disabled={licenseStatusUpdating}
                  className="text-xs h-6 px-1 border border-slate-200 rounded bg-white"
                >
                  {MANUAL_LICENSE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Card grid for athletes
const AthleteCardGrid = ({
  athletes,
  permissions,
  isAdmin,
  clubs,
  canViewDocuments,
  onOpenDocuments,
  onEdit,
  onTransfer,
  onRequestDelete,
  onAdminDelete,
  onStatusChange,
  onLicenseStatusChange,
  statusUpdating,
  licenseStatusUpdating,
  loading,
  emptyMessage,
}) => {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 h-40"
          />
        ))}
      </div>
    );
  }

  if (!athletes || athletes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
        {emptyMessage || "No athletes"}
      </div>
    );
  }

  // Sort athletes by birthdate (oldest first)
  const sortedAthletes = [...athletes].sort((a, b) => {
    const dateA = a.birthDate ? new Date(a.birthDate) : new Date(0);
    const dateB = b.birthDate ? new Date(b.birthDate) : new Date(0);
    return dateA - dateB; // Ascending: oldest (earliest date) first
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sortedAthletes.map((athlete) => (
        <AthleteCard
          key={athlete._id}
          athlete={athlete}
          permissions={permissions}
          isAdmin={isAdmin}
          clubs={clubs}
          canViewDocuments={canViewDocuments}
          onOpenDocuments={onOpenDocuments}
          onEdit={onEdit}
          onTransfer={onTransfer}
          onRequestDelete={onRequestDelete}
          onAdminDelete={onAdminDelete}
          onStatusChange={onStatusChange}
          onLicenseStatusChange={onLicenseStatusChange}
          statusUpdating={statusUpdating}
          licenseStatusUpdating={licenseStatusUpdating}
        />
      ))}
    </div>
  );
};

const ClubDetail = () => {
  const navigate = useNavigate();
  const { clubId: routeClubId } = useParams();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);
  const [athleteBuckets, setAthleteBuckets] = useState(EMPTY_ATHLETE_GROUP);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [permissions, setPermissions] = useState(buildPermissions());
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [pendingDeletionRequests, setPendingDeletionRequests] = useState([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [licenseStatusUpdating, setLicenseStatusUpdating] = useState(false);
  const [clubs, setClubs] = useState([]);
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [licenseFilter, setLicenseFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  // Section-specific search terms
  const [eligibleSearchTerm, setEligibleSearchTerm] = useState("");
  const [inactiveSearchTerm, setInactiveSearchTerm] = useState("");
  const [transferredSearchTerm, setTransferredSearchTerm] = useState("");

  const [transferDialog, setTransferDialog] = useState({
    open: false,
    athlete: null,
    targetClubId: "",
    note: "",
    submitting: false,
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    athlete: null,
    reason: "",
    submitting: false,
  });

  const [documentDialog, setDocumentDialog] = useState({
    open: false,
    athlete: null,
  });

  const [editingAthlete, setEditingAthlete] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    firstNameAr: "",
    lastNameAr: "",
    birthDate: "",
    gender: "",
    cin: "",
    passportNumber: "",
    clubId: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Dual membership state (Centre de Promotion)
  const [associatedCentre, setAssociatedCentre] = useState(null);
  const [centreAthletes, setCentreAthletes] = useState([]);
  const [loadingCentreAthletes, setLoadingCentreAthletes] = useState(false);
  const [centreSearchTerm, setCentreSearchTerm] = useState("");
  const [centrePage, setCentrePage] = useState(1);
  const CENTRE_PAGE_SIZE = 10;
  const [dualMembershipDialog, setDualMembershipDialog] = useState({
    open: false,
    athlete: null,
    submitting: false,
  });

  const isAdmin = user?.role === "admin";
  const canViewDocuments = useMemo(() => {
    const allowedRoles = ["admin", "club_manager", "jury_president", "umpire"];
    return allowedRoles.includes(user?.role);
  }, [user?.role]);

  const effectiveClubId = useMemo(() => {
    if (routeClubId && routeClubId !== "mine") {
      return routeClubId;
    }

    if (routeClubId === "mine" && user?.clubId) {
      return user.clubId;
    }

    return user?.clubId ?? null;
  }, [routeClubId, user?.clubId]);

  const detailTargetId = routeClubId === "mine" ? "mine" : effectiveClubId;

  const loadClubDetails = useCallback(async () => {
    if (!token || !detailTargetId) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/clubs/${detailTargetId}/details`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load club details");
      }

      const payload = await response.json();

      setClub(payload.club ?? null);
      setAthleteBuckets({
        ...EMPTY_ATHLETE_GROUP,
        ...(payload.athletes ?? {}),
      });
      setCounts({ ...EMPTY_COUNTS, ...(payload.counts ?? {}) });
      setPermissions(buildPermissions(payload.permissions));
      setPendingTransfers(
        Array.isArray(payload.pendingTransfers) ? payload.pendingTransfers : []
      );
      setPendingDeletionRequests(
        Array.isArray(payload.pendingDeletionRequests)
          ? payload.pendingDeletionRequests
          : []
      );
      setAssociatedCentre(payload.associatedCentre ?? null);
    } catch (error) {
      console.error("Failed to load club details", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [detailTargetId, token]);

  useEffect(() => {
    loadClubDetails();
  }, [loadClubDetails]);

  const loadClubs = useCallback(async () => {
    if (!token || !permissions.canManageAthletes) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/clubs?isActive=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load clubs");
      }

      const payload = await response.json();
      setClubs(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load clubs", error);
      toast.error(error.message);
    }
  }, [permissions.canManageAthletes, token]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  // Load athletes from associated Centre de Promotion
  const loadCentreAthletes = useCallback(async () => {
    if (
      !token ||
      !associatedCentre?._id ||
      !permissions.canManageDualMembership
    ) {
      setCentreAthletes([]);
      return;
    }

    setLoadingCentreAthletes(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/athletes/centre/${associatedCentre._id}/athletes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load centre athletes");
      }

      const payload = await response.json();
      setCentreAthletes(
        Array.isArray(payload.athletes) ? payload.athletes : []
      );
    } catch (error) {
      console.error("Failed to load centre athletes", error);
      // Don't show error toast - centre may just not exist
    } finally {
      setLoadingCentreAthletes(false);
    }
  }, [associatedCentre?._id, permissions.canManageDualMembership, token]);

  useEffect(() => {
    loadCentreAthletes();
  }, [loadCentreAthletes]);

  // Add secondary membership (add centre athlete to this club)
  const addSecondaryMembership = useCallback(
    async (athleteId) => {
      if (!token || !club?._id || !athleteId) {
        return;
      }

      setDualMembershipDialog((prev) => ({ ...prev, submitting: true }));

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athletes/secondary-membership`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              athleteId,
              clubId: club._id,
            }),
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.message || "Failed to add secondary membership"
          );
        }

        toast.success("Athlete added to club successfully");
        setDualMembershipDialog({
          open: false,
          athlete: null,
          submitting: false,
        });
        await loadClubDetails();
        await loadCentreAthletes();
      } catch (error) {
        console.error("Failed to add secondary membership", error);
        toast.error(error.message);
        setDualMembershipDialog((prev) => ({ ...prev, submitting: false }));
      }
    },
    [club?._id, loadClubDetails, loadCentreAthletes, token]
  );

  // Remove secondary membership
  const removeSecondaryMembership = useCallback(
    async (athleteId) => {
      if (!token || !club?._id || !athleteId) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athletes/secondary-membership`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              athleteId,
              clubId: club._id,
            }),
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.message || "Failed to remove secondary membership"
          );
        }

        toast.success("Secondary membership removed");
        await loadClubDetails();
        await loadCentreAthletes();
      } catch (error) {
        console.error("Failed to remove secondary membership", error);
        toast.error(error.message);
      }
    },
    [club?._id, loadClubDetails, loadCentreAthletes, token]
  );

  const filteredBuckets = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    const matchesSearchTerm = (athlete, specificSearchTerm = "") => {
      const combinedSearch = (searchTerm + " " + specificSearchTerm).trim().toLowerCase();
      if (!combinedSearch) {
        return true;
      }

      const needles = combinedSearch.split(/\s+/);

      const fields = [
        athlete.fullName,
        athlete.fullNameAr,
        athlete.firstName,
        athlete.lastName,
        athlete.firstNameAr,
        athlete.lastNameAr,
        athlete.licenseNumber,
        athlete.cin,
        athlete.passportNumber,
        athlete.status,
        athlete.membershipStatus,
      ].map(v => v ? v.toString().toLowerCase() : "");

      return needles.every(needle => 
        fields.some(field => field.includes(needle))
      );
    };

    const matchesGender = (athlete) => {
      if (genderFilter === "all") {
        return true;
      }
      const gender = athlete.gender ? athlete.gender.toLowerCase() : "";
      return gender === genderFilter;
    };

    const documentStatusKeys = new Set([
      "pending_documents",
      "expired_medical",
    ]);

    const matchesLicenseStatus = (athlete) => {
      if (licenseFilter === "all") {
        return true;
      }

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
    };

    const matchesAllFilters = (athlete, specificSearchTerm = "") =>
      matchesSearchTerm(athlete, specificSearchTerm) &&
      matchesGender(athlete) &&
      matchesLicenseStatus(athlete);

    const filterList = (list) =>
      Array.isArray(list) ? list.filter(matchesAllFilters) : [];

    const bucketMatchesMembership = (key) =>
      membershipFilter === "all" || membershipFilter === key;

    const mapForExport = (athlete) => {
      const issues = athlete.documentsIssues || athlete.documentEvaluation?.issues || [];
      const documentIssuesText = (Array.isArray(issues) ? issues : []).map(issue => {
        const issueStr = issue.toString().toLowerCase();
        const isMissing = issueStr.includes("required") || issueStr.includes("missing");
        const isExpired = issueStr.includes("expired");
        const isPending = issueStr.includes("not_approved") || issueStr.includes("pending");

        let label = formatIssueLabel(issue);
        if (isMissing) return `Missing: ${label.replace(/ Required| Missing/gi, "")}`;
        if (isExpired) return `Expired: ${label.replace(/ Expired/gi, "")}`;
        if (isPending) return `Pending: ${label.replace(/ Not Approved| Pending/gi, "")}`;
        return label;
      }).join("; ");

      return {
        ...athlete,
        documentIssuesText,
        birthDate: athlete.birthDate ? new Date(athlete.birthDate) : null,
      };
    };

    const filterAndMap = (list, search) =>
      (Array.isArray(list) ? list.filter(a => matchesAllFilters(a, search)) : [])
        .map(mapForExport);

    return {
      active: bucketMatchesMembership("active")
        ? filterAndMap(athleteBuckets.active, "")
        : [],
      eligible: bucketMatchesMembership("eligible")
        ? filterAndMap(athleteBuckets.eligible, eligibleSearchTerm)
        : [],
      pending: bucketMatchesMembership("pending")
        ? filterAndMap(athleteBuckets.pending, "")
        : [],
      inactive: bucketMatchesMembership("inactive")
        ? filterAndMap(athleteBuckets.inactive, inactiveSearchTerm)
        : [],
      transferred: bucketMatchesMembership("transferred")
        ? filterAndMap(athleteBuckets.transferred, transferredSearchTerm)
        : [],
    };
  }, [
    athleteBuckets,
    genderFilter,
    licenseFilter,
    membershipFilter,
    searchTerm,
    eligibleSearchTerm,
    inactiveSearchTerm,
    transferredSearchTerm,
  ]);

  const activeFilterTags = useMemo(() => {
    const resolveLabel = (options, value) => {
      const match = options.find((option) => option.value === value);
      return match?.label || value;
    };

    const tags = [];

    if (membershipFilter !== "all") {
      tags.push({
        key: "membership",
        label: `Membership: ${resolveLabel(
          MEMBERSHIP_FILTER_OPTIONS,
          membershipFilter
        )}`,
      });
    }

    if (licenseFilter !== "all") {
      const label =
        licenseFilter === "needs_attention"
          ? "Needs attention"
          : resolveLabel(LICENSE_STATUS_FILTER_OPTIONS, licenseFilter);

      tags.push({ key: "license", label: `License: ${label}` });
    }

    if (genderFilter !== "all") {
      tags.push({
        key: "gender",
        label: `Gender: ${resolveLabel(GENDER_FILTER_OPTIONS, genderFilter)}`,
      });
    }

    return tags;
  }, [genderFilter, licenseFilter, membershipFilter]);

  const hasSearchFilters = useMemo(() => {
    return Boolean(searchTerm.trim()) || activeFilterTags.length > 0;
  }, [activeFilterTags, searchTerm]);

  const clearAllFilters = useCallback(() => {
    setSearchTerm("");
    setMembershipFilter("all");
    setLicenseFilter("all");
    setGenderFilter("all");
    setEligibleSearchTerm("");
    setInactiveSearchTerm("");
    setTransferredSearchTerm("");
  }, [setGenderFilter, setLicenseFilter, setMembershipFilter, setSearchTerm]);

  const gridRefs = React.useRef({});
  const setGridRef = (key) => (el) => {
    if (el) gridRefs.current[key] = el;
  };

  const handleExportExcel = useCallback(
    (bucketKey, bucketLabel) => {
      const grid = gridRefs.current[bucketKey];
      if (grid) {
        // filter out columns that shouldn't be exported
        const exportColumns = grid.columns.filter(col => col.allowExcelExport !== false);
        
        grid.excelExport({
          fileName: `${club?.name || "club"}_${bucketLabel.replace(
            /\s+/g,
            "_"
          )}.xlsx`,
          includeHiddenColumn: true,
          columns: exportColumns
        });
      } else {
        toast.error("Export service not ready");
      }
    },
    [club?.name]
  );

  const allAthletes = useMemo(() => {
    const aggregated = [];
    Object.values(athleteBuckets).forEach((list) => {
      if (Array.isArray(list)) {
        aggregated.push(...list);
      }
    });
    return aggregated;
  }, [athleteBuckets]);

  // Only count active membership athletes for document tracking
  const activeAthletes = useMemo(
    () => (Array.isArray(athleteBuckets.active) ? athleteBuckets.active : []),
    [athleteBuckets]
  );

  const licenseStatusSummary = useMemo(() => {
    const summary = {
      active: 0,
      pending_documents: 0,
      expired_medical: 0,
      suspended: 0,
    };

    // Only count active membership athletes
    activeAthletes.forEach((athlete) => {
      const statusKey = (athlete.status || "pending_documents")
        .toString()
        .toLowerCase();
      if (summary[statusKey] === undefined) {
        summary[statusKey] = 0;
      }
      summary[statusKey] += 1;
    });

    return summary;
  }, [activeAthletes]);

  const totalTrackedAthletes = useMemo(
    () => activeAthletes.length,
    [activeAthletes]
  );

  const firstAttentionAthlete = useMemo(
    () =>
      activeAthletes.find((athlete) =>
        LICENSE_ATTENTION_STATUSES.includes(
          (athlete.status || "pending_documents").toString().toLowerCase()
        )
      ) || null,
    [activeAthletes]
  );

  const nextDocumentTarget = useMemo(() => {
    if (firstAttentionAthlete) {
      return firstAttentionAthlete;
    }
    if (activeAthletes.length > 0) {
      return activeAthletes[0];
    }
    return null;
  }, [activeAthletes, firstAttentionAthlete]);

  const updateEditForm = useCallback((field, value) => {
    setEditForm((previous) => ({ ...previous, [field]: value }));
  }, []);

  const openEditDialog = useCallback(
    (athlete) => {
      if (!athlete) {
        return;
      }

      let birthDate = "";
      if (athlete.birthDate) {
        const parsed = new Date(athlete.birthDate);
        if (!Number.isNaN(parsed.getTime())) {
          birthDate = parsed.toISOString().slice(0, 10);
        }
      }

      setEditingAthlete(athlete);
      setEditForm({
        firstName: athlete.firstName || "",
        lastName: athlete.lastName || "",
        firstNameAr: athlete.firstNameAr || "",
        lastNameAr: athlete.lastNameAr || "",
        birthDate,
        gender: athlete.gender || "",
        cin: athlete.cin || "",
        passportNumber: athlete.passportNumber || "",
        clubId: athlete.membershipClubId || effectiveClubId || "",
      });
    },
    [effectiveClubId]
  );

  const closeEditDialog = useCallback(() => {
    setEditingAthlete(null);
    setEditForm({
      firstName: "",
      lastName: "",
      firstNameAr: "",
      lastNameAr: "",
      birthDate: "",
      gender: "",
      cin: "",
      passportNumber: "",
      clubId: "",
    });
    setEditSubmitting(false);
  }, []);

  const handleEditSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!token || !editingAthlete) {
        toast.error("Athlete context missing");
        return;
      }

      setEditSubmitting(true);

      try {
        const payload = {
          firstName: editForm.firstName.trim() || undefined,
          lastName: editForm.lastName.trim() || undefined,
          firstNameAr: editForm.firstNameAr.trim() || undefined,
          lastNameAr: editForm.lastNameAr.trim() || undefined,
          birthDate: editForm.birthDate || undefined,
          gender: editForm.gender || undefined,
          cin: editForm.cin.trim() || undefined,
          passportNumber: editForm.passportNumber.trim() || undefined,
        };

        const currentClubId =
          editingAthlete.membershipClubId || effectiveClubId || "";
        if (isAdmin && editForm.clubId && editForm.clubId !== currentClubId) {
          payload.membership = {
            clubId: editForm.clubId,
            previousClubId: currentClubId || undefined,
          };
        }

        const response = await fetch(
          `${API_BASE_URL}/api/athletes/${editingAthlete._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to update athlete");
        }

        toast.success("Athlete updated");
        closeEditDialog();
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to update athlete", error);
        toast.error(error.message);
      } finally {
        setEditSubmitting(false);
      }
    },
    [
      closeEditDialog,
      editForm,
      editingAthlete,
      effectiveClubId,
      isAdmin,
      loadClubDetails,
      token,
    ]
  );

  const handleStatusChange = useCallback(
    async (athleteId, nextStatus) => {
      if (!club?._id) {
        toast.error("Club context missing");
        return;
      }

      setStatusUpdating(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/clubs/${club._id}/athletes/${athleteId}/status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status: nextStatus }),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to update status");
        }

        toast.success("Athlete status updated");
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to update athlete status", error);
        toast.error(error.message);
      } finally {
        setStatusUpdating(false);
      }
    },
    [club?._id, loadClubDetails, token]
  );

  const handleLicenseStatusChange = useCallback(
    async (athleteId, nextStatus) => {
      if (!isAdmin) {
        toast.error("Only administrators can update manual license status");
        return;
      }

      if (!nextStatus) {
        return;
      }

      setLicenseStatusUpdating(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athletes/${athleteId}/license-status`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ licenseStatus: nextStatus }),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to update license status");
        }

        toast.success("License status updated");
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to update manual license status", error);
        toast.error(error.message);
      } finally {
        setLicenseStatusUpdating(false);
      }
    },
    [isAdmin, loadClubDetails, token]
  );

  const openTransferDialog = useCallback((athlete) => {
    setTransferDialog({
      open: true,
      athlete,
      targetClubId: "",
      note: "",
      submitting: false,
    });
  }, []);

  const closeTransferDialog = useCallback(() => {
    setTransferDialog((previous) => ({ ...previous, open: false }));
  }, []);

  const submitTransferRequest = useCallback(
    async (event) => {
      event.preventDefault();

      if (!transferDialog.athlete || !transferDialog.targetClubId) {
        toast.error("Please select a target club");
        return;
      }

      setTransferDialog((previous) => ({ ...previous, submitting: true }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/athlete-transfers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            athleteId: transferDialog.athlete._id,
            toClubId: transferDialog.targetClubId,
            notes: transferDialog.note || undefined,
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            result.message || "Failed to submit transfer request"
          );
        }

        toast.success("Transfer request submitted");
        setTransferDialog({
          open: false,
          athlete: null,
          targetClubId: "",
          note: "",
          submitting: false,
        });
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to submit transfer request", error);
        toast.error(error.message);
        setTransferDialog((previous) => ({ ...previous, submitting: false }));
      }
    },
    [loadClubDetails, token, transferDialog]
  );

  const decideTransferRequest = useCallback(
    async (requestId, action) => {
      const confirmed = window.confirm(
        `Are you sure you want to ${action} this transfer request?`
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athlete-transfers/${requestId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action }),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to update request");
        }

        toast.success(
          action === "approve" ? "Transfer approved" : "Transfer rejected"
        );
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to update transfer request", error);
        toast.error(error.message);
      }
    },
    [loadClubDetails, token]
  );

  const openDeleteDialog = useCallback((athlete) => {
    setDeleteDialog({ open: true, athlete, reason: "", submitting: false });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog((previous) => ({ ...previous, open: false }));
  }, []);

  const openDocumentsDialog = useCallback((athlete) => {
    setDocumentDialog({ open: true, athlete });
  }, []);

  const handleOpenDocumentsWorkspace = useCallback(() => {
    if (nextDocumentTarget) {
      openDocumentsDialog(nextDocumentTarget);
      return;
    }

    toast.info("No athletes available for document review");
  }, [nextDocumentTarget, openDocumentsDialog]);

  const closeDocumentsDialog = useCallback(() => {
    setDocumentDialog({ open: false, athlete: null });
  }, []);

  const submitDeletionRequest = useCallback(
    async (event) => {
      event.preventDefault();

      if (!deleteDialog.athlete) {
        toast.error("Athlete context missing");
        return;
      }

      setDeleteDialog((previous) => ({ ...previous, submitting: true }));

      try {
        const response = await fetch(`${API_BASE_URL}/api/athlete-deletions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            athleteId: deleteDialog.athlete._id,
            reason: deleteDialog.reason || undefined,
          }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            result.message || "Failed to submit deletion request"
          );
        }

        toast.success("Deletion request submitted");
        setDeleteDialog({
          open: false,
          athlete: null,
          reason: "",
          submitting: false,
        });
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to submit deletion request", error);
        toast.error(error.message);
        setDeleteDialog((previous) => ({ ...previous, submitting: false }));
      }
    },
    [deleteDialog, loadClubDetails, token]
  );

  const handleAdminDelete = useCallback(
    async (athlete) => {
      const confirmed = window.confirm(
        `Delete ${resolvePersonName(athlete)}? This cannot be undone.`
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athletes/${athlete._id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to delete athlete");
        }

        toast.success("Athlete deleted");
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to delete athlete", error);
        toast.error(error.message);
      }
    },
    [loadClubDetails, token]
  );

  const decideDeletionRequest = useCallback(
    async (requestId, action) => {
      const confirmed = window.confirm(
        `Are you sure you want to ${action} this deletion request?`
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/athlete-deletions/${requestId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action }),
          }
        );

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.message || "Failed to update request");
        }

        toast.success(
          action === "approve"
            ? "Deletion approved"
            : "Deletion request rejected"
        );
        await loadClubDetails();
      } catch (error) {
        console.error("Failed to update deletion request", error);
        toast.error(error.message);
      }
    },
    [loadClubDetails, token]
  );

  const renderAthleteSummary = useCallback((athlete) => {
    const photoUrl = getAthletePhotoUrl(athlete);
    const initials = getAthleteInitials(athlete);
    const firstName = athlete.firstName || "";
    const lastName = athlete.lastName || "";
    const displayName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : athlete.fullName || "Unnamed";

    // Build ID string
    const idParts = [];
    if (athlete.cin) idParts.push(`CIN: ${athlete.cin}`);
    if (athlete.passportNumber) idParts.push(`Pass: ${athlete.passportNumber}`);
    const idString = idParts.join(" | ");

    return (
      <div className="flex items-center gap-3 py-1">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm">
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
            className={
              photoUrl ? "hidden" : "text-[11px] font-semibold text-slate-400"
            }
          >
            {initials}
          </span>
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-bold text-slate-900 leading-tight truncate">
            {displayName}
          </p>
          {athlete.fullNameAr && (
            <p className="text-xs text-slate-500 leading-tight font-medium">
              {athlete.fullNameAr}
            </p>
          )}
          {idString && <p className="text-[10px] text-slate-400 font-medium">{idString}</p>}
        </div>
      </div>
    );
  }, []);

  const renderIdentifierBadges = useCallback((athlete) => {
    const birthDate = formatDisplayDate(athlete.birthDate) || "N/A";
    const gender = athlete.gender
      ? athlete.gender === "male"
        ? "M"
        : "F"
      : "-";

    return (
      <div className="text-xs text-slate-600 leading-tight">
        {athlete.licenseNumber && (
          <div className="font-medium text-slate-800">
            {athlete.licenseNumber}
          </div>
        )}
        <div className="text-[11px] text-slate-400">
          {birthDate} • {gender}
        </div>
      </div>
    );
  }, []);

  const renderStatusBadge = useCallback((athlete) => {
    const status = (athlete.membershipStatus || "inactive").toLowerCase();
    const style = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.inactive;

    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${style}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }, []);

  const renderLicenseStatus = useCallback((athlete) => {
    if (!athlete) {
      return null;
    }

    const licenseKey = (athlete.licenseStatus || "inactive")
      .toString()
      .toLowerCase();
    const licenseStyle =
      LICENSE_STATUS_BADGE_STYLES[licenseKey] ||
      LICENSE_STATUS_BADGE_STYLES.inactive;
    const licenseLabel =
      LICENSE_STATUS_LABELS[licenseKey] ||
      licenseKey.charAt(0).toUpperCase() + licenseKey.slice(1);

    const documentsKey = (
      athlete.documentsStatus ||
      athlete.documentEvaluation?.status ||
      athlete.status ||
      athlete.athleteStatus ||
      "pending_documents"
    )
      .toString()
      .toLowerCase();
    const documentsStyle =
      LICENSE_STATUS_BADGE_STYLES[documentsKey] ||
      LICENSE_STATUS_BADGE_STYLES.pending_documents;
    const documentsLabel =
      LICENSE_STATUS_LABELS[documentsKey] ||
      documentsKey
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");

    const issues = Array.isArray(athlete.documentsIssues)
      ? athlete.documentsIssues
      : Array.isArray(athlete.documentEvaluation?.issues)
      ? athlete.documentEvaluation.issues
      : [];

    return (
      <div className="flex flex-col gap-1.5 py-1">
        <span
          className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ring-1 ring-inset ${licenseStyle}`}
        >
          {licenseLabel}
        </span>
        <span
          className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ring-1 ring-inset ${documentsStyle}`}
        >
          {documentsLabel}
        </span>
        {documentsKey !== "active" && issues.length ? (
          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
            <span className="scale-110">⚠️</span> {issues.length} {issues.length > 1 ? "issues" : "issue"}
          </span>
        ) : null}
      </div>
    );
  }, []);

  const renderStatusManager = useCallback(
    (athlete) => {
      if (!permissions.canManageAthletes) {
        return <span className="text-[10px] text-slate-400">-</span>;
      }

      const normalizedStatus = (
        athlete.membershipStatus || "inactive"
      ).toLowerCase();

      return (
        <Select
          value={normalizedStatus}
          onChange={(event) =>
            handleStatusChange(athlete._id, event.target.value)
          }
          disabled={statusUpdating}
          className="text-xs h-9 w-[100px] shadow-sm"
        >
          {ATHLETE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    },
    [handleStatusChange, permissions.canManageAthletes, statusUpdating]
  );

  const renderLicenseStatusManager = useCallback(
    (athlete) => {
      if (!isAdmin) {
        return <span className="text-[10px] text-slate-400">-</span>;
      }

      const normalizedStatus = (athlete.licenseStatus || "inactive")
        .toString()
        .toLowerCase();

      return (
        <Select
          value={normalizedStatus}
          onChange={(event) =>
            handleLicenseStatusChange(athlete._id, event.target.value)
          }
          disabled={licenseStatusUpdating}
          className="text-xs h-9 w-[95px] shadow-sm"
        >
          {MANUAL_LICENSE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      );
    },
    [handleLicenseStatusChange, isAdmin, licenseStatusUpdating]
  );

  const renderActionButtons = useCallback(
    (athlete) => {
      const buttons = [];
      const canManage = permissions.canManageAthletes;
      const canApproveDeletion = permissions.canApproveDeletions || isAdmin;
      const hasTransferTargets = clubs.length > 1;

      if (canViewDocuments) {
        buttons.push(
          <Button
            key="documents"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            onClick={() => openDocumentsDialog(athlete)}
          >
            Docs
          </Button>
        );
      }

      if (canManage) {
        buttons.push(
          <Button
            key="edit"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={() => openEditDialog(athlete)}
          >
            Edit
          </Button>
        );
      }

      if (canManage && hasTransferTargets) {
        buttons.push(
          <Button
            key="transfer"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
            onClick={() => openTransferDialog(athlete)}
          >
            Transfer
          </Button>
        );
      }

      if (canApproveDeletion) {
        buttons.push(
          <Button
            key="delete"
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => handleAdminDelete(athlete)}
          >
            Del
          </Button>
        );
      }

      if (!buttons.length) {
        return <span className="text-[10px] text-slate-400">-</span>;
      }

      return <div className="flex items-center gap-1.5 py-1 flex-wrap">{buttons}</div>;
    },
    [
      clubs.length,
      canViewDocuments,
      handleAdminDelete,
      isAdmin,
      openDocumentsDialog,
      openDeleteDialog,
      openEditDialog,
      openTransferDialog,
      permissions,
    ]
  );

  const athleteColumns = useMemo(
    () =>
      [
        {
          headerText: "Athlete",
          field: "fullName",
          width: 200,
          template: renderAthleteSummary,
          allowExcelExport: false,
        },
        {
          headerText: "Info",
          field: "licenseNumber",
          width: 110,
          template: renderIdentifierBadges,
          allowExcelExport: false,
        },
        {
          headerText: "Full Name",
          field: "fullName",
          width: 150,
          visible: false,
        },
        {
          headerText: "License Number",
          field: "licenseNumber",
          width: 120,
          visible: false,
        },
        {
          headerText: "Name (AR)",
          field: "fullNameAr",
          width: 150,
          visible: false,
        },
        {
          headerText: "Gender",
          field: "gender",
          width: 80,
          visible: false,
        },
        {
          headerText: "Birth Date",
          field: "birthDate",
          width: 100,
          visible: false,
          type: "date",
          format: "dd/MM/yyyy",
        },
        {
          headerText: "Status",
          field: "status",
          width: 115,
          template: renderLicenseStatus,
        },
        {
          headerText: "Document Issues",
          field: "documentIssuesText",
          width: 150,
          visible: false,
        },
        permissions.canManageAthletes
          ? {
              headerText: "Membership",
              field: "membershipStatus",
              width: 95,
              template: renderStatusManager,
            }
          : null,
        isAdmin
          ? {
              headerText: "License",
              field: "licenseStatus",
              width: 90,
              template: renderLicenseStatusManager,
            }
          : null,
        {
          headerText: "Actions",
          width: 140,
          template: renderActionButtons,
          allowExcelExport: false,
        },
      ].filter(Boolean),
    [
      permissions.canManageAthletes,
      renderActionButtons,
      renderAthleteSummary,
      renderIdentifierBadges,
      renderLicenseStatusManager,
      renderLicenseStatus,
      renderStatusManager,
      isAdmin,
    ]
  );

  const availableTransferClubs = useMemo(() => {
    if (!transferDialog.athlete) {
      return clubs;
    }

    const currentClubId =
      transferDialog.athlete.membershipClubId || effectiveClubId;
    return clubs.filter((item) => item._id !== currentClubId);
  }, [clubs, effectiveClubId, transferDialog.athlete]);

  const clubTypeLabel = club?.type
    ? CLUB_TYPE_LABELS[club.type] || club.type.replace(/_/g, " ")
    : "--";

  const parentClubName =
    typeof club?.parentClub === "object"
      ? club?.parentClub?.name
      : club?.parentClub || null;

  if (!detailTargetId) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No club context available.
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate("/clubs")}>
              Back to clubs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !club) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          This club could not be found.
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate("/clubs")}>
              Back to clubs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full space-y-10 p-6 sm:p-8 lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-semibold text-slate-900">
            Club overview
          </h1>
        </div>
        {club?.code ? (
          <span className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600">
            Code {club.code}
          </span>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          <ClubLogoPreview
            name={club?.name}
            code={club?.code}
            logoUrl={club?.logoUrl}
          />

          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {club?.name || "Club details"}
                </h2>
                <p className="text-sm text-slate-500">
                  {club?.nameAr || "Arabic name unavailable"}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Monitoring {totalTrackedAthletes} athlete
                {totalTrackedAthletes === 1 ? "" : "s"}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Type">{clubTypeLabel}</DetailItem>
              <DetailItem label="Status">
                {club?.isActive ? "Active" : "Inactive"}
              </DetailItem>
              <DetailItem label="City">{club?.city || "--"}</DetailItem>
              <DetailItem label="Parent club">
                {parentClubName || "--"}
              </DetailItem>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailItem label="Email">{club?.email || "--"}</DetailItem>
              <DetailItem label="Phone">{club?.phone || "--"}</DetailItem>
              <DetailItem label="Address">{club?.address || "--"}</DetailItem>
              <DetailItem label="Contact">
                {club?.contacts?.primaryName || club?.contactName || "--"}
              </DetailItem>
            </div>

            {associatedCentre ? (
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
                    Associated Centre de Promotion
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-purple-900">
                  {associatedCentre.name}
                  {associatedCentre.code ? ` (${associatedCentre.code})` : ""}
                </p>
                {associatedCentre.nameAr ? (
                  <p className="text-sm text-purple-700">
                    {associatedCentre.nameAr}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-purple-600">
                  Athletes from this centre can be added as secondary members
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ATHLETE_SECTIONS.map((section) => (
          <div
            key={section.key}
            className={`rounded-2xl border ${section.cardClasses} p-5 shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {section.label}
                </p>
                <p className="text-xs text-slate-500">{section.description}</p>
              </div>
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${section.badgeClasses}`}
              >
                {counts[section.key] ?? 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Documents & Eligibility */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Documents &amp; Eligibility
              </h2>
              <p className="text-sm text-slate-500">
                Track required paperwork and keep athletes eligible for
                competition.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(LICENSE_STATUS_LABELS).map(([key, label]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                    LICENSE_STATUS_BADGE_STYLES[key] ||
                    LICENSE_STATUS_BADGE_STYLES.pending_documents
                  }`}
                >
                  <span>{label}</span>
                  <span className="rounded bg-white/40 px-2 py-[1px] text-[10px] font-semibold uppercase text-slate-700">
                    {licenseStatusSummary[key] ?? 0}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Monitoring {totalTrackedAthletes} active athlete
              {totalTrackedAthletes === 1 ? "" : "s"}. Status badges highlight
              anyone whose documents still need attention.
            </p>
            {totalTrackedAthletes > 0 && nextDocumentTarget && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenDocumentsWorkspace}
                >
                  Review: {resolvePersonName(nextDocumentTarget)}
                </Button>
                <span className="text-xs text-slate-500">
                  {LICENSE_STATUS_LABELS[
                    String(
                      nextDocumentTarget.status || "pending_documents"
                    ).toLowerCase()
                  ] || "Pending Documents"}
                </span>
              </div>
            )}
          </div>
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Required documents
              </h3>
              <p className="text-xs text-slate-500">
                Quick reference for managers preparing uploads.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              {DOCUMENT_DEFINITION_SUMMARY.map((definition) => {
                const attentionFlags = [
                  definition.requiresExpiry ? "Tracks expiry" : null,
                  definition.conditional ? "Conditional" : null,
                ].filter(Boolean);

                return (
                  <li key={definition.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-900">
                        {definition.label}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          definition.required
                            ? "text-rose-600"
                            : "text-slate-400"
                        }`}
                      >
                        {definition.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {definition.description}
                    </p>
                    {attentionFlags.length ? (
                      <p className="text-[10px] uppercase tracking-wide text-amber-600">
                        {attentionFlags.join(" • ")}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="athlete-search">Search athletes</Label>
            <Input
              id="athlete-search"
              placeholder="Search by name, license, CIN, passport"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="membership-filter">Membership status</Label>
            <Select
              id="membership-filter"
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
          <div className="space-y-1">
            <Label htmlFor="license-filter">License status</Label>
            <Select
              id="license-filter"
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
          <div className="space-y-1">
            <Label htmlFor="gender-filter">Gender</Label>
            <Select
              id="gender-filter"
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {permissions.canManageAthletes
              ? "Status changes and transfers are available to authorized managers."
              : "Search applies to all athlete groups within this club."}
          </p>
          {hasSearchFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Active filters:
              </span>
              {searchTerm.trim() ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Search: {searchTerm.trim()}
                </span>
              ) : null}
              {activeFilterTags.map((tag) => (
                <span
                  key={tag.key}
                  className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {tag.label}
                </span>
              ))}
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1 text-xs"
                onClick={clearAllFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {permissions.canDecideTransfers && pendingTransfers.length ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Pending transfer requests
          </h2>
          <div className="mt-4 space-y-4">
            {pendingTransfers.map((request) => (
              <div
                key={request._id}
                className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-900">
                        {resolvePersonName(request.athlete)}
                      </span>{" "}
                      from {request.fromClub?.name || "Unknown"} to{" "}
                      {request.toClub?.name || "Unknown"}
                    </p>
                    {request.notes ? (
                      <p className="text-xs text-slate-500">
                        Note: {request.notes}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      Requested{" "}
                      {formatDisplayDate(request.createdAt) || "recently"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        decideTransferRequest(request._id, "reject")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      onClick={() =>
                        decideTransferRequest(request._id, "approve")
                      }
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {permissions.canApproveDeletions && pendingDeletionRequests.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Pending deletion requests
          </h2>
          <div className="mt-4 space-y-4">
            {pendingDeletionRequests.map((request) => (
              <div
                key={request._id}
                className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="font-medium text-slate-900">
                        {resolvePersonName(request.athlete)}
                      </span>{" "}
                      requested by {resolvePersonName(request.requestedBy)}
                    </p>
                    {request.reason ? (
                      <p className="text-xs text-slate-500">
                        Reason: {request.reason}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-400">
                      Submitted{" "}
                      {formatDisplayDate(request.createdAt) || "recently"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        decideDeletionRequest(request._id, "reject")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        decideDeletionRequest(request._id, "approve")
                      }
                    >
                      Approve & Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-8">
        {ATHLETE_SECTIONS.map((section) => {
          const bucket = filteredBuckets[section.key] ?? [];
          const useCards = section.key === "active";
          return (
            <section
              key={section.key}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {section.label}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {bucket.length
                      ? `${bucket.length} athlete${
                          bucket.length === 1 ? "" : "s"
                        }`
                      : ATHLETE_EMPTY_MESSAGES[section.key]}
                  </p>
                </div>
                {!useCards && (
                  <div className="flex-1 max-w-sm">
                    <Input
                      placeholder={`Search in ${section.label?.toLowerCase()}...`}
                      value={
                        section.key === "eligible" ? eligibleSearchTerm :
                        section.key === "inactive" ? inactiveSearchTerm :
                        section.key === "transferred" ? transferredSearchTerm : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (section.key === "eligible") setEligibleSearchTerm(val);
                        else if (section.key === "inactive") setInactiveSearchTerm(val);
                        else if (section.key === "transferred") setTransferredSearchTerm(val);
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportExcel(section.key, section.label)}
                    className="h-9 px-3 text-[11px] font-bold uppercase tracking-tight border-slate-200 hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
                  >
                    Export List
                  </Button>
                  <span
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white shadow-md ${section.badgeClasses}`}
                  >
                    {counts[section.key] ?? 0}
                  </span>
                </div>
              </div>

              {useCards ? (
                <>
                  <AthleteCardGrid
                    athletes={bucket}
                    permissions={permissions}
                    isAdmin={isAdmin}
                    clubs={clubs}
                    canViewDocuments={canViewDocuments}
                    onOpenDocuments={openDocumentsDialog}
                    onEdit={openEditDialog}
                    onTransfer={openTransferDialog}
                    onRequestDelete={openDeleteDialog}
                    onAdminDelete={handleAdminDelete}
                    onStatusChange={handleStatusChange}
                    onLicenseStatusChange={handleLicenseStatusChange}
                    statusUpdating={statusUpdating}
                    licenseStatusUpdating={licenseStatusUpdating}
                    loading={loading}
                    emptyMessage={ATHLETE_EMPTY_MESSAGES[section.key]}
                  />
                  {/* Hidden grid for export purposes */}
                  <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                    <DataGrid
                      ref={setGridRef(section.key)}
                      data={bucket}
                      columns={athleteColumns}
                      gridId={`export-grid-${section.key}`}
                    />
                  </div>
                </>
              ) : (
                <DataGrid
                  ref={setGridRef(section.key)}
                  data={bucket}
                  columns={athleteColumns}
                  emptyMessage={ATHLETE_EMPTY_MESSAGES[section.key]}
                  loading={loading}
                  gridId={`club-athletes-${section.key}`}
                  showSearch={false}
                />
              )}
            </section>
          );
        })}
      </div>

      {/* Centre de Promotion Athletes Section */}
      {associatedCentre && permissions.canManageDualMembership ? (
        <div className="mt-8 space-y-4 rounded-2xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-purple-900">
                Centre de Promotion Athletes
              </h2>
              <p className="text-sm text-purple-600">
                Athletes from{" "}
                <span className="font-medium">{associatedCentre.name}</span>
                {associatedCentre.nameAr ? (
                  <span className="ml-1">({associatedCentre.nameAr})</span>
                ) : null}{" "}
                who can be added as secondary members
              </p>
            </div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-sm font-semibold text-white">
              {centreAthletes.length}
            </span>
          </div>

          {/* Search input */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, license number..."
                value={centreSearchTerm}
                onChange={(e) => {
                  setCentreSearchTerm(e.target.value);
                  setCentrePage(1);
                }}
                className="bg-white"
              />
            </div>
          </div>

          {loadingCentreAthletes ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-purple-600">
                Loading centre athletes...
              </div>
            </div>
          ) : centreAthletes.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-slate-500">
                No athletes found in this Centre de Promotion
              </div>
            </div>
          ) : (
            (() => {
              const needle = centreSearchTerm.trim().toLowerCase();
              const filtered = centreAthletes.filter((athlete) => {
                if (!needle) return true;
                const fields = [
                  athlete.firstName,
                  athlete.lastName,
                  athlete.firstNameAr,
                  athlete.lastNameAr,
                  athlete.licenseNumber,
                ];
                return fields.some((f) => f?.toLowerCase().includes(needle));
              });
              const totalPages = Math.ceil(filtered.length / CENTRE_PAGE_SIZE);
              const paginated = filtered.slice(
                (centrePage - 1) * CENTRE_PAGE_SIZE,
                centrePage * CENTRE_PAGE_SIZE
              );

              if (filtered.length === 0) {
                return (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-sm text-slate-500">
                      No athletes match your search
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-purple-200 text-xs font-semibold uppercase tracking-wide text-purple-700">
                          <th className="px-4 py-3">Athlete</th>
                          <th className="px-4 py-3">License</th>
                          <th className="px-4 py-3">Gender</th>
                          <th className="px-4 py-3">Birth Date</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {paginated.map((athlete) => {
                          // Check if this athlete already has a secondary membership to this club
                          const hasSecondaryHere = athlete.memberships?.some(
                            (m) =>
                              m.membershipType === "secondary" &&
                              (m.club === club?._id ||
                                m.club?._id === club?._id ||
                                (typeof m.club === "object" &&
                                  m.club?._id?.toString() === club?._id))
                          );

                          return (
                            <tr
                              key={athlete._id}
                              className="hover:bg-purple-100/50"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-200 text-xs font-medium text-purple-700">
                                    {getAthleteInitials(athlete)}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-900">
                                      {athlete.firstName} {athlete.lastName}
                                    </div>
                                    {athlete.firstNameAr ||
                                    athlete.lastNameAr ? (
                                      <div className="text-xs text-slate-500">
                                        {athlete.firstNameAr}{" "}
                                        {athlete.lastNameAr}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {athlete.licenseNumber || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600 capitalize">
                                {athlete.gender || "—"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {formatDisplayDate(athlete.birthDate) || "—"}
                              </td>
                              <td className="px-4 py-3">
                                {hasSecondaryHere ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                                    Member
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                    Not a member
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {hasSecondaryHere ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      removeSecondaryMembership(athlete._id)
                                    }
                                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    Remove
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setDualMembershipDialog({
                                        open: true,
                                        athlete,
                                        submitting: false,
                                      })
                                    }
                                    className="text-purple-600 hover:bg-purple-100 hover:text-purple-700"
                                  >
                                    Add to Club
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 ? (
                    <div className="flex items-center justify-between border-t border-purple-200 pt-4">
                      <p className="text-sm text-purple-600">
                        Showing {(centrePage - 1) * CENTRE_PAGE_SIZE + 1} to{" "}
                        {Math.min(
                          centrePage * CENTRE_PAGE_SIZE,
                          filtered.length
                        )}{" "}
                        of {filtered.length} athletes
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={centrePage === 1}
                          onClick={() => setCentrePage((p) => p - 1)}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-purple-700">
                          Page {centrePage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={centrePage === totalPages}
                          onClick={() => setCentrePage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-purple-600 pt-2">
                      Showing {filtered.length} athlete
                      {filtered.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </>
              );
            })()
          )}
        </div>
      ) : null}

      {/* Dual Membership Confirmation Dialog */}
      {dualMembershipDialog.open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Add athlete to club
              </h2>
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  setDualMembershipDialog({
                    open: false,
                    athlete: null,
                    submitting: false,
                  })
                }
              >
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-sm text-slate-600">
                You are about to add{" "}
                <span className="font-medium">
                  {dualMembershipDialog.athlete?.firstName}{" "}
                  {dualMembershipDialog.athlete?.lastName}
                </span>{" "}
                from{" "}
                <span className="font-medium">{associatedCentre?.name}</span> as
                a secondary member of this club.
              </p>
              <p className="text-sm text-slate-500">
                The athlete will maintain their primary membership at the Centre
                de Promotion while also being able to compete for this club.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() =>
                    setDualMembershipDialog({
                      open: false,
                      athlete: null,
                      submitting: false,
                    })
                  }
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    addSecondaryMembership(dualMembershipDialog.athlete?._id)
                  }
                  disabled={dualMembershipDialog.submitting}
                >
                  {dualMembershipDialog.submitting
                    ? "Adding..."
                    : "Confirm & Add"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editingAthlete ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Edit athlete
              </h2>
              <Button variant="ghost" type="button" onClick={closeEditDialog}>
                Close
              </Button>
            </div>

            <form
              className="mt-6 grid gap-4 md:grid-cols-2"
              onSubmit={handleEditSubmit}
            >
              <div className="md:col-span-2 flex justify-center mb-4">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-3xl font-medium text-slate-500">
                    {getAthletePhotoUrl(editingAthlete) ? (
                      <img
                        src={getAthletePhotoUrl(editingAthlete)}
                        alt="Profile"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const span = e.currentTarget.parentNode.querySelector("span");
                          if (span) span.style.display = "block";
                        }}
                      />
                    ) : null}
                    <span style={{ display: getAthletePhotoUrl(editingAthlete) ? 'none' : 'block' }}>
                        {getAthleteInitials(editingAthlete)}
                    </span>
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-first-name">First name</Label>
                <Input
                  id="edit-first-name"
                  value={editForm.firstName}
                  onChange={(event) =>
                    updateEditForm("firstName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name">Last name</Label>
                <Input
                  id="edit-last-name"
                  value={editForm.lastName}
                  onChange={(event) =>
                    updateEditForm("lastName", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-first-name-ar">First name (AR)</Label>
                <Input
                  id="edit-first-name-ar"
                  value={editForm.firstNameAr}
                  onChange={(event) =>
                    updateEditForm("firstNameAr", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-last-name-ar">Last name (AR)</Label>
                <Input
                  id="edit-last-name-ar"
                  value={editForm.lastNameAr}
                  onChange={(event) =>
                    updateEditForm("lastNameAr", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-birth-date">Birth date</Label>
                <Input
                  id="edit-birth-date"
                  type="date"
                  value={editForm.birthDate}
                  onChange={(event) =>
                    updateEditForm("birthDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">Gender</Label>
                <Select
                  id="edit-gender"
                  value={editForm.gender}
                  onChange={(event) =>
                    updateEditForm("gender", event.target.value)
                  }
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cin">CIN</Label>
                <Input
                  id="edit-cin"
                  value={editForm.cin}
                  onChange={(event) =>
                    updateEditForm("cin", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-passport">Passport</Label>
                <Input
                  id="edit-passport"
                  value={editForm.passportNumber}
                  onChange={(event) =>
                    updateEditForm("passportNumber", event.target.value)
                  }
                />
              </div>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label htmlFor="edit-club">Club assignment</Label>
                  <Select
                    id="edit-club"
                    value={editForm.clubId}
                    onChange={(event) =>
                      updateEditForm("clubId", event.target.value)
                    }
                  >
                    <option value="">Keep current</option>
                    {clubs.map((clubOption) => (
                      <option key={clubOption._id} value={clubOption._id}>
                        {clubOption.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}

              <div className="col-span-full flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeEditDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editSubmitting}>
                  {editSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {transferDialog.open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Request athlete transfer
              </h2>
              <Button
                variant="ghost"
                type="button"
                onClick={closeTransferDialog}
              >
                Close
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitTransferRequest}>
              <p className="text-sm text-slate-600">
                Athlete: {resolvePersonName(transferDialog.athlete)}
              </p>

              <div className="space-y-2">
                <Label htmlFor="transfer-target-club">Target club</Label>
                <Select
                  id="transfer-target-club"
                  value={transferDialog.targetClubId}
                  onChange={(event) =>
                    setTransferDialog((previous) => ({
                      ...previous,
                      targetClubId: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a club</option>
                  {availableTransferClubs.map((candidate) => (
                    <option key={candidate._id} value={candidate._id}>
                      {candidate.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-note">Notes</Label>
                <textarea
                  id="transfer-note"
                  rows={3}
                  value={transferDialog.note}
                  onChange={(event) =>
                    setTransferDialog((previous) => ({
                      ...previous,
                      note: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeTransferDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={transferDialog.submitting}>
                  {transferDialog.submitting ? "Sending..." : "Submit request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteDialog.open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-10">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Request athlete deletion
              </h2>
              <Button variant="ghost" type="button" onClick={closeDeleteDialog}>
                Close
              </Button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitDeletionRequest}>
              <p className="text-sm text-slate-600">
                Athlete: {resolvePersonName(deleteDialog.athlete)}
              </p>

              <div className="space-y-2">
                <Label htmlFor="delete-reason">Reason (optional)</Label>
                <textarea
                  id="delete-reason"
                  rows={3}
                  value={deleteDialog.reason}
                  onChange={(event) =>
                    setDeleteDialog((previous) => ({
                      ...previous,
                      reason: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeDeleteDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={deleteDialog.submitting}>
                  {deleteDialog.submitting ? "Sending..." : "Submit request"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AthleteDocumentsDialog
        open={documentDialog.open}
        athlete={documentDialog.athlete}
        token={token}
        currentUserRole={user?.role}
        apiBaseUrl={API_BASE_URL}
        onClose={closeDocumentsDialog}
        onUpdated={loadClubDetails}
      />
    </div>
  );
};

export default ClubDetail;
