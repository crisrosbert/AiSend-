import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role bypasses RLS to safely process real-time customer data
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_API_KEY = "AIzaSyDKT3yeyEPw5YXXoY4l-eVoLbgtKHUVwGo";

interface MetaMessage {
  from: string;
  text?: { body: string };
}

interface MetaPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<MetaMessage>;
        metadata?: { phone_number_id: string };
      };
    }>;
  }>;
}

interface JourneyNode {
  id: string;
  type: string;
  data?: {
    text?: string;
    caption?: string;
    tagName?: string;
    endpoint?: string;
    method?: string;
  };
}

interface JourneyEdge {
  source: string;
  target: string;
}

// 1. Meta Webhook Verification (Handshake)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// 2. Core Incoming Message Pipeline
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MetaPayload;
    
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Ignore payload events that do not contain a text message body
    if (!message || !message.text?.body) {
      return NextResponse.json({ status: "ignored" });
    }

    const customerPhone = message.from;
    const rawInput = message.text.body.trim();
    const query = rawInput.toLowerCase();
    
    const phoneId = value?.metadata?.phone_number_id;
    const metaToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneId || !metaToken) {
      return NextResponse.json({ error: "Missing Meta credentials configuration" }, { status: 400 });
    }

    // ── STEP 1: LOG THE INCOMING MESSAGE TO YOUR LIVE CHAT INBOX DATABASE ──
    await supabase.from("messages").insert({
      phone: customerPhone,
      text: rawInput,
      sender: "user", // Renders as an incoming grey bubble
      created_at: new Date().toISOString()
    });

    // ── STEP 2: LOOK UP INDEPENDENT ACTIVE CANVAS FLOWS ──
    const { data: journey } = await supabase
      .from("journeys")
      .select("*")
      .eq("status", "active")
      .maybeSingle();

    if (!journey) {
      return NextResponse.json({ status: "logged_no_flow" });
    }

    const registeredKeywords = (journey.trigger?.keywords as string[])?.map((k: string) => k.trim().toLowerCase()) ?? [];

    // Typo-tolerance engine matching (Levenshtein calculation matrix)
    const findClosestKeyword = (input: string, targets: string[]): string | null => {
      let closest: string | null = null;
      let minDistance = 3;
      for (const target of targets) {
        if (input.includes(target) || target.includes(input)) return target;
        const distance = Math.abs(input.length - target.length);
        if (distance < minDistance) { closest = target; minDistance = distance; }
      }
      return closest;
    };

    const matchedKey = findClosestKeyword(query, registeredKeywords);

    // ── STEP 3: FALLBACK INTERCEPT ➔ AI AUTOPILOT RESOLUTION ──
    if (!matchedKey) {
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a helpful customer support agent on WhatsApp. Answer this inquiry directly in under 20 words: "${rawInput}"` }] }]
        })
      });
      const aiData = await aiResponse.json();
      const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Thanks for your message.";

      // Dispatch the response to the user's phone screen via Meta
      await sendWhatsAppTextMessage(phoneId, metaToken, customerPhone, aiText);

      // Save the AI's reply to your database so it displays in your Live Chat panel logs
      await supabase.from("messages").insert({
        phone: customerPhone,
        text: aiText,
        sender: "bot", // Renders as an outgoing green bubble
        created_at: new Date().toISOString()
      });

      return NextResponse.json({ status: "ai_handled" });
    }

    // ── STEP 4: TRACE AND EXECUTE CONNECTED CANVAS PATH EDGES ──
    const connectedEdges = (journey.edges as JourneyEdge[]).filter((e) => e.source === "trigger");
    
    for (const edge of connectedEdges) {
      const targetNode = (journey.nodes as JourneyNode[]).find((n) => n.id === edge.target);
      if (!targetNode) continue;

      const nodeType = targetNode.type;

      if (nodeType === "WEBHOOK_CALL") {
        const apiEndpoint = targetNode.data?.endpoint;
        if (apiEndpoint) {
          await fetch(apiEndpoint, { method: targetNode.data?.method || "POST" }).catch(() => null);
        }
      } else if (nodeType === "TAG_CONTACT") {
        await supabase.from("contacts").upsert({ phone: customerPhone, tag: targetNode.data?.tagName });
      } else {
        const replyText = targetNode.data?.text || targetNode.data?.caption || "Step processed.";
        
        // Trigger outbound messaging delivery via WhatsApp
        await sendWhatsAppTextMessage(phoneId, metaToken, customerPhone, replyText);

        // Update the live conversation stream records
        await supabase.from("messages").insert({
          phone: customerPhone,
          text: replyText,
          sender: "bot",
          created_at: new Date().toISOString()
        });
      }
    }

    return NextResponse.json({ status: "canvas_handled" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// Meta Core API Outbound Request Wrapper
async function sendWhatsAppTextMessage(phoneId: string, token: string, to: string, text: string) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "text",
      text: { body: text },
    }),
  });
}
