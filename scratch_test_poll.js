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
  const taskId = 'gen_2167994131306909697';
  console.log(`Polling task ${taskId}...`);
  try {
    const response = await fetch(`https://polza.ai/api/v1/media/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });

    if (!response.ok) {
      console.error(`HTTP ${response.status}`);
      return;
    }

    const result = await response.json();
    console.log('Poll Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
run();
