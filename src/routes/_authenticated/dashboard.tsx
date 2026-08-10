import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import {
  CASE_STATUSES,
  STATUS_COLOR,
  dueLabel,
  daysLeft,
  fmtDate,
  type CaseStatus,
} from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SafetyCore" },
      {
        name: "description",
        content: "Live pharmacovigilance case status, compliance timers and team workload.",
      },
      { property: "og:title", content: "Dashboard — SafetyCore" },
      { property: "og:description", content: "Live case status and compliance tracking." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const { data: cases } = useQuery({
    queryKey: ["cases", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("received_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: people } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, title")).data ?? [],
  });

  const { data: signals } = useQuery({
    queryKey: ["signals"],
    queryFn: async () => (await supabase.from("signals").select("*")).data ?? [],
  });

  const rows = cases ?? [];
  const open = rows.filter((c) => c.status !== "Closed" && c.status !== "Submitted");
  const serious = rows.filter((c) => c.seriousness === "Serious");
  const overdue = open.filter((c) => (daysLeft(c.due_date) ?? 99) < 0);
  const dueSoon = open.filter((c) => {
    const d = daysLeft(c.due_date);
    return d !== null && d >= 0 && d <= 3;
  });
  const isField = session?.role === "FIELD_ASSOCIATE";

  const counts = CASE_STATUSES.map((s) => ({
    status: s,
    n: rows.filter((c) => c.status === s).length,
  }));
  const total = rows.length || 1;

  const myTasks = rows
    .filter(
      (c) =>
        c.status !== "Closed" &&
        (isField ? c.created_by === session?.userId : c.assigned_to === session?.userId),
    )
    .slice(0, 6);

  const workload = (people ?? [])
    .map((p) => ({
      name: p.full_name,
      n: open.filter((c) => c.assigned_to === p.id).length,
    }))
    .filter((w) => w.n > 0);
  const maxLoad = Math.max(1, ...workload.map((w) => w.n));

  return (
    <AppShell
      title={isField ? "My Reports" : "Safety Operations Dashboard"}
      subtitle={
        isField
          ? "Reports you have submitted and their current review status"
          : "Live ICSR pipeline, regulatory clocks and signal activity"
      }
      actions={
        <Link to="/intake" className="btn primary">
          New ICSR
        </Link>
      }
    >
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">{isField ? "My reports" : "Open cases"}</div>
          <div className="num">
            {isField ? rows.filter((c) => c.created_by === session?.userId).length : open.length}
          </div>
          <div className="foot">{rows.length} total in system</div>
        </div>
        <div className="kpi">
          <div className="label">Serious cases</div>
          <div className="num">{serious.length}</div>
          <div className="foot">15-day expedited clock</div>
        </div>
        <div className="kpi">
          <div className="label">Overdue</div>
          <div className={`num${overdue.length ? " warn" : ""}`}>{overdue.length}</div>
          <div className="foot">{dueSoon.length} due within 3 days</div>
        </div>
        <div className="kpi">
          <div className="label">Active signals</div>
          <div className="num">
            {(signals ?? []).filter((s) => s.status !== "Refuted").length}
          </div>
          <div className="foot">Threshold ≥ 2 cases</div>
        </div>
      </div>

      {!isField && (
        <div className="panel">
          <h3>
            Case pipeline<small>BY WORKFLOW STAGE</small>
          </h3>
          <div className="status-bar">
            {counts.map((c) => (
              <span
                key={c.status}
                style={{
                  width: `${(c.n / total) * 100}%`,
                  background: STATUS_COLOR[c.status as CaseStatus],
                }}
              />
            ))}
          </div>
          <div className="status-legend">
            {counts.map((c) => (
              <div className="item" key={c.status}>
                <span
                  className="sw"
                  style={{ background: STATUS_COLOR[c.status as CaseStatus] }}
                />
                {c.status} · {c.n}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-grid">
        <div className="panel">
          <h3>
            {isField ? "My submitted reports" : "My queue"}
            <small>ACTION REQUIRED</small>
          </h3>
          {myTasks.length === 0 ? (
            <div className="empty">Nothing assigned to you right now.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Product / Event</th>
                  <th>Status</th>
                  <th>Due</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((c) => (
                  <tr
                    key={c.id}
                    className="rowlink"
                    onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                  >
                    <td className="mono">{c.case_number}</td>
                    <td>
                      {c.product_name}
                      <br />
                      <span style={{ color: "#8a9186", fontSize: 12 }}>
                        {c.meddra_term ?? "Uncoded"}
                      </span>
                    </td>
                    <td>
                      <span className="st-pill">{c.status}</span>
                    </td>
                    <td>
                      <span
                        className={
                          (daysLeft(c.due_date) ?? 9) < 0 ? "badge overdue" : "badge nonserious"
                        }
                      >
                        {dueLabel(c.due_date, c.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>
            {isField ? "Latest activity" : "Team workload"}
            <small>{isField ? "RECENT" : "OPEN CASES PER OWNER"}</small>
          </h3>
          {isField ? (
            <div className="audit-list">
              {rows.slice(0, 6).map((c) => (
                <div className="audit-row" key={c.id}>
                  <span className="audit-time">{fmtDate(c.received_date)}</span>
                  <span className="audit-body">
                    <span className="mono">{c.case_number}</span> — {c.status}
                  </span>
                </div>
              ))}
            </div>
          ) : workload.length === 0 ? (
            <div className="empty">No open cases assigned.</div>
          ) : (
            workload.map((w) => (
              <div className="workload-row" key={w.name}>
                <div className="workload-name">{w.name}</div>
                <div className="workload-bar">
                  <span style={{ width: `${(w.n / maxLoad) * 100}%` }} />
                </div>
                <div className="workload-count">{w.n} open</div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
