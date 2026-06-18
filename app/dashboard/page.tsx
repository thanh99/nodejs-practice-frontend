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

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">
          Xin chào, {user.username}! 👋
        </h1>
        <p className="text-gray-500 mb-6 text-sm sm:text-base">
          {user.role === "admin" ? "Bạn đang đăng nhập với quyền Admin" : "Tài khoản người dùng"}
        </p>

        {/* Cards thống kê nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">Tổng file của bạn</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{stats?.totalFiles ?? "—"}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">Dung lượng đã dùng</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {stats ? formatBytes(stats.storageUsed) : "—"}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">Role</p>
            <p className="text-3xl font-bold text-purple-600 mt-1 capitalize">{user.role}</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Link href="/files" className="bg-blue-600 text-white p-6 rounded-xl hover:bg-blue-700 transition-colors">
            <h3 className="text-lg font-semibold mb-1">Quản lý File</h3>
            <p className="text-blue-100 text-sm">Upload, xem và xóa file của bạn</p>
          </Link>
          <Link href="/stats" className="bg-white border border-gray-200 p-6 rounded-xl hover:border-blue-300 transition-colors">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Xem thống kê</h3>
            <p className="text-gray-500 text-sm">
              {user.role === "admin" ? "Thống kê toàn bộ hệ thống" : "Thống kê của bạn"}
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
