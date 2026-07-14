"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import NotificationPanel from "@/components/NotificationPanel";
import api from "@/lib/api";

const AVATAR_COLORS = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
  "#EF4444", "#06B6D4", "#F97316", "#EC4899",
];

function getAvatarColor(username: string) {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ username, size = "sm" }: { username: string; size?: "sm" | "lg" }) {
  const color = getAvatarColor(username);
  const initials = username.slice(0, 2).toUpperCase();
  const cls = size === "lg"
    ? "w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold select-none"
    : "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold select-none cursor-pointer hover:opacity-90 transition-opacity";
  return (
    <div style={{ backgroundColor: color }} className={cls}>
      {initials}
    </div>
  );
}

type ProfileMsg = { type: "success" | "error"; text: string } | null;

export default function Navbar() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Đổi tên
  const [newUsername, setNewUsername] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<ProfileMsg>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<ProfileMsg>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const openProfile = () => {
    setNewUsername(user?.username ?? "");
    setUsernameMsg(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg(null);
    setProfileOpen(true);
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || newUsername.trim() === user?.username) return;
    setUsernameLoading(true);
    setUsernameMsg(null);
    try {
      const { data } = await api.put("/auth/profile", { username: newUsername.trim() });
      updateUser(data.user);
      setUsernameMsg({ type: "success", text: data.message });
    } catch (err: unknown) {
      setUsernameMsg({
        type: "error",
        text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Cập nhật thất bại",
      });
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: "error", text: "Vui lòng điền đầy đủ thông tin" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Mật khẩu xác nhận không khớp" });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);
    try {
      const { data } = await api.put("/auth/profile", { currentPassword, newPassword });
      setPasswordMsg({ type: "success", text: data.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setPasswordMsg({
        type: "error",
        text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Cập nhật thất bại",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/files", label: "Files" },
    { href: "/stats", label: "Thống kê" },
  ];

  return (
    <>
      <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-sm border-b border-white/60 dark:border-gray-700/60 sticky top-0 z-40 animate-slide-down">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600 dark:text-blue-400">
            Share App
          </Link>

          {user && (
            <>
              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm transition-colors ${
                      pathname === link.href
                        ? "text-blue-600 dark:text-blue-400 font-medium"
                        : "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200 dark:border-gray-700">
                  {/* Notification bell */}
                  <div className="relative">
                    <button
                      onClick={() => setNotifOpen((o) => !o)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                      title="Thông báo"
                    >
                      🔔
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                    {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
                  </div>

                  {/* Theme toggle */}
                  <button
                    onClick={toggleTheme}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title={theme === "dark" ? "Chuyển sang light mode" : "Chuyển sang dark mode"}
                  >
                    {theme === "dark" ? "☀️" : "🌙"}
                  </button>
                  <button onClick={openProfile} className="flex items-center gap-2 group">
                    <Avatar username={user.username} />
                    <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                      {user.username}
                      {user.role === "admin" && (
                        <span className="ml-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs rounded">
                          Admin
                        </span>
                      )}
                    </span>
                  </button>
                  <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-400">
                    Đăng xuất
                  </button>
                </div>
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Mobile dropdown */}
        {user && menuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === link.href
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between px-3 py-2">
              <button onClick={() => { setMenuOpen(false); openProfile(); }} className="flex items-center gap-2">
                <Avatar username={user.username} />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {user.username}
                  {user.role === "admin" && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs rounded">
                      Admin
                    </span>
                  )}
                </span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
                <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-400">
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Profile Modal */}
      {profileOpen && user && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Hồ sơ cá nhân</h2>
              <button onClick={() => setProfileOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">✕</button>
            </div>

            {/* Avatar + info */}
            <div className="flex flex-col items-center gap-2 pt-6 pb-4 px-6">
              <Avatar username={user.username} size="lg" />
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mt-1">{user.username}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">{user.email}</p>
              {user.role === "admin" && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Admin</span>
              )}
            </div>

            <div className="px-6 pb-6 space-y-6">
              {/* Đổi tên */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Đổi tên hiển thị</h3>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateUsername()}
                  placeholder="Tên người dùng mới"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {usernameMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${usernameMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {usernameMsg.text}
                  </p>
                )}
                <button
                  onClick={handleUpdateUsername}
                  disabled={usernameLoading || !newUsername.trim() || newUsername.trim() === user.username}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {usernameLoading ? "Đang lưu..." : "Cập nhật tên"}
                </button>
              </div>

              {/* Đổi mật khẩu */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Đổi mật khẩu</h3>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mật khẩu hiện tại"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdatePassword()}
                  placeholder="Xác nhận mật khẩu mới"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {passwordMsg && (
                  <p className={`text-xs rounded-lg px-3 py-2 ${passwordMsg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {passwordMsg.text}
                  </p>
                )}
                <button
                  onClick={handleUpdatePassword}
                  disabled={passwordLoading}
                  className="w-full bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
                >
                  {passwordLoading ? "Đang lưu..." : "Đổi mật khẩu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
