"use client";

import { Menu, Scale, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/datasets", label: "Datasets" },
  { href: "/audit/new", label: "New Audit" },
];

export function GlassNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    const source = session?.user?.name || session?.user?.email || "UA";
    const bits = source.split(/[ @._-]+/).filter(Boolean);
    return bits
      .slice(0, 2)
      .map((b) => b[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);
  }, [session?.user?.email, session?.user?.name]);

  const itemClass = (href: string) =>
    cn(
      "liquid-glass glass-pill glass-btn text-xs text-white/70",
      pathname === href || pathname.startsWith(`${href}/`) ? "bg-white/10 text-white" : "hover:text-white",
    );

  return (
    <header className="fixed inset-x-0 top-0 z-20">
      <div className="liquid-glass-strong flex items-center justify-between px-4 py-3 backdrop-blur-[20px] md:px-8">
        <Link href="/dashboard" className="flex items-center gap-2 text-white" data-testid="nav-brand">
          <span className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full">
            <Scale className="h-7 w-7 text-white" />
          </span>
          <span className="font-display text-xl font-medium tracking-tight">UnbiasedAI</span>
        </Link>

        <nav className="hidden items-center gap-2 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={itemClass(l.href)} data-testid={`nav-${l.label.toLowerCase()}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <div className="liquid-glass flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white">
            {initials || "UA"}
          </div>
          <button
            type="button"
            className="liquid-glass glass-pill glass-btn text-xs text-white/70 hover:text-white"
            onClick={() => void signOut({ callbackUrl: "/login" })}
            data-testid="nav-sign-out"
          >
            Sign out
          </button>
        </div>

        <button
          type="button"
          className="liquid-glass flex h-9 w-9 items-center justify-center rounded-full lg:hidden"
          aria-label="Menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
        </button>
      </div>

      {open ? (
        <div className="px-4 pt-2 lg:hidden">
          <div className="liquid-glass-strong rounded-3xl p-3">
            <div className="flex flex-col gap-2">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={itemClass(l.href)}
                  onClick={() => setOpen(false)}
                  data-testid={`mobile-nav-${l.label.toLowerCase()}`}
                >
                  {l.label}
                </Link>
              ))}
              <button
                type="button"
                className="liquid-glass glass-pill glass-btn text-left text-xs text-white/70 hover:text-white"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
