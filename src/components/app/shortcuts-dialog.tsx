"use client";

import { X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] text-foreground">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </span>
    </li>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
  modKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modKey: string;
}) {
  const sections: { title: string; rows: { keys: string[]; label: string }[] }[] = [
    {
      title: "Anywhere",
      rows: [
        { keys: [modKey, "K"], label: "Command menu" },
        { keys: [modKey, "S"], label: "Download PDF" },
        { keys: [modKey, "O"], label: "Open a Markdown file" },
        { keys: [modKey, "V"], label: "Paste - converts copied chatbot answers" },
        { keys: [modKey, "\\"], label: "Show or hide the editor" },
        { keys: ["?"], label: "This list" },
      ],
    },
    {
      title: "Writing",
      rows: [
        { keys: [modKey, "B"], label: "Bold" },
        { keys: [modKey, "I"], label: "Italic" },
        { keys: [modKey, "E"], label: "Inline code" },
        { keys: [modKey, "Z"], label: "Undo" },
        { keys: [modKey, "Shift", "Z"], label: "Redo" },
        { keys: [modKey, "Shift", "V"], label: "Paste as plain text, exactly as copied" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(520px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <DialogTitle className="text-[15px] font-semibold">Keyboard shortcuts</DialogTitle>
          <DialogClose
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="size-[18px]" />
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">Every keyboard shortcut in Typeset.</DialogDescription>
        <div className="grid max-h-[70dvh] gap-6 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground">
                {section.title}
              </h3>
              <ul className="mt-1 divide-y divide-border">
                {section.rows.map((row) => (
                  <Row key={row.label} keys={row.keys} label={row.label} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
