"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold text-blue-600">
          NodeJS App
        </Link>

        {user && (
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 text-sm">
              Dashboard
            </Link>
            <Link href="/files" className="text-gray-600 hover:text-blue-600 text-sm">
              Files
            </Link>
            <Link href="/stats" className="text-gray-600 hover:text-blue-600 text-sm">
              Thống kê
            </Link>

            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-500">
                {user.username}
                {user.role === "admin" && (
                  <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                    Admin
                  </span>
                )}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
