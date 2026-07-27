import { createFileRoute, Link } from "@tanstack/react-router";
import { integrations } from "@/lib/integrations";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Get Started — Limeryx Solana Tracking" },
      {
        name: "description",
        content:
          "Set up Limeryx in three steps: connect your terminal, add Solana wallets and X lists, then watch the live feed.",
      },
      { property: "og:title", content: "Get Started — Limeryx Solana Tracking" },
      {
        property: "og:description",
        content: "Connect Axiom, Padre.gg or Photon, add wallets and X lists, go live.",
      },
    ],
  }),
  component: GetStarted,
});

const steps = [
  {
    n: "01",
    t: "PICK YOUR TERMINAL",
    d: "Limeryx routes every signal into the terminal you already trade on. Axiom, Padre.gg, Photon, BullX, GMGN or Jupiter — pick one, or wire up all of them.",
  },
  {
    n: "02",
    t: "ADD WALLETS + X LISTS",
    d: "Drop in Solana addresses to follow and paste the X lists you actually read. Limeryx pulls balances and signed transactions straight from mainnet and pins the posts beside them.",
  },
  {
    n: "03",
    t: "GO LIVE",
    d: "Your dashboard streams on-chain activity, network throughput and the daily top-trader leaderboard, refreshed continuously while the tab is open.",
  },
];

function GetStarted() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20">
      <p className="pixel-text text-[9px] text-primary">GET STARTED</p>
      <h1 className="mt-6 text-xl text-foreground sm:text-2xl">
        THREE STEPS TO LIVE<span className="blink text-primary">_</span>
      </h1>
      <p className="mt-6 max-w-2xl text-xl text-muted-foreground">
        No node to run, no indexer to babysit. Limeryx does the reading, you do the trading.
      </p>

      <ol className="mt-12 space-y-4">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className="panel rise-in flex flex-col gap-4 p-6 sm:flex-row"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="pixel-text text-lg text-primary sm:w-20">{s.n}</span>
            <div>
              <h2 className="text-xs text-foreground">{s.t}</h2>
              <p className="mt-3 text-lg text-muted-foreground">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14">
        <p className="pixel-text text-[9px] text-muted-foreground">SUPPORTED TERMINALS</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {integrations.map((i) => (
            <span key={i.name} className="panel flex items-center gap-3 px-4 py-3">
              <img src={i.logo} alt={`${i.name} logo`} className="h-6 w-6 object-contain" />
              <span className="pixel-text text-[9px] text-foreground">{i.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link
          to="/signup"
          className="pixel-text panel-glow bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
        >
          CREATE ACCOUNT
        </Link>
        <Link
          to="/dashboard"
          className="pixel-text border border-border px-6 py-4 text-[10px] text-foreground transition hover:border-primary hover:text-primary"
        >
          SKIP TO DASHBOARD
        </Link>
      </div>
    </div>
  );
}
