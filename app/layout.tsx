import type { Metadata } from "next";
import "./globals.css";
import ReduxProvider from "@/components/ReduxProvider";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ToastProvider } from "@/context/ToastContext";
import ToastContainer from "@/components/ToastContainer";
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
          <ReduxProvider>
            <ToastProvider>
              <NotificationProvider>
                <RippleEffect />
                <ToastContainer />
                {children}
              </NotificationProvider>
            </ToastProvider>
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
