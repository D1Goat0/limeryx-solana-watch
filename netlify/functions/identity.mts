import type { UserSignupEvent, UserValidateEvent } from "@netlify/functions";
import { syncMember, validCode } from "../../src/lib/membership-store.server";

function referralFrom(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^[a-f0-9]{16}$/.test(value.toLowerCase()))
    throw new Error("Invalid referral code");
  return value.toLowerCase();
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
