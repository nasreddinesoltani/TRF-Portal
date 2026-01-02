import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";

const API_BASE_URL = "";

// Options for dropdowns
const GROUP_BY_OPTIONS = [
  { value: "gender", label: "Gender (Men's Cup / Women's Cup)" },
  { value: "category", label: "Age Category (Senior, Junior, etc.)" },
  {
    value: "category_gender",
    label: "Category + Gender (Senior Men, Senior Women, etc.)",
  },
];

const JOURNEY_MODE_OPTIONS = [
  { value: "all", label: "All Journeys" },
  { value: "final_only", label: "Final Journey Only" },
  { value: "best_n", label: "Best N Results" },
];

const POINT_MODE_OPTIONS = [
  { value: "crew_club", label: "All Points → Clubs" },
  { value: "skiff_athlete", label: "All Points → Athletes" },
  { value: "mixed", label: "Mixed (Skiff → Athlete, Crew → Club)" },
];

const DISCIPLINE_OPTIONS = [
  { value: "", label: "All Disciplines" },
  { value: "classic", label: "Classic / Flatwater" },
  { value: "coastal", label: "Coastal" },
  { value: "beach", label: "Beach Sprint" },
  { value: "indoor", label: "Indoor" },
];

// Default point table
const DEFAULT_POINT_TABLE = [
  { position: 1, points: 20 },
  { position: 2, points: 12 },
  { position: 3, points: 8 },
  { position: 4, points: 6 },
  { position: 5, points: 4 },
  { position: 6, points: 3 },
  { position: 7, points: 2 },
  { position: 8, points: 1 },
];

// Empty form state
const EMPTY_FORM = {
  code: "",
  names: { en: "", fr: "", ar: "" },
  description: "",
  groupBy: "gender",
  discipline: "",
  journeyMode: "all",
  bestNCount: "",
  pointMode: "crew_club",
  maxScoringPosition: 8,
  dnfGetsPointsIfFewFinishers: true,
  customPointTable: [],
  isActive: true,
  sortOrder: 0,
};

// Ranking System Card Component
const RankingSystemCard = ({ system, onEdit, onDelete, onToggleActive }) => {
  const groupByLabel =
    GROUP_BY_OPTIONS.find((o) => o.value === system.groupBy)?.label ||
    system.groupBy;
  const pointModeLabel =
    POINT_MODE_OPTIONS.find((o) => o.value === system.pointMode)?.label ||
    system.pointMode;
  const journeyLabel =
    JOURNEY_MODE_OPTIONS.find((o) => o.value === system.journeyMode)?.label ||
    system.journeyMode;

  return (
    <div
      className={`bg-white rounded-lg border shadow-sm overflow-hidden ${
        !system.isActive ? "opacity-60" : ""
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 ${
          system.isPreset
            ? "bg-blue-50 border-b border-blue-100"
            : "bg-slate-50 border-b border-slate-100"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {system.names?.en || system.code}
            </h3>
            {system.isPreset && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                Preset
              </span>
            )}
            {!system.isActive && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                Inactive
              </span>
            )}
          </div>
          <span className="text-sm font-mono text-slate-500">
            {system.code}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Multilingual names */}
        <div className="text-sm text-slate-600">
          <span className="font-medium">FR:</span> {system.names?.fr || "-"} |
          <span className="font-medium mr-1"> AR:</span>{" "}
          {system.names?.ar || "-"}
        </div>

        {system.description && (
          <p className="text-sm text-slate-500">{system.description}</p>
        )}

        {/* Configuration badges */}
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
            📊 {groupByLabel}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
            🎯 {pointModeLabel}
          </span>
          <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
            📅 {journeyLabel}
          </span>
          {system.discipline && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs">
              🚣 {system.discipline}
            </span>
          )}
        </div>

        {/* Point table preview */}
        <div className="text-xs text-slate-500">
          Points: 1st={system.customPointTable?.[0]?.points || 20}, 2nd=
          {system.customPointTable?.[1]?.points || 12}, 3rd=
          {system.customPointTable?.[2]?.points || 8}...
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
        <button
          onClick={() => onToggleActive(system)}
          className={`text-sm ${
            system.isActive
              ? "text-amber-600 hover:text-amber-700"
              : "text-green-600 hover:text-green-700"
          }`}
        >
          {system.isActive ? "Deactivate" : "Activate"}
        </button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(system)}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => onDelete(system)}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

// Form Dialog Component
const RankingSystemForm = ({ system, onSave, onCancel, isReadOnly }) => {
  const [form, setForm] = useState(system || EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNameChange = (lang, value) => {
    setForm((prev) => ({
      ...prev,
      names: { ...prev.names, [lang]: value },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isReadOnly) return;

    if (!form.code || !form.names.en) {
      toast.error("Code and English name are required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {system?._id ? "Edit Ranking System" : "Create Ranking System"}
          </h2>
          {system?.isPreset && (
            <p className="text-sm text-blue-600 mt-1">
              This is a built-in preset. Changes will be saved to the database.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Code */}
          <div>
            <Label>Code *</Label>
            <Input
              value={form.code}
              onChange={(e) =>
                handleChange("code", e.target.value.toUpperCase())
              }
              placeholder="e.g., CUSTOM_CUP"
              disabled={isReadOnly || !!system?._id}
              className="font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Unique identifier (cannot be changed after creation)
            </p>
          </div>

          {/* Names */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Name (English) *</Label>
              <Input
                value={form.names.en}
                onChange={(e) => handleNameChange("en", e.target.value)}
                placeholder="Classic Cup"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Name (French)</Label>
              <Input
                value={form.names.fr}
                onChange={(e) => handleNameChange("fr", e.target.value)}
                placeholder="Coupe Classique"
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Label>Name (Arabic)</Label>
              <Input
                value={form.names.ar}
                onChange={(e) => handleNameChange("ar", e.target.value)}
                placeholder="الكأس الكلاسيكية"
                disabled={isReadOnly}
                dir="rtl"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea
              value={form.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Describe how this ranking system works..."
              disabled={isReadOnly}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              rows={2}
            />
          </div>

          {/* Group By */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Group Rankings By *</Label>
              <Select
                value={form.groupBy}
                onChange={(e) => handleChange("groupBy", e.target.value)}
                disabled={isReadOnly}
              >
                {GROUP_BY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Discipline Filter</Label>
              <Select
                value={form.discipline || ""}
                onChange={(e) =>
                  handleChange("discipline", e.target.value || null)
                }
                disabled={isReadOnly}
              >
                {DISCIPLINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Point Mode & Journey Mode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Points Go To *</Label>
              <Select
                value={form.pointMode}
                onChange={(e) => handleChange("pointMode", e.target.value)}
                disabled={isReadOnly}
              >
                {POINT_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Journey Mode *</Label>
              <Select
                value={form.journeyMode}
                onChange={(e) => handleChange("journeyMode", e.target.value)}
                disabled={isReadOnly}
              >
                {JOURNEY_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Best N (conditional) */}
          {form.journeyMode === "best_n" && (
            <div>
              <Label>Best N Count</Label>
              <Input
                type="number"
                min={1}
                value={form.bestNCount || ""}
                onChange={(e) =>
                  handleChange("bestNCount", parseInt(e.target.value) || null)
                }
                placeholder="e.g., 3"
                disabled={isReadOnly}
              />
            </div>
          )}

          {/* Max Scoring Position & DNF Rule */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Scoring Position</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={form.maxScoringPosition}
                onChange={(e) =>
                  handleChange(
                    "maxScoringPosition",
                    parseInt(e.target.value) || 8
                  )
                }
                disabled={isReadOnly}
              />
              <p className="text-xs text-slate-500 mt-1">
                Positions beyond this get 0 points
              </p>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.dnfGetsPointsIfFewFinishers}
                  onChange={(e) =>
                    handleChange(
                      "dnfGetsPointsIfFewFinishers",
                      e.target.checked
                    )
                  }
                  disabled={isReadOnly}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  DNF gets points if few finishers
                </span>
              </label>
            </div>
          </div>

          {/* Sort Order & Active */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  handleChange("sortOrder", parseInt(e.target.value) || 0)
                }
                disabled={isReadOnly}
              />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  disabled={isReadOnly}
                  className="w-4 h-4"
                />
                <span className="text-sm text-slate-700">
                  Active (available for selection)
                </span>
              </label>
            </div>
          </div>

          {/* Point Table Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-700 mb-2">Point Table</h4>
            <p className="text-sm text-slate-500 mb-2">
              Default: 1st=20, 2nd=12, 3rd=8, 4th=6, 5th=4, 6th=3, 7th=2, 8th=1,
              9th+=0
            </p>
            <p className="text-xs text-slate-400">
              Custom point tables can be configured via the API if needed.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onCancel}>
              {isReadOnly ? "Close" : "Cancel"}
            </Button>
            {!isReadOnly && (
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : system?._id ? "Update" : "Create"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
export default function RankingSystemManagement() {
  const { token } = useAuth();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [filter, setFilter] = useState("all"); // all, active, inactive, preset, custom

  // Fetch ranking systems
  const fetchSystems = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rankings/systems`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSystems(data);
      } else {
        toast.error("Failed to load ranking systems");
      }
    } catch (error) {
      console.error("Error fetching systems:", error);
      toast.error("Failed to load ranking systems");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchSystems();
  }, [token, fetchSystems]);

  // Create/Update system
  const handleSave = async (formData) => {
    const isUpdate = !!formData._id;
    const url = isUpdate
      ? `${API_BASE_URL}/api/rankings/systems/${formData._id}`
      : `${API_BASE_URL}/api/rankings/systems`;

    try {
      const response = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success(
          isUpdate ? "Ranking system updated" : "Ranking system created"
        );
        setShowForm(false);
        setEditingSystem(null);
        fetchSystems();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save ranking system");
      }
    } catch (error) {
      console.error("Error saving system:", error);
      toast.error("Failed to save ranking system");
    }
  };

  // Delete system
  const handleDelete = async (system) => {
    if (
      !confirm(
        `Are you sure you want to delete "${system.names?.en || system.code}"?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rankings/systems/${system._id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Ranking system deleted");
        fetchSystems();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to delete ranking system");
      }
    } catch (error) {
      console.error("Error deleting system:", error);
      toast.error("Failed to delete ranking system");
    }
  };

  // Toggle active status
  const handleToggleActive = async (system) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rankings/systems/${system._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isActive: !system.isActive }),
        }
      );

      if (response.ok) {
        toast.success(
          system.isActive ? "System deactivated" : "System activated"
        );
        fetchSystems();
      } else {
        toast.error("Failed to update system");
      }
    } catch (error) {
      console.error("Error toggling active:", error);
      toast.error("Failed to update system");
    }
  };

  // Sync presets
  const handleSyncPresets = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rankings/presets/sync`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(`Synced ${result.results.length} presets`);
        fetchSystems();
      } else {
        toast.error("Failed to sync presets");
      }
    } catch (error) {
      console.error("Error syncing presets:", error);
      toast.error("Failed to sync presets");
    }
  };

  // Open edit form
  const handleEdit = (system) => {
    setEditingSystem(system);
    setIsReadOnly(false); // Allow editing all systems including presets
    setShowForm(true);
  };

  // Open create form
  const handleCreate = () => {
    setEditingSystem(null);
    setIsReadOnly(false);
    setShowForm(true);
  };

  // Filter systems
  const filteredSystems = systems.filter((sys) => {
    switch (filter) {
      case "active":
        return sys.isActive;
      case "inactive":
        return !sys.isActive;
      case "preset":
        return sys.isPreset;
      case "custom":
        return !sys.isPreset;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ranking Systems</h1>
          <p className="text-slate-500">
            Configure how rankings are calculated for competitions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSyncPresets}>
            🔄 Sync Presets
          </Button>
          <Button onClick={handleCreate}>+ New System</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "preset", label: "Presets" },
          { value: "custom", label: "Custom" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">
          {filteredSystems.length} system
          {filteredSystems.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Systems Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSystems.map((system) => (
          <RankingSystemCard
            key={system._id}
            system={system}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />
        ))}
      </div>

      {filteredSystems.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            No Ranking Systems
          </h3>
          <p className="text-slate-500 mb-4">
            {filter === "all"
              ? 'Click "Sync Presets" to load the default ranking systems.'
              : "No systems match the current filter."}
          </p>
          {filter === "all" && (
            <Button onClick={handleSyncPresets}>Sync Presets</Button>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <RankingSystemForm
          system={editingSystem}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingSystem(null);
          }}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
}
