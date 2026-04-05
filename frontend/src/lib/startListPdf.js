const DEFAULT_NAME = "Unknown";

const resolveAthlete = (value, athleteLookup, toDocumentId) => {
  const id = toDocumentId(value);
  if (id && athleteLookup?.get(id)) {
    return athleteLookup.get(id);
  }
  if (value && typeof value === "object") {
    return value;
  }
  return null;
};

const formatCrewRole = (index, size) => {
  if (size <= 1) return "";
  if (index === 0) return "(b) ";
  if (index === size - 1) return "(s) ";
  return `(${index + 1}) `;
};

const getLaneMeta = (lane, referenceRace, originalRaceLookup, toDocumentId) => {
  const originalRace =
    originalRaceLookup?.get(String(lane?._originalRaceId)) || referenceRace;

  const laneCategoryId = toDocumentId(lane?.category);
  const laneBoatClassId = toDocumentId(lane?.boatClass);

  return {
    raceOrder: Number(originalRace?.order) || Number.MAX_SAFE_INTEGER,
    categoryId: laneCategoryId || toDocumentId(originalRace?.category) || "",
    boatClassId: laneBoatClassId || toDocumentId(originalRace?.boatClass) || "",
    laneNumber: Number(lane?.lane) || Number.MAX_SAFE_INTEGER,
    originalRace,
  };
};

export const sortStartListLanes = ({
  lanes,
  referenceRace,
  originalRaceLookup,
  toDocumentId,
}) => {
  return [...(lanes || [])].sort((a, b) => {
    const aMeta = getLaneMeta(
      a,
      referenceRace,
      originalRaceLookup,
      toDocumentId,
    );
    const bMeta = getLaneMeta(
      b,
      referenceRace,
      originalRaceLookup,
      toDocumentId,
    );

    if (aMeta.raceOrder !== bMeta.raceOrder) {
      return aMeta.raceOrder - bMeta.raceOrder;
    }
    if (aMeta.categoryId !== bMeta.categoryId) {
      return aMeta.categoryId.localeCompare(bMeta.categoryId);
    }
    if (aMeta.boatClassId !== bMeta.boatClassId) {
      return aMeta.boatClassId.localeCompare(bMeta.boatClassId);
    }
    return aMeta.laneNumber - bMeta.laneNumber;
  });
};

export const buildStartListTableBody = ({
  lanes,
  referenceRace,
  originalRaceLookup,
  athleteLookup,
  categories,
  boatClasses,
  toDocumentId,
  generateRaceCode,
  formatName,
  sortLanes = true,
  includeUnassigned = false,
}) => {
  const effectiveLanes = sortLanes
    ? sortStartListLanes({
        lanes,
        referenceRace,
        originalRaceLookup,
        toDocumentId,
      })
    : [...(lanes || [])];

  const visibleLanes = includeUnassigned
    ? effectiveLanes
    : effectiveLanes.filter(
        (lane) =>
          Boolean(lane?.athlete) ||
          (Array.isArray(lane?.crew) && lane.crew.length > 0),
      );

  const tableBody = visibleLanes.map((lane, rowIdx) => {
    const athlete = resolveAthlete(lane?.athlete, athleteLookup, toDocumentId);

    const clubCode =
      lane?.club?.code || lane?.club?.name?.slice(0, 3).toUpperCase() || "-";

    let athleteName = "Unassigned";
    let license = "";
    let dob = "";

    if (athlete) {
      athleteName = formatName(athlete) || DEFAULT_NAME;
      license = athlete?.licenseNumber || "";
      dob = athlete?.birthDate
        ? new Date(athlete.birthDate).toLocaleDateString("en-GB")
        : "";
    } else if (Array.isArray(lane?.crew) && lane.crew.length > 0) {
      athleteName = lane.crew
        .map((member, index, arr) => {
          const m = resolveAthlete(member, athleteLookup, toDocumentId);
          const name = m ? formatName(m) : DEFAULT_NAME;
          return `${formatCrewRole(index, arr.length)}${name}`;
        })
        .join("\n");

      license = lane.crew
        .map((member) => {
          const m = resolveAthlete(member, athleteLookup, toDocumentId);
          return m?.licenseNumber || "-";
        })
        .join("\n");

      dob = lane.crew
        .map((member) => {
          const m = resolveAthlete(member, athleteLookup, toDocumentId);
          return m?.birthDate
            ? new Date(m.birthDate).toLocaleDateString("en-GB")
            : "-";
        })
        .join("\n");
    }

    const laneMeta = getLaneMeta(
      lane,
      referenceRace,
      originalRaceLookup,
      toDocumentId,
    );
    const lCat = categories.find(
      (c) => toDocumentId(c) === laneMeta.categoryId,
    );
    const lBc = boatClasses.find(
      (b) => toDocumentId(b) === laneMeta.boatClassId,
    );

    const lEvent = generateRaceCode(lCat, lBc)
      .replace(/([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g, "$1 $2")
      .replace(/X/g, "x");

    return [rowIdx + 1, clubCode, athleteName, license, dob, lEvent];
  });

  return { tableBody, lanes: visibleLanes };
};
