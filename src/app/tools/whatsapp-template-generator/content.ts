// src/app/tools/whatsapp-template-generator/content.ts
//
// Everything editable on the WhatsApp template generator page: copy, videos,
// reviews and the call-back form labels. page.tsx only arranges these.
//
// ── How to update ─────────────────────────────────────────────────────
//  • Reels / Shorts and videos: paste a YouTube, Vimeo or Instagram Reel
//    link into `src`. Until then a labelled stand-in is shown.
//  • Reviews: add real customer quotes to REVIEWS. While it is empty the
//    section invites feedback instead. Never put invented quotes here.
//  • Blog cards fill themselves from content/blog (posts tagged
//    "whatsapp-templates").
//  • The example templates behind the "Use this template" cards live in
//    src/lib/tools/template-presets.ts and are tested to pass the checker.
//  • Meta changes its template rules from time to time. Re-read the limits in
//    the guide below against Meta's current documentation now and then.

import type { Review } from '@/components/tools/landing/sections'
import type { ToolPageContent } from '@/components/tools/landing/tool-page'

export const PAGE_PATH = '/tools/whatsapp-template-generator'

/**
 * Real customer reviews only. Example:
 *   { quote: '…', name: 'Priya S.', role: 'Boutique owner, Jaipur', rating: 5 }
 */
export const REVIEWS: Review[] = []

export const CONTENT: ToolPageContent = {
  path: PAGE_PATH,
  relatedTag: 'whatsapp-templates',
  formId: 'tool-whatsapp-template-generator',
  toolLabel: 'WhatsApp message template generator and approval checker',

  seo: {
    // The site appends " — AiSend", so this stays short enough for a search result.
    title: 'WhatsApp Template Generator and Approval Checker',
    description:
      'Write a WhatsApp Business message template, preview it on a phone and check it against Meta’s rules before you submit. Free, no signup. Copy the API request.',
    ogTitle: 'Free WhatsApp Message Template Generator and Approval Checker',
    ogDescription:
      'Write marketing, utility or authentication templates, see how they look in a chat and catch the common reasons for rejection before Meta does.',
  },
  schema: { name: 'WhatsApp Message Template Generator', breadcrumb: 'WhatsApp template generator' },

  hero: {
    badge: 'Free template generator and approval checker',
    title: 'Write a WhatsApp template that gets approved the first time',
    lead: 'Write your message, see it on a phone as your customer will, and let the checker flag what Meta usually rejects. When it is clean, copy the text or the API request. Free, no signup, and nothing leaves your browser.',
    primaryLabel: 'Write my template',
    primaryHref: '#generator',
    secondaryLabel: 'Chat with our team',
    whatsappMessage: 'Hi, I just used the WhatsApp template generator and I would like help with my message templates.',
    proof: ['Checks Meta’s published limits', 'Live phone preview', 'Copy the API request body'],
  },

  why: {
    heading: 'Why check a template before you submit it?',
    intro:
      'Every message you send first, outside a customer chat, has to be an approved template. A rejection costs you a day and a rewrite, and a wrong category costs you money on every message.',
    benefits: [
      {
        icon: 'shield',
        title: 'Catch rejections early',
        text: 'The checker looks for the mistakes that cause most refusals: broken variables, missing examples, selling inside a utility message and risky wording.',
      },
      {
        icon: 'chat',
        title: 'See what your customer sees',
        text: 'The preview shows the header, body, footer and buttons in a chat, with your own example values filled in.',
      },
      {
        icon: 'code',
        title: 'Copy it, do not retype it',
        text: 'Get the text for the template manager, or the exact request body for the WhatsApp Cloud API, with examples included.',
      },
    ],
    reels: [
      { title: 'Why WhatsApp templates get rejected', src: '' },
      { title: 'Marketing or utility? How to choose', src: '' },
    ],
  },

  workflow: {
    heading: 'From idea to submit-ready in three steps',
    intro: 'Start from an example or a blank page. The checker updates as you type, so you always know where you stand.',
    steps: [
      {
        title: 'Choose a category and write',
        text: 'Pick marketing, utility or authentication, then write the message and add variables where the details change.',
        sample: { kind: 'message', text: 'Hi {{1}}, your order {{2}} has shipped.' },
      },
      {
        title: 'Fix what the checker finds',
        text: 'Work through the problems first, then the warnings. Each one says what is wrong and how to fix it.',
        sample: { kind: 'message', text: '2 problems to fix' },
      },
      {
        title: 'Copy and submit',
        text: 'Paste the text into the template manager, or send the request body to the Cloud API.',
        sample: { kind: 'link', text: 'order_shipped.json' },
      },
    ],
  },

  useCases: {
    heading: 'Start from a template that already passes',
    intro:
      'Pick a situation and we load a complete example into the generator above, with examples for every variable. Change the words to suit your business.',
    actionLabel: 'Use this template',
    cases: [
      {
        icon: 'inbox',
        title: 'Order shipped',
        text: 'A utility update with a tracking button, the most common template an online store sends.',
        message: 'Hi {{1}}, your order {{2}} has been shipped and should reach you by {{3}}.',
        data: { preset: 'order-update' },
      },
      {
        icon: 'clock',
        title: 'Appointment reminder',
        text: 'Cuts no-shows for clinics, salons and classes, with quick replies to confirm or reschedule.',
        message: 'Hi {{1}}, this is a reminder about your appointment with {{2}}.',
        data: { preset: 'appointment-reminder' },
      },
      {
        icon: 'file',
        title: 'Payment received',
        text: 'Confirms a payment and links to the receipt, so customers stop asking if it went through.',
        message: 'Hi {{1}}, we have received your payment of {{2}}.',
        data: { preset: 'payment-receipt' },
      },
      {
        icon: 'megaphone',
        title: 'Festive sale',
        text: 'A marketing message with a shop button and an opt-out, written to stay on the right side of Meta.',
        message: 'Hi {{1}}, our festive sale runs until {{2}}.',
        data: { preset: 'festive-offer' },
      },
      {
        icon: 'store',
        title: 'Cart reminder',
        text: 'Brings back people who left something behind, with a link to their own cart.',
        message: 'Hi {{1}}, you left your {{2}} in your cart.',
        data: { preset: 'abandoned-cart' },
      },
      {
        icon: 'shield',
        title: 'One-time passcode',
        text: 'The fixed authentication format, with a copy-code button and an expiry time.',
        message: 'Your verification code',
        data: { preset: 'login-code' },
      },
    ],
  },

  banner: {
    heading: 'Template rejected and you cannot see why?',
    text: 'Send us the template and the rejection reason. We will tell you what to change and help you get it approved.',
    label: 'Chat on WhatsApp',
    message: 'Hi, my WhatsApp template was rejected and I would like help fixing it.',
  },

  guide: {
    heading: 'The complete guide to WhatsApp message templates',
    intro:
      'What templates are, how to pick the right category, how to write variables and buttons, why templates are rejected and what to do after you submit.',
    sections: [
      {
        id: 'what-is-a-whatsapp-template',
        heading: 'What a WhatsApp message template is',
        blocks: [
          {
            kind: 'p',
            text: 'A message template is a message that has been written in advance and approved by Meta. On the WhatsApp Business Platform, you can send free-form messages only while a customer is talking to you. That window closes 24 hours after their last message. To message someone outside that window, or to start the conversation yourself, you must use an approved template.',
          },
          {
            kind: 'p',
            text: 'Templates exist to protect customers from spam. Meta reviews each one before you can use it, and it keeps watching how people react to the messages you send. A template people block or report hurts your quality rating, and a low rating limits what you can do.',
          },
          {
            kind: 'p',
            text: 'A template has a fixed part and, if you want, blanks called variables. Your wording stays the same for everyone. The variables are filled in for each customer when you send, so one template can say "Hi Priya, your order A1043 has shipped" to one person and "Hi Rahul, your order B2290 has shipped" to another.',
          },
          {
            kind: 'note',
            title: 'What this tool covers',
            text: 'The generator handles templates with a text header, a body, a footer and buttons, including authentication templates. Templates with an image, video or document header, a carousel, a product catalogue or a flow are made in the template manager or through the API.',
          },
        ],
      },
      {
        id: 'choose-the-right-category',
        heading: 'Choose the right category',
        blocks: [
          {
            kind: 'p',
            text: 'Every template belongs to one of three categories. The category decides how Meta reviews the template and how much each message costs, so choosing correctly matters more than almost anything else on this page.',
          },
          {
            kind: 'table',
            caption: 'The three template categories.',
            head: ['Category', 'Use it for', 'Examples', 'Be careful with'],
            rows: [
              ['Marketing', 'Anything that promotes, informs about an offer or invites someone back.', 'Sale announcements, new arrivals, cart reminders, event invitations.', 'It needs a customer who has agreed to hear from you, and it costs the most per message.'],
              ['Utility', 'A follow-up on something the customer asked for or did.', 'Order and delivery updates, booking confirmations, payment receipts, account alerts.', 'Any sales language moves it into marketing, even if you chose utility.'],
              ['Authentication', 'One-time passcodes to log in or confirm an action.', 'Login codes, verification codes, password reset codes.', 'Wording is fixed by Meta. No links, media or extra text.'],
            ],
          },
          { kind: 'h4', text: 'The test for utility' },
          {
            kind: 'p',
            text: 'Ask two questions. First, did the customer do something that this message follows up on, such as placing an order, booking a slot or making a payment? Second, would the message still make sense if you removed every offer and every reason to buy? If the answer to either is no, it is marketing.',
          },
          { kind: 'h4', text: 'Why the category affects your bill' },
          {
            kind: 'p',
            text: 'WhatsApp charges for template messages by category and by the country of the person who receives them. Marketing messages cost the most. Utility messages cost less, and they are free when you send them inside the 24-hour window that opens when a customer writes to you. Meta publishes the current rates on its pricing page, so check there before you plan a campaign.',
          },
          {
            kind: 'p',
            text: 'Meta may also approve a template under a different category than the one you chose. If your utility template reads like a promotion, expect it to be treated and billed as marketing. The checker warns you when a utility template contains offer language, so you can fix the wording or choose marketing honestly.',
          },
        ],
      },
      {
        id: 'parts-of-a-template',
        heading: 'The parts of a template and their limits',
        blocks: [
          {
            kind: 'p',
            text: 'A template is built from up to four parts. Only the body is required.',
          },
          {
            kind: 'table',
            caption: 'Template parts and the limits the checker uses.',
            head: ['Part', 'Required?', 'Limit', 'Notes'],
            rows: [
              ['Name', 'Yes', 'Lowercase letters, numbers and underscores', 'For example order_shipped_v1. You use it when you send the template.'],
              ['Header', 'No', '60 characters, one variable', 'Plain text. Do not use bold or italics here.'],
              ['Body', 'Yes', '1,024 characters', 'Supports bold, italics, strikethrough, emoji and line breaks.'],
              ['Footer', 'No', '60 characters', 'Fixed text only. No variables.'],
              ['Buttons', 'No', '10 in total', 'Quick replies, links, a call button and a copy-code button.'],
            ],
          },
          {
            kind: 'p',
            text: 'Keep the body short enough to read on a phone without scrolling. Customers read the first two lines in the notification and decide from those whether to open it. Put the most important fact, such as what happened or what you need from them, in that first part.',
          },
          { kind: 'h4', text: 'Use the footer for small print' },
          {
            kind: 'p',
            text: 'The footer appears below the body in grey, smaller text. It suits a short line such as "Reply if you need help" or "Offer valid on selected items". Because it cannot hold variables, put anything specific to the customer in the body.',
          },
          { kind: 'h4', text: 'Name your templates so you can find them' },
          {
            kind: 'p',
            text: 'Names cannot be changed later, and you will end up with dozens. Use a pattern that tells you what it is and which version, such as order_shipped_v1, cart_reminder_hindi_v2 or diwali_sale_2026. The generator turns a title into a valid name with one click.',
          },
        ],
      },
      {
        id: 'variables',
        heading: 'How to write variables',
        blocks: [
          {
            kind: 'p',
            text: 'A variable is written as a number in double curly braces: `{{1}}`, `{{2}}`, `{{3}}`. They must start at 1 and go up one at a time. Meta does not accept names such as `{{customer_name}}` in the standard format.',
          },
          {
            kind: 'table',
            caption: 'Variable mistakes the checker catches.',
            head: ['What you wrote', 'What is wrong', 'Write this instead'],
            rows: [
              ['{{1}}, your order has shipped.', 'The message starts with a variable.', 'Hi {{1}}, your order has shipped.'],
              ['Your order has shipped to {{1}}', 'The message ends with a variable.', 'Your order has shipped to {{1}}. Thank you.'],
              ['Order {{1}}{{2}}', 'Two variables are touching.', 'Order {{1}} for {{2}}.'],
              ['Hi {{name}}, your order is ready.', 'Variables must be numbers.', 'Hi {{1}}, your order is ready.'],
              ['Hi {{1}}, {{3}} is ready.', 'The numbers skip {{2}}.', 'Hi {{1}}, {{2}} is ready.'],
              ['{{1}} {{2}} {{3}}', 'Far too many variables for the amount of text.', 'Write a full sentence around each variable.'],
            ],
          },
          { kind: 'h4', text: 'Give every variable a real example' },
          {
            kind: 'p',
            text: 'When you submit a template, Meta asks for an example value for every variable. Reviewers use them to understand the message. Examples such as "test" or "abc" make the template look unfinished and are a common reason for rejection. Use realistic ones: a first name, an order number that looks like yours, a date.',
          },
          {
            kind: 'p',
            text: 'The checker will not let a template pass while an example is missing, and the live preview fills the examples into the message so you can read it as a customer would.',
          },
          { kind: 'h4', text: 'What you can send as a value' },
          {
            kind: 'p',
            text: 'When you send the template later, the values you pass in cannot contain line breaks, tabs or more than four spaces in a row. If your data has them, clean it first. Otherwise the send fails even though the template itself was approved.',
          },
        ],
      },
      {
        id: 'buttons',
        heading: 'Buttons that help people act',
        blocks: [
          {
            kind: 'p',
            text: 'Buttons turn a message into something a customer can act on with one tap. A template can have up to ten in total, in four kinds.',
          },
          {
            kind: 'table',
            caption: 'Button kinds and how many each template can hold.',
            head: ['Button', 'What it does', 'How many', 'Text limit'],
            rows: [
              ['Quick reply', 'Sends a fixed reply into the chat, such as "Confirm" or "Stop promotions".', 'Several, within the 10 total', '25 characters'],
              ['Link', 'Opens a web address. It can end with one variable for a personal page.', '2', '25 characters'],
              ['Call', 'Dials a phone number you set.', '1', '25 characters'],
              ['Copy code', 'Copies a coupon or reference code to the clipboard.', '1', 'Fixed label'],
            ],
          },
          {
            kind: 'list',
            items: [
              '**Links need a full address.** Start with https:// and use your own domain. Link shorteners such as bit.ly are a frequent cause of rejection.',
              '**A link can end with a variable.** For example https://example.com/track/{{1}}, so each customer lands on their own order page. The variable must be the last thing in the address.',
              '**Phone numbers use the international format.** Write + and the country code, then digits only, such as +919876543210.',
              '**Quick replies are grouped together.** WhatsApp shows them as one group, and link and call buttons as another. The generator orders them that way.',
            ],
          },
          { kind: 'h4', text: 'Give marketing messages an easy way out' },
          {
            kind: 'p',
            text: 'A quick reply such as "Stop promotions" lets people leave without blocking you. A block counts against your quality rating, so an opt-out button protects the number you depend on. It is also fair to the customer, which is the best reason to add it.',
          },
        ],
      },
      {
        id: 'why-templates-are-rejected',
        heading: 'Why templates get rejected',
        blocks: [
          {
            kind: 'p',
            text: 'Meta reviews templates with a mix of automated checks and people, and it gives a short reason when it says no. These are the causes we see most often, in rough order of how common they are.',
          },
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Broken variables.** Wrong format, gaps in the numbering, a variable at the start or end of the message, or too many variables for the amount of text.',
              '**Missing or careless examples.** Empty examples, or placeholder values such as "abc" and "123".',
              '**The wrong category.** A promotion submitted as utility, or a template that does not mention anything the customer did.',
              '**Sensitive requests.** Asking for a full card number, bank details, an ID number or a password in a message.',
              '**Threats and pressure.** Warnings of legal action or arrest in payment reminders, or language meant to shame the customer.',
              '**Shortened or mismatched links.** Link shorteners, links that do not work, or links to a site that has nothing to do with your business.',
              '**Spam signals.** Messages in capitals, rows of exclamation marks, or text that reads like a chain message.',
              '**Prohibited content.** Goods and services that WhatsApp’s commerce and business policies do not allow.',
              '**Vague or generic text.** A one-line message that does not say what it is about.',
              '**A duplicate.** A template with the same content and language as one that already exists.',
            ],
          },
          {
            kind: 'p',
            text: 'The generator checks for the first seven directly. For the rest, read the policies on Meta’s site and keep your wording specific and polite. If a template is rejected, read the reason, fix that one thing and submit it under a new version name, such as order_shipped_v2.',
          },
        ],
      },
      {
        id: 'after-you-submit',
        heading: 'After you submit',
        blocks: [
          {
            kind: 'p',
            text: 'A new template starts as pending. Meta says a review can take up to 24 hours, though many are decided in minutes. You can use a template only once its status is approved.',
          },
          {
            kind: 'table',
            caption: 'Template statuses you will see.',
            head: ['Status', 'What it means', 'What to do'],
            rows: [
              ['Pending', 'Meta is still reviewing it.', 'Wait. Do not submit a copy; it may be rejected as a duplicate.'],
              ['Approved', 'You can send it.', 'Send a test to your own number first.'],
              ['Rejected', 'Meta refused it and gave a reason.', 'Fix the reason and submit a new version.'],
              ['Paused', 'People reacted badly, so Meta stopped it for a while.', 'Read the feedback, improve the wording and the audience, then wait.'],
              ['Disabled', 'Repeated low quality. It cannot be used again.', 'Write a new template with a new name.'],
            ],
          },
          { kind: 'h4', text: 'Quality and pausing' },
          {
            kind: 'p',
            text: 'After a template goes live, Meta watches how customers respond. Many blocks and reports lower its quality rating. A template that stays at low quality is paused for a short time and, if the problem continues, disabled. The best protection is to message only people who asked to hear from you, and to send them something they care about.',
          },
          { kind: 'h4', text: 'Editing, versions and languages' },
          {
            kind: 'list',
            items: [
              '**Editing.** An approved template can be edited a limited number of times, and its category cannot be changed. For a bigger change, create a new version.',
              '**Languages.** A template is approved separately for each language. Add a Hindi version next to your English one rather than mixing both in one message.',
              '**Versions.** Keep the old template running until the new one is approved, then switch.',
            ],
          },
        ],
      },
      {
        id: 'writing-templates-that-work',
        heading: 'Writing templates people want to read',
        blocks: [
          {
            kind: 'p',
            text: 'Approval is the minimum. A template that is approved but ignored does not help you, and one that annoys people gets paused. A few habits make the difference.',
          },
          {
            kind: 'table',
            caption: 'Weak and stronger versions of the same message.',
            head: ['Weak', 'Stronger', 'Why it works better'],
            rows: [
              ['Dear customer, your order has been dispatched.', 'Hi Priya, your order #A1043 has shipped and should reach you by Friday.', 'Uses the name and tells them when to expect it.'],
              ['SALE!!! BUY NOW!!! 50% OFF!!!', 'Hi Neha, our festive sale runs until 16 November. Tap below to browse.', 'Calm, specific and honest about the dates.'],
              ['Pay your dues immediately or face action.', 'Hi Anita, a payment of Rs. 2,499 for invoice INV-0187 is due on 20 November. You can pay with the button below.', 'Polite, factual and gives a clear next step.'],
              ['Your appointment.', 'Hi Rahul, a reminder about your appointment with Dr. Mehta on Monday at 5:30 PM. Please confirm or choose a new time.', 'Says who, when and what you need from them.'],
            ],
          },
          {
            kind: 'list',
            items: [
              '**Say who you are.** The customer sees your business name, but a clear first line removes any doubt.',
              '**Lead with the point.** What happened, or what you need, in the first sentence.',
              '**One message, one job.** A shipping update should not also announce a sale.',
              '**Use plain words.** Short sentences read well on a phone and are easier to translate.',
              '**Use emoji sparingly.** One or two can help. A row of them looks like spam.',
              '**Always include a way to reply or act.** A button, or a clear line telling them to reply.',
            ],
          },
        ],
      },
      {
        id: 'submit-with-the-api',
        heading: 'Submitting through the WhatsApp Cloud API',
        blocks: [
          {
            kind: 'p',
            text: 'You can create a template in the template manager inside your Meta business account, or send it to the WhatsApp Cloud API. The generator gives you both: the "Copy as text" button for the manager, and the request body for the API.',
          },
          {
            kind: 'p',
            text: 'The request body is the content of a `POST` to your WhatsApp Business Account’s `message_templates` endpoint. It carries the template name, category and language, and a list of components for the header, body, footer and buttons. Examples for every variable are included, which is the part people most often forget when they write it by hand.',
          },
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Get your WhatsApp Business Account ID** from the Meta business settings.',
              '**Create an access token** with permission to manage WhatsApp templates.',
              '**Send the request body** to the `message_templates` endpoint of your account.',
              '**Check the status.** The response tells you the template was received. Approval follows after review.',
            ],
          },
          {
            kind: 'note',
            title: 'Using AiSend?',
            text: 'If your number is connected to AiSend, you do not need to handle tokens or endpoints yourself. Write the template in the same place you run your campaigns and see its status in your dashboard.',
          },
        ],
      },
    ],
  },

  beyond: {
    heading: 'An approved template is where the work starts',
    intro:
      'Once Meta says yes, you still need to send it to the right people, handle the replies and learn what works. AiSend is built for that part.',
    features: [
      {
        icon: 'megaphone',
        title: 'Send to opted-in contacts',
        text: 'Choose a template, pick a segment of people who agreed to hear from you and send it, with the right values for each person.',
      },
      {
        icon: 'inbox',
        title: 'Handle every reply',
        text: 'When someone taps a button or writes back, the chat lands in a shared inbox where your team can answer.',
      },
      {
        icon: 'bot',
        title: 'Automate the follow-up',
        text: 'Answer common replies automatically and pass the chat to a person when it needs one.',
      },
    ],
    ctaLabel: 'Create your account',
    ctaHref: '/signup',
    moreLabel: 'Explore the WhatsApp Business API',
    moreHref: '/whatsapp-business-api',
  },

  videos: {
    heading: 'See it in action',
    intro: 'Two short walk-throughs: writing a template that passes, and fixing one that was rejected.',
    videos: [
      {
        title: 'Write a WhatsApp template that gets approved',
        src: '',
        caption: 'Write a template that gets approved',
        detail: 'From a blank page to a clean check.',
      },
      {
        title: 'Fix a rejected WhatsApp template',
        src: '',
        caption: 'Fix a rejected template',
        detail: 'Read the reason, change one thing, resubmit.',
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
    heading: 'Guides on WhatsApp templates',
    intro: 'Practical reads on writing templates, choosing categories and keeping your quality rating healthy.',
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
        href: '/tools/whatsapp-chat-widget',
        name: 'WhatsApp chat button generator',
        text: 'Design a floating chat button for your website and copy the code.',
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
    ],
  },

  faqHeading: 'Frequently asked questions',
  faqs: [
    {
      q: 'What is a WhatsApp message template?',
      a: 'It is a message you write in advance and Meta approves, which you can send to a customer outside the 24-hour chat window. It has a fixed text and, if you want, variables such as {{1}} that are filled in for each person when you send it.',
    },
    {
      q: 'How do I get a WhatsApp template approved?',
      a: 'Choose the honest category, write a clear and specific message, format your variables correctly and give each one a realistic example. Avoid shortened links, capitals and pressure. Then check it with this tool before you submit.',
      points: [
        'Pick the category that matches what the message really does',
        'Start and end the message with words, not variables',
        'Give every variable a realistic example',
        'Use your own full https:// links',
        'Add a way to opt out of marketing messages',
      ],
    },
    {
      q: 'How long does Meta take to approve a template?',
      a: 'Meta says a review can take up to 24 hours. Many templates are decided within minutes or a few hours. If you have waited longer than a day, check the status in your template manager before you submit it again.',
    },
    {
      q: 'Why was my WhatsApp template rejected?',
      a: 'The most common reasons are badly written variables, missing examples, a promotion submitted as utility, requests for sensitive details, threatening wording and shortened links. Meta gives a short reason when it rejects a template. Fix that one thing and submit a new version with a new name.',
    },
    {
      q: 'What is the difference between marketing, utility and authentication templates?',
      a: 'Marketing promotes or invites someone back. Utility follows up on something the customer did, such as an order or a booking. Authentication delivers one-time passcodes. The category changes how the template is reviewed and what each message costs.',
    },
    {
      q: 'How many characters can a template have?',
      a: 'The body can be up to 1,024 characters. A text header and a footer can each be up to 60 characters, and button text up to 25. The generator shows a live counter beside each field and turns it red when you go over.',
    },
    {
      q: 'How do variables work in a template?',
      a: 'A variable is a number in double curly braces, such as {{1}}, and stands for something that changes for each customer. Number them in order from 1, never start or end the message with one, and give each an example. The values are supplied when you send the template.',
    },
    {
      q: 'Can I use emoji, bold and italics in a template?',
      a: 'Yes, in the body. Use asterisks for bold, underscores for italics and tildes for strikethrough, and use emoji sparingly. Do not use formatting in a header. Authentication templates have fixed wording and cannot be formatted.',
    },
    {
      q: 'How many buttons can a template have?',
      a: 'Up to 10 in total. That can include several quick replies, up to 2 link buttons, 1 call button and 1 copy-code button. Quick replies are grouped together, and link and call buttons are grouped together.',
    },
    {
      q: 'Can I change a template after it is approved?',
      a: 'You can edit an approved template a limited number of times, but you cannot change its category. For a larger change, write a new version with a new name, wait for approval and then switch your campaigns to it.',
    },
    {
      q: 'Can I send a template to anyone?',
      a: 'No. You should message only people who have agreed to hear from you on WhatsApp. For marketing messages that agreement is essential. Customers who are blocked or reported often can lower your quality rating and limit what you can send.',
    },
    {
      q: 'Does a clean check guarantee approval?',
      a: 'No. The checker covers Meta’s published limits and the most common causes of rejection, so it removes the avoidable mistakes. Meta reviews every template itself and makes the final decision, and its rules change from time to time.',
    },
    {
      q: 'What is the API request body for?',
      a: 'It is the exact JSON you send to the WhatsApp Cloud API to create the template, including the examples Meta needs for each variable. If you use the template manager instead, use the "Copy as text" button.',
    },
    {
      q: 'Can I make templates with images, videos or carousels here?',
      a: 'Not yet. The generator covers text templates with buttons, and authentication templates. For an image, video or document header, a carousel, a catalogue or a flow, use the template manager or the API.',
    },
    {
      q: 'Which language should I choose?',
      a: 'Choose the language the message is written in. Each language is approved separately, so if you message customers in English and Hindi, create one template for each rather than mixing them in one message.',
    },
    {
      q: 'Is my template saved or sent anywhere?',
      a: 'No. The check and the preview run in your browser. What you type here is not stored and not sent to our servers by this tool.',
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
    sourceLabel: 'WhatsApp template generator page',
  },
}
