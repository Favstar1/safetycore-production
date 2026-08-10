import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useSession } from "@/hooks/useSession";
import { logQms } from "@/lib/audit";
import { ROLE_LABEL, fmtDateTime, type AppRole } from "@/lib/pv";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administration — SafetyCore" },
      {
        name: "description",
        content:
          "Manage the product catalogue, user roles and review the system-wide audit trail for the safety system.",
      },
      { property: "og:title", content: "Administration — SafetyCore" },
      { property: "og:description", content: "Products, roles and system audit oversight." },
    ],
  }),
  component: AdminPage,
});

const ROLES: AppRole[] = ["FIELD_ASSOCIATE", "PV_COORDINATOR", "PV_MANAGER", "ADMIN"];

function AdminPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [newProduct, setNewProduct] = useState("");
  const [client, setClient] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products", "admin"],
    queryFn: async () => (await supabase.from("products").select("*").order("name")).data ?? [],
  });

  const { data: people } = useQuery({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as AppRole),
      }));
    },
  });

  const { data: audit } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () =>
      (
        await supabase
          .from("case_audit_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(40)
      ).data ?? [],
  });

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <AppShell title="Administration" subtitle="Catalogue, access control and system oversight">
      <div className="panel">
        <h3>
          Product catalogue<small>MARKETING AUTHORIZATIONS</small>
        </h3>
        <div className="form-grid">
          <div className="field">
            <label>Product name</label>
            <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} />
          </div>
          <div className="field">
            <label>Client / MAH</label>
            <input value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
        </div>
        <button
          className="btn"
          disabled={!newProduct.trim()}
          onClick={async () => {
            if (!session) return;
            const { error } = await supabase.from("products").insert({
              org_id: session.orgId,
              name: newProduct.trim(),
              client_name: client.trim() || null,
              active: true,
            });
            if (error) return flash(error.message);
            await logQms({
              orgId: session.orgId,
              entryType: "System",
              event: `Product "${newProduct.trim()}" added to catalogue`,
              actorId: session.userId,
              actorName: session.fullName,
            });
            setNewProduct("");
            setClient("");
            queryClient.invalidateQueries();
            flash("Product added");
          }}
        >
          Add product
        </button>

        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Client / MAH</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.client_name ?? "—"}</td>
                <td>
                  <span className="st-pill">{p.active ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <button
                    className="btn"
                    onClick={async () => {
                      await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
                      queryClient.invalidateQueries();
                    }}
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>
          Users &amp; roles<small>ACCESS CONTROL</small>
        </h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Title</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {(people ?? []).map((p) => (
              <tr key={p.id}>
                <td>{p.full_name}</td>
                <td>{p.email}</td>
                <td>{p.title ?? "—"}</td>
                <td>
                  <select
                    value={p.roles[0] ?? "FIELD_ASSOCIATE"}
                    onChange={async (e) => {
                      if (!session) return;
                      const role = e.target.value as AppRole;
                      await supabase.from("user_roles").delete().eq("user_id", p.id);
                      const { error } = await supabase
                        .from("user_roles")
                        .insert({ user_id: p.id, role });
                      if (error) return flash(error.message);
                      await logQms({
                        orgId: session.orgId,
                        entryType: "System",
                        event: `Role for ${p.full_name} changed to ${ROLE_LABEL[role]}`,
                        actorId: session.userId,
                        actorName: session.fullName,
                      });
                      queryClient.invalidateQueries();
                      flash("Role updated");
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>
          System audit trail<small>LATEST 40 EVENTS</small>
        </h3>
        <div className="audit-list">
          {(audit ?? []).map((a) => (
            <div className="audit-row" key={a.id}>
              <span className="audit-time">{fmtDateTime(a.created_at)}</span>
              <span className="audit-body">
                <span className="audit-user">{a.actor_name ?? "System"}</span> — {a.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </AppShell>
  );
}
