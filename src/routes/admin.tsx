import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAccount } from "@/lib/wallet-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Limeryx" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Admin,
});

const SESSION_KEY = "limeryx.admin";
const ADMIN_USER = "me";
const ADMIN_PASS = "admin";

function Admin() {
  const [signedIn, setSignedIn] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1",
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <p className="pixel-text text-[9px] text-primary">ADMIN</p>
      <h1 className="mt-6 text-xl text-foreground">
        USER MANAGEMENT<span className="blink text-primary">_</span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Demo-only panel. This check runs in the browser and is visible in the page source — it isn't
        real access control. It also only ever shows the account saved on the device viewing it, since
        Limeryx doesn't have a backend collecting every signup.
      </p>

      {signedIn ? (
        <AdminPanel onSignOut={() => setSignedIn(false)} />
      ) : (
        <AdminLogin onSignIn={() => setSignedIn(true)} />
      )}
    </div>
  );
}

function AdminLogin({ onSignIn }: { onSignIn: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel panel-glow mt-10 max-w-sm space-y-6 p-7"
      onSubmit={(e) => {
        e.preventDefault();
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
          sessionStorage.setItem(SESSION_KEY, "1");
          onSignIn();
        } else {
          setError("Incorrect username or password.");
        }
      }}
    >
      <label className="block">
        <span className="pixel-text text-[8px] text-muted-foreground">USERNAME</span>
        <input
          required
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
        />
      </label>
      <label className="block">
        <span className="pixel-text text-[8px] text-muted-foreground">PASSWORD</span>
        <input
          required
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
        />
      </label>
      {error && <p className="text-base text-destructive">{error}</p>}
      <button
        type="submit"
        className="pixel-text w-full bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
      >
        SIGN IN
      </button>
    </form>
  );
}

function AdminPanel({ onSignOut }: { onSignOut: () => void }) {
  const { account, ready, removeWatch, signOut } = useAccount();

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between">
        <p className="pixel-text text-[9px] text-muted-foreground">
          {ready && account ? "1 ACCOUNT ON THIS DEVICE" : "NO ACCOUNT ON THIS DEVICE"}
        </p>
        <button
          onClick={() => {
            sessionStorage.removeItem(SESSION_KEY);
            onSignOut();
          }}
          className="pixel-text border border-border px-3 py-2 text-[8px] text-foreground transition hover:border-primary hover:text-primary"
        >
          SIGN OUT
        </button>
      </div>

      {!ready ? null : !account ? (
        <div className="panel mt-4 p-7 text-lg text-muted-foreground">
          Nobody has signed up on this device yet.
        </div>
      ) : (
        <div className="panel mt-4 divide-y divide-border">
          <Row label="HANDLE" value={account.handle} />
          <Row label="EMAIL" value={account.email || "—"} />
          <Row label="WALLET" value={account.wallet || "—"} />
          <Row label="DEFAULT TERMINAL" value={account.terminal} />
          <Row label="WATCHLIST" value={`${account.watchlist.length} address(es)`} />

          {account.watchlist.length > 0 && (
            <div className="p-5">
              <span className="pixel-text text-[8px] text-muted-foreground">WATCHED ADDRESSES</span>
              <ul className="mt-3 space-y-2">
                {account.watchlist.map((w) => (
                  <li key={w} className="flex items-center justify-between gap-3">
                    <span className="truncate text-base text-foreground">{w}</span>
                    <button
                      onClick={() => removeWatch(w)}
                      className="pixel-text shrink-0 text-[7px] text-destructive hover:underline"
                    >
                      REMOVE
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="p-5">
            <button
              onClick={signOut}
              className="pixel-text border border-destructive px-4 py-3 text-[8px] text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
            >
              DELETE THIS ACCOUNT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <span className="pixel-text text-[8px] text-muted-foreground">{label}</span>
      <span className="truncate text-lg text-foreground">{value}</span>
    </div>
  );
}
