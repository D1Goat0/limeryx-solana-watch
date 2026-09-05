import { useEffect, useRef, useState } from "react";

const ACCOUNTS = [
  { handle: "solanafloor", label: "SOLANA" },
  { handle: "pumpdotfun", label: "PUMP.FUN" },
  { handle: "AxiomExchange", label: "AXIOM" },
  { handle: "JupiterExchange", label: "JUPITER" },
  { handle: "0xMert_", label: "SMART MONEY" },
];

type Twttr = {
  widgets: {
    createTimeline: (
      source: { sourceType: string; screenName: string },
      target: HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement | undefined>;
  };
};

function loadWidgets(): Promise<Twttr> {
  const w = window as unknown as { twttr?: Twttr };
  if (w.twttr?.widgets) return Promise.resolve(w.twttr);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("twitter-wjs") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = "twitter-wjs";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.addEventListener("load", () => {
      const t = (window as unknown as { twttr?: Twttr }).twttr;
      t ? resolve(t) : reject(new Error("widgets unavailable"));
    });
    script.addEventListener("error", () => reject(new Error("blocked")));
    if (!existing) document.head.appendChild(script);
  });
}

export function XTimeline() {
  const [active, setActive] = useState(ACCOUNTS[0]!.handle);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const target = box.current;
    if (!target) return;
    target.innerHTML = "";
    setFailed(false);
    setLoading(true);
    // X's embedded timeline hangs forever when rate-limited (HTTP 429);
    // treat a long silence as a failure so the fallback always appears.
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled || settled) return;
      setLoading(false);
      setFailed(true);
    }, 12_000);
    loadWidgets()
      .then((twttr) =>
        twttr.widgets.createTimeline(
          { sourceType: "profile", screenName: active },
          target,
          { theme: "dark", height: 520, chrome: "noheader nofooter transparent", dnt: true },
        ),
      )
      .then((el) => {
        if (cancelled) return;
        setLoading(false);
        if (!el) setFailed(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [active]);


  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.handle}
            onClick={() => setActive(a.handle)}
            className={`pixel-text border px-3 py-2 text-[7px] transition ${
              active === a.handle
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div ref={box} className="mt-4 min-h-[200px]" />

      {loading && <p className="mt-3 text-base text-muted-foreground">Loading live posts from X…</p>}



      {failed && (
        <div className="mt-3">
          <p className="text-base text-muted-foreground">
            X is rate-limiting the embedded feed right now. Open the live feeds directly:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ACCOUNTS.map((a) => (
              <a
                key={a.handle}
                href={`https://x.com/${a.handle}`}
                target="_blank"
                rel="noreferrer noopener"
                className={`pixel-text border px-3 py-2 text-[7px] transition hover:border-primary hover:text-primary ${
                  a.handle === active ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}
              >
                @{a.handle.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
