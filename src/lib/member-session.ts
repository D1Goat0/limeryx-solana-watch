import type { Account } from "./wallet-store";

export async function sessionRequest<T>(
  action: "profile" | "prepare",
  account?: Account,
): Promise<T> {
  const response = await fetch(`/.netlify/functions/member-session?action=${action}`, {
    method: account ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: account ? { "Content-Type": "application/json" } : undefined,
    body: account ? JSON.stringify(account) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error || "Could not load your bot account. Please try again.");
  return data as T;
}
