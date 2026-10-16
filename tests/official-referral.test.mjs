import { test } from "node:test";
import assert from "node:assert/strict";
import identity from "../netlify/functions/identity.mts";
import { membershipServices } from "../src/lib/membership-store.server.ts";
import { createMembershipHandler } from "../src/lib/membership-handler.server.ts";
import { REFERRAL_PATTERN } from "../src/lib/referral-codes.ts";

test("Official code validates through the production public handler without storage or sign-in", async () => {
  const handler = createMembershipHandler(membershipServices);
  for (const code of ["dtofficial", "DTOFFICIAL"]) {
    const response = await handler(
      new Request(
        `https://limeryx.example/.netlify/functions/membership?action=valid&code=${code}`,
      ),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { valid: true });
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  for (const code of ["dtofficial2", "dtofficial/", "othercampaign"]) {
    const response = await handler(
      new Request(
        `https://limeryx.example/.netlify/functions/membership?action=valid&code=${encodeURIComponent(code)}`,
      ),
    );
    assert.deepEqual(await response.json(), { valid: false });
  }
  assert.equal(REFERRAL_PATTERN.test("a".repeat(16)), true);
});

test("Identity signup validation accepts the official code and denies unknown campaigns", async () => {
  for (const [code, shouldDeny] of [
    ["dtofficial", false],
    ["DTOFFICIAL", false],
    ["othercampaign", true],
  ]) {
    let denied = false;
    await identity.userValidate({
      user: { userMetadata: { limeryx_member: true, referral_code: code } },
      deny() {
        denied = true;
      },
    });
    assert.equal(denied, shouldDeny);
  }
});
