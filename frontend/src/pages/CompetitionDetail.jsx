import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  ChevronDown,
  Clock3,
  Download,
  Loader2,
  Info,
  MapPin,
  Medal,
  Radio,
  Sparkles,
  Trophy,
  Users,
  Waves,
  Flag,
  Award,
  ShieldCheck,
} from "lucide-react";
import {
  formatEntryClub,
  formatEntryClubShort,
  formatEntryName,
  formatEntryAffiliation,
  formatProgressionRule,
  formatBoatCode,
  formatBoatClassName,
  formatEventLabel,
  formatDayLabel,
  formatTimeOfDay,
  getAffiliationMode,
  getPodiumEntries,
  groupEntriesByPhase,
  groupRacesByEventGroupId,
  isHeatPhase,
  formatPhaseSummary,
} from "../lib/format";
import {
  generateRaceResultsPdf,
  generateFullResultsPdf,
} from "../lib/publicResultsPdf";
import "../public.css";

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "To be confirmed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatTime = (ms) => {
  if (!Number.isFinite(ms)) return "—";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths
    .toString()
    .padStart(2, "0")}`;
};

const getCompetitionTitle = (competition) =>
  competition?.names?.en || competition?.code || "Competition";

const getCategoryLabel = (category) =>
  category?.titles?.en ||
  category?.name ||
  category?.nameAr ||
  category?.abbreviation ||
  category?.code ||
  "Category";

const getCategoryCode = (category) =>
  category?.abbreviation || category?.code || "";

const getBoatClassLabel = (boatClass) =>
  formatBoatCode(
    boatClass?.names?.en ||
      boatClass?.name ||
      boatClass?.nameAr ||
      boatClass?.code ||
      "Boat class",
  );

const getBoatClassCode = (boatClass) => formatBoatCode(boatClass?.code || "");

const getVenueLabel = (competition) => {
  const venue = competition?.venue || {};
  const parts = [venue.name, venue.city, venue.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Venue to be confirmed";
};

const getOrganizerLabel = (competition) => {
  const organizer = competition?.organizer || {};
  const parts = [organizer.primary, organizer.secondary].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Organizer to be confirmed";
};

const getDisciplineIcon = (discipline) => {
  switch (discipline) {
    case "coastal":
      return <Waves size={14} />;
    case "beach":
      return <Flag size={14} />;
    case "indoor":
      return <Radio size={14} />;
    default:
      return <Trophy size={14} />;
  }
};

const getDisciplineLabel = (discipline) => {
  switch (discipline) {
    case "classic":
      return "Classic Rowing";
    case "coastal":
      return "Coastal Rowing";
    case "beach":
      return "Beach Sprint";
    case "indoor":
      return "Indoor Rowing";
    default:
      return "Rowing";
  }
};

const getEntryName = (entry) => formatEntryName(entry);

const getEntryClub = (entry) => formatEntryClub(entry);

const getRaceEventLabel = (race) => {
  const categoryLabel = getCategoryLabel(race?.category);
  const boatClassLabel = getBoatClassLabel(race?.boatClass);
  return [categoryLabel, boatClassLabel].filter(Boolean).join(" / ");
};

const getRaceEventCode = (race) => {
  const categoryCode = getCategoryCode(race?.category);
  const boatClassCode = getBoatClassCode(race?.boatClass);
  return formatEventLabel(`${categoryCode} ${boatClassCode}`);
};

const CompetitionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [competition, setCompetition] = useState(null);
  const [programme, setProgramme] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("programme");
  // Collapsed-by-default day accordions (programme & results tabs)
  const [openProgrammeDay, setOpenProgrammeDay] = useState(null);
  const [openResultDay, setOpenResultDay] = useState(null);

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (["programme", "results", "info"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.15 },
    );

    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    els.forEach((el) => {
      // If element is already mostly in the viewport, reveal immediately
      try {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) {
          el.classList.add("is-visible");
        }
      } catch (e) {
        /* ignore */
      }
      observer.observe(el);
    });
    // Fallback: reveal the first main section immediately so page doesn't appear blank
    try {
      const firstSection = document.querySelector(".pub-section");
      if (firstSection && !firstSection.classList.contains("is-visible")) {
        firstSection.classList.add("is-visible");
      }
    } catch (e) {
      /* ignore */
    }

    return () => observer.disconnect();
  }, [competition, programme.length, results.length, activeTab]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [competitionResponse, programmeResponse, resultsResponse] =
          await Promise.all([
            fetch(`/api/public/competitions/${id}`),
            fetch(`/api/public/competitions/${id}/programme`),
            fetch(`/api/public/competitions/${id}/results`),
          ]);

        if (!competitionResponse.ok) {
          const payload = await competitionResponse.json().catch(() => null);
          throw new Error(payload?.message || "Competition not found");
        }

        setCompetition(await competitionResponse.json());

        setProgramme(
          programmeResponse.ok ? await programmeResponse.json() : [],
        );
        setResults(resultsResponse.ok ? await resultsResponse.json() : []);
      } catch (err) {
        console.error("Failed to load public competition detail:", err);
        setError(err.message || "Unable to load competition details");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  // Races grouped by day, each day sorted by time from first to last.
  const programmeDays = useMemo(() => {
    const days = new Map();
    [...(programme || [])]
      .sort((a, b) => {
        const aTime = new Date(a.startTime || 0).getTime();
        const bTime = new Date(b.startTime || 0).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return Number(a.order || 0) - Number(b.order || 0);
      })
      .forEach((race) => {
        const key = formatDayLabel(race.startTime);
        if (!days.has(key)) days.set(key, []);
        days.get(key).push(race);
      });
    return [...days.entries()].map(([day, races]) => ({ day, races }));
  }, [programme]);

  const isWomenRace = (race) => {
    const gender = race?.category?.gender?.toString().toLowerCase();
    return gender === "women" || gender === "female";
  };

  // International championships run by nation display countries; national
  // competitions display clubs. Mixed regattas show what each entry has.
  const affiliationMode = useMemo(
    () => getAffiliationMode(competition),
    [competition],
  );
  const hostCountry = competition?.scope?.hostCountry || "";

  const getAffiliation = (entry) =>
    formatEntryAffiliation(entry, affiliationMode, hostCountry);

  // Lane chips are tight: in club mode use the short club code so the
  // athlete name stays readable.
  const getLaneAffiliation = (lane) =>
    affiliationMode === "club"
      ? formatEntryClubShort(lane)
      : getAffiliation(lane);

  const affiliationColumnLabel =
    affiliationMode === "nation"
      ? "Nation"
      : affiliationMode === "mixed"
        ? "Club / Nation"
        : "Club";

  // Ranking systems are named by the federation ("Club Ranking by Gender");
  // in by-nation events the same word should read "Nation".
  const rankingLabel = (name) => {
    if (!name) return "Official ranking";
    return affiliationMode === "club" ? name : name.replace(/club/gi, "Nation");
  };

  const statusClass = (status) => {
    const value = String(status || "ok").toLowerCase();
    if (value === "ok") return "pub-status--ok";
    if (value === "dsq") return "pub-status--bad";
    return "pub-status--warn";
  };

  const exportGroupPdf = (group) => {
    try {
      generateRaceResultsPdf({
        competition,
        group,
        races: raceGroupsByEventId.get(group.eventGroupId) || {
          heats: [],
          final: null,
        },
        mode: affiliationMode,
        hostCountry,
      });
    } catch (err) {
      console.error("Failed to generate the event results PDF:", err);
    }
  };

  const exportFullPdf = () => {
    try {
      generateFullResultsPdf({
        competition,
        groups: results,
        programme,
        mode: affiliationMode,
        hostCountry,
      });
    } catch (err) {
      console.error("Failed to generate the full results PDF:", err);
    }
  };

  // Final phase available for each category+boat group, so heat races can
  // show their progression target.
  const finalPhaseByGroup = useMemo(() => {
    const map = new Map();
    (programme || []).forEach((race) => {
      if (/^final/i.test(String(race.phase || ""))) {
        const key = `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`;
        if (!map.has(key)) map.set(key, race.phase);
      }
    });
    return map;
  }, [programme]);

  // Programme races indexed per result group, so heat results can show the
  // FULL crew list of each heat race (published groups only keep a subset).
  const raceGroupsByEventId = useMemo(
    () => groupRacesByEventGroupId(programme),
    [programme],
  );

  // Results grouped by the day their decisive race took place, each day
  // sorted by time from first to last.
  const resultDays = useMemo(() => {
    const days = new Map();
    (results || []).forEach((group) => {
      const races =
        raceGroupsByEventId.get(group.eventGroupId) || {
          heats: [],
          final: null,
        };
      const decisive =
        races.final?.startTime || races.heats?.[0]?.startTime || group.publishedAt;
      const time = new Date(decisive || 0).getTime();
      const key = formatDayLabel(decisive);
      if (!days.has(key)) days.set(key, { dayTime: time, items: [] });
      days.get(key).items.push({ group, time });
    });
    return [...days.entries()]
      .map(([day, { dayTime, items }]) => ({
        day,
        dayTime,
        groups: items.sort((a, b) => a.time - b.time).map((item) => item.group),
      }))
      .sort((a, b) => a.dayTime - b.dayTime);
  }, [results, raceGroupsByEventId]);

  const competitionTitle = getCompetitionTitle(competition);

  if (loading) {
    return (
      <div className="pub-page">
        <div className="pub-ambient" />
        <div
          className="pub-spinner-wrap"
          style={{ position: "relative", zIndex: 1 }}
        >
          <Loader2 className="pub-spinner" />
          <span className="pub-spinner-text">Loading competition detail</span>
        </div>
      </div>
    );
  }

  if (error || !competition) {
    return (
      <div className="pub-page">
        <div className="pub-ambient" />
        <div
          className="pub-container"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="pub-error" style={{ marginTop: 64 }}>
            <Info className="pub-error__icon" />
            <h3 className="pub-error__title">Competition not available</h3>
            <p className="pub-error__text">
              {error || "We could not find this competition."}
            </p>
            <button
              className="pub-error__btn"
              type="button"
              onClick={() => navigate("/")}
            >
              <ArrowLeft size={14} />
              Back to home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pub-page">
      <div className="pub-ambient" />

      <header className="pub-detail-hero pub-reveal" data-reveal>
        <div className="pub-container pub-container--detail">
          <button
            className="pub-detail-hero__back"
            type="button"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={14} />
            Back to home
          </button>

          <div className="pub-detail-hero__badges">
            <span className="pub-badge pub-badge--season">
              Season {competition.season}
            </span>
            <span className="pub-badge pub-badge--upcoming">
              {competition.status === "completed"
                ? "Completed"
                : competition.status === "published"
                  ? "Published"
                  : "Draft"}
            </span>
            <span className="pub-badge pub-badge--ongoing">
              {competition.registrationStatus?.replace(/_/g, " ") ||
                "Registration pending"}
            </span>
          </div>

          <h1 className="pub-detail-hero__title">{competitionTitle}</h1>
          <p className="pub-detail-hero__summary">
            {getDisciplineLabel(competition.discipline)} · {competition.code}
          </p>

          <div className="pub-detail-hero__meta">
            <span className="pub-meta__item">
              <Calendar size={14} />
              {formatDate(competition.startDate)} –{" "}
              {formatDate(competition.endDate)}
            </span>
            <span className="pub-meta__item">
              <MapPin size={14} />
              {getVenueLabel(competition)}
            </span>
            <span className="pub-meta__item">
              <Building2 size={14} />
              {getOrganizerLabel(competition)}
            </span>
          </div>
        </div>
      </header>

      <main className="pub-container pub-container--detail">
        <div className="pub-tabs pub-reveal" data-reveal>
          <button
            className={`pub-tab ${activeTab === "programme" ? "pub-tab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("programme")}
          >
            <Clock3 size={14} />
            Programme
          </button>
          <button
            className={`pub-tab ${activeTab === "results" ? "pub-tab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("results")}
          >
            <Medal size={14} />
            Results
          </button>
          <button
            className={`pub-tab ${activeTab === "info" ? "pub-tab--active" : ""}`}
            type="button"
            onClick={() => setActiveTab("info")}
          >
            <Info size={14} />
            Event Info
          </button>
        </div>

        {activeTab === "programme" && (
          <section className="pub-section pub-reveal" data-reveal>
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon accent">
                  <Clock3 size={16} />
                </span>
                Race Programme
              </h2>
            </div>

            {programmeDays.length === 0 ? (
              <div className="pub-empty">
                <Clock3 className="pub-empty__icon" />
                <h4 className="pub-empty__title">
                  Programme not published yet
                </h4>
                <p className="pub-empty__text">
                  The race schedule will appear here once it is released.
                </p>
              </div>
            ) : (
              programmeDays.map(({ day, races }) => {
                const isOpen = openProgrammeDay === day;
                const dayColumns = [
                  {
                    key: "men",
                    label: "Men's Events",
                    races: races.filter((race) => !isWomenRace(race)),
                  },
                  {
                    key: "women",
                    label: "Women's Events",
                    races: races.filter((race) => isWomenRace(race)),
                  },
                ].filter((column) => column.races.length > 0);

                return (
                  <div className="pub-day-section" key={day}>
                    <button
                      type="button"
                      className="pub-day-section__header"
                      onClick={() =>
                        setOpenProgrammeDay(isOpen ? null : day)
                      }
                      aria-expanded={isOpen}
                    >
                      <span className="pub-day-section__title">{day}</span>
                      <span className="pub-day-section__meta">
                        <span className="pub-day-section__count">
                          {races.length} race{races.length === 1 ? "" : "s"}
                        </span>
                        <ChevronDown
                          size={16}
                          className={`pub-day-section__chevron ${isOpen ? "is-open" : ""}`}
                        />
                      </span>
                    </button>
                    {isOpen && (
                    <div className="pub-programme-columns">
                      {dayColumns.map((column) => (
                        <section
                          className="pub-programme-column"
                          key={column.key}
                        >
                          <div className="pub-programme-column__header">
                            <div>
                              <h3 className="pub-programme-column__title">
                                {column.label}
                              </h3>
                              <p className="pub-programme-column__subtitle">
                                {column.races.length} race
                                {column.races.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          <div className="pub-grid" style={{ gap: 16 }}>
                            {column.races.map((race) => (
                              <article className="pub-race-card" key={race._id}>
                                <div className="pub-race-card__header">
                                  <div>
                                    <h3 className="pub-race-card__name">
                                      {getCategoryLabel(race.category) ||
                                        getRaceEventLabel(race) ||
                                        race.name ||
                                        "Race"}
                                      {formatBoatClassName(
                                        race.boatClass?.code,
                                      ) && (
                                        <span className="pub-race-card__boat-name">
                                          {" "}
                                          —{" "}
                                          {formatBoatClassName(
                                            race.boatClass?.code,
                                          )}
                                        </span>
                                      )}
                                    </h3>
                                    <div className="pub-race-card__badges">
                                      {getRaceEventCode(race) ? (
                                        <span className="pub-badge pub-badge--season pub-badge--code">
                                          {getRaceEventCode(race)}
                                        </span>
                                      ) : null}
                                      {race.phase ? (
                                        <span
                                          className={`pub-badge ${isHeatPhase(race.phase) ? "pub-badge--heat" : "pub-badge--final"}`}
                                        >
                                          {race.phase}
                                        </span>
                                      ) : null}
                                      {isHeatPhase(race.phase) &&
                                      finalPhaseByGroup.get(
                                        `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`,
                                      ) ? (
                                        <span
                                          className="pub-badge pub-badge--progression"
                                          title={formatProgressionRule(
                                            finalPhaseByGroup.get(
                                              `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`,
                                            ),
                                          )}
                                        >
                                          →{" "}
                                          {
                                            finalPhaseByGroup.get(
                                              `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`,
                                            )
                                          }
                                        </span>
                                      ) : null}
                                      <span
                                        className={`pub-race-card__status pub-race-card__status--${String(race.status || "scheduled")}`}
                                      >
                                        {String(
                                          race.status || "scheduled",
                                        ).replace(/_/g, " ")}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="pub-race-card__time">
                                    <Calendar size={14} />
                                    {race.startTime
                                      ? formatTimeOfDay(race.startTime)
                                      : "To be announced"}
                                  </div>
                                </div>

                                {race.notes ? (
                                  <p className="pub-race-card__notes">
                                    {race.notes}
                                  </p>
                                ) : null}

                                {Array.isArray(race.lanes) &&
                                race.lanes.length > 0 ? (
                                  <div className="pub-race-card__lanes">
                                    <div className="pub-race-card__lanes-title">
                                      Entries
                                    </div>
                                    <div className="pub-race-card__lane-grid">
                                      {race.lanes
                                        .slice()
                                        .sort((a, b) => a.lane - b.lane)
                                        .map((lane) => (
                                          <div
                                            className="pub-race-card__lane"
                                            key={`${race._id}-${lane.lane}`}
                                          >
                                            <div className="pub-race-card__lane-num">
                                              {lane.lane}
                                            </div>
                                            <div className="pub-race-card__lane-name">
                                              {getEntryName(lane)}
                                            </div>
                                            <div className="pub-race-card__lane-club">
                                              {getLaneAffiliation(lane)}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        {activeTab === "results" && (
          <section className="pub-section pub-reveal" data-reveal>
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon gold">
                  <Medal size={16} />
                </span>
                Official Results
              </h2>
            </div>

            {results.length > 0 && (
              <div className="pub-results-toolbar">
                <button
                  className="pub-event__more-link"
                  onClick={exportFullPdf}
                  type="button"
                >
                  <Download size={14} />
                  Download full results (PDF)
                </button>
              </div>
            )}
            {results.length === 0 ? (
              <div className="pub-empty">
                <Award className="pub-empty__icon" />
                <h4 className="pub-empty__title">Results not published yet</h4>
                <p className="pub-empty__text">
                  Official standings will appear here when the federation
                  publishes them.
                </p>
              </div>
            ) : (
              resultDays.map(({ day, groups: dayGroups }) => {
                const isOpen = openResultDay === day;
                return (
                <div className="pub-day-section" key={day}>
                  <button
                    type="button"
                    className="pub-day-section__header"
                    onClick={() => setOpenResultDay(isOpen ? null : day)}
                    aria-expanded={isOpen}
                  >
                    <span className="pub-day-section__title">{day}</span>
                    <span className="pub-day-section__meta">
                      <span className="pub-day-section__count">
                        {dayGroups.length} event
                        {dayGroups.length === 1 ? "" : "s"}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`pub-day-section__chevron ${isOpen ? "is-open" : ""}`}
                      />
                    </span>
                  </button>
                  {isOpen && (
                  <div className="pub-grid" style={{ gap: 18 }}>
                    {dayGroups.map((group) => {
                  const phaseGroups = groupEntriesByPhase(group.entries);
                  const entriesHaveHeats = phaseGroups.some((p) =>
                    isHeatPhase(p.phase),
                  );
                  const groupRaces =
                    raceGroupsByEventId.get(group.eventGroupId) || {
                      heats: [],
                      final: null,
                    };
                  const heatRaces = groupRaces.heats || [];
                  const hasHeats =
                    heatRaces.length > 0 || entriesHaveHeats;
                  const finalRace = groupRaces.final || null;
                  const finalPhaseLabel =
                    finalRace?.phase ||
                    phaseGroups.find((p) => /^final/i.test(p.phase))?.phase ||
                    "";
                  const finalPhase = phaseGroups.find((p) =>
                    /^final/i.test(p.phase),
                  );
                  const heatPhases = phaseGroups.filter((p) =>
                    isHeatPhase(p.phase),
                  );
                  const podium = getPodiumEntries(group.entries).slice(0, 3);
                  const progressionRule =
                    formatProgressionRule(finalPhaseLabel);
                  const raceDate =
                    finalRace?.startTime ||
                    heatRaces[0]?.startTime ||
                    group.publishedAt;
                  const labelKey =
                    formatEventLabel(group.eventLabel) ||
                    getRaceEventLabel(group);

                  // Crews that reached the final → "Q" badge in heat tables
                  const finalistNames = new Set();
                  (finalRace?.lanes || []).forEach((lane) => {
                    const name = formatEntryName(lane);
                    if (name) finalistNames.add(name.toLowerCase().trim());
                  });
                  (finalPhase?.entries || []).forEach((entry) => {
                    const name = formatEntryName(entry);
                    if (name) finalistNames.add(name.toLowerCase().trim());
                  });

                  const raceLaneRows = (race) =>
                    (race.lanes || [])
                      .map((lane) => ({
                        pos:
                          lane.result?.finishPosition ??
                          (Number.isFinite(lane.result?.elapsedMs)
                            ? null
                            : "—"),
                        elapsedMs: lane.result?.elapsedMs,
                        name: formatEntryName(lane),
                        affiliation: getAffiliation(lane),
                        lane: lane.lane,
                        status: lane.result?.status || "ok",
                        time:
                          lane.result?.status === "ok" &&
                          Number.isFinite(lane.result?.elapsedMs)
                            ? formatTime(lane.result.elapsedMs)
                            : lane.result?.status
                              ? String(lane.result.status).toUpperCase()
                              : "—",
                        qualified: finalistNames.has(
                          formatEntryName(lane).toLowerCase().trim(),
                        ),
                      }))
                      .sort((a, b) => {
                        const posA =
                          typeof a.pos === "number"
                            ? a.pos
                            : Number.MAX_SAFE_INTEGER;
                        const posB =
                          typeof b.pos === "number"
                            ? b.pos
                            : Number.MAX_SAFE_INTEGER;
                        if (posA !== posB) return posA - posB;
                        return (a.elapsedMs ?? Infinity) - (b.elapsedMs ?? Infinity);
                      });

                  const entryRows = (entries) =>
                    (entries || []).map((entry, index) => ({
                      pos: entry.finishPosition || entry.rank || index + 1,
                      name: getEntryName(entry),
                      affiliation: getAffiliation(entry),
                      lane: entry.lane,
                      time:
                        entry.status === "ok"
                          ? formatTime(entry.elapsedMs)
                          : "—",
                      status: String(entry.status || "ok").replace(/_/g, " "),
                      qualified: finalistNames.has(
                        getEntryName(entry).toLowerCase().trim(),
                      ),
                    }));

                  const renderTable = (rows, keyPrefix, showQualification) => (
                    <div className="pub-table-wrap" style={{ marginTop: 12 }}>
                      <table className="pub-table pub-table--compact">
                        <thead>
                          <tr>
                            <th className="col-pos">Pos</th>
                            <th className="col-name">Athlete / Crew</th>
                            <th className="col-club">
                              {affiliationColumnLabel}
                            </th>
                            <th className="col-lane">Lane</th>
                            <th className="col-time">Time</th>
                            <th className="col-status">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr key={`${keyPrefix}-${index}`}>
                              <td className="col-pos">{row.pos ?? index + 1}</td>
                              <td className="col-name">
                                {row.name}
                                {showQualification && row.qualified && (
                                  <span
                                    className="pub-qual-badge"
                                    title={`Qualified for ${finalPhaseLabel}`}
                                  >
                                    Q
                                  </span>
                                )}
                              </td>
                              <td className="col-club">{row.affiliation}</td>
                              <td className="col-lane">
                                {row.lane || "—"}
                              </td>
                              <td className="col-time">{row.time}</td>
                              <td className="col-status">
                                <span
                                  className={`pub-status ${statusClass(row.status)}`}
                                >
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );

                  return (
                    <article
                      className="pub-info-card"
                      key={`${group.eventGroupId || group.eventLabel || group._id}`}
                    >
                      <div className="pub-info-card__title">
                        <Trophy size={16} />
                        {labelKey}
                        {hasHeats && (
                          <span className="pub-phase-summary">
                            {formatPhaseSummary(group.entries)}
                          </span>
                        )}
                        <button
                          className="pub-btn-pdf"
                          onClick={() => exportGroupPdf(group)}
                          type="button"
                          title="Download this event's results (PDF)"
                        >
                          <Download size={12} />
                          PDF
                        </button>
                      </div>

                      <div
                        className="pub-detail-hero__meta"
                        style={{ marginBottom: 16 }}
                      >
                        <span className="pub-meta__item">
                          <ShieldCheck size={14} />
                          {rankingLabel(group.rankingSystem?.nameEn)}
                        </span>
                        <span className="pub-meta__item">
                          <Users size={14} />
                          {group.totalParticipants ||
                            (group.entries || []).length}{" "}
                          participants
                        </span>
                        <span className="pub-meta__item">
                          <Calendar size={14} />
                          {raceDate
                            ? formatDateTime(raceDate)
                            : "Date unavailable"}
                        </span>
                      </div>

                      {podium.length > 0 && (
                        <div className="pub-podium pub-podium--compact">
                          {podium.map((entry, index) => (
                            <div
                              key={`${group.eventGroupId || group._id}-${index}`}
                              className={`pub-podium__block pub-podium__block--${index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}`}
                            >
                              <div className="pub-podium__rank">{index + 1}</div>
                              <div className="pub-podium__label">
                                {hasHeats && finalPhaseLabel
                                  ? `Winner · ${finalPhaseLabel}`
                                  : index === 0
                                    ? "Winner"
                                    : index === 1
                                      ? "Runner-up"
                                      : "Third"}
                              </div>
                              <div className="pub-podium__name">
                                {getEntryName(entry)}
                              </div>
                              <div className="pub-podium__club">
                                {getAffiliation(entry)}
                              </div>
                              <div className="pub-podium__time">
                                {entry.status === "ok"
                                  ? formatTime(entry.elapsedMs)
                                  : String(entry.status || "—").toUpperCase()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {hasHeats ? (
                        <>
                          {finalPhase && (
                            <div className="pub-phase-block">
                              <div className="pub-phase-block__header">
                                <span className="pub-phase-block__title">
                                  {finalPhase.phase}
                                </span>
                                <span className="pub-phase-block__hint">
                                  Final standings
                                </span>
                              </div>
                              {renderTable(
                                entryRows(finalPhase.entries),
                                `${group.eventGroupId}-final`,
                              )}
                            </div>
                          )}
                          {heatRaces.length > 0
                            ? heatRaces.map((race) => (
                                <div
                                  className="pub-phase-block"
                                  key={race._id}
                                >
                                  <div className="pub-phase-block__header">
                                    <span className="pub-phase-block__title">
                                      {race.phase || race.name}
                                    </span>
                                    {progressionRule && (
                                      <span className="pub-phase-block__progression">
                                        {progressionRule}
                                      </span>
                                    )}
                                  </div>
                                  {renderTable(
                                    raceLaneRows(race),
                                    `${race._id}`,
                                    true,
                                  )}
                                </div>
                              ))
                            : heatPhases.map((phaseGroup) => (
                                <div
                                  className="pub-phase-block"
                                  key={phaseGroup.phase}
                                >
                                  <div className="pub-phase-block__header">
                                    <span className="pub-phase-block__title">
                                      {phaseGroup.phase}
                                    </span>
                                    {progressionRule && (
                                      <span className="pub-phase-block__progression">
                                        {progressionRule}
                                      </span>
                                    )}
                                  </div>
                                  {renderTable(
                                    entryRows(phaseGroup.entries),
                                    `${group.eventGroupId}-${phaseGroup.phase}`,
                                    true,
                                  )}
                                </div>
                              ))}
                        </>
                      ) : (
                        renderTable(entryRows(group.entries || ""), "all")
                      )}
                    </article>
                  );
                    })}
                  </div>
                  )}
                </div>
                );
              })
            )}
          </section>
        )}

        {activeTab === "info" && (
          <section className="pub-section pub-reveal" data-reveal>
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon accent">
                  <Info size={16} />
                </span>
                Event Information
              </h2>
            </div>

            <div className="pub-info-grid">
              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <Sparkles size={16} />
                  Overview
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Discipline</span>
                  <span className="pub-info-row__value">
                    {getDisciplineLabel(competition.discipline)}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Competition type</span>
                  <span className="pub-info-row__value">
                    {competition.competitionType?.replace(/_/g, " ") ||
                      "Single day"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Status</span>
                  <span className="pub-info-row__value">
                    {competition.status}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Registration</span>
                  <span className="pub-info-row__value">
                    {competition.registrationStatus?.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Results</span>
                  <span className="pub-info-row__value">
                    {competition.resultsStatus}
                  </span>
                </div>
              </div>

              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <MapPin size={16} />
                  Venue
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Name</span>
                  <span className="pub-info-row__value">
                    {competition.venue?.name || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Address</span>
                  <span className="pub-info-row__value">
                    {competition.venue?.address || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">City</span>
                  <span className="pub-info-row__value">
                    {competition.venue?.city || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Country</span>
                  <span className="pub-info-row__value">
                    {competition.venue?.country || "TBD"}
                  </span>
                </div>
              </div>

              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <Building2 size={16} />
                  Organizer
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Primary</span>
                  <span className="pub-info-row__value">
                    {competition.organizer?.primary || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Secondary</span>
                  <span className="pub-info-row__value">
                    {competition.organizer?.secondary || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Email</span>
                  <span className="pub-info-row__value">
                    {competition.organizer?.contactEmail || "TBD"}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Phone</span>
                  <span className="pub-info-row__value">
                    {competition.organizer?.contactPhone || "TBD"}
                  </span>
                </div>
              </div>

              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <Users size={16} />
                  Participation
                </div>
                <div className="pub-pills" style={{ paddingTop: 0 }}>
                  {competition.allowedCategories?.length ? (
                    competition.allowedCategories.map((category) => (
                      <span
                        className="pub-badge pub-badge--season"
                        key={category._id || category.code}
                      >
                        {getCategoryLabel(category)}
                      </span>
                    ))
                  ) : (
                    <span className="pub-badge pub-badge--season">
                      No category limit published
                    </span>
                  )}
                </div>

                <div className="pub-pills" style={{ paddingTop: 0 }}>
                  {competition.allowedBoatClasses?.length ? (
                    competition.allowedBoatClasses.map((boatClass) => (
                      <span
                        className="pub-badge pub-badge--season"
                        key={boatClass._id || boatClass.code}
                      >
                        {getBoatClassLabel(boatClass)}
                      </span>
                    ))
                  ) : (
                    <span className="pub-badge pub-badge--season">
                      No boat class limit published
                    </span>
                  )}
                </div>

                <div className="pub-info-row">
                  <span className="pub-info-row__label">Summary</span>
                  <span className="pub-info-row__value">
                    {competition.allowedCategories?.length || 0} categories ·{" "}
                    {competition.allowedBoatClasses?.length || 0} boat classes
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default CompetitionDetail;
