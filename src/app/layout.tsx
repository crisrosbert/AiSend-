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
  "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";

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
  themeColor: "#10b981",
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
      <body className="min-h-full bg-[#f4f7f5] text-[#0c1f17]" style={{ fontFamily: "var(--font-sans)" }}>
        {children}
        <Toaster
          theme="light"
          position="top-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid #e7ece9",
              color: "#0c1f17",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
