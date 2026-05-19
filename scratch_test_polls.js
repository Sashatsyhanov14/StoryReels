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

async function poll(taskId) {
  const response = await fetch(`https://polza.ai/api/v1/media/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  console.log(`Server Date for ${taskId}:`, response.headers.get('date'));
  return response.json();
}

async function run() {
  const veoTask = 'gen_2168023737418256385';
  const klingTask = 'gen_2168001072022032385';
  
  const veoRes = await poll(veoTask);
  const klingRes = await poll(klingTask);
  
  const now = Math.floor(Date.now() / 1000);
  console.log(`Veo Status: ${veoRes.status} (elapsed: ${now - veoRes.created}s)`);
  if (veoRes.data) console.log('Veo URL:', JSON.stringify(veoRes.data));
  if (veoRes.error) console.log('Veo Error:', JSON.stringify(veoRes.error));

  console.log(`Kling Status: ${klingRes.status} (elapsed: ${now - klingRes.created}s)`);
  if (klingRes.data) console.log('Kling URL:', JSON.stringify(klingRes.data));
  if (klingRes.error) console.log('Kling Error:', JSON.stringify(klingRes.error));
}
run();
