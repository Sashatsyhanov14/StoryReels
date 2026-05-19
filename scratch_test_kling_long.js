const fs = require('fs');
const envPath = 'c:\\Users\\ТЕХНОРАЙ\\Downloads\\StoryReels\\.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});
const apiKey = env['POLZA_API_KEY'];

async function run() {
  console.log('Starting Kling video generation (waiting up to 150 seconds)...');
  const start = Date.now();
  try {
    const response = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'kling/v2.5-turbo',
        input: {
          prompt: "cyberpunk car driving fast, neon lights",
          aspect_ratio: "9:16",
          resolution: "480p",
          duration: "3s"
        }
      })
    });

    console.log(`Response received after ${(Date.now() - start)/1000}s, status: ${response.status}`);
    const text = await response.text();
    console.log('Result:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
run();
