// src/app/tools/whatsapp-roi-calculator/content.ts
//
// Everything editable on the WhatsApp ROI calculator page: copy, videos,
// reviews and the call-back form labels. page.tsx only arranges these.
//
// ── How to update ─────────────────────────────────────────────────────
//  • Reels / Shorts and videos: paste a YouTube, Vimeo or Instagram Reel
//    link into `src`. Until then a labelled stand-in is shown.
//  • Reviews: add real customer quotes to REVIEWS. While it is empty the
//    section invites feedback instead. Never put invented quotes here.
//  • Blog cards fill themselves from content/blog (posts tagged
//    "roi-calculator").
//  • The example businesses inside the tool (their prices and rates) live in
//    src/lib/tools/roi.ts. They are examples, not benchmarks. If you change
//    them, keep the figures in the worked example in this file in step.
//  • Message prices change. Re-check the WhatsApp pricing section against
//    Meta's current rate card before you publish.

import type { Review } from '@/components/tools/landing/sections'
import type { ToolPageContent } from '@/components/tools/landing/tool-page'

export const PAGE_PATH = '/tools/whatsapp-roi-calculator'

/**
 * Real customer reviews only. Example:
 *   { quote: '…', name: 'Priya S.', role: 'Boutique owner, Jaipur', rating: 5 }
 */
export const REVIEWS: Review[] = []

export const CONTENT: ToolPageContent = {
  path: PAGE_PATH,
  relatedTag: 'roi-calculator',
  formId: 'tool-whatsapp-roi-calculator',
  toolLabel: 'WhatsApp vs SMS vs email ROI calculator',

  seo: {
    // The site appends " — AiSend", so this stays short enough for a search result.
    title: 'WhatsApp vs SMS vs Email ROI Calculator',
    description:
      'Free calculator that compares WhatsApp, SMS and email campaigns. Enter your own prices and rates to see profit, return, cost per order and break-even.',
    ogTitle: 'Free WhatsApp vs SMS vs Email ROI Calculator',
    ogDescription:
      'Compare the profit and return of the same campaign on WhatsApp, SMS and email using your own numbers. See cost per order and the conversion rate you need to break even.',
  },
  schema: { name: 'WhatsApp vs SMS vs Email ROI Calculator', breadcrumb: 'WhatsApp ROI calculator' },

  hero: {
    badge: 'Free WhatsApp, SMS and email ROI calculator',
    title: 'Which channel really earns more: WhatsApp, SMS or email?',
    lead: 'Enter your list size, your prices and your results. See the profit, the return and the cost of each order for all three channels side by side. Free, with no signup, and nothing leaves your browser.',
    primaryLabel: 'Work out my ROI',
    primaryHref: '#generator',
    secondaryLabel: 'Chat with our team',
    whatsappMessage: 'Hi, I just used the WhatsApp ROI calculator and I would like help planning my campaigns.',
    proof: ['Free, no signup', 'Uses your own numbers', 'Shows break-even too'],
  },

  why: {
    heading: 'Why work out the return before you spend?',
    intro:
      'A campaign that feels busy is not always one that pays. Writing the numbers down, channel by channel, shows where your money works hardest and where it only looks good.',
    benefits: [
      {
        icon: 'trend',
        title: 'Compare like with like',
        text: 'The same list, the same offer and the same order value, run through three channels, so the difference you see is the channel itself.',
      },
      {
        icon: 'calc',
        title: 'See profit, not only revenue',
        text: 'Revenue is not what you keep. The calculator takes off your margin and your messaging cost, then shows what is left.',
      },
      {
        icon: 'shield',
        title: 'Honest about what it knows',
        text: 'Every result comes from the numbers you type. The starting figures are examples, and the page says so beside them.',
      },
    ],
    reels: [
      { title: 'Work out your WhatsApp campaign ROI', src: '' },
      { title: 'Find the numbers to put in', src: '' },
    ],
  },

  workflow: {
    heading: 'Compare your channels in three steps',
    intro: 'The results update as you type, so you can try a different price or response rate and see what changes.',
    steps: [
      {
        title: 'Describe one campaign',
        text: 'Enter how many people you message, how many campaigns you send a month, and your average order and margin.',
        sample: { kind: 'number', text: '5,000 people' },
      },
      {
        title: 'Enter each channel',
        text: 'For WhatsApp, SMS and email, add the price per message and the share who receive, respond and buy.',
        sample: { kind: 'message', text: '8% respond' },
      },
      {
        title: 'Read the result',
        text: 'See the net profit, the return on cost and the break-even conversion for each channel, and a plain-words verdict.',
        sample: { kind: 'link', text: 'Net profit' },
      },
    ],
  },

  useCases: {
    heading: 'Start from a business like yours',
    intro:
      'Pick one and we load a set of example numbers into the calculator above. They are only a place to start, so replace them with your own prices and results.',
    actionLabel: 'Load this example',
    cases: [
      {
        icon: 'store',
        title: 'Online store',
        text: 'Offers, restocks and abandoned carts sent to past buyers, with a mid-sized order and a steady list.',
        message: 'Online store example',
        data: { setup: 'store' },
      },
      {
        icon: 'megaphone',
        title: 'Restaurant or cafe',
        text: 'Frequent, small orders, with more campaigns a month and a lower order value.',
        message: 'Restaurant example',
        data: { setup: 'restaurant' },
      },
      {
        icon: 'users',
        title: 'Coaching or courses',
        text: 'High-value enrolments from a smaller list, where one extra sale changes the month.',
        message: 'Coaching example',
        data: { setup: 'coaching' },
      },
      {
        icon: 'clock',
        title: 'Clinic or salon',
        text: 'Reminders and offers that fill appointment slots, with a small order and a good margin.',
        message: 'Clinic example',
        data: { setup: 'clinic' },
      },
      {
        icon: 'profile',
        title: 'Agency or consultancy',
        text: 'A few high-value deals from a small list. The coaching example is a close match for this shape.',
        message: 'High-value example',
        data: { setup: 'coaching' },
      },
      {
        icon: 'pin',
        title: 'Gym, spa or studio',
        text: 'Memberships, class packs and renewals sent to people who have already visited you. The clinic example is a close match.',
        message: 'Appointment example',
        data: { setup: 'clinic' },
      },
    ],
  },

  banner: {
    heading: 'Want help finding your real numbers?',
    text: 'Tell us how you sell and what you send today. We will help you work out your costs and your results, and plan a campaign that makes sense.',
    label: 'Chat on WhatsApp',
    message: 'Hi, I would like help working out the return on my WhatsApp campaigns.',
  },

  guide: {
    heading: 'The complete guide to WhatsApp, SMS and email campaign ROI',
    intro:
      'What return on investment means for a message campaign, how the calculator reaches its answer, where to find your own numbers, how WhatsApp is priced, and how to improve the result.',
    sections: [
      {
        id: 'what-roi-means',
        heading: 'What ROI means for a message campaign',
        blocks: [
          {
            kind: 'p',
            text: 'Return on investment, or ROI, answers a simple question: for every rupee, dollar or pound I spend on this campaign, how much do I get back after the cost? A campaign with a 100% return has paid for itself and made the same amount again. A campaign with a return below zero has lost money.',
          },
          {
            kind: 'p',
            text: 'People use the word loosely, so it helps to separate the numbers that sit close together. This calculator shows four of them, and each says something different.',
          },
          {
            kind: 'table',
            caption: 'The measures in the calculator and what each one tells you.',
            head: ['Measure', 'What it is', 'Why it matters'],
            rows: [
              ['Net profit', 'Profit from the orders, after your margin and after the cost of messaging.', 'The money you actually keep. This is what pays your bills.'],
              ['Return on cost', 'Net profit divided by the messaging cost, as a percentage.', 'How hard each unit of money works. Useful for comparing channels.'],
              ['Revenue for each unit spent', 'Revenue divided by the messaging cost.', 'Often called ROAS. It ignores your margin, so read it with care.'],
              ['Cost of each order', 'Messaging cost divided by the number of orders.', 'The most you can pay to win a customer through this channel.'],
              ['Break-even conversion', 'The share of responders who must buy for the channel to cover its cost.', 'A target to aim for, and a warning if it looks out of reach.'],
            ],
          },
          {
            kind: 'note',
            title: 'Revenue is not profit',
            text: 'A campaign that brings in 1,00,000 of sales has not made 1,00,000. After the cost of the goods or service, and after the cost of the messages, much less remains. That is why the calculator asks for your margin.',
          },
        ],
      },
      {
        id: 'how-it-works',
        heading: 'How the calculator reaches its answer',
        blocks: [
          {
            kind: 'p',
            text: 'There is no hidden model here and no data about other businesses. Each channel follows the same short chain of steps, using only the numbers you enter. You can check every line with a pencil.',
          },
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Messages sent** = people in each campaign × campaigns a month.',
              '**Delivered** = messages sent × the share that are delivered.',
              '**Responses** = delivered × the share that click or reply.',
              '**Orders** = responses × the share of responders who buy.',
              '**Revenue** = orders × your average order value.',
              '**Profit before messaging cost** = revenue × your profit margin.',
              '**Messaging cost** = price per message × messages (sent or delivered, as you choose) + any fixed monthly cost.',
              '**Net profit** = profit before messaging cost − messaging cost.',
              '**Return on cost** = net profit ÷ messaging cost.',
            ],
          },
          {
            kind: 'p',
            text: 'The same people, the same offer and the same order value go through all three channels. Only the price, the delivery rate, the response rate and the buying rate differ. That is deliberate. If you changed the offer between channels, you could not tell whether the channel or the offer made the difference.',
          },
          { kind: 'h4', text: 'Why a response can be a click or a reply' },
          {
            kind: 'p',
            text: 'On email and SMS, a response is usually a click on a link. On WhatsApp it can be a tap on a button, a click on a link, or a reply. The calculator treats all of them as one step so that the three channels can sit in the same table. Use whichever action leads to a sale in your own business.',
          },
        ],
      },
      {
        id: 'worked-example',
        heading: 'A worked example, step by step',
        blocks: [
          {
            kind: 'p',
            text: 'Take the online store example that loads when you open the page. A shop messages 5,000 past buyers four times a month. The average order is ₹1,500 and 30% of that is profit. These figures are examples chosen to show the method, not results you should expect.',
          },
          {
            kind: 'table',
            caption: 'The same four campaigns a month, through three channels (example numbers).',
            head: ['Step', 'WhatsApp', 'SMS', 'Email'],
            rows: [
              ['Messages sent', '20,000', '20,000', '20,000'],
              ['Delivered', '19,000', '18,000', '19,400'],
              ['Responses', '1,520', '360', '388'],
              ['Orders', '76', '11', '8'],
              ['Revenue', '₹1,14,000', '₹16,200', '₹11,640'],
              ['Profit before messaging cost (30%)', '₹34,200', '₹4,860', '₹3,492'],
              ['Messaging cost', '₹16,340', '₹4,000', '₹1,000'],
              ['Net profit', '₹17,860', '₹860', '₹2,492'],
              ['Return on cost', '109%', '21%', '249%'],
            ],
          },
          {
            kind: 'p',
            text: 'Read the last two rows together. Email returns the most for every rupee spent, at 249%, because it costs so little to send. WhatsApp leaves the shop with by far the most profit, ₹17,860 against ₹2,492, because far more people respond and buy. Neither answer is wrong. They answer different questions, and the next section explains why that matters.',
          },
          {
            kind: 'note',
            title: 'These are example numbers',
            text: 'The prices, delivery rates, response rates and buying rates above were picked to show how the sums work. Your results will differ, sometimes a lot. Replace every figure with your own before you decide anything.',
          },
        ],
      },
      {
        id: 'roi-or-profit',
        heading: 'Highest return or highest profit?',
        blocks: [
          {
            kind: 'p',
            text: 'It is easy to chase the channel with the highest percentage and miss the one that earns the most money. A small, cheap channel can show a spectacular return because the cost underneath it is tiny. A larger channel can show a more modest percentage while delivering many times the profit.',
          },
          {
            kind: 'p',
            text: 'The calculator shows both and tells you plainly when they point in different directions. Which one to follow depends on what limits your business.',
          },
          {
            kind: 'table',
            caption: 'Which measure to trust, depending on your situation.',
            head: ['Your situation', 'Look first at', 'Why'],
            rows: [
              ['You have a small budget and any waste hurts', 'Return on cost', 'It shows where each unit of money does the most work.'],
              ['You have a fixed list and want the most from it', 'Net profit', 'Your list is the limit, not your budget, so extract the most profit from it.'],
              ['You are deciding whether to start a channel at all', 'Break-even conversion', 'It tells you how well the channel must perform to be worth the effort.'],
              ['You want to know what a customer costs to win', 'Cost of each order', 'Compare it with the profit an order brings.'],
            ],
          },
          {
            kind: 'p',
            text: 'In practice the best answer is often a mix. A cheap channel handles the broad, regular messages, and a more engaging one handles the offers where a quick reply turns into a sale. The calculator is a way to see where that line sits for your business.',
          },
        ],
      },
      {
        id: 'find-your-numbers',
        heading: 'Where to find your own numbers',
        blocks: [
          {
            kind: 'p',
            text: 'The calculator is only as good as what you put in. Most of the numbers are already in tools you use. If you do not have a number yet, make a careful estimate and say so to yourself, then replace it once you have real results.',
          },
          {
            kind: 'table',
            caption: 'Each input and where to find it.',
            head: ['Input', 'Where to find it', 'A tip'],
            rows: [
              ['People in each campaign', 'The size of the list or segment you message.', 'Count only people who agreed to hear from you.'],
              ['Campaigns a month', 'Your sending calendar.', 'Use an average over three months, not your busiest one.'],
              ['Average order value', 'Your sales report: revenue divided by orders.', 'Use orders from the people you message, not all customers.'],
              ['Profit on each order', 'Your accounts: price minus cost of goods and delivery.', 'Use margin, not markup, and leave out the cost of messaging.'],
              ['Cost per message', 'Your provider’s price list or invoice.', 'Divide the monthly bill by messages sent if prices vary.'],
              ['Delivered', 'The delivery report from your platform.', 'Email and SMS reports usually show this directly.'],
              ['Click or reply', 'Click-through or reply counts from your platform.', 'Count unique people, not repeat clicks.'],
              ['Responses that buy', 'Orders from the campaign divided by responses.', 'Use a coupon code or a tracked link for each channel.'],
              ['Fixed cost a month', 'Subscriptions or platform fees for that channel.', 'Include any monthly minimum or number rental.'],
            ],
          },
          {
            kind: 'p',
            text: 'If you have never run a campaign on one of the channels, leave its numbers as examples, and treat the answer as a question to test rather than a forecast. A small first campaign gives you real figures to replace them with.',
          },
        ],
      },
      {
        id: 'whatsapp-costs',
        heading: 'How WhatsApp campaigns are priced',
        blocks: [
          {
            kind: 'p',
            text: 'WhatsApp Business messages that you start, such as offers and reminders, are sent as approved templates. Meta, the company that runs WhatsApp, charges for these template messages, and it currently does so for each message delivered. The price depends on the category of the template and on the country of the person receiving it.',
          },
          {
            kind: 'table',
            caption: 'The template categories and how they are usually treated.',
            head: ['Category', 'What it is for', 'Cost'],
            rows: [
              ['Marketing', 'Offers, launches, promotions and reminders to buy.', 'Charged per delivered message, usually the highest rate.'],
              ['Utility', 'Order updates, bookings, payment and delivery messages the customer expects.', 'Charged per delivered message, usually lower. Some are free inside an open conversation window.'],
              ['Authentication', 'One-time passcodes and login codes.', 'Charged per delivered message.'],
              ['Service', 'Replies to a customer who messaged you, within the support window.', 'Free text replies within the window, subject to Meta’s current terms.'],
            ],
          },
          {
            kind: 'note',
            title: 'Check the current rates',
            text: 'Meta changes its price list and its rules from time to time, and the rate for one country differs from another. The WhatsApp price in the calculator is an example. Look up the current rate for your country on Meta’s official pricing page, and add anything your WhatsApp provider charges on top.',
          },
          { kind: 'h4', text: 'Charged on delivery, not on sending' },
          {
            kind: 'p',
            text: 'Because WhatsApp bills for messages that are delivered, a message to a number that cannot receive it does not cost you. That is why the calculator lets you choose whether each channel charges on messages sent or on messages delivered. SMS and email providers usually bill for what you send.',
          },
          { kind: 'h4', text: 'Fees from your provider' },
          {
            kind: 'p',
            text: 'Most businesses reach WhatsApp through a provider that connects them to the official WhatsApp Business API. Some providers charge a monthly fee, some add a small amount to each message, and some do both. Put a monthly fee in the fixed cost box, and add any per-message charge to the price.',
          },
        ],
      },
      {
        id: 'sms-and-email-costs',
        heading: 'What SMS and email really cost',
        blocks: [
          {
            kind: 'p',
            text: 'The price on an SMS provider’s home page is rarely the whole cost. Depending on your country there may be sender registration, message template approval, different prices for promotional and transactional routes, and a minimum top-up. Spread those over the messages you send, and use the real figure.',
          },
          {
            kind: 'p',
            text: 'Email is usually priced as a monthly plan, based on how many contacts you hold or how many emails you send. Divide the monthly price by the number of emails you actually send to get a cost per email, or put the plan in the fixed cost box and leave the per-email price low. Either approach gives the same answer, as long as you do not count the plan twice.',
          },
          {
            kind: 'list',
            items: [
              '**Count what you pay for in total.** Subscriptions, registration fees and top-ups all belong in the cost.',
              '**Do not forget time.** Designing an email or an image takes hours that a short text message does not. The calculator leaves this out, so remember it when the results are close.',
              '**Check the delivery rate.** Messages that land in spam folders or are blocked by an operator do not reach anyone, however cheap they were to send.',
            ],
          },
        ],
      },
      {
        id: 'break-even',
        heading: 'Break-even: the number to beat',
        blocks: [
          {
            kind: 'p',
            text: 'The last row of the results table is the break-even conversion. It is the share of people who respond that must go on to buy before the channel covers its own cost. Below that rate the channel loses money. Above it, every extra sale is profit.',
          },
          {
            kind: 'p',
            text: 'In the store example, WhatsApp needs about 2.4% of responders to buy to cover its costs. The example assumes 5%, so it clears the line comfortably. Email needs only about 0.6%, because it costs so little. SMS needs about 2.5% and assumes 3%, a thin margin that a small drop would erase.',
          },
          {
            kind: 'p',
            text: 'That is the real use of the number. Ask yourself honestly whether your own buying rate is likely to be above it. If it sits close to break-even, a small change in price or response can turn a profit into a loss, and the channel needs watching. If it is far above, you have room to test, to offer a discount, or to spend more on getting responses.',
          },
          {
            kind: 'note',
            title: 'A rate you have not measured is a guess',
            text: 'Break-even tells you the target, not whether you will hit it. Until you have run a campaign and counted the orders, treat your buying rate as an assumption and try a range in the calculator, such as half and double your guess.',
          },
        ],
      },
      {
        id: 'improve-the-return',
        heading: 'How to raise your return',
        blocks: [
          {
            kind: 'p',
            text: 'Once you can see the chain of steps, you can see where to push. Each step multiplies the next, so a small gain early in the chain carries all the way to the profit.',
          },
          {
            kind: 'list',
            items: [
              '**Message people who want to hear from you.** A smaller list of opted-in contacts who respond beats a larger list of people who ignore or block you. It is also what WhatsApp expects.',
              '**Segment your list.** An offer sent to the people who bought a similar thing before will do better than the same offer sent to everyone.',
              '**Write for the response you want.** A clear first line and one obvious button raise the share who respond. See how templates are approved in the [message template generator](/tools/whatsapp-template-generator).',
              '**Make replying easy.** Put a click-to-chat link or a [QR code](/tools/whatsapp-qr-code) wherever a customer might want to start a conversation.',
              '**Answer quickly.** A reply that arrives in minutes closes sales that a reply the next day loses. This lifts the share of responders who buy.',
              '**Send at a sensible time.** Avoid late nights, and test mornings against evenings with your own audience.',
              '**Raise the order value.** Bundles and minimum-order offers lift revenue for the same messaging cost.',
              '**Follow up once.** A short reminder to people who did not respond often adds orders at little extra cost.',
              '**Trim what does not earn.** If a channel sits below break-even after a fair test, send less on it or stop.',
            ],
          },
          {
            kind: 'p',
            text: 'Change one thing at a time. If you change the offer, the audience and the wording together, you will not know which one made the difference.',
          },
        ],
      },
      {
        id: 'channel-strengths',
        heading: 'What each channel is good at',
        blocks: [
          {
            kind: 'p',
            text: 'The three channels are not rivals so much as tools. Each suits certain messages, and the numbers in the calculator will show where each one earns its place in your mix.',
          },
          {
            kind: 'table',
            caption: 'Where each channel tends to fit, and what to watch.',
            head: ['Channel', 'Often a good fit for', 'Watch out for'],
            rows: [
              ['WhatsApp', 'Conversations: questions, bookings, order help, and offers where a quick reply closes the sale.', 'Per-message charges, template approval, and the need for opt-in.'],
              ['SMS', 'Short, urgent notices and reminders to people who may not use data or email much.', 'Registration rules, route costs and limited length.'],
              ['Email', 'Longer content, newsletters, receipts and low-cost broad reach.', 'Spam filtering, crowded inboxes and slower replies.'],
            ],
          },
          {
            kind: 'p',
            text: 'Which one wins in the calculator depends entirely on your prices and your results. A channel that is strong for one business can be weak for another, so test with your own audience instead of relying on a general rule.',
          },
        ],
      },
      {
        id: 'common-mistakes',
        heading: 'Common mistakes when working out ROI',
        blocks: [
          {
            kind: 'list',
            items: [
              '**Using revenue as profit.** Always take off your margin. A 1,00,000 sale at 30% margin is 30,000 of profit, before costs.',
              '**Giving the campaign credit for every sale.** Some of those buyers would have bought anyway. A small group you do not message, kept aside as a comparison, shows how many.',
              '**Leaving out fixed costs.** Subscriptions and number rentals count, even in a month when you send little.',
              '**Mixing up margin and markup.** A product bought for 70 and sold for 100 has a 30% margin, but a 43% markup.',
              '**Judging on one campaign.** A single send is noisy. Average a few before you decide.',
              '**Comparing different offers.** If WhatsApp got a discount and email did not, the channel is not the only difference.',
              '**Ignoring repeat value.** A first order from a new customer may lead to more. The calculator counts one order only, so it can understate channels that bring loyal customers.',
              '**Forgetting that numbers change.** Rates move with season, offer and list age. Re-run the calculator every few months.',
            ],
          },
        ],
      },
      {
        id: 'track-the-results',
        heading: 'Tracking results channel by channel',
        blocks: [
          {
            kind: 'p',
            text: 'To feed real numbers into the calculator you need to know which orders came from which channel. A few simple habits are enough.',
          },
          {
            kind: 'list',
            ordered: true,
            items: [
              '**Give each channel its own link.** Add a source tag to the web address in each message, so your analytics can separate WhatsApp, SMS and email visitors.',
              '**Use a code per channel.** A coupon such as WA10, SMS10 or MAIL10 shows in your orders. People who enter it have told you where they came from.',
              '**Count replies as orders when they lead to one.** For conversational sales, note which chats ended in a sale. A shared inbox with tags makes this easy.',
              '**Keep a holdout group.** Leave a small random share of your list out of a campaign. Compare their buying with the group you messaged.',
              '**Write it down each month.** A simple sheet with the inputs from this calculator and the real results shows how your numbers move.',
            ],
          },
          {
            kind: 'p',
            text: 'After one or two months you will have your own delivery, response and buying rates, and the calculator stops being an estimate and becomes a plan.',
          },
        ],
      },
      {
        id: 'limits-of-a-calculator',
        heading: 'What a calculator cannot tell you',
        blocks: [
          {
            kind: 'p',
            text: 'A tool like this makes your assumptions visible. It does not make them true. Be aware of what it leaves out.',
          },
          {
            kind: 'list',
            items: [
              '**It assumes every channel reaches the same people.** In real life the people who read email and the people who open WhatsApp overlap, but are not identical.',
              '**It does not model opt-outs or complaints.** Messaging people too often has a cost that does not appear in the table.',
              '**It does not include your time.** Setup, design and replying are real work.',
              '**It counts one month.** Customers who come back later add value that the first order does not show.',
              '**It cannot see your market.** Prices, rules and habits differ by country and industry.',
            ],
          },
          {
            kind: 'p',
            text: 'Use the result to decide what to test next, not to promise anyone a figure. When you have real campaign results, they will always be a better guide than any calculator.',
          },
        ],
      },
    ],
  },

  beyond: {
    heading: 'The calculator is the plan. AiSend helps you run it.',
    intro:
      'When the numbers say WhatsApp is worth it, you need a way to send well and reply fast. AiSend gives your team one place to do both.',
    features: [
      {
        icon: 'megaphone',
        title: 'Campaigns to opted-in contacts',
        text: 'Send approved template messages to the people who agreed to hear from you, and see how each one performs.',
      },
      {
        icon: 'inbox',
        title: 'A shared inbox for replies',
        text: 'Every response lands in one place, where your team can answer quickly and tag the chats that end in a sale.',
      },
      {
        icon: 'bot',
        title: 'Automatic first replies',
        text: 'Greet people the moment they respond, ask what they need, and hand over to a person when it matters.',
      },
    ],
    ctaLabel: 'Create your account',
    ctaHref: '/signup',
    moreLabel: 'Explore the WhatsApp Business API',
    moreHref: '/whatsapp-business-api',
  },

  videos: {
    heading: 'See it in action',
    intro: 'Two short walk-throughs: working out the return on a campaign, and finding the numbers to put in.',
    videos: [
      {
        title: 'Work out your WhatsApp campaign ROI',
        src: '',
        caption: 'Work out your campaign ROI',
        detail: 'From the first number to a verdict.',
      },
      {
        title: 'Find the numbers to put in the calculator',
        src: '',
        caption: 'Find your own numbers',
        detail: 'Where each input comes from.',
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
    heading: 'Guides on campaign return',
    intro: 'Practical reads on measuring campaigns, comparing channels and spending where it pays.',
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
        href: '/tools/whatsapp-chat-widget',
        name: 'Chat button for websites',
        text: 'Design a floating chat button with a welcome popup and copy the code.',
        tag: 'Website',
        icon: 'globe',
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
      q: 'How do I calculate the ROI of a WhatsApp campaign?',
      a: 'Work out the profit the campaign brings, subtract what it cost to send, and divide the result by the cost. The calculator does this for you: enter your list size, your order value and margin, the price per message, and the share who receive, respond and buy.',
      points: [
        'Net profit = profit from orders − messaging cost',
        'Return on cost = net profit ÷ messaging cost',
        'Use your margin, not your revenue',
      ],
    },
    {
      q: 'Is WhatsApp better than SMS or email?',
      a: 'It depends on your prices and your results, which is why the calculator uses your own numbers. WhatsApp costs more per message than email and often more than SMS, but it can bring more responses and orders. Run your figures and see which one leaves you the most profit and the best return.',
    },
    {
      q: 'Are the example numbers real benchmarks?',
      a: 'No. They are illustrative figures chosen to show how the sums work. Prices, delivery rates, response rates and buying rates differ by country, list, offer and season. Replace every figure with your own before relying on a result.',
    },
    {
      q: 'What is a good ROI for a message campaign?',
      a: 'Any return above zero means the campaign paid for itself. What counts as good depends on your margin, your alternatives and how much you could earn by spending the same money elsewhere. Compare it with your other ways of finding customers, using the same method.',
    },
    {
      q: 'What is the difference between ROI and ROAS?',
      a: 'ROI uses profit after costs, so it shows whether you made money. ROAS, shown here as revenue for each unit spent, uses revenue and ignores your margin. A campaign can have a healthy ROAS and still lose money if your margin is thin.',
    },
    {
      q: 'Why does a different channel win on return and on profit?',
      a: 'A cheap channel can show a high percentage on a small cost, while a more expensive channel earns far more in total. If your list is your limit, profit matters more. If your budget is your limit, return matters more. The calculator shows both.',
    },
    {
      q: 'How much does WhatsApp charge per message?',
      a: 'Meta prices template messages by category and by the country of the person receiving them, and it changes its price list from time to time. Check the current rates on Meta’s official pricing page, and add anything your WhatsApp provider charges on top. The figure in the calculator is only an example.',
    },
    {
      q: 'Are replies to customers free on WhatsApp?',
      a: 'Text replies sent within the customer service window after a customer messages you are generally not charged, but the rules are Meta’s and they can change. Check the current terms before you plan your costs.',
    },
    {
      q: 'What does “charged on delivered” mean?',
      a: 'WhatsApp bills for template messages that reach the person, not for ones that fail. SMS and email providers usually bill for what you send. You can choose either for each channel, and the cost is worked out accordingly.',
    },
    {
      q: 'What is break-even conversion?',
      a: 'It is the share of people who respond that must go on to buy for the channel to cover its cost. If your real buying rate is lower, the channel loses money. If it is higher, each extra sale is profit.',
    },
    {
      q: 'What should I put for “Responses that buy”?',
      a: 'Divide the orders from a campaign by the number of people who clicked or replied. If you have not run one, use a careful estimate, then test a range such as half and double your guess to see how much the answer moves.',
    },
    {
      q: 'Does the calculator count repeat purchases?',
      a: 'No. It counts one order per buyer in a month. If a channel brings customers who come back, the calculator will understate its value. Keep that in mind when two results are close.',
    },
    {
      q: 'Can I use a different currency?',
      a: 'Yes. Choose rupee, dollar, euro, pound or dirham at the top of the calculator. It changes how amounts are shown, but it does not convert them, so enter your prices in the currency you choose.',
    },
    {
      q: 'Does the calculator save or send my numbers?',
      a: 'No. Everything is worked out in your browser. Nothing you type is stored or sent, unless you choose to send your figures to our team on WhatsApp, which opens a message for you to review first.',
    },
    {
      q: 'Can I use it for a business that is not selling products?',
      a: 'Yes. Treat an “order” as whatever outcome is worth money to you, such as a booking, an enrolment or a paid appointment, and the “order value” as what that is worth. Margin is the share of it you keep.',
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
    sourceLabel: 'WhatsApp ROI calculator page',
  },
}
