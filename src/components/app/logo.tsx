import { cn } from "@/lib/cn";

/** A page with a folded corner and a line of set type, on the accent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path
        d="M10.5 7h8.2l4.8 4.8V24a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        fill="#fff"
      />
      <path d="M18.7 7v4.8h4.8" fill="#fff" stroke="var(--primary)" strokeWidth="1.1" strokeLinejoin="round" />
      <rect x="12.4" y="15.2" width="8.6" height="1.8" rx=".9" fill="var(--primary)" />
      <rect x="12.4" y="19" width="6" height="1.8" rx=".9" fill="#1b1a18" opacity=".28" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <LogoMark />
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          Typeset
        </span>
      )}
    </span>
  );
}
