import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("Optional PostgreSQL membership ledger", async (t) => {
  const db = new PGlite();
  const inviter = "11111111-1111-4111-8111-111111111111";
  const invitee = "22222222-2222-4222-8222-222222222222";
  const stranger = "33333333-3333-4333-8333-333333333333";
  const wallet = "So11111111111111111111111111111111111111112";
  const signature = "2".repeat(88);
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const sync = (id, ref = null, verified = true) =>
    query("select public.member_sync_account($1, $2, $3)", [id, ref, verified]);
  const claim = (id, address = wallet) =>
    query("select public.member_request_claim($1, $2) as id", [id, address]);
  try {
    await db.exec(await readFile(new URL("../docs/sql/membership.sql", import.meta.url), "utf8"));
    await sync(inviter);
    await sync(stranger);
    const code = (
      await query("select code from public.member_accounts where user_id = $1", [inviter])
    )[0].code;
    await t.test(
      "signup attribution is recorded before confirmation with zero unearned rewards",
      async () => {
        assert.match(code, /^[a-f0-9]{16}$/);
        await sync(invitee, code, false);
        const [referral] = await query("select * from public.member_referrals");
        assert.equal(referral.inviter_id, inviter);
        assert.equal(referral.confirmed_at, null);
        assert.equal((await query("select * from public.member_rewards")).length, 0);
        await assert.rejects(claim(invitee), /Verify your email/);
        await assert.rejects(
          sync("44444444-4444-4444-8444-444444444444", "ffffffffffffffff"),
          /Invalid referral/,
        );
      },
    );
    await t.test(
      "confirmation qualifies each beneficiary exactly once and attribution stays immutable",
      async () => {
        await query(
          "update public.member_referral_policy set enabled = true, inviter_lamports = 20000000, invitee_lamports = 10000000",
        );
        await sync(invitee, code);
        await sync(invitee, null);
        const strangerCode = (
          await query("select code from public.member_accounts where user_id = $1", [stranger])
        )[0].code;
        await sync(invitee, strangerCode);
        assert.equal(
          (
            await query("select inviter_id from public.member_referrals where invitee_id = $1", [
              invitee,
            ])
          )[0].inviter_id,
          inviter,
        );
        const rewards = await query("select * from public.member_rewards");
        assert.equal(rewards.length, 2);
        assert.ok(rewards.every((reward) => reward.status === "pending"));
      },
    );
    const reward = (
      await query("select id from public.member_rewards where user_id = $1", [inviter])
    )[0].id;
    await t.test("approval reserves only funded budget and cannot run twice", async () => {
      await assert.rejects(
        query("select public.member_approve_reward($1)", [reward]),
        /sufficient funded budget/,
      );
      await query("update public.member_referral_policy set unallocated_lamports = 50000000");
      await query("select public.member_approve_reward($1)", [reward]);
      await assert.rejects(
        query("select public.member_approve_reward($1)", [reward]),
        /not pending/,
      );
      assert.equal(
        (await query("select unallocated_lamports from public.member_referral_policy"))[0]
          .unallocated_lamports,
        30000000,
      );
    });
    let claimId;
    await t.test(
      "claims check addresses and balances and reserve available rewards once",
      async () => {
        await assert.rejects(claim(stranger), /below the minimum/);
        await assert.rejects(claim(inviter, "invalid"), /valid public Solana/);
        claimId = (await claim(inviter))[0].id;
        await assert.rejects(claim(inviter), /below the minimum/);
        const [record] = await query("select * from public.member_claims where id = $1", [claimId]);
        assert.equal(record.user_id, inviter);
        assert.equal(record.amount_lamports, 20000000);
      },
    );
    await t.test(
      "rejection restores the reserved balance without refunding the funding reservation",
      async () => {
        await query("select public.member_resolve_claim($1)", [claimId]);
        const [record] = await query(
          "select status, claim_id from public.member_rewards where id = $1",
          [reward],
        );
        assert.deepEqual(record, { status: "available", claim_id: null });
        assert.equal(
          (await query("select unallocated_lamports from public.member_referral_policy"))[0]
            .unallocated_lamports,
          30000000,
        );
        claimId = (await claim(inviter))[0].id;
      },
    );
    await t.test("paid claims require a valid signature and cannot be paid again", async () => {
      await assert.rejects(
        query("select public.member_resolve_claim($1, 'fake')", [claimId]),
        /Invalid transaction/,
      );
      await query("select public.member_resolve_claim($1, $2)", [claimId, signature]);
      await assert.rejects(
        query("select public.member_resolve_claim($1, $2)", [claimId, signature]),
        /not pending/,
      );
      assert.equal(
        (await query("select status from public.member_rewards where id = $1", [reward]))[0].status,
        "paid",
      );
    });
    await t.test("exact aggregates isolate accounts", async () => {
      const [owner] = await query("select * from public.member_referral_summary($1)", [inviter]);
      assert.equal(owner.paid_lamports, "20000000");
      assert.equal(Number(owner.invited_count), 1);
      const [other] = await query("select * from public.member_referral_summary($1)", [invitee]);
      assert.equal(other.pending_lamports, "10000000");
      assert.equal(other.paid_lamports, "0");
      const [empty] = await query("select * from public.member_referral_summary($1)", [stranger]);
      assert.equal(empty.pending_lamports, "0");
      assert.equal(empty.available_lamports, "0");
    });
    await t.test(
      "auto-confirmed accounts qualify once and pausing prevents new claims and awards",
      async () => {
        await sync("55555555-5555-4555-8555-555555555555", code);
        assert.equal((await query("select * from public.member_rewards")).length, 4);
        await query("update public.member_referral_policy set enabled = false");
        await sync("66666666-6666-4666-8666-666666666666", code);
        assert.equal((await query("select * from public.member_rewards")).length, 4);
        await assert.rejects(claim(inviter), /Claims are not open/);
      },
    );
  } finally {
    await db.close();
  }
});
