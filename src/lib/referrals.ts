import { memberRequest, type ReferralDashboard } from "./member-api";
import { REFERRAL_PATTERN } from "./referral-codes.ts";

export { REFERRAL_PATTERN };
export function sol(lamports: number | string) {
  const amount = BigInt(lamports);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export async function validReferral(code: string) {
  code = code.trim().toLowerCase();
  if (!REFERRAL_PATTERN.test(code)) return false;
  const data = await memberRequest<{ valid: boolean }>("valid", undefined, { code });
  return data.valid;
}

export async function getReferralDashboard(_userId: string) {
  return memberRequest<ReferralDashboard>("dashboard");
}
