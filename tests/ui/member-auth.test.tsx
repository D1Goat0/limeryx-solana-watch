import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberProvider, useMember } from "../../src/lib/member-auth";
import { SiteNav } from "../../src/components/site/SiteChrome";
import { AccountPage } from "../../src/routes/account";

const mocks = vi.hoisted(() => ({
  user: null as any,
  search: { mode: "login" } as any,
  listeners: new Set<(event: string, user: any) => void>(),
  navigate: vi.fn(),
  session: vi.fn(),
  signup: vi.fn(),
}));
vi.mock("@netlify/identity", () => ({
  getUser: async () => mocks.user,
  handleAuthCallback: async () => null,
  onAuthChange: (listener: any) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
  login: async () => {
    mocks.user = member;
    for (const listener of mocks.listeners) listener("login", member);
    return member;
  },
  logout: async () => {
    mocks.user = null;
    for (const listener of mocks.listeners) listener("logout", null);
  },
  signup: (...args: any[]) => mocks.signup(...args),
  updateUser: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  MissingIdentityError: class extends Error {},
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: any) => ({ options, useSearch: () => mocks.search }),
  useNavigate: () => mocks.navigate,
  Link: ({ to, children, search, activeProps, activeOptions, ...props }: any) =>
    React.createElement("a", { ...props, href: to }, children),
}));
vi.mock("../../src/lib/member-session", () => ({
  sessionRequest: (...args: any[]) => mocks.session(...args),
}));
vi.mock("../../src/components/site/Logo", () => ({ Logo: () => <span>Limeryx</span> }));
vi.mock("../../src/lib/integrations", () => ({ integrations: [{ name: "Axiom" }] }));

const member = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "trader@example.com",
  confirmedAt: "2026-10-15T00:00:00Z",
};
const bot = {
  handle: "@trader",
  email: member.email,
  wallet: "So11111111111111111111111111111111111111112",
  limeKey: "test-bot-identifier",
  terminal: "Axiom",
  watchlist: [],
};
function Probe() {
  const { linkedAccount, profileReady } = useMember();
  return (
    <output data-testid="profile">
      {profileReady ? linkedAccount?.wallet || "none" : "loading"}
    </output>
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.user = null;
  mocks.search = { mode: "login" };
  mocks.listeners.clear();
  mocks.navigate.mockReset();
  mocks.session.mockReset();
  mocks.signup.mockReset();
  mocks.session.mockResolvedValue({ account: bot });
});
afterEach(cleanup);

describe("Member dashboard connection", () => {
  it("restores the signed-in account, redirects to dashboard and replaces Sign Up", async () => {
    mocks.user = member;
    render(
      <MemberProvider>
        <SiteNav />
        <AccountPage />
      </MemberProvider>,
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
    expect(screen.queryByRole("link", { name: "SIGN UP" })).toBeNull();
    expect(
      screen
        .getAllByRole("link", { name: "DASHBOARD" })
        .every((link) => link.getAttribute("href") === "/dashboard"),
    ).toBe(true);
    expect(JSON.parse(localStorage.getItem("limeryx.account")!).wallet).toBe(bot.wallet);
  });

  it("links a fresh sign-in to its server account and clears it on logout", async () => {
    const user = userEvent.setup();
    render(
      <MemberProvider>
        <SiteNav />
        <AccountPage />
        <Probe />
      </MemberProvider>,
    );
    await user.type(await screen.findByLabelText("Email"), member.email);
    await user.type(screen.getByLabelText("Password"), "a-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in", exact: true }));
    await waitFor(() => expect(screen.getByTestId("profile").textContent).toBe(bot.wallet));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(localStorage.getItem("limeryx.account")).toBeNull());
    expect(screen.getByRole("link", { name: "SIGN UP" })).toBeTruthy();
  });

  it("does not let a delayed previous-user response replace the current user's wallet", async () => {
    let resolveOld!: (value: any) => void;
    mocks.user = member;
    mocks.session.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    render(
      <MemberProvider>
        <Probe />
      </MemberProvider>,
    );
    await waitFor(() => expect(mocks.session).toHaveBeenCalledTimes(1));
    const next = {
      ...member,
      id: "22222222-2222-4222-8222-222222222222",
      email: "next@example.com",
    };
    const nextBot = { ...bot, email: next.email, wallet: "1".repeat(32) };
    mocks.session.mockResolvedValueOnce({ account: nextBot });
    await act(async () => {
      mocks.user = next;
      for (const listener of mocks.listeners) listener("login", next);
    });
    await waitFor(() => expect(screen.getByTestId("profile").textContent).toBe(nextBot.wallet));
    await act(async () => {
      resolveOld({ account: bot });
    });
    expect(JSON.parse(localStorage.getItem("limeryx.account")!).email).toBe(next.email);
  });

  it("does not redirect password recovery to the dashboard", async () => {
    mocks.user = member;
    mocks.search = { recovery: "1" };
    render(
      <MemberProvider>
        <AccountPage />
      </MemberProvider>,
    );
    await screen.findByRole("heading", { name: "Set a new password" });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("links a matching older browser account when the server profile is missing", async () => {
    localStorage.setItem("limeryx.account", JSON.stringify(bot));
    mocks.user = member;
    mocks.session.mockResolvedValueOnce({ account: null }).mockResolvedValueOnce({ account: bot });
    render(
      <MemberProvider>
        <AccountPage />
      </MemberProvider>,
    );
    await waitFor(() => expect(mocks.session).toHaveBeenCalledWith("profile", bot));
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true }),
    );
  });

  it("keeps the restored dashboard account available when browser storage is blocked", async () => {
    mocks.user = member;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    render(
      <MemberProvider>
        <AccountPage />
        <Probe />
      </MemberProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("profile").textContent).toBe(bot.wallet));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", replace: true });
  });
});

it("requires bot fields and waits for server storage before creating Identity accounts", async () => {
  const user = userEvent.setup();
  mocks.search = {};
  mocks.session.mockRejectedValueOnce(new Error("Could not save your bot account."));
  render(
    <MemberProvider>
      <AccountPage />
    </MemberProvider>,
  );
  await user.type(await screen.findByLabelText("Email"), member.email);
  await user.type(screen.getByLabelText("Password"), "a-test-password");
  const wallet = screen.getByLabelText(/PUBLIC WALLET/);
  const key = screen.getByLabelText(/^Private Key/);
  expect(wallet.hasAttribute("required")).toBe(true);
  expect(key.hasAttribute("required")).toBe(true);
  await user.type(wallet, bot.wallet);
  await user.type(key, bot.limeKey);
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("alert");
  expect(mocks.signup).not.toHaveBeenCalled();
  mocks.session.mockResolvedValueOnce({ id: "33333333-3333-4333-8333-333333333333" });
  mocks.signup.mockResolvedValueOnce({ ...member, confirmedAt: undefined });
  await user.click(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(mocks.signup).toHaveBeenCalledTimes(1));
  expect(mocks.signup.mock.calls[0][2]).toEqual({
    limeryx_member: true,
    referral_code: null,
    bot_setup_id: "33333333-3333-4333-8333-333333333333",
  });
  expect(JSON.stringify(mocks.signup.mock.calls[0][2])).not.toContain(bot.limeKey);
  await screen.findByText(/Check your email to confirm/);
});
