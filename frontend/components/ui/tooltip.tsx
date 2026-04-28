"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible tooltip primitive for metric explanations.
 */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={120}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({ ...props }: TooltipPrimitive.TooltipProps) {
  return <TooltipPrimitive.Root {...props} />;
}

export function TooltipTrigger({ ...props }: TooltipPrimitive.TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger {...props} />;
}

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-xs rounded-md border border-border bg-bg-secondary px-3 py-2 text-xs text-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
