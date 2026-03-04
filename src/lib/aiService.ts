import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Free Professional Photography: Recreates a professional version of the car using Gemini Vision + Pollinations
 */
export async function recreateProfessionalPhoto(imageUrl: string, carBrand: string | undefined, geminiKey: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Analyze the car image to get a high-quality prompt
    const imageResp = await fetch(imageUrl);
    const imageData = await imageResp.arrayBuffer();

    // Browser-compatible way to convert ArrayBuffer to Base64
    const base64Data = btoa(
        new Uint8Array(imageData)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const prompt = `Describe this car in detail for an AI image generator. 
    Focus on: Brand, Model, Color, Year range, Body type, and specific details like rims or trim.
    Output ONLY a single paragraph prompt in English, starting with "A professional studio shot of a...". 
    Context: the car should be in a clean, high-end showroom background with perfect lighting, side profile 45 degree angle.`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
            },
        },
    ]);

    const carDescription = result.response.text().trim();

    // 2. Generate the new image via Pollinations (Free)
    const finalPrompt = encodeURIComponent(carDescription + ", 8k resolution, professional photography, cinematic lighting, showroom background");
    const pollinationsUrl = `https://pollinations.ai/p/${finalPrompt}?width=1280&height=720&model=flux&seed=${Math.floor(Math.random() * 100000)}`;

    return pollinationsUrl;
}
