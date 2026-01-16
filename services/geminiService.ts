import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from "../types";

// Helper to convert file to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove data url prefix (e.g. "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const countItemsInImage = async (base64Image: string, mimeType: string) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: `Analyze this image of uniform inventory. Count the total number of items visible.
            Categorize them into 'shirts', 'pants', and 'other'.
            Provide a confidence score (0-100) based on image clarity and occlusion.
            Return ONLY a valid JSON object.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalCount: { type: Type.INTEGER },
            breakdown: {
              type: Type.OBJECT,
              properties: {
                shirts: { type: Type.INTEGER },
                pants: { type: Type.INTEGER },
                other: { type: Type.INTEGER },
              },
            },
            confidence: { type: Type.INTEGER },
            notes: { type: Type.STRING },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);

  } catch (error) {
    console.error("AI Counting Error:", error);
    throw error;
  }
};

export const generateUniformConcept = async (prompt: string, aspectRatio: AspectRatio) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    // Using gemini-3-pro-image-preview as requested for aspect ratio control
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K" // Defaulting to 1K
          },
        },
      });

    // Extract image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image generated");

  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
}