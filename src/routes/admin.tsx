import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, deleteStoredAccount, type StoredAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Limeryx" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Admin,
});

type Session = { user: string; pass: string };

function Admin() {
  const [session, setSession] = useState<Session | null>(null);

  return (
    <div className="mx-auto max-w-4xl px-4 py-20">
      <p className="pixel-text text-[9px] text-primary">ADMIN</p>
      <h1 className="mt-6 text-xl text-foreground">
        USER MANAGEMENT<span className="blink text-primary">_</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        Every signup, from every device, is listed below. Credentials are checked server-side, but
        this still isn't full production auth — treat this data as sensitive, and set real
        ADMIN_USER / ADMIN_PASS values in Netlify before this site is public.
      </p>

      {session ? (
        <AdminPanel session={session} onSignOut={() => setSession(null)} />
      ) : (
        <AdminLogin onSignIn={setSession} />
      )}
    </div>
  );
}

function AdminLogin({ onSignIn }: { onSignIn: (s: Session) => void }) {
  const listFn = useServerFn(listAccounts);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="panel panel-glow mt-10 max-w-sm space-y-6 p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
          // Auth is verified inside listAccounts itself — a failed check throws.
          await listFn({ data: { user, pass } });
          onSignIn({ user, pass });
        } catch {
          setError("Incorrect username or password.");
        } finally {
          setLoading(false);
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
        disabled={loading}
        className="pixel-text w-full bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent disabled:opacity-50"
      >
        {loading ? "CHECKING..." : "SIGN IN"}
      </button>
    </form>
  );
}

function toTxt(accounts: StoredAccount[]) {
  return accounts
    .map((a) =>
      [
        `ID: ${a.id}`,
        `CREATED: ${a.createdAt}`,
        `HANDLE: ${a.handle}`,
        `EMAIL: ${a.email || "—"}`,
        `LIME KEY: ${a.limeKey || "—"}`,
        `WALLET: ${a.wallet || "—"}`,
        `DEFAULT TERMINAL: ${a.terminal}`,
        `WATCHLIST (${a.watchlist.length}): ${a.watchlist.join(", ") || "—"}`,
      ].join("\n"),
    )
    .join("\n\n" + "-".repeat(40) + "\n\n");
}

function downloadTxt(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminPanel({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const listFn = useServerFn(listAccounts);
  const deleteFn = useServerFn(deleteStoredAccount);
  const [accounts, setAccounts] = useState<StoredAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listFn({ data: session });
      setAccounts(data);
    } catch {
      setError("Couldn't load accounts. Sign in again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="pixel-text text-[9px] text-muted-foreground">
          {accounts ? `${accounts.length} ACCOUNT(S)` : "LOADING..."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="pixel-text border border-border px-3 py-2 text-[8px] text-foreground transition hover:border-primary hover:text-primary"
          >
            REFRESH
          </button>
          <button
            onClick={() => accounts && downloadTxt(`limeryx-users-${Date.now()}.txt`, toTxt(accounts))}
            disabled={!accounts?.length}
            className="pixel-text border border-primary px-3 py-2 text-[8px] text-primary transition hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
          >
            DOWNLOAD .TXT
          </button>
          <button
            onClick={onSignOut}
            className="pixel-text border border-border px-3 py-2 text-[8px] text-foreground transition hover:border-primary hover:text-primary"
          >
            SIGN OUT
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-base text-destructive">{error}</p>}

      {!loading && accounts?.length === 0 && (
        <div className="panel mt-4 p-7 text-lg text-muted-foreground">No signups yet.</div>
      )}

      {accounts && accounts.length > 0 && (
        <div className="panel mt-4 divide-y divide-border">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-lg text-foreground">
                  {a.handle} <span className="text-sm text-muted-foreground">— {a.email || "no email"}</span>
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {a.terminal} · Lime Key: {a.limeKey || "—"} · Wallet: {a.wallet || "—"} ·{" "}
                  {a.watchlist.length} watched
                </p>
                <p className="text-sm text-muted-foreground/70">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={async () => {
                  await deleteFn({ data: { ...session, id: a.id } });
                  setAccounts((prev) => prev?.filter((x) => x.id !== a.id) ?? null);
                }}
                className="pixel-text shrink-0 border border-destructive px-3 py-2 text-[8px] text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
              >
                DELETE
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
