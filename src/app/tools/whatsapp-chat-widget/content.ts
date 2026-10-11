// src/app/tools/whatsapp-chat-widget/content.ts
//
// Everything editable on the WhatsApp chat button page: copy, videos, reviews
// and the call-back form labels. page.tsx only arranges these.
//
// ── How to update ─────────────────────────────────────────────────────
//  • Reels / Shorts and videos: paste a YouTube, Vimeo or Instagram Reel
//    link into `src`. Until then a labelled stand-in is shown.
//  • Reviews: add real customer quotes to REVIEWS. While it is empty the
//    section invites feedback instead. Never put invented quotes here.
//  • Blog cards fill themselves from content/blog (posts tagged
//    "chat-widget").
//  • The installation steps inside the tool (WordPress, Shopify and so on)
//    live in widget-tool.tsx. Platform menus change, so re-check them now
//    and then.

import type { Review } from '@/components/tools/landing/sections'
import type { ToolPageContent } from '@/components/tools/landing/tool-page'

export const PAGE_PATH = '/tools/whatsapp-chat-widget'

/**
 * Real customer reviews only. Example:
 *   { quote: '…', name: 'Priya S.', role: 'Boutique owner, Jaipur', rating: 5 }
 */
export const REVIEWS: Review[] = []

export const CONTENT: ToolPageContent = {
  path: PAGE_PATH,
  relatedTag: 'chat-widget',
  formId: 'tool-whatsapp-chat-widget',
  toolLabel: 'WhatsApp chat button generator for websites',

  seo: {
    // The site appends " — AiSend", so this stays short enough for a search result.
    title: 'Free WhatsApp Chat Button for Website',
    description:
      'Make a free WhatsApp chat button for your website. Pick colour, side and a welcome popup, preview it live, then copy one block of code. No plugin or signup.',
    ogTitle: 'Free WhatsApp Chat Button Generator for Your Website',
    ogDescription:
      'Design a floating WhatsApp chat button with a welcome popup, preview it on a website and copy the code. Works on WordPress, Shopify, Wix and any HTML site.',
  },
  schema: { name: 'WhatsApp Chat Button Generator', breadcrumb: 'WhatsApp chat button generator' },

  hero: {
    badge: 'Free WhatsApp chat button generator',
    title: 'Add a WhatsApp chat button to your website in two minutes',
    lead: 'Pick a colour and a side, write a welcome message, and watch the button float over a website. Then copy one block of code. No plugin, no signup, and no other site is loaded.',
    primaryLabel: 'Design my button',
    primaryHref: '#generator',
    secondaryLabel: 'Chat with our team',
    whatsappMessage: 'Hi, I just used the WhatsApp chat button generator and I would like help adding it to my website.',
    proof: ['Free, with no plugin', 'Live preview, computer and phone', 'Works on any website'],
  },

  why: {
    heading: 'Why put a chat button on your website?',
    intro:
      'Most visitors who have a question leave rather than hunt for a contact page. A button that is always in the corner turns that question into a conversation you can answer.',
    benefits: [
      {
        icon: 'chat',
        title: 'Questions become chats',
        text: 'People ask on the app they already use all day. There is no form to fill in and no email to wait on.',
      },
      {
        icon: 'bolt',
        title: 'Light and quick to add',
        text: 'It is one small block of code. It makes no calls to other sites, so it does not slow your pages down.',
      },
      {
        icon: 'palette',
        title: 'Matches your brand',
        text: 'Choose your colour, size and side of the screen, and add a short greeting in your own words.',
      },
    ],
    reels: [
      { title: 'Add a WhatsApp button to any website', src: '' },
      { title: 'Write a popup that gets clicks', src: '' },
    ],
  },

  workflow: {
    heading: 'Live on your website in three steps',
    intro: 'The preview updates as you type, so you can see exactly what your visitors will see.',
    steps: [
      {
        title: 'Add your number',
        text: 'Type your WhatsApp number and the first message people should send when the chat opens.',
        sample: { kind: 'number', text: '+91 98765 43210' },
      },
      {
        title: 'Design the button',
        text: 'Choose a colour, a side and a size. Turn on the welcome popup and write your greeting.',
        sample: { kind: 'message', text: 'Hi! How can we help?' },
      },
      {
        title: 'Copy and paste the code',
        text: 'Copy the block and paste it before the closing body tag of your site. Steps for each platform are in the tool.',
        sample: { kind: 'link', text: '</body>' },
      },
    ],
  },

  useCases: {
    heading: 'Set it up for your kind of business',
    intro:
      'Pick a business and we load a greeting, a name, a button label and a colour that suit it into the generator above. Change any of it.',
    actionLabel: 'Use this setup',
    cases: [
      {
        icon: 'store',
        title: 'Online store',
        text: 'Help shoppers choose a size, check delivery or ask about an order before they leave the page.',
        message: 'Hi! Need help choosing something? Ask us here and we will reply on WhatsApp.',
        data: { agent: 'Store support', role: 'Ask us anything', cta: 'Ask a question', label: 'Chat with us', color: '#1b6b4a' },
      },
      {
        icon: 'megaphone',
        title: 'Restaurant or cafe',
        text: 'Take orders and table bookings from your menu page without a phone call.',
        message: 'Hungry? Order or book a table with a quick message.',
        data: { agent: 'Front desk', role: 'Orders and bookings', cta: 'Start an order', label: 'Order on WhatsApp', color: '#b3261e' },
      },
      {
        icon: 'clock',
        title: 'Clinic or salon',
        text: 'Let patients and clients ask for a slot at the moment they decide to come.',
        message: 'Hello! Would you like to book an appointment? Message us and we will find a time.',
        data: { agent: 'Reception', role: 'Appointments and questions', cta: 'Book a visit', label: '', color: '#123c69' },
      },
      {
        icon: 'pin',
        title: 'Real estate',
        text: 'Turn a property listing into a conversation about a visit or a price list.',
        message: 'Interested in this property? Ask for a visit or the price list.',
        data: { agent: 'Sales team', role: 'Property enquiries', cta: 'Ask about this property', label: 'Enquire now', color: '#1f2937' },
      },
      {
        icon: 'users',
        title: 'School or coaching',
        text: 'Answer questions about courses, fees and admissions while parents are still on the page.',
        message: 'Questions about courses or admissions? We are happy to help.',
        data: { agent: 'Admissions', role: 'Courses and fees', cta: 'Ask about admissions', label: 'Need help?', color: '#5b2a86' },
      },
      {
        icon: 'profile',
        title: 'Agency or services',
        text: 'Invite visitors to describe what they need and get a reply the same day.',
        message: 'Want a quote? Tell us what you need and we will reply today.',
        data: { agent: 'Our team', role: 'Quotes and questions', cta: 'Get a quote', label: 'Get a quote', color: '#1b6b4a' },
      },
    ],
  },

  banner: {
    heading: 'Not sure where to paste the code?',
    text: 'Tell us which platform your website is on. We will show you exactly where the code goes and check that the button appears.',
    label: 'Chat on WhatsApp',
    message: 'Hi, I would like help adding a WhatsApp chat button to my website.',
  },

  guide: {
    heading: 'The complete guide to WhatsApp chat buttons for websites',
    intro:
      'How a chat button works, how to add it to your platform, how to design and word it so people click, and how to see whether it brings you customers.',
    sections: [
      {
        id: 'what-is-a-whatsapp-chat-button',
        heading: 'What a WhatsApp chat button is',
        blocks: [
          {
            kind: 'p',
            text: 'A WhatsApp chat button is a small round button that floats in the corner of your website. When a visitor clicks it, WhatsApp opens with a chat to your business number, and any first message you wrote is already typed in. On a phone it opens the app. On a computer it opens WhatsApp Web or the desktop app.',
          },
          {
            kind: 'p',
            text: 'There is no special software behind it. The button is a link to a normal [click-to-chat address](/tools/whatsapp-link-generator) that starts with `wa.me`. That means it works with a personal number, the WhatsApp Business app and a number connected to the WhatsApp Business API, with nothing to install or connect.',
          },
          {
            kind: 'p',
            text: 'The button shown here can also open a short welcome popup first. The popup greets the visitor, shows a name and a line of text, and has a button that opens the chat. It is a gentle way to say that a real person is on the other end.',
          },
          {
            kind: 'note',
            title: 'What the button does not do',
            text: 'It starts a chat. It does not read or store messages, and it does not show a live conversation on your site. Your replies happen in WhatsApp, or in a shared inbox such as AiSend if your number is connected to one.',
          },
        ],
      },
      {
        id: 'how-to-add-it',
        heading: 'How to add it to your website',
        blocks: [
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Add your number.** Choose your country, type your WhatsApp number and write the first message.',
              '**Design the button.** Pick a colour, a side of the screen and a size. Add a short label if you want one.',
              '**Write the popup.** Give it a name, a line of text, a greeting and a button label, or switch it off.',
              '**Check the preview.** Look at it on the computer and the phone view. Make sure it does not cover anything important.',
              '**Copy the code.** One button copies the whole block.',
              '**Paste it into your site.** Put it just before the closing body tag. The tool lists the steps for each platform.',
              '**Test it.** Open your site in a private window, click the button and check that the chat opens with your message.',
            ],
          },
          {
            kind: 'p',
            text: 'The block contains its own styles, its markup and a small script, so you paste once and nothing else needs to be linked. Every name in it starts with `aswa`, so it cannot clash with your theme.',
          },
        ],
      },
      {
        id: 'platforms',
        heading: 'Where the code goes on each platform',
        blocks: [
          {
            kind: 'p',
            text: 'Every website platform has a place for code that should appear on all pages. These are the usual ones. Menus change from time to time, so look for the closest match if a name is slightly different.',
          },
          {
            kind: 'table',
            caption: 'Where to paste the chat button code.',
            head: ['Platform', 'Where to paste it', 'Good to know'],
            rows: [
              ['WordPress', 'A header and footer plugin, in the footer box.', 'Safer than editing theme files, which an update can overwrite.'],
              ['Shopify', 'Online Store, Themes, Edit code, then theme.liquid, above the closing body tag.', 'Copy your theme first so you can undo a mistake.'],
              ['Wix', 'Settings, then Custom code, set to the end of the body on all pages.', 'May need a paid plan and a connected domain.'],
              ['Squarespace', 'Settings, Developer tools, Code injection, footer box.', 'Available on some plans only.'],
              ['Webflow', 'Project settings, Custom code, footer code.', 'Publish the site after you save.'],
              ['Google Tag Manager', 'A new Custom HTML tag that fires on all pages.', 'Useful when you cannot edit the site directly.'],
              ['Plain HTML', 'In your page or template, above the closing body tag.', 'Upload the file again after the change.'],
            ],
          },
          {
            kind: 'p',
            text: 'If your site is built with a framework and a shared layout file, paste the code into that layout so it appears on every page at once.',
          },
        ],
      },
      {
        id: 'design-it-so-people-click',
        heading: 'Design it so people click',
        blocks: [
          {
            kind: 'p',
            text: 'A chat button only works if visitors notice it and trust it. A few small design choices decide which.',
          },
          { kind: 'h4', text: 'Side, size and distance' },
          {
            kind: 'p',
            text: 'Bottom right is where most visitors expect a chat button, so start there. Choose the left side only if something else on the right already sits in the corner, such as a cookie banner or another widget. The medium size suits most sites. Go larger for sites visited mostly on phones, where a fingertip needs a bigger target.',
          },
          {
            kind: 'table',
            caption: 'Common choices and what they do.',
            head: ['Choice', 'Works well when', 'Watch out for'],
            rows: [
              ['Bottom right', 'Your site has nothing else in that corner.', 'Overlap with a cookie banner or back-to-top arrow.'],
              ['Bottom left', 'The right corner is already used.', 'Left-handed phone users reach it less easily.'],
              ['Icon only', 'Your layout is busy or your audience is used to chat buttons.', 'A few visitors will not know what it does.'],
              ['Icon with words', 'You want to be clear, such as "Chat with us".', 'It is wider, so it may crowd small screens.'],
              ['Pulse on', 'You want to draw attention gently.', 'Constant motion can irritate, so keep it for key pages.'],
              ['Popup on', 'You want to start the conversation for the visitor.', 'Opening too fast feels pushy.'],
            ],
          },
          { kind: 'h4', text: 'Colour and contrast' },
          {
            kind: 'p',
            text: 'Choose a colour that stands out from your page background but matches your brand. The generator checks the contrast and picks a white or dark icon, whichever is easier to see on your colour, so a light button never gets a pale icon.',
          },
          { kind: 'h4', text: 'Do not hide your content' },
          {
            kind: 'p',
            text: 'Check the button on your busiest pages, such as product pages and checkout. A button that covers a price, a form field or a buy button costs more than it earns. Use the distance sliders to move it clear, or show it only on the screens where it fits.',
          },
        ],
      },
      {
        id: 'the-welcome-popup',
        heading: 'Writing a welcome popup that gets clicks',
        blocks: [
          {
            kind: 'p',
            text: 'The popup has one job: to make starting a chat feel easy. It should sound like a person, ask a question the visitor can answer, and offer one clear next step.',
          },
          {
            kind: 'table',
            caption: 'Weak and stronger popup messages.',
            head: ['Weak', 'Stronger', 'Why it works better'],
            rows: [
              ['Welcome to our website.', 'Hi! Need help choosing something? Ask us here.', 'It offers help rather than stating the obvious.'],
              ['Contact us for more information.', 'Want a quote? Tell us what you need and we will reply today.', 'It says what happens next.'],
              ['Chat now!!!', 'Questions about delivery? We can check for you.', 'It names a specific worry.'],
              ['Click here', 'Start chat', 'The button says what will happen.'],
            ],
          },
          { kind: 'h4', text: 'When should it open?' },
          {
            kind: 'p',
            text: 'A popup that opens the moment the page loads interrupts people who have not yet seen what you offer. Five to ten seconds is a sensible starting point for most pages, and longer for pages that take time to read. A visitor who closes it is not shown it again during that visit.',
          },
          { kind: 'h4', text: 'Be honest about who answers' },
          {
            kind: 'list',
            items: [
              '**Use a real name or team name.** "Priya from Sales" is warmer than "Support".',
              '**Do not promise speed you cannot keep.** If you reply within a day, do not write "replies in minutes".',
              '**Match your opening hours.** If nobody is online at night, say so or let the first message set the expectation.',
            ],
          },
        ],
      },
      {
        id: 'the-first-message',
        heading: 'The first message',
        blocks: [
          {
            kind: 'p',
            text: 'The first message is the text waiting in the chat box when the visitor arrives in WhatsApp. They still tap send, so nothing goes out without their choice. Write it as the customer would: short, friendly and specific, such as "Hi! I have a question about your delivery times."',
          },
          { kind: 'h4', text: 'Use a different message for each page' },
          {
            kind: 'p',
            text: 'The simplest way to find out which page brings you chats is to give each one its own first message. A pricing page might say "Hi! I have a question about your pricing", and a product page "Hi! I have a question about this product". When the chat arrives, you can see which page it came from without any extra tools.',
          },
          {
            kind: 'p',
            text: 'To do this, make a separate button for each page template, or place a different code block on key pages. If you also want a quick reference for the links themselves, the [WhatsApp link generator](/tools/whatsapp-link-generator) builds them.',
          },
        ],
      },
      {
        id: 'speed-privacy-accessibility',
        heading: 'Speed, privacy and accessibility',
        blocks: [
          {
            kind: 'p',
            text: 'A chat button sits on every page, so it has to be good company. The code made here is built with that in mind.',
          },
          {
            kind: 'list',
            items: [
              '**It is small.** A few kilobytes of code, with no images and no fonts to download.',
              '**It loads nothing from other sites.** The icon is drawn inside the code, so there are no extra requests that could slow your page.',
              '**It does not shift your layout.** The button is fixed to the corner of the screen, so nothing on the page moves when it appears.',
              '**It sets no cookies.** To remember that a popup was closed during a visit, it uses the browser session, which ends when the tab closes. If you have questions about privacy notices, ask whoever looks after your compliance.',
              '**It can be used with a keyboard.** Every part can be reached with the Tab key, and the Escape key closes the popup.',
              '**It respects reduced motion.** The pulse stops for visitors whose device is set to reduce animation.',
              '**It has readable colours.** The icon colour is chosen for contrast against your button colour.',
            ],
          },
          {
            kind: 'p',
            text: 'When a visitor sends a message, WhatsApp shows you their phone number, because that is how WhatsApp works. Visitors who only click the button and never send anything stay anonymous to you.',
          },
        ],
      },
      {
        id: 'measure-what-works',
        heading: 'See whether it is working',
        blocks: [
          {
            kind: 'p',
            text: 'A button that gets clicks but no sales is worth knowing about. There are three simple ways to measure, from easiest to most detailed.',
          },
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Count the chats.** Compare how many new conversations you get each week before and after you add the button.',
              '**Read the first message.** If you gave pages different first messages, you can see which pages bring chats.',
              '**Track the clicks.** In Google Tag Manager, create a trigger for clicks on links that contain `wa.me`. The popup\'s button is such a link, so each click can be counted as an event in your analytics.',
            ],
          },
          {
            kind: 'p',
            text: 'Give the change a few weeks before you judge it. Try one change at a time, such as the greeting or the delay, so you know which one made the difference.',
          },
        ],
      },
      {
        id: 'common-problems',
        heading: 'If the button does not appear',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Your site is cached.** Clear the cache in your caching plugin or host, then reload in a private window.',
              '**The code went in the wrong place.** It must be inside the page, before the closing body tag, not only in the admin area.',
              '**A plugin removed the script.** Some security or speed plugins strip scripts from custom code. Check their settings, or add the code with Google Tag Manager.',
              '**It is hidden behind something.** Another widget or banner may sit on top. Move the button with the distance sliders, or move it to the other side.',
              '**You limited it to one device.** Check the "Show it on" setting. A button set to phones only will not appear on a computer.',
              '**The chat does not open.** Check that the number has the right country code and that WhatsApp is installed on the phone or reachable through WhatsApp Web.',
            ],
          },
          {
            kind: 'p',
            text: 'If it still does not work, tell us which platform you use and we will help you find the cause.',
          },
        ],
      },
    ],
  },

  beyond: {
    heading: 'A button starts the chat. AiSend helps you run it.',
    intro:
      'Once visitors start messaging you, the work is answering well and fast. AiSend gives your team one place to do that.',
    features: [
      {
        icon: 'inbox',
        title: 'One shared inbox',
        text: 'Every chat from your website lands in the same place, where your team can answer, assign and tag them.',
      },
      {
        icon: 'bot',
        title: 'An automatic first reply',
        text: 'Greet visitors the moment they message you, ask what they need and hand over to a person when it matters.',
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
    intro: 'Two short walk-throughs: adding the button to a website, and writing a popup that gets clicks.',
    videos: [
      {
        title: 'Add a WhatsApp chat button to your website',
        src: '',
        caption: 'Add a chat button to your website',
        detail: 'From the generator to a live page.',
      },
      {
        title: 'Write a welcome popup that gets clicks',
        src: '',
        caption: 'Write a popup that gets clicks',
        detail: 'Wording, timing and the first message.',
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
    heading: 'Guides on WhatsApp chat buttons',
    intro: 'Practical reads on adding a chat button, writing the popup and turning clicks into customers.',
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
      q: 'How do I add a WhatsApp chat button to my website?',
      a: 'Add your number in the generator, design the button, then copy the code and paste it just before the closing body tag of your pages. The tool lists the exact steps for WordPress, Shopify, Wix, Squarespace, Webflow, Google Tag Manager and plain HTML sites.',
    },
    {
      q: 'Is this WhatsApp chat button free?',
      a: 'Yes. There is no signup, no limit and no monthly fee. The code runs on your own website and does not depend on our servers, so it keeps working however long you leave it.',
    },
    {
      q: 'Do I need a plugin?',
      a: 'No. The button is one block of code. On WordPress, a plugin that adds code to the footer is the easiest place to paste it, but you do not need a chat plugin.',
    },
    {
      q: 'Does it work with WhatsApp Business and the Business API?',
      a: 'Yes. The button opens a chat with any number registered on WhatsApp, including the WhatsApp Business app and a number connected to the WhatsApp Business API.',
    },
    {
      q: 'Can I show the button only on phones or only on computers?',
      a: 'Yes. Choose "Phones only" or "Computers only" under "Show it on". The generator also tells you when your setting hides the button on the preview you are looking at.',
    },
    {
      q: 'How do I put the button on the left side?',
      a: 'Choose "Left" under "Side of the screen". You can also use the distance sliders to move it away from the edge or from other items in the corner.',
    },
    {
      q: 'What does the welcome popup do?',
      a: 'It opens a small card above the button with a name, a short greeting and a button that starts the chat. You choose the words and how many seconds it waits. A visitor who closes it will not see it again on that visit.',
    },
    {
      q: 'Can I turn the popup off?',
      a: 'Yes. Untick "Greet visitors with a short message". The button then opens WhatsApp as soon as it is clicked.',
    },
    {
      q: 'Can I change the colour and the label?',
      a: 'Yes. Choose from the colours or type your own hex code, and add a short label such as "Chat with us", or leave it as an icon only. The icon colour is chosen automatically so it stays easy to see.',
    },
    {
      q: 'Will the button slow down my website?',
      a: 'It should not. It is a few kilobytes, it loads no images, fonts or scripts from other sites, and it is fixed to the corner so it cannot move your layout.',
    },
    {
      q: 'Does it use cookies or track my visitors?',
      a: 'It sets no cookies and does no tracking of its own. To avoid showing a closed popup again during a visit, it remembers the choice in the browser session only. Speak to whoever looks after your privacy policy about how it applies to your site.',
    },
    {
      q: 'Why is my chat button not showing?',
      a: 'The usual causes are a cached page, code pasted in the wrong place, a plugin that removes scripts, or another element covering it. Check the "Show it on" setting too. The guide above walks through each one.',
      points: [
        'Clear your site cache and reload in a private window',
        'Make sure the code is inside the page, before the closing body tag',
        'Check whether a security or speed plugin strips scripts',
        'Look for another widget or banner covering the corner',
        'Confirm the device setting is not hiding it',
      ],
    },
    {
      q: 'How can I tell how many people click the button?',
      a: 'Use Google Tag Manager to count clicks on links that contain wa.me, or give each page its own first message and see which one arrives in your chats. The guide above explains both.',
    },
    {
      q: 'Can I use different numbers for different pages?',
      a: 'Yes. Make a separate block for each number and paste the right one on each page template. Only use one block per page, because two on the same page would clash.',
    },
    {
      q: 'Is my number saved or sent anywhere?',
      a: 'No. The code is made in your browser. Your number goes only into the link inside the button, which is visible to anyone who views your page source, as with any contact link.',
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
    sourceLabel: 'WhatsApp chat button page',
  },
}
