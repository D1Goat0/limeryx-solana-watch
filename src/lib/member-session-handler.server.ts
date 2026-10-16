import { z } from "zod";
import { MemberError } from "./membership-handler.server.ts";
import type { ProfileUser, createMemberProfileStorage } from "./member-profile.server.ts";

type Services = ReturnType<typeof createMemberProfileStorage> & {
  currentUser(): Promise<ProfileUser | null>;
};
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
export function createMemberSessionHandler(services: Services) {
  return async (request: Request) => {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get("action");
      const prepare = action === "prepare" && request.method === "POST";
      if (!prepare && !(action === "profile" && ["GET", "POST"].includes(request.method)))
        return json({ error: "Not found." }, 404);
      if (request.method === "POST" && request.headers.get("origin") !== url.origin)
        return json({ error: "Invalid request origin." }, 403);
      const user = prepare ? null : await services.currentUser();
      if (!prepare && (!user || !z.string().uuid().safeParse(user.id).success))
        return json({ error: "Please sign in to continue." }, 401);
      if (request.method === "GET") return json({ account: await services.getProfile(user!) });
      const body = await request.text();
      if (body.length > 20000) return json({ error: "Request is too large." }, 413);
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        return json({ error: "Invalid account setup." }, 400);
      }
      if (prepare) return json({ id: await services.prepareProfile(data) });
      return json({ account: await services.saveProfile(user!, data) });
    } catch (error) {
      if (error instanceof MemberError) return json({ error: error.message }, error.status);
      if (error instanceof z.ZodError)
        return json(
          { error: "Enter your required bot key, public wallet and account details." },
          400,
        );
      // Do not log request bodies or bot credentials.
      console.error("Member profile storage is unavailable.");
      return json({ error: "Could not save or load your bot account. Please try again." }, 503);
    }
  };
}
