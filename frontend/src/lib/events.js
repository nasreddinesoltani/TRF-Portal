// ============================================================
//  International Events — Tunisia 2025/2026
//  Static data source for the public Home hero + Event pages.
//  Edit this file to update event details or add new events.
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
    summary:
      "The 17th edition of the Tunis Lake International Rowing Regatta gathers national and international crews on the iconic waters of Tunis Lake.",
    description:
      "The Tunis Lake International Rowing Regatta is one of the flagship rowing events organised by the Tunisian Rowing Federation. The 17th edition welcomes national teams and international guests for a day of competitive racing on the calm waters of Tunis Lake.",
    // Link to the live competition in the portal once it exists in the database.
    competitionId: null,
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
    summary:
      "The continental championship bringing together the best rowing nations across Africa over two days of racing.",
    description:
      "Tunisia proudly hosts the 18th African Rowing Championships, the premier continental competition organised under the umbrella of the African Rowing Confederation. Over two days, national teams from across the continent compete for continental titles and qualification honours.",
    competitionId: null,
    entryForm: {
      fileName: "18thAfRCH-Entry-Form.xlsx",
      label: "Entry Form (xlsx)",
    },
  },
  {
    slug: "2026-arab-rowing-championships",
    name: "2026 Arab Rowing Championships",
    shortName: "Arab Rowing Championships",
    dateLabel: "3 – 4 October 2026",
    startDate: "2026-10-03T08:00:00",
    endDate: "2026-10-04T18:00:00",

    venue: "Tunis Lake, Tunis, Tunisia",
    discipline: "Classic Rowing",
    summary:
      "The Arab world's leading rowing championship, hosted in Tunisia across two days of elite competition.",
    description:
      "The 2026 Arab Rowing Championships bring together the leading rowing nations of the Arab world. Hosted by the Tunisian Rowing Federation, the championship features two days of high-level racing across a full programme of boat classes.",
    competitionId: null,
  },
];

export const getEventBySlug = (slug) =>
  INTERNATIONAL_EVENTS.find((event) => event.slug === slug) || null;

export default INTERNATIONAL_EVENTS;
