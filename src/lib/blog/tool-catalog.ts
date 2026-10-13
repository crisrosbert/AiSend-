// The free tools a post can suggest under its text. A post lists the slugs in
// its front matter:  tools: [whatsapp-template-generator, whatsapp-bulk-sender]

export interface BlogTool {
  slug: string
  name: string
  text: string
}

export const BLOG_TOOLS: readonly BlogTool[] = [
  { slug: 'ai-chatbot-widget', name: 'Free AI Chatbot Widget', text: 'Paste your website address and get an AI chatbot trained on your pages. Test it live, then add it for free.' },
  { slug: 'whatsapp-link-generator', name: 'WhatsApp Link Generator', text: 'Create a free click-to-chat wa.me link with a QR code, in your browser.' },
  { slug: 'whatsapp-bulk-sender', name: 'WhatsApp Bulk Sender', text: 'Send templated WhatsApp messages to thousands of contacts, officially.' },
  { slug: 'whatsapp-qr-code', name: 'WhatsApp QR Code Generator', text: 'Make a scannable QR code in your colours, with a logo, and download it as PNG or SVG.' },
  { slug: 'whatsapp-template-generator', name: 'WhatsApp Template Generator', text: 'Write a message template, preview it as a chat bubble and check it against the common reasons for rejection.' },
  { slug: 'whatsapp-chat-widget', name: 'WhatsApp Chat Button for Websites', text: 'Design a floating chat button with a welcome popup, preview it live and copy one block of code.' },
  { slug: 'whatsapp-roi-calculator', name: 'WhatsApp vs SMS vs Email ROI Calculator', text: 'Compare profit, return and break-even for the same campaign on three channels, using your own numbers.' },
  { slug: 'whatsapp-text-formatter', name: 'WhatsApp Text Formatter', text: 'Bold, italic, strikethrough, and bullets, with a live chat preview.' },
  { slug: 'whatsapp-catalog-builder', name: 'WhatsApp Catalogue Builder', text: 'Paste your store URL and get a ready-to-send WhatsApp product list.' },
]

export const TOOL_SLUGS: readonly string[] = BLOG_TOOLS.map((t) => t.slug)
