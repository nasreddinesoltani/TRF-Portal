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

import {
  BeachSprintEvent,
  BeachSprintRace,
  BeachSprintStanding,
  RACE_PHASES,
  PROGRESSION_RULES,
} from "../Models/beachSprintModel.js";

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
  return BeachSprintEvent.find({ competition: competitionId })
    .populate("boatClass")
    .populate("category")
    .sort({ gender: 1, "category.ageMin": -1 });
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

export {
  createEvent,
  getEventsByCompetition,
  getEventWithRaces,
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
