import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getUser, handleAuthCallback, onAuthChange, type User } from "@netlify/identity";
import { saveAccount, type Account } from "./wallet-store";
import { sessionRequest } from "./member-session";

type MemberAuth = {
  user: User | null;
  ready: boolean;
  error: string | null;
  profileReady: boolean;
  profileError: string | null;
  linkedAccount: Account | null;
};
const MemberContext = createContext<MemberAuth>({
  user: null,
  ready: false,
  error: null,
  profileReady: false,
  profileError: null,
  linkedAccount: null,
});

function clearBotAccount() {
  try {
    localStorage.removeItem("limeryx.account");
  } catch {
    /* Storage can be disabled. */
  }
  window.dispatchEvent(new Event("limeryx:account"));
}
function cachedAccount(email?: string): Account | null {
  try {
    const account = JSON.parse(localStorage.getItem("limeryx.account") || "null") as Account | null;
    return account?.email?.toLowerCase() === email?.toLowerCase() ? account : null;
  } catch {
    return null;
  }
}
export function MemberProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    user: null as User | null,
    ready: false,
    error: null as string | null,
  });
  const [profileState, setProfileState] = useState({
    userId: null as string | null,
    ready: true,
    error: null as string | null,
    account: null as Account | null,
  });
  const previousMember = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = onAuthChange((_event, user) => {
      receivedEvent = true;
      if (active) setState({ user, ready: true, error: null });
    });
    void (async () => {
      try {
        const callback = await handleAuthCallback();
        if (callback?.type === "recovery") {
          window.location.replace("/account?recovery=1");
          return;
        }
        const user = await getUser();
        if (active && !receivedEvent) setState({ user, ready: true, error: null });
      } catch {
        if (active)
          setState({
            user: null,
            ready: true,
            error: "Your sign-in link could not be completed. Please sign in again.",
          });
      }
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!state.ready) return;
    let active = true;
    const user = state.user;
    if (!user) {
      if (previousMember.current) clearBotAccount();
      previousMember.current = null;
      setProfileState({ userId: null, ready: true, error: null, account: null });
      return;
    }
    previousMember.current = user.id;
    const local = cachedAccount(user.email);
    if (!local) clearBotAccount();
    setProfileState({ userId: user.id, ready: false, error: null, account: null });
    void (async () => {
      try {
        let { account } = await sessionRequest<{ account: Account | null }>("profile");
        if (!active) return;
        if (!account && local?.wallet && local.limeKey)
          ({ account } = await sessionRequest<{ account: Account | null }>("profile", local));
        if (!active) return;
        if (account) {
          if (local?.wallet === account.wallet) account.watchlist = local.watchlist;
          try {
            saveAccount(account);
          } catch {
            /* Keep the restored account available in memory. */
          }
        } else clearBotAccount();
        setProfileState({ userId: user.id, ready: true, error: null, account });
      } catch (cause) {
        if (active)
          setProfileState({
            userId: user.id,
            ready: true,
            error: cause instanceof Error ? cause.message : "Could not restore your bot account.",
            account: local,
          });
      }
    })();
    return () => {
      active = false;
    };
  }, [state.ready, state.user?.id, state.user?.email]);
  const profileReady =
    state.ready && (!state.user || (profileState.userId === state.user.id && profileState.ready));
  return (
    <MemberContext.Provider
      value={{
        ...state,
        profileReady,
        profileError: profileState.error,
        linkedAccount: state.user?.id === profileState.userId ? profileState.account : null,
      }}
    >
      {children}
    </MemberContext.Provider>
  );
}
export function useMember() {
  return useContext(MemberContext);
}
