import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { DataGrid } from "../components/DataGrid";
import { useAuth } from "../contexts/AuthContext";

const initialFormState = {
  name: "",
  nameAr: "",
  code: "",
  type: "club",
  email: "",
  phone: "",
  address: "",
  city: "",
  logoUrl: "",
  contactName: "",
  contactPhone: "",
  isActive: "true",
  parentClubId: "",
};

const PROMOTION_CENTER_TYPE = "centre_de_promotion";

const TYPE_OPTIONS = [
  { value: "club", label: "Club" },
  { value: "country", label: "Country" },
  { value: "centre_de_promotion", label: "Centre de promotion" },
  { value: "ecole_federale", label: "Ecole federale" },
];

const TYPE_LABELS = TYPE_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

const apiBase = "/api/clubs";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const formatDisplayDate = (value) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return dateFormatter.format(date);
};

const getClubInitials = (name, code) => {
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

  if (code) {
    return code.slice(0, 2).toUpperCase();
  }

  return "CL";
};

const ClubLogoPreview = ({ name, code, logoUrl }) => {
  const initials = getClubInitials(name, code);
  const hasLogo = Boolean(logoUrl);

  return (
    <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
      {hasLogo ? (
        <>
          <img
            src={logoUrl}
            alt={`${name || "Club"} logo`}
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              const fallback = event.currentTarget.nextElementSibling;
              if (fallback) {
                fallback.classList.remove("hidden");
              }
            }}
          />
          <span className="hidden text-sm font-semibold text-slate-500">
            {initials}
          </span>
        </>
      ) : (
        <span className="text-sm font-semibold text-slate-500">{initials}</span>
      )}
    </div>
  );
};

const DetailItem = ({ label, children }) => (
  <div className="space-y-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <div className="text-sm text-slate-900">{children ?? "—"}</div>
  </div>
);

const Clubs = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingClubId, setEditingClubId] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState(null);

  const loadClubs = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(apiBase, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load clubs");
      }

      const data = Array.isArray(payload) ? payload : [];

      setClubs(data);
      setStats({
        total: data.length,
        active: data.filter((club) => club.isActive).length,
        inactive: data.filter((club) => !club.isActive).length,
      });

      setSelectedClubId((current) => {
        if (current && data.some((club) => club._id === current)) {
          return current;
        }
        return data[0]?._id ?? null;
      });
    } catch (err) {
      console.error("Failed to load clubs", err);
      const message = err.message || "Failed to load clubs";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  const gridRows = useMemo(
    () =>
      clubs.map((club) => ({
        id: club._id,
        _id: club._id,
        name: club.name,
        nameAr: club.nameAr,
        code: club.code,
        logoUrl: club.logoUrl,
        type: club.type,
        typeLabel: TYPE_LABELS[club.type] || club.type,
        email: club.email,
        phone: club.phone,
        city: club.city,
        address: club.address,
        isActive: Boolean(club.isActive),
        statusLabel: club.isActive ? "Active" : "Inactive",
        contacts: club.contacts || {},
        seasonActivation: club.seasonActivation,
        parentClub: club.parentClub ?? null,
        raw: club,
      })),
    [clubs]
  );

  const baseClubOptions = useMemo(
    () => clubs.filter((club) => club.type === "club"),
    [clubs]
  );

  const parentClubChoices = useMemo(() => {
    if (!editingClubId) {
      return baseClubOptions;
    }

    return baseClubOptions.filter((club) => club._id !== editingClubId);
  }, [baseClubOptions, editingClubId]);

  const typeStats = useMemo(() => {
    const baseline = TYPE_OPTIONS.reduce((accumulator, option) => {
      accumulator[option.value] = {
        type: option.value,
        label: option.label,
        total: 0,
        active: 0,
        inactive: 0,
      };
      return accumulator;
    }, {});

    clubs.forEach((club) => {
      if (!baseline[club.type]) {
        baseline[club.type] = {
          type: club.type,
          label: TYPE_LABELS[club.type] || club.type.replace(/_/g, " "),
          total: 0,
          active: 0,
          inactive: 0,
        };
      }

      const bucket = baseline[club.type];
      bucket.total += 1;
      if (club.isActive) {
        bucket.active += 1;
      } else {
        bucket.inactive += 1;
      }
    });

    return Object.values(baseline);
  }, [clubs]);

  const promotionCenterSummary = useMemo(() => {
    const entries = clubs.filter((club) => club.type === PROMOTION_CENTER_TYPE);

    const withParent = entries.filter((club) =>
      Boolean(club.parentClub)
    ).length;

    return {
      total: entries.length,
      withParent,
      withoutParent: entries.length - withParent,
    };
  }, [clubs]);

  const overallActiveRate = useMemo(() => {
    if (!stats.total) {
      return 0;
    }

    return Math.round((stats.active / stats.total) * 100);
  }, [stats.active, stats.total]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRows = useMemo(
    () =>
      gridRows.filter((row) => {
        if (statusFilter !== "all") {
          const wantsActive = statusFilter === "active";
          if (row.isActive !== wantsActive) {
            return false;
          }
        }

        if (typeFilter !== "all" && row.type !== typeFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystacks = [
          row.name,
          row.nameAr,
          row.code,
          row.email,
          row.phone,
          row.city,
          row.contacts?.primaryName,
          row.contacts?.primaryPhone,
        ];

        return haystacks.some((value) =>
          value
            ? value.toString().toLowerCase().includes(normalizedSearch)
            : false
        );
      }),
    [gridRows, normalizedSearch, statusFilter, typeFilter]
  );

  useEffect(() => {
    if (
      selectedClubId &&
      !filteredRows.some((row) => row.id === selectedClubId)
    ) {
      setSelectedClubId(null);
    }
  }, [filteredRows, selectedClubId]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club._id === selectedClubId) ?? null,
    [clubs, selectedClubId]
  );

  const hasActiveFilters = useMemo(
    () =>
      statusFilter !== "all" ||
      typeFilter !== "all" ||
      normalizedSearch.length > 0,
    [normalizedSearch, statusFilter, typeFilter]
  );

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((previous) => {
      const nextState = {
        ...previous,
        [name]: value,
      };

      if (name === "type" && value !== PROMOTION_CENTER_TYPE) {
        nextState.parentClubId = "";
      }

      return nextState;
    });
  }, []);

  const closeForm = useCallback(() => {
    setIsFormOpen(false);
    setIsEditMode(false);
    setEditingClubId(null);
    setFormData(initialFormState);
  }, []);

  const openCreateForm = useCallback(() => {
    setFormData(initialFormState);
    setIsFormOpen(true);
    setIsEditMode(false);
    setEditingClubId(null);
  }, []);

  const openEditForm = useCallback(
    (id) => {
      const club = clubs.find((item) => item._id === id);

      if (!club) {
        toast.error("Club not found");
        return;
      }

      const parentClubIdValue = (() => {
        if (!club.parentClub) {
          return "";
        }

        if (typeof club.parentClub === "string") {
          return club.parentClub;
        }

        return club.parentClub._id ?? "";
      })();

      setFormData({
        name: club.name ?? "",
        nameAr: club.nameAr ?? "",
        code: club.code ?? "",
        type: club.type ?? "club",
        email: club.email ?? "",
        phone: club.phone ?? "",
        address: club.address ?? "",
        city: club.city ?? "",
        logoUrl: club.logoUrl ?? "",
        contactName: club.contacts?.primaryName ?? "",
        contactPhone: club.contacts?.primaryPhone ?? "",
        isActive: club.isActive ? "true" : "false",
        parentClubId: parentClubIdValue,
      });

      setEditingClubId(id);
      setIsEditMode(true);
      setIsFormOpen(true);
    },
    [clubs]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const trimmedName = formData.name.trim();
      const trimmedEmail = formData.email.trim();

      if (!trimmedName || !trimmedEmail) {
        toast.error("Name and email are required.");
        return;
      }

      setSubmitting(true);

      try {
        const basePayload = {
          name: trimmedName,
          nameAr: formData.nameAr.trim() || undefined,
          code: formData.code.trim() || undefined,
          type: formData.type,
          email: trimmedEmail,
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          city: formData.city.trim() || undefined,
          logoUrl: formData.logoUrl.trim() || undefined,
        };

        const contactPayload = {
          firstName: formData.contactName.trim() || undefined,
          phone: formData.contactPhone.trim() || undefined,
        };

        const filteredContact = Object.fromEntries(
          Object.entries(contactPayload).filter(
            ([, value]) => value !== undefined
          )
        );

        if (Object.keys(filteredContact).length > 0) {
          basePayload.contact = filteredContact;
        }

        if (formData.type === PROMOTION_CENTER_TYPE) {
          const trimmedParentId = formData.parentClubId.trim();

          if (!trimmedParentId) {
            toast.error(
              "Please select a parent club for the promotion center."
            );
            return;
          }

          basePayload.parentClubId = trimmedParentId;
        } else if (isEditMode) {
          basePayload.parentClubId = "";
        }

        let endpoint = apiBase;
        let method = "POST";

        if (isEditMode && editingClubId) {
          endpoint = `${apiBase}/${editingClubId}`;
          method = "PUT";
          basePayload.isActive = formData.isActive === "true";
        }

        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(basePayload),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to save club");
        }

        toast.success(
          isEditMode ? "Club updated successfully" : "Club created successfully"
        );

        closeForm();
        await loadClubs();
      } catch (err) {
        console.error("Failed to submit club form", err);
        const message = err.message || "Failed to save club";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [closeForm, editingClubId, formData, isEditMode, loadClubs, token]
  );

  const handleStatusToggle = useCallback(
    async (id) => {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const target = clubs.find((club) => club._id === id);

      if (!target) {
        toast.error("Club not found");
        return;
      }

      try {
        const response = await fetch(`${apiBase}/${id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: !target.isActive }),
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to update status");
        }

        toast.success(!target.isActive ? "Club activated" : "Club deactivated");
        await loadClubs();
      } catch (err) {
        console.error("Failed to update club status", err);
        const message = err.message || "Failed to update status";
        toast.error(message);
      }
    },
    [clubs, loadClubs, token]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const target = clubs.find((club) => club._id === id);

      if (!target) {
        toast.error("Club not found");
        return;
      }

      const confirmed = window.confirm(
        `Delete ${target.name}? This action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(`${apiBase}/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to delete club");
        }

        toast.success("Club deleted successfully");
        await loadClubs();
      } catch (err) {
        console.error("Failed to delete club", err);
        const message = err.message || "Failed to delete club";
        toast.error(message);
      }
    },
    [clubs, loadClubs, token]
  );

  const handleResetPassword = useCallback(
    async (id) => {
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const target = clubs.find((club) => club._id === id);
      if (!target) {
        toast.error("Club not found");
        return;
      }

      const newPassword = window.prompt(
        `Enter new temporary password for ${target.name}:`
      );

      if (!newPassword) return;

      if (newPassword.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }

      try {
        const response = await fetch(
          `/api/users/${id}/reset-password`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ newPassword }),
          }
        );

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.message || "Failed to reset password");
        }

        toast.success("Password reset successfully");
      } catch (err) {
        console.error("Failed to reset password", err);
        toast.error(err.message);
      }
    },
    [clubs, token]
  );

  const handleRowSelected = useCallback((row) => {
    if (row) {
      setSelectedClubId(row.id || row._id || null);
    } else {
      setSelectedClubId(null);
    }
  }, []);

  const handleRowDeselected = useCallback(() => {
    setSelectedClubId(null);
  }, []);

  const renderLogoCell = useCallback(
    (props) => (
      <div className="flex justify-center">
        <ClubLogoPreview
          name={props.name}
          code={props.code}
          logoUrl={props.logoUrl}
        />
      </div>
    ),
    []
  );

  const renderNameCell = useCallback(
    (props) => (
      <div className="space-y-1">
        <p className="font-semibold text-slate-900">{props.name}</p>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {props.code ? <span>{props.code}</span> : null}
          {props.email ? (
            <a
              href={`mailto:${props.email}`}
              className="text-blue-600 hover:underline"
            >
              {props.email}
            </a>
          ) : null}
        </div>
        {props.nameAr ? (
          <p className="text-xs text-slate-400">{props.nameAr}</p>
        ) : null}
      </div>
    ),
    []
  );

  const renderStatusBadge = useCallback((props) => {
    const baseClasses =
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold";
    const palette = props.isActive
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-100 text-slate-600";

    return (
      <span className={`${baseClasses} ${palette}`}>{props.statusLabel}</span>
    );
  }, []);

  const renderActionsCell = useCallback(
    (props) => (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="px-3 py-1 text-xs"
          onClick={() => navigate(`/clubs/${props.id}`)}
        >
          View
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3 py-1 text-xs"
          onClick={() => openEditForm(props.id)}
        >
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3 py-1 text-xs"
          onClick={() => handleStatusToggle(props.id)}
        >
          {props.isActive ? "Deactivate" : "Activate"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="px-3 py-1 text-xs"
          onClick={() => handleResetPassword(props.id)}
        >
          Reset Pwd
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="px-3 py-1 text-xs"
          onClick={() => handleDelete(props.id)}
        >
          Delete
        </Button>
      </div>
    ),
    [
      handleDelete,
      handleResetPassword,
      handleStatusToggle,
      navigate,
      openEditForm,
    ]
  );

  const columns = useMemo(
    () => [
      {
        field: "logoUrl",
        headerText: "Logo",
        width: "96",
        template: renderLogoCell,
        allowFiltering: false,
        allowSorting: false,
        textAlign: "Center",
      },
      {
        field: "name",
        headerText: "Club",
        width: "240",
        template: renderNameCell,
      },
      {
        field: "typeLabel",
        headerText: "Type",
        width: "110",
      },
      {
        field: "statusLabel",
        headerText: "Status",
        width: "130",
        template: renderStatusBadge,
      },
      {
        field: "actions",
        headerText: "Actions",
        width: "320",
        template: renderActionsCell,
      },
    ],
    [renderActionsCell, renderLogoCell, renderNameCell, renderStatusBadge]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] space-y-8 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Club Directory</h1>
            <p className="text-sm text-gray-500">
              Manage clubs and federations, invite new managers, and track
              status in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={loadClubs}>
              Refresh
            </Button>
            <Button onClick={openCreateForm}>Add Club</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Total Organizations
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {stats.total}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Includes clubs, countries, promotion centers, and federal schools.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-emerald-700">Active</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">
              {stats.active}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Organizations currently active in the system.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-600">Inactive</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {stats.inactive}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Organizations temporarily offline or archived.
            </p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-blue-700">Active Rate</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-blue-900">
                {overallActiveRate}%
              </span>
              <span className="text-xs text-blue-700">
                of all organizations
              </span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${overallActiveRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Club Analytics
              </h2>
              <p className="text-sm text-slate-500">
                Breakdown by organization type with active status insights.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
              Promotion centers linked to a parent club:{" "}
              {promotionCenterSummary.withParent}/{promotionCenterSummary.total}
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {typeStats.map((item) => {
              const activePercent = item.total
                ? Math.round((item.active / item.total) * 100)
                : 0;

              return (
                <div
                  key={item.type}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">
                      {item.total}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        Active {item.active}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
                        Inactive {item.inactive}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Active rate</span>
                      <span>{activePercent}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${activePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {promotionCenterSummary.withoutParent > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {promotionCenterSummary.withoutParent} promotion center(s) do not
              have a parent club assigned yet.
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label
                htmlFor="club-search"
                className="text-xs uppercase tracking-wide text-gray-500"
              >
                Search
              </Label>
              <Input
                id="club-search"
                placeholder="Search by name, code, city, or contact"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label
                htmlFor="status-filter"
                className="text-xs uppercase tracking-wide text-gray-500"
              >
                Status
              </Label>
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div>
              <Label
                htmlFor="type-filter"
                className="text-xs uppercase tracking-wide text-gray-500"
              >
                Type
              </Label>
              <Select
                id="type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="mt-1"
              >
                <option value="all">All types</option>
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {hasActiveFilters ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="text-sm text-gray-600"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            Error: {error}
          </div>
        ) : null}

        {isFormOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isEditMode ? "Edit Club" : "Create Club"}
                </h2>
                <button
                  type="button"
                  onClick={closeForm}
                  className="text-2xl leading-none text-gray-400 transition hover:text-gray-600"
                  aria-label="Close form"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nameAr">Name (Arabic)</Label>
                    <Input
                      id="nameAr"
                      name="nameAr"
                      value={formData.nameAr}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="code">Code (Short Name)</Label>
                    <Input
                      id="code"
                      name="code"
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder="e.g. CNMT"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      required
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {formData.type === PROMOTION_CENTER_TYPE ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="parentClubId">Parent club *</Label>
                      <Select
                        id="parentClubId"
                        name="parentClubId"
                        value={formData.parentClubId}
                        onChange={handleInputChange}
                        required
                        disabled={parentClubChoices.length === 0}
                      >
                        <option value="">Select a parent club</option>
                        {parentClubChoices.map((club) => (
                          <option key={club._id} value={club._id}>
                            {club.name}
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-slate-500">
                        Promotion centers must belong to an existing club.
                      </p>
                      {parentClubChoices.length === 0 ? (
                        <p className="text-xs text-amber-600">
                          Create a base club first, then assign it as the
                          parent.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      name="logoUrl"
                      value={formData.logoUrl}
                      onChange={handleInputChange}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactName">Primary Contact</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      value={formData.contactName}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      name="contactPhone"
                      value={formData.contactPhone}
                      onChange={handleInputChange}
                    />
                  </div>

                  {isEditMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="isActive">Status</Label>
                      <Select
                        id="isActive"
                        name="isActive"
                        value={formData.isActive}
                        onChange={handleInputChange}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={closeForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting
                      ? "Saving..."
                      : isEditMode
                      ? "Update Club"
                      : "Create Club"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <DataGrid
              data={filteredRows}
              columns={columns}
              gridId="clubs-grid"
              loading={loading}
              emptyMessage={
                hasActiveFilters
                  ? "No clubs match your filters"
                  : "No clubs found"
              }
              onRowSelected={handleRowSelected}
              onRowDeselected={handleRowDeselected}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {selectedClub ? (
              (() => {
                const contactName =
                  selectedClub.contacts?.primaryName || "Not specified";
                const contactPhone = selectedClub.contacts?.primaryPhone || "—";
                const statusClasses = selectedClub.isActive
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200";
                const typeLabel =
                  TYPE_LABELS[selectedClub.type] || selectedClub.type;

                const parentClubDisplay = (() => {
                  if (!selectedClub.parentClub) {
                    return null;
                  }

                  if (typeof selectedClub.parentClub === "string") {
                    const referencedClub = clubs.find(
                      (club) => club._id === selectedClub.parentClub
                    );
                    return (
                      referencedClub?.name ||
                      referencedClub?.code ||
                      selectedClub.parentClub
                    );
                  }

                  return (
                    selectedClub.parentClub.name ||
                    selectedClub.parentClub.code ||
                    null
                  );
                })();

                const activation = selectedClub.seasonActivation;
                let seasonContent = null;

                if (activation) {
                  const formattedFrom = formatDisplayDate(activation.from);
                  const formattedTo = formatDisplayDate(activation.to);

                  if (!(formattedFrom === "—" && formattedTo === "—")) {
                    let rangeText = "";

                    if (formattedFrom !== "—" && formattedTo !== "—") {
                      rangeText = `${formattedFrom} – ${formattedTo}`;
                    } else if (formattedFrom !== "—") {
                      rangeText = `From ${formattedFrom}`;
                    } else {
                      rangeText = `Until ${formattedTo}`;
                    }

                    seasonContent = (
                      <div className="rounded-lg bg-slate-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-slate-500">
                          Season Activation
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {rangeText}
                        </p>
                      </div>
                    );
                  }
                }

                return (
                  <div className="flex h-full flex-col gap-6">
                    <div className="flex flex-wrap items-start gap-4">
                      <ClubLogoPreview
                        name={selectedClub.name}
                        code={selectedClub.code}
                        logoUrl={selectedClub.logoUrl}
                      />
                      <div className="space-y-2">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900">
                            {selectedClub.name}
                          </h2>
                          {selectedClub.nameAr ? (
                            <p className="text-sm text-slate-500">
                              {selectedClub.nameAr}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                            {typeLabel}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}`}
                          >
                            {selectedClub.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <DetailItem label="Club Code">
                        {selectedClub.code || "—"}
                      </DetailItem>
                      <DetailItem label="Email">
                        {selectedClub.email ? (
                          <a
                            href={`mailto:${selectedClub.email}`}
                            className="text-blue-600 hover:underline"
                          >
                            {selectedClub.email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </DetailItem>
                      <DetailItem label="Phone">
                        {selectedClub.phone || "—"}
                      </DetailItem>
                      <DetailItem label="City">
                        {selectedClub.city || "—"}
                      </DetailItem>
                      <DetailItem label="Address">
                        <span className="block break-words">
                          {selectedClub.address || "—"}
                        </span>
                      </DetailItem>
                      <DetailItem label="Parent Club">
                        {parentClubDisplay || "—"}
                      </DetailItem>
                      <DetailItem label="Primary Contact">
                        {contactName}
                      </DetailItem>
                      <DetailItem label="Contact Phone">
                        {contactPhone}
                      </DetailItem>
                    </div>

                    {seasonContent}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/clubs/${selectedClub._id}`)}
                      >
                        View Club
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditForm(selectedClub._id)}
                      >
                        Edit Club
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusToggle(selectedClub._id)}
                      >
                        {selectedClub.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(selectedClub._id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                Select a club in the table to preview its details here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Clubs;
