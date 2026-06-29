import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY not set — /api/ai/respond disabled");
      return NextResponse.json(
        { error: "AI suggest is not configured." },
        { status: 503 },
      );
    }

    const systemInstruction = 
      "You are an AI customer support assistant assisting a live agent over a WhatsApp Business inbox. " +
      "Generate a natural, polite, and highly clear message response to the customer based on their query context template. " +
      "Keep it direct and human-like.";

    const userPrompt = `${systemInstruction}\n\nContext or prompt request: ${prompt}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Gemini Raw API Error Payload:", errorText);
      return NextResponse.json({ error: `Google API rejected request: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ reply: replyText.trim() });
  } catch (error) {
    console.error("Global AI routing process failure:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal system routing timeout" },
      { status: 500 }
    );
  }
}
