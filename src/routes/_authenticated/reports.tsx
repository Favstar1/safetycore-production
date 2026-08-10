import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession, canReview } from "@/hooks/useSession";
import { logQms } from "@/lib/audit";
import { download, fmtDate, toCsv } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Aggregate Reports — SafetyCore" },
      {
        name: "description",
        content:
          "Generate PSUR, PBRER and DSUR aggregate safety reports from live case data for any product and reporting period.",
      },
      { property: "og:title", content: "Aggregate Reports — SafetyCore" },
      { property: "og:description", content: "PSUR / PBRER / DSUR generation from live case data." },
    ],
  }),
  component: ReportsPage,
});

const TYPES = ["PSUR", "PBRER", "DSUR"];

function ReportsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  const [type, setType] = useState("PSUR");
  const [product, setProduct] = useState("");
  const [from, setFrom] = useState(start.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [toast, setToast] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("name").order("name")).data ?? [],
  });

  const { data: cases } = useQuery({
    queryKey: ["cases", "all"],
    queryFn: async () => (await supabase.from("cases").select("*")).data ?? [],
  });

  const { data: reports } = useQuery({
    queryKey: ["reports"],
    queryFn: async () =>
      (await supabase.from("aggregate_reports").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const inScope = (cases ?? []).filter(
    (c) =>
      (!product || c.product_name === product) &&
      c.received_date >= from &&
      c.received_date <= to,
  );
  const seriousCount = inScope.filter((c) => c.seriousness === "Serious").length;

  const bySoc = Object.entries(
    inScope.reduce<Record<string, number>>((acc, c) => {
      const k = c.meddra_soc ?? "Uncoded";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  async function generate() {
    if (!session) return;
    const summary = `${type} for ${product || "all products"} covering ${fmtDate(from)} – ${fmtDate(
      to,
    )}. ${inScope.length} valid ICSRs received, of which ${seriousCount} were serious. Most frequently reported system organ class: ${
      bySoc[0]?.[0] ?? "n/a"
    }.`;
    const { error } = await supabase.from("aggregate_reports").insert({
      org_id: session.orgId,
      report_type: type,
      product_name: product || "All products",
      period_start: from,
      period_end: to,
      case_count: inScope.length,
      serious_count: seriousCount,
      summary,
      status: "Draft",
      content: { bySoc } as never,
      created_by: session.userId,
    });
    if (error) {
      setToast(error.message);
      return;
    }
    await logQms({
      orgId: session.orgId,
      event: `${type} draft generated for ${product || "all products"} (${fmtDate(from)}–${fmtDate(to)})`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    queryClient.invalidateQueries();
    setToast(`${type} draft generated`);
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <AppShell title="Aggregate Reports" subtitle="PSUR / PBRER / DSUR generation from live case data">
      <div className="panel">
        <h3>
          Reporting period<small>DEFINE SCOPE</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Report type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Product</label>
            <select value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">All products</option>
              {(products ?? []).map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Period start</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Period end</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <div className="kpi">
            <div className="label">Cases in period</div>
            <div className="num">{inScope.length}</div>
          </div>
          <div className="kpi">
            <div className="label">Serious</div>
            <div className="num">{seriousCount}</div>
          </div>
          <div className="kpi">
            <div className="label">Distinct SOCs</div>
            <div className="num">{bySoc.length}</div>
          </div>
          <div className="kpi">
            <div className="label">Top SOC</div>
            <div className="num" style={{ fontSize: 16 }}>
              {bySoc[0]?.[0] ?? "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn primary" disabled={!canReview(session?.role)} onClick={() => void generate()}>
            Generate {type} draft
          </button>
          <button
            className="btn"
            onClick={() =>
              download(
                `${type}-line-listing-${from}-${to}.csv`,
                toCsv(
                  inScope.map((c) => ({
                    case_number: c.case_number,
                    product: c.product_name,
                    meddra_pt: c.meddra_term,
                    soc: c.meddra_soc,
                    seriousness: c.seriousness,
                    outcome: c.outcome,
                    received: c.received_date,
                  })),
                ),
                "text/csv",
              )
            }
          >
            Export line listing
          </button>
        </div>
        {!canReview(session?.role) && (
          <div className="perm-note">Report generation is restricted to PV Manager / Admin.</div>
        )}
      </div>

      <div className="panel">
        <h3>
          Case distribution by SOC<small>PERIOD SUMMARY TABULATION</small>
        </h3>
        {bySoc.length === 0 ? (
          <div className="empty">No cases in this period.</div>
        ) : (
          bySoc.map(([soc, n]) => (
            <div className="workload-row" key={soc}>
              <div className="workload-name">{soc}</div>
              <div className="workload-bar">
                <span style={{ width: `${(n / (bySoc[0]?.[1] ?? 1)) * 100}%` }} />
              </div>
              <div className="workload-count">{n} cases</div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h3>
          Generated reports<small>DRAFT REGISTER</small>
        </h3>
        {(reports ?? []).length === 0 ? (
          <div className="empty">No reports generated yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Product</th>
                <th>Period</th>
                <th>Cases</th>
                <th>Serious</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.report_type}</td>
                  <td>{r.product_name}</td>
                  <td>
                    {fmtDate(r.period_start)} – {fmtDate(r.period_end)}
                  </td>
                  <td className="mono">{r.case_count}</td>
                  <td className="mono">{r.serious_count}</td>
                  <td>
                    <span className="st-pill">{r.status}</span>
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
