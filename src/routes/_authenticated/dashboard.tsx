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
      { title: "Manager Dashboard — SafetyCore" },
      {
        name: "description",
        content: "Team-wide case load, regulatory compliance clocks and signal oversight.",
      },
      { property: "og:title", content: "Manager Dashboard — SafetyCore" },
      {
        property: "og:description",
        content: "Team-wide case load, compliance, and signal oversight.",
      },
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
  const overdue = open.filter((c) => (daysLeft(c.due_date) ?? 99) < 0);
  const dueSoon = open.filter((c) => {
    const d = daysLeft(c.due_date);
    return d !== null && d >= 0 && d <= 3;
  });
  const isField = session?.role === "FIELD_ASSOCIATE";
  const isManager = session?.role === "PV_MANAGER" || session?.role === "ADMIN";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const submittedThisMonth = rows.filter(
    (c) => c.submitted_at && new Date(c.submitted_at) >= monthStart,
  ).length;
  const activeSignals = (signals ?? []).filter((s) => s.status !== "Refuted").length;
  const serious = rows.filter((c) => c.seriousness === "Serious");

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

  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const workload = (people ?? [])
    .map((p) => ({ name: p.full_name, n: open.filter((c) => c.assigned_to === p.id).length }))
    .filter((w) => w.n > 0)
    .sort((a, b) => b.n - a.n);
  const maxLoad = Math.max(1, ...workload.map((w) => w.n));

  const recent = rows.slice(0, 8);

  function shortName(full?: string | null) {
    if (!full) return "Unassigned";
    const parts = full.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]![0]}. ${parts.slice(1).join(" ")}` : full;
  }

  function patientLabel(c: (typeof rows)[number]) {
    if (!c.patient_sex && !c.patient_age) {
      return c.channel === "WhatsApp" ? "Unknown, reported via WhatsApp" : "Unknown";
    }
    return `${c.patient_sex ?? "U"}, ${c.patient_age ?? "?"}y`;
  }

  return (
    <AppShell
      title={
        isField ? "My Reports" : isManager ? "Manager Dashboard" : "Safety Operations Dashboard"
      }
      subtitle={
        isField
          ? "Reports you have submitted and their current review status"
          : isManager
            ? "Team-wide case load, compliance, and signal oversight."
            : "Live ICSR pipeline, regulatory clocks and signal activity"
      }
      actions={
        <Link to="/intake" className="btn primary">
          + New ICSR Case
        </Link>
      }
    >
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">{isField ? "My reports" : "Open cases"}</div>
          <div className="num">
            {isField ? rows.filter((c) => c.created_by === session?.userId).length : open.length}
          </div>
          <div className="foot">of {rows.length} total in system</div>
        </div>
        <div className="kpi">
          <div className="label">Overdue (E2B clock)</div>
          <div className={`num${overdue.length ? " warn" : ""}`}>{overdue.length}</div>
          <div className="foot">
            {overdue.length ? `${dueSoon.length} more due within 3 days` : "past regulatory due date"}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Submitted this month</div>
          <div className="num">{submittedThisMonth}</div>
          <div className="foot">to regulatory gateway(s)</div>
        </div>
        <div className="kpi">
          <div className="label">{isManager ? "Signals active" : "Serious cases"}</div>
          <div className="num">{isManager ? activeSignals : serious.length}</div>
          <div className="foot">
            {isManager ? "new / under validation" : "15-day expedited clock"}
          </div>
        </div>
      </div>

      {!isField && (
        <div className="panel">
          <h3>
            Case status breakdown<small>ALL PRODUCTS</small>
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
                {c.status} ({c.n})
              </div>
            ))}
          </div>
        </div>
      )}

      {isManager ? (
        <>
          <div className="panel">
            <h3>
              Team workload<small>OPEN CASES BY STAFF</small>
            </h3>
            {workload.length === 0 ? (
              <div className="empty">No open cases assigned.</div>
            ) : (
              workload.map((w) => (
                <div className="workload-row" key={w.name}>
                  <div className="workload-name">{shortName(w.name)}</div>
                  <div className="workload-bar">
                    <span style={{ width: `${(w.n / maxLoad) * 100}%` }} />
                  </div>
                  <div className="workload-count">{w.n} open</div>
                </div>
              ))
            )}
          </div>

          <div className="panel">
            <h3>Recently received cases</h3>
            {recent.length === 0 ? (
              <div className="empty">No cases received yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Patient</th>
                    <th>Product</th>
                    <th>MedDRA term</th>
                    <th>Seriousness</th>
                    <th>Status</th>
                    <th>Due (E2B)</th>
                    <th>Assigned</th>
                    <th>Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr
                      key={c.id}
                      className="rowlink"
                      onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                    >
                      <td className="mono">{c.case_number}</td>
                      <td>{patientLabel(c)}</td>
                      <td>{c.product_name}</td>
                      <td>{c.meddra_term ?? "—"}</td>
                      <td>
                        <span
                          className={`badge ${c.seriousness === "Serious" ? "serious" : "nonserious"}`}
                        >
                          {c.seriousness}
                        </span>
                      </td>
                      <td>
                        <span className="st-pill">{c.status}</span>
                      </td>
                      <td className="mono">{c.due_date ?? "—"}</td>
                      <td>{shortName(nameById.get(c.assigned_to ?? "") ?? null)}</td>
                      <td>{c.channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
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
      )}
    </AppShell>
  );
}
