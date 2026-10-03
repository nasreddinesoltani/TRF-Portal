// ============================================================
//  International Events — Tunisia 2025/2026
//  Static data source for the public Home hero + Event pages.
//  Edit this file to update event details or add new events.
//
//  competitionId links an event to its live competition record
//  in the database (programme, live races & official results).
//  null = the competition has not been created in the portal yet.
// ============================================================

export const INTERNATIONAL_EVENTS = [
  {
    slug: "17th-tunis-lake-international-rowing-regatta",
    name: "17th Tunis Lake International Rowing Regatta",
    shortName: "Tunis Lake International Regatta",
    dateLabel: "27 September 2026",
    startDate: "2026-09-27T08:00:00",
    endDate: "2026-09-27T18:00:00",

    venue: "Tunis Lake, Tunis, Tunisia",
    discipline: "Classic Rowing",
    organizer: "Tunisian Rowing Federation",
    summary:
      "The 17th edition of the Tunis Lake International Rowing Regatta gathers national and international crews on the iconic waters of Tunis Lake.",
    description:
      "The Tunis Lake International Rowing Regatta is one of the flagship rowing events organised by the Tunisian Rowing Federation. The 17th edition welcomes national teams and international guests for a day of competitive racing on the calm waters of Tunis Lake.",
    competitionId: "6a9ee8df14d0e9cf4119f553",
    entryForm: {
      fileName: "17thTLIRR-Entry-Form.xlsx",
      label: "Entry Form (xlsx)",
    },
  },
  {
    slug: "18th-african-rowing-championships",
    name: "18th African Rowing Championships",
    shortName: "African Rowing Championships",
    dateLabel: "29 – 30 September 2026",
    startDate: "2026-09-29T08:00:00",
    endDate: "2026-09-30T18:00:00",

    venue: "Tunis Lake, Tunis, Tunisia",
    discipline: "Classic Rowing",
    organizer: "Tunisian Rowing Federation · African Rowing Confederation",
    summary:
      "The continental championship bringing together the best rowing nations across Africa over two days of racing.",
    description:
      "Tunisia proudly hosts the 18th African Rowing Championships, the premier continental competition organised under the umbrella of the African Rowing Confederation. Over two days, national teams from across the continent compete for continental titles and qualification honours.",
    competitionId: "6aba5fd41ab99675aa89c29f",
    entryForm: {
      fileName: "18thAfRCH-Entry-Form.xlsx",
      label: "Entry Form (xlsx)",
    },
  },
];

export const getEventBySlug = (slug) =>
  INTERNATIONAL_EVENTS.find((event) => event.slug === slug) || null;

/**
 * Lifecycle state of an event, derived from its dates.
 * Returns "upcoming" | "ongoing" | "completed".
 */
export const getEventStatus = (event, now = new Date()) => {
  if (!event?.startDate || !event?.endDate) return "upcoming";
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "upcoming";
  }
  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "ongoing";
};

export default INTERNATIONAL_EVENTS;
