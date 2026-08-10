import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { logQms } from "@/lib/audit";
import { fmtDateTime } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/qms")({
  head: () => ({
    meta: [
      { title: "QMS / SOP Log — SafetyCore" },
      {
        name: "description",
        content:
          "Quality management log recording SOP reviews, deviations, CAPA and system events across the pharmacovigilance system.",
      },
      { property: "og:title", content: "QMS / SOP Log — SafetyCore" },
      { property: "og:description", content: "Quality events and SOP governance record." },
    ],
  }),
  component: QmsPage,
});

const ENTRY_TYPES = ["Manual", "Deviation", "CAPA", "Training", "SOP Review"];

function QmsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [entryType, setEntryType] = useState("Manual");
  const [event, setEvent] = useState("");
  const [reference, setReference] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { data: entries } = useQuery({
    queryKey: ["qms"],
    queryFn: async () =>
      (await supabase.from("qms_entries").select("*").order("created_at", { ascending: false })).data ??
      [],
  });

  return (
    <AppShell title="QMS / SOP Log" subtitle="Quality events, SOP governance and system activity">
      <div className="panel">
        <h3>
          Record a quality event<small>MANUAL ENTRY</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Entry type</label>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
              {ENTRY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Reference (SOP / CAPA ID)</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="field span2">
            <label>Event</label>
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="e.g. SOP-PV-004 (Case Triage) reviewed, no changes."
            />
          </div>
        </div>
        <button
          className="btn primary"
          disabled={!event.trim()}
          onClick={async () => {
            if (!session) return;
            await logQms({
              orgId: session.orgId,
              entryType,
              event: event.trim(),
              reference: reference.trim() || undefined,
              actorId: session.userId,
              actorName: session.fullName,
            });
            setEvent("");
            setReference("");
            queryClient.invalidateQueries({ queryKey: ["qms"] });
            setToast("Quality event recorded");
            setTimeout(() => setToast(null), 2600);
          }}
        >
          Record entry
        </button>
      </div>

      <div className="panel">
        <h3>
          Quality log<small>APPEND-ONLY</small>
        </h3>
        {(entries ?? []).length === 0 ? (
          <div className="empty">No quality entries recorded.</div>
        ) : (
          <div className="audit-list">
            {(entries ?? []).map((e) => (
              <div className="audit-row" key={e.id}>
                <span className="audit-time">{fmtDateTime(e.created_at)}</span>
                <span className="audit-body">
                  <span className="audit-user">{e.actor_name ?? "System"}</span> — {e.event}
                  {e.reference ? ` (${e.reference})` : ""}
                  <span className="st-pill" style={{ marginLeft: 8 }}>
                    {e.entry_type}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
