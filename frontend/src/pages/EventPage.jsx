import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  Trophy,
  Waves,
} from "lucide-react";
import { getEventBySlug } from "../lib/events";
import EventCountdown from "../components/EventCountdown";
import "../public.css";

const EventPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const event = getEventBySlug(slug);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

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
          <div className="pub-doc__accent" />

          <div className="pub-event__meta">
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

          <div className="pub-countdown-banner">
            <span className="pub-countdown-banner__label">
              Countdown to the event
            </span>
            <EventCountdown targetDate={event.startDate} variant="large" />
          </div>

          <div className="pub-doc__body">
            <p className="pub-doc__lead">{event.summary}</p>
            <p>{event.description}</p>
          </div>

          <div className="pub-event__actions">
            {event.competitionId ? (
              <button
                className="pub-hero__cta"
                onClick={() => navigate(`/competition/${event.competitionId}`)}
                type="button"
              >
                View Competition &amp; Results
                <ArrowRight size={15} />
              </button>
            ) : (
              <span className="pub-event__soon">
                Competition programme &amp; results will be available closer to
                the event.
              </span>
            )}
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
