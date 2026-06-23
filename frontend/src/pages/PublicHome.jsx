import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Anchor,
  ArrowRight,
  Calendar,
  ChevronRight,
  Compass,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Sparkles,
  Trophy,
  Waves,
} from "lucide-react";
import "../public.css";

const DISCIPLINES = {
  classic: { label: "Classic Rowing", css: "pub-badge--classic", Icon: Waves },
  coastal: { label: "Coastal Rowing", css: "pub-badge--coastal", Icon: Anchor },
  beach: { label: "Beach Sprint", css: "pub-badge--beach", Icon: Compass },
  indoor: { label: "Indoor Rowing", css: "pub-badge--indoor", Icon: Activity },
};

const FALLBACK_DISCIPLINE = {
  label: "Rowing",
  css: "pub-badge--classic",
  Icon: Waves,
};

const formatTime = (ms) => {
  if (!Number.isFinite(ms)) return "-";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatRange = (start, end) => `${formatDate(start)} - ${formatDate(end)}`;

const getCompetitionTitle = (competition) =>
  competition?.names?.en || competition?.code || "Competition";

const getVenueLabel = (competition) => {
  const venue = competition?.venue || {};
  const parts = [venue.name, venue.city, venue.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Venue to be confirmed";
};

const getDiscipline = (discipline) =>
  DISCIPLINES[discipline] || FALLBACK_DISCIPLINE;

const getResultEntryTitle = (entry) =>
  entry?.athleteName || entry?.clubName || entry?.sourceRaceName || "Entry";

const getResultEntryClub = (entry) => entry?.clubName || "Club";

const buildPodiumPreview = (groups) => {
  const entries = (groups || []).flatMap((group) =>
    (group?.entries || []).map((entry) => ({
      ...entry,
      eventLabel: group.eventLabel,
    })),
  );

  return entries
    .sort((a, b) => {
      const rankA = Number.isFinite(a.rank)
        ? a.rank
        : Number.isFinite(a.finishPosition)
          ? a.finishPosition
          : 999;
      const rankB = Number.isFinite(b.rank)
        ? b.rank
        : Number.isFinite(b.finishPosition)
          ? b.finishPosition
          : 999;
      if (rankA !== rankB) return rankA - rankB;
      const timeA = Number.isFinite(a.elapsedMs)
        ? a.elapsedMs
        : Number.MAX_SAFE_INTEGER;
      const timeB = Number.isFinite(b.elapsedMs)
        ? b.elapsedMs
        : Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    })
    .slice(0, 3);
};

const DisciplineBadge = ({ discipline }) => {
  const conf = getDiscipline(discipline);
  const { Icon } = conf;

  return (
    <span className={`pub-badge ${conf.css}`}>
      <Icon size={14} />
      {conf.label}
    </span>
  );
};

const RegistrationBadge = ({ status }) => {
  if (status === "open") {
    return (
      <span className="pub-badge pub-badge--reg-open">
        <span className="pub-live-dot" />
        Registration Open
      </span>
    );
  }

  if (status === "closed") {
    return (
      <span className="pub-badge pub-badge--reg-closed">
        Registration Closed
      </span>
    );
  }

  return <span className="pub-badge pub-badge--reg-notyet">Not Open Yet</span>;
};

const StatusBadge = ({ type, children }) => (
  <span className={`pub-badge pub-badge--${type}`}>{children}</span>
);

const PublicHome = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [competitions, setCompetitions] = useState([]);
  const [liveRaces, setLiveRaces] = useState([]);
  const [resultPreviews, setResultPreviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    els.forEach((element) => {
      try {
        const rect = element.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.9) {
          element.classList.add("is-visible");
        }
      } catch (e) {
        /* ignore */
      }
      observer.observe(element);
    });

    // Fallback: ensure the first main section is visible to avoid a blank-looking page
    try {
      const firstSection = document.querySelector(".pub-section");
      if (firstSection && !firstSection.classList.contains("is-visible")) {
        firstSection.classList.add("is-visible");
      }
    } catch (e) {
      /* ignore */
    }

    return () => observer.disconnect();
  }, [
    competitions.length,
    liveRaces.length,
    resultPreviews.length,
    loading,
    error,
  ]);

  useEffect(() => {
    if (loading || error || !location.hash) return;
    const target = document.getElementById(location.hash.replace("#", ""));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, loading, error]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [competitionsResponse, liveResponse] = await Promise.all([
          fetch("/api/public/competitions"),
          fetch("/api/public/live"),
        ]);

        if (!competitionsResponse.ok) {
          throw new Error("Failed to load public competitions");
        }

        const competitionsData = await competitionsResponse.json();
        setCompetitions(competitionsData);

        if (liveResponse.ok) {
          setLiveRaces(await liveResponse.json());
        }

        const now = new Date();
        const recentCompleted = competitionsData
          .filter((competition) => {
            const endDate = new Date(competition.endDate);
            return (
              competition.status === "completed" ||
              (competition.status === "published" && endDate < now)
            );
          })
          .slice(0, 3);

        const previews = await Promise.all(
          recentCompleted.map(async (competition) => {
            try {
              const response = await fetch(
                `/api/public/competitions/${competition._id}/results`,
              );
              if (!response.ok) {
                return { competition, podium: [] };
              }

              const groups = await response.json();
              return { competition, podium: buildPodiumPreview(groups) };
            } catch {
              return { competition, podium: [] };
            }
          }),
        );

        setResultPreviews(previews);
      } catch (err) {
        console.error("Error loading public home data:", err);
        setError(
          "Unable to retrieve federation records right now. Please try again later.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const now = new Date();

  const seasons = useMemo(
    () =>
      Array.from(
        new Set(competitions.map((competition) => competition.season)),
      ).sort((a, b) => b - a),
    [competitions],
  );

  const activeComps = useMemo(
    () =>
      competitions.filter((competition) => {
        const start = new Date(competition.startDate);
        const end = new Date(competition.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return competition.status === "published" && start <= now && end >= now;
      }),
    [competitions, now],
  );

  const upcomingComps = useMemo(
    () =>
      competitions.filter((competition) => {
        const start = new Date(competition.startDate);
        return competition.status === "published" && start > now;
      }),
    [competitions, now],
  );

  const completedComps = useMemo(
    () =>
      competitions.filter((competition) => {
        const end = new Date(competition.endDate);
        return (
          competition.status === "completed" ||
          (competition.status === "published" && end < now)
        );
      }),
    [competitions, now],
  );

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    navigate(`/#${sectionId}`);
  };

  const previewRows =
    resultPreviews.length > 0
      ? resultPreviews
      : completedComps.map((competition) => ({ competition, podium: [] }));

  return (
    <div className="pub-page pub-page--home">
      <div className="pub-ambient" />

      {loading && (
        <div
          className="pub-spinner-wrap"
          style={{ position: "relative", zIndex: 1 }}
        >
          <Loader2 className="pub-spinner" />
          <span className="pub-spinner-text">Loading federation data</span>
        </div>
      )}

      {error && (
        <div
          className="pub-container"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="pub-error">
            <Trophy className="pub-error__icon" />
            <h3 className="pub-error__title">Connection Error</h3>
            <p className="pub-error__text">{error}</p>
            <button
              className="pub-error__btn"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="pub-hero pub-reveal" data-reveal>
            <div className="pub-container">
              <div className="pub-hero__grid">
                <div>
                  <div className="pub-hero__eyebrow">
                    <Sparkles size={14} />
                    Official Federation Portal
                  </div>

                  <h1 className="pub-hero__title">
                    Tunisian Rowing Federation
                    <span> events platform</span>
                  </h1>

                  <p className="pub-hero__subtitle">
                    Follow live races, browse upcoming events, and review
                    official results.
                  </p>

                  <div className="pub-hero__actions">
                    <button
                      className="pub-hero__cta"
                      onClick={() => scrollToSection("events")}
                      type="button"
                    >
                      Explore Events
                      <ArrowRight size={15} />
                    </button>
                    <button
                      className="pub-hero__cta pub-hero__cta--secondary"
                      onClick={() => scrollToSection("results")}
                      type="button"
                    >
                      View Results
                    </button>
                  </div>

                  <div className="pub-hero__note"></div>
                </div>

                <div className="pub-hero__panel">
                  <div className="pub-info-card" style={{ height: "100%" }}>
                    <div
                      className="pub-info-card__title"
                      style={{ marginBottom: 18 }}
                    >
                      <Activity size={16} />
                      Public Snapshot
                    </div>
                    <div className="pub-stat-grid">
                      <div className="pub-stat-card">
                        <div className="pub-stat-card__value">
                          {competitions.length}
                        </div>
                        <div className="pub-stat-card__label">Competitions</div>
                      </div>
                      <div className="pub-stat-card">
                        <div className="pub-stat-card__value">
                          {seasons.length}
                        </div>
                        <div className="pub-stat-card__label">Seasons</div>
                      </div>
                      <div className="pub-stat-card">
                        <div className="pub-stat-card__value">
                          {activeComps.length}
                        </div>
                        <div className="pub-stat-card__label">Active</div>
                      </div>
                      <div className="pub-stat-card">
                        <div className="pub-stat-card__value">
                          {liveRaces.length}
                        </div>
                        <div className="pub-stat-card__label">Live</div>
                      </div>
                    </div>

                    <div className="pub-info-row" style={{ marginTop: 20 }}>
                      <span className="pub-info-row__label">
                        Current live races
                      </span>
                      <span className="pub-info-row__value">
                        {liveRaces.length > 0 ? "On air" : "Quiet"}
                      </span>
                    </div>
                    <div className="pub-info-row">
                      <span className="pub-info-row__label">Latest season</span>
                      <span className="pub-info-row__value">
                        {seasons[0] || "TBD"}
                      </span>
                    </div>
                    <div className="pub-info-row">
                      <span className="pub-info-row__label">
                        Next public view
                      </span>
                      <span className="pub-info-row__value">
                        Programme, results, event info
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {liveRaces.length > 0 && (
            <section
              className="pub-section pub-section--border pub-reveal"
              data-reveal
              id="live"
            >
              <div className="pub-container">
                <div className="pub-section__header">
                  <h2 className="pub-section__title">
                    <span className="pub-section__title-icon live">
                      <Radio size={16} />
                    </span>
                    Live Races
                    <span className="pub-live-dot" style={{ marginLeft: 4 }} />
                  </h2>
                </div>

                <div className="pub-live-banner">
                  {liveRaces.map((race) => (
                    <div className="pub-live-card" key={race._id}>
                      <div className="pub-live-card__header">
                        <div>
                          <h3 className="pub-live-card__title">
                            {race.name || "Live race"}
                          </h3>
                          <p className="pub-live-card__subtitle">
                            {race.competitionName?.en ||
                              race.competitionName?.fr ||
                              race.competitionName?.ar ||
                              "Competition"}
                          </p>
                        </div>
                        <span className="pub-badge pub-badge--ongoing">
                          <span className="pub-live-dot" />
                          {String(race.status || "in_progress").replace(
                            /_/g,
                            " ",
                          )}
                        </span>
                      </div>

                      <div className="pub-live-lane-grid">
                        {race.lanes
                          ?.slice()
                          .sort((a, b) => a.lane - b.lane)
                          .map((lane) => (
                            <div className="pub-live-lane" key={lane.lane}>
                              <div className="pub-live-lane__number">
                                L{lane.lane}
                              </div>
                              <div className="pub-live-lane__name">
                                {lane.athleteName ||
                                  lane.athleteNameAr ||
                                  "Crew assignment"}
                              </div>
                              <div className="pub-live-lane__club">
                                {lane.clubName || "Club"}
                              </div>
                              <div className="pub-live-lane__time">
                                {lane.result
                                  ? lane.result.status === "ok"
                                    ? formatTime(lane.result.elapsedMs)
                                    : lane.result.status?.toUpperCase()
                                  : "Racing"}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {activeComps.length > 0 && (
            <section
              className="pub-section pub-section--border pub-reveal"
              data-reveal
            >
              <div className="pub-container">
                <div className="pub-section__header">
                  <h2 className="pub-section__title">
                    <span className="pub-section__title-icon success">
                      <Activity size={16} />
                    </span>
                    Ongoing Competitions
                  </h2>
                </div>

                <div className="pub-grid pub-grid--2">
                  {activeComps.map((competition, index) => (
                    <div
                      key={competition._id}
                      className="pub-card pub-card--clickable pub-fade-in"
                      style={{ animationDelay: `${index * 60}ms` }}
                      onClick={() =>
                        navigate(`/competition/${competition._id}`)
                      }
                    >
                      <div className="pub-card__body">
                        <div className="pub-card__header-row">
                          <DisciplineBadge
                            discipline={competition.discipline}
                          />
                          <StatusBadge type="ongoing">Ongoing</StatusBadge>
                        </div>

                        <h3 className="pub-card__headline">
                          {getCompetitionTitle(competition)}
                        </h3>

                        <div className="pub-meta">
                          <span className="pub-meta__item">
                            <Calendar size={14} />
                            {formatRange(
                              competition.startDate,
                              competition.endDate,
                            )}
                          </span>
                          <span className="pub-meta__item pub-meta__item--venue">
                            <MapPin size={14} />
                            {getVenueLabel(competition)}
                          </span>
                        </div>
                      </div>

                      <div className="pub-card__footer">
                        <span className="pub-cta">
                          Open detail page <ArrowRight size={12} />
                        </span>
                        <div className="pub-arrow">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section
            className="pub-section pub-section--border pub-reveal"
            data-reveal
            id="events"
          >
            <div className="pub-container">
              <div className="pub-section__header">
                <h2 className="pub-section__title">
                  <span className="pub-section__title-icon accent">
                    <Calendar size={16} />
                  </span>
                  Upcoming Events
                </h2>
              </div>

              {upcomingComps.length === 0 ? (
                <div className="pub-empty">
                  <Calendar className="pub-empty__icon" />
                  <h4 className="pub-empty__title">No Upcoming Events</h4>
                  <p className="pub-empty__text">
                    New competitions will appear here once the federation
                    publishes them.
                  </p>
                </div>
              ) : (
                <div className="pub-grid pub-grid--3">
                  {upcomingComps.map((competition, index) => (
                    <div
                      key={competition._id}
                      className="pub-card pub-card--clickable pub-fade-in"
                      style={{ animationDelay: `${index * 60}ms` }}
                      onClick={() =>
                        navigate(`/competition/${competition._id}`)
                      }
                    >
                      <div className="pub-card__body">
                        <div className="pub-card__header-row">
                          <DisciplineBadge
                            discipline={competition.discipline}
                          />
                          <StatusBadge type="upcoming">Upcoming</StatusBadge>
                        </div>

                        <h3 className="pub-card__headline">
                          {getCompetitionTitle(competition)}
                        </h3>

                        <div className="pub-meta" style={{ marginBottom: 12 }}>
                          <span className="pub-meta__item">
                            <Calendar size={14} />
                            {formatRange(
                              competition.startDate,
                              competition.endDate,
                            )}
                          </span>
                          <span className="pub-meta__item pub-meta__item--venue">
                            <MapPin size={14} />
                            {getVenueLabel(competition)}
                          </span>
                        </div>

                        <RegistrationBadge
                          status={competition.registrationStatus}
                        />
                      </div>

                      <div className="pub-card__footer">
                        <span className="pub-cta">
                          Open detail page <ArrowRight size={12} />
                        </span>
                        <div className="pub-arrow">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            className="pub-section pub-section--border pub-reveal"
            data-reveal
            id="results"
          >
            <div className="pub-container">
              <div className="pub-section__header">
                <h2 className="pub-section__title">
                  <span className="pub-section__title-icon gold">
                    <Trophy size={16} />
                  </span>
                  Recent Results
                </h2>
              </div>

              {previewRows.length === 0 ? (
                <div className="pub-empty">
                  <Trophy className="pub-empty__icon" />
                  <h4 className="pub-empty__title">No Results Yet</h4>
                  <p className="pub-empty__text">
                    Official standings will appear here once competitions are
                    completed.
                  </p>
                </div>
              ) : (
                <div className="pub-grid pub-grid--3">
                  {previewRows.map(({ competition, podium }, index) => (
                    <div
                      key={competition._id}
                      className="pub-card pub-card--clickable pub-fade-in"
                      style={{ animationDelay: `${index * 60}ms` }}
                      onClick={() =>
                        navigate(`/competition/${competition._id}#results`)
                      }
                    >
                      <div className="pub-card__body">
                        <div className="pub-card__header-row">
                          <DisciplineBadge
                            discipline={competition.discipline}
                          />
                          <StatusBadge type="completed">Completed</StatusBadge>
                        </div>

                        <h3 className="pub-card__headline">
                          {getCompetitionTitle(competition)}
                        </h3>

                        <div className="pub-meta" style={{ marginBottom: 16 }}>
                          <span className="pub-meta__item pub-meta__item--venue">
                            <MapPin size={14} />
                            {getVenueLabel(competition)}
                          </span>
                          <span className="pub-badge pub-badge--season">
                            Season {competition.season}
                          </span>
                        </div>

                        {podium.length > 0 ? (
                          <div className="pub-podium pub-podium--compact">
                            {podium.map((entry, entryIndex) => (
                              <div
                                key={`${competition._id}-${entryIndex}`}
                                className={`pub-podium__block pub-podium__block--${entryIndex === 0 ? "gold" : entryIndex === 1 ? "silver" : "bronze"}`}
                              >
                                <div className="pub-podium__rank">
                                  {entryIndex + 1}
                                </div>
                                <div className="pub-podium__label">
                                  {entry.eventLabel || "Result"}
                                </div>
                                <div className="pub-podium__name">
                                  {getResultEntryTitle(entry)}
                                </div>
                                <div className="pub-podium__club">
                                  {getResultEntryClub(entry)}
                                </div>
                                <div className="pub-podium__time">
                                  {entry.status === "ok"
                                    ? formatTime(entry.elapsedMs)
                                    : String(entry.status || "-").toUpperCase()}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="pub-empty pub-empty--compact">
                            <p className="pub-empty__text">
                              Results preview will appear after official
                              publishing.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pub-card__footer">
                        <span className="pub-cta">
                          Open results <ArrowRight size={12} />
                        </span>
                        <div className="pub-arrow">
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <footer className="pub-footer pub-reveal" data-reveal>
            <div className="pub-container">
              <p className="pub-footer__text">
                © {new Date().getFullYear()}{" "}
                <span className="pub-footer__brand">
                  Tunisian Rowing Federation
                </span>
                . All rights reserved.
              </p>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default PublicHome;
