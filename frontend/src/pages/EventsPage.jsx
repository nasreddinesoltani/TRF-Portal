import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  Compass,
  Globe2,
  Loader2,
  RefreshCw,
  Trophy,
} from "lucide-react";
import CompetitionCard, { isInternationalScope } from "../components/CompetitionCard";
import "../public.css";

const SCOPE_FILTERS = [
  { key: "all", label: "All Events" },
  { key: "national", label: "National" },
  { key: "international", label: "International" },
];

const EventsPage = () => {
  const navigate = useNavigate();

  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [seasonFilter, setSeasonFilter] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/public/competitions");
        if (!response.ok) {
          throw new Error("Failed to load public competitions");
        }
        setCompetitions(await response.json());
      } catch (err) {
        console.error("Error loading public events:", err);
        setError(
          "Unable to retrieve federation records right now. Please try again later.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
    els.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [loading, error, competitions.length]);

  const seasons = useMemo(
    () =>
      Array.from(
        new Set(competitions.map((competition) => competition.season)),
      )
        .filter(Boolean)
        .sort((a, b) => b - a),
    [competitions],
  );

  const filteredCompetitions = useMemo(
    () =>
      competitions.filter((competition) => {
        if (
          scopeFilter === "national" &&
          isInternationalScope(competition)
        ) {
          return false;
        }
        if (
          scopeFilter === "international" &&
          !isInternationalScope(competition)
        ) {
          return false;
        }
        if (
          seasonFilter !== "all" &&
          String(competition.season) !== String(seasonFilter)
        ) {
          return false;
        }
        return true;
      }),
    [competitions, scopeFilter, seasonFilter],
  );

  const scopeCounts = useMemo(
    () => ({
      all: competitions.length,
      national: competitions.filter((c) => !isInternationalScope(c)).length,
      international: competitions.filter((c) => isInternationalScope(c)).length,
    }),
    [competitions],
  );

  return (
    <div className="pub-page pub-page--events">
      <div className="pub-ambient" />

      {loading && (
        <div
          className="pub-spinner-wrap"
          style={{ position: "relative", zIndex: 1 }}
        >
          <Loader2 className="pub-spinner" />
          <span className="pub-spinner-text">Loading federation events</span>
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
          <section className="pub-section pub-reveal" data-reveal>
            <div className="pub-container">
              <div className="pub-events-hero">
                <div className="pub-hero__eyebrow">
                  <Compass size={14} />
                  Federation Calendar
                </div>
                <h1 className="pub-events-hero__title">
                  All Federation <span>Events</span>
                </h1>
                <p className="pub-events-hero__subtitle">
                  Every national championship and international regatta hosted
                  or organised by the Tunisian Rowing Federation — upcoming,
                  ongoing and completed.
                </p>
              </div>
            </div>
          </section>

          <section className="pub-section pub-reveal" data-reveal>
            <div className="pub-container">
              <div className="pub-events-toolbar">
                <div className="pub-chip-row">
                  {SCOPE_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`pub-chip ${scopeFilter === filter.key ? "is-active" : ""}`}
                      onClick={() => setScopeFilter(filter.key)}
                    >
                      {filter.key === "international" && <Globe2 size={13} />}
                      {filter.label}
                      <span className="pub-chip__count">
                        {scopeCounts[filter.key]}
                      </span>
                    </button>
                  ))}
                </div>

                {seasons.length > 0 && (
                  <label className="pub-season-select">
                    <Calendar size={14} />
                    <select
                      value={seasonFilter}
                      onChange={(event) => setSeasonFilter(event.target.value)}
                    >
                      <option value="all">All seasons</option>
                      {seasons.map((season) => (
                        <option key={season} value={season}>
                          Season {season}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {filteredCompetitions.length === 0 ? (
                <div className="pub-empty">
                  <Calendar className="pub-empty__icon" />
                  <h4 className="pub-empty__title">No Events Found</h4>
                  <p className="pub-empty__text">
                    No competition matches this filter yet.
                  </p>
                </div>
              ) : (
                <div className="pub-grid pub-grid--3">
                  {filteredCompetitions.map((competition, index) => (
                    <CompetitionCard
                      key={competition._id}
                      competition={competition}
                      index={index}
                    />
                  ))}
                </div>
              )}

              <button
                className="pub-event__more-link"
                onClick={() => navigate("/")}
                type="button"
              >
                Back to home <ChevronRight size={14} />
              </button>
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

export default EventsPage;
