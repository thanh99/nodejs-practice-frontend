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

type ShareItem = {
  _id: string;
  file: {
    _id: string;
    originalName: string;
    mimetype: string;
    size: number;
    url?: string;
    createdAt: string;
  };
  sharedBy: { username: string; email: string };
  sharedTo: { username: string; email: string };
  createdAt: string;
};

type Tab = "mine" | "received" | "sent";

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

  const [tab, setTab] = useState<Tab>("mine");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [receivedShares, setReceivedShares] = useState<ShareItem[]>([]);
  const [sentShares, setSentShares] = useState<ShareItem[]>([]);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [allFiles, setAllFiles] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [lightbox, setLightbox] = useState<{ url: string; name: string; mimetype: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  const [shareModal, setShareModal] = useState<FileItem | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        document.body.style.overflow = "";
        setShareModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const fetchReceivedShares = async () => {
    try {
      const { data } = await api.get("/shares/received");
      setReceivedShares(data.shares);
    } catch {}
  };

  const fetchSentShares = async () => {
    try {
      const { data } = await api.get("/shares/sent");
      setSentShares(data.shares);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    if (tab === "mine") fetchFiles();
    else if (tab === "received") fetchReceivedShares();
    else if (tab === "sent") fetchSentShares();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, allFiles]);

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

  const handleShare = async () => {
    if (!shareModal || !shareInput.trim()) return;
    setShareLoading(true);
    setShareMsg(null);
    try {
      const { data } = await api.post("/shares", {
        fileId: shareModal._id,
        identifier: shareInput.trim(),
      });
      setShareMsg({ type: "success", text: data.message });
      setShareInput("");
    } catch (err: unknown) {
      setShareMsg({
        type: "error",
        text:
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Chia sẻ thất bại",
      });
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm("Thu hồi chia sẻ này?")) return;
    try {
      await api.delete(`/shares/${shareId}`);
      setSentShares((prev) => prev.filter((s) => s._id !== shareId));
    } catch {}
  };

  const downloadLink = (fileId: string) => {
    const token = localStorage.getItem("token") ?? "";
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    return `${base}/files/${fileId}/download?token=${encodeURIComponent(token)}`;
  };

  const openLightbox = (url: string, name: string, mimetype: string) => {
    setLightbox({ url, name, mimetype });
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

  const openShareModal = (file: FileItem) => {
    setShareModal(file);
    setShareInput("");
    setShareMsg(null);
  };

  if (loading || !user) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "mine", label: "File của tôi" },
    { key: "received", label: "File được chia sẻ" },
    { key: "sent", label: "File đã chia sẻ" },
  ];

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
              {key === "received" && receivedShares.length > 0 && (
                <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                  {receivedShares.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: File của tôi ===== */}
        {tab === "mine" && (
          <>
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
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
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
              <div className="grid grid-cols-2 gap-4">
                {files.map((file) => (
                  <div key={file._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    <div
                      className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                      onClick={() =>
                        (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) &&
                        openLightbox(file.url ?? "", file.originalName, file.mimetype)
                      }
                    >
                      {file.mimetype.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
                      ) : file.mimetype.startsWith("video/") ? (
                        <video src={file.url} className="w-full h-full object-contain bg-black pointer-events-none" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 cursor-default">
                          <span className="text-5xl">{getFileIcon(file.mimetype)}</span>
                          <span className="text-xs uppercase tracking-wide">{file.mimetype.split("/")[1]}</span>
                        </div>
                      )}
                      {(file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) && (
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate" title={file.originalName}>
                        {file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
                        {allFiles && <span className="text-xs text-gray-400">@{file.owner?.username}</span>}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <a href={file.url ?? ""} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                        {file.url && <a href={downloadLink(file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>}
                        <button onClick={() => openShareModal(file)} className="text-indigo-600 hover:text-indigo-800 text-xs">Chia sẻ</button>
                        <button onClick={() => handleDelete(file._id, file.originalName)} className="text-red-500 hover:text-red-700 text-xs ml-auto">Xóa</button>
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
                        {allFiles && <th className="text-left px-4 py-3 text-gray-500 font-medium">Chủ sở hữu</th>}
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
                              <span className="text-gray-800 font-medium truncate max-w-[200px]">{file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500">{formatBytes(file.size)}</td>
                          {allFiles && <td className="px-4 py-3 text-gray-500">{file.owner?.username}</td>}
                          <td className="px-4 py-3 text-gray-500">{new Date(file.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <a href={file.url ?? ""} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                              {file.url && <a href={downloadLink(file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>}
                              <button onClick={() => openShareModal(file)} className="text-indigo-600 hover:text-indigo-800 text-xs">Chia sẻ</button>
                              <button onClick={() => handleDelete(file._id, file.originalName)} className="text-red-500 hover:text-red-700 text-xs">Xóa</button>
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
                    <div key={file._id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimetype)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{file.originalName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{file.mimetype.split("/")[1]} · {formatBytes(file.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          <a href={file.url ?? ""} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium">Xem</a>
                          {file.url && <a href={downloadLink(file._id)} className="text-green-600 text-sm font-medium">Tải về</a>}
                          <button onClick={() => openShareModal(file)} className="text-indigo-600 text-sm font-medium">Chia sẻ</button>
                          <button onClick={() => handleDelete(file._id, file.originalName)} className="text-red-500 text-sm font-medium">Xóa</button>
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
          </>
        )}

        {/* ===== TAB: File được chia sẻ với tôi ===== */}
        {tab === "received" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">File được chia sẻ với tôi</h1>
              {receivedShares.length > 0 && (
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
                </div>
              )}
            </div>

            {receivedShares.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📬</p>
                <p>Chưa có file nào được chia sẻ với bạn.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {receivedShares.map((share) => (
                  <div key={share._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    <div
                      className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                      onClick={() =>
                        (share.file.mimetype.startsWith("image/") || share.file.mimetype.startsWith("video/")) &&
                        openLightbox(share.file.url ?? "", share.file.originalName, share.file.mimetype)
                      }
                    >
                      {share.file.mimetype.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={share.file.url} alt={share.file.originalName} className="w-full h-full object-cover" />
                      ) : share.file.mimetype.startsWith("video/") ? (
                        <video src={share.file.url} className="w-full h-full object-contain bg-black pointer-events-none" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 cursor-default">
                          <span className="text-5xl">{getFileIcon(share.file.mimetype)}</span>
                          <span className="text-xs uppercase tracking-wide">{share.file.mimetype.split("/")[1]}</span>
                        </div>
                      )}
                      {(share.file.mimetype.startsWith("image/") || share.file.mimetype.startsWith("video/")) && (
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate" title={share.file.originalName}>
                        {share.file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{formatBytes(share.file.size)}</span>
                        <span className="text-xs text-gray-400">@{share.sharedBy.username}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        {share.file.url && (
                          <a href={share.file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                        )}
                        {share.file.url && (
                          <a href={downloadLink(share.file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Kích thước</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Chia sẻ bởi</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày nhận</th>
                        <th className="text-right px-4 py-3 text-gray-500 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {receivedShares.map((share) => (
                        <tr key={share._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(share.file.mimetype)}</span>
                              <span className="text-gray-800 font-medium truncate max-w-[200px]">{share.file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{share.file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500">{formatBytes(share.file.size)}</td>
                          <td className="px-4 py-3 text-gray-500">@{share.sharedBy.username}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(share.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {share.file.url && (
                                <a href={share.file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                              )}
                              {share.file.url && (
                                <a href={downloadLink(share.file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {receivedShares.map((share) => (
                    <div key={share._id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl flex-shrink-0">{getFileIcon(share.file.mimetype)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{share.file.originalName}</p>
                          <p className="text-xs text-gray-400">{share.file.mimetype.split("/")[1]} · {formatBytes(share.file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                        <span>Chia sẻ bởi <span className="font-medium">@{share.sharedBy.username}</span></span>
                        <span>{new Date(share.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                      <div className="flex gap-3">
                        {share.file.url && <a href={share.file.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium">Xem</a>}
                        {share.file.url && <a href={downloadLink(share.file._id)} className="text-green-600 text-sm font-medium">Tải về</a>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ===== TAB: File đã chia sẻ ===== */}
        {tab === "sent" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">File đã chia sẻ</h1>
              {sentShares.length > 0 && (
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
                </div>
              )}
            </div>

            {sentShares.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-3">📤</p>
                <p>Bạn chưa chia sẻ file nào.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {sentShares.map((share) => (
                  <div key={share._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                    <div
                      className="relative bg-gray-100 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                      onClick={() =>
                        (share.file.mimetype.startsWith("image/") || share.file.mimetype.startsWith("video/")) &&
                        openLightbox(share.file.url ?? "", share.file.originalName, share.file.mimetype)
                      }
                    >
                      {share.file.mimetype.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={share.file.url} alt={share.file.originalName} className="w-full h-full object-cover" />
                      ) : share.file.mimetype.startsWith("video/") ? (
                        <video src={share.file.url} className="w-full h-full object-contain bg-black pointer-events-none" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 cursor-default">
                          <span className="text-5xl">{getFileIcon(share.file.mimetype)}</span>
                          <span className="text-xs uppercase tracking-wide">{share.file.mimetype.split("/")[1]}</span>
                        </div>
                      )}
                      {(share.file.mimetype.startsWith("image/") || share.file.mimetype.startsWith("video/")) && (
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate" title={share.file.originalName}>
                        {share.file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{formatBytes(share.file.size)}</span>
                        <span className="text-xs text-gray-400">→ @{share.sharedTo.username}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        {share.file.url && (
                          <a href={share.file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                        )}
                        <button
                          onClick={() => handleRevoke(share._id)}
                          className="text-red-500 hover:text-red-700 text-xs ml-auto"
                        >
                          Thu hồi
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Kích thước</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Chia sẻ với</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium">Ngày chia sẻ</th>
                        <th className="text-right px-4 py-3 text-gray-500 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sentShares.map((share) => (
                        <tr key={share._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(share.file.mimetype)}</span>
                              <span className="text-gray-800 font-medium truncate max-w-[200px]">{share.file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{share.file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500">{formatBytes(share.file.size)}</td>
                          <td className="px-4 py-3 text-gray-500">@{share.sharedTo.username}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(share.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRevoke(share._id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Thu hồi
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden space-y-3">
                  {sentShares.map((share) => (
                    <div key={share._id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(share.file.mimetype)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{share.file.originalName}</p>
                            <p className="text-xs text-gray-400">{share.file.mimetype.split("/")[1]} · {formatBytes(share.file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(share._id)}
                          className="text-red-500 text-sm font-medium flex-shrink-0"
                        >
                          Thu hồi
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                        <span>Chia sẻ với <span className="font-medium">@{share.sharedTo.username}</span></span>
                        <span>{new Date(share.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={closeLightbox}>
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white text-sm truncate max-w-xs">{lightbox.name}</span>
            <div className="flex items-center gap-2">
              {lightbox.mimetype.startsWith("image/") && (
                <>
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                  >−</button>
                  <span className="text-white text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors"
                  >+</button>
                  <button
                    onClick={() => setZoom(1)}
                    className="px-2 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
                  >Reset</button>
                </>
              )}
              <button
                onClick={closeLightbox}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg flex items-center justify-center transition-colors ml-2"
              >✕</button>
            </div>
          </div>
          <div
            className="flex-1 flex items-center justify-center overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onWheel={lightbox.mimetype.startsWith("image/") ? handleWheel : undefined}
          >
            {lightbox.mimetype.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt={lightbox.name}
                style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease" }}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            ) : (
              <video src={lightbox.url} controls autoPlay className="max-w-full max-h-full" />
            )}
          </div>
          <p className="text-center text-white/40 text-xs pb-3 flex-shrink-0">
            {lightbox.mimetype.startsWith("image/")
              ? "Scroll chuột hoặc dùng nút +/− để zoom • ESC để đóng"
              : "ESC để đóng"}
          </p>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShareModal(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Chia sẻ file</h2>
              <button onClick={() => setShareModal(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4 truncate">
              <span className="font-medium text-gray-700">{shareModal.originalName}</span>
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
                placeholder="Nhập email hoặc tên người dùng"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleShare}
                disabled={shareLoading || !shareInput.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {shareLoading ? "..." : "Chia sẻ"}
              </button>
            </div>
            {shareMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 ${
                shareMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                {shareMsg.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
