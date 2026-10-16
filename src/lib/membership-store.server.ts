import { getDatabase } from "@netlify/database";
import { admin, getUser } from "@netlify/identity";
import type { User } from "@netlify/identity";
import { MemberError, type MembershipServices } from "./membership-handler.server.ts";
import type { MemberUser, ReferralDashboard } from "./member-api.ts";

let database: ReturnType<typeof getDatabase> | undefined;
async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  database ??= getDatabase();
  const result = await database.pool.query(text, values);
  return result.rows as T[];
}
export async function validCode(code: string) {
  return (
    await query<{ valid: boolean }>("select public.member_referral_valid($1) as valid", [code])
  )[0].valid;
}
export async function syncMember(id: string, code: string | null, confirmed: boolean) {
  await query("select public.member_sync_account($1::uuid, $2::text, $3::boolean)", [
    id,
    code,
    confirmed,
  ]);
}
async function canonicalUser(): Promise<User | null> {
  const session = await getUser();
  // Refresh from Identity rather than trusting optional/stale JWT profile fields.
  return session ? await admin.getUser(session.id) : null;
}
async function syncAuthenticated(user: MemberUser) {
  const canonical = await canonicalUser();
  if (!canonical || canonical.id !== user.id)
    throw new MemberError("Please sign in to continue.", 401);
  const code = canonical.appMetadata?.limeryx_referral_code;
  await syncMember(
    canonical.id,
    typeof code === "string" ? code : null,
    Boolean(canonical.confirmedAt),
  );
}
export const membershipServices: MembershipServices = {
  currentUser: canonicalUser,
  validCode,
  async dashboard(user) {
    await syncAuthenticated(user);
    const [accounts, summaries, programs, claims] = await Promise.all([
      query<{ code: string }>("select code from public.member_accounts where user_id = $1", [
        user.id,
      ]),
      query<ReferralDashboard["summary"]>(
        "select * from public.member_referral_summary($1::uuid)",
        [user.id],
      ),
      query<ReferralDashboard["program"]>(
        "select enabled, inviter_lamports::text, invitee_lamports::text, minimum_claim_lamports::text from public.member_referral_policy where id = true",
      ),
      query<ReferralDashboard["claims"][number]>(
        "select id, amount_lamports::text, payout_wallet, status, tx_signature, created_at from public.member_claims where user_id = $1 order by created_at desc limit 100",
        [user.id],
      ),
    ]);
    const summary = summaries[0];
    return {
      code: accounts[0].code,
      summary: {
        ...summary,
        invited_count: Number(summary.invited_count),
        verified_count: Number(summary.verified_count),
      },
      program: programs[0],
      claims,
    };
  },
  async claim(user, wallet) {
    await syncAuthenticated(user);
    try {
      return (
        await query<{ id: string }>(
          "select public.member_request_claim($1::uuid, $2::text) as id",
          [user.id, wallet],
        )
      )[0].id;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      if (
        /Claims are not open|below the minimum|Verify your email|valid public Solana|Contact support|Member account is not ready/.test(
          message,
        )
      )
        throw new MemberError(message);
      throw cause;
    }
  },
};
