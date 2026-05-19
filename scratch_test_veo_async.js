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
  console.log('Sending async request to Polza.ai media API with Veo...');
  try {
    const response = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/veo3_fast',
        input: {
          prompt: "cyberpunk car driving fast on a wet neon highway, highly dynamic, 4k",
          aspect_ratio: "9:16",
          resolution: "480p",
          duration: "3s"
        },
        async: true
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`HTTP ${response.status} Error: ${text}`);
      return;
    }

    const result = await response.json();
    console.log('Success:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
run();
