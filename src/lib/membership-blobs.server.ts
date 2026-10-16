import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { z } from "zod";
import type { ReferralDashboard } from "./member-api.ts";
import { MemberError } from "./membership-handler.server.ts";
import { isOfficialReferral, OFFICIAL_REFERRAL_CODE } from "./referral-codes.ts";

type Profile = {
  id: string;
  code: string;
  inviter_id: string | null;
  campaign_code?: typeof OFFICIAL_REFERRAL_CODE | null;
  created_at: string;
};
type BlobStore = Pick<ReturnType<typeof getStore>, "get" | "setJSON" | "list">;
const uuid = z.string().uuid();
const codePattern = /^[a-f0-9]{16}$/;

// Immutable records only: balances, budgets and claims are never stored in Blobs.
export function createBlobMembershipStorage(
  storeFactory: () => BlobStore = () => getStore("limeryx-members-v1", { consistency: "strong" }),
) {
  const read = async <T>(key: string): Promise<T | null> =>
    storeFactory().get(key, { type: "json" }) as Promise<T | null>;
  const profile = (id: string) => read<Profile>(`members/${id}`);
  async function memberForCode(code: string): Promise<Profile | null> {
    if (!codePattern.test(code)) return null;
    const index = await read<{ id: string }>(`codes/${code}`);
    if (!index || !uuid.safeParse(index.id).success) return null;
    const member = await profile(index.id);
    return member?.code === code ? member : null;
  }
  async function syncMember(id: string, referral: string | null, confirmed: boolean) {
    if (!uuid.safeParse(id).success) throw new MemberError("Invalid member account.");
    let member = await profile(id);
    if (!member) {
      const official = isOfficialReferral(referral);
      const inviter = referral && !official ? await memberForCode(referral.toLowerCase()) : null;
      if (referral && !official && (!inviter || inviter.id === id))
        throw new MemberError("Invalid referral code.");
      const code = createHash("sha256").update(`limeryx:${id}`).digest("hex").slice(0, 16);
      const index = await storeFactory().setJSON(`codes/${code}`, { id }, { onlyIfNew: true });
      if (!index.modified && (await read<{ id: string }>(`codes/${code}`))?.id !== id)
        throw new MemberError("Account service is temporarily unavailable.", 503);
      await storeFactory().setJSON(
        `members/${id}`,
        {
          id,
          code,
          inviter_id: inviter?.id ?? null,
          campaign_code: official ? OFFICIAL_REFERRAL_CODE : null,
          created_at: new Date().toISOString(),
        } satisfies Profile,
        { onlyIfNew: true },
      );
      // Concurrent signup retries must use the first persisted attribution.
      member = await profile(id);
      if (!member) throw new MemberError("Member account is not ready.", 503);
    }
    if (member.campaign_code === OFFICIAL_REFERRAL_CODE)
      await storeFactory().setJSON(
        `campaigns/${OFFICIAL_REFERRAL_CODE}/${id}`,
        { id },
        { onlyIfNew: true },
      );
    if (member.inviter_id)
      await storeFactory().setJSON(
        `referrals/${member.inviter_id}/${id}`,
        { id },
        { onlyIfNew: true },
      );
    if (confirmed)
      await storeFactory().setJSON(
        `verified/${id}`,
        { confirmed_at: new Date().toISOString() },
        { onlyIfNew: true },
      );
  }
  return {
    validCode: async (code: string) =>
      isOfficialReferral(code) || Boolean(await memberForCode(code.toLowerCase())),
    syncMember,
    async dashboard(id: string): Promise<ReferralDashboard> {
      if (!uuid.safeParse(id).success) throw new MemberError("Invalid member account.");
      const member = await profile(id);
      if (!member) throw new MemberError("Member account is not ready.", 503);
      let invited = 0;
      let verified = 0;
      // Paginate every record instead of truncating counts at the first page.
      for await (const page of storeFactory().list({
        prefix: `referrals/${id}/`,
        paginate: true,
      })) {
        for (const blob of page.blobs) {
          const inviteeId = blob.key.slice(`referrals/${id}/`.length);
          if (!uuid.safeParse(inviteeId).success) continue;
          const invitee = await profile(inviteeId);
          if (invitee?.inviter_id !== id) continue;
          invited++;
          if (await read(`verified/${inviteeId}`)) verified++;
        }
      }
      return {
        code: member.code,
        summary: {
          invited_count: invited,
          verified_count: verified,
          pending_lamports: "0",
          available_lamports: "0",
          claimed_lamports: "0",
          paid_lamports: "0",
        },
        program: {
          enabled: false,
          inviter_lamports: "0",
          invitee_lamports: "0",
          minimum_claim_lamports: "10000000",
        },
        claims: [],
      };
    },
    async claim(_id: string, _wallet: string): Promise<string> {
      throw new MemberError("Claims are not open yet.");
    },
  };
}
