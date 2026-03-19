"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "../theme/theme-provider";

type Theme = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: Theme;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    )
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    )
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </svg>
    )
  }
];

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAppearance(false);
      }
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setShowAppearance(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const themeLabel =
    theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light";

  return (
    <div ref={menuRef} className="relative border-t border-panel-line">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setShowAppearance(false);
        }}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 transition-colors duration-150 hover:bg-sidebar-hover"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
          R
        </div>
        <span className="flex-1 text-left text-[13px] font-medium text-ink">
          Rajat
        </span>
        <svg
          className={[
            "shrink-0 text-muted/50 transition-transform duration-200",
            open ? "" : "rotate-180"
          ].join(" ")}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>

      {/* Popup */}
      {open && (
        <div
          className="absolute bottom-full left-2 right-2 z-50 mb-1.5 overflow-visible rounded-xl border border-panel-line bg-panel shadow-panel backdrop-blur-md"
          style={{ animation: "user-menu-in 150ms ease-out" }}
        >
          {/* User header */}
          <div className="flex items-center gap-2.5 border-b border-panel-line/70 px-3.5 py-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">
              R
            </div>
            <span className="truncate text-[12px] font-medium text-ink">
              rajat@mycelium.ai
            </span>
          </div>

          {/* Settings */}
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2 text-[13px] text-ink transition-colors duration-100 hover:bg-sidebar-hover"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-muted"
              >
                <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6" />
              </svg>
              Settings
            </Link>
          </div>

          {/* Appearance */}
          <div className="border-t border-panel-line/70 py-1">
            <div
              className="relative"
              onMouseEnter={() => setShowAppearance(true)}
              onMouseLeave={() => setShowAppearance(false)}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 px-3.5 py-2 text-[13px] text-ink transition-colors duration-100 hover:bg-sidebar-hover"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-muted"
                >
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
                <span className="flex-1 text-left">Appearance</span>
                <span className="mr-1 text-[11px] text-muted">
                  {themeLabel}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-muted/50"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {/* Appearance submenu */}
              {showAppearance && (
                <div
                  className="absolute bottom-0 left-full z-50 ml-1.5 min-w-[148px] rounded-xl border border-panel-line bg-panel py-1 shadow-panel backdrop-blur-md"
                  style={{ animation: "user-menu-in 100ms ease-out" }}
                >
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTheme(option.value);
                        setOpen(false);
                        setShowAppearance(false);
                      }}
                      className={[
                        "flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] transition-colors duration-100 hover:bg-sidebar-hover",
                        theme === option.value ? "text-accent" : "text-ink"
                      ].join(" ")}
                    >
                      <span
                        className={
                          theme === option.value ? "text-accent" : "text-muted"
                        }
                      >
                        {option.icon}
                      </span>
                      <span className="flex-1 text-left">{option.label}</span>
                      {theme === option.value && (
                        <svg
                          className="shrink-0 text-accent"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sign out */}
          <div className="border-t border-panel-line/70 py-1">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3.5 py-2 text-[13px] text-muted transition-colors duration-100 hover:bg-sidebar-hover hover:text-ink"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
