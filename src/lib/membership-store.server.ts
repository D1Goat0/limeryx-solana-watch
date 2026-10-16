import { admin, getUser } from "@netlify/identity";
import type { User } from "@netlify/identity";
import { MemberError, type MembershipServices } from "./membership-handler.server.ts";
import type { MemberUser } from "./member-api.ts";
import { createBlobMembershipStorage } from "./membership-blobs.server.ts";
import { postgresMembershipStorage } from "./membership-postgres.server.ts";
import { isOfficialReferral } from "./referral-codes.ts";

const blobs = createBlobMembershipStorage();
// Accounts/referrals work on the existing plan. Money requires transactional storage.
function storage() {
  return process.env.LIMERYX_DATABASE_URL ? postgresMembershipStorage : blobs;
}
export async function validCode(code: string) {
  return isOfficialReferral(code) || storage().validCode(code);
}
export async function syncMember(id: string, code: string | null, confirmed: boolean) {
  if (process.env.LIMERYX_DATABASE_URL && isOfficialReferral(code)) {
    // Official campaigns are tracked in Blobs and never credited to a personal inviter.
    await blobs.syncMember(id, code, confirmed);
    await postgresMembershipStorage.syncMember(id, null, confirmed);
    return;
  }
  await storage().syncMember(id, code, confirmed);
}
async function canonicalUser(): Promise<User | null> {
  const session = await getUser();
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
    return storage().dashboard(user.id);
  },
  async claim(user, wallet) {
    await syncAuthenticated(user);
    return storage().claim(user.id, wallet);
  },
};
