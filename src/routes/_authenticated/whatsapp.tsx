import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { logAudit } from "@/lib/audit";
import { MIN_CRITERIA, SOC_MAP, fmtDateTime } from "@/lib/pv";

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
    ],
  }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: threads } = useQuery({
    queryKey: ["wa-threads"],
    queryFn: async () =>
      (
        await supabase
          .from("whatsapp_threads")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const active = (threads ?? []).find((t) => t.id === activeId) ?? (threads ?? [])[0] ?? null;

  const { data: messages } = useQuery({
    queryKey: ["wa-messages", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (
        await supabase
          .from("whatsapp_messages")
          .select("*")
          .eq("thread_id", active!.id)
          .order("sent_at", { ascending: true })
      ).data ?? [],
  });

  const { data: extract } = useQuery({
    queryKey: ["wa-extract", active?.id],
    enabled: !!active,
    queryFn: async () =>
      (
        await supabase.from("whatsapp_extracts").select("*").eq("thread_id", active!.id).maybeSingle()
      ).data,
  });

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  const criteriaMet = active
    ? MIN_CRITERIA.filter((c) => (active as Record<string, unknown>)[c.key]).length
    : 0;
  const convertible = active && criteriaMet === 4 && active.consent && active.status === "New";

  async function convert() {
    if (!session || !active || !extract) return;
    const { data: numberData, error: numberError } = await supabase.rpc("next_case_number");
    if (numberError) return flash(numberError.message);

    const received = new Date();
    const due = new Date(received);
    due.setDate(due.getDate() + (extract.serious_flag ? 15 : 90));

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
        product_name: extract.product_name ?? "Unknown",
        meddra_term: extract.meddra_term ?? null,
        meddra_soc: extract.meddra_term ? (SOC_MAP[extract.meddra_term] ?? null) : null,
        narrative: extract.narrative,
        seriousness: extract.serious_flag ? "Serious" : "Non-serious",
        criteria_hospitalization: !!extract.serious_flag,
        created_by: session.userId,
        assigned_to: session.userId,
        received_date: received.toISOString().slice(0, 10),
        due_date: due.toISOString().slice(0, 10),
      })
      .select("id, case_number")
      .single();

    if (error || !data) return flash(error?.message ?? "Could not convert thread");

    await supabase
      .from("whatsapp_threads")
      .update({ status: "Converted", linked_case_id: data.id })
      .eq("id", active.id);
    await logAudit({
      orgId: session.orgId,
      caseId: data.id,
      action: `Case created from WhatsApp thread ${active.thread_ref} with NDPR consent recorded`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    queryClient.invalidateQueries();
    navigate({ to: "/cases/$caseId", params: { caseId: data.id } });
  }

  return (
    <AppShell
      title="WhatsApp Intake"
      subtitle="Spontaneous reports received on the safety line"
    >
      <div className="wa-banner">
        Inbound messages are not ICSRs until the four minimum criteria are met and the reporter has
        given NDPR consent for their data to be processed. Threads that are not adverse event
        reports must be marked <strong>Not Reportable</strong> and remain in the audit record.
      </div>

      <div className="wa-layout">
        <div className="wa-list">
          {(threads ?? []).map((t) => (
            <button
              key={t.id}
              className={`wa-thread${active?.id === t.id ? " active" : ""}`}
              onClick={() => setActiveId(t.id)}
            >
              <div className="wa-thread-top">
                <span className="wa-name">{t.contact_name ?? t.contact}</span>
                <span className="wa-time">{t.status}</span>
              </div>
              <div className="wa-snippet">
                {t.thread_ref} · {t.contact}
              </div>
            </button>
          ))}
          {(threads ?? []).length === 0 && <div className="empty">No inbound threads.</div>}
        </div>

        <div className="panel wa-thread-view">
          {!active ? (
            <div className="empty">Select a thread.</div>
          ) : (
            <>
              <h3>
                {active.contact_name ?? active.contact}
                <small>{active.thread_ref}</small>
              </h3>

              {extract?.serious_flag && (
                <div className="wa-alert">
                  Potentially serious report — expedite triage. 15-day regulatory clock will start on
                  conversion.
                </div>
              )}

              <div className="wa-chat">
                {(messages ?? []).map((m) => (
                  <div key={m.id} className={`wa-bubble ${m.direction === "in" ? "in" : "out"}`}>
                    {m.body}
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                      {fmtDateTime(m.sent_at)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="wa-extract">
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
                <span className={`consent-pill${active.consent ? " met" : ""}`}>
                  {active.consent ? "NDPR consent recorded" : "NDPR consent outstanding"}
                </span>

                <div className="form-grid" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label>Extracted product</label>
                    <input value={extract?.product_name ?? "—"} readOnly />
                  </div>
                  <div className="field">
                    <label>Extracted event</label>
                    <input value={extract?.meddra_term ?? "—"} readOnly />
                  </div>
                  <div className="field span2">
                    <label>Draft narrative</label>
                    <textarea value={extract?.narrative ?? ""} readOnly />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {!active.consent && active.status === "New" && (
                    <button
                      className="btn"
                      onClick={async () => {
                        if (!session) return;
                        await supabase
                          .from("whatsapp_threads")
                          .update({ consent: true })
                          .eq("id", active.id);
                        await logAudit({
                          orgId: session.orgId,
                          entity: "whatsapp_thread",
                          entityId: active.id,
                          action: `NDPR consent recorded for thread ${active.thread_ref}`,
                          actorId: session.userId,
                          actorName: session.fullName,
                        });
                        queryClient.invalidateQueries();
                        flash("Consent recorded");
                      }}
                    >
                      Record NDPR consent
                    </button>
                  )}
                  <button className="btn primary" disabled={!convertible} onClick={() => void convert()}>
                    Convert to ICSR
                  </button>
                  {active.status === "New" && (
                    <button
                      className="btn"
                      onClick={async () => {
                        if (!session) return;
                        await supabase
                          .from("whatsapp_threads")
                          .update({ status: "Not Reportable" })
                          .eq("id", active.id);
                        await logAudit({
                          orgId: session.orgId,
                          entity: "whatsapp_thread",
                          entityId: active.id,
                          action: `Thread ${active.thread_ref} marked Not Reportable`,
                          actorId: session.userId,
                          actorName: session.fullName,
                        });
                        queryClient.invalidateQueries();
                        flash("Marked not reportable");
                      }}
                    >
                      Not reportable
                    </button>
                  )}
                </div>
                {!convertible && active.status === "New" && (
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
