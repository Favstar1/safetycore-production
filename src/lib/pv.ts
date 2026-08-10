// Domain constants and helpers for SafetyCore.
// Values mirror the SafetyCore prototype (safetycore-app.html) exactly.

export type AppRole = "FIELD_ASSOCIATE" | "PV_COORDINATOR" | "PV_MANAGER" | "ADMIN";

export const ROLE_LABEL: Record<AppRole, string> = {
  FIELD_ASSOCIATE: "Field Associate",
  PV_COORDINATOR: "PV Coordinator",
  PV_MANAGER: "PV Manager",
  ADMIN: "Admin",
};

export type CaseStatus = "Triage" | "Coding" | "Medical Review" | "QC" | "Submitted" | "Closed";

export const CASE_STATUSES: CaseStatus[] = [
  "Triage",
  "Coding",
  "Medical Review",
  "QC",
  "Submitted",
  "Closed",
];

export const STATUS_COLOR: Record<CaseStatus, string> = {
  Triage: "#c96b5f",
  Coding: "#c9975f",
  "Medical Review": "#1e7f76",
  QC: "#3f6b3a",
  Submitted: "#7fcfc4",
  Closed: "#5a6156",
};

export const REPORTER_TYPES = [
  "Physician",
  "Pharmacist",
  "Other Healthcare Professional",
  "Patient / Consumer",
  "Lawyer",
  "Unclear",
];

export const SERIOUSNESS_CRITERIA = [
  { key: "criteria_death", label: "Death" },
  { key: "criteria_life_threatening", label: "Life-threatening" },
  { key: "criteria_hospitalization", label: "Hospitalization / prolonged" },
  { key: "criteria_disability", label: "Disability / incapacity" },
  { key: "criteria_other", label: "Other medically important" },
] as const;

export const OUTCOMES = [
  "Recovered / resolved",
  "Recovering / resolving",
  "Not recovered",
  "Recovered with sequelae",
  "Fatal",
  "Unknown",
];

// MedDRA is a licensed dictionary. This is the prototype's working subset used
// as a coding picker until a licensed MedDRA browser is provisioned.
export const MEDDRA_TERMS = [
  "Nausea",
  "Vomiting",
  "Diarrhoea",
  "Headache",
  "Dizziness",
  "Rash",
  "Pruritus",
  "Angioedema",
  "Anaphylactic reaction",
  "Hepatic enzyme increased",
  "Thrombocytopenia",
  "Hypoglycaemia",
  "Fatigue",
  "Pyrexia",
  "Cough",
];

export const SOC_MAP: Record<string, string> = {
  Nausea: "Gastrointestinal disorders",
  Vomiting: "Gastrointestinal disorders",
  Diarrhoea: "Gastrointestinal disorders",
  Headache: "Nervous system disorders",
  Dizziness: "Nervous system disorders",
  Rash: "Skin and subcutaneous tissue disorders",
  Pruritus: "Skin and subcutaneous tissue disorders",
  Angioedema: "Skin and subcutaneous tissue disorders",
  "Anaphylactic reaction": "Immune system disorders",
  "Hepatic enzyme increased": "Investigations",
  Thrombocytopenia: "Blood and lymphatic system disorders",
  Hypoglycaemia: "Metabolism and nutrition disorders",
  Fatigue: "General disorders",
  Pyrexia: "General disorders",
  Cough: "Respiratory, thoracic and mediastinal disorders",
};

export const MIN_CRITERIA = [
  { key: "criteria_reporter", label: "Identifiable Reporter" },
  { key: "criteria_patient", label: "Identifiable Patient" },
  { key: "criteria_product", label: "Suspect Product" },
  { key: "criteria_event", label: "Adverse Event" },
] as const;

export const SIGNAL_THRESHOLD = 2;

export function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysLeft(due?: string | null) {
  if (!due) return null;
  const ms = new Date(due).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function dueLabel(due?: string | null, status?: string) {
  if (status === "Submitted" || status === "Closed") return "—";
  const d = daysLeft(due);
  if (d === null) return "—";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Due today";
  return `${d}d left`;
}

export function initialsOf(name?: string | null) {
  if (!name) return "??";
  return name
    .replace(/[^A-Za-z .]/g, "")
    .split(/[ .]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function download(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal E2B(R3)-shaped payload preview for submission attestation. */
export function buildE2BPreview(c: {
  case_number: string;
  received_date?: string | null;
  reporter_type?: string | null;
  patient_initials?: string | null;
  patient_age?: number | null;
  patient_sex?: string | null;
  product_name?: string | null;
  batch_number?: string | null;
  meddra_term?: string | null;
  meddra_soc?: string | null;
  seriousness?: string | null;
  outcome?: string | null;
  narrative?: string | null;
}) {
  return JSON.stringify(
    {
      messageType: "ichicsr",
      messageFormatVersion: "E2B(R3)",
      safetyReportId: c.case_number,
      receiveDate: c.received_date,
      primarySource: { qualification: c.reporter_type },
      patient: {
        initials: c.patient_initials,
        age: c.patient_age,
        sex: c.patient_sex,
        reaction: {
          meddraPreferredTerm: c.meddra_term,
          systemOrganClass: c.meddra_soc,
          seriousness: c.seriousness,
          outcome: c.outcome,
        },
        drug: {
          characterisation: "Suspect",
          medicinalProduct: c.product_name,
          batchNumber: c.batch_number,
        },
        narrative: c.narrative,
      },
    },
    null,
    2,
  );
}
