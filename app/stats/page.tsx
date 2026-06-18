"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";

type AdminStats = {
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  filesByDay: { _id: string; count: number; size: number }[];
  usersByDay: { _id: string; count: number }[];
};

type UserStats = {
  totalFiles: number;
  storageUsed: number;
  filesByDay: { _id: string; count: number }[];
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Component mini bar chart đơn giản
function BarChart({ data, label }: { data: { _id: string; count: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div>
      <p className="text-sm font-medium text-gray-600 mb-3">{label}</p>
      {data.length === 0 ? (
        <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
      ) : (
        <>
          {/* Hàng 1: chỉ chứa các thanh bar, items-end để căn đáy */}
          <div className="flex items-end gap-1 sm:gap-2 h-20">
            {data.map((d) => (
              <div
                key={d._id}
                className="flex-1 bg-blue-500 rounded-t"
                style={{ height: `${(d.count / max) * 100}%`, minHeight: "4px" }}
              />
            ))}
          </div>
          {/* Hàng 2: label ngày + số đếm, tách riêng để không bị che */}
          <div className="flex gap-1 sm:gap-2 mt-1">
            {data.map((d) => (
              <div key={d._id} className="flex-1 text-center">
                <p className="text-xs text-gray-400 truncate">{d._id.slice(5)}</p>
                <p className="text-xs font-semibold text-gray-600">{d.count}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "admin") {
      api.get("/stats/admin").then((r) => setAdminStats(r.data)).catch(() => {});
    } else {
      api.get("/stats/me").then((r) => setUserStats(r.data)).catch(() => {});
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6">
          {user.role === "admin" ? "Thống kê hệ thống" : "Thống kê của bạn"}
        </h1>

        {/* ADMIN VIEW */}
        {user.role === "admin" && adminStats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">Tổng số User</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{adminStats.totalUsers}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">Tổng số File</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{adminStats.totalFiles}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">Tổng dung lượng</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {formatBytes(adminStats.totalStorage)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
                <BarChart data={adminStats.filesByDay} label="File upload theo ngày (7 ngày gần nhất)" />
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200">
                <BarChart data={adminStats.usersByDay} label="User đăng ký theo ngày (7 ngày gần nhất)" />
              </div>
            </div>
          </>
        )}

        {/* USER VIEW */}
        {user.role !== "admin" && userStats && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">File của bạn</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{userStats.totalFiles}</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <p className="text-sm text-gray-500">Dung lượng đã dùng</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {formatBytes(userStats.storageUsed)}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <BarChart data={userStats.filesByDay} label="File upload theo ngày (7 ngày gần nhất)" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
