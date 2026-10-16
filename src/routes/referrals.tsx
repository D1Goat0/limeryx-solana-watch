import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, ExternalLink, Gift, RefreshCw, Users } from "lucide-react";
import { useMember } from "@/lib/member-auth";
import { getReferralDashboard, sol } from "@/lib/referrals";
import { memberRequest } from "@/lib/member-api";
import { isSolanaAddress } from "@/lib/wallet-store";

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [{ title: "Referral rewards | Limeryx" }, { name: "robots", content: "noindex" }],
  }),
  component: ReferralPage,
});

function ReferralPage() {
  const { user, ready, error } = useMember();
  if (!ready)
    return (
      <div role="status" className="mx-auto max-w-6xl px-4 py-24">
        Loading rewards...
      </div>
    );
  if (!user)
    return (
      <section className="mx-auto max-w-xl px-4 py-24 text-center">
        <Gift aria-hidden className="mx-auto h-10 w-10 text-primary" />
        <p className="eyebrow mt-6">YOUR NETWORK. YOUR REWARDS.</p>
        <h1 className="mt-6 text-xl">Bring your circle.</h1>
        <p className="mt-6 text-xl text-muted-foreground">
          Create an account to get your personal invite link and follow your SOL rewards.
        </p>
        <Link to="/account" className="action-primary mt-8">
          Create account or sign in <ArrowRight size={16} />
        </Link>
        {error && (
          <p role="alert" className="mt-5 text-destructive">
            {error}
          </p>
        )}
      </section>
    );
  return <ReferralDashboard key={user.id} userId={user.id} verified={Boolean(user.confirmedAt)} />;
}

function ReferralDashboard({ userId, verified }: { userId: string; verified: boolean }) {
  const queryClient = useQueryClient();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [wallet, setWallet] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [copied]);
  const queryKey = ["member-referrals", userId];
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => getReferralDashboard(userId),
    refetchInterval: 30_000,
    retry: 1,
  });
  const claim = useMutation({
    mutationFn: async () => {
      return memberRequest<{ id: string }>("claim", { payout_wallet: wallet.trim() });
    },
    onSuccess: async () => {
      setClaimMessage(
        "Claim requested. Your SOL is reserved while the payout is reviewed. The transfer will appear below once paid.",
      );
      setConfirm(false);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const balance = (status: "pending" | "available" | "claimed" | "paid") =>
    data?.summary?.[`${status}_lamports`] ?? "0";
  const available = balance("available");
  const link = data && origin ? `${origin}/account?ref=${data.code}` : "";
  const canClaim =
    data?.program?.enabled &&
    verified &&
    BigInt(available) >= BigInt(data.program.minimum_claim_lamports) &&
    BigInt(available) > 0n;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">LIMERYX REFERRALS</p>
          <h1 className="mt-5 text-xl sm:text-2xl">
            Good signals travel.
            <br />
            <span className="text-primary">Bring your people.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-xl text-muted-foreground">
            Invite traders. Track your rewards. Claim approved SOL to your wallet.
          </p>
        </div>
        <button onClick={() => void refetch()} disabled={isFetching} className="action-secondary">
          <RefreshCw aria-hidden size={15} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>
      {isPending && (
        <p role="status" className="panel mt-8 p-6">
          Loading your referrals...
        </p>
      )}
      {isError && (
        <div role="alert" className="panel mt-8 p-6">
          <p>Rewards could not be loaded. Please try again shortly.</p>
          <button onClick={() => void refetch()} className="mt-3 text-primary underline">
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          {!data.program?.enabled && (
            <p className="mt-8 border border-primary/30 bg-primary/5 px-5 py-4 text-primary">
              Referral links are ready. SOL reward amounts and claims will open when the rewards
              program launches.
            </p>
          )}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "CLAIMABLE SOL", value: sol(available), accent: true },
              { label: "PENDING REVIEW", value: sol(balance("pending")) },
              { label: "IN CLAIMS", value: sol(balance("claimed")) },
              { label: "TOTAL PAID SOL", value: sol(balance("paid")) },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`panel p-5 sm:p-6 ${stat.accent ? "border-primary/40 bg-primary/5" : ""}`}
              >
                <p className="pixel-text text-[7px] text-muted-foreground sm:text-[8px]">
                  {stat.label}
                </p>
                <p
                  className={`mt-4 break-all font-mono text-2xl sm:text-3xl ${stat.accent ? "text-primary" : "text-foreground"}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-5">
            <section className="panel p-6 lg:col-span-3 sm:p-8">
              <Gift aria-hidden className="h-6 w-6 text-primary" />
              <h2 className="mt-5 text-sm">Your invite link</h2>
              <p className="mt-3 text-muted-foreground">
                Share this link. The referral code is applied when a new member creates their
                account.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label="Your referral link"
                  readOnly
                  value={link}
                  onFocus={(e) => e.target.select()}
                  className="field-input mt-0 min-w-0 flex-1 font-mono text-sm"
                />
                <button
                  disabled={!link}
                  className="action-primary shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(link);
                      setCopied(true);
                      setCopyError("");
                    } catch {
                      setCopyError("Select the link and copy it manually.");
                    }
                  }}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy link"}
                </button>
              </div>
              <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
                {copyError || (copied ? "Referral link copied." : `Your code: ${data.code}`)}
              </p>
              <div className="mt-7 flex flex-wrap gap-7 border-t border-border pt-5">
                <div>
                  <p className="text-2xl text-foreground">{data.summary?.invited_count ?? 0}</p>
                  <p className="text-base text-muted-foreground">Invited members</p>
                </div>
                <div>
                  <p className="text-2xl text-primary">{data.summary?.verified_count ?? 0}</p>
                  <p className="text-base text-muted-foreground">Verified members</p>
                </div>
              </div>
            </section>
            <section className="panel p-6 lg:col-span-2 sm:p-8">
              <h2 className="text-sm">Claim your SOL</h2>
              <p className="mt-4 text-muted-foreground">
                Approved rewards are sent to the public Solana address you enter below. Claims are
                reviewed before payment.
              </p>
              <p className="mt-3 text-base text-primary">
                Minimum claim: {sol(data.program?.minimum_claim_lamports ?? 0)} SOL
              </p>
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canClaim && confirm && isSolanaAddress(wallet) && !claim.isPending) {
                    setClaimMessage("");
                    claim.mutate();
                  }
                }}
              >
                <label className="field-label">
                  Payout wallet
                  <input
                    required
                    value={wallet}
                    onChange={(e) => {
                      setWallet(e.target.value);
                      setConfirm(false);
                    }}
                    className="field-input font-mono text-sm"
                    placeholder="Public Solana address"
                    maxLength={44}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                    className="mt-1 accent-orange-500"
                  />
                  I have checked this address and understand payouts go to this wallet.
                </label>
                <button
                  type="submit"
                  disabled={!canClaim || !confirm || !isSolanaAddress(wallet) || claim.isPending}
                  className="action-primary w-full"
                >
                  {claim.isPending ? "Requesting..." : "Request claim"}
                  <ArrowRight size={16} />
                </button>
              </form>
              {!verified && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Verify your account email before claiming.
                </p>
              )}
              {claim.isError && (
                <p role="alert" className="mt-4 text-base text-destructive">
                  {claim.error.message}
                </p>
              )}
              {claimMessage && (
                <p role="status" className="mt-4 text-base text-primary">
                  {claimMessage}
                </p>
              )}
            </section>
          </div>
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Share your link", d: "Send your personal invite to another trader." },
              {
                n: "02",
                t: "They create an account",
                d: data.program?.enabled
                  ? `After email verification, ${sol(data.program.inviter_lamports)} SOL for the inviter and ${sol(data.program.invitee_lamports)} SOL for the new member enter review.`
                  : "Verified referrals are tracked. Reward amounts will be announced when the program opens.",
              },
              {
                n: "03",
                t: "Request your rewards",
                d: "Approved, funded rewards become claimable. Paid transfers include a mainnet transaction link.",
              },
            ].map((step) => (
              <div className="border-t border-border pt-5" key={step.n}>
                <span className="pixel-text text-[9px] text-primary">{step.n}</span>
                <p className="mt-3 text-xl">{step.t}</p>
                <p className="mt-2 text-base text-muted-foreground">{step.d}</p>
              </div>
            ))}
          </section>
          <section className="panel mt-8 p-6 sm:p-8">
            <h2 className="text-sm">Claim history</h2>
            {data.claims.length === 0 ? (
              <div className="py-10 text-center">
                <Users aria-hidden className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Your first claim starts here.</p>
                <p className="mt-1 text-base text-muted-foreground">
                  Share your link to start building your referral network.
                </p>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[500px] text-left text-base">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="pb-3 font-normal">Requested</th>
                      <th className="pb-3 font-normal">SOL</th>
                      <th className="pb-3 font-normal">Status</th>
                      <th className="pb-3 font-normal">Transfer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.claims.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="py-4">{new Date(item.created_at).toLocaleDateString()}</td>
                        <td className="font-mono text-primary">{sol(item.amount_lamports)}</td>
                        <td className="capitalize">
                          {item.status === "rejected"
                            ? "Returned to balance"
                            : item.status === "requested"
                              ? "In review"
                              : "Paid"}
                        </td>
                        <td>
                          {item.tx_signature ? (
                            <a
                              href={`https://solscan.io/tx/${item.tx_signature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary underline"
                            >
                              View transaction <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">Awaiting transfer</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
