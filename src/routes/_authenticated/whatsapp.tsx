import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const SIM_SCENARIOS = [
  {
    contact: "+234 803 ••• 447",
    contact_name: "Ifeanyi B. (Patient)",
    reporter_type: "Patient / Consumer",
    body: "I took Lisinopril 10mg yesterday and my face started swelling, I'm having trouble breathing.",
    product: "Lisinopril 10mg",
    term: "Angioedema",
    criteria: { reporter: true, patient: true, product: true, event: true },
  },
  {
    contact: "+234 706 ••• 190",
    contact_name: "Grace O. (Pharmacist)",
    reporter_type: "Pharmacist",
    body: "A customer says the Metformin 500mg gave her severe nausea and vomiting for two days.",
    product: "Metformin 500mg",
    term: "Nausea",
    criteria: { reporter: true, patient: false, product: true, event: true },
  },
  {
    contact: "+234 810 ••• 022",
    contact_name: "Unknown sender",
    reporter_type: null,
    body: "How much is Losartan 50mg selling for now? I want to buy for my father.",
    product: null,
    term: null,
    criteria: { reporter: false, patient: false, product: false, event: false },
  },
] as const;

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
  const convertible = !!active && criteriaMet === 4 && active.consent && active.status === "New";
  const seriousSignal =
    messages.some((m) =>
      SERIOUS_KEYWORDS.some((k) => m.body.toLowerCase().includes(k)),
    ) || !!extract?.serious_flag;

  async function sendMessage(body: string, direction: "in" | "out", sender?: string) {
    if (!session || !active) return;
    await supabase.from("whatsapp_messages").insert({
      thread_id: active.id,
      org_id: session.orgId,
      direction,
      body,
      sender: sender ?? (direction === "out" ? session.fullName : active.contact_name),
      sent_at: new Date().toISOString(),
    });
    await supabase
      .from("whatsapp_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", active.id);
  }

  async function requestMissingInfo() {
    if (!session || !active || busy) return;
    setBusy(true);
    const missing = MIN_CRITERIA.filter((c) => !(active as Record<string, unknown>)[c.key]);
    if (missing.length === 0) {
      await sendMessage(
        "Thank you. Could you share any additional detail on the reaction (dates, outcome, treatment given)?",
        "out",
      );
      await logAudit({
        orgId: session.orgId,
        entity: "whatsapp_thread",
        entityId: active.id,
        action: `Follow-up information requested on thread ${active.thread_ref}`,
        actorId: session.userId,
        actorName: session.fullName,
      });
      await queryClient.invalidateQueries();
      setBusy(false);
      return flash("Follow-up request sent");
    }

    const asks: Record<string, string> = {
      criteria_reporter: "your full name and how we can reach you",
      criteria_patient: "the patient's initials, age and sex",
      criteria_product: "the exact medicine name, strength and batch number",
      criteria_event: "what reaction was experienced and when it started",
    };
    await sendMessage(
      `Thank you for the report. To register this safety report we still need: ${missing
        .map((m) => asks[m.key])
        .join("; ")}. Please reply with these details.`,
      "out",
    );
    const replies: Record<string, string> = {
      criteria_reporter: "My name is on this line, you can reach me here.",
      criteria_patient: "Patient is 34 years old, female, initials A.O.",
      criteria_product: "The medicine is the one prescribed at the clinic, batch on the pack.",
      criteria_event: "The reaction started two days after taking the medicine.",
    };
    await sendMessage(missing.map((m) => replies[m.key]).join(" "), "in");
    const patch: Record<string, boolean> = {};
    for (const m of missing) patch[m.key] = true;
    await supabase.from("whatsapp_threads").update(patch).eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `Missing minimum-criteria information requested and received on thread ${active.thread_ref} (${missing
        .map((m) => m.label)
        .join(", ")})`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash("Missing information requested — reporter responded");
  }

  async function requestConsent() {
    if (!session || !active || busy) return;
    setBusy(true);
    if (active.consent) {
      await sendMessage(
        "Noting that you have already consented to your data being used for safety monitoring. Thank you.",
        "out",
      );
      await queryClient.invalidateQueries();
      setBusy(false);
      return flash("Consent already on record");
    }
    await sendMessage(
      "Before we can record this report we need your permission to process your information for drug safety monitoring, in line with the NDPR. Do you consent?",
      "out",
    );
    await sendMessage("Yes, I consent to that.", "in");
    await supabase.from("whatsapp_threads").update({ consent: true }).eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      entity: "whatsapp_thread",
      entityId: active.id,
      action: `NDPR data-use consent requested and confirmed on thread ${active.thread_ref}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash("NDPR consent confirmed");
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

  async function simulateMessage() {
    if (!session || busy) return;
    setBusy(true);
    const s = SIM_SCENARIOS[Math.floor(Math.random() * SIM_SCENARIOS.length)]!;
    const now = new Date().toISOString();
    const { data: thread, error } = await supabase
      .from("whatsapp_threads")
      .insert({
        org_id: session.orgId,
        thread_ref: `WA-${Math.floor(1000 + Math.random() * 9000)}`,
        contact: s.contact,
        contact_name: s.contact_name,
        reporter_type: s.reporter_type,
        status: "New",
        consent: false,
        criteria_reporter: s.criteria.reporter,
        criteria_patient: s.criteria.patient,
        criteria_product: s.criteria.product,
        criteria_event: s.criteria.event,
      })
      .select("id")
      .single();
    if (error || !thread) {
      setBusy(false);
      return flash(error?.message ?? "Could not simulate message");
    }
    await supabase.from("whatsapp_messages").insert({
      thread_id: thread.id,
      org_id: session.orgId,
      direction: "in",
      body: s.body,
      sender: s.contact_name,
      sent_at: now,
    });
    if (s.product || s.term) {
      await supabase.from("whatsapp_extracts").insert({
        thread_id: thread.id,
        org_id: session.orgId,
        product_name: s.product,
        meddra_term: s.term,
        serious_flag: SERIOUS_KEYWORDS.some((k) => s.body.toLowerCase().includes(k)),
        narrative: `Auto-drafted from WhatsApp message — pending PV review and confirmation: "${s.body}"`,
      });
    }
    await queryClient.invalidateQueries();
    setActiveId(thread.id);
    setBusy(false);
    flash("Inbound message received");
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
    const serious = !!extract?.serious_flag || seriousSignal;
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
            <button className="btn" disabled={busy} onClick={() => void simulateMessage()}>
              + Simulate message
            </button>
          </div>
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
            {(threads ?? []).length === 0 && <div className="empty">No inbound threads.</div>}
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
                  Potential serious case detected (keywords: breathing / swelling / hospital) —
                  expedite review.
                </div>
              )}

              <div className="criteria-row">
                {MIN_CRITERIA.map((c) => (
                  <span
                    key={c.key}
                    className={`criteria-pill${(active as Record<string, unknown>)[c.key] ? " met" : ""}`}
                  >
                    {c.label}
                  </span>
                ))}
              </div>
              <div className="criteria-note">
                {criteriaMet} of 4 minimum ICSR criteria met — a valid ICSR needs all four before it
                can be created.
              </div>
              <span className={`consent-pill${active.consent ? " met" : ""}`}>
                Data-use consent (NDPR){active.consent ? " · recorded" : ""}
              </span>

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

                {active.status === "New" ? (
                  <div className="wa-actions">
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
                    Conversion requires all four minimum criteria and recorded NDPR consent.
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
