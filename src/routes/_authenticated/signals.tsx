import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession, canReview } from "@/hooks/useSession";
import { logAudit, logQms } from "@/lib/audit";
import { SIGNAL_THRESHOLD } from "@/lib/pv";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignalsPage,
});

type SignalStatus = "New" | "Under Validation" | "Confirmed" | "Refuted";

function SignalsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: cases } = useQuery({
    queryKey: ["cases", "all"],
    queryFn: async () => (await supabase.from("cases").select("*")).data ?? [],
  });

  const { data: signals } = useQuery({
    queryKey: ["signals"],
    queryFn: async () =>
      (await supabase.from("signals").select("*").order("signal_ref", { ascending: false })).data ??
      [],
  });

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  const clusters = Object.values(
    (cases ?? []).reduce<Record<string, { product: string; term: string; n: number }>>((acc, c) => {
      if (!c.meddra_term) return acc;
      const key = `${c.product_name}||${c.meddra_term}`;
      acc[key] ??= { product: c.product_name, term: c.meddra_term, n: 0 };
      acc[key]!.n += 1;
      return acc;
    }, {}),
  ).filter((x) => x.n >= SIGNAL_THRESHOLD);

  const unraised = clusters.filter(
    (c) =>
      !(signals ?? []).some((s) => s.product_name === c.product && s.meddra_term === c.term),
  );

  async function raiseSignal(cluster: { product: string; term: string; n: number }) {
    if (!session || busy) return;
    setBusy(true);
    const ref = `SIG-${new Date().getFullYear()}-${String((signals ?? []).length + 1).padStart(3, "0")}`;
    const { error } = await supabase.from("signals").insert({
      org_id: session.orgId,
      signal_ref: ref,
      product_name: cluster.product,
      meddra_term: cluster.term,
      case_count: cluster.n,
      status: "New",
    });
    if (error) {
      setBusy(false);
      return flash(error.message);
    }
    await logQms({
      orgId: session.orgId,
      event: `Signal ${ref} raised: ${cluster.product} / ${cluster.term} (${cluster.n} cases)`,
      actorId: session.userId,
      actorName: session.fullName,
      reference: ref,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash(`${ref} raised for validation`);
  }

  async function decide(signalId: string, ref: string, decision: SignalStatus) {
    if (!session || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("signals")
      .update({
        status: decision,
        review_decision: decision,
        reviewed_by: session.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", signalId);
    if (error) {
      setBusy(false);
      return flash(error.message);
    }
    await supabase.from("signal_reviews").insert({
      org_id: session.orgId,
      signal_id: signalId,
      decision,
      reviewer_id: session.userId,
    });
    await logAudit({
      orgId: session.orgId,
      entity: "signal",
      entityId: signalId,
      action: `Signal ${ref} decision recorded: ${decision}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await logQms({
      orgId: session.orgId,
      entryType: "Signal management",
      event: `Signal ${ref} ${decision.toLowerCase()}`,
      reference: ref,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await queryClient.invalidateQueries();
    setBusy(false);
    flash(`Signal ${decision}`);
  }

  const reviewer = canReview(session?.role);

  return (
    <AppShell
      title="Signal Detection"
      subtitle="Cases grouped by product and MedDRA term for review."
    >
      <div className="panel">
        <h3>
          Signal detection &amp; validation
          <small>THRESHOLD: ≥ {SIGNAL_THRESHOLD} CASES, SAME PRODUCT + TERM</small>
        </h3>
        {(signals ?? []).length === 0 && unraised.length === 0 ? (
          <div className="empty">No clusters above the detection threshold.</div>
        ) : (
          <table className="signal-table">
            <thead>
              <tr>
                <th>Signal ID</th>
                <th>Product</th>
                <th>MedDRA term</th>
                <th>Supporting cases</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(signals ?? []).map((s) => {
                const live =
                  clusters.find(
                    (c) => c.product === s.product_name && c.term === s.meddra_term,
                  )?.n ?? s.case_count;
                return (
                  <tr key={s.id}>
                    <td className="mono">{s.signal_ref}</td>
                    <td>{s.product_name}</td>
                    <td>{s.meddra_term}</td>
                    <td>{live} cases</td>
                    <td>
                      <span className={`sig-pill ${s.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      {!reviewer ? (
                        <span className="perm-note" style={{ margin: 0 }}>
                          PV Manager only
                        </span>
                      ) : s.status === "New" ? (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => void decide(s.id, s.signal_ref, "Under Validation")}
                        >
                          Validate
                        </button>
                      ) : s.status === "Under Validation" ? (
                        <div className="sig-actions">
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => void decide(s.id, s.signal_ref, "Confirmed")}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn"
                            disabled={busy}
                            onClick={() => void decide(s.id, s.signal_ref, "Refuted")}
                          >
                            Refute
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {unraised.map((c) => (
                <tr key={`${c.product}-${c.term}`}>
                  <td className="mono">—</td>
                  <td>{c.product}</td>
                  <td>{c.term}</td>
                  <td>{c.n} cases</td>
                  <td>
                    <span className="sig-pill detected">Detected</span>
                  </td>
                  <td>
                    {reviewer ? (
                      <button className="btn" disabled={busy} onClick={() => void raiseSignal(c)}>
                        Raise signal
                      </button>
                    ) : (
                      <span className="perm-note" style={{ margin: 0 }}>
                        PV Manager only
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
