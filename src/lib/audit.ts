import { supabase } from "@/integrations/supabase/client";

/** Append-only audit trail write (21 CFR Part 11 style event log). */
export async function logAudit(params: {
  orgId: string;
  caseId?: string | null;
  entity?: string;
  entityId?: string | null;
  action: string;
  actorId: string;
  actorName: string;
  metadata?: Record<string, unknown>;
}) {
  await supabase.from("case_audit_events").insert({
    org_id: params.orgId,
    case_id: params.caseId ?? null,
    entity: params.entity ?? "case",
    entity_id: params.entityId ?? params.caseId ?? null,
    action: params.action,
    actor_id: params.actorId,
    actor_name: params.actorName,
    metadata: (params.metadata ?? null) as never,
  });
}

export async function logQms(params: {
  orgId: string;
  event: string;
  actorId: string;
  actorName: string;
  entryType?: string;
  reference?: string | undefined;
}) {
  await supabase.from("qms_entries").insert({
    org_id: params.orgId,
    entry_type: params.entryType ?? "System",
    event: params.event,
    reference: params.reference ?? null,
    actor_id: params.actorId,
    actor_name: params.actorName,
  });
}

export async function notify(params: {
  orgId: string;
  userId: string;
  type: string;
  message: string;
  entity?: string;
  entityId?: string | null;
}) {
  await supabase.from("notifications").insert({
    org_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    message: params.message,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
  });
}
