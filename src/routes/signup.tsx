import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { integrations } from "@/lib/integrations";
import { isSolanaAddress, saveAccount } from "@/lib/wallet-store";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — Limeryx" },
      {
        name: "description",
        content:
          "Create your Limeryx account and connect a Solana wallet address to track wallets and X lists live.",
      },
      { property: "og:title", content: "Sign Up — Limeryx" },
      {
        property: "og:description",
        content: "Create a Limeryx account and connect a wallet to start tracking Solana in real time.",
      },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [terminal, setTerminal] = useState(integrations[0].name);
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [error, setError] = useState<string | null>(null);


  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-20">
      <p className="pixel-text text-[9px] text-primary">SIGN UP</p>
      <h1 className="mt-6 text-xl text-foreground">
        CREATE ACCOUNT<span className="blink text-primary">_</span>
      </h1>

      <form
        className="panel panel-glow mt-10 space-y-6 p-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (!walletOk) {
            setError("Connect a wallet or paste a valid Solana address to continue.");
            return;
          }
          saveAccount({ handle: handle || "@degen", terminal, wallet: wallet.trim(), watchlist: [] });
          navigate({ to: "/dashboard" });
        }}
      >
        <label className="block">
          <span className="pixel-text text-[8px] text-muted-foreground">HANDLE</span>
          <input
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@degen"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="pixel-text text-[8px] text-muted-foreground">EMAIL</span>
          <input
            required
            type="email"
            placeholder="you@limeryx.xyz"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="pixel-text text-[8px] text-muted-foreground">CONNECT WALLET</span>
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Paste your Solana wallet address"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Public address only. Limeryx never asks for a private key or seed phrase — tracking reads
            mainnet, it never needs to spend. Any site that asks for your secret key can drain you.
          </p>
          {wallet && !walletOk && (
            <p className="mt-2 text-sm text-destructive">That doesn&apos;t look like a Solana address.</p>
          )}
        </div>

        <div>
          <span className="pixel-text text-[8px] text-muted-foreground">DEFAULT TERMINAL</span>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {integrations.map((i) => (
              <button
                key={i.name}
                type="button"
                onClick={() => setTerminal(i.name)}
                className={`flex flex-col items-center gap-2 border px-2 py-3 transition ${
                  terminal === i.name
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground"
                }`}
              >
                <img src={i.logo} alt={`${i.name} logo`} className="h-6 w-6 object-contain" />
                <span className="pixel-text text-[7px] text-foreground">{i.name}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-base text-destructive">{error}</p>}

        <button
          type="submit"
          className="pixel-text w-full bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent disabled:opacity-50"
        >
          CONNECT & CREATE ACCOUNT
        </button>
        <p className="text-center text-base text-muted-foreground">
          Already tracking?{" "}
          <Link to="/dashboard" className="text-primary underline">
            Open dashboard
          </Link>
        </p>
      </form>
    </div>
  );
}
