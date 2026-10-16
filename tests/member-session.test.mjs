import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemberProfileStorage } from "../src/lib/member-profile.server.ts";
import { createMemberSessionHandler } from "../src/lib/member-session-handler.server.ts";

const member = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "trader@example.com",
  confirmedAt: "2026-10-15T00:00:00Z",
  lastSignInAt: "2026-10-15T01:00:00Z",
};
const other = { ...member, id: "22222222-2222-4222-8222-222222222222", email: "other@example.com" };
const account = {
  handle: "@trader",
  email: member.email,
  wallet: "So11111111111111111111111111111111111111112",
  limeKey: "test-bot-identifier",
  terminal: "Axiom",
  watchlist: [],
};
const origin = "https://limeryx.example";
function fixture(user = member) {
  const stores = new Map();
  const factory = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async get(key) {
        return structuredClone(entries.get(key) ?? null);
      },
      async setJSON(key, value, { onlyIfNew } = {}) {
        if (onlyIfNew && entries.has(key)) return { modified: false };
        entries.set(key, structuredClone(value));
        return { modified: true };
      },
      async *list() {
        for (const key of entries.keys()) yield { blobs: [{ key }], directories: [] };
      },
    };
  };
  const storage = createMemberProfileStorage(factory);
  return {
    stores,
    storage,
    handler: createMemberSessionHandler({ ...storage, currentUser: async () => user }),
  };
}
const request = (action, data, source = origin) =>
  new Request(`${origin}/.netlify/functions/member-session?action=${action}`, {
    method: data ? "POST" : "GET",
    headers: data ? { Origin: source, "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });

test("Setup is stored in the original admin account store before registration and linked by verified ownership", async () => {
  const { storage, stores } = fixture();
  const id = await storage.prepareProfile(account);
  assert.equal(stores.get("limeryx-accounts").get(id).wallet, account.wallet);
  await assert.rejects(storage.linkProfile(other, id), /could not be linked/);
  await storage.linkProfile(member, id);
  assert.deepEqual(await storage.getProfile(member), account);
  assert.equal(await storage.getProfile(other), null);
  await assert.rejects(
    storage.getProfile({ ...member, confirmedAt: undefined }),
    /Verify your email/,
  );
});

test("Verified older members recover their existing account and keep a stable link", async () => {
  const { storage, stores } = fixture();
  const oldId = "33333333-3333-4333-8333-333333333333";
  await storage.prepareProfile({ ...account, email: other.email });
  stores
    .get("limeryx-accounts")
    .set(oldId, { ...account, id: oldId, createdAt: "2026-10-10T00:00:00Z" });
  assert.deepEqual(await storage.getProfile(member), account);
  await storage.prepareProfile({ ...account, wallet: "1".repeat(32) });
  assert.deepEqual(await storage.getProfile(member), account);
  assert.equal(stores.get("limeryx-member-profiles").get(member.id).accountId, oldId);
});

test("Unlinked signup drafts are not restored by email alone", async () => {
  const { storage } = fixture();
  await storage.prepareProfile(account);
  assert.equal(await storage.getProfile(member), null);
  const saved = await storage.saveProfile(member, account);
  assert.deepEqual(saved, account);
  await assert.rejects(
    storage.saveProfile(member, { ...account, email: other.email }),
    /does not match/,
  );
});

test("Sign-in audit records distinct logins once and never include bot credentials", async () => {
  const { storage } = fixture();
  await storage.logActivity(member, "signup");
  await storage.logActivity(member, "signup");
  await storage.logActivity(member, "signin");
  await storage.logActivity(member, "signin");
  await storage.logActivity({ ...member, lastSignInAt: "2026-10-15T02:00:00Z" }, "signin");
  const activity = await storage.listActivity();
  assert.equal(activity.length, 3);
  assert.equal(activity.filter((entry) => entry.kind === "signin").length, 2);
  assert.equal(JSON.stringify(activity).includes(account.limeKey), false);
});

test("Profile HTTP API enforces authentication, origin, schema and private caching", async () => {
  const anonymous = fixture(null);
  assert.equal((await anonymous.handler(request("profile"))).status, 401);
  assert.equal(
    (await anonymous.handler(request("prepare", account, "https://attacker.example"))).status,
    403,
  );
  assert.equal(
    (await anonymous.handler(request("prepare", { ...account, password: "never-store-this" })))
      .status,
    400,
  );
  assert.equal(
    (await anonymous.handler(request("prepare", { ...account, limeKey: " " }))).status,
    400,
  );
  assert.equal(
    (await anonymous.handler(request("prepare", { ...account, wallet: "invalid" }))).status,
    400,
  );
  const response = await anonymous.handler(request("prepare", account));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(Object.keys(await response.json()), ["id"]);
  const signedIn = fixture();
  assert.equal(
    (await signedIn.handler(request("profile", { ...account, userId: other.id }))).status,
    400,
  );
  assert.equal(
    (await signedIn.handler(request("profile", { ...account, email: other.email }))).status,
    403,
  );
  const saved = await signedIn.handler(request("profile", account));
  assert.equal(saved.status, 200);
  const loaded = await signedIn.handler(request("profile"));
  assert.deepEqual(await loaded.json(), { account });
  assert.equal(loaded.headers.get("netlify-cdn-cache-control"), "no-store");
});
