import React, { useEffect, useState } from "react";

/**
 * Live countdown timer to an event's start date.
 *
 * Props:
 *  - targetDate: ISO date string (event start)
 *  - variant: "compact" (default) for cards | "large" for the event page
 */
const getRemaining = (target) => {
  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0)
    return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { done: false, days, hours, minutes, seconds };
};

const pad = (n) => String(n).padStart(2, "0");

const EventCountdown = ({ targetDate, variant = "compact" }) => {
  const [remaining, setRemaining] = useState(() => getRemaining(targetDate));

  useEffect(() => {
    setRemaining(getRemaining(targetDate));
    const id = setInterval(() => {
      setRemaining(getRemaining(targetDate));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (!remaining) return null;

  if (remaining.done) {
    return (
      <div
        className={`pub-countdown pub-countdown--${variant} pub-countdown--live`}
      >
        <span className="pub-countdown__live-dot" />
        <span className="pub-countdown__live-text">Event in progress</span>
      </div>
    );
  }

  const units = [
    { label: "Days", value: remaining.days },
    { label: "Hrs", value: pad(remaining.hours) },
    { label: "Min", value: pad(remaining.minutes) },
    { label: "Sec", value: pad(remaining.seconds) },
  ];

  return (
    <div className={`pub-countdown pub-countdown--${variant}`}>
      {units.map((unit) => (
        <div className="pub-countdown__unit" key={unit.label}>
          <span className="pub-countdown__value">{unit.value}</span>
          <span className="pub-countdown__label">{unit.label}</span>
        </div>
      ))}
    </div>
  );
};

export default EventCountdown;
