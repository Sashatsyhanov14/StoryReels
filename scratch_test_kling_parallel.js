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

async function startGen(index) {
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
          prompt: `cyberpunk scene ${index}, neon lights`,
          aspect_ratio: "9:16",
          resolution: "480p",
          duration: "3s"
        },
        async: true
      })
    });
    const status = response.status;
    const text = await response.text();
    console.log(`Request ${index} Status: ${status}, Response: ${text}`);
  } catch (err) {
    console.error(`Request ${index} Error:`, err);
  }
}

async function run() {
  console.log('Starting 5 parallel Kling requests...');
  await Promise.all([
    startGen(1),
    startGen(2),
    startGen(3),
    startGen(4),
    startGen(5)
  ]);
}
run();
