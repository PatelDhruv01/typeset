import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
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
        {/* Applies the stored appearance before first paint. Without it the page
            renders light and then flips, which is worse than either.
            `beforeInteractive` rather than a bare <script>: React 19 does not
            execute script tags rendered by a component on the client, and warns
            about it. */}
        <Script id="typeset-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("typeset:theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
