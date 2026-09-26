import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-semibold", {
  variants: {
    variant: {
      likely: "bg-likely-bg text-likely-fg",
      possibly: "bg-possibly-bg text-possibly-fg",
      not: "bg-not-bg text-not-fg",
      warn: "bg-warn-bg text-warn-fg",
      outline: "border border-border",
    },
  },
  defaultVariants: { variant: "outline" },
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
