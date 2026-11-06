import type { Metadata } from "next";
import "./figma-make.css";
import "./next-ui.css";
import StudioProvider from "@/components/StudioProvider";
import Navigation from "@/components/Navigation";
export const metadata: Metadata = {
  icons: { icon: "/favicon.png" },
  title: "MarketMorph · 訂閱頁面設計工作台",
  description: "為不同市場而設的訂閱頁面設計工具。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-HK">
      <body>
        <StudioProvider>
          <Navigation />
          {children}
        </StudioProvider>
      </body>
    </html>
  );
}
