import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "今晚吃什么 — 一周菜单与采购清单",
  description: "输入偏好和冰箱库存，AI 生成一周菜单，一键合并采购清单。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppProvider>
          <Nav />
          <main className="flex-1">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
