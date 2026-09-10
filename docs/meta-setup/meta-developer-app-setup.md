# Meta Developer App Setup — InstaAuto/DMSpark

> **Prepared for:** `amitshah995/InstaAuto`, deployed at `insta-auto-flax.vercel.app`
> **Prerequisite check before starting:** Instagram account must be **Business or Creator** type (not Personal). See §0.
> **Reference:** `edge-cases/phase-0-foundations.md` for what commonly goes wrong at each step below (marked ⚠️ inline).

---

## 0. Before you start — confirm these two things

1. **Instagram account type.** Instagram app → Profile → tap the hamburger menu → Settings → if you see "Switch to Professional Account", you're still on Personal — do that switch first (choose Business or Creator). If you already see "Professional Account" / "Creator Tools", you're set.
2. **Business Manager verification status.** Go to `business.facebook.com` → select your business → Settings → Business Info → check if it says **"Verified"**. Write down what you see — it changes Step 3 below (whether you create a new Business Portfolio or reuse an existing verified one).

---

## 1. Create the Meta App

1. Go to `developers.facebook.com/apps` → **"Create App"**
2. App type: choose **"Business"** (not Consumer)
3. Fill in:
   - **App name:** something like `DMSpark` or `InstaAuto Automation` (this name is shown to users on the Instagram OAuth consent screen — don't use "AiSend" here, per our earlier decision to keep this a separate brand identity)
   - **App contact email:** your email
   - **Business Portfolio:** if you found a verified one in step 0.2, select it here. If none exists, create a new one now — verification can happen later, but starting inside the right portfolio saves a migration step.
4. Click **"Create App"**

⚠️ **EC-0-06:** business verification is required before App Review can approve Instagram permissions — but you can build and test with unverified apps first (development mode). Don't block on verification to keep moving.

---

## 2. Add the Instagram product

1. In the app dashboard, left sidebar → **"Add Product"**
2. Find **"Instagram"** → click **"Set Up"**
3. You'll land on the Instagram product's own dashboard. Look for **"Instagram Login"** (sometimes labeled "Instagram Business Login" or "Instagram API setup with Instagram Login") — this is the correct product; do **not** use the older "Instagram Basic Display" product (deprecated, wrong permission set for this use case).

---

## 3. Configure OAuth redirect URI

Still in the Instagram product settings, find **"OAuth redirect URIs"** (or similar):

```
https://insta-auto-flax.vercel.app/api/instagram/callback
```

Add this exact URL. ⚠️ **EC-1.2-18 equivalent:** even a trailing slash mismatch breaks OAuth — copy-paste this exactly, don't retype it.

If you also want to test locally later:
```
http://localhost:3000/api/instagram/callback
```
(Add both — Meta allows multiple redirect URIs.)

---

## 4. Request the permissions (scopes)

In the Instagram product's **"Permissions"** or **"App Review → Permissions and Features"** section, request/add these (they'll show as "Development" access initially, which is enough for testing on your own account):

| Permission | Why |
|---|---|
| `instagram_business_basic` | Basic profile/account access |
| `instagram_business_manage_messages` | Send/receive DMs |
| `instagram_business_manage_comments` | Reply to comments |

Do **not** request `instagram_business_content_publish` or `instagram_business_manage_insights` yet — those are for Reels publishing (Phase 5), not needed now. Requesting only what's used keeps App Review simpler later.

---

## 5. Configure the Webhook

Still in the Instagram product, find **"Webhooks"**:

1. **Callback URL:**
   ```
   https://insta-auto-flax.vercel.app/api/instagram/webhook
   ```
2. **Verify Token:** make up a secure random string yourself — this is NOT provided by Meta, you invent it. Example (generate your own, don't reuse this one):
   ```
   dmspark_wh_9f3a7c2e1b8d4f60
   ```
   **Write this exact value down** — it must match `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` in Vercel env vars (step 7).
3. Click **"Verify and Save"**. Meta will immediately send a `GET` request to your callback URL to confirm it responds correctly.

⚠️ **If verification fails here:**
- Check Vercel isn't password-protecting the deployment (Settings → Deployment Protection → should be OFF, or the webhook path excluded)
- Confirm the app is genuinely live: open `https://insta-auto-flax.vercel.app/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123` directly in a browser — it should return exactly `test123` as plain text, nothing else. If it returns a 403 or JSON error, the `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` env var isn't set yet in Vercel (see step 7 — do that first, then retry this step).

4. **Subscribe to these fields** (checkboxes under the webhook config):
   - `messages`
   - `messaging_postbacks`
   - `comments`
   - `story_insights` (only if you'll test story automation; safe to enable regardless)

---

## 6. Add yourself as a test user (Development mode)

While the app is in Development mode (before App Review), only accounts explicitly added as testers can trigger webhook events for it.

1. App dashboard → **"App Roles"** → **"Roles"**
2. Add your Instagram Business/Creator account's associated Facebook account as an **Administrator** or **Tester**
3. If prompted, accept the role invitation (check notifications on that Facebook account)

⚠️ **EC-0-05:** if you skip this, comments/DMs on your test account will silently produce zero webhook events — no error, just nothing happening. This is the single most common "why isn't it working" cause at this stage.

---

## 7. Fill in the real environment variables (Vercel)

Now that the app exists, go back to **Vercel → your `insta-auto` project → Settings → Environment Variables** and fill in the Instagram ones you left blank earlier:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_INSTAGRAM_APP_ID` | App dashboard → Settings → Basic → "App ID" |
| `INSTAGRAM_APP_ID` | Same value as above |
| `INSTAGRAM_APP_SECRET` | App dashboard → Settings → Basic → "App Secret" (click "Show") |
| `NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI` | `https://insta-auto-flax.vercel.app/api/instagram/callback` |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | The exact string you invented in step 5.2 |

After saving, **redeploy** (Deployments tab → "..." on latest → Redeploy) so the new env vars take effect.

**Order matters:** set these env vars **before** step 5's webhook verification, or verification will fail (the deployed app won't have the token to compare against).

---

## 8. Connect your account and test

1. Go to `insta-auto-flax.vercel.app`, find the "Connect Instagram" button
2. It should redirect you to an Instagram OAuth consent screen showing your app's name
3. Approve → redirected back to your app, now connected
4. Post a test comment on one of your own Reels, or DM your own Business account from a second Instagram account (personal accounts CAN message business accounts, that direction is fine)
5. Check Vercel → your project → **Logs** tab — you should see `[v0] 📩 DM from ...` or comment-processing log lines appear within seconds

If nothing appears in Logs: revisit step 6 (test user role) and step 5 (webhook field subscriptions) first — those two cause 90% of "silence" at this stage.

---

## What NOT to do yet

- Don't submit for **App Review** (Advanced Access) until Task 2–4 from today's ChatGPT work are done and tested — App Review asks for a screencast of working functionality, and reviewers reject apps whose demo doesn't match what's described.
- Don't add `instagram_business_content_publish` scope — not needed until Reels publishing (later phase).
- Don't skip step 6 (test user) thinking Development mode doesn't need it — it does, always.
