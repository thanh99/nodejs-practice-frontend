"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import api from "@/lib/api";

type FileItem = {
  _id: string;
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  url?: string;
  createdAt: string;
  owner: { username: string; email: string };
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

export default function FilesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [allFiles, setAllFiles] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [lightbox, setLightbox] = useState<FileItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đóng lightbox bằng ESC
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

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchFiles = async () => {
    try {
      const endpoint = allFiles && user?.role === "admin" ? "/files/all" : "/files";
      const { data } = await api.get(endpoint);
      setFiles(data.files);
    } catch {}
  };

  useEffect(() => {
    if (user) fetchFiles();
  }, [user, allFiles]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(
      selectedFiles.length === 1
        ? `Đang upload "${selectedFiles[0].name}"...`
        : `Đang upload ${selectedFiles.length} files...`
    );

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    try {
      const { data } = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadProgress(data.message);
      fetchFiles();
    } catch (err: unknown) {
      setUploadProgress(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Upload thất bại"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadProgress(""), 3000);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa file "${name}"?`)) return;
    try {
      await api.delete(`/files/${id}`);
      setFiles((prev) => prev.filter((f) => f._id !== id));
    } catch {}
  };

  const fileUrl = (file: FileItem) => file.url ?? "";

  const downloadLink = (file: FileItem) => {
    if (!file.url) return "";
    const token = localStorage.getItem("token") ?? "";
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return `${base}/files/${file._id}/download?token=${encodeURIComponent(token)}`;
  };

  if (loading || !user) return null;

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Quản lý File</h1>
          <div className="flex items-center gap-2">
            {user.role === "admin" && (
              <button
                onClick={() => setAllFiles(!allFiles)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  allFiles
                    ? "bg-purple-100 border-purple-300 text-purple-700"
                    : "bg-white border-gray-300 text-gray-600"
                }`}
              >
                {allFiles ? "Tất cả file" : "File của tôi"}
              </button>
            )}
            {/* Toggle view */}
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
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              + Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept="image/*,application/pdf,.doc,.docx,video/*"
              multiple
            />
          </div>
        </div>

        {uploadProgress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
            {uploadProgress}
          </div>
        )}

        {files.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📂</p>
            <p>Chưa có file nào. Hãy upload file đầu tiên!</p>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid view: 2 cột, ảnh/video xem trực tiếp */
          <div className="grid grid-cols-2 gap-4">
            {files.map((file) => (
              <div
                key={file._id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col"
              >
                {/* Preview area — click để phóng to */}
                <div
                  className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                  onClick={() => (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) && openLightbox(file)}
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
                  {/* Overlay hint */}
                  {(file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) && (
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                    </div>
                  )}
                </div>

                {/* Info + actions */}
                <div className="p-3 flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-gray-800 truncate" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                    {allFiles && (
                      <span className="text-xs text-gray-400">@{file.owner?.username}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <a
                      href={fileUrl(file)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Xem
                    </a>
                    {file.url && (
                      <a
                        href={downloadLink(file)}
                        className="text-green-600 hover:underline text-xs"
                      >
                        Tải về
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(file._id, file.originalName)}
                      className="text-red-500 hover:text-red-700 text-xs ml-auto"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop: Table */}
            <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">File</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Loại</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Kích thước</th>
                    {allFiles && (
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Chủ sở hữu</th>
                    )}
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày upload</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <tr key={file._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{getFileIcon(file.mimetype)}</span>
                          <span className="text-gray-800 font-medium truncate max-w-[200px]">
                            {file.originalName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{file.mimetype.split("/")[1]}</td>
                      <td className="px-4 py-3 text-gray-500">{formatBytes(file.size)}</td>
                      {allFiles && (
                        <td className="px-4 py-3 text-gray-500">{file.owner?.username}</td>
                      )}
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <a
                            href={fileUrl(file)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Xem
                          </a>
                          {file.url && (
                            <a
                              href={downloadLink(file)}
                              className="text-green-600 hover:underline text-xs"
                            >
                              Tải về
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(file._id, file.originalName)}
                            className="text-red-500 hover:text-red-700 text-xs"
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

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-3">
              {files.map((file) => (
                <div
                  key={file._id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimetype)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {file.mimetype.split("/")[1]} · {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <a
                        href={fileUrl(file)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 text-sm font-medium"
                      >
                        Xem
                      </a>
                      {file.url && (
                        <a
                          href={downloadLink(file)}
                          className="text-green-600 text-sm font-medium"
                        >
                          Tải về
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(file._id, file.originalName)}
                        className="text-red-500 text-sm font-medium"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{new Date(file.createdAt).toLocaleDateString("vi-VN")}</span>
                    {allFiles && <span>@{file.owner?.username}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
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

