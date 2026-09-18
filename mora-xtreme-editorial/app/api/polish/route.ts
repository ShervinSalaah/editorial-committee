import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// Initialize the SDK securely using your environment variable [3]
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

    // Call the fast, modern gemini-3.6-flash model
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash', 
      contents: draftText,
      config: {
        systemInstruction: `You are an expert copywriter for a university hackathon (Mora Xtreme and IEEEXtreme). 
        Fix any grammatical errors and add appropriate, professional emojis to the provided PR caption. 
        Do not change the core message, and keep the tone energetic but professional.
        
        CRITICAL INSTRUCTION: Output ONLY the polished text. You are strictly forbidden from including introductory remarks (e.g., "Here is the corrected version:"), markdown wrappers, conversational filler, or concluding notes. Return nothing but the final caption.`,
        temperature: 0.2, // Lowered further to prevent creative conversational drift
      },
    })

    // The SDK provides direct property access instead of messy object arrays [3]
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
