// src/app/home/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Home — Isolynic",
  description: "See what needs your attention right now.",
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}