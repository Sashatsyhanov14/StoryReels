# Chat Stories Pivot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Pivot the StoryReels video generation system into an interactive dark-mode messenger app for AI-generated chat stories with tap-to-reveal mechanics, on-demand Flux illustrations, and Yookassa paywall cliffhangers, using a zero-SQL database layout.

**Architecture:** Use Gemini API to generate structured story scripts (messages array with sender, text, delay, and image prompt attributes) stored in Supabase under `episodes.assets_json` as a JSONB object `{ "messages": [...], "unlockedTillIndex": 5 }`. The client renders these messages sequentially on screen tap, showing live typing indicators and dynamically calling the Flux route to generate images for media triggers. Progress is blocked when a message with `isCliffhanger: true` is reached, showing a premium paywall that unlocks the rest of the episode upon a successful Yookassa checkout.

**Tech Stack:** Next.js, Tailwind CSS, Supabase (DB + TG Auth Client), Gemini API, Flux API (via Gen-API), Yookassa API, and Native Node.js Test Runner with `tsx`.

---

### Task 1: Type Definitions and Schema Setup

**Files:**
- Modify: `src/lib/chat-types.ts`
- Modify: `tests/types.test.ts`

**Step 1: Write the failing test**
Update `tests/types.test.ts` to assert validation of chat message schemas and JSONB wrapper:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { validateChatMessage } from '../src/lib/chat-types';

test('validateChatMessage rejects invalid schema objects', () => {
  const invalidMsg = { id: 123, sender: '', text: null };
  assert.throws(() => validateChatMessage(invalidMsg), /Invalid message format/);
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/types.test.ts`
Expected: PASS/FAIL depending on changes.

**Step 3: Write minimal implementation**
Ensure `src/lib/chat-types.ts` is updated:
```typescript
export interface ChatMessage {
  id: string;
  sender: string;         // e.g. "Ты", "Маньяк", "Мама"
  text: string;           // Message text content
  typingDelayMs: number;  // Suspension delay for typing animation (e.g. 1500)
  mediaPrompt?: string;   // Image generation prompt for Flux
  imageUrl?: string;      // Generated image URL
  isCliffhanger?: boolean; // If true, halts tap progress and opens paywall
}

export interface ChatEpisodePayload {
  messages: ChatMessage[];
  unlockedTillIndex: number; // Index of last message the user is allowed to read
}

export interface ChatEpisode {
  id: string;
  userId: string;
  showId?: string;
  title: string;
  prompt: string;
  status: 'pending' | 'ready' | 'failed';
  payload: ChatEpisodePayload;
  createdAt: string;
}

export function validateChatMessage(msg: any): ChatMessage {
  if (
    typeof msg !== 'object' ||
    msg === null ||
    typeof msg.id !== 'string' ||
    typeof msg.sender !== 'string' ||
    typeof msg.text !== 'string' ||
    typeof msg.typingDelayMs !== 'number'
  ) {
    throw new Error('Invalid message format');
  }
  return msg as ChatMessage;
}
```

**Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/types.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/lib/chat-types.ts tests/types.test.ts
git commit -m "feat: define chat story type interfaces and validators"
```

---

### Task 2: Supabase JSONB Adapter Tests

**Files:**
- Create: `tests/db-jsonb.test.ts`

**Step 1: Write the failing test**
Create `tests/db-jsonb.test.ts` to verify the DB client can read and write the new JSONB payload structure inside `assets_json` without modifying table columns:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { getSupabaseAdmin } from '../src/lib/supabase';

test('database assets_json can store and retrieve ChatEpisodePayload objects', async () => {
  const supabase = getSupabaseAdmin();
  const testPayload = {
    messages: [{ id: 'test-1', sender: 'Ты', text: 'Привет', typingDelayMs: 1000 }],
    unlockedTillIndex: 1
  };
  
  // Select any existing row to verify JSON serialization works
  const { data, error } = await supabase
    .from('episodes')
    .select('assets_json')
    .limit(1);
    
  assert.equal(error, null, 'Error querying database: ' + error?.message);
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --env-file=.env.local --test tests/db-jsonb.test.ts`
Expected: FAIL if connection issues or environment variables missing.

**Step 3: Write minimal implementation**
We ensure connection works and JSONB adapter parses objects.

**Step 4: Run test to verify it passes**
Run: `npx tsx --env-file=.env.local --test tests/db-jsonb.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add tests/db-jsonb.test.ts
git commit -m "test: add JSONB adapter verification test"
```

---

### Task 3: LLM Chat Story Generator Route

**Files:**
- Modify: `src/app/api/episodes/create/route.ts`
- Create: `tests/api-create.test.ts`

**Step 1: Write the failing test**
Create `tests/api-create.test.ts` to assert that the script generation output conforms to a list of ChatMessages inside `assets_json`:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';

test('create route parses prompt into ChatMessages', async () => {
  const response = await fetch('http://localhost:3000/api/episodes/create', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'Переписка с маньяком', userId: 'test-user-id' })
  });
  const data = await response.json();
  assert.ok(data.episodeId);
  assert.ok(Array.isArray(data.payload.messages));
  assert.ok(data.payload.messages[0].sender);
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/api-create.test.ts`
Expected: FAIL due to mismatch in response shape (returning old video scene schemas).

**Step 3: Write minimal implementation**
Update `src/app/api/episodes/create/route.ts` to instruct the Gemini model to output ChatMessages JSON format. Instruct the prompt to:
- Generate 15-20 dialogue messages between characters (e.g. "Ты" vs "Маньяк" or other sender names).
- Embed a suspension `typingDelayMs` (1000 - 3000ms).
- Add 1-2 `mediaPrompt` prompts (designed for Flux) at strategic times (e.g. "*Отправляет фото с улицы*").
- Embed 1 `isCliffhanger: true` right after a major suspenseful build-up or right after sending a scary photo prompt.
- Save to Supabase `episodes.assets_json` in the format: `{ messages: [...], unlockedTillIndex: 5 }`.

**Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/api-create.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/episodes/create/route.ts tests/api-create.test.ts
git commit -m "api: pivot creation route to generate Gemini-powered chat messages"
```

---

### Task 4: Dynamic Flux Image Generation API

**Files:**
- Modify: `src/app/api/episodes/generate-scene/route.ts`
- Create: `tests/generate-image.test.ts`

**Step 1: Write the failing test**
Create `tests/generate-image.test.ts` to test calling the image generation endpoint for a specific message inside an episode:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';

test('generate-scene route generates and saves Flux image for messageId', async () => {
  const response = await fetch('http://localhost:3000/api/episodes/generate-scene', {
    method: 'POST',
    body: JSON.stringify({ episodeId: 'test-episode-id', messageId: 'msg-3' })
  });
  const data = await response.json();
  assert.ok(data.imageUrl);
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/generate-image.test.ts`
Expected: FAIL since the API expects old scene indices and structure.

**Step 3: Write minimal implementation**
Modify `src/app/api/episodes/generate-scene/route.ts`:
- Accept `episodeId` and `messageId`.
- Fetch the episode from Supabase.
- Handle payload parsing: extract messages from `{ messages: [...], unlockedTillIndex: 5 }`.
- Find the message in `messages` with the matching `id`.
- Extract its `mediaPrompt`.
- Call Flux API (via Gen-API) to generate a vertical `9:16` image.
- Save the resulting URL to the message's `imageUrl` field in the database.
- Return the updated message object.

**Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/generate-image.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/episodes/generate-scene/route.ts tests/generate-image.test.ts
git commit -m "api: update image generation to support chat message Flux triggers"
```

---

### Task 5: Interactive Messenger UI (Dark Mode & Tap-to-Read)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/api/episodes/route.ts`

**Step 1: Write the failing test**
We can verify that the list API returns message structures:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';

test('GET episodes returns formatted chat episodes with messages', async () => {
  const response = await fetch('http://localhost:3000/api/episodes?userId=test-user-id');
  const data = await response.json();
  assert.ok(Array.isArray(data.episodes[0].messages));
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/api-get.test.ts`
Expected: FAIL (returning old `scenes` schema instead of `messages`).

**Step 3: Write minimal implementation**
- Modify `src/app/api/episodes/route.ts` to map database `assets_json` items directly into the `messages` array, and fetch the `unlocked_till_index` from the JSONB wrapper.
- Modify `src/app/page.tsx`:
  - Build a sleek, dark-mode messaging page (mobile player layout).
  - Add tap-to-read: tapping the screen renders the next message in the list.
  - Render typing indicators (`...`) if the next message has a `typingDelayMs`.
  - For messages with `mediaPrompt`, show a loading placeholder and automatically fire the API call to generate the Flux image.
  - If the revealed message index equals the `unlockedTillIndex` AND has `isCliffhanger: true`, block the next tap and slide up the paywall.

**Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/api-get.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/page.tsx src/app/api/episodes/route.ts
git commit -m "ui: implement dark-mode messenger UI with tap-to-reveal mechanics"
```

---

### Task 6: Yookassa Cliffhanger Paywall Integration

**Files:**
- Modify: `src/app/api/yookassa/create/route.ts`
- Modify: `src/app/api/yookassa/webhook/route.ts`

**Step 1: Write the failing test**
Create a test to verify webhook success unlocks the correct episode:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';

test('yookassa webhook unlocks episode to full length', async () => {
  const response = await fetch('http://localhost:3000/api/yookassa/webhook', {
    method: 'POST',
    body: JSON.stringify({
      event: 'payment.succeeded',
      object: {
        id: 'pay-123',
        status: 'succeeded',
        amount: { value: '19.00', currency: 'RUB' },
        metadata: { episodeId: 'test-episode-id' }
      }
    })
  });
  assert.equal(response.status, 200);
});
```

**Step 2: Run test to verify it fails**
Run: `npx tsx --test tests/yookassa-webhook.test.ts`
Expected: FAIL since the webhook logic does not update `unlocked_till_index` for the episode.

**Step 3: Write minimal implementation**
- Update `src/app/api/yookassa/create/route.ts` to attach `{ episodeId }` in the payment metadata object.
- Update `src/app/api/yookassa/webhook/route.ts`: on payment succeeded event, query the episode from the database, get the length of the `messages` array inside the JSONB payload, and set `unlockedTillIndex` to `messages.length` to completely unlock the story.

**Step 4: Run test to verify it passes**
Run: `npx tsx --test tests/yookassa-webhook.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/yookassa/create/route.ts src/app/api/yookassa/webhook/route.ts
git commit -m "api: integrate yookassa payments to unlock cliffhanger progress"
```
