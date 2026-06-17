import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key configuration" }, { status: 500 });
    }

    // Direct HTTP POST to OpenAI endpoints using standard fetch
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI customer support assistant assisting a live agent over a WhatsApp Business inbox. Generate a natural, polite, and highly clear message response to the customer based on their query context template. Keep it direct and human-like.",
          },
          { role: "user", content: `Context or prompt request: ${prompt}` },
        ],
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ reply: replyText });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate reply framework" },
      { status: 500 }
    );
  }
}
