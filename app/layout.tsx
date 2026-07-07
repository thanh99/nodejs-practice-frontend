import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import RippleEffect from "@/components/RippleEffect";

export const metadata: Metadata = {
  title: "NodeJS Practice App",
  description: "Ứng dụng học Node.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <RippleEffect />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
