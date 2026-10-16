import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listMemberActivity = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ user: z.string(), pass: z.string() }).parse(value))
  .handler(async ({ data }) => {
    if (
      data.user !== (process.env.ADMIN_USER || "me") ||
      data.pass !== (process.env.ADMIN_PASS || "admin")
    )
      throw new Error("Invalid admin credentials.");
    const { memberProfileStorage } = await import("./member-profile.server.ts");
    return memberProfileStorage.listActivity();
  });
