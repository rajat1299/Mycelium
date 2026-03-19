"use client";

import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-[1rem] border border-panel-line bg-white/88 px-3 py-2 text-sm text-ink outline-none transition",
        "placeholder:text-muted/80 focus:border-accent focus:ring-2 focus:ring-accent-soft",
        className
      )}
    />
  );
}
