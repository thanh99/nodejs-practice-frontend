"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import adminApi from "@/lib/adminApi";

type User = {
  _id: string;
  username: string;
  email: string;
  role: string;
  storageUsed: number;
  fileCount: number;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      router.replace("/admin");
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await adminApi.get("/admin/users");
      setUsers(data.users);
    } catch {
      router.replace("/admin");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Bạn có chắc muốn xóa user "${username}"?\nToàn bộ file của họ cũng sẽ bị xóa.`))
      return;
    try {
      await adminApi.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch {
      alert("Xóa thất bại");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Admin Navbar */}
      <nav className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">🔐 Admin Panel</span>
          <span className="text-gray-400 text-sm hidden sm:inline">Quản lý người dùng</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-red-400 hover:text-red-300 transition-colors"
        >
          Đăng xuất
        </button>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500">Tổng người dùng</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{users.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500">Tổng file</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {users.reduce((s, u) => s + u.fileCount, 0)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-500">Dung lượng tổng</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {formatBytes(users.reduce((s, u) => s + u.storageUsed, 0))}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Danh sách người dùng</h2>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Người dùng</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Role</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">File</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Dung lượng</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày tạo</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user._id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {user.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.fileCount}</td>
                    <td className="px-4 py-3 text-gray-500">{formatBytes(user.storageUsed)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/users/${user._id}`}
                          className="text-xs text-gray-600 hover:text-blue-600"
                        >
                          Xem
                        </Link>
                        <Link
                          href={`/admin/users/${user._id}/edit`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Sửa
                        </Link>
                        <button
                          onClick={() => handleDelete(user._id, user.username)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user._id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link
                    href={`/admin/users/${user._id}`}
                    className="font-medium text-blue-600"
                  >
                    {user.username}
                  </Link>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{user.email}</p>
                <p className="text-xs text-gray-400">
                  {user.fileCount} file · {formatBytes(user.storageUsed)} ·{" "}
                  {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                </p>
                <div className="flex gap-4 mt-3">
                  <Link href={`/admin/users/${user._id}`} className="text-sm text-gray-600">
                    Xem
                  </Link>
                  <Link href={`/admin/users/${user._id}/edit`} className="text-sm text-blue-600">
                    Sửa
                  </Link>
                  <button
                    onClick={() => handleDelete(user._id, user.username)}
                    className="text-sm text-red-500"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
