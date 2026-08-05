/**
 * Beach Sprint Service
 *
 * Handles all business logic for Beach Sprint competitions:
 * - Event creation and management
 * - Bracket/draw generation
 * - Progression logic (who advances from each phase)
 * - Medal assignment
 * - Club standings calculation
 */

import ExcelJS from "exceljs";
import {
  BeachSprintEvent,
  BeachSprintRace,
  BeachSprintStanding,
  RACE_PHASES,
  PROGRESSION_RULES,
} from "../Models/beachSprintModel.js";
import CompetitionEntry from "../Models/competitionEntryModel.js";
import Competition from "../Models/competitionModel.js";

/**
 * Parse time string to milliseconds
 * @param {string} timeStr - Time in format "MM:SS.cc" or "SS.cc"
 * @returns {number} Time in milliseconds
 */
function parseTimeToMs(timeStr) {
  if (!timeStr) return null;

  const parts = timeStr.split(":");
  let minutes = 0,
    seconds = 0,
    centiseconds = 0;

  if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    const secParts = parts[1].split(".");
    seconds = parseInt(secParts[0], 10);
    centiseconds = parseInt(secParts[1] || "0", 10);
  } else {
    const secParts = parts[0].split(".");
    seconds = parseInt(secParts[0], 10);
    centiseconds = parseInt(secParts[1] || "0", 10);
  }

  return minutes * 60 * 1000 + seconds * 1000 + centiseconds * 10;
}

/**
 * Format milliseconds to time string
 * @param {number} ms - Time in milliseconds
 * @returns {string} Time in format "MM:SS.cc"
 */
function formatMsToTime(ms) {
  if (!ms) return "";

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
}

/**
 * Create a new Beach Sprint event
 */
async function createEvent(eventData) {
  const event = new BeachSprintEvent({
    competition: eventData.competitionId,
    boatClass: eventData.boatClassId,
    category: eventData.categoryId,
    gender: eventData.gender,
    name: eventData.name,
    progressionConfig: eventData.progressionConfig || {},
  });

  await event.save();
  return event;
}

/**
 * Get all events for a competition
 */
async function getEventsByCompetition(competitionId) {
  const events = await BeachSprintEvent.find({ competition: competitionId })
    .populate("boatClass")
    .populate("category")
    .sort({ gender: 1, "category.ageMin": -1 })
    .lean();

  if (!events.length) return events;

  const raceCounts = await BeachSprintRace.aggregate([
    { $match: { event: { $in: events.map((event) => event._id) } } },
    { $group: { _id: "$event", count: { $sum: 1 } } },
  ]);
  const countByEvent = new Map(
    raceCounts.map((item) => [item._id.toString(), item.count]),
  );

  return events.map((event) => ({
    ...event,
    raceCount: countByEvent.get(event._id.toString()) || 0,
  }));
}

/**
 * Get single event with all races
 */
async function getEventWithRaces(eventId) {
  const event = await BeachSprintEvent.findById(eventId)
    .populate("boatClass")
    .populate("category")
    .populate("medals.gold.athlete")
    .populate("medals.gold.club")
    .populate("medals.silver.athlete")
    .populate("medals.silver.club")
    .populate("medals.bronze.athlete")
    .populate("medals.bronze.club");

  if (!event) return null;

  const races = await BeachSprintRace.find({ event: eventId })
    .populate("lanes.athlete")
    .populate("lanes.crew")
    .populate("lanes.club")
    .sort({ phase: 1, heatNumber: 1 });

  return { event, races };
}

/**
 * Generate Time Trial heats from registered entries
 * @param {string} eventId - Event ID
 * @param {Array} entries - Array of { athlete, crew, club } objects
 * @param {number} lanesPerHeat - Number of lanes per heat (usually 4)
 */
async function generateTimeTrialHeats(eventId, entries, lanesPerHeat = 4) {
  const event = await BeachSprintEvent.findById(eventId);
  if (!event) throw new Error("Event not found");

  // Delete existing time trial races
  await BeachSprintRace.deleteMany({ event: eventId, phase: "time_trial" });

  // Shuffle entries for random draw
  const shuffled = [...entries].sort(() => Math.random() - 0.5);

  // Create heats
  const heats = [];
  let heatNumber = 1;

  for (let i = 0; i < shuffled.length; i += lanesPerHeat) {
    const heatEntries = shuffled.slice(i, i + lanesPerHeat);

    const race = new BeachSprintRace({
      event: eventId,
      phase: "time_trial",
      heatNumber,
      raceCode: `TT${heatNumber}`,
      lanes: heatEntries.map((entry, idx) => ({
        lane: idx + 1,
        athlete: entry.athlete,
        crew: entry.crew || [],
        club: entry.club,
        status: "ok",
      })),
    });

    await race.save();
    heats.push(race);
    heatNumber++;
  }

  // Update event status
  event.status = "in_progress";
  event.currentPhase = "time_trial";
  await event.save();

  return heats;
}

/**
 * Record results for a race and process progression
 * @param {string} raceId - Race ID
 * @param {Array} results - Array of { lane, time, status } objects
 */
async function recordRaceResults(raceId, results) {
  const race = await BeachSprintRace.findById(raceId);
  if (!race) throw new Error("Race not found");

  // Update lane results
  for (const result of results) {
    const lane = race.lanes.find((l) => l.lane === result.lane);
    if (lane) {
      lane.time = result.time;
      lane.timeInMs = parseTimeToMs(result.time);
      lane.status = result.status || "ok";
    }
  }

  // Calculate positions based on time (only for OK status)
  const validLanes = race.lanes
    .filter((l) => l.status === "ok" && l.timeInMs)
    .sort((a, b) => a.timeInMs - b.timeInMs);

  validLanes.forEach((lane, idx) => {
    lane.position = idx + 1;
  });

  // Set position for non-OK lanes
  race.lanes.forEach((lane) => {
    if (lane.status !== "ok") {
      lane.position = null;
    }
  });

  race.status = "completed";
  await race.save();

  return race;
}

/**
 * Process progression after time trials are complete
 * Creates bracket for knockout rounds
 */
async function processTimeTrialProgression(eventId) {
  const event = await BeachSprintEvent.findById(eventId);
  if (!event) throw new Error("Event not found");

  // Get all time trial races
  const timeTrials = await BeachSprintRace.find({
    event: eventId,
    phase: "time_trial",
    status: "completed",
  });

  // Collect all results and sort by time
  const allResults = [];
  for (const race of timeTrials) {
    for (const lane of race.lanes) {
      if (lane.status === "ok" && lane.timeInMs) {
        allResults.push({
          athlete: lane.athlete,
          crew: lane.crew,
          club: lane.club,
          time: lane.time,
          timeInMs: lane.timeInMs,
          sourceRace: race._id,
        });
      }
    }
  }

  allResults.sort((a, b) => a.timeInMs - b.timeInMs);

  const config = event.progressionConfig;
  const directAdvance = config.timeTrialDirectAdvance || 4;
  const toRepechage = config.timeTrialToRepechage || 4;

  // Split into groups
  const directQualifiers = allResults.slice(0, directAdvance);
  const repechageEntries = config.hasRepechage
    ? allResults.slice(directAdvance, directAdvance + toRepechage)
    : [];

  // Generate next phase races
  if (config.hasRepechage && repechageEntries.length > 0) {
    await generateRepechageRaces(eventId, repechageEntries);
    event.currentPhase = "repechage";
  } else {
    await generateKnockoutBracket(eventId, directQualifiers);
    event.currentPhase = "quarterfinal";
  }

  await event.save();

  return {
    directQualifiers,
    repechageEntries,
    nextPhase: event.currentPhase,
  };
}

/**
 * Generate repechage races
 */
async function generateRepechageRaces(eventId, entries, lanesPerHeat = 2) {
  await BeachSprintRace.deleteMany({ event: eventId, phase: "repechage" });

  let heatNumber = 1;
  const races = [];

  for (let i = 0; i < entries.length; i += lanesPerHeat) {
    const heatEntries = entries.slice(i, i + lanesPerHeat);

    const race = new BeachSprintRace({
      event: eventId,
      phase: "repechage",
      heatNumber,
      raceCode: `REP${heatNumber}`,
      lanes: heatEntries.map((entry, idx) => ({
        lane: idx + 1,
        athlete: entry.athlete,
        crew: entry.crew || [],
        club: entry.club,
        status: "ok",
      })),
    });

    await race.save();
    races.push(race);
    heatNumber++;
  }

  return races;
}

/**
 * Generate knockout bracket (QF/SF/Finals)
 */
async function generateKnockoutBracket(eventId, qualifiedEntries) {
  const event = await BeachSprintEvent.findById(eventId);
  const numEntries = qualifiedEntries.length;

  // Determine bracket structure based on number of entries
  let phases = [];

  if (numEntries >= 8) {
    phases = ["quarterfinal", "semifinal", "final_b", "final_a"];
  } else if (numEntries >= 4) {
    phases = ["semifinal", "final_b", "final_a"];
  } else {
    phases = ["final_a"];
  }

  // Delete existing knockout races
  await BeachSprintRace.deleteMany({
    event: eventId,
    phase: { $in: ["quarterfinal", "semifinal", "final_a", "final_b"] },
  });

  // For now, create the first knockout round with seeding
  const firstKnockoutPhase = phases[0];

  if (firstKnockoutPhase === "quarterfinal") {
    // 8 entries: Create 4 QF races (1v8, 4v5, 2v7, 3v6 seeding)
    const seeding = [0, 7, 3, 4, 1, 6, 2, 5]; // Standard bracket seeding

    for (let i = 0; i < 4; i++) {
      const entry1 = qualifiedEntries[seeding[i * 2]];
      const entry2 = qualifiedEntries[seeding[i * 2 + 1]];

      const race = new BeachSprintRace({
        event: eventId,
        phase: "quarterfinal",
        heatNumber: i + 1,
        raceCode: `QF${i + 1}`,
        lanes: [
          entry1
            ? {
                lane: 1,
                athlete: entry1.athlete,
                crew: entry1.crew,
                club: entry1.club,
                status: "ok",
              }
            : null,
          entry2
            ? {
                lane: 2,
                athlete: entry2.athlete,
                crew: entry2.crew,
                club: entry2.club,
                status: "ok",
              }
            : null,
        ].filter(Boolean),
      });

      await race.save();
    }
  } else if (firstKnockoutPhase === "semifinal") {
    // 4 entries: Create 2 SF races
    for (let i = 0; i < 2; i++) {
      const entry1 = qualifiedEntries[i];
      const entry2 = qualifiedEntries[3 - i];

      const race = new BeachSprintRace({
        event: eventId,
        phase: "semifinal",
        heatNumber: i + 1,
        raceCode: `SF${i + 1}`,
        lanes: [
          entry1
            ? {
                lane: 1,
                athlete: entry1.athlete,
                crew: entry1.crew,
                club: entry1.club,
                status: "ok",
              }
            : null,
          entry2
            ? {
                lane: 2,
                athlete: entry2.athlete,
                crew: entry2.crew,
                club: entry2.club,
                status: "ok",
              }
            : null,
        ].filter(Boolean),
      });

      await race.save();
    }
  } else {
    // Direct to final
    const race = new BeachSprintRace({
      event: eventId,
      phase: "final_a",
      heatNumber: 1,
      raceCode: "FA",
      lanes: qualifiedEntries.map((entry, idx) => ({
        lane: idx + 1,
        athlete: entry.athlete,
        crew: entry.crew || [],
        club: entry.club,
        status: "ok",
      })),
    });

    await race.save();
  }

  event.currentPhase = firstKnockoutPhase;
  await event.save();
}

/**
 * Process knockout round results and advance winners
 */
async function processKnockoutProgression(eventId, phase) {
  const event = await BeachSprintEvent.findById(eventId);
  const races = await BeachSprintRace.find({
    event: eventId,
    phase,
    status: "completed",
  });

  const winners = [];
  const losers = [];

  for (const race of races) {
    const sorted = [...race.lanes]
      .filter((l) => l.status === "ok" && l.position)
      .sort((a, b) => a.position - b.position);

    if (sorted[0]) winners.push(sorted[0]);
    if (sorted[1]) losers.push(sorted[1]);
  }

  // Determine next phase
  let nextPhase;
  if (phase === "quarterfinal") {
    nextPhase = "semifinal";
    await generateNextKnockoutRound(eventId, nextPhase, winners);
  } else if (phase === "semifinal") {
    // Winners go to Final A, Losers go to Final B (for bronze)
    await generateFinals(eventId, winners, losers);
    nextPhase = "final_a";
  }

  event.currentPhase = nextPhase;
  await event.save();

  return { winners, losers, nextPhase };
}

/**
 * Generate next knockout round races
 */
async function generateNextKnockoutRound(eventId, phase, entries) {
  await BeachSprintRace.deleteMany({ event: eventId, phase });

  const numRaces = Math.ceil(entries.length / 2);

  for (let i = 0; i < numRaces; i++) {
    const entry1 = entries[i * 2];
    const entry2 = entries[i * 2 + 1];

    const raceCode = phase === "semifinal" ? `SF${i + 1}` : `QF${i + 1}`;

    const race = new BeachSprintRace({
      event: eventId,
      phase,
      heatNumber: i + 1,
      raceCode,
      lanes: [
        entry1
          ? {
              lane: 1,
              athlete: entry1.athlete,
              crew: entry1.crew,
              club: entry1.club,
              status: "ok",
            }
          : null,
        entry2
          ? {
              lane: 2,
              athlete: entry2.athlete,
              crew: entry2.crew,
              club: entry2.club,
              status: "ok",
            }
          : null,
      ].filter(Boolean),
    });

    await race.save();
  }
}

/**
 * Generate Final A and Final B
 */
async function generateFinals(eventId, finalistA, finalistB) {
  await BeachSprintRace.deleteMany({
    event: eventId,
    phase: { $in: ["final_a", "final_b"] },
  });

  // Final A (Gold/Silver)
  if (finalistA.length >= 2) {
    const raceA = new BeachSprintRace({
      event: eventId,
      phase: "final_a",
      heatNumber: 1,
      raceCode: "FA",
      lanes: finalistA.map((entry, idx) => ({
        lane: idx + 1,
        athlete: entry.athlete,
        crew: entry.crew || [],
        club: entry.club,
        status: "ok",
      })),
    });
    await raceA.save();
  }

  // Final B (Bronze)
  if (finalistB.length >= 2) {
    const raceB = new BeachSprintRace({
      event: eventId,
      phase: "final_b",
      heatNumber: 1,
      raceCode: "FB",
      lanes: finalistB.map((entry, idx) => ({
        lane: idx + 1,
        athlete: entry.athlete,
        crew: entry.crew || [],
        club: entry.club,
        status: "ok",
      })),
    });
    await raceB.save();
  }
}

/**
 * Process final results and assign medals
 */
async function processFinalResults(eventId) {
  const event = await BeachSprintEvent.findById(eventId);

  const finalA = await BeachSprintRace.findOne({
    event: eventId,
    phase: "final_a",
    status: "completed",
  });

  const finalB = await BeachSprintRace.findOne({
    event: eventId,
    phase: "final_b",
    status: "completed",
  });

  const medals = { gold: null, silver: null, bronze: null };

  // Final A results
  if (finalA) {
    const sorted = [...finalA.lanes]
      .filter((l) => l.status === "ok" && l.position)
      .sort((a, b) => a.position - b.position);

    if (sorted[0]) {
      medals.gold = {
        athlete: sorted[0].athlete,
        crew: sorted[0].crew,
        club: sorted[0].club,
        time: sorted[0].time,
      };
    }

    if (sorted[1]) {
      medals.silver = {
        athlete: sorted[1].athlete,
        crew: sorted[1].crew,
        club: sorted[1].club,
        time: sorted[1].time,
      };
    }
  }

  // Final B results (bronze)
  if (finalB) {
    const sorted = [...finalB.lanes]
      .filter((l) => l.status === "ok" && l.position)
      .sort((a, b) => a.position - b.position);

    if (sorted[0]) {
      medals.bronze = {
        athlete: sorted[0].athlete,
        crew: sorted[0].crew,
        club: sorted[0].club,
        time: sorted[0].time,
      };
    }
  }

  // Update event with medals
  event.medals = medals;
  event.status = "completed";
  await event.save();

  // Update club standings
  await updateClubStandings(event.competition);

  return medals;
}

/**
 * Update club standings for a competition
 */
async function updateClubStandings(competitionId) {
  // Get all completed events
  const events = await BeachSprintEvent.find({
    competition: competitionId,
    status: "completed",
  });

  // Aggregate medals by club
  const clubMedals = {};

  for (const event of events) {
    for (const medalType of ["gold", "silver", "bronze"]) {
      const medal = event.medals?.[medalType];
      if (medal?.club) {
        const clubId = medal.club.toString();

        if (!clubMedals[clubId]) {
          clubMedals[clubId] = {
            club: medal.club,
            gold: 0,
            silver: 0,
            bronze: 0,
            medalDetails: [],
          };
        }

        clubMedals[clubId][medalType]++;
        clubMedals[clubId].medalDetails.push({
          event: event._id,
          eventName: event.name,
          medalType,
        });
      }
    }
  }

  // Clear existing standings
  await BeachSprintStanding.deleteMany({ competition: competitionId });

  // Create new standings
  const standings = Object.values(clubMedals);

  // Sort by gold, then silver, then bronze (Olympic ranking)
  standings.sort((a, b) => {
    if (a.gold !== b.gold) return b.gold - a.gold;
    if (a.silver !== b.silver) return b.silver - a.silver;
    return b.bronze - a.bronze;
  });

  // Assign ranks and save
  for (let i = 0; i < standings.length; i++) {
    const standing = standings[i];

    await BeachSprintStanding.create({
      competition: competitionId,
      club: standing.club,
      gold: standing.gold,
      silver: standing.silver,
      bronze: standing.bronze,
      total: standing.gold + standing.silver + standing.bronze,
      rank: i + 1,
      medalDetails: standing.medalDetails,
    });
  }

  return standings;
}

/**
 * Get club standings for a competition
 */
async function getClubStandings(competitionId) {
  return BeachSprintStanding.find({ competition: competitionId })
    .populate("club")
    .populate("medalDetails.event")
    .sort({ rank: 1 });
}

/**
 * Get bracket structure for display
 */
async function getEventBracket(eventId) {
  const event = await BeachSprintEvent.findById(eventId)
    .populate("boatClass")
    .populate("category");

  if (!event) return null;

  const races = await BeachSprintRace.find({ event: eventId })
    .populate("lanes.athlete")
    .populate("lanes.crew")
    .populate("lanes.club")
    .sort({ phase: 1, heatNumber: 1 });

  // Group races by phase
  const bracket = {
    event,
    phases: {},
  };

  for (const phase of RACE_PHASES) {
    const phaseRaces = races.filter((r) => r.phase === phase);
    if (phaseRaces.length > 0) {
      bracket.phases[phase] = phaseRaces;
    }
  }

  return bracket;
}

/**
 * Map a Category gender ("men"|"women"|"mixed") to a BeachSprintEvent
 * gender enum ("M"|"F"|"Mixed").
 */
function categoryGenderToEventGender(categoryGender) {
  const g = String(categoryGender || "").toLowerCase();
  if (g === "men") return "M";
  if (g === "women") return "F";
  return "Mixed";
}

/**
 * Auto-generate Beach Sprint events from a competition's registrations.
 *
 * Reads eligible entries (pending/approved), groups them by
 * category + boatClass, and creates one BeachSprintEvent per group that
 * actually has entries (gender derived from the category). Idempotent:
 * combinations that already have an event are skipped.
 *
 * @param {string} competitionId
 * @returns {Promise<{ created: Array, skipped: Array, totalGroups: number }>}
 */
async function autoGenerateEvents(competitionId) {
  const entries = await CompetitionEntry.find({
    competition: competitionId,
    status: { $in: ["pending", "approved"] },
  })
    .populate("category")
    .populate("boatClass");

  // Group by category + boatClass
  const groups = new Map();
  for (const entry of entries) {
    const categoryId = entry.category?._id?.toString() || null;
    const boatClassId = entry.boatClass?._id?.toString() || null;
    if (!categoryId || !boatClassId) continue; // need both to define an event
    const key = `${categoryId}::${boatClassId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        categoryId,
        boatClassId,
        category: entry.category,
        boatClass: entry.boatClass,
        count: 0,
      });
    }
    groups.get(key).count += 1;
  }

  // Load existing events to avoid duplicates
  const existingEvents = await BeachSprintEvent.find({
    competition: competitionId,
  });
  const existingKeys = new Set(
    existingEvents.map(
      (ev) =>
        `${ev.category?.toString?.() || ev.category}::${
          ev.boatClass?.toString?.() || ev.boatClass
        }`,
    ),
  );

  const created = [];
  const skipped = [];

  for (const group of groups.values()) {
    const key = `${group.categoryId}::${group.boatClassId}`;
    if (existingKeys.has(key)) {
      skipped.push({
        categoryId: group.categoryId,
        boatClassId: group.boatClassId,
        reason: "event_exists",
      });
      continue;
    }

    const categoryLabel =
      group.category?.titles?.en || group.category?.abbreviation || "Category";
    const boatLabel =
      group.boatClass?.names?.en || group.boatClass?.code || "Boat";
    const name = `${categoryLabel} ${boatLabel}`;
    const gender = categoryGenderToEventGender(group.category?.gender);

    const event = new BeachSprintEvent({
      competition: competitionId,
      boatClass: group.boatClassId,
      category: group.categoryId,
      gender,
      name,
      progressionConfig: {},
    });
    await event.save();
    created.push(event);
  }

  return { created, skipped, totalGroups: groups.size };
}

/**
 * Normalize an event gender value to an athlete gender matcher.
 * Event genders are stored as "M" | "F" | "Mixed".
 * Athlete genders may be stored in various forms (male/female/M/F/...).
 */
function genderMatches(eventGender, athleteGender) {
  if (!eventGender || eventGender === "Mixed") return true;
  if (!athleteGender) return true; // don't hide entries with unknown gender
  const g = String(athleteGender).trim().toLowerCase();
  if (eventGender === "M") {
    return g === "m" || g === "male" || g === "men" || g === "man";
  }
  if (eventGender === "F") {
    return g === "f" || g === "female" || g === "women" || g === "woman";
  }
  return true;
}

/**
 * Get the registered entries eligible for a Beach Sprint event.
 *
 * Beach Sprint has no manual "approve" step yet, so both `pending` and
 * `approved` entries are considered eligible (only `rejected`/`withdrawn`
 * are excluded). Entries are matched to the event by competition, category,
 * boat class and — via the athlete/crew — gender.
 *
 * @param {string} eventId
 * @returns {Promise<{ event: object, entries: Array, total: number }>}
 */
async function getEventEntries(eventId) {
  const event = await BeachSprintEvent.findById(eventId)
    .populate("boatClass")
    .populate("category");
  if (!event) throw new Error("Event not found");

  const query = {
    competition: event.competition,
    category: event.category?._id || event.category,
    status: { $in: ["pending", "approved"] },
  };
  // Only constrain boat class when the event has one (it always should)
  if (event.boatClass?._id || event.boatClass) {
    query.boatClass = event.boatClass?._id || event.boatClass;
  }

  const rawEntries = await CompetitionEntry.find(query)
    .populate("athlete")
    .populate("crew")
    .populate("club")
    .sort({ seed: 1, createdAt: 1 });

  // Filter by gender using the athlete (or first crew member) gender.
  const filtered = rawEntries.filter((entry) => {
    const primary =
      entry.athlete ||
      (Array.isArray(entry.crew) && entry.crew.length ? entry.crew[0] : null);
    return genderMatches(event.gender, primary?.gender);
  });

  // Normalize into a lightweight shape the frontend can render directly,
  // preserving the ObjectId references needed to generate races.
  const entries = filtered.map((entry, index) => {
    const crew = Array.isArray(entry.crew) ? entry.crew : [];
    const athleteName = entry.athlete
      ? [entry.athlete.firstName, entry.athlete.lastName]
          .filter(Boolean)
          .join(" ")
      : null;
    const crewNames = crew
      .map((m) => [m?.firstName, m?.lastName].filter(Boolean).join(" "))
      .filter(Boolean);

    return {
      entryId: entry._id,
      seed: entry.seed ?? null,
      classification: entry.seed ?? index + 1,
      status: entry.status,
      athlete: entry.athlete?._id || null,
      athleteName: athleteName || null,
      crew: crew.map((m) => m?._id).filter(Boolean),
      crewNames,
      displayName: athleteName || crewNames.join(" / ") || "Unknown",
      club: entry.club?._id || null,
      clubName: entry.club?.name || null,
      clubCode: entry.club?.code || null,
      representingType: entry.representingType || "club",
      representingNation: entry.representingNation || null,
    };
  });

  return { event, entries, total: entries.length };
}

/**
 * Format a Date (or date string) to an ISO "YYYY-MM-DD" string.
 * Returns "" for missing/invalid values.
 */
function formatDateYMD(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Derive the age-group prefix used by the external race-management system
 * from a Category. Rules (per federation usage):
 *   - Under-17 category  -> "U17"
 *   - Junior category    -> "J"
 *   - Senior category    -> "" (no prefix)
 */
function ageGroupPrefix(category) {
  if (!category) return "";
  const abbr = String(category.abbreviation || "").toUpperCase();
  const titleEn = String(category.titles?.en || "").toUpperCase();
  const haystack = `${abbr} ${titleEn}`;

  if (/(U-?17|UNDER\s*17)/.test(haystack)) return "U17";
  // Match a junior category but avoid matching "senior".
  if (/\bJ(UNIOR)?\b/.test(haystack) || /^J/.test(abbr)) return "J";
  return "";
}

/**
 * Map a gender value to the external system's letter:
 *   men -> "M", women -> "W", mixed -> "Mix".
 * Accepts category gender ("men"/"women"/"mixed") or event gender
 * ("M"/"F"/"Mixed").
 */
function eventGenderLetter(gender) {
  const g = String(gender || "").toLowerCase();
  if (g === "men" || g === "m" || g === "male") return "M";
  if (g === "women" || g === "f" || g === "female") return "W";
  return "Mix";
}

/**
 * Build the external "Event" code for an entry, e.g. "CU17W1x", "CJM2x",
 * "CMix2x". Format: "C" (Coastal) + [agePrefix] + genderLetter + boatCode.
 *
 * @param {object} category  - populated Category document
 * @param {object} boatClass - populated BoatClass document
 * @returns {string}
 */
function buildEventCode(category, boatClass) {
  const prefix = ageGroupPrefix(category);
  const gender = eventGenderLetter(category?.gender);

  // Boat class codes may already embed the discipline/gender (e.g. "C1x",
  // "C2x", "Cmix2x"). We only want the boat SIZE ("1x"/"2x") here, since the
  // external "Event" code is composed as "C" + [agePrefix] + gender + size.
  const rawCode = String(boatClass?.code || "").toLowerCase();
  const sizeMatch = rawCode.match(/\d+x/);
  const boatSize = sizeMatch ? sizeMatch[0] : rawCode.replace(/[^0-9x]/gi, "");

  return `C${prefix}${gender}${boatSize}`;
}

/**
 * Determine the seat "Position" label for a crew member.
 * The `crew` array order encodes seating (index 0 = Bow, last = Stroke),
 * matching how registration stores/reorders crew.
 *   - Single or bow seat  -> "b"
 *   - Stroke seat (last)  -> "s"
 *   - Middle seats        -> seat number ("2", "3", ...)
 */
function seatPositionLabel(index, crewSize) {
  if (crewSize <= 1) return "b";
  if (index === 0) return "b";
  if (index === crewSize - 1) return "s";
  return String(index + 1);
}

/**
 * Build the "Entries by Team" Excel workbook for a competition, matching the
 * exact column layout expected by the external race-management system.
 *
 * One row is produced per athlete per entry (crew boats expand to multiple
 * rows sharing the same Crew Number and Event).
 *
 * @param {string} competitionId
 * @returns {Promise<{ buffer: Buffer, fileName: string, rowCount: number }>}
 */
async function generateEntriesByTeamWorkbook(competitionId) {
  const competition = await Competition.findById(competitionId).lean();
  if (!competition) throw new Error("Competition not found");

  const entries = await CompetitionEntry.find({
    competition: competitionId,
    status: { $nin: ["rejected", "withdrawn"] },
  })
    .populate("athlete")
    .populate("crew")
    .populate("club")
    .populate("category")
    .populate("boatClass")
    .sort({ createdAt: 1 });

  // Expand entries into per-athlete rows.
  const rows = [];
  for (const entry of entries) {
    const club = entry.club || null;
    const isNation = entry.representingType === "nation";

    // Team identity: nation code for international entries, else club code.
    const teamCode = isNation
      ? entry.representingNation || club?.code || ""
      : club?.code || "";
    const teamName = isNation
      ? entry.representingNation || club?.name || ""
      : club?.name || "";
    const teamLeader = club?.contacts?.primaryName || "";
    const leaderTel = club?.contacts?.primaryPhone || club?.phone || "";
    const email = club?.email || "";
    const entryDate = formatDateYMD(entry.submittedAt || entry.createdAt);

    const eventCode = buildEventCode(entry.category, entry.boatClass);
    const crewNumber = entry.crewNumber || 1;

    // Build the ordered athlete list for this entry (single or crew).
    const athletes =
      Array.isArray(entry.crew) && entry.crew.length > 0
        ? entry.crew
        : entry.athlete
          ? [entry.athlete]
          : [];

    const crewSize = athletes.length;

    athletes.forEach((athlete, index) => {
      if (!athlete) return;
      const nationality =
        athlete.nationalityCode || athlete.nationality || teamCode || "";
      const athleteId =
        athlete.licenseNumber ||
        athlete.passportNumber ||
        athlete.cin ||
        athlete.fisaId ||
        "";

      rows.push({
        teamCode,
        teamName,
        teamLeader,
        leaderTel,
        email,
        entryDate,
        familyName: athlete.lastName || "",
        givenName: athlete.firstName || "",
        gender: athlete.gender === "female" ? "F" : "M",
        dateOfBirth: formatDateYMD(athlete.birthDate),
        nationality,
        athleteId,
        event: eventCode,
        crewNumber,
        position: seatPositionLabel(index, crewSize),
      });
    });
  }

  // Sort for a clean, grouped file: Team, Event, Crew Number, then seat.
  const seatRank = (p) => (p === "b" ? 0 : p === "s" ? 99 : Number(p) || 50);
  rows.sort((a, b) => {
    if (a.teamCode !== b.teamCode) return a.teamCode.localeCompare(b.teamCode);
    if (a.event !== b.event) return a.event.localeCompare(b.event);
    if (a.crewNumber !== b.crewNumber) return a.crewNumber - b.crewNumber;
    return seatRank(a.position) - seatRank(b.position);
  });

  // Build the workbook.
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TRF Portal";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Entries by Team");
  worksheet.columns = [
    { header: "Team Code", key: "teamCode", width: 12 },
    { header: "Team Name", key: "teamName", width: 20 },
    { header: "Team Leader", key: "teamLeader", width: 18 },
    { header: "Leader Tel", key: "leaderTel", width: 14 },
    { header: "Email", key: "email", width: 22 },
    { header: "Entry Date", key: "entryDate", width: 12 },
    { header: "Family Name", key: "familyName", width: 18 },
    { header: "Given Name", key: "givenName", width: 18 },
    { header: "Gender", key: "gender", width: 8 },
    { header: "Date Of Birth", key: "dateOfBirth", width: 13 },
    { header: "Nationality", key: "nationality", width: 11 },
    {
      header: "Athlete ID/Passport/License No.",
      key: "athleteId",
      width: 28,
    },
    { header: "Event", key: "event", width: 12 },
    { header: "Crew Number", key: "crewNumber", width: 12 },
    { header: "Position", key: "position", width: 9 },
  ];

  // Force text formatting so codes/ids are not coerced to numbers/dates.
  worksheet.getColumn("entryDate").numFmt = "@";
  worksheet.getColumn("dateOfBirth").numFmt = "@";
  worksheet.getColumn("athleteId").numFmt = "@";

  worksheet.getRow(1).font = { bold: true };

  rows.forEach((row) => worksheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = String(competition.name || "competition")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  const fileName = `Entries_by_Team_${safeName || "competition"}.xlsx`;

  return { buffer, fileName, rowCount: rows.length };
}

export {
  createEvent,
  autoGenerateEvents,
  generateEntriesByTeamWorkbook,
  getEventsByCompetition,
  getEventWithRaces,
  getEventEntries,
  generateTimeTrialHeats,
  recordRaceResults,
  processTimeTrialProgression,
  processKnockoutProgression,
  processFinalResults,
  updateClubStandings,
  getClubStandings,
  getEventBracket,
  parseTimeToMs,
  formatMsToTime,
};
