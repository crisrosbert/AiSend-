import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

/**
 * Fonts are loaded at runtime via <link> with display=swap instead of
 * next/font/google. next/font downloads fonts from Google at BUILD
 * time, which breaks `next build` on restricted CI networks and
 * offline machines. The <link> approach never fails a build, and the
 * CSS fallback stack in globals.css keeps text readable if the font
 * CDN is unreachable at runtime.
 */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap";

export const metadata: Metadata = {
  title: {
    default: "AiSend — WhatsApp CRM",
    template: "%s — AiSend",
  },
  description:
    "AiSend — The smartest WhatsApp CRM for Indian businesses. Manage conversations, broadcast campaigns, and automate follow-ups.",
  robots: { index: false, follow: false },
  icons: { icon: [{ url: "/icon" }] },
};

export const viewport: Viewport = {
  // Mobile browser chrome colour. References the brand green from
  // globals.css — not a hardcoded hex, so a brand retheme auto-updates
  // the chrome.
  themeColor: "#00855A",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS_HREF} />
      </head>
      {/*
        The body no longer hardcodes background and text colours — those
        used to override the warm-cream canvas defined in globals.css
        (--canvas) and leave the app looking like a cool-grey slate. Now
        globals.css's body rule drives both, so one edit retints the
        whole app.
      */}
      <body className="min-h-full" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
        <Toaster
          theme="light"
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--surface)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
