import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock3,
  Filter,
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
  boatClass?.names?.en ||
  boatClass?.name ||
  boatClass?.nameAr ||
  boatClass?.code ||
  "Boat class";

const getBoatClassCode = (boatClass) => boatClass?.code || "";

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

const getEntryName = (entry) =>
  entry?.athleteName ||
  entry?.athleteNameAr ||
  entry?.clubName ||
  entry?.sourceRaceName ||
  "Entry";

const getEntryClub = (entry) =>
  entry?.clubCode || entry?.clubName || entry?.clubNameAr || "Club";

const getRaceEventLabel = (race) => {
  const categoryLabel = getCategoryLabel(race?.category);
  const boatClassLabel = getBoatClassLabel(race?.boatClass);
  return [categoryLabel, boatClassLabel].filter(Boolean).join(" / ");
};

const getRaceEventCode = (race) => {
  const categoryCode = getCategoryCode(race?.category);
  const boatClassCode = getBoatClassCode(race?.boatClass);
  return [categoryCode, boatClassCode].filter(Boolean).join(" / ");
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
  const [stageFilter, setStageFilter] = useState("all");

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

  const stageFilters = useMemo(() => {
    const filters = new Map();

    (programme || []).forEach((race) => {
      const key = race.sessionLabel || formatDate(race.startTime);
      if (!filters.has(key)) {
        filters.set(key, {
          key,
          label: race.sessionLabel || formatDate(race.startTime),
        });
      }
    });

    return [{ key: "all", label: "All stages" }, ...filters.values()];
  }, [programme]);

  const filteredProgramme = useMemo(() => {
    const races =
      stageFilter === "all"
        ? programme
        : programme.filter(
            (race) =>
              (race.sessionLabel || formatDate(race.startTime)) === stageFilter,
          );

    return [...races].sort((a, b) => {
      const aTime = new Date(a.startTime || 0).getTime();
      const bTime = new Date(b.startTime || 0).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return Number(a.order || 0) - Number(b.order || 0);
    });
  }, [programme, stageFilter]);

  const isWomenRace = (race) => {
    const gender = race?.category?.gender?.toString().toLowerCase();
    return gender === "women" || gender === "female";
  };

  const programmeColumns = useMemo(() => {
    const women = [];
    const men = [];

    filteredProgramme.forEach((race) => {
      if (isWomenRace(race)) {
        women.push(race);
      } else {
        men.push(race);
      }
    });

    return {
      men,
      women,
    };
  }, [filteredProgramme]);

  const groupedResults = useMemo(() => {
    return [...results].sort(
      (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
    );
  }, [results]);

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

            <div className="pub-pills">
              {stageFilters.map((filter) => (
                <button
                  key={filter.key}
                  className={`pub-pill ${stageFilter === filter.key ? "pub-pill--active" : ""}`}
                  type="button"
                  onClick={() => setStageFilter(filter.key)}
                >
                  {filter.key === "all" ? <Filter size={12} /> : null}
                  {filter.label}
                </button>
              ))}
            </div>

            {filteredProgramme.length === 0 ? (
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
              <div className="pub-programme-columns">
                {[
                  {
                    key: "men",
                    label: "Men's Events",
                    races: programmeColumns.men,
                  },
                  {
                    key: "women",
                    label: "Women's Events",
                    races: programmeColumns.women,
                  },
                ].map((column) => (
                  <section className="pub-programme-column" key={column.key}>
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

                    {column.races.length === 0 ? (
                      <div className="pub-empty pub-empty--compact">
                        <Clock3 className="pub-empty__icon" />
                        <h4 className="pub-empty__title">
                          No {column.label.toLowerCase()}
                        </h4>
                        <p className="pub-empty__text">
                          Published races for this category will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="pub-grid" style={{ gap: 16 }}>
                        {column.races.map((race) => (
                          <article className="pub-race-card" key={race._id}>
                            <div className="pub-race-card__header">
                              <div>
                                <h3 className="pub-race-card__name">
                                  {getRaceEventLabel(race) ||
                                    race.name ||
                                    "Race"}
                                </h3>
                                <div className="pub-race-card__badges">
                                  {getRaceEventCode(race) ? (
                                    <span className="pub-badge pub-badge--season">
                                      {getRaceEventCode(race)}
                                    </span>
                                  ) : null}
                                  <span
                                    className={`pub-race-card__status pub-race-card__status--${String(race.status || "scheduled")}`}
                                  >
                                    {String(race.status || "scheduled").replace(
                                      /_/g,
                                      " ",
                                    )}
                                  </span>
                                </div>
                              </div>
                              <div className="pub-race-card__time">
                                <Calendar size={14} />
                                {race.startTime
                                  ? formatDateTime(race.startTime)
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
                                          {getEntryClub(lane)}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
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

            {groupedResults.length === 0 ? (
              <div className="pub-empty">
                <Award className="pub-empty__icon" />
                <h4 className="pub-empty__title">Results not published yet</h4>
                <p className="pub-empty__text">
                  Official standings will appear here when the federation
                  publishes them.
                </p>
              </div>
            ) : (
              <div className="pub-grid" style={{ gap: 18 }}>
                {groupedResults.map((group) => {
                  const podium = (group.entries || []).slice(0, 3);

                  return (
                    <article
                      className="pub-info-card"
                      key={`${group.eventGroupId || group.eventLabel || group._id}`}
                    >
                      <div className="pub-info-card__title">
                        <Trophy size={16} />
                        {getRaceEventLabel(group) || group.eventLabel}
                      </div>

                      <div
                        className="pub-detail-hero__meta"
                        style={{ marginBottom: 16 }}
                      >
                        <span className="pub-meta__item">
                          <ShieldCheck size={14} />
                          {group.rankingSystem?.nameEn || "Official ranking"}
                        </span>
                        <span className="pub-meta__item">
                          <Users size={14} />
                          {group.totalParticipants ||
                            (group.entries || []).length}{" "}
                          participants
                        </span>
                        <span className="pub-meta__item">
                          <Calendar size={14} />
                          {group.publishedAt
                            ? formatDateTime(group.publishedAt)
                            : "Publication date unavailable"}
                        </span>
                      </div>

                      <div className="pub-podium pub-podium--compact">
                        {podium.map((entry, index) => (
                          <div
                            key={`${group.eventGroupId || group._id}-${index}`}
                            className={`pub-podium__block pub-podium__block--${index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}`}
                          >
                            <div className="pub-podium__rank">{index + 1}</div>
                            <div className="pub-podium__label">
                              {index === 0
                                ? "Winner"
                                : index === 1
                                  ? "Runner-up"
                                  : "Third"}
                            </div>
                            <div className="pub-podium__name">
                              {getEntryName(entry)}
                            </div>
                            <div className="pub-podium__club">
                              {getEntryClub(entry)}
                            </div>
                            <div className="pub-podium__time">
                              {entry.status === "ok"
                                ? formatTime(entry.elapsedMs)
                                : String(entry.status || "—").toUpperCase()}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pub-table-wrap" style={{ marginTop: 16 }}>
                        <table className="pub-table pub-table--compact">
                          <thead>
                            <tr>
                              <th className="col-pos">Pos</th>
                              <th className="col-name">Athlete / Crew</th>
                              <th className="col-club">Club</th>
                              <th className="col-lane">Lane</th>
                              <th className="col-time">Time</th>
                              <th className="col-status">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(group.entries || []).map((entry, index) => (
                              <tr
                                key={`${group.eventGroupId || group._id}-${entry.lane || index}-${index}`}
                              >
                                <td className="col-pos">
                                  {entry.rank ||
                                    entry.finishPosition ||
                                    index + 1}
                                </td>
                                <td className="col-name">
                                  {getEntryName(entry)}
                                </td>
                                <td className="col-club">
                                  {getEntryClub(entry)}
                                </td>
                                <td className="col-lane">
                                  {entry.lane || "—"}
                                </td>
                                <td className="col-time">
                                  {entry.status === "ok"
                                    ? formatTime(entry.elapsedMs)
                                    : "—"}
                                </td>
                                <td className="col-status">
                                  {String(entry.status || "ok").replace(
                                    /_/g,
                                    " ",
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
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
