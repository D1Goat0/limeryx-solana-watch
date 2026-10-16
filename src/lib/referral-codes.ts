export const OFFICIAL_REFERRAL_CODE = "dtofficial";
// Keep existing personal links valid alongside the one approved official campaign.
export const REFERRAL_PATTERN = /^(?:[a-f0-9]{16}|dtofficial)$/;
export function isOfficialReferral(code: string | null) {
  return code?.trim().toLowerCase() === OFFICIAL_REFERRAL_CODE;
}
