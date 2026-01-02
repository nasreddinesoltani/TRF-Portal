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

const CATEGORY_TYPE_OPTIONS = [
  { value: "national", label: "National" },
  { value: "international", label: "International" },
];

const CATEGORY_GENDER_OPTIONS = [
  { value: "all", label: "Any gender" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "mixed", label: "Mixed" },
];

const STATUS_BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border border-slate-200",
};

const DEFAULT_FORM = {
  type: "national",
  abbreviation: "",
  gender: "",
  minAge: "",
  maxAge: "",
  titleEn: "",
  titleFr: "",
  titleAr: "",
  isActive: true,
};

const CategoryManagement = () => {
  const { token } = useAuth();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [typeFilter, setTypeFilter] = useState("national");
  const [genderFilter, setGenderFilter] = useState("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  const [recalculateSeason, setRecalculateSeason] = useState(() =>
    new Date().getFullYear().toString()
  );
  const [recalculateSubmitting, setRecalculateSubmitting] = useState(false);

  const loadCategories = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams();
      params.set("type", typeFilter);
      if (includeInactive) {
        params.set("includeInactive", "true");
      }
      if (genderFilter !== "all") {
        params.set("gender", genderFilter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/categories?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "Failed to load categories");
      }

      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load categories", error);
      setFetchError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [genderFilter, includeInactive, token, typeFilter]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories, refreshKey]);

  const filteredCategories = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return categories;
    }

    return categories.filter((category) => {
      const targets = [
        category.abbreviation,
        category.titles?.en,
        category.titles?.fr,
        category.titles?.ar,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return targets.some((value) => value.includes(term));
    });
  }, [categories, searchTerm]);

  const categorySummary = useMemo(() => {
    const total = filteredCategories.length;
    const active = filteredCategories.filter((item) => item.isActive).length;
    const inactive = total - active;
    const byGender = filteredCategories.reduce(
      (accumulator, category) => {
        if (category.gender === "men") {
          accumulator.men += 1;
        } else if (category.gender === "women") {
          accumulator.women += 1;
        } else {
          accumulator.mixed += 1;
        }
        return accumulator;
      },
      { men: 0, women: 0, mixed: 0 }
    );

    return {
      total,
      active,
      inactive,
      byGender,
    };
  }, [filteredCategories]);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setFormState({ ...DEFAULT_FORM, type: typeFilter });
    setEditingCategoryId(null);
    setDialogOpen(true);
  }, [typeFilter]);

  const openEditDialog = useCallback((category) => {
    if (!category) {
      return;
    }

    setDialogMode("edit");
    setEditingCategoryId(category._id);
    setFormState({
      type: category.type || "national",
      abbreviation: category.abbreviation || "",
      gender: category.gender || "mixed",
      minAge:
        category.minAge === null || category.minAge === undefined
          ? ""
          : String(category.minAge),
      maxAge:
        category.maxAge === null || category.maxAge === undefined
          ? ""
          : String(category.maxAge),
      titleEn: category.titles?.en || "",
      titleFr: category.titles?.fr || "",
      titleAr: category.titles?.ar || "",
      isActive: Boolean(category.isActive),
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogSubmitting(false);
    setEditingCategoryId(null);
  }, []);

  const handleFormChange = useCallback((event) => {
    const { name, value, type: inputType, checked } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: inputType === "checkbox" ? checked : value,
    }));
  }, []);

  const parseAgeValue = (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  };

  const submitCreateCategory = async () => {
    const payload = {
      type: formState.type,
      abbreviation: formState.abbreviation.trim(),
      gender: formState.gender || "mixed",
      minAge: parseAgeValue(formState.minAge),
      maxAge: parseAgeValue(formState.maxAge),
      titles: {
        en: formState.titleEn.trim() || undefined,
        fr: formState.titleFr.trim() || undefined,
        ar: formState.titleAr.trim() || undefined,
      },
      isActive: Boolean(formState.isActive),
    };

    const response = await fetch(`${API_BASE_URL}/api/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Failed to create category");
    }

    toast.success("Category created");
    closeDialog();
    setRefreshKey((previous) => previous + 1);
  };

  const submitUpdateCategory = async () => {
    if (!editingCategoryId) {
      return;
    }

    const payload = {
      abbreviation: formState.abbreviation.trim(),
      gender: formState.gender || "mixed",
      minAge: parseAgeValue(formState.minAge),
      maxAge: parseAgeValue(formState.maxAge),
      titles: {
        en: formState.titleEn.trim() || undefined,
        fr: formState.titleFr.trim() || undefined,
        ar: formState.titleAr.trim() || undefined,
      },
      isActive: Boolean(formState.isActive),
    };

    const response = await fetch(
      `${API_BASE_URL}/api/categories/${editingCategoryId}`,
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
      throw new Error(result.message || "Failed to update category");
    }

    toast.success("Category updated");
    closeDialog();
    setRefreshKey((previous) => previous + 1);
  };

  const handleSubmitDialog = async (event) => {
    event.preventDefault();
    setDialogSubmitting(true);

    try {
      if (!formState.abbreviation.trim()) {
        throw new Error("Abbreviation is required");
      }
      if (formState.minAge === "" || formState.maxAge === "") {
        throw new Error("Minimum and maximum age are required");
      }

      if (dialogMode === "create") {
        await submitCreateCategory();
      } else {
        await submitUpdateCategory();
      }
    } catch (error) {
      console.error("Failed to save category", error);
      toast.error(error.message);
      setDialogSubmitting(false);
    }
  };

  const handleDeleteCategory = useCallback(
    async (category) => {
      if (!category) {
        return;
      }
      const confirmed = window.confirm(
        `Delete category ${category.abbreviation}? This action cannot be undone.`
      );
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/categories/${category._id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "Failed to delete category");
        }

        toast.success("Category deleted");
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to delete category", error);
        toast.error(error.message);
      }
    },
    [token]
  );

  const handleToggleActive = useCallback(
    async (category) => {
      if (!category) {
        return;
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/categories/${category._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isActive: !category.isActive }),
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.message || "Failed to update status");
        }

        toast.success(
          `Category ${!category.isActive ? "activated" : "deactivated"}`
        );
        setRefreshKey((previous) => previous + 1);
      } catch (error) {
        console.error("Failed to toggle category", error);
        toast.error(error.message);
      }
    },
    [token]
  );

  const handleRecalculate = async () => {
    if (typeFilter !== "national") {
      toast.info("Recalculation is only available for national categories");
      return;
    }

    const seasonValue = recalculateSeason.trim();
    const payload = seasonValue ? { season: seasonValue } : {};

    try {
      setRecalculateSubmitting(true);
      const response = await fetch(
        `${API_BASE_URL}/api/categories/national/recalculate`,
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
        throw new Error(result.message || "Failed to recalculate categories");
      }

      toast.success(
        `Recalculated national categories for season ${result.season}`
      );
      setRefreshKey((previous) => previous + 1);
    } catch (error) {
      console.error("Failed to recalculate categories", error);
      toast.error(error.message);
    } finally {
      setRecalculateSubmitting(false);
    }
  };

  const renderTitlesCell = useCallback((category) => {
    if (!category) {
      return null;
    }

    const titles = [
      category.titles?.en,
      category.titles?.fr,
      category.titles?.ar,
    ]
      .filter(Boolean)
      .join(" • ");

    return (
      <div className="flex flex-col text-xs text-slate-600">
        <span className="font-medium text-slate-900">
          {category.abbreviation}
        </span>
        {titles ? <span>{titles}</span> : <span>Untitled</span>}
      </div>
    );
  }, []);

  const renderAgeCell = useCallback((category) => {
    if (!category) {
      return null;
    }

    return (
      <div className="text-xs text-slate-600">
        {category.minAge ?? "?"} – {category.maxAge ?? "?"}
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((category) => {
    if (!category) {
      return null;
    }

    const key = category.isActive ? "active" : "inactive";
    const label = category.isActive ? "Active" : "Inactive";

    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
          STATUS_BADGE_STYLES[key]
        )}
      >
        {label}
      </span>
    );
  }, []);

  const renderActionsCell = useCallback(
    (category) => {
      if (!category) {
        return null;
      }

      return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            onClick={() => openEditDialog(category)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleToggleActive(category)}
          >
            {category.isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleDeleteCategory(category)}
          >
            Delete
          </Button>
        </div>
      );
    },
    [handleDeleteCategory, handleToggleActive, openEditDialog]
  );

  const gridColumns = useMemo(
    () => [
      {
        headerText: "Category",
        field: "abbreviation",
        width: 240,
        template: renderTitlesCell,
      },
      {
        headerText: "Gender",
        field: "gender",
        width: 120,
      },
      {
        headerText: "Age range",
        field: "minAge",
        width: 140,
        template: renderAgeCell,
      },
      {
        headerText: "Status",
        field: "isActive",
        width: 140,
        template: renderStatusCell,
      },
      {
        headerText: "Updated",
        field: "updatedAt",
        width: 160,
        format: "yMd",
      },
      {
        headerText: "Actions",
        width: 260,
        template: renderActionsCell,
      },
    ],
    [renderActionsCell, renderAgeCell, renderStatusCell, renderTitlesCell]
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Competition framework
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">
            Category management
          </h1>
          <p className="text-sm text-slate-500">
            Maintain national and international age bands, translate titles, and
            keep assignments aligned for every season.
          </p>
          {fetchError ? (
            <p className="text-xs text-rose-500">{fetchError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            New category
          </Button>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="typeFilter">Category type</Label>
            <Select
              id="typeFilter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              {CATEGORY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="genderFilter">Gender</Label>
            <Select
              id="genderFilter"
              value={genderFilter}
              onChange={(event) => setGenderFilter(event.target.value)}
            >
              {CATEGORY_GENDER_OPTIONS.map((option) => (
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
              placeholder="Abbreviation or title"
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
          <div className="space-y-2">
            <Label htmlFor="recalculateSeason">Recalculate national</Label>
            <div className="flex gap-2">
              <Input
                id="recalculateSeason"
                type="number"
                min="1900"
                max="9999"
                value={recalculateSeason}
                onChange={(event) => setRecalculateSeason(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleRecalculate}
                disabled={recalculateSubmitting || typeFilter !== "national"}
              >
                {recalculateSubmitting ? "Recalculating..." : "Run"}
              </Button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">
              {categorySummary.total}
            </span>{" "}
            categories • Active {categorySummary.active} • Inactive{" "}
            {categorySummary.inactive}
          </p>
          <p className="mt-1">
            Gender coverage — Men {categorySummary.byGender.men}, Women{" "}
            {categorySummary.byGender.women}
            {categorySummary.byGender.mixed ? (
              <>
                {", "}Mixed {categorySummary.byGender.mixed}
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Category catalogue
            </h2>
            <p className="text-sm text-slate-500">
              Structured age bands with Syncfusion grid controls, export tools,
              and column chooser.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {loading
              ? "Loading categories..."
              : `${filteredCategories.length} item${
                  filteredCategories.length === 1 ? "" : "s"
                }`}
          </span>
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <DataGrid
            data={filteredCategories}
            columns={gridColumns}
            loading={loading}
            gridId="category-management-grid"
            emptyMessage={
              searchTerm
                ? "No categories match the current search."
                : "No categories found."
            }
          />
        </div>
      </section>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {dialogMode === "create"
                    ? "Create category"
                    : "Edit category"}
                </h2>
                <p className="text-sm text-slate-500">
                  Define the age band, gender eligibility, and multilingual
                  labels for competition use.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="sr-only">Close</span>X
              </button>
            </div>
            <form
              className="max-h-[70vh] overflow-y-auto px-6 py-6"
              onSubmit={handleSubmitDialog}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formType">Type</Label>
                  <Select
                    id="formType"
                    name="type"
                    value={formState.type}
                    onChange={handleFormChange}
                    disabled={dialogMode === "edit"}
                  >
                    {CATEGORY_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formAbbreviation">Abbreviation</Label>
                  <Input
                    id="formAbbreviation"
                    name="abbreviation"
                    value={formState.abbreviation}
                    onChange={handleFormChange}
                    placeholder="e.g. J18"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formGender">Gender</Label>
                  <Select
                    id="formGender"
                    name="gender"
                    value={formState.gender}
                    onChange={handleFormChange}
                  >
                    {CATEGORY_GENDER_OPTIONS.filter(
                      (option) => option.value !== "all"
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formMinAge">Minimum age</Label>
                  <Input
                    id="formMinAge"
                    name="minAge"
                    type="number"
                    min="0"
                    value={formState.minAge}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formMaxAge">Maximum age</Label>
                  <Input
                    id="formMaxAge"
                    name="maxAge"
                    type="number"
                    min="0"
                    value={formState.maxAge}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formTitleEn">Title (English)</Label>
                  <Input
                    id="formTitleEn"
                    name="titleEn"
                    value={formState.titleEn}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formTitleFr">Title (French)</Label>
                  <Input
                    id="formTitleFr"
                    name="titleFr"
                    value={formState.titleFr}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formTitleAr">Title (Arabic)</Label>
                  <Input
                    id="formTitleAr"
                    name="titleAr"
                    value={formState.titleAr}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formIsActive">Status</Label>
                  <Select
                    id="formIsActive"
                    name="isActive"
                    value={formState.isActive ? "true" : "false"}
                    onChange={(event) =>
                      setFormState((previous) => ({
                        ...previous,
                        isActive: event.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeDialog}
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

export default CategoryManagement;
