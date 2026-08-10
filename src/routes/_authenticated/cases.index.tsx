import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { CASE_STATUSES, daysLeft, dueLabel, fmtDate, toCsv, download } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/cases/")({
  head: () => ({
    meta: [
      { title: "Case Management — SafetyCore" },
      {
        name: "description",
        content: "Search, filter and progress ICSR cases through triage, coding, review and QC.",
      },
      { property: "og:title", content: "Case Management — SafetyCore" },
      { property: "og:description", content: "The full ICSR case inventory and regulatory clocks." },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [seriousness, setSeriousness] = useState("");
  const [term, setTerm] = useState("");

  const { data: cases, isLoading } = useQuery({
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

  const rows = (cases ?? []).filter(
    (c) =>
      (!status || c.status === status) &&
      (!seriousness || c.seriousness === seriousness) &&
      (!term ||
        [c.case_number, c.product_name, c.meddra_term, c.patient_initials]
          .join(" ")
          .toLowerCase()
          .includes(term.toLowerCase())),
  );

  return (
    <AppShell
      title="Case Management"
      subtitle={`${rows.length} case${rows.length === 1 ? "" : "s"} visible under your access level`}
      actions={
        <>
          <button
            className="btn"
            onClick={() =>
              download(
                `safetycore-cases-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(
                  rows.map((c) => ({
                    case_number: c.case_number,
                    status: c.status,
                    seriousness: c.seriousness,
                    product: c.product_name,
                    meddra_term: c.meddra_term,
                    received: c.received_date,
                    due: c.due_date,
                  })),
                ),
                "text/csv",
              )
            }
          >
            Export CSV
          </button>
          <Link to="/intake" className="btn primary">
            New ICSR
          </Link>
        </>
      }
    >
      <div className="filters">
        <input placeholder="Filter cases…" value={term} onChange={(e) => setTerm(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {CASE_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={seriousness} onChange={(e) => setSeriousness(e.target.value)}>
          <option value="">All seriousness</option>
          <option>Serious</option>
          <option>Non-serious</option>
        </select>
      </div>

      <div className="panel">
        {isLoading ? (
          <div className="empty">Loading cases…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No cases match these filters.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Product</th>
                <th>MedDRA PT</th>
                <th>Patient</th>
                <th>Seriousness</th>
                <th>Status</th>
                <th>Received</th>
                <th>Clock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="rowlink"
                  onClick={() => navigate({ to: "/cases/$caseId", params: { caseId: c.id } })}
                >
                  <td className="mono">{c.case_number}</td>
                  <td>{c.product_name}</td>
                  <td>{c.meddra_term ?? "—"}</td>
                  <td>
                    {c.patient_initials ?? "—"}
                    {c.patient_age ? ` · ${c.patient_age}` : ""}
                    {c.patient_sex ? ` ${c.patient_sex}` : ""}
                  </td>
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
                  <td>{fmtDate(c.received_date)}</td>
                  <td>
                    <span
                      className={
                        (daysLeft(c.due_date) ?? 9) < 0 &&
                        c.status !== "Submitted" &&
                        c.status !== "Closed"
                          ? "badge overdue"
                          : "badge nonserious"
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
    </AppShell>
  );
}
