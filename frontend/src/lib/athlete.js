const API_BASE_URL = import.meta.env?.VITE_API_URL || "http://localhost:5000";

const normaliseStoragePath = (pathValue) => {
  if (!pathValue) {
    return "";
  }
  return pathValue.toString().replace(/\\/g, "/").replace(/^\/+/, "");
};

const sanitizeName = (value) => (value || "").trim();

const buildInitials = (firstName, lastName) => {
  const firstInitial = sanitizeName(firstName).charAt(0);
  const lastInitial = sanitizeName(lastName).charAt(0);

  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`.toUpperCase();
  }
  if (firstInitial) {
    return firstInitial.toUpperCase();
  }
  if (lastInitial) {
    return lastInitial.toUpperCase();
  }
  return "--";
};

export const getAthletePhotoUrl = (athlete) => {
  if (!athlete) {
    return null;
  }

  const storagePath =
    athlete.photo?.storagePath ||
    athlete.documents?.photo?.storagePath ||
    athlete.documents?.photo?.url ||
    athlete.photoPath;

  if (!storagePath) {
    return null;
  }

  return `${API_BASE_URL}/uploads/${normaliseStoragePath(storagePath)}`;
};

export const getAthleteInitials = (athlete) => {
  if (!athlete) {
    return "--";
  }

  if (athlete.initials) {
    return sanitizeName(athlete.initials).slice(0, 2).toUpperCase() || "--";
  }

  const firstName =
    sanitizeName(athlete.firstName) ||
    sanitizeName(athlete.fullName)?.split(" ")[0];
  const lastName =
    sanitizeName(athlete.lastName) ||
    sanitizeName(athlete.fullName)?.split(" ").slice(-1)[0];

  if (!firstName && athlete.fullName) {
    const segments = athlete.fullName.split(/\s+/).filter(Boolean);
    if (segments.length >= 2) {
      return buildInitials(segments[0], segments[1]);
    }
    if (segments.length === 1) {
      return buildInitials(segments[0], "");
    }
  }

  return buildInitials(firstName, lastName);
};

export const getAthleteLicenseLabel = (athlete) => {
  if (!athlete) {
    return "License";
  }
  return athlete.licenseNumber ? `License ${athlete.licenseNumber}` : "License";
};
