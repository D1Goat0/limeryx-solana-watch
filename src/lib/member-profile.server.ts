import { createHash, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { z } from "zod";
import { MemberError } from "./membership-handler.server.ts";
import type { Account } from "./wallet-store.ts";

export const botAccountSchema = z
  .object({
    handle: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    wallet: z
      .string()
      .trim()
      .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
    limeKey: z.string().trim().min(1).max(4096),
    terminal: z.string().trim().min(1).max(100),
    watchlist: z.array(z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)).max(200),
  })
  .strict();
export type ProfileUser = {
  id: string;
  email?: string;
  confirmedAt?: string;
  lastSignInAt?: string;
  appMetadata?: Record<string, unknown>;
};
export type MemberActivity = {
  id: string;
  memberId: string;
  email: string;
  kind: "signup" | "signin";
  at: string;
};
type StoredProfile = Account & { id: string; createdAt: string; pendingMember?: boolean };
type Store = Pick<ReturnType<typeof getStore>, "get" | "setJSON" | "list">;
const uuid = z.string().uuid();
const email = (value?: string) => value?.trim().toLowerCase();

export function createMemberProfileStorage(
  factory: (name: string) => Store = (name) => getStore(name, { consistency: "strong" }),
) {
  const accounts = () => factory("limeryx-accounts");
  const links = () => factory("limeryx-member-profiles");
  const activity = () => factory("limeryx-member-activity");
  const readProfile = async (id: string): Promise<StoredProfile | null> => {
    if (!uuid.safeParse(id).success) return null;
    return accounts().get(id, { type: "json" }) as Promise<StoredProfile | null>;
  };
  async function validateSetup(id: string, memberEmail?: string) {
    const profile = await readProfile(id);
    if (
      !profile ||
      !botAccountSchema.safeParse({
        handle: profile.handle,
        email: profile.email,
        wallet: profile.wallet,
        limeKey: profile.limeKey,
        terminal: profile.terminal,
        watchlist: profile.watchlist,
      }).success ||
      !memberEmail ||
      email(profile.email) !== email(memberEmail)
    )
      throw new MemberError(
        "Your bot setup could not be linked. Please create your account again.",
      );
    return profile;
  }
  async function linkProfile(user: ProfileUser, id: string) {
    if (!uuid.safeParse(user.id).success) throw new MemberError("Invalid member account.");
    await validateSetup(id, user.email);
    await links().setJSON(user.id, { accountId: id }, { onlyIfNew: true });
  }
  async function getProfile(user: ProfileUser): Promise<Account | null> {
    if (!user.confirmedAt)
      throw new MemberError("Verify your email before loading your bot account.", 403);
    let link = (await links().get(user.id, { type: "json" })) as { accountId: string } | null;
    if (!link) {
      const setupId = user.appMetadata?.limeryx_profile_id;
      if (typeof setupId === "string") {
        await linkProfile(user, setupId);
      } else if (user.email) {
        // Restore accounts created before Identity linking, only for the verified email owner.
        let latest: StoredProfile | null = null;
        for await (const page of accounts().list({ paginate: true })) {
          for (const blob of page.blobs) {
            const candidate = await readProfile(blob.key);
            if (
              candidate &&
              !candidate.pendingMember &&
              email(candidate.email) === email(user.email) &&
              (!latest || candidate.createdAt > latest.createdAt)
            )
              latest = candidate;
          }
        }
        if (latest) await linkProfile(user, latest.id);
      }
      link = (await links().get(user.id, { type: "json" })) as { accountId: string } | null;
    }
    if (!link) return null;
    const profile = await validateSetup(link.accountId, user.email);
    const { handle, wallet, limeKey, terminal, watchlist } = profile;
    return { handle, email: user.email!, wallet, limeKey, terminal, watchlist };
  }
  async function prepareProfile(value: unknown) {
    const account = botAccountSchema.parse(value);
    const id = randomUUID();
    await accounts().setJSON(
      id,
      { ...account, id, createdAt: new Date().toISOString(), pendingMember: true },
      { onlyIfNew: true },
    );
    return id;
  }
  async function saveProfile(user: ProfileUser, value: unknown) {
    if (!user.confirmedAt)
      throw new MemberError("Verify your email before linking your bot account.", 403);
    const account = botAccountSchema.parse(value);
    if (email(account.email) !== email(user.email))
      throw new MemberError("Account email does not match your sign-in.", 403);
    const existing = await getProfile(user);
    if (existing) return existing;
    const id = await prepareProfile({ ...account, email: user.email });
    await linkProfile(user, id);
    return getProfile(user);
  }
  async function logActivity(user: ProfileUser, kind: MemberActivity["kind"]) {
    if (!uuid.safeParse(user.id).success) throw new MemberError("Invalid member account.");
    const at =
      kind === "signin" ? user.lastSignInAt || new Date().toISOString() : new Date().toISOString();
    const stamp = kind === "signup" ? "signup" : createHash("sha256").update(at).digest("hex");
    const id = `${kind}/${user.id}/${stamp}`;
    await activity().setJSON(
      id,
      { id, memberId: user.id, email: user.email || "", kind, at } satisfies MemberActivity,
      { onlyIfNew: true },
    );
  }
  async function listActivity() {
    const entries: MemberActivity[] = [];
    for await (const page of activity().list({ paginate: true }))
      for (const blob of page.blobs) {
        const item = (await activity().get(blob.key, { type: "json" })) as MemberActivity | null;
        if (item) entries.push(item);
      }
    return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  }
  return {
    prepareProfile,
    validateSetup,
    linkProfile,
    getProfile,
    saveProfile,
    logActivity,
    listActivity,
  };
}
export const memberProfileStorage = createMemberProfileStorage();
