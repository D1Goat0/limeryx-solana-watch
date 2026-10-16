import { memberRequest, type ReferralDashboard } from "./member-api";

export const REFERRAL_PATTERN = /^[a-f0-9]{16}$/;
export function sol(lamports: number | string) {
  const amount = BigInt(lamports);
  const whole = amount / 1_000_000_000n;
  const fraction = (amount % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

export async function validReferral(code: string) {
  if (!REFERRAL_PATTERN.test(code)) return false;
  const data = await memberRequest<{ valid: boolean }>("valid", undefined, { code });
  return data.valid;
}

export async function getReferralDashboard(_userId: string) {
  return memberRequest<ReferralDashboard>("dashboard");
}
