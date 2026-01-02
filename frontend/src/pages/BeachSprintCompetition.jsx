import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Label } from "../components/ui/label";

const API_BASE_URL = "";

// Phase display names
const PHASE_NAMES = {
  time_trial: "Time Trial",
  repechage: "Repechage",
  quarterfinal: "Quarterfinal",
  semifinal: "Semifinal",
  final_b: "Final B",
  final_a: "Final A",
};

// Phase order for progression
const PHASE_ORDER = [
  "time_trial",
  "repechage",
  "quarterfinal",
  "semifinal",
  "final_b",
  "final_a",
];

// Status badge styles
const STATUS_STYLES = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

// Medal emojis
const MEDAL_EMOJI = {
  gold: "🥇",
  silver: "🥈",
  bronze: "🥉",
};

/**
 * Event Card Component
 */
const EventCard = ({ event, onSelect, onDelete }) => {
  const statusLabel = {
    pending: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
  };

  return (
    <div
      className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(event)}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-slate-900">{event.name}</h3>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded ${
              STATUS_STYLES[event.status]
            }`}
          >
            {statusLabel[event.status]}
          </span>
        </div>

        <div className="text-sm text-slate-600 space-y-1">
          <p>
            <span className="font-medium">Category:</span>{" "}
            {event.category?.name || "-"}
          </p>
          <p>
            <span className="font-medium">Boat:</span>{" "}
            {event.boatClass?.name || "-"}
          </p>
          <p>
            <span className="font-medium">Phase:</span>{" "}
            {PHASE_NAMES[event.currentPhase] || event.currentPhase}
          </p>
        </div>

        {/* Medal results if completed */}
        {event.status === "completed" && event.medals && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex gap-4 text-sm">
              {event.medals.gold?.club && (
                <span>
                  {MEDAL_EMOJI.gold} {event.medals.gold.club.name}
                </span>
              )}
              {event.medals.silver?.club && (
                <span>
                  {MEDAL_EMOJI.silver} {event.medals.silver.club.name}
                </span>
              )}
              {event.medals.bronze?.club && (
                <span>
                  {MEDAL_EMOJI.bronze} {event.medals.bronze.club.name}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(event);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

/**
 * Race Card Component
 */
const RaceCard = ({ race, onRecordResults, onEdit }) => {
  const isCompleted = race.status === "completed";

  return (
    <div
      className={`bg-white rounded-lg border ${
        isCompleted ? "border-green-200" : "border-slate-200"
      } p-4`}
    >
      <div className="flex justify-between items-center mb-3">
        <div>
          <span className="font-semibold text-slate-900">{race.raceCode}</span>
          <span className="ml-2 text-sm text-slate-500">
            {PHASE_NAMES[race.phase]}{" "}
            {race.heatNumber > 1 ? `#${race.heatNumber}` : ""}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            isCompleted
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {isCompleted ? "Completed" : "Scheduled"}
        </span>
      </div>

      {/* Lanes */}
      <div className="space-y-2">
        {race.lanes.map((lane, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-2 rounded ${
              isCompleted && lane.position === 1
                ? "bg-yellow-50"
                : "bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 flex items-center justify-center bg-white rounded text-sm font-medium">
                {lane.lane}
              </span>
              <div>
                <span className="font-medium">
                  {lane.athlete?.firstName} {lane.athlete?.lastName}
                  {lane.crew?.length > 0 &&
                    lane.crew.map((a) => ` ${a.firstName}`).join(",")}
                </span>
                {lane.club && (
                  <span className="ml-2 text-sm text-slate-500">
                    ({lane.club.shortName || lane.club.name})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isCompleted && (
                <>
                  {lane.position && (
                    <span
                      className={`font-bold ${
                        lane.position === 1
                          ? "text-yellow-600"
                          : "text-slate-700"
                      }`}
                    >
                      P{lane.position}
                    </span>
                  )}
                  <span className="font-mono text-sm">{lane.time || "-"}</span>
                  {lane.status !== "ok" && (
                    <span className="text-xs font-medium text-red-600 uppercase">
                      {lane.status}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <Button size="sm" onClick={() => onRecordResults(race)}>
            Record Results
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Results Entry Dialog
 */
const ResultsDialog = ({ race, onSave, onCancel }) => {
  const [results, setResults] = useState(
    race.lanes.map((lane) => ({
      lane: lane.lane,
      time: lane.time || "",
      status: lane.status || "ok",
    }))
  );
  const [saving, setSaving] = useState(false);

  const handleTimeChange = (laneNum, time) => {
    setResults((prev) =>
      prev.map((r) => (r.lane === laneNum ? { ...r, time } : r))
    );
  };

  const handleStatusChange = (laneNum, status) => {
    setResults((prev) =>
      prev.map((r) => (r.lane === laneNum ? { ...r, status } : r))
    );
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(results);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Record Results - {race.raceCode}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {race.lanes.map((lane, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded font-medium">
                {lane.lane}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {lane.athlete?.firstName} {lane.athlete?.lastName}
                </p>
                <p className="text-xs text-slate-500">{lane.club?.name}</p>
              </div>
              <Input
                type="text"
                placeholder="MM:SS.cc"
                className="w-24 font-mono text-center"
                value={results.find((r) => r.lane === lane.lane)?.time || ""}
                onChange={(e) => handleTimeChange(lane.lane, e.target.value)}
              />
              <Select
                className="w-20"
                value={
                  results.find((r) => r.lane === lane.lane)?.status || "ok"
                }
                onChange={(e) => handleStatusChange(lane.lane, e.target.value)}
              >
                <option value="ok">OK</option>
                <option value="dns">DNS</option>
                <option value="dnf">DNF</option>
                <option value="dsq">DSQ</option>
              </Select>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving..." : "Save Results"}
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * Create Event Dialog
 */
const CreateEventDialog = ({ competition, onSave, onCancel }) => {
  const { token } = useAuth();
  const [form, setForm] = useState({
    name: "",
    boatClassId: "",
    categoryId: "",
    gender: "M",
    progressionConfig: {
      hasRepechage: true,
      timeTrialDirectAdvance: 4,
      timeTrialToRepechage: 4,
      repechageAdvance: 2,
    },
  });
  const [boatClasses, setBoatClasses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  // Get allowed IDs from competition
  const allowedBoatClassIds =
    competition?.allowedBoatClasses?.map((bc) =>
      typeof bc === "string" ? bc : bc._id
    ) || [];
  const allowedCategoryIds =
    competition?.allowedCategories?.map((cat) =>
      typeof cat === "string" ? cat : cat._id
    ) || [];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bcRes, catRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/boat-classes`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (bcRes.ok) {
          const bcData = await bcRes.json();
          const allBoatClasses = Array.isArray(bcData)
            ? bcData
            : bcData.data || [];
          // Filter by allowed boat classes if any are specified
          const filtered =
            allowedBoatClassIds.length > 0
              ? allBoatClasses.filter((bc) =>
                  allowedBoatClassIds.includes(bc._id)
                )
              : allBoatClasses;
          setBoatClasses(filtered);
        }
        if (catRes.ok) {
          const catData = await catRes.json();
          const allCategories = Array.isArray(catData)
            ? catData
            : catData.data || [];
          // Filter by allowed categories if any are specified
          const filtered =
            allowedCategoryIds.length > 0
              ? allCategories.filter((cat) =>
                  allowedCategoryIds.includes(cat._id)
                )
              : allCategories;
          setCategories(filtered);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    if (token) fetchData();
  }, [token, allowedBoatClassIds.length, allowedCategoryIds.length]);

  // Filter categories based on selected gender
  // - Mixed categories work for any event gender
  // - Men categories work for Men events
  // - Women categories work for Women events
  // - Mixed events should use mixed categories
  const filteredCategories = categories.filter((cat) => {
    if (cat.gender === "mixed") return true; // Mixed categories always show
    if (form.gender === "M" && cat.gender === "men") return true;
    if (form.gender === "F" && cat.gender === "women") return true;
    if (form.gender === "Mixed" && cat.gender === "mixed") return true; // Only mixed for mixed events
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.boatClassId || !form.categoryId) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        competitionId: competition._id,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Create Beach Sprint Event
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <Label>Event Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Senior Men 1x"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Boat Class *</Label>
              <Select
                value={form.boatClassId}
                onChange={(e) =>
                  setForm({ ...form, boatClassId: e.target.value })
                }
              >
                <option value="">Select boat class</option>
                {boatClasses.map((bc) => (
                  <option key={bc._id} value={bc._id}>
                    {bc.names?.en || bc.code}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Category *</Label>
              <Select
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Select category</option>
                {filteredCategories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.titles?.en || cat.abbreviation}
                  </option>
                ))}
              </Select>
              {form.gender === "Mixed" && filteredCategories.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No gender-neutral categories available. Create them in
                  Category Management.
                </p>
              )}
            </div>
          </div>

          <div>
            <Label>Gender *</Label>
            <Select
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value, categoryId: "" })
              }
            >
              <option value="M">Men</option>
              <option value="F">Women</option>
              <option value="Mixed">Mixed</option>
            </Select>
          </div>

          {/* Progression Config */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-medium text-slate-700 mb-3">
              Progression Settings
            </h4>

            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={form.progressionConfig.hasRepechage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    progressionConfig: {
                      ...form.progressionConfig,
                      hasRepechage: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700">
                Include Repechage round
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Direct to Knockout</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.progressionConfig.timeTrialDirectAdvance}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      progressionConfig: {
                        ...form.progressionConfig,
                        timeTrialDirectAdvance: parseInt(e.target.value) || 4,
                      },
                    })
                  }
                />
              </div>
              {form.progressionConfig.hasRepechage && (
                <div>
                  <Label className="text-xs">To Repechage</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.progressionConfig.timeTrialToRepechage}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        progressionConfig: {
                          ...form.progressionConfig,
                          timeTrialToRepechage: parseInt(e.target.value) || 4,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * Bracket View Component
 */
const BracketView = ({ bracket }) => {
  if (!bracket || !bracket.phases) return null;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max p-4">
        {PHASE_ORDER.map((phase) => {
          const races = bracket.phases[phase];
          if (!races || races.length === 0) return null;

          return (
            <div key={phase} className="w-64">
              <h4 className="font-semibold text-slate-700 mb-3 text-center">
                {PHASE_NAMES[phase]}
              </h4>
              <div className="space-y-4">
                {races.map((race) => (
                  <div
                    key={race._id}
                    className={`border rounded-lg p-2 ${
                      race.status === "completed"
                        ? "bg-green-50 border-green-200"
                        : "bg-white"
                    }`}
                  >
                    <div className="text-xs text-slate-500 mb-1">
                      {race.raceCode}
                    </div>
                    {race.lanes.map((lane, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center py-1 px-2 rounded text-sm ${
                          lane.position === 1 ? "bg-yellow-100" : ""
                        }`}
                      >
                        <span className="truncate">
                          {lane.athlete?.lastName ||
                            lane.club?.shortName ||
                            `Lane ${lane.lane}`}
                        </span>
                        <span className="font-mono text-xs">
                          {lane.time || "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Main Beach Sprint Competition Page
 */
export default function BeachSprintCompetition() {
  const { competitionId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [competition, setCompetition] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventDetail, setEventDetail] = useState(null);
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [selectedRace, setSelectedRace] = useState(null);

  // View mode
  const [viewMode, setViewMode] = useState("list"); // list | bracket

  // Fetch competition info
  useEffect(() => {
    const fetchCompetition = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/competitions/${competitionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          setCompetition(await response.json());
        }
      } catch (error) {
        console.error("Error fetching competition:", error);
      }
    };
    if (token && competitionId) fetchCompetition();
  }, [token, competitionId]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/beach-sprint/competitions/${competitionId}/events`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok) {
        setEvents(await response.json());
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  }, [token, competitionId]);

  useEffect(() => {
    if (token && competitionId) fetchEvents();
  }, [token, competitionId, fetchEvents]);

  // Fetch event detail when selected
  useEffect(() => {
    const fetchEventDetail = async () => {
      if (!selectedEvent) {
        setEventDetail(null);
        setBracket(null);
        return;
      }

      try {
        const [detailRes, bracketRes] = await Promise.all([
          fetch(
            `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
          fetch(
            `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}/bracket`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          ),
        ]);

        if (detailRes.ok) setEventDetail(await detailRes.json());
        if (bracketRes.ok) setBracket(await bracketRes.json());
      } catch (error) {
        console.error("Error fetching event detail:", error);
      }
    };

    fetchEventDetail();
  }, [token, selectedEvent]);

  // Create event
  const handleCreateEvent = async (eventData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/beach-sprint/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        toast.success("Event created successfully");
        setShowCreateEvent(false);
        fetchEvents();
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to create event");
      }
    } catch (error) {
      toast.error("Failed to create event");
    }
  };

  // Delete event
  const handleDeleteEvent = async (event) => {
    if (!confirm(`Delete "${event.name}"? This will remove all races.`)) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/beach-sprint/events/${event._id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        toast.success("Event deleted");
        if (selectedEvent?._id === event._id) setSelectedEvent(null);
        fetchEvents();
      } else {
        toast.error("Failed to delete event");
      }
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  // Record race results
  const handleRecordResults = async (results) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/beach-sprint/races/${selectedRace._id}/results`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ results }),
        }
      );

      if (response.ok) {
        toast.success("Results recorded");
        setShowResultsDialog(false);
        setSelectedRace(null);
        // Refresh event detail
        setSelectedEvent({ ...selectedEvent });
      } else {
        toast.error("Failed to record results");
      }
    } catch (error) {
      toast.error("Failed to record results");
    }
  };

  // Process progression
  const handleProcessProgression = async (type) => {
    const endpoint =
      type === "time_trial"
        ? "process-time-trial"
        : type === "finals"
        ? "process-finals"
        : "process-knockout";

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/beach-sprint/events/${selectedEvent._id}/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ phase: selectedEvent.currentPhase }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        fetchEvents();
        setSelectedEvent({ ...selectedEvent });
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to process progression");
      }
    } catch (error) {
      toast.error("Failed to process progression");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate("/competitions")}
                className="text-sm text-slate-500 hover:text-slate-700 mb-1"
              >
                ← Back to Competitions
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                🏖️ {competition?.name || "Beach Sprint Competition"}
              </h1>
              <p className="text-slate-600">Beach Sprint Events & Brackets</p>
            </div>
            <Button onClick={() => setShowCreateEvent(true)}>
              + Create Event
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Events List */}
          <div className="col-span-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Events
            </h2>
            {events.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg border">
                <p className="text-slate-500">No events yet</p>
                <Button
                  className="mt-4"
                  onClick={() => setShowCreateEvent(true)}
                >
                  Create First Event
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    onSelect={setSelectedEvent}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Event Detail */}
          <div className="col-span-8">
            {selectedEvent ? (
              <div className="bg-white rounded-lg border">
                <div className="px-6 py-4 border-b border-slate-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">
                        {selectedEvent.name}
                      </h2>
                      <p className="text-slate-500">
                        Current Phase: {PHASE_NAMES[selectedEvent.currentPhase]}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={viewMode === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                      >
                        List
                      </Button>
                      <Button
                        variant={viewMode === "bracket" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setViewMode("bracket")}
                      >
                        Bracket
                      </Button>
                    </div>
                  </div>

                  {/* Progression Actions */}
                  {selectedEvent.status !== "completed" && (
                    <div className="mt-4 flex gap-2">
                      {selectedEvent.currentPhase === "time_trial" && (
                        <Button
                          size="sm"
                          onClick={() => handleProcessProgression("time_trial")}
                        >
                          Process Time Trial → Generate Bracket
                        </Button>
                      )}
                      {["quarterfinal", "semifinal"].includes(
                        selectedEvent.currentPhase
                      ) && (
                        <Button
                          size="sm"
                          onClick={() => handleProcessProgression("knockout")}
                        >
                          Process {PHASE_NAMES[selectedEvent.currentPhase]}{" "}
                          Results
                        </Button>
                      )}
                      {["final_a", "final_b"].includes(
                        selectedEvent.currentPhase
                      ) && (
                        <Button
                          size="sm"
                          onClick={() => handleProcessProgression("finals")}
                        >
                          Process Finals & Assign Medals
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-6">
                  {viewMode === "bracket" ? (
                    <BracketView bracket={bracket} />
                  ) : (
                    <div className="space-y-4">
                      {eventDetail?.races?.length > 0 ? (
                        // Group races by phase
                        PHASE_ORDER.map((phase) => {
                          const phaseRaces = eventDetail.races.filter(
                            (r) => r.phase === phase
                          );
                          if (phaseRaces.length === 0) return null;

                          return (
                            <div key={phase}>
                              <h3 className="font-semibold text-slate-700 mb-2">
                                {PHASE_NAMES[phase]}
                              </h3>
                              <div className="grid gap-3">
                                {phaseRaces.map((race) => (
                                  <RaceCard
                                    key={race._id}
                                    race={race}
                                    onRecordResults={(race) => {
                                      setSelectedRace(race);
                                      setShowResultsDialog(true);
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          No races generated yet. Add entries and generate time
                          trials.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
                Select an event to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showCreateEvent && competition && (
        <CreateEventDialog
          competition={competition}
          onSave={handleCreateEvent}
          onCancel={() => setShowCreateEvent(false)}
        />
      )}

      {showResultsDialog && selectedRace && (
        <ResultsDialog
          race={selectedRace}
          onSave={handleRecordResults}
          onCancel={() => {
            setShowResultsDialog(false);
            setSelectedRace(null);
          }}
        />
      )}
    </div>
  );
}
