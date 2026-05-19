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
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const apiKey = env['POLZA_API_KEY'];

async function run() {
  console.log('Sending request to Polza.ai image API...');
  try {
    const response = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tongyi-mai/z-image',
        input: {
          prompt: "cyberpunk car",
          aspect_ratio: "9:16"
        }
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
