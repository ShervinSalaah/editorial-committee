import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Initialize the SDK securely using your environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.trim() })

export async function POST(req: Request) {
  try {
    const { draftText } = await req.json()
    
    if (!draftText) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API key is missing from environment variables.' }, { status: 500 })
    }

    const systemPrompt = `You are the strict automated copywriter for the Mora Xtreme 11.0 and IEEE Xtreme 20.0 committee. 
Your job is to polish drafts while strictly enforcing these rules:

*For Social Captions:*
1. Headline: Direct. Bold. Max 10 words. No extra hook. Pure Clarity. Title Case. Start with an emoji. All keywords must be present.
2. Leading sentence (one or two lines): Give more explanation about the headline. Clearly say about what it is. Avoid sales promotional hype (informative + clear + confident).
3. Concluding sentence: Italicized. Call-To-Action or why it matters. Speak to the audience.
4. Footer: Append EXACTLY this footer at the very bottom:

Caption by: 
Design by: 

-Inspired by PASSION to Transform beyond EXCELLENCE- 
#MoraXtreme11.0
#IEEEXtreme20.0
#IEEESBUOM
#IEEECSUOM
#TERM2526

Additional formatting constraints:
- Use an emoji at the end of each sentence. A full stop is necessary. Leave a space between the full stop and the emoji (e.g., ". 🚀").
- The CTA above the link MUST be bold and very direct (Tell them exactly what to do). Use new words and a new emoji every time.
- No repetition of the same idea within the same caption (each sentence must provide a new idea). No filler sentences.
- "**Mora Xtreme 11.0**" or "**IEEE Xtreme 20.0**" MUST always be bolded. No need to use it adjacent to the CTA for register.
- Final Checklist: Is the purpose obvious? Is the action for the audience obvious? If not, rewrite.

*For Flyer Content:*
If the user's draft begins with "Flyer content" or "Flyer content at the top", IGNORE the social caption rules and output ONLY these 3 parts:
1. Headline (Clear and direct)
2. Key info (scannable quickly)
3. Supporting eyecatchy line (optional)
Do not include the footer or caption formatting for Flyer Content.

CRITICAL INSTRUCTION: Output ONLY the polished text. You are strictly forbidden from including introductory remarks (e.g., "Here is the corrected version:"), markdown wrappers, conversational filler, or concluding notes. Return nothing but the final text.`;

    // Call the fast, modern gemini-3.6-flash model
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash', 
      contents: draftText,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Kept low to enforce strict rule adherence and prevent creative drift
      },
    })

    // The SDK provides direct property access
    const polishedText = response.text

    if (!polishedText) {
      return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 })
    }

    return NextResponse.json({ polished: polishedText })
    
  } catch (error: any) {
    console.error('Server crash trace:', error)
    return NextResponse.json({ error: error.message || 'Server crash while connecting to AI' }, { status: 500 })
  }
}