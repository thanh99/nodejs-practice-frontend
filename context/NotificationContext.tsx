"use client";

import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import api from "@/lib/api";

export type NotifType = "file_shared" | "share_revoked";

export type Notification = {
  _id: string;
  type: NotifType;
  message: string;
  read: boolean;
  createdAt: string;
  fromUser?: { username: string };
  file?: { _id: string; originalName: string };
};

type NCtx = {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotif: (id: string) => Promise<void>;
};

const NotificationContext = createContext<NCtx>({
  notifications: [],
  unreadCount: 0,
  markRead: async () => {},
  markAllRead: async () => {},
  deleteNotif: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user) {
      // Ngắt socket và reset khi đăng xuất
      socketRef.current?.disconnect();
      socketRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();

    const token = localStorage.getItem("token");
    if (!token) return;

    // Lấy base URL của socket từ API URL (bỏ /api ở cuối)
    const socketUrl =
      (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api$/, "");

    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      // socket connected
    });

    // Nhận thông báo real-time từ server
    socket.on("notification:new", (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    socket.on("connect_error", () => {
      // silent — server có thể chưa start
    });

    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const deleteNotif = useCallback(
    async (id: string) => {
      const notif = notifications.find((n) => n._id === id);
      try {
        await api.delete(`/notifications/${id}`);
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        if (notif && !notif.read) setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    },
    [notifications]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead, deleteNotif }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
