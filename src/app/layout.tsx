import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/app/providers";
import { THEME_INIT_SCRIPT } from "@/lib/app/theme";

import "./globals.css";

// next/font downloads and self-hosts these at build time, so the app chrome
// never depends on a font CDN at runtime. (The *document's* fonts are a
// separate system - see scripts/sync-fonts.mjs.)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Typeset — Markdown and chatbot answers to beautiful PDFs",
    template: "%s · Typeset",
  },
  description:
    "Paste an answer from ChatGPT, Claude or Gemini - or any Markdown - and download a beautifully typeset PDF. Live page preview, real typography, no sign-up.",
  applicationName: "Typeset",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables live on <html>, not <body>: `--font-sans`/`--font-mono`
    // in globals.css are declared on :root and nest var() references to these,
    // so they must resolve on the same element.
    //
    // suppressHydrationWarning: the inline script sets data-theme before React
    // hydrates, so the attribute legitimately differs from the server's HTML.
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
