import { test } from 'node:test';
import assert from 'node:assert';
import { validateChatMessage } from '../src/lib/chat-types';

test('validateChatMessage rejects invalid schema objects', () => {
  const invalidMsg = { id: 123, sender: '', text: null };
  assert.throws(() => validateChatMessage(invalidMsg), /Invalid message format/);
});
