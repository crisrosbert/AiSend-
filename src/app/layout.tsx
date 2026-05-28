import type { Metadata, Viewport } from "next";
import { Sora, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Clickstream WA — WhatsApp CRM",
    template: "%s — Clickstream WA",
  },
  description:
    "Clickstream WA — The smartest WhatsApp CRM for Indian businesses. Manage conversations, broadcast campaigns, and automate follow-ups.",
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
    <html lang="en" className={`${sora.variable} ${jakarta.variable} h-full antialiased`}>
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
