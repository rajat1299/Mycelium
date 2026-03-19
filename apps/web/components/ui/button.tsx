"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "default" | "outline" | "ghost";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "border-transparent bg-accent text-white shadow-[0_12px_24px_var(--accent-soft)] hover:bg-accent-hover",
  outline:
    "border-panel-line bg-panel text-ink hover:border-accent hover:text-accent",
  ghost: "border-transparent bg-transparent text-muted hover:text-ink"
};

export function Button({
  className,
  type = "button",
  disabled,
  variant = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100",
        variantClasses[variant],
        className
      )}
    />
  );
}
