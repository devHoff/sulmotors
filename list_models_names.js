import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env manually
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("API Key not found in .env");
    process.exit(1);
}

const cleanKey = apiKey.replace(/\r$/, '');

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
        if (!response.ok) {
            console.error("Error fetching models:", response.status, response.statusText);
            return;
        }
        const data = await response.json();
        if (data.models) {
            console.log("--- START MODELS ---");
            data.models.forEach(m => console.log(m.name));
            console.log("--- END MODELS ---");
        } else {
            console.log("No models found or unexpected format.");
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
