import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession, canReview } from "@/hooks/useSession";
import { logAudit, logQms } from "@/lib/audit";
import { SIGNAL_THRESHOLD, fmtDate } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/signals")({
  head: () => ({
    meta: [
      { title: "Signal Detection — SafetyCore" },
      {
        name: "description",
        content:
          "Disproportionality-style case clustering by product and MedDRA term, with a structured signal validation workflow.",
      },
      { property: "og:title", content: "Signal Detection — SafetyCore" },
      { property: "og:description", content: "Detect, validate, confirm or refute safety signals." },
    ],
  }),
  component: SignalsPage,
});

function SignalsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const { data: cases } = useQuery({
    queryKey: ["cases", "all"],
    queryFn: async () => (await supabase.from("cases").select("*")).data ?? [],
  });

  const { data: signals } = useQuery({
    queryKey: ["signals"],
    queryFn: async () =>
      (await supabase.from("signals").select("*").order("case_count", { ascending: false })).data ??
      [],
  });

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  // Live clustering from case data — the detection view.
  const clusters = Object.values(
    (cases ?? []).reduce<Record<string, { product: string; term: string; n: number; serious: number }>>(
      (acc, c) => {
        if (!c.meddra_term) return acc;
        const key = `${c.product_name}||${c.meddra_term}`;
        acc[key] ??= { product: c.product_name, term: c.meddra_term, n: 0, serious: 0 };
        acc[key]!.n += 1;
        if (c.seriousness === "Serious") acc[key]!.serious += 1;
        return acc;
      },
      {},
    ),
  )
    .filter((x) => x.n >= SIGNAL_THRESHOLD)
    .sort((a, b) => b.n - a.n);

  async function createSignal(cluster: { product: string; term: string; n: number }) {
    if (!session) return;
    const ref = `SIG-${new Date().getFullYear()}-${String((signals ?? []).length + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("signals").insert({
      org_id: session.orgId,
      signal_ref: ref,
      product_name: cluster.product,
      meddra_term: cluster.term,
      case_count: cluster.n,
      status: "New",
    });
    if (error) return flash(error.message);
    await logQms({
      orgId: session.orgId,
      event: `Signal ${ref} raised: ${cluster.product} / ${cluster.term} (${cluster.n} cases)`,
      actorId: session.userId,
      actorName: session.fullName,
      reference: ref,
    });
    queryClient.invalidateQueries();
    flash(`${ref} raised for validation`);
  }

  async function decide(signalId: string, decision: "Under Validation" | "Confirmed" | "Refuted") {
    if (!session) return;
    const note = notes[signalId] ?? "";
    const { error } = await supabase
      .from("signals")
      .update({
        status: decision,
        review_decision: decision,
        notes: note || null,
        reviewed_by: session.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", signalId);
    if (error) return flash(error.message);
    await supabase.from("signal_reviews").insert({
      org_id: session.orgId,
      signal_id: signalId,
      decision,
      notes: note || null,
      reviewer_id: session.userId,
    });
    await logAudit({
      orgId: session.orgId,
      entity: "signal",
      entityId: signalId,
      action: `Signal decision recorded: ${decision}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    queryClient.invalidateQueries();
    flash(`Signal marked ${decision}`);
  }

  return (
    <AppShell
      title="Signal Detection"
      subtitle={`Clusters of ${SIGNAL_THRESHOLD}+ cases sharing a product and MedDRA preferred term`}
    >
      <div className="panel">
        <h3>
          Detected clusters<small>LIVE FROM CASE DATA</small>
        </h3>
        {clusters.length === 0 ? (
          <div className="empty">No clusters above the detection threshold.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>MedDRA PT</th>
                <th>Cases</th>
                <th>Serious</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => {
                const existing = (signals ?? []).find(
                  (s) => s.product_name === c.product && s.meddra_term === c.term,
                );
                return (
                  <tr key={`${c.product}-${c.term}`}>
                    <td>{c.product}</td>
                    <td>{c.term}</td>
                    <td className="mono">{c.n}</td>
                    <td className="mono">{c.serious}</td>
                    <td>
                      {existing ? (
                        <span className="st-pill">{existing.status}</span>
                      ) : (
                        <button
                          className="btn"
                          disabled={!canReview(session?.role)}
                          onClick={() => void createSignal(c)}
                        >
                          Raise signal
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!canReview(session?.role) && (
          <div className="perm-note">Raising and adjudicating signals is restricted to PV Manager / Admin.</div>
        )}
      </div>

      <div className="panel">
        <h3>
          Signal validation<small>STRUCTURED ADJUDICATION</small>
        </h3>
        {(signals ?? []).length === 0 ? (
          <div className="empty">No signals under management.</div>
        ) : (
          (signals ?? []).map((s) => (
            <div
              key={s.id}
              style={{ borderBottom: "1px solid var(--line)", padding: "14px 0" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="mono" style={{ color: "#7fcfc4" }}>
                    {s.signal_ref}
                  </span>{" "}
                  — {s.product_name} / {s.meddra_term}
                  <div style={{ fontSize: 12, color: "#8a9186", marginTop: 4 }}>
                    {s.case_count} cases · raised {fmtDate(s.created_at)}
                    {s.reviewed_at ? ` · last decision ${fmtDate(s.reviewed_at)}` : ""}
                  </div>
                </div>
                <span className="st-pill">{s.status}</span>
              </div>
              {canReview(session?.role) && s.status !== "Confirmed" && s.status !== "Refuted" && (
                <>
                  <div className="field" style={{ marginTop: 10 }}>
                    <label>Validation notes</label>
                    <textarea
                      value={notes[s.id] ?? s.notes ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                      placeholder="Assessment of case series, biological plausibility, labelling status…"
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => void decide(s.id, "Under Validation")}>
                      Mark under validation
                    </button>
                    <button className="btn teal" onClick={() => void decide(s.id, "Confirmed")}>
                      Confirm signal
                    </button>
                    <button className="btn" onClick={() => void decide(s.id, "Refuted")}>
                      Refute
                    </button>
                  </div>
                </>
              )}
              {s.notes && <div className="perm-note">{s.notes}</div>}
            </div>
          ))
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
