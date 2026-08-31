import { NextResponse } from "next/server";
import { z } from "zod";

import { mergeConfig } from "@/lib/config/merge";
import { isPresetId, PRESETS, PRESET_IDS } from "@/lib/config/presets";
import {
  documentConfigSchema,
  type PartialDocumentConfig,
} from "@/lib/config/schema";
import { BrowserUnavailableError } from "@/lib/pdf/browser";
import { renderPdfWithFallback } from "@/lib/pdf/render";
import { renderDocument, toSafeFileName } from "@/lib/renderer/document";

/**
 * POST /api/render - Markdown in, PDF out.
 *
 * This is also the public API. The body is a DocumentConfig, the same object
 * the UI edits and a preset is a value of, so anything achievable in the app is
 * achievable here with no extra surface to design or document.
 */

// Chromium cannot run on the edge runtime, and a cold start plus Paged.js
// layout on a long document comfortably exceeds the 10s default.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Roughly a 2 MB Markdown file - far larger than any real document. */
const MAX_SOURCE_LENGTH = 2_000_000;

const requestSchema = z.object({
  source: z
    .string()
    .max(
      MAX_SOURCE_LENGTH,
      `Markdown source must be under ${MAX_SOURCE_LENGTH} characters.`,
    ),
  /**
   * Style preset to start from, by id. Resolved first; `config` is then merged
   * over it. Without this, `{"preset": "academic"}` would look like it worked
   * while doing nothing - `preset` inside a DocumentConfig is only a
   * provenance label, not an instruction.
   */
  preset: z.string().optional(),
  /** Partial: every field the caller omits falls back to a schema default. */
  config: z.unknown().optional(),
  /** Original filename, used when deriving the output name. */
  sourceName: z.string().max(255).optional(),
  /**
   * "html" returns the rendered document instead of a PDF. It is the exact
   * input the PDF renderer is given, which makes it the right thing to look at
   * when output is wrong, and it doubles as the export-HTML feature.
   */
  format: z.enum(["pdf", "html"]).default("pdf"),
});

function errorResponse(message: string, status: number, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail } : {}) },
    { status },
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be JSON.", 400);
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse(
      "Invalid request.",
      400,
      z.prettifyError(parsedRequest.error),
    );
  }

  const { preset } = parsedRequest.data;

  if (preset !== undefined && !isPresetId(preset)) {
    return errorResponse(
      `Unknown preset "${preset}".`,
      400,
      `Valid presets: ${PRESET_IDS.join(", ")}.`,
    );
  }

  // Preset first, caller overrides on top - deep-merged, so overriding one
  // margin does not discard the other three.
  const merged = mergeConfig(
    preset ? PRESETS[preset].config : {},
    (parsedRequest.data.config ?? {}) as PartialDocumentConfig,
  );

  const parsedConfig = documentConfigSchema.safeParse(merged);
  if (!parsedConfig.success) {
    return errorResponse(
      "Invalid configuration.",
      400,
      z.prettifyError(parsedConfig.error),
    );
  }

  if (parsedRequest.data.source.trim() === "") {
    return errorResponse("There is nothing to convert.", 400);
  }

  if (parsedRequest.data.format === "html") {
    // Asset URLs are left as same-origin paths here rather than inlined, so the
    // result is browsable at the app's own origin.
    const rendered = renderDocument(
      parsedRequest.data.source,
      parsedConfig.data,
      { sourceName: parsedRequest.data.sourceName },
    );

    return new Response(rendered.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Typeset-Filename": encodeURIComponent(rendered.fileName),
      },
    });
  }

  try {
    const result = await renderPdfWithFallback(
      parsedRequest.data.source,
      parsedConfig.data,
      { sourceName: parsedRequest.data.sourceName },
    );

    // RFC 5987: `filename` for old clients, `filename*` so a title with
    // non-ASCII characters survives instead of being mangled or dropped.
    const ascii = toSafeFileName(result.fileName).replace(
      /[^\x20-\x7e]/g,
      "_",
    );
    const encoded = encodeURIComponent(`${result.fileName}.pdf`);

    return new Response(result.pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(result.pdf.byteLength),
        "Content-Disposition": `attachment; filename="${ascii}.pdf"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
        // Surfaced so the UI can tell the user when a render was degraded.
        "X-Typeset-Pages": String(result.pageCount),
        "X-Typeset-Paginator": result.paginatedBy,
        "X-Typeset-Duration-Ms": String(result.durationMs),
        ...(result.fallbackReason
          ? { "X-Typeset-Fallback": encodeURIComponent(result.fallbackReason) }
          : {}),
      },
    });
  } catch (error) {
    if (error instanceof BrowserUnavailableError) {
      return errorResponse(
        "The PDF renderer is unavailable on this server.",
        503,
        error.message,
      );
    }

    console.error("[api/render] failed", error);
    return errorResponse(
      "Could not render the PDF.",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}
