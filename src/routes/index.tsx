import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Crosshair,
  Gift,
  Radio,
  Users,
  Wallet,
} from "lucide-react";
import { getNetworkStats } from "@/lib/solana.functions";
import { integrations } from "@/lib/integrations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Limeryx | Solana wallets. X signals. One screen." },
      {
        name: "description",
        content:
          "Follow Solana wallets, watch X lists, and track on-chain activity in one trading workspace. Invite your circle with Limeryx referrals.",
      },
      { property: "og:title", content: "Limeryx | Follow the flow." },
      {
        property: "og:description",
        content: "Solana wallet tracking, X list feeds, and referral rewards in one workspace.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const stats = useServerFn(getNetworkStats);
  const { data, isError } = useQuery({
    queryKey: ["network-stats"],
    queryFn: () => stats(),
    refetchInterval: 10_000,
  });
  const fmt = (n: number | null | undefined, digits = 2) =>
    n == null ? "--" : n.toLocaleString("en-US", { maximumFractionDigits: digits });

  return (
    <div className="landing-page mx-auto max-w-6xl px-4">
      <section className="grid gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-10 lg:py-24">
        <div className="rise-in">
          <span className="pixel-text inline-flex items-center gap-3 border border-primary/25 bg-primary/5 px-3 py-2 text-[8px] text-primary">
            <span aria-hidden className="h-1.5 w-1.5 bg-primary" />
            BUILT FOR SOLANA TRADERS
          </span>
          <h1 className="hero-title mt-7">
            Find the signal.
            <br />
            <span className="text-primary">Follow the flow.</span>
          </h1>
          <p className="mt-6 max-w-lg text-2xl leading-relaxed text-muted-foreground">
            Wallets on-chain. Conversations on X. Your next move starts with seeing them together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/account" className="action-primary">
              Create account <ArrowRight aria-hidden size={16} />
            </Link>
            <Link to="/dashboard" className="action-secondary">
              Open dashboard <ArrowUpRight aria-hidden size={16} />
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-base text-muted-foreground">
            <span className="flex items-center gap-2">
              <Activity aria-hidden size={13} className="text-primary" />
              Mainnet data
            </span>
            <span className="flex items-center gap-2">
              <Radio aria-hidden size={13} className="text-primary" />
              Live wallet & X feeds
            </span>
          </div>
        </div>
        <div className="panel signal-grid relative overflow-hidden border-primary/30 p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="pixel-text flex items-center gap-2 text-[8px]">
              <Crosshair aria-hidden size={15} className="text-primary" />
              THE SIGNAL DESK
            </div>
            <span className="text-sm text-muted-foreground">WORKSPACE PREVIEW</span>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
              <Wallet aria-hidden size={19} />
            </span>
            <div>
              <p className="text-xl">Your watchlist, in focus.</p>
              <p className="text-base text-muted-foreground">Solana wallets + X lists</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              {
                icon: Wallet,
                title: "Wallet activity",
                description: "Balances and signed transactions",
                tag: "ON-CHAIN",
              },
              {
                icon: Radio,
                title: "X list feed",
                description: "The conversations you follow",
                tag: "SOCIAL",
              },
              {
                icon: Users,
                title: "Top traders",
                description: "Explore active wallets on mainnet",
                tag: "DISCOVER",
              },
            ].map(({ icon: Icon, title, description, tag }) => (
              <div
                key={title}
                className="flex items-center gap-3 border border-border bg-black/70 px-3 py-4 sm:px-4"
              >
                <Icon aria-hidden size={17} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <span className="pixel-text hidden text-[6px] text-primary sm:block">{tag}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="text-base text-muted-foreground">
              Less tab switching. More context.
            </span>
            <ArrowUpRight aria-hidden size={17} className="shrink-0 text-primary" />
          </div>
        </div>
      </section>
      <section
        aria-label="Solana market and network data"
        className="grid grid-cols-2 divide-x divide-y divide-border border border-border bg-black/65 sm:grid-cols-4 sm:divide-y-0"
      >
        {[
          { label: "SOL / USD", value: data?.priceUsd ? `$${fmt(data.priceUsd)}` : "--" },
          {
            label: "24H CHANGE",
            value:
              data?.change24h != null
                ? `${data.change24h > 0 ? "+" : ""}${fmt(data.change24h)}%`
                : "--",
          },
          { label: "NETWORK TPS", value: fmt(data?.tps, 0) },
          { label: "CURRENT SLOT", value: fmt(data?.slot, 0) },
        ].map(({ label, value }) => (
          <div key={label} className="min-w-0 px-4 py-5 sm:px-6">
            <p className="pixel-text text-[7px] text-muted-foreground">{label}</p>
            <p className="mt-3 break-all font-mono text-lg text-primary sm:text-2xl">{value}</p>
          </div>
        ))}
      </section>
      {isError && (
        <p className="mt-2 text-sm text-muted-foreground">
          Network data is temporarily unavailable.
        </p>
      )}
      <section className="py-12">
        <p className="pixel-text text-center text-[8px] text-muted-foreground">
          ALONGSIDE THE TERMINALS YOU ALREADY USE
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-x-8 gap-y-5 sm:justify-between">
          {integrations.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground transition hover:text-primary"
            >
              <img src={item.logo} alt="" className="h-6 w-6 object-contain" />
              <span className="pixel-text text-[8px]">{item.name}</span>
            </a>
          ))}
        </div>
      </section>
      <section className="border-t border-border py-14 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">A CLEARER VIEW OF THE MARKET</p>
            <h2 className="mt-5 text-lg sm:text-xl">
              All your signals.
              <br />
              <span className="text-muted-foreground">One place to watch.</span>
            </h2>
          </div>
          <Link to="/get-started" className="inline-flex items-center gap-2 text-base text-primary">
            How it works <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Wallet,
              number: "01",
              title: "WALLET TRACKING",
              text: "Follow public Solana addresses. Read balances and signed transactions straight from mainnet.",
            },
            {
              icon: Radio,
              number: "02",
              title: "X LISTS LIVE",
              text: "Keep your X lists beside wallet activity, so the conversation stays close to the on-chain context.",
            },
            {
              icon: Crosshair,
              number: "03",
              title: "TRADER DISCOVERY",
              text: "Explore active fee payers from finalized blocks and find the wallets worth a closer look.",
            },
          ].map(({ icon: Icon, number, title, text }) => (
            <article
              key={title}
              className="panel group p-6 transition hover:border-primary/50 sm:p-7"
            >
              <div className="flex items-center justify-between">
                <Icon aria-hidden size={23} className="text-primary" />
                <span className="pixel-text text-[8px] text-muted-foreground">{number}</span>
              </div>
              <h3 className="mt-8 text-[10px]">{title}</h3>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel panel-glow relative my-4 overflow-hidden p-6 sm:p-10">
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p className="eyebrow flex items-center gap-3">
              <Gift aria-hidden size={16} />
              LIMERYX REFERRALS
            </p>
            <h2 className="mt-5 text-lg sm:text-xl">
              Trading is better
              <br />
              <span className="text-primary">with your circle.</span>
            </h2>
            <p className="mt-5 max-w-lg text-xl text-muted-foreground">
              Get your personal invite link. Follow your referrals and see every stage of your SOL
              rewards, from review to payout.
            </p>
          </div>
          <div className="border-l-2 border-primary/50 pl-6">
            <p className="text-xl">Your network, connected.</p>
            <p className="mt-3 text-base text-muted-foreground">
              Create an account to see the program status, reward rules, and your referral activity.
            </p>
            <Link to="/referrals" className="action-primary mt-6">
              Explore referrals <ArrowRight aria-hidden size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="flex flex-col items-center py-16 text-center sm:py-24">
        <p className="eyebrow">LESS NOISE. MORE CONTEXT.</p>
        <h2 className="mt-6 text-lg sm:text-xl">Keep your eyes on the flow.</h2>
        <p className="mt-5 max-w-xl text-xl text-muted-foreground">
          Build your watchlist and put the signals that matter in one workspace.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/account" className="action-primary">
            Create account <ArrowRight aria-hidden size={16} />
          </Link>
          <Link to="/signup" className="action-secondary">
            Bot setup
          </Link>
        </div>
      </section>
    </div>
  );
}
