import type { UserLoginEvent, UserSignupEvent, UserValidateEvent } from "@netlify/functions";
import { syncMember, validCode } from "../../src/lib/membership-store.server.ts";
import { REFERRAL_PATTERN } from "../../src/lib/referral-codes.ts";
import { memberProfileStorage } from "../../src/lib/member-profile.server.ts";

function referralFrom(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !REFERRAL_PATTERN.test(value.trim().toLowerCase()))
    throw new Error("Invalid referral code");
  return value.trim().toLowerCase();
}

export default {
  async userValidate(event: UserValidateEvent) {
    if (!event.user.userMetadata?.limeryx_member) return;
    try {
      const code = referralFrom(event.user.userMetadata.referral_code);
      if (code && !(await validCode(code))) return event.deny();
      const setup = event.user.userMetadata.bot_setup_id;
      if (setup != null) {
        if (typeof setup !== "string") return event.deny();
        await memberProfileStorage.validateSetup(setup, event.user.email);
      }
    } catch {
      return event.deny();
    }
  },
  async userSignup(event: UserSignupEvent) {
    if (!event.user.userMetadata?.limeryx_member) return;
    const code = referralFrom(event.user.userMetadata.referral_code);
    const setup = event.user.userMetadata.bot_setup_id;
    if (typeof setup === "string") await memberProfileStorage.linkProfile(event.user, setup);
    await syncMember(event.user.id, code, Boolean(event.user.confirmedAt));
    await memberProfileStorage.logActivity(event.user, "signup");
    // App metadata is server-controlled; later client metadata changes cannot rewrite attribution.
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          limeryx_referral_code: code,
          ...(typeof setup === "string" ? { limeryx_profile_id: setup } : {}),
        },
      },
    };
  },
  async userLogin(event: UserLoginEvent) {
    await memberProfileStorage.logActivity(event.user, "signin");
  },
};
