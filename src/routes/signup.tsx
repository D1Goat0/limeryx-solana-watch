import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { integrations } from "@/lib/integrations";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign Up — Limeryx" },
      {
        name: "description",
        content:
          "Create your Limeryx account to track Solana wallets and X lists live and see daily top traders.",
      },
      { property: "og:title", content: "Sign Up — Limeryx" },
      {
        property: "og:description",
        content: "Create a Limeryx account and start tracking Solana wallets in real time.",
      },
    ],
  }),
  component: SignUp;
});

function SignUp() {
  const navigate = useNavigate();
  const [terminal, setTerminal] = useState(integrations[0].name);

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
          navigate({ to: "/dashboard" });
        }}
      >
        <label className="block">
          <span className="pixel-text text-[8px] text-muted-foreground">HANDLE</span>
          <input
            required
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
        <label className="block">
          <span className="pixel-text text-[8px] text-muted-foreground">PASSWORD</span>
          <input
            required
            type="password"
            minLength={6}
            placeholder="••••••••"
            className="mt-3 w-full border border-border bg-input px-4 py-3 text-lg text-foreground outline-none focus:border-primary"
          />
        </label>

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

        <button
          type="submit"
          className="pixel-text w-full bg-primary px-6 py-4 text-[10px] text-primary-foreground transition hover:bg-accent"
        >
          CREATE ACCOUNT
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
