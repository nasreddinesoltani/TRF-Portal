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

const isMasterCategory = (category) => {
  const haystack = [
    category?.abbreviation,
    category?.titles?.en,
    category?.titles?.fr,
    category?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /master|masters|veteran|veterans/.test(haystack);
};

const formatRaceCodeForEventColumn = (raceCode, category) => {
  const normalized = String(raceCode || "").replace(/X/g, "x");
  if (!isMasterCategory(category)) {
    return normalized;
  }

  return normalized.replace(
    /([A-Z0-9-]+)(\d(?:[xX]|[+-])(?:[+-])?)(?=$|\s*\/)/g,
    "$1 $2",
  );
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

  // A start list can span several original races. When it does, a bare lane
  // number would repeat per race, so qualify it with the source race order
  // (mirrors the results exports, e.g. "3 (R2)").
  const visibleRaceOrders = new Set(
    visibleLanes.map(
      (lane) =>
        getLaneMeta(lane, referenceRace, originalRaceLookup, toDocumentId)
          .raceOrder,
    ),
  );
  const isCombinedStartList =
    visibleRaceOrders.size > 1 &&
    !visibleRaceOrders.has(Number.MAX_SAFE_INTEGER);

  const tableBody = visibleLanes.map((lane, rowIdx) => {
    const athlete = resolveAthlete(lane?.athlete, athleteLookup, toDocumentId);

    const clubCode =
      lane?.club?.code || lane?.club?.name?.slice(0, 3).toUpperCase() || "-";
    const hasCrewNumber =
      lane?.crewNumber !== undefined &&
      lane?.crewNumber !== null &&
      String(lane.crewNumber).trim() !== "";
    const isCrewLane = Array.isArray(lane?.crew) && lane.crew.length > 1;
    const clubLabel =
      isCrewLane && hasCrewNumber
        ? `${clubCode} ${String(lane.crewNumber).trim()}`
        : clubCode;

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

    const lEvent = formatRaceCodeForEventColumn(
      generateRaceCode(lCat, lBc),
      lCat,
    );

    // Use the real lane number so the printed sheet matches the chevron
    // assignment (3, 4, 2, 5, 1, 6 ...) instead of a 1..N row counter.
    const laneNumber = laneMeta.laneNumber;
    const hasRealLane = Number.isInteger(laneNumber) && laneNumber > 0;
    const displayLane = hasRealLane
      ? isCombinedStartList
        ? `${laneNumber} (R${laneMeta.raceOrder})`
        : String(laneNumber)
      : String(rowIdx + 1);

    return [displayLane, clubLabel, athleteName, license, dob, lEvent];
  });

  return { tableBody, lanes: visibleLanes };
};
