"use client";

import type { ReactNode } from "react";

type PhaseGroupProps = {
  children: ReactNode;
  kind?: "transition" | "delivery" | "default";
};

export function PhaseGroup({
  children,
  kind = "default"
}: PhaseGroupProps) {
  return (
    <div data-kind={kind} data-testid="phase-group" className="flex flex-col gap-3">
      {children}
    </div>
  );
}
