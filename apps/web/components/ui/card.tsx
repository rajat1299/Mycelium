"use client";

import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-[1.6rem] border border-panel-line bg-white/78 shadow-[0_12px_28px_rgba(33,42,55,0.08)]",
        className
      )}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("flex flex-col gap-2 p-5", className)} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      {...props}
      className={cn("text-base font-semibold tracking-tight text-ink", className)}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...props} className={cn("text-sm leading-6 text-muted", className)} />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("px-5 pb-5", className)} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-panel-line/70 px-5 py-4",
        className
      )}
    />
  );
}
