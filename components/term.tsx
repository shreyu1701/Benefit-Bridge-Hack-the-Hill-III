"use client";

import { useId, useState } from "react";

/**
 * Plain-language explanation for a term (accessible tooltip): works with
 * keyboard, touch and screen readers (the explanation is also the button's
 * accessible description).
 */
export function Term({ children, explain }: { children: React.ReactNode; explain: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-block">
      <button
        type="button"
        className="underline decoration-dotted underline-offset-4 cursor-help"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        {children}
      </button>
      <span
        id={id}
        role="tooltip"
        className={`${open ? "block" : "sr-only"} absolute z-10 left-0 top-full mt-1 w-64 rounded-md border border-border bg-card p-2 text-sm shadow-lg`}
      >
        {explain}
      </span>
    </span>
  );
}
