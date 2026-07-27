import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

const links = [
  { to: "/", label: "HOME" },
  { to: "/get-started", label: "GET STARTED" },
  { to: "/dashboard", label: "DASHBOARD" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-5 sm:flex">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="pixel-text text-[9px] text-muted-foreground transition-colors hover:text-primary"
                activeProps={{ className: "pixel-text text-[9px] text-primary" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link
            to="/signup"
            className="pixel-text border border-primary bg-primary px-3 py-2 text-[9px] text-primary-foreground transition hover:bg-transparent hover:text-primary"
          >
            SIGN UP
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-black/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Logo size={26} />
        <p className="text-sm text-muted-foreground">
          Limeryx — real-time Solana wallet & X list intelligence. Not financial advice.
        </p>
      </div>
    </footer>
  );
}
