import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt, conversationId } = await req.json();

    const response = await openai.chat.completions.create({
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
    });

    return NextResponse.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json({ error: "Failed to generate reply framework" }, { status: 500 });
  }
}
