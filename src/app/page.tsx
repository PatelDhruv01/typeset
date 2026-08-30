const PHASES = [
  { n: 0, name: "Scaffold, repo and CI", done: true },
  { n: 1, name: "Config schema, renderer core, theme system", done: false },
  { n: 2, name: "Chromium PDF engine and download", done: false },
  { n: 3, name: "Editor, presets, live paginated preview", done: false },
  { n: 4, name: "Full customisation drawer", done: false },
  { n: 5, name: "Cover page, table of contents, numbering", done: false },
  { n: 6, name: "Math, Mermaid, callouts, images", done: false },
  { n: 7, name: "Saved presets, sharing, batch, deploy", done: false },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Phase 0
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Typeset
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Markdown in. Typeset PDF out.</p>

      <p className="mt-6 text-muted-foreground">
        The scaffold is running. Next.js, TypeScript and Tailwind are wired up
        and the design tokens are live — this page is using them.
      </p>

      <ol className="mt-10 space-y-1">
        {PHASES.map((phase) => (
          <li
            key={phase.n}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
          >
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-medium ${
                phase.done
                  ? "bg-success text-white"
                  : "border border-border text-muted-foreground"
              }`}
            >
              {phase.done ? "✓" : phase.n}
            </span>
            <span className={phase.done ? "" : "text-muted-foreground"}>
              {phase.name}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
