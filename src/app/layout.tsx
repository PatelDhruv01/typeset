import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font downloads and self-hosts these at build time. That matters more
// than it looks: the legacy script pulled fonts from Google's CDN at render
// time, so a render box without egress silently fell back to Times New Roman.
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
