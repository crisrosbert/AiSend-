---
title: WhatsApp Business API Pricing in India: Rates & Calculator
description: Meta's WhatsApp API rates in India per message: marketing ₹0.8631, utility ₹0.115. See free windows, GST, worked examples and a formula to estimate your bill.
date: 2026-10-11
hideDate: true
author: Team AiSend
category: Pricing
tags: [whatsapp-api-pricing, business-api, pricing, india]
cover: https://app.performancemktg.net/covers/whatsapp-business-api-pricing-india.webp
coverAlt: WhatsApp Business API pricing in India, rate card illustration
---

# Quick answer: what does the WhatsApp Business API cost in India?

WhatsApp Business API pricing in India is **per delivered message**, not per conversation and not per user. Meta sets the message rate by category, and your provider adds its own platform fee and GST on top. The rates Meta currently lists for India are:

| Message category | Rate per delivered message (INR) | What it is used for |
|---|---|---|
| Marketing | ₹0.8631 | Offers, launches, abandoned cart nudges, re-engagement |
| Utility | ₹0.1150 | Order, delivery, payment and account updates |
| Authentication | ₹0.1150 | One-time passwords and login codes |
| Service | ₹0.1150 | Replies to customer-started chats, after the free monthly allowance |

Three things decide your real monthly bill: how many messages you send in each category, how many of those fall inside a free window, and what your provider charges for the platform itself. The rest of this guide explains each part in plain English, shows the formula, and walks through worked examples so you can estimate your own cost before you spend a rupee.

> **Verify before you budget.** Meta revises rate cards and free-window rules from time to time. The figures here were last checked against Meta's published India rate card in October. Always confirm the current numbers on Meta's pricing page or with your provider before you commit to a budget.

If you only want a fast estimate, jump to the [formula section](#the-formula-to-estimate-your-monthly-bill) or use our [WhatsApp ROI calculator](/tools/whatsapp-roi-calculator) to see whether a campaign pays back.

# How WhatsApp API pricing works in India

Older WhatsApp pricing was built around 24-hour "conversations". Meta has moved to a simpler idea: **you pay for each message that is delivered**, and the price depends on the category of the message. That change made costs easier to predict, because one template sent to one customer equals one chargeable message, regardless of how many replies follow.

There are four moving parts in every bill:

1. **Meta's message charge.** Rate multiplied by delivered messages, per category.
2. **Free allowances and free windows.** Some messages cost nothing, depending on the category, timing and how the chat started.
3. **Your provider's platform fee.** A monthly or yearly subscription for the dashboard, inbox, campaigns, chatbot and support.
4. **Taxes and add-ons.** GST on the platform fee and Meta charges where applicable, plus any paid extras such as extra agent seats or a dedicated number.

Meta bills the message charges, and your provider usually passes them through at cost. A good provider shows the message cost as a separate line so you can see exactly what is Meta's money and what is the provider's fee. We believe that separation is the single most important thing to look for, and we explain why in the section on hidden markups below.

## Why "per delivered message" matters

Because the charge applies only on delivery, you are not billed for messages that fail. A number that has blocked you, a user who is not on WhatsApp, or a message that Meta refuses to deliver does not add to your marketing spend. That makes list hygiene directly connected to cost: every dead number you remove is one less failed attempt, and a cleaner list also protects your quality rating.

# The four WhatsApp message categories

Every template you send is placed in exactly one category. The category controls the price, so choosing correctly matters. Meta reviews the content and can re-categorise a template if the wording does not match what you picked.

## Marketing messages

Marketing is anything that promotes a product or service or tries to drive a sale or an action. Typical examples are a festival discount, a new collection, a cart reminder with an offer, a webinar invite, or a win-back message to inactive customers. Marketing is the most expensive category at ₹0.8631 per delivered message in India, and it is the only category where standard volume discounts are not shown on the rate card.

Marketing templates need the customer's opt-in. Sending them to people who never agreed raises block and report rates, which lowers your quality rating and can limit how many messages you may send.

## Utility messages

Utility messages are triggered by something the customer did or by an existing transaction. Order confirmation, shipping update, delivery OTP, payment receipt, appointment reminder, booking change and account alert all belong here. Utility is priced at ₹0.1150 per delivered message, which is roughly one seventh of the marketing price. Utility also qualifies for volume tiers, so heavy senders may see the effective rate drop as monthly volume grows.

The catch is that a utility template must be useful on its own. If you add a promotion, a discount code or a "buy more" line to an order update, Meta can treat the whole message as marketing. Read our guide on [marketing or utility: which category fits your template](/blog/marketing-or-utility-whatsapp-template) before you submit.

## Authentication messages

Authentication templates deliver one-time passcodes for login, sign-up and verification. They are priced the same as utility at ₹0.1150 per delivered message in India and they are volume-tier eligible. The format is strict: a short code, an optional expiry note and a copy-code button, with no promotional text allowed.

## Service messages

Service messages are free-form replies to a customer who messaged you first. They are not templates. While the customer's 24-hour service window is open, you can reply with any text, image, document or interactive message. Under the rules that apply from 1 October, service messages become chargeable per delivered message after a monthly free allowance is used up, at ₹0.1150 each. Before that change, replies inside the window were free without a monthly cap.

# What changed from 1 October for service and utility messages

The change that confuses most businesses is how free windows work now. Here is the plain comparison.

| Situation | Before 1 October | From 1 October |
|---|---|---|
| Free-form reply inside the 24-hour window | Free | Chargeable after the monthly free allowance, ₹0.1150 each |
| Utility template sent inside an open window | Free | Chargeable at the utility rate |
| Utility template sent outside a window | Chargeable | Chargeable |
| Marketing template | Chargeable | Chargeable |
| Authentication template | Chargeable | Chargeable |
| Chats started from a click-to-WhatsApp ad or Facebook page button | Free for 72 hours | Free entry point; Meta has announced an extension to 7 days |

Two ideas are worth remembering. First, the **24-hour window still controls whether you may send a free-form message**. If the customer wrote to you within the last 24 hours you can reply in any format; after that you can only send an approved template. Second, **being allowed to send is not the same as being free to send**. The window decides eligibility; the price still follows the category.

The free entry point is the exception that rewards ad spend. When a customer taps a click-to-WhatsApp ad or a call-to-action button on your Facebook page and starts a chat, the replies you send during the entry window are not billed. Meta has announced that this window will extend from 72 hours to 7 days. Treat the effective date as something to confirm with Meta or your provider, because the rollout timing can differ by region.

# The formula to estimate your monthly bill

You can estimate any month with one line of arithmetic:

**Total bill = (marketing × ₹0.8631) + (utility × ₹0.1150) + (authentication × ₹0.1150) + (billable service × ₹0.1150) + platform fee + GST**

Where *billable service* means the delivered service messages left after you subtract your free monthly allowance, and *utility* means only the utility messages that are charged under the current rules.

A simple way to apply it:

1. Count the delivered messages you expect in each category.
2. Subtract anything that falls in a free window or free allowance.
3. Multiply each remaining count by its rate.
4. Add the provider's platform fee.
5. Add 18% GST on the platform fee, and check whether GST applies to the message charges on your invoice.

The GST step is where many first-time buyers get surprised, so keep reading.

## GST and other taxes

Indian businesses should expect **18% GST** on the platform fee charged by an Indian provider. Whether GST is shown separately on Meta's message charges depends on how your account is billed and who invoices you, so ask for a sample invoice. If you can claim input tax credit, GST is mostly a cash-flow item rather than a true cost. If you cannot, add 18% to every line that carries it when you compare quotes.

# Worked examples with real arithmetic

Numbers make this concrete. All three examples use the India rates above and assume the monthly free service allowance is already counted in the "billable" figure. Platform fee and GST are excluded so you can see Meta's share clearly.

## Example 1: a support-first small business

A clinic receives customer questions and sends appointment updates. In a month it handles 5,000 service messages and sends 1,000 utility templates. It sends no marketing.

Assume 1,000 service messages are covered by the free allowance, which leaves 4,000 billable.

- Billable service: 4,000 × ₹0.1150 = ₹460
- Utility: 1,000 × ₹0.1150 = ₹115
- **Meta charges: ₹575**

Even with 6,000 total conversations worth of messages, the Meta cost is under six hundred rupees. For service businesses the provider fee is usually the bigger line.

## Example 2: a D2C brand running campaigns

An online store sends 25,000 marketing messages (two campaigns a month), 20,000 utility messages (order and shipping updates) and handles 8,000 service messages, of which 1,000 are free.

- Marketing: 25,000 × ₹0.8631 = ₹21,577.50
- Utility: 20,000 × ₹0.1150 = ₹2,300
- Billable service: 7,000 × ₹0.1150 = ₹805
- **Meta charges: ₹24,682.50**

Marketing is about 87% of the bill. That is the lever. A 10% improvement in targeting, meaning fewer irrelevant sends, saves more than the entire utility and service cost combined.

## Example 3: an app sending login codes

A fintech app delivers 100,000 authentication OTPs a month.

- Authentication: 100,000 × ₹0.1150 = **₹11,500**

If volume tiers apply at higher usage, the effective per-message price can fall, so ask your provider whether tier discounts are passed on.

# Marketing vs utility: the cost gap in one table

The category you choose changes the cost of the same business event dramatically.

| Per 10,000 delivered messages | Marketing rate | Utility rate | Difference |
|---|---|---|---|
| Cost | ₹8,631 | ₹1,150 | ₹7,481 |

That ₹7,481 gap is why Meta reviews category choices carefully. If your order confirmation is truly an order confirmation, keep it clean and it stays in the cheaper category. If you add a coupon for the next purchase, expect it to be billed as marketing. The practical rule is to send the transactional message on its own and a separate, opted-in marketing message later. Our post on [why WhatsApp templates get rejected](/blog/why-whatsapp-templates-get-rejected) covers the wording mistakes that trigger re-categorisation, and the free [template generator and approval checker](/tools/whatsapp-template-generator) flags them before you submit.

# Platform fees: what your provider charges on top

Meta's charge is the same for everyone. The provider's fee is not, and it is where plans differ. Providers in India typically charge one of three ways.

## Flat monthly subscription

You pay a fixed fee for a tier that includes a number of agent seats, campaign tools, chatbot flows and support. Message charges are billed separately at Meta's rate. This is the most predictable model, and it is the easiest to budget because the only variable is how many messages you send.

## Subscription plus per-message markup

Some providers add a small amount to every message on top of Meta's rate. A ₹0.15 markup on 25,000 marketing messages adds ₹3,750 a month. That is not automatically bad if the platform justifies it, but it must be disclosed. Always ask for the all-in price per marketing message and per utility message, then compare it to the Meta rate in the table above.

## Free or low-cost entry plans

Entry plans are useful for testing, but check what they exclude. Common limits are one agent seat, no campaign scheduling, no API access, no chatbot builder, or caps on contacts. A plan that looks cheap can become expensive once you need a second agent.

At AiSend we separate the two clearly: Meta's per-message charge is shown as its own line, and the platform fee covers the inbox, campaigns, automation and support. If you want a quote built around your message mix, [talk to our team](/contact).

# Hidden costs to check before you sign

Pricing pages rarely show the whole picture. Before you commit, confirm each of these.

- **Message markup.** Is the per-message price Meta's rate or Meta's rate plus a fee?
- **Wallet minimums and expiry.** Some providers require a prepaid wallet with a minimum top-up, and unused balance may expire.
- **Agent seats.** How much does each additional team member cost per month?
- **Phone number charges.** Does the provider charge to register or migrate a number?
- **Green tick and verification support.** Is help included or billed as a service?
- **Chatbot and automation limits.** Are flows capped by number of nodes or monthly runs?
- **Contact limits.** Does the plan cap stored contacts, and what is the overage?
- **Template submission support.** Is review help included?
- **Tax treatment.** Is GST included in the displayed price or added at checkout?
- **Exit terms.** Can you export contacts, chats and templates if you leave?

A provider that answers all ten clearly, in writing, is usually one you can trust with your customer relationships.

# Business-verification tiers and sending limits

Cost is only half of the story; reach is the other half. Meta limits how many unique customers you can message in a rolling 24-hour period, and the limit rises as you prove quality.

- A new, unverified number starts with a low daily limit, often 250 unique customers.
- After business verification and a good quality rating, limits step up to 1,000, then 10,000, then 100,000 and eventually unlimited.
- A poor quality rating, caused by high block or report rates, can pause growth or reduce your limit.

This links to price in a practical way. Sending to a large, unfiltered list is not only expensive, it risks a lower rating and a slower route to higher limits. Targeted lists make each rupee of Meta spend carry more value.

# How to reduce your WhatsApp API costs

Spending less is mostly about sending smarter, not sending less. These tactics work in real accounts.

## 1. Use the right category

Move genuinely transactional messages out of marketing and keep them clean. Put the promotion in a separate, opted-in marketing template. Never hide a coupon inside a utility template.

## 2. Segment before every campaign

At ₹0.8631 per message, sending to a cold, irrelevant list is the most expensive mistake you can make. Segment by purchase history, last activity, location, language and interest. A campaign to 4,000 interested customers often earns more than the same offer to 20,000 uninterested ones, at a fifth of the cost.

## 3. Turn on click-to-WhatsApp entry points

Ads and page buttons that open a chat give you a free window. Pair them with a strong first reply and a catalogue or booking flow so the free window turns into revenue.

## 4. Answer inside the service window

Because free-form replies are only allowed while the window is open, a fast response keeps you out of paid template territory. Staff the inbox, set quick replies and use an away message so customers still feel heard outside working hours.

## 5. Automate the repetitive 70%

Order status, store hours, pricing questions and return policy make up most inbound chats. A simple bot that answers them instantly reduces agent hours and avoids the paid follow-up templates that late replies would require.

## 6. Clean your list monthly

Remove numbers that have never delivered, opted out or reported you. You pay only for delivered messages, but a dirty list drags down quality rating, which limits scale.

## 7. Test small, then scale

Send a new template to a small slice, check the read and reply rate, then roll it out. A template with a weak response is expensive at scale and cheap to discover early.

## 8. Choose a provider on all-in cost

A lower subscription with a message markup can cost more than a higher flat plan once you send 20,000 messages a month. Compare the total, not the headline.

## 9. Watch your template quality

Low-quality templates can be paused, which interrupts campaigns and wastes preparation time. Our [template approval checker](/tools/whatsapp-template-generator) catches the most common rejection reasons for free.

## 10. Measure return, not just cost

The right question is not "how cheap is a message" but "what does one sale cost me". Plug your numbers into the [ROI calculator](/tools/whatsapp-roi-calculator) and compare WhatsApp with SMS and email on cost per order.

# WhatsApp API vs SMS vs email: cost per message in India

Per-message price alone does not tell you which channel wins, because open and response rates differ enormously.

| Channel | Typical cost per message | Typical strength |
|---|---|---|
| WhatsApp marketing | ₹0.8631 | High read rate, rich media, two-way chat |
| WhatsApp utility | ₹0.1150 | Reliable transactional updates |
| SMS | Often ₹0.15 to ₹0.25 | Reach without internet, limited format |
| Email | Fractions of a rupee | Cheap at volume, lower attention |

WhatsApp marketing is dearer per send than SMS or email, yet brands keep using it because customers actually read and answer it. If a campaign converts at even a modest rate, the higher cost per message is offset by a lower cost per order. We break the comparison down with real formulas in [WhatsApp vs SMS vs email marketing](/blog/whatsapp-vs-sms-vs-email-marketing).

# Pricing by business type: what to expect

Different businesses sit in very different places on the rate card. Here is how the mix usually looks.

## Local services and clinics

Mostly service and utility. Customers message first, you confirm bookings and send reminders. Meta cost stays low, often a few hundred to a couple of thousand rupees a month. Prioritise a shared inbox and appointment reminders.

## Retail and D2C

Heavy on marketing plus order utility. Marketing dominates the bill, so segmentation and offer timing matter most. Use cart recovery sparingly and only to opted-in contacts.

## Education and coaching

A mix of marketing for admissions and utility for class schedules. Seasonal spikes around admissions mean a flat platform plan with pay-as-you-go messages works well.

## Fintech, SaaS and apps

High authentication and utility volumes. Volume tiers can help, so ask the provider how tier discounts are applied to your account.

## Real estate and automobile

Lead-driven. Use click-to-WhatsApp ads for free entry windows, then nurture inside the service window. Marketing spend is lower but each conversation is worth more.

# How to choose a WhatsApp API provider in India

Use this checklist when you shortlist providers.

1. **Official partner status.** Confirm that the provider is an approved Meta partner so your number and data stay compliant.
2. **Transparent pricing.** Message charges must appear as their own line.
3. **Inbox quality.** Look for assignment rules, labels, notes and fast search.
4. **Campaign tools.** Segmentation, scheduling, retries and delivery reports.
5. **Automation.** A visual flow builder with keyword triggers, working hours and handoff to a human.
6. **Integrations.** Shopify, WooCommerce, payment gateways, CRMs and webhooks.
7. **Support in your language and time zone.** Fast help matters most during template rejections and number issues.
8. **Data ownership.** You should be able to export contacts and conversations.
9. **Security.** Role-based access, two-step login and audit logs for teams.
10. **Trial or demo.** A short test with your real use case beats any feature page.

If you are still choosing between the free WhatsApp Business app and the API, remember that the app suits one phone and a handful of chats, while the API is built for team inboxes, automation and campaigns at scale.

# Getting started: from sign-up to first campaign

A realistic setup takes a few days, most of it waiting for approvals.

1. **Prepare your business details.** Legal name, website, address and a phone number that is not currently registered on a WhatsApp app, or one you are ready to migrate.
2. **Connect through your provider.** The guided sign-up links your Facebook business account and registers the number.
3. **Submit business verification.** Documents are reviewed by Meta, and a verified business can raise its sending limits.
4. **Create your templates.** Start with a welcome utility template and one marketing offer. Use the [template generator](/tools/whatsapp-template-generator) to draft and check them.
5. **Import and tag opted-in contacts.** Record where each opt-in came from.
6. **Run a small test campaign.** Send to a slice of your list, review delivery and replies, then scale.
7. **Add a chat button and QR code.** Put a click-to-chat link on your website and packaging so new customers can reach you for free in their own window.

# Cost per order: the number that really matters

A cheap message that never sells is more expensive than a costly message that does. Work backwards from the sale.

Suppose a store sends 10,000 marketing messages at ₹0.8631. The Meta cost is ₹8,631. If 2% of recipients place an order, that is 200 orders, so the message cost per order is about ₹43. With an average order margin of ₹300, each order leaves roughly ₹257 before other costs. Now suppose the list is poorly targeted and only 0.5% order. The same ₹8,631 buys 50 orders, which is about ₹173 per order. The price per message did not change; the targeting did.

This is why the best-run accounts watch three ratios every month: delivered rate, reply or click rate, and cost per order. If any of the three slips, fix the audience or the offer before you raise the budget.

# A simple monthly budgeting plan

Use this routine so the bill never surprises you.

1. **Week 0.** List the campaigns planned for the month and the audience size of each. Multiply by the marketing rate.
2. **Week 0.** Estimate transactional volume from last month's orders, bookings or sign-ups. Multiply by the utility rate.
3. **Week 0.** Estimate inbound chats and subtract your free allowance. Multiply the rest by the service rate.
4. **Week 2.** Compare actual delivered messages against the plan. If campaigns are running hot, pause the weakest segment.
5. **Week 4.** Record cost per order and note which templates earned their keep. Retire the rest.

Keep a buffer of 15 to 20% for festival periods, when volumes and replies climb together.

# Common pricing mistakes to avoid

- **Treating every message as marketing.** Order and delivery updates belong in utility, and billing them as marketing wastes money.
- **Putting coupons in utility templates.** It risks re-categorisation and a billing surprise.
- **Ignoring the 24-hour window.** Slow replies push you toward paid templates for conversations you could have answered for free.
- **Comparing only subscription prices.** Message markup and seat charges decide the true monthly total.
- **Sending to unconsented lists.** Blocks and reports lower your rating, which limits scale and wastes spend.
- **Forgetting GST.** An 18% difference changes which quote is cheapest.
- **Scaling before testing.** A weak template sent to a large list is the costliest experiment you can run.

# Pricing trends to watch

WhatsApp pricing has been moving in one direction for some time: toward simpler, per-message rules and clearer separation between categories. A few things are worth watching if you plan a year ahead.

- **More chargeable service traffic.** As free windows narrow, support-heavy businesses should plan for a small but real service line item.
- **Wider free entry windows.** Meta continues to reward chats that start from ads and page buttons, so click-to-WhatsApp is likely to stay a cost-effective way to acquire leads.
- **Volume tiers on utility and authentication.** Larger senders may see lower effective rates, which favours consolidating traffic with one provider.
- **Local currency billing.** Billing in INR removes exchange-rate swings from your budget.
- **Stricter category review.** Expect Meta to look closely at whether a template matches its category, so honest labelling protects both your cost and your approval rate.

Because these rules change, treat any rate table, including ours, as a snapshot. Re-check the official rate card each quarter and update your budget model.

# Quick glossary

- **Delivered message.** A message that reached the customer's device. Only these are billed.
- **Template.** A pre-approved message format required to start a chat or message outside the 24-hour window.
- **Service window.** The 24 hours after a customer's last message to you, during which you can send free-form replies.
- **Free entry point.** A chat opened from a click-to-WhatsApp ad or a page button, which carries a free reply window.
- **Quality rating.** Meta's score for your number, based on how recipients react. It affects sending limits.
- **Platform fee.** What your provider charges for software and support, separate from Meta's message price.
- **Opt-in.** Clear permission from a customer to receive your messages on WhatsApp.
- **Volume tier.** A lower per-message rate that applies once monthly volume passes a threshold, available for some categories.

# Who should use which setup

If you answer a few dozen chats a day and send no campaigns, the free WhatsApp Business app may be enough. The moment you need more than one person answering, scheduled campaigns, a chatbot or order notifications from your store, the API is the right tool and the pricing above starts to apply. Growing brands usually begin with a low-volume plan, prove two or three templates, and move to a larger plan only when response data justifies it. That sequence keeps your first month's spend small and your learning fast.

# Compliance basics that protect your budget

Following Meta's policy is part of cost control, because violations cost you reach and sometimes your account.

- Get clear opt-in and record it.
- Make opting out easy and honour it immediately.
- Do not send prohibited content or misleading offers.
- Keep templates accurate to their category.
- Respond to customer complaints quickly.
- Avoid sending the same message repeatedly to the same user.

A healthy quality rating raises your limits and keeps campaigns running, which is worth more than any single discount.

# Frequently asked questions

## How much does the WhatsApp Business API cost in India?

Meta charges per delivered message: ₹0.8631 for marketing and ₹0.1150 for utility, authentication and service messages (after the free monthly allowance). You also pay your provider's platform fee and GST.

## Is the WhatsApp Business API free?

No. Some messages fall in free windows or allowances, but marketing messages are always charged and a provider normally charges a platform fee. The free WhatsApp Business app is a separate product with limited features.

## What is the difference between marketing and utility messages?

Marketing promotes or sells. Utility supports a transaction or an action the customer already took. Utility costs about one seventh of marketing, so keep transactional messages free of promotion.

## Do I pay for failed messages?

No. Meta charges only for delivered messages.

## Is GST charged on WhatsApp API messages?

Expect 18% GST on your provider's platform fee. Ask for a sample invoice to see how GST is applied to message charges in your account.

## Are replies to customers free?

Replies inside the 24-hour window are free-form, but under the rules from 1 October, service messages are chargeable after a monthly free allowance. Chats started from eligible ads and page buttons get a free entry window.

## What is the 24-hour window?

It opens when a customer messages you. While it is open you can send free-form replies. After it closes you can only send approved templates.

## Do volume discounts apply?

Utility and authentication messages can qualify for volume tiers. The marketing rate shows no standard tier discount, so check with your provider for any commercial terms.

## How much should a small business budget?

A service-led small business can run under a thousand rupees of Meta charges a month. A D2C brand sending two campaigns can expect tens of thousands, with marketing as the largest share. Use the formula above with your own counts.

## Can I switch providers later?

Yes, if your number and data are portable. Ask about number migration and data export before you sign.

## Does AiSend add a markup on Meta's message price?

We keep Meta's message charge visible as a separate line, so you can compare it to Meta's published rate. Ask our team for a quote based on your message mix.

# Final checklist before you pay for anything

- Count expected messages per category.
- Apply the formula and add GST.
- Ask each provider for the all-in price per message.
- Confirm free-window rules and allowances in writing.
- Test with a small campaign before scaling.
- Track cost per order, not only cost per message.

WhatsApp API pricing in India is predictable once you split it into Meta's per-message charge and your provider's fee. Keep transactional messages clean, segment your marketing, use free entry windows, and measure the return. When you are ready to see what your mix would cost on AiSend, [message our team](/contact) and we will build the estimate with you.
