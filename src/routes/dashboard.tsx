import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNetworkStats, getTopTraders, getWallet } from "@/lib/solana.functions";
import { integrations } from "@/lib/integrations";
import { isSolanaAddress, useAccount } from "@/lib/wallet-store";


export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Limeryx Live Solana Feed" },
      {
        name: "description",
        content:
          "Live Solana dashboard: track any wallet's balance and transactions, watch network throughput and today's top traders from real on-chain blocks.",
      },
      { property: "og:title", content: "Dashboard — Limeryx Live Solana Feed" },
      {
        property: "og:description",
        content: "Real-time wallet tracking, X list feed and top traders on Solana.",
      },
    ],
  }),
  component: Dashboard,
});

const DEFAULT_WALLET = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

const xFeed = [
  { handle: "@solanafloor", list: "SOL CORE", text: "Network TPS holding above baseline through the session." },
  { handle: "@aeyakovenko", list: "SOL CORE", text: "Client diversity update shipping to mainnet validators." },
  { handle: "@JupiterExchange", list: "DEX FLOW", text: "Routing volume climbing on perps and spot pairs." },
  { handle: "@0xMert_", list: "SMART MONEY", text: "Watching fee payers rotate between two new mints." },
  { handle: "@blknoiz06", list: "SMART MONEY", text: "Size showing up on-chain before the timeline notices." },
];

function short(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h2 className="text-[10px] text-foreground">{title}</h2>
        {right}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function LiveTag() {
  return (
    <span className="pixel-text flex items-center gap-2 text-[7px] text-primary">
      <span className="live-dot inline-block h-2 w-2 bg-primary" /> LIVE
    </span>
  );
}

function ConnectGate() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="pixel-text text-[9px] text-primary">WALLET REQUIRED</p>
      <h1 className="mt-6 text-lg text-foreground">
        CONNECT TO CONTINUE<span className="blink text-primary">_</span>
      </h1>
      <p className="mt-6 text-lg text-muted-foreground">
        The dashboard tracks the wallet on your account. Create an account and connect a wallet address
        to unlock it.
      </p>
      <Link
        to="/signup"
        className="pixel-text mt-8 inline-block bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
      >
        CONNECT WALLET
      </Link>
    </div>
  );
}

function Dashboard() {
  const { account, ready, addWatch, removeWatch, signOut } = useAccount();

  const statsFn = useServerFn(getNetworkStats);
  const tradersFn = useServerFn(getTopTraders);
  const walletFn = useServerFn(getWallet);

  const [input, setInput] = useState("");
  const [address, setAddress] = useState(DEFAULT_WALLET);

  useEffect(() => {
    if (account?.wallet) setAddress(account.wallet);
  }, [account?.wallet]);

  const stats = useQuery({
    queryKey: ["network-stats"],
    queryFn: () => statsFn(),
    refetchInterval: 8_000,
  });
  const traders = useQuery({
    queryKey: ["top-traders"],
    queryFn: () => tradersFn(),
    refetchInterval: 30_000,
  });
  const wallet = useQuery({
    queryKey: ["wallet", address],
    queryFn: () => walletFn({ data: { address } }),
    refetchInterval: 15_000,
    retry: false,
    enabled: Boolean(account),
  });

  const fmt = (n: number | null | undefined, d = 2) =>
    n === null || n === undefined ? "····" : n.toLocaleString("en-US", { maximumFractionDigits: d });

  if (!ready) return <div className="px-4 py-24 text-center text-base text-muted-foreground">Loading…</div>;
  if (!account) return <ConnectGate />;

  const tracked = [account.wallet, ...account.watchlist].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="pixel-text text-[9px] text-primary">DASHBOARD</p>
          <h1 className="mt-4 text-lg text-foreground">
            LIVE FEED<span className="blink text-primary">_</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            {account.handle} · {account.wallet ? short(account.wallet) : "no wallet added"} ·{" "}
            {account.terminal}{" "}
            <button onClick={signOut} className="ml-2 text-primary underline">
              disconnect
            </button>
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          {[
            { l: "SOL", v: stats.data?.priceUsd ? `$${fmt(stats.data.priceUsd)}` : "····" },
            { l: "TPS", v: fmt(stats.data?.tps, 0) },
            { l: "SLOT", v: fmt(stats.data?.slot, 0) },
            { l: "EPOCH", v: fmt(stats.data?.epoch, 0) },
          ].map((s) => (
            <div key={s.l} className="panel px-4 py-2">
              <p className="pixel-text text-[7px] text-muted-foreground">{s.l}</p>
              <p className="pixel-text mt-2 text-[10px] text-primary">{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {/* WALLET TRACKER */}
        <div className="lg:col-span-2">
          <Card title="WALLET TRACKER" right={<LiveTag />}>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const a = input.trim();
                if (!a) return;
                addWatch(a);
                setAddress(a);
                setInput("");
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Add a Solana wallet address to track"
                className="w-full border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                className="pixel-text bg-primary px-5 py-3 text-[9px] text-primary-foreground transition hover:bg-accent"
              >
                ADD + TRACK
              </button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {tracked.map((w) => (
                <span
                  key={w}
                  className={`flex items-center gap-2 border px-3 py-2 ${
                    w === address ? "border-primary" : "border-border"
                  }`}
                >
                  <button
                    onClick={() => setAddress(w)}
                    className="pixel-text text-[7px] text-foreground hover:text-primary"
                  >
                    {w === account.wallet ? "MINE · " : ""}
                    {short(w)}
                  </button>
                  {w !== account.wallet && (
                    <button
                      onClick={() => {
                        removeWatch(w);
                        if (address === w) setAddress(account.wallet);
                      }}
                      aria-label={`Remove ${short(w)}`}
                      className="pixel-text text-[7px] text-destructive"
                    >
                      X
                    </button>
                  )}
                </span>
              ))}
            </div>


            {wallet.isError && (
              <p className="mt-4 text-base text-destructive">
                Could not read that address from mainnet. Check the address and try again.
              </p>
            )}

            {wallet.data && (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-6 border border-border bg-black/50 p-4">
                  <div>
                    <p className="pixel-text text-[7px] text-muted-foreground">ADDRESS</p>
                    <p className="mt-2 text-lg text-foreground">{short(wallet.data.address)}</p>
                  </div>
                  <div>
                    <p className="pixel-text text-[7px] text-muted-foreground">BALANCE</p>
                    <p className="mt-2 text-lg text-primary">{fmt(wallet.data.sol, 4)} SOL</p>
                  </div>
                  <div>
                    <p className="pixel-text text-[7px] text-muted-foreground">USD VALUE</p>
                    <p className="mt-2 text-lg text-foreground">
                      {stats.data?.priceUsd ? `$${fmt(wallet.data.sol * stats.data.priceUsd)}` : "····"}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 divide-y divide-border">
                  {wallet.data.activity.map((a) => (
                    <li key={a.signature} className="flex items-center justify-between gap-3 py-3">
                      <a
                        href={`https://solscan.io/tx/${a.signature}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="truncate text-base text-muted-foreground hover:text-primary"
                      >
                        {short(a.signature)}
                      </a>
                      <span className="text-base text-muted-foreground">slot {a.slot}</span>
                      <span
                        className={`pixel-text text-[7px] ${a.failed ? "text-destructive" : "text-success"}`}
                      >
                        {a.failed ? "FAILED" : "OK"}
                      </span>
                      <span className="hidden text-base text-muted-foreground sm:block">
                        {a.blockTime ? new Date(a.blockTime * 1000).toLocaleTimeString() : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {wallet.isPending && <p className="mt-4 text-base text-muted-foreground">Reading mainnet…</p>}
          </Card>
        </div>

        {/* X LISTS */}
        <Card title="X LISTS" right={<LiveTag />}>
          <ul className="space-y-4">
            {xFeed.map((p) => (
              <li key={p.handle} className="border-l-2 border-primary pl-3">
                <p className="pixel-text text-[7px] text-primary">{p.list}</p>
                <p className="mt-2 text-base text-foreground">{p.handle}</p>
                <p className="text-base text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* TOP TRADERS */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            title="DAILY TOP TRADERS"
            right={
              <span className="pixel-text text-[7px] text-muted-foreground">
                {traders.data ? `${traders.data.scannedTx} TX SCANNED` : "SCANNING…"}
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead>
                  <tr className="pixel-text text-[7px] text-muted-foreground">
                    <th className="pb-3">#</th>
                    <th className="pb-3">WALLET</th>
                    <th className="pb-3">TXS</th>
                    <th className="pb-3">FEES (SOL)</th>
                    <th className="pb-3">FAILED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(traders.data?.traders ?? []).map((t, i) => (
                    <tr key={t.address}>
                      <td className="py-3 text-primary">{i + 1}</td>
                      <td className="py-3">
                        <a
                          href={`https://solscan.io/account/${t.address}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-foreground hover:text-primary"
                        >
                          {short(t.address)}
                        </a>
                      </td>
                      <td className="py-3 text-muted-foreground">{t.txs}</td>
                      <td className="py-3 text-muted-foreground">{t.fees.toFixed(6)}</td>
                      <td className="py-3 text-muted-foreground">{t.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!traders.data && (
                <p className="py-4 text-base text-muted-foreground">Scanning finalized blocks…</p>
              )}
            </div>
          </Card>
        </div>

        <Card title="ROUTE ORDER TO">
          <div className="grid grid-cols-2 gap-2">
            {integrations.map((i) => (
              <a
                key={i.name}
                href={i.href}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 border border-border px-3 py-3 transition hover:border-primary"
              >
                <img src={i.logo} alt={`${i.name} logo`} className="h-5 w-5 object-contain" />
                <span className="pixel-text text-[7px] text-foreground">{i.name}</span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
