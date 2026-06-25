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

const STATUS_BADGE_STYLES = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-slate-100 text-slate-600 border border-slate-200",
};

const DEFAULT_FORM = {
  code: "",
  codeAlpha2: "",
  iocCode: "",
  nameEn: "",
  nameFr: "",
  nameAr: "",
  flagUrl: "",
  federationCode: "",
  fedNameEn: "",
  fedNameFr: "",
  fedNameAr: "",
  isTrf: false,
  isActive: true,
  sortOrder: 0,
};

const CountryManagement = () => {
  const { token } = useAuth();

  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [trfOnly, setTrfOnly] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogSubmitting, setDialogSubmitting] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [editingCountryId, setEditingCountryId] = useState(null);

  const loadCountries = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (includeInactive) params.set("includeInactive", "true");
      if (trfOnly) params.set("isTrf", "true");
      const res = await fetch(
        `${API_BASE_URL}/api/countries?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const p = await res.json().catch(() => ({}));
        throw new Error(p.message || "Failed to load countries");
      }
      const data = await res.json();
      setCountries(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [includeInactive, token, trfOnly]);

  useEffect(() => {
    loadCountries();
  }, [loadCountries, refreshKey]);

  const filteredCountries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter((c) => {
      const targets = [
        c.code,
        c.codeAlpha2,
        c.iocCode,
        c.names?.en,
        c.names?.fr,
        c.names?.ar,
        c.federationCode,
        c.federationNames?.en,
        c.federationNames?.fr,
        c.federationNames?.ar,
      ]
        .filter(Boolean)
        .map((v) => v.toString().toLowerCase());
      return targets.some((v) => v.includes(term));
    });
  }, [countries, searchTerm]);

  const summary = useMemo(() => {
    const total = filteredCountries.length;
    const active = filteredCountries.filter((c) => c.isActive).length;
    return { total, active, inactive: total - active };
  }, [filteredCountries]);

  const openCreateDialog = useCallback(() => {
    setDialogMode("create");
    setFormState(DEFAULT_FORM);
    setEditingCountryId(null);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((country) => {
    if (!country) return;
    setDialogMode("edit");
    setEditingCountryId(country._id);
    setFormState({
      code: country.code || "",
      codeAlpha2: country.codeAlpha2 || "",
      iocCode: country.iocCode || "",
      nameEn: country.names?.en || "",
      nameFr: country.names?.fr || "",
      nameAr: country.names?.ar || "",
      flagUrl: country.flagUrl || "",
      federationCode: country.federationCode || "",
      fedNameEn: country.federationNames?.en || "",
      fedNameFr: country.federationNames?.fr || "",
      fedNameAr: country.federationNames?.ar || "",
      isTrf: Boolean(country.isTrf),
      isActive: Boolean(country.isActive),
      sortOrder: country.sortOrder ?? 0,
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setDialogSubmitting(false);
    setEditingCountryId(null);
  }, []);

  const handleFormChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const buildPayload = useCallback(() => ({
    code: formState.code.trim().toUpperCase(),
    codeAlpha2: formState.codeAlpha2.trim().toUpperCase() || undefined,
    iocCode: formState.iocCode.trim().toUpperCase() || undefined,
    names: {
      en: formState.nameEn.trim() || undefined,
      fr: formState.nameFr.trim() || undefined,
      ar: formState.nameAr.trim() || undefined,
    },
    flagUrl: formState.flagUrl.trim() || undefined,
    federationCode: formState.federationCode.trim().toUpperCase() || undefined,
    federationNames: {
      en: formState.fedNameEn.trim() || undefined,
      fr: formState.fedNameFr.trim() || undefined,
      ar: formState.fedNameAr.trim() || undefined,
    },
    isTrf: Boolean(formState.isTrf),
    isActive: Boolean(formState.isActive),
    sortOrder: Number(formState.sortOrder) || 0,
  }), [formState]);

  const submitCreate = async () => {
    const payload = buildPayload();
    const res = await fetch(`${API_BASE_URL}/api/countries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Failed to create country");
    toast.success("Country created");
    closeDialog();
    setRefreshKey((k) => k + 1);
  };

  const submitUpdate = async () => {
    if (!editingCountryId) return;
    const payload = buildPayload();
    const res = await fetch(`${API_BASE_URL}/api/countries/${editingCountryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Failed to update country");
    toast.success("Country updated");
    closeDialog();
    setRefreshKey((k) => k + 1);
  };

  const handleSubmitDialog = async (e) => {
    e.preventDefault();
    setDialogSubmitting(true);
    try {
      if (!formState.code.trim()) throw new Error("Alpha-3 code is required");
      if (!formState.nameEn.trim()) throw new Error("English name is required");
      if (dialogMode === "create") await submitCreate();
      else await submitUpdate();
    } catch (err) {
      toast.error(err.message);
      setDialogSubmitting(false);
    }
  };

  const handleDelete = useCallback(
    async (country) => {
      if (!country) return;
      const ok = window.confirm(
        `Delete country ${country.code} (${country.names?.en || country.code})? This cannot be undone.`,
      );
      if (!ok) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/countries/${country._id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.message || "Failed to delete");
        toast.success("Country deleted");
        setRefreshKey((k) => k + 1);
      } catch (err) {
        toast.error(err.message);
      }
    },
    [token],
  );

  const renderNameCell = useCallback((country) => {
    if (!country) return null;
    const flagImg = country.flagUrl
      ? country.flagUrl
      : country.codeAlpha2
        ? `https://flagcdn.com/24x18/${country.codeAlpha2.toLowerCase()}.png`
        : null;
    return (
      <div className="flex items-center gap-2">
        {flagImg && (
          <img
            src={flagImg}
            alt={country.code}
            className="h-4 w-6 rounded-sm object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        )}
        <div className="flex flex-col text-xs text-slate-600">
          <span className="flex items-center gap-2 font-medium text-slate-900">
            {country.names?.en || "Untitled"}
            {country.isTrf && (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-700/10">
                TRF
              </span>
            )}
          </span>
          {country.code && (
            <span className="text-[10px] font-mono text-slate-400">
              {country.code}
              {country.iocCode && country.iocCode !== country.code
                ? ` / IOC: ${country.iocCode}`
                : ""}
            </span>
          )}
        </div>
      </div>
    );
  }, []);

  const renderFederationCell = useCallback((country) => {
    if (!country) return null;
    const fedName = country.federationNames?.en || country.federationCode || "";
    return (
      <div className="text-xs text-slate-600">
        <span className="font-medium text-slate-900">
          {country.federationCode || "-"}
        </span>
        {fedName && country.federationCode && (
          <div className="text-[10px] text-slate-400">{fedName}</div>
        )}
      </div>
    );
  }, []);

  const renderStatusCell = useCallback((country) => {
    if (!country) return null;
    const key = country.isActive ? "active" : "inactive";
    return (
      <span
        className={clsx(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
          STATUS_BADGE_STYLES[key],
        )}
      >
        {country.isActive ? "Active" : "Inactive"}
      </span>
    );
  }, []);

  const renderActionsCell = useCallback(
    (country) => {
      if (!country) return null;
      return (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button type="button" variant="outline" onClick={() => openEditDialog(country)}>
            Edit
          </Button>
          <Button type="button" variant="destructive" onClick={() => handleDelete(country)}>
            Delete
          </Button>
        </div>
      );
    },
    [handleDelete, openEditDialog],
  );

  const gridColumns = useMemo(
    () => [
      { headerText: "Country", field: "names.en", width: 280, template: renderNameCell },
      { headerText: "Federation", field: "federationCode", width: 200, template: renderFederationCell },
      { headerText: "Status", field: "isActive", width: 110, template: renderStatusCell },
      { headerText: "Sort", field: "sortOrder", width: 70 },
      { headerText: "Updated", field: "updatedAt", width: 140, format: "yMd" },
      { headerText: "Actions", width: 180, template: renderActionsCell },
    ],
    [renderNameCell, renderFederationCell, renderStatusCell, renderActionsCell],
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            International settings
          </span>
          <h1 className="text-3xl font-semibold text-slate-900">Country management</h1>
          <p className="text-sm text-slate-500">
            Manage countries, federations, and flags for international competition entries.
          </p>
          {fetchError && <p className="text-xs text-rose-500">{fetchError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            New country
          </Button>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="searchTerm">Search</Label>
            <Input
              id="searchTerm"
              placeholder="Code or name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="includeInactive">Visibility</Label>
            <Select
              id="includeInactive"
              value={includeInactive ? "include" : "active"}
              onChange={(e) => setIncludeInactive(e.target.value === "include")}
            >
              <option value="active">Active only</option>
              <option value="include">Include inactive</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trfOnly">Federation</Label>
            <Select
              id="trfOnly"
              value={trfOnly ? "trf" : "all"}
              onChange={(e) => setTrfOnly(e.target.value === "trf")}
            >
              <option value="all">All countries</option>
              <option value="trf">TRF only</option>
            </Select>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">{summary.total}</span> countries
          {" • "}Active {summary.active}
          {" • "}Inactive {summary.inactive}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Country catalogue</h2>
            <p className="text-sm text-slate-500">
              ISO 3166-1 alpha-3 codes with trilingual names and federation metadata.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {loading
              ? "Loading..."
              : `${filteredCountries.length} item${filteredCountries.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="px-2 pb-2 pt-4 sm:px-4">
          <DataGrid
            data={filteredCountries}
            columns={gridColumns}
            loading={loading}
            gridId="country-management-grid"
            emptyMessage={
              searchTerm
                ? "No countries match the current search."
                : "No countries found. Click \"New country\" to add one."
            }
          />
        </div>
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {dialogMode === "create" ? "Create country" : "Edit country"}
                </h2>
                <p className="text-sm text-slate-500">
                  {dialogMode === "create"
                    ? "Add a new country with ISO alpha-3 code and federation details."
                    : "Update country metadata and federation information."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                X
              </button>
            </div>
            <form
              className="max-h-[70vh] overflow-y-auto px-6 py-6"
              onSubmit={handleSubmitDialog}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="formCode">Alpha-3 code</Label>
                  <Input
                    id="formCode"
                    name="code"
                    value={formState.code}
                    onChange={handleFormChange}
                    placeholder="e.g. TUN"
                    required
                    maxLength={3}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formCodeAlpha2">Alpha-2 code</Label>
                  <Input
                    id="formCodeAlpha2"
                    name="codeAlpha2"
                    value={formState.codeAlpha2}
                    onChange={handleFormChange}
                    placeholder="e.g. TN"
                    maxLength={2}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formIocCode">IOC code</Label>
                  <Input
                    id="formIocCode"
                    name="iocCode"
                    value={formState.iocCode}
                    onChange={handleFormChange}
                    placeholder="e.g. TUN"
                    maxLength={3}
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formFlagUrl">Flag URL</Label>
                  <Input
                    id="formFlagUrl"
                    name="flagUrl"
                    value={formState.flagUrl}
                    onChange={handleFormChange}
                    placeholder="https://... or leave blank for flagcdn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formNameEn">Name (English)</Label>
                  <Input
                    id="formNameEn"
                    name="nameEn"
                    value={formState.nameEn}
                    onChange={handleFormChange}
                    placeholder="e.g. Tunisia"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formNameFr">Name (French)</Label>
                  <Input
                    id="formNameFr"
                    name="nameFr"
                    value={formState.nameFr}
                    onChange={handleFormChange}
                    placeholder="e.g. Tunisie"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formNameAr">Name (Arabic)</Label>
                  <Input
                    id="formNameAr"
                    name="nameAr"
                    value={formState.nameAr}
                    onChange={handleFormChange}
                    placeholder="e.g. تونس"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formFederationCode">Federation code</Label>
                  <Input
                    id="formFederationCode"
                    name="federationCode"
                    value={formState.federationCode}
                    onChange={handleFormChange}
                    placeholder="e.g. FTTA"
                    className="uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formFedNameEn">Federation name (EN)</Label>
                  <Input
                    id="formFedNameEn"
                    name="fedNameEn"
                    value={formState.fedNameEn}
                    onChange={handleFormChange}
                    placeholder="e.g. Tunisian Rowing Federation"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formFedNameFr">Federation name (FR)</Label>
                  <Input
                    id="formFedNameFr"
                    name="fedNameFr"
                    value={formState.fedNameFr}
                    onChange={handleFormChange}
                    placeholder="e.g. Fédération Tunisienne d'Aviron"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formFedNameAr">Federation name (AR)</Label>
                  <Input
                    id="formFedNameAr"
                    name="fedNameAr"
                    value={formState.fedNameAr}
                    onChange={handleFormChange}
                    placeholder="e.g. الجامعة التونسية للتجديف"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formSortOrder">Sort order</Label>
                  <Input
                    id="formSortOrder"
                    name="sortOrder"
                    type="number"
                    min="0"
                    value={formState.sortOrder}
                    onChange={handleFormChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formIsActive">Status</Label>
                  <Select
                    id="formIsActive"
                    name="isActive"
                    value={formState.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        isActive: e.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isTrf"
                      checked={formState.isTrf}
                      onChange={handleFormChange}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      TRF federation
                    </span>
                  </label>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
                <Button type="button" variant="ghost" onClick={closeDialog} disabled={dialogSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={dialogSubmitting}>
                  {dialogSubmitting
                    ? dialogMode === "create" ? "Creating..." : "Saving..."
                    : dialogMode === "create" ? "Create" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CountryManagement;
