import { test } from "node:test";
import assert from "node:assert/strict";
import { createMembershipHandler, MemberError } from "../src/lib/membership-handler.server.ts";

const member = { id: "11111111-1111-4111-8111-111111111111", confirmedAt: "2026-10-15T12:00:00Z" };
const wallet = "So11111111111111111111111111111111111111112";
const url = "https://limeryx.example/.netlify/functions/membership";
function fixture(user = member) {
  const calls = [];
  const handler = createMembershipHandler({
    currentUser: async () => user,
    validCode: async (code) => {
      calls.push(["valid", code]);
      return true;
    },
    dashboard: async (owner) => {
      calls.push(["dashboard", owner.id]);
      return { code: "a".repeat(16) };
    },
    claim: async (owner, address) => {
      calls.push(["claim", owner.id, address]);
      return "claim-id";
    },
  });
  const post = (body, origin = "https://limeryx.example") =>
    new Request(`${url}?action=claim`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { handler, calls, post };
}
test("private endpoints require an authenticated server identity", async () => {
  const f = fixture(null);
  assert.equal((await f.handler(new Request(`${url}?action=dashboard`))).status, 401);
  assert.equal((await f.handler(f.post({ payout_wallet: wallet }))).status, 401);
  assert.deepEqual(f.calls, []);
});
test("claims reject cross-origin requests and unverified accounts", async () => {
  const f = fixture();
  assert.equal(
    (await f.handler(f.post({ payout_wallet: wallet }, "https://attacker.example"))).status,
    403,
  );
  const unverified = fixture({ id: member.id });
  assert.equal((await unverified.handler(unverified.post({ payout_wallet: wallet }))).status, 403);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(unverified.calls, []);
});
test("request bodies cannot select the account or amount", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handler(
        f.post({ payout_wallet: wallet, user_id: "victim", amount_lamports: 99999999999 }),
      )
    ).status,
    400,
  );
  assert.equal((await f.handler(f.post({ payout_wallet: "invalid" }))).status, 400);
  assert.deepEqual(f.calls, []);
  const response = await f.handler(f.post({ payout_wallet: wallet }));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls, [["claim", member.id, wallet]]);
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("dashboard ignores supplied user ids and prevents shared caching", async () => {
  const f = fixture();
  const response = await f.handler(new Request(`${url}?action=dashboard&user_id=victim`));
  assert.equal(response.status, 200);
  assert.deepEqual(f.calls, [["dashboard", member.id]]);
  assert.equal(response.headers.get("netlify-cdn-cache-control"), "no-store");
});
test("public code validation reveals only validity and malformed codes do not hit storage", async () => {
  const f = fixture(null);
  assert.deepEqual(
    await (await f.handler(new Request(`${url}?action=valid&code=invalid`))).json(),
    { valid: false },
  );
  assert.deepEqual(f.calls, []);
  assert.deepEqual(
    await (await f.handler(new Request(`${url}?action=valid&code=${"a".repeat(16)}`))).json(),
    { valid: true },
  );
});
test("claim operations and methods are restricted; domain errors are safe to display", async () => {
  const f = fixture();
  assert.equal((await f.handler(new Request(`${url}?action=approve`))).status, 404);
  assert.equal((await f.handler(new Request(`${url}?action=claim`))).status, 404);
  const fail = createMembershipHandler({
    currentUser: async () => member,
    validCode: async () => false,
    dashboard: async () => {
      throw new MemberError("Claims are not open yet");
    },
    claim: async () => "",
  });
  assert.equal((await fail(new Request(`${url}?action=dashboard`))).status, 400);
});
