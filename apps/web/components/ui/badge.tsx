"use client";

import type { ReactNode } from "react";

type BadgeVariant = "default" | "sky" | "emerald" | "amber" | "slate";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "default" | "sm";
  className?: string;
};

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-panel-line bg-white/75 text-ink",
  sky: "border-sky-200/80 bg-sky-100/80 text-sky-900",
  emerald: "border-emerald-200/80 bg-emerald-100/85 text-emerald-900",
  amber: "border-amber-200/80 bg-amber-100/85 text-amber-900",
  slate: "border-slate-200/80 bg-slate-100/85 text-slate-800"
};

const sizeClasses = {
  default: "px-3 py-1 text-[11px]",
  sm: "px-2.5 py-1 text-[10px]"
};

export function Badge({
  children,
  variant = "default",
  size = "default",
  className
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.18em]",
        variantClasses[variant],
        sizeClasses[size],
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
