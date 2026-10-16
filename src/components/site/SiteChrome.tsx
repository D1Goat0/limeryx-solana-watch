import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useMember } from "@/lib/member-auth";
import { useAccount } from "@/lib/wallet-store";

const links = [
  { to: "/", label: "HOME" },
  { to: "/get-started", label: "GET STARTED" },
  { to: "/dashboard", label: "DASHBOARD" },
  { to: "/referrals", label: "REFERRALS" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const { user } = useMember();
  const { account } = useAccount();
  const hasAccount = Boolean(user || account);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/80 backdrop-blur-md">
      <div className="flex items-center justify-center gap-3 border-b border-primary/25 bg-primary/10 px-4 py-3 text-center">
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-primary" />
        <p className="pixel-text text-[8px] leading-relaxed text-primary sm:text-[9px]">
          Groups for traders coming soon!
        </p>
      </div>
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-5 lg:flex">
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
            to="/account"
            search={hasAccount ? {} : { mode: "login" }}
            className="pixel-text hidden text-[8px] text-muted-foreground transition hover:text-primary sm:block"
          >
            {hasAccount ? "ACCOUNT" : "SIGN IN"}
          </Link>
          <Link
            to={hasAccount ? "/dashboard" : "/account"}
            className="pixel-text border border-primary bg-primary px-2 py-2 text-[8px] text-primary-foreground transition hover:bg-transparent hover:text-primary sm:px-3 sm:text-[9px]"
          >
            {hasAccount ? "DASHBOARD" : "SIGN UP"}
          </Link>
          <button
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(!open)}
            className="p-2 text-foreground lg:hidden"
          >
            {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
          </button>
        </div>
      </nav>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="grid gap-1 border-t border-border bg-black px-4 py-3 lg:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="pixel-text px-3 py-3 text-[9px] text-muted-foreground hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className="pixel-text px-3 py-3 text-[9px] text-primary"
          >
            {hasAccount ? "ACCOUNT" : "ACCOUNT / SIGN IN"}
          </Link>
        </nav>
      )}
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
        <Link
          to="/admin"
          className="pixel-text text-[8px] text-muted-foreground/60 transition-colors hover:text-primary"
        >
          ADMIN
        </Link>
      </div>
    </footer>
  );
}
