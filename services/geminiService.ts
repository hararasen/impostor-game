import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface TopicResponse {
  category: string;
  topic: string;
}

export const generateGameTopic = async (): Promise<TopicResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a creative, common-knowledge topic for a social deduction game (like Spyfall). It should be a specific place, object, profession, or activity.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: "The general category (e.g., 'Location', 'Job', 'Food')",
            },
            topic: {
              type: Type.STRING,
              description: "The specific secret word (e.g., 'Submarine', 'Pizza Chef', 'Eiffel Tower')",
            },
          },
          required: ["category", "topic"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as TopicResponse;
    }
    throw new Error("No text returned from Gemini");
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if API fails
    const fallbacks = [
      { category: "Location", topic: "The Beach" },
      { category: "Job", topic: "Astronaut" },
      { category: "Object", topic: "Smartphone" },
      { category: "Activity", topic: "Camping" }
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
};
