import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SafetyCore" },
      {
        name: "description",
        content: "Sign in to SafetyCore, MedNova's pharmacovigilance case management platform.",
      },
      { property: "og:title", content: "Sign in — SafetyCore" },
      {
        property: "og:description",
        content: "Access ICSR intake, triage, signal detection and regulatory submissions.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(withEmail: string, withPassword: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: withEmail,
      password: withPassword,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="signin-overlay">
      <div className="signin-card">
        <div className="signin-brand">
          <span className="brand-mark">SC</span>
          <span className="brand-name">SafetyCore</span>
        </div>
        <h2>Sign in to continue</h2>
        <p className="sub">
          Sign in with your SafetyCore account. Access is role-based and every action is recorded.
        </p>

        {error && <div className="signin-error">{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void signIn(email, password);
          }}
        >
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn teal" style={{ width: "100%" }} disabled={busy} type="submit">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="signin-accounts">
          <div className="signin-accounts-title">Test accounts · password: password123</div>
          {[
            { role: "Field Associate", name: "A. Balogun", email: "field.rep@fidson.com" },
            { role: "PV Coordinator", name: "T. Okafor", email: "pv.coordinator@fidson.com" },
            { role: "PV Manager / QPPV", name: "F. Yusuf", email: "pv.manager@fidson.com" },
          ].map((a) => (
            <button
              key={a.email}
              type="button"
              className="signin-account"
              onClick={() => {
                setEmail(a.email);
                setPassword("password123");
              }}
            >
              <span className="signin-account-role">
                {a.role} · {a.name}
              </span>
              <span className="signin-account-email">{a.email}</span>
            </button>
          ))}
        </div>

        <div className="signin-foot">
          Access is logged. All actions in SafetyCore are recorded in an append-only audit trail in
          line with GxP and 21 CFR Part 11 expectations.
        </div>
      </div>
    </div>
  );
}
