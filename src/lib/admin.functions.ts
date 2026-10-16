import { createServerFn } from "@tanstack/react-start";
import { getStore } from "@netlify/blobs";
import { z } from "zod";

const STORE_NAME = "limeryx-accounts";

// Checked server-side only — this code never reaches the browser bundle.
// Set real ADMIN_USER / ADMIN_PASS values in Netlify's environment variables
// before this site is live; these are just fallbacks for local testing.
function isValidAdmin(user: string, pass: string) {
  const wantUser = process.env.ADMIN_USER || "me";
  const wantPass = process.env.ADMIN_PASS || "admin";
  return user === wantUser && pass === wantPass;
}

const accountSchema = z.object({
  handle: z.string(),
  email: z.string(),
  limeKey: z.string(),
  terminal: z.string(),
  wallet: z.string(),
  watchlist: z.array(z.string()),
});

export type StoredAccount = z.infer<typeof accountSchema> & { id: string; createdAt: string };

/** Called on signup. Persists the account server-side so every signup — from any device — shows up for admins. */
export const submitAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => accountSchema.parse(d))
  .handler(async ({ data }) => {
    const store = getStore(STORE_NAME);
    const id = crypto.randomUUID();
    const record: StoredAccount = { ...data, id, createdAt: new Date().toISOString() };
    await store.setJSON(id, record);
    return { id };
  });

const adminAuthSchema = z.object({ user: z.string(), pass: z.string() });

/** Admin-only: every signup ever submitted, newest first. Credentials are verified server-side. */
export const listAccounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminAuthSchema.parse(d))
  .handler(async ({ data }) => {
    if (!isValidAdmin(data.user, data.pass)) throw new Error("Invalid admin credentials.");
    const store = getStore(STORE_NAME, { consistency: "strong" });
    const blobs: { key: string }[] = [];
    for await (const page of store.list({ paginate: true })) blobs.push(...page.blobs);
    const records = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<StoredAccount | null>),
    );
    return records
      .filter((r): r is StoredAccount => Boolean(r))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });

const adminDeleteSchema = z.object({ user: z.string(), pass: z.string(), id: z.string() });

/** Admin-only: removes a single stored signup. */
export const deleteStoredAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adminDeleteSchema.parse(d))
  .handler(async ({ data }) => {
    if (!isValidAdmin(data.user, data.pass)) throw new Error("Invalid admin credentials.");
    const store = getStore(STORE_NAME);
    await store.delete(data.id);
    return { ok: true };
  });
