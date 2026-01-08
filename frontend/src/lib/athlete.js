import API_URL from "../config";

const API_BASE_URL = API_URL;

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
  
  // If absolute URL, return as-is
  if (storagePath.toLowerCase().startsWith("http")) {
      return storagePath;
  }

  const normalized = normaliseStoragePath(storagePath);
  
  // Remove all leading 'uploads/' segments (case-insensitive) to avoid duplication
  // e.g. "uploads/uploads/foo.jpg" -> "foo.jpg"
  // e.g. "Uploads/foo.jpg" -> "foo.jpg"
  const cleanPath = normalized.replace(/^(uploads\/)+/i, "");
  
  // Ensure we don't double-append if API_BASE_URL ends with /uploads
  const cleanBaseUrl = API_BASE_URL.replace(/\/uploads\/?$/i, "");

  // Use a modified timestamp as cache-buster if available, otherwise use a fixed one
  const version = athlete.updatedAt 
    ? new Date(athlete.updatedAt).getTime() 
    : athlete.photo?.uploadedAt 
      ? new Date(athlete.photo.uploadedAt).getTime() 
      : "1";

  return `${cleanBaseUrl}/uploads/${cleanPath}?v=${version}`;
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
