"use client";

/**
 * Toast Notification System
 *
 * Dạy các khái niệm:
 * 1. ReactDOM.createPortal — render component ra ngoài cây React (vào document.body)
 * 2. Context + custom hook để truy cập toast từ bất kỳ component nào
 * 3. Auto-dismiss với setTimeout + cleanup
 * 4. Animation stacking nhiều toast cùng lúc
 */

import {
  createContext, useCallback, useContext, useRef, useState,
} from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastFn = (message: string, duration?: number) => void;

type ToastCtx = {
  toasts: Toast[];
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  warning: ToastFn;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastCtx>({
  toasts: [],
  success: () => {},
  error: () => {},
  info: () => {},
  warning: () => {},
  dismiss: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Dùng ref để giữ timer cleanup, tránh memory leak
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback((type: ToastType, message: string, duration = 3500) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto-dismiss sau `duration` ms
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{
      toasts,
      success: (msg, dur) => show("success", msg, dur),
      error:   (msg, dur) => show("error",   msg, dur),
      info:    (msg, dur) => show("info",    msg, dur),
      warning: (msg, dur) => show("warning", msg, dur),
      dismiss,
    }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
