// Simple script to list models using fetch
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("API Key not found in .env");
    process.exit(1);
}

console.log("Using API Key:", apiKey.substring(0, 5) + "...");

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            console.error("Error fetching models:", response.status, response.statusText);
            const text = await response.text();
            console.error(text);
            return;
        }
        const data = await response.json();
        console.log("Output:");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

listModels();
