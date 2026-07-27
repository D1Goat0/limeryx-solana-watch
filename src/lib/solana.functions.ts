import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RPC = "https://api.mainnet-beta.solana.com";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed (${res.status})`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/** Live SOL market data + Solana network throughput. */
export const getNetworkStats = createServerFn({ method: "GET" }).handler(async () => {
  const [priceRes, epoch, samples, supply] = await Promise.all([
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_market_cap=true",
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    rpc<{ absoluteSlot: number; epoch: number }>("getEpochInfo", []).catch(() => null),
    rpc<Array<{ numTransactions: number; samplePeriodSecs: number }>>(
      "getRecentPerformanceSamples",
      [1],
    ).catch(() => null),
    rpc<{ value: { total: number; circulating: number } }>("getSupply", [
      { excludeNonCirculatingAccountsList: true },
    ]).catch(() => null),
  ]);

  const sample = samples?.[0];
  const p = (priceRes as { solana?: { usd: number; usd_24h_change: number; usd_market_cap: number } } | null)
    ?.solana;

  return {
    priceUsd: p?.usd ?? null,
    change24h: p?.usd_24h_change ?? null,
    marketCap: p?.usd_market_cap ?? null,
    slot: epoch?.absoluteSlot ?? null,
    epoch: epoch?.epoch ?? null,
    tps: sample ? Math.round(sample.numTransactions / sample.samplePeriodSecs) : null,
    circulating: supply?.value.circulating ? supply.value.circulating / 1e9 : null,
    fetchedAt: new Date().toISOString(),
  };
});

const addressSchema = z.object({ address: z.string().trim().min(32).max(44) });

/** Real balance + most recent signed activity for any Solana wallet. */
export const getWallet = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ data }) => {
    const [balance, sigs] = await Promise.all([
      rpc<{ value: number }>("getBalance", [data.address]),
      rpc<Array<{ signature: string; slot: number; blockTime: number | null; err: unknown }>>(
        "getSignaturesForAddress",
        [data.address, { limit: 12 }],
      ),
    ]);

    return {
      address: data.address,
      sol: balance.value / 1e9,
      activity: sigs.map((s) => ({
        signature: s.signature,
        slot: s.slot,
        blockTime: s.blockTime,
        failed: Boolean(s.err),
      })),
    };
  });

/**
 * Daily top traders: scans the most recent finalized blocks and ranks fee
 * payers by transaction count — real on-chain activity, no mock data.
 */
export const getTopTraders = createServerFn({ method: "GET" }).handler(async () => {
  const slot = await rpc<number>("getSlot", [{ commitment: "finalized" }]);
  const slots = [slot, slot - 1, slot - 2];

  const blocks = await Promise.all(
    slots.map((s) =>
      rpc<{
        blockTime: number | null;
        transactions: Array<{
          transaction: { accountKeys?: Array<{ pubkey: string; signer: boolean }> };
          meta: { fee: number; err: unknown } | null;
        }>;
      }>("getBlock", [
        s,
        {
          encoding: "jsonParsed",
          transactionDetails: "accounts",
          rewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ]).catch(() => null),
    ),
  );

  const tally = new Map<string, { txs: number; fees: number; failed: number }>();
  let scanned = 0;

  for (const block of blocks) {
    if (!block) continue;
    for (const tx of block.transactions ?? []) {
      scanned++;
      const payer = tx.transaction.accountKeys?.find((k) => k.signer)?.pubkey;
      if (!payer) continue;
      const row = tally.get(payer) ?? { txs: 0, fees: 0, failed: 0 };
      row.txs += 1;
      row.fees += (tx.meta?.fee ?? 0) / 1e9;
      if (tx.meta?.err) row.failed += 1;
      tally.set(payer, row);
    }
  }

  const traders = [...tally.entries()]
    .map(([address, v]) => ({ address, ...v }))
    .sort((a, b) => b.txs - a.txs)
    .slice(0, 10);

  return {
    traders,
    scannedTx: scanned,
    slots: slots.filter((_, i) => blocks[i]),
    fetchedAt: new Date().toISOString(),
  };
});
