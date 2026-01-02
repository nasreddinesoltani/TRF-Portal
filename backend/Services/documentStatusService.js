import mongoose from "mongoose";

const DOCUMENT_TYPES = {
  photo: {
    key: "photo",
    label: "Athlete Photo",
    required: true,
  },
  birthCertificate: {
    key: "birthCertificate",
    label: "Birth Certificate",
    required: true,
  },
  cin: {
    key: "cin",
    label: "CIN",
    required: false,
  },
  passport: {
    key: "passport",
    label: "Passport",
    required: false,
  },
  parentalAuthorization: {
    key: "parentalAuthorization",
    label: "Parental Authorization",
    required: false, // Conditional based on age
  },
  medicalCertificate: {
    key: "medicalCertificate",
    label: "Medical Certificate",
    required: true,
    requiresExpiry: true,
  },
};

export const DOCUMENT_DEFINITIONS = DOCUMENT_TYPES;

const DOC_TYPE_ALIASES = {
  photo: "photo",
  "athlete-photo": "photo",
  "birth-certificate": "birthCertificate",
  birthcertificate: "birthCertificate",
  birth_certificate: "birthCertificate",
  cin: "cin",
  "national-id": "cin",
  nationalid: "cin",
  passport: "passport",
  "parental-authorization": "parentalAuthorization",
  parentalauthorization: "parentalAuthorization",
  "parent-authorization": "parentalAuthorization",
  "medical-certificate": "medicalCertificate",
  medicalcertificate: "medicalCertificate",
};

const APPROVED_STATUS = "approved";
const REJECTED_STATUS = "rejected";
const PENDING_STATUS = "pending";

const resolveDocumentState = (document, typeKey, currentDate = new Date()) => {
  if (!document) {
    return "missing";
  }

  const status = document.status || PENDING_STATUS;
  if (status === REJECTED_STATUS) {
    return REJECTED_STATUS;
  }

  if (status !== APPROVED_STATUS) {
    return PENDING_STATUS;
  }

  if (typeKey === "medicalCertificate" && document.expiresAt) {
    const expiresAtDate = new Date(document.expiresAt);
    if (!Number.isNaN(expiresAtDate.getTime()) && expiresAtDate < currentDate) {
      return "expired";
    }
  }

  return APPROVED_STATUS;
};

const calculateAge = (birthDate, referenceDate = new Date()) => {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const monthDiff = referenceDate.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age;
};

export const normalizeDocumentType = (rawType) => {
  if (!rawType) {
    return null;
  }
  const lowered = rawType.toString().trim().toLowerCase();
  return DOCUMENT_TYPES[lowered]?.key || DOC_TYPE_ALIASES[lowered] || null;
};

export const getDocumentDefinition = (docType) => {
  const normalized = normalizeDocumentType(docType);
  if (!normalized) {
    return null;
  }
  return DOCUMENT_TYPES[normalized] || null;
};

const toPlainObject = (value) => {
  if (!value) {
    return value;
  }

  if (typeof value.toObject === "function") {
    return value.toObject({ getters: true, virtuals: false });
  }

  if (value instanceof mongoose.Types.Subdocument) {
    return value.toObject({ getters: true, virtuals: false });
  }

  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    const clone = { ...value };
    if (clone.metadata instanceof Map) {
      clone.metadata = Object.fromEntries(clone.metadata.entries());
    }
    return clone;
  }

  return value;
};

export const serialiseDocument = (document) => {
  if (!document) {
    return null;
  }

  const plain = toPlainObject(document);
  if (!plain) {
    return null;
  }

  if (plain.metadata instanceof Map) {
    plain.metadata = Object.fromEntries(plain.metadata.entries());
  }

  if (
    plain.metadata &&
    typeof plain.metadata === "object" &&
    !(plain.metadata instanceof Array)
  ) {
    plain.metadata = { ...plain.metadata };
  }

  return plain;
};

export const serialiseDocuments = (documents = {}) => {
  const result = {};
  Object.keys(DOCUMENT_TYPES).forEach((key) => {
    if (documents && documents[key]) {
      result[key] = serialiseDocument(documents[key]);
    }
  });
  return result;
};

export const evaluateDocumentStatuses = (
  athlete,
  referenceDate = new Date()
) => {
  const documents = athlete?.documents || {};
  const birthDate = athlete?.birthDate;
  const age = calculateAge(birthDate, referenceDate);
  const requiresParentalAuthorization =
    typeof age === "number" ? age < 19 : false;

  const documentStates = {};
  Object.keys(DOCUMENT_TYPES).forEach((key) => {
    documentStates[key] = resolveDocumentState(
      documents[key],
      key,
      referenceDate
    );
  });

  const identityApproved =
    documentStates.cin === APPROVED_STATUS ||
    documentStates.passport === APPROVED_STATUS;

  const issues = [];
  let finalStatus = "active";

  if (documentStates.medicalCertificate === "expired") {
    finalStatus = "expired_medical";
    issues.push("medical_certificate_expired");
  }

  const checkPending = (state, key, issueCode) => {
    if (state === APPROVED_STATUS) {
      return;
    }
    if (finalStatus !== "expired_medical") {
      finalStatus = "pending_documents";
    }
    issues.push(issueCode ?? `${key}_not_approved`);
  };

  checkPending(documentStates.photo, "photo", "photo_not_approved");
  checkPending(
    documentStates.birthCertificate,
    "birthCertificate",
    "birth_certificate_not_approved"
  );
  checkPending(
    documentStates.medicalCertificate,
    "medicalCertificate",
    "medical_certificate_not_approved"
  );

  if (!identityApproved) {
    checkPending("missing", "identity", "identity_document_missing");
  }

  if (requiresParentalAuthorization) {
    if (documentStates.parentalAuthorization !== APPROVED_STATUS) {
      checkPending(
        documentStates.parentalAuthorization,
        "parentalAuthorization",
        "parental_authorization_required"
      );
    }
  }

  return {
    status: finalStatus,
    issues,
    documentStates,
    requiresParentalAuthorization,
    age,
  };
};

export const applyDocumentStatusToAthlete = (athlete) => {
  if (!athlete) {
    return null;
  }
  const evaluation = evaluateDocumentStatuses(athlete);
  athlete.status = evaluation.status;
  athlete.documentsStatus = evaluation.status;
  athlete.documentsIssues = evaluation.issues;
  athlete.documentsEvaluatedAt = new Date();
  return evaluation;
};

export const DOCUMENT_TYPE_KEYS = Object.keys(DOCUMENT_TYPES);
