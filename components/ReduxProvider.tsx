"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "@/store/store";
import { hydrate } from "@/store/authSlice";

function SessionHydrator({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    store.dispatch(hydrate(token && user ? { token, user: JSON.parse(user) } : null));
  }, []);

  return <>{children}</>;
}

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SessionHydrator>{children}</SessionHydrator>
    </Provider>
  );
}
