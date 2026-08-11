import { createFileRoute, Link } from "@tanstack/react-router";
import logoAsset from "@/assets/mednova-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafetyCore — Pharmacovigilance Platform | MedNova Lifesciences" },
      {
        name: "description",
        content:
          "SafetyCore is MedNova's ICH E2B(R3)-compliant pharmacovigilance platform for ICSR intake, signal detection, aggregate reporting and regulatory submission across Nigeria and West Africa.",
      },
      { property: "og:title", content: "SafetyCore — Enterprise Pharmacovigilance Platform" },
      {
        property: "og:description",
        content:
          "ICSR intake, triage, MedDRA coding, E2B(R3) submissions, signal detection and aggregate reporting — built for African regulatory realities.",
      },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  ["ICSR intake, triage & coding", "Case intake, triage, and MedDRA / WHO-DD coding in one workflow."],
  ["Narrative writing support", "Structured tools to draft and standardize case narratives."],
  [
    "E2B(R3) electronic submissions",
    "Direct electronic submission to regulatory gateways in E2B(R3) format.",
  ],
  ["Aggregate reporting", "PSUR / PBRER / DSUR generation, built from your live case data."],
  ["Signal detection & validation", "Ongoing signal detection with a structured validation workflow."],
  ["Executive dashboards", "Real-time visibility into case status and compliance tracking."],
  ["WhatsApp intake", "Capture spontaneous reports where reporters already are, with NDPR consent."],
  ["QMS / SOP integration", "Reflects your existing safety governance rather than forcing a new one."],
];

const WHY = [
  [
    "01",
    "Platform and people, aligned",
    "Built by the same team that runs your PV operations, so the platform and the people are already aligned rather than handed off between vendors.",
  ],
  [
    "02",
    "African regulatory realities, from day one",
    "Configured for African regulatory realities from the start, rather than adapted from a US/EU system after the fact.",
  ],
  [
    "03",
    "Integrated across the lifecycle",
    "Connected to MedNova's Regulatory Affairs and Clinical Development services, so safety data links directly to registration and trial-safety workflows.",
  ],
  [
    "04",
    "Flexible deployment",
    "From a fully managed service to a self-administered licensed instance for teams that want to run it in-house.",
  ],
];

function Landing() {
  return (
    <div>
      <header className="mk-header">
        <div className="mk-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div className="brand" style={{ padding: 0 }}>
            <img src={logoAsset.url} alt="MedNova Lifesciences" className="brand-logo" />
          </div>
          <Link to="/auth" className="btn">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mk-hero">
        <div className="mk-wrap">
          <div className="eyebrow">Pharmacovigilance Technology</div>
          <h1>Enterprise-grade drug safety, built for African regulatory realities.</h1>
          <p>
            MedNova SafetyCore is our ICH E2B(R3)-compliant case management platform — the same
            system our pharmacovigilance team uses to run ICSR intake, aggregate reporting, and
            regulatory submissions for clients across Nigeria and West Africa, now available as a
            standalone platform for sponsors and Marketing Authorization Holders who want direct
            visibility into their own safety data.
          </p>
          <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/auth" className="btn primary">
              Open SafetyCore
            </Link>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-wrap">
          <div className="eyebrow">What it does</div>
          <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, margin: "12px 0 6px" }}>
            Core capabilities
          </h2>
          <p style={{ color: "#8a9186", fontSize: 14, lineHeight: 1.7 }}>
            A single system covering intake through submission — configured to reflect how your
            safety team already works.
          </p>
          <div className="mk-grid">
            {CAPABILITIES.map(([h, p]) => (
              <div className="mk-card" key={h}>
                <h4>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-wrap">
          <div className="eyebrow">Why MedNova SafetyCore</div>
          <h2 className="serif" style={{ fontSize: 26, fontWeight: 500, margin: "12px 0 6px" }}>
            Built by the team that runs your safety operations
          </h2>
          <div className="mk-grid">
            {WHY.map(([n, h, p]) => (
              <div className="mk-card" key={n}>
                <div className="eyebrow">{n}</div>
                <h4 style={{ marginTop: 8 }}>{h}</h4>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mk-foot">
        <div className="mk-wrap">© 2026 MedNova Lifesciences. Lagos, Nigeria.</div>
      </footer>
    </div>
  );
}
