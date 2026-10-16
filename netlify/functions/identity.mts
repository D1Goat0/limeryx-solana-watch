import type { UserSignupEvent, UserValidateEvent } from "@netlify/functions";
import { syncMember, validCode } from "../../src/lib/membership-store.server.ts";
import { REFERRAL_PATTERN } from "../../src/lib/referral-codes.ts";

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
    } catch {
      return event.deny();
    }
  },
  async userSignup(event: UserSignupEvent) {
    if (!event.user.userMetadata?.limeryx_member) return;
    const code = referralFrom(event.user.userMetadata.referral_code);
    await syncMember(event.user.id, code, Boolean(event.user.confirmedAt));
    // App metadata is server-controlled; later client metadata changes cannot rewrite attribution.
    return {
      user: {
        ...event.user,
        appMetadata: { ...event.user.appMetadata, limeryx_referral_code: code },
      },
    };
  },
};
