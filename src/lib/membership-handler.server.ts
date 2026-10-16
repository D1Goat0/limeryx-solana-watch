import { z } from "zod";
import type { MemberUser, ReferralDashboard } from "./member-api.ts";

export class MemberError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export type MembershipServices = {
  currentUser(): Promise<MemberUser | null>;
  validCode(code: string): Promise<boolean>;
  dashboard(user: MemberUser): Promise<ReferralDashboard>;
  claim(user: MemberUser, wallet: string): Promise<string>;
};

const claimSchema = z
  .object({
    payout_wallet: z
      .string()
      .trim()
      .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/),
  })
  .strict();
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      Vary: "Cookie",
    },
  });
}

// Identity always comes from a verified server session; request bodies cannot select a member.
export function createMembershipHandler(services: MembershipServices) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get("action");
      if (request.method === "GET" && action === "valid") {
        const code = url.searchParams.get("code") ?? "";
        return json({ valid: /^[a-f0-9]{16}$/.test(code) && (await services.validCode(code)) });
      }
      if (
        !(request.method === "GET" && action === "dashboard") &&
        !(request.method === "POST" && action === "claim")
      )
        return json({ error: "Not found." }, 404);
      if (request.method === "POST" && request.headers.get("origin") !== url.origin)
        return json({ error: "Invalid request origin." }, 403);
      const user = await services.currentUser();
      if (!user || !z.string().uuid().safeParse(user.id).success)
        return json({ error: "Please sign in to continue." }, 401);
      if (action === "dashboard") return json(await services.dashboard(user));
      if (!user.confirmedAt)
        return json({ error: "Verify your email before requesting a claim." }, 403);
      const body = await request.text();
      if (body.length > 2048) return json({ error: "Request is too large." }, 413);
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json({ error: "Invalid request." }, 400);
      }
      const result = claimSchema.safeParse(parsed);
      if (!result.success)
        return json({ error: "Enter a valid public Solana payout address." }, 400);
      return json({ id: await services.claim(user, result.data.payout_wallet) });
    } catch (cause) {
      if (cause instanceof MemberError) return json({ error: cause.message }, cause.status);
      console.error(
        "Membership service failed",
        cause instanceof Error ? cause.message : "Unknown error",
      );
      return json(
        { error: "Rewards service is temporarily unavailable. Please try again shortly." },
        503,
      );
    }
  };
}
