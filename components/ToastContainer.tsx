"use client";

/**
 * ToastContainer — render danh sách toast ra ngoài React tree bằng createPortal.
 *
 * Tại sao dùng createPortal?
 * - Toast cần đè lên mọi thứ (z-index cao nhất)
 * - Nếu render trong component thường, nó bị ảnh hưởng bởi overflow/stacking context của cha
 * - createPortal gắn thẳng vào document.body → thoát khỏi mọi CSS cha
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useToast, type Toast } from "@/context/ToastContext";

const ICONS: Record<string, string> = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
  warning: "⚠",
};

const STYLES: Record<string, string> = {
  success: "bg-emerald-500",
  error:   "bg-red-500",
  info:    "bg-blue-500",
  warning: "bg-amber-500",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  // Trigger animation vào sau 1 frame
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm max-w-sm pointer-events-auto
        transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}
        ${STYLES[toast.type]}`}
    >
      <span className="text-base font-bold flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
        {ICONS[toast.type]}
      </span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors text-xs ml-1 mt-0.5"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  // Portal chỉ hoạt động phía client, cần check mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    // pointer-events-none trên container để không chặn click bên dưới
    // pointer-events-auto trên từng toast để vẫn click được
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>,
    document.body
  );
}
