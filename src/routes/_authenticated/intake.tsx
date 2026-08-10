import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { logAudit, notify } from "@/lib/audit";
import {
  MEDDRA_TERMS,
  MIN_CRITERIA,
  OUTCOMES,
  REPORTER_TYPES,
  SERIOUSNESS_CRITERIA,
  SOC_MAP,
} from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/intake")({
  head: () => ({
    meta: [
      { title: "New ICSR — SafetyCore" },
      {
        name: "description",
        content:
          "Capture a new individual case safety report with the four minimum ICSR criteria, seriousness assessment and narrative.",
      },
      { property: "og:title", content: "New ICSR — SafetyCore" },
      { property: "og:description", content: "Structured adverse event intake with validity checks." },
    ],
  }),
  component: IntakePage,
});

const EMPTY = {
  reporter_type: "",
  reporter_name: "",
  reporter_contact: "",
  patient_initials: "",
  patient_age: "",
  patient_sex: "",
  product_name: "",
  batch_number: "",
  event_description: "",
  onset_date: "",
  meddra_term: "",
  outcome: "",
  narrative: "",
};

function IntakePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [form, setForm] = useState({ ...EMPTY });
  const [criteria, setCriteria] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      (await supabase.from("products").select("id, name").eq("active", true).order("name")).data ??
      [],
  });

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const met = {
    criteria_reporter: !!form.reporter_type && form.reporter_type !== "Unclear",
    criteria_patient: !!form.patient_initials || !!form.patient_age,
    criteria_product: !!form.product_name,
    criteria_event: !!form.event_description,
  };
  const validCase = Object.values(met).every(Boolean);
  const serious = SERIOUSNESS_CRITERIA.some((s) => criteria[s.key]);

  async function save() {
    if (!session) return;
    setBusy(true);
    const { data: numberData, error: numberError } = await supabase.rpc("next_case_number");
    if (numberError) {
      setBusy(false);
      setToast(numberError.message);
      return;
    }
    const received = new Date();
    const due = new Date(received);
    due.setDate(due.getDate() + (serious ? 15 : 90));

    const { data, error } = await supabase
      .from("cases")
      .insert({
        org_id: session.orgId,
        case_number: numberData as string,
        status: "Triage",
        channel: "Direct Entry",
        reporter_type: form.reporter_type || null,
        reporter_name: form.reporter_name || null,
        reporter_contact: form.reporter_contact || null,
        patient_initials: form.patient_initials || null,
        patient_age: form.patient_age ? Number(form.patient_age) : null,
        patient_sex: form.patient_sex || null,
        product_id: (products ?? []).find((p) => p.name === form.product_name)?.id ?? null,
        product_name: form.product_name,
        batch_number: form.batch_number || null,
        event_description: form.event_description || null,
        onset_date: form.onset_date || null,
        meddra_term: form.meddra_term || null,
        meddra_soc: form.meddra_term ? (SOC_MAP[form.meddra_term] ?? null) : null,
        outcome: form.outcome || null,
        narrative: form.narrative || null,
        seriousness: serious ? "Serious" : "Non-serious",
        criteria_death: !!criteria["criteria_death"],
        criteria_life_threatening: !!criteria["criteria_life_threatening"],
        criteria_hospitalization: !!criteria["criteria_hospitalization"],
        criteria_disability: !!criteria["criteria_disability"],
        criteria_other: !!criteria["criteria_other"],
        created_by: session.userId,
        assigned_to: session.userId,
        received_date: received.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
      })
      .select("id, case_number")
      .single();

    setBusy(false);
    if (error || !data) {
      setToast(error?.message ?? "Could not save case");
      return;
    }

    await logAudit({
      orgId: session.orgId,
      caseId: data.id,
      action: `Case created via direct entry (${serious ? "Serious" : "Non-serious"})`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    if (serious) {
      await notify({
        orgId: session.orgId,
        userId: session.userId,
        type: "Expedited case",
        message: `${data.case_number} is serious — 15-day clock started`,
        entity: "case",
        entityId: data.id,
      });
    }
    queryClient.invalidateQueries();
    navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
  }

  return (
    <AppShell
      title="New ICSR"
      subtitle="Individual Case Safety Report — direct entry"
      actions={
        <button className="btn" onClick={() => navigate({ to: "/cases" })}>
          Cancel
        </button>
      }
    >
      <div className="panel">
        <h3>
          Minimum criteria<small>ICH E2D VALIDITY</small>
        </h3>
        <div className="criteria-row">
          {MIN_CRITERIA.map((c) => (
            <span key={c.key} className={`criteria-pill${met[c.key] ? " met" : ""}`}>
              {c.label}
            </span>
          ))}
        </div>
        <div className="criteria-note">
          All four criteria must be met for a valid ICSR. Incomplete reports can still be saved as
          triage records once a reporter and product are identified.
        </div>
      </div>

      <div className="panel">
        <h3>
          Reporter<small>PRIMARY SOURCE</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Reporter type</label>
            <select
              value={form.reporter_type}
              onChange={(e) => set("reporter_type", e.target.value)}
            >
              <option value="">Select…</option>
              {REPORTER_TYPES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Reporter name</label>
            <input value={form.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} />
          </div>
          <div className="field">
            <label>Reporter contact</label>
            <input
              value={form.reporter_contact}
              onChange={(e) => set("reporter_contact", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>
          Patient<small>DE-IDENTIFIED · NDPR</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Patient initials</label>
            <input
              maxLength={4}
              value={form.patient_initials}
              onChange={(e) => set("patient_initials", e.target.value.toUpperCase())}
            />
          </div>
          <div className="field">
            <label>Age (years)</label>
            <input
              type="number"
              min={0}
              max={120}
              value={form.patient_age}
              onChange={(e) => set("patient_age", e.target.value)}
            />
          </div>
          <div className="field">
            <label>Sex</label>
            <select value={form.patient_sex} onChange={(e) => set("patient_sex", e.target.value)}>
              <option value="">Select…</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="U">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>
          Suspect product &amp; event<small>E2B(R3) CORE</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Suspect product</label>
            <select value={form.product_name} onChange={(e) => set("product_name", e.target.value)}>
              <option value="">Select…</option>
              {(products ?? []).map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Batch number</label>
            <input value={form.batch_number} onChange={(e) => set("batch_number", e.target.value)} />
          </div>
          <div className="field">
            <label>Event onset date</label>
            <input
              type="date"
              value={form.onset_date}
              onChange={(e) => set("onset_date", e.target.value)}
            />
          </div>
          <div className="field">
            <label>MedDRA preferred term (optional at intake)</label>
            <select value={form.meddra_term} onChange={(e) => set("meddra_term", e.target.value)}>
              <option value="">Code later…</option>
              {MEDDRA_TERMS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field span2">
            <label>Adverse event as reported</label>
            <input
              value={form.event_description}
              onChange={(e) => set("event_description", e.target.value)}
            />
          </div>
          <div className="field span2">
            <label>Narrative</label>
            <textarea value={form.narrative} onChange={(e) => set("narrative", e.target.value)} />
          </div>
          <div className="field">
            <label>Outcome</label>
            <select value={form.outcome} onChange={(e) => set("outcome", e.target.value)}>
              <option value="">Select…</option>
              {OUTCOMES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>
          Seriousness assessment<small>{serious ? "SERIOUS · 15-DAY CLOCK" : "NON-SERIOUS · 90-DAY"}</small>
        </h3>
        <div className="checkrow">
          {SERIOUSNESS_CRITERIA.map((s) => (
            <label key={s.key}>
              <input
                type="checkbox"
                checked={!!criteria[s.key]}
                onChange={(e) => setCriteria((c) => ({ ...c, [s.key]: e.target.checked }))}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="btn primary"
          disabled={busy || !form.product_name || !form.reporter_type}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : validCase ? "Create valid ICSR" : "Save as triage record"}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
