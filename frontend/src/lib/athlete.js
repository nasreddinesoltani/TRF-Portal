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
  if (storagePath.startsWith("http")) {
      return storagePath;
  }

  const normalized = normaliseStoragePath(storagePath);
  
  // Avoid duplicating 'uploads/' if strictly using relative path
  // If backend serves '/uploads', and path is 'uploads/foo.jpg', 
  // joining them blindly might create '/uploads/uploads/foo.jpg' IF the base url includes it?
  // But BASE_URL is just host. 
  // Backend serves static at '/uploads'.
  // So we want `${BASE_URL}/uploads/foo.jpg` IF file is at `root/uploads/foo.jpg`.
  // My script stored `uploads/photos_organized/...` in storagePath.
  // So `normalized` starts with `uploads/`.
  // So we need `${BASE_URL}/${normalized}`.
  
  if (normalized.startsWith("uploads/")) {
       return `${API_BASE_URL}/${normalized}`;
  }

  return `${API_BASE_URL}/uploads/${normalized}`;
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
