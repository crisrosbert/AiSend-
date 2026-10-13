---
title: Why WhatsApp Templates Get Rejected and How to Fix Them
description: The most common reasons Meta rejects a WhatsApp message template, and a simple checklist to fix each one before you submit again.
date: 2026-10-11
author: Team AiSend
category: Guides
tags: [whatsapp-templates, business-api]
cover: https://app.performancemktg.net/covers/whatsappdesktop.webp
coverAlt: WhatsApp Business API pricing in India, rate card illustration

coverMobile: https://app.performancemktg.net/covers/whatsappmobile.webp
---

# A rejection is usually a small mistake

When Meta rejects a WhatsApp message template, it feels like a verdict on your whole message. In practice it is almost always one small thing: a variable written the wrong way, an example left blank, or a promotion filed under the wrong category.

The good news is that these mistakes are easy to catch before you submit. This guide lists the ones that come up most often and how to fix each of them.

# 1. The variables are not written correctly

A variable is a number in double curly braces, such as `{{1}}`. Meta is strict about how they are used.

- **Number them in order.** Start at `{{1}}` and go up with no gaps. If you remove `{{2}}`, renumber the ones after it.
- **Do not start or end with one.** "Hi {{1}}, your order is ready." works. "{{1}}, your order is ready." does not.
- **Do not put two together.** Place real words between variables.
- **Do not use names.** `{{customer_name}}` is not accepted in the standard format.
- **Do not overuse them.** A message that is mostly variables and very little text is rejected.

# 2. The examples are missing or careless

Meta asks for an example value for every variable so a reviewer can read the message as a customer would. Leaving one empty blocks the template. Filling it with "test" or "abc" makes the message look unfinished.

Use realistic values: a first name, an order number that looks like yours, a real-looking date.

# 3. The category does not match the message

Templates fall into three categories: marketing, utility and authentication. A utility template follows up on something the customer did, such as an order, a booking or a payment. If it contains an offer, a discount or a push to buy, Meta treats it as marketing.

This matters twice. A mismatched template can be rejected, and one that is approved under a different category is charged at that category's rate. Ask yourself whether the message would still make sense with every offer removed. If not, choose marketing.

# 4. The message asks for sensitive details

Messages that ask people to reply with a full card number, a bank account number, an ID number or a password are refused. If you only want to remind customers never to share those details, say so without naming each item.

# 5. The tone is threatening

Payment reminders are a common problem. Wording that threatens legal action, mentions the police or tries to shame the customer is rejected. A polite, factual reminder with a clear next step passes far more often:

- Weak: "Pay your dues immediately or face action."
- Better: "Hi Anita, a payment of Rs. 2,499 for invoice INV-0187 is due on 20 November. You can pay with the button below."

# 6. The links are shortened or do not match

Link shorteners such as bit.ly are a frequent cause of rejection, because reviewers cannot see where they lead. Use your own full `https://` address. Check that every link works and points to a site that belongs to your business.

# 7. It looks like spam

Messages written in capital letters, rows of exclamation marks and chain-message wording all read as spam, to reviewers and to customers. Write in normal sentence case with one exclamation mark at most.

# What to do after a rejection

1. **Read the reason.** Meta gives a short explanation. Fix that specific thing.
2. **Change one thing at a time** so you know what worked.
3. **Submit it as a new version,** such as `order_shipped_v2`, rather than reusing the old name.
4. **Do not submit identical copies.** A template with the same content and language as an existing one can be refused as a duplicate.

# Check it before you submit

The free [WhatsApp template generator and approval checker](/tools/whatsapp-template-generator) looks for every problem above. Write your message, see how it looks on a phone, and fix the points it raises. When it is clean, copy the text or the API request.

A clean check does not guarantee approval. Meta reviews every template itself and its rules change from time to time. But it removes the avoidable mistakes, which are the reason most templates are rejected.
