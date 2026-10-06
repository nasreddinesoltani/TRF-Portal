import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Clock3,
  Download,
  FileSpreadsheet,
  Flag,
  Globe,
  MapPin,
  Medal,
  Trophy,
  Users,
  Waves,
} from "lucide-react";
import { getEventBySlug, getEventStatus } from "../lib/events";
import { countryName, flagEmoji } from "../lib/countries";
import {
  formatDayLabel,
  formatEntryName,
  formatEntryAffiliation,
  formatPhaseSummary,
  formatProgressionRule,
  formatRaceLabel,
  formatShortDate,
  formatTime,
  formatTimeOfDay,
  getAffiliationMode,
  getPodiumEntries,
  groupRacesByEventGroupId,
  isHeatPhase,
} from "../lib/format";
import { generateFullResultsPdf } from "../lib/publicResultsPdf";
import EventCountdown from "../components/EventCountdown";
import "../public.css";

const TEAM_SERVICES = [
  {
    to: "/teams/visa",
    label: "VISA",
    desc: "Visa request letters and application forms",
  },
  {
    to: "/teams/accommodation",
    label: "Accommodation",
    desc: "Official hotels and housing options",
  },
  {
    to: "/teams/transportation",
    label: "Transportation",
    desc: "Airport transfers and local transport",
  },
  {
    to: "/teams/accreditation",
    label: "Accreditation",
    desc: "Accreditation for teams and officials",
  },
  {
    to: "/teams/boats-equipments",
    label: "Boats and Equipments",
    desc: "Boat rental and equipment services",
  },
];

const STATUS_LABELS = {
  upcoming: { label: "Upcoming", badge: "pub-badge--upcoming" },
  ongoing: { label: "In Progress", badge: "pub-badge--ongoing" },
  completed: { label: "Completed", badge: "pub-badge--completed" },
};

const scrollToSection = (sectionId) => {
  const target = document.getElementById(sectionId);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

const EventPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const event = getEventBySlug(slug);

  const [competition, setCompetition] = useState(null);
  const [programme, setProgramme] = useState([]);
  const [results, setResults] = useState([]);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  const competitionId = event?.competitionId || null;

  useEffect(() => {
    let cancelled = false;
    setCompetition(null);
    setProgramme([]);
    setResults([]);
    setDataReady(false);

    if (!competitionId) return undefined;

    const load = async () => {
      const base = `/api/public/competitions/${competitionId}`;
      try {
        const [compRes, progRes, resultsRes] = await Promise.all([
          fetch(base),
          fetch(`${base}/programme`),
          fetch(`${base}/results`),
        ]);

        if (cancelled) return;

        if (compRes.ok) setCompetition(await compRes.json());
        if (progRes.ok) setProgramme(await progRes.json());
        if (resultsRes.ok) setResults(await resultsRes.json());
      } catch (err) {
        console.error("Failed to load event competition data:", err);
      } finally {
        if (!cancelled) setDataReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const status = useMemo(
    () => (event ? getEventStatus(event) : "upcoming"),
    [event],
  );

  const programmeDays = useMemo(() => {
    const days = new Map();
    [...programme]
      .sort(
        (a, b) =>
          new Date(a.startTime || 0).getTime() -
            new Date(b.startTime || 0).getTime() ||
          Number(a.order || 0) - Number(b.order || 0),
      )
      .forEach((race) => {
        const key = race.startTime
          ? formatDayLabel(race.startTime)
          : "Schedule to be announced";
        if (!days.has(key)) {
          days.set(key, { key, races: [] });
        }
        days.get(key).races.push(race);
      });
    return [...days.values()];
  }, [programme]);

  const resultGroups = useMemo(
    () =>
      [...results].sort((a, b) =>
        String(a.eventLabel || "").localeCompare(String(b.eventLabel || "")),
      ),
    [results],
  );

  const nations = useMemo(() => {
    const list = competition?.scope?.participatingFederations;
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }, [competition]);

  // Countries for international events, clubs for national ones.
  const affiliationMode = useMemo(
    () => getAffiliationMode(competition),
    [competition],
  );
  const hostCountry = competition?.scope?.hostCountry || "";
  const getAffiliation = (entry) =>
    formatEntryAffiliation(entry, affiliationMode, hostCountry);

  // Final phase available per category+boat group, for heat progression.
  const finalPhaseByGroup = useMemo(() => {
    const map = new Map();
    programme.forEach((race) => {
      if (/^final/i.test(String(race.phase || ""))) {
        const key = `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`;
        if (!map.has(key)) map.set(key, race.phase);
      }
    });
    return map;
  }, [programme]);

  const raceGroupsByEventId = useMemo(
    () => groupRacesByEventGroupId(programme),
    [programme],
  );

  // Event labels appearing on more than one result group get a date chip.
  const duplicatedLabelCounts = useMemo(() => {
    const counts = new Map();
    resultGroups.forEach((group) => {
      const label = formatRaceLabel(group);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return counts;
  }, [resultGroups]);

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

  const totalCrews = useMemo(
    () =>
      resultGroups.reduce(
        (sum, group) => sum + (group.entries?.length || 0),
        0,
      ),
    [resultGroups],
  );

  const statusConf = STATUS_LABELS[status] || STATUS_LABELS.upcoming;

  const scrollTo = (sectionId) => scrollToSection(sectionId);

  if (!event) {
    return (
      <div className="pub-page pub-page--doc">
        <div className="pub-ambient" />
        <section
          className="pub-doc"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div className="pub-container">
            <button
              className="pub-doc__back"
              onClick={() => navigate("/")}
              type="button"
            >
              <ArrowLeft size={15} />
              Back to Home
            </button>
            <div className="pub-empty">
              <Trophy className="pub-empty__icon" />
              <h4 className="pub-empty__title">Event Not Found</h4>
              <p className="pub-empty__text">
                The event you are looking for does not exist or has been moved.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pub-page pub-page--doc">
      <div className="pub-ambient" />

      <section className="pub-doc" style={{ position: "relative", zIndex: 1 }}>
        <div className="pub-container">
          <button
            className="pub-doc__back"
            onClick={() => navigate("/")}
            type="button"
          >
            <ArrowLeft size={15} />
            Back to Home
          </button>

          <div className="pub-doc__eyebrow">International Event</div>
          <h1 className="pub-doc__title">{event.name}</h1>
          {competition?.names?.ar && (
            <p className="pub-event__arabic">{competition.names.ar}</p>
          )}
          <div className="pub-doc__accent" />

          <div className="pub-event__meta">
            <span className={`pub-badge ${statusConf.badge}`}>
              {statusConf.label}
            </span>
            <span className="pub-meta__item">
              <Calendar size={15} />
              {event.dateLabel}
            </span>
            <span className="pub-meta__item pub-meta__item--venue">
              <MapPin size={15} />
              {event.venue}
            </span>
            {event.discipline && (
              <span className="pub-badge pub-badge--classic">
                <Waves size={14} />
                {event.discipline}
              </span>
            )}
          </div>

          {status === "completed" ? (
            <div className="pub-event__done-banner">
              <div className="pub-event__done-text">
                <Medal size={18} />
                <span>
                  This event has taken place. Relive it through the race
                  programme and the official results.
                </span>
              </div>
              {dataReady && (programme.length > 0 || resultGroups.length > 0) && (
                <div className="pub-event__done-actions">
                  {programme.length > 0 && (
                    <button
                      className="pub-hero__cta pub-hero__cta--secondary"
                      onClick={() => scrollTo("programme")}
                      type="button"
                    >
                      <Clock3 size={15} />
                      Programme
                    </button>
                  )}
                  {resultGroups.length > 0 && (
                    <button
                      className="pub-hero__cta"
                      onClick={() => scrollTo("results")}
                      type="button"
                    >
                      <Medal size={15} />
                      Official Results
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="pub-countdown-banner">
              <span className="pub-countdown-banner__label">
                Countdown to the event
              </span>
              <EventCountdown
                targetDate={event.startDate}
                endDate={event.endDate}
                variant="large"
              />
            </div>
          )}

          <div className="pub-doc__body">
            <p className="pub-doc__lead">{event.summary}</p>
            <p>{event.description}</p>
          </div>

          <div className="pub-event__actions">
            {event.entryForm && (
              <a
                className="pub-hero__cta pub-hero__cta--entry"
                href={`/documents/${event.entryForm.fileName}`}
                target="_blank"
                rel="noreferrer"
                download
              >
                <FileSpreadsheet size={15} />
                {event.entryForm.label || "Entry Form"}
              </a>
            )}
            {competitionId ? (
              <button
                className="pub-hero__cta"
                onClick={() => navigate(`/competition/${competitionId}`)}
                type="button"
              >
                Full Competition Page
                <ArrowRight size={15} />
              </button>
            ) : (
              <span className="pub-event__soon">
                Competition programme &amp; results will be available closer to
                the event.
              </span>
            )}
          </div>

          {(event.organizer ||
            nations.length > 0 ||
            (competition && dataReady)) && (
            <div className="pub-info-grid pub-event__facts">
              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <Globe size={16} />
                  Event Details
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Dates</span>
                  <span className="pub-info-row__value">
                    {event.dateLabel}
                  </span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Venue</span>
                  <span className="pub-info-row__value">{event.venue}</span>
                </div>
                <div className="pub-info-row">
                  <span className="pub-info-row__label">Discipline</span>
                  <span className="pub-info-row__value">
                    {event.discipline}
                  </span>
                </div>
                {event.organizer && (
                  <div className="pub-info-row">
                    <span className="pub-info-row__label">Organizer</span>
                    <span className="pub-info-row__value">
                      {event.organizer}
                    </span>
                  </div>
                )}
                {competition?.code && (
                  <div className="pub-info-row">
                    <span className="pub-info-row__label">Portal code</span>
                    <span className="pub-info-row__value">
                      {competition.code}
                    </span>
                  </div>
                )}
              </div>

              {nations.length > 0 && (
                <div className="pub-info-card">
                  <div className="pub-info-card__title">
                    <Flag size={16} />
                    Participating Nations
                  </div>
                  <div className="pub-nation-grid">
                    {nations.map((code) => (
                      <span
                        className="pub-nation-chip"
                        key={code}
                        title={countryName(code)}
                      >
                        <span className="pub-nation-chip__flag">
                          {flagEmoji(code) || <Globe size={12} />}
                        </span>
                        {countryName(code)}
                        {code === "TUN" && (
                          <span className="pub-nation-chip__host">Host</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {dataReady && programme.length > 0 && (
                <div className="pub-info-card">
                  <div className="pub-info-card__title">
                    <Users size={16} />
                    Competition Snapshot
                  </div>
                  <div className="pub-info-row">
                    <span className="pub-info-row__label">Races scheduled</span>
                    <span className="pub-info-row__value">
                      {programme.length}
                    </span>
                  </div>
                  {resultGroups.length > 0 && (
                    <div className="pub-info-row">
                      <span className="pub-info-row__label">Events timed</span>
                      <span className="pub-info-row__value">
                        {resultGroups.length}
                      </span>
                    </div>
                  )}
                  {totalCrews > 0 && (
                    <div className="pub-info-row">
                      <span className="pub-info-row__label">
                        Recorded performances
                      </span>
                      <span className="pub-info-row__value">{totalCrews}</span>
                    </div>
                  )}
                  {nations.length > 0 && (
                    <div className="pub-info-row">
                      <span className="pub-info-row__label">Nations</span>
                      <span className="pub-info-row__value">
                        {nations.length}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pub-event__section" id="programme">
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon accent">
                  <Clock3 size={16} />
                </span>
                Race Programme
              </h2>
            </div>

            {!dataReady ? (
              <div className="pub-doc__placeholder">
                <p>Loading the race programme…</p>
              </div>
            ) : programmeDays.length === 0 ? (
              <div className="pub-doc__placeholder">
                <p>
                  The detailed race programme will be published here once the
                  timetable is confirmed by the organising committee.
                </p>
              </div>
            ) : (
              <>
                {programmeDays.map((day) => (
                  <div className="pub-day-block" key={day.key}>
                    <div className="pub-day-block__header">
                      <span className="pub-day-block__title">{day.key}</span>
                      <span className="pub-day-block__count">
                        {day.races.length} race
                        {day.races.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="pub-day-block__races">
                      {day.races.map((race) => {
                        const groupKey = `${race.category?._id || race.category}|${race.boatClass?._id || race.boatClass}`;
                        const progression =
                          isHeatPhase(race.phase) &&
                          finalPhaseByGroup.get(groupKey);
                        return (
                          <div className="pub-race-row" key={race._id}>
                            <span className="pub-race-row__time">
                              {race.startTime
                                ? formatTimeOfDay(race.startTime)
                                : "TBA"}
                            </span>
                            <span className="pub-race-row__label">
                              {formatRaceLabel(race) || race.name || "Race"}
                            </span>
                            {race.phase ? (
                              <span
                                className={`pub-race-row__phase ${isHeatPhase(race.phase) ? "pub-race-row__phase--heat" : ""}`}
                              >
                                {race.phase}
                              </span>
                            ) : race.name && formatRaceLabel(race) ? (
                              <span className="pub-race-row__phase">
                                {race.name}
                              </span>
                            ) : null}
                            {progression && (
                              <span
                                className="pub-race-row__progression"
                                title="Static qualification system"
                              >
                                {formatProgressionRule(progression)}
                              </span>
                            )}
                            <span
                              className={`pub-race-row__status pub-race-row__status--${String(race.status || "scheduled")}`}
                            >
                              {String(race.status || "scheduled").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {competitionId && (
                  <button
                    className="pub-event__more-link"
                    onClick={() => navigate(`/competition/${competitionId}#programme`)}
                    type="button"
                  >
                    Open the full programme with entries
                    <ArrowRight size={14} />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="pub-event__section" id="results">
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon gold">
                  <Medal size={16} />
                </span>
                Official Results
              </h2>
            </div>

            {!dataReady ? (
              <div className="pub-doc__placeholder">
                <p>Loading official results…</p>
              </div>
            ) : resultGroups.length === 0 ? (
              <div className="pub-doc__placeholder">
                <p>
                  {status === "completed"
                    ? "Official results are being finalised and will be published here."
                    : "Official results will be published here at the end of the competition."}
                </p>
              </div>
            ) : (
              <>
                <div className="pub-result-grid">
                  {resultGroups.map((group) => {
                    const podium = getPodiumEntries(group.entries);
                    const hasHeats = (group.entries || []).some((entry) =>
                      isHeatPhase(entry.phase),
                    );
                    const phaseSummary = hasHeats
                      ? formatPhaseSummary(group.entries)
                      : "";
                    const groupRaces =
                      raceGroupsByEventId.get(group.eventGroupId) || {
                        heats: [],
                        final: null,
                      };
                    const raceDate =
                      groupRaces.final?.startTime ||
                      groupRaces.heats[0]?.startTime;
                    const labelKey = formatRaceLabel(group) || "Event";
                    const showDateChip =
                      raceDate && (duplicatedLabelCounts.get(labelKey) || 0) > 1;
                    return (
                      <article
                        className="pub-result-mini"
                        key={group.eventGroupId || group.eventLabel}
                      >
                        <div className="pub-result-mini__header">
                          <Trophy size={14} />
                          {labelKey}
                          {showDateChip && (
                            <span className="pub-group-date">
                              {formatShortDate(raceDate)}
                            </span>
                          )}
                          {phaseSummary && (
                            <span className="pub-result-mini__phases">
                              {phaseSummary}
                            </span>
                          )}
                        </div>
                        <div className="pub-result-mini__rows">
                          {podium
                            .slice()
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
                              return rankA - rankB;
                            })
                            .slice(0, 3)
                            .map((entry, index) => (
                              <div
                                className="pub-result-mini__row"
                                key={`${group.eventGroupId}-${index}`}
                              >
                                <span
                                  className={`pub-result-mini__rank pub-result-mini__rank--${index === 0 ? "gold" : index === 1 ? "silver" : "bronze"}`}
                                >
                                  {entry.rank || entry.finishPosition || index + 1}
                                </span>
                                <span className="pub-result-mini__name">
                                  {formatEntryName(entry)}
                                </span>
                                <span className="pub-result-mini__club">
                                  {getAffiliation(entry)}
                                </span>
                                <span className="pub-result-mini__time">
                                  {entry.status === "ok"
                                    ? formatTime(entry.elapsedMs)
                                    : String(entry.status || "—").toUpperCase()}
                                </span>
                              </div>
                            ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {competitionId && (
                  <div className="pub-event__more-row">
                    <button
                      className="pub-event__more-link"
                      onClick={() =>
                        navigate(`/competition/${competitionId}#results`)
                      }
                      type="button"
                    >
                      Open the full official results tables
                      <ArrowRight size={14} />
                    </button>
                    {resultGroups.length > 0 && (
                      <button
                        className="pub-event__more-link"
                        onClick={exportFullPdf}
                        type="button"
                      >
                        <Download size={14} />
                        Download full results (PDF)
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="pub-event__section" id="teams">
            <div className="pub-section__header">
              <h2 className="pub-section__title">
                <span className="pub-section__title-icon success">
                  <Users size={16} />
                </span>
                Team Services &amp; Documents
              </h2>
            </div>

            <div className="pub-info-grid">
              {event.entryForm && (
                <div className="pub-info-card">
                  <div className="pub-info-card__title">
                    <FileSpreadsheet size={16} />
                    Documents
                  </div>
                  <a
                    className="pub-doc-row"
                    href={`/documents/${event.entryForm.fileName}`}
                    target="_blank"
                    rel="noreferrer"
                    download
                  >
                    <span className="pub-doc-row__icon">
                      <Download size={14} />
                    </span>
                    <span className="pub-doc-row__body">
                      <span className="pub-doc-row__label">
                        {event.entryForm.label || "Entry Form"}
                      </span>
                      <span className="pub-doc-row__hint">
                        Official entry form — {event.shortName}
                      </span>
                    </span>
                    <ArrowRight size={14} className="pub-doc-row__arrow" />
                  </a>
                  <p className="pub-event__note">
                    Visa, accreditation, accommodation and transport forms are
                    available on the corresponding team service pages.
                  </p>
                </div>
              )}

              <div className="pub-info-card">
                <div className="pub-info-card__title">
                  <Building2 size={16} />
                  Visiting Teams
                </div>
                {TEAM_SERVICES.map((service) => (
                  <button
                    className="pub-doc-row"
                    key={service.to}
                    onClick={() => navigate(service.to)}
                    type="button"
                  >
                    <span className="pub-doc-row__icon">
                      <ArrowRight size={14} />
                    </span>
                    <span className="pub-doc-row__body">
                      <span className="pub-doc-row__label">
                        {service.label}
                      </span>
                      <span className="pub-doc-row__hint">
                        {service.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="pub-footer">
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
    </div>
  );
};

export default EventPage;
