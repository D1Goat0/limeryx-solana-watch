import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUser, handleAuthCallback, onAuthChange, type User } from "@netlify/identity";

type MemberAuth = { user: User | null; ready: boolean; error: string | null };
const MemberContext = createContext<MemberAuth>({ user: null, ready: false, error: null });

// Membership is independent of the existing bot setup and local wallet store.
export function MemberProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MemberAuth>({ user: null, ready: false, error: null });
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
  return <MemberContext.Provider value={state}>{children}</MemberContext.Provider>;
}

export function useMember() {
  return useContext(MemberContext);
}
