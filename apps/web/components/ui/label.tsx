"use client";

import type { LabelHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.18em] text-muted",
        className
      )}
    />
  );
}
