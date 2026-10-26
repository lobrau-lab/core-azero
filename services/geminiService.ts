import { GoogleGenAI } from "@google/genai";

export const getGeminiOptimization = async (channelName: string, type: string) => {
  let apiKey = localStorage.getItem('GEMINI_API_KEY') || (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY || process.env?.API_KEY) : undefined);

  if (!apiKey) {
    apiKey = window.prompt("Please enter your Gemini API Key for AI Optimization:", "");
    if (apiKey) {
      localStorage.setItem('GEMINI_API_KEY', apiKey);
    } else {
      return "Optimization cancelled. API Key is required.";
    }
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const prompt = `Act as a senior audio engineer. Provide optimization suggestions for a ${type} channel named "${channelName}". 
  Suggest specific EQ points (Low, Mid, High), a compression ratio, and a noise gate threshold for professional performance. 
  The mixer has a 3-band EQ (Low Shelf 320Hz, Mid Peaking 1kHz, High Shelf 3200Hz). 
  Respond in brief bullet points.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (err: any) {
    console.error("Gemini failed", err);
    // If it's an auth error, clear the stored key so they can try again next time
    if (err?.message?.toLowerCase().includes('api key') || err?.status === 401 || err?.status === 403) {
      localStorage.removeItem('GEMINI_API_KEY');
      return "API Key is invalid or expired. It has been removed. Please try again.";
    }
    return "Could not fetch AI suggestions at this time.";
  }
};
