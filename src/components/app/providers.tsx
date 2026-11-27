"use client";

import type { CSSProperties, ReactNode } from "react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/app/theme";

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      // Bottom-right, clear of the status bar and of the preview's floating
      // toolbar, which sits 12px above the status bar and is 42px tall.
      position="bottom-right"
      offset={{ bottom: 96, right: 16 }}
      // Clear of the phone tab bar, which is 64px plus the home indicator.
      mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
      gap={8}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--foreground)",
          "--border-radius": "12px",
          fontFamily: "var(--font-sans)",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-lg !gap-2.5 !text-[13px]",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-md !font-medium",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      {children}
      <ThemedToaster />
    </TooltipProvider>
  );
}
