import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Anchor,
  ArrowRight,
  Calendar,
  ChevronRight,
  Compass,
  MapPin,
  Waves,
} from "lucide-react";
import { getEventSlugByCompetitionId } from "../lib/events";

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

export const getDiscipline = (discipline) =>
  DISCIPLINES[discipline] || FALLBACK_DISCIPLINE;

export const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatRange = (start, end) =>
  `${formatDate(start)} - ${formatDate(end)}`;

export const getCompetitionTitle = (competition) =>
  competition?.names?.en || competition?.code || "Competition";

export const getVenueLabel = (competition) => {
  const venue = competition?.venue || {};
  const parts = [venue.name, venue.city, venue.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Venue to be confirmed";
};

/** Older competitions carry no scope object — the model default is national. */
export const isInternationalScope = (competition) => {
  const type = competition?.scope?.type;
  return Boolean(type) && type !== "national";
};

export const DisciplineBadge = ({ discipline }) => {
  const conf = getDiscipline(discipline);
  const { Icon } = conf;

  return (
    <span className={`pub-badge ${conf.css}`}>
      <Icon size={14} />
      {conf.label}
    </span>
  );
};

export const ScopeBadge = ({ competition }) =>
  isInternationalScope(competition) ? (
    <span className="pub-badge pub-badge--scope-intl">International</span>
  ) : (
    <span className="pub-badge pub-badge--scope-national">National</span>
  );

export const RegistrationBadge = ({ status }) => {
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

export const StatusBadge = ({ type, children }) => (
  <span className={`pub-badge pub-badge--${type}`}>{children}</span>
);

/**
 * Lifecycle state of a competition, from its stored status and dates:
 * "upcoming" | "ongoing" | "completed".
 */
export const getCompetitionPhase = (competition, now = new Date()) => {
  if (competition?.status === "completed") return "completed";

  const start = new Date(competition?.startDate);
  const end = new Date(competition?.endDate);
  if (
    competition?.status !== "published" ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return "upcoming";
  }
  if (start > now) return "upcoming";
  const endOfDay = new Date(end);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay < now ? "completed" : "ongoing";
};

const PHASE_BADGES = {
  upcoming: { type: "upcoming", label: "Upcoming" },
  ongoing: { type: "ongoing", label: "Ongoing" },
  completed: { type: "completed", label: "Completed" },
};

/**
 * Card for a DB competition, shared by the home page and the events page.
 * Curated international events link to their rich /events/:slug page,
 * everything else to the generic /competition/:id detail page.
 */
const CompetitionCard = ({
  competition,
  // Optional pinned badge, e.g. { type: "completed", label: "Completed" }.
  statusOverride,
  showRegistration = false,
  footerLabel = "Open detail page",
  index = 0,
}) => {
  const navigate = useNavigate();
  const phase = getCompetitionPhase(competition);
  const badge = statusOverride || PHASE_BADGES[phase];
  const slug = getEventSlugByCompetitionId(competition?._id);

  return (
    <div
      className="pub-card pub-card--clickable pub-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={() =>
        navigate(slug ? `/events/${slug}` : `/competition/${competition._id}`)
      }
    >
      <div className="pub-card__body">
        <div className="pub-card__header-row">
          <DisciplineBadge discipline={competition.discipline} />
          <StatusBadge type={badge.type}>{badge.label}</StatusBadge>
        </div>

        <h3 className="pub-card__headline">{getCompetitionTitle(competition)}</h3>

        <div className="pub-meta" style={{ marginBottom: 12 }}>
          <span className="pub-meta__item">
            <Calendar size={14} />
            {formatRange(competition.startDate, competition.endDate)}
          </span>
          <span className="pub-meta__item pub-meta__item--venue">
            <MapPin size={14} />
            {getVenueLabel(competition)}
          </span>
        </div>

        <div className="pub-card__badges">
          <ScopeBadge competition={competition} />
          {showRegistration && (
            <RegistrationBadge status={competition.registrationStatus} />
          )}
        </div>
      </div>

      <div className="pub-card__footer">
        <span className="pub-cta">
          {footerLabel} <ArrowRight size={12} />
        </span>
        <div className="pub-arrow">
          <ChevronRight size={16} />
        </div>
      </div>
    </div>
  );
};

export default CompetitionCard;
