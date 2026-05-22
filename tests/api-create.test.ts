import { test } from 'node:test';
import assert from 'node:assert';
import { POST } from '../src/app/api/episodes/create/route';

test('create route generates Gemini-powered chat messages and returns payload', async () => {
  // Mock request body
  const requestBody = {
    userId: 'c2d19371-5c56-4fe2-a6f5-0f7cda105a56', // Using a valid/existing test UUID
    prompt: 'Переписка с маньяком в чате',
  };

  const request = new Request('http://localhost:3000/api/episodes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const response = await POST(request);
  const data = await response.json();

  if (response.status === 402) {
    console.log('✓ Handled insufficient tokens gracefully (402)');
    return;
  }

  assert.equal(response.status, 200, 'Expected 200 OK or 402: ' + JSON.stringify(data));
  assert.ok(data.episodeId, 'Response should contain episodeId');
  assert.ok(data.payload, 'Response should contain payload');
  assert.ok(Array.isArray(data.payload.messages), 'payload.messages should be an array');
  assert.ok(data.payload.messages.length > 0, 'payload.messages should not be empty');
  
  const firstMsg = data.payload.messages[0];
  assert.ok(firstMsg.id, 'Message should have an id');
  assert.ok(firstMsg.sender, 'Message should have a sender');
  assert.ok(firstMsg.text, 'Message should have text');
});
