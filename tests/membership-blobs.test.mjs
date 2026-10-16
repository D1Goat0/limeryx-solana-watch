import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createBlobMembershipStorage } from "../src/lib/membership-blobs.server.ts";

const inviter = "11111111-1111-4111-8111-111111111111";
const invitee = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const wallet = "So11111111111111111111111111111111111111112";
function fixture() {
  const records = new Map();
  const store = {
    failPrefix: null,
    async get(key) {
      return structuredClone(records.get(key) ?? null);
    },
    async setJSON(key, value, options) {
      assert.equal(options?.onlyIfNew, true, "All Blobs records must be create-only");
      if (this.failPrefix && key.startsWith(this.failPrefix)) throw new Error("Interrupted write");
      if (records.has(key)) return { modified: false };
      records.set(key, structuredClone(value));
      return { modified: true, etag: key };
    },
    async *list({ prefix, paginate }) {
      assert.equal(paginate, true);
      // One entry per page forces the implementation to consume all pages.
      for (const key of records.keys())
        if (key.startsWith(prefix)) yield { blobs: [{ key }], directories: [] };
    },
  };
  return { records, store, service: createBlobMembershipStorage(() => store) };
}

test("Official campaign signup is active without an inviter and immutable on retries", async () => {
  const { service, records } = fixture();
  assert.equal(await service.validCode("dtofficial"), true);
  assert.equal(await service.validCode("DTOFFICIAL"), true);
  assert.equal(await service.validCode("dtofficial-fake"), false);
  await service.syncMember(invitee, "DTOFFICIAL", false);
  assert.equal(records.get(`members/${invitee}`).campaign_code, "dtofficial");
  assert.equal(records.get(`members/${invitee}`).inviter_id, null);
  assert.deepEqual(records.get(`campaigns/dtofficial/${invitee}`), { id: invitee });
  await service.syncMember(inviter, null, true);
  const code = (await service.dashboard(inviter)).code;
  await service.syncMember(invitee, code, true);
  assert.equal(records.get(`members/${invitee}`).campaign_code, "dtofficial");
  assert.equal(records.get(`members/${invitee}`).inviter_id, null);
  assert.ok(records.has(`verified/${invitee}`));
  assert.equal((await service.dashboard(inviter)).summary.invited_count, 0);
  assert.equal((await service.dashboard(invitee)).program.enabled, false);
  await service.syncMember(inviter, "dtofficial", true);
  assert.equal(records.get(`members/${inviter}`).campaign_code, null);
  assert.equal(records.has(`campaigns/dtofficial/${inviter}`), false);
});

test("Interrupted official campaign indexing repairs without losing attribution", async () => {
  const { service, store, records } = fixture();
  store.failPrefix = "campaigns/";
  await assert.rejects(service.syncMember(invitee, "dtofficial", false), /Interrupted/);
  store.failPrefix = null;
  await service.syncMember(invitee, null, true);
  assert.equal(records.get(`members/${invitee}`).campaign_code, "dtofficial");
  assert.ok(records.has(`campaigns/dtofficial/${invitee}`));
  assert.ok(records.has(`verified/${invitee}`));
});

test("Blobs tracks immutable referrals and confirmations without financial balances", async () => {
  const { service, records } = fixture();
  await service.syncMember(inviter, null, true);
  await service.syncMember(stranger, null, true);
  const code = (await service.dashboard(inviter)).code;
  assert.match(code, /^[a-f0-9]{16}$/);
  assert.equal(await service.validCode(code), true);
  assert.equal(await service.validCode("ffffffffffffffff"), false);
  await service.syncMember(invitee, code.toUpperCase(), false);
  assert.equal((await service.dashboard(inviter)).summary.invited_count, 1);
  assert.equal((await service.dashboard(inviter)).summary.verified_count, 0);
  await service.syncMember(invitee, (await service.dashboard(stranger)).code, true);
  await service.syncMember(invitee, null, false);
  assert.equal(records.get(`members/${invitee}`).inviter_id, inviter);
  const dashboard = await service.dashboard(inviter);
  assert.equal(dashboard.summary.verified_count, 1);
  assert.equal((await service.dashboard(stranger)).summary.invited_count, 0);
  assert.equal(dashboard.program.enabled, false);
  assert.deepEqual(dashboard.claims, []);
  for (const [key, value] of Object.entries(dashboard.summary))
    if (key.endsWith("_lamports")) assert.equal(value, "0");
  await assert.rejects(service.claim(inviter, wallet), /Claims are not open/);
  assert.equal(
    [...records.keys()].some((k) => /reward|claim|budget/.test(k)),
    false,
  );
});

test("Concurrent signup retries preserve one profile and one original inviter", async () => {
  const { service, records } = fixture();
  await service.syncMember(inviter, null, true);
  await service.syncMember(stranger, null, true);
  const code = (await service.dashboard(inviter)).code;
  const otherCode = (await service.dashboard(stranger)).code;
  await Promise.all([
    service.syncMember(invitee, code, true),
    service.syncMember(invitee, otherCode, true),
  ]);
  const member = records.get(`members/${invitee}`);
  const first = member.inviter_id;
  await service.syncMember(invitee, first === inviter ? otherCode : code, true);
  assert.equal(records.get(`members/${invitee}`).inviter_id, first);
  assert.equal((await service.dashboard(first)).summary.invited_count, 1);
  assert.equal(
    (await service.dashboard(first === inviter ? stranger : inviter)).summary.invited_count,
    0,
  );
});

test("Interrupted index writes repair on retry and incomplete codes are invalid", async () => {
  const { service, store, records } = fixture();
  store.failPrefix = "members/";
  await assert.rejects(service.syncMember(inviter, null, true), /Interrupted/);
  const code = createHash("sha256").update(`limeryx:${inviter}`).digest("hex").slice(0, 16);
  assert.equal(await service.validCode(code), false);
  store.failPrefix = null;
  await service.syncMember(inviter, null, true);
  assert.equal(await service.validCode(code), true);
  store.failPrefix = "referrals/";
  await assert.rejects(service.syncMember(invitee, code, false), /Interrupted/);
  assert.equal(records.get(`members/${invitee}`).inviter_id, inviter);
  store.failPrefix = null;
  await service.syncMember(invitee, null, true);
  assert.equal((await service.dashboard(inviter)).summary.verified_count, 1);
});

test("Blobs rejects invalid identities, referrals and code collisions", async () => {
  const { service, records } = fixture();
  await assert.rejects(service.syncMember("../bad", null, true), /Invalid member/);
  await assert.rejects(service.dashboard("../bad"), /Invalid member/);
  await assert.rejects(service.syncMember(invitee, "ffffffffffffffff", true), /Invalid referral/);
  assert.equal(records.size, 0);
  const code = createHash("sha256").update(`limeryx:${inviter}`).digest("hex").slice(0, 16);
  records.set(`codes/${code}`, { id: stranger });
  await assert.rejects(service.syncMember(inviter, null, true), /temporarily unavailable/);
  assert.equal(records.has(`members/${inviter}`), false);
});

test("Blobs counts all referral pages and isolates members", async () => {
  const { service } = fixture();
  await service.syncMember(inviter, null, true);
  await service.syncMember(stranger, null, true);
  const code = (await service.dashboard(inviter)).code;
  for (let i = 10; i < 15; i++)
    await service.syncMember(
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      code,
      i % 2 === 0,
    );
  const dashboard = await service.dashboard(inviter);
  assert.equal(dashboard.summary.invited_count, 5);
  assert.equal(dashboard.summary.verified_count, 3);
  assert.equal((await service.dashboard(stranger)).summary.invited_count, 0);
});
