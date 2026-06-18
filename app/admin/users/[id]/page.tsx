"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import adminApi from "@/lib/adminApi";

type User = {
  _id: string;
  username: string;
  email: string;
  role: string;
  storageUsed: number;
  createdAt: string;
};

type FileItem = {
  _id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(mimetype: string) {
  if (mimetype.startsWith("image/")) return "🖼️";
  if (mimetype === "application/pdf") return "📄";
  if (mimetype.startsWith("video/")) return "🎬";
  return "📁";
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("adminToken")) {
      router.replace("/admin");
      return;
    }
    adminApi
      .get(`/admin/users/${id}`)
      .then(({ data }) => {
        setUser(data.user);
        setFiles(data.files);
      })
      .catch(() => router.replace("/admin/dashboard"))
      .finally(() => setLoading(false));
  }, [id]);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000";

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Đang tải...</div>;
  if (!user) return null;

  return (
    <div>
      <nav className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">
          ← Quay lại
        </button>
        <span className="text-gray-600">|</span>
        <span className="font-semibold">Chi tiết người dùng</span>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Thông tin cơ bản */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-lg">Thông tin tài khoản</h2>
            <Link
              href={`/admin/users/${user._id}/edit`}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Chỉnh sửa
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Username", value: user.username },
              { label: "Email", value: user.email },
              { label: "Role", value: user.role },
              { label: "Dung lượng đã dùng", value: formatBytes(user.storageUsed) },
              { label: "Ngày tạo", value: new Date(user.createdAt).toLocaleDateString("vi-VN") },
              { label: "Tổng file", value: `${files.length} file` },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                <p className="text-sm font-medium text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Danh sách file */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">File đã upload ({files.length})</h2>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Chưa có file nào</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {files.map((file) => (
                <div key={file._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{getFileIcon(file.mimetype)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.originalName}</p>
                      <p className="text-xs text-gray-400">
                        {file.mimetype.split("/")[1]} · {formatBytes(file.size)} ·{" "}
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`${baseUrl}/uploads/${file.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex-shrink-0 ml-3"
                  >
                    Xem
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
