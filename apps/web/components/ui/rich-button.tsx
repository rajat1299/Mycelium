"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type RichButtonColor = "accent" | "sand" | "slate";

type RichButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  color?: RichButtonColor;
};

const colorClasses: Record<RichButtonColor, string> = {
  accent:
    "bg-[linear-gradient(135deg,var(--accent),var(--accent-hover))] text-white shadow-[0_16px_32px_var(--accent-soft)]",
  sand:
    "bg-[linear-gradient(135deg,#f2dfbf_0%,#e9cfa5_100%)] text-ink shadow-[0_16px_32px_rgba(161,122,64,0.16)]",
  slate:
    "bg-[linear-gradient(135deg,#364153_0%,#1f2937_100%)] text-white shadow-[0_16px_32px_rgba(31,41,55,0.24)]"
};

export function RichButton({
  children,
  color = "accent",
  className,
  disabled,
  ...props
}: RichButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={[
        "group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/30 px-4 py-3 text-sm font-semibold transition duration-200",
        "before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-white/55 before:content-['']",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[55%] after:bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.16),transparent_70%)] after:content-['']",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(39,27,13,0.18)] active:translate-y-0",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        colorClasses[color],
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.12)_45%,transparent_85%)] opacity-0 transition duration-300 group-hover:opacity-100" />
      <span className="relative z-10 inline-flex items-center gap-3">{children}</span>
    </button>
  );
}
