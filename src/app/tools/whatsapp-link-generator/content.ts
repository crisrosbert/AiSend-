// src/app/tools/whatsapp-link-generator/content.ts
//
// Everything editable on the WhatsApp link generator page: copy, videos,
// reviews and the call-back form labels. page.tsx only arranges these.
//
// ── How to update ─────────────────────────────────────────────────────
//  • Reels / Shorts and videos: paste a YouTube, Vimeo or Instagram Reel
//    link into `src`. Until then a labelled stand-in is shown.
//  • Reviews: add real customer quotes to REVIEWS. While it is empty the
//    section invites feedback instead — never put invented quotes here.
//  • Blog cards fill themselves from content/blog (posts tagged
//    "whatsapp-link").

import type { UseCase } from '@/components/tools/landing/use-cases'
import type { RailTool } from '@/components/tools/landing/tools-rail'
import type { Benefit, Step, Feature, VideoItem, Review, FaqItem } from '@/components/tools/landing/sections'
import { SITE_URL } from '@/lib/seo/site'

export const PAGE_PATH = '/tools/whatsapp-link-generator'
export const PAGE_URL = `${SITE_URL}${PAGE_PATH}`

/** Tag that marks the blog posts shown in "Related articles". */
export const RELATED_POST_TAG = 'whatsapp-link'

/** Lead form id: shows up as the lead's source in the CRM. */
export const LEAD_FORM_ID = 'tool-whatsapp-link-generator'

export const SEO = {
  // The site appends " — AiSend", so this stays short enough for a search result.
  title: 'Free WhatsApp Link Generator with QR Code',
  description:
    'Create a free WhatsApp link (wa.me) with a pre-filled message and QR code. Add your number, copy the link and share it anywhere. No signup needed.',
  ogTitle: 'Free WhatsApp Link Generator with QR Code',
  ogDescription:
    'Turn your number into a link and QR code that opens a WhatsApp chat in one tap, with your first message already typed.',
}

export const HERO = {
  badge: 'Free click-to-chat link generator',
  title: 'Create a WhatsApp link people can tap to message you',
  lead: 'Enter your number, type a first message and get a wa.me link and QR code in seconds. No signup, nothing to install.',
  primaryLabel: 'Create my link',
  primaryHref: '#generator',
  secondaryLabel: 'Chat with our team',
  whatsappMessage: 'Hi, I just used the WhatsApp link generator and I would like to know more about AiSend.',
  proof: ['Free to use', 'Works with WhatsApp Business', 'Your number stays in your browser'],
} as const

export const WHY = {
  heading: 'Why use a WhatsApp link instead of a phone number?',
  intro:
    'A number on a poster or in a bio asks people to save it, open WhatsApp and start typing. A link removes all of that: one tap and the chat is open.',
  benefits: [
    {
      icon: 'bolt',
      title: 'One tap to a chat',
      text: 'Nobody has to save your number or copy it across. The conversation opens with you, ready to type.',
    },
    {
      icon: 'chat',
      title: 'A first message that is already written',
      text: 'The text box opens with your message filled in, so you know what the person wants before you reply.',
    },
    {
      icon: 'globe',
      title: 'Works wherever people can tap or scan',
      text: 'Use it in a bio, on your website, in an email or as a QR code on print. It is the same link every time.',
    },
  ] satisfies Benefit[],
  // Paste a YouTube Short or an Instagram Reel link as `src`.
  reels: [
    { title: 'How a WhatsApp link opens a chat', src: '' },
    { title: 'Adding your WhatsApp link to an Instagram bio', src: '' },
  ] as { src?: string; title: string }[],
}

export const WORKFLOW = {
  heading: 'Your link is ready in three steps',
  intro: 'It takes less than a minute, and you can change the message and generate a new link as often as you like.',
  steps: [
    {
      title: 'Add your number',
      text: 'Choose your country and type your WhatsApp number. We tidy up the format, so there is no doubled country code or stray zero.',
      sample: { kind: 'number', text: '+91 98765 43210' },
    },
    {
      title: 'Write the first message',
      text: 'Type what people should say when the chat opens, or start from a ready-made message.',
      sample: { kind: 'message', text: 'Hi, I would like to know more about your services.' },
    },
    {
      title: 'Copy the link and share it',
      text: 'Copy the wa.me link or download the QR code, then put it in your bio, on your website or on print.',
      sample: { kind: 'link', text: 'wa.me/919876543210' },
    },
  ] satisfies Step[],
}

export const USE_CASES = {
  heading: 'Where to put your WhatsApp link',
  intro: 'Pick a place and we load a message that suits it into the generator above. Change it however you like.',
  actionLabel: 'Use this message',
  cases: [
    {
      icon: 'profile',
      title: 'Instagram and Facebook bio',
      text: 'The one link your bio allows can open a chat instead of a generic contact page.',
      message: 'Hi! I found you on Instagram and I have a question.',
    },
    {
      icon: 'globe',
      title: 'A chat button on your website',
      text: 'Skip the contact form. A button that links here starts a real conversation.',
      message: 'Hi! I am on your website and would like some help.',
    },
    {
      icon: 'pin',
      title: 'Google Business Profile',
      text: 'Add it as a link so people who find you in local search can message straight away.',
      message: 'Hi! I found your business on Google and would like to know more.',
    },
    {
      icon: 'mail',
      title: 'Email signature',
      text: 'Give customers a quicker way to reach you than waiting for an email reply.',
      message: 'Hi, I am replying to your email. Can we continue here?',
    },
    {
      icon: 'megaphone',
      title: 'Ads and campaigns',
      text: 'Send people from a post or an ad into a chat, with a message that names the offer.',
      message: 'Hi! I saw your offer and would like to know more.',
    },
    {
      icon: 'qr',
      title: 'Print and packaging',
      text: 'Turn the link into a QR code for posters, menus, packaging and shop windows.',
      message: 'Hi! I scanned your QR code and have a question.',
    },
  ] satisfies UseCase[],
}

export const BANNER = {
  heading: 'Not sure where to start? Talk to us on WhatsApp',
  text: 'Tell us what you sell and who you want to reach. We will suggest where your link should go and how to handle the chats that follow.',
  label: 'Chat on WhatsApp',
  message: 'Hi, I would like help setting up WhatsApp for my business.',
}

export const BEYOND = {
  heading: 'A link starts the chat. AiSend helps you run it.',
  intro:
    'A free link gets people to message you. When the messages start coming in, AiSend gives your team one place to answer them.',
  features: [
    {
      icon: 'inbox',
      title: 'One shared inbox',
      text: 'Your whole team replies from the same WhatsApp number, with chats assigned and tagged.',
    },
    {
      icon: 'bot',
      title: 'Automatic replies',
      text: 'Answer common questions straight away and pass the conversation to a person when it needs one.',
    },
    {
      icon: 'megaphone',
      title: 'Campaigns to opted-in contacts',
      text: 'Send approved template messages to people who have agreed to hear from you.',
    },
  ] satisfies Feature[],
  ctaLabel: 'Create your account',
  ctaHref: '/signup',
  moreLabel: 'Explore the WhatsApp Business API',
  moreHref: '/whatsapp-business-api',
}

export const VIDEOS = {
  heading: 'See it in action',
  intro: 'Two short walk-throughs: making your first link, and what happens once people start messaging.',
  videos: [
    {
      title: 'Create your first WhatsApp link',
      src: '',
      caption: 'Create your first WhatsApp link',
      detail: 'From entering your number to copying the link.',
    },
    {
      title: 'Handling the chats your link brings in',
      src: '',
      caption: 'Handling the chats your link brings in',
      detail: 'Replying, assigning and following up from one inbox.',
    },
  ] satisfies VideoItem[],
}

/**
 * Real customer reviews only. Example:
 *   { quote: '…', name: 'Priya S.', role: 'Boutique owner, Jaipur', rating: 5 }
 */
export const REVIEWS: Review[] = []

export const REVIEWS_COPY = {
  heading: 'What customers say',
  intro: 'Words from businesses that use AiSend.',
  inviteHeading: 'Using AiSend in your business?',
  inviteText: 'Tell us how it is going. With your permission, we will share your story here.',
  inviteLabel: 'Share your feedback',
  inviteMessage: 'Hi, I would like to share my feedback about AiSend.',
}

export const POSTS_COPY = {
  heading: 'Guides on WhatsApp links',
  intro: 'Short, practical reads on getting more from click-to-chat links and QR codes.',
}

export const TOOLS_RAIL = {
  heading: 'More free WhatsApp tools',
  intro: 'Everything here is free and runs in your browser.',
  openLabel: 'Open tool',
  viewAllHref: '/tools',
  viewAllLabel: 'View all free tools',
  tools: [
    {
      href: '/tools/whatsapp-qr-code',
      name: 'WhatsApp QR code generator',
      text: 'Turn your number into a QR code with your colours and logo, and download it as PNG or SVG.',
      tag: 'QR code',
      icon: 'qr',
    },
    {
      href: '/tools/whatsapp-template-generator',
      name: 'Message template generator',
      text: 'Write a template and check it against the common reasons for rejection.',
      tag: 'Templates',
      icon: 'file',
    },
    {
      href: '/tools/whatsapp-chat-widget',
      name: 'Chat button for websites',
      text: 'Design a floating chat button with a welcome popup and copy the code.',
      tag: 'Website',
      icon: 'globe',
    },
    {
      href: '/tools/whatsapp-roi-calculator',
      name: 'WhatsApp ROI calculator',
      text: 'Compare the return from WhatsApp, SMS and email campaigns.',
      tag: 'Calculator',
      icon: 'calc',
    },
    {
      href: '/tools/whatsapp-text-formatter',
      name: 'WhatsApp text formatter',
      text: 'Add bold, italic, strikethrough and bullets, with a live chat preview.',
      tag: 'Editor',
      icon: 'chat',
    },
    {
      href: '/tools/whatsapp-catalog-builder',
      name: 'WhatsApp catalogue builder',
      text: 'Paste your store address and get a ready-to-send product list.',
      tag: 'Catalogue',
      icon: 'store',
    },
    {
      href: '/tools/whatsapp-bulk-sender',
      name: 'WhatsApp bulk message sender',
      text: 'Send approved template messages to opted-in contacts through the official API.',
      tag: 'Official API',
      icon: 'megaphone',
    },
  ] satisfies RailTool[],
}

export const FAQ_HEADING = 'Frequently asked questions'

export const FAQS: FaqItem[] = [
  {
    q: 'What is a WhatsApp link?',
    a: 'A WhatsApp link, also called a click-to-chat link, is a web address that opens a WhatsApp chat with a specific number. It looks like wa.me/919876543210. Whoever taps it does not need to save your number first.',
  },
  {
    q: 'How do I create a WhatsApp link for my number?',
    a: 'Choose your country, type your WhatsApp number and, if you like, add a first message. The link appears as you type. Copy it, or download the QR code, and share it.',
  },
  {
    q: 'How do I add a pre-filled message to the link?',
    a: 'Type the message in the message box. The generator adds it to the link as ?text= followed by your message in web-safe form, so spaces, emojis and line breaks all work. The text appears in the chat box when someone opens the link.',
  },
  {
    q: 'What format should the phone number be in?',
    a: 'A WhatsApp link needs the full number with the country code and nothing else. The generator takes care of this for you.',
    points: [
      'Start with the country code, for example 91 for India',
      'No plus sign, spaces, dashes or brackets in the final link',
      'Drop the leading zero of the local number',
    ],
  },
  {
    q: 'Is this WhatsApp link generator free?',
    a: 'Yes. There is no signup, no limit on links and no watermark on the QR code.',
  },
  {
    q: 'Does it work with WhatsApp Business?',
    a: 'Yes. A wa.me link works the same for a personal number, the WhatsApp Business app and a number on the WhatsApp Business API.',
  },
  {
    q: 'Will the pre-filled message be sent automatically?',
    a: 'No. It only fills in the text box. The person still taps send, so nothing goes out without them choosing to.',
  },
  {
    q: 'Can I turn the link into a QR code?',
    a: 'Yes. A QR code for your link appears beside it. Download it as an image and use it on posters, menus, packaging or a shop window. Scan it once with a phone before you print.',
  },
  {
    q: 'Is my phone number stored anywhere?',
    a: 'No. The link and QR code are made in your browser, and your number is not sent to our servers by the generator.',
  },
  {
    q: 'Why is my WhatsApp link not working?',
    a: 'Most problems come from the number. Check that it has the country code, that there is no extra zero after the country code, and that the number is registered on WhatsApp. Then open the link with the Test in WhatsApp button.',
  },
]

export const LEAD = {
  heading: 'Want help setting up WhatsApp for your business?',
  intro: 'Leave your details and our team will call you back. If you would rather chat, message us on WhatsApp.',
  points: [
    'We call to understand what you need',
    'Get help connecting your number to the official WhatsApp Business API',
    'No obligation to sign up',
  ],
  whatsappLabel: 'Chat on WhatsApp',
  whatsappMessage: 'Hi, I would like a call back about WhatsApp for my business.',
  sourceLabel: 'WhatsApp link generator page',
}
