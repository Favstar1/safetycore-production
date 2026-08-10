import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getWhatsAppConfig, sendWhatsAppMessage } from "@/lib/whatsapp.functions";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { logAudit } from "@/lib/audit";
import { MIN_CRITERIA, SOC_MAP } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp Intake — SafetyCore" },
      {
        name: "description",
        content:
          "Triage inbound WhatsApp adverse event reports, capture NDPR consent and convert qualifying threads into ICSR cases.",
      },
      { property: "og:title", content: "WhatsApp Intake — SafetyCore" },
      {
        property: "og:description",
        content: "Progressive ICSR capture from spontaneous WhatsApp reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhatsAppPage,
});

const SERIOUS_KEYWORDS = ["breathing", "swelling", "hospital", "death", "unconscious", "bleeding"];

type Simulation = {
  name: string;
  reporterType: string;
  product: string;
  term: string;
  serious: boolean;
  messages: string[];
};

const SIMULATIONS: Simulation[] = [
  {
    name: "Kemi T.",
    reporterType: "Healthcare Professional",
    product: "Astymin Forte",
    term: "Angioedema",
    serious: true,
    messages: [
      "Good afternoon, I am a nurse at a clinic in Ikeja.",
      "A patient took Astymin Forte yesterday and now has swelling of the face and difficulty breathing.",
      "We referred her to the hospital this morning.",
    ],
  },
  {
    name: "Uche N.",
    reporterType: "Patient / Consumer",
    product: "Fidson Paracetamol 500mg",
    term: "Rash",
    serious: false,
    messages: [
      "Hello, I bought paracetamol from a pharmacy last week.",
      "After two tablets I developed an itchy rash on my arms.",
      "It has not gone away, should I stop taking it?",
    ],
  },
  {
    name: "Dr. Bello A.",
    reporterType: "Healthcare Professional",
    product: "Gastromet",
    term: "Nausea",
    serious: false,
    messages: [
      "Reporting on behalf of a 42 year old male patient, initials B.A.",
      "He started Gastromet three days ago and complains of persistent nausea and dizziness.",
      "No hospitalisation, symptoms ongoing.",
    ],
  },
];

function relTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 86_400_000) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 172_800_000) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function WhatsAppPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sendWa = useServerFn(sendWhatsAppMessage);
  const waConfig = useServerFn(getWhatsAppConfig);
  const { data: config } = useQuery({
    queryKey: ["wa-config"],
    queryFn: () => waConfig({}),
  });

  const { data: threads } = useQuery({
    queryKey: ["wa-threads"],
    queryFn: async () =>
      (
        await supabase
          .from("whatsapp_threads")
          .select("*")
          .order("updated_at", { ascending: false })
      ).data ?? [],
  });

  const { data: allMessages } = useQuery({
    queryKey: ["wa-messages-all"],
    queryFn: async () =>
      (
        await supabase
          .from("whatsapp_messages")
          .select("*")
          .order("sent_at", { ascending: true })
      ).data ?? [],
  });

  const active = (threads ?? []).find((t) => t.id === activeId) ?? (threads ?? [])[0] ?? null;
  const messages = (allMessages ?? []).filter((m) => m.thread_id === active?.id);

  const { data: extract } = useQuery({
    queryKey: ["wa-extract", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (
        await supabase
          .from("whatsapp_extracts")
          .select("*")
          .eq("thread_id", active!.id)
          .maybeSingle()
      ).data,
  });

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  const criteriaMet = active
    ? MIN_CRITERIA.filter((c) => (active as Record<string, unknown>)[c.key]).length
    : 0;
  const convertible =
    !!active &&
    criteriaMet === 4 &&
    active.consent &&
    !!active.criteria_confirmed_at &&
    active.status === "New";
  const seriousSignal =
    messages.some((m) =>
      SERIOUS_KEYWORDS.some((k) => m.body.toLowerCase().includes(k)),
    ) || !!extract?.serious_flag;

  async function sendOutbound(body: string) {
    if (!active) return null;
    const res = await sendWa({ data: { threadId: active.id, body } });
    return res;
  }

  function deliveryNote(res: { deliveryStatus: string } | null, fallback: string) {
    if (!res) return fallback;
    if (res.deliveryStatus === "sent") return `${fallback} — delivered via WhatsApp`;
    if (res.deliveryStatus === "failed") return `${fallback} — WhatsApp delivery failed, see thread`;
    return `${fallback} — queued (WhatsApp Business Platform not configured)`;
  }

  async function requestMissingInfo() {
    if (!session || !active || busy) return;
    setBusy(true);
    const missing = MIN_CRITERIA.filter((c) => !(active as Record<string, unknown>)[c.key]);
    const asks: Record<string, string> = {
      criteria_reporter: "your full name and how we can reach you",
      criteria_patient: "the patient's initials, age and sex",
      criteria_product: "the exact medicine name, strength and batch number",
      criteria_event: "what reaction was experienced and when it started",
    };
    const body =
      missing.length === 0
        ? "Thank you. Could you share any additional detail on the reaction (dates, outcome, treatment given)?"
        : `Thank you for the report. To register this safety report we still need: ${missing
            .map((m) => asks[m.key])
            .join("; ")}. Please reply with these details.`;
    try {
      const res = await sendOutbound(body);
      await logAudit({
        orgId: session.orgId,
        entity: "whatsapp_thread",
        entityId: active.id,
        action:
          missing.length === 0
            ? `Additional detail requested on thread ${active.thread_ref}`
            : `Missing minimum-criteria information requested on thread ${active.thread_ref} (${missing
                .map((m) => m.label)
                .join(", ")})`,
        actorId: session.userId,
        actorName: session.fullName,
      });
      await queryClient.invalidateQueries();
      flash(deliveryNote(res, "Information request recorded"));
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not send request");
    }
    setBusy(false);
  }

  async function requestConsent() {
    if (!session || !active || busy) return;
    setBusy(true);
    try {
      const res = await sendOutbound(
        active.consent
          ? "Noting that you have already consented to your data being used for safety monitoring. Thank you."
          : "Before we can record this report we need your permission to process your information for drug safety monitoring, in line with the NDPR. Do you consent?",
      );
      await logAudit({
        orgId: session.orgId,
        entity: "whatsapp_thread",
        entityId: active.id,
        action: `NDPR data-use consent requested on thread ${active.thread_ref}`,
        actorId: session.userId,
        actorName: session.fullName,
      });
      await queryClient.invalidateQueries();
      flash(deliveryNote(res, "Consent request recorded"));
    } catch (e) {
      flash(e instanceof Error ? e.message : "Could not send consent request");
    }
    setBusy(false);
  }

  /** Reviewer confirms a minimum-information criterion against the conversation. */
  async function toggleCriterion(
    key: "criteria_reporter" | "criteria_patient" | "criteria_product" | "criteria_event",
    label: string,
  ) {
    if (!session || !active || busy) return;
    setBusy(true);
    const next = !(active as Record<string, unknown>)[key];
    await supabase
      .from("whatsapp_threads")
      .update({
        criteria_reporter: key === "criteria_reporter" ? next : active.criteria_reporter,
        criteria_patient: key === "criteria_patient" ? next : active.criteria_patient,
        criteria_product: key === "criteria_product" ? next : active.criteria_product,
        criteria_event: key === "criteria_event" ? next : active.criteria_event,
        criteria_confirmed_at: null,
        criteria_confirmed_by: null,
      })
      .eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `PV reviewer marked "${label}" as ${next ? "present" : "not present"} on thread ${active.thread_ref}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
  }

  async function recordConsent() {
    if (!session || !active || busy) return;
    setBusy(true);
    const next = !active.consent;
    await supabase.from("whatsapp_threads").update({ consent: next }).eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `PV reviewer recorded NDPR consent as ${next ? "given" : "not given"} on thread ${active.thread_ref}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
  }

  async function confirmMinimumInformation() {
    if (!session || !active || busy || criteriaMet !== 4) return;
    setBusy(true);
    await supabase
      .from("whatsapp_threads")
      .update({ criteria_confirmed_at: new Date().toISOString(), criteria_confirmed_by: session.userId })
      .eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `PV reviewer confirmed all four minimum ICSR criteria on thread ${active.thread_ref}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash("Minimum information confirmed by reviewer");
  }

  async function decideSeriousness(decision: "Serious" | "Non-serious") {
    if (!session || !active || busy) return;
    setBusy(true);
    if (extract) {
      await supabase
        .from("whatsapp_extracts")
        .update({
          reviewer_seriousness: decision,
          reviewer_decided_at: new Date().toISOString(),
          reviewer_decided_by: session.userId,
        })
        .eq("id", extract.id);
    } else {
      await supabase.from("whatsapp_extracts").insert({
        thread_id: active.id,
        org_id: session.orgId,
        serious_flag: seriousSignal,
        serious_flag_reason: seriousSignal ? "Triage keyword detected in conversation" : null,
        reviewer_seriousness: decision,
        reviewer_decided_at: new Date().toISOString(),
        reviewer_decided_by: session.userId,
      });
    }
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `PV reviewer classified thread ${active.thread_ref} as ${decision}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash(`Classified as ${decision}`);
  }

  async function markNotReportable() {
    if (!session || !active || busy) return;
    setBusy(true);
    await supabase
      .from("whatsapp_threads")
      .update({ status: "Not Reportable" })
      .eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `Thread ${active.thread_ref} assessed by PV and marked Not Reportable`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash("Marked not reportable");
  }

  async function convert() {
    if (!session || !active || busy) return;
    setBusy(true);
    const { data: numberData, error: numberError } = await supabase.rpc("next_case_number");
    if (numberError) {
      setBusy(false);
      return flash(numberError.message);
    }

    const received = new Date();
    const serious = extract?.reviewer_seriousness === "Serious";
    const due = new Date(received);
    due.setDate(due.getDate() + (serious ? 15 : 90));

    const { data, error } = await supabase
      .from("cases")
      .insert({
        org_id: session.orgId,
        case_number: numberData as string,
        status: "Triage",
        channel: "WhatsApp",
        reporter_type: active.reporter_type ?? "Patient / Consumer",
        reporter_name: active.contact_name,
        reporter_contact: active.contact,
        patient_initials: null,
        product_name: extract?.product_name ?? "Unknown",
        meddra_term: extract?.meddra_term ?? null,
        meddra_soc: extract?.meddra_term ? (SOC_MAP[extract.meddra_term] ?? null) : null,
        narrative: extract?.narrative ?? messages.map((m) => m.body).join(" "),
        seriousness: serious ? "Serious" : "Non-serious",
        criteria_hospitalization: serious,
        created_by: session.userId,
        assigned_to: session.userId,
        received_date: received.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
      })
      .select("id, case_number")
      .single();

    if (error || !data) {
      setBusy(false);
      return flash(error?.message ?? "Could not convert thread");
    }

    await supabase
      .from("whatsapp_threads")
      .update({ status: "Converted", linked_case_id: data.id })
      .eq("id", active.id);
    if (extract) {
      await supabase
        .from("whatsapp_extracts")
        .update({ confirmed_by: session.userId })
        .eq("id", extract.id);
    }
    await logAudit({
      orgId: session.orgId,
      caseId: data.id,
      action: `Minimum-information ICSR ${data.case_number} created from WhatsApp thread ${active.thread_ref} with NDPR consent recorded`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
  }

  async function createSimulation() {
    if (!session || busy) return;
    setBusy(true);
    const sim = SIMULATIONS[Math.floor(Math.random() * SIMULATIONS.length)]!;
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const contact = `+23480${suffix}${suffix.slice(0, 3)}`;
    const { data: thread, error } = await supabase
      .from("whatsapp_threads")
      .insert({
        org_id: session.orgId,
        thread_ref: `WA-SIM-${suffix}`,
        contact,
        contact_name: `${sim.name} (simulated)`,
        reporter_type: sim.reporterType,
        status: "New",
        consent: false,
      })
      .select("id, thread_ref")
      .single();

    if (error || !thread) {
      setBusy(false);
      return flash(error?.message ?? "Could not create simulation");
    }

    const base = Date.now() - sim.messages.length * 60_000;
    await supabase.from("whatsapp_messages").insert(
      sim.messages.map((body, i) => ({
        thread_id: thread.id,
        org_id: session.orgId,
        direction: "in",
        body,
        sender: sim.name,
        sent_at: new Date(base + i * 60_000).toISOString(),
        delivery_status: "received",
      })),
    );

    await supabase.from("whatsapp_extracts").insert({
      thread_id: thread.id,
      org_id: session.orgId,
      product_name: sim.product,
      meddra_term: sim.term,
      serious_flag: sim.serious,
      serious_flag_reason: sim.serious ? "Triage keyword detected in simulated conversation" : null,
      narrative: sim.messages.join(" "),
    });

    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: thread.id,
      action: `Simulated WhatsApp intake thread ${thread.thread_ref} created for training/testing`,
      actorId: session.userId,
      actorName: session.fullName,
    });

    await queryClient.invalidateQueries();
    setActiveId(thread.id);
    setBusy(false);
    flash(`Simulation ${thread.thread_ref} created`);
  }

  return (
    <AppShell
      title="WhatsApp Intake"
      subtitle="Reports received via WhatsApp — review and convert into formal ICSR cases."
    >
      <div className="wa-banner">
        All WhatsApp reports require human PV review before entering the formal case record. Nothing
        here is auto-submitted or auto-coded — this is an intake channel that feeds the Case
        Workbench, not a bypass of it. Once the 4 minimum criteria are met, an <strong>initial</strong>{" "}
        ICSR can be created immediately; richer detail can be logged as <strong>follow-up</strong>{" "}
        reports later — this is the progressive ICSR model.
      </div>

      <div className="wa-layout">
        <div>
          <div className="wa-inbox-head">
            <h3>Inbox</h3>
            <span className={`wa-status ${config?.configured ? "converted" : "new"}`}>
              {config?.configured ? "WhatsApp connected" : "WhatsApp not configured"}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary wa-sim-btn"
            disabled={busy || !session}
            onClick={() => void createSimulation()}
          >
            + New simulation
          </button>
          <div className="wa-list">
            {(threads ?? []).map((t) => {
              const last = (allMessages ?? []).filter((m) => m.thread_id === t.id).slice(-1)[0];
              return (
                <button
                  key={t.id}
                  className={`wa-thread${active?.id === t.id ? " active" : ""}`}
                  onClick={() => setActiveId(t.id)}
                >
                  <div className="wa-thread-top">
                    <span className="wa-name">{t.contact_name ?? t.contact}</span>
                    <span className="wa-time">{relTime(last?.sent_at ?? t.created_at)}</span>
                  </div>
                  <div className="wa-snippet">
                    {last ? (last.body.length > 64 ? `${last.body.slice(0, 64)}...` : last.body) : t.contact}
                  </div>
                  <span className={`wa-status ${t.status.toLowerCase().replace(/\s+/g, "-")}`}>
                    {t.status}
                  </span>
                </button>
              );
            })}
            {(threads ?? []).length === 0 && (
              <div className="empty">
                {config?.configured
                  ? "No inbound threads yet."
                  : "No inbound threads. Connect the WhatsApp Business Platform (access token, phone number ID, webhook verify token and app secret) to start receiving reports."}
              </div>
            )}
          </div>
        </div>

        <div className="panel wa-thread-view">
          {!active ? (
            <div className="empty">Select a thread.</div>
          ) : (
            <>
              <h3 className="wa-title">{active.contact_name ?? active.contact}</h3>
              <div className="wa-meta">
                {active.contact} · {active.reporter_type ?? "Reporter type unknown"}
              </div>

              {seriousSignal && (
                <div className="wa-alert">
                  Potential serious case detected — triage signal only, expedite review. A qualified
                  PV reviewer must confirm the regulatory seriousness classification.
                </div>
              )}

              <div className="criteria-row">
                {MIN_CRITERIA.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    disabled={busy || active.status !== "New"}
                    title="Confirm against the conversation"
                    onClick={() => void toggleCriterion(c.key as "criteria_reporter", c.label)}
                    className={`criteria-pill${(active as Record<string, unknown>)[c.key] ? " met" : ""}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="criteria-note">
                {criteriaMet} of 4 minimum ICSR criteria met — a valid ICSR needs all four before it
                can be created.
              </div>
              <button
                type="button"
                disabled={busy || active.status !== "New"}
                onClick={() => void recordConsent()}
                className={`consent-pill${active.consent ? " met" : ""}`}
              >
                Data-use consent (NDPR){active.consent ? " · recorded" : " · not recorded"}
              </button>
              <div className="criteria-note">
                {active.criteria_confirmed_at
                  ? "Minimum information confirmed by a PV reviewer."
                  : "Reviewer confirmation is required before an ICSR can be created — extraction alone never creates a case."}
              </div>

              <div className="wa-chat">
                {messages.map((m) => (
                  <div key={m.id} className={`wa-bubble ${m.direction === "in" ? "in" : "out"}`}>
                    {m.body}
                    <div className="wa-bubble-time">{relTime(m.sent_at)}</div>
                  </div>
                ))}
                {messages.length === 0 && <div className="empty">No messages on this thread.</div>}
              </div>

              <div className="wa-extract">
                <div className="wa-extract-label">
                  Extracted for PV review — confirm before creating case
                </div>
                <div className="wa-extract-line">
                  Product: <strong>{extract?.product_name ?? "Not identified"}</strong>
                </div>
                <div className="wa-extract-line">
                  Suspected term: <strong>{extract?.meddra_term ?? "Not identified"}</strong>
                </div>
                <div className="wa-extract-line">
                  Draft narrative: {extract?.narrative ?? "No narrative extracted yet."}
                </div>

                <div className="wa-extract-line">
                  Reviewer seriousness decision:{" "}
                  <strong>{extract?.reviewer_seriousness ?? "Not yet decided"}</strong>
                </div>

                {active.status === "New" ? (
                  <div className="wa-actions">
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => void decideSeriousness("Serious")}
                    >
                      Classify serious
                    </button>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => void decideSeriousness("Non-serious")}
                    >
                      Classify non-serious
                    </button>
                    <button
                      className="btn"
                      disabled={busy || criteriaMet !== 4 || !!active.criteria_confirmed_at}
                      onClick={() => void confirmMinimumInformation()}
                    >
                      Confirm minimum information
                    </button>
                    <button className="btn" disabled={busy} onClick={() => void requestMissingInfo()}>
                      Request missing info
                    </button>
                    <button className="btn" disabled={busy} onClick={() => void requestConsent()}>
                      Request consent confirmation
                    </button>
                    <button
                      className="btn teal"
                      disabled={!convertible || busy}
                      onClick={() => void convert()}
                    >
                      Create minimum-information ICSR
                    </button>
                    <button className="btn" disabled={busy} onClick={() => void markNotReportable()}>
                      Not reportable
                    </button>
                  </div>
                ) : active.status === "Converted" && active.linked_case_id ? (
                  <div className="wa-actions">
                    <button
                      className="btn teal"
                      onClick={() =>
                        navigate({
                          to: "/cases/$caseId",
                          params: { caseId: active.linked_case_id! },
                        })
                      }
                    >
                      Open linked case
                    </button>
                  </div>
                ) : (
                  <div className="perm-note">
                    This thread was assessed as not reportable and is retained in the audit record.
                  </div>
                )}

                {active.status === "New" && !convertible && (
                  <div className="perm-note">
                    Conversion requires all four minimum criteria, recorded NDPR consent and
                    reviewer confirmation.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
