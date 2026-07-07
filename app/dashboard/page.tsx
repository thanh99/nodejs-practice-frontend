"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";

type Stats = {
  totalFiles: number;
  storageUsed: number;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      api.get("/stats/me").then((r) => setStats(r.data)).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  const statCards = [
    {
      label: "Tổng file của bạn",
      value: stats?.totalFiles ?? "—",
      gradient: "from-blue-500 to-blue-600",
      icon: "📁",
      delay: "delay-100",
    },
    {
      label: "Dung lượng đã dùng",
      value: stats ? formatBytes(stats.storageUsed) : "—",
      gradient: "from-emerald-500 to-teal-600",
      icon: "💾",
      delay: "delay-200",
    },
    {
      label: "Vai trò",
      value: user.role,
      gradient: "from-violet-500 to-purple-600",
      icon: "🎭",
      delay: "delay-300",
    },
  ];

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-1">
            Xin chào, <span className="text-gradient">{user.username}</span>! <span className="animate-wave">👋</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
            {user.role === "admin"
              ? "Bạn đang đăng nhập với quyền Admin"
              : "Chào mừng trở lại!"}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl overflow-hidden shadow-sm card-lift animate-fade-in-up ${card.delay}`}
            >
              <div className={`bg-gradient-to-br ${card.gradient} p-5`}>
                <span className="text-3xl">{card.icon}</span>
                <p className="text-white/80 text-xs mt-2 mb-1">{card.label}</p>
                <p className="text-white text-2xl font-bold capitalize">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/files"
            className="group bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-1 transition-all duration-200 animate-fade-in-up delay-400"
          >
            <div className="text-2xl mb-2">🗂️</div>
            <h3 className="text-lg font-semibold mb-1">Quản lý File</h3>
            <p className="text-blue-100 text-sm">Upload, xem và chia sẻ file của bạn</p>
          </Link>
          <Link
            href="/stats"
            className="group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 hover:border-violet-300 dark:hover:border-violet-600 transition-all duration-200 animate-fade-in-up delay-500"
          >
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">Xem thống kê</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {user.role === "admin" ? "Thống kê toàn bộ hệ thống" : "Thống kê của bạn"}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
