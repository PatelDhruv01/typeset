import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font downloads and self-hosts these at build time. That matters more
// than it looks: the legacy script pulled fonts from Google's CDN at render
// time, so a render box without egress silently fell back to Times New Roman.
//
// Archivo carries the whole app chrome - body and headings alike, per the
// Modernist design system (it draws no distinction between the two). Weights
// 400/600/800 match what the design's own font request asks for.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Typeset — Markdown to PDF",
    template: "%s · Typeset",
  },
  description:
    "Turn Markdown into a typeset, print-ready PDF. Live paginated preview, real typography controls, no sign-up.",
  applicationName: "Typeset",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables live on <html>, not <body>: `--font-sans`/`--font-mono`
    // in globals.css are declared on `:root` (= <html>), and their value nests
    // a var() reference to `--font-archivo`/`--font-jetbrains-mono`. Putting the
    // font classes on <body> instead put that inner variable one element below
    // :root, which made the whole chain fail to resolve - every themed font
    // and, it turned out, every other @theme-derived token (colours, radii)
    // silently fell back to its CSS-initial value. Same element, no ambiguity.
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
