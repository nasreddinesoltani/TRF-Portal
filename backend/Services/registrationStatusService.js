import Competition from "../Models/competitionModel.js";

const parseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const computeCompetitionRegistrationStatus = (
  competition,
  referenceDate = new Date(),
  journeyIndex = null,
) => {
  const requestedJourney = Number(journeyIndex);
  // If a specific journey is requested, use only that journey's dates
  if (
    Number.isFinite(requestedJourney) &&
    Array.isArray(competition?.stages) &&
    competition.stages.length > 0
  ) {
    const stage = competition.stages.find(
      (item, index) => (item.order ?? index + 1) === requestedJourney,
    );

    if (stage) {
      const openAt = parseDate(stage.registrationOpenDate);
      const closeAt = parseDate(stage.registrationCloseDate);

      if (openAt || closeAt) {
        if (openAt && referenceDate < openAt) {
          return "not_open";
        }

        if (closeAt && referenceDate > closeAt) {
          return "closed";
        }

        return "open";
      }
    }
  }

  // If no journey was specified and there are stages with registration windows,
  // return the MOST RESTRICTIVE status across all stages (closed > not_open > open)
  if (
    journeyIndex === null &&
    Array.isArray(competition?.stages) &&
    competition.stages.length > 0
  ) {
    const stageStatuses = competition.stages
      .map((stage) => {
        const openAt = parseDate(stage.registrationOpenDate);
        const closeAt = parseDate(stage.registrationCloseDate);

        if (!openAt && !closeAt) {
          return null; // This stage has no registration window
        }

        if (openAt && referenceDate < openAt) {
          return "not_open";
        }

        if (closeAt && referenceDate > closeAt) {
          return "closed";
        }

        return "open";
      })
      .filter((status) => status !== null);

    // If any stage has a defined registration window, use the most restrictive status
    if (stageStatuses.length > 0) {
      if (stageStatuses.includes("closed")) {
        return "closed";
      }
      if (stageStatuses.includes("not_open")) {
        return "not_open";
      }
      return "open";
    }
  }

  // Fall back to championship-level registration window
  const registrationWindow = competition?.registrationWindow || {};
  const openAt = parseDate(registrationWindow.openAt);
  const closeAt = parseDate(registrationWindow.closeAt);

  if (openAt || closeAt) {
    if (openAt && referenceDate < openAt) {
      return "not_open";
    }

    if (closeAt && referenceDate > closeAt) {
      return "closed";
    }

    return "open";
  }

  if (competition?.registrationStatus === "open") {
    return "open";
  }

  if (competition?.registrationStatus === "closed") {
    return "closed";
  }

  return "not_open";
};

export const syncCompetitionRegistrationStatus = (
  competition,
  referenceDate = new Date(),
) => {
  if (!competition) {
    return false;
  }

  const nextStatus = computeCompetitionRegistrationStatus(
    competition,
    referenceDate,
  );

  if (competition.registrationStatus !== nextStatus) {
    competition.registrationStatus = nextStatus;
    return true;
  }

  return false;
};

export const syncAllCompetitionRegistrationStatuses = async (
  referenceDate = new Date(),
) => {
  const competitions = await Competition.find({
    $or: [
      { "registrationWindow.openAt": { $exists: true, $ne: null } },
      { "registrationWindow.closeAt": { $exists: true, $ne: null } },
    ],
  });

  let updatedCount = 0;

  for (const competition of competitions) {
    if (syncCompetitionRegistrationStatus(competition, referenceDate)) {
      updatedCount += 1;
      await competition.save();
    }
  }

  return {
    scannedCount: competitions.length,
    updatedCount,
  };
};
