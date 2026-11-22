import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wishlist Manager",
  description: "Plan what you want to buy, month by month, and track what you earn and spend.",
};

export const viewport: Viewport = {
  themeColor: "#F5F2EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
