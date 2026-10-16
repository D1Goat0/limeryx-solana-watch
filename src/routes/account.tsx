import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Gift, ShieldCheck, UserRound } from "lucide-react";
import {
  login,
  signup,
  logout,
  updateUser,
  requestPasswordRecovery,
  MissingIdentityError,
} from "@netlify/identity";
import { useMember } from "@/lib/member-auth";
import { REFERRAL_PATTERN, validReferral } from "@/lib/referrals";
import { isSolanaAddress, saveAccount, useAccount } from "@/lib/wallet-store";
import { integrations } from "@/lib/integrations";
import { sessionRequest } from "@/lib/member-session";

export const Route = createFileRoute("/account")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { ref?: string; mode?: "login"; recovery?: "1" } => ({
    ref:
      typeof search.ref === "string" && REFERRAL_PATTERN.test(search.ref.toLowerCase())
        ? search.ref.toLowerCase()
        : undefined,
    mode: search.mode === "login" ? "login" : undefined,
    recovery: search.recovery === "1" ? "1" : undefined,
  }),
  head: () => ({
    meta: [{ title: "Your account | Limeryx" }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

export function AccountPage() {
  const { ref, mode: initialMode, recovery } = Route.useSearch();
  const { user, ready, profileReady, profileError, linkedAccount, error: authError } = useMember();
  const { account: cachedAccount } = useAccount();
  const account = cachedAccount || linkedAccount;
  const navigate = useNavigate();
  const prepared = useRef<{ value: string; id: string } | null>(null);
  const [mode, setMode] = useState<"signup" | "login">(initialMode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wallet, setWallet] = useState("");
  const [limeKey, setLimeKey] = useState("");
  const [referral, setReferral] = useState(ref ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (
      user &&
      profileReady &&
      account &&
      !recovery &&
      account.email.toLowerCase() === user.email?.toLowerCase()
    )
      void navigate({ to: "/dashboard", replace: true });
  }, [user?.id, user?.email, profileReady, account, recovery, navigate]);
  useEffect(() => {
    if (initialMode === "login") setMode("login");
  }, [initialMode]);
  useEffect(() => {
    try {
      if (ref) {
        setReferral(ref);
        sessionStorage.setItem(
          "limeryx.member-referral",
          JSON.stringify({ code: ref, time: Date.now() }),
        );
      } else {
        const stored = JSON.parse(sessionStorage.getItem("limeryx.member-referral") || "null");
        if (
          stored &&
          REFERRAL_PATTERN.test(stored.code) &&
          Date.now() - stored.time < 7 * 86400_000
        )
          setReferral(stored.code);
      }
    } catch {
      /* Referral entry still works when browser storage is disabled. */
    }
  }, [ref]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        if (!isSolanaAddress(wallet))
          throw new Error("Enter a valid Solana wallet address to track.");
        if (!limeKey.trim()) throw new Error("A Lime Key is required to create an account.");
        const code = referral.trim().toLowerCase();
        if (code && !(await validReferral(code)))
          throw new Error(
            "That referral code was not found. Check it with the person who invited you.",
          );
        const account = {
          handle: "@degen",
          email: email.trim(),
          limeKey: limeKey.trim(),
          terminal: integrations[0].name,
          wallet: wallet.trim(),
          watchlist: [],
        };
        const value = JSON.stringify(account);
        if (prepared.current?.value !== value) {
          const { id } = await sessionRequest<{ id: string }>("prepare", account);
          prepared.current = { value, id };
        }
        // Persist setup before registration; only an opaque receipt enters Identity metadata.
        const createdUser = await signup(email.trim(), password, {
          limeryx_member: true,
          referral_code: code || null,
          bot_setup_id: prepared.current.id,
        });
        try {
          saveAccount(account);
        } catch {
          // Identity registration still succeeds when browser storage is disabled.
        }
        setLimeKey("");
        try {
          sessionStorage.removeItem("limeryx.member-referral");
        } catch {
          /* Storage may be disabled. */
        }
        if (!createdUser.confirmedAt) {
          setMode("login");
          setMessage(
            "Check your email to confirm your account, then sign in. If you already have an account, use Sign in.",
          );
        }
      } else {
        await login(email.trim(), password);
      }
      setPassword("");
    } catch (cause) {
      setError(
        cause instanceof MissingIdentityError
          ? "Account registration is not enabled yet. Please try again shortly."
          : cause instanceof Error
            ? cause.message
            : "Could not complete your request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2 md:items-center md:py-24">
      <section>
        <p className="eyebrow">YOUR EDGE STARTS HERE</p>
        <h1 className="mt-6 text-2xl leading-relaxed sm:text-3xl">
          One account.
          <br />
          <span className="text-primary">More signal.</span>
        </h1>
        <p className="mt-6 max-w-md text-xl text-muted-foreground">
          Your place for account access, referral links, and SOL rewards. Keep your trading workflow
          close and your network closer.
        </p>
        <div className="mt-10 space-y-5">
          {[
            [UserRound, "Your own account", "Sign in with your email and password."],
            [Gift, "Grow your circle", "Share a personal link and track your referrals."],
            [
              ShieldCheck,
              "Rewards you can follow",
              "See pending, claimable, and paid SOL in one place.",
            ],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Gift;
            return (
              <div key={String(title)} className="flex gap-4">
                <FeatureIcon aria-hidden className="mt-1 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-foreground">{String(title)}</p>
                  <p className="text-base text-muted-foreground">{String(text)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel panel-glow p-6 sm:p-9">
        {!ready || (user && !profileReady && !recovery) ? (
          <p role="status">Loading your account...</p>
        ) : user && recovery ? (
          <PasswordReset />
        ) : user ? (
          <div className="space-y-6">
            <CheckCircle2 aria-hidden className="h-9 w-9 text-primary" />
            <h2 className="text-lg">You're signed in.</h2>
            <p className="break-all text-muted-foreground">{user.email}</p>
            <Link to="/referrals" className="action-primary w-full">
              Open referral rewards <ArrowRight size={16} />
            </Link>
            <Link to="/dashboard" className="action-secondary w-full">
              Open dashboard
            </Link>
            <Link
              to="/signup"
              className="block text-center text-base text-muted-foreground underline hover:text-primary"
            >
              Continue bot setup
            </Link>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await logout();
                } catch {
                  setError("Could not sign out. Please try again.");
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full text-base text-muted-foreground underline disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <div className="mb-7 grid grid-cols-2 border border-border p-1">
              {(["signup", "login"] as const).map((tab) => (
                <button
                  key={tab}
                  disabled={busy}
                  onClick={() => {
                    setMode(tab);
                    setError("");
                    setMessage("");
                  }}
                  className={`pixel-text px-2 py-3 text-[9px] transition ${mode === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}
                </button>
              ))}
            </div>
            <h2 className="text-base">
              {mode === "signup" ? "Welcome to Limeryx." : "Welcome back."}
            </h2>
            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="field-label">
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="you@example.com"
                />
              </label>
              <label className="field-label">
                Password
                <input
                  required
                  type="password"
                  minLength={mode === "signup" ? 12 : 1}
                  maxLength={128}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  placeholder={mode === "signup" ? "At least 12 characters" : "Your password"}
                />
              </label>
              {mode === "signup" && (
                <>
                  <label className="field-label">
                    PUBLIC WALLET
                    <input
                      required
                      value={wallet}
                      onChange={(event) => setWallet(event.target.value)}
                      placeholder="Paste a wallet address to track"
                      className="field-input font-mono"
                      spellCheck={false}
                      autoCapitalize="none"
                    />
                    <span className="mt-2 block text-sm font-normal text-muted-foreground">
                      Required — tracking only ever reads mainnet.
                    </span>
                  </label>
                  <label className="field-label">
                    Private Key
                    <input
                      required
                      value={limeKey}
                      onChange={(event) => setLimeKey(event.target.value)}
                      placeholder="Your Limeryx platform identifier"
                      className="field-input"
                      spellCheck={false}
                      autoCapitalize="none"
                      autoComplete="off"
                    />
                    <span className="mt-2 block text-sm font-normal text-muted-foreground">
                      Required — your Private Key-issued platform identifier. This is used for
                      signing transactions
                    </span>
                  </label>
                </>
              )}
              {mode === "signup" && (
                <label className="field-label">
                  Referral code <span className="text-muted-foreground">(optional)</span>
                  <input
                    value={referral}
                    maxLength={16}
                    onChange={(e) => setReferral(e.target.value)}
                    className="field-input font-mono"
                    placeholder="Your friend's code"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                  <span className="mt-2 block text-sm font-normal text-muted-foreground">
                    Applied when you create your account. Rewards follow the active program rules.
                  </span>
                </label>
              )}
              <button
                disabled={busy || Boolean(authError)}
                className="action-primary w-full"
                type="submit"
              >
                {busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
                <ArrowRight aria-hidden size={16} />
              </button>
            </form>
            {mode === "login" && (
              <button
                type="button"
                disabled={busy}
                className="mt-5 text-base text-primary underline disabled:opacity-50"
                onClick={async () => {
                  if (!email.trim()) {
                    setError("Enter your email above to request a password reset.");
                    return;
                  }
                  setBusy(true);
                  setError("");
                  setMessage("");
                  try {
                    await requestPasswordRecovery(email.trim());
                    setMessage(
                      "If an account exists for that email, a password reset link will arrive shortly.",
                    );
                  } catch {
                    setError("Could not request a reset link. Please try again shortly.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Forgot password?
              </button>
            )}
            <p className="mt-6 text-center text-base text-muted-foreground">
              Looking for your bot setup?{" "}
              <Link to="/signup" className="text-primary underline">
                Continue here
              </Link>
            </p>
          </>
        )}
        {(error || authError) && (
          <p role="alert" className="mt-5 text-base text-destructive">
            {error || authError}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 border border-primary/30 bg-primary/5 p-4 text-base text-primary"
          >
            {message}
          </p>
        )}
        {profileError && (
          <p role="alert" className="mt-5 text-base text-destructive">
            {profileError}
          </p>
        )}
      </section>
    </div>
  );
}

function PasswordReset() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        if (password !== confirmation) {
          setError("Passwords don't match.");
          return;
        }
        setBusy(true);
        setError("");
        try {
          await updateUser({ password });
          window.location.replace("/account");
        } catch {
          setError(
            "Could not update your password. Please request a fresh reset link and try again.",
          );
          setBusy(false);
        }
      }}
    >
      <h2 className="text-base">Set a new password</h2>
      <label className="field-label">
        New password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field-input"
        />
      </label>
      <label className="field-label">
        Confirm new password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="field-input"
        />
      </label>
      <button type="submit" className="action-primary w-full" disabled={busy}>
        {busy ? "Updating..." : "Update password"}
      </button>
      {error && (
        <p role="alert" className="text-base text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
