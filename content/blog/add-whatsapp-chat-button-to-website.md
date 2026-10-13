---
title: How to Add a WhatsApp Chat Button to Your Website
description: A step-by-step guide to adding a floating WhatsApp chat button to WordPress, Shopify, Wix and any HTML website, with no plugin needed.
date: 2026-10-11
author: Team AiSend
category: Guides
tags: [chat-widget, click-to-chat, whatsapp-link]

cover: https://app.performancemktg.net/covers/blog-add-whatsapp-chat-button-to-websitedesktop.webp
coverAlt: WhatsApp Business API pricing in India, rate card illustration

coverMobile: https://app.performancemktg.net/covers/blog-add-whatsapp-chat-button-to-websitemobile.webp
---

# What you are adding

A WhatsApp chat button is a small round button that floats in the corner of your website. When a visitor clicks it, WhatsApp opens with a chat to your business number and, if you wrote one, a first message already typed in.

It works because the button is a normal WhatsApp link, the kind that starts with `wa.me`. That means it needs no special account, and it works with the WhatsApp Business app and with a number on the WhatsApp Business API.

# Step 1: Make the button

Open the free [WhatsApp chat button generator](/tools/whatsapp-chat-widget) and:

1. Choose your country and type your WhatsApp number.
2. Write the first message people should send, such as "Hi! I have a question about your products."
3. Pick a colour, a side of the screen and a size.
4. Decide whether to add a short welcome popup and write your greeting.
5. Check the live preview on the computer and the phone view.

# Step 2: Copy the code

Press **Copy code**. You get one block that contains the styles, the button and a small script. Nothing else needs to be linked, and the button loads nothing from other websites.

# Step 3: Paste it into your website

Paste the block just before the closing body tag of your pages. Where that is depends on your platform.

## WordPress

Install a plugin that adds code to the footer, such as WPCode or Insert Headers and Footers. Open it, paste the block into the footer box and save. This is safer than editing theme files, which a theme update can overwrite.

## Shopify

In your admin, go to Online Store, then Themes. Beside your live theme choose the three dots and then Edit code. Open the file named `theme.liquid` and paste the block above the closing body tag. Save. It is wise to duplicate your theme first, so you can go back if something goes wrong.

## Wix

Open your site settings, find Custom code and add a new snippet. Paste the block, set it to load at the end of the body on all pages, then apply and publish. Custom code may need a paid plan.

## Squarespace

Go to Settings, then Developer tools, then Code injection. Paste the block into the footer box and save. Code injection is available on some plans only.

## Webflow

Open your project settings and choose Custom code. Paste the block into the footer code box, save and publish.

## Plain HTML

Open the page or template in an editor, paste the block above the closing body tag, and upload the file again. If your pages share a layout file, paste it there once.

# Step 4: Test it

Open your website in a private browser window so you are not looking at a cached version. You should see the button in the corner. Click it. If you added a popup, it opens after the delay you chose, and its button opens WhatsApp with your first message.

Then try it on your phone. Make sure the button does not cover a price, a form field or a buy button.

# If the button does not show

- **Clear the cache.** A caching plugin or your host may be serving an old copy of the page.
- **Check where you pasted.** It must be inside the page, before the closing body tag.
- **Look at your plugins.** Some security and speed plugins remove scripts from custom code.
- **Check the device setting.** A button set to phones only will not appear on a computer.

# Next steps

A button gets visitors to message you. What happens next decides whether they buy. Reply quickly, and give each page its own first message so you can see which one brings chats. Our guide to [writing a popup that gets clicks](/blog/whatsapp-chat-widget-best-practices) covers wording, timing and placement.
