import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // Direct configuration using your provided Gemini API Key
    const geminiApiKey = "AIzaSyD3qusnHssGCRXvfMHREpe_uIuZAOucgUk";

    // Standard system instructions to anchor the AI's behavior
    const systemInstruction = 
      "You are an AI customer support assistant assisting a live agent over a WhatsApp Business inbox. " +
      "Generate a natural, polite, and highly clear message response to the customer based on their query context template. " +
      "Keep it direct and human-like.";

    // Combined context payload matching Google's standard content structure rules
    const userPrompt = `${systemInstruction}\n\nContext or prompt request: ${prompt}`;

    // Google AI Studio standard endpoint for the Gemini 1.5 Flash model
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    // Executing direct HTTP POST request matching Google's strict JSON schema layout
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: userPrompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 250,
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `HTTP ${response.status} Gemini Error`);
    }

    const data = await response.json();
    
    // Safely parse out the string data from Gemini's nested response blocks
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return NextResponse.json({ reply: replyText.trim() });
  } catch (error) {
    console.error("Gemini AI route error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate reply framework" },
      { status: 500 }
    );
  }
}
