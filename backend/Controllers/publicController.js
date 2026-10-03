import Competition from "../Models/competitionModel.js";
import OfficialResult from "../Models/officialResultModel.js";
import CompetitionRace from "../Models/competitionRaceModel.js";

/**
 * @desc    Get a single public competition by id
 * @route   GET /api/public/competitions/:competitionId
 * @access  Public
 */
export const getPublicCompetition = async (req, res) => {
  try {
    const { competitionId } = req.params;

    const competition = await Competition.findById(competitionId)
      .populate("allowedCategories", "name nameAr code")
      .populate("allowedBoatClasses", "name nameAr code")
      .lean();

    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    if (
      competition.status !== "published" &&
      competition.status !== "completed"
    ) {
      return res
        .status(403)
        .json({ message: "Competition not available for public access" });
    }

    res.json(competition);
  } catch (error) {
    console.error("Error in getPublicCompetition:", error);
    res.status(500).json({ message: "Server error retrieving competition" });
  }
};

/**
 * @desc    Get all public competitions (published or completed)
 * @route   GET /api/public/competitions
 * @access  Public
 */
export const getPublicCompetitions = async (req, res) => {
  try {
    const { upcoming, completed, limit } = req.query;

    let query = {
      status: { $in: ["published", "completed"] },
    };

    const now = new Date();

    if (upcoming === "true") {
      query.status = "published";
      query.startDate = { $gte: now };
    } else if (completed === "true") {
      // Return competitions that are explicitly completed or whose end date is in the past
      query.$or = [
        { status: "completed" },
        { status: "published", endDate: { $lt: now } },
      ];
    }

    let competitionsQuery = Competition.find(query)
      .populate("allowedCategories", "name nameAr code")
      .populate("allowedBoatClasses", "name nameAr code")
      .sort({ startDate: -1 });

    if (limit) {
      competitionsQuery = competitionsQuery.limit(parseInt(limit, 10));
    }

    const competitions = await competitionsQuery.lean();
    res.json(competitions);
  } catch (error) {
    console.error("Error in getPublicCompetitions:", error);
    res
      .status(500)
      .json({ message: "Server error retrieving public competitions" });
  }
};

/**
 * @desc    Get official results for a competition
 * @route   GET /api/public/competitions/:competitionId/results
 * @access  Public
 */
export const getPublicCompetitionResults = async (req, res) => {
  try {
    const { competitionId } = req.params;

    const competition = await Competition.findById(competitionId).lean();
    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    // Only allow public viewing if competition status is published/completed
    if (
      competition.status !== "published" &&
      competition.status !== "completed"
    ) {
      return res
        .status(403)
        .json({ message: "Results not available for public access" });
    }

    // Find official published results and populate deep athlete/club details
    const results = await OfficialResult.find({ competition: competitionId })
      .populate("category", "name nameAr code")
      .populate("boatClass", "name nameAr code")
      .populate(
        "entries.athlete",
        "firstName lastName firstNameAr lastNameAr nationalityCode nationality",
      )
      .populate("entries.club", "name nameAr code")
      .lean();

    // Annotate each entry with the phase (Heat 1, Final A, ...) of the race
    // it comes from, so the UI can separate heats from finals, and with the
    // FULL crew names resolved from that race's lanes (published entries
    // only keep a single athlete reference, even for doubles/fours).
    const sourceRaceIds = [
      ...new Set(
        results.flatMap((group) =>
          (group.entries || [])
            .map((entry) => entry.sourceRace && String(entry.sourceRace))
            .filter(Boolean),
        ),
      ),
    ];

    const sourceRaces = sourceRaceIds.length
      ? await CompetitionRace.find({ _id: { $in: sourceRaceIds } })
          .select("phase name lanes.athlete lanes.crew")
          .populate("lanes.athlete", "firstName lastName")
          .populate("lanes.crew", "firstName lastName")
          .lean()
      : [];

    // raceId → (athleteId → joined crew label of the lane containing him)
    const crewByRaceAndAthlete = new Map();
    const racePhaseById = new Map();
    for (const race of sourceRaces) {
      racePhaseById.set(String(race._id), race.phase || "");
      const byAthlete = new Map();
      for (const lane of race.lanes || []) {
        const members = [];
        if (lane.athlete) members.push(lane.athlete);
        if (Array.isArray(lane.crew)) members.push(...lane.crew);
        const label = members
          .map(
            (member) =>
              `${member.firstName || ""} ${member.lastName || ""}`.trim(),
          )
          .filter(Boolean)
          .join(", ");
        for (const member of members) {
          if (member?._id) byAthlete.set(String(member._id), label);
        }
      }
      crewByRaceAndAthlete.set(String(race._id), byAthlete);
    }

    results.forEach((group) => {
      (group.entries || []).forEach((entry) => {
        entry.phase = entry.sourceRace
          ? racePhaseById.get(String(entry.sourceRace)) || ""
          : "";
        const crewMap = entry.sourceRace
          ? crewByRaceAndAthlete.get(String(entry.sourceRace))
          : null;
        const athleteId =
          entry.athlete && entry.athlete._id
            ? String(entry.athlete._id)
            : null;
        entry.crewNames =
          crewMap && athleteId ? crewMap.get(athleteId) || "" : "";
      });
    });

    res.json(results);
  } catch (error) {
    console.error("Error in getPublicCompetitionResults:", error);
    res.status(500).json({ message: "Server error retrieving results" });
  }
};

/**
 * @desc    Get race schedule / programme for a competition
 * @route   GET /api/public/competitions/:competitionId/programme
 * @access  Public
 */
export const getPublicCompetitionProgramme = async (req, res) => {
  try {
    const { competitionId } = req.params;

    const competition = await Competition.findById(competitionId).lean();
    if (!competition) {
      return res.status(404).json({ message: "Competition not found" });
    }

    if (
      competition.status !== "published" &&
      competition.status !== "completed"
    ) {
      return res
        .status(403)
        .json({ message: "Programme not available for public access" });
    }

    // Find all races for this competition and populate athletes, crew & clubs
    const races = await CompetitionRace.find({ competition: competitionId })
      .populate("category", "abbreviation titles code gender")
      .populate("boatClass", "name nameAr code")
      .populate(
        "lanes.athlete",
        "firstName lastName firstNameAr lastNameAr nationalityCode nationality",
      )
      .populate(
        "lanes.crew",
        "firstName lastName firstNameAr lastNameAr nationalityCode nationality",
      )
      .populate("lanes.club", "name nameAr code")
      .sort({ startTime: 1, order: 1 })
      .lean();

    // Clean up athlete details to protect personal data
    const publicRaces = races.map((race) => {
      const publicLanes = (race.lanes || []).map((lane) => {
        // Resolve athlete name from populated ref
        let athName = "";
        if (lane.athlete) {
          athName =
            `${lane.athlete.firstName || ""} ${lane.athlete.lastName || ""}`.trim();
        }

        // For crew boats, build name from crew members
        if (!athName && Array.isArray(lane.crew) && lane.crew.length > 0) {
          athName = lane.crew
            .map((m) => `${m.firstName || ""} ${m.lastName || ""}`.trim())
            .filter(Boolean)
            .join(", ");
        }

        let athNameAr = "";
        if (lane.athlete) {
          athNameAr =
            `${lane.athlete.firstNameAr || ""} ${lane.athlete.lastNameAr || ""}`.trim();
        }

        if (!athNameAr && Array.isArray(lane.crew) && lane.crew.length > 0) {
          athNameAr = lane.crew
            .map((m) => `${m.firstNameAr || ""} ${m.lastNameAr || ""}`.trim())
            .filter(Boolean)
            .join(", ");
        }

        let cName = lane.clubName || (lane.club && lane.club.name) || "";
        let cCode = (lane.club && lane.club.code) || "";

        // Nation of the lane: stored value → single athlete's nationality →
        // the crew's shared nationality (doubles/fours have no single
        // athlete ref). Only used when every crew member shares one nation.
        let representing = String(lane.representingNation || "").trim();
        if (!representing && lane.athlete) {
          representing = String(
            lane.athlete.nationalityCode || lane.athlete.nationality || "",
          ).trim();
        }
        if (!representing && Array.isArray(lane.crew) && lane.crew.length > 0) {
          const crewCodes = [
            ...new Set(
              lane.crew
                .map((member) =>
                  String(
                    member.nationalityCode || member.nationality || "",
                  ).trim(),
                )
                .filter(Boolean),
            ),
          ];
          if (crewCodes.length === 1) representing = crewCodes[0];
        }

        return {
          lane: lane.lane,
          clubName: cName,
          clubCode: cCode,
          athleteName: athName,
          athleteNameAr: athNameAr,
          representingNation: representing.toUpperCase(),
          seed: lane.seed,
          result: lane.result
            ? {
                status: lane.result.status,
                finishPosition: lane.result.finishPosition,
                elapsedMs: lane.result.elapsedMs,
              }
            : undefined,
        };
      });

      return {
        _id: race._id,
        competition: race.competition,
        category: race.category,
        boatClass: race.boatClass,
        eventGroupId: race.eventGroupId,
        journeyIndex: race.journeyIndex,
        sessionLabel: race.sessionLabel,
        name: race.name,
        phase: race.phase || "",
        order: race.order,
        startTime: race.startTime,
        distanceOverride: race.distanceOverride,
        status: race.status,
        lanes: publicLanes,
        notes: race.notes,
      };
    });

    res.json(publicRaces);
  } catch (error) {
    console.error("Error in getPublicCompetitionProgramme:", error);
    res.status(500).json({ message: "Server error retrieving programme" });
  }
};

/**
 * @desc    Get currently active live competition/races
 * @route   GET /api/public/live
 * @access  Public
 */
export const getPublicLive = async (req, res) => {
  try {
    const now = new Date();
    // A competition is active if it's published and today lies between start and end dates (with 1 day buffer)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const activeCompetitions = await Competition.find({
      status: "published",
      startDate: { $lte: oneDayAhead },
      endDate: { $gte: oneDayAgo },
    }).lean();

    if (activeCompetitions.length === 0) {
      return res.json([]);
    }

    const activeCompIds = activeCompetitions.map((c) => c._id);

    // Find any races in those active competitions that are in_progress or completed within the last 2 hours
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const liveRaces = await CompetitionRace.find({
      competition: { $in: activeCompIds },
      $or: [
        { status: "in_progress" },
        { status: "completed", updatedAt: { $gte: twoHoursAgo } },
      ],
    })
      .populate("category", "name nameAr code")
      .populate("boatClass", "name nameAr code")
      .sort({ updatedAt: -1 })
      .lean();

    const publicLiveRaces = liveRaces.map((race) => {
      const publicLanes = (race.lanes || []).map((lane) => {
        return {
          lane: lane.lane,
          clubName: lane.clubName || "",
          athleteName: lane.athleteName || "",
          athleteNameAr: lane.athleteNameAr || "",
          result: lane.result
            ? {
                status: lane.result.status,
                finishPosition: lane.result.finishPosition,
                elapsedMs: lane.result.elapsedMs,
              }
            : undefined,
        };
      });

      const comp = activeCompetitions.find(
        (c) => c._id.toString() === race.competition.toString(),
      );

      return {
        _id: race._id,
        competitionName: comp ? comp.names : null,
        category: race.category,
        boatClass: race.boatClass,
        name: race.name,
        status: race.status,
        startTime: race.startTime,
        lanes: publicLanes,
      };
    });

    res.json(publicLiveRaces);
  } catch (error) {
    console.error("Error in getPublicLive:", error);
    res.status(500).json({ message: "Server error retrieving live details" });
  }
};
