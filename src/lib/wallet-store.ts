import { useCallback, useEffect, useState } from "react";

const KEY = "limeryx.account";

export type Account = {
  handle: string;
  terminal: string;
  wallet: string;
  watchlist: string[];
};

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaAddress(v: string) {
  return BASE58.test(v.trim());
}

function read(): Account | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Account;
    return a && typeof a.wallet === "string" ? { ...a, watchlist: a.watchlist ?? [] } : null;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account) {
  localStorage.setItem(KEY, JSON.stringify(a));
  window.dispatchEvent(new Event("limeryx:account"));
}

/** Hydration-safe account state backed by localStorage. */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setAccount(read());
    sync();
    setReady(true);
    window.addEventListener("limeryx:account", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("limeryx:account", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: Account) => saveAccount(next), []);

  const addWatch = useCallback(
    (address: string) => {
      const a = read();
      if (!a || !isSolanaAddress(address)) return;
      const addr = address.trim();
      if (a.watchlist.includes(addr)) return;
      saveAccount({ ...a, watchlist: [...a.watchlist, addr] });
    },
    [],
  );

  const removeWatch = useCallback((address: string) => {
    const a = read();
    if (!a) return;
    saveAccount({ ...a, watchlist: a.watchlist.filter((w) => w !== address) });
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("limeryx:account"));
  }, []);

  return { account, ready, update, addWatch, removeWatch, signOut };
}

type Provider = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
};

/** Read-only Phantom connect — returns the public address, never a secret key. */
export async function connectPhantom(): Promise<string> {
  const provider = (window as unknown as { solana?: Provider }).solana;
  if (!provider?.isPhantom) {
    throw new Error("No Phantom wallet detected in this browser. Paste your address instead.");
  }
  const res = await provider.connect();
  return res.publicKey.toString();
}
