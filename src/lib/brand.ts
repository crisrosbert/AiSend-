/**
 * Single source of truth for the product brand.
 *
 * Change the name, links or colours here and every page that imports
 * `BRAND` follows. Technical identifiers that existing customers depend on
 * (the `/aisend.js` tracking script, cookie and localStorage keys, the
 * `aisend_` API key prefix) are deliberately NOT renamed — changing them
 * would break websites that already embed the script and sign users out.
 */

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://app.performancemktg.net"
).replace(/\/+$/, "");

export const BRAND = {
  name: "PerfChat",
  tagline: "WhatsApp CRM & AI agent for growing businesses",
  description:
    "PerfChat is a WhatsApp CRM and marketing platform for Indian businesses. Manage conversations, send broadcast campaigns, and automate follow-ups with AI.",
  siteUrl: SITE_URL,
  host: SITE_URL.replace(/^https?:\/\//, ""),
  supportEmail: "admin@performancemktg.net",
  supportPhone: "+91 8707879485",
  supportWhatsApp: "https://wa.me/918707879485",
  colors: {
    green: "#17A673",
    navy: "#14213D",
  },
} as const;

export type Brand = typeof BRAND;
