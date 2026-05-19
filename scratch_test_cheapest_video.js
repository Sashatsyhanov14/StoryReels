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

async function testModel(modelName) {
  try {
    const response = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        input: {
          prompt: "cyberpunk car driving fast",
          aspect_ratio: "9:16",
          resolution: "480p",
          duration: "3s"
        },
        async: true
      })
    });
    const result = await response.json();
    console.log(`Model ${modelName}:`, JSON.stringify(result.error || result));
  } catch (err) {
    console.error(`Model ${modelName} Error:`, err);
  }
}

async function run() {
  const models = [
    'kling/v2.5-turbo',
    'google/veo3_fast',
    'bytedance/seedream-5-lite',
    'wan/2.5'
  ];
  for (const model of models) {
    await testModel(model);
  }
}
run();
