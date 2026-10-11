// src/app/tools/whatsapp-qr-code/content.ts
//
// Everything editable on the WhatsApp QR code page: copy, videos, reviews and
// the call-back form labels. page.tsx only arranges these.
//
// ── How to update ─────────────────────────────────────────────────────
//  • Reels / Shorts and videos: paste a YouTube, Vimeo or Instagram Reel
//    link into `src`. Until then a labelled stand-in is shown.
//  • Reviews: add real customer quotes to REVIEWS. While it is empty the
//    section invites feedback instead. Never put invented quotes here.
//  • Blog cards fill themselves from content/blog (posts tagged "qr-code").

import type { Review } from '@/components/tools/landing/sections'
import type { ToolPageContent } from '@/components/tools/landing/tool-page'

export const PAGE_PATH = '/tools/whatsapp-qr-code'

/**
 * Real customer reviews only. Example:
 *   { quote: '…', name: 'Priya S.', role: 'Boutique owner, Jaipur', rating: 5 }
 */
export const REVIEWS: Review[] = []

export const CONTENT: ToolPageContent = {
  path: PAGE_PATH,
  relatedTag: 'qr-code',
  formId: 'tool-whatsapp-qr-code',
  toolLabel: 'WhatsApp QR code generator',

  seo: {
    // The site appends " — AiSend", so this stays short enough for a search result.
    title: 'Free WhatsApp QR Code Generator with Logo',
    description:
      'Make a free WhatsApp QR code for your number, group or channel. Add a message, your logo and colours, then download a sharp PNG or SVG. No signup.',
    ogTitle: 'Free WhatsApp QR Code Generator with Logo',
    ogDescription:
      'Turn your WhatsApp number into a QR code that opens a chat in one scan. Style it with your colours and logo, then download it as PNG or SVG.',
  },
  schema: { name: 'WhatsApp QR Code Generator', breadcrumb: 'WhatsApp QR code generator' },

  hero: {
    badge: 'Free WhatsApp QR code generator',
    title: 'Make a WhatsApp QR code customers scan to chat with you',
    lead: 'Add your number and a first message, style the code with your colours and logo, and download it as PNG or SVG. Free, no signup, and nothing leaves your browser.',
    primaryLabel: 'Make my QR code',
    primaryHref: '#generator',
    secondaryLabel: 'Chat with our team',
    whatsappMessage: 'Hi, I just used the WhatsApp QR code generator and I would like to know more about AiSend.',
    proof: ['Free, with no watermark', 'PNG and SVG download', 'Your number stays in your browser'],
  },

  why: {
    heading: 'Why use a WhatsApp QR code?',
    intro:
      'A phone number on a poster asks people to type digits, save a contact and open WhatsApp. A QR code replaces all of that with a single scan.',
    benefits: [
      {
        icon: 'scan',
        title: 'One scan to a chat',
        text: 'The phone camera reads the code and opens a conversation with you. Nobody has to type or save a number.',
      },
      {
        icon: 'image',
        title: 'Works where links cannot',
        text: 'Menus, packaging, shop windows, invoices and business cards cannot be tapped. They can all be scanned.',
      },
      {
        icon: 'palette',
        title: 'Looks like your brand',
        text: 'Choose a shape and colour, add your logo and put a short label under the code so people know what it does.',
      },
    ],
    reels: [
      { title: 'How to scan a WhatsApp QR code', src: '' },
      { title: 'Where to stick your QR code', src: '' },
    ],
  },

  workflow: {
    heading: 'Your QR code is ready in three steps',
    intro: 'It takes about a minute. You can change anything and download again as often as you like.',
    steps: [
      {
        title: 'Choose what it opens',
        text: 'Type your WhatsApp number and a first message, or paste a group or channel link.',
        sample: { kind: 'number', text: '+91 98765 43210' },
      },
      {
        title: 'Style it',
        text: 'Pick a shape and colour, add your logo, and put a short label under the code if you like.',
        sample: { kind: 'message', text: 'Scan to chat' },
      },
      {
        title: 'Download and test',
        text: 'Save a PNG or an SVG, then scan it with your own phone before it goes to print.',
        sample: { kind: 'link', text: 'whatsapp-qr.svg' },
      },
    ],
  },

  useCases: {
    heading: 'Where a WhatsApp QR code earns its place',
    intro: 'Pick a place and we load a message and a label that suit it into the generator above. Change them however you like.',
    actionLabel: 'Use this setup',
    cases: [
      {
        icon: 'store',
        title: 'Restaurant tables and menus',
        text: 'Guests can order, ask for the bill or request a table without waving a waiter down.',
        message: 'Hi! I am at your restaurant and would like to place an order.',
        data: { frame: 'Scan to order', dots: 'rounded' },
      },
      {
        icon: 'pin',
        title: 'Shop window and counter',
        text: 'People who walk past after closing can still send a message, and be answered in the morning.',
        message: 'Hi! I saw your shop and have a question.',
        data: { frame: 'Message us on WhatsApp', dots: 'rounded' },
      },
      {
        icon: 'inbox',
        title: 'Packaging and delivery slips',
        text: 'Buyers can reach you about a delivery, a size or a return from the box itself.',
        message: 'Hi! I need help with my order.',
        data: { frame: 'Need help? Scan to chat', dots: 'square' },
      },
      {
        icon: 'profile',
        title: 'Business cards and brochures',
        text: 'A scan is quicker than typing a number from a card, and it starts the conversation right away.',
        message: 'Hi! I got your card and would like to talk.',
        data: { frame: 'Chat with us', dots: 'square' },
      },
      {
        icon: 'megaphone',
        title: 'Posters and flyers',
        text: 'Turn a passer-by into a conversation, with a message that names the offer on the poster.',
        message: 'Hi! I saw your poster and want to know more.',
        data: { frame: 'Scan to chat', dots: 'rounded' },
      },
      {
        icon: 'users',
        title: 'Events and stalls',
        text: 'Visitors can ask for details now and you can follow up with them after the event.',
        message: 'Hi! I met you at your stall and would like the details.',
        data: { frame: 'Scan for details', dots: 'dots' },
      },
    ],
  },

  banner: {
    heading: 'Planning a print run? Ask us before you print',
    text: 'Tell us where the code will go and who will scan it. We will look at your design, suggest the first message and help set up the chat that follows.',
    label: 'Chat on WhatsApp',
    message: 'Hi, I would like help planning a WhatsApp QR code for my business.',
  },

  guide: {
    heading: 'The complete guide to WhatsApp QR codes',
    intro:
      'How they work, how to design one that scans, how big to print it, and how to see which placement is bringing you chats.',
    sections: [
      {
        id: 'what-is-a-whatsapp-qr-code',
        heading: 'What a WhatsApp QR code is',
        blocks: [
          {
            kind: 'p',
            text: 'A WhatsApp QR code is a square picture that a phone camera can read. When someone scans it, their phone opens a WhatsApp chat with your business number. If you added a first message, it is already typed in the box, so the customer only has to tap send.',
          },
          {
            kind: 'p',
            text: 'There is nothing special inside the picture. A QR code is a way of storing a short piece of text, and for WhatsApp that text is a normal [click-to-chat link](/tools/whatsapp-link-generator) that starts with `wa.me`. The camera reads the link and offers to open it. That is why the same code works for a personal number, the WhatsApp Business app and a number connected to the WhatsApp Business API.',
          },
          {
            kind: 'p',
            text: 'The code is also static. It holds the link exactly as it was on the day you made it. Nothing is stored on a server, nothing can expire, and nothing can be edited afterwards. If your number or your opening message changes, you need a new code, so settle the wording before you print.',
          },
          {
            kind: 'note',
            title: 'No middleman',
            text: 'Codes made on this page point straight to WhatsApp. There is no redirect through our servers and no tracking, so they keep working for as long as your number does.',
          },
        ],
      },
      {
        id: 'how-to-make-one',
        heading: 'How to make a WhatsApp QR code',
        blocks: [
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Choose what it opens.** For a chat, pick your country and type your WhatsApp number. For a group or channel, paste its invite link.',
              '**Write the first message.** Type the words customers should send, such as "Hi, I would like to order". Keep it short and make it specific to the place where the code will sit.',
              '**Style the code.** Choose a shape, a colour and a background. Add a chat icon or your own logo in the middle if you want one.',
              '**Add a frame if it helps.** A short label such as "Scan to chat" under the code tells people what it does.',
              '**Download it.** Take the PNG for screens and quick prints, or the SVG for a professional print job.',
              '**Scan it yourself.** Use your own phone and the normal camera app, from the distance a customer will use.',
            ],
          },
          {
            kind: 'p',
            text: 'The whole process takes about a minute. If you only need a link to share online, the [WhatsApp link generator](/tools/whatsapp-link-generator) gives you the link and a basic code together.',
          },
        ],
      },
      {
        id: 'design-a-code-that-scans',
        heading: 'Design a code that scans',
        blocks: [
          {
            kind: 'p',
            text: 'Most scanning problems come from design choices made after the code is created. Phone cameras look for dark squares on a lighter background, and they need a clear space around the edge to find the corners.',
          },
          { kind: 'h4', text: 'Colour and contrast' },
          {
            kind: 'p',
            text: 'Dark on light always works. Light on dark works on newer phones but not on all of them, so avoid it for anything you print in bulk. What matters is the difference in brightness between the code and its background, not the colour itself.',
          },
          {
            kind: 'table',
            caption: 'Common colour choices and how phone cameras treat them.',
            head: ['Combination', 'Scans on most phones?', 'Comment'],
            rows: [
              ['Dark green on white', 'Yes', 'Easy to read and close to the feel of WhatsApp.'],
              ['Black on cream or mint', 'Yes', 'A soft background is fine as long as the code stays dark.'],
              ['Navy or plum on white', 'Yes', 'A good choice for brands that do not use green.'],
              ['Bright green on white', 'Often not', 'Looks pale to a camera, especially under shop lighting.'],
              ['White on a dark background', 'Newer phones only', 'Avoid it for large print runs.'],
              ['Pastel on pastel', 'No', 'There is not enough contrast for the camera to separate the squares.'],
            ],
          },
          {
            kind: 'note',
            title: 'The generator checks this for you',
            text: 'It measures the contrast between your two colours. If it is too low, the download buttons switch off. If you choose a light code on a dark background, it shows a warning.',
          },
          { kind: 'h4', text: 'Keep the empty border' },
          {
            kind: 'p',
            text: 'The blank margin around a code is called the quiet zone. Four squares wide is the standard, and the generator adds it for you. Do not crop it, and do not let a border, a photo or a line of text run into it.',
          },
        ],
      },
      {
        id: 'how-big-to-print-it',
        heading: 'How big to print it',
        blocks: [
          {
            kind: 'p',
            text: 'A simple rule works well: the code should be about one tenth as wide as the distance people will scan it from. A menu held in the hand needs a small code. A poster on a wall needs a much larger one.',
          },
          {
            kind: 'table',
            caption: 'A guide based on the one-tenth rule. Bigger is always safer.',
            head: ['Where it is placed', 'Scanning distance', 'Smallest code'],
            rows: [
              ['Business card', '20 to 30 cm', '2.5 cm'],
              ['Packaging or delivery slip', 'About 30 cm', '3 cm'],
              ['Menu or table tent', '30 to 40 cm', '4 cm'],
              ['Shop window or counter sign', 'About 1 m', '10 cm'],
              ['Poster or notice board', 'About 2 m', '20 cm'],
              ['Banner or hoarding', 'About 5 m', '50 cm'],
            ],
          },
          {
            kind: 'p',
            text: 'Resolution matters as much as size. A small PNG stretched to fit a poster prints with blurry edges that cameras struggle to read. For anything bigger than a business card, download the print-size PNG or, better, the SVG, which stays sharp at any size.',
          },
          {
            kind: 'p',
            text: 'Where you can, print on matte paper. Glossy paper and plastic laminate reflect light, and a bright patch of glare over one corner is enough to stop a scan.',
          },
        ],
      },
      {
        id: 'logo-shapes-and-frames',
        heading: 'Logo, shapes and frames',
        blocks: [
          {
            kind: 'p',
            text: 'A plain black and white code looks like every other code. A few small touches make it look like part of your brand and help people understand what it is for.',
          },
          { kind: 'h4', text: 'Square, rounded or dots' },
          {
            kind: 'p',
            text: 'The shape options change how the squares are drawn, not what the code says. Square is the classic look and the safest choice. Rounded is softer and scans just as well. Dots is the most playful and works best when the code is not tiny. The three corner markers always stay clearly visible so the camera can find them.',
          },
          { kind: 'h4', text: 'A logo in the middle' },
          {
            kind: 'p',
            text: 'You can place a chat icon or your own logo in the centre. A QR code carries built-in error correction, so a covered or damaged area can be rebuilt from the rest of the picture. When you add a logo, the generator switches to the strongest level so the covered middle does not matter. Use a simple logo on a plain background, keep the file small, and scan the result before you print.',
          },
          { kind: 'h4', text: 'A frame with a label' },
          {
            kind: 'p',
            text: 'People scan more when they know what will happen. A short label under the code, such as "Scan to chat" or "Scan to order", answers the question "what is this?" before they lift their phone. Keep it under about 20 characters so it stays large enough to read.',
          },
        ],
      },
      {
        id: 'groups-and-channels',
        heading: 'QR codes for groups and channels',
        blocks: [
          {
            kind: 'p',
            text: 'A QR code for your number opens a one-to-one chat. If you run a community, you may want people to join a group or follow a channel instead.',
          },
          {
            kind: 'list',
            items: [
              '**Group.** Open the group in WhatsApp, go to the group info page and copy the invite link. Paste it into the generator under the "A group or channel" tab.',
              '**Channel.** Open your channel, choose the option to share or copy its link, and paste it in the same way.',
            ],
          },
          {
            kind: 'p',
            text: 'The generator accepts only genuine WhatsApp group and channel links, and it removes extra tracking text from the end. Remember that anyone who scans a group invite code can join, so keep the code off public walls if the group is meant to be private. You can reset a group invite link in the group settings, which also stops old printed codes from working.',
          },
        ],
      },
      {
        id: 'test-and-track',
        heading: 'Test it, then see what works',
        blocks: [
          {
            kind: 'p',
            text: 'Test before you print. Scan the code with at least two phones, one Android and one iPhone, using the normal camera app. Try it in the lighting where it will sit and from the real distance, not from a desk.',
          },
          { kind: 'h4', text: 'Know which code brought the chat' },
          {
            kind: 'p',
            text: 'A QR code that points to a plain `wa.me` link cannot tell you where it was scanned. The simplest fix needs no extra tools: give each placement its own first message. A table code might say "Hi, I am at table 5 and would like to order", a packaging insert "Hi, I need help with my order", and a poster "Hi, I saw your poster". When the chat opens, you can see which code it came from.',
          },
          {
            kind: 'p',
            text: 'In a shared inbox such as the one in [AiSend](/signup), your whole team sees that first message at the top of every chat and can tag the conversation, so each placement can be counted without reading every chat by hand.',
          },
        ],
      },
      {
        id: 'mistakes-to-avoid',
        heading: 'Mistakes that stop codes scanning',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Stretching it.** Always resize with the proportions locked so the squares stay square.',
              '**Low contrast.** A pale code over a coloured photo fails quickly under shop lights.',
              '**Making it too small.** Check the size table above before you send a file to the printer.',
              '**Covering the corners.** A logo or sticker may sit in the middle only, never over the three corner markers.',
              '**Crowding the border.** Keep text, frames and patterns outside the empty margin.',
              '**Printing a screenshot.** A screenshot is low resolution. Download the file instead.',
              '**Writing a long first message.** More text means a denser code with smaller squares, which is harder to scan from a distance. One sentence is plenty.',
              '**Skipping the proof.** Scan a printed copy before you order the full run.',
            ],
          },
          {
            kind: 'p',
            text: 'Follow these and the code should scan on the first try for almost everyone. If a code still does not scan, the questions below cover the usual causes.',
          },
        ],
      },
    ],
  },

  beyond: {
    heading: 'A QR code starts the chat. AiSend helps you run it.',
    intro:
      'A printed code can bring in messages all day. AiSend gives your team one place to answer them, even when you are not at your desk.',
    features: [
      {
        icon: 'inbox',
        title: 'One shared inbox',
        text: 'Every scan lands in the same inbox, where your team can answer, assign and tag chats.',
      },
      {
        icon: 'bot',
        title: 'An automatic first reply',
        text: 'Greet people the moment they scan, ask what they need and pass the chat to a person when it matters.',
      },
      {
        icon: 'megaphone',
        title: 'Follow-ups to opted-in contacts',
        text: 'Send approved template messages to people who have agreed to hear from you.',
      },
    ],
    ctaLabel: 'Create your account',
    ctaHref: '/signup',
    moreLabel: 'Explore the WhatsApp Business API',
    moreHref: '/whatsapp-business-api',
  },

  videos: {
    heading: 'See it in action',
    intro: 'Two short walk-throughs: making your first code, and printing it so it scans.',
    videos: [
      {
        title: 'Make your first WhatsApp QR code',
        src: '',
        caption: 'Make your first WhatsApp QR code',
        detail: 'From your number to a finished PNG.',
      },
      {
        title: 'Print and place your QR code',
        src: '',
        caption: 'Print and place your QR code',
        detail: 'Size, paper and placement that get scanned.',
      },
    ],
  },

  reviews: REVIEWS,
  reviewsCopy: {
    heading: 'What customers say',
    intro: 'Words from businesses that use AiSend.',
    inviteHeading: 'Using AiSend in your business?',
    inviteText: 'Tell us how it is going. With your permission, we will share your story here.',
    inviteLabel: 'Share your feedback',
    inviteMessage: 'Hi, I would like to share my feedback about AiSend.',
  },

  postsCopy: {
    heading: 'Guides on WhatsApp QR codes',
    intro: 'Practical reads on making, printing and placing codes that people scan.',
  },

  toolsRail: {
    heading: 'More free WhatsApp tools',
    intro: 'Everything here is free and runs in your browser.',
    openLabel: 'Open tool',
    viewAllHref: '/tools',
    viewAllLabel: 'View all free tools',
    tools: [
      {
        href: '/tools/whatsapp-link-generator',
        name: 'WhatsApp link generator',
        text: 'Create a click-to-chat link with a pre-filled message to use in bios, emails and ads.',
        tag: 'Click-to-chat',
        icon: 'link',
      },
      {
        href: '/tools/whatsapp-chat-widget',
        name: 'WhatsApp chat button generator',
        text: 'Design a floating chat button for your website and copy the code.',
        tag: 'Website',
        icon: 'globe',
      },
      {
        href: '/tools/whatsapp-template-generator',
        name: 'Message template generator',
        text: 'Write a template and check it against the common reasons for rejection.',
        tag: 'Templates',
        icon: 'file',
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
    ],
  },

  faqHeading: 'Frequently asked questions',
  faqs: [
    {
      q: 'What is a WhatsApp QR code?',
      a: 'It is a square code that a phone camera can scan to open a WhatsApp chat with a number. Behind the picture is an ordinary click-to-chat link, so the person scanning does not need to save your number or type anything.',
    },
    {
      q: 'How do I make a WhatsApp QR code for my number?',
      a: 'Choose your country, type your WhatsApp number and, if you like, add a first message. Style the code, then download it as a PNG or SVG. The code updates as you type, so you can see exactly what you are getting.',
    },
    {
      q: 'Is this WhatsApp QR code generator free?',
      a: 'Yes. There is no signup, no limit on how many codes you make and no watermark. The codes never expire either, because they point straight to WhatsApp and not to a page on our servers.',
    },
    {
      q: 'Can I add a pre-filled message to the QR code?',
      a: 'Yes. Whatever you type in the message box waits in the chat box when someone scans. They still tap send themselves, so nothing goes out without them choosing to. Keep the message short, because a longer message makes a denser code.',
    },
    {
      q: 'Can I put my logo in the middle of the code?',
      a: 'Yes. Choose "Your logo" and upload a PNG, JPG or WebP image up to 2 MB. We shrink it for you and switch the code to the strongest error correction so the covered middle does not stop it scanning.',
      points: [
        'Use a simple logo on a plain background',
        'Scan the result with a phone before you print',
        'Never cover the three corner markers',
      ],
    },
    {
      q: 'Should I download the PNG or the SVG?',
      a: 'Use the PNG for screens, social posts and quick prints from a desktop printer. Use the SVG for anything a print shop will handle, such as posters, boards and packaging, because it stays perfectly sharp at any size.',
    },
    {
      q: 'How big should the printed QR code be?',
      a: 'A good rule is one tenth of the scanning distance. A code on a menu read from 30 cm can be about 3 to 4 cm wide. A poster read from 2 metres needs about 20 cm. When in doubt, print it larger.',
    },
    {
      q: 'Which colours scan best?',
      a: 'A dark code on a light background scans best on every phone. Dark green, navy, plum and black on white, mint or cream all work well. The generator measures the contrast and stops the download if the colours are too close.',
    },
    {
      q: 'Will my WhatsApp QR code expire?',
      a: 'No. The code is static, so it stays valid as long as the number or link inside it is valid. The only way it stops working is if you stop using that number, or reset the invite link of a group.',
    },
    {
      q: 'Can I change the message or number after I have printed it?',
      a: 'No. A printed code always opens the link it was made with. If you may want to change things later, point the code at a short address on your own website that redirects to WhatsApp. You can then change the destination without reprinting.',
    },
    {
      q: 'Can I make a QR code for a WhatsApp group or channel?',
      a: 'Yes. Switch to the "A group or channel" tab and paste the invite link from WhatsApp. Anyone who scans a group code can join, so do not display it publicly if the group is private.',
    },
    {
      q: 'Does it work with WhatsApp Business and the Business API?',
      a: 'Yes. The code opens a chat with any number that is registered on WhatsApp, including the WhatsApp Business app and a number connected to the WhatsApp Business API.',
    },
    {
      q: 'Why is my QR code not scanning?',
      a: 'The cause is almost always the design, not the code. Check these things first:',
      points: [
        'The colours have enough contrast, with a dark code on a light background',
        'The empty border around the code has not been cropped or covered',
        'It is printed large enough for the scanning distance',
        'The image has not been stretched or saved at a low resolution',
        'Glare from glossy paper is not covering part of the code',
      ],
    },
    {
      q: 'Is my phone number stored anywhere?',
      a: 'No. The code is drawn in your browser. Your number, your message and any logo you upload are not sent to our servers by this tool.',
    },
    {
      q: 'How can I tell which poster or table brought a chat?',
      a: 'Give each placement a different first message, such as "Hi, I am at table 5". When the chat opens you can see the message and know which code it came from. A shared inbox lets your team tag and count these chats.',
    },
  ],

  lead: {
    heading: 'Want help setting up WhatsApp for your business?',
    intro: 'Leave your details and our team will call you back. If you would rather chat, message us on WhatsApp.',
    points: [
      'We call to understand what you need',
      'Get help connecting your number to the official WhatsApp Business API',
      'No obligation to sign up',
    ],
    whatsappLabel: 'Chat on WhatsApp',
    whatsappMessage: 'Hi, I would like a call back about WhatsApp for my business.',
    sourceLabel: 'WhatsApp QR code page',
  },
}
