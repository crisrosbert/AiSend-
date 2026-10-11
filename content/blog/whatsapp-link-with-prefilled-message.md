---
title: How to Create a WhatsApp Link with a Pre-filled Message
description: Learn the wa.me link format, how to add a ready-typed message, and the common mistakes that stop a WhatsApp link from working.
date: 2026-10-11
author: Team AiSend
category: Guides
tags: [whatsapp-link, click-to-chat, wa-me]
---

# What a WhatsApp link does

A WhatsApp link, also called a click-to-chat link, opens a conversation with a specific number the moment someone taps it. The person does not need to save your number, search for your name or copy anything into WhatsApp first.

It is an official WhatsApp feature, and the link starts with `wa.me`. That makes it a good fit for any place where you can put a link: a social media bio, a website button, an email signature or a QR code on print.

# The basic format

The simplest link is the address `wa.me/` followed by the full phone number:

```
https://wa.me/919876543210
```

The number has to be written in international format, and nothing else:

- Start with the country code. For India that is `91`.
- Leave out the plus sign, spaces, dashes and brackets.
- Leave out any zero at the start of the local number. A number written as 098765 43210 becomes 9876543210 before the country code is added.

So an Indian mobile number 98765 43210 becomes `919876543210`. If your link already works for you but fails for others, the number is almost always the reason.

# Add a message that is already typed

To open the chat with a message waiting in the text box, add `?text=` to the end of the link and put your message after it:

```
https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20know%20more
```

The message must be URL-encoded, which means special characters are swapped for codes that are safe inside a web address. The ones you will meet most often:

| You want | You write |
|----------|-----------|
| A space | `%20` |
| A comma | `%2C` |
| A new line | `%0A` |
| A question mark | `%3F` |
| An ampersand | `%26` |

Doing this by hand is easy to get wrong, which is why most people use a generator. Our [free WhatsApp link generator](/tools/whatsapp-link-generator) encodes the message for you and shows the finished link as you type.

# The message is not sent for you

A pre-filled message only appears in the text box. The person still has to tap send, so nothing goes out without them choosing to. That is also why it is worth writing a message that is easy to send as it is: short, polite and clear about what they want.

# Let people choose who to message

If you want to share a message without picking the recipient, leave the number out:

```
https://wa.me/?text=Check%20out%20this%20offer
```

WhatsApp then asks the person to choose a contact. This is useful for "share this with a friend" buttons.

# Why a WhatsApp link may not work

Check these first when a link fails:

- **A leading zero or a plus sign.** Remove both from the number.
- **Spaces in the message.** Replace them with `%20`, or let a generator do it.
- **A number that is not on WhatsApp.** The link can only open a chat with a number that has an account.
- **The wrong country code.** A missing or doubled country code opens a chat with a different number, or none.

Always open the finished link on a phone before you share it.

# Use a different message for each place

If the same link goes on Instagram, your website and your email signature, you will not know where a chat came from. Give each place its own opening message, such as "Hi, I found you on Instagram", and you can see the source in the first line of every conversation.

When the chats start arriving, you will want a way to reply as a team and follow up. That is what [AiSend](/whatsapp-business-api) is for.
