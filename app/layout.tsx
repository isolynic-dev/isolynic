// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Isolynic — Don't lose customers just because you were busy",
  description:
    "Isolynic notices when a customer may be slipping away and helps bring the right customers back.",
  manifest: "/manifest.json",
  applicationName: "Isolynic",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}