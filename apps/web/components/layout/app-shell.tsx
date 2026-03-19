"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserMenu } from "./user-menu";

type AppShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  {
    href: "/",
    label: "Mycelium",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
    )
  },
  {
    href: "/review",
    label: "Review",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    )
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6" />
      </svg>
    )
  }
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-shell">
      <nav className="hidden w-56 shrink-0 flex-col border-r border-panel-line bg-sidebar-bg md:flex">
        <div className="px-5 pb-1 pt-5">
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent transition-colors duration-150 hover:text-accent-hover"
          >
            Mycelium
          </Link>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 px-3 pt-5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-active text-accent"
                    : "text-muted hover:bg-sidebar-hover hover:text-ink"
                ].join(" ")}
              >
                <span className={[
                  "shrink-0 transition-colors duration-150",
                  active ? "text-accent" : "text-muted/70"
                ].join(" ")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <UserMenu />
      </nav>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
