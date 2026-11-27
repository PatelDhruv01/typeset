"use client";

import { Files, LoaderCircle, Minus, Plus, ScrollText, TriangleAlert } from "lucide-react";

import { PaginatedPreview, type PreviewStatus } from "@/components/paginated-preview";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export type Zoom = number | "fit";

const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

/** The next zoom step above or below what is on screen now. */
export function stepZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) {
    return ZOOM_STEPS.find((step) => step > current + 0.005) ?? ZOOM_STEPS.at(-1)!;
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.005) ?? ZOOM_STEPS[0];
}

function percent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

/**
 * Shown over the canvas while a document's first pages are laid out - a
 * shimmering sheet where the page is about to be, rather than an empty pane
 * or a spinner.
 */
function PageSkeleton() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex justify-center px-5 pt-5">
      <div className="aspect-[210/297] w-full max-w-[34rem] rounded-[3px] bg-surface p-[8%] shadow-page animate-fade-in">
        <div className="skeleton h-5 w-3/5 rounded-full" />
        {[100, 94, 97, 72, 0, 100, 90, 96, 58, 0, 100, 86].map((width, index) =>
          width === 0 ? (
            <div key={index} className="h-6" />
          ) : (
            <div
              key={index}
              className="skeleton mt-3 h-2.5 rounded-full"
              style={{ width: `${width}%` }}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md rounded-xl border border-destructive/30 bg-destructive-soft p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-destructive">
          <TriangleAlert className="size-4" /> This document could not be rendered
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground/80">{message}</pre>
      </div>
    </div>
  );
}

export function PreviewPane({
  html,
  error,
  empty,
  paginate,
  onPaginateChange,
  zoom,
  effectiveZoom,
  onZoomChange,
  onEffectiveZoom,
  pageOffset,
  status,
  onStatus,
  compact,
  firstLayout,
}: {
  html: string | null;
  error: string | null;
  empty: boolean;
  /** No pages of this document have been shown yet: show a skeleton. */
  firstLayout: boolean;
  paginate: boolean;
  onPaginateChange: (paginate: boolean) => void;
  zoom: Zoom;
  effectiveZoom: number;
  onZoomChange: (zoom: Zoom) => void;
  onEffectiveZoom: (zoom: number) => void;
  pageOffset: number;
  status: PreviewStatus;
  onStatus: (status: PreviewStatus) => void;
  /** Phones: icon-only view switch, no page count. */
  compact: boolean;
}) {
  const layingOut = status.state === "laying-out" && paginate;

  return (
    <section aria-label="Preview" className="relative h-full min-h-0 bg-canvas">
      {error !== null ? (
        <ErrorCard message={error} />
      ) : empty || html === null ? null : (
        <PaginatedPreview
          html={html}
          paginate={paginate}
          pageOffset={pageOffset}
          zoom={zoom}
          maxFitZoom={1}
          onEffectiveZoom={onEffectiveZoom}
          insetBottom={72}
          onStatus={onStatus}
        />
      )}

      {firstLayout && error === null && !empty && <PageSkeleton />}

      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur transition-[opacity,transform] duration-200",
          layingOut && !firstLayout ? "opacity-100" : "-translate-y-1 opacity-0",
        )}
      >
        <LoaderCircle className="size-3.5 animate-spin" />
        Updating pages…
      </div>

      {!empty && error === null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
          <div
            role="toolbar"
            aria-label="Preview"
            className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface/95 p-1 shadow-lg backdrop-blur"
          >
            <Segmented
              label="Preview layout"
              value={paginate ? "pages" : "continuous"}
              onChange={(value) => onPaginateChange(value === "pages")}
              options={[
                {
                  value: "pages",
                  icon: <Files />,
                  label: compact ? null : "Pages",
                  ariaLabel: "Pages: exactly as it will print",
                },
                {
                  value: "continuous",
                  icon: <ScrollText />,
                  label: compact ? null : "Continuous",
                  ariaLabel: "Continuous: one scrolling column",
                },
              ]}
            />

            <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />

            <Tip label="Zoom out" side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => onZoomChange(stepZoom(effectiveZoom, -1))}
              >
                <Minus />
              </Button>
            </Tip>

            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Zoom level"
                  className="h-8 min-w-[3.75rem] rounded-md px-2 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-surface-hover data-[state=open]:bg-surface-hover"
                >
                  {zoom === "fit" ? (compact ? percent(effectiveZoom) : `Fit · ${percent(effectiveZoom)}`) : percent(effectiveZoom)}
                </button>
              </MenuTrigger>
              <MenuContent side="top" align="center" className="min-w-[160px]">
                <MenuRadioGroup
                  value={zoom === "fit" ? "fit" : String(zoom)}
                  onValueChange={(value) => onZoomChange(value === "fit" ? "fit" : Number(value))}
                >
                  <MenuRadioItem value="fit">Fit to width</MenuRadioItem>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((step) => (
                    <MenuRadioItem key={step} value={String(step)}>
                      {percent(step)}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuContent>
            </Menu>

            <Tip label="Zoom in" side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => onZoomChange(stepZoom(effectiveZoom, 1))}
              >
                <Plus />
              </Button>
            </Tip>
          </div>
        </div>
      )}
    </section>
  );
}
