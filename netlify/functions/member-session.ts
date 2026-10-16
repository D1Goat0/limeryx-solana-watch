import { admin, getUser } from "@netlify/identity";
import { memberProfileStorage } from "../../src/lib/member-profile.server.ts";
import { createMemberSessionHandler } from "../../src/lib/member-session-handler.server.ts";

export default createMemberSessionHandler({
  ...memberProfileStorage,
  async currentUser() {
    const session = await getUser();
    return session ? admin.getUser(session.id) : null;
  },
});
