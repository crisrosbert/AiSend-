// src/content/landing/whatsapp-business-api.ts
//
// Page: /whatsapp-business-api
// Copy is word-for-word from "6 Page: Whatsapp business API.docx".
//
// Pictures and videos are URLs: paste a link between the quotes.
//   images — any https:// PNG / JPG / WebP / SVG link
//   videos — a YouTube or Vimeo link, or a direct https:// .mp4 / .webm
// Leave '' and the spot shows a placeholder (big slots) or an icon (cards).
//
// Testimonial `company` still says "[Company Name]" — the doc's own
// placeholder. Replace it with each customer's real company before launch.

import type { LandingContent } from '@/lib/landing/types'

const content: LandingContent = {
  slug: 'whatsapp-business-api',
  seo: {
    title: 'Get the Official WhatsApp Business API. Free to Start.',
    description:
      'Run broadcasts, automate notifications, build AI-powered agents, and manage customer support on WhatsApp, all at scale with PerformanceMktg.',
  },
  breadcrumb: 'WhatsApp Business API',
  published: '2026-10-05',
  updated: '2026-10-05',
  sections: [
    {
      type: 'hero',
      title: 'Get the Official WhatsApp Business API. Free to Start.',
      lead: 'Run broadcasts, automate notifications, build AI-powered agents, and manage customer support on WhatsApp, all at scale with PerformanceMktg.',
      subtitle: 'WhatsApp API Without the Headache',
      body: 'Get official WhatsApp API access with no hidden fees, no messy setup, and everything you need to turn WhatsApp into a powerful business channel.',
      primaryCta: { label: 'Get FREE WhatsApp API', href: '/signup' },
      secondaryCta: { label: 'Book a Demo', href: '/contact' },
      image: '',
      imageAlt: 'PerformanceMktg WhatsApp Business API dashboard',
    },

    {
      type: 'logos',
      title: 'Loved by Founders & Marketers',
      body: 'PerformanceMktg helps businesses use the Official WhatsApp Business API to reach customers, automate conversations, and manage support at scale.',
      image: '',
      imageAlt: 'Logos of businesses using PerformanceMktg',
    },

    {
      type: 'stats',
      title: 'Why WhatsApp in 2026?',
      body: 'WhatsApp is not only a messaging application. It integrates news from the business, customer interactions, and even support into one application.',
      stats: [
        { value: '98%', label: 'Open Rate' },
        { value: '45–60%', label: 'Click Rate' },
        { value: '2.6B+', label: 'Active Users' },
        { value: '70%', label: 'Engagement Rate' },
      ],
      image: '',
      imageAlt: 'WhatsApp engagement statistics',
    },

    {
      type: 'comparison',
      id: 'comparison',
      title: 'WhatsApp Business or WhatsApp API? Know the Difference.',
      body: 'Both help you manage business chats on WhatsApp. But once your messages, customers, and team start growing, the difference becomes pretty clear.',
      points: [
        {
          label: 'WhatsApp Business App',
          text: 'WhatsApp Business App serves great for small businesses managing their own conversations.',
        },
        {
          label: 'WhatsApp Business API',
          text: 'WhatsApp Business API helps with automations, broadcasts, multi-user capability, integration, analytics, and so forth.',
        },
      ],
      tableTitle: 'So, Which One Fits Your Business?',
      columns: ['Feature', 'WhatsApp Business App', 'WhatsApp Business API'],
      rows: [
        ['Best suited for', 'Small businesses', 'Growing businesses'],
        [
          'Device access',
          'Up to 5 linked devices',
          'Multiple users and agents can access customer chats',
        ],
        ['Broadcast messaging', 'Limited daily broadcasts', 'High-volume broadcasts'],
        [
          'Automation',
          'No advanced automated messaging',
          'Automated messages and workflows',
        ],
        ['Chat features', 'Basic chat features', 'Chatbots and AI-powered automation'],
        [
          'Integrations',
          'No CRM integrations',
          'Can connect with CRMs and other business tools',
        ],
        ['Analytics', 'No campaign analytics', 'Can track campaigns and performance'],
        [
          'Main use',
          'Basic customer communication',
          'Sales, marketing, customer support, and large-scale messaging',
        ],
      ],
      footnote:
        'Still deciding? If WhatsApp is becoming a serious part of your sales, marketing, or customer support, the API gives you more room to scale.',
      image: '',
      imageAlt: 'WhatsApp Business App compared with WhatsApp Business API',
    },

    {
      type: 'cards',
      title: 'Why Businesses Are Switching to WhatsApp API',
      body: 'WhatsApp is already where your customers spend time. The API helps you turn those chats into marketing, sales, and support opportunities.',
      columns: 3,
      variant: 'icon',
      items: [
        {
          icon: 'users',
          title: 'Reach Customers Where They Already Are',
          body: 'Billions of people use WhatsApp every month. Meet your customers on a platform they already know and use, instead of making them switch channels.',
        },
        {
          icon: 'badge-check',
          title: 'Build a Brand Customers Recognise',
          body: 'Enhance your image on WhatsApp by establishing a formal brand identity through branded messaging and regular customer communication.',
        },
        {
          icon: 'megaphone',
          title: 'Turn Conversations Into Revenue',
          body: 'Build your customer journey right inside WhatsApp. Run campaigns, share product updates, follow up with leads, and guide customers towards a purchase.',
        },
        {
          icon: 'messages',
          title: 'Keep Customer Support Moving',
          body: 'Handle more conversations without making customers wait. Give your support team shared access, automate common replies, and manage chats from one place.',
        },
        {
          icon: 'bar-chart',
          title: 'Get More From Your Marketing Budget',
          body: "Perform automated marketing actions, communicate directly with your customers, and analyze your campaigns' performance. Spend less time on chat management, and spend more time on business development.",
        },
        {
          icon: 'shield-check',
          title: 'Official, Secure & Built for Business',
          body: 'WhatsApp Business API is the official solution by Meta for companies that wish to communicate with customers on a large scale. Create campaigns, automate conversations and integrate WhatsApp with the applications your company is using.',
        },
      ],
      image: '',
      imageAlt: 'Businesses switching to the WhatsApp Business API',
      imagePosition: 'below',
    },

    {
      type: 'video',
      id: 'setup',
      title: 'Ready to Put WhatsApp to Work?',
      body: 'Get started for FREE and see how easy the setup can be.',
      cta: 'Watch the 10-Minute Setup →',
      video: '',
      videoTitle: 'Watch the 10-Minute Setup',
    },

    {
      type: 'cards',
      id: 'features',
      title: 'How Can You Use WhatsApp Business API with PerformanceMktg?',
      body: 'Everything you need to market, sell, and support customers on WhatsApp, all in one place.',
      columns: 3,
      variant: 'icon',
      items: [
        {
          icon: 'send',
          title: 'Import Contacts & Start Broadcasting',
          body: 'Bring your contacts to one place and send approved WhatsApp messages in just a few clicks. No need to message customers one by one.',
        },
        {
          icon: 'credit-card',
          title: 'Collect Payments on WhatsApp',
          body: 'Make payments easier for your customers. Accept payments through WhatsApp Pay, UPI, net banking, and cards.',
        },
        {
          icon: 'megaphone',
          title: 'Run Click-to-WhatsApp Ads',
          body: 'Turn ad clicks into real conversations. Send people straight from your ad to WhatsApp, capture leads, and start chatting right away.',
        },
        {
          icon: 'bot',
          title: 'Build No-Code WhatsApp Chatbots',
          body: 'No coding skills? No problem. Build WhatsApp chatbots with a simple drag-and-drop setup and let them handle common customer questions automatically.',
        },
        {
          icon: 'bell',
          title: 'Send Automated Notifications',
          body: 'Update your customers without having to send out every single notification manually. Connect your CRM, payment processors, Shopify, Hubspot, and more for automated order confirmations and cart abandonment alerts.',
        },
        {
          icon: 'badge-check',
          title: 'Get Your Official WhatsApp Blue Tick',
          body: "Give your business profile a more trusted look with WhatsApp's official verification. It helps customers know they are talking to the right business.",
        },
        {
          icon: 'bar-chart',
          title: 'Track What Your Campaigns Are Doing',
          body: 'See how your WhatsApp campaigns are performing from one dashboard. Track delivery, reads, clicks, conversions, and other key numbers.',
        },
        {
          icon: 'plug',
          title: 'Connect With the Tools You Already Use',
          body: "WhatsApp doesn't have to work alone. Connect PerformanceMktg with tools like Shopify, Zoho, HubSpot, Google Sheets, and other business tools to keep your workflows connected.",
        },
        {
          icon: 'messages',
          title: 'Chat With Customers in Real Time',
          body: 'Let your team manage the customer conversation through a single WhatsApp number. Add more people to the team, switch conversations, and get involved when the customer needs a human touch.',
        },
      ],
    },

    {
      type: 'cards',
      id: 'use-cases',
      title: 'WhatsApp Business API Use Cases Across Industries',
      body: 'Different businesses, different needs. WhatsApp API can help with sales, marketing, updates, and customer support across industries.',
      columns: 4,
      variant: 'icon',
      cta: 'Explore Use Case',
      items: [
        {
          icon: 'shopping-cart',
          title: 'E-commerce',
          body: 'Bring customers back to their carts, share order updates, promote new products, and drive repeat purchases.',
          href: '/contact',
        },
        {
          icon: 'graduation-cap',
          title: 'Education & EdTech',
          body: 'From new enquiries to admission updates, keep students and parents informed without endless follow-ups.',
          href: '/contact',
        },
        {
          icon: 'landmark',
          title: 'Banking & Fintech',
          body: 'Make customer communication easier with payment alerts, service updates, KYC reminders, and quick support.',
          href: '/contact',
        },
        {
          icon: 'heart-pulse',
          title: 'Healthcare',
          body: 'Send appointment reminders, follow-ups, health updates, and other important messages directly to patients.',
          href: '/contact',
        },
        {
          icon: 'building',
          title: 'Real Estate',
          body: 'Share property details, follow up with leads, schedule site visits, and keep buyers in the loop.',
          href: '/contact',
        },
        {
          icon: 'car',
          title: 'Automobile',
          body: 'Help customers book test drives, get service reminders, explore vehicles, and stay connected after the sale.',
          href: '/contact',
        },
        {
          icon: 'plane',
          title: 'Travel & Tourism',
          body: 'Share packages, booking confirmations, travel details, and timely updates, all on a channel customers already use.',
          href: '/contact',
        },
        {
          icon: 'megaphone',
          title: 'Marketing Agencies',
          body: 'Manage WhatsApp campaigns for multiple clients, generate leads, automate follow-ups, and keep campaigns moving.',
          href: '/contact',
        },
      ],
    },

    {
      type: 'cards',
      title: 'Why Get WhatsApp Business API with PerformanceMktg?',
      body: "Getting started with WhatsApp API doesn't have to be complicated. PerformanceMktg keeps the setup simple and helps you get going without the usual hassle.",
      columns: 3,
      variant: 'check',
      items: [
        {
          title: 'Official WhatsApp API',
          body: 'Get access to the official WhatsApp Business API and build your customer communication on a trusted platform.',
        },
        {
          title: 'Free to Get Started',
          body: 'Start with WhatsApp API without worrying about hidden setup fees. Simple pricing, no surprises.',
        },
        {
          title: 'Support When You Need It',
          body: 'Got a question? Need help with setup? Our team is here to help you get things moving.',
        },
      ],
      image: '',
      imageAlt: 'Getting started with PerformanceMktg',
      imagePosition: 'above',
    },

    {
      type: 'testimonials',
      title: 'Hear It From Businesses Like Yours',
      body: 'Trusted by businesses using WhatsApp to reach, engage, and support their customers.',
      items: [
        {
          headline: '“WhatsApp has become much easier to manage.”',
          quote:
            '“PerformanceMktg made it easier for our team to manage WhatsApp conversations and stay connected with customers.”',
          name: 'Priyanka',
          role: 'Marketing Manager',
          company: '[Company Name]',
          avatar: '',
        },
        {
          headline: '“We can reach more customers, faster.”',
          quote:
            '“From campaigns to customer updates, PerformanceMktg helps us handle our WhatsApp communication without the usual back-and-forth.”',
          name: 'Piyush',
          role: 'Business Head',
          company: '[Company Name]',
          avatar: '',
        },
        {
          headline: '“Our team saves a lot of time.”',
          quote:
            '“The automation features have taken care of many repetitive tasks. Our team can now spend more time on customers and less time on manual work.”',
          name: 'Swastik',
          role: 'Founder',
          company: '[Company Name]',
          avatar: '',
        },
      ],
    },

    {
      type: 'cards',
      id: 'case-studies',
      title: 'See How Brands Use WhatsApp to Grow',
      body: 'Real businesses. Real use cases. See how companies are using WhatsApp Business API for sales, support, lead generation, and everyday customer communication.',
      columns: 3,
      variant: 'media',
      cta: 'Explore Case Study →',
      items: [
        {
          title: 'Delhi Transport Corporation',
          body: 'See how Delhi Transport Corporation used WhatsApp to make bus ticket booking easier for passengers.',
          image: '',
          video: '',
          href: '/contact',
        },
        {
          title: 'PhysicsWallah',
          body: 'See how the EdTech platform used WhatsApp to connect with more students and generate leads through WhatsApp campaigns.',
          image: '',
          video: '',
          href: '/contact',
        },
        {
          title: 'IndiaMART',
          body: 'See how IndiaMART used WhatsApp to simplify customer communication, reduce manual work, and improve conversions.',
          image: '',
          video: '',
          href: '/contact',
        },
      ],
    },

    {
      type: 'cta',
      title: 'Ready to Make WhatsApp Work Harder?',
      body: 'Get started with WhatsApp Business API for FREE. No credit card. No fuss.',
      cta: { label: 'Get Started for FREE →', href: '/signup' },
      image: '',
      imageAlt: 'Get started with the WhatsApp Business API',
    },

    {
      type: 'faq',
      id: 'faqs',
      title: 'FAQs',
      items: [
        {
          q: 'Is WhatsApp Business API free?',
          a: 'It can be. The API itself does not come with a fixed monthly subscription fee. However, WhatsApp messaging charges may apply based on your usage and message type.',
        },
        {
          q: 'How can I get WhatsApp Business API for free?',
          a: 'You can get started through PerformanceMktg without paying a setup fee. Sign up, complete the required business details, and follow the onboarding steps.',
        },
        {
          q: 'Can I use WhatsApp Business and WhatsApp Business API on the same number?',
          a: 'Normally, no. If a number is currently being used by the WhatsApp Business app, then it needs to be transferred to the API. Another number can be used if one wishes to use the app.',
        },
        {
          q: 'Can I use WhatsApp Business API for sending automated messages?',
          a: 'Yes. One can automate messages such as notifications, reminders, updates, follow-ups and more.',
        },
        {
          q: 'Can I use WhatsApp Business API on multiple devices?',
          a: 'Yes. Your team can access and manage conversations through a shared inbox, depending on the setup and tools you use.',
        },
        {
          q: 'WhatsApp Business or WhatsApp Business API: which one should I use?',
          a: 'It depends on your business. The WhatsApp Business app works well for smaller teams and basic chats. The API is built for businesses that need automation, multiple users, integrations, and higher-volume communication.',
        },
        {
          q: 'How long will it take to get WhatsApp Business API approval?',
          a: 'Depending on the company and its Setup, it could take some time. Once the setup is complete, onboarding can commence.',
        },
        {
          q: 'What are the prerequisites to get started with WhatsApp Business API?',
          a: 'There must be a business, a valid phone number, business information, and the necessary information about the business from Meta. Requirements may differ based on the setup that you choose.',
        },
        {
          q: 'Can I use an international number for WhatsApp Business API?',
          a: "Yes, international phone numbers can be supported, subject to WhatsApp and Meta's requirements for the country and number.",
        },
        {
          q: 'Can I go back to the normal WhatsApp Business app from API?',
          a: 'It depends on your business needs and migration process. Switching between app and API may involve number migration, so make sure you understand the options available to you before switching.',
        },
      ],
    },
  ],
}

export default content
