"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useDebounce } from "@/hooks/useDebounce";
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

type FavoriteItem = {
  _id: string;
  file: {
    _id: string;
    originalName: string;
    mimetype: string;
    size: number;
    url?: string;
    createdAt: string;
  };
  createdAt: string;
};

type Tab = "mine" | "received" | "sent" | "favorites";

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
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("mine");
  const [highlightedFileId, setHighlightedFileId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [receivedShares, setReceivedShares] = useState<ShareItem[]>([]);
  const [sentShares, setSentShares] = useState<ShareItem[]>([]);

  const [uploading, setUploading] = useState(false);
  const [allFiles, setAllFiles] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [lightbox, setLightbox] = useState<{ url: string; name: string; mimetype: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  const [shareModal, setShareModal] = useState<FileItem | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMsg, setShareMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteFiles, setFavoriteFiles] = useState<FavoriteItem[]>([]);

  // Infinite scroll
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Search + Filter (Tính năng 1) ──────────────────────────────────────
  type FilterType = "all" | "image" | "video" | "pdf" | "other";
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterType, setFilterType]     = useState<FilterType>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo]     = useState("");
  // useDebounce: chỉ gửi request sau 400ms user ngừng gõ
  const debouncedSearch = useDebounce(searchQuery, 400);
  const searchInputRef  = useRef<HTMLInputElement>(null);

  // Ref luôn giữ giá trị filter hiện tại — dùng trong IntersectionObserver
  // (tránh stale closure vì observer callback không re-subscribe khi state thay đổi)
  const filterRef = useRef({ search: "", type: "all", dateFrom: "", dateTo: "" });

  // ── Multi-select + Bulk Delete (Tính năng 2) ───────────────────────────
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [isSelecting,  setIsSelecting]  = useState(false);
  // lastClickIdx: nhớ vị trí click cuối để tính range khi shift+click
  const lastClickIdx = useRef<number>(-1);

  // ── Shortcuts help modal (Tính năng 3) ─────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Refs để keydown handler luôn đọc giá trị mới nhất mà không cần re-subscribe
  const filesRef      = useRef<FileItem[]>([]);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const isSelectingRef = useRef(false);
  useEffect(() => { filesRef.current       = files; },       [files]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { isSelectingRef.current = isSelecting; }, [isSelecting]);

  // ── Drag & Drop ─────────────────────────────────────────────────────────
  // dragCounter giải quyết vấn đề flicker khi kéo qua child elements
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Shortcuts (Tính năng 3)
  // Dùng refs thay vì deps array để tránh re-subscribe mỗi lần files/selectedIds thay đổi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);

      if (e.key === "Escape") {
        setLightbox(null);
        document.body.style.overflow = "";
        setShareModal(null);
        setShowShortcuts(false);
        if (isSelectingRef.current) { setIsSelecting(false); setSelectedIds(new Set()); }
        return;
      }

      if (inInput) return;

      if (e.key === "/" || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "g") {
        setViewMode((v) => v === "table" ? "grid" : "table");
      } else if (e.key === "u") {
        fileInputRef.current?.click();
      } else if (e.key === "?") {
        setShowShortcuts((v) => !v);
      } else if (e.key === "a" && isSelectingRef.current) {
        e.preventDefault();
        const cur = filesRef.current;
        setSelectedIds((prev) =>
          prev.size === cur.length ? new Set() : new Set(cur.map((f) => f._id))
        );
      } else if ((e.key === "Delete" || e.key === "Backspace") && isSelectingRef.current && selectedIdsRef.current.size > 0) {
        handleBulkDelete();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Đọc ?tab= và ?fileId= từ URL (dùng khi điều hướng từ notification)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as Tab | null;
    const fileIdParam = searchParams.get("fileId");
    const validTabs: Tab[] = ["mine", "received", "sent", "favorites"];
    if (tabParam && validTabs.includes(tabParam)) {
      setTab(tabParam);
    }
    if (fileIdParam) {
      setHighlightedFileId(fileIdParam);
      // Tự động bỏ highlight sau 3s
      setTimeout(() => setHighlightedFileId(null), 3000);
    }
  }, [searchParams]);

  // Cập nhật filterRef mỗi khi filter thay đổi
  useEffect(() => {
    filterRef.current = {
      search: debouncedSearch,
      type: filterType,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    };
  }, [debouncedSearch, filterType, filterDateFrom, filterDateTo]);

  type FetchOpts = { search?: string; type?: string; dateFrom?: string; dateTo?: string };

  const fetchFiles = async (pageNum = 1, append = false, opts: FetchOpts = filterRef.current) => {
    if (append) setLoadingMore(true);
    try {
      const endpoint = allFiles && user?.role === "admin" ? "/files/all" : "/files";
      const params: Record<string, string | number> = { page: pageNum, limit: 20 };
      if (opts.search) params.search = opts.search;
      if (opts.type && opts.type !== "all") params.type = opts.type;
      if (opts.dateFrom) params.dateFrom = opts.dateFrom;
      if (opts.dateTo)   params.dateTo   = opts.dateTo;
      const { data } = await api.get(endpoint, { params });
      setFiles((prev) => append ? [...prev, ...data.files] : data.files);
      setHasMore(data.hasMore ?? false);
      setPage(pageNum);
    } catch {} finally {
      if (append) setLoadingMore(false);
    }
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

  const fetchFavorites = async () => {
    try {
      const { data } = await api.get("/favorites");
      setFavoriteFiles(data.favorites);
      setFavoriteIds(new Set(data.favorites.map((f: FavoriteItem) => f.file._id)));
    } catch {}
  };

  // Load favorites ids on mount để hiện đúng trạng thái ngôi sao
  useEffect(() => {
    if (user) fetchFavorites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (tab === "mine") {
      setPage(1);
      setHasMore(false);
      setSelectedIds(new Set());
      fetchFiles(1, false);
    } else if (tab === "received") fetchReceivedShares();
    else if (tab === "sent") fetchSentShares();
    else if (tab === "favorites") fetchFavorites();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab, allFiles]);

  // Refetch khi debounced search hoặc filter thay đổi
  useEffect(() => {
    if (!user || tab !== "mine") return;
    setPage(1);
    setHasMore(false);
    setSelectedIds(new Set());
    fetchFiles(1, false, {
      search: debouncedSearch,
      type: filterType,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterType, filterDateFrom, filterDateTo]);

  // IntersectionObserver: khi sentinel hiện ra trong viewport thì load trang tiếp
  useEffect(() => {
    if (tab !== "mine" || !sentinelRef.current) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchFiles(page + 1, true);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasMore, loadingMore, page]);

  const toggleFavorite = async (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (favoriteIds.has(fileId)) {
      try {
        await api.delete(`/favorites/${fileId}`);
        setFavoriteIds((prev) => { const s = new Set(prev); s.delete(fileId); return s; });
        setFavoriteFiles((prev) => prev.filter((f) => f.file._id !== fileId));
      } catch {}
    } else {
      try {
        await api.post("/favorites", { fileId });
        setFavoriteIds((prev) => new Set(prev).add(fileId));
        // Sẽ tự refresh khi user chuyển sang tab favorites
      } catch {}
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    const msg = selectedFiles.length === 1
      ? `Đang upload "${selectedFiles[0].name}"...`
      : `Đang upload ${selectedFiles.length} files...`;
    toastInfo(msg, 5000);
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));
    try {
      const { data } = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toastSuccess(data.message);
      fetchFiles(1, false);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Upload thất bại"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa file "${name}"?`)) return;
    try {
      await api.delete(`/files/${id}`);
      setFiles((prev) => prev.filter((f) => f._id !== id));
      toastSuccess(`Đã xóa "${name}"`);
    } catch {
      toastError("Xóa file thất bại");
    }
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
      toastSuccess("Đã thu hồi chia sẻ");
    } catch {
      toastError("Thu hồi thất bại");
    }
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

  // ── Multi-select handlers (Tính năng 2) ────────────────────────────────
  const toggleSelect = (fileId: string, idx: number, shiftKey = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickIdx.current >= 0) {
        // Shift+click: chọn toàn bộ range từ lastClickIdx đến idx
        const [from, to] = [Math.min(lastClickIdx.current, idx), Math.max(lastClickIdx.current, idx)];
        files.slice(from, to + 1).forEach((f) => next.add(f._id));
      } else {
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
      }
      return next;
    });
    lastClickIdx.current = idx;
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Xóa ${selectedIds.size} file đã chọn?`)) return;
    try {
      const { data } = await api.delete("/files/bulk", { data: { ids: [...selectedIds] } });
      setFiles((prev) => prev.filter((f) => !selectedIds.has(f._id)));
      setSelectedIds(new Set());
      toastSuccess(data.message);
    } catch {
      toastError("Xóa thất bại");
    }
  };

  // ── Export CSV/JSON (Tính năng 4) ───────────────────────────────────────
  // Dạy: Blob API, URL.createObjectURL, kích hoạt download bằng <a> ảo
  const exportData = (format: "csv" | "json") => {
    if (files.length === 0) { toastInfo("Không có file nào để xuất"); return; }

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === "csv") {
      const header = "Tên file,Loại,Kích thước (bytes),Ngày upload,URL";
      const rows = files.map((f) =>
        [`"${f.originalName}"`, f.mimetype, f.size, new Date(f.createdAt).toLocaleDateString("vi-VN"), f.url ?? ""].join(",")
      );
      content = [header, ...rows].join("\n");
      mimeType = "text/csv;charset=utf-8;";
      extension = "csv";
    } else {
      content = JSON.stringify(
        files.map((f) => ({
          name: f.originalName,
          type: f.mimetype,
          size: f.size,
          uploadedAt: f.createdAt,
          url: f.url,
        })),
        null, 2
      );
      mimeType = "application/json";
      extension = "json";
    }

    // Tạo Blob từ string, sau đó tạo URL tạm thời và click <a> ảo để tải xuống
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `files-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
    a.click();
    // Giải phóng URL object sau khi dùng xong (tránh memory leak)
    URL.revokeObjectURL(url);
    toastSuccess(`Đã xuất ${files.length} file ra .${extension}`);
  };

  // ── Drag & Drop handlers ────────────────────────────────────────────────
  // dragenter: fire khi đi vào vùng drop (kể cả vào child elements)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    // Chỉ phản ứng khi kéo file, không phải text/link
    if (!Array.from(e.dataTransfer.items).some((i) => i.kind === "file")) return;
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  // dragleave: fire khi rời khỏi vùng drop — cần check counter
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragOver(false);
  };

  // dragover: bắt buộc preventDefault để trình duyệt cho phép drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // drop: lấy files từ DataTransfer API rồi upload
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);

    // DataTransfer.files — đây là FileList từ kéo thả
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    // Chuyển sang tab "mine" nếu đang ở tab khác
    setTab("mine");

    setUploading(true);
    const msg = droppedFiles.length === 1
      ? `Đang upload "${droppedFiles[0].name}"...`
      : `Đang upload ${droppedFiles.length} files...`;
    toastInfo(msg, 5000);

    const formData = new FormData();
    droppedFiles.forEach((f) => formData.append("files", f));

    try {
      const { data } = await api.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toastSuccess(data.message);
      fetchFiles(1, false);
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || "Upload thất bại"
      );
    } finally {
      setUploading(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  if (loading || !user) return null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "mine", label: "File của tôi" },
    { key: "received", label: "File được chia sẻ" },
    { key: "sent", label: "File đã chia sẻ" },
    { key: "favorites", label: "★ Yêu thích" },
  ];

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Drag & Drop Overlay
          Hiển thị khi kéo file vào trang
          pointer-events-none để không chặn các sự kiện drag bên dưới */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          {/* Backdrop mờ */}
          <div className="absolute inset-0 bg-blue-600/20 dark:bg-blue-900/40 backdrop-blur-sm" />
          {/* Drop zone card */}
          <div className="relative flex flex-col items-center gap-4 bg-white dark:bg-gray-800 border-4 border-dashed border-blue-500 dark:border-blue-400 rounded-3xl px-16 py-12 shadow-2xl animate-scale-in">
            <div className="text-6xl animate-bounce">📂</div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">Thả file để upload</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Hỗ trợ nhiều file cùng lúc</p>
          </div>
        </div>
      )}

      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 animate-fade-in-up">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {label}
              {key === "received" && receivedShares.length > 0 && (
                <span className="ml-1.5 bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                  {receivedShares.length}
                </span>
              )}
              {key === "favorites" && favoriteIds.size > 0 && (
                <span className="ml-1.5 bg-yellow-100 text-yellow-600 text-xs px-1.5 py-0.5 rounded-full">
                  {favoriteIds.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: File của tôi ===== */}
        {tab === "mine" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Quản lý File</h1>
              <div className="flex items-center gap-2">
                {user.role === "admin" && (
                  <button
                    onClick={() => setAllFiles(!allFiles)}
                    className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      allFiles
                        ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                        : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {allFiles ? "Tất cả file" : "File của tôi"}
                  </button>
                )}
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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

            {/* ── Search + Filter bar (Tính năng 1) ── */}
            <div className="mb-4 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm file... (phím /)"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                  )}
                </div>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Từ ngày" />
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Đến ngày" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(["all", "image", "video", "pdf", "other"] as const).map((t) => (
                  <button key={t} onClick={() => setFilterType(t)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      filterType === t
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-blue-400"
                    }`}>
                    {{ all: "Tất cả", image: "🖼 Ảnh", video: "🎬 Video", pdf: "📄 PDF", other: "📁 Khác" }[t]}
                  </button>
                ))}
                {(searchQuery || filterType !== "all" || filterDateFrom || filterDateTo) && (
                  <button onClick={() => { setSearchQuery(""); setFilterType("all"); setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="px-3 py-1 text-xs rounded-full border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Xóa bộ lọc ✕
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {/* Multi-select toggle (Tính năng 2) */}
                  <button onClick={() => { setIsSelecting((v) => !v); setSelectedIds(new Set()); }}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      isSelecting
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"
                    }`}>
                    {isSelecting ? `☑ Đang chọn (${selectedIds.size})` : "☐ Chọn nhiều"}
                  </button>
                  {/* Export dropdown (Tính năng 4) */}
                  <button onClick={() => exportData("csv")}
                    className="px-3 py-1 text-xs rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
                    title="Xuất danh sách file">
                    ↓ CSV
                  </button>
                  <button onClick={() => exportData("json")}
                    className="px-3 py-1 text-xs rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                    title="Xuất JSON">
                    ↓ JSON
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk delete bar */}
            {isSelecting && selectedIds.size > 0 && (
              <div className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 animate-fade-in-up">
                <span className="text-sm text-red-700 dark:text-red-300 flex-1">Đã chọn {selectedIds.size} file</span>
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">Bỏ chọn tất cả</button>
                <button onClick={handleBulkDelete} className="bg-red-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-red-700 transition-colors">
                  Xóa {selectedIds.size} file
                </button>
              </div>
            )}

            {files.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 animate-fade-in">
                <p className="text-5xl mb-3 animate-float inline-block">
                  {searchQuery || filterType !== "all" ? "🔍" : "📂"}
                </p>
                <p>{searchQuery || filterType !== "all" ? `Không tìm thấy file nào` : "Chưa có file nào. Hãy upload file đầu tiên!"}</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {files.map((file, i) => (
                  <div key={file._id}
                    onClick={isSelecting ? (e) => toggleSelect(file._id, i, e.shiftKey) : undefined}
                    className={`relative rounded-xl border overflow-hidden flex flex-col card-lift animate-fade-in-up transition-colors duration-150 ${
                      isSelecting ? "cursor-pointer" : ""
                    } ${
                      selectedIds.has(file._id)
                        ? "bg-indigo-50 dark:bg-indigo-900/25 border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-400"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {isSelecting && (
                      <div className="absolute top-2 left-2 z-10">
                        <input type="checkbox" readOnly checked={selectedIds.has(file._id)} className="w-4 h-4 accent-indigo-600" />
                      </div>
                    )}
                    <div
                      className="relative bg-gray-100 dark:bg-gray-700 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
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
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 cursor-default">
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
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={file.originalName}>
                        {file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file.size)}</span>
                        {allFiles && <span className="text-xs text-gray-400">@{file.owner?.username}</span>}
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={(e) => toggleFavorite(file._id, e)}
                          className={`text-lg leading-none transition-colors ${favoriteIds.has(file._id) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                          title={favoriteIds.has(file._id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                        >
                          {favoriteIds.has(file._id) ? "★" : "☆"}
                        </button>
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
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        {isSelecting && (
                          <th className="w-10 px-4 py-3">
                            <input type="checkbox" readOnly className="w-4 h-4 accent-indigo-600"
                              checked={selectedIds.size === files.length && files.length > 0}
                              onClick={() => setSelectedIds(selectedIds.size === files.length ? new Set() : new Set(files.map((f) => f._id)))}
                            />
                          </th>
                        )}
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Kích thước</th>
                        {allFiles && <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Chủ sở hữu</th>}
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Ngày upload</th>
                        <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {files.map((file, i) => (
                        <tr key={file._id}
                          onClick={isSelecting ? (e) => toggleSelect(file._id, i, e.shiftKey) : undefined}
                          className={`transition-colors duration-150 ${isSelecting ? "cursor-pointer" : ""} ${
                            selectedIds.has(file._id) ? "bg-indigo-50 dark:bg-indigo-900/25" : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          {isSelecting && (
                            <td className="px-4 py-3">
                              <input type="checkbox" readOnly checked={selectedIds.has(file._id)} className="w-4 h-4 accent-indigo-600" />
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(file.mimetype)}</span>
                              <span className="text-gray-800 dark:text-gray-100 font-medium truncate max-w-[200px]">{file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</td>
                          {allFiles && <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{file.owner?.username}</td>}
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(file.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={(e) => toggleFavorite(file._id, e)}
                                className={`text-lg leading-none transition-colors ${favoriteIds.has(file._id) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                                title={favoriteIds.has(file._id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                              >
                                {favoriteIds.has(file._id) ? "★" : "☆"}
                              </button>
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
                    <div key={file._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(file.mimetype)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{file.originalName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{file.mimetype.split("/")[1]} · {formatBytes(file.size)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          <button
                            onClick={(e) => toggleFavorite(file._id, e)}
                            className={`text-xl leading-none transition-colors ${favoriteIds.has(file._id) ? "text-yellow-400" : "text-gray-300"}`}
                          >
                            {favoriteIds.has(file._id) ? "★" : "☆"}
                          </button>
                          <a href={file.url ?? ""} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium">Xem</a>
                          {file.url && <a href={downloadLink(file._id)} className="text-green-600 text-sm font-medium">Tải về</a>}
                          <button onClick={() => openShareModal(file)} className="text-indigo-600 text-sm font-medium">Chia sẻ</button>
                          <button onClick={() => handleDelete(file._id, file.originalName)} className="text-red-500 text-sm font-medium">Xóa</button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                        <span>{new Date(file.createdAt).toLocaleDateString("vi-VN")}</span>
                        {allFiles && <span>@{file.owner?.username}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Sentinel — IntersectionObserver trigger */}
            <div ref={sentinelRef} className="py-6 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  Đang tải thêm...
                </div>
              )}
              {!hasMore && files.length >= 20 && !loadingMore && (
                <p className="text-xs text-gray-300 dark:text-gray-600">
                  Đã hiển thị tất cả {files.length} file
                </p>
              )}
            </div>
          </>
        )}

        {/* ===== TAB: File được chia sẻ với tôi ===== */}
        {tab === "received" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">File được chia sẻ với tôi</h1>
              {receivedShares.length > 0 && (
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
                </div>
              )}
            </div>

            {receivedShares.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 animate-fade-in">
                <p className="text-5xl mb-3 animate-float inline-block">📬</p>
                <p>Chưa có file nào được chia sẻ với bạn.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {receivedShares.map((share, i) => (
                  <div
                    key={share._id}
                    className={`rounded-xl border overflow-hidden flex flex-col card-lift animate-fade-in-up transition-colors duration-500 ${
                      highlightedFileId === share.file._id
                        ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 ring-2 ring-blue-400 dark:ring-blue-500"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    }`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div
                      className="relative bg-gray-100 dark:bg-gray-700 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
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
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 cursor-default">
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
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={share.file.originalName}>
                        {share.file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(share.file.size)}</span>
                        <span className="text-xs text-gray-400">@{share.sharedBy.username}</span>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={(e) => toggleFavorite(share.file._id, e)}
                          className={`text-lg leading-none transition-colors ${favoriteIds.has(share.file._id) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                          title={favoriteIds.has(share.file._id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                        >
                          {favoriteIds.has(share.file._id) ? "★" : "☆"}
                        </button>
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
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Kích thước</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Chia sẻ bởi</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Ngày nhận</th>
                        <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {receivedShares.map((share) => (
                        <tr
                          key={share._id}
                          className={`transition-colors duration-500 ${
                            highlightedFileId === share.file._id
                              ? "bg-blue-50 dark:bg-blue-900/25"
                              : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(share.file.mimetype)}</span>
                              <span className="text-gray-800 dark:text-gray-100 font-medium truncate max-w-[200px]">{share.file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{share.file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatBytes(share.file.size)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">@{share.sharedBy.username}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(share.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={(e) => toggleFavorite(share.file._id, e)}
                                className={`text-lg leading-none transition-colors ${favoriteIds.has(share.file._id) ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400"}`}
                                title={favoriteIds.has(share.file._id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                              >
                                {favoriteIds.has(share.file._id) ? "★" : "☆"}
                              </button>
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
                    <div
                      key={share._id}
                      className={`rounded-xl border p-4 transition-colors duration-500 ${
                        highlightedFileId === share.file._id
                          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl flex-shrink-0">{getFileIcon(share.file.mimetype)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{share.file.originalName}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{share.file.mimetype.split("/")[1]} · {formatBytes(share.file.size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-3">
                        <span>Chia sẻ bởi <span className="font-medium">@{share.sharedBy.username}</span></span>
                        <span>{new Date(share.createdAt).toLocaleDateString("vi-VN")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => toggleFavorite(share.file._id, e)}
                          className={`text-xl leading-none transition-colors ${favoriteIds.has(share.file._id) ? "text-yellow-400" : "text-gray-300"}`}
                        >
                          {favoriteIds.has(share.file._id) ? "★" : "☆"}
                        </button>
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
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">File đã chia sẻ</h1>
              {sentShares.length > 0 && (
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
                </div>
              )}
            </div>

            {sentShares.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 animate-fade-in">
                <p className="text-5xl mb-3 animate-float inline-block">📤</p>
                <p>Bạn chưa chia sẻ file nào.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {sentShares.map((share, i) => (
                  <div key={share._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col card-lift animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div
                      className="relative bg-gray-100 dark:bg-gray-700 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
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
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 cursor-default">
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
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={share.file.originalName}>
                        {share.file.originalName}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(share.file.size)}</span>
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
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Kích thước</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Chia sẻ với</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Ngày chia sẻ</th>
                        <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {sentShares.map((share) => (
                        <tr key={share._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(share.file.mimetype)}</span>
                              <span className="text-gray-800 dark:text-gray-100 font-medium truncate max-w-[200px]">{share.file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{share.file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatBytes(share.file.size)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">@{share.sharedTo.username}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(share.createdAt).toLocaleDateString("vi-VN")}</td>
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
                    <div key={share._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(share.file.mimetype)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{share.file.originalName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{share.file.mimetype.split("/")[1]} · {formatBytes(share.file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(share._id)}
                          className="text-red-500 text-sm font-medium flex-shrink-0"
                        >
                          Thu hồi
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
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
        {/* ===== TAB: Yêu thích ===== */}
        {tab === "favorites" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">File yêu thích</h1>
              {favoriteFiles.length > 0 && (
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setViewMode("table")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "table" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng bảng"
                  >☰</button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1.5 text-sm transition-colors ${
                      viewMode === "grid" ? "bg-gray-800 text-white dark:bg-gray-600" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                    title="Dạng lưới"
                  >⊞</button>
                </div>
              )}
            </div>

            {favoriteFiles.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500 animate-fade-in">
                <p className="text-5xl mb-3 animate-float inline-block">⭐</p>
                <p>Chưa có file nào được đánh dấu yêu thích.</p>
                <p className="text-sm mt-1">Nhấn ☆ trên bất kỳ file nào để thêm vào đây.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4">
                {favoriteFiles.map((fav, i) => (
                  <div key={fav._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col card-lift animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                    <div
                      className="relative bg-gray-100 dark:bg-gray-700 aspect-video flex items-center justify-center overflow-hidden cursor-zoom-in"
                      onClick={() =>
                        (fav.file.mimetype.startsWith("image/") || fav.file.mimetype.startsWith("video/")) &&
                        openLightbox(fav.file.url ?? "", fav.file.originalName, fav.file.mimetype)
                      }
                    >
                      {fav.file.mimetype.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fav.file.url} alt={fav.file.originalName} className="w-full h-full object-cover" />
                      ) : fav.file.mimetype.startsWith("video/") ? (
                        <video src={fav.file.url} className="w-full h-full object-contain bg-black pointer-events-none" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 cursor-default">
                          <span className="text-5xl">{getFileIcon(fav.file.mimetype)}</span>
                          <span className="text-xs uppercase tracking-wide">{fav.file.mimetype.split("/")[1]}</span>
                        </div>
                      )}
                      {(fav.file.mimetype.startsWith("image/") || fav.file.mimetype.startsWith("video/")) && (
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                          <span className="opacity-0 hover:opacity-100 text-white text-2xl transition-opacity">⤢</span>
                        </div>
                      )}
                      {/* Star overlay */}
                      <button
                        onClick={(e) => toggleFavorite(fav.file._id, e)}
                        className="absolute top-2 right-2 text-yellow-400 text-xl drop-shadow leading-none hover:scale-110 transition-transform"
                        title="Bỏ yêu thích"
                      >★</button>
                    </div>
                    <div className="p-3 flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate" title={fav.file.originalName}>
                        {fav.file.originalName}
                      </p>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(fav.file.size)}</span>
                      <div className="flex items-center gap-3 pt-1">
                        {fav.file.url && (
                          <a href={fav.file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                        )}
                        {fav.file.url && (
                          <a href={downloadLink(fav.file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">File</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Loại</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Kích thước</th>
                        <th className="text-left px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Ngày thêm</th>
                        <th className="text-right px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {favoriteFiles.map((fav) => (
                        <tr key={fav._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{getFileIcon(fav.file.mimetype)}</span>
                              <span className="text-gray-800 dark:text-gray-100 font-medium truncate max-w-[200px]">{fav.file.originalName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fav.file.mimetype.split("/")[1]}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatBytes(fav.file.size)}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(fav.createdAt).toLocaleDateString("vi-VN")}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={(e) => toggleFavorite(fav.file._id, e)}
                                className="text-yellow-400 hover:text-gray-400 text-lg leading-none transition-colors"
                                title="Bỏ yêu thích"
                              >★</button>
                              {fav.file.url && (
                                <a href={fav.file.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">Xem</a>
                              )}
                              {fav.file.url && (
                                <a href={downloadLink(fav.file._id)} className="text-green-600 hover:underline text-xs">Tải về</a>
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
                  {favoriteFiles.map((fav) => (
                    <div key={fav._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-2xl flex-shrink-0">{getFileIcon(fav.file.mimetype)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{fav.file.originalName}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{fav.file.mimetype.split("/")[1]} · {formatBytes(fav.file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => toggleFavorite(fav.file._id, e)}
                          className="text-yellow-400 text-2xl leading-none flex-shrink-0"
                          title="Bỏ yêu thích"
                        >★</button>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        {fav.file.url && <a href={fav.file.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium">Xem</a>}
                        {fav.file.url && <a href={downloadLink(fav.file._id)} className="text-green-600 text-sm font-medium">Tải về</a>}
                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{new Date(fav.createdAt).toLocaleDateString("vi-VN")}</span>
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
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Chia sẻ file</h2>
              <button onClick={() => setShareModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">
              <span className="font-medium text-gray-700 dark:text-gray-200">{shareModal.originalName}</span>
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={shareInput}
                onChange={(e) => setShareInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleShare()}
                placeholder="Nhập email hoặc tên người dùng"
                className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                shareMsg.type === "success" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}>
                {shareMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal (Tính năng 3) — hiện khi nhấn '?' */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">Phím tắt</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["/  hoặc  Ctrl+K", "Focus ô tìm kiếm"],
                ["G", "Chuyển Grid / Table"],
                ["U", "Mở hộp upload file"],
                ["☐ Chọn nhiều → A", "Chọn / bỏ chọn tất cả"],
                ["☐ Chọn nhiều → Delete", "Xóa file đã chọn"],
                ["Shift + Click", "Chọn nhiều file liên tiếp"],
                ["Escape", "Đóng modal / Thoát chế độ chọn"],
                ["?", "Hiện / ẩn trang này"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <kbd className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">{key}</kbd>
                  <span className="text-gray-600 dark:text-gray-400 text-right">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
