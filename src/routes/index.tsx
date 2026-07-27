import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNetworkStats } from "@/lib/solana.functions";
import { integrations } from "@/lib/integrations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Limeryx — Track Solana Wallets & X Lists Live" },
      {
        name: "description",
        content:
          "Limeryx streams Solana wallet activity and X lists in real time, ranks daily top traders from on-chain data, and works with Axiom, Padre.gg, Photon and more.",
      },
      { property: "og:title", content: "Limeryx — Track Solana Wallets & X Lists Live" },
      {
        property: "og:description",
        content: "Real-time Solana wallet tracking, live X lists, daily top traders.",
      },
    ],
  }),
  component: Home,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel px-4 py-3">
      <p className="pixel-text text-[8px] text-muted-foreground">{label}</p>
      <p className="mt-2 font-[var(--font-pixel)] text-sm text-primary">{value}</p>
    </div>
  );
}

function Home() {
  const stats = useServerFn(getNetworkStats);
  const { data } = useQuery({
    queryKey: ["network-stats"],
    queryFn: () => stats(),
    refetchInterval: 10_000,
  });

  const fmt = (n: number | null | undefined, d = 2) =>
    n === null || n === undefined ? "····" : n.toLocaleString("en-US", { maximumFractionDigits: d });

  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* HERO */}
      <section className="rise-in flex flex-col items-center py-20 text-center sm:py-28">
        <span className="pixel-text flex items-center gap-2 border border-border bg-black/60 px-3 py-2 text-[8px] text-muted-foreground">
          <span className="live-dot inline-block h-2 w-2 bg-primary" />
          LIVE ON SOLANA MAINNET
        </span>
        <h1 className="mt-8 max-w-3xl text-2xl leading-relaxed text-foreground sm:text-4xl">
          TRACK WALLETS <span className="text-primary">&</span> X LISTS
          <br />
          IN <span className="text-primary">REAL TIME</span>
          <span className="blink text-primary">_</span>
        </h1>
        <p className="mt-8 max-w-2xl text-xl text-muted-foreground">
          Limeryx watches Solana on-chain flow and your X lists on one screen. Every buy, every
          call, every rotation — the second it happens.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/get-started"
            className="pixel-text panel-glow bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
          >
            GET STARTED
          </Link>
          <Link
            to="/dashboard"
            className="pixel-text border border-border px-6 py-4 text-[10px] text-foreground transition hover:border-primary hover:text-primary"
          >
            VIEW LIVE DEMO
          </Link>
        </div>

        <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="SOL / USD" value={data?.priceUsd ? `$${fmt(data.priceUsd)}` : "····"} />
          <Stat
            label="24H CHANGE"
            value={data?.change24h != null ? `${data.change24h > 0 ? "+" : ""}${fmt(data.change24h)}%` : "····"}
          />
          <Stat label="NETWORK TPS" value={fmt(data?.tps, 0)} />
          <Stat label="SLOT" value={fmt(data?.slot, 0)} />
        </div>
      </section>

      {/* TICKER */}
      <section className="overflow-hidden border-y border-border bg-black/70 py-4">
        <div className="ticker-track flex w-max gap-10 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-10">
              {integrations.map((i) => (
                <span key={i.name} className="pixel-text flex items-center gap-3 text-[9px] text-muted-foreground">
                  <img src={i.logo} alt={`${i.name} logo`} className="h-5 w-5 object-contain" />
                  {i.name.toUpperCase()}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="grid gap-4 py-20 md:grid-cols-3">
        {[
          {
            t: "WALLET TRACKING",
            d: "Paste any Solana address and stream its balance and signed transactions live, straight from mainnet RPC.",
          },
          {
            t: "X LISTS LIVE",
            d: "Attach your X lists and watch calls land next to the on-chain fill, timestamped to the same second.",
          },
          {
            t: "DAILY TOP TRADERS",
            d: "A leaderboard built by scanning finalized blocks and ranking the fee payers moving the most flow today.",
          },
        ].map((f, idx) => (
          <article
            key={f.t}
            className="panel rise-in p-6 transition hover:panel-glow"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <h2 className="text-xs text-primary">{f.t}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{f.d}</p>
          </article>
        ))}
      </section>

      {/* INTEGRATIONS */}
      <section className="py-10">
        <h2 className="text-center text-base text-foreground">
          WORKS WITH <span className="text-primary">AXIOM</span>, PADRE.GG, PHOTON
          <br className="hidden sm:block" /> AND MORE
        </h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {integrations.map((i) => (
            <a
              key={i.name}
              href={i.href}
              target="_blank"
              rel="noreferrer noopener"
              className="panel flex items-start gap-4 p-5 transition hover:panel-glow"
            >
              <img
                src={i.logo}
                alt={`${i.name} official logo`}
                className="h-9 w-9 shrink-0 object-contain"
                loading="lazy"
              />
              <div>
                <p className="pixel-text text-[10px] text-foreground">{i.name}</p>
                <p className="mt-2 text-base text-muted-foreground">{i.blurb}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="panel panel-glow my-16 flex flex-col items-center gap-6 p-10 text-center">
        <h2 className="text-base text-foreground">
          READY TO SEE THE <span className="text-primary">FLOW</span>?
        </h2>
        <p className="max-w-xl text-lg text-muted-foreground">
          Three steps: connect your feeds, pick your wallets, watch it move.
        </p>
        <Link
          to="/get-started"
          className="pixel-text bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
        >
          GET STARTED
        </Link>
      </section>
    </div>
  );
}
