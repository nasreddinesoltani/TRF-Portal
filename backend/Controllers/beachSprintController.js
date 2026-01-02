/**
 * Beach Sprint Controller
 *
 * API endpoints for managing Beach Sprint competitions
 */

import {
  BeachSprintEvent,
  BeachSprintRace,
  BeachSprintStanding,
  RACE_PHASES,
} from "../Models/beachSprintModel.js";

import * as beachSprintService from "../Services/beachSprintService.js";

/**
 * Create a new Beach Sprint event
 * POST /api/beach-sprint/events
 */
export const createEvent = async (req, res) => {
  try {
    const {
      competitionId,
      boatClassId,
      categoryId,
      gender,
      name,
      progressionConfig,
    } = req.body;

    if (!competitionId || !boatClassId || !categoryId || !gender || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const event = await beachSprintService.createEvent({
      competitionId,
      boatClassId,
      categoryId,
      gender,
      name,
      progressionConfig,
    });

    res.status(201).json(event);
  } catch (error) {
    console.error("Error creating beach sprint event:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all events for a competition
 * GET /api/beach-sprint/competitions/:competitionId/events
 */
export const getCompetitionEvents = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const events = await beachSprintService.getEventsByCompetition(
      competitionId
    );
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single event with all races
 * GET /api/beach-sprint/events/:eventId
 */
export const getEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await beachSprintService.getEventWithRaces(eventId);

    if (!result) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update event details
 * PUT /api/beach-sprint/events/:eventId
 */
export const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;

    const event = await BeachSprintEvent.findByIdAndUpdate(
      eventId,
      { $set: updates },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(event);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete event and all its races
 * DELETE /api/beach-sprint/events/:eventId
 */
export const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Delete all races for this event
    await BeachSprintRace.deleteMany({ event: eventId });

    // Delete the event
    const event = await BeachSprintEvent.findByIdAndDelete(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Update standings
    await beachSprintService.updateClubStandings(event.competition);

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get event bracket structure
 * GET /api/beach-sprint/events/:eventId/bracket
 */
export const getEventBracket = async (req, res) => {
  try {
    const { eventId } = req.params;
    const bracket = await beachSprintService.getEventBracket(eventId);

    if (!bracket) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(bracket);
  } catch (error) {
    console.error("Error fetching bracket:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Generate time trial heats from entries
 * POST /api/beach-sprint/events/:eventId/generate-time-trials
 */
export const generateTimeTrials = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { entries, lanesPerHeat } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "Entries are required" });
    }

    const heats = await beachSprintService.generateTimeTrialHeats(
      eventId,
      entries,
      lanesPerHeat || 4
    );

    res.json({ message: `Generated ${heats.length} time trial heats`, heats });
  } catch (error) {
    console.error("Error generating time trials:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all races for an event
 * GET /api/beach-sprint/events/:eventId/races
 */
export const getEventRaces = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phase } = req.query;

    const query = { event: eventId };
    if (phase) query.phase = phase;

    const races = await BeachSprintRace.find(query)
      .populate("lanes.athlete")
      .populate("lanes.crew")
      .populate("lanes.club")
      .sort({ phase: 1, heatNumber: 1 });

    res.json(races);
  } catch (error) {
    console.error("Error fetching races:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single race
 * GET /api/beach-sprint/races/:raceId
 */
export const getRace = async (req, res) => {
  try {
    const { raceId } = req.params;

    const race = await BeachSprintRace.findById(raceId)
      .populate("lanes.athlete")
      .populate("lanes.crew")
      .populate("lanes.club");

    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    res.json(race);
  } catch (error) {
    console.error("Error fetching race:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update race (schedule, notes, etc.)
 * PUT /api/beach-sprint/races/:raceId
 */
export const updateRace = async (req, res) => {
  try {
    const { raceId } = req.params;
    const updates = req.body;

    const race = await BeachSprintRace.findByIdAndUpdate(
      raceId,
      { $set: updates },
      { new: true }
    )
      .populate("lanes.athlete")
      .populate("lanes.crew")
      .populate("lanes.club");

    if (!race) {
      return res.status(404).json({ message: "Race not found" });
    }

    res.json(race);
  } catch (error) {
    console.error("Error updating race:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Record race results
 * POST /api/beach-sprint/races/:raceId/results
 */
export const recordRaceResults = async (req, res) => {
  try {
    const { raceId } = req.params;
    const { results } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ message: "Results array is required" });
    }

    const race = await beachSprintService.recordRaceResults(raceId, results);

    // Populate for response
    await race.populate("lanes.athlete");
    await race.populate("lanes.crew");
    await race.populate("lanes.club");

    res.json(race);
  } catch (error) {
    console.error("Error recording results:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Process time trial progression
 * POST /api/beach-sprint/events/:eventId/process-time-trial
 */
export const processTimeTrialProgression = async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await beachSprintService.processTimeTrialProgression(
      eventId
    );

    res.json({
      message: `Progression processed. Next phase: ${result.nextPhase}`,
      ...result,
    });
  } catch (error) {
    console.error("Error processing progression:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Process knockout round progression
 * POST /api/beach-sprint/events/:eventId/process-knockout
 */
export const processKnockoutProgression = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phase } = req.body;

    if (!phase) {
      return res.status(400).json({ message: "Phase is required" });
    }

    const result = await beachSprintService.processKnockoutProgression(
      eventId,
      phase
    );

    res.json({
      message: `Knockout progression processed. Next phase: ${result.nextPhase}`,
      ...result,
    });
  } catch (error) {
    console.error("Error processing knockout:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Process final results and assign medals
 * POST /api/beach-sprint/events/:eventId/process-finals
 */
export const processFinalResults = async (req, res) => {
  try {
    const { eventId } = req.params;

    const medals = await beachSprintService.processFinalResults(eventId);

    res.json({
      message: "Finals processed and medals assigned",
      medals,
    });
  } catch (error) {
    console.error("Error processing finals:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get club standings for a competition
 * GET /api/beach-sprint/competitions/:competitionId/standings
 */
export const getClubStandings = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const standings = await beachSprintService.getClubStandings(competitionId);
    res.json(standings);
  } catch (error) {
    console.error("Error fetching standings:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Recalculate club standings
 * POST /api/beach-sprint/competitions/:competitionId/recalculate-standings
 */
export const recalculateStandings = async (req, res) => {
  try {
    const { competitionId } = req.params;

    await beachSprintService.updateClubStandings(competitionId);
    const standings = await beachSprintService.getClubStandings(competitionId);

    res.json({
      message: "Standings recalculated",
      standings,
    });
  } catch (error) {
    console.error("Error recalculating standings:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get available race phases
 * GET /api/beach-sprint/phases
 */
export const getRacePhases = async (req, res) => {
  const phases = RACE_PHASES.map((phase) => ({
    value: phase,
    label: BeachSprintRace.getPhaseDisplayName(phase),
  }));

  res.json(phases);
};
