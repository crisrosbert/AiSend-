// Long-form copy for the free AI chatbot widget page. Plain text only: the page
// turns each block into a heading, paragraphs, an optional list and an optional
// table, so editing the wording never means touching layout code.

export interface Section {
  id: string
  h2: string
  paras: string[]
  list?: string[]
  table?: { head: string[]; rows: string[][] }
  after?: string[]
}

export const SECTIONS: Section[] = [
  {
    id: 'what-is-it',
    h2: 'What is an AI chatbot widget?',
    paras: [
      'An AI chatbot widget is a small chat bubble that sits in the corner of your website. When a visitor clicks it, they can type a question in their own words and get an answer straight away, without calling you, filling a form or waiting for an email. Unlike the older rule-based chat boxes that offered a fixed menu of buttons, an AI chatbot reads the question, finds the relevant information about your business and writes a reply in natural language.',
      'The chatbot you build on this page is trained on your own website. You do not upload documents, write scripts or design conversation trees. You enter your address, we read the public pages, and the chatbot learns what you sell, what it costs, where you are and how to reach you. It then answers from that material and nothing else, which keeps replies accurate and on-brand.',
      'For most small businesses the biggest gain is simple: the questions customers ask at 11 pm, on a holiday or in the middle of a busy afternoon no longer go unanswered. Every unanswered question is a visitor who may buy from someone else.',
    ],
  },
  {
    id: 'how-it-works',
    h2: 'How the chatbot learns from your website',
    paras: [
      'The process has three stages, and you can watch each one happen when you create your chatbot above.',
      'First, the tool scans your website. It starts at the address you enter and follows the links that lead to your most important pages, such as services, products, pricing, about and contact. It reads only public pages, skips anything private and stops after a small number of pages so the scan finishes in well under a minute.',
      'Second, it builds a knowledge base. The text of each page is split into short passages, and each passage remembers the page it came from. When a visitor asks something, the chatbot looks for the passages that best match the question and uses only those to write its answer. This approach is often called retrieval, and it is what stops the chatbot from inventing facts.',
      'Third, it shapes a personality. From the pages it read, the tool drafts a name, a role, a greeting and a few suggested questions. You can change every one of them, choose a friendly, professional or casual tone, and pick a colour that matches your brand. The preview on the right updates as you type, so you can test it before anything goes live.',
    ],
  },
  {
    id: 'benefits',
    h2: 'Why add an AI chatbot to your website',
    paras: [
      'A chatbot is most valuable when it is available exactly when a visitor is deciding. Here is what businesses typically gain.',
    ],
    list: [
      'Answers at any hour. The chatbot replies in seconds, day or night, including weekends and festivals.',
      'More enquiries from the same traffic. Visitors who would have left quietly can ask a question and stay.',
      'Lead capture built in. When someone shows interest, the chatbot can ask for a name and phone number and pass the lead to you.',
      'Less repetitive work. Opening hours, delivery areas, prices and policies are asked again and again. The chatbot handles them so your team can focus on real conversations.',
      'Consistent answers. Everyone gets the same accurate information taken from your own pages, not whatever the person on shift remembers.',
      'Insight into what customers want. Reading the questions visitors ask shows you what your website fails to explain.',
    ],
  },
  {
    id: 'use-cases',
    h2: 'Who uses an AI chatbot widget',
    paras: [
      'Any business with a website and customers who ask questions can use one. These are the situations where it tends to help most.',
    ],
    list: [
      'Online stores: product details, sizes, delivery time, returns and order help.',
      'Clinics and salons: services, prices, timings, location and appointment requests.',
      'Coaching and education: course details, fees, batch dates and admission questions.',
      'Real estate and builders: project information, price ranges, site visits and brochure requests.',
      'Restaurants and cafes: menu, opening hours, reservations and catering enquiries.',
      'Agencies and software companies: what you offer, how pricing works and how to book a demo.',
      'Local services such as repair, cleaning and travel: coverage areas, quotes and booking.',
    ],
    after: [
      'The common thread is a visitor with a specific question and a short window of attention. A fast, accurate answer keeps them on your page and moves them toward contacting you.',
    ],
  },
  {
    id: 'lead-capture',
    h2: 'How the chatbot captures leads',
    paras: [
      'A chatbot that only answers questions is helpful. A chatbot that also collects leads is profitable. When you run the chatbot from your AiSend account, it does both.',
      'During a conversation, the assistant recognises buying intent, for example a visitor asking for a quote, a booking or a callback. At that point it can ask for the visitor\'s name and phone number in a short in-chat form, one question at a time rather than a long page of fields. The details are saved as a lead against that conversation, so you can see exactly what the person asked before you reach out.',
      'Every conversation is stored, and you can read it, take it over and reply yourself whenever you like. For serious leads, the chatbot can also hand the visitor over to WhatsApp so the conversation continues on the channel your customers already use every day.',
      'Where you will find these leads in your dashboard is covered step by step in our guide on where to see the leads from your website chatbot.',
    ],
  },
  {
    id: 'compare',
    h2: 'AI chatbot vs live chat vs contact form',
    paras: [
      'Each way of letting visitors reach you has strengths. The table shows how they compare for a typical small business website.',
    ],
    table: {
      head: ['', 'AI chatbot', 'Live chat (human)', 'Contact form'],
      rows: [
        ['Availability', 'All day, every day', 'Only when staff are online', 'Always, but replies are slow'],
        ['Reply speed', 'Seconds', 'Seconds to minutes', 'Hours or days'],
        ['Cost to run', 'Low and fixed', 'Needs people on shift', 'Low'],
        ['Handles repeated questions', 'Very well', 'Uses staff time', 'Not applicable'],
        ['Complex or sensitive cases', 'Hands over to a person', 'Excellent', 'Slow'],
        ['Visitor effort', 'Type a question', 'Type a question', 'Fill several fields'],
      ],
    },
    after: [
      'Most businesses get the best result by combining them: the chatbot answers the everyday questions and captures leads, while your team steps in for the conversations that need a human.',
    ],
  },
  {
    id: 'install',
    h2: 'How to add the chatbot to your website',
    paras: [
      'Once you create a free account, installing the chatbot takes a few minutes and needs no developer. You paste one line of code into your site, the same way you would add an analytics tag.',
    ],
    list: [
      'Create your chatbot above and click Add to website for free.',
      'Create your free account. Your chatbot name, greeting and colour are waiting for you in the Website Widget page.',
      'Press the button to teach the chatbot from your website, review what it learned in the Agents page, then turn it on.',
      'Copy the embed code shown on the Website Widget page.',
      'Paste it just before the closing body tag on your website, or into the custom code or footer scripts area of your website builder.',
      'Open your website in a private window and check that the chat bubble appears and answers a question.',
    ],
    after: [
      'On WordPress you can use any plugin that adds a footer script. On Shopify, add the line to your theme file or a custom code section. Website builders such as Wix, Webflow and Squarespace have a custom code setting in their site or page options. If your site is plain HTML, paste it into the page template. The snippet works the same way everywhere because it is a single script tag.',
    ],
  },
  {
    id: 'best-practices',
    h2: 'Ten tips for a chatbot that actually helps',
    paras: [
      'A chatbot is only as good as the information behind it and the care you put into its first impression. These habits make the biggest difference.',
    ],
    list: [
      'Keep your key pages clear. Services, pricing, delivery, returns and contact pages should state facts in plain sentences. If your site is vague, the chatbot will be too.',
      'Put contact details in text, not only in images, so the chatbot can read them.',
      'Write a greeting that tells visitors what the chatbot can do, for example help with prices, bookings or order questions.',
      'Offer three or four suggested questions that match what customers really ask.',
      'Match the tone to your brand. A law firm and a toy shop should not sound alike.',
      'Test it with the ten questions customers ask most often and fix any weak answers by improving the page that should have covered them.',
      'Review conversations weekly. Real questions show you what to add to your website.',
      'Make it easy to reach a person. Always give a phone number or WhatsApp option for urgent or complicated cases.',
      'Keep information fresh. When prices or timings change, update the page and refresh the chatbot.',
      'Place it where it helps, not everywhere. A bubble on your pricing and product pages usually outperforms one on a thank-you page.',
    ],
  },
  {
    id: 'mistakes',
    h2: 'Common mistakes to avoid',
    paras: [
      'Most disappointing chatbots fail for the same few reasons.',
    ],
    list: [
      'Training it on a thin website. If your pages say little, the chatbot has little to say.',
      'Letting it guess. Answers should come from your content. A good chatbot says it is not sure and points to your contact details instead of inventing a price.',
      'Hiding the human option. Visitors with a complaint or a big purchase want a person.',
      'Setting it live without testing. Always chat with it yourself first.',
      'Asking for too much too early. Request a phone number only when the visitor has shown interest.',
      'Ignoring the conversations. The transcripts are a free research tool.',
    ],
  },
  {
    id: 'example',
    h2: 'What a conversation looks like',
    paras: [
      'Here is a typical exchange on a candle shop website. The visitor asks about shipping, the chatbot answers from the delivery page, and the visitor then shows buying interest.',
      'Visitor: Do you deliver to Pune, and how long does it take? The chatbot replies that the shop ships across India and orders usually arrive within five working days, quoting the delivery page. The visitor asks whether gift wrapping is available. The chatbot confirms it from the product page and offers to take their name and phone number so the team can help with a bulk order.',
      'Notice what the chatbot did not do. It did not guess a delivery date for Pune, it did not promise a discount that is not on the site and it did not pretend to be a person. When the page does not contain an answer, a good chatbot says so and points the visitor to your phone number or WhatsApp.',
    ],
  },
  {
    id: 'features',
    h2: 'What you can customise',
    paras: [
      'The profile panel gives you control over how the chatbot presents your business, and every change shows in the live preview straight away.',
    ],
    list: [
      'Name and role, so the chatbot introduces itself the way you want.',
      'Tone of voice: friendly, professional or casual.',
      'Greeting message shown when the chat opens.',
      'Suggested questions that visitors can tap instead of typing.',
      'Brand colour for the header and message bubbles.',
      'Logo, picked up from your website when one is available.',
    ],
    after: [
      'After you sign up you can go further, with a welcome bubble that nudges visitors after a few seconds, a WhatsApp number for hand-over, working hours and a lead form that appears at the right moment.',
    ],
  },
  {
    id: 'measure',
    h2: 'How to measure whether it is working',
    paras: [
      'Treat the chatbot like any other channel and look at a few simple numbers each week. How many conversations did it handle? How many turned into leads with a name and phone number? How many questions could it not answer?',
      'The last number is the most useful. Each unanswered question points to something missing from your website. Add a short paragraph to the right page, refresh the chatbot and the gap closes for every future visitor. Over a month or two this loop improves both your chatbot and your website copy, which also helps your pages perform better in search.',
      'For revenue, compare the leads from the chatbot with the sales they produce. Even a modest number of extra enquiries each week adds up quickly when the chatbot costs you nothing to run after the initial setup.',
    ],
  },
  {
    id: 'whatsapp',
    h2: 'Connect your website chatbot to WhatsApp',
    paras: [
      'Visitors who are ready to buy often prefer to continue on WhatsApp, where they can share photos, confirm details and get updates on the same app they use all day. Because the chatbot runs inside AiSend, it can pass a warm lead to your WhatsApp number along with the conversation so far.',
      'That means one system covers the whole journey: a visitor asks a question on your website, becomes a lead, receives a follow-up on WhatsApp and can later be included in your campaigns and reminders. You no longer copy details between tools or lose leads between a website form and a phone.',
    ],
  },
  {
    id: 'trouble',
    h2: 'If the scan cannot read your website',
    paras: [
      'Most public websites scan without any trouble. A few do not. Sites that block automated visitors, require a login or show all of their text only after running JavaScript can look empty to the scanner. If that happens, try your main address without a page path, check that the site loads without signing in and try again after a few minutes in case the site was slow.',
      'If it still fails, you can create your account and describe your business by hand, or ask our team to set the chatbot up with you. Either way you end up with the same chatbot and the same lead capture.',
    ],
  },
  {
    id: 'privacy',
    h2: 'Privacy and safety',
    paras: [
      'This free tool reads only public pages of the website you enter and does not ask you to log in to anything. It will not scan private or internal addresses. The preview is temporary and expires after a couple of hours, and usage limits stop automated abuse.',
      'When you run the chatbot from your account, visitor messages are stored in your own workspace so you can review them. You decide who on your team can see them. If you collect phone numbers, tell visitors why you are asking and only use the details to answer their enquiry, in line with the privacy laws that apply to your business.',
    ],
  },
  {
    id: 'free',
    h2: 'Is it really free?',
    paras: [
      'Yes. Building and testing the chatbot costs nothing and needs no card. Creating a free AiSend account lets you embed it on your website and see the conversations and leads it collects. As your usage grows you can move to a paid plan for higher volumes, more team members and WhatsApp automation, but you can start and learn what works without paying anything.',
      'Because the same account also runs WhatsApp campaigns, a shared team inbox and automated follow-ups, your website chatbot becomes the first step in a complete system for turning visitors into customers.',
    ],
  },
]

export const EXTRA_FAQ = [
  { q: 'Do I need to know how to code?', a: 'No. You paste one line of code into your website, and most website builders have a place for it. If you get stuck, our team can help you install it.' },
  { q: 'Can it answer in Hindi or other languages?', a: 'It replies in the language the visitor writes in, using the information from your website. Answers are best when your pages are written clearly.' },
  { q: 'Will it slow down my website?', a: 'The chat bubble loads after your page and is small, so it should not affect how quickly your content appears.' },
  { q: 'Can I stop it from answering certain things?', a: 'It answers only from your website content. You can edit its role and tone, review its replies and switch it off at any time.' },
  { q: 'Where do I see the leads and chats?', a: 'In your AiSend dashboard, under Leads and the Website chats tab, and in the Live Chat inbox where you can reply yourself.' },
  { q: 'Can I use it without a website?', a: 'The free tool needs a public website address to learn from. If you do not have one, you can describe your business manually when you create an agent in your account.' },
]
