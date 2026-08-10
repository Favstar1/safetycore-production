import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession, canReview, canSubmit } from "@/hooks/useSession";
import { logAudit, logQms, notify } from "@/lib/audit";
import {
  MEDDRA_TERMS,
  OUTCOMES,
  SOC_MAP,
  buildE2BPreview,
  dueLabel,
  fmtDate,
  fmtDateTime,
} from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  head: () => ({
    meta: [
      { title: "Case detail — SafetyCore" },
      {
        name: "description",
        content: "ICSR case detail: coding, medical review, QC checklist, audit trail and E2B(R3) submission.",
      },
      { property: "og:title", content: "Case detail — SafetyCore" },
      { property: "og:description", content: "Full case workflow with append-only audit trail." },
    ],
  }),
  component: CaseDetail,
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [toast, setToast] = useState<string | null>(null);
  const [attested, setAttested] = useState(false);
  const [followUp, setFollowUp] = useState("");

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: audit } = useQuery({
    queryKey: ["case-audit", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("case_audit_events")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: followUps } = useQuery({
    queryKey: ["case-followups", caseId],
    queryFn: async () =>
      (
        await supabase
          .from("case_follow_ups")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const mutate = useMutation({
    mutationFn: async ({
      patch,
      action,
    }: {
      patch: Record<string, unknown>;
      action: string;
    }) => {
      if (!session || !c) throw new Error("No session");
      const { error } = await supabase.from("cases").update(patch as never).eq("id", caseId);
      if (error) throw error;
      await logAudit({
        orgId: session.orgId,
        caseId,
        action,
        actorId: session.userId,
        actorName: session.fullName,
        metadata: patch as Record<string, unknown>,
      });
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["case-audit", caseId] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      flash(v.action);
    },
    onError: (e: Error) => flash(e.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Case detail">
        <div className="empty">Loading case…</div>
      </AppShell>
    );
  }
  if (!c) {
    return (
      <AppShell title="Case detail">
        <div className="empty">This case is not available under your access level.</div>
      </AppShell>
    );
  }

  const readyToSubmit = c.coding_complete && c.medical_review_complete && c.qc_complete;

  async function submitCase() {
    if (!session || !c) return;
    const preview = buildE2BPreview(c);
    const { error } = await supabase.from("case_submissions").insert({
      org_id: session.orgId,
      case_id: c.id,
      destination: "NAFDAC E2B(R3) Gateway",
      message_type: "ichicsr",
      state: "Transmitted",
      attested_by: session.userId,
      attestation_text: `I, ${session.fullName}, attest that this ICSR is complete and accurate for regulatory submission.`,
      payload_preview: preview,
    });
    if (error) {
      flash(error.message);
      return;
    }
    await supabase
      .from("cases")
      .update({
        status: "Submitted",
        submitted_at: new Date().toISOString(),
        submitted_by: session.userId,
      })
      .eq("id", c.id);
    await logAudit({
      orgId: session.orgId,
      caseId: c.id,
      action: `Submitted to regulatory gateway (E2B R3), attested by ${session.fullName}`,
      actorId: session.userId,
      actorName: session.fullName,
    });
    await logQms({
      orgId: session.orgId,
      event: `ICSR ${c.case_number} transmitted to NAFDAC gateway`,
      actorId: session.userId,
      actorName: session.fullName,
      reference: c.case_number,
    });
    queryClient.invalidateQueries();
    flash("Case submitted and attested");
  }

  return (
    <AppShell
      title={c.case_number}
      subtitle={`${c.product_name} · ${c.meddra_term ?? "Uncoded"} · ${c.status}`}
      actions={
        <button className="btn" onClick={() => navigate({ to: "/cases" })}>
          Back to cases
        </button>
      }
    >
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Seriousness</div>
          <div className="num" style={{ fontSize: 22 }}>
            {c.seriousness}
          </div>
          <div className="foot">{c.seriousness === "Serious" ? "15-day expedited" : "90-day periodic"}</div>
        </div>
        <div className="kpi">
          <div className="label">Regulatory clock</div>
          <div className="num" style={{ fontSize: 22 }}>
            {dueLabel(c.due_date, c.status)}
          </div>
          <div className="foot">Due {fmtDate(c.due_date)}</div>
        </div>
        <div className="kpi">
          <div className="label">Channel</div>
          <div className="num" style={{ fontSize: 22 }}>
            {c.channel ?? "Direct Entry"}
          </div>
          <div className="foot">Received {fmtDate(c.received_date)}</div>
        </div>
        <div className="kpi">
          <div className="label">Follow-ups</div>
          <div className="num" style={{ fontSize: 22 }}>
            {(followUps ?? []).length}
          </div>
          <div className="foot">Version {(c.follow_up_count ?? 0) + 1}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div>
          <div className="panel">
            <h3>
              Case data<small>ICH E2B(R3) CORE FIELDS</small>
            </h3>
            <div className="form-grid">
              <div className="field">
                <label>Reporter type</label>
                <input value={c.reporter_type ?? "—"} readOnly />
              </div>
              <div className="field">
                <label>Patient</label>
                <input
                  value={`${c.patient_initials ?? "—"} · ${c.patient_age ?? "—"} · ${c.patient_sex ?? "—"}`}
                  readOnly
                />
              </div>
              <div className="field">
                <label>Suspect product</label>
                <input value={c.product_name ?? "—"} readOnly />
              </div>
              <div className="field">
                <label>Batch number</label>
                <input value={c.batch_number ?? "—"} readOnly />
              </div>
              <div className="field span2">
                <label>Narrative</label>
                <textarea value={c.narrative ?? ""} readOnly />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>
              MedDRA / WHO-DD coding<small>DICTIONARY SUBSET · LICENSED MEDDRA PENDING</small>
            </h3>
            <div className="form-grid">
              <div className="field">
                <label>Preferred term (PT)</label>
                <select
                  value={c.meddra_term ?? ""}
                  onChange={(e) =>
                    mutate.mutate({
                      patch: {
                        meddra_term: e.target.value,
                        meddra_soc: SOC_MAP[e.target.value] ?? null,
                      },
                      action: `MedDRA coding set to "${e.target.value}"`,
                    })
                  }
                >
                  <option value="">Select term…</option>
                  {MEDDRA_TERMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>System organ class (SOC)</label>
                <input value={c.meddra_soc ?? "—"} readOnly />
              </div>
              <div className="field">
                <label>Outcome</label>
                <select
                  value={c.outcome ?? ""}
                  onChange={(e) =>
                    mutate.mutate({
                      patch: { outcome: e.target.value },
                      action: `Outcome recorded as "${e.target.value}"`,
                    })
                  }
                >
                  <option value="">Select outcome…</option>
                  {OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>
              Follow-up requests<small>REPORTER CORRESPONDENCE</small>
            </h3>
            <div className="field">
              <label>New follow-up request</label>
              <textarea
                value={followUp}
                placeholder="Describe the missing information being requested from the reporter…"
                onChange={(e) => setFollowUp(e.target.value)}
              />
            </div>
            <button
              className="btn"
              disabled={!followUp.trim()}
              onClick={async () => {
                if (!session) return;
                await supabase.from("case_follow_ups").insert({
                  org_id: session.orgId,
                  case_id: c.id,
                  request: followUp.trim(),
                  status: "Open",
                  owner_id: session.userId,
                  created_by: session.userId,
                });
                await supabase
                  .from("cases")
                  .update({ follow_up_count: (c.follow_up_count ?? 0) + 1 })
                  .eq("id", c.id);
                await logAudit({
                  orgId: session.orgId,
                  caseId: c.id,
                  action: "Follow-up request raised",
                  actorId: session.userId,
                  actorName: session.fullName,
                });
                setFollowUp("");
                queryClient.invalidateQueries();
                flash("Follow-up request logged");
              }}
            >
              Log follow-up
            </button>
            <div className="audit-list" style={{ marginTop: 14 }}>
              {(followUps ?? []).map((f) => (
                <div className="audit-row" key={f.id}>
                  <span className="audit-time">{fmtDate(f.created_at)}</span>
                  <span className="audit-body">{f.request}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <h3>
              Workflow<small>SEQUENTIAL GATES</small>
            </h3>
            <div className="checklist">
              <label>
                <input
                  type="checkbox"
                  checked={!!c.coding_complete}
                  disabled={!c.meddra_term}
                  onChange={(e) =>
                    mutate.mutate({
                      patch: {
                        coding_complete: e.target.checked,
                        status: e.target.checked ? "Medical Review" : "Coding",
                      },
                      action: e.target.checked ? "Coding completed" : "Coding reopened",
                    })
                  }
                />
                <span>
                  Coding complete
                  <br />
                  <span className="perm-note">Requires a MedDRA preferred term.</span>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!c.medical_review_complete}
                  disabled={!c.coding_complete || !canReview(session?.role)}
                  onChange={(e) =>
                    mutate.mutate({
                      patch: {
                        medical_review_complete: e.target.checked,
                        status: e.target.checked ? "QC" : "Medical Review",
                      },
                      action: e.target.checked ? "Medical review signed off" : "Medical review reopened",
                    })
                  }
                />
                <span>
                  Medical review complete
                  <br />
                  <span className="perm-note">PV Manager / QPPV only.</span>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!c.qc_complete}
                  disabled={!c.medical_review_complete}
                  onChange={(e) =>
                    mutate.mutate({
                      patch: { qc_complete: e.target.checked, status: e.target.checked ? "QC" : "QC" },
                      action: e.target.checked ? "QC check passed" : "QC reopened",
                    })
                  }
                />
                <span>QC check complete</span>
              </label>
            </div>

            <div className="sig-panel">
              <div className="mono-label">Electronic signature · 21 CFR Part 11</div>
              <p>
                Submission transmits an E2B(R3) message to the NAFDAC gateway and is recorded as an
                attested, append-only event against this case.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={attested}
                  disabled={!canSubmit(session?.role) || !readyToSubmit || c.status === "Submitted"}
                  onChange={(e) => setAttested(e.target.checked)}
                />
                <span>
                  I attest that this ICSR is complete and accurate, and I am authorised to submit it.
                </span>
              </label>
              <button
                className="btn teal"
                disabled={
                  !attested || !readyToSubmit || !canSubmit(session?.role) || c.status === "Submitted"
                }
                onClick={() => void submitCase()}
              >
                {c.status === "Submitted" ? "Already submitted" : "Sign & submit E2B(R3)"}
              </button>
              {!canSubmit(session?.role) && (
                <div className="perm-note">Submission is restricted to PV Manager / Admin.</div>
              )}
            </div>

            {c.status === "Submitted" && canSubmit(session?.role) && (
              <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={async () => {
                  mutate.mutate({ patch: { status: "Closed" }, action: "Case closed" });
                  if (session && c.assigned_to) {
                    await notify({
                      orgId: session.orgId,
                      userId: c.assigned_to,
                      type: "Case closed",
                      message: `${c.case_number} has been closed`,
                      entity: "case",
                      entityId: c.id,
                    });
                  }
                }}
              >
                Close case
              </button>
            )}
          </div>

          <div className="panel">
            <h3>
              Audit trail<small>APPEND-ONLY</small>
            </h3>
            <div className="audit-list">
              {(audit ?? []).length === 0 ? (
                <div className="empty">No recorded events.</div>
              ) : (
                (audit ?? []).map((a) => (
                  <div className="audit-row" key={a.id}>
                    <span className="audit-time">{fmtDateTime(a.created_at)}</span>
                    <span className="audit-body">
                      <span className="audit-user">{a.actor_name ?? "System"}</span> — {a.action}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
