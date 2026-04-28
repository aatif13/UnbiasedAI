"use client";

import type { ReactNode } from "react";
import VideoBackground from "@/components/layout/VideoBackground";
import { GlassNav } from "@/components/layout/GlassNav";

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Primary authenticated shell with top navigation and active route styling.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={`min-h-screen ${className ?? ""}`}>
      <VideoBackground />
      <GlassNav />
      <main className="content-layer mx-auto max-w-7xl px-4 pb-10 pt-24 md:px-6">{children}</main>
    </div>
  );
}
