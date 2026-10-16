export type MemberUser = { id: string; email?: string; confirmedAt?: string };
export type ReferralDashboard = {
  code: string;
  summary: {
    invited_count: number;
    verified_count: number;
    pending_lamports: string;
    available_lamports: string;
    claimed_lamports: string;
    paid_lamports: string;
  };
  program: {
    enabled: boolean;
    inviter_lamports: string;
    invitee_lamports: string;
    minimum_claim_lamports: string;
  };
  claims: {
    id: string;
    amount_lamports: string;
    payout_wallet: string;
    status: "requested" | "paid" | "rejected";
    tx_signature: string | null;
    created_at: string;
  }[];
};

export async function memberRequest<T>(
  action: string,
  payload?: object,
  params?: Record<string, string>,
): Promise<T> {
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`/.netlify/functions/membership?${query}`, {
    method: payload ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(
      data?.error || "Account service is temporarily unavailable. Please try again shortly.",
    );
  return data as T;
}
