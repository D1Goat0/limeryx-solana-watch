import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  createRoute,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { AccountPage, Route as AccountRoute } from "../../src/routes/account";
import { MemberProvider } from "../../src/lib/member-auth";

const mocks = vi.hoisted(() => ({
  user: null as any,
  listeners: new Set<any>(),
  login: vi.fn(),
  signup: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@netlify/identity", () => ({
  getUser: async () => mocks.user,
  handleAuthCallback: async () => null,
  onAuthChange: (callback: any) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
  login: (...args: any[]) => mocks.login(...args),
  signup: (...args: any[]) => mocks.signup(...args),
  logout: vi.fn(),
  updateUser: vi.fn(),
  requestPasswordRecovery: vi.fn(),
  MissingIdentityError: class extends Error {},
}));
vi.mock("../../src/lib/member-session", () => ({
  sessionRequest: (...args: any[]) => mocks.session(...args),
}));
vi.mock("../../src/lib/integrations", () => ({ integrations: [{ name: "Axiom" }] }));

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "trader@example.com",
  confirmedAt: "2026-10-15T00:00:00Z",
};
function openAccount(mode: "login" | "signup") {
  const root = createRootRoute({
    component: () => (
      <MemberProvider>
        <Outlet />
      </MemberProvider>
    ),
  });
  AccountRoute.update({
    getParentRoute: () => root,
    path: "/account",
    component: AccountPage,
  } as any);
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: "/dashboard",
    component: () => <h1>Dashboard destination</h1>,
    validateSearch: (search: Record<string, unknown>) => ({ confirmation: search.confirmation }),
  });
  const router = createRouter({
    routeTree: root.addChildren([AccountRoute, dashboard]),
    history: createMemoryHistory({
      initialEntries: [`/account${mode === "login" ? "?mode=login" : ""}`],
    }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  sessionStorage.clear();
  mocks.user = null;
  mocks.listeners.clear();
  mocks.login.mockReset();
  mocks.signup.mockReset();
  mocks.session.mockReset();
  mocks.login.mockImplementation(async () => {
    mocks.user = user;
    for (const listener of mocks.listeners) listener("login", user);
    return user;
  });
  mocks.session.mockImplementation((action: string) =>
    action === "prepare"
      ? Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" })
      : new Promise(() => {}),
  );
});
afterEach(cleanup);
async function fill(mode: "login" | "signup") {
  const keyboard = userEvent.setup();
  await keyboard.type(await screen.findByLabelText("Email"), user.email);
  await keyboard.type(screen.getByLabelText("Password"), "a-test-password");
  if (mode === "signup") {
    await keyboard.type(
      screen.getByLabelText(/PUBLIC WALLET/),
      "So11111111111111111111111111111111111111112",
    );
    await keyboard.type(screen.getByLabelText(/^Private Key/), "test-bot-identifier");
  }
  return keyboard;
}

it("successful sign-in changes the real router location even while profile loading is pending", async () => {
  const router = openAccount("login");
  const keyboard = await fill("login");
  await keyboard.click(screen.getByRole("button", { name: "Sign in", exact: true }));
  await screen.findByRole("heading", { name: "Dashboard destination" });
  expect(router.state.location.pathname).toBe("/dashboard");
});

it("confirmed account creation establishes a session and navigates to the dashboard", async () => {
  mocks.signup.mockResolvedValue(user);
  const router = openAccount("signup");
  const keyboard = await fill("signup");
  await keyboard.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("heading", { name: "Dashboard destination" });
  expect(mocks.login).toHaveBeenCalledWith(user.email, "a-test-password");
  expect(router.state.location.pathname).toBe("/dashboard");
});

it("signup awaiting confirmation opens the dashboard with a confirmation notice flag", async () => {
  mocks.signup.mockResolvedValue({ ...user, confirmedAt: undefined });
  const router = openAccount("signup");
  const keyboard = await fill("signup");
  await keyboard.click(screen.getByRole("button", { name: "Create account" }));
  await screen.findByRole("heading", { name: "Dashboard destination" });
  expect(router.state.location.pathname).toBe("/dashboard");
  expect(router.state.location.search.confirmation).toBe("1");
  expect(mocks.login).not.toHaveBeenCalled();
});

it("a rejected sign-in stays on the account page with an error", async () => {
  mocks.login.mockRejectedValue(new Error("Invalid email or password."));
  const router = openAccount("login");
  const keyboard = await fill("login");
  await keyboard.click(screen.getByRole("button", { name: "Sign in", exact: true }));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Invalid email or password"),
  );
  expect(router.state.location.pathname).toBe("/account");
});
