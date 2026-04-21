import type { Metadata } from "next";
import "./globals.css";
import ShellLayout from "@/components/ShellLayout";

export const metadata: Metadata = {
  title: "Algo Terminal",
  description: "Institutional futures trading system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning style={{ height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
        <ShellLayout>
          {children}
        </ShellLayout>
      </body>
    </html>
  );
}
