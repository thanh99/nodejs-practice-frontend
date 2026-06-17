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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(`Đang upload "${file.name}"...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadProgress("Upload thành công!");
      fetchFiles();
    } catch (err: unknown) {
      setUploadProgress((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Upload thất bại");
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

  if (loading || !user) return null;

  return (
    <div>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Quản lý File</h1>
          <div className="flex items-center gap-3">
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
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              + Upload File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept="image/*,application/pdf,.doc,.docx,video/*"
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
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5000"}/uploads/${file.filename}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Xem
                        </a>
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
        )}
      </main>
    </div>
  );
}
