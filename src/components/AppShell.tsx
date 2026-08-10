import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { ROLE_LABEL, fmtDateTime, initialsOf, type AppRole } from "@/lib/pv";

type NavItem = { to: string; label: string; roles?: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/cases", label: "Case Workbench" },
  { to: "/intake", label: "New ICSR Intake" },
  {
    to: "/whatsapp",
    label: "WhatsApp Intake",
    roles: ["PV_COORDINATOR", "PV_MANAGER", "ADMIN"],
  },
  { to: "/signals", label: "Signal Detection", roles: ["PV_COORDINATOR", "PV_MANAGER", "ADMIN"] },
  { to: "/reports", label: "Aggregate Reports", roles: ["PV_COORDINATOR", "PV_MANAGER", "ADMIN"] },
  { to: "/qms", label: "QMS / SOP Log" },
  { to: "/admin", label: "Administration", roles: ["ADMIN"] },
];

function GlobalSearch() {
  const [term, setTerm] = useState("");
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["search", term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const q = term.trim();
      const { data } = await supabase
        .from("cases")
        .select("id, case_number, product_name, meddra_term, status")
        .or(`case_number.ilike.%${q}%,product_name.ilike.%${q}%,meddra_term.ilike.%${q}%`)
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        placeholder="Search cases…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Search cases"
      />
      {term.trim().length >= 2 && (
        <div className="search-drop">
          {(data ?? []).length === 0 ? (
            <div className="notif-empty">No matches</div>
          ) : (
            (data ?? []).map((c) => (
              <button
                key={c.id}
                className="search-result"
                onClick={() => {
                  setTerm("");
                  navigate({ to: "/cases/$caseId", params: { caseId: c.id } });
                }}
              >
                <span className="mono">{c.case_number}</span>
                <span className="sub">
                  {c.product_name} · {c.meddra_term ?? "Uncoded"} · {c.status}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Notifications({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = (data ?? []).filter((n) => !n.read).length;

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        className="btn notif-bell"
        onClick={async () => {
          setOpen((v) => !v);
          if (!open && unread) {
            await supabase
              .from("notifications")
              .update({ read: true })
              .eq("user_id", userId)
              .eq("read", false);
            queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
          }
        }}
        aria-label="Notifications"
      >
        Alerts
        {unread > 0 && <span className="notif-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {(data ?? []).length === 0 ? (
            <div className="notif-empty">Nothing new</div>
          ) : (
            (data ?? []).map((n) => (
              <div key={n.id} className="notif-item">
                <span className="notif-item-label">{n.message}</span>
                <span className="notif-item-sub">
                  {n.type} · {fmtDateTime(n.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = session?.role;

  const items = NAV.filter((n) => !n.roles || (role && n.roles.includes(role)));

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SC</span>
          <span className="brand-name">SafetyCore</span>
        </div>
        <div className="env-tag">Validated · GxP</div>
        <nav className="nav">
          {items.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`nav-item${pathname.startsWith(n.to) ? " active" : ""}`}
            >
              <span className="dot" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          MedNova Lifesciences
          <br />
          Lagos, Nigeria
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {actions}
            <GlobalSearch />
            {session && <Notifications userId={session.userId} />}
            {session && (
              <div className="account-chip">
                <div className="account-avatar">{initialsOf(session.fullName)}</div>
                <div className="account-info">
                  <span className="account-name">{session.fullName}</span>
                  <span className="account-role">{ROLE_LABEL[session.role]}</span>
                </div>
              </div>
            )}
            <button className="btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
