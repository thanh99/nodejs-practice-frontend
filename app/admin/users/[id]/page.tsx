"use client";

import { useEffect, useRef, useState } from "react";
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
  url?: string;
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
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [lightbox, setLightbox] = useState<FileItem | null>(null);
  const [zoom, setZoom] = useState(1);

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

  // ESC để đóng lightbox
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openLightbox = (file: FileItem) => {
    setLightbox(file);
    setZoom(1);
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    setLightbox(null);
    setZoom(1);
    document.body.style.overflow = "";
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)));
  };

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
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">File đã upload ({files.length})</h2>
            {files.length > 0 && (
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    viewMode === "table"
                      ? "bg-gray-800 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  title="Dạng bảng"
                >
                  ☰
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    viewMode === "grid"
                      ? "bg-gray-800 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  title="Dạng lưới"
                >
                  ⊞
                </button>
              </div>
            )}
          </div>

          {files.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Chưa có file nào</div>
          ) : viewMode === "grid" ? (
            /* Grid view */
            <div className="grid grid-cols-2 gap-4 p-4">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden flex flex-col"
                >
                  {/* Preview */}
                  <div
                    className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                    onClick={() =>
                      (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) &&
                      openLightbox(file)
                    }
                  >
                    {file.mimetype.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={file.url}
                        alt={file.originalName}
                        className="w-full h-full object-cover"
                      />
                    ) : file.mimetype.startsWith("video/") ? (
                      <video
                        src={file.url}
                        className="w-full h-full object-contain bg-black pointer-events-none"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400 cursor-default">
                        <span className="text-5xl">{getFileIcon(file.mimetype)}</span>
                        <span className="text-xs uppercase tracking-wide">
                          {file.mimetype.split("/")[1]}
                        </span>
                      </div>
                    )}
                    {(file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) && (
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-800 truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    {file.url && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        Xem gốc
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table view */
            <div className="divide-y divide-gray-100">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
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
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline flex-shrink-0 ml-3"
                    >
                      Xem
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={closeLightbox}
        >
          {/* Toolbar */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white text-sm truncate max-w-xs">{lightbox.originalName}</span>
            <div className="flex items-center gap-2">
              {lightbox.mimetype.startsWith("image/") && (
                <>
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <span className="text-white text-sm w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className="px-2 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                  >
                    Reset
                  </button>
                </>
              )}
              <button
                onClick={closeLightbox}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors ml-2"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            className="flex-1 flex items-center justify-center overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onWheel={lightbox.mimetype.startsWith("image/") ? handleWheel : undefined}
          >
            {lightbox.mimetype.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.originalName}
                style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease" }}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-w-full max-h-full"
              />
            )}
          </div>

          <p className="text-center text-white/40 text-xs pb-3 flex-shrink-0">
            {lightbox.mimetype.startsWith("image/")
              ? "Scroll chuột hoặc dùng nút +/− để zoom • ESC để đóng"
              : "ESC để đóng"}
          </p>
        </div>
      )}
    </div>
  );
}
