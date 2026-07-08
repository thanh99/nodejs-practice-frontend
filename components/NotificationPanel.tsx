"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotifications, type Notification } from "@/context/NotificationContext";

const ICONS: Record<string, string> = {
  file_shared:   "📨",
  share_revoked: "🚫",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
}

type Props = {
  onClose: () => void;
};

export default function NotificationPanel({ onClose }: Props) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleClickNotif = (n: Notification) => {
    if (!n.read) markRead(n._id);

    // file_shared → chuyển đến tab "File được chia sẻ"
    if (n.type === "file_shared" && n.file) {
      onClose();
      router.push(`/files?tab=received&fileId=${n.file._id}`);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-slide-down"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Thông báo</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-2">🔕</p>
            <p className="text-sm">Không có thông báo nào</p>
          </div>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li
                key={n._id}
                onClick={() => handleClickNotif(n)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors ${
                  n.read
                    ? "hover:bg-gray-50 dark:hover:bg-gray-700/40"
                    : "bg-blue-50/60 dark:bg-blue-900/15 hover:bg-blue-50 dark:hover:bg-blue-900/25"
                }`}
              >
                {/* Icon */}
                <span className="text-xl flex-shrink-0 mt-0.5">{ICONS[n.type] ?? "🔔"}</span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${n.read ? "text-gray-600 dark:text-gray-400" : "text-gray-800 dark:text-gray-100 font-medium"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>

                {/* Unread dot + Delete */}
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotif(n._id); }}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 text-xs transition-colors leading-none"
                    title="Xóa thông báo"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
