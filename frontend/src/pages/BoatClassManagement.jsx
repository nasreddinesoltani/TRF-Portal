import React, { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { toast } from "react-toastify";

import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { DataGrid } from "../components/DataGrid";

const API_BASE_URL = "";

const DISCIPLINE_OPTIONS = [
  { value: "all", label: "All disciplines" },
  { value: "classic", label: "Classic / flatwater" },
  { value: "coastal", label: "Coastal" },
  { value: "beach", label: "Beach sprint" },
  { value: "indoor", label: "Indoor" },
];

const WEIGHT_CLASS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "lightweight", label: "Lightweight" },
  { value: "para", label: "Para" },
];

const GENDER_OPTIONS = [
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "mixed", label: "Mixed" },
];

const STATUS_BADGE = {
  true: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  false: "bg-slate-100 text-slate-600 border border-slate-200",
};

const DEFAULT_FORM_STATE = {
  code: "",
  discipline: "classic",
  nameEn: "",
  nameFr: "",
  nameAr: "",
  description: "",
  crewSize: "1",
  weightClass: "open",
  coxswain: false,
  sculling: true,
  relay: false,
  runSegment: false,
  allowedGenders: ["men", "women", "mixed"],
  sortOrder: "0",
  isActive: true,
};

const createDefaultFormState = (overrides = {}) => ({
  ...DEFAULT_FORM_STATE,
  allowedGenders: [...DEFAULT_FORM_STATE.allowedGenders],
  ...overrides,
});

const BoatClassManagement = () => {
  const { token, user } = useAuth();

  const [boatClasses, setBoatClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [formState, setFormState] = useState(createDefaultFormState());
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  const canManage = ["admin", "jury_president"].includes(user?.role);

  const loadBoatClasses = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams();
      if (disciplineFilter !== "all") {
        params.set("discipline", disciplineFilter);
      }
      if (includeInactive) {
        params.set("includeInactive", "true");
      }
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const response = await fetch(
        `${API_BASE_URL}/api/boat-classes?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load boat classes");
      }

      setBoatClasses(Array.isArray(payload) ? payload : []);
    } catch (error) {
      console.error("Failed to load boat classes", error);
      setErrorMessage(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [disciplineFilter, includeInactive, searchTerm, token]);

  useEffect(() => {
    loadBoatClasses();
  }, [loadBoatClasses, refreshKey]);

  const filteredBoatClasses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return boatClasses;
    }
    return boatClasses.filter((item) => {
      const targets = [
        item.code,
        item?.names?.en,
        item?.names?.fr,
        item?.names?.ar,
        item?.description,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());
      return targets.some((value) => value.includes(term));
    });
  }, [boatClasses, searchTerm]);

  const summary = useMemo(() => {
    const total = filteredBoatClasses.length;
    const byDiscipline = filteredBoatClasses.reduce(
      (accumulator, item) => {
        const key = item.discipline || "unknown";
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      },
      { classic: 0, coastal: 0, beach: 0, indoor: 0, unknown: 0 }
    );
    const active = filteredBoatClasses.filter((item) => item.isActive).length;
    return { total, byDiscipline, active };
  }, [filteredBoatClasses]);

  const resetDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogMode("create");
    setFormState(createDefaultFormState());
    setDialogSubmitting(false);
    setEditingId(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setFormState(
      createDefaultFormState({
        discipline: disciplineFilter === "all" ? "classic" : disciplineFilter,
      })
    );
    setEditingId(null);
    setDialogOpen(true);
  }, [disciplineFilter]);

  const normaliseAllowedGenders = (values) => {
    const list = Array.isArray(values) ? values : [values];
    return GENDER_OPTIONS.map((option) => option.value).filter((gender) =>
      list.includes(gender)
    );
  };

  const openEditDialog = useCallback((boatClass) => {
    if (!boatClass) {
      return;
    }
    setDialogMode("edit");
    setEditingId(boatClass._id);
    setFormState({
      code: boatClass.code || "",
      discipline: boatClass.discipline || "classic",
      nameEn: boatClass.names?.en || "",
      nameFr: boatClass.names?.fr || "",
      nameAr: boatClass.names?.ar || "",
      description: boatClass.description || "",
      crewSize: boatClass.crewSize?.toString() || "1",
      weightClass: boatClass.weightClass || "open",
      coxswain: Boolean(boatClass.coxswain),
      sculling: Boolean(boatClass.sculling),
      relay: Boolean(boatClass.relay),
      runSegment: Boolean(boatClass.runSegment),
      allowedGenders: normaliseAllowedGenders(boatClass.allowedGenders || []),
      sortOrder: boatClass.sortOrder?.toString() ?? "0",
      isActive: Boolean(boatClass.isActive),
    });
    setDialogOpen(true);
  }, []);

  const handleInputChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleGenderToggle = useCallback((gender) => {
    setFormState((previous) => {
      const current = new Set(previous.allowedGenders);
      if (current.has(gender)) {
        current.delete(gender);
      } else {
        current.add(gender);
      }
      const next = Array.from(current);
      return {
        ...previous,
        allowedGenders: next.length ? next : [gender],
      };
    });
  }, []);

  const submitBoatClass = async (method, endpoint) => {
    const payload = {
      code: formState.code.trim(),
      discipline: formState.discipline,
      names: {
        en: formState.nameEn.trim(),
        fr: formState.nameFr.trim(),
        ar: formState.nameAr.trim(),
      },
      description: formState.description.trim() || undefined,
      crewSize: Number(formState.crewSize),
      weightClass: formState.weightClass,
      coxswain: Boolean(formState.coxswain),
      sculling: Boolean(formState.sculling),
      relay: Boolean(formState.relay),
      runSegment: Boolean(formState.runSegment),
      allowedGenders: formState.allowedGenders,
      sortOrder: Number(formState.sortOrder || 0),
      isActive: Boolean(formState.isActive),
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
      throw new Error(data.message || "Failed to save boat class");
    }

    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManage) {
      toast.error("You do not have permission to modify boat classes");
      return;
    }

    if (!formState.code.trim()) {
      toast.error("Code is required");
      return;
    }

    if (
      !formState.nameEn.trim() ||
      !formState.nameFr.trim() ||
      !formState.nameAr.trim()
    ) {
      toast.error("All language names are required");
      return;
    }

    setDialogSubmitting(true);

    try {
      if (dialogMode === "create") {
        await submitBoatClass("POST", `${API_BASE_URL}/api/boat-classes`);
        toast.success("Boat class created");
      } else if (editingId) {
        await submitBoatClass(
          "PUT",
          `${API_BASE_URL}/api/boat-classes/${editingId}`
        );
        toast.success("Boat class updated");
      }
      resetDialog();
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      console.error("Failed to save boat class", error);
      toast.error(error.message);
      setDialogSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (boatClass) => {
      if (!canManage || !boatClass) {
        return;
      }
      const confirmed = window.confirm(
        `Delete boat class ${boatClass.code}? This cannot be undone.`
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boat-classes/${boatClass._id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to delete boat class");
        }
        toast.success("Boat class deleted");
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to delete boat class", error);
        toast.error(error.message);
      }
    },
    [canManage, token]
  );

  const toggleActive = useCallback(
    async (boatClass) => {
      if (!canManage || !boatClass) {
        return;
      }
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/boat-classes/${boatClass._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isActive: !boatClass.isActive }),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || "Failed to update status");
        }
        toast.success(
          `Boat class ${!boatClass.isActive ? "activated" : "deactivated"}`
        );
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to toggle boat class", error);
        toast.error(error.message);
      }
    },
    [canManage, token]
  );

  const handleBootstrap = async () => {
    if (!canManage) {
      toast.error("You do not have permission to sync boat classes");
      return;
    }

    try {
      setBootstrapping(true);
      const response = await fetch(
        `${API_BASE_URL}/api/boat-classes/bootstrap`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Failed to sync default boat classes");
      }
      toast.success(data.message || "Boat classes synchronised");
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      console.error("Failed to bootstrap boat classes", error);
      toast.error(error.message);
    } finally {
      setBootstrapping(false);
    }
  };

  const renderStatusBadge = useCallback((item) => {
    if (!item) {
      return null;
    }
    const label = item.isActive ? "Active" : "Inactive";
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
          STATUS_BADGE[item.isActive ? true : false]
        )}
      >
        {label}
      </span>
    );
  }, []);

  const renderClassCell = useCallback((item) => {
    if (!item) {
      return null;
    }
    const disciplineLabel =
      DISCIPLINE_OPTIONS.find((option) => option.value === item.discipline)
        ?.label || item.discipline;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold uppercase tracking-wide text-slate-900">
          {item.code}
        </span>
        <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {disciplineLabel}
        </span>
      </div>
    );
  }, []);

  const renderNamesCell = useCallback((item) => {
    if (!item) {
      return null;
    }
    return (
      <div className="flex flex-col text-sm">
        <span className="font-medium text-slate-900">
          {item.names?.en || "—"}
        </span>
        <span className="text-xs text-slate-600">{item.names?.fr || "—"}</span>
        <span className="text-xs text-slate-600">{item.names?.ar || "—"}</span>
      </div>
    );
  }, []);

  const renderAttributesCell = useCallback((item) => {
    if (!item) {
      return null;
    }
    const tags = [];
    if (item.sculling) tags.push("Sculling");
    if (item.coxswain) tags.push("Coxed");
    if (item.relay) tags.push("Relay");
    if (item.runSegment) tags.push("Run segment");
    return (
      <div className="flex flex-col gap-1 text-xs text-slate-600">
        <span className="text-sm text-slate-700">{`Crew size ${item.crewSize}`}</span>
        <span className="capitalize">{`Weight class • ${item.weightClass}`}</span>
        {tags.length ? (
          <span className="text-xs text-slate-500">{tags.join(" • ")}</span>
        ) : null}
        {item.description ? (
          <span className="text-xs text-slate-500">
            {item.description.length > 80
              ? `${item.description.slice(0, 77)}...`
              : item.description}
          </span>
        ) : null}
      </div>
    );
  }, []);

  const renderGendersCell = useCallback((item) => {
    if (!item) {
      return null;
    }
    const genders = item.allowedGenders || [];
    return (
      <div className="flex flex-wrap gap-1">
        {GENDER_OPTIONS.filter((option) => genders.includes(option.value)).map(
          (option) => (
            <span
              key={option.value}
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {option.label}
            </span>
          )
        )}
      </div>
    );
  }, []);

  const renderActionsCell = useCallback(
    (item) => {
      if (!item || !canManage) {
        return null;
      }
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            onClick={() => openEditDialog(item)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => toggleActive(item)}
          >
            {item.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleDelete(item)}
          >
            Delete
          </Button>
        </div>
      );
    },
    [canManage, handleDelete, openEditDialog, toggleActive]
  );

  const columns = useMemo(
    () => [
      {
        headerText: "Class",
        width: 160,
        template: renderClassCell,
      },
      {
        headerText: "Names",
        width: 260,
        template: renderNamesCell,
      },
      {
        headerText: "Attributes",
        width: 260,
        template: renderAttributesCell,
      },
      {
        headerText: "Allowed genders",
        width: 200,
        template: renderGendersCell,
      },
      {
        headerText: "Status",
        width: 140,
        template: renderStatusBadge,
      },
      {
        headerText: "Actions",
        width: 260,
        template: renderActionsCell,
      },
    ],
    [
      renderActionsCell,
      renderAttributesCell,
      renderClassCell,
      renderGendersCell,
      renderNamesCell,
      renderStatusBadge,
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
            Boat classes
          </h1>
          <p className="text-sm text-slate-500">
            Define the boat categories available for competitions across all
            disciplines.
          </p>
          {errorMessage ? (
            <p className="text-xs text-rose-500">{errorMessage}</p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBootstrap}
              disabled={bootstrapping}
            >
              {bootstrapping ? "Syncing defaults..." : "Sync defaults"}
            </Button>
            <Button type="button" onClick={openCreateDialog}>
              New boat class
            </Button>
          </div>
        ) : null}
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
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
            <Label htmlFor="searchTerm">Search</Label>
            <Input
              id="searchTerm"
              placeholder="Code or name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="includeInactive">Visibility</Label>
            <Select
              id="includeInactive"
              value={includeInactive ? "include" : "active"}
              onChange={(event) =>
                setIncludeInactive(event.target.value === "include")
              }
            >
              <option value="active">Active only</option>
              <option value="include">Include inactive</option>
            </Select>
          </div>
          <div className="space-y-2 hidden xl:block">
            <Label className="text-transparent">Placeholder</Label>
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
              Use filters to narrow the library.
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">
              {summary.total}
            </span>{" "}
            classes • Active {summary.active}
          </p>
          <p className="mt-1">
            Classic {summary.byDiscipline.classic}, Coastal{" "}
            {summary.byDiscipline.coastal}, Beach {summary.byDiscipline.beach},
            Indoor {summary.byDiscipline.indoor}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Boat class library
            </h2>
            <p className="text-sm text-slate-500">
              Manage the standard boat definitions used across competitions.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {loading
              ? "Loading boat classes..."
              : `${filteredBoatClasses.length} item${
                  filteredBoatClasses.length === 1 ? "" : "s"
                }`}
          </span>
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <DataGrid
            data={filteredBoatClasses}
            columns={columns}
            loading={loading}
            gridId="boat-class-management-grid"
            emptyMessage={
              searchTerm
                ? "No boat classes match the current search."
                : "No boat classes found."
            }
          />
        </div>
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {dialogMode === "create"
                    ? "Create boat class"
                    : "Edit boat class"}
                </h2>
                <p className="text-sm text-slate-500">
                  Provide localized names, crew configuration, and competition
                  attributes.
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
              className="max-h-[70vh] overflow-y-auto px-6 py-6"
              onSubmit={handleSubmit}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formCode">Code</Label>
                  <Input
                    id="formCode"
                    name="code"
                    value={formState.code}
                    onChange={handleInputChange}
                    placeholder="e.g. 1X"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formDiscipline">Discipline</Label>
                  <Select
                    id="formDiscipline"
                    name="discipline"
                    value={formState.discipline}
                    onChange={handleInputChange}
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
                  <Label htmlFor="formNameEn">English name</Label>
                  <Input
                    id="formNameEn"
                    name="nameEn"
                    value={formState.nameEn}
                    onChange={handleInputChange}
                    required
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formCrewSize">Crew size</Label>
                  <Input
                    id="formCrewSize"
                    name="crewSize"
                    type="number"
                    min="1"
                    max="12"
                    value={formState.crewSize}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formWeightClass">Weight class</Label>
                  <Select
                    id="formWeightClass"
                    name="weightClass"
                    value={formState.weightClass}
                    onChange={handleInputChange}
                  >
                    {WEIGHT_CLASS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formSortOrder">Sort order</Label>
                  <Input
                    id="formSortOrder"
                    name="sortOrder"
                    type="number"
                    value={formState.sortOrder}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="formDescription">Description</Label>
                  <textarea
                    id="formDescription"
                    name="description"
                    value={formState.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    placeholder="Optional notes about this boat class"
                  />
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <legend className="text-sm font-semibold text-slate-700">
                    Attributes
                  </legend>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="sculling"
                      checked={formState.sculling}
                      onChange={handleInputChange}
                    />
                    Sculling
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="coxswain"
                      checked={formState.coxswain}
                      onChange={handleInputChange}
                    />
                    Coxed
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="relay"
                      checked={formState.relay}
                      onChange={handleInputChange}
                    />
                    Relay
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="runSegment"
                      checked={formState.runSegment}
                      onChange={handleInputChange}
                    />
                    Run segment / beach sprint
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formState.isActive}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                </fieldset>

                <fieldset className="space-y-2 rounded-xl border border-slate-200 p-4">
                  <legend className="text-sm font-semibold text-slate-700">
                    Allowed genders
                  </legend>
                  {GENDER_OPTIONS.map((gender) => (
                    <label
                      key={gender.value}
                      className="flex items-center gap-2 text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={formState.allowedGenders.includes(
                          gender.value
                        )}
                        onChange={() => handleGenderToggle(gender.value)}
                      />
                      {gender.label}
                    </label>
                  ))}
                </fieldset>
              </div>

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
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default BoatClassManagement;
