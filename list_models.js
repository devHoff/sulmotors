import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
    const key = process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        console.error("No API Key found");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);
    try {
        // The SDK might not expose listModels directly on the main class easily in all versions,
        // but let's try a direct fetch if the SDK method isn't handy, or use the model-less client if possible.
        // Actually, for this specific SDK version, let's just try to hit the REST API directly to be sure.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        console.log("Available Models:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error listing models:", e);
    }
}

listModels();
