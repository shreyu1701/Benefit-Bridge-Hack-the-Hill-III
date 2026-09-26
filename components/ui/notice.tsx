import * as React from "react";
import { cn } from "@/lib/utils";

export function Notice({ className, tone = "warn", ...props }: React.HTMLAttributes<HTMLDivElement> & { tone?: "warn" | "info" }) {
  return (
    <div
      role="note"
      className={cn("rounded-lg px-3 py-2 text-sm", tone === "warn" ? "bg-warn-bg text-warn-fg" : "bg-not-bg text-not-fg", className)}
      {...props}
    />
  );
}
