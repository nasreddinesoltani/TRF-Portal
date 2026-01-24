/**
 * Ranking Controller
 *
 * Handles ranking system CRUD and competition ranking calculations.
 */

import RankingSystem from "../Models/rankingSystemModel.js";
import {
  buildCompetitionRanking,
  getRankingSummary,
} from "../Services/rankingService.js";
import {
  getAllPresets,
  getPresetsForDiscipline,
} from "../Services/rankingPresets.js";

/**
 * Get all ranking systems
 * GET /api/rankings/systems
 */
export const getRankingSystems = async (req, res) => {
  try {
    const { discipline, activeOnly } = req.query;

    const filter = {};
    if (discipline) filter.discipline = { $in: [discipline, null] };
    if (activeOnly === "true") filter.isActive = true;

    const systems = await RankingSystem.find(filter)
      .sort({ sortOrder: 1, code: 1 })
      .populate("allowedBoatClasses");

    res.json(systems);
  } catch (error) {
    console.error("Error fetching ranking systems:", error);
    res.status(500).json({ message: "Failed to fetch ranking systems" });
  }
};

/**
 * Get a single ranking system by ID
 * GET /api/rankings/systems/:id
 */
export const getRankingSystemById = async (req, res) => {
  try {
    const system = await RankingSystem.findById(req.params.id).populate(
      "allowedBoatClasses"
    );

    if (!system) {
      return res.status(404).json({ message: "Ranking system not found" });
    }

    res.json(system);
  } catch (error) {
    console.error("Error fetching ranking system:", error);
    res.status(500).json({ message: "Failed to fetch ranking system" });
  }
};

/**
 * Create a new ranking system
 * POST /api/rankings/systems
 */
export const createRankingSystem = async (req, res) => {
  try {
    const system = new RankingSystem({
      ...req.body,
      isPreset: false, // Custom systems are not presets
    });

    await system.save();
    res.status(201).json(system);
  } catch (error) {
    console.error("Error creating ranking system:", error);
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: "A ranking system with this code already exists" });
    }
    res.status(500).json({ message: "Failed to create ranking system" });
  }
};

/**
 * Update a ranking system
 * PUT /api/rankings/systems/:id
 */
export const updateRankingSystem = async (req, res) => {
  try {
    const system = await RankingSystem.findById(req.params.id);

    if (!system) {
      return res.status(404).json({ message: "Ranking system not found" });
    }

    // Don't allow modifying preset flag
    const { isPreset, ...updateData } = req.body;

    Object.assign(system, updateData);
    await system.save();

    res.json(system);
  } catch (error) {
    console.error("Error updating ranking system:", error);
    res.status(500).json({ message: "Failed to update ranking system" });
  }
};

/**
 * Delete a ranking system
 * DELETE /api/rankings/systems/:id
 */
export const deleteRankingSystem = async (req, res) => {
  try {
    const system = await RankingSystem.findById(req.params.id);

    if (!system) {
      return res.status(404).json({ message: "Ranking system not found" });
    }

    if (system.isPreset) {
      return res
        .status(400)
        .json({ message: "Cannot delete preset ranking systems" });
    }

    await system.deleteOne();
    res.json({ message: "Ranking system deleted" });
  } catch (error) {
    console.error("Error deleting ranking system:", error);
    res.status(500).json({ message: "Failed to delete ranking system" });
  }
};

/**
 * Get preset configurations (for reference/templates)
 * GET /api/rankings/presets
 */
export const getPresets = async (req, res) => {
  try {
    const { discipline } = req.query;

    const presets = discipline
      ? getPresetsForDiscipline(discipline)
      : getAllPresets();

    res.json(presets);
  } catch (error) {
    console.error("Error fetching presets:", error);
    res.status(500).json({ message: "Failed to fetch presets" });
  }
};

/**
 * Sync presets to database (create/update)
 * POST /api/rankings/presets/sync
 */
export const syncPresets = async (req, res) => {
  try {
    const presets = getAllPresets();
    const results = [];

    for (const preset of presets) {
      const existing = await RankingSystem.findOne({ code: preset.code });

      if (existing) {
        await RankingSystem.findOneAndUpdate(
          { code: preset.code },
          { $set: preset }
        );
        results.push({ code: preset.code, action: "updated" });
      } else {
        await RankingSystem.create(preset);
        results.push({ code: preset.code, action: "created" });
      }
    }

    res.json({
      message: "Presets synced successfully",
      results,
    });
  } catch (error) {
    console.error("Error syncing presets:", error);
    res.status(500).json({ message: "Failed to sync presets" });
  }
};

/**
 * Calculate ranking for a competition
 * GET /api/rankings/competition/:competitionId
 * Query params:
 *   - systemId: Ranking system ID
 *   - summary: "true" for simplified view
 *   - includeMasters: "true" or "false" to include/exclude masters categories
 */
export const getCompetitionRanking = async (req, res) => {
  try {
    const { competitionId } = req.params;
    const { systemId, summary, includeMasters } = req.query;

    // Build options from query params
    const options = {};
    if (includeMasters !== undefined) {
      options.includeMasters = includeMasters === "true";
    }

    let ranking;
    if (summary === "true") {
      ranking = await getRankingSummary(
        competitionId,
        systemId || null,
        options
      );
    } else {
      ranking = await buildCompetitionRanking(
        competitionId,
        systemId || null,
        options
      );
    }

    res.json(ranking);
  } catch (error) {
    console.error("Error calculating ranking:", error.message, error.stack);
    if (error.message === "Competition not found") {
      return res.status(404).json({ message: "Competition not found" });
    }
    res
      .status(500)
      .json({ message: "Failed to calculate ranking", error: error.message });
  }
};

/**
 * Get ranking for a specific group within a competition
 * GET /api/rankings/competition/:competitionId/group/:groupKey
 */
export const getCompetitionGroupRanking = async (req, res) => {
  try {
    const { competitionId, groupKey } = req.params;
    const { systemId } = req.query;

    const fullRanking = await buildCompetitionRanking(
      competitionId,
      systemId || null
    );

    const groupRanking = fullRanking.rankings[groupKey];

    if (!groupRanking) {
      return res.status(404).json({
        message: "Group not found",
        availableGroups: Object.keys(fullRanking.rankings),
      });
    }

    res.json({
      competition: fullRanking.competition,
      rankingSystem: fullRanking.rankingSystem,
      groupKey,
      ranking: groupRanking,
      generatedAt: fullRanking.generatedAt,
    });
  } catch (error) {
    console.error("Error calculating group ranking:", error);
    res.status(500).json({ message: "Failed to calculate group ranking" });
  }
};

/**
 * Get available ranking systems for a competition
 * GET /api/rankings/competition/:competitionId/available-systems
 */
export const getAvailableSystemsForCompetition = async (req, res) => {
  try {
    const { competitionId } = req.params;

    // Get competition to determine discipline
    const Competition = (await import("../Models/competitionModel.js")).default;
    const competition = await Competition.findById(competitionId);

    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    // Get ranking systems that apply to this discipline
    const systems = await RankingSystem.find({
      isActive: true,
      $or: [{ discipline: competition.discipline }, { discipline: null }],
    }).sort({ sortOrder: 1 });

    res.json({
      competition: {
        _id: competition._id,
        code: competition.code,
        discipline: competition.discipline,
      },
      availableSystems: systems,
    });
  } catch (error) {
    console.error("Error fetching available systems:", error);
    res.status(500).json({ message: "Failed to fetch available systems" });
  }
};
